'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';
import { createEmployeeAccount } from '../users/actions';
import { useRouter } from 'next/navigation';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'] as const;
type Stage = typeof STAGES[number] | 'Rejected';

const STAGE_COLORS: Record<string, { head: string; count: string }> = {
  Applied:   { head: 'var(--ink-3)',          count: 'bdg bdg-gy' },
  Screening: { head: 'oklch(0.45 0.12 75)',   count: 'bdg bdg-warn' },
  Interview: { head: 'oklch(0.45 0.16 268)',  count: 'bdg bdg-acc' },
  Offer:     { head: 'oklch(0.45 0.12 155)',  count: 'bdg bdg-ok' },
  Hired:     { head: 'oklch(0.42 0.12 155)',  count: 'bdg bdg-ok' },
};

function scoreColor(s: number) {
  if (s >= 90) return { bg: 'var(--ok-soft)', color: 'oklch(0.42 0.12 155)' };
  if (s >= 70) return { bg: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)' };
  return { bg: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' };
}

export default function HrClient({ initialApplicants }: { initialApplicants: any[] }) {
  const [applicants, setApplicants] = useState(initialApplicants);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewApplicant, setViewApplicant] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hireError, setHireError] = useState('');
  const [showRejected, setShowRejected] = useState(false);
  const router = useRouter();

  const getStage = (a: any): Stage => {
    if (a.status === 'Rejected') return 'Rejected';
    if (a.status === 'Hired') return 'Hired';
    return (a.stage as Stage) || 'Applied';
  };

  const pipeline = applicants.filter(a => a.status !== 'Rejected');
  const rejected = applicants.filter(a => a.status === 'Rejected');

  const totalApplied   = applicants.filter(a => getStage(a) === 'Applied').length;
  const totalScreening = applicants.filter(a => getStage(a) === 'Screening').length;
  const totalInterview = applicants.filter(a => getStage(a) === 'Interview').length;
  const totalHired     = applicants.filter(a => getStage(a) === 'Hired').length;

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const newApp = {
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      position: fd.get('position') as string,
      score: Number(fd.get('score')),
      notes: fd.get('notes_field') as string || null,
      status: 'Reviewing',
      stage: 'Applied',
    };
    const { data } = await dbOp('hr_applicants', 'insert', newApp);
    if (data?.[0]) setApplicants(prev => [data[0], ...prev]);
    setIsAddModalOpen(false);
    setIsSubmitting(false);
    (e.target as HTMLFormElement).reset();
  };

  const moveStage = async (app: any, direction: 'next' | 'prev') => {
    const currentStage = getStage(app);
    if (currentStage === 'Rejected' || currentStage === 'Hired') return;
    const idx = STAGES.indexOf(currentStage as typeof STAGES[number]);
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= STAGES.length) return;
    const newStage = STAGES[nextIdx];
    await dbOp('hr_applicants', 'update', { stage: newStage, status: newStage === 'Hired' ? 'Hired' : 'Reviewing' }, { id: app.id });
    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, stage: newStage, status: newStage === 'Hired' ? 'Hired' : 'Reviewing' } : a));
    if (viewApplicant?.id === app.id) setViewApplicant({ ...viewApplicant, stage: newStage, status: newStage === 'Hired' ? 'Hired' : 'Reviewing' });
  };

  const handleHire = async (app: any) => {
    setIsSubmitting(true);
    setHireError('');
    const fd = new FormData();
    fd.append('email', app.email);
    fd.append('username', app.email.split('@')[0]);
    fd.append('password', 'pioneers2026!');
    fd.append('name', app.name);
    fd.append('role', app.position.toLowerCase().replace(' ', '_'));
    fd.append('salary', '2500');
    const res = await createEmployeeAccount(fd);
    if (res.error) {
      setHireError(`Could not hire ${app.name}: ${res.error}`);
    } else {
      await dbOp('hr_applicants', 'update', { status: 'Hired', stage: 'Hired' }, { id: app.id });
      setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Hired', stage: 'Hired' } : a));
      setViewApplicant(null);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const handleReject = async (app: any) => {
    await dbOp('hr_applicants', 'update', { status: 'Rejected' }, { id: app.id });
    setApplicants(prev => prev.map(a => a.id === app.id ? { ...a, status: 'Rejected' } : a));
    setViewApplicant(null);
  };

  const handleRestore = async (id: string) => {
    await dbOp('hr_applicants', 'update', { status: 'Reviewing', stage: 'Applied' }, { id });
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: 'Reviewing', stage: 'Applied' } : a));
  };

  const handleDelete = async (app: any) => {
    if (!confirm(`Permanently delete ${app.name} from the pipeline? This cannot be undone.`)) return;
    await dbOp('hr_applicants', 'delete', {}, { id: app.id });
    setApplicants(prev => prev.filter(a => a.id !== app.id));
    setViewApplicant(null);
  };

  return (
    <div className="page-fade">
      {/* Stat row */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📥</div></div>
          <div className="stat-l">APPLIED</div>
          <div className="stat-v">{totalApplied}</div>
          <div className="stat-foot">New applicants this cycle</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">🔍</div></div>
          <div className="stat-l">SCREENING</div>
          <div className="stat-v">{totalScreening}</div>
          <div className="stat-foot">Under initial review</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎤</div></div>
          <div className="stat-l">INTERVIEW</div>
          <div className="stat-v">{totalInterview}</div>
          <div className="stat-foot">Scheduled or completed</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">HIRED</div>
          <div className="stat-v">{totalHired}</div>
          <div className="stat-foot">Onboarded this quarter</div>
        </div>
      </div>

      {hireError && (
        <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{hireError}</div>
      )}

      {/* Kanban header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>HR Pipeline</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{pipeline.length} active candidates across {STAGES.length} stages</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sec btn-sm" onClick={() => setShowRejected(s => !s)}>
            {showRejected ? 'Hide rejected' : `Rejected (${rejected.length})`}
          </button>
          <button className="btn btn-acc btn-sm" onClick={() => setIsAddModalOpen(true)}>+ Add Applicant</button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="kanban">
        {STAGES.map(stage => {
          const cards = applicants.filter(a => getStage(a) === stage);
          const c = STAGE_COLORS[stage];
          return (
            <div key={stage} className="kanban-col">
              <div className="kanban-col-head" style={{ color: c.head }}>
                {stage}
                <span className={c.count}>{cards.length}</span>
              </div>
              {cards.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', textAlign: 'center', padding: '12px 0' }}>Empty</div>
              )}
              {cards.map(a => {
                const sc = scoreColor(a.score);
                return (
                  <div key={a.id} className="kanban-card" onClick={() => setViewApplicant(a)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{a.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: sc.bg, color: sc.color, flexShrink: 0, marginLeft: 6 }}>
                        {a.score}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{a.position}</div>
                    {a.notes && (
                      <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.notes.slice(0, 50)}{a.notes.length > 50 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ marginTop: 10, display: 'flex', gap: 5 }}>
                      {stage !== 'Applied' && (
                        <button className="btn btn-sec btn-sm" style={{ fontSize: 10, padding: '3px 7px' }} onClick={e => { e.stopPropagation(); moveStage(a, 'prev'); }}>← Back</button>
                      )}
                      {stage !== 'Hired' && (
                        <button className="btn btn-acc btn-sm" style={{ fontSize: 10, padding: '3px 7px', marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); moveStage(a, 'next'); }}>
                          {stage === 'Offer' ? 'Hire →' : 'Next →'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Rejected section */}
      {showRejected && rejected.length > 0 && (
        <div className="card" style={{ marginTop: 20, overflow: 'hidden' }}>
          <div className="card-hdr">
            <div className="card-title" style={{ color: 'var(--ink-3)' }}>Rejected Applicants ({rejected.length})</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Position</th><th>Score</th><th>Actions</th></tr></thead>
              <tbody>
                {rejected.map(a => {
                  const sc = scoreColor(a.score);
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.name}</td>
                      <td style={{ color: 'var(--ink-3)' }}>{a.position}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: sc.bg, color: sc.color }}>{a.score}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sec btn-sm" onClick={() => handleRestore(a.id)}>Restore</button>
                          <button className="btn btn-sm" style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', border: '1px solid oklch(0.85 0.10 25)' }} onClick={() => handleDelete(a)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Applicant Modal */}
      {isAddModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 440 }}>
            <div className="md-t">Add Applicant</div>
            <form onSubmit={handleAdd}>
              <div className="pv-fld"><label>Full Name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Email</label><input type="email" name="email" required /></div>
              <div className="pv-fld">
                <label>Applying for</label>
                <select name="position">
                  <option value="Sales">Sales</option>
                  <option value="CX">CX</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Admin">Admin</option>
                  <option value="Accountant">Accountant</option>
                </select>
              </div>
              <div className="pv-fld"><label>Interview Score (0–100)</label><input type="number" name="score" min="0" max="100" defaultValue={80} required /></div>
              <div className="pv-fld"><label>Notes (optional)</label><textarea name="notes_field" rows={3} placeholder="Interviewer notes, observations…" /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Applicant Modal */}
      {viewApplicant && (
        <div className="mb">
          <div className="md" style={{ width: 460 }}>
            <div className="md-t">{viewApplicant.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16, marginTop: -12 }}>{viewApplicant.email} · {viewApplicant.position}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginBottom: 16 }}>
              {[
                ['Score', `${viewApplicant.score}/100`],
                ['Stage', getStage(viewApplicant)],
                ['Position', viewApplicant.position],
                ['Applied', new Date(viewApplicant.created_at).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--surface-2)', padding: '9px 11px', borderRadius: 7 }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>

            {viewApplicant.notes && (
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
                {viewApplicant.notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {viewApplicant.status === 'Reviewing' && getStage(viewApplicant) === 'Offer' && (
                <button className="btn btn-acc" onClick={() => handleHire(viewApplicant)} disabled={isSubmitting}>
                  {isSubmitting ? 'Hiring…' : 'Confirm Hire →'}
                </button>
              )}
              {viewApplicant.status === 'Reviewing' && (
                <button className="btn btn-sec" style={{ color: 'oklch(0.45 0.16 25)' }} onClick={() => handleReject(viewApplicant)}>Reject</button>
              )}
              <button className="btn btn-sm" style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', border: '1px solid oklch(0.85 0.10 25)' }} onClick={() => handleDelete(viewApplicant)}>
                Delete
              </button>
              <button className="btn btn-sec" onClick={() => setViewApplicant(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
