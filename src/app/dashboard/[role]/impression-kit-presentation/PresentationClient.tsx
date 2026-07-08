'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Presentation content ────────────────────────────────────────────────────
// A single video file drives every step; drop it at /public/impression-walkthrough.mp4
const VIDEO_SRC = '/impression-walkthrough.mp4';
const VIDEO_FILE = 'impression-walkthrough.mp4';

type Slide =
  | {
      kind: 'step';
      step: number;
      eyebrow: string;
      title: string;
      subtitle: string;
      bullets: string[];
      videoLabel: string;
    }
  | {
      kind: 'timer';
      eyebrow: string;
      title: string;
      subtitle: string;
      videoLabel: string;
      seconds: number;
    };

const SLIDES: Slide[] = [
  {
    kind: 'step',
    step: 1,
    eyebrow: 'STEP 1 OF 5',
    title: 'Prepare your space',
    subtitle: 'A calm, well-lit spot makes this quick and clean.',
    bullets: [
      'Find a bright area near a mirror and wash your hands.',
      'Sit comfortably where you can clearly see your teeth.',
      'Have a flat surface ready for the kit — nothing else is needed.',
    ],
    videoLabel: 'Getting set up',
  },
  {
    kind: 'step',
    step: 2,
    eyebrow: 'STEP 2 OF 5',
    title: 'Meet your kit',
    subtitle: "Let's look at everything inside before we start.",
    bullets: [
      "You'll find two trays, a base putty, and a coloured catalyst.",
      'The two clays are what we mix — one is the base, one activates it.',
      'Lay the pieces out so everything is within easy reach.',
    ],
    videoLabel: "What's in the box",
  },
  {
    kind: 'step',
    step: 3,
    eyebrow: 'STEP 3 OF 5',
    title: 'Mix for 20 seconds',
    subtitle: 'The two colours only work when they blend evenly — and fast.',
    bullets: [
      'Take equal scoops of each putty and press them together.',
      'Fold and knead until the colour is completely uniform — no streaks.',
      'Work quickly — once mixed, you have a short window before it sets.',
    ],
    videoLabel: 'Mixing — getting started',
  },
  {
    kind: 'timer',
    eyebrow: 'TIMER',
    title: 'Keep mixing',
    subtitle: 'Fold the putty until the timer reaches zero.',
    videoLabel: 'Mixing — 20 second window',
    seconds: 20,
  },
  {
    kind: 'step',
    step: 4,
    eyebrow: 'STEP 4 OF 5',
    title: 'Load & seat the tray',
    subtitle: 'Work steadily — the putty stays soft for a couple of minutes.',
    bullets: [
      'Press the mixed putty evenly into the tray, filling it fully.',
      'Centre the tray over your teeth using the handle as a guide.',
      'Push up firmly and evenly so every tooth sinks into the putty.',
    ],
    videoLabel: 'Seating the tray',
  },
  {
    kind: 'step',
    step: 5,
    eyebrow: 'STEP 5 OF 5',
    title: 'Hold, then release',
    subtitle: 'Almost done — stillness now gives us a crisp impression.',
    bullets: [
      'Hold completely still for two to three minutes while it sets.',
      'When firm, remove the tray in one steady downward motion.',
      'Check for a clean, detailed imprint, then pack it for return.',
    ],
    videoLabel: 'Hold, then release',
  },
];

// ─── Video panel (placeholder that plays a real file when available) ─────────
// Remounted via `key` when the slide changes, so it always resets to the poster.
function VideoPanel({ label }: { label: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="ikp-video">
        <video className="ikp-video-el" src={VIDEO_SRC} controls autoPlay onEnded={() => setPlaying(false)} />
      </div>
    );
  }

  return (
    <button className="ikp-video ikp-video-ph" type="button" onClick={() => setPlaying(true)} aria-label="Play walkthrough video">
      <span className="ikp-video-badge">{label}</span>
      <span className="ikp-video-play">▶</span>
      <span className="ikp-video-file">VIDEO · {VIDEO_FILE}</span>
      <span className="ikp-video-bar">
        <span className="ikp-video-bar-fill" />
        <span className="ikp-video-mute">🔊</span>
      </span>
    </button>
  );
}

// ─── Countdown timer for the mixing step ─────────────────────────────────────
function MixTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => { if (idRef.current) { clearInterval(idRef.current); idRef.current = null; } };
  useEffect(() => clear, []);

  const start = () => {
    clear();
    setRemaining(seconds);
    setRunning(true);
    idRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clear(); setRunning(false); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const done = !running && remaining === 0;
  const pct = running || done ? ((seconds - remaining) / seconds) * 100 : 0;

  return (
    <div className="ikp-timer">
      <div className={`ikp-timer-ring${running ? ' running' : ''}${done ? ' done' : ''}`} style={{ ['--pct' as string]: `${pct}%` }}>
        <div className="ikp-timer-num">{remaining}</div>
        <div className="ikp-timer-unit">seconds</div>
      </div>
      <button className="ikp-timer-btn" type="button" onClick={start}>
        {running ? '● Counting…' : done ? '↺ Restart timer' : `▶  Start ${seconds}-second timer`}
      </button>
    </div>
  );
}

export default function PresentationClient() {
  const [presenting, setPresenting] = useState(false);
  const [index, setIndex] = useState(0);
  const wheelLock = useRef(0);

  const total = SLIDES.length;
  const go = useCallback((next: number) => {
    setIndex(prev => Math.max(0, Math.min(total - 1, next ?? prev)));
  }, [total]);

  const enter = () => { setIndex(0); setPresenting(true); };
  const exit = useCallback(() => setPresenting(false), []);

  // Lock background scroll while presenting
  useEffect(() => {
    if (!presenting) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [presenting]);

  // Keyboard navigation
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { exit(); return; }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        setIndex(prev => Math.min(total - 1, prev + 1));
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        setIndex(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, total, exit]);

  // Scroll navigation (one gesture = one step)
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 24) return;
    const now = Date.now();
    if (now - wheelLock.current < 650) return;
    wheelLock.current = now;
    setIndex(prev => Math.max(0, Math.min(total - 1, prev + (e.deltaY > 0 ? 1 : -1))));
  };

  const slide = SLIDES[index];

  return (
    <>
      {/* ── In-portal view ─────────────────────────────────────────────── */}
      <div className="ikp-page">
        <div className="ikp-toolbar">
          <button className="ikp-present-btn" type="button" onClick={enter}>
            <span>🖥</span> Present
          </button>
          <div className="ikp-toolbar-note">
            <span className="ikp-shield">🛡</span>
            Present mode hides the sidebar and every portal detail — safe to show a customer.
          </div>
        </div>

        <div className="ikp-hero">
          <div className="ikp-hero-text">
            <div className="ikp-hero-eyebrow">Customer-facing walkthrough</div>
            <h1 className="ikp-hero-title">Impression Kit Presentation</h1>
            <p className="ikp-hero-desc">
              A clean, five-step guide you present one-on-one to walk a customer through taking their own
              impressions — with a built-in 20-second mixing timer. Press <strong>Present</strong> to go full
              screen; the portal disappears entirely.
            </p>
          </div>
          <VideoPanel label="Walkthrough preview" />
        </div>

        <div className="ikp-steps-grid">
          {SLIDES.filter((s): s is Extract<Slide, { kind: 'step' }> => s.kind === 'step').map(s => (
            <div key={s.step} className="ikp-step-card">
              <div className="ikp-step-num">{s.step}</div>
              <div className="ikp-step-card-title">{s.title}</div>
              <div className="ikp-step-card-sub">{s.subtitle}</div>
              {s.step === 3 && <span className="ikp-step-tag">20s timer follows</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Full-screen present overlay ────────────────────────────────── */}
      {presenting && (
        <div className="ikp-present" onWheel={onWheel}>
          <header className="ikp-present-bar">
            <div className="ikp-present-brand">
              <span className="ikp-present-logo">PV</span>
              Impression Kit — Step-by-Step
            </div>

            <div className="ikp-dots">
              {SLIDES.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ikp-dot${i === index ? ' active' : ''}${i < index ? ' done' : ''}`}
                  onClick={() => go(i)}
                  aria-label={s.kind === 'timer' ? 'Timer' : `Step ${s.step}`}
                >
                  {s.kind === 'timer' ? '⏱' : s.step}
                </button>
              ))}
            </div>

            <button className="ikp-exit" type="button" onClick={exit}>✕ Exit</button>
          </header>

          <div className="ikp-present-body">
            <div className="ikp-present-video">
              <VideoPanel key={index} label={slide.videoLabel} />
            </div>

            <div className="ikp-present-content">
              <div className="ikp-content-inner">
                <div className="ikp-eyebrow">{slide.eyebrow}</div>
                <h2 className="ikp-slide-title">{slide.title}</h2>
                <p className="ikp-slide-sub">{slide.subtitle}</p>

                {slide.kind === 'step' ? (
                  <ol className="ikp-bullets">
                    {slide.bullets.map((b, i) => (
                      <li key={i} className="ikp-bullet">
                        <span className="ikp-bullet-num">{i + 1}</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <MixTimer seconds={slide.seconds} />
                )}
              </div>

              <div className="ikp-nav">
                <button
                  className="ikp-nav-btn"
                  type="button"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                >
                  ‹ Back
                </button>
                <div className="ikp-nav-label">
                  {slide.kind === 'timer' ? 'MIXING' : `STEP ${slide.step}`}
                </div>
                {index < total - 1 ? (
                  <button className="ikp-nav-btn primary" type="button" onClick={() => go(index + 1)}>
                    Next ›
                  </button>
                ) : (
                  <button className="ikp-nav-btn primary" type="button" onClick={exit}>
                    Finish ✓
                  </button>
                )}
              </div>
            </div>
          </div>

          <footer className="ikp-present-foot">
            Use the arrows, your ← → keys, or scroll to move between steps · Esc to exit
          </footer>
        </div>
      )}
    </>
  );
}
