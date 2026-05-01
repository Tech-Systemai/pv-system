import { mockLiveFeed, mockEmployees } from '@/lib/mock-db';

export default function MonitoringPage() {
  return (
    <div className="pv-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="pv-panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', marginRight: '8px' }}></span>
          Live System Monitoring
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Live Feed */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.08em', fontWeight: 600 }}>Activity Stream</h3>
          <div style={{ background: '#fff', border: '1px solid #e4e7eb', borderRadius: '8px' }}>
            {mockLiveFeed.map((feed, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: i === mockLiveFeed.length - 1 ? 'none' : '1px solid #f0f2f5', alignItems: 'center' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#6b7689', minWidth: '50px' }}>{feed.time}</div>
                <div style={{ fontSize: '13px', color: '#4a5568' }}>
                  <strong style={{ color: '#1a1f2e', fontWeight: 600 }}>{feed.user}</strong> {feed.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Screens */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '11px', color: '#6b7689', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.08em', fontWeight: 600 }}>Active Agents</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {mockEmployees.filter(e => e.clockedIn).map(emp => (
              <div key={emp.id} style={{ position: 'relative', aspectRatio: '16/9', background: '#f5f6f8', borderRadius: '8px', border: '1px solid #d8dde5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }}></div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#dc2626', letterSpacing: '0.05em' }}>REC</div>
                </div>
                <div style={{ color: '#6b7689', fontSize: '11px', fontWeight: 500 }}>{emp.name} Screen</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
