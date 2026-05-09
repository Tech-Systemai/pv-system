'use client';

import { useState, useEffect, useRef } from 'react';
import { dbOp } from '@/utils/db';

type FilterTab = 'all' | 'employee' | 'customer' | 'mine' | 'unassigned' | 'critical';

type Reply = {
  id: string;
  ticket_id: string;
  user_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

const PRIORITY_BADGE: Record<string, string> = {
  High:   'bdg bdg-err',
  Medium: 'bdg bdg-warn',
  Low:    'bdg bdg-gy',
};
const STATUS_BADGE: Record<string, string> = {
  Open:     'bdg bdg-acc',
  Resolved: 'bdg bdg-ok',
};
const TYPE_BADGE: Record<string, string> = {
  employee: 'bdg bdg-gy',
  customer: 'bdg bdg-acc',
};

function SlaBar({ createdAt, priority }: { createdAt: string; priority: string }) {
  const slaHours  = priority === 'High' ? 4 : priority === 'Medium' ? 24 : 72;
  const elapsedH  = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const pct       = Math.min(100, (elapsedH / slaHours) * 100);
  const color     = pct >= 90 ? 'var(--err)' : pct >= 65 ? 'var(--warn)' : 'var(--ok)';
  const remaining = Math.max(0, slaHours - elapsedH);
  const label     = remaining < 1 ? `${Math.round(remaining * 60)}m` : `${remaining.toFixed(1)}h`;
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: pct >= 90 ? color : 'var(--ink-4)' }}>
        {pct >= 100 ? 'BREACHED' : `${label} left`}
      </div>
    </div>
  );
}

export default function TicketsClient({
  initialTickets, isMgmt, userRole, currentUserId, allUsers,
}: {
  initialTickets: any[]; isMgmt: boolean; userRole: string; currentUserId: string; allUsers?: any[];
}) {
  const [tickets, setTickets]         = useState(initialTickets);
  const [filterTab, setFilterTab]     = useState<FilterTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewTicket, setViewTicket]   = useState<any>(null);
  const [replies, setReplies]         = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText]     = useState('');
  const [sending, setSending]         = useState(false);
  const [resolving, setResolving]     = useState(false);
  const [claiming, setClaiming]       = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const threadBottomRef = useRef<HTMLDivElement>(null);

  const isCX = userRole === 'cx';
  const currentUserName = (allUsers ?? []).find((u: any) => u.id === currentUserId)?.name ?? 'Me';

  const open     = tickets.filter(t => t.status !== 'Resolved');
  const resolved = tickets.filter(t => t.status === 'Resolved');

  // Load replies whenever a ticket is opened
  useEffect(() => {
    if (!viewTicket) { setReplies([]); return; }
    setLoadingReplies(true);
    dbOp('ticket_replies', 'select', undefined, { ticket_id: viewTicket.id })
      .then(({ data }) => { setReplies(data ?? []); setLoadingReplies(false); });
  }, [viewTicket?.id]);

  // Scroll thread to bottom when replies load or a new one arrives
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const filtered = (() => {
    switch (filterTab) {
      case 'employee':   return tickets.filter(t => (t.ticket_type ?? 'employee') === 'employee');
      case 'customer':   return tickets.filter(t => t.ticket_type === 'customer');
      case 'mine':       return tickets.filter(t => t.user_id === currentUserId);
      case 'unassigned': return tickets.filter(t => !t.assigned_to && t.status !== 'Resolved');
      case 'critical':   return tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved');
      default:           return tickets;
    }
  })();

  // ── Create new ticket ──────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');
    const fd       = new FormData(e.currentTarget);
    const titleVal = fd.get('subject') as string;
    const newTicket: Record<string, any> = {
      title:       titleVal,
      description: fd.get('description') as string,
      priority:    fd.get('priority') as string,
      ticket_type: fd.get('ticket_type') as string,
      user_id:     currentUserId,
      status:      'Open',
    };
    let { data, error } = await dbOp('tickets', 'insert', newTicket);
    if (error && (error.toLowerCase().includes('ticket_type') || error.toLowerCase().includes('schema cache'))) {
      ({ data, error } = await dbOp('tickets', 'insert', {
        title: titleVal, description: newTicket.description,
        priority: newTicket.priority, user_id: currentUserId, status: 'Open',
      }));
    }
    if (error) { setSubmitError(error); setIsSubmitting(false); return; }
    const nameMap = Object.fromEntries((allUsers ?? []).map((u: any) => [u.id, u.name]));
    const row = data?.[0] ?? { ...newTicket, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() };
    setTickets(prev => [{ ...row, profiles: { name: nameMap[currentUserId] ?? 'Me' } }, ...prev]);
    setIsSubmitting(false);
    setIsModalOpen(false);
    (e.target as HTMLFormElement).reset();
  };

  // ── Send a reply ───────────────────────────────────────────────────────────
  const handleReply = async () => {
    if (!replyText.trim() || !viewTicket || sending) return;
    setSending(true);
    const newReply = {
      ticket_id:   viewTicket.id,
      user_id:     currentUserId,
      sender_name: currentUserName,
      content:     replyText.trim(),
    };
    const { data, error } = await dbOp('ticket_replies', 'insert', newReply);
    if (error) { setSending(false); return; }
    const saved: Reply = data?.[0] ?? { ...newReply, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() };
    setReplies(prev => [...prev, saved]);
    setReplyText('');
    setSending(false);
  };

  // ── Resolve ticket ─────────────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!viewTicket || resolving) return;
    setResolving(true);
    await dbOp('tickets', 'update', { status: 'Resolved' }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, status: 'Resolved' } : t));
    setViewTicket((prev: any) => ({ ...prev, status: 'Resolved' }));
    setResolving(false);
  };

  // ── Reopen ticket ──────────────────────────────────────────────────────────
  const handleReopen = async () => {
    if (!viewTicket) return;
    await dbOp('tickets', 'update', { status: 'Open' }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, status: 'Open' } : t));
    setViewTicket((prev: any) => ({ ...prev, status: 'Open' }));
  };

  // ── Claim ticket ───────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!viewTicket || claiming) return;
    setClaiming(true);
    await dbOp('tickets', 'update', { assigned_to: currentUserId }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, assigned_to: currentUserId } : t));
    setViewTicket((prev: any) => ({ ...prev, assigned_to: currentUserId }));
    setClaiming(false);
  };

  // ── Release claim ──────────────────────────────────────────────────────────
  const handleRelease = async () => {
    if (!viewTicket || claiming) return;
    setClaiming(true);
    await dbOp('tickets', 'update', { assigned_to: null }, { id: viewTicket.id });
    setTickets(prev => prev.map(t => t.id === viewTicket.id ? { ...t, assigned_to: null } : t));
    setViewTicket((prev: any) => ({ ...prev, assigned_to: null }));
    setClaiming(false);
  };

  const baseTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all',        label: 'All',        count: tickets.length },
    { id: 'mine',       label: 'Mine',       count: tickets.filter(t => t.user_id === currentUserId).length },
    { id: 'unassigned', label: 'Unassigned', count: tickets.filter(t => !t.assigned_to && t.status !== 'Resolved').length },
    { id: 'critical',   label: 'Critical',   count: tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length },
  ];
  const TABS = isMgmt
    ? [
        { id: 'employee' as FilterTab, label: 'Employee', count: tickets.filter(t => (t.ticket_type ?? 'employee') === 'employee').length },
        { id: 'customer' as FilterTab, label: 'Customer', count: tickets.filter(t => t.ticket_type === 'customer').length },
        ...baseTabs,
      ]
    : baseTabs;

  const defaultType = isCX ? 'customer' : 'employee';

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
        {isMgmt && (
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ind">👤</div></div>
            <div className="stat-l">EMPLOYEE TICKETS</div>
            <div className="stat-v">{tickets.filter(t => (t.ticket_type ?? 'employee') === 'employee').length}</div>
            <div className="stat-foot">Internal · Private</div>
          </div>
        )}
        {isMgmt && (
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico ok">🌐</div></div>
            <div className="stat-l">CUSTOMER TICKETS</div>
            <div className="stat-v">{tickets.filter(t => t.ticket_type === 'customer').length}</div>
            <div className="stat-foot">CX · Shared</div>
          </div>
        )}
        {!isMgmt && (
          <div className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className="stat-ico er">⚠</div></div>
            <div className="stat-l">CRITICAL</div>
            <div className="stat-v" style={{ color: 'var(--err)' }}>{tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved').length}</div>
            <div className="stat-foot">High priority · SLA at risk</div>
          </div>
        )}
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
            <div className="card-sub">{open.length} open · shared across all portals</div>
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
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No tickets in this view.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th><th>Title</th>
                  {(isMgmt || isCX) && <th>From</th>}
                  <th>Type</th><th>Priority</th><th>Status</th>
                  {(isMgmt || isCX) && <th>Assigned</th>}
                  <th>SLA</th><th>Age</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const ageH     = (Date.now() - new Date(t.created_at).getTime()) / 3_600_000;
                  const ageLabel = ageH < 1 ? `${Math.round(ageH * 60)}m` : ageH < 24 ? `${ageH.toFixed(1)}h` : `${Math.floor(ageH / 24)}d`;
                  const tType    = t.ticket_type ?? 'employee';
                  return (
                    <tr key={t.id} onClick={() => { setViewTicket(t); setReplyText(''); }} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>#{(1000 + i).toString(16).toUpperCase()}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.title ?? t.subject}</div>
                        {t.description && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.description.slice(0, 80)}</div>}
                      </td>
                      {(isMgmt || isCX) && <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.profiles?.name ?? 'Unknown'}</td>}
                      <td><span className={TYPE_BADGE[tType] ?? 'bdg bdg-gy'} style={{ fontSize: 10 }}>{tType === 'customer' ? '🌐 Customer' : '👤 Employee'}</span></td>
                      <td><span className={PRIORITY_BADGE[t.priority] ?? 'bdg bdg-gy'}>{t.priority}</span></td>
                      <td><span className={STATUS_BADGE[t.status] ?? 'bdg bdg-gy'}>{t.status}</span></td>
                      {(isMgmt || isCX) && (
                        <td style={{ fontSize: 12 }}>
                          {t.assigned_to
                            ? t.assigned_to === currentUserId
                              ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>You</span>
                              : <span style={{ color: 'var(--ink-3)' }}>{(allUsers ?? []).find((u: any) => u.id === t.assigned_to)?.name ?? '—'}</span>
                            : <span style={{ color: 'var(--ink-4)' }}>—</span>
                          }
                        </td>
                      )}
                      <td onClick={e => e.stopPropagation()}>{t.status !== 'Resolved' && <SlaBar createdAt={t.created_at} priority={t.priority} />}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{ageLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create ticket modal ── */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 440 }}>
            <div className="md-t">Create Support Ticket</div>
            <form onSubmit={handleCreate}>
              <div className="pv-fld"><label>Issue Title</label><input type="text" name="subject" required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="pv-fld">
                  <label>Type</label>
                  <select name="ticket_type" defaultValue={defaultType}>
                    <option value="employee">👤 Employee (Private)</option>
                    <option value="customer">🌐 Customer (Shared)</option>
                  </select>
                </div>
                <div className="pv-fld">
                  <label>Priority</label>
                  <select name="priority">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              <div className="pv-fld"><label>Description</label><textarea name="description" rows={4} required /></div>
              {submitError && (
                <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>{submitError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit Ticket'}</button>
                <button type="button" className="btn btn-sec" onClick={() => { setIsModalOpen(false); setSubmitError(''); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Ticket thread modal ── */}
      {viewTicket && (
        <div className="mb" onClick={e => { if (e.target === e.currentTarget) setViewTicket(null); }}>
          <div className="md" style={{ width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{viewTicket.title ?? viewTicket.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {(isMgmt || isCX) && viewTicket.profiles?.name && <span>Opened by {viewTicket.profiles.name} · </span>}
                    {new Date(viewTicket.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className={TYPE_BADGE[viewTicket.ticket_type ?? 'employee'] ?? 'bdg bdg-gy'} style={{ fontSize: 10 }}>
                    {viewTicket.ticket_type === 'customer' ? '🌐 Customer' : '👤 Employee'}
                  </span>
                  <span className={PRIORITY_BADGE[viewTicket.priority] ?? 'bdg bdg-gy'}>{viewTicket.priority}</span>
                  <span className={STATUS_BADGE[viewTicket.status] ?? 'bdg bdg-gy'}>{viewTicket.status}</span>
                </div>
              </div>
              {/* Assignment row */}
              {(isMgmt || isCX) && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  {viewTicket.assigned_to ? (
                    <>
                      <span style={{ color: 'var(--ink-3)' }}>
                        Assigned to{' '}
                        <strong style={{ color: viewTicket.assigned_to === currentUserId ? 'var(--accent)' : 'var(--ink)' }}>
                          {viewTicket.assigned_to === currentUserId
                            ? 'you'
                            : (allUsers ?? []).find((u: any) => u.id === viewTicket.assigned_to)?.name ?? 'Unknown'}
                        </strong>
                      </span>
                      {viewTicket.assigned_to === currentUserId ? (
                        <button className="btn btn-ghost btn-sm" onClick={handleRelease} disabled={claiming} style={{ fontSize: 11, padding: '2px 8px' }}>
                          Release
                        </button>
                      ) : isMgmt ? (
                        <button className="btn btn-ghost btn-sm" onClick={handleClaim} disabled={claiming} style={{ fontSize: 11, padding: '2px 8px' }}>
                          {claiming ? '…' : 'Reassign to me'}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span style={{ color: 'var(--ink-4)' }}>Unassigned</span>
                      <button className="btn btn-acc btn-sm" onClick={handleClaim} disabled={claiming} style={{ fontSize: 11, padding: '2px 10px' }}>
                        {claiming ? '…' : 'Claim'}
                      </button>
                    </>
                  )}
                </div>
              )}
              {viewTicket.status === 'Open' && (
                <div style={{ marginTop: 10 }}>
                  <SlaBar createdAt={viewTicket.created_at} priority={viewTicket.priority} />
                </div>
              )}
            </div>

            {/* Thread — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Original request */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{viewTicket.profiles?.name ?? 'Employee'}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{new Date(viewTicket.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                  {viewTicket.description ?? '(No description)'}
                </div>
              </div>

              {/* Reply cards */}
              {loadingReplies ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--ink-4)' }}>Loading replies…</div>
              ) : (
                replies.map(r => {
                  const isMe = r.user_id === currentUserId;
                  return (
                    <div key={r.id} style={{
                      border: `1px solid ${isMe ? 'var(--accent-line)' : 'var(--line)'}`,
                      borderRadius: 10, overflow: 'hidden',
                      marginLeft: isMe ? 32 : 0,
                      marginRight: isMe ? 0 : 32,
                    }}>
                      <div style={{ padding: '8px 14px', background: isMe ? 'oklch(0.96 0.04 268)' : 'var(--surface-2)', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: isMe ? 'var(--accent)' : 'var(--ink)' }}>{isMe ? 'You' : r.sender_name}</span>
                        <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                        {r.content}
                      </div>
                    </div>
                  );
                })
              )}

              {viewTicket.status === 'Resolved' && (
                <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'oklch(0.42 0.12 155)', fontWeight: 600 }}>
                  ✓ Ticket resolved
                </div>
              )}

              <div ref={threadBottomRef} />
            </div>

            {/* Reply input + actions — always visible */}
            <div style={{ borderTop: '2px solid var(--line)', padding: '14px 20px', flexShrink: 0, background: 'white' }}>
              {viewTicket.status === 'Open' ? (
                <>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(); }}
                    rows={3}
                    placeholder="Write a reply… (Ctrl+Enter to send)"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent-line)'}
                    onBlur={e => e.target.style.borderColor = 'var(--line)'}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-acc" disabled={!replyText.trim() || sending} onClick={handleReply}>
                      {sending ? 'Sending…' : '↩ Send Reply'}
                    </button>
                    {isMgmt && (
                      <button className="btn btn-sec" disabled={resolving} onClick={handleResolve}
                        style={{ marginLeft: 'auto', color: 'oklch(0.42 0.12 155)', borderColor: 'oklch(0.85 0.08 155)', background: 'var(--ok-soft)' }}>
                        {resolving ? 'Resolving…' : '✓ Mark Resolved'}
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => setViewTicket(null)} style={{ marginLeft: isMgmt ? 0 : 'auto' }}>Close</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>This ticket is resolved.</div>
                  {isMgmt && (
                    <button className="btn btn-sec btn-sm" onClick={handleReopen}>Reopen</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewTicket(null)}>Close</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
