// Google Maps pulls through Apify's compass/crawler-google-places actor. A run
// takes a minute or more, so it is started with an ad-hoc webhook that calls
// the portal back when the dataset is ready.

const ACTOR = 'compass~crawler-google-places';
const API = 'https://api.apify.com/v2';

/** What we ask Google Maps for in each niche. */
export const SEARCH_TERMS: Record<string, string[]> = {
  plumbing: ['plumber'],
  hvac: ['hvac contractor', 'air conditioning repair'],
  electrical: ['electrician'],
  garage_door: ['garage door repair'],
  restoration: ['water damage restoration'],
  roofing: ['roofing contractor'],
  remodeling: ['kitchen remodeling', 'bathroom remodeling'],
  pools: ['pool builder'],
  windows: ['window replacement', 'door installation'],
  landscaping: ['landscaping company'],
};

export type MapsItem = {
  title?: string;
  categoryName?: string;
  placeId?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  address?: string;
  totalScore?: number;
  reviewsCount?: number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  emails?: string[];
  reviews?: { text?: string | null; stars?: number }[];
};

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error('APIFY_TOKEN is not set');
  return t;
}

export async function startMapsRun(opts: { niche: string; city: string; max: number; webhookUrl: string }) {
  const input = {
    searchStringsArray: SEARCH_TERMS[opts.niche] ?? [opts.niche],
    locationQuery: opts.city,
    maxCrawledPlacesPerSearch: opts.max,
    language: 'en',
    skipClosedPlaces: true,
    maxReviews: 10,
    scrapeContacts: true,
  };
  const webhooks = Buffer.from(JSON.stringify([{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
    requestUrl: opts.webhookUrl,
  }])).toString('base64');

  const res = await fetch(`${API}/acts/${ACTOR}/runs?token=${token()}&webhooks=${encodeURIComponent(webhooks)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Apify returned ${res.status}`);
  return { runId: json.data?.id as string, datasetId: json.data?.defaultDatasetId as string };
}

export async function fetchDataset(datasetId: string): Promise<MapsItem[]> {
  const res = await fetch(`${API}/datasets/${datasetId}/items?token=${token()}&clean=true&format=json`);
  if (!res.ok) throw new Error(`Apify dataset returned ${res.status}`);
  return res.json();
}

/** Owner-looking address first; generic inboxes last. */
export function pickEmail(emails: string[] | undefined): { email: string; type: 'owner' | 'generic' | 'none' } {
  const list = (emails ?? []).map(e => e.trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e));
  if (!list.length) return { email: '', type: 'none' };
  const generic = /^(info|office|contact|hello|admin|service|support|sales|team|mail|help|jobs|careers|billing|dispatch|schedule)@/;
  const owner = list.find(e => !generic.test(e));
  return owner ? { email: owner, type: 'owner' } : { email: list[0], type: 'generic' };
}

/** "123 Main St, Tampa, FL 33602, United States" → Tampa / FL. Maps often leaves city/state empty. */
function cityState(item: MapsItem, fallbackCity: string) {
  if (item.city) return { city: item.city, state: item.state ?? '' };
  const parts = (item.address ?? '').split(',').map(p => p.trim()).filter(Boolean);
  const stateIdx = parts.findIndex(p => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p));
  if (stateIdx > 0) return { city: parts[stateIdx - 1], state: parts[stateIdx].slice(0, 2) };
  const [c, s] = fallbackCity.split(',').map(p => p.trim());
  return { city: c ?? '', state: (s ?? '').slice(0, 2).toUpperCase() };
}

export function toLeadRow(item: MapsItem, niche: string, searchedCity = '') {
  const { email, type } = pickEmail(item.emails);
  const { city, state } = cityState(item, searchedCity);
  const reviews = (item.reviews ?? []).map(r => (r.text ?? '').trim()).filter(Boolean).slice(0, 10);
  return {
    niche,
    business_name: (item.title ?? '').trim(),
    city,
    state,
    phone: item.phone ?? '',
    email,
    website: item.website ?? '',
    rating: item.totalScore ?? null,
    review_count: item.reviewsCount ?? 0,
    source: 'google_maps',
    signals: {
      email_type: type,
      has_website: !!item.website,
      place_id: item.placeId ?? '',
      category: item.categoryName ?? '',
      reviews_sample: reviews,
    },
    status: 'new',
  };
}
