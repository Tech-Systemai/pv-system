import numpy as np, wave, sys
import json
RJ=json.load(open(sys.argv[2]));ALT=False
SR=48000; DUR=RJ["dur"]; N=int(SR*DUR); B=.5; BAR=2.0
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

RI=int(sys.argv[3]); SF=RJ["sfx"]
CTA=[x[0] for x in SF if x[1]=='send'][0]-2.1; DM=[x[0] for x in SF if x[1]=='impact'][-1]
key=[0,3,-2,5,2,-4,1,-1,4,-3][RI]
def bassline(t0,t1,roots,gain=.24,cut=900,pattern=(1,0,1,1,0,1,1,0)):
    step=B/2;k=0;t=t0
    while t<t1-1e-6:
        r=roots[int((t-t0)//BAR)%len(roots)]+key
        if pattern[k%len(pattern)]: mus(fftfilt(saw(midi(r+(12 if k%8==6 else 0)),step*.92,6),0,cut)*np.exp(-tt(step*.92)*4),t,gain)
        k+=1;t+=step
def pads(t0,t1,chords,gain=.026,hi=2000):
    t=t0;i=0
    while t<t1-1e-6:
        d=min(BAR,t1-t);env=np.minimum(1,tt(d)*5)*np.minimum(1,(d-tt(d))*15)
        for n in chords[i%len(chords)]:
            for det in (-.004,.004): mus(fftfilt(saw(midi(n+key),d,8,det),0,hi)*env,t,gain,pan=det*90,verb=.4)
        t+=BAR;i+=1
st=0.4
kicks=[k*B for k in range(1,int(DM/B)+1)]
for ti in kicks: mus(kick(),ti,.6)
for e in range(2,int(DM/(B/2))):
    if e%2: mus(hat(.1,30),e*B/2,.09,pan=.25)
for k in range(int(CTA/B),int(DM/B)):
    if k%2: mus(clap(),k*B,.22,verb=.3)
bassline(st,CTA,[45,41,43,40],.22)
pads(0,CTA,[[57,60,64],[53,57,60],[55,59,62],[52,55,59]],.022,1500)
bassline(CTA,DM,[41,36,38,34],.24,1100)
pads(CTA,DM,[[57,60,65],[55,60,64],[57,62,65],[58,62,65]],.028,2600)
for s in range(int((DM-CTA)/(B/4))):
    t=CTA+s*B/4; ch=[[65,69,72,77],[64,67,72,76]][int((t-CTA)//BAR)%2]; mus(pluck(midi(ch[s%4]+12+key),.22,14,4),t,.035,pan=.6 if s%2 else -.6,verb=.5)
for n in [41,53,60,64,67,69]:
    for det in (-.005,.005):
        d=DUR-DM; x=tt(d); mus(fftfilt(saw(midi(n+key),d,8,det),0,2200)*np.minimum(1,x*3)*np.exp(-x*.8),DM,.04,pan=det*80,verb=.8)
duck=np.ones(N)
for ti in kicks:
    i=int(ti*SR);x=tt(.3);duck[i:i+len(x)]=np.minimum(duck[i:i+len(x)],1-.6*np.exp(-x*10))
MUS[:,:]*=duck
nt=[76,79,83,84,86,88,91]
for n_,(t0,ty,g) in enumerate(SF):
    if ty=='pop': sfx(S(pluck(midi(nt[n_%7]),.3,10,3),kick(.15,200,90,25)*.25),t0,.18*g,verb=.3)
    elif ty=='whoosh': sfx(whoosh(.35,700,10000,2.5),t0-.3 if t0>.3 else 0,.3*g)
    elif ty=='rise': sfx(whoosh(.6,500,8000,2),t0,.25*g)
    elif ty=='buzz': sfx(S(np.sign(np.sin(2*np.pi*98*tt(.2)))*np.exp(-tt(.2)*12)*.45,crush(.08)),t0,.25*g)
    elif ty=='stamp': sfx(stamp(),t0,.8*g,verb=.3)
    elif ty=='thud': sfx(kick(.4,110,40,9),t0,.55*g)
    elif ty=='impact': sfx(impact(.8),t0,.7*g,verb=.5)
    elif ty=='ding': sfx(ding([midi(84),midi(88),midi(91)],1.2),t0,.22*g,verb=.5)
    elif ty=='coin': sfx(S(blip(midi(96),.08),np.concatenate([np.zeros(int(.07*SR)),blip(midi(100),.1)])),t0,.18*g,verb=.3)
    elif ty=='chip': sfx(pluck(midi(nt[n_%7]+12),.25,14,3),t0,.13*g,pan=(n_%3-1)*.4,verb=.4)
    elif ty=='tick': sfx(key_ if False else S(fftfilt(noise(.03),2500,9000)*np.exp(-tt(.03)*220)),t0,.2*g)
    elif ty=='type': sfx(S(fftfilt(noise(.03),2500,9000)*np.exp(-tt(.03)*220)),t0,.14*g,pan=.2)
    elif ty=='grow': 
        for k in range(5): sfx(pluck(midi([72,76,79,83,86][k]),.4,8,3),t0+k*.12,.1*g,verb=.5)
    elif ty=='shrink': x=tt(.7); sfx(np.sin(2*np.pi*np.cumsum(np.linspace(700,140,len(x)))/SR)*np.exp(-x*3),t0,.18*g)
    elif ty=='send': x=tt(.25); sfx(np.sin(2*np.pi*np.cumsum(np.linspace(300,1400,len(x)))/SR)*np.exp(-x*8),t0,.22*g,verb=.3)
    elif ty=='blipdot': sfx(blip(midi(89),.12),t0,.3*g,verb=.5)
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
