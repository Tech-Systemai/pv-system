import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LIVE_AGENTS } from '@/lib/aiAgents/org';
import { JOBS, JOB_LABEL, JOB_OWNER, runJob, skillsFor, type Job } from '@/lib/aiAgents/server/jobs';
import { admin, logEvent, requireManager, setDesk } from '@/lib/aiAgents/server/runtime';

// The task bar: type any job in plain words, and it goes to the right desk and
// runs. If nobody can run it yet, it lands on that agent's desk instead.

export const maxDuration = 300;

const Routed = z.object({
  agent_slug: z.string().describe('The slug of the agent who owns this, from the roster below'),
  job: z.enum(['none', ...JOBS]).describe('The job to run right now, or "none" when this is not something the agents can run yet'),
  niche: z.string().describe('Niche key if the founder named one (plumbing, hvac, roofing, pools, …), else ""'),
  city: z.string().describe('City if the founder named one, e.g. "Sarasota, FL", else ""'),
  count: z.number().int().describe('How many they asked for, else 0'),
  title: z.string().describe('A short title for the work, under 80 characters'),
  reply: z.string().describe('One or two sentences back to the founder, as the agent, saying what is being done now'),
});

export async function POST(req: NextRequest) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ error: 'Only owners, admins and supervisors can assign work' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' }, { status: 400 });

  const text = String((await req.json().catch(() => ({}))).text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Type what you want done' }, { status: 400 });

  const db = admin();
  const { data: agents } = await db.from('ai_agents').select('id, slug, name, title, department, status').eq('status', 'active');
  const { data: niches } = await db.from('ai_niches').select('key, name').eq('active', true);

  const roster = (agents ?? []).map(a => {
    const duty = LIVE_AGENTS[a.slug ?? ''];
    return `${a.slug} — ${a.name}, ${a.title} (${a.department})${duty ? ` · LIVE: ${duty}` : ' · not live yet'}`;
  }).join('\n');

  const system = `You are the office manager at Octopus Engines, which sells home-service contractors 24/7 AI call answering and missed-call text-back. The founder types a job into the task bar and you send it to the right desk.

The agents:
${roster}

Niche keys: ${(niches ?? []).map(n => `${n.key} (${n.name})`).join(', ')}

The jobs that can actually run right now:
${JOBS.map(j => `- ${j}: ${JOB_LABEL[j]} — owned by ${JOB_OWNER[j]}`).join('\n')}

Rules:
- Pick the agent whose job it is. When the work is one of the runnable jobs, set "job" and use that job's owner as the agent.
- When it is something no agent can run yet (write a landing page, call someone, post an ad), set job to "none" and pick the agent who will own it once built. Say plainly that it is on their desk and not running yet.
- Pull the niche, the city and the number out of what they typed when they are there.
- Reply as that agent, in one or two sentences, present tense. Never promise a later sweep.`;

  try {
    const res = await new Anthropic().messages.parse({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: system + (await skillsFor('', '')),
      messages: [{ role: 'user', content: text }],
      output_config: { format: zodOutputFormat(Routed), effort: 'low' },
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('Could not work out who should do that');
    const out = res.parsed_output;

    const agent = (agents ?? []).find(a => a.slug === out.agent_slug)
      ?? (agents ?? []).find(a => a.slug === JOB_OWNER[out.job as Job]);
    if (!agent) throw new Error('No agent to give that to');

    const { data: work } = await db.from('ai_agent_work')
      .insert({ agent_id: agent.id, title: out.title.slice(0, 120), brief: text, status: out.job === 'none' ? 'queued' : 'in_progress', requested_by: manager.userId })
      .select().single();
    await logEvent(db, agent.slug ?? '', 'request', `Founder → {agent}: ${out.title}`, work?.id ?? null);

    let result = '';
    if (out.job !== 'none') {
      await setDesk(db, agent.slug ?? '', 'working', out.title.slice(0, 120));
      result = await runJob(out.job as Job, {
        max: out.count || undefined,
        limit: out.count || undefined,
        niche: out.niche || undefined,
        city: out.city || undefined,
      });
      const now = new Date().toISOString();
      if (work) await db.from('ai_agent_work').update({ status: 'done', output: result, completed_at: now, updated_at: now }).eq('id', work.id);
      await setDesk(db, agent.slug ?? '', 'idle');
      await logEvent(db, agent.slug ?? '', 'done', `{agent}: ${result}`, work?.id ?? null);
    }

    await db.from('ai_agent_messages').insert([
      { agent_id: agent.id, role: 'founder', text, said_by: manager.userId },
      { agent_id: agent.id, role: 'agent', text: result ? `${out.reply}\n\n${result}` : out.reply, work_id: work?.id ?? null },
    ]);

    return NextResponse.json({
      agent: { id: agent.id, name: agent.name, title: agent.title },
      job: out.job, reply: out.reply, result, work,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
