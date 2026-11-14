import numpy as np, wave, sys
ALT=len(sys.argv)>2 and sys.argv[2]=='alt'
SR=48000; DUR=32.0; N=int(SR*DUR); B=.5; BAR=2.0
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
# ───────── music ─────────
def bassline(t0,t1,roots,gain=.3,cut=900,pattern=(1,0,1,1,0,1,1,0)):
    step=B/2; k=0; t=t0
    while t<t1-1e-6:
        bi=int((t-t0)//BAR)%len(roots); r=roots[bi]
        if pattern[k%len(pattern)]:
            n=r+(12 if k%8==6 else 0); s=fftfilt(saw(midi(n),step*.92,6),0,cut)*np.exp(-tt(step*.92)*4)
            mus(s,t,gain)
        k+=1; t+=step
def pads(t0,t1,chords,gain=.035,hi=2000):
    t=t0;i=0
    while t<t1-1e-6:
        d=min(BAR,t1-t); env=np.minimum(1,tt(d)*5)*np.minimum(1,(d-tt(d))*15)
        for n in chords[i%len(chords)]:
            for det in (-.004,.004): mus(fftfilt(saw(midi(n),d,8,det),0,hi)*env,t,gain,pan=det*90,verb=.4)
        t+=BAR;i+=1
kicks=[]
# S1 tension: drone + ticking
x=tt(5.5); mus(np.sin(2*np.pi*midi(26)*x)*np.minimum(1,x*.8)*(1-np.minimum(1,np.maximum(0,x-5.0)*2))*.35,0)
for k in range(44): mus(hat(.04,140),k*B/4+.0,.05+.05*(k%4==0),pan=.3)
for k in range(1,11): mus(pluck(midi(50),.4,7,3),k*B,.05,verb=.3)
# S2 + S3 dark groove (Dm Bb)
for k in range(11,33): kicks.append(k*B)            # 5.5..16.0
for k in range(34,62): kicks.append(k*B)            # 17..30.5 (fix)
for ti in kicks: mus(kick(),ti,.75)
for k in range(11,33):
    if k%2: mus(clap(),k*B,.32,verb=.3) if k>=22 else None
for e in range(22,66): mus(hat(.1,30),e*B/2,.12,pan=.25) if e%2 else None
for s in range(88,130): mus(hat(),s*B/4,.07+.03*(s%4==0),pan=-.3)
bassline(5.5,16.2,[38,34],.28)
pads(5.5,16.0,[[50,53,57],[46,50,53]],.025,1400)
for s in range(16*4):  # S3 arp
    t=11+s*B/4
    if t>=16.2: break
    ch=[62,65,69,74] if int((t-11)//BAR)%2==0 else [58,62,65,70]
    mus(pluck(midi(ch[s%4]),.2,16,5),t,.06,pan=.5 if s%2 else -.5,verb=.4)
d=16.2-13.4; x=tt(d); p=x/d; mus(fftfilt(noise(d),800,12000)*p**3*.35+np.sin(2*np.pi*np.cumsum(200+1800*p**2.3)/SR)*p**2*.06,13.4)
# S4–S6 lift (F C Dm Bb)
for k in range(34,62):
    if k%2: mus(clap(),k*B,.28,verb=.35)
for e in range(68,124):
    if e%2: mus(hat(.1,30),e*B/2,.11,pan=.25)
bassline(16.5,30.0,[41,36,38,34],.26,1100)
pads(16.5,30.0,[[57,60,65],[55,60,64],[57,62,65],[58,62,65]],.03,2600)
for s in range(int((27.5-21)/(B/4))):
    t=21+s*B/4; bi=int((t-16.5)//BAR)%4; ch=[[65,69,72,77],[64,67,72,76],[62,65,69,74],[62,65,70,74]][bi]
    mus(pluck(midi(ch[s%4]+12),.22,14,4),t,.045,pan=.6 if s%2 else -.6,verb=.5)
# final chord
for n in [41,53,60,64,67,69]:
    for det in (-.005,.005):
        x=tt(2.0); mus(fftfilt(saw(midi(n),2.0,8,det),0,2200)*np.minimum(1,x*3)*np.exp(-x*.6),30.05,.04,pan=det*80,verb=.8)
# sidechain
duck=np.ones(N)
for ti in kicks:
    i=int(ti*SR); x=tt(.3); duck[i:i+len(x)]=np.minimum(duck[i:i+len(x)],1-.6*np.exp(-x*10))
MUS[:, :]*=duck
# ───────── sfx ─────────
if not ALT:
    for at in (.35,1.3,2.75,3.6): sfx(whoosh(.25,3000,14000,2,True),at,.25)
    for i in range(18): sfx(blip(900+i*60,.05),1.75+.85*(1-(1-i/18)**2.2),.12)   # counter roll
    sfx(ding([midi(84),midi(88)],.9),2.6,.18,verb=.4)
    sfx(impact(.8),4.3,.75,verb=.4); sfx(crush(.12),4.3,.4); sfx(whoosh(.3,1500,9000,2),4.35,.0)
    sfx(np.sin(2*np.pi*np.cumsum(np.full(int(.3*SR),1.0)*np.linspace(600,120,int(.3*SR)))/SR)*np.exp(-tt(.3)*6),4.38,.12)  # strike
else:
    for at in (.4,.85): sfx(whoosh(.25,3000,14000,2,True),at,.25)
    for k in range(4): sfx(pluck(midi([76,79,83,86][k]),.3,12,3),1.05+k*.25,.16,pan=.4,verb=.3)
    for k in range(4): sfx(np.sign(np.sin(2*np.pi*110*tt(.12)))*np.exp(-tt(.12)*25)*.5+S(key(),np.zeros(int(.12*SR))),2.85+k*.12,.14,pan=-.3)
    sfx(impact(.6),2.8,.6,verb=.4); sfx(crush(.1),2.8,.35); sfx(kick(.4,120,40,10),3.25,.5)
sfx(S(whoosh(.25,600,10000,3),crush(.25)*.3),5.25,.4)
sfx(impact(.5),5.5,.5,verb=.3)
sfx(whoosh(.4,500,6000,2,True),6.0,.25)
for i in range(4):
    for j in range(9): sfx(key(),6.3+i*.25+j*.022,.22,pan=.2)
sfx(key()*2.0,7.33,.4)
sfx(crush(.1),7.6,.35); sfx(blip(220,.15),7.6,.15)
sfx(stamp(),7.85,1.0,verb=.3)
for k in range(8): sfx(pluck(midi(62+k*2),.15,20,3),8.75+k*.045,.06,pan=(k-4)/5)
for k in range(8): sfx(stamp(),9.5+k*.09,.28,pan=((k*3)%8-4)/5)
sfx(whoosh(.45,800,10000,3),10.5,.35)
for n in range(7): sfx(blip(500*2**(n/3),.1),11.7+n*.62,.15,pan=.0,verb=.3)
sfx(whoosh(.18,4000,16000,1.5),16.02,.4); sfx(ding([midi(96)],.6),16.18,.12,verb=.5)
sfx(whoosh(.3,300,8000,1.5,True),16.2,.4)
sfx(impact(1.0),16.7,.85,verb=.5)
sfx(whoosh(.4,500,7000,2.5),17.6,.3)
for i in range(25): sfx(key(),17.95+i*.02,.18,pan=.3)
sfx(whoosh(.5,1500,12000,2),18.3,.22,pan=.6)
sfx(S(blip(1200,.08),kick(.2,200,80,20)*.4),18.85,.35)
sfx(pluck(midi(84),.3,10,3),19.35,.16,verb=.3)
x=tt(.5); sfx(sum(np.sin(2*np.pi*midi(n)*x)*np.exp(-x*2) for n in (77,81,84,89))*(x/.5)*.25,20.4,.4,verb=.6)
sfx(ding([midi(77),midi(81),midi(84),midi(89)],1.6),20.9,.4,verb=.6); sfx(kick(.4,160,45,8),20.9,.35)
for j in range(9): sfx(np.sin(2*np.pi*np.cumsum(np.linspace(900,250,int(.12*SR)))/SR)*np.exp(-tt(.12)*20)+S(crush(.06)*.4,np.zeros(int(.12*SR))),21.48+j*.16,.18,pan=(-1)**j*-.5)
for k,h0 in enumerate((21.55,22.0,22.35)): sfx(pluck(midi([81,84,88][k]),.6,6,2),h0+.45,.12,verb=.6)
sfx(whoosh(.3,600,12000,2),22.7,.4)
sfx(whoosh(.3,600,10000,2.5,True),23.0,.25)
for k in range(4): sfx(S(pluck(midi([72,76,79,84][k]),.5,8,3),blip(midi([84,88,91,96][k]),.1)*.4),24.5+k*.5,.17,pan=(k-1.5)/3,verb=.4)
sfx(whoosh(.4,800,9000,2.5),27.1,.3)
for i in range(len('I want real kitchen and bath leads.')): sfx(key(),27.85+i*(1.6/35)+((i*7)%5)*.004,.16,pan=.2)
x=tt(.25); sfx(np.sin(2*np.pi*np.cumsum(np.linspace(300,1400,len(x)))/SR)*np.exp(-x*8),29.8,.22,verb=.3)
sfx(impact(.9),30.05,.75,verb=.6)
for j,x0 in enumerate([.3636,.7273,.9091,.9773]): sfx(blip(midi(89),.12),30.45+.4*x0,.3*(.55**j),verb=.5)
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
