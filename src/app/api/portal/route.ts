import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/* Public, unauthenticated lookup for the customer profile site
   (myprofile.pioneersveneers.com). A customer enters their phone number and
   gets back ONLY the published snapshot for their order(s). All access goes
   through the service-role client, so the customer_portal table is never
   exposed directly to the browser. */
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const key = String(body.phone ?? '').replace(/\D/g, '');
  if (key.length < 7) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_portal')
    .select('*')
    .eq('phone', key)
    .order('published_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No order found for that phone number.' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
