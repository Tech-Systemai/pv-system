import { NICHE_PROFILE } from './org';
import type { Channel, Lead, Niche, Outreach, Reason } from './types';

// The rules Research and Compliance work by. Phase 2 puts Claude in front of
// these (reading sites and reviews to fill in the signals), but the scoring,
// the call-or-email decision and the compliance gate stay here so they are
// explainable and the same for every lead.

export const QUALIFY_AT = 60;

// ── Willingness to pay ─────────────────────────────────────────────────────────

export function scoreWillingness(lead: Pick<Lead, 'niche' | 'signals' | 'review_count' | 'rating'>): { score: number; reasons: Reason[] } {
  const s = lead.signals;
  const p = NICHE_PROFILE[lead.niche];
  const reasons: Reason[] = [];
  const add = (weight: number, text: string) => reasons.push({ weight, text });

  if (s.runs_ads) add(20, 'Already pays for Google / Facebook ads — spends to get calls');
  if (s.missed_call_reviews) add(15, 'Reviews complain about calls not being answered');
  if (lead.review_count >= 50) add(12, `Established: ${lead.review_count} reviews`);
  else if (lead.review_count >= 15) add(6, `${lead.review_count} reviews — steady business`);
  else if (lead.review_count < 8) add(-12, `Only ${lead.review_count} reviews — may be too small to pay`);
  if ((s.staff_estimate ?? 1) >= 4) add(10, `Team of ~${s.staff_estimate} — enough volume to miss calls`);
  else if ((s.staff_estimate ?? 1) <= 1) add(-6, 'Solo operator — tighter budget');
  if (s.hours_24_7 || p?.emergency) add(8, s.hours_24_7 ? 'Advertises 24/7 service — after-hours calls matter' : 'Emergency trade — calls come at all hours');
  if (p?.highTicket) add(8, 'High-ticket jobs — every missed lead is expensive');
  if (s.has_website) add(5, 'Maintains a website');
  else add(-8, 'No website — less invested in marketing');
  if ((lead.rating ?? 0) > 0 && (lead.rating ?? 0) < 3.8) add(-6, `Low rating (${lead.rating}) — bigger problems than missed calls`);

  const score = Math.max(0, Math.min(100, 30 + reasons.reduce((t, r) => t + r.weight, 0)));
  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { score, reasons };
}

// ── Call or email ──────────────────────────────────────────────────────────────

export type ChannelStats = Record<Channel, { attempts: number; positive: number }>;

/** Replies/interest per channel for one niche, from outreach that has an outcome. */
export function channelStats(nicheKey: string, leads: Lead[], outreach: Outreach[]): ChannelStats {
  const inNiche = new Set(leads.filter(l => l.niche === nicheKey).map(l => l.id));
  const stats: ChannelStats = { call: { attempts: 0, positive: 0 }, email: { attempts: 0, positive: 0 } };
  for (const o of outreach) {
    if (!inNiche.has(o.lead_id)) continue;
    const done = o.channel === 'email'
      ? ['sent', 'replied', 'bounced'].includes(o.status)
      : ['no_answer', 'callback', 'interested', 'booked', 'not_interested'].includes(o.status);
    if (!done) continue;
    stats[o.channel].attempts += 1;
    if (['replied', 'interested', 'booked', 'callback'].includes(o.status)) stats[o.channel].positive += 1;
  }
  return stats;
}

const MIN_ATTEMPTS = 10;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function identifyChannel(
  lead: Pick<Lead, 'niche' | 'signals' | 'email' | 'website'>,
  niche: Pick<Niche, 'name' | 'channel_mode'> | undefined,
  stats?: ChannelStats,
): { channel: Channel; confidence: number; reasons: Reason[] } {
  const s = lead.signals;
  const p = NICHE_PROFILE[lead.niche];
  const reasons: Reason[] = [];
  const add = (toward: Channel, weight: number, text: string) => reasons.push({ toward, weight, text });

  const emailType = s.email_type ?? (lead.email ? 'generic' : 'none');
  if (emailType === 'none') add('call', 40, 'No email address found');
  else if (emailType === 'owner') add('email', 25, 'Owner\'s direct email found');
  else add('email', 6, 'Only a generic inbox (info@ / office@)');

  if (p?.emergency) add('call', 20, 'Emergency trade — owners live on the phone');
  else if (p) add('email', 18, 'Planned, higher-ticket jobs — office reads the inbox');

  if (s.office_staff || (s.staff_estimate ?? 0) >= 5) add('email', 10, 'Has office staff handling admin');
  else if ((s.staff_estimate ?? 1) <= 2) add('call', 12, 'Owner-operated — the owner picks up');
  if (s.hours_24_7) add('call', 8, 'Advertises 24/7 — phone is their main channel');
  if (!s.has_website && !lead.website) add('call', 10, 'No website to research an email from');

  // What has actually worked for this niche outranks the trade profile once there is enough data.
  if (stats && stats.call.attempts >= MIN_ATTEMPTS && stats.email.attempts >= MIN_ATTEMPTS) {
    const cr = stats.call.positive / stats.call.attempts;
    const er = stats.email.positive / stats.email.attempts;
    if (Math.abs(cr - er) >= 0.02) {
      const win: Channel = cr > er ? 'call' : 'email';
      add(win, Math.min(30, Math.round(Math.abs(cr - er) * 200)),
        `In ${niche?.name ?? 'this niche'}, calls convert ${pct(cr)} vs email ${pct(er)}`);
    }
  }

  const call = reasons.filter(r => r.toward === 'call').reduce((t, r) => t + r.weight, 0);
  const email = reasons.filter(r => r.toward === 'email').reduce((t, r) => t + r.weight, 0);
  let channel: Channel = call >= email ? 'call' : 'email';
  let confidence = Math.min(95, 50 + Math.round(Math.abs(call - email) * 0.8));

  // A niche you locked wins, except an email lock cannot email a lead with no address.
  if (niche && niche.channel_mode !== 'auto') {
    if (niche.channel_mode === 'email' && emailType === 'none') {
      reasons.unshift({ toward: 'call', weight: 0, text: `${niche.name} is locked to email, but there is no address — calling instead` });
      channel = 'call';
    } else {
      reasons.unshift({ toward: niche.channel_mode, weight: 0, text: `You locked ${niche.name} to ${niche.channel_mode}` });
      channel = niche.channel_mode;
      confidence = 100;
    }
  }
  reasons.sort((a, b) => b.weight - a.weight);
  return { channel, confidence, reasons };
}

export type NicheChannelView = {
  channel: Channel;
  basis: 'locked' | 'results' | 'research' | 'trade';
  detail: string;
  split: Record<Channel, number>;
  stats: ChannelStats;
};

/** The niche-level answer to "call or email?", and what it rests on. */
export function nicheChannel(niche: Niche, leads: Lead[], outreach: Outreach[]): NicheChannelView {
  const stats = channelStats(niche.key, leads, outreach);
  const researched = leads.filter(l => l.niche === niche.key && l.contact_channel);
  const split = {
    call: researched.filter(l => l.contact_channel === 'call').length,
    email: researched.filter(l => l.contact_channel === 'email').length,
  };
  if (niche.channel_mode !== 'auto') {
    return { channel: niche.channel_mode, basis: 'locked', detail: `Locked by you`, split, stats };
  }
  if (stats.call.attempts >= MIN_ATTEMPTS && stats.email.attempts >= MIN_ATTEMPTS) {
    const cr = stats.call.positive / stats.call.attempts;
    const er = stats.email.positive / stats.email.attempts;
    return {
      channel: cr >= er ? 'call' : 'email', basis: 'results',
      detail: `Results: calls ${pct(cr)} positive (${stats.call.attempts}) vs email ${pct(er)} (${stats.email.attempts})`,
      split, stats,
    };
  }
  if (split.call + split.email >= 5) {
    const channel: Channel = split.call >= split.email ? 'call' : 'email';
    const share = split[channel] / (split.call + split.email);
    return { channel, basis: 'research', detail: `Research picked ${channel} for ${pct(share)} of ${split.call + split.email} leads`, split, stats };
  }
  const p = NICHE_PROFILE[niche.key];
  return {
    channel: p?.emergency ? 'call' : 'email', basis: 'trade',
    detail: p?.emergency ? 'Starting point: emergency trade, owners answer the phone' : 'Starting point: planned jobs, office staff read email',
    split, stats,
  };
}

// ── Talking points for the founder's call list ─────────────────────────────────

export function talkingPoints(lead: Pick<Lead, 'business_name' | 'niche' | 'signals' | 'review_count' | 'city'>): string[] {
  const s = lead.signals;
  const out: string[] = [];
  if (s.missed_call_reviews) out.push('Open with their reviews: customers say calls go unanswered.');
  if (s.runs_ads) out.push('They pay for ads — every unanswered call wastes that spend.');
  if (s.hours_24_7) out.push('They advertise 24/7: ask who picks up at 2am.');
  if ((s.staff_estimate ?? 1) <= 2) out.push('Owner-operated: they can\'t answer while on a job. Lead with text-back.');
  if (lead.review_count >= 50) out.push(`${lead.review_count} reviews — frame it as protecting a strong reputation.`);
  if (NICHE_PROFILE[lead.niche]?.highTicket) out.push('High-ticket jobs: one saved call can pay for a year.');
  if (out.length === 0) out.push(`Ask how they handle calls while the team is out on ${lead.city} jobs.`);
  return out.slice(0, 4);
}

// ── Email personalisation and compliance ───────────────────────────────────────

export function personalize(
  tpl: string,
  lead: Pick<Lead, 'business_name' | 'owner_name' | 'city'>,
  niche: Pick<Niche, 'name' | 'ghl_url'>,
  sender = { name: '{sender_name}', address: '{sender_address}' },
) {
  const first = lead.owner_name.split(/\s+/)[0] || 'there';
  return tpl
    .replace(/\{first_name\}/g, first)
    .replace(/\{business\}/g, lead.business_name)
    .replace(/\{city\}/g, lead.city)
    .replace(/\{niche\}/g, niche.name)
    .replace(/\{niche_lower\}/g, niche.name.toLowerCase())
    .replace(/\{landing_page\}/g, niche.ghl_url || '{landing_page}')
    .replace(/\{sender_name\}/g, sender.name)
    .replace(/\{sender_address\}/g, sender.address);
}

const SPAM_WORDS = ['100% free', 'act now', 'guarantee', 'risk-free', 'no obligation', 'winner', 'cash bonus', 'urgent', '$$$', 'click here'];

/** CAN-SPAM basics plus deliverability red flags. Empty list = clear to send. */
export function checkEmail(subject: string, body: string): string[] {
  const issues: string[] = [];
  const text = `${subject}\n${body}`.toLowerCase();
  if (!/(reply\s+"?stop|unsubscribe|opt[\s-]?out)/i.test(body)) issues.push('No way to opt out (CAN-SPAM requires one)');
  if (/\{sender_address\}/.test(body) || !/\d{2,}.*\b(st|street|ave|avenue|rd|road|blvd|suite|ste|dr|drive|fl)\b/i.test(body)) {
    issues.push('Missing a real postal address (CAN-SPAM requires one)');
  }
  if (/^\s*(re|fwd?):/i.test(subject)) issues.push('Subject pretends to be a reply or forward');
  const hits = SPAM_WORDS.filter(w => text.includes(w));
  if (hits.length) issues.push(`Spam-trigger words: ${hits.join(', ')}`);
  if (/\{[a-z_]+\}/.test(body.replace(/\{sender_address\}/g, '')) || /\{[a-z_]+\}/.test(subject)) issues.push('Unfilled placeholder left in the message');
  if ((body.match(/https?:\/\//g) ?? []).length > 2) issues.push('More than 2 links — looks like spam to Gmail');
  if (body.length > 1400) issues.push('Too long for a first touch');
  return issues;
}
