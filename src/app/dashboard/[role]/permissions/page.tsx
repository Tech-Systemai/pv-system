export default function PermissionsPage() {
  const cats = ['tasks', 'schedule', 'reports', 'tickets', 'hr', 'contracts', 'inbox', 'attendance', 'monitoring', 'policy', 'targets', 'coaching', 'planning', 'kb', 'chat'];
  const roles = ['owner', 'admin', 'supervisor', 'accountant', 'sales', 'cx'];

  return (
    <div className="pn" style={{ overflowX: 'auto' }}>
      <div className="pn-h">
        <div className="pn-t">Role Permissions</div>
        <button className="pv-btn pv-btn-pri">Save Changes</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #e4e7eb', color: '#6b7689' }}>Category</th>
            {roles.map(r => (
              <th key={r} style={{ textAlign: 'center', padding: '12px', borderBottom: '2px solid #e4e7eb', color: '#6b7689', textTransform: 'capitalize' }}>{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map(c => (
            <tr key={c} style={{ borderBottom: '1px solid #f0f2f5' }}>
              <td style={{ padding: '12px', fontWeight: 600, textTransform: 'capitalize' }}>{c}</td>
              {roles.map(r => {
                // Mock permissions: owner gets everything, admin gets most
                const hasPerm = r === 'owner' || (r === 'admin' && c !== 'policy') || (r === 'supervisor' && ['schedule', 'tasks', 'tickets', 'coaching'].includes(c));
                
                return (
                  <td key={r} style={{ textAlign: 'center', padding: '12px' }}>
                    <input type="checkbox" defaultChecked={hasPerm} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
