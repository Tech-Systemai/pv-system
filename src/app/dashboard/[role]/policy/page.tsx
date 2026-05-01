export default function PolicyPage() {
  const policies = [
    { name: 'Late Clock-In Penalty', trigger: 'Every 5 min late', action: '-0.5 points · -$10 salary', active: true, executed: 142 },
    { name: 'No-Show Penalty', trigger: 'Full day absence', action: '-3 points · -$60 salary', active: true, executed: 12 },
    { name: 'Termination Trigger', trigger: '7 points lost in cycle', action: 'Auto-flag for termination review', active: true, executed: 3 },
    { name: 'Overtime Bonus', trigger: 'Work > 8 hours/day', action: '+$25 / hour', active: false, executed: 0 }
  ];

  return (
    <div className="pn">
      <div className="pn-h">
        <div className="pn-t">Active rules · {policies.filter(p => p.active).length}</div>
        <button className="pv-btn pv-btn-pri">+ New rule</button>
      </div>
      
      {policies.map((p, i) => (
        <div key={i} className="r-cd" style={{ flexDirection: 'column', alignItems: 'stretch', opacity: p.active ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1f2e' }}>{p.name}</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span className="pv-bdg pv-bdg-indigo">{p.executed}× fired</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={p.active} /> Active
              </label>
            </div>
          </div>
          
          <div style={{ fontSize: '12.5px', color: '#4a5568', background: '#f5f6f8', padding: '10px 12px', borderRadius: '6px' }}>
            <div><strong>Trigger →</strong> {p.trigger}</div>
            <div style={{ marginTop: '4px' }}><strong>Action →</strong> {p.action}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
