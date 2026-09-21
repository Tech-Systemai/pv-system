import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LIVE_AGENTS, NEXT_UP } from '@/lib/aiAgents/org';
import { topUpLeads } from '@/lib/aiAgents/server/leadgen';
import { researchBatch } from '@/lib/aiAgents/server/research';
import { skillsFor } from '@/lib/aiAgents/server/jobs';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';
import { checkReplies, sendBatch } from '@/lib/aiAgents/server/sender';
import { writeBatch } from '@/lib/aiAgents/server/writer';

// Talking to an agent in the office. It answers as itself, from its real job,
// its live work and what it has actually done. If the founder gives it
// something to do, the message becomes an assignment on its desk.

export const maxDuration = 120;

// What an agent can actually go and do, right now, in this conversation.
const ACTIONS = ['none', 'find_leads', 'research', 'write_emails', 'send_emails'] as const;

/** Run the job the agent just agreed to, and report what happened. */
async function runAction(action: string): Promise<string> {
  const db = admin();
  if (action === 'find_leads') {
    const r = await topUpLeads(db, { force: true, max: 40 }) as Record<string, unknown>;
    return r.ok
      ? `Started a Google Maps pull: ${r.niche} in ${r.city}. They land in a couple of minutes and I research them straight away.`
      : `Could not start a pull: ${r.error ?? r.skipped}`;
  }
  if (action === 'research') {
    const r = await researchBatch(12, 4);
    return r.researched
      ? `Researched ${r.researched} leads just now — ${r.qualified} qualified${r.failed ? `, ${r.failed} failed` : ''}.`
      : 'Nothing was waiting to be researched.';
  }
  if (action === 'write_emails') {
    const r = await writeBatch(5) as { written: number; waiting?: string };
    if (r.waiting === 'settings') return 'I cannot write yet: the postal address is still missing in the Outreach settings.';
    return r.written ? `Wrote ${r.written} emails just now — they are waiting for your approval in Outreach.` : 'No qualified email-first leads were waiting.';
  }
  if (action === 'send_emails') {
    const sent = await sendBatch({ force: true });
    const replies = await checkReplies();
    return sent.sent
      ? `Sent ${sent.sent}${replies.replies ? `, and ${replies.replies} new replies came in` : ''}.`
      : `Nothing sent: ${sent.reason ?? 'nothing approved yet'}.`;
  }
  return '';
}

const Reply = z.object({
  reply: z.string().describe('What the agent says back. One to three short sentences, plain and practical. If you are about to run something, say so in the present tense — never promise a later sweep.'),
  action: z.enum(ACTIONS).describe('The job to run right now, if the founder asked for work you can do. "none" when there is nothing to run.'),
  task_title: z.string().describe('If the founder asked for work, a short title for it (under 80 chars); otherwise ""'),
  task_brief: z.string().describe('The details of that work in the founder\'s own terms; otherwise ""'),
});

export async function POST(req: NextRequest) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: 'Only owners, admins and supervisors can talk to the agents' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' }, { status: 400 });

  const { agentId, text } = await req.json().catch(() => ({}));
  const said = String(text ?? '').trim();
  if (!agentId || !said) return NextResponse.json({ error: 'Say something first' }, { status: 400 });

  const db = admin();
  const { data: agent } = await db.from('ai_agents').select('*').eq('id', agentId).single();
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const [{ data: work }, { data: events }, { data: history }] = await Promise.all([
    db.from('ai_agent_work').select('title, status, output').eq('agent_id', agentId).neq('status', 'done').order('updated_at', { ascending: false }).limit(8),
    db.from('ai_agent_events').select('message, created_at').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(6),
    db.from('ai_agent_messages').select('role, text').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(10),
  ]);

  const duty = LIVE_AGENTS[agent.slug ?? ''];
  const system = `You are ${agent.name}, ${agent.title} at Octopus Engines, which sells home-service contractors 24/7 AI call answering and missed-call text-back. You are talking to the founder, your boss.

Your job: ${agent.purpose}
${duty
  ? `You are live and running right now. Specifically: ${duty}`
  : `You are NOT live yet: you are on the floor plan but nothing of yours runs. ${NEXT_UP[agent.slug ?? ''] ?? 'The founder will switch you on in a later step.'} Be straight about that rather than pretending to work.`}

How to talk:
- Speak as yourself, briefly: one to three sentences, no corporate filler, no "As an AI".
- Never claim to have done something unless it is in your work or recent activity below.
- If the founder asks for something another agent owns, say who owns it.
- You are on call around the clock. When the founder asks for work you can run, set "action" and do it now. Never say you will do it later, in a sweep, or on a schedule.
  · find_leads — pull a fresh batch of businesses from Google Maps (Scout's job)
  · research — score and qualify the leads that are waiting (Sage's job)
  · write_emails — write the next emails for qualified leads (Quill's job)
  · send_emails — send the emails the founder has already approved (Post's job)
- If what they want is not one of those, say plainly that you cannot run it yet, and that you have put it on your desk.
- If you need something from the founder to do the job (a decision, access, a detail), ask for that one thing.`;

  const context = [
    `Your open work: ${(work ?? []).length ? (work ?? []).map(w => `${w.title} (${w.status})`).join('; ') : 'nothing open'}`,
    `Your recent activity: ${(events ?? []).length ? (events ?? []).map(e => e.message).join(' | ') : 'nothing yet'}`,
  ].join('\n');

  const messages = [
    ...(history ?? []).reverse().map(m => ({ role: (m.role === 'founder' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text })),
    { role: 'user' as const, content: `[Your current state]\n${context}\n\n[The founder says]\n${said}` },
  ];

  try {
    const res = await new Anthropic().messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: system + (await skillsFor(agent.slug ?? '', agent.department ?? '')),
      messages,
      output_config: { format: zodOutputFormat(Reply), effort: 'low' },
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('No reply came back');
    const out = res.parsed_output;

    const { data: mine } = await db.from('ai_agent_messages').insert({ agent_id: agentId, role: 'founder', text: said, said_by: manager.userId }).select().single();
    let workRow = null;
    if (out.task_title.trim()) {
      const { data: w } = await db.from('ai_agent_work')
        .insert({ agent_id: agentId, title: out.task_title.trim().slice(0, 120), brief: out.task_brief.trim(), status: 'queued', requested_by: manager.userId })
        .select().single();
      workRow = w;
      await logEvent(db, agent.slug ?? '', 'request', `Founder asked {agent}: ${out.task_title.trim()}`, w?.id ?? null);
    }
    const { data: theirs } = await db.from('ai_agent_messages')
      .insert({ agent_id: agentId, role: 'agent', text: out.reply, work_id: workRow?.id ?? null }).select().single();

    // Do the job now and report back in the same conversation.
    let result = null;
    if (out.action && out.action !== 'none') {
      const ran = await runAction(out.action);
      const { data } = await db.from('ai_agent_messages').insert({ agent_id: agentId, role: 'agent', text: ran }).select().single();
      result = data;
      await logEvent(db, agent.slug ?? '', 'progress', `{agent}, asked by the founder: ${ran}`);
    }
    return NextResponse.json({ messages: [mine, theirs, result].filter(Boolean), work: workRow });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
