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

  // Diagnostic: log the full payload (keys AND values) so the field mapping can
  // be verified from Vercel logs. This reveals when GHL sends a key with an
  // empty/unresolved value (e.g. a custom-field merge token that didn't resolve).
  // Safe to remove once the integration is confirmed.
  console.log('GHL webhook payload:', JSON.stringify(body ?? {}));

  // ── Map GHL fields → case fields ────────────────────────────────────────────
  // GHL doesn't only send the snake_case keys we configure under "Custom Data".
  // It also auto-includes every contact custom field at the top level keyed by
  // its *display name* ("Veneer Set", "Full Price", …), and may nest the
  // configured custom data under `customData` and the contact under `contact`.
  // Flatten all three sources so pick() finds the value wherever GHL puts it
  // (top-level body wins, then customData, then the nested contact object).
  const src = {
    ...(typeof body?.contact === 'object' ? body.contact : {}),
    ...(typeof body?.customData === 'object' ? body.customData : {}),
    ...(body ?? {}),
  };

  const ghlId = pick(src, 'ghl_contact_id', 'contact_id', 'id');
  if (!ghlId) {
    console.warn('GHL webhook missing contact id. Full body:', JSON.stringify(body));
    return NextResponse.json({ error: 'Missing ghl_contact_id' }, { status: 400 });
  }

  const first = pick(src, 'first_name', 'firstName', 'First Name');
  const last  = pick(src, 'last_name', 'lastName', 'Last Name');
  const customerName = [first, last].filter(Boolean).join(' ').trim()
    || pick(src, 'full_name', 'name', 'contact_name', 'Full Name')
    || 'Unknown';

  const fullPrice = toNum(pick(src, 'full_price', 'Full Price'));
  const collected = toNum(pick(src, 'amount_collected', 'Total Paid')) ?? 0;
  // Mirror the client's payment math: derive balance + status when a price is set.
  const paymentLeft = fullPrice != null ? Math.max(0, fullPrice - collected) : null;
  const payStatus = fullPrice != null
    ? (collected >= fullPrice ? 'Paid' : collected > 0 ? 'Partial' : 'Defaulted')
    : null;

  // Fields synced from CRM. These overwrite on every event; agent-owned fields
  // (status, pipeline_stage, assigned_to, etc.) are left untouched on update.
  // Each pick lists the configured key first, then the GHL display-name fallback.
  const synced: Record<string, any> = {
    customer_name: customerName,
    phone:   pick(src, 'phone', 'Phone') || null,
    email:   pick(src, 'email', 'Email') || null,
    address: pick(src, 'address', 'full_address', 'Address') || null,
    order_number: pick(src, 'order_number', 'Order Number') || null,
    veneer_set:   pick(src, 'veneer_set', 'Veneer Set') || null,
    veneer_shade: pick(src, 'veneer_shade', 'Veneer Shade') || null,
    special_request: pick(src, 'special_request', 'special_note', 'note', 'Special Request Notes') || null,
    full_price: fullPrice,
    amount_collected: collected,
    payment_left: paymentLeft,
    pay_status: payStatus,
    updated_at: new Date().toISOString(),
  };

  // Diagnostic echo: surfaced in the webhook HTTP response so the values the
  // portal actually received show up directly in GHL's Execution Logs message.
  // If these come back empty, GHL's merge fields aren't resolving. Safe to
  // remove once the integration is confirmed.
  const received = {
    veneer_set: synced.veneer_set,
    veneer_shade: synced.veneer_shade,
    full_price: synced.full_price,
    amount_collected: synced.amount_collected,
    special_request: synced.special_request,
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
      // Never overwrite an assigned order_number with an empty value — the
      // portal numbers CRM orders (6000+) and a re-sync must not wipe that.
      const patch: Record<string, any> = { ...synced };
      if (!patch.order_number) delete patch.order_number;
      const { error } = await admin.from('cx_cases').update(patch).eq('id', existing.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, action: 'updated', case_id: existing.id, received });
    }

    // New case — add defaults the synced patch doesn't carry.
    const insert = {
      ...synced,
      ghl_contact_id: ghlId,
      source: 'CRM',
      status: 'New CX',
      priority: 'HIGH',
      issue: '',
    };
    const { data, error } = await admin.from('cx_cases').insert(insert).select('id').single();
    if (error) throw error;
    return NextResponse.json({ ok: true, action: 'created', case_id: data.id, received });
  } catch (err: any) {
    console.error('GHL webhook error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
