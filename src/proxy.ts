import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const sub = host.split('.')[0].toLowerCase();

  // Customer profile site (portal.pioneersveneers.com) — public, no auth.
  // Serve the /portal app for this subdomain; the portal's own API is left alone.
  if (sub === 'portal' || sub === 'myprofile') {
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
