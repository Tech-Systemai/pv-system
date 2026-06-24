import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/* GoHighLevel → Portal webhook receiver.
 *
 * GHL Workflow "Webhook" action POSTs the contact's details here. The custom
 * data keys you configure in the workflow arrive at the top level of the body
 * (see the Key column in the GHL webhook action). We map them onto a cx_case
 * and upsert keyed on ghl_contact_id so repeat events update the same case
 * instead of creating duplicates.
 *
 * Expected keys (set these in the GHL webhook "Custom Data"):
 *   ghl_contact_id, first_name, last_name, phone, email, address,
 *   order_number, veneer_set, veneer_shade, full_price, amount_collected
 *
 * Auth: pass the shared secret either as ?secret=... in the URL or as the
 * x-webhook-secret header. Configure GHL_WEBHOOK_SECRET in Vercel.
 */

function pick(body: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = body?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function toNum(v: string): number | null {
  if (v === '') return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const expected = process.env.GHL_WEBHOOK_SECRET;
  const provided =
    req.nextUrl.searchParams.get('secret') ||
    req.headers.get('x-webhook-secret') ||
    '';
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Diagnostic: log the keys GHL actually sends so the field mapping can be
  // verified from Vercel logs. Safe to remove once the integration is confirmed.
  console.log('GHL webhook payload keys:', JSON.stringify(Object.keys(body ?? {})));

  // ── Map GHL fields → case fields ────────────────────────────────────────────
  const ghlId = pick(body, 'ghl_contact_id', 'contact_id', 'id');
  if (!ghlId) {
    console.warn('GHL webhook missing contact id. Full body:', JSON.stringify(body));
    return NextResponse.json({ error: 'Missing ghl_contact_id' }, { status: 400 });
  }

  const first = pick(body, 'first_name', 'firstName');
  const last  = pick(body, 'last_name', 'lastName');
  const customerName = [first, last].filter(Boolean).join(' ').trim()
    || pick(body, 'full_name', 'name', 'contact_name')
    || 'Unknown';

  const fullPrice = toNum(pick(body, 'full_price'));
  const collected = toNum(pick(body, 'amount_collected')) ?? 0;
  // Mirror the client's payment math: derive balance + status when a price is set.
  const paymentLeft = fullPrice != null ? Math.max(0, fullPrice - collected) : null;
  const payStatus = fullPrice != null
    ? (collected >= fullPrice ? 'Paid' : collected > 0 ? 'Partial' : 'Defaulted')
    : null;

  // Fields synced from CRM. These overwrite on every event; agent-owned fields
  // (status, pipeline_stage, assigned_to, etc.) are left untouched on update.
  const synced: Record<string, any> = {
    customer_name: customerName,
    phone:   pick(body, 'phone') || null,
    email:   pick(body, 'email') || null,
    address: pick(body, 'address', 'full_address') || null,
    order_number: pick(body, 'order_number') || null,
    veneer_set:   pick(body, 'veneer_set') || null,
    veneer_shade: pick(body, 'veneer_shade') || null,
    full_price: fullPrice,
    amount_collected: collected,
    payment_left: paymentLeft,
    pay_status: payStatus,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();

  try {
    const { data: existing, error: selErr } = await admin
      .from('cx_cases')
      .select('id')
      .eq('ghl_contact_id', ghlId)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing) {
      const { error } = await admin.from('cx_cases').update(synced).eq('id', existing.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, action: 'updated', case_id: existing.id });
    }

    // New case — add defaults the synced patch doesn't carry.
    const insert = {
      ...synced,
      ghl_contact_id: ghlId,
      status: 'New CX',
      priority: 'HIGH',
      issue: '',
    };
    const { data, error } = await admin.from('cx_cases').insert(insert).select('id').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, action: 'created', case_id: data.id });
  } catch (err: any) {
    console.error('GHL webhook error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
