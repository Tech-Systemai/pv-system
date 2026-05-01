'use client';

import { useState } from 'react';
import { createEmployeeAccount } from './actions';
import { useRouter } from 'next/navigation';

export default function UsersClient({ initialUsers, isMgmt }: { initialUsers: any[], isMgmt: boolean }) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(filter.toLowerCase()) || 
    u.role.toLowerCase().includes(filter.toLowerCase())
  );

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const email = username.includes('@') ? username : `${username}@pioneers.com`;
    formData.set('email', email);
    formData.set('password', 'pioneers2026!'); // default temp password

    const result = await createEmployeeAccount(formData);
    
    if (result.error) {
      alert(result.error);
    } else {
      setIsModalOpen(false);
      router.refresh(); // Refresh page to get updated users from server
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="pn-h" style={{ marginBottom: '14px' }}>
        <div></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Search employees..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #e4e7eb', borderRadius: '7px', fontSize: '12px', width: '200px', outline: 'none' }} 
          />
          <button className="pv-btn pv-btn-sec">Filter</button>
          {isMgmt && <button className="pv-btn pv-btn-pri" onClick={() => setIsModalOpen(true)}>+ Add Employee</button>}
        </div>
      </div>
      
      <div className="pn">
        {filteredUsers.map(e => {
          const avClass = e.role === 'supervisor' || e.role === 'admin' ? 'cy' : e.role === 'cx' ? 'gn' : e.role === 'accountant' ? 'gy' : 'am';
          const initials = e.name ? e.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U';
          const isMgmtRole = e.role === 'owner' || e.role === 'admin';
          
          return (
            <div key={e.id} className="r-cd" onClick={() => setViewUser(e)} style={{ cursor: 'pointer' }}>
              <div className={`av ${avClass}`}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {e.name} {e.clocked_in && <span className="pulse" style={{ width: '6px', height: '6px' }}></span>}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7689' }}>
                  {e.id.substring(0,8)} · {e.department} · {e.location || 'Remote'}
                </div>
              </div>
              
              <span className={`pv-bdg ${isMgmtRole ? 'pv-bdg-indigo' : 'pv-bdg-gray'}`}>{e.role}</span>
              
              <div className="points" title={`${e.points}/7`} style={{ display: 'flex', gap: '3px' }}>
                {[1,2,3,4,5,6,7].map(n => (
                  <div key={n} className="pt-bar" style={{ 
                    width: '7px', height: '16px', borderRadius: '2px', 
                    background: n > e.points ? '#ef4444' : '#e4e7eb' 
                  }}></div>
                ))}
              </div>
              
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                ${(e.salary || 0).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>Add new employee</div>
            <form onSubmit={handleAddSubmit}>
              <div className="pv-fld"><label>Full name</label><input type="text" name="name" required /></div>
              <div className="pv-fld"><label>Username (or email)</label><input type="text" name="username" required /></div>
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
              <div className="pv-fld"><label>Base Salary</label><input type="number" name="salary" defaultValue={2500} required /></div>
              
              <div style={{ background: '#f5f6f8', padding: '10px', borderRadius: '6px', fontSize: '11px', color: '#6b7689', marginBottom: '16px' }}>
                Temporary password will be <strong>pioneers2026!</strong>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="pv-btn pv-btn-pri" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Employee'}
                </button>
                <button type="button" className="pv-btn pv-btn-sec" onClick={() => setIsModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewUser && (
        <div className="mb" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="md" style={{ background: '#fff', padding: '24px', borderRadius: '14px', width: '420px', maxWidth: '100%' }}>
            <div className="md-t" style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>{viewUser.name} · Profile</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px', marginBottom: '13px' }}>
              {[
                ['ID', viewUser.id.substring(0,8)],
                ['Role', viewUser.role],
                ['Department', viewUser.department],
                ['Location', viewUser.location || 'Remote'],
                ['Salary', `$${viewUser.salary.toLocaleString()}`],
                ['Points', `${viewUser.points}/7`]
              ].map(([k, v]) => (
                <div key={k as string} style={{ background: '#f5f6f8', padding: '9px 11px', borderRadius: '7px' }}>
                  <div style={{ fontSize: '10px', color: '#6b7689', fontWeight: 600, textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '1px' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isMgmt && <button className="pv-btn pv-btn-pri">Edit details</button>}
              <button className="pv-btn pv-btn-sec" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
