import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/* Shippo → shipment creator (does NOT buy the label).
 *
 * The CX portal POSTs a confirmed recipient address + parcel here. We call
 * Shippo to create + rate the shipment, which makes it show up in the Shippo
 * dashboard with live rates and a "Buy" button. The team buys the label there
 * (so billing stays in Shippo). We return the cheapest rate as a price preview.
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

  let body: { to?: Address; parcel?: Parcel };
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

  try {
    // ── 1. Rate the shipment ─────────────────────────────────────────────────
    const shipment = await shippo('/shipments/', {
      address_from: from,
      address_to: { ...to, country: to.country || 'US' },
      parcels: [{
        length: String(parcel.length), width: String(parcel.width), height: String(parcel.height),
        distance_unit: 'in', weight: String(parcel.weight), mass_unit: 'oz',
      }],
      async: false,
    }, token);

    if (!shipment.ok) {
      const msg = shipment.json?.detail || JSON.stringify(shipment.json);
      return NextResponse.json({ error: `Shippo rating failed: ${msg}` }, { status: 502 });
    }

    let rates: any[] = shipment.json?.rates ?? [];
    if (!rates.length) {
      const msgs = (shipment.json?.messages ?? []).map((m: any) => m.text).filter(Boolean).join('; ');
      return NextResponse.json({ error: `No rates returned${msgs ? ': ' + msgs : ' — check the address.'}` }, { status: 422 });
    }

    const preferred = process.env.SHIPPO_PREFERRED_CARRIER?.toUpperCase();
    if (preferred) {
      const filtered = rates.filter(r => String(r.provider).toUpperCase() === preferred);
      if (filtered.length) rates = filtered;
    }
    rates.sort((a, b) => Number(a.amount) - Number(b.amount));
    const rate = rates[0];

    // No purchase. The shipment is now in the Shippo dashboard with rates and a
    // "Buy" button — the team buys the label there. Return the cheapest rate as
    // a price preview so the agent knows roughly what it will cost.
    return NextResponse.json({
      shipment_id: shipment.json.object_id,
      carrier: rate.provider,
      servicelevel: rate.servicelevel?.name ?? '',
      amount: rate.amount,
      currency: rate.currency,
      buy_url: 'https://apps.goshippo.com/orders',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
