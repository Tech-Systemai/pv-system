'use client';

import { useState, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/utils/supabase/client';
import { dbOp } from '@/utils/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type RemakeStatus = 'pending_review' | 'in_production' | 'delivered' | 'rejected';
type ActivityEntry = { user: string; text: string; at: string };

type RemakeRequest = {
  id: number;
  patient_name: string;
  phone: string | null;
  original_case_id: string | null;
  delivered_date: string | null;
  reason_category: string;
  veneer_set: string | null;
  veneer_shade: string | null;
  complaint: string;
  status: RemakeStatus;
  submitted_by: string | null;
  submitted_by_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  remake_type: string | null;
  estimated_delivery: string | null;
  ship_impression_kit: boolean;
  impression_kit_tracking: string | null;
  owner_notes: string | null;
  stage_case_at: string | null;
  stage_kit_at: string | null;
  stage_imp_at: string | null;
  stage_lab_at: string | null;
  stage_qc_at: string | null;
  stage_shipped_at: string | null;
  activity: ActivityEntry[];
  created_at: string;
};

type RemakePhoto = {
  id: string;
  request_id: number;
  photo_type: string;
  photo_label: string | null;
  photo_url: string;
  created_at: string;
};

type ApproveForm = {
  remake_type: string;
  estimated_delivery: string;
  ship_impression_kit: boolean;
  owner_notes: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_CATEGORIES = [
  'Color / shade mismatch',
  'Fit / bite issue',
  'Breakage',
  'Sizing issue',
  'Other',
];

const VENEER_SETS   = ['Full set', 'Top only', 'Bottom only'];
const VENEER_SHADES = ['Natural white', 'Super white'];

const PHOTO_TYPES = ['FRONT', 'CLOSEUP', 'SIDE', 'LEFT', 'BITE', 'GUM'];

// role: who advances this stage
const STAGES = [
  { key: 'stage_case_at' as const,    label: 'Case created',         num: '1', role: 'cx'    as const },
  { key: 'stage_kit_at' as const,     label: 'Impression sent',      num: '2', role: 'cx'    as const },
  { key: 'stage_imp_at' as const,     label: 'Impressions received', num: '3', role: 'cx'    as const },
  { key: 'stage_lab_at' as const,     label: 'In production',        num: '4', role: 'owner' as const },
  { key: 'stage_qc_at' as const,      label: 'Quality check',        num: '5', role: 'owner' as const },
  { key: 'stage_shipped_at' as const, label: 'Shipped to patient',   num: '6', role: 'owner' as const },
];

const STORAGE_BUCKET = 'employee-docs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `${h}h ago`;
  return `${Math.floor(ms / 60_000)}m ago`;
}

function getStage(r: RemakeRequest) {
  if (r.stage_shipped_at) return 6;
  if (r.stage_qc_at)      return 5;
  if (r.stage_lab_at)     return 4;
  if (r.stage_imp_at)     return 3;
  if (r.stage_kit_at)     return 2;
  if (r.stage_case_at)    return 1;
  return 0;
}

const STATUS_META: Record<RemakeStatus, { label: string; cls: string }> = {
  pending_review: { label: 'PENDING REVIEW', cls: 'bdg bdg-warn' },
  in_production:  { label: 'IN PRODUCTION',  cls: 'bdg bdg-ind'  },
  delivered:      { label: 'DELIVERED',      cls: 'bdg bdg-ok'   },
  rejected:       { label: 'REJECTED',       cls: 'bdg bdg-err'  },
};

function StatusBadge({ status }: { status: RemakeStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.pending_review;
  return <span className={m.cls} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>{m.label}</span>;
}

function reasonHue(cat: string) {
  const l = cat.toLowerCase();
  if (l.includes('color') || l.includes('shade')) return 25;
  if (l.includes('fit') || l.includes('bite'))    return 265;
  if (l.includes('break'))                         return 55;
  if (l.includes('siz'))                           return 200;
  return 120;
}

function fmtDate(s: string) {
  return new Date(s).toISOString().slice(0, 16).replace('T', ' ');
}

const DEFAULT_APPROVE: ApproveForm = {
  remake_type: 'Full remake',
  estimated_delivery: '',
  ship_impression_kit: false,
  owner_notes: '',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RemakeRequestsClient({
  initialRequests,
  initialPhotos,
  isOwner,
  currentUserId,
  currentUserName,
}: {
  initialRequests: RemakeRequest[];
  initialPhotos: RemakePhoto[];
  isOwner: boolean;
  currentUserId: string;
  currentUserName: string;
}) {
  const supabase = createClient();

  const [requests, setRequests] = useState(initialRequests);
  const [photos, setPhotos] = useState(initialPhotos);
  const [selected, setSelected] = useState<RemakeRequest | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  // New request form (CX)
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    patient_name: '', phone: '', delivered_date: '',
    reason_category: REASON_CATEGORIES[0],
    veneer_set: VENEER_SETS[0], veneer_shade: VENEER_SHADES[0],
    complaint: '',
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPhotoTypes, setNewPhotoTypes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Approve/decline state (owner)
  const [approveForm, setApproveForm] = useState<ApproveForm>(DEFAULT_APPROVE);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Kit tracking
  const [kitTracking, setKitTracking] = useState('');
  const [kitSaving, setKitSaving] = useState(false);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const display = isOwner ? requests : requests.filter(r => r.submitted_by === currentUserId);
  const stats = {
    all: display.length,
    pending:    display.filter(r => r.status === 'pending_review').length,
    production: display.filter(r => r.status === 'in_production').length,
    delivered:  display.filter(r => r.status === 'delivered').length,
    rejected:   display.filter(r => r.status === 'rejected').length,
  };
  const pendingList = requests.filter(r => r.status === 'pending_review');
  const filtered = display.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.patient_name.toLowerCase().includes(s) ||
      (r.original_case_id ?? '').toLowerCase().includes(s) ||
      (r.phone ?? '').includes(s);
  });
  const getPhotos = (id: number) => photos.filter(p => p.request_id === id);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setNewFiles(prev => [...prev, ...files]);
    setNewPhotoTypes(prev => [...prev, ...files.map((_, i) => PHOTO_TYPES[prev.length + i] ?? 'FRONT')]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (i: number) => {
    setNewFiles(prev => prev.filter((_, j) => j !== i));
    setNewPhotoTypes(prev => prev.filter((_, j) => j !== i));
  };

  const uploadPhotos = async (requestId: number, files: File[], types: string[]) => {
    const added: RemakePhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `remake/${requestId}/${i}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
      if (error) continue;
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const { data } = await dbOp('remake_photos', 'insert', {
        request_id: requestId,
        photo_type: types[i] ?? PHOTO_TYPES[i] ?? 'PHOTO',
        photo_url: publicUrl,
        uploaded_by: currentUserId,
      });
      if (data?.[0]) added.push(data[0] as RemakePhoto);
    }
    return added;
  };

  const submitNew = async () => {
    if (!newForm.patient_name || !newForm.complaint || newFiles.length === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      { user: currentUserName, text: 'Submitted remake request.', at: now },
      { user: currentUserName, text: `Uploaded ${newFiles.length} customer photo${newFiles.length !== 1 ? 's' : ''}.`, at: now },
    ];
    const { data, error } = await dbOp('remake_requests', 'insert', {
      ...newForm,
      delivered_date: newForm.delivered_date || null,
      submitted_by: currentUserId,
      submitted_by_name: currentUserName,
      status: 'pending_review',
      activity,
    });
    if (error || !data?.[0]) { setBusy(false); alert(error ?? 'Failed to submit.'); return; }
    const req = data[0] as RemakeRequest;
    const added = await uploadPhotos(req.id, newFiles, newPhotoTypes);
    setRequests(prev => [req, ...prev]);
    setPhotos(prev => [...prev, ...added]);
    setShowNew(false);
    setNewFiles([]); setNewPhotoTypes([]);
    setNewForm({ patient_name: '', phone: '', delivered_date: '', reason_category: REASON_CATEGORIES[0], veneer_set: VENEER_SETS[0], veneer_shade: VENEER_SHADES[0], complaint: '' });
    setBusy(false);
  };

  const openRequest = (req: RemakeRequest) => {
    setSelected(req);
    setApproveForm(DEFAULT_APPROVE);
    setShowDecline(false);
    setDeclineReason('');
    setKitTracking(req.impression_kit_tracking ?? '');
  };

  const approve = async () => {
    if (!selected || !approveForm.estimated_delivery) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: `Approved — ${approveForm.remake_type}.${approveForm.ship_impression_kit ? ' New impression kit to be shipped.' : ''}`, at: now },
    ];
    const patch = { status: 'in_production' as const, ...approveForm, approved_by: currentUserId, approved_at: now, activity };
    const { error } = await dbOp('remake_requests', 'update', patch, { id: selected.id });
    if (!error) {
      const updated = { ...selected, ...patch };
      setRequests(prev => prev.map(r => r.id === selected.id ? updated : r));
      setSelected(updated);
    }
    setBusy(false);
  };

  const decline = async () => {
    if (!selected || !declineReason.trim()) return;
    setBusy(true);
    const now = new Date().toISOString();
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: `Declined. Reason: ${declineReason}`, at: now },
    ];
    const patch = { status: 'rejected' as const, rejection_reason: declineReason, rejected_at: now, activity };
    const { error } = await dbOp('remake_requests', 'update', patch, { id: selected.id });
    if (!error) {
      const updated = { ...selected, ...patch };
      setRequests(prev => prev.map(r => r.id === selected.id ? updated : r));
      setSelected(updated);
    }
    setShowDecline(false);
    setDeclineReason('');
    setBusy(false);
  };

  const advanceStage = async (stageKey: string) => {
    if (!selected) return;
    setBusy(true);
    const now = new Date().toISOString();
    const label = STAGES.find(s => s.key === stageKey)?.label ?? 'Stage advanced';
    const isLast = stageKey === 'stage_shipped_at';
    const activity: ActivityEntry[] = [
      ...selected.activity,
      { user: currentUserName, text: label, at: now },
    ];
    const patch: Record<string, any> = { [stageKey]: now, activity, ...(isLast ? { status: 'delivered' as const } : {}) };
    const { error } = await dbOp('remake_requests', 'update', patch, { id: selected.id });
    if (!error) {
      const updated = { ...selected, ...patch };
      setRequests(prev => prev.map(r => r.id === selected.id ? updated : r));
      setSelected(updated);
    }
    setBusy(false);
  };

  const deleteRequest = async () => {
    if (!selected) return;
    if (!confirm(`Delete remake request RM-${selected.id} for ${selected.patient_name}? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await dbOp('remake_requests', 'delete', {}, { id: selected.id });
    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== selected.id));
      setPhotos(prev => prev.filter(p => p.request_id !== selected.id));
      setSelected(null);
    }
    setBusy(false);
  };

  const saveKitTracking = async () => {
    if (!selected) return;
    setKitSaving(true);
    const val = kitTracking.trim() || null;
    const { error } = await dbOp('remake_requests', 'update', { impression_kit_tracking: val }, { id: selected.id });
    if (!error) {
      const updated = { ...selected, impression_kit_tracking: val };
      setRequests(prev => prev.map(r => r.id === selected.id ? updated : r));
      setSelected(updated);
    }
    setKitSaving(false);
  };

  // ─── Detail view ───────────────────────────────────────────────────────────

  if (selected) {
    return (
      <div className="page-fade">
        <DetailView
          request={selected}
          photos={getPhotos(selected.id)}
          isOwner={isOwner}
          approveForm={approveForm}
          setApproveForm={setApproveForm}
          showDecline={showDecline}
          setShowDecline={setShowDecline}
          declineReason={declineReason}
          setDeclineReason={setDeclineReason}
          kitTracking={kitTracking}
          setKitTracking={setKitTracking}
          kitSaving={kitSaving}
          onSaveKitTracking={saveKitTracking}
          busy={busy}
          onApprove={approve}
          onDecline={decline}
          onAdvanceStage={advanceStage}
          onDelete={deleteRequest}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  // ─── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="page-fade">

      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg,oklch(0.30 0.14 265),oklch(0.24 0.10 248))', borderRadius: 14, padding: '22px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.55, marginBottom: 8 }}>
          ● {isOwner ? 'REMAKE REVIEW QUEUE' : 'REMAKE REQUESTS'}
        </div>
        {isOwner ? (
          <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            <strong style={{ color: stats.pending > 0 ? 'oklch(0.92 0.14 75)' : 'rgba(255,255,255,0.9)' }}>
              {stats.pending} remake request{stats.pending !== 1 ? 's' : ''}
            </strong>{' '}awaiting your decision.{' '}
            <strong style={{ color: 'oklch(0.88 0.10 220)' }}>{stats.production}</strong> in production,{' '}
            <strong style={{ color: 'oklch(0.88 0.14 145)' }}>{stats.delivered}</strong> delivered.
            {stats.rejected > 0 && <> · <strong style={{ color: 'oklch(0.88 0.14 25)' }}>{stats.rejected} rejected</strong> — customers notified.</>}
          </div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Tracking <strong>{stats.all} remake request{stats.all !== 1 ? 's' : ''}</strong>
            {stats.pending > 0 && <> · <strong style={{ color: 'oklch(0.92 0.14 75)' }}>{stats.pending}</strong> awaiting dentist decision</>}
            {stats.production > 0 && <>, <strong style={{ color: 'oklch(0.88 0.10 220)' }}>{stats.production}</strong> in production</>}
            {stats.delivered > 0 && <>. <strong style={{ color: 'oklch(0.88 0.14 145)' }}>{stats.delivered}</strong> delivered</>}.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {isOwner && pendingList.length > 0 && (
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }}
              onClick={() => openRequest(pendingList[0])}>
              Go to pending ({pendingList.length})
            </button>
          )}
          {!isOwner && (
            <button className="btn btn-sm" style={{ background: 'oklch(0.55 0.18 265)', color: '#fff', border: 'none', fontWeight: 600 }}
              onClick={() => setShowNew(true)}>
              + New remake request
            </button>
          )}
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.18)' }}
            onClick={() => {
              const csv = [['RM ID', 'Patient', 'Phone', 'Case ID', 'Reason', 'Status', 'Submitted'],
                ...display.map(r => [`RM-${r.id}`, r.patient_name, r.phone ?? '', r.original_case_id ?? '', r.reason_category, r.status, new Date(r.created_at).toLocaleDateString()])
              ].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
              const a = document.createElement('a');
              a.href = 'data:text/csv,' + encodeURIComponent(csv);
              a.download = 'remake-requests.csv';
              a.click();
            }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {([
          { label: 'ALL REMAKES',     value: stats.all,        sub: 'in pipeline',                          hue: null },
          { label: 'AWAITING REVIEW', value: stats.pending,    sub: isOwner ? 'need your call' : 'awaiting dentist', hue: 55  },
          { label: 'IN PRODUCTION',   value: stats.production, sub: 'approved · active',                    hue: 265 },
          { label: 'DELIVERED',       value: stats.delivered,  sub: 'remakes shipped',                      hue: 145 },
          { label: 'REJECTED',        value: stats.rejected,   sub: 'declined remakes',                     hue: 25  },
        ] as { label: string; value: number; sub: string; hue: number | null }[]).map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h">
              <div className="stat-ico" style={s.hue ? { background: `oklch(0.93 0.05 ${s.hue})`, color: `oklch(0.40 0.14 ${s.hue})` } : undefined}>◈</div>
            </div>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v" style={s.value > 0 && s.hue ? { color: `oklch(0.40 0.14 ${s.hue})` } : undefined}>{s.value}</div>
            <div className="stat-foot">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Request list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-hdr" style={{ padding: '14px 18px' }}>
          <div>
            <div className="card-title">{isOwner ? 'Remake decisions' : 'Your remake requests'}</div>
            <div className="card-sub">{isOwner ? 'Approve to open a production case · reject with reason to notify customer' : 'Submit new remakes and track production stages'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="text" placeholder="Search patient, case ID…" value={search}
              onChange={e => setSearch(e.target.value)} className="fld-input" style={{ width: 200, fontSize: 12 }} />
            {!isOwner && <button className="btn btn-acc btn-sm" onClick={() => setShowNew(true)}>+ New remake request</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            {search ? 'No matches found.' : isOwner ? 'No remake requests yet.' : 'No requests yet. Submit one when a patient reports an issue.'}
          </div>
        ) : filtered.map(req => {
          const reqPhotos = getPhotos(req.id);
          const stage = getStage(req);
          const rh = reasonHue(req.reason_category);
          return (
            <div key={req.id} onClick={() => openRequest(req)}
              style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>RM-{req.id}</span>
                    {req.original_case_id && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>· {req.original_case_id}</span>}
                    <StatusBadge status={req.status} />
                    <span className="bdg" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', background: `oklch(0.93 0.05 ${rh})`, color: `oklch(0.38 0.15 ${rh})`, border: `1px solid oklch(0.84 0.09 ${rh})` }}>
                      {req.reason_category.split(' ')[0].toUpperCase()}
                    </span>
                    {req.ship_impression_kit && (
                      <span className="bdg" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', background: 'oklch(0.93 0.10 55)', color: 'oklch(0.38 0.18 55)', border: '1px solid oklch(0.82 0.14 55)' }}>
                        📦 KIT REQUIRED
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{req.patient_name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {req.phone && <>{req.phone} · </>}
                    Requested {new Date(req.created_at).toLocaleDateString()} · {timeAgo(req.created_at)}
                  </div>
                  {req.status === 'in_production' && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                        Stage {stage}/6
                        {req.estimated_delivery && ` · ETA ${new Date(req.estimated_delivery).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                      </div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                        {STAGES.map((_, i) => <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i < stage ? 'oklch(0.55 0.18 265)' : 'var(--line)' }} />)}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  {reqPhotos.length > 0 && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{reqPhotos.length} photo{reqPhotos.length !== 1 ? 's' : ''}</span>}
                  {isOwner && req.submitted_by_name && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{req.submitted_by_name}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New request modal */}
      {showNew && (
        <div className="mb">
          <div className="md" style={{ width: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'oklch(0.55 0.18 265)', letterSpacing: '0.1em', marginBottom: 6 }}>NEW REMAKE REQUEST</div>
            <div className="md-t" style={{ marginBottom: 4 }}>Capture the customer's case and photos</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>
              You can submit once you have at least 1 customer photo and a complaint description.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Patient Name</label>
                <input type="text" placeholder="e.g. Anthony Camara" value={newForm.patient_name} onChange={e => setNewForm(f => ({ ...f, patient_name: e.target.value }))} />
              </div>
              <div className="pv-fld" style={{ margin: 0 }}>
                <label>Patient Phone</label>
                <input type="text" placeholder="603-857-0010" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
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
                <label>Reason Category</label>
                <select value={newForm.reason_category} onChange={e => setNewForm(f => ({ ...f, reason_category: e.target.value }))}>
                  {REASON_CATEGORIES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="pv-fld" style={{ marginBottom: 16 }}>
              <label>Describe what the customer is reporting</label>
              <textarea rows={4} value={newForm.complaint}
                placeholder="What did the patient tell you? Be specific about which tooth, what they're noticing, when it started."
                onChange={e => setNewForm(f => ({ ...f, complaint: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            {/* Photo upload */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.06em', marginBottom: 10 }}>
                CUSTOMER PHOTOS · {newFiles.length} ATTACHED
              </div>
              {newFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 10 }}>
                  {newFiles.map((f, i) => (
                    <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ aspectRatio: '4/3', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                      <div style={{ padding: '4px 6px' }}>
                        <select value={newPhotoTypes[i] ?? 'FRONT'}
                          onChange={e => setNewPhotoTypes(prev => prev.map((t, j) => j === i ? e.target.value : t))}
                          style={{ width: '100%', fontSize: 10, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}>
                          {PHOTO_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ padding: '0 6px 5px', fontSize: 9, color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <button onClick={() => removeFile(i)}
                        style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${newFiles.length === 0 ? 'oklch(0.72 0.13 25)' : 'var(--line)'}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: newFiles.length === 0 ? 'oklch(0.985 0.015 25)' : 'transparent' }}>
                <div style={{ fontSize: 26, color: newFiles.length === 0 ? 'oklch(0.60 0.14 25)' : 'var(--ink-4)', marginBottom: 8 }}>↑</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Drop photos here or click to upload</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>JPG · PNG · UP TO 10 MB EACH</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={addFiles} />
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginBottom: 18 }}>
              Submit will queue this remake for dentist review. Customer is not yet notified.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sec" onClick={() => { setShowNew(false); setNewFiles([]); setNewPhotoTypes([]); setNewForm({ patient_name: '', phone: '', delivered_date: '', reason_category: REASON_CATEGORIES[0], veneer_set: VENEER_SETS[0], veneer_shade: VENEER_SHADES[0], complaint: '' }); }}>
                Cancel
              </button>
              <button className="btn btn-acc" disabled={!newForm.patient_name || !newForm.complaint || newFiles.length === 0 || busy} onClick={submitNew}>
                {busy ? '…' : '↑ Submit remake request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({
  request, photos, isOwner,
  approveForm, setApproveForm,
  showDecline, setShowDecline,
  declineReason, setDeclineReason,
  kitTracking, setKitTracking, kitSaving, onSaveKitTracking,
  busy, onApprove, onDecline, onAdvanceStage, onDelete, onBack,
}: {
  request: RemakeRequest;
  photos: RemakePhoto[];
  isOwner: boolean;
  approveForm: ApproveForm;
  setApproveForm: Dispatch<SetStateAction<ApproveForm>>;
  showDecline: boolean;
  setShowDecline: (v: boolean) => void;
  declineReason: string;
  setDeclineReason: (v: string) => void;
  kitTracking: string;
  setKitTracking: (v: string) => void;
  kitSaving: boolean;
  onSaveKitTracking: () => void;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onAdvanceStage: (key: string) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const stage = getStage(request);
  const isPending    = request.status === 'pending_review';
  const isProduction = request.status === 'in_production';
  const isApproved   = isProduction || request.status === 'delivered';
  const rh = reasonHue(request.reason_category);

  const nextStage = STAGES[stage];
  const canAdvance = stage < 6 && nextStage && (
    (nextStage.role === 'cx' && !isOwner) ||
    (nextStage.role === 'owner' && isOwner)
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className="card-hdr" style={{ padding: '12px 18px', gap: 12 }}>
        <button className="btn btn-sec btn-sm" onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>RM-{request.id}</span>
            {request.original_case_id && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>· {request.original_case_id}</span>}
            <StatusBadge status={request.status} />
            <span className="bdg" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', background: `oklch(0.93 0.05 ${rh})`, color: `oklch(0.38 0.15 ${rh})`, border: `1px solid oklch(0.84 0.09 ${rh})` }}>
              {request.reason_category.split(' ')[0].toUpperCase()}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 3 }}>{request.patient_name}</div>
        </div>
        {isOwner && (
          <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.88 0.06 25)', flexShrink: 0 }}
            disabled={busy} onClick={onDelete}>
            🗑 Delete
          </button>
        )}
      </div>

      <div style={{ padding: '6px 24px 32px', maxWidth: 820 }}>
        {/* Meta */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)', marginBottom: 22 }}>
          {request.phone && <span>{request.phone}</span>}
          {request.veneer_set && <span>Set: <strong style={{ color: 'var(--ink)' }}>{request.veneer_set}</strong></span>}
          {request.veneer_shade && <span>Shade: <strong style={{ color: 'var(--ink)' }}>{request.veneer_shade}</strong></span>}
          {request.delivered_date && <span>Delivered {new Date(request.delivered_date).toLocaleDateString()}</span>}
          {request.submitted_by_name && <span>Submitted by <strong style={{ color: 'var(--ink)' }}>{request.submitted_by_name}</strong></span>}
        </div>

        {/* Impression kit banner — prominent */}
        {request.ship_impression_kit && (
          <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '2px solid oklch(0.75 0.18 55)' }}>
            <div style={{ background: 'oklch(0.55 0.20 55)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📦</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: '0.01em' }}>NEW IMPRESSION KIT REQUIRED</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', marginTop: 2 }}>A replacement impression kit must be shipped to this patient before production can begin.</div>
              </div>
            </div>
            <div style={{ background: 'oklch(0.97 0.05 55)', padding: '14px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'oklch(0.45 0.18 55)', marginBottom: 8 }}>KIT TRACKING NUMBER</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  className="fld-input"
                  placeholder="e.g. 1Z999AA10123456784"
                  value={kitTracking}
                  onChange={e => setKitTracking(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSaveKitTracking()}
                  style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 13 }}
                />
                <button
                  className="btn btn-sm"
                  style={{ background: 'oklch(0.50 0.20 55)', color: '#fff', border: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  disabled={kitSaving}
                  onClick={onSaveKitTracking}
                >
                  {kitSaving ? '…' : request.impression_kit_tracking ? '✓ Update' : 'Save tracking'}
                </button>
              </div>
              {request.impression_kit_tracking && (
                <div style={{ fontSize: 11, color: 'oklch(0.40 0.16 55)', marginTop: 6, fontFamily: 'var(--mono)' }}>
                  Saved: {request.impression_kit_tracking}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Production stages */}
        {isProduction && (
          <div style={{ marginBottom: 24, border: '1px solid var(--line)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 14 }}>
              PRODUCTION · STAGE {stage}/6{request.estimated_delivery ? ` · ETA ${new Date(request.estimated_delivery).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
              {STAGES.map((s, i) => {
                const ts = (request as any)[s.key] as string | null;
                const done = !!ts;
                const cur  = i + 1 === stage;
                return (
                  <div key={s.key} style={{ padding: '10px 6px', borderRadius: 8, textAlign: 'center', background: done ? 'oklch(0.95 0.06 265)' : cur ? 'oklch(0.97 0.03 265)' : 'var(--surface-2)', border: `1px solid ${done ? 'oklch(0.82 0.12 265)' : cur ? 'oklch(0.78 0.14 265)' : 'var(--line)'}` }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', margin: '0 auto 6px', background: done ? 'oklch(0.55 0.18 265)' : cur ? 'oklch(0.70 0.16 265)' : 'var(--line)', color: (done || cur) ? '#fff' : 'var(--ink-4)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.num}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: (done || cur) ? 600 : 400, color: done ? 'oklch(0.35 0.16 265)' : cur ? 'var(--ink)' : 'var(--ink-4)', lineHeight: 1.3 }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                      {s.role === 'cx' ? 'CX' : 'Owner'}
                    </div>
                    {ts && <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--mono)', marginTop: 3 }}>{new Date(ts).toLocaleDateString([], { month: '2-digit', day: '2-digit' })} {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                  </div>
                );
              })}
            </div>
            {canAdvance && (
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-acc btn-sm" disabled={busy} onClick={() => onAdvanceStage(nextStage.key)}>
                  {busy ? '…' : `✓ Mark: ${nextStage.label}`}
                </button>
              </div>
            )}
            {!canAdvance && stage < 6 && nextStage && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                Next: <strong>{nextStage.label}</strong> — to be marked by {nextStage.role === 'cx' ? 'Customer Service' : 'Owner'}.
              </div>
            )}
          </div>
        )}

        {/* Approval summary */}
        {isApproved && request.remake_type && (
          <div style={{ marginBottom: 24, padding: 18, background: 'oklch(0.97 0.03 145)', border: '1px solid oklch(0.88 0.07 145)', borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'oklch(0.45 0.12 145)', marginBottom: 14 }}>
              APPROVAL{request.approved_at ? ` · ${fmtDate(request.approved_at)}` : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: request.owner_notes ? 12 : 0 }}>
              {([
                ['TYPE', request.remake_type],
                ['ETA', request.estimated_delivery ? new Date(request.estimated_delivery).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
              ] as [string, string | null][]).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9, color: 'oklch(0.45 0.12 145)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v ?? '—'}</div>
                </div>
              ))}
            </div>
            {request.owner_notes && (
              <div>
                <div style={{ fontSize: 9, color: 'oklch(0.45 0.12 145)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>DENTIST NOTES</div>
                <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.55 }}>{request.owner_notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Rejection summary */}
        {request.status === 'rejected' && request.rejection_reason && (
          <div style={{ marginBottom: 24, padding: 16, background: 'oklch(0.97 0.03 25)', border: '1px solid oklch(0.88 0.06 25)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--err)', letterSpacing: '0.06em', marginBottom: 8 }}>REJECTION REASON</div>
            <div style={{ fontSize: 13.5 }}>{request.rejection_reason}</div>
          </div>
        )}

        {/* Customer complaint */}
        <div style={{ marginBottom: 24, border: '1px solid var(--line)', borderRadius: 10 }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-4)' }}>CUSTOMER COMPLAINT</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>{fmtDate(request.created_at)}</div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ borderLeft: '3px solid oklch(0.68 0.16 265)', paddingLeft: 14, fontSize: 13.5, lineHeight: 1.65 }}>
              {request.complaint}
            </div>
          </div>
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>PHOTOS FROM CUSTOMER</span><span>{photos.length} ATTACHED</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
              {photos.map(p => (
                <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  <a href={p.photo_url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--surface-2)' }}>
                      <span style={{ position: 'absolute', top: 7, left: 7, zIndex: 1, background: 'rgba(0,0,0,0.70)', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 4 }}>
                        {p.photo_type.toUpperCase()}
                      </span>
                      <img src={p.photo_url} alt={p.photo_type}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.style.display = 'none';
                          if (el.parentElement) el.parentElement.style.background = 'repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2) 8px,var(--line) 8px,var(--line) 16px)';
                        }} />
                    </div>
                  </a>
                  {p.photo_label && <div style={{ padding: '5px 8px', fontSize: 10.5, color: 'var(--ink-3)' }}>{p.photo_label}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity log */}
        {request.activity.length > 0 && (
          <div style={{ marginBottom: isPending && isOwner ? 24 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-4)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>ACTIVITY</span><span>{request.activity.length} ENTRIES</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {request.activity.map((entry, i) => {
                const parts = entry.user.split(' ');
                const short = parts[0] + (parts[1] ? ` ${parts[1][0]}.` : '');
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'oklch(0.55 0.18 265)', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{short}</span>
                      {' '}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>{fmtDate(entry.at)}</span>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{entry.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Approve form */}
        {isOwner && isPending && !showDecline && (
          <div style={{ border: '2px solid oklch(0.88 0.07 145)', borderRadius: 12, padding: 20, background: 'oklch(0.985 0.015 145)', marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'oklch(0.45 0.12 145)', marginBottom: 18 }}>● APPROVE REMAKE – CONFIGURE CASE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 5 }}>REMAKE TYPE</div>
                <select className="fld-input" style={{ width: '100%' }} value={approveForm.remake_type} onChange={e => setApproveForm(f => ({ ...f, remake_type: e.target.value }))}>
                  <option>Full remake</option><option>Partial remake</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 5 }}>ESTIMATED DELIVERY</div>
                <input type="date" className="fld-input" style={{ width: '100%' }} value={approveForm.estimated_delivery} onChange={e => setApproveForm(f => ({ ...f, estimated_delivery: e.target.value }))} />
              </div>
            </div>

            {/* Impression kit — prominent toggle */}
            <div style={{ marginBottom: 14, borderRadius: 10, border: `2px solid ${approveForm.ship_impression_kit ? 'oklch(0.70 0.18 55)' : 'var(--line)'}`, background: approveForm.ship_impression_kit ? 'oklch(0.96 0.06 55)' : 'var(--surface)', transition: 'all 0.15s' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}>
                <input type="checkbox" checked={approveForm.ship_impression_kit} onChange={e => setApproveForm(f => ({ ...f, ship_impression_kit: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'oklch(0.55 0.20 55)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: approveForm.ship_impression_kit ? 'oklch(0.38 0.20 55)' : 'var(--ink)' }}>
                    📦 Ship new impression kit to patient
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                    Check this if the patient needs a new kit before we can proceed with the remake.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: 5 }}>NOTES FOR AGENT (OPTIONAL)</div>
              <textarea className="fld-input" rows={3} style={{ width: '100%', resize: 'vertical' }}
                placeholder="e.g. Replace #10 only. Verify occlusal contact ≤ 0.3mm."
                value={approveForm.owner_notes} onChange={e => setApproveForm(f => ({ ...f, owner_notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="btn btn-sm" style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.88 0.06 25)' }} onClick={() => setShowDecline(true)}>
                ✕ Decline request
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sec btn-sm" onClick={onBack}>Cancel</button>
                <button className="btn btn-sm" style={{ background: 'oklch(0.45 0.15 145)', color: '#fff', border: 'none', fontWeight: 600 }}
                  disabled={busy || !approveForm.estimated_delivery} onClick={onApprove}>
                  {busy ? '…' : '✓ Confirm approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decline form */}
        {isOwner && isPending && showDecline && (
          <div style={{ border: '2px solid oklch(0.88 0.06 25)', borderRadius: 12, padding: 20, background: 'oklch(0.985 0.015 25)', marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Decline remake request</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
              Provide a reason so the CX agent can inform the customer.
            </div>
            <textarea className="fld-input" rows={3} style={{ width: '100%', marginBottom: 14, resize: 'vertical' }}
              placeholder="e.g. Photos do not clearly show the issue. Please re-submit with better lighting and a close-up of the affected tooth."
              value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sec btn-sm" onClick={() => setShowDecline(false)}>← Back</button>
              <button className="btn btn-sm" style={{ background: 'oklch(0.50 0.18 25)', color: '#fff', border: 'none' }}
                disabled={busy || !declineReason.trim()} onClick={onDecline}>
                {busy ? '…' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
