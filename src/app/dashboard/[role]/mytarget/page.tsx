import { createClient } from '@/utils/supabase/server';

const TIERS = [
  { range: '1–10 sales', value: '$10/sale', min: 1, max: 10 },
  { range: '11–20 sales', value: '$15/sale', min: 11, max: 20 },
  { range: '21–30 sales', value: '$20/sale', min: 21, max: 30 },
  { range: '31–40 sales', value: '$25/sale', min: 31, max: 40 },
  { range: '41+ sales', value: '$40/sale', min: 41, max: Infinity },
];

export default async function MyTargetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: sales } = await supabase
    .from('sales_logs')
    .select('id, amount')
    .eq('user_id', user.id)
    .eq('type', 'Sale')
    .gte('created_at', startOfMonth.toISOString());

  const salesCount = sales?.length ?? 0;
  const totalRevenue = sales?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0;
  const TARGET = 50;
  const progressPct = Math.min((salesCount / TARGET) * 100, 100);
  const currentTierIdx = TIERS.findIndex(t => salesCount >= t.min && salesCount <= t.max);

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">🎯</div></div>
          <div className="stat-l">SALES THIS MONTH</div>
          <div className="stat-v">{salesCount}</div>
          <div className="stat-foot">of {TARGET} target</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">REVENUE LOGGED</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalRevenue.toLocaleString()}</div>
          <div className="stat-foot">This month</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">◈</div></div>
          <div className="stat-l">PROGRESS</div>
          <div className="stat-v">{progressPct.toFixed(0)}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>%</span></div>
          <div className="stat-foot">{TARGET - salesCount > 0 ? `${TARGET - salesCount} sales to go` : 'Target met!'}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico wn">⭐</div></div>
          <div className="stat-l">CURRENT TIER</div>
          <div className="stat-v" style={{ fontSize: 16 }}>{currentTierIdx >= 0 ? TIERS[currentTierIdx].value : '—'}</div>
          <div className="stat-foot">Commission rate</div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 18px', marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Monthly Progress</div>
        <div className="card-sub" style={{ marginBottom: 16 }}>Your sales count toward the monthly target</div>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--ink-3)' }}>Sales count</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{salesCount} / {TARGET}</span>
        </div>
        <div style={{ height: 12, background: 'var(--surface-3)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct >= 100 ? 'var(--ok)' : 'var(--accent)', borderRadius: 6, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{progressPct.toFixed(0)}% complete</div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-hdr">
          <div className="card-title">Commission Ladder</div>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          {TIERS.map((tier, i) => {
            const isActive = i === currentTierIdx;
            const isPast = salesCount > tier.max;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', marginBottom: 8, borderRadius: 10,
                background: isActive ? 'oklch(0.96 0.05 145)' : isPast ? 'var(--surface-2)' : 'var(--surface)',
                border: `1.5px solid ${isActive ? 'oklch(0.88 0.07 145)' : 'var(--line)'}`,
              }}>
                <div style={{ fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--ok)' : isPast ? 'var(--ink-4)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {tier.range}
                  {isActive && <span style={{ fontSize: 9, background: 'var(--ok)', color: '#fff', padding: '2px 7px', borderRadius: 10, fontWeight: 700, textTransform: 'uppercase' }}>Current</span>}
                  {isPast && <span style={{ fontSize: 10, color: 'var(--ok)' }}>✓</span>}
                </div>
                <div style={{ fontWeight: 700, color: isActive ? 'var(--ok)' : isPast ? 'var(--ok)' : 'var(--ink-3)', fontSize: 14 }}>{tier.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
