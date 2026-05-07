'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type FilterTab = 'all' | 'mine' | 'unassigned' | 'critical';

const PRIORITY_BADGE: Record<string, string> = {
  High:   'bdg bdg-err',
  Medium: 'bdg bdg-warn',
  Low:    'bdg bdg-gy',
};

const STATUS_BADGE: Record<string, string> = {
  Open:     'bdg bdg-acc',
  Resolved: 'bdg bdg-ok',
};

function SlaBar({ createdAt, priority }: { createdAt: string; priority: string }) {
  const slaHours = priority === 'High' ? 4 : priority === 'Medium' ? 24 : 72;
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedH = elapsedMs / 3_600_000;
  const pct = Math.min(100, (elapsedH / slaHours) * 100);
  const color = pct >= 90 ? 'var(--err)' : pct >= 65 ? 'var(--warn)' : 'var(--ok)';
  const remaining = Math.max(0, slaHours - elapsedH);
  const label = remaining < 1 ? `${Math.round(remaining * 60)}m` : `${remaining.toFixed(1)}h`;
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .5s' }} />
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: pct >= 90 ? color : 'var(--ink-4)' }}>
        {pct >= 100 ? 'BREACHED' : `${label} left`}
      </div>
    </div>
  );
}

export default function TicketsClient({
  initialTickets, isMgmt, currentUserId, allUsers,
}: {
  initialTickets: any[]; isMgmt: boolean; currentUserId: string; allUsers?: any[];
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const open     = tickets.filter(t => t.status !== 'Resolved');
  const resolved = tickets.filter(t => t.status === 'Resolved');

  const filtered = (() => {
    const base = tickets;
    switch (filterTab) {
      case 'mine':       return base.filter(t => t.user_id === currentUserId);
      case 'unassigned': return base.filter(t => !t.assigned_to && t.status !== 'Resolved');
      case 'critical':   return base.filter(t => t.priority === 'High' && t.status !== 'Resolved');
      default:           return base;
    }
  })();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    const fd = new FormData(e.currentTarget);
    const newTicket = {
      subject: fd.get('subject') as string,
      description: fd.get('description') as string,
      priority: fd.get('priority') as string,
      user_id: currentUserId,
      status: 'Open',
    };
    const { data, error } = await dbOp('tickets', 'insert', newTicket, undefined, '*, profiles(name)');
    if (error) { setSubmitError(error); setIsSubmitting(false); return; }
    if (data?.[0]) setTickets([data[0], ...tickets]);
    setIsSubmitting(false);
    setIsModalOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  const handleReplyAndResolve = async () => {
    if (!viewTicket || !replyText.trim()) return;
    setIsReplying(true);
    await dbOp('inbox_documents', 'insert', {
      user_id: viewTicket.user_id,
      title: `Re: ${viewTicket.subject}`,
      subject: `Re: ${viewTicket.subject}`,
      content: replyText.trim(),
      type: 'Notice',
      sender: 'Support Team',
      requires_signature: false,
    });
    await dbOp('tickets', 'update', { status: 'Resolved' }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, status: 'Resolved' } : t));
    setViewTicket(null);
    setReplyText('');
    setIsReplying(false);
  };

  const handleReopen = async (id: string) => {
    await dbOp('tickets', 'update', { status: 'Open' }, { id });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'Open' } : t));
  };

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all',        label: 'All',        count: tickets.length },
    { id: 'mine',       label: 'Mine',       count: tickets.filter(t => t.user_id === currentUserId).length },
    { id: 'unassigned', label: 'Unassigned', count: tickets.filter(t => !t.assigned_to && t.status !== 'Resolved').length },
    { id: 'critical',   label: 'Critical',   count: tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length },
  ];

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎫</div></div>
          <div className="stat-l">OPEN TICKETS</div>
          <div className="stat-v">{open.length}</div>
          <div className="stat-foot">Awaiting resolution</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico er">⚠</div></div>
          <div className="stat-l">CRITICAL</div>
          <div className="stat-v" style={{ color: 'var(--err)' }}>{tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length}</div>
          <div className="stat-foot">High priority · SLA at risk</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">○</div></div>
          <div className="stat-l">UNASSIGNED</div>
          <div className="stat-v">{tickets.filter(t => !t.assigned_to && t.status !== 'Resolved').length}</div>
          <div className="stat-foot">No agent assigned</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">✓</div></div>
          <div className="stat-l">RESOLVED</div>
          <div className="stat-v">{resolved.length}</div>
          <div className="stat-foot">Closed this period</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">Support Tickets</div>
            <div className="card-sub">{open.length} open · Avg first-response 4m 12s</div>
          </div>
          <button className="btn btn-acc btn-sm" onClick={() => setIsModalOpen(true)}>+ New Ticket</button>
        </div>

        <div style={{ padding: '0 18px 12px' }}>
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab${filterTab === t.id ? ' active' : ''}`} onClick={() => setFilterTab(t.id)}>
                {t.label} <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            No tickets in this view.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  {isMgmt && <th>From</th>}
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const ageMs = Date.now() - new Date(t.created_at).getTime();
                  const ageH = ageMs / 3_600_000;
                  const ageLabel = ageH < 1 ? `${Math.round(ageH * 60)}m` : ageH < 24 ? `${ageH.toFixed(1)}h` : `${Math.floor(ageH / 24)}d`;
                  return (
                    <tr key={t.id} onClick={() => { setViewTicket(t); setReplyText(''); }} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>#{(1000 + i).toString(16).toUpperCase()}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.subject}</div>
                        {t.description && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.description.slice(0, 80)}</div>}
                      </td>
                      {isMgmt && <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.profiles?.name ?? 'Unknown'}</td>}
                      <td><span className={PRIORITY_BADGE[t.priority] ?? 'bdg bdg-gy'}>{t.priority}</span></td>
                      <td><span className={STATUS_BADGE[t.status] ?? 'bdg bdg-gy'}>{t.status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        {t.status !== 'Resolved' && <SlaBar createdAt={t.created_at} priority={t.priority} />}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{ageLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create ticket modal */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 420 }}>
            <div className="md-t">Create Support Ticket</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld"><label>Issue Title</label><input type="text" name="subject" required /></div>
              <div className="pv-fld">
                <label>Priority</label>
                <select name="priority">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="pv-fld"><label>Description</label><textarea name="description" rows={4} required /></div>
              {submitError && (
                <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
                  {submitError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit'}</button>
                <button type="button" className="btn btn-sec" onClick={() => { setIsModalOpen(false); setSubmitError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View / Reply modal */}
      {viewTicket && (
        <div className="mb">
          <div className="md" style={{ width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{viewTicket.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
                  {isMgmt && viewTicket.profiles?.name && `From ${viewTicket.profiles.name} · `}
                  {new Date(viewTicket.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <span className={PRIORITY_BADGE[viewTicket.priority] ?? 'bdg bdg-gy'}>{viewTicket.priority}</span>
                <span className={STATUS_BADGE[viewTicket.status] ?? 'bdg bdg-gy'}>{viewTicket.status}</span>
              </div>
            </div>

            {viewTicket.status !== 'Resolved' && (
              <div style={{ marginBottom: 14 }}>
                <SlaBar createdAt={viewTicket.created_at} priority={viewTicket.priority} />
              </div>
            )}

            {viewTicket.description && (
              <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {viewTicket.description}
              </div>
            )}

            {isMgmt && viewTicket.status !== 'Resolved' && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Reply & Resolve</div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Type your reply — it will be sent to the employee's inbox and this ticket will be marked Resolved…"
                  style={{ width: '100%', padding: 10, border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-line)'}
                  onBlur={e => e.target.style.borderColor = 'var(--line)'}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {isMgmt && viewTicket.status !== 'Resolved' && (
                <button className="btn btn-acc" onClick={handleReplyAndResolve} disabled={isReplying || !replyText.trim()}>
                  {isReplying ? 'Sending…' : 'Send Reply & Resolve'}
                </button>
              )}
              {isMgmt && viewTicket.status === 'Resolved' && (
                <button className="btn btn-sec" onClick={() => { handleReopen(viewTicket.id); setViewTicket(null); }}>Reopen</button>
              )}
              <button className="btn btn-sec" onClick={() => setViewTicket(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
