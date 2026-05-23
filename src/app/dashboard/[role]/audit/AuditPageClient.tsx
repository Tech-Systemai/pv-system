'use client';

import { useState } from 'react';
import DailyUpdatesClient from './DailyUpdatesClient';
import SystemChangesClient from './SystemChangesClient';

type View = 'updates' | 'changes';

export default function AuditPageClient({
  updates,
  activityLog,
}: {
  updates: any[];
  activityLog: any[];
}) {
  const [view, setView] = useState<View>('updates');

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Daily Updates & System Changes
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '6px 0 0' }}>
          Review staff shift check-ins and monitor all activity across every module.
        </p>
      </div>

      {/* Toggle buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => setView('updates')}
          style={{
            flex: 1, maxWidth: 300, padding: '16px 20px', borderRadius: 12,
            border: `2px solid ${view === 'updates' ? 'oklch(0.55 0.20 260)' : 'var(--line)'}`,
            background: view === 'updates' ? 'oklch(0.95 0.05 260)' : 'white',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: view === 'updates' ? 'oklch(0.36 0.20 260)' : 'var(--ink)',
          }}>
            Daily Updates Popup
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
            Staff shift check-ins — start, mid, and end of shift.
          </div>
        </button>

        <button
          onClick={() => setView('changes')}
          style={{
            flex: 1, maxWidth: 300, padding: '16px 20px', borderRadius: 12,
            border: `2px solid ${view === 'changes' ? 'oklch(0.55 0.20 155)' : 'var(--line)'}`,
            background: view === 'changes' ? 'oklch(0.95 0.05 155)' : 'white',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: view === 'changes' ? 'oklch(0.36 0.18 155)' : 'var(--ink)',
          }}>
            System Changes
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>
            Complete audit — every action, note, and change in the system.
          </div>
        </button>
      </div>

      {/* Content */}
      {view === 'updates'
        ? <DailyUpdatesClient initialUpdates={updates} />
        : <SystemChangesClient initialLog={activityLog} />
      }
    </div>
  );
}
