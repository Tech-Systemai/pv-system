import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { QUALIFY_AT, channelStats, checkEmail, identifyChannel, personalize, scoreWillingness, talkingPoints } from '../pipeline';
import type { Lead, LeadSignals, Niche, Outreach } from '../types';
import { pickEmail } from './apify';
import { admin, agentId, logEvent, setDesk } from './runtime';

// Research: read the lead's website and Google reviews, have Claude pull out
// the facts, then run the same scoring / channel / compliance rules the rest of
// the HQ uses. Qualified leads land on the founder's call list or as a
// compliance-checked email draft.

const MODEL = 'claude-opus-5';
const PAGE_CHARS = 12_000;
const MAX_ATTEMPTS = 2;

const Findings = z.object({
  owner_name: z.string().describe('Owner or principal\'s full name if the site or reviews name one, else ""'),
  owner_email: z.string().describe('A personal email for the owner if one appears on the site, else ""'),
  hours_24_7: z.boolean().describe('Advertises 24/7, emergency or after-hours service'),
  staff_estimate: z.number().int().describe('Best estimate of team size (1 = solo). Use team pages, "our techs", truck counts, review mentions'),
  office_staff: z.boolean().describe('Evidence of office/admin staff (office manager, dispatch, "call our office")'),
  missed_call_reviews: z.boolean().describe('Any review complains about unanswered calls, voicemail, slow callbacks or hard to reach'),
  years_in_business: z.number().int().describe('Years in business if stated or derivable from "since 19xx", else 0'),
  research_notes: z.string().describe('One short sentence (under 30 words) a salesperson would want before contacting them'),
});
type FindingsT = z.infer<typeof Findings>;

// ── Website reading ────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OctopusEnginesResearch/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return '';
    return (await res.text()).slice(0, 1_500_000);
  } catch {
    return '';
  }
}

function pageText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cloudflare's email protection hides addresses as data-cfemail="hex"; decode them. */
function cloudflareEmails(html: string): string[] {
  return [...html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map(([, hex]) => {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out.toLowerCase();
  });
}

/** Ad-platform tags in the page source are hard evidence they pay for leads. */
function adEvidence(html: string): string {
  const found: string[] = [];
  if (/googleadservices\.com|['"]AW-\d{6,}['"]|gtag\(\s*['"]config['"]\s*,\s*['"]AW-/.test(html)) found.push('Google Ads tag');
  if (/connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init['"]/.test(html)) found.push('Meta pixel');
  return found.length ? `${found.join(' + ')} on their website` : '';
}

async function readSite(website: string) {
  if (!website) return { text: '', ads: '', emails: [] as string[] };
  const base = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  let origin = base;
  try { origin = new URL(base).origin; } catch { /* keep as given */ }
  const pages = await Promise.all([base, `${origin}/about`, `${origin}/contact`].map(fetchPage));
  const html = pages.join('\n');
  const found = [...(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map(e => e.toLowerCase()), ...cloudflareEmails(html)];
  const emails = [...new Set(found)]
    .filter(e => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/sentry|wixpress|example\.com|domain\.com/.test(e));
  const text = pages
    .map((p, i) => (p ? `[${['Home', 'About', 'Contact'][i]} page]\n${pageText(p).slice(0, PAGE_CHARS)}` : ''))
    .filter(Boolean)
    .join('\n\n');
  return { text, ads: adEvidence(html), emails };
}

// ── Claude ─────────────────────────────────────────────────────────────────────

let client: Anthropic | null = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  client ??= new Anthropic();
  return client;
}

const SYSTEM = `You research home-service contractors (plumbers, roofers, HVAC, etc.) for Octopus Engines, which sells them 24/7 AI call answering and missed-call text-back.
From the business's website text and Google reviews, report only what the evidence supports. When something is not stated or implied, use "" for text, 0 for numbers and false for yes/no. Do not guess an owner email from a generic inbox.`;

async function extract(lead: Lead, site: { text: string; emails: string[] }): Promise<FindingsT> {
  const reviews = (lead.signals.reviews_sample ?? []).map((r, i) => `${i + 1}. ${r}`).join('\n');
  const content = [
    `Business: ${lead.business_name} (${lead.signals.category || lead.niche}) in ${lead.city}${lead.state ? `, ${lead.state}` : ''}`,
    `Google: ${lead.rating ?? '?'}★ from ${lead.review_count} reviews`,
    site.emails.length ? `Emails found on the site: ${site.emails.join(', ')}` : 'No emails found on the site.',
    site.text ? `Website text:\n${site.text}` : 'No website text could be read.',
    reviews ? `Recent Google reviews:\n${reviews}` : 'No review text available.',
  ].join('\n\n');

  const res = await claude().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
    // Fact extraction, not open-ended reasoning: medium effort holds quality at lower cost.
    output_config: { format: zodOutputFormat(Findings), effort: 'medium' },
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to research this business');
  if (!res.parsed_output) throw new Error(`No structured result (stop reason: ${res.stop_reason})`);
  return res.parsed_output;
}

// ── One lead ───────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof admin>;

async function researchOne(db: Db, lead: Lead, niche: Niche | undefined, researcherId: string | null) {
  await setDesk(db, 'research-qualifier', 'working', `Researching ${lead.business_name}`);
  const site = await readSite(lead.website);
  const f = await extract(lead, site);

  const signals: LeadSignals = {
    ...lead.signals,
    has_website: !!lead.website && !!site.text,
    runs_ads: !!site.ads,
    ads_evidence: site.ads,
    hours_24_7: f.hours_24_7,
    staff_estimate: Math.max(1, f.staff_estimate || 1),
    office_staff: f.office_staff,
    missed_call_reviews: f.missed_call_reviews,
    years_in_business: f.years_in_business || undefined,
    research_notes: f.research_notes.split('\n')[0].slice(0, 280),
  };
  let email = lead.email;
  const ownerEmail = f.owner_email.trim().toLowerCase();
  if (ownerEmail && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(ownerEmail)) {
    email = ownerEmail;
    signals.email_type = 'owner';
  } else if (!email && site.emails.length) {
    const found = pickEmail(site.emails);
    email = found.email;
    signals.email_type = found.type;
  }

  const scored = { ...lead, email, signals, owner_name: f.owner_name || lead.owner_name };
  const { score, reasons } = scoreWillingness(scored);
  if (site.ads) {
    // Say where the ad signal came from, not just that it exists.
    const r = reasons.find(x => x.text.startsWith('Already pays'));
    if (r) r.text = `Already pays for ads — ${site.ads}`;
  }

  // Channel results so far for this niche feed the call-or-email decision.
  const { data: nicheLeads } = await db.from('ai_leads').select('id, niche').eq('niche', lead.niche).limit(5000);
  const ids = (nicheLeads ?? []).map(l => l.id);
  const { data: outs } = ids.length
    ? await db.from('ai_outreach').select('lead_id, channel, status').in('lead_id', ids.slice(0, 1000))
    : { data: [] };
  const stats = channelStats(lead.niche, (nicheLeads ?? []) as Lead[], (outs ?? []) as Outreach[]);
  const ch = identifyChannel(scored, niche, stats);
  const qualified = score >= QUALIFY_AT;
  const now = new Date().toISOString();

  await db.from('ai_leads').update({
    email, owner_name: scored.owner_name, signals,
    status: qualified ? 'qualified' : 'disqualified',
    wtp_score: score, wtp_reasons: reasons,
    contact_channel: ch.channel, channel_confidence: ch.confidence, channel_reasons: ch.reasons,
    talking_points: ch.channel === 'call' ? talkingPoints(scored) : [],
    researched_by: researcherId, researched_at: now, updated_at: now,
  }).eq('id', lead.id);

  if (!qualified) {
    await logEvent(db, 'research-qualifier', 'progress',
      `{agent} passed on ${lead.business_name} (${score}/100) — ${reasons.find(r => r.weight < 0)?.text.toLowerCase() ?? 'low willingness to pay'}`);
    return 'passed';
  }
  await logEvent(db, 'research-qualifier', 'handoff',
    `{agent} qualified ${lead.business_name} (${score}/100) · ${ch.channel} first — ${ch.reasons[0]?.text.toLowerCase() ?? ''}`);

  if (ch.channel === 'call') {
    await db.from('ai_outreach').insert({ lead_id: lead.id, channel: 'call', status: 'to_call', agent_id: await agentId(db, 'research-callprep') });
    await logEvent(db, 'research-callprep', 'request', `{agent} added ${lead.business_name} to your call list · ${niche?.name ?? lead.niche}`);
    return 'call';
  }

  // Email: personalise the niche template, then the compliance gate decides.
  const sender = { name: process.env.OUTREACH_SENDER_NAME || '{sender_name}', address: process.env.OUTREACH_SENDER_ADDRESS || '{sender_address}' };
  const copy = { name: niche?.name ?? lead.niche, ghl_url: niche?.ghl_url ?? '' };
  const subject = personalize(niche?.template_subject ?? '', scored, copy, sender);
  const body = personalize(niche?.template_body ?? '', scored, copy, sender);
  const issues = checkEmail(subject, body);
  await db.from('ai_outreach').insert({
    lead_id: lead.id, channel: 'email', status: issues.length ? 'blocked' : 'scheduled',
    subject, body, compliance_issues: issues, agent_id: await agentId(db, 'outreach-writer'),
  });
  await logEvent(db, 'outreach-writer', 'handoff', `{agent} drafted an email to ${lead.business_name} — sent to Compliance`);
  await logEvent(db, 'compliance-email', issues.length ? 'alert' : 'progress', issues.length
    ? `{agent} blocked the email to ${lead.business_name}: ${issues[0]}`
    : `{agent} cleared the email to ${lead.business_name}${niche?.template_approved ? '' : ` — waiting on your ${niche?.name ?? ''} template approval to send`}`);
  return 'email';
}

// ── Batch ──────────────────────────────────────────────────────────────────────

/** Research up to `limit` new leads (oldest first), a few at a time. */
export async function researchBatch(limit = 5, concurrency = 3) {
  const db = admin();
  const { data: rows } = await db.from('ai_leads').select('*').eq('status', 'new').order('created_at', { ascending: true }).limit(limit);
  const leads = (rows ?? []) as Lead[];
  if (!leads.length) return { researched: 0, qualified: 0, failed: 0 };

  // Claim them so an overlapping run skips them.
  await db.from('ai_leads').update({ status: 'researching', updated_at: new Date().toISOString() }).in('id', leads.map(l => l.id)).eq('status', 'new');
  const { data: nicheRows } = await db.from('ai_niches').select('*');
  const niches = (nicheRows ?? []) as Niche[];
  const researcherId = await agentId(db, 'research-qualifier');

  let qualified = 0, failed = 0;
  const queue = [...leads];
  const worker = async () => {
    for (let lead = queue.shift(); lead; lead = queue.shift()) {
      try {
        const out = await researchOne(db, lead, niches.find(n => n.key === lead!.niche), researcherId);
        if (out !== 'passed') qualified += 1;
      } catch (e) {
        failed += 1;
        const attempts = ((lead.signals as LeadSignals & { research_attempts?: number }).research_attempts ?? 0) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await db.from('ai_leads').update({
          status: giveUp ? 'disqualified' : 'new',
          signals: { ...lead.signals, research_attempts: attempts, research_error: String((e as Error).message ?? e).slice(0, 300) },
          updated_at: new Date().toISOString(),
        }).eq('id', lead.id);
        await logEvent(db, 'research-qualifier', 'alert', `Research failed on ${lead.business_name}${giveUp ? ' (gave up)' : ' — will retry'}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, leads.length) }, worker));
  await setDesk(db, 'research-qualifier', 'idle');
  return { researched: leads.length, qualified, failed };
}

