"""Soundtrack for "Stop boosting posts": the owner's cloned voice (Chatterbox, one clip per line),
laid out with fixed gaps, an original synthesized music bed ducked under the voice, mixed to -14 LUFS.

  # 1) voice clips (needs the private voice reference, never committed):
  #    /opt/chatterbox/bin/python vo_lines.py lines.json <VOICE_DIR>
  # 2) VOICE_DIR=<dir with l00.wav ...> WORK=<scratch dir> python3 audio.py
Lines 12 and 13 were regenerated with seed 33 (vo_lines.py lines.json <dir> 12,13 33) for clearer words.
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
GAP = [0.15, .25, .55, .22, .18, .6, .28, .32, .3, .3, .6, .6, .26, .6, .28]
TAIL = 1.6

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
    s2, s3, s4, s5, s6 = st[2] - .35, st[5] - .35, st[10] - .35, st[11] - .35, st[13] - .35
    beat = .5
    def drums(t, clapit=False, g=1.0):
        both(t, kick(.8 * g))
        if clapit: both(t, clap(.2 * g))
        for s in range(4): both(t + s * .125, hat((.05 + .05 * (s == 2)) * g, 80), pan=.5 if s % 2 else -.5)
    def bass(t, root, g=.15):
        for s in (0, 1): both(t + s * .25, tone(root + 12, .22, g, decay=9, harm=(1, .5, .25)))
    def pad(t0, d, notes, g=.045, att=.3):
        for m in notes: both(t0, tone(m, d, g, att=att, harm=(1, .3, .1)))
    # A (0 -> s3): the boost trap. A minor, a heartbeat kick, tense
    both(0, boom(.8)); both(st[0] + .95, boom(.5))           # stamp hit
    pad(0, s2 + .2, (45, 57, 60, 64), g=.05, att=.8)
    b = 1
    while b * beat < s2:
        t = b * beat
        if b % 4 in (0, 1): both(t if b % 4 == 0 else t - .2, kick(.45))
        both(t + .25, hat(.07), pan=.4 if b % 2 else -.4); b += 1
    both(s2, boom(.45))
    t = s2; k = 0
    while t < s3 - .25:                                          # driving, a little smug
        drums(t, clapit=k % 2 == 1, g=.85); bass(t, 33 if (k // 4) % 2 == 0 else 29); t += beat; k += 1
    for t0, n in ((s2, (45, 57, 60, 64)), (s2 + 4, (41, 57, 60, 65))):
        if t0 < s3: pad(t0, min(4.1, s3 - t0), n)
    both(s3 - 1.6, riser(1.6))
    for a in (L, R): a[int((s3 - .1) * SR):int(s3 * SR)] *= np.linspace(1, 0, int(.1 * SR)) ** 2
    # B (s3 -> s6): the fix. C major lift, plucks, steady groove
    both(s3, boom(.9))
    prog = [(36, (60, 64, 67)), (31, (59, 62, 67)), (33, (60, 64, 69)), (29, (60, 65, 69))]
    t = s3; i = 0
    while t < s6 - .3:
        root, ch = prog[(i // 4) % 4]
        if i % 4 == 0: pad(t, 2.05, ch, g=.04, att=.05)
        drums(t, clapit=i % 2 == 1); bass(t, root)
        for s in range(2):
            m = ch[(i * 2 + s) % 3] + 12
            both(t + s * .25, tone(m, .5, .07, decay=7, harm=(1, .3, .15, .05)), pan=(-.5, .5)[(i * 2 + s) % 2])
        t += beat; i += 1
    for tx in (s4, s5): both(tx, boom(.4))
    both(en[12] - .75, tone(84, .9, .06, decay=4, harm=(1, .3)))     # calendar "ding"
    both(en[12] - .55, tone(88, .9, .05, decay=4, harm=(1, .3)))
    both(s6 - 1.2, riser(1.2, .1))
    # C (s6 -> end): CTA. big hit, half-time groove, final chord
    both(s6, boom(.85)); both(s6, kick(.9))
    t = s6 + beat * 2; i = 0
    while t < dur - 1.2:
        both(t, kick(.7)); both(t + beat, clap(.16)); both(t + beat * .5, hat(.06), pan=-.4); both(t + beat * 1.5, hat(.06), pan=.4)
        bass(t, 36 if (i // 2) % 2 == 0 else 31, .13); t += beat * 2; i += 1
    fin = en[14] - .1
    both(fin, boom(.7)); both(fin, tone(36, 1.6, .2, decay=1.6, harm=(1, .4, .1)))
    for m in (60, 64, 67, 72): both(fin, tone(m, 1.6, .04, att=.02, harm=(1, .35, .12)))
    for j, m in enumerate((72, 76, 79, 84)): both(fin + .2 + j * .09, tone(m, 1.2, .06, decay=3.5, harm=(1, .3, .1)), pan=(-.4, .4)[j % 2])
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
