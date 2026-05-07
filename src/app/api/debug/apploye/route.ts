import { NextResponse } from 'next/server';

// Temporary diagnostic endpoint — shows raw Apploye API responses.
// Only accessible to management; remove after confirming the integration works.
export async function GET() {
  const apployeKey = process.env.APPLOYE_API_KEY;
  if (!apployeKey) {
    return NextResponse.json({ error: 'APPLOYE_API_KEY env var not set' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  const results: Record<string, any> = { today, keyLength: apployeKey.length };

  // Test 1 — correct header + start_date/end_date params
  try {
    const r = await fetch(
      `https://public-api.apploye.com/v1/timesheets?start_date=${today}&end_date=${today}`,
      { headers: { 'X-APPLOYE-API-KEY': apployeKey }, cache: 'no-store' }
    );
    results.test1 = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.test1 = { error: e.message }; }

  // Test 2 — same header + legacy date param
  try {
    const r = await fetch(
      `https://public-api.apploye.com/v1/timesheets?date=${today}`,
      { headers: { 'X-APPLOYE-API-KEY': apployeKey }, cache: 'no-store' }
    );
    results.test2 = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.test2 = { error: e.message }; }

  // Test 3 — members endpoint
  try {
    const r = await fetch(
      'https://public-api.apploye.com/v1/members',
      { headers: { 'X-APPLOYE-API-KEY': apployeKey }, cache: 'no-store' }
    );
    results.test3_members = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.test3_members = { error: e.message }; }

  // Test 4 — organisation endpoint (basic connectivity check)
  try {
    const r = await fetch(
      'https://public-api.apploye.com/v1/organization',
      { headers: { 'X-APPLOYE-API-KEY': apployeKey }, cache: 'no-store' }
    );
    results.test4_org = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.test4_org = { error: e.message }; }

  return NextResponse.json(results, { status: 200 });
}
