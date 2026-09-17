import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Prayer times for the Smart Time section, from the public AlAdhan API.
// Proxied rather than called from the browser so the response can be cached and
// the timings normalised into plain "HH:MM" before they reach the planner.
//
//   /api/prayer-times?city=Cairo&country=Egypt&method=5&school=0&date=2026-09-16
//   /api/prayer-times?lat=30.04&lng=31.24            (coordinates win over city)
//   /api/prayer-times?city=Cairo                     (no country → address lookup)
//
// Endpoint choice follows the API's own rules: timingsByCity needs *both* city
// and country, so a city on its own goes to timingsByAddress instead.

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'] as const;

// AlAdhan mirrors, tried in order — the same API behind three hostnames.
const HOSTS = [
  'https://api.aladhan.com/v1',
  'https://aladhan.api.islamic.network/v1',
];

/** The order `tune` expects. Anything we don't offer stays at 0. */
const TUNE_ORDER = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'sunset', 'isha', 'midnight'] as const;

/** AlAdhan returns values like "05:12 (EET)" — the planner wants "05:12". */
function cleanTime(raw: unknown): string {
  return typeof raw === 'string' ? (raw.trim().match(/^\d{1,2}:\d{2}/)?.[0] ?? '') : '';
}

/** AlAdhan wants DD-MM-YYYY; the portal passes YYYY-MM-DD. */
function toAladhanDate(iso: string | null): string {
  const today = new Date();
  const source = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [y, m, d] = source.split('-');
  return `${d}-${m}-${y}`;
}

/** Only pass an integer through when it is one the API accepts. */
function intParam(raw: string | null, allowed: (value: number) => boolean): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && allowed(value) ? value : null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const city = (q.get('city') ?? '').trim();
  const country = (q.get('country') ?? '').trim();
  const lat = q.get('lat');
  const lng = q.get('lng');
  const date = toAladhanDate(q.get('date'));

  const params = new URLSearchParams();

  // Left unset, the API picks the calculation method closest to the location,
  // which is a better default than forcing one school on everybody.
  const method = intParam(q.get('method'), v => (v >= 0 && v <= 23) || v === 99);
  if (method !== null) params.set('method', String(method));
  // Moonsighting Committee is the one method that needs a twilight choice.
  if (method === 15) params.set('shafaq', q.get('shafaq') ?? 'general');

  const school = intParam(q.get('school'), v => v === 0 || v === 1);
  if (school !== null) params.set('school', String(school));

  // Matters at high latitudes, where Fajr and Isha otherwise drift absurdly.
  const latAdjust = intParam(q.get('latitudeAdjustment'), v => v >= 1 && v <= 3);
  if (latAdjust !== null) params.set('latitudeAdjustmentMethod', String(latAdjust));

  // Per-prayer minute offsets, so the times can be lined up with a local mosque.
  const tuneRaw = q.get('tune');
  if (tuneRaw) {
    try {
      const offsets = JSON.parse(tuneRaw) as Record<string, unknown>;
      const csv = TUNE_ORDER.map(key => {
        const value = Number(offsets[key]);
        return Number.isInteger(value) && Math.abs(value) <= 60 ? value : 0;
      });
      if (csv.some(v => v !== 0)) params.set('tune', csv.join(','));
    } catch {
      // A malformed tune is not worth failing the whole lookup over.
    }
  }

  let path: string;
  if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    params.set('latitude', String(Number(lat)));
    params.set('longitude', String(Number(lng)));
    path = `/timings/${date}`;
  } else if (city && country) {
    params.set('city', city);
    params.set('country', country);
    path = `/timingsByCity/${date}`;
  } else if (city) {
    // No country given — the address endpoint takes a free-form place instead.
    params.set('address', city);
    path = `/timingsByAddress/${date}`;
  } else {
    return NextResponse.json(
      { error: 'Set your city or coordinates in Smart Time settings first.' },
      { status: 400 },
    );
  }

  let lastError = 'Could not reach the prayer time service.';

  for (const host of HOSTS) {
    try {
      // Times for a given place and day never change, so a long cache is safe.
      const res = await fetch(`${host}${path}?${params}`, { next: { revalidate: 21_600 } });

      if (!res.ok) {
        // The API puts a readable reason in `data` ("Geocoding is temporarily
        // unavailable", "Please specify a valid city and country") — pass it on
        // rather than inventing our own wording.
        const body = await res.json().catch(() => null);
        const reported = typeof body?.data === 'string' ? body.data : '';

        // A 400 is this request's fault, so a mirror would reject it the same way.
        if (res.status === 400) {
          return NextResponse.json(
            { error: reported || 'That place was not recognised. Check the spelling, or set coordinates instead.' },
            { status: 400 },
          );
        }
        lastError = reported || `Prayer time service returned ${res.status}.`;
        continue;
      }

      const json = await res.json();
      const timings = json?.data?.timings;
      if (!timings) {
        lastError = 'Prayer time service sent no timings.';
        continue;
      }

      const cleaned: Record<string, string> = {};
      for (const key of PRAYER_KEYS) {
        const value = cleanTime(timings[key]);
        if (value) cleaned[key] = value;
      }

      const hijri = json?.data?.date?.hijri;
      const hijriDate = hijri
        ? `${hijri.day} ${hijri.month?.en ?? ''} ${hijri.year} ${hijri.designation?.abbreviated ?? 'AH'}`
            .replace(/\s+/g, ' ')
            .trim()
        : '';

      const meta = json?.data?.meta ?? {};
      return NextResponse.json({
        timings: cleaned,
        hijriDate,
        timezone: meta.timezone ?? '',
        // What the API actually used — the point of leaving method unset.
        methodName: meta.method?.name ?? '',
        methodId: meta.method?.id ?? null,
        place: city ? [city, country].filter(Boolean).join(', ') : `${lat}, ${lng}`,
        // Only echoed back for a coordinate lookup: on the city and address
        // endpoints meta.latitude comes back as a placeholder (8.8888888), even
        // though the timings themselves are correctly geocoded.
        coordinates: lat && lng ? { lat: Number(lat), lng: Number(lng) } : null,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'unknown error';
    }
  }

  return NextResponse.json({ error: `${lastError} Please try again shortly.` }, { status: 502 });
}
