'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';
import { createEmployeeAccount } from './actions';
import { useRouter } from 'next/navigation';

export default function UsersClient({ initialUsers, isMgmt, canAdd = false }: { initialUsers: any[], isMgmt: boolean, canAdd?: boolean }) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const router = useRouter();

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(filter.toLowerCase()) ||
    u.role?.toLowerCase().includes(filter.toLowerCase()) ||
    u.department?.toLowerCase().includes(filter.toLowerCase())
  );

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const username = fd.get('username') as string;
    const email = username.includes('@') ? username : `${username}@pioneers.com`;
    fd.set('email', email);
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Add New Employee</div>
            <form onSubmit={handleAddSubmit}>
              <div className="pv-fld"><label>Full name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Username or email</label><input type="text" name="username" required placeholder="e.g. john or john@company.com" /></div>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '440px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>{viewUser.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px', marginBottom: '16px' }}>
              {([
                ['ID', viewUser.id.substring(0, 8)],
                ['Role', viewUser.role],
                ['Department', viewUser.department || '—'],
                ['Location', viewUser.location || 'Remote'],
                ['Salary', `$${(viewUser.salary || 0).toLocaleString()}`],
                ['Points', `${viewUser.points ?? 0}/7`],
                ['Status', viewUser.clocked_in ? 'Online' : 'Offline'],
                ['Email', viewUser.email || '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: '#f5f6f8', padding: '9px 11px', borderRadius: '7px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '1px' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isMgmt && (
                <button className="pv-btn pv-btn-pri" onClick={() => setEditUser(viewUser)}>Edit Details</button>
              )}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '440px', maxWidth: '100%' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Edit — {editUser.name}</div>
            <form onSubmit={handleEditSave}>
              <div className="pv-fld"><label>Full Name</label><input type="text" name="name" defaultValue={editUser.name} required /></div>
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
