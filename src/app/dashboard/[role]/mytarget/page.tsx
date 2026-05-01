import { createClient } from '@/utils/supabase/server';

export default async function MyTargetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0,0,0,0);
  
  const { data: sales } = await supabase
    .from('sales_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('type', 'Sale')
    .gte('created_at', startOfMonth.toISOString());

  const salesCount = sales?.length || 0;
  const progressPct = Math.min((salesCount / 50) * 100, 100);

  return (
    <>
      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Monthly progress</div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
            <span style={{ fontWeight: 500 }}>Sales count</span>
            <span style={{ color: '#4f46e5', fontSize: '14px', fontWeight: 700 }}>{salesCount} / 50</span>
          </div>
          <div className="bw" style={{ height: '7px' }}>
            <div className="bf" style={{ width: `${progressPct}%`, background: '#4f46e5' }}></div>
          </div>
        </div>
      </div>
      
      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Commission ladder</div>
        {[
          ['1–10 sales', '$10/sale', 10],
          ['11–20 sales', '$15/sale', 20],
          ['21–30 sales', '$20/sale', 30],
          ['31–40 sales', '$25/sale', 40],
          ['41+ sales', '$40/sale', 50]
        ].map(([r, v, th], i) => (
          <div key={i} className={`tier ${salesCount >= (th as number) - 9 ? 'met' : ''}`} style={{ 
            display: 'flex', justifyContent: 'space-between', padding: '12px', 
            borderBottom: '1px solid #f0f2f5', 
            background: salesCount >= (th as number) - 9 ? '#ecfdf5' : '#fff',
            color: salesCount >= (th as number) - 9 ? '#047857' : '#4a5568',
            fontWeight: salesCount >= (th as number) - 9 ? 600 : 500
          }}>
            <span className="tier-l">{r as string}</span>
            <span className="tier-v">{v as string}</span>
          </div>
        ))}
      </div>
    </>
  );
}
