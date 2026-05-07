import { createClient } from '@/utils/supabase/server';

export default async function MyDashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: u } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: sales } = await supabase
    .from('sales_logs')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString());

  const salesCount = sales?.filter(s => s.type === 'Sale').length ?? 0;
  const totalRevenue = sales?.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount), 0) ?? 0;
  const commission = salesCount * 15;

  const TARGET = 50;
  const progressPct = Math.min((salesCount / TARGET) * 100, 100);
  const targetMet = salesCount >= TARGET;
  const pts = u?.points ?? 7;

  return (
    <div className="page-fade">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ind">📊</div></div>
          <div className="stat-l">SALES · MONTH</div>
          <div className="stat-v">{salesCount}</div>
          <div className="stat-foot">{targetMet ? 'Target met ✓' : `${TARGET - salesCount} to go`}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico ok">$</div></div>
          <div className="stat-l">REVENUE</div>
          <div className="stat-v" style={{ color: 'var(--ok)' }}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="stat-foot">This month</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h"><div className="stat-ico acc">⊕</div></div>
          <div className="stat-l">COMMISSION</div>
          <div className="stat-v">${commission.toLocaleString()}</div>
          <div className="stat-foot">Estimated earned</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-h">
            <div className="stat-ico" style={{ background: pts >= 6 ? 'oklch(0.96 0.05 145)' : pts >= 4 ? 'oklch(0.96 0.05 75)' : 'oklch(0.97 0.03 25)', color: pts >= 6 ? 'var(--ok)' : pts >= 4 ? 'var(--warn)' : 'var(--err)' }}>●</div>
          </div>
          <div className="stat-l">POINTS</div>
          <div className="stat-v" style={{ color: pts >= 6 ? 'var(--ok)' : pts >= 4 ? 'var(--warn)' : 'var(--err)' }}>
            {pts}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>/7</span>
          </div>
          <div className="stat-foot">{pts >= 6 ? 'Good standing' : pts >= 4 ? 'Warning level' : 'At risk'}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 18px' }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Monthly Target Progress</div>
        <div className="card-sub" style={{ marginBottom: 16 }}>Track your sales performance toward the monthly goal</div>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--ink-3)' }}>Monthly sales</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{salesCount} / {TARGET}</span>
        </div>
        <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: targetMet ? 'var(--ok)' : 'var(--accent)', borderRadius: 6, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{progressPct.toFixed(0)}% complete{targetMet ? ' — Target achieved!' : ''}</div>
      </div>
    </div>
  );
}
