'use client';

import { useMemo, useState } from 'react';

type Rec = {
  id: string;
  url: string;
  file_name?: string;
  by?: string;
  date?: string;
  caseId: number;
  customerName: string;
  cardNumber: string;
};

export default function RecordingUploadsClient({
  cases,
  allProfiles,
}: {
  cases: any[];
  allProfiles: { id: string; name: string }[];
}) {
  const [search, setSearch] = useState('');
  const nameMap = useMemo(
    () => Object.fromEntries(allProfiles.map(p => [p.id, p.name])),
    [allProfiles],
  );

  // Flatten every case's recording_uploads into one list, newest first.
  const recordings: Rec[] = useMemo(() => {
    const all: Rec[] = [];
    for (const c of cases) {
      const ups: any[] = Array.isArray(c.recording_uploads) ? c.recording_uploads : [];
      for (const u of ups) {
        all.push({
          id: u.id,
          url: u.url,
          file_name: u.file_name,
          by: u.by,
          date: u.date,
          caseId: c.id,
          customerName: c.customer_name ?? '—',
          cardNumber: c.order_number ?? String(c.id),
        });
      }
    }
    return all.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recordings;
    return recordings.filter(r =>
      r.customerName.toLowerCase().includes(q) ||
      r.cardNumber.toLowerCase().includes(q) ||
      (r.file_name ?? '').toLowerCase().includes(q),
    );
  }, [recordings, search]);

  return (
    <div className="page-fade">
      {/* Briefing strip */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px', background: 'linear-gradient(135deg, oklch(0.985 0.01 200), oklch(0.975 0.015 260))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="bdg bdg-acc" style={{ fontSize: 10, letterSpacing: '0.06em' }}>🎥 RECORDING UPLOADS</span>
          <span style={{ marginLeft: 'auto' }} />
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 7, background: 'oklch(0.92 0.06 25)', color: 'oklch(0.40 0.20 25)', border: '1px solid oklch(0.82 0.12 25)' }}>
            🔒 ADMINS &amp; OWNERS ONLY
          </span>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.75 }}>
          Every impression-appointment recording our agents upload, kept on record by{' '}
          <strong style={{ color: 'var(--accent)' }}>customer name and card number</strong>{' '}
          so we have proof of all the video meetings.{' '}
          <strong style={{ color: 'var(--accent)' }}>{recordings.length} recording{recordings.length !== 1 ? 's' : ''}</strong> on file.
        </div>
      </div>

      {/* Impression Care recordings */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>Impression Care recordings</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, card #, or file…"
            className="fld-input" style={{ marginLeft: 'auto', height: 34, width: 280, maxWidth: '100%', fontSize: 13 }} />
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            {recordings.length === 0 ? 'No recordings uploaded yet.' : 'No recordings match your search.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 22 }}>🎬</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.customerName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                    Card #{r.cardNumber}
                    {r.file_name && <> · {r.file_name}</>}
                    {' · '}{nameMap[r.by ?? ''] || 'Agent'}{r.date ? ` · ${r.date}` : ''}
                  </div>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-sec btn-sm" style={{ fontSize: 12, flexShrink: 0 }}>
                  ▶ View
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
