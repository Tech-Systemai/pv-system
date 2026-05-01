'use client';
import { useRouter } from 'next/navigation';

export default function PortalSwitcher({ currentRole }: { currentRole: string }) {
  const router = useRouter();
  
  const roles = [
    { id: 'owner', label: 'Owner Portal' },
    { id: 'admin', label: 'Admin Portal' },
    { id: 'supervisor', label: 'Supervisor' },
    { id: 'sales', label: 'Sales Agent' },
    { id: 'cx', label: 'CX Agent' },
    { id: 'accountant', label: 'Finance/Accountant' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Switch View:</span>
      <select 
        value={currentRole}
        onChange={(e) => router.push(`/dashboard/${e.target.value}`)}
        style={{ 
          background: 'transparent', border: 'none', fontSize: '12px', fontWeight: 600, color: '#1e293b', outline: 'none', cursor: 'pointer'
        }}
      >
        {roles.map(r => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}
