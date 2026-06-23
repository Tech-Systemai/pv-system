import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const sub = host.split('.')[0].toLowerCase();

  // Customer profile site — a SEPARATE public site on its own subdomain
  // (e.g. myprofile.pioneersveneers.com). This must NOT touch `portal.*`,
  // which is the full internal system. Only the dedicated customer subdomain
  // is rewritten to the public /portal page.
  if (sub === 'myprofile') {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith('/portal') || pathname.startsWith('/api/')) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
