import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const BUCKET = 'interview-recordings';

/** Staff-only: redirects to a short-lived signed URL for a candidate's mock-call recording. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!['owner', 'admin', 'supervisor'].includes(profile?.role ?? '')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return new NextResponse('Missing session_id', { status: 400 });

  const { data: session } = await admin
    .from('interview_sessions')
    .select('recording_path')
    .eq('id', sessionId)
    .single();
  if (!session?.recording_path) {
    return new NextResponse('No recording for this session', { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(session.recording_path, 3600);
  if (error || !signed?.signedUrl) {
    return new NextResponse('Recording file not found — the candidate may not have finished uploading.', { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
