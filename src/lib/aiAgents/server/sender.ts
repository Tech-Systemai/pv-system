import { isWorkHours } from '../hours';
import type { OutreachSettings } from '../types';
import { buildMime, firstReply, mailbox, sendMessage } from './gmail';
import { admin, logEvent, setDesk } from './runtime';
import { loadSettings, settingsReady } from './writer';

// Post sends from the connected inbox and watches for replies. Because the
// inbox is on the main octopusengines.com domain, sending is deliberately
// slow: a warm-up ramp, office hours only, a couple per run, and never the
// same address twice.

const PER_RUN = 2;

/** How many a day the inbox may send, growing as it earns reputation. */
export function warmupCap(connectedAt: string, limit: number) {
  const days = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 86_400_000);
  const ramp = days < 7 ? 8 : days < 14 ? 15 : days < 21 ? 25 : limit;
  return Math.min(ramp, limit, 50);
}

export async function sentLast24h(db: ReturnType<typeof admin>, email: string) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from('ai_outreach').select('id', { count: 'exact', head: true })
    .eq('channel', 'email').eq('from_email', email).gte('sent_at', since);
  return count ?? 0;
}

export async function sendBatch() {
  const db = admin();
  const settings = await loadSettings(db);
  if (!settingsReady(settings)) return { sent: 0, reason: 'settings' };
  if (!isWorkHours()) return { sent: 0, reason: 'outside office hours (9–5 ET)' };
  const box = await mailbox();
  if (!box) return { sent: 0, reason: 'no inbox connected' };

  const cap = warmupCap(box.connectedAt, (settings as OutreachSettings).daily_limit);
  const room = Math.min(PER_RUN, cap - (await sentLast24h(db, box.email)));
  if (room <= 0) return { sent: 0, reason: `daily limit reached (${cap})` };

  const statuses = settings.auto_send ? ['scheduled', 'draft'] : ['scheduled'];
  const { data: queue } = await db.from('ai_outreach').select('id, lead_id, subject, body, status')
    .eq('channel', 'email').in('status', statuses).order('approved_at', { ascending: true, nullsFirst: false }).limit(room * 3);
  let sent = 0;

  for (const o of queue ?? []) {
    if (sent >= room) break;
    const { data: lead } = await db.from('ai_leads').select('id, business_name, email').eq('id', o.lead_id).single();
    if (!lead?.email) continue;
    // Never email the same address twice.
    const { count: prior } = await db.from('ai_outreach').select('id, ai_leads!inner(email)', { count: 'exact', head: true })
      .eq('channel', 'email').not('sent_at', 'is', null).eq('ai_leads.email', lead.email);
    if (prior) {
      await db.from('ai_outreach').update({ status: 'skipped', error: 'Already emailed this address', updated_at: new Date().toISOString() }).eq('id', o.id);
      continue;
    }
    await setDesk(db, 'outreach-sender', 'working', `Sending to ${lead.business_name}`);
    try {
      const raw = buildMime({ from: box.email, fromName: settings.sender_name, to: lead.email, subject: o.subject, body: o.body });
      const msg = await sendMessage(box, raw);
      const now = new Date().toISOString();
      await db.from('ai_outreach').update({
        status: 'sent', sent_at: now, from_email: box.email, gmail_message_id: msg.id, gmail_thread_id: msg.threadId, updated_at: now,
      }).eq('id', o.id);
      await db.from('ai_leads').update({ status: 'contacted', updated_at: now }).eq('id', lead.id);
      await logEvent(db, 'outreach-sender', 'done', `{agent} sent the email to ${lead.business_name} from ${box.email}`);
      sent += 1;
    } catch (e) {
      const msg = (e as Error).message;
      await db.from('ai_outreach').update({ status: 'failed', error: msg, updated_at: new Date().toISOString() }).eq('id', o.id);
      await logEvent(db, 'outreach-sender', 'alert', `{agent} could not send to ${lead.business_name}: ${msg}`);
    }
  }
  await setDesk(db, 'outreach-sender', 'idle');
  return { sent };
}

const OPT_OUT = /\b(no thanks|not interested|unsubscribe|remove me|stop emailing|take me off)\b/i;

/** Look for replies, bounces and opt-outs on emails sent in the last three weeks. */
export async function checkReplies() {
  const db = admin();
  const box = await mailbox();
  if (!box) return { replies: 0 };
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const { data: sent } = await db.from('ai_outreach').select('id, lead_id, gmail_thread_id')
    .eq('channel', 'email').eq('status', 'sent').not('gmail_thread_id', 'is', null).gte('sent_at', since).limit(60);
  let replies = 0;
  for (const o of sent ?? []) {
    const r = await firstReply(box, o.gmail_thread_id!);
    if (!r) continue;
    const { data: lead } = await db.from('ai_leads').select('business_name').eq('id', o.lead_id).single();
    const now = new Date().toISOString();
    if (r.bounce) {
      await db.from('ai_outreach').update({ status: 'bounced', notes: r.snippet, replied_at: r.at, updated_at: now }).eq('id', o.id);
      await logEvent(db, 'outreach-sender', 'alert', `The email to ${lead?.business_name} bounced`);
      continue;
    }
    const optOut = OPT_OUT.test(r.snippet);
    await db.from('ai_outreach').update({ status: 'replied', notes: r.snippet, replied_at: r.at, updated_at: now }).eq('id', o.id);
    await db.from('ai_leads').update({ status: optOut ? 'not_interested' : 'replied', updated_at: now }).eq('id', o.lead_id);
    await logEvent(db, 'outreach-sender', optOut ? 'progress' : 'handoff',
      optOut ? `${lead?.business_name} opted out — no more emails to them` : `${lead?.business_name} replied: "${r.snippet.slice(0, 140)}"`);
    replies += 1;
  }
  return { replies };
}
