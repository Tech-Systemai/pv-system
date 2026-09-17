import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Prayer times for the Smart Time section, from the public Aladhan API.
// Proxied rather than called from the browser so the response can be cached and
// the timings normalised into plain "HH:MM" before they reach the planner.
//
//   /api/prayer-times?city=Cairo&country=Egypt&method=3&school=0&date=2026-09-16
//   /api/prayer-times?lat=30.04&lng=31.24&method=3

const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'] as const;

/** Aladhan returns values like "05:12 (EET)" — the planner wants "05:12". */
function cleanTime(raw: unknown): string {
  return typeof raw === 'string' ? (raw.trim().match(/^\d{1,2}:\d{2}/)?.[0] ?? '') : '';
}

/** Aladhan wants DD-MM-YYYY; the portal passes YYYY-MM-DD. */
function toAladhanDate(iso: string | null): string {
  const today = new Date();
  const source = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [y, m, d] = source.split('-');
  return `${d}-${m}-${y}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const city = (q.get('city') ?? '').trim();
  const country = (q.get('country') ?? '').trim();
  const lat = q.get('lat');
  const lng = q.get('lng');
  const method = Number(q.get('method') ?? 3);
  const school = Number(q.get('school') ?? 0);
  const date = toAladhanDate(q.get('date'));

  const params = new URLSearchParams({
    method: String(Number.isFinite(method) ? method : 3),
    school: String(Number.isFinite(school) ? school : 0),
  });

  let url: string;
  if (lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    params.set('latitude', String(Number(lat)));
    params.set('longitude', String(Number(lng)));
    url = `https://api.aladhan.com/v1/timings/${date}?${params}`;
  } else if (city) {
    params.set('city', city);
    params.set('country', country || city);
    url = `https://api.aladhan.com/v1/timingsByCity/${date}?${params}`;
  } else {
    return NextResponse.json(
      { error: 'Set your city or coordinates in Smart Time settings first.' },
      { status: 400 },
    );
  }

  try {
    // Times for a given place and day never change, so a long cache is safe.
    const res = await fetch(url, { next: { revalidate: 21_600 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Prayer time service returned ${res.status}. Check the city spelling or use coordinates.` },
        { status: 502 },
      );
    }

    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) {
      return NextResponse.json({ error: 'Prayer time service sent no timings.' }, { status: 502 });
    }

    const cleaned: Record<string, string> = {};
    for (const key of PRAYER_KEYS) {
      const value = cleanTime(timings[key]);
      if (value) cleaned[key] = value;
    }

    const hijri = json?.data?.date?.hijri;
    const hijriDate = hijri
      ? `${hijri.day} ${hijri.month?.en ?? ''} ${hijri.year} AH`.replace(/\s+/g, ' ').trim()
      : '';

    return NextResponse.json({
      timings: cleaned,
      hijriDate,
      timezone: json?.data?.meta?.timezone ?? '',
      place: city ? [city, country].filter(Boolean).join(', ') : `${lat}, ${lng}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { error: `Could not reach the prayer time service: ${reason}` },
      { status: 502 },
    );
  }
}
