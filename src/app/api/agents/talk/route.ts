import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LIVE_AGENTS, NEXT_UP } from '@/lib/aiAgents/org';
import { admin, logEvent, requireManager } from '@/lib/aiAgents/server/runtime';

// Talking to an agent in the office. It answers as itself, from its real job,
// its live work and what it has actually done. If the founder gives it
// something to do, the message becomes an assignment on its desk.

export const maxDuration = 120;

const Reply = z.object({
  reply: z.string().describe('What the agent says back. One to three short sentences, plain and practical.'),
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
- If the founder gives you work, acknowledge it concretely and say what you will do first. Note that assignments are saved to your desk: you pick them up when you next run, and free-text jobs outside your pipeline wait until the founder wires that up.
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
      system,
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

    return NextResponse.json({ messages: [mine, theirs].filter(Boolean), work: workRow });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
