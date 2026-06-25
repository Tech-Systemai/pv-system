import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/* Shippo → ORDER creator (does NOT buy the label).
 *
 * The CX portal POSTs a confirmed recipient address + parcel here. We create a
 * Shippo *Order* (not a bare shipment) so it lands in the dashboard's "Orders"
 * tab with live rates and a "Buy" button — the team buys the label there (so
 * billing stays in Shippo). NOTE: a bare /shipments/ call does NOT show in the
 * Orders tab, which is why orders are used here.
 *
 * Auth: must be a logged-in portal user (same gate as /api/db).
 *
 * Required env (set in Vercel):
 *   SHIPPO_API_TOKEN      live token (starts with "shippo_live_…")
 *   SHIP_FROM_NAME        return/origin contact name (your warehouse / UPS store)
 *   SHIP_FROM_STREET1
 *   SHIP_FROM_CITY
 *   SHIP_FROM_STATE       2-letter state
 *   SHIP_FROM_ZIP
 *   SHIP_FROM_PHONE
 *   SHIP_FROM_EMAIL       required by USPS — labels fail to buy without it
 * Optional env:
 *   SHIP_FROM_STREET2
 *   SHIP_FROM_COUNTRY     defaults to "US"
 *   SHIPPO_PREFERRED_CARRIER  e.g. "USPS" / "UPS" — pick cheapest of that carrier;
 *                             unset = cheapest overall. NOTE: a carrier must be
 *                             activated in your Shippo account to buy its labels
 *                             (UPS/FedEx need one-time activation; USPS works by
 *                             default), so pin USPS until others are enabled.
 */

const SHIPPO_BASE = 'https://api.goshippo.com';

type Address = {
  name?: string; street1?: string; street2?: string;
  city?: string; state?: string; zip?: string; country?: string; phone?: string;
};
type Parcel = {
  length: number; width: number; height: number; // inches
  weight: number;                                 // ounces
};

function fromAddress(): Address | { error: string } {
  const required = {
    name:    process.env.SHIP_FROM_NAME,
    street1: process.env.SHIP_FROM_STREET1,
    city:    process.env.SHIP_FROM_CITY,
    state:   process.env.SHIP_FROM_STATE,
    zip:     process.env.SHIP_FROM_ZIP,
    phone:   process.env.SHIP_FROM_PHONE,
    email:   process.env.SHIP_FROM_EMAIL,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return { error: `Missing origin env: ${missing.map(k => 'SHIP_FROM_' + k.toUpperCase()).join(', ')}` };
  return {
    ...required,
    street2: process.env.SHIP_FROM_STREET2 || undefined,
    country: process.env.SHIP_FROM_COUNTRY || 'US',
  } as Address;
}

async function shippo(path: string, body: unknown, token: string) {
  const res = await fetch(`${SHIPPO_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `ShippoToken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'SHIPPO_API_TOKEN is not configured' }, { status: 500 });

  const from = fromAddress();
  if ('error' in from) return NextResponse.json({ error: from.error }, { status: 500 });

  let body: { to?: Address; parcel?: Parcel; order_number?: string; item_title?: string; case_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const to = body.to ?? {};
  const parcel = body.parcel;
  const missing = (['street1', 'city', 'state', 'zip'] as const).filter(k => !String(to[k] ?? '').trim());
  if (missing.length) return NextResponse.json({ error: `Recipient address missing: ${missing.join(', ')}` }, { status: 400 });
  if (!parcel || !(parcel.length > 0 && parcel.width > 0 && parcel.height > 0 && parcel.weight > 0)) {
    return NextResponse.json({ error: 'Parcel must have positive length, width, height and weight' }, { status: 400 });
  }

  const orderNumber = String(body.order_number || '').trim() || `CX-${Date.now()}`;
  const itemTitle = String(body.item_title || '').trim() || 'Pioneers Veneers order';
  // Stamp the case id into metadata so the webhook can match the purchased
  // label back to this exact case (Shippo echoes metadata into the transaction).
  const caseTag = body.case_id ? `cx_case:${body.case_id}` : '';

  try {
    // Create a Shippo ORDER (not a bare shipment) so it shows in the "Orders"
    // tab with a Buy button. Orders store weight but not L/W/H, so we stash the
    // parcel dimensions in the notes for whoever buys the label.
    const order = await shippo('/orders/', {
      to_address: { ...to, country: to.country || 'US' },
      from_address: from,
      line_items: [{
        title: itemTitle,
        quantity: 1,
        total_price: '0.00',
        currency: 'USD',
        weight: String(parcel.weight),
        weight_unit: 'oz',
        sku: orderNumber,
      }],
      placed_at: new Date().toISOString(),
      order_number: orderNumber,
      order_status: 'PAID',
      currency: 'USD',
      weight: String(parcel.weight),
      weight_unit: 'oz',
      total_price: '0.00',
      subtotal_price: '0.00',
      shipping_cost: '0.00',
      shipping_cost_currency: 'USD',
      total_tax: '0.00',
      metadata: caseTag || undefined,
      notes: `${caseTag ? caseTag + ' · ' : ''}Parcel: ${parcel.length} x ${parcel.width} x ${parcel.height} in, ${parcel.weight} oz`,
    }, token);

    if (!order.ok || !order.json?.object_id) {
      const msg = order.json?.detail || JSON.stringify(order.json);
      return NextResponse.json({ error: `Shippo order failed: ${msg}` }, { status: 502 });
    }

    // No purchase. The order is now in the Shippo "Orders" tab with a Buy button.
    return NextResponse.json({
      order_id: order.json.object_id,
      order_number: order.json.order_number ?? orderNumber,
      buy_url: 'https://apps.goshippo.com/orders',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
