import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const admin = () => createAdminClient();

export async function POST(req: NextRequest) {
  try {
    const { userId, userName, module, action, description, metadata } = await req.json();
    if (!action || !description) {
      return NextResponse.json({ error: 'action and description required' }, { status: 400 });
    }
    const { error } = await admin().from('activity_log').insert({
      user_id: userId || null,
      user_name: userName || 'System',
      module: module || 'system',
      action,
      description,
      metadata: metadata || {},
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90);
    const module = searchParams.get('module');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let query = admin()
      .from('activity_log')
      .select('*')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (module && module !== 'all') {
      query = query.eq('module', module);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
