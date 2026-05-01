export default function OrgPage() {
  const tree = [
    [{ r: 'Owner', sub: 'Full access', k: 'owner' }],
    [{ r: 'Admin', sub: 'Operations', k: 'admin' }, { r: 'Accountant', sub: 'Finance', k: 'accountant' }],
    [{ r: 'Sales Sup', sub: 'Sales team', k: 'supervisor' }, { r: 'CX Sup', sub: 'CX team', k: 'supervisor' }],
    [{ r: 'Sales', sub: 'Front-line', k: 'sales' }, { r: 'CX', sub: 'Front-line', k: 'cx' }]
  ];

  return (
    <div className="pn">
      <div className="pn-t" style={{ marginBottom: '24px', textAlign: 'center' }}>Organization Hierarchy</div>
      {tree.map((l, li) => (
        <div key={li} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {li > 0 && <div className="org-c" style={{ width: '2px', height: '30px', background: '#cbd2e0', margin: '10px 0' }}></div>}
          <div className="org-l" style={{ display: 'flex', gap: '30px', justifyContent: 'center' }}>
            {l.map((n, i) => (
              <div key={i} className="org-n" style={{ background: '#fff', border: '1px solid #e4e7eb', padding: '16px 24px', borderRadius: '10px', minWidth: '160px', textAlign: 'center', boxShadow: '0 2px 4px rgba(15,23,42,0.02)' }}>
                <div className="org-nm" style={{ fontSize: '14px', fontWeight: 700, color: '#1a1f2e' }}>{n.r}</div>
                <div className="org-sb" style={{ fontSize: '11px', color: '#6b7689', marginTop: '4px' }}>{n.sub}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
