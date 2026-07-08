'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbOp } from '@/utils/db';

/* ── Types ─────────────────────────────────────────────────────── */
type ToolId   = 'select' | 'pan' | 'sticky' | 'note' | 'text' | 'pen' | 'file' | 'goal' | 'checklist';
type TextSize = 'sm' | 'md' | 'lg' | 'xl';

interface WBase      { id: string; x: number; y: number; w: number; h: number; }
interface StickyW    extends WBase { type: 'sticky';    text: string; bg: string; }
interface NoteW      extends WBase { type: 'note';      title: string; body: string; }
interface TextW      extends WBase { type: 'text';      content: string; size: TextSize; }
interface GoalW      extends WBase { type: 'goal';      title: string; description: string; targetDate?: string; }
interface ChecklistW extends WBase { type: 'checklist'; title: string; items: { text: string; done: boolean }[]; }
interface FileW      extends WBase { type: 'file'; name: string; ext: string; dataUrl?: string; embedType?: 'image' | 'html' | 'file'; }
type Widget = StickyW | NoteW | TextW | GoalW | ChecklistW | FileW;

interface Stroke { id: string; pts: [number, number][]; color: string; w: number; }
type BoardStatus = 'in_progress' | 'extended' | 'closed';
interface Board  {
  id: string; title: string; desc: string; areaId: string;
  shared: boolean; created: string;
  startDate?: string; dueDate?: string;
  status?: BoardStatus; statusChangedAt?: string;
  timeRunningSince?: string; timeAccruedSeconds?: number;
  widgets: Widget[]; strokes: Stroke[];
}

// Elapsed seconds → HH:MM:SS clock for the board time tracker.
const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// Board lifecycle status shown (and changeable) on the outer card.
const STATUS_META: Record<BoardStatus, { label: string; emoji: string; bg: string; fg: string; bd: string }> = {
  in_progress: { label: 'In Progress', emoji: '🟢', bg: 'var(--accent-soft)', fg: 'var(--accent-ink)',      bd: 'var(--accent-line)' },
  extended:    { label: 'Extended',    emoji: '⏳', bg: 'var(--warn-soft)',   fg: 'oklch(0.45 0.12 75)',   bd: 'oklch(0.85 0.08 75)' },
  closed:      { label: 'Closed',      emoji: '✅', bg: 'var(--ok-soft)',     fg: 'oklch(0.42 0.12 155)',  bd: 'oklch(0.85 0.08 155)' },
};
const STATUS_ORDER: BoardStatus[] = ['in_progress', 'extended', 'closed'];
interface XF { x: number; y: number; s: number; }

/* ── Constants ──────────────────────────────────────────────────── */
const AREAS = [
  { id: 'marketing',  label: 'Marketing',    hue: 268, g: '📣' },
  { id: 'business',   label: 'Business Dev', hue: 25,  g: '🤝' },
  { id: 'financial',  label: 'Financial',    hue: 145, g: '📊' },
  { id: 'website',    label: 'Website',      hue: 200, g: '🌐' },
  { id: 'cx',         label: 'CX',           hue: 75,  g: '⭐' },
  { id: 'sales',      label: 'Sales',        hue: 155, g: '💰' },
  { id: 'operations', label: 'Operations',   hue: 220, g: '⚙️' },
  { id: 'hr',         label: 'HR',           hue: 340, g: '👥' },
];

const TOOLS: { id: ToolId; icon: string; label: string }[] = [
  { id: 'select',    icon: '↖',  label: 'Select  V' },
  { id: 'pan',       icon: '✋', label: 'Pan  H' },
  { id: 'sticky',    icon: '🟡', label: 'Sticky Note  S' },
  { id: 'note',      icon: '📄', label: 'Note Card  N' },
  { id: 'text',      icon: 'T',  label: 'Text  T' },
  { id: 'goal',      icon: '🎯', label: 'Goal  G' },
  { id: 'checklist', icon: '☑',  label: 'Checklist  C' },
  { id: 'pen',       icon: '✏',  label: 'Pen  P' },
  { id: 'file',      icon: '🖼', label: 'Image / File  F' },
];

const STICKY_PAL = [
  { bg: '#fef08a', text: '#78350f' }, { bg: '#fecdd3', text: '#881337' },
  { bg: '#bfdbfe', text: '#1e3a5f' }, { bg: '#bbf7d0', text: '#14532d' },
  { bg: '#e9d5ff', text: '#4c1d95' }, { bg: '#fed7aa', text: '#7c2d12' },
  { bg: '#ffffff', text: '#1a1f2e' },
];

const PEN_COLORS = ['#1a1f2e','#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
const PEN_WIDTHS = [1, 2, 4, 7];

const TEXT_SIZES: Record<TextSize, { px: number; label: string }> = {
  sm: { px: 12, label: 'S' }, md: { px: 16, label: 'M' },
  lg: { px: 24, label: 'L' }, xl: { px: 36, label: 'XL' },
};

const FILE_ICONS: Record<string, string> = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', zip: '📦', txt: '📝', csv: '📊', mp4: '🎬',
};
const IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg']);
const HTML_EXTS  = new Set(['html','htm']);

/* ── Helpers ────────────────────────────────────────────────────── */
function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
function makePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
function makeBoard(title: string, areaId: string, desc = '', startDate = '', dueDate = ''): Board {
  return { id: uid(), title, desc, areaId, shared: false, created: new Date().toISOString(), startDate: startDate || undefined, dueDate: dueDate || undefined, status: 'in_progress', widgets: [], strokes: [] };
}

/* ── CX Plan board data ─────────────────────────────────────────── */
const CX_PLAN_ID = 'f0e1d2c3-b4a5-4678-9abc-def012345678';
const CX_PLAN_WIDGETS: Widget[] = [
  // Pioneers Cycle title
  { id: 'cx-t-01', type: 'text', x: 200, y: 20, w: 400, h: 65, content: 'Pioneers Cycle', size: 'xl' },
  // Patient journey note cards
  { id: 'cx-n-01', type: 'note', x: 60, y: 120, w: 270, h: 185,
    title: 'Patient Makes order',
    body: '* CX agent needs to give the patient a welcoming text/call to tell them the cycle no more no less.' },
  { id: 'cx-n-02', type: 'note', x: 360, y: 120, w: 270, h: 185,
    title: 'Ship IMP KIT → Patient',
    body: '* Agent needs to inform the patient with their tracking number.\n* Book an Appointment with them for the next stage.' },
  { id: 'cx-n-03', type: 'note', x: 660, y: 120, w: 270, h: 225,
    title: 'Patient receive the IMP KIT',
    body: '* Agent Needs to remind them about their appointment 24 hours before the appointment through text/call.\n* Agent is required to do the IMP Kit with the patient and to get Dentist approval.\n* Agent requires to follow up with the patient until updating of the Tracking number' },
  { id: 'cx-n-04', type: 'note', x: 960, y: 120, w: 270, h: 210,
    title: 'Patient Ship → Dental Lab',
    body: '* Agent requires to track the shipping and update CX that the dental lab received your kit by looking at the tracking number provided in the previous step.\n**** Make the patient feels excited' },
  { id: 'cx-n-05', type: 'note', x: 1260, y: 120, w: 270, h: 175,
    title: 'Patient Smile(veneers) in production',
    body: '* Agent requires to update the patient at this stage and make them excited about the veneers' },
  { id: 'cx-n-06', type: 'note', x: 1560, y: 120, w: 270, h: 185,
    title: 'Ship Veneers → Patient',
    body: '* Agent is required to follow up with the patient and ask for referrals and reviews at this stage.\n*** Do not leave without a referral or review ****' },
  // Goal
  { id: 'cx-g-01', type: 'goal', x: 1880, y: 100, w: 290, h: 220,
    title: 'CX managing targets',
    description: 'the goal of showing pioneers cycle is to provide organized exceptional cx care to all of our patients and',
    targetDate: '2027-12-17' },
  // CRITICAL section
  { id: 'cx-t-02', type: 'text', x: 60, y: 380, w: 240, h: 52, content: 'CRITICAL:', size: 'lg' },
  { id: 'cx-s-01', type: 'sticky', x: 60, y: 450, w: 210, h: 215, bg: '#fecdd3',
    text: 'TASK #1: The Full Calendar\n\nCall any Patient who just received their kit and do not hang up until a Zoom appointment is locked into the calendar.' },
  { id: 'cx-s-02', type: 'sticky', x: 290, y: 450, w: 210, h: 215, bg: '#fecdd3',
    text: 'Task #2: The No-Show Recovery\n\nImmediately call any Patient who missed their Zoom appointment to reschedule them for the same day.' },
  { id: 'cx-s-03', type: 'sticky', x: 520, y: 450, w: 210, h: 215, bg: '#fecdd3',
    text: 'Task #3: The Photo Audit\n\nGet Dentist approval while conducting the zoom with the patient to see if we will remake the impression or proceed' },
  { id: 'cx-s-04', type: 'sticky', x: 60, y: 685, w: 210, h: 225, bg: '#fecdd3',
    text: 'Task #4: The Production Update\n\nSend a "Your veneers are currently being hand-crafted with our specialized dentist" update every 3 days while the lab is working.' },
  { id: 'cx-s-05', type: 'sticky', x: 290, y: 685, w: 210, h: 225, bg: '#fecdd3',
    text: 'Task #4: The Shipping Verification\n\nManually verify that every kit "Return Label" has been scanned by the carrier within 48 hours of the Zoom call, and update every 3 days while the lab is working.' },
  { id: 'cx-s-06', type: 'sticky', x: 520, y: 685, w: 210, h: 215, bg: '#fecdd3',
    text: 'Task #5: The CRM Cleanup\n\nEnsure every customer has a "Next Step" date assigned so no one sits in a stage for more than 5 days.' },
  // ROUTINE section
  { id: 'cx-t-03', type: 'text', x: 60, y: 940, w: 240, h: 52, content: 'ROUTINE:', size: 'lg' },
  { id: 'cx-s-07', type: 'sticky', x: 60, y: 1010, w: 210, h: 215, bg: '#fef08a',
    text: 'Task #1: The Welcome Process\n\nSend the personalized "Welcome" SMS/Email to every new order within 1 hour of purchase.' },
  { id: 'cx-s-08', type: 'sticky', x: 290, y: 1010, w: 210, h: 215, bg: '#fef08a',
    text: 'Task #2: The Tracking Update\n\n* Ship the IMP KIT to Patient via emailing the ups store.\n* Input tracking numbers for every outbound kit and veneer box into the CRM.' },
  { id: 'cx-s-09', type: 'sticky', x: 520, y: 1010, w: 210, h: 215, bg: '#fef08a',
    text: 'Task #3: The KIT Confirmation\n\nNotify the Patient via SMS/calls, the second the lab confirms their physical kit has arrived at the facility.' },
  { id: 'cx-s-10', type: 'sticky', x: 60, y: 1245, w: 210, h: 230, bg: '#bbf7d0',
    text: 'Task #5: The Refund Saver\n\nHandle "I want a refund" emails/texts/calls, by offering a "Senior Technician Zoom" to solve their kit/IMP session issues instead of losing the Patient.' },
  { id: 'cx-s-11', type: 'sticky', x: 290, y: 1245, w: 210, h: 230, bg: '#bbf7d0',
    text: 'Task #6: The Review Extractor\n\nSecure a Google review from a customer the moment they confirm their veneers fit perfectly or after a successful call with them' },
  { id: 'cx-s-12', type: 'sticky', x: 520, y: 1245, w: 210, h: 215, bg: '#bbf7d0',
    text: 'Task #6\n\n* Update the Lab Inbounds Kit every day + Inform the lab daily via email.' },
  { id: 'cx-s-13', type: 'sticky', x: 60, y: 1495, w: 210, h: 215, bg: '#bfdbfe',
    text: 'Task #7: The Referral Pitch\n\nOffer the "Friends & Family" $100 off to every customer during the final follow-up call, and a free remake for the patient themself.' },
  { id: 'cx-s-14', type: 'sticky', x: 290, y: 1495, w: 210, h: 215, bg: '#bfdbfe',
    text: 'Task #8: The Daily Recap\n\nSubmitting the "3-Line Report" (Bookings, Zooms, Rescues) to you before logging off.' },
  { id: 'cx-s-15', type: 'sticky', x: 520, y: 1495, w: 210, h: 225, bg: '#bfdbfe',
    text: 'Task #8: The Inbox Zero\n\n* Ensure all "Where is my order?" emails are answered by the end of the shift.\n* Ensure Texts/calendars are ready for next day work' },
  { id: 'cx-s-16', type: 'sticky', x: 60, y: 1740, w: 210, h: 240, bg: '#e9d5ff',
    text: 'Task #7: The Read & Sign Audit\n\n* Log into the portal every Monday to review the "Hall of Fame/Shame" impression photos.\n* Make sure all your training is completed before the past due' },
  { id: 'cx-s-17', type: 'sticky', x: 290, y: 1740, w: 220, h: 275, bg: '#fed7aa',
    text: 'Task #9: ON FRIDAYS\n\n* Audit every customer in the CRM who hasn\'t had a "Next Action" or note in the last 4 days\n* Call every customer who had a Lab Rejection this week and align them with the solution. (New imp kit and a senior Lab Technician will help you to remake it)\n* Identify and tag the Top 10 "Must FOLLOW-UP" customers for Monday morning.' },
];

/* ── Shared delete button ───────────────────────────────────────── */
function DelBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      onPointerDown={e => { e.stopPropagation(); onDelete(); }}
      style={{ position: 'absolute', top: -9, right: -9, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid white', color: 'white', fontSize: 11, cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontWeight: 700 }}
    >×</button>
  );
}

/* ── Sticky Note ────────────────────────────────────────────────── */
function StickyNote({ w, sel, onPD, onDel, onChange }: { w: StickyW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (t: string) => void }) {
  const pal = STICKY_PAL.find(c => c.bg === w.bg) ?? STICKY_PAL[0];
  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, background: w.bg, borderRadius: 4, padding: '12px 14px', boxShadow: sel ? '0 0 0 2.5px #4f46e5, 0 8px 24px rgba(0,0,0,0.2)' : '0 3px 12px rgba(0,0,0,0.12)', cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      {sel && <DelBtn onDelete={onDel} />}
      <textarea key={w.id} defaultValue={w.text} onBlur={e => onChange(e.target.value)} onPointerDown={e => e.stopPropagation()}
        placeholder="Type here…"
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: pal.text, lineHeight: 1.6, cursor: 'text', fontFamily: 'inherit', padding: 0, fontWeight: 500 }} />
      <div style={{ fontSize: 9, color: pal.text, opacity: 0.3, textAlign: 'right', userSelect: 'none' }}>sticky</div>
    </div>
  );
}

/* ── Note Card ──────────────────────────────────────────────────── */
function NoteCard({ w, sel, onPD, onDel, onChange }: { w: NoteW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (p: Partial<NoteW>) => void }) {
  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, background: 'white', borderRadius: 12, border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.08)'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.09)', cursor: 'grab', display: 'flex', flexDirection: 'column', userSelect: 'none', overflow: 'hidden' }}>
      {sel && <DelBtn onDelete={onDel} />}
      <div style={{ height: 3, background: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <input key={w.id + 't'} defaultValue={w.title} onBlur={e => onChange({ title: e.target.value })} onPointerDown={e => e.stopPropagation()} placeholder="Title…" style={{ fontSize: 13, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text', width: '100%' }} />
        <textarea key={w.id + 'b'} defaultValue={w.body} onBlur={e => onChange({ body: e.target.value })} onPointerDown={e => e.stopPropagation()} placeholder="Notes…" style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink-2)', lineHeight: 1.65, cursor: 'text', fontFamily: 'inherit', padding: 0 }} />
      </div>
    </div>
  );
}

/* ── Text Block ─────────────────────────────────────────────────── */
function TextBlock({ w, sel, onPD, onDel, onChange }: { w: TextW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (c: string) => void }) {
  const fs = TEXT_SIZES[w.size ?? 'md'].px;
  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, outline: sel ? '2px solid #4f46e5' : 'none', borderRadius: 4, padding: 4, cursor: 'grab', userSelect: 'none' }}>
      {sel && <DelBtn onDelete={onDel} />}
      <textarea key={w.id} defaultValue={w.content} onBlur={e => onChange(e.target.value)} onPointerDown={e => e.stopPropagation()} placeholder="Text…"
        style={{ width: '100%', minHeight: w.h - 8, fontSize: fs, fontWeight: fs >= 22 ? 700 : 600, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink)', lineHeight: 1.35, cursor: 'text', fontFamily: 'inherit', padding: 0 }} />
    </div>
  );
}

/* ── Goal Widget ────────────────────────────────────────────────── */
function GoalWidget({ w, sel, onPD, onDel, onChange }: { w: GoalW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (p: Partial<GoalW>) => void }) {
  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, background: 'linear-gradient(145deg, oklch(0.97 0.03 260), white)', borderRadius: 12, border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'oklch(0.88 0.07 260)'}`, boxShadow: '0 4px 16px rgba(79,70,229,0.1)', cursor: 'grab', userSelect: 'none', overflow: 'hidden', padding: '14px 16px' }}>
      {sel && <DelBtn onDelete={onDel} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <input key={w.id + 't'} defaultValue={w.title} onBlur={e => onChange({ title: e.target.value })} onPointerDown={e => e.stopPropagation()}
          placeholder="Goal title…"
          style={{ flex: 1, fontSize: 14, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text' }} />
      </div>
      <textarea key={w.id + 'd'} defaultValue={w.description} onBlur={e => onChange({ description: e.target.value })} onPointerDown={e => e.stopPropagation()}
        placeholder="Describe your goal and vision…" rows={3}
        style={{ width: '100%', fontSize: 12, border: 'none', outline: 'none', resize: 'none', background: 'transparent', color: 'var(--ink-3)', lineHeight: 1.6, cursor: 'text', fontFamily: 'inherit', padding: 0, boxSizing: 'border-box' }} />
      {w.targetDate && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#4f46e5', fontWeight: 600, padding: '4px 8px', background: 'oklch(0.94 0.04 260)', borderRadius: 6, display: 'inline-block' }}>
          📅 Target: {w.targetDate}
        </div>
      )}
      {!w.targetDate && (
        <input key={w.id + 'dt'} defaultValue={w.targetDate ?? ''} onBlur={e => onChange({ targetDate: e.target.value || undefined })} onPointerDown={e => e.stopPropagation()}
          type="date" placeholder="Target date (optional)"
          style={{ marginTop: 8, fontSize: 10, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-4)', padding: '3px 6px', outline: 'none', cursor: 'pointer' }} />
      )}
    </div>
  );
}

/* ── Checklist Widget ───────────────────────────────────────────── */
function ChecklistWidget({ w, sel, onPD, onDel, onChange }: { w: ChecklistW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void; onChange: (p: Partial<ChecklistW>) => void }) {
  const [newItem, setNewItem] = useState('');
  const done  = w.items.filter(i => i.done).length;
  const total = w.items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const barClr = pct === 100 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'oklch(0.72 0.10 220)';

  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, minHeight: w.h, background: 'white', borderRadius: 12, border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.08)'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.09)', cursor: 'grab', userSelect: 'none', overflow: 'hidden' }}>
      {sel && <DelBtn onDelete={onDel} />}
      <div style={{ height: 4, background: 'var(--line)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: barClr, transition: 'width 0.3s' }} />
      </div>
      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>☑</span>
          <input key={w.id + 't'} defaultValue={w.title} onBlur={e => onChange({ title: e.target.value })} onPointerDown={e => e.stopPropagation()}
            placeholder="Checklist title…"
            style={{ flex: 1, fontSize: 13, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, cursor: 'text' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? 'var(--ok)' : 'var(--ink-4)' }}>{pct}%</span>
        </div>
        <div data-no-drag style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {w.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '3px 0' }}>
              <input type="checkbox" checked={item.done} onChange={() => onChange({ items: w.items.map((it, j) => j === i ? { ...it, done: !it.done } : it) })} onPointerDown={e => e.stopPropagation()} style={{ flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 12, color: item.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{item.text}</span>
              <button onClick={() => onChange({ items: w.items.filter((_, j) => j !== i) })} onPointerDown={e => e.stopPropagation()} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 13, padding: '0 2px', opacity: 0.4 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 5, marginTop: 4 }} onPointerDown={e => e.stopPropagation()}>
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { onChange({ items: [...w.items, { text: newItem.trim(), done: false }] }); setNewItem(''); } }}
              placeholder="Add item… ↵"
              style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 5, outline: 'none', background: 'var(--surface-2)', color: 'var(--ink)' }} />
          </div>
          {total > 0 && <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4, textAlign: 'right' }}>{done}/{total} done</div>}
        </div>
      </div>
    </div>
  );
}

/* ── File / Image / Embed Card ──────────────────────────────────── */
function FileCard({ w, sel, onPD, onDel }: { w: FileW; sel: boolean; onPD: (e: React.PointerEvent) => void; onDel: () => void }) {
  if (w.embedType === 'image' && w.dataUrl) {
    return (
      <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, borderRadius: 12, border: `${sel ? 2.5 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.1)'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', cursor: 'grab', userSelect: 'none', overflow: 'hidden', background: '#f8f9fb' }}>
        {sel && <DelBtn onDelete={onDel} />}
        <img src={w.dataUrl} alt={w.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
        {sel && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.55))', padding: '12px 10px 6px', fontSize: 10, color: 'white', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
        )}
      </div>
    );
  }
  if (w.embedType === 'html' && w.dataUrl) {
    return (
      <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, borderRadius: 12, border: `${sel ? 2.5 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.1)'}`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', cursor: 'grab', userSelect: 'none', overflow: 'hidden', background: 'white' }}>
        {sel && <DelBtn onDelete={onDel} />}
        <div style={{ height: 24, background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', flexShrink: 0 }}>
          <span style={{ fontSize: 11 }}>🌐</span>
          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
        </div>
        <iframe srcDoc={w.dataUrl} title={w.name} style={{ width: '100%', height: w.h - 24, border: 'none', display: 'block' }} sandbox="allow-scripts allow-same-origin" />
      </div>
    );
  }
  const icon = FILE_ICONS[w.ext.toLowerCase()] ?? '📄';
  return (
    <div onPointerDown={onPD} style={{ position: 'absolute', left: w.x, top: w.y, width: w.w, height: w.h, background: 'white', borderRadius: 12, border: `${sel ? 2 : 1.5}px solid ${sel ? '#4f46e5' : 'rgba(0,0,0,0.08)'}`, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: '10px 14px', cursor: 'grab', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
      {sel && <DelBtn onDelete={onDel} />}
      <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.ext} file</div>
      </div>
    </div>
  );
}

/* ── Calendar View (on boards overview) ────────────────────────── */
const WEEK_PX = 72;

function CalendarView({ boards, onClose, onEditBoard }: {
  boards: Board[];
  onClose: () => void;
  onEditBoard: (b: Board) => void;
}) {
  const datedBoards = boards.filter(b => b.startDate && b.dueDate);
  const allBoards   = boards;

  const today = new Date();
  let rangeMin = new Date(today);
  let rangeMax = new Date(today);
  rangeMax.setDate(rangeMax.getDate() + 60);

  if (datedBoards.length > 0) {
    const starts = datedBoards.map(b => new Date(b.startDate!));
    const ends   = datedBoards.map(b => new Date(b.dueDate!));
    rangeMin = new Date(Math.min(...starts.map(d => d.getTime())));
    rangeMax = new Date(Math.max(...ends.map(d => d.getTime())));
  }
  rangeMin.setDate(rangeMin.getDate() - 7);
  rangeMax.setDate(rangeMax.getDate() + 14);

  const weeks: Date[] = [];
  const wCur = new Date(rangeMin);
  wCur.setDate(wCur.getDate() - wCur.getDay() + 1);
  while (wCur <= rangeMax) {
    weeks.push(new Date(wCur));
    wCur.setDate(wCur.getDate() + 7);
  }

  const totalDays = Math.ceil((rangeMax.getTime() - rangeMin.getTime()) / 86400000);
  const totalPx = weeks.length * WEEK_PX;

  const getBar = (b: Board) => {
    if (!b.startDate || !b.dueDate) return null;
    const s = new Date(b.startDate);
    const e = new Date(b.dueDate);
    const leftDays  = Math.max(0, (s.getTime() - rangeMin.getTime()) / 86400000);
    const widthDays = Math.max(1, (e.getTime() - s.getTime()) / 86400000) + 1;
    return {
      left:  Math.round(leftDays  / totalDays * totalPx),
      width: Math.max(14, Math.round(widthDays / totalDays * totalPx)),
    };
  };

  const todayLeft = Math.round((today.getTime() - rangeMin.getTime()) / 86400000 / totalDays * totalPx);

  return (
    <div className="page-fade">
      <div className="briefing" style={{ marginBottom: 20 }}>
        <div>
          <div className="card-title">📅 Project Calendar</div>
          <div className="card-sub">Timeline overview of all boards — click a board to set or view its dates</div>
        </div>
        <button className="btn btn-sec" onClick={onClose}>← Back to Boards</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 600, width: 240 + totalPx }}>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <div style={{ width: 240, flexShrink: 0, padding: '9px 18px', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: '1px solid var(--line)' }}>Board</div>
              <div style={{ position: 'relative', width: totalPx, flexShrink: 0, height: 34 }}>
                {weeks.map((w, i) => (
                  <div key={i} style={{ position: 'absolute', left: i * WEEK_PX, width: WEEK_PX, top: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, borderLeft: i > 0 ? '1px solid var(--line-2)' : 'none' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
                {todayLeft >= 0 && todayLeft <= totalPx && (
                  <div style={{ position: 'absolute', left: todayLeft, top: 0, bottom: 0, width: 2, background: 'var(--accent)', zIndex: 2 }}>
                    <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, color: 'var(--accent-ink)', fontWeight: 700, whiteSpace: 'nowrap' }}>Today</div>
                  </div>
                )}
              </div>
            </div>

            {allBoards.map(board => {
              const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
              const bar  = getBar(board);
              return (
                <div key={board.id} style={{ display: 'flex', borderBottom: '1px solid var(--line-2)', minHeight: 52, alignItems: 'center' }}>
                  <div style={{ width: 240, flexShrink: 0, padding: '8px 18px', borderRight: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: `oklch(0.62 0.14 ${area.hue})`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.title}</div>
                      {board.startDate && board.dueDate ? (
                        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>
                          {new Date(board.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(board.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      ) : (
                        <button onClick={() => onEditBoard(board)} style={{ fontSize: 10, color: 'var(--accent-ink)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: 1 }}>+ Set dates</button>
                      )}
                    </div>
                  </div>

                  <div style={{ position: 'relative', width: totalPx, height: 52, flexShrink: 0 }}>
                    {weeks.map((_, i) => i > 0 && (
                      <div key={i} style={{ position: 'absolute', left: i * WEEK_PX, top: 0, bottom: 0, width: 1, background: 'var(--line-2)' }} />
                    ))}
                    {todayLeft >= 0 && todayLeft <= totalPx && (
                      <div style={{ position: 'absolute', left: todayLeft, top: 0, bottom: 0, width: 2, background: 'oklch(0.62 0.18 260)', opacity: 0.25, zIndex: 1 }} />
                    )}
                    {bar ? (
                      <div style={{ position: 'absolute', left: bar.left, width: bar.width, top: '50%', transform: 'translateY(-50%)', height: 28, background: `oklch(0.62 0.14 ${area.hue})`, borderRadius: 7, display: 'flex', alignItems: 'center', paddingLeft: 8, overflow: 'hidden', zIndex: 2, boxShadow: `0 2px 8px oklch(0.62 0.14 ${area.hue} / 0.35)`, cursor: 'pointer' }}
                        onClick={() => onEditBoard(board)}
                      >
                        <span style={{ fontSize: 11, color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{board.title}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {datedBoards.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, borderTop: '1px solid var(--line)' }}>
            No boards have dates set yet. Click &quot;+ Set dates&quot; on any board above, or add dates when creating a new board.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Whiteboard View ────────────────────────────────────────────── */
function WhiteboardView({ board, onUpdate, onBack }: {
  board: Board; onUpdate: (fn: (b: Board) => Board) => void; onBack: () => void;
}) {
  const [tool, setTool]         = useState<ToolId>('select');
  const [stickyBg, setStickyBg] = useState('#fef08a');
  const [textSize, setTextSize] = useState<TextSize>('md');
  const [penColor, setPenColor] = useState('#1a1f2e');
  const [penWidth, setPenWidth] = useState(2);
  const [xf, setXf]             = useState<XF>({ x: 60, y: 60, s: 1 });
  const [selId, setSelId]       = useState<string | null>(null);
  const [liveStroke, setLiveStroke] = useState<[number, number][]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const xfRef        = useRef(xf);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFile  = useRef<[number, number] | null>(null);
  useEffect(() => { xfRef.current = xf; }, [xf]);

  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];

  const toCanvas = (sx: number, sy: number): [number, number] => {
    const rect = containerRef.current!.getBoundingClientRect();
    const t = xfRef.current;
    return [(sx - rect.left - t.x) / t.s, (sy - rect.top - t.y) / t.s];
  };

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setXf(t => {
      const ns = Math.min(4, Math.max(0.1, t.s * factor));
      const r  = ns / t.s;
      const mx = cx ?? 400, my = cy ?? 300;
      return { x: mx + (t.x - mx) * r, y: my + (t.y - my) * r, s: ns };
    });
  };

  useEffect(() => {
    const MAP: Record<string, ToolId> = { v: 'select', h: 'pan', s: 'sticky', n: 'note', t: 'text', g: 'goal', c: 'checklist', p: 'pen', f: 'file' };
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) { onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== selId) })); setSelId(null); return; }
      if (e.key === 'Escape') { setSelId(null); setTool('select'); return; }
      if (e.key === '=' || e.key === '+') { zoom(1.2); return; }
      if (e.key === '-') { zoom(0.8); return; }
      const t = MAP[e.key.toLowerCase()];
      if (t) setTool(t);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selId, onUpdate]);

  // Attach the wheel listener natively with { passive: false }. React's onWheel
  // is registered as passive, so e.preventDefault() there is ignored and the
  // browser performs its own ctrl+wheel page zoom on top of the canvas zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFile.current) { e.target.value = ''; return; }
    const [cx, cy] = pendingFile.current;
    pendingFile.current = null;
    const ext     = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const isImg   = IMAGE_EXTS.has(ext);
    const isHtml  = HTML_EXTS.has(ext);
    const ww = isImg ? 300 : isHtml ? 440 : 200;
    const wh = isImg ? 220 : isHtml ? 340 : 80;
    const reader  = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const nw: FileW = { id: uid(), type: 'file', x: cx - ww / 2, y: cy - wh / 2, w: ww, h: wh, name: file.name, ext, dataUrl: content, embedType: isImg ? 'image' : isHtml ? 'html' : 'file' };
      onUpdate(b => ({ ...b, widgets: [...b.widgets, nw] }));
      setSelId(nw.id);
    };
    if (isImg)       reader.readAsDataURL(file);
    else if (isHtml) reader.readAsText(file);
    else             reader.readAsDataURL(file);
    e.target.value = '';
    setTool('select');
  };

  const handleCanvasPD = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1 || tool === 'pan') {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const tx0 = xfRef.current.x, ty0 = xfRef.current.y;
      const mm = (me: PointerEvent) => setXf(t => ({ ...t, x: tx0 + me.clientX - sx, y: ty0 + me.clientY - sy }));
      const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
      window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
      return;
    }
    if (tool === 'select') { setSelId(null); return; }
    if (tool === 'pen') {
      const pt0 = toCanvas(e.clientX, e.clientY);
      const pts: [number, number][] = [pt0];
      setLiveStroke([pt0]);
      const mm = (me: PointerEvent) => { const pt = toCanvas(me.clientX, me.clientY); pts.push(pt); setLiveStroke(prev => [...prev, pt]); };
      const mu = () => {
        if (pts.length > 1) onUpdate(b => ({ ...b, strokes: [...b.strokes, { id: uid(), pts, color: penColor, w: penWidth }] }));
        setLiveStroke([]);
        window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu);
      };
      window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
      return;
    }
    const [cx, cy] = toCanvas(e.clientX, e.clientY);
    if (tool === 'file') { pendingFile.current = [cx, cy]; fileInputRef.current?.click(); return; }
    const id = uid();
    let nw: Widget;
    if (tool === 'sticky')    nw = { id, type: 'sticky',    x: cx - 90,  y: cy - 90,  w: 190, h: 190, text: '', bg: stickyBg };
    else if (tool === 'note') nw = { id, type: 'note',      x: cx - 130, y: cy - 85,  w: 250, h: 170, title: 'Note', body: '' };
    else if (tool === 'text') nw = { id, type: 'text',      x: cx - 110, y: cy - 20,  w: 220, h: 55,  content: 'Text', size: textSize };
    else if (tool === 'goal') nw = { id, type: 'goal',      x: cx - 110, y: cy - 80,  w: 240, h: 180, title: 'Goal', description: '' };
    else                      nw = { id, type: 'checklist', x: cx - 105, y: cy - 100, w: 220, h: 200, title: 'Checklist', items: [] };
    onUpdate(b => ({ ...b, widgets: [...b.widgets, nw] }));
    setSelId(id);
    setTool('select');
  };

  const makeDrag = (wid: string, wx0: number, wy0: number) => (e: React.PointerEvent) => {
    if (tool !== 'select') return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.stopPropagation();
    setSelId(wid);
    const sx0 = e.clientX, sy0 = e.clientY;
    const mm = (me: PointerEvent) => {
      const s = xfRef.current.s;
      onUpdate(b => ({ ...b, widgets: b.widgets.map(w => w.id === wid ? { ...w, x: wx0 + (me.clientX - sx0) / s, y: wy0 + (me.clientY - sy0) / s } : w) }));
    };
    const mu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu); };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu);
  };

  const delWidget   = (id: string) => { onUpdate(b => ({ ...b, widgets: b.widgets.filter(w => w.id !== id) })); setSelId(null); };
  const patchWidget = (id: string, patch: Partial<Widget>) => onUpdate(b => ({ ...b, widgets: b.widgets.map(w => w.id === id ? { ...w, ...patch } as Widget : w) }));
  const cursor = tool === 'pan' ? 'grab' : tool !== 'select' ? 'crosshair' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      <input ref={fileInputRef} type="file" accept="image/*,.html,.htm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt,.csv,.zip" style={{ display: 'none' }} onChange={handleFileInput} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--line)', background: 'white', flexShrink: 0, zIndex: 10, flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-sm btn-sec" style={{ flexShrink: 0 }}>← Boards</button>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{area.g}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{board.title}</div>
          {board.desc && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{board.desc}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-sm btn-sec" onClick={() => zoom(0.8)} title="Zoom out (−)" style={{ width: 28, padding: 0, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>−</button>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'center' }}>{Math.round(xf.s * 100)}%</span>
          <button className="btn btn-sm btn-sec" onClick={() => zoom(1.2)} title="Zoom in (+)" style={{ width: 28, padding: 0, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>+</button>
          <button className="btn btn-sm btn-sec" onClick={() => setXf({ x: 60, y: 60, s: 1 })} title="Reset zoom">⊙</button>
        </div>

        {board.strokes.length > 0 && (
          <button className="btn btn-sm btn-sec" onClick={() => onUpdate(b => ({ ...b, strokes: [] }))}>🧹 Clear ink</button>
        )}
        <button className={`bdg ${board.shared ? 'bdg-ok' : 'bdg-gy'}`}
          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', borderRadius: 20, fontSize: 11, flexShrink: 0 }}
          onClick={() => onUpdate(b => ({ ...b, shared: !b.shared }))}>
          {board.shared ? '🔗 Shared' : '🔒 Private'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <div style={{ width: 50, background: 'white', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 3, flexShrink: 0, overflowY: 'auto', zIndex: 10 }}>
          {TOOLS.map((t, i) => (
            <div key={t.id}>
              {i === 2 && <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 11px' }} />}
              {i === 7 && <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 11px' }} />}
              <button onClick={() => setTool(t.id)} title={t.label} style={{
                width: 36, height: 36, borderRadius: 8,
                fontSize: t.id === 'text' ? 13 : 16, fontWeight: t.id === 'text' ? 800 : 400,
                background: tool === t.id ? 'var(--accent-soft)' : 'transparent',
                border: `1.5px solid ${tool === t.id ? 'var(--accent-line)' : 'transparent'}`,
                color: tool === t.id ? 'var(--accent-ink)' : 'var(--ink-3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
              }}>{t.icon}</button>
            </div>
          ))}

          {tool === 'sticky' && (
            <>
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {STICKY_PAL.map(c => (
                <button key={c.bg} onClick={() => setStickyBg(c.bg)} style={{ width: 22, height: 22, borderRadius: 4, background: c.bg, border: `2.5px solid ${stickyBg === c.bg ? '#4f46e5' : c.bg === '#ffffff' ? '#d1d5db' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
              ))}
            </>
          )}

          {tool === 'text' && (
            <>
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {(Object.keys(TEXT_SIZES) as TextSize[]).map(sz => (
                <button key={sz} onClick={() => setTextSize(sz)} title={`${TEXT_SIZES[sz].px}px`}
                  style={{ width: 36, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700, background: textSize === sz ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${textSize === sz ? 'var(--accent-line)' : 'transparent'}`, color: textSize === sz ? 'var(--accent-ink)' : 'var(--ink-4)', cursor: 'pointer' }}>
                  {TEXT_SIZES[sz].label}
                </button>
              ))}
            </>
          )}

          {tool === 'pen' && (
            <>
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {PEN_COLORS.map(c => (
                <button key={c} onClick={() => setPenColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: `2.5px solid ${penColor === c ? '#4f46e5' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
              ))}
              <div style={{ width: 28, height: 1, background: 'var(--line)', margin: '4px 0' }} />
              {PEN_WIDTHS.map(pw => (
                <button key={pw} onClick={() => setPenWidth(pw)} style={{ width: 36, height: 26, background: penWidth === pw ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${penWidth === pw ? 'var(--accent-line)' : 'transparent'}`, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: pw, background: penColor, borderRadius: pw }} />
                </button>
              ))}
            </>
          )}
        </div>

        <div ref={containerRef} onPointerDown={handleCanvasPD}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor, background: 'var(--surface-2)', backgroundImage: 'radial-gradient(circle, oklch(0.84 0.01 265) 1px, transparent 1px)', backgroundSize: '28px 28px', touchAction: 'none' }}>
          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${xf.x}px,${xf.y}px) scale(${xf.s})`, width: 3600, height: 2800 }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              {board.strokes.map(s => <path key={s.id} d={makePath(s.pts)} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />)}
              {liveStroke.length > 1 && <path d={makePath(liveStroke)} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" />}
            </svg>

            {board.widgets.map(w => {
              const common = { sel: selId === w.id, onPD: makeDrag(w.id, w.x, w.y), onDel: () => delWidget(w.id) };
              if (w.type === 'sticky')    return <StickyNote    key={w.id} w={w} {...common} onChange={t => patchWidget(w.id, { text: t })} />;
              if (w.type === 'note')      return <NoteCard      key={w.id} w={w} {...common} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
              if (w.type === 'text')      return <TextBlock     key={w.id} w={w} {...common} onChange={c => patchWidget(w.id, { content: c })} />;
              if (w.type === 'goal')      return <GoalWidget    key={w.id} w={w} {...common} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
              if (w.type === 'checklist') return <ChecklistWidget key={w.id} w={w} {...common} onChange={p => patchWidget(w.id, p as Partial<Widget>)} />;
              if (w.type === 'file')      return <FileCard      key={w.id} w={w} {...common} />;
              return null;
            })}
          </div>

          {board.widgets.length === 0 && board.strokes.length === 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: 'var(--ink-4)', pointerEvents: 'none' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🖊</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6 }}>Board is empty</div>
              <div style={{ fontSize: 12, marginBottom: 10 }}>Pick a tool on the left and click to place.</div>
              <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.8 }}>S sticky · N note · T text · G goal · C checklist<br />P pen · F image/file · H pan · scroll to zoom</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Boards Overview ────────────────────────────────────────────── */
export default function PlanningClient({ initialBoards, currentUserId }: { initialBoards: Board[]; currentUserId: string }) {
  const [boards, setBoards]             = useState<Board[]>(initialBoards);
  const [activeBoardId, setActive]      = useState<string | null>(null);
  const [areaFilter, setAreaFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState<BoardStatus | 'all'>('in_progress');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [editBoard, setEditBoard]       = useState<Board | null>(null);
  const [form, setForm]                 = useState({ title: '', areaId: 'marketing', desc: '', startDate: '', dueDate: '' });
  const [mounted, setMounted]           = useState(false);
  const [createError, setCreateError]   = useState('');
  const [creating, setCreating]         = useState(false);
  const [dbBanner, setDbBanner]         = useState('');
  const savePendingRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  /* One-time seed: if DB and localStorage are both empty, insert the default starter boards */
  useEffect(() => {
    if (initialBoards.length > 0) return;

    // Try localStorage migration first
    try {
      const raw = localStorage.getItem('pv-planning-v3');
      if (raw) {
        const parsed = JSON.parse(raw) as Board[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          Promise.all(parsed.map(b =>
            dbOp('planning_documents', 'insert', {
              id: b.id, title: b.title, board_desc: b.desc || '',
              area_id: b.areaId, shared: b.shared,
              start_date: b.startDate ?? null, due_date: b.dueDate ?? null,
              content: {
                widgets: b.widgets.map((w): Widget =>
                  w.type === 'file' && w.dataUrl && w.dataUrl.length > 200_000 ? { ...w, dataUrl: undefined } : w
                ),
                strokes: b.strokes,
              },
              created_by: currentUserId,
            })
          )).then(() => { setBoards(parsed); localStorage.removeItem('pv-planning-v3'); });
          return;
        }
      }
    } catch { /* ignore */ }

    // Nothing in localStorage either — recreate the boards that were lost
    const cxStarter: Board = {
      id: CX_PLAN_ID, title: 'Cx Care Team MNGMT PLAN',
      desc: 'Customer experience cycle management and task framework',
      areaId: 'cx', shared: true, created: new Date().toISOString(),
      widgets: CX_PLAN_WIDGETS, strokes: [],
    };
    const starters: Board[] = [
      {
        id: uid(), title: 'Business Plan', desc: '',
        areaId: 'business', shared: false, created: new Date().toISOString(),
        widgets: [], strokes: [],
      },
      cxStarter,
    ];
    Promise.all(starters.map(b =>
      dbOp('planning_documents', 'insert', {
        id: b.id, title: b.title, board_desc: b.desc,
        area_id: b.areaId, shared: b.shared,
        start_date: b.startDate ?? null, due_date: b.dueDate ?? null,
        content: { widgets: b.widgets, strokes: b.strokes },
        created_by: currentUserId,
      })
    )).then(() => setBoards(starters));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Restore CX plan if DB already had other boards but the CX plan is missing */
  useEffect(() => {
    const hasCxPlan = initialBoards.some(
      b => b.id === CX_PLAN_ID || b.title === 'Cx Care Team MNGMT PLAN'
    );
    if (hasCxPlan) return;
    // Only restore when we know there are already boards (seed won't run)
    if (initialBoards.length === 0) return;
    const cxBoard: Board = {
      id: CX_PLAN_ID, title: 'Cx Care Team MNGMT PLAN',
      desc: 'Customer experience cycle management and task framework',
      areaId: 'cx', shared: true, created: new Date().toISOString(),
      widgets: CX_PLAN_WIDGETS, strokes: [],
    };
    dbOp('planning_documents', 'insert', {
      id: cxBoard.id, title: cxBoard.title, board_desc: cxBoard.desc,
      area_id: cxBoard.areaId, shared: cxBoard.shared,
      start_date: null, due_date: null,
      content: { widgets: CX_PLAN_WIDGETS, strokes: [] },
      created_by: currentUserId,
    }).then(({ error }) => {
      if (!error) {
        setBoards(prev => {
          const already = prev.some(b => b.id === CX_PLAN_ID || b.title === 'Cx Care Team MNGMT PLAN');
          return already ? prev : [cxBoard, ...prev];
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Debounced auto-save of the active board's content every 3s while editing */
  useEffect(() => {
    if (!activeBoardId) return;
    if (savePendingRef.current) clearTimeout(savePendingRef.current);
    savePendingRef.current = setTimeout(async () => {
      const board = boards.find(b => b.id === activeBoardId);
      if (!board) return;
      const safeWidgets = board.widgets.map((w): Widget =>
        w.type === 'file' && w.dataUrl && w.dataUrl.length > 200_000 ? { ...w, dataUrl: undefined } : w
      );
      await dbOp('planning_documents', 'update', {
        content: { widgets: safeWidgets, strokes: board.strokes },
        updated_at: new Date().toISOString(),
      }, { id: board.id });
    }, 3000);
  }, [boards, activeBoardId]);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const updateBoard = (fn: (b: Board) => Board) => setBoards(prev => prev.map(b => b.id === activeBoardId ? fn(b) : b));
  const updateById  = (id: string, fn: (b: Board) => Board) => setBoards(prev => prev.map(b => b.id === id ? fn(b) : b));

  // Change a board's lifecycle status and stamp the moment it changed.
  const changeStatus = async (id: string, status: BoardStatus) => {
    const now = new Date().toISOString();
    const prev = boards.find(b => b.id === id);
    updateById(id, b => ({ ...b, status, statusChangedAt: now }));
    const { error } = await dbOp('planning_documents', 'update', { status, status_changed_at: now }, { id });
    if (error) {
      // Roll the optimistic change back so the UI matches what's actually stored,
      // and tell the user why (almost always: the schema_v86 migration isn't applied).
      updateById(id, b => ({ ...b, status: prev?.status ?? 'in_progress', statusChangedAt: prev?.statusChangedAt }));
      setDbBanner(`Couldn't save the board status. Run the schema_v86 migration in Supabase, then try again. (${error})`);
    }
  };

  // ── Live time tracking (clock in / out per board) ──────────────────────────
  // A board's clock counts up while running; tick once a second only when at
  // least one board is actively running.
  const anyRunning = boards.some(b => b.timeRunningSince);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const elapsedSeconds = (b: Board) => {
    const accrued = b.timeAccruedSeconds ?? 0;
    if (!b.timeRunningSince) return accrued;
    return accrued + Math.max(0, Math.floor((nowMs - new Date(b.timeRunningSince).getTime()) / 1000));
  };

  const startTimer = (id: string) => {
    const iso = new Date().toISOString();
    setNowMs(Date.now());
    updateById(id, b => ({ ...b, timeRunningSince: iso }));
    dbOp('planning_documents', 'update', { time_running_since: iso }, { id });
  };

  const stopTimer = (id: string) => {
    const b = boards.find(x => x.id === id);
    if (!b || !b.timeRunningSince) return;
    const accrued = (b.timeAccruedSeconds ?? 0)
      + Math.max(0, Math.floor((Date.now() - new Date(b.timeRunningSince).getTime()) / 1000));
    updateById(id, bb => ({ ...bb, timeRunningSince: undefined, timeAccruedSeconds: accrued }));
    dbOp('planning_documents', 'update', { time_running_since: null, time_accrued_seconds: accrued }, { id });
  };

  /* Save active board immediately then navigate back */
  const handleBack = () => {
    if (savePendingRef.current) clearTimeout(savePendingRef.current);
    if (activeBoardId) {
      const board = boards.find(b => b.id === activeBoardId);
      if (board) {
        const safeWidgets = board.widgets.map((w): Widget =>
          w.type === 'file' && w.dataUrl && w.dataUrl.length > 200_000 ? { ...w, dataUrl: undefined } : w
        );
        dbOp('planning_documents', 'update', {
          content: { widgets: safeWidgets, strokes: board.strokes },
          shared: board.shared,
          updated_at: new Date().toISOString(),
        }, { id: board.id });
      }
    }
    setActive(null);
  };

  const addBoard = async () => {
    if (!form.title.trim()) return;
    setCreateError('');
    setCreating(true);
    const b = makeBoard(form.title.trim(), form.areaId, form.desc, form.startDate, form.dueDate);
    const { error } = await dbOp('planning_documents', 'insert', {
      id: b.id,
      title: b.title,
      board_desc: b.desc,
      area_id: b.areaId,
      shared: b.shared,
      start_date: b.startDate ?? null,
      due_date: b.dueDate ?? null,
      status: 'in_progress',
      status_changed_at: b.created,
      content: { widgets: [], strokes: [] },
      created_by: currentUserId,
    });
    setCreating(false);
    if (error) {
      setCreateError(error);
      return;
    }
    setBoards(prev => [b, ...prev]);
    setActive(b.id);
    setShowNew(false);
    setForm({ title: '', areaId: 'marketing', desc: '', startDate: '', dueDate: '' });
  };

  const saveEditBoard = async () => {
    if (!editBoard) return;
    const patch = {
      title: form.title || editBoard.title,
      board_desc: form.desc,
      area_id: form.areaId,
      start_date: form.startDate || null,
      due_date: form.dueDate || null,
    };
    await dbOp('planning_documents', 'update', patch, { id: editBoard.id });
    updateById(editBoard.id, b => ({
      ...b,
      title: patch.title,
      desc: patch.board_desc,
      areaId: form.areaId,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
    }));
    setEditBoard(null);
  };

  const openEditBoard = (b: Board) => {
    setEditBoard(b);
    setForm({ title: b.title, areaId: b.areaId, desc: b.desc, startDate: b.startDate ?? '', dueDate: b.dueDate ?? '' });
  };

  const deleteBoard = async (id: string) => {
    if (!confirm('Delete this board?')) return;
    await dbOp('planning_documents', 'delete', {}, { id });
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  if (activeBoard) return <WhiteboardView board={activeBoard} onUpdate={updateBoard} onBack={handleBack} />;
  if (showCalendar) return <CalendarView boards={boards} onClose={() => setShowCalendar(false)} onEditBoard={b => { openEditBoard(b); setShowCalendar(false); }} />;

  const usedAreaIds  = [...new Set(boards.map(b => b.areaId))];
  const statusOf     = (b: Board): BoardStatus => b.status ?? 'in_progress';
  const statusCount  = (s: BoardStatus | 'all') => s === 'all' ? boards.length : boards.filter(b => statusOf(b) === s).length;
  const filtered     = boards.filter(b =>
    (statusFilter === 'all' || statusOf(b) === statusFilter) &&
    (areaFilter === 'all' || b.areaId === areaFilter)
  );
  const totalItems  = boards.reduce((s, b) => s + b.widgets.length + b.strokes.length, 0);
  const sharedCount = boards.filter(b => b.shared).length;

  return (
    <div className="page-fade">
      {dbBanner && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span>{dbBanner}</span>
          <button onClick={() => setDbBanner('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>×</button>
        </div>
      )}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Boards', value: boards.length,    foot: 'Planning spaces',    ico: 'ind', g: '◈' },
          { label: 'Total Items',  value: totalItems,         foot: 'Widgets + drawings', ico: 'ind', g: '🖊' },
          { label: 'Shared',       value: sharedCount,        foot: 'Visible to team',    ico: 'ok',  g: '🔗' },
          { label: 'Areas',        value: usedAreaIds.length, foot: 'Business areas',     ico: 'ind', g: '◉' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className={`stat-ico ${s.ico}`}>{s.g}</div></div>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v">{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      {/* Status tabs — boards live under In Progress / Extended / Closed */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {([
          { id: 'in_progress', label: 'In Progress', emoji: '🟢' },
          { id: 'extended',    label: 'Extended',    emoji: '⏳' },
          { id: 'closed',      label: 'Closed',      emoji: '✅' },
          { id: 'all',         label: 'All',         emoji: '▦' },
        ] as { id: BoardStatus | 'all'; label: string; emoji: string }[]).map(t => {
          const active = statusFilter === t.id;
          const meta = t.id !== 'all' ? STATUS_META[t.id] : null;
          const count = statusCount(t.id);
          return (
            <button key={t.id} onClick={() => setStatusFilter(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: '1.5px solid',
                ...(active
                  ? (meta ? { background: meta.bg, color: meta.fg, borderColor: meta.bd } : { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' })
                  : { background: 'white', color: 'var(--ink-3)', borderColor: 'var(--line)' }) }}>
              <span>{t.emoji}</span>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? 'rgba(0,0,0,0.10)' : 'var(--surface-3)', color: active ? 'inherit' : 'var(--ink-4)' }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flex: 1, minWidth: 0 }}>
          <button className={`tab${areaFilter === 'all' ? ' active' : ''}`} onClick={() => setAreaFilter('all')}>All ({boards.length})</button>
          {AREAS.filter(a => usedAreaIds.includes(a.id)).map(a => (
            <button key={a.id} className={`tab${areaFilter === a.id ? ' active' : ''}`} onClick={() => setAreaFilter(a.id)}>{a.g} {a.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sec" onClick={() => setShowCalendar(true)}>📅 Calendar</button>
          <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)' }}>
          {boards.length === 0 ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖊</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-2)', marginBottom: 8 }}>No boards yet</div>
              <div style={{ marginBottom: 20, fontSize: 13 }}>Create a board and start placing ideas.</div>
              <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{statusFilter !== 'all' ? STATUS_META[statusFilter].emoji : '🗂'}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-2)', marginBottom: 8 }}>
                No {statusFilter !== 'all' ? STATUS_META[statusFilter].label : ''} boards{areaFilter !== 'all' ? ' in this area' : ''}
              </div>
              <div style={{ marginBottom: 20, fontSize: 13 }}>Change a board’s status from its card, or view another tab.</div>
              <button className="btn btn-sec" onClick={() => setStatusFilter('all')}>View all boards</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {filtered.map(board => {
            const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
            const widgetCount = board.widgets.length;
            const goals = board.widgets.filter(w => w.type === 'goal').length;
            const checklists = board.widgets.filter(w => w.type === 'checklist').length;
            return (
              <div key={board.id} onClick={() => setActive(board.id)}
                style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 14, padding: '18px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--sh-1)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.borderColor = `oklch(0.84 0.08 ${area.hue})`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `oklch(0.65 0.12 ${area.hue})`, borderRadius: '14px 14px 0 0' }} />
                <div style={{ position: 'absolute', top: 12, right: 10, display: 'flex', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); openEditBoard(board); }} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 13, padding: '2px 5px', opacity: 0.5 }} title="Edit board">⚙</button>
                  <button onClick={e => { e.stopPropagation(); deleteBoard(board.id); }} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, padding: '2px 5px', opacity: 0.5 }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, marginTop: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>{area.g}</div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 40 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.25 }}>{board.title}</div>
                    <div style={{ fontSize: 11, color: `oklch(0.52 0.09 ${area.hue})`, marginTop: 2, fontWeight: 500 }}>{area.label}</div>
                  </div>
                </div>

                {board.desc && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{board.desc}</div>
                )}

                {board.startDate && board.dueDate && (
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>📅</span>
                    {new Date(board.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(board.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}

                {(() => {
                  const running = !!board.timeRunningSince;
                  const secs = elapsedSeconds(board);
                  return (
                    <div onClick={e => e.stopPropagation()}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}>
                      <span style={{ fontSize: 12 }}>⏱</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', color: running ? 'oklch(0.55 0.16 25)' : secs > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                        {fmtClock(secs)}
                      </span>
                      {running && <span style={{ fontSize: 9, fontWeight: 700, color: 'oklch(0.55 0.16 25)', letterSpacing: '0.06em' }}>● TRACKING</span>}
                      <button
                        onClick={e => { e.stopPropagation(); if (running) stopTimer(board.id); else startTimer(board.id); }}
                        title={running ? 'Stop the clock' : 'Start the clock'}
                        style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid',
                          ...(running
                            ? { background: 'var(--err-soft)', color: 'oklch(0.5 0.16 25)', borderColor: 'oklch(0.85 0.10 25)' }
                            : { background: 'var(--ok-soft)', color: 'oklch(0.42 0.12 155)', borderColor: 'oklch(0.85 0.08 155)' }) }}
                      >
                        {running ? '■ Stop' : secs > 0 ? '▶ Resume' : '▶ Start'}
                      </button>
                    </div>
                  );
                })()}

                {widgetCount > 0 && (
                  <div style={{ height: 38, background: 'var(--surface-2)', borderRadius: 7, marginBottom: 10, position: 'relative', overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                    {board.widgets.slice(0, 12).map((w, i) => {
                      const x = (i % 6) * 16 + 8, y = Math.floor(i / 6) * 14 + 5;
                      const bg = w.type === 'sticky' ? w.bg : w.type === 'goal' ? '#e0e7ff' : w.type === 'checklist' ? '#dcfce7' : 'white';
                      return <div key={w.id} style={{ position: 'absolute', left: x, top: y, width: 11, height: 11, borderRadius: 2, background: bg, border: '1px solid rgba(0,0,0,0.06)' }} />;
                    })}
                    <div style={{ position: 'absolute', right: 6, bottom: 3, fontSize: 9, color: 'var(--ink-4)', fontWeight: 600 }}>{widgetCount} items</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(() => {
                    const status = (board.status ?? 'in_progress') as BoardStatus;
                    const meta = STATUS_META[status];
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <select
                          value={status}
                          title="Change board status"
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); changeStatus(board.id, e.target.value as BoardStatus); }}
                          style={{ fontSize: 10, fontWeight: 700, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}` }}
                        >
                          {STATUS_ORDER.map(s => (
                            <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                          ))}
                        </select>
                        {status !== 'in_progress' && board.statusChangedAt && (
                          <span style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 600 }}>
                            · {new Date(board.statusChangedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {board.shared && <span className="bdg bdg-ok" style={{ fontSize: 10 }}>🔗 Shared</span>}
                  {goals > 0 && <span className="bdg bdg-acc" style={{ fontSize: 10 }}>🎯 {goals}</span>}
                  {checklists > 0 && <span className="bdg bdg-gy" style={{ fontSize: 10 }}>☑ {checklists}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>
                    {new Date(board.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Board modal */}
      {showNew && mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div style={{ background: 'white', borderRadius: 16, width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>New Board</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>A blank canvas to organise your thinking.</div>
            <div className="pv-fld"><label>Board title *</label>
              <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addBoard(); }} placeholder="e.g. Q3 Marketing Plan" /></div>
            <div className="pv-fld"><label>Area</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.g} {a.label}</option>)}</select></div>
            <div className="pv-fld"><label>Description <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea rows={2} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="What is this board for?" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="pv-fld"><label>Start date <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="pv-fld"><label>Due date <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            {createError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#dc2626' }}>
                ⚠️ {createError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addBoard} className="btn btn-acc" disabled={!form.title.trim() || creating}>
                {creating ? 'Creating…' : 'Create Board'}
              </button>
              <button onClick={() => { setShowNew(false); setCreateError(''); setForm({ title: '', areaId: 'marketing', desc: '', startDate: '', dueDate: '' }); }} className="btn btn-sec" disabled={creating}>Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Board modal */}
      {editBoard && mounted && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setEditBoard(null); }}>
          <div style={{ background: 'white', borderRadius: 16, width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 22 }}>Edit Board</div>
            <div className="pv-fld"><label>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="pv-fld"><label>Area</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.g} {a.label}</option>)}</select></div>
            <div className="pv-fld"><label>Description</label>
              <textarea rows={2} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="pv-fld"><label>Start date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="pv-fld"><label>Due date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEditBoard} className="btn btn-acc">Save Changes</button>
              <button onClick={() => setEditBoard(null)} className="btn btn-sec">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
