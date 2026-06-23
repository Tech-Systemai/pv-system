'use client';

import { useState } from 'react';

/* Customer-facing order status page served at myprofile.pioneersveneers.com.
   Customers look up their order by phone number — no login. It only ever shows
   the published snapshot returned by /api/portal. */

type Snapshot = {
  case_id: number;
  customer_name: string | null;
  order_number: string | null;
  status: string | null;
  stage_label: string | null;
  stage_pct: number | null;
  next_step_summary: string | null;
  next_steps: { text: string; done: boolean }[];
  tracking: { label: string; number: string }[];
  full_price: number | null;
  amount_collected: number | null;
  balance: number | null;
  published_at: string;
};

const NAVY = '#1e2a4a';
const ACCENT = '#3b5bdb';
const GREEN = '#2f9e44';

function money(n: number | null | undefined) {
  return `$${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

export default function PortalPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Snapshot[] | null>(null);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setOrders(null);
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Something went wrong.'); return; }
      setOrders(json.data as Snapshot[]);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: NAVY }}>
      {/* Header */}
      <div style={{ background: NAVY, color: 'white', padding: '20px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>PV</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.01em' }}>Pioneers Veneers</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>My Order Status</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Lookup form */}
        <form onSubmit={lookup} style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Track your veneers</div>
          <div style={{ fontSize: 14, color: '#667085', marginBottom: 18, lineHeight: 1.5 }}>
            Enter the phone number on your order to see where things stand.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 347-784-1546" autoFocus
              style={{ flex: 1, minWidth: 200, height: 48, borderRadius: 10, border: '1.5px solid #d0d5dd', padding: '0 14px', fontSize: 16, outline: 'none', color: NAVY }}
            />
            <button type="submit" disabled={loading || !phone.trim()}
              style={{ height: 48, padding: '0 22px', borderRadius: 10, border: 'none', background: ACCENT, color: 'white', fontWeight: 700, fontSize: 15, cursor: loading || !phone.trim() ? 'default' : 'pointer', opacity: loading || !phone.trim() ? 0.6 : 1 }}>
              {loading ? 'Looking…' : 'View order'}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#fff0f0', color: '#b42318', fontSize: 14 }}>{error}</div>
          )}
        </form>

        {/* Results */}
        {orders && orders.map(o => (
          <div key={o.case_id} style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Hi {o.customer_name?.split(' ')[0] || 'there'} 👋</div>
              {o.order_number && <div style={{ fontSize: 13, color: '#667085', fontFamily: 'monospace' }}>{o.order_number}</div>}
            </div>

            {/* Current stage */}
            <div style={{ marginTop: 18, padding: 18, borderRadius: 12, background: '#f0f4ff', border: '1px solid #dbe4ff' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: ACCENT, marginBottom: 4 }}>WHERE YOUR ORDER IS</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{o.stage_label || o.status || 'In progress'}</div>
              {o.stage_pct != null && (
                <>
                  <div style={{ height: 8, borderRadius: 999, background: '#dbe4ff', marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${o.stage_pct}%`, background: ACCENT, borderRadius: 999, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#667085', marginTop: 6 }}>{o.stage_pct}% through your journey</div>
                </>
              )}
            </div>

            {/* Next steps */}
            {o.next_step_summary && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>What&apos;s next</div>
                <div style={{ fontSize: 14, color: '#475467', lineHeight: 1.6, marginBottom: 10 }}>{o.next_step_summary}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {o.next_steps?.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: s.done ? '#98a2b3' : NAVY }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? GREEN : 'transparent', border: s.done ? 'none' : '2px solid #d0d5dd', color: 'white', fontSize: 11, fontWeight: 900 }}>{s.done ? '✓' : ''}</span>
                      <span style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking */}
            {o.tracking?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Shipment tracking</div>
                {o.tracking.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#f8f9fb', border: '1px solid #eaecf0', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475467' }}>{t.label}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, marginLeft: 'auto' }}>{t.number}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Payment */}
            {(o.full_price != null || o.balance != null) && (
              <div style={{ marginTop: 20, padding: 18, borderRadius: 12, border: '1px solid #eaecf0' }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Payment</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#667085', fontWeight: 700 }}>TOTAL</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{money(o.full_price)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#667085', fontWeight: 700 }}>PAID</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: GREEN }}>{money(o.amount_collected)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#667085', fontWeight: 700 }}>BALANCE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: (o.balance ?? 0) > 0 ? '#b42318' : '#98a2b3' }}>{money(o.balance)}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18, fontSize: 12, color: '#98a2b3' }}>
              Last updated {new Date(o.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: '#98a2b3' }}>
          Questions? Reply to your latest text from us and an agent will help.
        </div>
      </div>
    </div>
  );
}
