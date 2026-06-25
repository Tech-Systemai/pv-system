import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/* Shippo → Portal webhook receiver.
 *
 * When a label is bought (in the Shippo dashboard or via API), Shippo fires a
 * `transaction_created` event (and later `track_updated` events) to this URL.
 * We pull the tracking number + label/tracking URLs out of the payload, find
 * the matching cx_case, and append an entry to its tracking_log automatically —
 * the same shape the manual "Add tracking" button writes.
 *
 * Matching the label back to a case (best → fallback):
 *   1. metadata "cx_case:<id>" — we stamp this on the order at creation time.
 *   2. order_number — matched against cx_cases.order_number.
 * Unmatched events are logged (not errored) so Shippo doesn't retry-storm; the
 * full payload is logged so the mapping can be confirmed on the first real buy.
 *
 * Auth: pass the shared secret as ?secret=... (Shippo can't send custom headers).
 * Configure SHIPPO_WEBHOOK_SECRET in Vercel and append ?secret=... to the URL
 * you register at portal.goshippo.com/api-config/webhooks.
 */

const SHIPPO_BASE = 'https://api.goshippo.com';

function pickStr(...vals: any[]): string {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

async function shippoGet(path: string, token: string) {
  try {
    const res = await fetch(`${SHIPPO_BASE}${path}`, { headers: { Authorization: `ShippoToken ${token}` } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Quick liveness check for setup ("does the URL respond?").
export async function GET() {
  return NextResponse.json({ ok: true, service: 'shippo-webhook' });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const expected = process.env.SHIPPO_WEBHOOK_SECRET;
  const provided = req.nextUrl.searchParams.get('secret') || req.headers.get('x-webhook-secret') || '';
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Log the full event so the field mapping can be verified from Vercel logs.
  // Safe to trim once the integration is confirmed (mirrors the GHL webhook).
  console.log('Shippo webhook payload:', JSON.stringify(body ?? {}));

  // Shippo wraps the object in { event, test, data }. Older/relayed shapes put
  // it at the top level — handle both.
  const event = pickStr(body?.event, body?.event_type);
  const data = (body && typeof body.data === 'object' && body.data) ? body.data : body;

  // We only care about events that carry a tracking number for a bought label.
  const trackingNumber = pickStr(data?.tracking_number);
  if (!trackingNumber) {
    return NextResponse.json({ ok: true, skipped: 'no tracking number', event });
  }
  // For transaction events, only act once the purchase actually succeeded.
  const status = pickStr(data?.status).toUpperCase();
  if (event.startsWith('transaction') && status && status !== 'SUCCESS') {
    return NextResponse.json({ ok: true, skipped: `transaction status ${status}` });
  }

  const token = process.env.SHIPPO_API_TOKEN;

  // ── Carrier label + URLs ────────────────────────────────────────────────────
  const rate = (data?.rate && typeof data.rate === 'object') ? data.rate : null;
  const carrier = pickStr(rate?.provider, data?.carrier, data?.servicelevel?.token);
  const service = pickStr(rate?.servicelevel?.name, data?.servicelevel?.name);
  const label = pickStr(`${carrier} ${service}`.trim(), 'Shipping label');
  const labelUrl = pickStr(data?.label_url) || null;
  const trackingUrl = pickStr(data?.tracking_url_provider, data?.tracking_url) || null;

  // ── Correlate to a case ─────────────────────────────────────────────────────
  // metadata may live on the transaction directly, or we may need to follow the
  // order it was bought from.
  let metadata = pickStr(data?.metadata);
  let orderNumber = pickStr(data?.order_number, data?.order?.order_number);
  const orderRef = pickStr(data?.order?.object_id, typeof data?.order === 'string' ? data?.order : '');
  if ((!metadata || !orderNumber) && orderRef && token) {
    const order = await shippoGet(`/orders/${orderRef}`, token);
    metadata = metadata || pickStr(order?.metadata);
    orderNumber = orderNumber || pickStr(order?.order_number);
  }

  const caseIdMatch = metadata.match(/cx_case:(\S+)/);
  const caseId = caseIdMatch ? caseIdMatch[1] : '';

  const admin = createAdminClient();
  try {
    let row: { id: any; tracking_log: any[] } | null = null;
    if (caseId) {
      const { data: r } = await admin.from('cx_cases').select('id, tracking_log').eq('id', caseId).maybeSingle();
      row = r as any;
    }
    if (!row && orderNumber) {
      const { data: r } = await admin.from('cx_cases').select('id, tracking_log').eq('order_number', orderNumber).maybeSingle();
      row = r as any;
    }

    if (!row) {
      console.warn('Shippo webhook: no case matched.', JSON.stringify({ event, trackingNumber, metadata, orderNumber }));
      return NextResponse.json({ ok: true, matched: false, tracking_number: trackingNumber });
    }

    const log: any[] = Array.isArray(row.tracking_log) ? row.tracking_log : [];
    // Idempotent: Shippo retries and sends track_updated repeatedly.
    if (log.some(e => pickStr(e?.number) === trackingNumber)) {
      return NextResponse.json({ ok: true, matched: true, duplicate: true, case_id: row.id });
    }

    const entry = {
      id: (globalThis.crypto?.randomUUID?.() ?? `shippo-${Date.now()}`),
      by: 'shippo',
      date: new Date().toISOString().slice(0, 10),
      label,
      number: trackingNumber,
      label_url: labelUrl,
      tracking_url: trackingUrl,
      auto: true,
    };
    const { error } = await admin
      .from('cx_cases')
      .update({ tracking_log: [entry, ...log] })
      .eq('id', row.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, matched: true, case_id: row.id, tracking_number: trackingNumber });
  } catch (err: any) {
    console.error('Shippo webhook error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
