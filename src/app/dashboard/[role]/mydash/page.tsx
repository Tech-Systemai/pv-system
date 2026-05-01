import { createClient } from '@/utils/supabase/server';

export default async function MyDashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: u } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  
  // Fetch user's sales this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  
  const { data: sales } = await supabase
    .from('sales_logs')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString());

  const salesCount = sales?.filter(s => s.type === 'Sale').length || 0;
  const totalRevenue = sales?.filter(s => s.type === 'Sale').reduce((sum, s) => sum + Number(s.amount), 0) || 0;
  const commission = salesCount * 15; // Mock ladder calculation
  
  const targetMet = salesCount >= 50;
  const progressPct = Math.min((salesCount / 50) * 100, 100);

  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-h">
            <div className="s-ico ind">📊</div>
          </div>
          <div className="s-l">Sales · Month</div>
          <div className="s-v">{salesCount}</div>
          <div className="s-s">{targetMet ? 'Target met ✓' : `${50 - salesCount} to go`}</div>
        </div>
        <div className="stat">
          <div className="stat-h">
            <div className="s-ico gn">$</div>
          </div>
          <div className="s-l">Revenue</div>
          <div className="s-v gn">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
        </div>
        <div className="stat">
          <div className="stat-h">
            <div className="s-ico am">⊕</div>
          </div>
          <div className="s-l">Commission</div>
          <div className="s-v">${commission.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-h">
            <div className={`s-ico ${u?.points >= 6 ? 'gn' : 'rd'}`}>●</div>
          </div>
          <div className="s-l">Points</div>
          <div className={`s-v ${u?.points >= 6 ? 'gn' : 'rd'}`}>{u?.points}/7</div>
        </div>
      </div>
      
      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Target progress</div>
        <div style={{ marginBottom: '7px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 500 }}>Monthly sales</span>
            <span style={{ color: '#4f46e5', fontWeight: 700 }}>{salesCount} / 50</span>
          </div>
          <div className="bw">
            <div className="bf" style={{ width: `${progressPct}%`, background: '#4f46e5' }}></div>
          </div>
        </div>
      </div>
    </>
  );
}
