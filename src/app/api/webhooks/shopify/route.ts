import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';

/* Shopify → Portal webhook receiver (orders/create).
 *
 * Shopify fires this the moment an order is placed. We map the order onto a new
 * cx_case stamped source='Shopify' so it lands in the "New orders" section with
 * a "From Shopify" badge and the Shopify order number (#1001).
 *
 * Idempotent: keyed on shopify_order_id (Shopify retries delivery, and may send
 * the same order more than once) — a repeat event no-ops instead of duplicating.
 * Per setup decision, Shopify is treated as its OWN inflow: every new Shopify
 * order becomes its own case, deduped only against other Shopify orders (not
 * merged with GHL cases).
 *
 * Auth: Shopify signs each request with HMAC-SHA256 over the raw body using your
 * webhook signing secret. Configure SHOPIFY_WEBHOOK_SECRET in Vercel with the
 * secret shown in Shopify admin → Settings → Notifications → Webhooks.
 */

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Liveness check for setup ("does the URL respond?").
export async function GET() {
  return NextResponse.json({ ok: true, service: 'shopify-webhook' });
}

export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'SHOPIFY_WEBHOOK_SECRET is not configured' }, { status: 500 });

  // ── HMAC verification (must use the RAW body, before JSON parsing) ───────────
  const raw = await req.text();
  const provided = req.headers.get('x-shopify-hmac-sha256') || '';
  const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
  }

  let order: any;
  try {
    order = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Log the full event so the field mapping can be verified from Vercel logs.
  // Safe to trim once confirmed (mirrors the GHL/Shippo webhooks).
  console.log('Shopify webhook order:', JSON.stringify(order ?? {}));

  const shopifyOrderId = order?.id != null ? String(order.id) : '';
  if (!shopifyOrderId) {
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
  }

  // ── Map Shopify order → case fields ─────────────────────────────────────────
  const ship = order?.shipping_address ?? order?.customer?.default_address ?? {};
  const cust = order?.customer ?? {};
  const customerName =
    [cust.first_name, cust.last_name].filter(Boolean).join(' ').trim() ||
    String(ship.name ?? '').trim() ||
    'Unknown';

  // Compose the single-line address the portal stores (the Shippo label dialog
  // re-parses it into structured fields at ship time).
  const address = [
    ship.address1, ship.address2, ship.city,
    [ship.province_code, ship.zip].filter(Boolean).join(' '),
    ship.country_code,
  ].map((s: any) => String(s ?? '').trim()).filter(Boolean).join(', ') || null;

  // Order total + payment status mirror the GHL webhook's money math.
  const fullPrice = toNum(order?.total_price);
  const fin = String(order?.financial_status ?? '').toLowerCase();
  const collected = fin === 'paid' ? (fullPrice ?? 0) : fin === 'partially_paid' ? 0 : 0;
  const paymentLeft = fullPrice != null ? Math.max(0, fullPrice - collected) : null;
  const payStatus = fullPrice != null
    ? (collected >= fullPrice && fullPrice > 0 ? 'Paid' : collected > 0 ? 'Partial' : 'Defaulted')
    : null;

  // Readable summary of what was ordered, for the agent.
  const items: any[] = Array.isArray(order?.line_items) ? order.line_items : [];
  const itemsSummary = items.map(li => `${li.quantity ?? 1}× ${li.title ?? li.name ?? 'item'}`).join(', ');
  const note = String(order?.note ?? '').trim();
  const specialRequest = [itemsSummary, note].filter(Boolean).join(' — ') || null;

  const synced: Record<string, any> = {
    customer_name: customerName,
    phone: String(order?.phone ?? ship.phone ?? cust.phone ?? '').trim() || null,
    email: String(order?.email ?? cust.email ?? '').trim() || null,
    address,
    order_number: String(order?.name ?? order?.order_number ?? '').trim() || null,
    special_request: specialRequest,
    full_price: fullPrice,
    amount_collected: collected,
    payment_left: paymentLeft,
    pay_status: payStatus,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  try {
    // Idempotent: skip if we've already ingested this Shopify order.
    const { data: existing, error: selErr } = await admin
      .from('cx_cases')
      .select('id')
      .eq('shopify_order_id', shopifyOrderId)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      return NextResponse.json({ ok: true, action: 'duplicate', case_id: existing.id });
    }

    const insert = {
      ...synced,
      source: 'Shopify',
      shopify_order_id: shopifyOrderId,
      status: 'New CX',
      priority: 'HIGH',
      issue: '',
    };
    const { data, error } = await admin.from('cx_cases').insert(insert).select('id').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, action: 'created', case_id: data.id });
  } catch (err: any) {
    console.error('Shopify webhook error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
