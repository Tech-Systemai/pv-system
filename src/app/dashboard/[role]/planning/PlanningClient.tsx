'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/* ── Types ─────────────────────────────────────────────────── */
type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
interface CheckItem { text: string; done: boolean }
interface PlanCard {
  id: string; title: string; description: string;
  priority: Priority; dueDate: string; tags: string[];
  checklist: CheckItem[]; assignee: string;
}
interface PlanColumn { id: string; title: string; color: string; cards: PlanCard[] }
interface PlanBoard {
  id: string; title: string; description: string;
  areaId: string; shared: boolean; createdAt: string;
  columns: PlanColumn[];
}

/* ── Constants ─────────────────────────────────────────────── */
const AREAS = [
  { id: 'marketing',  label: 'Marketing',    hue: 268, glyph: '📣' },
  { id: 'business',   label: 'Business Dev', hue: 25,  glyph: '🤝' },
  { id: 'financial',  label: 'Financial',    hue: 145, glyph: '📊' },
  { id: 'website',    label: 'Website',      hue: 200, glyph: '🌐' },
  { id: 'cx',         label: 'CX',           hue: 75,  glyph: '⭐' },
  { id: 'sales',      label: 'Sales',        hue: 155, glyph: '💰' },
  { id: 'operations', label: 'Operations',   hue: 220, glyph: '⚙️' },
  { id: 'hr',         label: 'HR',           hue: 340, glyph: '👥' },
];

const PRIORITY_CFG: Record<Priority, { label: string; badgeCls: string }> = {
  none:   { label: '—',      badgeCls: 'bdg-gy' },
  low:    { label: 'Low',    badgeCls: 'bdg-ok' },
  medium: { label: 'Medium', badgeCls: 'bdg-warn' },
  high:   { label: 'High',   badgeCls: 'bdg-err' },
  urgent: { label: 'Urgent', badgeCls: 'bdg-acc' },
};

const DEFAULT_COLS = [
  { title: 'To Do',       color: '220' },
  { title: 'In Progress', color: '268' },
  { title: 'Review',      color: '75' },
  { title: 'Done',        color: '155' },
];

/* ── Helpers ───────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 10); }

function makeBoard(title: string, areaId: string, description = ''): PlanBoard {
  return {
    id: uid(), title, description, areaId, shared: false,
    createdAt: new Date().toISOString(),
    columns: DEFAULT_COLS.map(c => ({ id: uid(), title: c.title, color: c.color, cards: [] })),
  };
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(d: string) {
  return !!d && new Date(d + 'T23:59:59') < new Date();
}

/* ── Seed data ─────────────────────────────────────────────── */
const SEED: PlanBoard[] = [
  {
    id: 'b-1', title: 'Q3 Marketing Plan', description: 'Campaigns, content, and growth initiatives for Q3.',
    areaId: 'marketing', shared: true, createdAt: new Date().toISOString(),
    columns: [
      { id: 'c-1', title: 'To Do', color: '220', cards: [
        { id: 'k-1', title: 'Launch email re-engagement campaign', description: 'Send targeted flow to leads inactive 60+ days.', priority: 'high', dueDate: '2025-07-15', tags: ['Email'], checklist: [{ text: 'Write copy', done: true }, { text: 'Design template', done: false }, { text: 'Set up automation', done: false }], assignee: 'Sara M.' },
        { id: 'k-2', title: 'Blog post: Industry trends report', description: '', priority: 'medium', dueDate: '', tags: ['Content'], checklist: [], assignee: 'Lin W.' },
        { id: 'k-3', title: 'Set up retargeting audiences', description: '', priority: 'low', dueDate: '', tags: ['Ads'], checklist: [], assignee: '' },
      ]},
      { id: 'c-2', title: 'In Progress', color: '268', cards: [
        { id: 'k-4', title: 'A/B test paid ad creatives', description: 'Testing two creative variants across Facebook & Google.', priority: 'high', dueDate: '2025-07-10', tags: ['Ads'], checklist: [{ text: 'Create variant A', done: true }, { text: 'Create variant B', done: true }, { text: 'Launch campaigns', done: false }, { text: 'Monitor daily spend', done: false }], assignee: 'James K.' },
      ]},
      { id: 'c-3', title: 'Review', color: '75', cards: [
        { id: 'k-5', title: 'Brand guidelines refresh', description: '', priority: 'low', dueDate: '', tags: ['Brand'], checklist: [], assignee: 'Sara M.' },
      ]},
      { id: 'c-4', title: 'Done', color: '155', cards: [
        { id: 'k-6', title: 'Q2 campaign performance report', description: '', priority: 'none', dueDate: '', tags: ['Report'], checklist: [], assignee: 'Sara M.' },
      ]},
    ],
  },
  {
    id: 'b-2', title: 'Sales Pipeline Q3', description: 'Track deals, outreach, and pipeline initiatives.',
    areaId: 'sales', shared: false, createdAt: new Date().toISOString(),
    columns: [
      { id: 'c-5', title: 'To Do', color: '220', cards: [
        { id: 'k-7', title: 'Prospect 20 new enterprise accounts', description: '', priority: 'urgent', dueDate: '2025-07-08', tags: [], checklist: [], assignee: 'James K.' },
        { id: 'k-8', title: 'Update CRM deal stages', description: '', priority: 'medium', dueDate: '', tags: [], checklist: [], assignee: '' },
      ]},
      { id: 'c-6', title: 'In Progress', color: '268', cards: [
        { id: 'k-9', title: 'Proposal: Acme Corp', description: 'Custom enterprise package for 200-seat deployment.', priority: 'high', dueDate: '2025-07-12', tags: ['Enterprise'], checklist: [{ text: 'Discovery call', done: true }, { text: 'Draft proposal', done: false }, { text: 'Internal review', done: false }, { text: 'Send to client', done: false }], assignee: 'Omar T.' },
      ]},
      { id: 'c-7', title: 'Review', color: '75', cards: [] },
      { id: 'c-8', title: 'Done', color: '155', cards: [] },
    ],
  },
];

/* ── Card Detail Modal ─────────────────────────────────────── */
interface CardModalProps {
  card: PlanCard; col: PlanColumn; board: PlanBoard;
  onClose: () => void;
  onUpdate: (bid: string, cid: string, kid: string, p: Partial<PlanCard>) => void;
  onMove: (bid: string, from: string, to: string, kid: string) => void;
  onDelete: (bid: string, cid: string, kid: string) => void;
}

function CardModal({ card, col, board, onClose, onUpdate, onMove, onDelete }: CardModalProps) {
  const [draft, setDraft] = useState(card);
  const [newItem, setNewItem] = useState('');
  const [newTag, setNewTag] = useState('');

  const save = (patch: Partial<PlanCard>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onUpdate(board.id, col.id, card.id, patch);
  };

  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
  const done = draft.checklist.filter(i => i.done).length;
  const total = draft.checklist.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'white', borderRadius: 16, width: 580, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: `oklch(0.55 0.12 ${area.hue})`, background: `oklch(0.94 0.04 ${area.hue})`, padding: '3px 10px', borderRadius: 20 }}>
              {area.glyph} {area.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>in</span>
            <select
              value={col.id}
              onChange={e => { onMove(board.id, col.id, e.target.value, card.id); onClose(); }}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', cursor: 'pointer', outline: 'none' }}
            >
              {board.columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select
              value={draft.priority}
              onChange={e => save({ priority: e.target.value as Priority })}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)', cursor: 'pointer', outline: 'none', marginLeft: 'auto' }}
            >
              {(Object.keys(PRIORITY_CFG) as Priority[]).map(p => (
                <option key={p} value={p}>{p === 'none' ? 'No priority' : PRIORITY_CFG[p].label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            onBlur={() => save({ title: draft.title })}
            rows={draft.title.length > 60 ? 2 : 1}
            style={{ width: '100%', fontSize: 19, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', padding: 0, resize: 'none', lineHeight: 1.3 }}
          />

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--line)', marginTop: 12, display: 'flex', gap: 0 }}>
            {['Details', 'Checklist', 'Tags'].map((t, i) => (
              <span key={t} style={{ display: 'none' }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Assignee</div>
              <input
                value={draft.assignee}
                onChange={e => setDraft(d => ({ ...d, assignee: e.target.value }))}
                onBlur={() => save({ assignee: draft.assignee })}
                placeholder="Assign to…"
                style={{ width: '100%', fontSize: 13, padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Due Date</div>
              <input
                type="date" value={draft.dueDate}
                onChange={e => save({ dueDate: e.target.value })}
                style={{ width: '100%', fontSize: 13, padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Description</div>
            <textarea
              rows={3} value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              onBlur={() => save({ description: draft.description })}
              placeholder="Add notes, context, or links…"
              style={{ width: '100%', fontSize: 13, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* Checklist */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: total > 0 ? 8 : 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Checklist {total > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({done}/{total})</span>}
              </div>
              {total > 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{pct}%</span>}
            </div>
            {total > 0 && (
              <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ok)', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
              {draft.checklist.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}>
                  <input type="checkbox" checked={item.done}
                    onChange={() => save({ checklist: draft.checklist.map((it, j) => j === i ? { ...it, done: !it.done } : it) })}
                    style={{ flexShrink: 0, accentColor: 'var(--accent)' }} />
                  <span style={{ flex: 1, fontSize: 13, color: item.done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  <button onClick={() => save({ checklist: draft.checklist.filter((_, j) => j !== i) })}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { save({ checklist: [...draft.checklist, { text: newItem.trim(), done: false }] }); setNewItem(''); } }}
                placeholder="Add item… press Enter"
                style={{ flex: 1, fontSize: 13, padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }}
              />
              <button onClick={() => { if (newItem.trim()) { save({ checklist: [...draft.checklist, { text: newItem.trim(), done: false }] }); setNewItem(''); } }}
                className="btn btn-sec btn-sm">Add</button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {draft.tags.map(tag => (
                <span key={tag} className="bdg bdg-acc" style={{ cursor: 'pointer', fontSize: 10 }}
                  onClick={() => save({ tags: draft.tags.filter(t => t !== tag) })}>
                  {tag} ×
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newTag.trim() && !draft.tags.includes(newTag.trim())) { save({ tags: [...draft.tags, newTag.trim()] }); setNewTag(''); } }}
                placeholder="Add tag… press Enter"
                style={{ flex: 1, fontSize: 13, padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }}
              />
              <button onClick={() => { if (newTag.trim() && !draft.tags.includes(newTag.trim())) { save({ tags: [...draft.tags, newTag.trim()] }); setNewTag(''); } }}
                className="btn btn-sec btn-sm">Add</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => { onDelete(board.id, col.id, card.id); onClose(); }}
            className="btn btn-sm" style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', border: '1px solid oklch(0.85 0.10 25)' }}>
            🗑 Delete
          </button>
          <button onClick={onClose} className="btn btn-sec btn-sm">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Kanban view ───────────────────────────────────────────── */
interface KanbanProps {
  board: PlanBoard; onBack: () => void;
  onUpdateCard: (bid: string, cid: string, kid: string, p: Partial<PlanCard>) => void;
  onMoveCard: (bid: string, from: string, to: string, kid: string) => void;
  onDeleteCard: (bid: string, cid: string, kid: string) => void;
  onAddCard: (bid: string, cid: string, title: string) => void;
  onAddColumn: (bid: string, title: string) => void;
  onUpdateBoard: (bid: string, p: Partial<PlanBoard>) => void;
}

function KanbanView({ board, onBack, onUpdateCard, onMoveCard, onDeleteCard, onAddCard, onAddColumn, onUpdateBoard }: KanbanProps) {
  const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
  const [selected, setSelected] = useState<{ card: PlanCard; col: PlanColumn } | null>(null);
  const [draftColId, setDraftColId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  const totalCards = board.columns.reduce((s, c) => s + c.cards.length, 0);
  const doneCards = board.columns.filter(c => c.title === 'Done')[0]?.cards.length ?? 0;

  const submitCard = (cid: string) => {
    if (draftTitle.trim()) onAddCard(board.id, cid, draftTitle.trim());
    setDraftColId(null); setDraftTitle('');
  };

  return (
    <div className="page-fade" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Board header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={onBack} className="btn btn-sm btn-sec">← Boards</button>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `oklch(0.92 0.06 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
          {area.glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{board.title}</div>
          {board.description && <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>{board.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {totalCards > 0 && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {doneCards}/{totalCards} done
            </span>
          )}
          <button
            className={`bdg ${board.shared ? 'bdg-ok' : 'bdg-gy'}`}
            style={{ cursor: 'pointer', border: 'none', fontSize: 11 }}
            onClick={() => onUpdateBoard(board.id, { shared: !board.shared })}
          >
            {board.shared ? '🔗 Shared' : '🔒 Private'}
          </button>
          <span className="bdg bdg-acc" style={{ fontSize: 11 }}>{area.label}</span>
        </div>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 16 }}>
        {board.columns.map(col => (
          <div key={col.id} style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px',
              borderRadius: 10, background: `oklch(0.95 0.03 ${col.color})`,
              border: `1.5px solid oklch(0.88 0.06 ${col.color})`,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: `oklch(0.62 0.12 ${col.color})`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: `oklch(0.35 0.12 ${col.color})` }}>{col.title}</span>
              <span style={{ fontSize: 11, color: `oklch(0.52 0.09 ${col.color})`, fontWeight: 600 }}>{col.cards.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 4 }}>
              {col.cards.map(card => {
                const overdue = isOverdue(card.dueDate);
                const chkDone = card.checklist.filter(i => i.done).length;
                return (
                  <div
                    key={card.id}
                    onClick={() => setSelected({ card, col })}
                    className="r-cd"
                    style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'stretch', padding: '12px 14px', cursor: 'pointer', borderRadius: 10 }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 7, lineHeight: 1.35 }}>{card.title}</div>
                    {(card.priority !== 'none' || card.tags.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                        {card.priority !== 'none' && (
                          <span className={`bdg ${PRIORITY_CFG[card.priority].badgeCls}`} style={{ fontSize: 9.5 }}>{PRIORITY_CFG[card.priority].label}</span>
                        )}
                        {card.tags.map(t => <span key={t} className="bdg bdg-acc" style={{ fontSize: 9.5 }}>{t}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {card.checklist.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                          ☑ {chkDone}/{card.checklist.length}
                        </span>
                      )}
                      {card.dueDate && (
                        <span style={{ fontSize: 11, color: overdue ? 'var(--err)' : 'var(--ink-4)', fontWeight: overdue ? 600 : 400 }}>
                          {overdue ? '⚠ ' : '📅 '}{fmtDate(card.dueDate)}
                        </span>
                      )}
                      {card.assignee && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
                          {card.assignee.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add card input */}
            {draftColId === col.id ? (
              <div style={{ background: 'white', border: '1.5px solid var(--accent-line)', borderRadius: 10, padding: '10px 12px', boxShadow: 'var(--sh-1)' }}>
                <textarea
                  autoFocus rows={2} value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCard(col.id); } if (e.key === 'Escape') { setDraftColId(null); setDraftTitle(''); } }}
                  placeholder="Card title… Enter to save, Esc to cancel"
                  style={{ width: '100%', fontSize: 13, border: 'none', outline: 'none', resize: 'none', color: 'var(--ink)', background: 'transparent', marginBottom: 8, lineHeight: 1.4 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => submitCard(col.id)} className="btn btn-sm btn-acc">Add card</button>
                  <button onClick={() => { setDraftColId(null); setDraftTitle(''); }} className="btn btn-sm btn-sec">✕</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setDraftColId(col.id); setDraftTitle(''); }}
                style={{ background: 'none', border: '1.5px dashed var(--line)', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', transition: 'all 0.12s', textAlign: 'left', width: '100%' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-line)'; e.currentTarget.style.color = 'var(--accent-ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-4)'; }}
              >
                + Add card
              </button>
            )}
          </div>
        ))}

        {/* Add column */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {addingCol ? (
            <div style={{ background: 'white', border: '1.5px solid var(--accent-line)', borderRadius: 10, padding: '12px' }}>
              <input
                autoFocus value={newColTitle} onChange={e => setNewColTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newColTitle.trim()) { onAddColumn(board.id, newColTitle.trim()); setNewColTitle(''); setAddingCol(false); } if (e.key === 'Escape') setAddingCol(false); }}
                placeholder="Column name…"
                style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, outline: 'none', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { if (newColTitle.trim()) { onAddColumn(board.id, newColTitle.trim()); setNewColTitle(''); setAddingCol(false); } }} className="btn btn-sm btn-acc">Add</button>
                <button onClick={() => setAddingCol(false)} className="btn btn-sm btn-sec">✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCol(true)}
              style={{ background: 'none', border: '1.5px dashed var(--line)', borderRadius: 9, padding: '10px 14px', fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', transition: 'all 0.12s', width: '100%' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-line)'; e.currentTarget.style.color = 'var(--accent-ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-4)'; }}
            >
              + Add column
            </button>
          )}
        </div>
      </div>

      {/* Card modal */}
      {selected && (
        <CardModal
          card={selected.card} col={selected.col} board={board}
          onClose={() => setSelected(null)}
          onUpdate={(bid, cid, kid, patch) => {
            onUpdateCard(bid, cid, kid, patch);
            setSelected(s => s ? { ...s, card: { ...s.card, ...patch } } : null);
          }}
          onMove={(bid, from, to, kid) => { onMoveCard(bid, from, to, kid); setSelected(null); }}
          onDelete={(bid, cid, kid) => { onDeleteCard(bid, cid, kid); setSelected(null); }}
        />
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */
export default function PlanningClient() {
  const [boards, setBoards] = useState<PlanBoard[]>(SEED);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', areaId: 'marketing', description: '' });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const activeBoard = boards.find(b => b.id === activeBoardId) ?? null;

  /* mutations */
  const mutBoard = (id: string, fn: (b: PlanBoard) => PlanBoard) =>
    setBoards(prev => prev.map(b => b.id === id ? fn(b) : b));

  const updateBoard = (id: string, patch: Partial<PlanBoard>) => mutBoard(id, b => ({ ...b, ...patch }));

  const addBoard = () => {
    if (!form.title.trim()) return;
    const b = makeBoard(form.title.trim(), form.areaId, form.description);
    setBoards(prev => [b, ...prev]);
    setActiveBoardId(b.id);
    setShowNew(false);
    setForm({ title: '', areaId: 'marketing', description: '' });
  };

  const deleteBoard = (id: string) => {
    if (!confirm('Delete this board and all its cards?')) return;
    setBoards(prev => prev.filter(b => b.id !== id));
    if (activeBoardId === id) setActiveBoardId(null);
  };

  const addCard = (bid: string, cid: string, title: string) =>
    mutBoard(bid, b => ({ ...b, columns: b.columns.map(c => c.id !== cid ? c : { ...c, cards: [...c.cards, { id: uid(), title, description: '', priority: 'none', dueDate: '', tags: [], checklist: [], assignee: '' }] }) }));

  const updateCard = (bid: string, cid: string, kid: string, patch: Partial<PlanCard>) =>
    mutBoard(bid, b => ({ ...b, columns: b.columns.map(c => c.id !== cid ? c : { ...c, cards: c.cards.map(k => k.id !== kid ? k : { ...k, ...patch }) }) }));

  const moveCard = (bid: string, from: string, to: string, kid: string) =>
    mutBoard(bid, b => {
      const card = b.columns.find(c => c.id === from)?.cards.find(k => k.id === kid);
      if (!card) return b;
      return { ...b, columns: b.columns.map(c => c.id === from ? { ...c, cards: c.cards.filter(k => k.id !== kid) } : c.id === to ? { ...c, cards: [...c.cards, card] } : c) };
    });

  const deleteCard = (bid: string, cid: string, kid: string) =>
    mutBoard(bid, b => ({ ...b, columns: b.columns.map(c => c.id !== cid ? c : { ...c, cards: c.cards.filter(k => k.id !== kid) }) }));

  const addColumn = (bid: string, title: string) => {
    const hues = ['220', '268', '75', '155', '25', '200', '340'];
    mutBoard(bid, b => ({ ...b, columns: [...b.columns, { id: uid(), title, color: hues[b.columns.length % hues.length], cards: [] }] }));
  };

  /* stats */
  const totalCards = boards.reduce((s, b) => s + b.columns.reduce((ss, c) => ss + c.cards.length, 0), 0);
  const sharedCount = boards.filter(b => b.shared).length;
  const overdueCount = boards.reduce((s, b) => s + b.columns.reduce((ss, c) => ss + c.cards.filter(k => isOverdue(k.dueDate)).length, 0), 0);
  const inProgCount = boards.reduce((s, b) => s + (b.columns.find(c => c.title === 'In Progress')?.cards.length ?? 0), 0);

  /* active board view */
  if (activeBoard) {
    return (
      <KanbanView
        board={activeBoard} onBack={() => setActiveBoardId(null)}
        onUpdateCard={updateCard} onMoveCard={moveCard}
        onDeleteCard={deleteCard} onAddCard={addCard}
        onAddColumn={addColumn} onUpdateBoard={updateBoard}
      />
    );
  }

  /* ── Boards overview ── */
  const usedAreaIds = [...new Set(boards.map(b => b.areaId))];
  const filtered = areaFilter === 'all' ? boards : boards.filter(b => b.areaId === areaFilter);

  return (
    <div className="page-fade">

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Boards', value: boards.length, foot: 'Planning workspaces', ico: 'ind', glyph: '◈' },
          { label: 'Total Cards', value: totalCards, foot: 'Across all boards', ico: 'ind', glyph: '☑' },
          { label: 'In Progress', value: inProgCount, foot: 'Active work items', ico: 'ok', glyph: '→' },
          { label: 'Overdue', value: overdueCount, foot: 'Past due date', ico: overdueCount > 0 ? 'er' : 'ind', glyph: '⚠' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h">
              <div className={`stat-ico ${s.ico}`}>{s.glyph}</div>
            </div>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v" style={s.label === 'Overdue' && overdueCount > 0 ? { color: 'var(--err)' } : {}}>{s.value}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs" style={{ flex: 1, flexWrap: 'wrap' }}>
          <button className={`tab${areaFilter === 'all' ? ' active' : ''}`} onClick={() => setAreaFilter('all')}>
            All <span style={{ fontSize: 10, opacity: 0.6 }}>({boards.length})</span>
          </button>
          {AREAS.filter(a => usedAreaIds.includes(a.id)).map(a => {
            const count = boards.filter(b => b.areaId === a.id).length;
            return (
              <button key={a.id} className={`tab${areaFilter === a.id ? ' active' : ''}`} onClick={() => setAreaFilter(a.id)}>
                {a.glyph} {a.label} <span style={{ fontSize: 10, opacity: 0.6 }}>({count})</span>
              </button>
            );
          })}
        </div>
        <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
      </div>

      {/* Board grid */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}>No boards yet</div>
          <div style={{ marginBottom: 20, color: 'var(--ink-4)' }}>Create your first planning board to get started.</div>
          <button className="btn btn-acc" onClick={() => setShowNew(true)}>+ New Board</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
          {filtered.map(board => {
            const area = AREAS.find(a => a.id === board.areaId) ?? AREAS[0];
            const total = board.columns.reduce((s, c) => s + c.cards.length, 0);
            const done = board.columns.find(c => c.title === 'Done')?.cards.length ?? 0;
            const inProg = board.columns.find(c => c.title === 'In Progress')?.cards.length ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const overdue = board.columns.reduce((s, c) => s + c.cards.filter(k => isOverdue(k.dueDate)).length, 0);
            return (
              <div
                key={board.id}
                onClick={() => setActiveBoardId(board.id)}
                style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 14, padding: '18px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--sh-1)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--sh-2)'; e.currentTarget.style.borderColor = `oklch(0.84 0.08 ${area.hue})`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--sh-1)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                {/* Accent top strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `oklch(0.65 0.12 ${area.hue})`, borderRadius: '14px 14px 0 0' }} />

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteBoard(board.id); }}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 5px', opacity: 0.5 }}
                >×</button>

                {/* Top row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, marginTop: 6 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(0.93 0.05 ${area.hue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
                    {area.glyph}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.008em', paddingRight: 20, lineHeight: 1.25 }}>{board.title}</div>
                    <div style={{ fontSize: 11, color: `oklch(0.55 0.10 ${area.hue})`, marginTop: 2, fontWeight: 500 }}>{area.label}</div>
                  </div>
                </div>

                {/* Description */}
                {board.description && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {board.description}
                  </div>
                )}

                {/* Column pills */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                  {board.columns.map(c => (
                    <span key={c.id} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: `oklch(0.95 0.03 ${c.color})`, color: `oklch(0.42 0.10 ${c.color})` }}>
                      {c.title} {c.cards.length > 0 && <span style={{ opacity: 0.7 }}>({c.cards.length})</span>}
                    </span>
                  ))}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>
                      <span>{done}/{total} done</span><span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `oklch(0.60 0.11 ${area.hue})`, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}

                {/* Footer badges */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {board.shared && <span className="bdg bdg-ok" style={{ fontSize: 10 }}>🔗 Shared</span>}
                  {inProg > 0 && <span className="bdg bdg-warn" style={{ fontSize: 10 }}>{inProg} in progress</span>}
                  {overdue > 0 && <span className="bdg bdg-err" style={{ fontSize: 10 }}>⚠ {overdue} overdue</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-5)' }}>
                    {board.columns.length} cols
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New board modal */}
      {showNew && mounted && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}
        >
          <div style={{ background: 'white', borderRadius: 16, width: 480, maxWidth: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', padding: '28px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>Create New Board</div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 22 }}>Boards keep your plans organised by area.</div>

            <div className="pv-fld">
              <label>Board title</label>
              <input
                autoFocus value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addBoard(); }}
                placeholder="e.g. Q3 Marketing Plan"
              />
            </div>
            <div className="pv-fld">
              <label>Area</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))}>
                {AREAS.map(a => <option key={a.id} value={a.id}>{a.glyph} {a.label}</option>)}
              </select>
            </div>
            <div className="pv-fld">
              <label>Description <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(optional)</span></label>
              <textarea rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this board for?"
              />
            </div>

            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Starts with 4 default columns</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {DEFAULT_COLS.map(c => (
                  <span key={c.title} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: `oklch(0.94 0.04 ${c.color})`, color: `oklch(0.38 0.11 ${c.color})` }}>{c.title}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addBoard} className="btn btn-acc" disabled={!form.title.trim()}>Create Board</button>
              <button onClick={() => { setShowNew(false); setForm({ title: '', areaId: 'marketing', description: '' }); }} className="btn btn-sec">Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
