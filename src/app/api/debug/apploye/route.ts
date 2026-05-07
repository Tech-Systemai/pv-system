import { NextResponse } from 'next/server';

export async function GET() {
  const apployeKey = process.env.APPLOYE_API_KEY;
  if (!apployeKey) {
    return NextResponse.json({ error: 'APPLOYE_API_KEY env var not set' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  const startDate = `${today}T00:00:00Z`;
  const endDate   = `${today}T23:59:59Z`;
  const results: Record<string, any> = {
    today,
    keyLength: apployeKey.length,
    keyPreview: apployeKey.slice(0, 6) + '...' + apployeKey.slice(-4),
  };

  // Test A — /members/ (exact URL used by main sync)
  try {
    const r = await fetch('https://public-api.apploye.com/members/', {
      headers: { 'X-APPLOYE-API-KEY': apployeKey },
      cache: 'no-store',
    });
    results.testA_members = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.testA_members = { error: e.message }; }

  // Test B — /timesheets/ with datetime params (exact URL used by main sync)
  try {
    const r = await fetch(
      `https://public-api.apploye.com/timesheets/?start_date=${startDate}&end_date=${endDate}`,
      { headers: { 'X-APPLOYE-API-KEY': apployeKey }, cache: 'no-store' },
    );
    results.testB_timesheets = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.testB_timesheets = { error: e.message }; }

  // Test C — /members/ with Authorization: Bearer (alternative auth style)
  try {
    const r = await fetch('https://public-api.apploye.com/members/', {
      headers: { 'Authorization': `Bearer ${apployeKey}` },
      cache: 'no-store',
    });
    results.testC_members_bearer = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.testC_members_bearer = { error: e.message }; }

  // Test D — /members/ without trailing slash
  try {
    const r = await fetch('https://public-api.apploye.com/members', {
      headers: { 'X-APPLOYE-API-KEY': apployeKey },
      cache: 'no-store',
    });
    results.testD_members_noslash = { status: r.status, body: await r.json().catch(() => r.text()) };
  } catch (e: any) { results.testD_members_noslash = { error: e.message }; }

  return NextResponse.json(results, { status: 200 });
}
