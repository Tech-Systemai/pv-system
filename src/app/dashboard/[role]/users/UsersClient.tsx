'use client';

import React, { useState, useEffect, useRef } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';
import { createEmployeeAccount, deleteEmployee, resetUserPassword } from './actions';
import { useRouter } from 'next/navigation';
import { CURRENCIES, fmt, getPayDates, fmtDate, fmtDateShort, type CurrencyCode } from '@/utils/currency';

const BUCKET = 'employee-docs';
const HUES = [268, 75, 155, 25, 290, 200, 50, 320];

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
  const hue = HUES[(name.charCodeAt(0) ?? 0) % HUES.length];
  return (
    <div className="av-circle" style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0, background: `linear-gradient(135deg,oklch(0.55 0.13 ${hue}),oklch(0.42 0.16 ${hue + 20}))` }}>
      {initials}
    </div>
  );
}

function StatCard({ ico, tone, label, value, foot }: { ico: string; tone: string; label: string; value: string | number; foot: string }) {
  const toneMap: Record<string, string> = { ind: 'stat-ico ind', ok: 'stat-ico ok', wn: 'stat-ico wn', er: 'stat-ico er' };
  return (
    <div className="stat-card" style={{ cursor: 'default' }}>
      <div className="stat-h"><div className={toneMap[tone] ?? 'stat-ico ind'}>{ico}</div></div>
      <div className="stat-l">{label}</div>
      <div className="stat-v">{value}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([code, c]) => ({ code, label: `${c.symbol} ${c.name} (${code})` }));

export default function UsersClient({
  initialUsers, isMgmt, canAdd = false,
}: {
  initialUsers: any[]; isMgmt: boolean; canAdd?: boolean;
}) {
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [viewHours, setViewHours] = useState<number | null>(null);
  const [viewUploading, setViewUploading] = useState<'contract' | 'id' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const contractRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!viewUser) { setViewHours(null); return; }
    supabase
      .from('attendance_logs')
      .select('clock_in_time, clock_out_time')
      .eq('user_id', viewUser.id)
      .not('clock_out_time', 'is', null)
      .then(({ data }) => {
        if (!data) { setViewHours(0); return; }
        const total = data.reduce((acc: number, log: any) => {
          const ms = new Date(log.clock_out_time).getTime() - new Date(log.clock_in_time).getTime();
          return acc + (ms > 0 ? ms / 3600000 : 0);
        }, 0);
        setViewHours(Math.round(total * 10) / 10);
      });
  }, [viewUser?.id]);

  const uploadEmployeeDoc = async (file: File, targetUserId: string, type: 'contract' | 'id') => {
    setViewUploading(type);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${targetUserId}/${type}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) { alert(`Upload failed: ${error.message}`); setViewUploading(null); return; }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const field = type === 'contract' ? 'contract_url' : 'id_document_url';
    await dbOp('profiles', 'update', { [field]: publicUrl }, { id: targetUserId });
    setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, [field]: publicUrl } : u));
    setViewUser((prev: any) => prev ? { ...prev, [field]: publicUrl } : prev);
    setViewUploading(null);
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(filter.toLowerCase()) ||
    u.role?.toLowerCase().includes(filter.toLowerCase()) ||
    u.department?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    fd.set('password', 'pioneers2026!');
    const result = await createEmployeeAccount(fd);
    if (result.error) {
      alert(result.error);
    } else {
      setIsModalOpen(false);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditSaving(true);
    const fd = new FormData(e.currentTarget);
    const updates = {
      name: fd.get('name') as string,
      username: fd.get('username') as string,
      department: fd.get('department') as string,
      role: fd.get('role') as string,
      salary: Number(fd.get('salary')),
      points: Number(fd.get('points')),
      status: fd.get('status') as string,
      currency: fd.get('currency') as string,
      start_date: (fd.get('start_date') as string) || null,
      training_end_date: (fd.get('training_end_date') as string) || null,
      first_pay_date: (fd.get('first_pay_date') as string) || null,
    };
    const { error } = await dbOp('profiles', 'update', updates, { id: editUser.id });
    if (!error) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u));
      setViewUser(null);
      setEditUser(null);
    }
    setEditSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetSaving(true);
    setResetMsg(null);
    const result = await resetUserPassword(resetTarget.id, resetPw);
    if (result.error) {
      setResetMsg({ text: result.error, ok: false });
    } else {
      setResetMsg({ text: 'Password updated successfully.', ok: true });
      setResetPw('');
    }
    setResetSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${viewUser.name}? This cannot be undone.`)) return;
    setDeleting(true);
    const result = await deleteEmployee(viewUser.id);
    if (result.error) {
      alert(result.error);
    } else {
      setUsers(prev => prev.filter(u => u.id !== viewUser.id));
      setViewUser(null);
    }
    setDeleting(false);
  };

  const activeCount = users.filter(u => u.clocked_in).length;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard ico="👥" tone="ind" label="HEADCOUNT" value={users.length} foot={`+${Math.max(0, users.length - 4)} this quarter`} />
        <StatCard ico="●" tone="ok" label="ACTIVE NOW" value={activeCount} foot={`${users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0}% on shift`} />
        <StatCard ico="📅" tone="wn" label="ANNIVERSARIES" value="3" foot="this week" />
        <StatCard ico="🎯" tone="ind" label="AVG TENURE" value="2.8y" foot="median: 2.4y" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-hdr" style={{ padding: '14px 18px' }}>
          <div>
            <div className="card-title">Directory</div>
            <div className="card-sub">{users.length} employees · {activeCount} active now</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search name, role, dept…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="fld-input"
              style={{ width: 200, fontSize: 12 }}
            />
            <div className="tabs" style={{ background: 'var(--surface-2)', padding: 3, borderRadius: 8 }}>
              <button className={`tab${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} style={{ fontSize: 12, padding: '4px 12px' }}>⊞ Grid</button>
              <button className={`tab${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} style={{ fontSize: 12, padding: '4px 12px' }}>☰ Table</button>
            </div>
            {canAdd && <button className="btn btn-acc btn-sm" onClick={() => setIsModalOpen(true)}>+ Invite</button>}
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>No employees found.</div>
        )}

        {viewMode === 'grid' && filteredUsers.length > 0 && (
          <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {filteredUsers.map(emp => {
              const isMgmtRole = emp.role === 'owner' || emp.role === 'admin';
              return (
                <div key={emp.id} onClick={() => setViewUser(emp)} style={{
                  background: 'var(--surface-2)', borderRadius: 12, padding: '18px 16px', cursor: 'pointer',
                  border: '1px solid var(--line)', transition: 'box-shadow 0.15s',
                }} onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-2)')}
                   onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <Avatar name={emp.name ?? 'U'} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{emp.department || emp.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`bdg ${isMgmtRole ? 'bdg-acc' : 'bdg-gy'}`}>{emp.role}</span>
                    {emp.status === 'Terminated' ? <span className="bdg bdg-err">Terminated</span>
                      : emp.status === 'Inactive' ? <span className="bdg bdg-gy">Inactive</span>
                      : emp.status === 'On Leave' ? <span className="bdg bdg-warn">On Leave</span>
                      : emp.clocked_in ? <span className="bdg bdg-ok">● Active</span>
                      : <span className="bdg bdg-gy">Offline</span>}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                    {emp.start_date ? `Started ${fmtDateShort(emp.start_date)}` : `Since ${emp.created_at ? new Date(emp.created_at).getFullYear() : '—'}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'table' && filteredUsers.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Email</th>
                  <th>Start Date</th>
                  <th>Status</th>
                  {isMgmt && <th>Salary</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(emp => {
                  const isMgmtRole = emp.role === 'owner' || emp.role === 'admin';
                  return (
                    <tr key={emp.id} onClick={() => setViewUser(emp)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp.name ?? 'U'} size={28} />
                          <span style={{ fontWeight: 500 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td><span className={`bdg ${isMgmtRole ? 'bdg-acc' : 'bdg-gy'}`}>{emp.role}</span></td>
                      <td style={{ color: 'var(--ink-3)' }}>{emp.department || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{emp.email || '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                        {emp.start_date ? fmtDate(emp.start_date) : emp.created_at ? new Date(emp.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td>
                        {emp.status === 'Terminated' ? <span className="bdg bdg-err">Terminated</span>
                          : emp.status === 'Inactive' ? <span className="bdg bdg-gy">Inactive</span>
                          : emp.status === 'On Leave' ? <span className="bdg bdg-warn">On Leave</span>
                          : emp.clocked_in ? <span className="bdg bdg-ok">● Active</span>
                          : <span className="bdg bdg-gy">Offline</span>}
                      </td>
                      {isMgmt && <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(emp.salary || 0, emp.currency)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="mb">
          <div className="md" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="md-t">Add New Employee</div>
            <form onSubmit={handleAddSubmit}>
              <div className="pv-fld"><label>Full Name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Username</label><input type="text" name="username" required placeholder="e.g. john.doe" /></div>
              <div className="pv-fld"><label>Email</label><input type="email" name="email" required placeholder="john@company.com" /></div>
              <div className="pv-fld">
                <label>Role</label>
                <select name="role" required>
                  <option value="sales">Sales</option>
                  <option value="cx">CX</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="dentist">Dentist</option>
                </select>
              </div>
              <div className="pv-fld"><label>Department</label><input type="text" name="department" placeholder="e.g. Sales Team A" /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="pv-fld">
                  <label>Base Salary</label>
                  <input type="number" name="salary" defaultValue={2500} required />
                </div>
                <div className="pv-fld">
                  <label>Currency</label>
                  <select name="currency" defaultValue="USD">
                    {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="pv-fld">
                  <label>Start Date</label>
                  <input type="date" name="start_date" />
                </div>
                <div className="pv-fld">
                  <label>Training End Date</label>
                  <input type="date" name="training_end_date" />
                </div>
              </div>
              <div className="pv-fld">
                <label>First Pay Date <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(anchors the bi-weekly schedule)</span></label>
                <input type="date" name="first_pay_date" />
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 7, fontSize: 11, color: 'var(--ink-3)', marginBottom: 16 }}>
                Default password: <strong>pioneers2026!</strong> — employee should change on first login.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Employee'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {viewUser && !editUser && (() => {
        const cur = viewUser.currency || 'USD';
        const payDates = getPayDates(viewUser.first_pay_date, 3);
        const isInTraining = viewUser.start_date && viewUser.training_end_date
          && new Date() >= new Date(viewUser.start_date)
          && new Date() <= new Date(viewUser.training_end_date);
        return (
          <div className="mb">
            <div className="md" style={{ width: 520, maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
              <div style={{ padding: '24px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <Avatar name={viewUser.name ?? 'U'} size={52} />
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{viewUser.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{viewUser.email || '—'}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {viewUser.status === 'Terminated' ? <span className="bdg bdg-err">Terminated</span>
                      : viewUser.status === 'Inactive' ? <span className="bdg bdg-gy">Inactive</span>
                      : viewUser.status === 'On Leave' ? <span className="bdg bdg-warn">On Leave</span>
                      : <span className="bdg bdg-ok">Employed</span>}
                    {isInTraining && <span className="bdg bdg-warn" style={{ fontSize: 10 }}>In Training</span>}
                    {(!viewUser.status || viewUser.status === 'Active') && (
                      <span className={`bdg ${viewUser.clocked_in ? 'bdg-ok' : 'bdg-gy'}`} style={{ fontSize: 10 }}>
                        {viewUser.clocked_in ? '● On shift' : '○ Off shift'}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginBottom: 14 }}>
                  {([
                    ['ID', viewUser.id.substring(0, 8)],
                    ['Username', viewUser.username ? `@${viewUser.username}` : '—'],
                    ['Role', viewUser.role],
                    ['Department', viewUser.department || '—'],
                    ['Employment', viewUser.status || 'Active'],
                    ['Location', viewUser.location || 'Remote'],
                    ['Salary', fmt(viewUser.salary || 0, cur)],
                    ['Currency', `${CURRENCIES[cur as CurrencyCode]?.symbol ?? ''} ${cur}`],
                    ['Points', `${viewUser.points ?? 7}/7`],
                    ['Hours Worked', viewHours === null ? '…' : `${viewHours} hrs`],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--surface-2)', padding: '9px 11px', borderRadius: 7 }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Pay Schedule */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Pay Schedule</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                    {[
                      ['Start Date', fmtDate(viewUser.start_date)],
                      ['Training Until', fmtDate(viewUser.training_end_date)],
                      ['First Pay Date', fmtDate(viewUser.first_pay_date)],
                      ['Frequency', viewUser.first_pay_date ? 'Bi-weekly' : '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {payDates.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Upcoming Pay Dates</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {payDates.map((d, i) => {
                          const isNext = i === 0;
                          return (
                            <div key={i} style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: isNext ? 700 : 400,
                              background: isNext ? 'var(--acc)' : 'var(--surface)',
                              color: isNext ? '#fff' : 'var(--ink-2)',
                              border: `1px solid ${isNext ? 'transparent' : 'var(--line)'}`,
                            }}>
                              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {isNext && <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.8 }}>next</span>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isMgmt && (
                <div style={{ padding: '0 24px' }}>
                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>📄 Signed Contract</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {viewUser.contract_url ? (
                        <a href={viewUser.contract_url} target="_blank" rel="noreferrer" className="btn btn-sec btn-sm" style={{ textDecoration: 'none', fontSize: 12 }}>View Contract</a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-4)', flex: 1 }}>No contract on file</span>
                      )}
                      <input ref={contractRef} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.[0]) uploadEmployeeDoc(e.target.files[0], viewUser.id, 'contract'); e.target.value = ''; }} />
                      <button onClick={() => contractRef.current?.click()} className="btn btn-sec btn-sm" disabled={!!viewUploading}>
                        {viewUploading === 'contract' ? 'Uploading…' : viewUser.contract_url ? 'Replace' : 'Upload Contract'}
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>🪪 ID Document</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {viewUser.id_document_url ? (
                        <a href={viewUser.id_document_url} target="_blank" rel="noreferrer" className="btn btn-sec btn-sm" style={{ textDecoration: 'none', fontSize: 12 }}>View ID</a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-4)', flex: 1 }}>No ID on file</span>
                      )}
                      <input ref={idRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                        onChange={e => { if (e.target.files?.[0]) uploadEmployeeDoc(e.target.files[0], viewUser.id, 'id'); e.target.value = ''; }} />
                      <button onClick={() => idRef.current?.click()} className="btn btn-sec btn-sm" disabled={!!viewUploading}>
                        {viewUploading === 'id' ? 'Uploading…' : viewUser.id_document_url ? 'Replace' : 'Upload ID'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding: '0 24px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {isMgmt && <button className="btn btn-pri btn-sm" onClick={() => setEditUser(viewUser)}>Edit Details</button>}
                {canAdd && (
                  <>
                    <button className="btn btn-sec btn-sm" onClick={() => { setResetTarget(viewUser); setResetPw(''); setResetMsg(null); }}>Reset Password</button>
                    <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.01 25)', color: 'oklch(0.50 0.18 25)', border: '1px solid oklch(0.88 0.06 25)' }}
                      onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Delete Employee'}
                    </button>
                  </>
                )}
                <button className="btn btn-sec btn-sm" onClick={() => setViewUser(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="mb">
          <div className="md" style={{ width: 380 }}>
            <div className="md-t">Reset Password — {resetTarget.name}</div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--ink-3)' }}>
              Set a new password directly. The user can change it again after signing in.
            </div>
            {resetMsg && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
                background: resetMsg.ok ? 'oklch(0.97 0.04 145)' : 'oklch(0.97 0.03 25)',
                color: resetMsg.ok ? 'var(--ok)' : 'var(--err)',
                border: `1px solid ${resetMsg.ok ? 'oklch(0.88 0.07 145)' : 'oklch(0.90 0.06 25)'}`,
              }}>
                {resetMsg.text}
              </div>
            )}
            <div className="pv-fld">
              <label>New Password</label>
              <input type="text" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="Min. 6 characters" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-acc" disabled={resetSaving || resetPw.length < 6} onClick={handleResetPassword}>
                {resetSaving ? 'Saving…' : 'Set Password'}
              </button>
              <button className="btn btn-sec" onClick={() => { setResetTarget(null); setResetMsg(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editUser && (
        <div className="mb">
          <div className="md" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="md-t">Edit — {editUser.name}</div>
            <form onSubmit={handleEditSave}>
              <div className="pv-fld"><label>Full Name</label><input type="text" name="name" defaultValue={editUser.name} required /></div>
              <div className="pv-fld"><label>Username</label><input type="text" name="username" defaultValue={editUser.username ?? ''} required /></div>
              <div className="pv-fld">
                <label>Role</label>
                <select name="role" defaultValue={editUser.role}>
                  <option value="sales">Sales</option>
                  <option value="cx">CX</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="dentist">Dentist</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="pv-fld"><label>Department</label><input type="text" name="department" defaultValue={editUser.department ?? ''} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="pv-fld">
                  <label>Base Salary</label>
                  <input type="number" name="salary" defaultValue={editUser.salary ?? 2500} required />
                </div>
                <div className="pv-fld">
                  <label>Currency</label>
                  <select name="currency" defaultValue={editUser.currency ?? 'USD'}>
                    {CURRENCY_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="pv-fld">
                <label>Reliability Points (0–7)</label>
                <input type="number" name="points" defaultValue={editUser.points ?? 7} min={0} max={7} required />
              </div>
              <div className="pv-fld">
                <label>Employment Status</label>
                <select name="status" defaultValue={editUser.status ?? 'Active'}>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>

              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="pv-fld">
                  <label>Start Date</label>
                  <input type="date" name="start_date" defaultValue={editUser.start_date ?? ''} />
                </div>
                <div className="pv-fld">
                  <label>Training End Date</label>
                  <input type="date" name="training_end_date" defaultValue={editUser.training_end_date ?? ''} />
                </div>
              </div>
              <div className="pv-fld">
                <label>First Pay Date <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(anchors the bi-weekly schedule)</span></label>
                <input type="date" name="first_pay_date" defaultValue={editUser.first_pay_date ?? ''} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
