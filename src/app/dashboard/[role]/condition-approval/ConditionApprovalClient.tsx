'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type CandidateStatus = 'need_photos' | 'awaiting_clearance' | 'retake' | 'cleared' | 'not_a_candidate';
type PhotoSlot = 'front' | 'left_side' | 'right_side';
type SlotPhoto = { url: string; by: string; byId: string; at: string };
type CandidatePhotos = Partial<Record<PhotoSlot, SlotPhoto>>;
type ActivityEntry = { user: string; text: string; at: string };

type Candidate = {
  id: number;
  patient_name: string;
  phone: string | null;
  veneer_set: string;
  veneer_shade: string;
  notes: string | null;
  lead_source: string | null;
  status: CandidateStatus;
  photos: CandidatePhotos;
  submitted_by: string | null;
  submitted_by_name: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  retake_reason: string | null;
  retake_at: string | null;
  activity: ActivityEntry[];
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOTS: { key: PhotoSlot; label: string; stripe: string }[] = [
  { key: 'front',      label: 'Front View', stripe: '55'  },
  { key: 'left_side',  label: 'Left Side',  stripe: '145' },
  { key: 'right_side', label: 'Right Side', stripe: '25'  },
];

const VENEER_SETS   = ['Full set', 'Top only', 'Bottom only'];
const VENEER_SHADES = ['Natural white', 'Super white'];
const LEAD_SOURCES  = ['Inbound', 'Instagram ad', 'Facebook ad', 'TikTok', 'Referral', 'Walk-in', 'Other'];

const RETAKE_CHIPS = [
  'Front view is blurry',
  'Lighting too harsh on left side',
  'Lips not fully retracted',
  'Cannot see gum line',
  'Photo cuts off molars',
];

const DECLINE_CHIPS = [
  'Active perio disease – refer to specialist',
  'Insufficient enamel for veneers',
  'Bite issue requires ortho first',
  'Patient is under 18',
];

const STORAGE_BUCKET = 'employee-docs';

const DEFAULT_FORM = {
  patient_name: '', phone: '',
  veneer_set: VENEER_SETS[0], veneer_shade: VENEER_SHADES[0],
  lead_source: LEAD_SOURCES[0], notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<CandidateStatus, { label: string; bg: string; color: string; border: string }> = {
  need_photos:        { label: 'NEED PHOTOS',      bg: 'oklch(0.95 0.04 200)', color: 'oklch(0.38 0.12 200)', border: 'oklch(0.80 0.10 200)' },
  awaiting_clearance: { label: 'AWAITING DENTIST', bg: 'oklch(0.95 0.06 55)',  color: 'oklch(0.42 0.14 55)',  border: 'oklch(0.80 0.12 55)'  },
  retake:             { label: 'RETAKE REQUESTED', bg: 'oklch(0.95 0.05 25)',  color: 'oklch(0.42 0.14 25)',  border: 'oklch(0.80 0.10 25)'  },
  cleared:            { label: 'CLEARED',          bg: 'oklch(0.95 0.05 145)', color: 'oklch(0.38 0.14 145)', border: 'oklch(0.80 0.10 145)' },
  not_a_candidate:    { label: 'NOT A CANDIDATE',  bg: 'oklch(0.94 0.03 10)',  color: 'oklch(0.42 0.10 10)',  border: 'oklch(0.78 0.07 10)'  },
};

function StatusBadge({ status }: { status: CandidateStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 5, background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `${h}h ago`;
  return `${Math.floor(ms / 60_000)}m ago`;
}

function fmtSlot(s: string) {
  const d = new Date(s);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtFull(s: string) {
  return new Date(s).toISOString().slice(0, 16).replace('T', ' ');
}

function sn(full: string) {
  const p = full.trim().split(' ');
  return p[0] + (p[1] ? ` ${p[1][0]}.` : '');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConditionApprovalClient({
  initialCandidates,
  isOwner,
  currentUserId,
  currentUserName,
}: {
  initialCandidates: Candidate[];
  isOwner: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const supabase = createClient();

  const [candidates, setCandidates] = useState(initialCandidates);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(DEFAULT_FORM);

  const [decisionMode, setDecisionMode] = useState<'retake' | 'decline' | null>(null);
  const [decisionText, setDecisionText] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<PhotoSlot | null>(null);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = {
    all:             candidates.length,
    need_photos:     candidates.filter(c => c.status === 'need_photos').length,
    awaiting:        candidates.filter(c => c.status === 'awaiting_clearance').length,
    retake:          candidates.filter(c => c.status === 'retake').length,
    cleared:         candidates.filter(c => c.status === 'cleared').length,
    not_a_candidate: candidates.filter(c => c.status === 'not_a_candidate').length,
  };

  const filtered = candidates.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.patient_name.toLowerCase().includes(s) || (c.phone ?? '').includes(s);
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openCandidate = (c: Candidate) => {
    setSelected(c);
    setDecisionMode(null);
    setDecisionText('');
  };

  const submitNew = async () => {
    if (!newForm.patient_name) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [{ user: currentUserName, text: 'Added candidate.', at: now }];
    const { data, error } = await dbOp('condition_approvals', 'insert', {
      ...newForm,
      notes: newForm.notes || null,
      photos: {},
      status: 'need_photos',
      submitted_by: currentUserId,
      submitted_by_name: currentUserName,
      activity,
    });
    if (error || !data?.[0]) { setBusy(false); alert(error ?? 'Failed'); return; }
    const candidate = data[0] as Candidate;
    setCandidates(prev => [candidate, ...prev]);
    setShowNew(false);
    setNewForm(DEFAULT_FORM);
    setBusy(false);
    openCandidate(candidate);
  };

  const triggerUpload = (slot: PhotoSlot) => {
    pendingSlot.current = slot;
    fileRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = pendingSlot.current;
    if (!file || !slot || !selected) return;
    if (fileRef.current) fileRef.current.value = '';

    setUploadingSlot(slot);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `condition/${selected.id}/${slot}.${ext}`;
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
    if (upErr) { setUploadingSlot(null); alert(upErr.message); return; }

    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const now = new Date().toISOString();
    const newPhotos: CandidatePhotos = {
      ...selected.photos,
      [slot]: { url: publicUrl, by: sn(currentUserName), byId: currentUserId, at: now },
    };

    const allFilled = SLOTS.every(s => newPhotos[s.key]);
    const shouldAdvance = allFilled && (selected.status === 'need_photos' || selected.status === 'retake');
    const newStatus: CandidateStatus = shouldAdvance ? 'awaiting_clearance' : selected.status;
    const slotLabel = SLOTS.find(s => s.key === slot)?.label ?? slot;

    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: `Uploaded ${slotLabel.toLowerCase()} photo.`, at: now },
      ...(shouldAdvance ? [{ user: currentUserName, text: 'All 3 photos uploaded — sent for dentist review.', at: now }] : []),
    ];

    const { error } = await dbOp('condition_approvals', 'update',
      { photos: newPhotos, status: newStatus, activity }, { id: selected.id });
    if (!error) {
      const updated = { ...selected, photos: newPhotos, status: newStatus, activity };
      setCandidates(prev => prev.map(c => c.id === selected.id ? updated : c));
      setSelected(updated);
    }
    setUploadingSlot(null);
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: 'Approved — patient cleared as veneer candidate.', at: now },
    ];
    const { error } = await dbOp('condition_approvals', 'update',
      { status: 'cleared', cleared_by: currentUserId, cleared_at: now, activity }, { id: selected.id });
    if (!error) {
      const updated = { ...selected, status: 'cleared' as const, cleared_by: currentUserId, cleared_at: now, activity };
      setCandidates(prev => prev.map(c => c.id === selected.id ? updated : c));
      setSelected(updated);
    }
    setBusy(false);
  };

  const requestRetake = async () => {
    if (!selected || !decisionText.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: `Requested retake: ${decisionText}`, at: now },
    ];
    const { error } = await dbOp('condition_approvals', 'update',
      { status: 'retake', retake_reason: decisionText, retake_at: now, activity }, { id: selected.id });
    if (!error) {
      const updated = { ...selected, status: 'retake' as const, retake_reason: decisionText, retake_at: now, activity };
      setCandidates(prev => prev.map(c => c.id === selected.id ? updated : c));
      setSelected(updated);
    }
    setDecisionMode(null); setDecisionText('');
    setBusy(false);
  };

  const decline = async () => {
    if (!selected || !decisionText.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: `Declined: ${decisionText}`, at: now },
    ];
    const { error } = await dbOp('condition_approvals', 'update',
      { status: 'not_a_candidate', decline_reason: decisionText, declined_at: now, activity }, { id: selected.id });
    if (!error) {
      const updated = { ...selected, status: 'not_a_candidate' as const, decline_reason: decisionText, declined_at: now, activity };
      setCandidates(prev => prev.map(c => c.id === selected.id ? updated : c));
      setSelected(updated);
    }
    setDecisionMode(null); setDecisionText('');
    setBusy(false);
  };

  const deleteCandidate = async () => {
    if (!selected) return;
    if (!confirm(`Delete candidate ${selected.patient_name}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await dbOp('condition_approvals', 'delete', {}, { id: selected.id });
    if (!error) {
      setCandidates(prev => prev.filter(c => c.id !== selected.id));
      setSelected(null);
    }
    setBusy(false);
  };

  // ─── Detail view ───────────────────────────────────────────────────────────

  if (selected) {
    const canUpload = !isOwner && (selected.status === 'need_photos' || selected.status === 'retake');
    const isPending = selected.status === 'awaiting_clearance';

    return (
      <div className="page-fade">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div className="card-hdr" style={{ padding: '12px 18px', gap: 12 }}>
            <button className="btn btn-sec btn-sm" onClick={() => setSelected(null)}>← Back</button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                <StatusBadge status={selected.status} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.patient_name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {selected.phone && <span>{selected.phone}</span>}
                {selected.lead_source && <span>· {selected.lead_source}</span>}
                {selected.veneer_set && <span>· {selected.veneer_set}</span>}
                {selected.veneer_shade && <span>· {selected.veneer_shade}</span>}
                {selected.submitted_by_name && <span>· Uploaded by <strong style={{ color: 'var(--ink)' }}>{selected.submitted_by_name}</strong></span>}
              </div>
            </div>
            {isOwner && (
              <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.88 0.06 25)', flexShrink: 0 }}
                disabled={busy} onClick={deleteCandidate}>
                🗑 Delete
              </button>
            )}
          </div>

          <div style={{ padding: '16px 24px 32px', maxWidth: 860 }}>
            {/* Notes */}
            {selected.notes && (
              <div style={{ fontSize: 13, marginBottom: 20, padding: '9px 14px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--line)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginRight: 8 }}>NOTES</span>
                {selected.notes}
              </div>
            )}

            {/* Retake banner */}
            {selected.status === 'retake' && selected.retake_reason && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'oklch(0.96 0.05 55)', border: '1px solid oklch(0.82 0.12 55)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.42 0.14 55)', letterSpacing: '0.06em', marginBottom: 5 }}>RETAKE REQUESTED</div>
                <div style={{ fontSize: 13 }}>{selected.retake_reason}</div>
              </div>
            )}

            {/* Cleared banner */}
            {selected.status === 'cleared' && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'oklch(0.96 0.05 145)', border: '1px solid oklch(0.82 0.10 145)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.38 0.14 145)', letterSpacing: '0.06em', marginBottom: 5 }}>✓ CLEARED AS VENEER CANDIDATE</div>
                <div style={{ fontSize: 13 }}>This patient has been approved by the dentist and can proceed to impressions.{selected.cleared_at && ` · ${fmtFull(selected.cleared_at)}`}</div>
              </div>
            )}

            {/* Not a candidate banner */}
            {selected.status === 'not_a_candidate' && selected.decline_reason && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'oklch(0.96 0.03 10)', border: '1px solid oklch(0.80 0.07 10)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.42 0.10 10)', letterSpacing: '0.06em', marginBottom: 5 }}>✕ NOT A CANDIDATE</div>
                <div style={{ fontSize: 13 }}>{selected.decline_reason}</div>
              </div>
            )}

            {/* Photo slots */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
              {SLOTS.map(slot => {
                const photo = selected.photos[slot.key];
                const isLoading = uploadingSlot === slot.key;
                const sl = `oklch(0.92 0.07 ${slot.stripe})`;
                const sd = `oklch(0.84 0.12 ${slot.stripe})`;
                const lc = `oklch(0.42 0.16 ${slot.stripe})`;
                return (
                  <div key={slot.key} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                    <div
                      style={{ position: 'relative', aspectRatio: '4/3', cursor: canUpload && !isLoading ? 'pointer' : 'default',
                        background: photo ? 'var(--surface-2)' : `repeating-linear-gradient(-45deg, ${sl}, ${sl} 12px, ${sd} 12px, ${sd} 24px)` }}
                      onClick={() => canUpload && !isLoading && triggerUpload(slot.key)}
                    >
                      <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 4 }}>
                        {slot.key.replace('_', ' ').toUpperCase()}
                      </span>
                      {isLoading ? (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                          Uploading…
                        </div>
                      ) : photo ? (
                        <img src={photo.url} alt={slot.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: lc, letterSpacing: '0.06em', marginBottom: 4 }}>{slot.key.replace('_', ' ').toUpperCase()}</div>
                          <div style={{ fontSize: 10, color: lc, opacity: 0.75, letterSpacing: '0.04em' }}>DROP PHOTO HERE</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{slot.label}</div>
                        {photo && <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 1 }}>{fmtSlot(photo.at)} · {photo.by}</div>}
                      </div>
                      {photo && canUpload && (
                        <button className="btn btn-sec btn-sm" style={{ fontSize: 10, padding: '3px 9px' }}
                          disabled={isLoading} onClick={() => triggerUpload(slot.key)}>
                          ↺ Replace
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Owner clearance decision */}
            {isOwner && isPending && !decisionMode && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Clearance decision</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
                  Review the three intake photos and decide whether{' '}
                  <strong>{selected.patient_name.split(' ')[0]}</strong> is a veneer candidate.{' '}
                  <span style={{ color: 'oklch(0.50 0.15 265)' }}>If they are, choose whether you need impressions before production.</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={approve} disabled={busy}
                    style={{ flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'oklch(0.40 0.15 145)', color: '#fff' }}>
                    ✓ Approve candidate
                  </button>
                  <button onClick={() => setDecisionMode('retake')}
                    style={{ flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid var(--line)', cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink)' }}>
                    ↺ Request retake
                  </button>
                  <button onClick={() => setDecisionMode('decline')}
                    style={{ flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 700, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'oklch(0.40 0.18 25)', color: '#fff' }}>
                    ✕ Not a candidate
                  </button>
                </div>
              </div>
            )}

            {/* Retake form */}
            {isOwner && isPending && decisionMode === 'retake' && (
              <div style={{ marginBottom: 24, padding: 20, background: 'oklch(0.97 0.04 55)', border: '1px solid oklch(0.84 0.10 55)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.14 55)', letterSpacing: '0.08em', marginBottom: 6 }}>WHAT NEEDS TO BE RETAKEN?</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Tell the agent which photo(s) need re-shooting and why.</div>
                <textarea className="fld-input" rows={4} style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
                  placeholder="Write the agent / customer a clear, kind explanation…"
                  value={decisionText} onChange={e => setDecisionText(e.target.value)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {RETAKE_CHIPS.map(c => (
                    <button key={c} onClick={() => setDecisionText(prev => prev ? `${prev}\n${c}` : c)}
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink)' }}>
                      + {c}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sec btn-sm" onClick={() => { setDecisionMode(null); setDecisionText(''); }}>Cancel</button>
                  <button disabled={busy || !decisionText.trim()} onClick={requestRetake}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'oklch(0.48 0.16 55)', color: '#fff', opacity: busy || !decisionText.trim() ? 0.5 : 1 }}>
                    {busy ? '…' : 'Send retake request'}
                  </button>
                </div>
              </div>
            )}

            {/* Decline form */}
            {isOwner && isPending && decisionMode === 'decline' && (
              <div style={{ marginBottom: 24, padding: 20, background: 'oklch(0.97 0.03 10)', border: '1px solid oklch(0.82 0.07 10)', borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.42 0.10 10)', letterSpacing: '0.08em', marginBottom: 6 }}>DECLINE THIS CANDIDATE</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Explain to the sales team why veneers aren't appropriate. The customer will see a sanitized version of this note.</div>
                <textarea className="fld-input" rows={4} style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
                  placeholder="Write the agent / customer a clear, kind explanation…"
                  value={decisionText} onChange={e => setDecisionText(e.target.value)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {DECLINE_CHIPS.map(c => (
                    <button key={c} onClick={() => setDecisionText(prev => prev ? `${prev}\n${c}` : c)}
                      style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--ink)' }}>
                      + {c}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sec btn-sm" onClick={() => { setDecisionMode(null); setDecisionText(''); }}>Cancel</button>
                  <button disabled={busy || !decisionText.trim()} onClick={decline}
                    style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: 'oklch(0.42 0.16 25)', color: '#fff', opacity: busy || !decisionText.trim() ? 0.5 : 1 }}>
                    {busy ? '…' : 'Decline candidate'}
                  </button>
                </div>
              </div>
            )}

            {/* Activity */}
            {selected.activity.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 12 }}>
                  ACTIVITY · {selected.activity.length} ENTRIES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.activity.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.55 0.18 265)', marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{sn(entry.user)}</span>
                        {' '}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>{fmtFull(entry.at)}</span>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{entry.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="page-fade">
      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg, oklch(0.28 0.12 265), oklch(0.22 0.08 248))', borderRadius: 14, padding: '22px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.55, marginBottom: 8 }}>
          ● {isOwner ? 'CANDIDATE CLEARANCE QUEUE' : 'CANDIDATE INTAKE STATUS'}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          {isOwner ? (
            <>
              <strong style={{ color: stats.awaiting > 0 ? 'oklch(0.92 0.14 55)' : 'rgba(255,255,255,0.9)' }}>{stats.awaiting} candidate{stats.awaiting !== 1 ? 's' : ''}</strong>{' '}
              awaiting your clearance decision.{' '}
              <strong style={{ color: 'oklch(0.88 0.14 145)' }}>{stats.cleared}</strong> approved this cycle
              {stats.retake > 0 && <> ({stats.retake > 0 ? `${stats.retake} → ` : ''}impressions, 1 → production)</>}.
              {stats.retake > 0 && <> · <strong style={{ color: 'oklch(0.92 0.14 25)' }}>{stats.retake} retake</strong> requested.</>}
            </>
          ) : (
            <>
              Tracking <strong>{stats.all} candidate{stats.all !== 1 ? 's' : ''}</strong>.{' '}
              {stats.need_photos > 0 && <><strong style={{ color: 'oklch(0.92 0.12 200)' }}>{stats.need_photos}</strong> still need photos, </>}
              {stats.awaiting > 0 && <><strong style={{ color: 'oklch(0.92 0.14 55)' }}>{stats.awaiting}</strong> awaiting dentist clearance.</>}
              {stats.retake > 0 && <> · <strong style={{ color: 'oklch(0.92 0.14 25)' }}>{stats.retake} retake</strong> requested.</>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isOwner && (
            <button className="btn btn-sm" style={{ background: 'oklch(0.55 0.18 265)', color: '#fff', border: 'none', fontWeight: 600 }}
              onClick={() => setShowNew(true)}>
              + New candidate
            </button>
          )}
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }}
            onClick={() => {
              const csv = [['Name', 'Phone', 'Veneer Set', 'Veneer Shade', 'Status', 'Lead Source', 'Submitted By', 'Created'],
                ...candidates.map(c => [c.patient_name, c.phone ?? '', c.veneer_set, c.veneer_shade, c.status, c.lead_source ?? '', c.submitted_by_name ?? '', new Date(c.created_at).toLocaleDateString()])
              ].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
              const a = document.createElement('a');
              a.href = 'data:text/csv,' + encodeURIComponent(csv);
              a.download = 'candidates.csv'; a.click();
            }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', marginBottom: 20, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {([
          { label: 'ALL CANDIDATES',     value: stats.all,             sub: 'pre-sale stage',   hue: null },
          { label: 'NEED PHOTOS',        value: stats.need_photos,     sub: 'awaiting upload',  hue: 200  },
          { label: 'AWAITING CLEARANCE', value: stats.awaiting,        sub: 'dentist decision', hue: 55   },
          { label: 'RETAKE',             value: stats.retake,          sub: 'photos rejected',  hue: 25   },
          { label: 'CLEARED',            value: stats.cleared,         sub: 'ready to proceed', hue: 145  },
          { label: 'NOT A CANDIDATE',    value: stats.not_a_candidate, sub: 'declined cases',   hue: 10   },
        ] as { label: string; value: number; sub: string; hue: number | null }[]).map((s, i, arr) => (
          <div key={s.label} style={{ padding: '14px 12px', borderRight: i < arr.length - 1 ? '1px solid var(--line)' : 'none', background: 'var(--surface)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: s.value > 0 && s.hue !== null ? `oklch(0.38 0.14 ${s.hue})` : 'var(--ink)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-hdr" style={{ padding: '14px 18px' }}>
          <div>
            <div className="card-title">{isOwner ? 'Candidate clearance' : 'Your candidates'}</div>
            <div className="card-sub">{isOwner ? 'Review the 3 intake photos and clear the patient before any sale or impression kit goes out' : 'Upload front, left, and right photos so the dentist can clear the candidate'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="fld-input" style={{ width: 200, fontSize: 12 }} />
            {!isOwner && <button className="btn btn-acc btn-sm" onClick={() => setShowNew(true)}>+ New candidate</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            {search ? 'No matches.' : 'No candidates yet.'}
          </div>
        ) : filtered.map(c => {
          const photoCount = SLOTS.filter(s => c.photos[s.key]).length;
          return (
            <div key={c.id} onClick={() => openCandidate(c)}
              style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: 'background 0.12s', display: 'flex', gap: 14, alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'oklch(0.88 0.08 265)', color: 'oklch(0.38 0.18 265)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                {c.patient_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.patient_name}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 6 }}>
                  {c.phone && <>{c.phone} · </>}{c.veneer_set} · {c.veneer_shade}
                  {c.lead_source && <> · {c.lead_source}</>}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
                  {SLOTS.map(s => (
                    <div key={s.key} style={{ height: 4, flex: 1, borderRadius: 2, background: c.photos[s.key] ? `oklch(0.62 0.14 ${s.stripe})` : 'var(--line)' }} />
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{photoCount}/3 photos · {timeAgo(c.created_at)}</div>
              </div>
              {c.lead_source && <div style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>{c.lead_source}</div>}
            </div>
          );
        })}
      </div>

      {/* New candidate modal */}
      {showNew && (
        <div className="mb">
          <div className="md" style={{ width: 500 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.55 0.18 265)', letterSpacing: '0.1em', marginBottom: 6 }}>NEW CANDIDATE</div>
            <div className="md-t" style={{ marginBottom: 16 }}>Add a new veneer candidate for dentist clearance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Patient Name *</label>
                <input type="text" placeholder="e.g. Rebecca Stone" value={newForm.patient_name} onChange={e => setNewForm(f => ({ ...f, patient_name: e.target.value }))} />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Phone Number</label>
                <input type="text" placeholder="512-440-7290" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Veneer Set</label>
                <select value={newForm.veneer_set} onChange={e => setNewForm(f => ({ ...f, veneer_set: e.target.value }))}>
                  {VENEER_SETS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Veneer Shade</label>
                <select value={newForm.veneer_shade} onChange={e => setNewForm(f => ({ ...f, veneer_shade: e.target.value }))}>
                  {VENEER_SHADES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="pv-fld" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label>Lead Source</label>
                <select value={newForm.lead_source} onChange={e => setNewForm(f => ({ ...f, lead_source: e.target.value }))}>
                  {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="pv-fld" style={{ margin: 0, gridColumn: '1 / -1' }}>
                <label>Notes (optional)</label>
                <textarea rows={3} placeholder="Any notes about the patient's condition, interests, or concerns…"
                  value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginBottom: 16 }}>
              After adding, you'll upload the 3 intake photos (Front, Left Side, Right Side) on the candidate page.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sec" onClick={() => { setShowNew(false); setNewForm(DEFAULT_FORM); }}>Cancel</button>
              <button className="btn btn-acc" disabled={!newForm.patient_name || busy} onClick={submitNew}>
                {busy ? '…' : '+ Add candidate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
