'use client';

import { useState } from 'react';
import { dbOp } from '@/utils/db';

type SubTab = 'candidates' | 'modules' | 'results';

const VERDICT_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  strong_hire: { label: 'Strong Hire', bg: 'var(--ok-soft)', color: 'oklch(0.42 0.12 155)' },
  hire:        { label: 'Hire',        bg: 'var(--ok-soft)', color: 'oklch(0.45 0.12 155)' },
  borderline:  { label: 'Borderline',  bg: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)' },
  no_hire:     { label: 'No Hire',     bg: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:     { bg: 'var(--surface-2)', color: 'var(--ink-3)' },
  in_progress: { bg: 'var(--warn-soft)', color: 'oklch(0.45 0.12 75)' },
  completed:   { bg: 'var(--ok-soft)', color: 'oklch(0.42 0.12 155)' },
  expired:     { bg: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' },
  revoked:     { bg: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' },
};

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function InterviewerPanel({
  initialModules,
  initialInvites,
  siteUrl,
}: {
  initialModules: any[];
  initialInvites: any[];
  siteUrl: string;
}) {
  const [sub, setSub] = useState<SubTab>('candidates');
  const [modules, setModules] = useState(initialModules);
  const [invites, setInvites] = useState(initialInvites);
  const [editModule, setEditModule] = useState<any>(null);
  const [isNewModule, setIsNewModule] = useState(false);
  const [isNewInvite, setIsNewInvite] = useState(false);
  const [linkType, setLinkType] = useState<'open' | 'personal'>('open');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [openResult, setOpenResult] = useState('');
  const [transcripts, setTranscripts] = useState<Record<string, any[]>>({});
  const [err, setErr] = useState('');

  const base = siteUrl.replace(/\/$/, '');
  const linkFor = (token: string) => `${base}/i/${token}`;

  // ── Modules ──
  const saveModule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const fd = new FormData(e.currentTarget);
    const row = {
      title: fd.get('title') as string,
      content: fd.get('content') as string,
      order_index: Number(fd.get('order_index') || 0),
      is_active: fd.get('is_active') === 'on',
    };
    if (isNewModule) {
      const { data, error } = await dbOp('interview_modules', 'insert', row);
      if (error) setErr(error);
      else if (data?.[0]) setModules(prev => [...prev, data[0]].sort((a, b) => a.order_index - b.order_index));
    } else {
      const { error } = await dbOp('interview_modules', 'update', row, { id: editModule.id });
      if (error) setErr(error);
      else setModules(prev => prev.map(m => (m.id === editModule.id ? { ...m, ...row } : m)).sort((a, b) => a.order_index - b.order_index));
    }
    setBusy(false);
    if (!err) { setEditModule(null); setIsNewModule(false); }
  };

  const deleteModule = async (m: any) => {
    if (!confirm(`Delete module "${m.title}"?`)) return;
    await dbOp('interview_modules', 'delete', {}, { id: m.id });
    setModules(prev => prev.filter(x => x.id !== m.id));
  };

  // ── Invites ──
  const createInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const fd = new FormData(e.currentTarget);
    const expiresDays = Number(fd.get('expires_days') || 0);
    const row: Record<string, any> = {
      token: makeToken(),
      candidate_name: fd.get('name') as string,
      candidate_email: (fd.get('email') as string) || '',
      difficulty: fd.get('difficulty') as string,
      status: 'pending',
      is_open: linkType === 'open',
    };
    if (expiresDays > 0) row.expires_at = new Date(Date.now() + expiresDays * 86400000).toISOString();
    const { data, error } = await dbOp('interview_invites', 'insert', row);
    if (error) setErr(error);
    else if (data?.[0]) {
      setInvites(prev => [{ ...data[0], interview_sessions: null }, ...prev]);
      setIsNewInvite(false);
      copyLink(data[0].token);
    }
    setBusy(false);
  };

  const revokeInvite = async (inv: any) => {
    if (!confirm(`Revoke the interview link for ${inv.candidate_name}?`)) return;
    await dbOp('interview_invites', 'update', { status: 'revoked' }, { id: inv.id });
    setInvites(prev => prev.map(i => (i.id === inv.id ? { ...i, status: 'revoked' } : i)));
  };

  const deleteInvite = async (inv: any) => {
    const children = invites.filter(x => x.parent_id === inv.id);
    const msg = inv.is_open
      ? `Delete the open link "${inv.candidate_name}"${children.length ? ` AND its ${children.length} candidate(s), including their results and recordings` : ''}? This cannot be undone.`
      : `Permanently delete ${inv.candidate_name} — including their interview, scorecard, and recording? This cannot be undone.`;
    if (!confirm(msg)) return;
    // Remove recording files first (rows cascade on invite delete, files don't).
    for (const target of [inv, ...children]) {
      const s = sessionOf(target);
      if (s?.recording_path) {
        try { await fetch(`/api/interview-recording?session_id=${s.id}`, { method: 'DELETE' }); } catch {}
      }
    }
    const { error } = await dbOp('interview_invites', 'delete', {}, { id: inv.id });
    if (error) { setErr(error); return; }
    const gone = new Set([inv.id, ...children.map(c => c.id)]);
    setInvites(prev => prev.filter(i => !gone.has(i.id)));
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(linkFor(token)).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(''), 1800);
    });
  };

  // ── Results ──
  const sessionOf = (inv: any) => (Array.isArray(inv.interview_sessions) ? inv.interview_sessions[0] : inv.interview_sessions);
  const scorecardOf = (inv: any) => {
    const s = sessionOf(inv);
    if (!s) return null;
    return Array.isArray(s.interview_scorecards) ? s.interview_scorecards[0] : s.interview_scorecards;
  };
  const results = invites.filter(i => scorecardOf(i));

  const toggleTranscript = async (inv: any) => {
    const s = sessionOf(inv);
    if (!s) return;
    if (openResult === inv.id) return setOpenResult('');
    setOpenResult(inv.id);
    if (!transcripts[inv.id]) {
      const { data } = await dbOp('interview_messages', 'select', undefined, { session_id: s.id });
      setTranscripts(prev => ({ ...prev, [inv.id]: data || [] }));
    }
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['candidates', `Candidates (${invites.length})`], ['modules', `Training Material (${modules.length})`], ['results', `Results (${results.length})`]] as const).map(([id, label]) => (
          <button key={id} className={sub === id ? 'btn btn-acc btn-sm' : 'btn btn-sec btn-sm'} onClick={() => setSub(id)}>
            {label}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>
          {err.includes('not allowed') || err.includes('does not exist') || err.includes('schema')
            ? 'Interview tables missing or outdated — run supabase/schema_v82_ai_interviewer.sql and schema_v83_open_invites.sql in the Supabase SQL Editor.'
            : err}
        </div>
      )}

      {/* ── CANDIDATES ── */}
      {sub === 'candidates' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Interview Invites</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                Each candidate gets a one-time link to study the material and take the AI mock sales call.
              </div>
            </div>
            <button className="btn btn-acc btn-sm" onClick={() => { setErr(''); setIsNewInvite(true); }}>+ New Link</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Candidate</th><th>Difficulty</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {invites.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: 24 }}>No invites yet — create one to interview your first candidate.</td></tr>
                )}
                {invites.map(inv => {
                  const st = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
                  const uses = inv.is_open ? invites.filter(x => x.parent_id === inv.id).length : 0;
                  return (
                    <tr key={inv.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {inv.is_open && <span style={{ marginRight: 5 }}>🔗</span>}
                          {inv.candidate_name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                          {inv.is_open ? `Open link · ${uses} candidate${uses === 1 ? '' : 's'} joined` : inv.candidate_email}
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--ink-2)' }}>{inv.difficulty}</td>
                      <td>
                        {inv.is_open ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
                            {['expired', 'revoked'].includes(inv.status) ? inv.status : 'open to all'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: st.bg, color: st.color, textTransform: 'capitalize' }}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['pending', 'in_progress'].includes(inv.status) && (
                            <>
                              <button className="btn btn-sec btn-sm" onClick={() => copyLink(inv.token)}>
                                {copied === inv.token ? '✓ Copied' : 'Copy link'}
                              </button>
                              <button className="btn btn-sm" style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' }} onClick={() => revokeInvite(inv)}>
                                Revoke
                              </button>
                            </>
                          )}
                          {scorecardOf(inv) && (
                            <button className="btn btn-sec btn-sm" onClick={() => { setSub('results'); setOpenResult(''); }}>View result</button>
                          )}
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' }}
                            onClick={() => deleteInvite(inv)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODULES ── */}
      {sub === 'modules' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 560 }}>
              Candidates study these modules before the mock call, and the AI customer uses them to judge whether the rep&apos;s claims are accurate. Keep them factual: what snap-on veneers are, pricing, common objections and answers.
            </div>
            <button className="btn btn-acc btn-sm" onClick={() => { setErr(''); setIsNewModule(true); setEditModule({ title: '', content: '', order_index: modules.length + 1, is_active: true }); }}>
              + Add Module
            </button>
          </div>
          {modules.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--ink-4)', padding: 30 }}>
              No training material yet. Add your first module (e.g. “What are snap-on veneers?”).
            </div>
          )}
          {modules.map(m => (
            <div className="card" key={m.id} style={{ marginBottom: 10, opacity: m.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {m.order_index}. {m.title} {!m.is_active && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>(hidden)</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 66, overflow: 'hidden' }}>
                    {m.content.slice(0, 220)}{m.content.length > 220 ? '…' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sec btn-sm" onClick={() => { setErr(''); setIsNewModule(false); setEditModule(m); }}>Edit</button>
                  <button className="btn btn-sm" style={{ background: 'var(--err-soft)', color: 'oklch(0.45 0.16 25)' }} onClick={() => deleteModule(m)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RESULTS ── */}
      {sub === 'results' && (
        <div>
          {results.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--ink-4)', padding: 30 }}>
              No completed interviews yet. Scorecards appear here automatically once a candidate finishes their mock call.
            </div>
          )}
          {results.map(inv => {
            const sc = scorecardOf(inv);
            const s = sessionOf(inv);
            const v = VERDICT_STYLE[sc.verdict] || VERDICT_STYLE.borderline;
            const dims: [string, number][] = [
              ['Product knowledge', sc.product_knowledge],
              ['Objection handling', sc.objection_handling],
              ['Rapport & tone', sc.rapport],
              ['Closing', sc.closing],
            ];
            return (
              <div className="card" key={inv.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{inv.candidate_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                      {inv.candidate_email} · {inv.difficulty} difficulty · {s?.turn_count ?? 0} turns · {s?.ended_at ? new Date(s.ended_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: v.bg, color: v.color }}>{v.label}</span>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{sc.overall}<span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>/100</span></div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, margin: '14px 0' }}>
                  {dims.map(([label, val]) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 4 }}>
                        <span>{label}</span><span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{val}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${val}%`, borderRadius: 4, background: val >= 70 ? 'var(--ok)' : val >= 45 ? 'oklch(0.70 0.13 75)' : 'var(--err)' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {sc.summary && (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', background: 'var(--surface-2)', padding: '10px 12px', borderRadius: 8, marginBottom: 10 }}>
                    {sc.summary}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'oklch(0.42 0.12 155)', textTransform: 'uppercase', marginBottom: 4 }}>Strengths</div>
                    {(sc.strengths || []).map((x: string, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 3 }}>• {x}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'oklch(0.45 0.16 25)', textTransform: 'uppercase', marginBottom: 4 }}>Weaknesses</div>
                    {(sc.weaknesses || []).map((x: string, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 3 }}>• {x}</div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sec btn-sm" onClick={() => toggleTranscript(inv)}>
                    {openResult === inv.id ? 'Hide transcript' : 'View transcript'}
                  </button>
                  {s?.recording_path && (
                    <a
                      className="btn btn-sec btn-sm"
                      href={`/api/interview-recording?session_id=${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🎥 Watch recording
                    </a>
                  )}
                </div>
                {openResult === inv.id && (
                  <div style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
                    {!transcripts[inv.id] && <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>Loading…</div>}
                    {(transcripts[inv.id] || []).map((m: any, i: number) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.role === 'candidate' ? 'var(--accent-ink)' : 'var(--ink-3)' }}>
                          {m.role === 'candidate' ? 'CANDIDATE' : 'AI CUSTOMER'}:
                        </span>{' '}
                        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{m.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Module editor modal ── */}
      {editModule && (
        <div className="mb">
          <div className="md" style={{ width: 560 }}>
            <div className="md-t">{isNewModule ? 'Add Training Module' : 'Edit Training Module'}</div>
            <form onSubmit={saveModule}>
              <div className="pv-fld"><label>Title</label><input type="text" name="title" defaultValue={editModule.title} required /></div>
              <div className="pv-fld">
                <label>Content</label>
                <textarea name="content" rows={10} defaultValue={editModule.content} required placeholder="e.g. Snap-on veneers are removable dental veneers that clip over your natural teeth…" />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="pv-fld" style={{ flex: 1 }}><label>Order</label><input type="number" name="order_index" defaultValue={editModule.order_index} min={0} /></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 10 }}>
                  <input type="checkbox" name="is_active" defaultChecked={editModule.is_active} /> Visible to candidates
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button type="submit" className="btn btn-acc" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-sec" onClick={() => { setEditModule(null); setIsNewModule(false); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New invite modal ── */}
      {isNewInvite && (
        <div className="mb">
          <div className="md" style={{ width: 440 }}>
            <div className="md-t">New Interview Link</div>
            <form onSubmit={createInvite}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {([['open', '🔗 Generic link', 'One link for everyone — candidates enter their own name & email'], ['personal', '👤 Personal invite', 'A one-time link for a specific candidate']] as const).map(([id, label, desc]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLinkType(id)}
                    style={{
                      flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 9,
                      border: linkType === id ? '2px solid var(--accent)' : '1px solid var(--line)',
                      background: linkType === id ? 'var(--accent-soft)' : 'var(--surface)',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>
                  </button>
                ))}
              </div>
              {linkType === 'open' ? (
                <div className="pv-fld"><label>Link Label (for your own tracking)</label><input type="text" name="name" required placeholder="e.g. Sales Hiring — July 2026" /></div>
              ) : (
                <>
                  <div className="pv-fld"><label>Candidate Name</label><input type="text" name="name" required /></div>
                  <div className="pv-fld"><label>Email (optional)</label><input type="email" name="email" /></div>
                </>
              )}
              <div className="pv-fld">
                <label>Customer Difficulty</label>
                <select name="difficulty" defaultValue="medium">
                  <option value="easy">Easy — friendly customer</option>
                  <option value="medium">Medium — cautious customer</option>
                  <option value="hard">Hard — skeptical customer</option>
                </select>
              </div>
              <div className="pv-fld">
                <label>Expires after (days, 0 = never)</label>
                <input type="number" name="expires_days" defaultValue={linkType === 'open' ? 0 : 7} min={0} key={linkType} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
                {linkType === 'open'
                  ? 'The link is copied to your clipboard — post it in your job ad or send it to all applicants. Each candidate registers with their name and email, and their result shows up here individually.'
                  : 'The interview link is copied to your clipboard when you create the invite — send it to the candidate however you like.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-acc" disabled={busy}>{busy ? 'Creating…' : 'Create & Copy Link'}</button>
                <button type="button" className="btn btn-sec" onClick={() => setIsNewInvite(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
