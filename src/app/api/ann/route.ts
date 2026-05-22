import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

const admin = () => createAdminClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const { data: setting, error: settingErr } = await admin()
      .from('global_settings')
      .select('value')
      .eq('key', 'active_announcement')
      .maybeSingle();

    if (settingErr) return NextResponse.json({ error: settingErr.message }, { status: 500 });
    if (!setting?.value) return NextResponse.json({ active: null });

    const announcement = setting.value as any;

    let acked = false;
    if (userId && announcement.created_at) {
      const { data: ack } = await admin()
        .from('announcement_acknowledgments')
        .select('id')
        .eq('user_id', userId)
        .eq('announcement_ts', announcement.created_at)
        .maybeSingle();
      acked = !!ack;
    }

    return NextResponse.json({ active: announcement, acked });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'save') {
      const { error } = await admin()
        .from('global_settings')
        .upsert({ key: 'active_announcement', value: body.payload });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'clear') {
      const { error } = await admin()
        .from('global_settings')
        .delete()
        .eq('key', 'active_announcement');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'ack') {
      const { error } = await admin()
        .from('announcement_acknowledgments')
        .upsert(
          { user_id: body.userId, announcement_ts: body.ts, action: body.ackAction },
          { onConflict: 'user_id,announcement_ts' }
        );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'acks') {
      const { data, error } = await admin()
        .from('announcement_acknowledgments')
        .select('user_id, action, responded_at, profiles(name)')
        .eq('announcement_ts', body.ts)
        .order('responded_at');
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
