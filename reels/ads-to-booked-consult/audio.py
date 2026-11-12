"""Builds the reel soundtrack: Kokoro voiceover ("Eric" = am_eric, speed 1.05) placed on its
timing slots, an original synthesized music bed ducked under the voice, mixed to -14 LUFS.

  pip install kokoro-onnx soundfile pyloudnorm
  KOKORO_DIR=<folder with kokoro-v1.0.onnx + voices-v1.0.bin> python3 audio.py
Writes mix.wav next to this file (plus vo.wav / music.wav stems in WORK).
"""
import os, subprocess, numpy as np, soundfile as sf, pyloudnorm as pyln

HERE = os.path.dirname(os.path.abspath(__file__))
KD = os.environ.get("KOKORO_DIR", ".")
WORK = os.environ.get("WORK", KD)
SR, DUR = 48000, 22.0
N = int(SR * DUR)
# (slot start, text) — starts match the caption slots in index.html
VO = [(0.20, "Most agencies hand you a lead and walk away."), (3.70, "We don't."), (5.90, "We run the ads."),
      (7.40, "We text the homeowner fast."), (9.30, "We book the consult on your calendar."), (12.90, "You just show up."),
      (15.70, "Florida kitchen and bath remodelers,"), (18.45, "DM us.")]

# ---------------- voiceover ----------------
def build_vo():
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(KD, "kokoro-v1.0.onnx"), os.path.join(KD, "voices-v1.0.bin"))
    out = np.zeros(N, np.float32)
    for i, (a, text) in enumerate(VO):
        au, sr = k.create(text, voice="am_eric", speed=1.05, lang="en-us")
        idx = np.where(np.abs(au) > 0.01)[0]
        au = au[max(0, idx[0] - int(.01 * sr)): idx[-1] + int(.04 * sr)]
        x = np.interp(np.arange(0, len(au), sr / SR), np.arange(len(au)), au).astype(np.float32)  # 24k -> 48k
        nxt = VO[i + 1][0] if i + 1 < len(VO) else DUR
        assert a + len(x) / SR < nxt, f"line {i} overruns its slot"
        s = int(a * SR); out[s:s + len(x)] += x
    return out

# ---------------- music bed ----------------
rng = np.random.default_rng(7)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(buf, t0, x):
    s = int(t0 * SR)
    if s >= N: return
    x = x[:N - s]; buf[s:s + len(x)] += x
def tt(d): return np.arange(int(d * SR)) / SR
def kick(g=1.0):
    t = tt(.45); f = 44 + 120 * np.exp(-t * 28)
    return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
def hat(g=.1, d=60):
    t = tt(.12); n = rng.standard_normal(len(t)); n = np.diff(n, prepend=0); n = np.diff(n, prepend=0)
    return g * .5 * n * np.exp(-t * d)
def clap(g=.3):
    t = tt(.25); n = rng.standard_normal(len(t)); n = np.diff(n, prepend=0)
    return g * n * np.exp(-t * 22) * (1 + .6 * np.sin(2 * np.pi * 45 * t))
def tone(m, d, g, decay=None, att=.005, harm=(1, .0, .0)):
    t = tt(d); f = hz(m)
    x = sum(h * np.sin(2 * np.pi * f * (i + 1) * t) for i, h in enumerate(harm))
    env = np.minimum(1, t / att) * (np.exp(-t * decay) if decay else np.minimum(1, (d - t) / .4))
    return g * x * env
def boom(g=.9):
    t = tt(2.2); n = np.cumsum(rng.standard_normal(len(t))); n -= np.linspace(n[0], n[-1], len(n)); n /= np.abs(n).max()
    return g * (np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2) + .25 * n * np.exp(-t * 5))

def build_music():
    L = np.zeros(N); R = np.zeros(N)
    def both(t0, x, pan=0.0): add(L, t0, x * (1 - max(0, pan))); add(R, t0, x * (1 + min(0, pan)))
    beat = .5
    def drums(t, clapit=False):
        both(t, kick(.8))
        if clapit: both(t, clap(.2))
        for s in range(4): both(t + s * .125, hat(.05 + .05 * (s == 2), 80), pan=.5 if s % 2 else -.5)
    # A: 0-3.5s the hand-off — minor, uneasy, a falling "walk away" figure
    both(0, boom(.8))
    for m in (45, 57, 60, 64): both(0, tone(m, 3.5, .05, att=.6, harm=(1, .25, .08)))
    for b in range(7):
        t = b * beat
        if b % 2 == 0 and b: both(t, kick(.5))
        both(t + .25, hat(.07), pan=.4 if b % 2 else -.4)
    for j, m in enumerate((76, 72, 69, 64)): both(1.95 + j * .12, tone(m, .5, .06, decay=6, harm=(1, .3, .1)), pan=-.6 + .3 * j)
    for a in (L, R): a[int(3.35 * SR):int(3.5 * SR)] *= np.linspace(1, 0, int(.15 * SR)) ** 2
    # B: 3.5-5.5s "We don't." — big hit, then a riser into the groove
    both(3.5, boom(1.0)); both(3.5, kick(1.0)); both(3.5, clap(.35))
    for m in (36, 48, 55, 60, 64): both(3.5, tone(m, 2.0, .05, att=.02, harm=(1, .35, .12)))
    t = tt(1.5); n = np.diff(rng.standard_normal(len(t)), prepend=0); both(4.0, .12 * n * (t / 1.5) ** 2.5)
    for a in (L, R): a[int(5.42 * SR):int(5.5 * SR)] *= np.linspace(1, 0, int(.08 * SR)) ** 2
    # C: 5.5-17.5s the system — C major groove, a pluck hit on each checklist tick
    both(5.5, boom(.8))
    prog = [(36, (60, 64, 67)), (31, (59, 62, 67)), (33, (60, 64, 69)), (29, (60, 65, 69)), (36, (60, 64, 67)), (31, (59, 62, 67))]
    for i, (root, ch) in enumerate(prog):
        t0 = 5.5 + i * 2
        for m in ch: both(t0, tone(m, 2.1, .04, att=.05, harm=(1, .35, .12)))
        for b in range(4):
            t = t0 + b * beat
            drums(t, clapit=b % 2 == 1)
            for s in (0, 1): both(t + s * .25, tone(root + 12, .22, .15, decay=9, harm=(1, .5, .25)))
            for s in range(2):
                m = ch[(b * 2 + s) % 3] + 12
                both(t + s * .25, tone(m, .5, .07, decay=7, harm=(1, .3, .15, .05)), pan=(-.5, .5)[(b * 2 + s) % 2])
    for t0, m in ((6.65, 79), (8.75, 83), (10.75, 84)): both(t0, tone(m, .8, .09, decay=5, harm=(1, .3, .1)))
    both(13.75, boom(.4))
    # 17.5-18.5 pickup, final hit on 18.5, soft tail to the end
    for m in (55, 59, 62): both(17.5, tone(m, 1.0, .04, att=.05, harm=(1, .35, .12)))
    for k, t in enumerate((17.5, 17.75, 18.0, 18.125, 18.25, 18.3125, 18.375, 18.4375)): both(t, clap(.12 + .02 * k))
    both(17.5, kick(.8)); both(18.0, kick(.8))
    both(18.5, boom(.8)); both(18.5, kick(.9)); both(18.5, tone(36, 2.5, .2, decay=1.2, harm=(1, .4, .1)))
    for m in (60, 64, 67, 72): both(18.5, tone(m, 3.4, .035, att=.02, harm=(1, .35, .12)))
    for j, m in enumerate((72, 76, 79, 84)): both(18.7 + j * .09, tone(m, 1.4, .07, decay=3.5, harm=(1, .3, .1)), pan=(-.4, .4)[j % 2])
    for b in range(6): both(19.5 + b * .5, hat(.04 * (1 - b / 6), 70), pan=.4 if b % 2 else -.4)
    m = np.stack([L, R], 1); m[-int(.6 * SR):] *= np.linspace(1, 0, int(.6 * SR))[:, None]
    return (m / np.abs(m).max() * .8).astype(np.float32)

if __name__ == "__main__":
    vo, mus = f"{WORK}/vo.wav", f"{WORK}/music.wav"
    sf.write(vo, build_vo(), SR); sf.write(mus, build_music(), SR)
    pre = f"{WORK}/premix.wav"
    # voice: clean-up + compression. music: sidechain-ducked by the voice.
    fc = ("[0:a]highpass=f=75,acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=2,pan=stereo|c0=c0|c1=c0,asplit=2[v][key];"
          "[1:a]volume=0.5[m];[m][key]sidechaincompress=threshold=0.02:ratio=10:attack=12:release=380[duck];"
          "[v][duck]amix=inputs=2:normalize=0,alimiter=limit=0.7[o]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vo, "-i", mus, "-filter_complex", fc, "-map", "[o]", pre], check=True)
    x, _ = sf.read(pre); meter = pyln.Meter(SR)
    for _ in range(4):                                         # gain to -14 LUFS, keep peaks under -1 dBFS
        x = x * 10 ** ((-14 - meter.integrated_loudness(x)) / 20)
        if np.abs(x).max() <= 10 ** (-1 / 20): break
        x = np.tanh(x / .85) * .85
    sf.write(os.path.join(HERE, "mix.wav"), x, SR)
    print(f"mix.wav  {meter.integrated_loudness(x):.2f} LUFS  peak {20 * np.log10(np.abs(x).max()):.2f} dBFS")
