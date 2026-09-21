import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { checkEmail } from '../pipeline';
import type { Lead, Niche, OutreachSettings } from '../types';
import { skillsFor } from './jobs';
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
  const base = s.home_base || 'Tampa';
  return `You are ${s.sender_name}${s.sender_title ? `, ${s.sender_title}` : ''} at Octopus Engines, a small software company in ${base}. You email owners of home-service businesses nearby, one at a time.

What we do: ${s.offer}
${s.proof ? `Proof you may mention if it fits: ${s.proof}` : 'We have no case studies to quote yet, so never invent clients, numbers or results.'}
What you want back: ${s.call_to_action || 'a yes to a short video call'}.

Write it like a neighbour who actually looked them up, not a vendor working a list:
- First line: one specific thing about THIS business, in your own words — something a review said, a claim on their site, how they run their day. Name the town or neighbourhood when it fits. Never a generic compliment, never "I hope this finds you well", never "I came across your website".
- Then connect that to the calls they are probably missing, in their own terms: the after-hours call, the one that comes while they are under a sink or on a roof.
- Then one plain sentence about what we built, as software you run for them. No feature lists, no jargon, no hype, no exclamation marks, no emojis, no links.
- Close by asking if they are free for a quick video call this week, phrased as a simple question they can answer with yes.
- 60 to 110 words. Short paragraphs, one or two sentences each. Sign-off is added for you: do not write one.
- Be truthful: only say things the research supports, and never claim you have called them, met them, or worked with anyone they know.`;
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

const NL = '\n';
const OPT_OUT_LINE = 'Not a fit? Reply "no thanks" and I won\'t reach out again.';

/** Signature, postal address and opt-out come from settings, never from the model. */
export function withFooter(body: string, s: OutreachSettings) {
  const sign = s.sender_title
    ? `${s.sender_name}${NL}${s.sender_title}, Octopus Engines`
    : `${s.sender_name}${NL}Octopus Engines`;
  return [body.trim(), sign, s.postal_address, OPT_OUT_LINE].join(NL + NL);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const br = (t: string) => esc(t).split(NL).join('<br>');

/** The same email as HTML, with the logo under the signature. */
export function asHtml(text: string, s: OutreachSettings) {
  const parts = text.split(/\n\s*\n/);
  const optOut = parts.pop() ?? '';
  const address = parts.pop() ?? '';
  const sign = parts.pop() ?? '';
  const body = parts.map(p => `<p style="margin:0 0 14px">${br(p)}</p>`).join('');
  const logo = s.logo_url
    ? `<img src="${esc(s.logo_url)}" alt="Octopus Engines" width="120" style="display:block;margin:0 0 8px;max-width:120px;height:auto">`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430">${body}` +
    `<div style="margin-top:18px">${logo}<div style="font-size:14px;color:#1f2430">${br(sign)}</div>` +
    `<div style="font-size:12px;color:#8b93a1;margin-top:6px">${esc(address)}</div>` +
    `<div style="font-size:11px;color:#a3aab6;margin-top:10px">${esc(optOut)}</div></div></div>`;
}

export function settingsReady(s: OutreachSettings | null): s is OutreachSettings {
  return !!s && !!s.sender_name.trim() && !!s.postal_address.trim();
}

export async function draftFor(lead: Lead, niche: Niche | undefined, s: OutreachSettings, revisionNotes = '', previous = ''): Promise<DraftT> {
  const skills = await skillsFor('outreach-writer', 'outreach');
  const content = revisionNotes
    ? `${leadBrief(lead, niche)}\n\nYour previous draft:\n${previous}\n\nThe founder wants this changed: ${revisionNotes}\nRewrite the email with that change.`
    : leadBrief(lead, niche);
  const res = await claude().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: system(s) + skills,
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
