'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

const QA_ATTRS = {
  cnf: ['Smiling tone', 'Customer feels special', 'Showing excitement', 'Personal experience', 'Multiple connections', 'Discount handling', 'Congratulating'],
  fl: ['Introduction', 'Customer connection', 'Price without value', 'Objection rebuttal', 'Card request trust'],
  lst: ['Over speaking', 'Building rapport', 'Offering alternatives', 'Pain point questions', 'Negative answers', 'Product knowledge', 'Payment method', 'Payment tools', 'System usage'],
};

const QA_LABELS: Record<string, string> = {
  cnf: 'Sale Confirmed',
  fl: 'Critical Fail',
  lst: 'Sale Lost',
};

const QA_HUES: Record<string, number> = { cnf: 145, fl: 25, lst: 75 };

export default function CoachingClient({
  initialSessions,
  users,
  isMgmt,
  currentUserId,
  currentUserName,
}: {
  initialSessions: any[];
  users: any[];
  isMgmt: boolean;
  currentUserId: string;
  currentUserName?: string;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingInbox, setPendingInbox] = useState<{ agentId: string; agentName: string; summary: string } | null>(null);
  const [sendingInbox, setSendingInbox] = useState(false);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const agentId = fd.get('agent_id') as string;
    const notes = fd.get('notes') as string;
    const actionPlan = fd.get('action_plan') as string;
    const type = fd.get('type') as string;

    const newSess = {
      agent_id: agentId,
      supervisor_id: currentUserId,
      type,
      notes,
      action_plan: actionPlan,
      next_review: fd.get('next_review') as string || null,
      scores,
    };

    const { data } = await dbOp('coaching_sessions', 'insert', newSess);
    if (data?.[0]) {
      const agent = users.find(u => u.id === agentId);
      const supervisor = users.find(u => u.id === currentUserId);
      setSessions(prev => [{
        ...data[0],
        agent: { name: agent?.name ?? '—' },
        supervisor: { name: supervisor?.name ?? '—' },
      }, ...prev]);
      setPendingInbox({
        agentId,
        agentName: agent?.name ?? 'Agent',
        summary: `Session Type: ${type}\n\nNotes:\n${notes}\n\nAction Plan:\n${actionPlan}`,
      });
    }
    setSaving(false);
    setScores({});
    (e.target as HTMLFormElement).reset();
  };

  const handleSendToInbox = async () => {
    if (!pendingInbox) return;
    setSendingInbox(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: pendingInbox.agentId,
      title: 'Coaching Session Summary',
      subject: 'Coaching Session Summary',
      content: pendingInbox.summary,
      type: 'Coaching',
      sender: currentUserName ?? 'Supervisor',
      requires_signature: true,
    });
    setPendingInbox(null);
    setSendingInbox(false);
  };

  const setScore = (key: string, val: number) => setScores(prev => ({ ...prev, [key]: val }));

  const totalSessions = sessions.length;
  const performanceSessions = sessions.filter(s => s.type === 'Performance').length;
  const correctiveSessions = sessions.filter(s => s.type === 'Corrective').length;
  const uniqueAgents = new Set(sessions.map(s => s.agent?.name)).size;

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎓</div></div>
          <div className="stat-l">TOTAL SESSIONS</div>
          <div className="stat-v">{totalSessions}</div>
          <div className="stat-foot">All coaching records</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">PERFORMANCE</div>
          <div className="stat-v">{performanceSessions}</div>
          <div className="stat-foot">Positive reviews</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⚠</div></div>
          <div className="stat-l">CORRECTIVE</div>
          <div className="stat-v" style={{ color: 'var(--warn)' }}>{correctiveSessions}</div>
          <div className="stat-foot">Improvement plans</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">👤</div></div>
          <div className="stat-l">AGENTS COACHED</div>
          <div className="stat-v">{uniqueAgents}</div>
          <div className="stat-foot">Unique individuals</div>
        </div>
      </div>

      {/* Pending inbox banner */}
      {pendingInbox && (
        <div style={{
          background: 'oklch(0.96 0.05 145)', border: '1px solid oklch(0.88 0.07 145)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ fontSize: 13, color: 'var(--ok)' }}>
            ✓ Session saved for <strong>{pendingInbox.agentName}</strong>. Send a summary to their inbox?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-acc btn-sm" onClick={handleSendToInbox} disabled={sendingInbox}>
              {sendingInbox ? 'Sending…' : 'Send to Inbox'}
            </button>
            <button className="btn btn-sec btn-sm" onClick={() => setPendingInbox(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {isMgmt && (
        <>
          {/* New session form */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr">
              <div className="card-title">New Coaching Session</div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <form onSubmit={handleSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div className="pv-fld">
                      <label>Agent</label>
                      <select name="agent_id" required>
                        <option value="">— Select agent —</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                    <div className="pv-fld">
                      <label>Session Type</label>
                      <select name="type">
                        <option value="Performance">Performance</option>
                        <option value="Corrective">Corrective</option>
                      </select>
                    </div>
                    <div className="pv-fld">
                      <label>Session Notes</label>
                      <textarea name="notes" rows={4} required placeholder="What was discussed, key observations…" />
                    </div>
                  </div>
                  <div>
                    <div className="pv-fld">
                      <label>Action Plan</label>
                      <textarea name="action_plan" rows={4} required placeholder="Steps the agent will take…" />
                    </div>
                    <div className="pv-fld">
                      <label>Next Review Date</label>
                      <input type="date" name="next_review" />
                    </div>
                    <button type="submit" className="btn btn-acc" disabled={saving} style={{ width: '100%' }}>
                      {saving ? 'Saving…' : 'Save Session →'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* QA Scorecard */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-hdr">
              <div>
                <div className="card-title">Quality Attributes Scorecard</div>
                <div className="card-sub">Scores saved with the session above</div>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {(Object.keys(QA_ATTRS) as (keyof typeof QA_ATTRS)[]).map(k => {
                const hue = QA_HUES[k];
                return (
                  <div key={k} style={{ background: `oklch(0.96 0.03 ${hue})`, borderRadius: 12, padding: '16px', border: `1px solid oklch(0.88 0.06 ${hue})` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, color: `oklch(0.40 0.14 ${hue})` }}>
                      {QA_LABELS[k]}
                    </div>
                    {QA_ATTRS[k].map((attr, i) => {
                      const key = `${k}-${i}`;
                      const val = scores[key] ?? 0;
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                            <span style={{ color: 'var(--ink-3)' }}>{attr}</span>
                            <span style={{ fontWeight: 700, color: val >= 7 ? 'var(--ok)' : val >= 4 ? 'var(--warn)' : 'var(--err)' }}>{val}/10</span>
                          </div>
                          <input
                            type="range" min={0} max={10} value={val}
                            onChange={e => setScore(key, Number(e.target.value))}
                            style={{ width: '100%', accentColor: val >= 7 ? 'oklch(0.55 0.14 145)' : val >= 4 ? 'oklch(0.65 0.14 75)' : 'oklch(0.55 0.18 25)' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Session History */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div className="card-title">Session History</div>
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No sessions recorded yet.</div>
        ) : (
          <div style={{ padding: '0 18px 18px' }}>
            {sessions.map(s => {
              const hue = s.type === 'Performance' ? 145 : 75;
              const agentHue = ((s.agent?.name ?? 'A').charCodeAt(0) * 13) % 360;
              return (
                <div key={s.id} style={{ borderBottom: '1px solid var(--line-2)', padding: '14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    <div className="av-circle" style={{ width: 36, height: 36, fontSize: 12, background: `linear-gradient(135deg, oklch(0.55 0.13 ${agentHue}), oklch(0.42 0.16 ${agentHue + 20}))`, flexShrink: 0 }}>
                      {(s.agent?.name ?? 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.agent?.name} · {s.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>With {s.supervisor?.name} · {new Date(s.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`bdg ${s.type === 'Performance' ? 'bdg-ok' : 'bdg-warn'}`}>{s.type}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{expandedId === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandedId === s.id && (
                    <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-2)', borderRadius: 10, fontSize: 12.5, lineHeight: 1.7 }}>
                      <div style={{ marginBottom: 8 }}><strong>Notes:</strong> {s.notes}</div>
                      <div><strong>Action Plan:</strong> {s.action_plan}</div>
                      {s.next_review && (
                        <div style={{ marginTop: 8, color: 'var(--accent-ink)', fontWeight: 600 }}>
                          Next review: {new Date(s.next_review).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
