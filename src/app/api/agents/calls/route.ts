import { NextRequest, NextResponse } from 'next/server';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';

// Logging a call you made. Each attempt is kept with its own note, so a lead
// can be called more than once and you still have the history.

const LEAD_STATUS: Record<string, string> = {
  booked: 'booked',
  interested: 'replied',
  not_interested: 'not_interested',
  callback: 'contacted',
  no_answer: 'contacted',
  left_voicemail: 'contacted',
};

export async function POST(req: NextRequest) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: 'Only owners, admins and supervisors can log calls' }, { status: 403 });

  const { leadId, outreachId, outcome, note } = await req.json().catch(() => ({}));
  if (!leadId || !LEAD_STATUS[outcome]) return NextResponse.json({ error: 'Pick an outcome' }, { status: 400 });

  const db = admin();
  const now = new Date().toISOString();
  const { data: lead } = await db.from('ai_leads').select('business_name').eq('id', leadId).single();

  const { data: call, error } = await db.from('ai_call_notes')
    .insert({ lead_id: leadId, outreach_id: outreachId ?? null, outcome, note: String(note ?? '').trim(), called_by: manager.userId, called_at: now })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let outreach = null;
  if (outreachId) {
    const { data } = await db.from('ai_outreach')
      .update({ status: outcome, notes: String(note ?? '').trim(), sent_at: now, updated_at: now })
      .eq('id', outreachId).select().single();
    outreach = data;
  }
  const { data: updatedLead } = await db.from('ai_leads')
    .update({ status: LEAD_STATUS[outcome], updated_at: now }).eq('id', leadId).select().single();

  const label = outcome.replace('_', ' ');
  await logEvent(db, 'research-callprep', outcome === 'booked' ? 'done' : 'progress',
    `Founder called ${lead?.business_name ?? 'a lead'} — ${label}${note ? `: ${String(note).slice(0, 120)}` : ''}`);

  return NextResponse.json({ call, outreach, lead: updatedLead });
}
