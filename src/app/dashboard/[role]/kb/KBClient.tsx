'use client';

import { useState, useRef, useEffect } from 'react';
import { dbOp } from '@/utils/db';

const DEFAULT_FOLDERS = [
  { name: 'Sales Playbook',       access: 'Sales + Mgmt',    icon: '📘', hue: 75  },
  { name: 'CX Procedures',        access: 'CX + Mgmt',       icon: '📗', hue: 145 },
  { name: 'Company Policies',     access: 'Everyone',        icon: '📋', hue: 268 },
  { name: 'Onboarding',           access: 'New hires',       icon: '🎯', hue: 200 },
  { name: 'Compliance & Legal',   access: 'Management Only', icon: '⚖',  hue: 25  },
  { name: 'Product Documentation',access: 'Everyone',        icon: '📚', hue: 155 },
];

const ACCESS_LEVELS = [
  'Everyone', 'Management Only', 'Sales + Mgmt', 'CX + Mgmt',
  'HR + Mgmt', 'Sales & CX + Mgmt', 'New hires',
];

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  text:  { label: 'TEXT',  bg: 'oklch(0.94 0.04 145)', color: 'oklch(0.35 0.14 145)' },
  video: { label: 'VIDEO', bg: 'oklch(0.94 0.04 268)', color: 'oklch(0.35 0.14 268)' },
  pdf:   { label: 'FILE',  bg: 'oklch(0.94 0.04 25)',  color: 'oklch(0.35 0.14 25)'  },
};

function buildFolderList(savedFolders: any[] | null, articles: any[]) {
  const base = savedFolders ?? DEFAULT_FOLDERS;
  const all = [...base];
  for (const a of articles) {
    if (a.folder && !all.find((f: any) => f.name === a.folder)) {
      all.push({ name: a.folder, access: 'Everyone', icon: '📁', hue: 200 });
    }
  }
  return all;
}

function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  if (url.includes('youtube.com/embed/')) return url;
  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(name: string): string {
  const ext = name?.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf')              return '📕';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  if (['ppt','pptx'].includes(ext)) return '📊';
  return '📄';
}

/* ── PDF inline viewer (blob URL avoids Chrome data: block) ─── */
function PdfEmbed({ dataUrl }: { dataUrl: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    const [, b64] = dataUrl.split(',');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [dataUrl]);
  if (!blobUrl) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16 }}>
      Loading PDF…
    </div>
  );
  return (
    <iframe src={blobUrl} title="PDF viewer"
      style={{ width: '100%', height: 640, border: 'none', borderRadius: 12, marginBottom: 16, display: 'block' }} />
  );
}

/* ── Inline file/video embed ─────────────────────────────────── */
function FileEmbed({ lesson }: { lesson: any }) {
  const { lesson_type, lesson_file, video_url, title } = lesson;

  if (lesson_type === 'video') {
    if (lesson_file?.dataUrl) {
      return (
        <video controls style={{ width: '100%', borderRadius: 12, marginBottom: 16 }}>
          <source src={lesson_file.dataUrl} type={lesson_file.type} />
        </video>
      );
    }
    if (video_url) {
      const embedUrl = getYouTubeEmbed(video_url);
      if (embedUrl) {
        return (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
            <iframe src={embedUrl} title={title} allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
          </div>
        );
      }
      return (
        <video controls style={{ width: '100%', borderRadius: 12, marginBottom: 16 }}>
          <source src={video_url} />
        </video>
      );
    }
    return (
      <div style={{ padding: '40px 20px', background: 'var(--surface-2)', borderRadius: 12, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, marginBottom: 16 }}>
        No video provided.
      </div>
    );
  }

  if (lesson_type === 'pdf' && lesson_file) {
    const mime = lesson_file.type || '';
    if (mime === 'application/pdf') {
      return <PdfEmbed dataUrl={lesson_file.dataUrl} />;
    }
    if (mime.startsWith('image/')) {
      return <img src={lesson_file.dataUrl} alt={lesson_file.name} style={{ width: '100%', borderRadius: 12, marginBottom: 16 }} />;
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'oklch(0.97 0.02 25)', border: '1px solid oklch(0.90 0.06 25)', borderRadius: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 36 }}>{getFileIcon(lesson_file.name)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{lesson_file.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{formatFileSize(lesson_file.size)}</div>
        </div>
        <a href={lesson_file.dataUrl} download={lesson_file.name}
          style={{ padding: '10px 20px', background: 'var(--accent)', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          ↓ Download
        </a>
      </div>
    );
  }

  return null;
}

export default function KBClient({
  initialArticles,
  userRole,
  currentUserId,
  savedFolders = null,
  initialProgress = [],
}: {
  initialArticles: any[];
  userRole: string;
  currentUserId: string;
  savedFolders?: any[] | null;
  initialProgress?: number[];
}) {
  const [articles, setArticles]         = useState(initialArticles);
  const [folders,  setFolders]          = useState(() => buildFolderList(savedFolders, initialArticles));
  const [completedIds, setCompletedIds] = useState<Set<number>>(() => new Set(initialProgress));
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showNew,      setShowNew]      = useState(false);
  const [showNewCourse,setShowNewCourse]= useState(false);
  const [editArticle,  setEditArticle]  = useState<any>(null);
  const [saving,       setSaving]       = useState(false);

  const [formFolder,     setFormFolder]     = useState('');
  const [formTitle,      setFormTitle]      = useState('');
  const [formContent,    setFormContent]    = useState('');
  const [formAccess,     setFormAccess]     = useState('Everyone');
  const [formType,       setFormType]       = useState<'text'|'video'|'pdf'>('text');
  const [formDuration,   setFormDuration]   = useState('');
  const [formVideoUrl,   setFormVideoUrl]   = useState('');
  const [formLessonFile, setFormLessonFile] = useState<any>(null);
  const [formOrderIndex, setFormOrderIndex] = useState(0);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const isMgmt  = ['owner', 'admin', 'supervisor'].includes(userRole);
  const isOwner = userRole === 'owner';

  /* ── Progress ───────────────────────────────────────────────── */
  const markComplete = async (id: number) => {
    await dbOp('kb_progress', 'insert', { user_id: currentUserId, article_id: id });
    setCompletedIds(prev => new Set([...prev, id]));
  };
  const markIncomplete = async (id: number) => {
    await dbOp('kb_progress', 'delete', undefined, { user_id: currentUserId, article_id: id });
    setCompletedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  /* ── CRUD helpers ───────────────────────────────────────────── */
  const openCreate = (defaultFolder?: string) => {
    const folder = defaultFolder ?? activeCourse ?? folders[0]?.name ?? '';
    setEditArticle(null);
    setFormFolder(folder);
    setFormTitle(''); setFormContent(''); setFormAccess('Everyone');
    setFormType('text'); setFormDuration(''); setFormVideoUrl('');
    setFormLessonFile(null);
    setFormOrderIndex(articles.filter(a => a.folder === folder).length);
    setShowNew(true);
  };

  const openEdit = (a: any) => {
    setEditArticle(a);
    setFormFolder(a.folder); setFormTitle(a.title); setFormContent(a.content ?? '');
    setFormAccess(a.access_level ?? 'Everyone'); setFormType(a.lesson_type ?? 'text');
    setFormDuration(a.duration ?? ''); setFormVideoUrl(a.video_url ?? '');
    setFormLessonFile(a.lesson_file ?? null); setFormOrderIndex(a.order_index ?? 0);
    setShowNew(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isVideo?: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxMB = isVideo ? 50 : 20;
    if (file.size > maxMB * 1024 * 1024) { alert(`Max file size is ${maxMB} MB`); return; }
    const reader = new FileReader();
    reader.onload = ev => setFormLessonFile({ name: file.name, type: file.type, size: file.size, dataUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    setSaving(true);
    const payload: any = {
      folder: formFolder, title: formTitle, content: formContent,
      access_level: formAccess, lesson_type: formType,
      duration: formDuration, order_index: formOrderIndex,
      video_url: formType === 'video' && !formLessonFile ? formVideoUrl : null,
      lesson_file: formLessonFile ?? null,
    };
    if (editArticle) {
      await dbOp('knowledge_base', 'update', payload, { id: editArticle.id });
      setArticles(prev => prev.map(a => a.id === editArticle.id ? { ...a, ...payload } : a));
      if (activeLesson?.id === editArticle.id) setActiveLesson((prev: any) => ({ ...prev, ...payload }));
    } else {
      const { data } = await dbOp('knowledge_base', 'insert', payload);
      if (data?.[0]) setArticles(prev => [...prev, data[0]]);
    }
    setSaving(false);
    setShowNew(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lesson?')) return;
    await dbOp('knowledge_base', 'delete', undefined, { id });
    setArticles(prev => prev.filter(a => a.id !== id));
    if (activeLesson?.id === id) setActiveLesson(null);
  };

  const handleDeleteFolder = async (folderName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const count = articles.filter(a => a.folder === folderName).length;
    const msg = count > 0
      ? `Delete "${folderName}" and its ${count} lesson${count !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete the folder "${folderName}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    const toDelete = articles.filter(a => a.folder === folderName);
    await Promise.all(toDelete.map(a => dbOp('knowledge_base', 'delete', undefined, { id: a.id })));
    const newFolders  = folders.filter((f: any) => f.name !== folderName);
    const newArticles = articles.filter(a => a.folder !== folderName);
    setFolders(newFolders);
    setArticles(newArticles);
    await dbOp('global_settings', 'upsert', { key: 'kb_folders', value: newFolders });
    if (activeCourse === folderName) setActiveCourse(null);
    if (activeLesson?.folder === folderName) setActiveLesson(null);
  };

  const handleCreateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name   = fd.get('name') as string;
    const access = fd.get('access') as string;
    const icon   = fd.get('icon') as string || '📁';
    if (name && !folders.find((f: any) => f.name === name)) {
      const nf = { name, access, icon, hue: Math.floor(Math.random() * 360) };
      const updated = [...folders, nf];
      setFolders(updated);
      await dbOp('global_settings', 'upsert', { key: 'kb_folders', value: updated });
    }
    setShowNewCourse(false);
  };

  /* ── LESSON VIEW ────────────────────────────────────────────── */
  if (activeLesson) {
    const done = completedIds.has(activeLesson.id);
    const tb   = TYPE_BADGE[activeLesson.lesson_type ?? 'text'];

    const courseLessons = articles
      .filter(a => a.folder === activeCourse)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const lessonIdx  = courseLessons.findIndex(l => l.id === activeLesson.id);
    const prevLesson = lessonIdx > 0 ? courseLessons[lessonIdx - 1] : null;
    const nextLesson = lessonIdx < courseLessons.length - 1 ? courseLessons[lessonIdx + 1] : null;

    return (
      <div className="page-fade">
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-sec btn-sm" onClick={() => setActiveLesson(null)}>← {activeCourse}</button>
          {isMgmt && <>
            <button className="btn btn-sec btn-sm" onClick={() => openEdit(activeLesson)}>⚙ Edit</button>
            <button className="btn btn-sm"
              style={{ background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }}
              onClick={() => handleDelete(activeLesson.id)}>Delete</button>
          </>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {done ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.45 0.15 145)', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Completed
                <button onClick={() => markIncomplete(activeLesson.id)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', textDecoration: 'underline' }}>Undo</button>
              </span>
            ) : (
              <button className="btn btn-acc" onClick={() => markComplete(activeLesson.id)}>✓ Mark Complete</button>
            )}
          </div>
        </div>

        {/* Lesson header */}
        <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: tb.bg, color: tb.color, padding: '3px 9px', borderRadius: 20 }}>{tb.label}</span>
              {activeLesson.duration && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{activeLesson.duration}</span>}
              {done && <span style={{ fontSize: 10, background: 'oklch(0.93 0.05 145)', color: 'oklch(0.35 0.14 145)', padding: '3px 9px', borderRadius: 20, fontWeight: 700 }}>✓ Done</span>}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'oklch(0.65 0.08 145)' }}>
              {activeLesson.title}
            </div>
          </div>

          <div style={{ padding: '22px 24px' }}>
            {/* Inline file/video embed */}
            <FileEmbed lesson={activeLesson} />

            {/* Text content */}
            {activeLesson.content && (
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                {activeLesson.content}
              </div>
            )}
            {!activeLesson.content && activeLesson.lesson_type === 'text' && (
              <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>No content added yet.</div>
            )}
          </div>
        </div>

        {/* Mark complete */}
        {!done && (
          <div style={{ textAlign: 'center', paddingBottom: 8 }}>
            <button className="btn btn-acc" style={{ padding: '12px 36px', fontSize: 15 }} onClick={() => markComplete(activeLesson.id)}>
              ✓ Mark as Complete
            </button>
          </div>
        )}

        {/* Prev / Next navigation */}
        {(prevLesson || nextLesson) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingBottom: 24 }}>
            {prevLesson ? (
              <button className="btn btn-sec" onClick={() => setActiveLesson(prevLesson)}
                style={{ maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ← {prevLesson.title}
              </button>
            ) : <div />}
            {nextLesson ? (
              <button className="btn btn-acc" onClick={() => setActiveLesson(nextLesson)}
                style={{ maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextLesson.title} →
              </button>
            ) : <div />}
          </div>
        )}

        {showNew && <LessonModal {...modalProps()} />}
      </div>
    );
  }

  /* ── COURSE VIEW ────────────────────────────────────────────── */
  if (activeCourse) {
    const folder  = folders.find((f: any) => f.name === activeCourse);
    const hue     = folder?.hue ?? 200;
    const icon    = folder?.icon ?? '📁';
    const lessons = articles
      .filter(a => a.folder === activeCourse)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    const completedCount = lessons.filter(l => completedIds.has(l.id)).length;
    const pct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    return (
      <div className="page-fade">
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-sec btn-sm" onClick={() => setActiveCourse(null)}>← Knowledge Base</button>
          {isMgmt && <button className="btn btn-acc btn-sm" onClick={() => openCreate(activeCourse)}>+ Add Lesson</button>}
          {isOwner && (
            <button className="btn btn-sm"
              style={{ marginLeft: 'auto', background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }}
              onClick={() => handleDeleteFolder(activeCourse)}>
              🗑 Delete Folder
            </button>
          )}
        </div>

        {/* Banner */}
        <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, background: `linear-gradient(135deg, oklch(0.42 0.18 ${hue}), oklch(0.28 0.20 ${hue + 30}))`, padding: '36px 32px 32px', position: 'relative', minHeight: 160 }}>
          <div style={{ position: 'absolute', top: 20, right: 28, fontSize: 80, opacity: 0.12, userSelect: 'none', lineHeight: 1 }}>{icon}</div>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 4 }}>{activeCourse}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
            {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
            {lessons.length > 0 && ` · ${completedCount} of ${lessons.length} complete`}
          </div>
        </div>

        {/* Progress */}
        {lessons.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>Your progress</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? 'oklch(0.45 0.15 145)' : 'var(--ink-3)' }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'oklch(0.55 0.16 145)' : `oklch(0.52 0.18 ${hue})`, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}

        {/* Lesson list */}
        {lessons.length === 0 ? (
          <div className="card">
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              No lessons yet.
              {isMgmt && <button className="btn btn-acc btn-sm" onClick={() => openCreate(activeCourse)} style={{ marginLeft: 10 }}>+ Add Lesson</button>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {lessons.map((lesson, i) => {
              const done = completedIds.has(lesson.id);
              const tb = TYPE_BADGE[lesson.lesson_type ?? 'text'];
              return (
                <div key={lesson.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < lessons.length - 1 ? '1px solid var(--line-2)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                  onClick={() => setActiveLesson(lesson)}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', border: `2px solid ${done ? 'oklch(0.55 0.16 145)' : 'var(--line)'}`, background: done ? 'oklch(0.93 0.05 145)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: done ? 14 : 16, color: done ? 'oklch(0.40 0.14 145)' : 'var(--ink-4)' }}>
                    {done ? '✓' : lesson.lesson_type === 'video' ? '▶' : lesson.lesson_type === 'pdf' ? '📄' : '📝'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--ink-4)' : 'var(--ink)', textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'oklch(0.65 0.08 145)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lesson.title}
                    </div>
                    {lesson.duration && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 2 }}>{lesson.duration}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: tb.bg, color: tb.color, padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>{tb.label}</span>
                  <button onClick={e => { e.stopPropagation(); setActiveLesson(lesson); }}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: done ? 'oklch(0.93 0.05 145)' : `oklch(0.50 0.20 ${hue})`, color: done ? 'oklch(0.35 0.14 145)' : 'white', flexShrink: 0 }}>
                    {done ? 'Review' : 'Start →'}
                  </button>
                  {isMgmt && (
                    <button onClick={e => { e.stopPropagation(); openEdit(lesson); }}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 13, padding: '4px 6px', opacity: 0.5, flexShrink: 0 }}>⚙</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showNew && <LessonModal {...modalProps()} />}
        {showNewCourse && <CourseModal onSubmit={handleCreateCourse} onClose={() => setShowNewCourse(false)} />}
      </div>
    );
  }

  /* ── OVERVIEW ───────────────────────────────────────────────── */
  const filteredArticles = searchQuery
    ? articles.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.folder?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const folderStats = folders.map((f: any) => ({
    ...f,
    count:     articles.filter(a => a.folder === f.name).length,
    completed: articles.filter(a => a.folder === f.name && completedIds.has(a.id)).length,
  }));

  function modalProps() {
    return {
      editArticle, formFolder, formTitle, formContent, formAccess,
      formType, formDuration, formVideoUrl, formLessonFile, formOrderIndex,
      folders, saving, fileInputRef, videoInputRef,
      setFormFolder, setFormTitle, setFormContent, setFormAccess,
      setFormType, setFormDuration, setFormVideoUrl, setFormLessonFile, setFormOrderIndex,
      handleFileSelect, handleSave,
      onDelete: editArticle ? () => { handleDelete(editArticle.id); setShowNew(false); } : undefined,
      onClose: () => setShowNew(false),
      isMgmt,
    };
  }

  return (
    <div className="page-fade">
      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { l: 'TOTAL LESSONS', v: articles.length,     f: 'Across all courses', g: '📚', i: 'ind' },
          { l: 'COURSES',       v: folders.length,      f: 'Knowledge tracks',   g: '📁', i: 'acc' },
          { l: 'COMPLETED',     v: completedIds.size,   f: 'By you',             g: '✓',  i: 'ok'  },
          { l: 'MGMT ONLY',     v: articles.filter(a => ['Mgmt only','Management Only'].includes(a.access_level ?? '')).length, f: 'Restricted', g: '🔒', i: 'wn' },
        ].map(s => (
          <div key={s.l} className="stat-card" style={{ cursor: 'default' }}>
            <div className="stat-h"><div className={`stat-ico ${s.i}`}>{s.g}</div></div>
            <div className="stat-l">{s.l}</div>
            <div className="stat-v">{s.v}</div>
            <div className="stat-foot">{s.f}</div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input type="text" placeholder="Search lessons…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="fld-input" style={{ flex: 1, height: 38 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {isMgmt && <button className="btn btn-acc btn-sm" onClick={() => openCreate()}>+ New Lesson</button>}
            {isOwner && <button className="btn btn-sec btn-sm" onClick={() => setShowNewCourse(true)}>+ New Course</button>}
          </div>
        </div>
        {searchQuery && filteredArticles.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '8px 18px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 8 }}>{filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''}</div>
            {filteredArticles.map(a => {
              const tb = TYPE_BADGE[a.lesson_type ?? 'text'];
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}
                  onClick={() => { setActiveCourse(a.folder); setActiveLesson(a); }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: tb.bg, color: tb.color, padding: '2px 7px', borderRadius: 10 }}>{tb.label}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{a.folder}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Course cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {folderStats.map((f: any) => {
          const pct = f.count > 0 ? Math.round((f.completed / f.count) * 100) : 0;
          return (
            <div key={f.name} onClick={() => setActiveCourse(f.name)}
              style={{ background: 'white', border: '1.5px solid var(--line)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform .12s, box-shadow .12s, border-color .12s', boxShadow: 'var(--sh-1)', position: 'relative' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-2)'; (e.currentTarget as HTMLDivElement).style.borderColor = `oklch(0.82 0.08 ${f.hue})`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--sh-1)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--line)'; }}
            >
              {isOwner && (
                <button onClick={e => handleDeleteFolder(f.name, e)}
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.35)', color: 'white', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                  title="Delete folder">✕</button>
              )}
              <div style={{ height: 88, background: `linear-gradient(135deg, oklch(0.42 0.18 ${f.hue}), oklch(0.28 0.20 ${f.hue + 30}))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
                {f.icon}
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{f.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: f.count > 0 ? 10 : 0 }}>
                  {f.count} lesson{f.count !== 1 ? 's' : ''} · {f.access}
                </div>
                {f.count > 0 && (
                  <>
                    <div style={{ height: 5, background: 'var(--line)', borderRadius: 3, marginBottom: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'oklch(0.55 0.16 145)' : `oklch(0.52 0.18 ${f.hue})`, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: pct === 100 ? 'oklch(0.45 0.15 145)' : 'var(--ink-5)', fontWeight: 600 }}>
                      {pct === 100 ? '✓ All complete' : `${f.completed}/${f.count} done`}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <LessonModal {...modalProps()} />}
      {showNewCourse && <CourseModal onSubmit={handleCreateCourse} onClose={() => setShowNewCourse(false)} />}
    </div>
  );
}

/* ── Lesson modal (create / edit) ────────────────────────────── */
function LessonModal({
  editArticle, formFolder, formTitle, formContent, formAccess,
  formType, formDuration, formVideoUrl, formLessonFile, formOrderIndex,
  folders, saving, fileInputRef, videoInputRef,
  setFormFolder, setFormTitle, setFormContent, setFormAccess,
  setFormType, setFormDuration, setFormVideoUrl, setFormLessonFile, setFormOrderIndex,
  handleFileSelect, handleSave, onDelete, onClose, isMgmt,
}: any) {
  return (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="md-t">{editArticle ? 'Edit Lesson' : 'New Lesson'}</div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
          style={{ display: 'none' }} onChange={e => handleFileSelect(e, false)} />
        <input ref={videoInputRef} type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
          style={{ display: 'none' }} onChange={e => handleFileSelect(e, true)} />

        <div className="pv-fld">
          <label>Course</label>
          <select value={formFolder} onChange={e => setFormFolder(e.target.value)}>
            {folders.map((f: any) => <option key={f.name} value={f.name}>{f.icon} {f.name}</option>)}
          </select>
        </div>
        <div className="pv-fld">
          <label>Title</label>
          <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Lesson title…" autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
          <div className="pv-fld">
            <label>Type</label>
            <select value={formType} onChange={e => { setFormType(e.target.value as any); setFormLessonFile(null); }}>
              <option value="text">📝 TEXT</option>
              <option value="video">▶ VIDEO</option>
              <option value="pdf">📄 FILE</option>
            </select>
          </div>
          <div className="pv-fld">
            <label>Duration</label>
            <input value={formDuration} onChange={e => setFormDuration(e.target.value)} placeholder="e.g. 5 min" />
          </div>
          <div className="pv-fld">
            <label>Order</label>
            <input type="number" value={formOrderIndex} onChange={e => setFormOrderIndex(Number(e.target.value))} min={0} />
          </div>
        </div>

        {formType === 'video' && (
          <>
            <div className="pv-fld">
              <label>YouTube / Direct URL</label>
              <input value={formVideoUrl} onChange={e => setFormVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                disabled={!!formLessonFile} style={{ opacity: formLessonFile ? 0.45 : 1 }} />
            </div>
            <div className="pv-fld">
              <label>— or upload a video file (max 50 MB) —</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" className="btn btn-sec btn-sm" onClick={() => videoInputRef.current?.click()}>
                  📎 {formLessonFile ? 'Change video file' : 'Upload video file'}
                </button>
                {formLessonFile && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {formLessonFile.name}
                    <button onClick={() => setFormLessonFile(null)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {formType === 'pdf' && (
          <div className="pv-fld">
            <label>File (PDF, Word, Excel, PowerPoint, Image…)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn btn-sec btn-sm" onClick={() => fileInputRef.current?.click()}>
                📎 {formLessonFile ? 'Change file' : 'Upload file'}
              </button>
              {formLessonFile && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {formLessonFile.name}
                  <button onClick={() => setFormLessonFile(null)} style={{ background: 'none', border: 'none', color: 'var(--err)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="pv-fld">
          <label>{formType === 'video' ? 'Description' : formType === 'pdf' ? 'Description (optional)' : 'Content'}</label>
          <textarea rows={7} value={formContent} onChange={e => setFormContent(e.target.value)}
            placeholder={formType === 'video' ? 'What will viewers learn?' : formType === 'pdf' ? 'Brief description of the document…' : 'Write the lesson content…'}
            style={{ resize: 'vertical' }} />
        </div>

        <div className="pv-fld">
          <label>Visibility</label>
          <select value={formAccess} onChange={e => setFormAccess(e.target.value)}>
            {ACCESS_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-acc" onClick={handleSave} disabled={saving || !formTitle.trim()}>
            {saving ? 'Saving…' : editArticle ? 'Update Lesson' : 'Add Lesson'}
          </button>
          <button className="btn btn-sec" onClick={onClose}>Cancel</button>
          {editArticle && isMgmt && onDelete && (
            <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'oklch(0.97 0.03 25)', color: 'var(--err)', border: '1px solid oklch(0.90 0.06 25)' }}
              onClick={() => { if (confirm('Delete this lesson?')) onDelete(); }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── New Course modal ────────────────────────────────────────── */
function CourseModal({ onSubmit, onClose }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return (
    <div className="mb" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="md" style={{ width: 420 }}>
        <div className="md-t">New Course</div>
        <form onSubmit={onSubmit}>
          <div className="pv-fld"><label>Course Name</label><input type="text" name="name" required placeholder="e.g. Leadership Training" autoFocus /></div>
          <div className="pv-fld"><label>Icon (emoji)</label><input type="text" name="icon" placeholder="📁" maxLength={4} defaultValue="📁" /></div>
          <div className="pv-fld">
            <label>Access Level</label>
            <select name="access">
              {ACCESS_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-acc">Create Course</button>
            <button type="button" className="btn btn-sec" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
