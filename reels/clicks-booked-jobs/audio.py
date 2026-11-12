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
SR, DUR = 48000, 29.0
N = int(SR * DUR)
# (slot start, text) — starts match the caption slots in index.html
VO = [(0.15, "Your agency sends you reports full of clicks and leads."), (3.40, "But how many jobs did you book?"),
      (6.10, "Clicks look nice."), (7.40, "Impressions look nice."), (9.05, "Traffic looks nice."),
      (10.60, "But they don't pay your bills."), (12.75, "The numbers that matter:"), (14.30, "booked consults."),
      (15.60, "Jobs sold."), (16.80, "Money in the bank."),
      (18.70, "Pick an agency that cares about your booked jobs, not just its report."),
      (23.75, "Want kitchen and bath leads that turn into booked consults?"), (27.45, "DM us.")]

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
    def drums(t, clapit=False, sixteenths=True):
        both(t, kick(.8))
        if clapit: both(t, clap(.2))
        for s in range(4 if sixteenths else 2):
            both(t + s * (.125 if sixteenths else .25), hat(.05 + .05 * (s == 2), 80), pan=.5 if s % 2 else -.5)
    # A: 0-6s the shiny report — sparse, a little smug: A minor pad, heartbeat kick
    both(0, boom(.8))
    for m in (45, 57, 60, 64): both(0, tone(m, 6.2, .05, att=1.0, harm=(1, .25, .08)))
    for b in range(12):
        t = b * beat
        if b % 4 in (0, 1) and b: both(t if b % 4 == 0 else t - .2, kick(.45))
        both(t + .25, hat(.07), pan=.4 if b % 2 else -.4)
    # B: 6-12.5s crossing out the vanity metrics — driving, a hit on every strike
    for b in range(12, 25):
        t = b * beat; root = 33 if b < 18 else 29
        drums(t)
        for s in (0, 1): both(t + s * .25, tone(root + 12, .22, .16, decay=9, harm=(1, .5, .25)))
    for m in (45, 57, 60, 64): both(6, tone(m, 3.1, .045, att=.3, harm=(1, .3, .1)))
    for m in (41, 57, 60, 65): both(9, tone(m, 3.4, .045, att=.3, harm=(1, .3, .1)))
    for t0 in (6.1, 7.4, 9.05): both(t0, boom(.35))
    t = tt(2.0); n = np.diff(rng.standard_normal(len(t)), prepend=0); both(10.4, .12 * n * (t / 2) ** 2.5)
    for a in (L, R): a[int(12.4 * SR):int(12.5 * SR)] *= np.linspace(1, 0, int(.1 * SR)) ** 2
    # C: 12.5-29s what matters — C major lift
    both(12.5, boom(.9))
    prog = [(36, (60, 64, 67)), (31, (59, 62, 67)), (33, (60, 64, 69)), (29, (60, 65, 69)),
            (36, (60, 64, 67)), (31, (59, 62, 67)), (29, (60, 65, 69))]
    for i, (root, ch) in enumerate(prog):
        t0 = 12.5 + i * 2
        for m in ch: both(t0, tone(m, 2.1, .04, att=.05, harm=(1, .35, .12)))
        for b in range(4):
            t = t0 + b * beat
            drums(t, clapit=b % 2 == 1)
            for s in (0, 1): both(t + s * .25, tone(root + 12, .22, .15, decay=9, harm=(1, .5, .25)))
            for s in range(2):
                m = ch[(b * 2 + s) % 3] + 12
                both(t + s * .25, tone(m, .5, .075, decay=7, harm=(1, .3, .15, .05)), pan=(-.5, .5)[(b * 2 + s) % 2])
    # 26.5-27.5 one bar of G pickup (snare-ish claps accelerating), then final C hit on 27.5
    for m in (55, 59, 62): both(26.5, tone(m, 1.0, .04, att=.05, harm=(1, .35, .12)))
    for k, t in enumerate((26.5, 26.75, 27.0, 27.125, 27.25, 27.3125, 27.375, 27.4375)): both(t, clap(.12 + .02 * k))
    both(26.5, kick(.8)); both(27.0, kick(.8))
    both(27.5, boom(.8)); both(27.5, kick(.9)); both(27.5, tone(36, 1.5, .2, decay=1.6, harm=(1, .4, .1)))
    for m in (60, 64, 67, 72): both(27.5, tone(m, 1.5, .04, att=.02, harm=(1, .35, .12)))
    for j, m in enumerate((72, 76, 79, 84)): both(27.7 + j * .09, tone(m, 1.2, .07, decay=3.5, harm=(1, .3, .1)), pan=(-.4, .4)[j % 2])
    m = np.stack([L, R], 1); m[-int(.4 * SR):] *= np.linspace(1, 0, int(.4 * SR))[:, None]
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
