import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/utils/supabase/server';

/* Merge several Shippo label PDFs into ONE document.
 *
 * Why this exists: the CX "Print all" button used to call window.open() once per
 * label. Browsers' popup blockers allow only the FIRST window per click and
 * silently drop the rest, so only one label ever opened. Instead, the client
 * POSTs the list of label_urls here; we fetch each PDF server-side (no browser
 * CORS limits), staple them into a single PDF, and hand back one file the client
 * opens in a single tab — every label prints together.
 *
 * Auth: must be a logged-in portal user (same gate as /api/shippo/create-label).
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === 'string' && u.trim() !== '')
    : [];
  if (urls.length === 0) {
    return NextResponse.json({ error: 'No label URLs provided' }, { status: 400 });
  }

  const merged = await PDFDocument.create();
  const failed: string[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { failed.push(url); continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const src = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    } catch {
      failed.push(url);
    }
  }

  if (merged.getPageCount() === 0) {
    return NextResponse.json(
      { error: 'Could not load any of the labels. They may have expired or be unreachable.' },
      { status: 502 },
    );
  }

  const out = await merged.save();
  return new NextResponse(Buffer.from(out), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="labels.pdf"',
      // Surface partial failures without breaking the response.
      'X-Labels-Merged': String(merged.getPageCount()),
      'X-Labels-Failed': String(failed.length),
    },
  });
}
