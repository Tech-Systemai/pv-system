import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { checkEmail } from '../pipeline';
import type { Lead, Niche, OutreachSettings } from '../types';
import { admin, agentId, logEvent, setDesk } from './runtime';

// Quill writes one email per lead, from that lead's research, not a template.
// Shield (the compliance check) runs on the finished email before it can be
// approved. Nothing here sends; Post does that after approval.

const MODEL = 'claude-opus-5';

const Draft = z.object({
  skip: z.boolean().describe('true only if the research is too thin to write something genuinely specific'),
  skip_reason: z.string().describe('Why, when skip is true; otherwise ""'),
  subject: z.string().describe('2 to 6 words, specific to them, lowercase is fine, no clickbait, never "Re:" or "Fwd:"'),
  body: z.string().describe('Greeting through the closing question. Plain text, 50 to 110 words, no signature, no links'),
  personal_hook: z.string().describe('The specific fact from the research the email is built on'),
  expected_reply: z.string().describe('The one-line reply this email is designed to get'),
});
type DraftT = z.infer<typeof Draft>;

let client: Anthropic | null = null;
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  client ??= new Anthropic();
  return client;
}

function system(s: OutreachSettings) {
  return `You write cold emails for ${s.sender_name}${s.sender_title ? `, ${s.sender_title}` : ''} at Octopus Engines to owners of home-service businesses.

What we sell: ${s.offer || '24/7 AI call answering and instant missed-call text-back for home-service businesses, so no call goes unanswered.'}
${s.proof ? `Proof we can mention (only if it fits naturally): ${s.proof}` : 'We have no case studies to cite yet, so do not invent any numbers, clients or results.'}
The reply we want: ${s.call_to_action || 'a quick yes to seeing a short demo of how it would handle their calls'}.

How to write it:
- Open with something specific to this business from the research: a review theme, a claim on their site, how they operate. Never a generic compliment and never "I hope this finds you well".
- Connect that detail to calls they are likely missing and what a missed call costs in their trade.
- One short paragraph on what we do, in plain words. No feature lists, no hype, no exclamation marks, no emojis, no links.
- End with one easy question that the reply we want answers, the kind someone can answer with "yes" from their phone.
- Write like a person, not a company. First name greeting if we know the owner, otherwise "Hi there".
- Only state facts the research supports. Never invent names, numbers or quotes.`;
}

function leadBrief(lead: Lead, niche?: Niche) {
  const s = lead.signals;
  const facts = [
    `Business: ${lead.business_name} — ${niche?.name ?? lead.niche} in ${lead.city}${lead.state ? `, ${lead.state}` : ''}`,
    lead.owner_name ? `Owner: ${lead.owner_name}` : 'Owner: unknown',
    `Google: ${lead.rating ?? '?'}★, ${lead.review_count} reviews`,
    s.ads_evidence ? `Advertising: ${s.ads_evidence}` : null,
    s.hours_24_7 ? 'Advertises 24/7 or emergency service' : null,
    s.staff_estimate ? `Team size: about ${s.staff_estimate}${s.office_staff ? ', with office staff' : ''}` : null,
    s.missed_call_reviews ? 'Some reviews complain about calls not being answered or slow callbacks' : null,
    s.years_in_business ? `In business ~${s.years_in_business} years` : null,
    s.research_notes ? `Researcher's note: ${s.research_notes}` : null,
    `Why we think they would buy: ${lead.wtp_reasons.filter(r => r.weight > 0).slice(0, 4).map(r => r.text).join('; ')}`,
  ].filter(Boolean);
  const reviews = (s.reviews_sample ?? []).slice(0, 6).map(r => `- "${r.slice(0, 300)}"`).join('\n');
  return `${facts.join('\n')}${reviews ? `\n\nRecent Google reviews:\n${reviews}` : ''}`;
}

/** Signature, postal address and opt-out come from settings, never from the model. */
export function withFooter(body: string, s: OutreachSettings) {
  return `${body.trim()}

${s.sender_name}${s.sender_title ? `\n${s.sender_title}, Octopus Engines` : '\nOctopus Engines'}
${s.postal_address}

Not a fit? Reply "no thanks" and I won't reach out again.`;
}

export function settingsReady(s: OutreachSettings | null): s is OutreachSettings {
  return !!s && !!s.sender_name.trim() && !!s.postal_address.trim();
}

export async function draftFor(lead: Lead, niche: Niche | undefined, s: OutreachSettings, revisionNotes = '', previous = ''): Promise<DraftT> {
  const content = revisionNotes
    ? `${leadBrief(lead, niche)}\n\nYour previous draft:\n${previous}\n\nThe founder wants this changed: ${revisionNotes}\nRewrite the email with that change.`
    : leadBrief(lead, niche);
  const res = await claude().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: system(s),
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(Draft) },
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to write this email');
  if (!res.parsed_output) throw new Error(`No draft returned (stop reason: ${res.stop_reason})`);
  return res.parsed_output;
}

type Db = ReturnType<typeof admin>;

export async function loadSettings(db: Db): Promise<OutreachSettings | null> {
  const { data } = await db.from('ai_outreach_settings').select('*').eq('id', 'default').maybeSingle();
  return (data as OutreachSettings | null) ?? null;
}

/** Write the next email-first leads' emails (qualified, has an email, nothing drafted yet). */
export async function writeBatch(limit = 5) {
  const db = admin();
  const settings = await loadSettings(db);
  if (!settingsReady(settings)) return { written: 0, skipped: 0, failed: 0, waiting: 'settings' as const };

  const { data: rows } = await db.from('ai_leads').select('*')
    .eq('status', 'qualified').eq('contact_channel', 'email').neq('email', '')
    .order('wtp_score', { ascending: false }).limit(50);
  const { data: existing } = await db.from('ai_outreach').select('lead_id').in('lead_id', (rows ?? []).map(r => r.id));
  const done = new Set((existing ?? []).map(e => e.lead_id));
  const leads = ((rows ?? []) as Lead[]).filter(l => !done.has(l.id)).slice(0, limit);
  if (!leads.length) return { written: 0, skipped: 0, failed: 0 };

  const { data: nicheRows } = await db.from('ai_niches').select('*');
  const niches = (nicheRows ?? []) as Niche[];
  const quill = await agentId(db, 'outreach-writer');
  let written = 0, skipped = 0, failed = 0;

  for (const lead of leads) {
    const niche = niches.find(n => n.key === lead.niche);
    await setDesk(db, 'outreach-writer', 'working', `Writing to ${lead.business_name}`);
    try {
      const d = await draftFor(lead, niche, settings);
      if (d.skip) {
        skipped += 1;
        await db.from('ai_outreach').insert({ lead_id: lead.id, channel: 'email', status: 'skipped', notes: `Quill skipped: ${d.skip_reason}`, agent_id: quill });
        await logEvent(db, 'outreach-writer', 'progress', `{agent} skipped ${lead.business_name}: ${d.skip_reason}`);
        continue;
      }
      const body = withFooter(d.body, settings);
      const issues = checkEmail(d.subject, body);
      await db.from('ai_outreach').insert({
        lead_id: lead.id, channel: 'email', status: issues.length ? 'blocked' : 'draft',
        subject: d.subject, body, compliance_issues: issues, personal_hook: d.personal_hook,
        notes: `Expected reply: ${d.expected_reply}`, agent_id: quill,
      });
      written += 1;
      await logEvent(db, 'outreach-writer', 'review', `{agent} wrote to ${lead.business_name} — built on: ${d.personal_hook}`);
      await logEvent(db, 'compliance-email', issues.length ? 'alert' : 'progress', issues.length
        ? `{agent} blocked the email to ${lead.business_name}: ${issues[0]}`
        : `{agent} cleared the email to ${lead.business_name} — waiting for your approval`);
    } catch (e) {
      failed += 1;
      await logEvent(db, 'outreach-writer', 'alert', `{agent} could not write to ${lead.business_name}: ${(e as Error).message}`);
    }
  }
  await setDesk(db, 'outreach-writer', 'idle');
  return { written, skipped, failed };
}

/** Founder asked for changes: rewrite one draft with their note. */
export async function rewriteOne(outreachId: string, notes: string) {
  const db = admin();
  const settings = await loadSettings(db);
  if (!settingsReady(settings)) throw new Error('Fill in your sender name and postal address first');
  const { data: o } = await db.from('ai_outreach').select('*').eq('id', outreachId).single();
  if (!o) throw new Error('Email not found');
  const { data: lead } = await db.from('ai_leads').select('*').eq('id', o.lead_id).single();
  const { data: niche } = await db.from('ai_niches').select('*').eq('key', lead?.niche ?? '').maybeSingle();
  await setDesk(db, 'outreach-writer', 'revising', `Rewriting to ${lead?.business_name}`);
  const d = await draftFor(lead as Lead, (niche as Niche) ?? undefined, settings, notes, `Subject: ${o.subject}\n\n${o.body}`);
  const body = withFooter(d.body, settings);
  const issues = checkEmail(d.subject, body);
  const { data: row } = await db.from('ai_outreach').update({
    status: issues.length ? 'blocked' : 'draft', subject: d.subject, body, compliance_issues: issues,
    personal_hook: d.personal_hook, notes: `Expected reply: ${d.expected_reply}`, updated_at: new Date().toISOString(),
  }).eq('id', outreachId).select().single();
  await setDesk(db, 'outreach-writer', 'idle');
  await logEvent(db, 'outreach-writer', 'revision', `{agent} rewrote the email to ${lead?.business_name}: ${notes}`);
  return row;
}
