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
      content: pendingInbox.summary,
      type: 'Coaching',
      sender: currentUserName ?? 'Supervisor',
      requires_signature: true,
    });
    setPendingInbox(null);
    setSendingInbox(false);
  };

  const setScore = (key: string, val: number) => setScores(prev => ({ ...prev, [key]: val }));

  return (
    <>
      {pendingInbox && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: '#047857' }}>
            ✓ Session saved for <strong>{pendingInbox.agentName}</strong>. Send a summary to their inbox?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="pv-btn pv-btn-pri" style={{ fontSize: '12px' }} onClick={handleSendToInbox} disabled={sendingInbox}>
              {sendingInbox ? 'Sending...' : 'Send to Inbox'}
            </button>
            <button className="pv-btn pv-btn-sec" style={{ fontSize: '12px' }} onClick={() => setPendingInbox(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {isMgmt && (
        <>
          <div className="pn" style={{ marginBottom: '20px' }}>
            <div className="pn-h" style={{ marginBottom: '16px' }}>
              <div className="pn-t">New Coaching Session</div>
            </div>
            <form onSubmit={handleSave} className="two">
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
                <div className="pv-fld"><label>Session Notes</label><textarea name="notes" rows={4} required placeholder="What was discussed, key observations..." /></div>
              </div>
              <div>
                <div className="pv-fld"><label>Action Plan</label><textarea name="action_plan" rows={4} required placeholder="Steps the agent will take..." /></div>
                <div className="pv-fld"><label>Next Review Date</label><input type="date" name="next_review" /></div>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={saving} style={{ width: '100%' }}>
                  {saving ? 'Saving...' : 'Save Session →'}
                </button>
              </div>
            </form>
          </div>

          <div className="pn" style={{ marginBottom: '20px' }}>
            <div className="pn-h" style={{ marginBottom: '16px' }}>
              <div className="pn-t">Quality Attributes Scorecard</div>
              <div style={{ fontSize: '11px', color: '#6b7689' }}>Scores are saved with the session above</div>
            </div>
            <div className="three">
              {(Object.keys(QA_ATTRS) as (keyof typeof QA_ATTRS)[]).map(k => (
                <div key={k} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', color: k === 'cnf' ? '#047857' : k === 'fl' ? '#dc2626' : '#b45309' }}>
                    {QA_LABELS[k]}
                  </div>
                  {QA_ATTRS[k].map((attr, i) => {
                    const key = `${k}-${i}`;
                    const val = scores[key] ?? 0;
                    return (
                      <div key={i} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                          <span style={{ color: '#4a5568' }}>{attr}</span>
                          <span style={{ fontWeight: 700, color: val >= 7 ? '#047857' : val >= 4 ? '#b45309' : '#dc2626' }}>{val}/10</span>
                        </div>
                        <input
                          type="range" min={0} max={10} value={val}
                          onChange={e => setScore(key, Number(e.target.value))}
                          style={{ width: '100%', accentColor: val >= 7 ? '#10b981' : val >= 4 ? '#f59e0b' : '#ef4444' }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="pn">
        <div className="pn-h" style={{ marginBottom: '14px' }}>
          <div className="pn-t">Session History</div>
        </div>
        {sessions.length === 0 && <div className="empty">No sessions found.</div>}
        {sessions.map(s => (
          <div key={s.id} style={{ borderBottom: '1px solid #f0f2f5', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.agent?.name} · {s.type}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>With {s.supervisor?.name} · {new Date(s.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`pv-bdg ${s.type === 'Performance' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{s.type}</span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{expandedId === s.id ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedId === s.id && (
              <div style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '12.5px', lineHeight: 1.7 }}>
                <div style={{ marginBottom: '8px' }}><strong>Notes:</strong> {s.notes}</div>
                <div><strong>Action Plan:</strong> {s.action_plan}</div>
                {s.next_review && <div style={{ marginTop: '6px', color: '#4f46e5' }}><strong>Next review:</strong> {new Date(s.next_review).toLocaleDateString()}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
