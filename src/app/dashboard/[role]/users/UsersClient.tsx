'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { dbOp } from '@/utils/db';
import { createClient } from '@/utils/supabase/client';
import { createEmployeeAccount, deleteEmployee } from './actions';
import { useRouter } from 'next/navigation';

const BUCKET = 'employee-docs';

export default function UsersClient({
  initialUsers, isMgmt, canAdd = false,
}: {
  initialUsers: any[]; isMgmt: boolean; canAdd?: boolean;
}) {
  const supabase = createClient();
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [viewHours, setViewHours] = useState<number | null>(null);
  const [viewUploading, setViewUploading] = useState<'contract' | 'id' | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const handleAddSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

  const handleEditSave = async (e: FormEvent<HTMLFormElement>) => {
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
    };
    const { error } = await dbOp('profiles', 'update', updates, { id: editUser.id });
    if (!error) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updates } : u));
      setViewUser(null);
      setEditUser(null);
    }
    setEditSaving(false);
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

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div className="pn-t">Employee Directory</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search by name, role, dept..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #e4e7eb', borderRadius: '7px', fontSize: '12px', width: '220px', outline: 'none' }}
          />
          {canAdd && (
            <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ Add Employee</button>
          )}
        </div>
      </div>

      <div className="pn">
        {filteredUsers.length === 0 && <div className="empty">No employees found.</div>}
        {filteredUsers.map(e => {
          const avClass = e.role === 'supervisor' || e.role === 'admin' ? 'cy' : e.role === 'cx' ? 'gn' : e.role === 'accountant' ? 'gy' : 'am';
          const initials = e.name ? e.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U';
          const isMgmtRole = e.role === 'owner' || e.role === 'admin';
          return (
            <div key={e.id} className="r-cd" onClick={() => setViewUser(e)} style={{ cursor: 'pointer' }}>
              <div className={`av ${avClass}`}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {e.name}
                  {e.clocked_in && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>
                  {e.id.substring(0, 8)} · {e.department || '—'} · {e.location || 'Remote'}
                </div>
              </div>
              <span className={`pv-bdg ${isMgmtRole ? 'pv-bdg-indigo' : 'pv-bdg-gray'}`}>{e.role}</span>
              <div style={{ display: 'flex', gap: '3px' }} title={`${e.points ?? 0}/7 points`}>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <div key={n} style={{ width: '7px', height: '16px', borderRadius: '2px', background: n <= (e.points ?? 0) ? '#4f46e5' : '#e4e7eb' }} />
                ))}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>${(e.salary || 0).toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Add New Employee</div>
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
                </select>
              </div>
              <div className="pv-fld"><label>Department</label><input type="text" name="department" placeholder="e.g. Sales Team A" /></div>
              <div className="pv-fld"><label>Base Salary ($)</label><input type="number" name="salary" defaultValue={2500} required /></div>
              <div style={{ background: '#f5f6f8', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#6b7689', marginBottom: '16px' }}>
                Default password: <strong>pioneers2026!</strong> — employee should change on first login.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Employee'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {viewUser && !editUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '500px', maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>{viewUser.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px', marginBottom: '16px' }}>
                {([
                  ['ID', viewUser.id.substring(0, 8)],
                  ['Username', viewUser.username ? `@${viewUser.username}` : '—'],
                  ['Role', viewUser.role],
                  ['Department', viewUser.department || '—'],
                  ['Location', viewUser.location || 'Remote'],
                  ['Salary', `$${(viewUser.salary || 0).toLocaleString()}`],
                  ['Points', `${viewUser.points ?? 0}/7`],
                  ['Status', viewUser.clocked_in ? 'Online' : 'Offline'],
                  ['Email', viewUser.email || '—'],
                  ['Hours Worked', viewHours === null ? '…' : `${viewHours} hrs`],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ background: '#f5f6f8', padding: '9px 11px', borderRadius: '7px' }}>
                    <div style={{ fontSize: '10px', color: '#6b7689', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '1px' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {isMgmt && (
              <div style={{ padding: '0 24px' }}>
                <div style={{ padding: '14px', background: '#f8f9fb', borderRadius: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>📄 Signed Contract</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {viewUser.contract_url ? (
                      <a href={viewUser.contract_url} target="_blank" rel="noreferrer" className="pv-btn pv-btn-sec" style={{ fontSize: '12px', textDecoration: 'none' }}>View Contract</a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>No contract on file</span>
                    )}
                    <input ref={contractRef} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadEmployeeDoc(e.target.files[0], viewUser.id, 'contract'); e.target.value = ''; }} />
                    <button onClick={() => contractRef.current?.click()} className="pv-btn pv-btn-sec" style={{ fontSize: '12px' }} disabled={!!viewUploading}>
                      {viewUploading === 'contract' ? 'Uploading…' : viewUser.contract_url ? 'Replace' : 'Upload Contract'}
                    </button>
                  </div>
                </div>

                <div style={{ padding: '14px', background: '#f8f9fb', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>🪪 ID Document</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {viewUser.id_document_url ? (
                      <a href={viewUser.id_document_url} target="_blank" rel="noreferrer" className="pv-btn pv-btn-sec" style={{ fontSize: '12px', textDecoration: 'none' }}>View ID</a>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1 }}>No ID on file</span>
                    )}
                    <input ref={idRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadEmployeeDoc(e.target.files[0], viewUser.id, 'id'); e.target.value = ''; }} />
                    <button onClick={() => idRef.current?.click()} className="pv-btn pv-btn-sec" style={{ fontSize: '12px' }} disabled={!!viewUploading}>
                      {viewUploading === 'id' ? 'Uploading…' : viewUser.id_document_url ? 'Replace' : 'Upload ID'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '0 24px 24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isMgmt && (
                <button className="pv-btn pv-btn-pri" onClick={() => setEditUser(viewUser)}>Edit Details</button>
              )}
              {canAdd && (
                <button
                  className="pv-btn"
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete Employee'}
                </button>
              )}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Edit — {editUser.name}</div>
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
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="pv-fld"><label>Department</label><input type="text" name="department" defaultValue={editUser.department ?? ''} /></div>
              <div className="pv-fld"><label>Base Salary ($)</label><input type="number" name="salary" defaultValue={editUser.salary ?? 2500} required /></div>
              <div className="pv-fld">
                <label>Reliability Points (0–7)</label>
                <input type="number" name="points" defaultValue={editUser.points ?? 7} min={0} max={7} required />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setEditUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
