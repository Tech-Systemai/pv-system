'use client';

import { useEffect, useState } from 'react';
import { checkDailyUpdateStatus, submitDailyUpdate } from '@/app/actions/dailyUpdate';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PROMPT_LABELS: Record<string, string> = {
  start:  'Start of Shift',
  midday: 'Mid-Shift Check-in',
  end:    'End of Shift',
};

const PROMPT_QUESTIONS: Record<string, string> = {
  start:  'What are you planning to work on today?',
  midday: 'What have you finished so far, and what will you be working on in the next hours?',
  end:    'What have you finished or accomplished today?',
};

type PromptKey = 'start' | 'midday' | 'end';
const PROMPT_ORDER: PromptKey[] = ['start', 'midday', 'end'];

function getLocalDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStartStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
}

export default function DailyUpdatePrompt({ userId }: { userId: string }) {
  const [activePrompt, setActivePrompt] = useState<PromptKey | null>(null);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [ready, setReady] = useState(false);

  const check = async () => {
    try {
      const now = new Date();
      const localDate = getLocalDateStr();
      const weekStart = getWeekStartStr();
      const dayName   = DAY_NAMES[now.getDay()];
      const nowMin    = now.getHours() * 60 + now.getMinutes();

      const { due, answered } = await checkDailyUpdateStatus(localDate, weekStart, dayName, nowMin);
      const answeredSet = new Set(answered);
      const pending = PROMPT_ORDER.find(p => due.includes(p) && !answeredSet.has(p)) ?? null;

      setActivePrompt(pending);
    } catch {
      // silently fail — don't block the UI
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async () => {
    if (!answer.trim() || !activePrompt || saving) return;
    setSaving(true);
    setSaveError('');
    const localDate = getLocalDateStr();
    const { error } = await submitDailyUpdate(userId, localDate, activePrompt, answer.trim());
    if (error) {
      setSaveError(error);
      setSaving(false);
      return;
    }
    setAnswer('');
    setSaving(false);
    setActivePrompt(null);
    await check();
  };

  if (!ready || !activePrompt) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface-1,#1a1f2e)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '32px', width: '100%', maxWidth: 520,
        boxShadow: '0 32px 96px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'oklch(0.65 0.2 250)',
          }}>
            Daily Update · {PROMPT_LABELS[activePrompt]}
          </span>
        </div>

        <p style={{
          fontSize: 16, fontWeight: 600, color: 'var(--ink-1,#e8eaf0)',
          margin: '14px 0 20px', lineHeight: 1.6,
        }}>
          {PROMPT_QUESTIONS[activePrompt]}
        </p>

        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Type your update here…"
          rows={5}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '12px 14px',
            color: 'var(--ink-1,#e8eaf0)', fontSize: 14, lineHeight: 1.6,
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
        />

        {saveError && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'oklch(0.65 0.22 25)', background: 'rgba(255,80,80,0.08)', borderRadius: 6, padding: '8px 12px' }}>
            {saveError}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4,rgba(255,255,255,0.3))' }}>
            This update is required and cannot be skipped.
          </span>
          <button
            onClick={handleSubmit}
            disabled={saving || !answer.trim()}
            style={{
              flexShrink: 0, padding: '10px 28px', borderRadius: 8, border: 'none',
              background: answer.trim() ? 'oklch(0.65 0.2 250)' : 'rgba(255,255,255,0.08)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: answer.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Submitting…' : 'Submit Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
