"""Soundtrack for "Speed books jobs": the owner's cloned voice (Chatterbox, one clip per line),
laid out with fixed gaps, an original synthesized music bed ducked under the voice, mixed to -14 LUFS.

  # 1) voice clips (needs the private voice reference, never committed):
  #    /opt/chatterbox/bin/python vo_lines.py lines.json <VOICE_DIR>
  # 2) VOICE_DIR=<dir with l00.wav ...> WORK=<scratch dir> python3 audio.py
Writes mix.wav next to this file, and rewrites the VO timing block in index.html so the
animation and captions follow the real line lengths.
"""
import os, re, json, subprocess, numpy as np, soundfile as sf, pyloudnorm as pyln

HERE = os.path.dirname(os.path.abspath(__file__))
VD = os.environ.get("VOICE_DIR", os.path.join(HERE, "vo"))
WORK = os.environ.get("WORK", VD)
SR = 48000
LINES = json.load(open(os.path.join(HERE, "lines.json")))
# silence before each line (scene changes get a longer breath)
GAP = [0.15, .2, .1, .35, .22, .2, .4, .3, .3, .3, .4, .3, .3, .4, .2, .4, .2, .4, .2, .4, .2]
TAIL = 1.8

def load(i):
    x, sr = sf.read(os.path.join(VD, f"l{i:02d}.wav"), dtype="float32")
    if x.ndim > 1: x = x.mean(1)
    idx = np.where(np.abs(x) > 0.012)[0]
    x = x[max(0, idx[0] - int(.012 * sr)): idx[-1] + int(.05 * sr)]
    return np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x).astype(np.float32)

def layout():
    clips, slots, t = [], [], 0.0
    for i, text in enumerate(LINES):
        c = load(i); t += GAP[i]; slots.append([round(t, 2), round(t + len(c) / SR, 2), text]); t += len(c) / SR; clips.append(c)
    return clips, slots, round(t + TAIL, 2)

def patch_html(slots):
    p = os.path.join(HERE, "index.html"); s = open(p).read()
    body = "[\n" + "".join(f" [{a:.2f}, {b:.2f}, {json.dumps(x)}],\n" for a, b, x in slots) + "]"
    s = re.sub(r"/\*VO\*/\[.*?\]/\*/VO\*/", "/*VO*/" + body.replace("\\", "\\\\") + "/*/VO*/", s, flags=re.S)
    open(p, "w").write(s)

# ---------------- music bed ----------------
rng = np.random.default_rng(11)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def kick(g=1.0):
    t = tt(.45); f = 44 + 120 * np.exp(-t * 28)
    return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8.5)
def hat(g=.1, d=60):
    t = tt(.12); n = np.diff(np.diff(rng.standard_normal(len(t)), prepend=0), prepend=0)
    return g * .5 * n * np.exp(-t * d)
def clap(g=.3):
    t = tt(.25); n = np.diff(rng.standard_normal(len(t)), prepend=0)
    return g * n * np.exp(-t * 22) * (1 + .6 * np.sin(2 * np.pi * 45 * t))
def tone(m, d, g, decay=None, att=.005, harm=(1, .0, .0)):
    t = tt(d); f = hz(m)
    x = sum(h * np.sin(2 * np.pi * f * (i + 1) * t) for i, h in enumerate(harm))
    env = np.minimum(1, t / att) * (np.exp(-t * decay) if decay else np.minimum(1, (d - t) / .4))
    return g * x * env
def boom(g=.9):
    t = tt(2.2); n = np.cumsum(rng.standard_normal(len(t))); n -= np.linspace(n[0], n[-1], len(n)); n /= np.abs(n).max()
    return g * (np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2) + .25 * n * np.exp(-t * 5))
def riser(d, g=.12):
    t = tt(d); n = np.diff(rng.standard_normal(len(t)), prepend=0); return g * n * (t / d) ** 2.5

def build_music(slots, dur):
    N = int(SR * dur); L = np.zeros(N); R = np.zeros(N)
    def add(buf, t0, x):
        s = int(t0 * SR)
        if 0 <= s < N: x = x[:N - s]; buf[s:s + len(x)] += x
    def both(t0, x, pan=0.0): add(L, t0, x * (1 - max(0, pan))); add(R, t0, x * (1 + min(0, pan)))
    st = [a for a, _, _ in slots]; en = [b for _, b, _ in slots]
    beat = 60 / 116
    def drums(t, clapit=False, g=1.0):
        both(t, kick(.75 * g))
        if clapit: both(t, clap(.18 * g))
        for s in range(4): both(t + s * beat / 4, hat((.045 + .05 * (s == 2)) * g, 80), pan=.5 if s % 2 else -.5)
    def bass(t, root, g=.14):
        for s in (0, 1): both(t + s * beat / 2, tone(root + 12, .22, g, decay=9, harm=(1, .5, .25)))
    def pad(t0, d, notes, g=.04, att=.3):
        for m in notes: both(t0, tone(m, d, g, att=att, harm=(1, .3, .1)))
    def tick(t0, g=.12):                                   # pixel-wipe "blip" on every cut
        both(t0, riser(.18, g * .8)[::-1]); both(t0, tone(96, .08, g * .25, decay=40))
    sA, sB, sC = st[6] - .3, st[19] - .3, dur
    for a in st[1:]: tick(a - .18)
    # A: the problem (0 -> sA). minor, tight pulse
    both(0, boom(.7)); pad(0, sA, (45, 57, 60, 64), g=.045, att=.6)
    t = beat; k = 0
    while t < sA - .3:
        both(t, kick(.5 if k % 2 == 0 else .3)); both(t + beat / 2, hat(.06), pan=.4 if k % 2 else -.4)
        if k >= 8: bass(t, 33 if (k // 4) % 2 == 0 else 29, .1)
        t += beat; k += 1
    both(sA - 1.2, riser(1.2, .1))
    # B: the fix (sA -> sB). major lift, full groove with plucks
    both(sA, boom(.85))
    prog = [(36, (60, 64, 67)), (31, (59, 62, 67)), (33, (60, 64, 69)), (29, (60, 65, 69))]
    t = sA; i = 0
    while t < sB - .3:
        root, ch = prog[(i // 4) % 4]
        if i % 4 == 0: pad(t, beat * 4 + .05, ch, g=.035, att=.05)
        drums(t, clapit=i % 2 == 1); bass(t, root)
        for s in range(2):
            m = ch[(i * 2 + s) % 3] + 12
            both(t + s * beat / 2, tone(m, .5, .06, decay=7, harm=(1, .3, .15, .05)), pan=(-.5, .5)[(i * 2 + s) % 2])
        t += beat; i += 1
    both(en[12] - .5, tone(84, .9, .06, decay=4, harm=(1, .3))); both(en[12] - .3, tone(88, .9, .05, decay=4, harm=(1, .3)))   # calendar ding
    both(st[17] - .3, boom(.5))
    both(sB - 1.2, riser(1.2, .1))
    # C: CTA (sB -> end). half-time groove, final chord
    both(sB, boom(.85)); t = sB + beat * 2; i = 0
    while t < dur - 1.4:
        both(t, kick(.65)); both(t + beat, clap(.15)); both(t + beat * .5, hat(.05), pan=-.4); both(t + beat * 1.5, hat(.05), pan=.4)
        bass(t, 36 if (i // 2) % 2 == 0 else 31, .12); t += beat * 2; i += 1
    fin = en[-1] - .1
    both(fin, boom(.6)); both(fin, tone(36, 1.6, .18, decay=1.6, harm=(1, .4, .1)))
    for m in (60, 64, 67, 72): both(fin, tone(m, 1.6, .035, att=.02, harm=(1, .35, .12)))
    m = np.stack([L, R], 1); m[-int(.5 * SR):] *= np.linspace(1, 0, int(.5 * SR))[:, None]
    return (m / np.abs(m).max() * .8).astype(np.float32)

if __name__ == "__main__":
    clips, slots, dur = layout()
    patch_html(slots)
    N = int(SR * dur); vo = np.zeros(N, np.float32)
    for c, (a, _, _) in zip(clips, slots): s = int(a * SR); vo[s:s + len(c)] += c
    vp, mp = f"{WORK}/vo.wav", f"{WORK}/music.wav"
    sf.write(vp, vo, SR); sf.write(mp, build_music(slots, dur), SR)
    pre = f"{WORK}/premix.wav"
    fc = ("[0:a]highpass=f=75,acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=2,pan=stereo|c0=c0|c1=c0,asplit=2[v][key];"
          "[1:a]volume=0.5[m];[m][key]sidechaincompress=threshold=0.02:ratio=10:attack=12:release=380[duck];"
          "[v][duck]amix=inputs=2:normalize=0,alimiter=limit=0.7[o]")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vp, "-i", mp, "-filter_complex", fc, "-map", "[o]", pre], check=True)
    x, _ = sf.read(pre); meter = pyln.Meter(SR)
    for _ in range(4):                                         # gain to -14 LUFS, keep peaks under -1 dBFS
        x = x * 10 ** ((-14 - meter.integrated_loudness(x)) / 20)
        if np.abs(x).max() <= 10 ** (-1 / 20): break
        x = np.tanh(x / .85) * .85
    sf.write(os.path.join(HERE, "mix.wav"), x, SR)
    print(f"duration {dur}s  mix.wav  {meter.integrated_loudness(x):.2f} LUFS  peak {20 * np.log10(np.abs(x).max()):.2f} dBFS")
    for a, b, t in slots: print(f"  {a:6.2f}-{b:6.2f}  {t}")
