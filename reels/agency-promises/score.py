import numpy as np, wave, sys
ALT=False
SR=48000; DUR=30.0; N=int(SR*DUR); B=.5; BAR=2.0
rng=np.random.default_rng(11)
MUS=np.zeros((2,N)); SFX=np.zeros((2,N)); VERB=np.zeros((2,N))
def tt(d): return np.arange(int(d*SR))/SR
def put(bus,sig,at,gain=1.0,pan=0.0,verb=0.0):
    i=int(at*SR)
    if i>=N or i<0: return
    s=sig[:N-i]*gain; l=s*np.sqrt((1-pan)/2); r=s*np.sqrt((1+pan)/2)
    bus[0,i:i+len(s)]+=l; bus[1,i:i+len(s)]+=r
    if verb: VERB[0,i:i+len(s)]+=l*verb; VERB[1,i:i+len(s)]+=r*verb
def mus(*a,**k): put(MUS,*a,**k)
def sfx(*a,**k): put(SFX,*a,**k)
def fftfilt(x,lo=0,hi=SR/2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); m=np.ones_like(f)
    if lo: m*=1/(1+(lo/np.maximum(f,1))**4)
    if hi<SR/2: m*=1/(1+(f/hi)**4)
    return np.fft.irfft(X*m,len(x))
def noise(d): return rng.standard_normal(int(d*SR))
def S(*a):
    n=max(len(x) for x in a); o=np.zeros(n)
    for x in a: o[:len(x)]+=x
    return o
def midi(n): return 440*2**((n-69)/12)
def kick(d=.42,f0=140,f1=42,decay=9):
    x=tt(d); f=f1+(f0-f1)*np.exp(-x*35); return np.tanh(1.5*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x*decay))+fftfilt(noise(d),2000)*np.exp(-x*120)*.25
def clap(d=.28):
    x=tt(d); env=np.exp(-x*22)
    for o in (0,.009,.018): env+=np.where(x>o,np.exp(-(x-o)*140),0)*.6
    return fftfilt(noise(d),900,6000)*env*.5
def hat(d=.06,dec=90): x=tt(d); return fftfilt(noise(d),7000)*np.exp(-x*dec)
def pluck(freq,d=.35,decay=9,bright=4):
    x=tt(d); return sum(np.sin(2*np.pi*freq*k*x)*np.exp(-x*decay*k*.6)/k**1.2 for k in range(1,bright+1))*np.minimum(1,x*400)
def saw(freq,d,harm=8,det=0.0):
    x=tt(d); return sum(np.sin(2*np.pi*freq*(1+det)*k*x+k)/k for k in range(1,harm+1))
def whoosh(d,lo=800,hi=12000,shape=2.5,rev=False):
    x=tt(d); p=x/d; env=(1-p)**shape if rev else p**shape
    return fftfilt(noise(d),lo,hi)*env
def impact(big=1.0):
    d=2.2*big; x=tt(d); f=35+90*np.exp(-x*8); boom=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x*(2.4/big))
    return np.tanh(boom*1.8)*.9+fftfilt(noise(d),200,8000)*np.exp(-x*10)*.45
def key(): x=tt(.03); return fftfilt(noise(.03),2500,9000)*np.exp(-x*220)+np.sin(2*np.pi*1800*x)*np.exp(-x*300)*.15
def stamp():
    d=.6; x=tt(d); return kick(.6,95,38,8)*1.0+fftfilt(noise(d),300,4000)*np.exp(-x*35)*.9+np.sin(2*np.pi*180*x)*np.exp(-x*25)*.4
def blip(freq,d=.12): x=tt(d); return np.sin(2*np.pi*freq*x)*np.exp(-x*30)*np.minimum(1,x*800)
def crush(d=.08): x=tt(d); return np.round(fftfilt(noise(d),1000)*2)/2*np.exp(-x*30)
def ding(freqs,d=1.4): x=tt(d); return sum(np.sin(2*np.pi*f*x)*np.exp(-x*3.5)+np.sin(2*np.pi*f*2.76*x)*np.exp(-x*9)*.25 for f in freqs)/len(freqs)

def bassline(t0,t1,roots,gain=.3,cut=900,pattern=(1,0,1,1,0,1,1,0)):
    step=B/2; k=0; t=t0
    while t<t1-1e-6:
        r=roots[int((t-t0)//BAR)%len(roots)]
        if pattern[k%len(pattern)]:
            s=fftfilt(saw(midi(r+(12 if k%8==6 else 0)),step*.92,6),0,cut)*np.exp(-tt(step*.92)*4); mus(s,t,gain)
        k+=1; t+=step
def pads(t0,t1,chords,gain=.03,hi=2000):
    t=t0;i=0
    while t<t1-1e-6:
        d=min(BAR,t1-t); env=np.minimum(1,tt(d)*5)*np.minimum(1,(d-tt(d))*15)
        for n in chords[i%len(chords)]:
            for det in (-.004,.004): mus(fftfilt(saw(midi(n),d,8,det),0,hi)*env,t,gain,pan=det*90,verb=.4)
        t+=BAR;i+=1
kicks=[]
# 1 reflective
pads(0,4.4,[[57,60,64],[53,57,60]],.03,1600)
for k,n in enumerate([69,72,76,72,67,71,74,71]): mus(pluck(midi(n),.8,5,3),.3+k*.5,.07,pan=(-1)**k*.3,verb=.6)
# 2a cheesy pitch (bright C major, claps)
for k in range(9): mus(clap(.2),4.5+k*.25,.18 if k%2 else .1,verb=.3)
for s in range(18):
    ch=[72,76,79,84]; mus(pluck(midi(ch[s%4]+12),.2,14,6),4.5+s*.125,.06,pan=.5 if s%2 else -.5,verb=.4)
pads(4.4,6.75,[[60,64,67,72]],.03,3000)
x=tt(.6); mus(np.sin(2*np.pi*np.cumsum(np.linspace(260,40,len(x)))/SR)*np.exp(-x*3)*.5,6.75)   # tape-stop
# 2b deflated
x=tt(3.6); mus(np.sin(2*np.pi*midi(38)*x)*np.minimum(1,x*3)*np.exp(-x*.3)*.3,7.0)
for k in range(7): mus(pluck(midi(50),.5,6,3),7.0+k*.5,.05,verb=.3)
# 3 build
for k in range(int(10.8/B),int(19.2/B)): kicks.append(k*B)
for e in range(int(10.8/(B/2)),int(19.2/(B/2))):
    if e%2: mus(hat(.1,30),e*B/2,.11,pan=.25)
for k in range(int(13.0/B),int(19.2/B)):
    if k%2: mus(clap(),k*B,.26,verb=.3)
bassline(10.8,19.2,[38,34,36,33],.26)
pads(10.8,19.2,[[50,53,57],[46,50,53],[48,52,55],[45,48,52]],.022,1500)
d=20.6-19.4; x=tt(d); p=x/d; mus(fftfilt(noise(d),700,12000)*p**3*.3+np.sin(2*np.pi*np.cumsum(220+1500*p**2)/SR)*p**2*.05,19.4)
# 4 walk away: sparse, then lift
x=tt(2.7); mus(np.sin(2*np.pi*midi(33)*x)*np.exp(-x*.8)*.35,20.6)
for k in range(int(23.3/B),int(29.0/B)): kicks.append(k*B)
for e in range(int(23.3/(B/2)),int(29.0/(B/2))):
    if e%2: mus(hat(.1,30),e*B/2,.11,pan=.25)
for k in range(int(23.3/B),int(29.0/B)):
    if k%2: mus(clap(),k*B,.26,verb=.35)
bassline(23.3,28.35,[41,36,38,34],.26,1100)
pads(23.3,28.35,[[57,60,65],[55,60,64],[57,62,65],[58,62,65]],.03,2600)
for s in range(int((28.3-25.0)/(B/4))):
    t=25.0+s*B/4; ch=[[65,69,72,77],[64,67,72,76],[62,65,69,74],[62,65,70,74]][int((t-23.3)//BAR)%4]
    mus(pluck(midi(ch[s%4]+12),.22,14,4),t,.04,pan=.6 if s%2 else -.6,verb=.5)
for n in [41,53,60,64,67,69]:
    for det in (-.005,.005):
        x=tt(1.65); mus(fftfilt(saw(midi(n),1.65,8,det),0,2200)*np.minimum(1,x*3)*np.exp(-x*.6),28.35,.04,pan=det*80,verb=.8)
for ti in kicks: mus(kick(),ti,.72)
duck=np.ones(N)
for ti in kicks:
    i=int(ti*SR); x=tt(.3); duck[i:i+len(x)]=np.minimum(duck[i:i+len(x)],1-.6*np.exp(-x*10))
MUS[:, :]*=duck
# ───────── sfx ─────────
sfx(whoosh(.45,500,7000,2.5,True),.12,.25)
for t0 in [.55,.75,.95,1.15,1.5,1.62]: sfx(key(),t0,.12)
sfx(kick(.4,110,45,10),2.0,.45); sfx(crush(.08),2.0,.2)
for i in range(13): sfx(key(),2.4+i*.038,.1)
sfx(whoosh(.4,600,9000,2.5),4.0,.3)
sfx(S(kick(.3,120,60,14),blip(700,.1)),4.45,.4)
for k in range(5): sfx(S(pluck(midi([79,83,86,88,91][k]),.3,10,3),blip(midi(96),.05)*.4),4.85+k*.3,.16,pan=(k-2)/3,verb=.3)
sfx(impact(.6),6.75,.6,verb=.4)
sfx(whoosh(.45,500,6000,2.5,True),6.85,.25)
for k in range(4): sfx(key()*1.5,7.15+k*.12,.15)
for k in range(3): sfx(S(np.sign(np.sin(2*np.pi*98*tt(.18)))*np.exp(-tt(.18)*14)*.45,crush(.08)),8.55+k*.2,.22,pan=(k-1)*.3)
sfx(ding([midi(84),midi(88),midi(91)],1.0),9.35,.22,verb=.5)
sfx(whoosh(.35,500,8000,2.5),10.25,.3)
sfx(whoosh(.25,3000,14000,2,True),10.8,.2)
sfx(impact(.6),11.85,.6,verb=.4)
for k,t0 in enumerate([13.35,14.85,16.65]): sfx(S(whoosh(.3,1500,12000,2,True),pluck(midi([76,79,83][k]),.5,8,3)*.8),t0,.3,verb=.4)
sfx(S(np.sign(np.sin(2*np.pi*120*tt(.12)))*np.exp(-tt(.12)*18)*.3),18.15,.15)
sfx(whoosh(.3,600,12000,2),18.9,.35)
sfx(impact(.9),20.6,.8,verb=.5); sfx(crush(.12),20.6,.35)
sfx(whoosh(.45,800,9000,2),20.6,.3,pan=-.6)
for t0 in (21.3,21.8): sfx(S(np.sign(np.sin(2*np.pi*98*tt(.2)))*np.exp(-tt(.2)*12)*.4,kick(.3,100,50,12)*.6),t0,.3)
for t0 in (21.6,22.4): sfx(whoosh(.2,2000,10000,1.5),t0,.15)
sfx(impact(1.0),23.3,.85,verb=.6); sfx(ding([midi(77),midi(81),midi(84),midi(89)],1.6),23.75,.35,verb=.6)
sfx(whoosh(.35,800,9000,2.5),24.7,.3)
for i in range(len('I want kitchen and bath leads.')): sfx(key(),25.4+i*(1.55/30)+((i*7)%5)*.004,.15,pan=.2)
x=tt(.25); sfx(np.sin(2*np.pi*np.cumsum(np.linspace(300,1400,len(x)))/SR)*np.exp(-x*8),27.25,.22,verb=.3)
sfx(impact(.9),28.35,.75,verb=.6)
for j,x0 in enumerate([.3636,.7273,.9091,.9773]): sfx(blip(midi(89),.12),28.75+.4*x0,.3*(.55**j),verb=.5)
# ───────── mix ─────────
d=2.2; x=tt(d); ir=[noise(d)*np.exp(-x*2.8) for _ in range(2)]; ir=[i/np.sqrt((i**2).sum()) for i in ir]
def conv(a,b):
    n=len(a)+len(b); n2=1<<(n-1).bit_length(); return np.fft.irfft(np.fft.rfft(a,n2)*np.fft.rfft(b,n2),n2)[:len(a)]
V=np.stack([fftfilt(conv(VERB[c],ir[c]),200) for c in range(2)])*.8
mix=MUS*.75+SFX*1.0+V
mix=np.stack([fftfilt(m,30) for m in mix])
mix=np.tanh(mix/np.max(np.abs(mix))*1.5)
fl=int(.5*SR); mix[:,-fl:]*=np.linspace(1,0,fl)**2
mix=mix/np.max(np.abs(mix))*.7   # ~-3 dBFS peak: headroom for voiceover
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T*32767).astype(np.int16).tobytes())
print('ok')
