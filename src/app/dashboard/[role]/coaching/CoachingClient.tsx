'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

const s = {
  cnf: ['Smiling tone', 'Customer feels special', 'Showing excitement', 'Personal experience', 'Multiple connections', 'Discount handling', 'Congratulating'],
  fl: ['Introduction', 'Customer connection', 'Price without value', 'Objection rebuttal', 'Card request trust'],
  lst: ['Over speaking', 'Building rapport', 'Offering alternatives', 'Pain point questions', 'Negative answers', 'Product knowledge', 'Payment method', 'Payment tools', 'System usage']
};

export default function CoachingClient({ initialSessions, users, isMgmt, currentUserId }: { initialSessions: any[], users: any[], isMgmt: boolean, currentUserId: string }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [scores, setScores] = useState<any>({});
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newSess = {
      agent_id: formData.get('agent_id') as string,
      supervisor_id: currentUserId,
      type: formData.get('type') as string,
      notes: formData.get('notes') as string,
      action_plan: formData.get('action_plan') as string,
      scores: scores
    };

    const { data } = await supabase.from('coaching_sessions').insert([newSess]).select(`*, agent:profiles!coaching_sessions_agent_id_fkey(name), supervisor:profiles!coaching_sessions_supervisor_id_fkey(name)`);
    if (data && data[0]) {
      setSessions([data[0], ...sessions]);
      alert('Coaching session saved.');
      // reset form
      (e.target as HTMLFormElement).reset();
      setScores({});
    }
  };

  return (
    <>
      {isMgmt && (
        <>
          <div className="pn">
            <div className="pn-h"><div className="pn-t">Active coaching session</div></div>
            <form onSubmit={handleSave} className="two">
              <div>
                <div className="pv-fld">
                  <label>Agent</label>
                  <select name="agent_id" required>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="pv-fld">
                  <label>Type</label>
                  <select name="type">
                    <option value="Performance">Performance</option>
                    <option value="Corrective">Corrective</option>
                  </select>
                </div>
                <div className="pv-fld"><label>Notes</label><textarea name="notes" rows={4} required></textarea></div>
              </div>
              <div>
                <div className="pv-fld"><label>Action plan</label><textarea name="action_plan" rows={4} required></textarea></div>
                <div className="pv-fld"><label>Next review</label><input type="date" name="next_review" /></div>
                <button type="submit" className="pv-btn pv-btn-pri">Save session →</button>
              </div>
            </form>
          </div>
          
          <div className="pn">
            <div className="pn-h"><div className="pn-t">Quality Attributes Scorecard</div></div>
            <div className="three">
              {[
                ['cnf', 'Sale Confirmed'],
                ['fl', 'Critical Fail'],
                ['lst', 'Sale Lost']
              ].map(([k, l]) => (
                <div key={k as string} className={`qa-s ${k}`}>
                  <div className={`qa-h ${k}`}>{l as string}</div>
                  {s[k as keyof typeof s].map((it, i) => (
                    <div key={i} className="qa-a">
                      <div className="qa-n">{it}</div>
                      <input 
                        type="range" min="0" max="10" value={scores[`${k}-${i}`] || 0} 
                        onChange={(e) => setScores({ ...scores, [`${k}-${i}`]: e.target.value })} 
                      />
                      <div className="qa-v">
                        <span>0</span>
                        <span>{scores[`${k}-${i}`] || 0}</span>
                        <span>10</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="pn">
        <div className="pn-h"><div className="pn-t">Session History</div></div>
        {sessions.length === 0 && <div className="empty">No sessions found.</div>}
        {sessions.map(s => (
          <div key={s.id} className="r-cd" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.agent?.name} · {s.type}</div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>With {s.supervisor?.name} · {new Date(s.created_at).toLocaleDateString()}</div>
              </div>
              <span className={`pv-bdg ${s.type === 'Performance' ? 'pv-bdg-green' : 'pv-bdg-amber'}`}>{s.type}</span>
            </div>
            <div style={{ marginTop: '12px', padding: '12px', background: '#f5f6f8', borderRadius: '8px', fontSize: '12px' }}>
              <strong>Notes:</strong> {s.notes}<br/><br/>
              <strong>Action Plan:</strong> {s.action_plan}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
