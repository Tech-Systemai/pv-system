'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

/* ── Photo slot definitions ───────────────────────────────── */
const PHOTO_SLOTS = [
  { key: 'upper_imp',  label: 'Upper Impression', short: 'UPPER IMP',  bg: 'oklch(0.91 0.06 268)', stripeBg: 'oklch(0.83 0.09 268)' },
  { key: 'lower_imp',  label: 'Lower Impression', short: 'LOWER IMP',  bg: 'oklch(0.91 0.07 200)', stripeBg: 'oklch(0.83 0.10 200)' },
  { key: 'front',      label: 'Front View',        short: 'FRONT',      bg: 'oklch(0.93 0.07 78)',  stripeBg: 'oklch(0.85 0.10 78)'  },
  { key: 'left_side',  label: 'Left Side',         short: 'LEFT SIDE',  bg: 'oklch(0.91 0.07 145)', stripeBg: 'oklch(0.83 0.10 145)' },
  { key: 'right_side', label: 'Right Side',        short: 'RIGHT SIDE', bg: 'oklch(0.91 0.06 25)',  stripeBg: 'oklch(0.83 0.10 25)'  },
  { key: 'gum_line',   label: 'Gum Line',          short: 'GUM LINE',   bg: 'oklch(0.94 0.04 305)', stripeBg: 'oklch(0.87 0.06 305)' },
] as const;


const KIT_STAGES = ['IMP KIT SENT', 'IMP KIT DEL', 'POST-CARE'];

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  awaiting_review: { bg: 'oklch(0.95 0.06 75)',  color: 'oklch(0.42 0.18 75)',  label: 'AWAITING REVIEW' },
  approved:        { bg: 'oklch(0.92 0.07 145)', color: 'oklch(0.36 0.16 145)', label: 'APPROVED' },
  declined:        { bg: 'oklch(0.92 0.07 25)',  color: 'oklch(0.40 0.20 25)',  label: 'DECLINED' },
};

const STAGE_META: Record<string, { bg: string; color: string }> = {
  'IMP KIT SENT': { bg: 'oklch(0.93 0.05 200)', color: 'oklch(0.38 0.14 200)' },
  'IMP KIT DEL':  { bg: 'oklch(0.93 0.06 75)',  color: 'oklch(0.40 0.18 75)'  },
  'POST-CARE':    { bg: 'oklch(0.92 0.05 145)', color: 'oklch(0.36 0.15 145)' },
};

/* ── Helpers ──────────────────────────────────────────────── */
function initials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getLatestByType(photos: any[], kitId: number): Record<string, any> {
  const result: Record<string, any> = {};
  for (const p of photos) {
    if (p.kit_id !== kitId) continue;
    if (!result[p.photo_type] || p.version > result[p.photo_type].version) {
      result[p.photo_type] = p;
    }
  }
  return result;
}

function getKitStats(kitId: number, photos: any[]) {
  const latest = getLatestByType(photos, kitId);
  const vals   = Object.values(latest);
  const approved    = vals.filter(p => p.status === 'approved').length;
  const declined    = vals.filter(p => p.status === 'declined').length;
  const awaiting    = vals.filter(p => p.status === 'awaiting_review').length;
  const notUploaded = 6 - vals.length;
  const isComplete  = approved === 6;
  return { approved, declined, awaiting, notUploaded, isComplete };
}

/* ── Main component ───────────────────────────────────────── */
export default function ImpressionKitClient({
  initialKits, initialPhotos, allProfiles,
  userRole, currentUserId,
}: {
  initialKits: any[]; initialPhotos: any[]; allProfiles: any[];
  userRole: string; currentUserId: string; currentUserName: string;
}) {
  const supabase = createClient();
  const [kits,   setKits]   = useState(initialKits);
  const [photos, setPhotos] = useState(initialPhotos);

  const [selectedKit,  setSelectedKit]  = useState<any>(null);
  const [activeTab,    setActiveTab]    = useState<'all' | 'awaiting' | 'declined' | 'not_uploaded' | 'complete'>('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [lightbox,     setLightbox]     = useState<{ photo: any; slot: typeof PHOTO_SLOTS[number]; history: any[] } | null>(null);

  // New kit form
  const [showNewKit,  setShowNewKit]  = useState(false);
  const [newKitForm,  setNewKitForm]  = useState({ patient_name: '', phone: '', kit_stage: 'IMP KIT SENT' });
  const [savingKit,   setSavingKit]   = useState(false);

  // Edit kit modal
  const [showEditKit,  setShowEditKit]  = useState(false);
  const [editKitForm,  setEditKitForm]  = useState({ patient_name: '', phone: '', kit_stage: 'IMP KIT SENT', notes: '' });
  const [savingEdit,   setSavingEdit]   = useState(false);

  // Remake modal
  const [showRemake,   setShowRemake]   = useState(false);
  const [remakeForm,   setRemakeForm]   = useState({ patient_name: '', phone: '', kit_stage: 'IMP KIT SENT', notes: '' });
  const [savingRemake, setSavingRemake] = useState(false);

  // Decline modal
  const [declineTarget,   setDeclineTarget]   = useState<{ photo: any } | null>(null);
  const [declineFeedback, setDeclineFeedback] = useState('');
  const [decliningPhoto,  setDecliningPhoto]  = useState(false);

  // Upload state keyed by `${kitId}_${slotKey}`
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const pendingUpload  = useRef<{ kitId: number; slot: string; version: number } | null>(null);

  const isOwner = ['owner', 'dentist'].includes(userRole);
  const isCX    = !isOwner;

  const nameMap = Object.fromEntries(allProfiles.map((p: any) => [p.id, p.name]));
  const shortName = (id: string | null) => {
    if (!id) return 'Unknown';
    const n = nameMap[id];
    if (!n) return 'Unknown';
    const parts = n.split(' ');
    return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
  };

  /* ── Realtime subscriptions ───────────────────────────────── */
  useEffect(() => {
    const sub = supabase
      .channel('imp-kit-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'impression_kits' }, payload => {
        setKits(prev => [payload.new as any, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'impression_kits' }, payload => {
        setKits(prev => prev.map(k => k.id === (payload.new as any).id ? payload.new as any : k));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'impression_kit_photos' }, payload => {
        setPhotos(prev => [...prev, payload.new as any]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'impression_kit_photos' }, payload => {
        setPhotos(prev => prev.map(p => p.id === (payload.new as any).id ? payload.new as any : p));
        // Keep lightbox in sync
        setLightbox(lb => {
          if (!lb || lb.photo.id !== (payload.new as any).id) return lb;
          const updated = payload.new as any;
          return { ...lb, photo: updated, history: lb.history.map(h => h.id === updated.id ? updated : h) };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  /* ── Global stats for banner ─────────────────────────────── */
  const totalAwaiting    = kits.reduce((s, k) => s + getKitStats(k.id, photos).awaiting, 0);
  const totalDeclined    = kits.reduce((s, k) => s + getKitStats(k.id, photos).declined, 0);
  const totalNotUploaded = kits.reduce((s, k) => s + getKitStats(k.id, photos).notUploaded, 0);
  const totalComplete    = kits.filter(k => getKitStats(k.id, photos).isComplete).length;

  /* ── Tab + search filter ──────────────────────────────────── */
  const filteredKits = kits.filter(k => {
    const q = searchQuery.toLowerCase();
    if (q && !k.patient_name?.toLowerCase().includes(q) && !k.phone?.includes(q)) return false;
    if (activeTab === 'all') return true;
    const st = getKitStats(k.id, photos);
    if (activeTab === 'awaiting')     return st.awaiting > 0;
    if (activeTab === 'declined')     return st.declined > 0;
    if (activeTab === 'not_uploaded') return st.notUploaded > 0;
    if (activeTab === 'complete')     return st.isComplete;
    return true;
  });

  /* ── Actions ─────────────────────────────────────────────── */
  async function createKit() {
    if (!newKitForm.patient_name.trim()) return;
    setSavingKit(true);
    const { data } = await dbOp('impression_kits', 'insert', {
      ...newKitForm,
      created_by: currentUserId,
      assigned_to: currentUserId,
    }, undefined, '*');
    if (data?.[0]) setKits(prev => [data[0], ...prev]);
    setShowNewKit(false);
    setNewKitForm({ patient_name: '', phone: '', kit_stage: 'IMP KIT SENT' });
    setSavingKit(false);
  }

  function triggerUpload(kitId: number, slotKey: string, currentVersion: number) {
    pendingUpload.current = { kitId, slot: slotKey, version: currentVersion };
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingUpload.current) return;
    const { kitId, slot, version } = pendingUpload.current;
    const upKey = `${kitId}_${slot}`;
    setUploading(prev => ({ ...prev, [upKey]: true }));
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `impression-kits/${kitId}/${slot}_v${version + 1}.${ext}`;
      const { error: upErr } = await supabase.storage.from('employee-docs').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('employee-docs').getPublicUrl(path);
      const { data } = await dbOp('impression_kit_photos', 'insert', {
        kit_id:      kitId,
        photo_type:  slot,
        photo_url:   publicUrl,
        version:     version + 1,
        status:      'awaiting_review',
        uploaded_by: currentUserId,
        uploaded_at: new Date().toISOString(),
      }, undefined, '*');
      if (data?.[0]) setPhotos(prev => [...prev, data[0]]);
    } catch (err: any) {
      alert('Upload failed: ' + (err.message ?? 'Unknown error'));
    } finally {
      setUploading(prev => ({ ...prev, [upKey]: false }));
    }
  }

  async function approvePhoto(photo: any) {
    const { data } = await dbOp('impression_kit_photos', 'update', {
      status:      'approved',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      feedback:    null,
    }, { id: photo.id }, '*');
    if (data?.[0]) setPhotos(prev => prev.map(p => p.id === photo.id ? data[0] : p));
  }

  async function submitDecline() {
    if (!declineTarget) return;
    setDecliningPhoto(true);
    const { data } = await dbOp('impression_kit_photos', 'update', {
      status:      'declined',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      feedback:    declineFeedback.trim() || null,
    }, { id: declineTarget.photo.id }, '*');
    if (data?.[0]) setPhotos(prev => prev.map(p => p.id === declineTarget.photo.id ? data[0] : p));
    setDeclineTarget(null);
    setDeclineFeedback('');
    setDecliningPhoto(false);
  }

  function openEditKit() {
    setEditKitForm({
      patient_name: selectedKit.patient_name ?? '',
      phone:        selectedKit.phone ?? '',
      kit_stage:    selectedKit.kit_stage ?? 'IMP KIT SENT',
      notes:        selectedKit.notes ?? '',
    });
    setShowEditKit(true);
  }

  async function saveEditKit() {
    if (!editKitForm.patient_name.trim()) return;
    setSavingEdit(true);
    const payload = {
      patient_name: editKitForm.patient_name.trim(),
      phone:        editKitForm.phone.trim(),
      kit_stage:    editKitForm.kit_stage,
      notes:        editKitForm.notes.trim() || null,
      updated_at:   new Date().toISOString(),
    };
    await dbOp('impression_kits', 'update', payload, { id: selectedKit.id });
    const updated = { ...selectedKit, ...payload };
    setKits(prev => prev.map(k => k.id === selectedKit.id ? updated : k));
    setSelectedKit(updated);
    setSavingEdit(false);
    setShowEditKit(false);
  }

  async function deleteKit() {
    if (!confirm(`Delete ${selectedKit.patient_name}'s impression kit and all photos? This cannot be undone.`)) return;
    await dbOp('impression_kits', 'delete', undefined, { id: selectedKit.id });
    setKits(prev => prev.filter(k => k.id !== selectedKit.id));
    setPhotos(prev => prev.filter(p => p.kit_id !== selectedKit.id));
    setSelectedKit(null);
  }

  async function createRemake() {
    if (!remakeForm.patient_name.trim()) return;
    setSavingRemake(true);
    const { data } = await dbOp('impression_kits', 'insert', {
      patient_name:  remakeForm.patient_name.trim(),
      phone:         remakeForm.phone.trim(),
      kit_stage:     remakeForm.kit_stage,
      notes:         remakeForm.notes.trim() || null,
      created_by:    currentUserId,
      assigned_to:   currentUserId,
      parent_kit_id: selectedKit.id,
    }, undefined, '*');
    if (data?.[0]) {
      setKits(prev => [data[0], ...prev]);
      setSelectedKit(data[0]);
    }
    setShowRemake(false);
    setSavingRemake(false);
  }

  function exportCSV() {
    const rows = [
      ['Patient Name', 'Phone', 'Stage', 'Approved', 'Declined', 'Awaiting Review', 'Not Uploaded', 'Complete'],
      ...kits.map(k => {
        const st = getKitStats(k.id, photos);
        return [k.patient_name, k.phone ?? '', k.kit_stage, st.approved, st.declined, st.awaiting, st.notUploaded, st.isComplete ? 'Yes' : 'No'];
      }),
    ];
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'impression-kits.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Photo history for lightbox ──────────────────────────── */
  function getPhotoHistory(kitId: number, slotKey: string) {
    return photos
      .filter(p => p.kit_id === kitId && p.photo_type === slotKey)
      .sort((a, b) => b.version - a.version);
  }

  /* ─────────────────────────────────────────────────────────── */
  /* ── Detail view: single patient ─────────────────────────── */
  /* ─────────────────────────────────────────────────────────── */
  if (selectedKit) {
    const latest         = getLatestByType(photos, selectedKit.id);
    const { approved }   = getKitStats(selectedKit.id, photos);
    const stageMeta      = STAGE_META[selectedKit.kit_stage] ?? STAGE_META['IMP KIT SENT'];

    return (
      <div className="page-fade">
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedKit(null)} style={{ marginBottom: 16 }}>
          ← Back to all patients
        </button>

        {/* Patient header card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'oklch(0.50 0.18 268)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 18,
            }}>
              {initials(selectedKit.patient_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>{selectedKit.patient_name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedKit.phone}
                {selectedKit.created_by && (
                  <span>· Added by <strong>{nameMap[selectedKit.created_by] ?? 'Unknown'}</strong></span>
                )}
                <span style={{
                  padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  background: stageMeta.bg, color: stageMeta.color,
                }}>
                  {selectedKit.kit_stage}
                </span>
                {selectedKit.parent_kit_id && (
                  <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', background: 'oklch(0.92 0.05 268)', color: 'oklch(0.38 0.14 268)' }}>
                    ↺ REMAKE
                  </span>
                )}
              </div>
              {selectedKit.notes && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  {selectedKit.notes}
                </div>
              )}
            </div>
            <div style={{
              padding: '14px 20px', background: 'var(--surface-2)', borderRadius: 12,
              textAlign: 'center', minWidth: 140,
            }}>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                PROGRESS
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
                {approved}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)' }}>/6 approved</span>
              </div>
              <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(approved / 6) * 100}%`, background: 'var(--ok)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Owner action bar */}
        {isOwner && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button className="btn btn-sec btn-sm" onClick={openEditKit}>✎ Edit info</button>
            <button className="btn btn-sec btn-sm" onClick={() => {
              setRemakeForm({ patient_name: selectedKit.patient_name, phone: selectedKit.phone ?? '', kit_stage: 'IMP KIT SENT', notes: '' });
              setShowRemake(true);
            }}>↺ Log Remake</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" style={{ color: 'oklch(0.40 0.20 25)', background: 'oklch(0.96 0.04 25)', border: '1px solid oklch(0.88 0.08 25)' }} onClick={deleteKit}>
              🗑 Delete patient
            </button>
          </div>
        )}

        {/* 6-slot photo grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {PHOTO_SLOTS.map(slot => {
            const photo     = latest[slot.key];
            const history   = getPhotoHistory(selectedKit.id, slot.key);
            const upKey     = `${selectedKit.id}_${slot.key}`;
            const isLoading = uploading[upKey];
            const status    = photo?.status ?? 'not_uploaded';
            const sm        = STATUS_META[status];

            return (
              <div key={slot.key} style={{
                border: `2px solid ${status === 'declined' ? 'oklch(0.78 0.14 25)' : status === 'approved' ? 'oklch(0.78 0.14 145)' : status === 'awaiting_review' ? 'oklch(0.84 0.10 75)' : 'var(--line)'}`,
                borderRadius: 16, overflow: 'hidden', background: 'var(--surface)',
              }}>
                {/* Thumbnail / placeholder */}
                <div
                  style={{
                    position: 'relative', aspectRatio: '4 / 3',
                    cursor: photo ? 'pointer' : 'default',
                    background: photo
                      ? `url(${photo.photo_url}) center / cover no-repeat`
                      : `repeating-linear-gradient(-45deg, ${slot.bg} 0, ${slot.bg} 10px, ${slot.stripeBg} 10px, ${slot.stripeBg} 20px)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => photo && setLightbox({ photo, slot, history })}
                >
                  {/* Slot label chip */}
                  <div style={{
                    position: 'absolute', top: 8, left: 8, padding: '3px 10px', borderRadius: 6,
                    background: 'rgba(10,10,20,0.72)', color: '#fff',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  }}>
                    {slot.short}
                  </div>

                  {/* Version chip */}
                  {photo && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8, padding: '3px 8px', borderRadius: 6,
                      background: 'rgba(10,10,20,0.60)', color: '#fff', fontSize: 10, fontWeight: 600,
                    }}>
                      v{photo.version}
                    </div>
                  )}

                  {/* DECLINED stamp */}
                  {status === 'declined' && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        background: 'oklch(0.44 0.22 25)', color: '#fff',
                        padding: '6px 20px', borderRadius: 8,
                        fontWeight: 800, fontSize: 13, letterSpacing: '0.10em',
                        transform: 'rotate(-8deg)',
                      }}>
                        DECLINED
                      </div>
                    </div>
                  )}

                  {/* APPROVED checkmark */}
                  {status === 'approved' && (
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8, width: 28, height: 28,
                      borderRadius: '50%', background: 'oklch(0.44 0.18 145)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 16, fontWeight: 700,
                    }}>
                      ✓
                    </div>
                  )}

                  {/* Empty slot text */}
                  {!photo && (
                    <div style={{ position: 'relative', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.10em', color: 'oklch(0.35 0.10 268)', marginBottom: 4 }}>
                        {slot.short}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'oklch(0.45 0.08 268)', opacity: 0.75 }}>
                        {isCX ? 'DROP PHOTO HERE' : 'Not yet uploaded'}
                      </div>
                      {!isCX && (
                        <div style={{ fontSize: 11, marginTop: 6, color: 'var(--ink-4)' }}>● EMPTY SLOT</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{slot.label}</span>
                    {sm ? (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', background: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', background: 'var(--surface-3)', color: 'var(--ink-4)' }}>
                        NOT UPLOADED
                      </span>
                    )}
                  </div>

                  {/* Metadata line */}
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: photo?.feedback ? 10 : 4 }}>
                    {status === 'approved'        && <>Approved {fmtDateTime(photo.reviewed_at)} · {shortName(photo.reviewed_by)}</>}
                    {status === 'declined'        && <>Declined {fmtDateTime(photo.reviewed_at)} · {shortName(photo.reviewed_by)}</>}
                    {status === 'awaiting_review' && <>Uploaded {fmtDateTime(photo.uploaded_at)} · {shortName(photo.uploaded_by)}</>}
                    {status === 'not_uploaded'    && '—'}
                  </div>
                  {history.length > 1 && (
                    <div
                      style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6, cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={e => { e.stopPropagation(); photo && setLightbox({ photo, slot, history }); }}
                    >
                      {history.length} version{history.length !== 1 ? 's' : ''} saved — view history
                    </div>
                  )}

                  {/* Owner feedback box */}
                  {status === 'declined' && photo?.feedback && (
                    <div style={{
                      padding: '10px 12px', marginBottom: 10,
                      background: 'oklch(0.97 0.03 25)', border: '1px solid oklch(0.87 0.08 25)', borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'oklch(0.42 0.18 25)', marginBottom: 4 }}>
                        OWNER FEEDBACK
                      </div>
                      <div style={{ fontSize: 12, color: 'oklch(0.28 0.10 25)', lineHeight: 1.6 }}>{photo.feedback}</div>
                    </div>
                  )}

                  {/* CX: awaiting — "Awaiting owner" placeholder */}
                  {isCX && status === 'awaiting_review' && (
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', textAlign: 'center', paddingTop: 4 }}>Awaiting owner</div>
                  )}

                  {/* Owner actions */}
                  {isOwner && status === 'awaiting_review' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, background: 'oklch(0.44 0.18 145)', color: '#fff', border: 'none' }}
                        onClick={() => approvePhoto(photo)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ flex: 1, background: 'oklch(0.44 0.20 25)', color: '#fff', border: 'none' }}
                        onClick={() => setDeclineTarget({ photo })}
                      >
                        ✕ Decline
                      </button>
                    </div>
                  )}

                  {isOwner && (status === 'approved' || status === 'declined') && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', marginTop: 4 }}
                      onClick={() => setLightbox({ photo, slot, history })}
                    >
                      {status === 'declined' ? 'Review feedback' : 'View photo'}
                    </button>
                  )}

                  {/* CX actions */}
                  {isCX && !photo && (
                    <button
                      className="btn btn-pri btn-sm"
                      style={{ width: '100%', marginTop: 4 }}
                      disabled={isLoading}
                      onClick={() => triggerUpload(selectedKit.id, slot.key, 0)}
                    >
                      {isLoading ? 'Uploading…' : '↑ Upload'}
                    </button>
                  )}
                  {isCX && photo && status === 'declined' && (
                    <button
                      className="btn btn-pri btn-sm"
                      style={{ width: '100%', marginTop: 4 }}
                      disabled={isLoading}
                      onClick={() => triggerUpload(selectedKit.id, slot.key, photo.version)}
                    >
                      {isLoading ? 'Uploading…' : '↺ Re-upload'}
                    </button>
                  )}
                  {isCX && photo && status !== 'declined' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', marginTop: 4 }}
                      onClick={() => setLightbox({ photo, slot, history })}
                    >
                      View photo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />

        {/* ── Decline modal ──────────────────────────────────── */}
        {declineTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 460, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.20)' }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Decline Photo</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 18, lineHeight: 1.6 }}>
                Provide feedback so the agent knows exactly how to retake this photo.
              </div>
              <textarea
                autoFocus
                style={{
                  width: '100%', minHeight: 110, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                }}
                placeholder="Explain what needs to be corrected…"
                value={declineFeedback}
                onChange={e => setDeclineFeedback(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button
                  className="btn btn-sm"
                  style={{ flex: 1, background: 'oklch(0.44 0.20 25)', color: '#fff', border: 'none' }}
                  disabled={decliningPhoto}
                  onClick={submitDecline}
                >
                  {decliningPhoto ? 'Saving…' : 'Decline with feedback'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setDeclineTarget(null); setDeclineFeedback(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit kit modal ────────────────────────────────── */}
        {showEditKit && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.20)' }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Edit Patient Info</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Patient Name *</label>
                  <input autoFocus type="text" value={editKitForm.patient_name} onChange={e => setEditKitForm(p => ({ ...p, patient_name: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Phone</label>
                  <input type="text" value={editKitForm.phone} onChange={e => setEditKitForm(p => ({ ...p, phone: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kit Stage</label>
                  <select value={editKitForm.kit_stage} onChange={e => setEditKitForm(p => ({ ...p, kit_stage: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }}>
                    {KIT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</label>
                  <textarea rows={2} value={editKitForm.notes} onChange={e => setEditKitForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional internal notes…"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn btn-pri btn-sm" style={{ flex: 1 }} disabled={savingEdit || !editKitForm.patient_name.trim()} onClick={saveEditKit}>
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEditKit(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Remake modal ──────────────────────────────────── */}
        {showRemake && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.20)' }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Log Remake Kit</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 20, lineHeight: 1.6 }}>
                A new impression kit entry will be created for this patient. The original kit and all its photos are preserved.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Patient Name *</label>
                  <input autoFocus type="text" value={remakeForm.patient_name} onChange={e => setRemakeForm(p => ({ ...p, patient_name: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Phone</label>
                  <input type="text" value={remakeForm.phone} onChange={e => setRemakeForm(p => ({ ...p, phone: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Kit Stage</label>
                  <select value={remakeForm.kit_stage} onChange={e => setRemakeForm(p => ({ ...p, kit_stage: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }}>
                    {KIT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Reason / Notes</label>
                  <textarea rows={2} value={remakeForm.notes} onChange={e => setRemakeForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Patient wasn't happy with fit, full remake requested…"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn btn-pri btn-sm" style={{ flex: 1 }} disabled={savingRemake || !remakeForm.patient_name.trim()} onClick={createRemake}>
                  {savingRemake ? 'Creating…' : '↺ Create remake kit'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowRemake(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Lightbox / photo modal ────────────────────────── */}
        {lightbox && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}
          >
            <div style={{
              background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 860,
              display: 'grid', gridTemplateColumns: '1fr 300px',
              boxShadow: '0 32px 100px rgba(0,0,0,0.28)', overflow: 'hidden',
            }}>
              {/* Photo side */}
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500 }}>
                    {selectedKit.patient_name} · <strong style={{ color: 'var(--ink)' }}>{lightbox.slot.label}</strong>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>VERSION {lightbox.photo.version}</span>
                </div>
                <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '4 / 3', position: 'relative' }}>
                  {lightbox.photo.photo_url ? (
                    <img src={lightbox.photo.photo_url} alt={lightbox.slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `repeating-linear-gradient(-45deg, ${lightbox.slot.bg} 0, ${lightbox.slot.bg} 10px, ${lightbox.slot.stripeBg} 10px, ${lightbox.slot.stripeBg} 20px)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'oklch(0.35 0.10 268)' }}>{lightbox.slot.short}</span>
                    </div>
                  )}
                  {/* Status chip overlay */}
                  {lightbox.photo.status in STATUS_META && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10, padding: '4px 12px',
                      background: STATUS_META[lightbox.photo.status].bg,
                      color: STATUS_META[lightbox.photo.status].color,
                      borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                    }}>
                      {STATUS_META[lightbox.photo.status].label}
                    </div>
                  )}
                  {/* Slot label overlay */}
                  <div style={{
                    position: 'absolute', top: 10, left: 10, padding: '4px 12px',
                    background: 'rgba(10,10,20,0.70)', color: '#fff',
                    borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  }}>
                    {lightbox.slot.short}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setLightbox(null)}>Close</button>
                  {lightbox.photo.photo_url && (
                    <a href={lightbox.photo.photo_url} download target="_blank" rel="noopener noreferrer">
                      <button className="btn btn-sec btn-sm">↓ Download</button>
                    </a>
                  )}
                </div>
              </div>

              {/* Activity log side */}
              <div style={{ borderLeft: '1px solid var(--line)', padding: 24, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Activity</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                      {lightbox.history.length} {lightbox.history.length === 1 ? 'entry' : 'entries'}
                    </div>
                  </div>
                  <button
                    onClick={() => setLightbox(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-3)', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {lightbox.history.map((h: any) => (
                    <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {h.uploaded_by === currentUserId ? 'You' : shortName(h.uploaded_by)}
                          <span style={{ fontWeight: 400, color: 'var(--ink-4)', fontSize: 11, marginLeft: 8 }}>
                            {fmtDateTime(h.uploaded_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                          Uploaded {lightbox.slot.label.toLowerCase()} (v{h.version})
                        </div>
                        {h.status === 'approved' && (
                          <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 4 }}>
                            ✓ Approved by {shortName(h.reviewed_by)} · {fmtDateTime(h.reviewed_at)}
                          </div>
                        )}
                        {h.status === 'declined' && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ fontSize: 12, color: 'oklch(0.42 0.18 25)' }}>
                              ✕ Declined by {shortName(h.reviewed_by)} · {fmtDateTime(h.reviewed_at)}
                            </div>
                            {h.feedback && (
                              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 4, lineHeight: 1.5 }}>
                                "{h.feedback}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────── */
  /* ── List view: all patients ──────────────────────────────── */
  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="page-fade">

      {/* Status banner */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(140deg, var(--surface) 0%, oklch(0.97 0.02 268) 100%)' }}>
        <div style={{ padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase' }}>
              {isOwner ? 'IMPRESSION KIT REVIEW QUEUE' : 'PHOTO UPLOAD STATUS'}
            </div>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 18, maxWidth: 720 }}>
            {isOwner ? (
              <>
                <strong style={{ color: 'var(--accent)' }}>{totalAwaiting}</strong> photos awaiting your review across{' '}
                <strong>{kits.length}</strong> patients. ·{' '}
                {totalDeclined > 0 && (
                  <><strong style={{ color: 'oklch(0.42 0.18 25)' }}>{totalDeclined} declined</strong>, agents notified to retake. </>
                )}
                <strong style={{ color: 'var(--ok)' }}>{totalComplete}</strong> patient{totalComplete !== 1 ? 's' : ''} fully approved.
              </>
            ) : (
              <>
                Tracking <strong style={{ color: 'var(--accent)' }}>{kits.length} patients</strong> ·{' '}
                <strong>{totalNotUploaded}</strong> photos still to upload.{' '}
                {totalDeclined > 0 && (
                  <>· <strong style={{ color: 'oklch(0.42 0.18 25)' }}>{totalDeclined} declined — need retake.</strong>{' '}</>
                )}
                <strong>{totalAwaiting}</strong> awaiting review.
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isCX && (
              <button className="btn btn-pri btn-sm" onClick={() => setShowNewKit(true)}>+ New patient</button>
            )}
            <button className="btn btn-sec btn-sm" onClick={exportCSV}>Export CSV</button>
          </div>
        </div>
      </div>

      {/* Stat tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { key: 'all',          label: 'ALL PATIENTS',    value: kits.length,      sub: 'in pipeline',    color: 'var(--ink)'              },
          { key: 'awaiting',     label: 'AWAITING REVIEW', value: totalAwaiting,    sub: 'photos pending', color: 'oklch(0.42 0.18 75)'     },
          { key: 'declined',     label: 'DECLINED',        value: totalDeclined,    sub: 'need retake',    color: 'oklch(0.42 0.18 25)'     },
          { key: 'not_uploaded', label: 'NOT UPLOADED',    value: totalNotUploaded, sub: 'missing slots',  color: 'var(--ink)'              },
          { key: 'complete',     label: 'COMPLETE',        value: totalComplete,    sub: 'all 6 approved', color: 'var(--ok)'               },
        ] as const).map(tab => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '16px 18px', borderRadius: 12, cursor: 'pointer', transition: 'border-color .15s',
              background: 'var(--surface)',
              border: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'var(--line)'}`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 8 }}>
              {tab.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: tab.color, lineHeight: 1 }}>{tab.value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>{tab.sub}</div>
          </div>
        ))}
      </div>

      {/* Patient list */}
      <div className="card">
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {isOwner ? 'Review queue' : 'Patient photos'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {isOwner
                ? 'Click a patient to review their photos · approve or decline with feedback'
                : 'Click a patient to upload photos and see dentist feedback'}
            </div>
          </div>
          <input
            type="text"
            placeholder="Search name or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line)',
              background: 'var(--surface-2)', fontSize: 13, width: 220,
            }}
          />
        </div>

        <div>
          {filteredKits.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No patients match the current filter.
            </div>
          )}
          {filteredKits.map(kit => {
            const st       = getKitStats(kit.id, photos);
            const latest   = getLatestByType(photos, kit.id);
            const pct      = Math.round((st.approved / 6) * 100);
            const stageMeta = STAGE_META[kit.kit_stage] ?? STAGE_META['IMP KIT SENT'];

            // 6-segment progress bar: one colour per slot
            const segColors = PHOTO_SLOTS.map(slot => {
              const p = latest[slot.key];
              if (!p) return 'var(--surface-3)';
              if (p.status === 'approved')        return 'oklch(0.70 0.13 145)';
              if (p.status === 'declined')        return 'oklch(0.70 0.14 25)';
              if (p.status === 'awaiting_review') return 'oklch(0.75 0.13 75)';
              return 'var(--surface-3)';
            });

            return (
              <div
                key={kit.id}
                onClick={() => setSelectedKit(kit)}
                style={{ padding: '16px 22px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: 'oklch(0.50 0.18 268)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 15,
                  }}>
                    {initials(kit.patient_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {kit.patient_name}
                      {kit.parent_kit_id && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: 'oklch(0.92 0.05 268)', color: 'oklch(0.38 0.14 268)', letterSpacing: '0.06em' }}>
                          ↺ REMAKE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{kit.phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', background: stageMeta.bg, color: stageMeta.color }}>
                      {kit.kit_stage}
                    </span>
                    {st.awaiting > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'oklch(0.95 0.06 75)', color: 'oklch(0.42 0.18 75)' }}>
                        {st.awaiting} PENDING
                      </span>
                    )}
                    {st.declined > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'oklch(0.93 0.07 25)', color: 'oklch(0.40 0.20 25)' }}>
                        {st.declined} DECLINED
                      </span>
                    )}
                    {st.notUploaded > 0 && (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--ink-3)' }}>
                        {st.notUploaded} TO UPLOAD
                      </span>
                    )}
                    {st.isComplete && (
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'oklch(0.92 0.07 145)', color: 'oklch(0.36 0.16 145)' }}>
                        COMPLETE
                      </span>
                    )}
                  </div>
                </div>

                {/* Segmented progress bar */}
                <div style={{ display: 'flex', gap: 3, height: 6 }}>
                  {segColors.map((color, i) => (
                    <div key={i} style={{ flex: 1, background: color, borderRadius: 3 }} />
                  ))}
                </div>
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {pct}% complete
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── New patient modal ───────────────────────────────── */}
      {showNewKit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.20)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 22 }}>New Patient</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Patient Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="Full name"
                  value={newKitForm.patient_name}
                  onChange={e => setNewKitForm(p => ({ ...p, patient_name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && createKit()}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Phone
                </label>
                <input
                  type="text"
                  placeholder="e.g. 555-123-4567"
                  value={newKitForm.phone}
                  onChange={e => setNewKitForm(p => ({ ...p, phone: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Kit Stage
                </label>
                <select
                  value={newKitForm.kit_stage}
                  onChange={e => setNewKitForm(p => ({ ...p, kit_stage: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 14 }}
                >
                  {KIT_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button
                className="btn btn-pri btn-sm"
                style={{ flex: 1 }}
                disabled={savingKit || !newKitForm.patient_name.trim()}
                onClick={createKit}
              >
                {savingKit ? 'Adding…' : 'Add patient'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowNewKit(false); setNewKitForm({ patient_name: '', phone: '', kit_stage: 'IMP KIT SENT' }); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
