import { NextRequest, NextResponse } from 'next/server';
import { checkEmail } from '@/lib/aiAgents/pipeline';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';
import { checkReplies, sendBatch } from '@/lib/aiAgents/server/sender';
import { rewriteOne, writeBatch } from '@/lib/aiAgents/server/writer';

// Everything the founder does with outreach email from the portal: save the
// pitch, have Quill write, approve / edit / rewrite / skip a draft, and nudge
// Post to send the approved queue now (still within hours and limits).

export const maxDuration = 300;

const SETTINGS_FIELDS = ['sender_name', 'sender_title', 'postal_address', 'offer', 'proof', 'call_to_action', 'daily_limit', 'auto_send', 'lead_target', 'pull_cities', 'logo_url', 'home_base'] as const;

export async function POST(req: NextRequest) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: 'Only owners, admins and supervisors can run outreach' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const db = admin();
  const now = new Date().toISOString();

  try {
    switch (body.action) {
      case 'settings': {
        const patch: Record<string, unknown> = { id: 'default', updated_at: now };
        for (const k of SETTINGS_FIELDS) if (k in (body.settings ?? {})) patch[k] = body.settings[k];
        if ('daily_limit' in patch) patch.daily_limit = Math.min(50, Math.max(1, Number(patch.daily_limit) || 30));
        if ('lead_target' in patch) patch.lead_target = Math.min(200, Math.max(5, Number(patch.lead_target) || 40));
        const { data, error } = await db.from('ai_outreach_settings').upsert(patch).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ settings: data });
      }
      case 'write': {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in Vercel');
        const r = await writeBatch(Math.min(10, Math.max(1, Number(body.limit) || 5)));
        if ('waiting' in r) throw new Error('Fill in your sender name and postal address first');
        return NextResponse.json(r);
      }
      case 'approve': {
        const { data: o } = await db.from('ai_outreach').select('id, lead_id, subject, body').eq('id', body.id).single();
        if (!o) throw new Error('Email not found');
        const subject = typeof body.subject === 'string' ? body.subject : o.subject;
        const text = typeof body.body === 'string' ? body.body : o.body;
        const issues = checkEmail(subject, text);
        if (issues.length) return NextResponse.json({ error: `Compliance: ${issues.join(' · ')}` }, { status: 400 });
        const { data } = await db.from('ai_outreach').update({
          subject, body: text, compliance_issues: [], status: 'scheduled', approved_by: manager.userId, approved_at: now, updated_at: now,
        }).eq('id', o.id).select().single();
        const { data: lead } = await db.from('ai_leads').select('business_name').eq('id', o.lead_id).single();
        await logEvent(db, 'outreach-sender', 'handoff', `Founder approved the email to ${lead?.business_name} — {agent} will send it in the next sending window`);
        return NextResponse.json({ outreach: data });
      }
      case 'rewrite': {
        if (!String(body.notes ?? '').trim()) throw new Error('Say what to change');
        return NextResponse.json({ outreach: await rewriteOne(body.id, String(body.notes).trim()) });
      }
      case 'skip': {
        const { data } = await db.from('ai_outreach').update({ status: 'skipped', updated_at: now }).eq('id', body.id).select().single();
        return NextResponse.json({ outreach: data });
      }
      case 'send': {
        const sent = await sendBatch({ force: true });
        const replies = await checkReplies();
        return NextResponse.json({ ...sent, ...replies });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
