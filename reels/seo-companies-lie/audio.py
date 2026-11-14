# Sound effects + beat bed, built from the cue sheet in sfx.json (written by: node render.js stills 0).
import json, numpy as np, wave, sys
SR=48000
d=json.load(open('sfx.json')); DUR=d['dur']
N=int(SR*DUR); L=np.zeros(N+SR); R=np.zeros(N+SR)
rng=np.random.default_rng(7)
def env(n,a,dec): t=np.arange(n)/SR; return np.minimum(t/a,1)*np.exp(-t/dec)
def lp(x,fc):  # one-pole lowpass (fc may be array)
    a=1-np.exp(-2*np.pi*np.broadcast_to(fc,x.shape)/SR); y=np.zeros_like(x); z=0.
    for i in range(len(x)): z+=a[i]*(x[i]-z); y[i]=z
    return y
def tone(f0,f1,dur,dec,a=.002):
    n=int(dur*SR); t=np.arange(n)/SR; f=f0*(f1/f0)**(t/dur); return np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,a,dec)
def noise(dur): return rng.standard_normal(int(dur*SR))
def mk(k):
    if k=='whoosh':
        n=noise(.5); t=np.linspace(0,1,len(n)); x=lp(n,300+5200*np.sin(np.pi*t)**2); x=x-lp(x,150)
        return x*np.sin(np.pi*t)**1.5*1.1
    if k=='swipe':
        n=noise(.28); t=np.linspace(0,1,len(n)); x=lp(n,1500+5000*t); return (x-lp(x,800))*np.sin(np.pi*t)**2*.5
    if k=='slam':
        x=tone(150,38,.7,.16)*1.5; c=noise(.12); c=(c-lp(c,1200))*env(len(c),.0005,.02)*.7
        x[:len(c)]+=c; tail=lp(noise(.7),500)*env(int(.7*SR),.002,.14)*1.2; return np.tanh((x+tail)*1.4)*.95
    if k=='thud2': return np.tanh(tone(110,45,.35,.09)*1.3)*.6
    if k=='pop': return tone(520,900,.09,.03)*.32
    if k=='tick':
        c=noise(.03); return (c-lp(c,3000))*env(len(c),.0005,.006)*.35+np.pad(tone(1800,1500,.02,.008)*.12,(0,int(.03*SR)-int(.02*SR)))
    if k=='key':
        c=noise(.025); return (c-lp(c,2200))*env(len(c),.0005,.005)*.22
    if k=='paper':
        c=noise(.16); x=lp(c,3500); x=(x-lp(x,600))*env(len(c),.004,.035)*.75; x[:int(.1*SR)]+=tone(140,70,.1,.03)*.35; return x
    if k=='ding':
        return (tone(1318.5,1318.5,.7,.16)+.5*tone(1975.5,1975.5,.7,.11)+.25*tone(2637,2637,.7,.07))*.2
    if k=='riser':
        n=noise(.45); t=np.linspace(0,1,len(n)); x=lp(n,400+7000*t**2); return (x-lp(x,300))*t**2*.7+tone(200,900,.45,5)*t*.12
    if k=='send':
        return tone(500,1400,.16,.08)*.3
for e in d['sfx']:
    x=mk(e['k']); i=int(e['t']*SR); pan=rng.uniform(-.25,.25) if e['k'] in('tick','key','paper','pop') else 0
    L[i:i+len(x)]+=x*(1-max(0,pan)); R[i:i+len(x)]+=x*(1+min(0,pan))
# understated bed: sub pulse + soft hat, 104 BPM, enters after the hook stamp
beat=60/104; t0=d['sfx'][0]['t']+.2; k=0
kick=np.tanh(tone(95,42,.3,.09)*1.2)*.26
hn=noise(.05); hat=(hn-lp(hn,6000))*env(len(hn),.0005,.012)*.07
while t0+k*beat/2<DUR-0.6:
    i=int((t0+k*beat/2)*SR)
    if k%2==0: L[i:i+len(kick)]+=kick; R[i:i+len(kick)]+=kick
    else: L[i:i+len(hat)]+=hat*.8; R[i:i+len(hat)]+=hat
    k+=1
tt=np.arange(N+SR)/SR
pad=(np.sin(2*np.pi*55*tt)+.5*np.sin(2*np.pi*82.4*tt)+.3*np.sin(2*np.pi*110.3*tt))*.035*(.6+.4*np.sin(2*np.pi*tt/beat/4))
L+=pad;R+=pad
M=np.stack([L[:N],R[:N]],1); f=int(.4*SR); M[-f:]*=np.linspace(1,0,f)[:,None]
M=np.tanh(M*.9); M=M/np.abs(M).max()*.89
w=wave.open('sfx.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((M*32767).astype('<i2').tobytes()); w.close()
print('ok',np.abs(M).max(), np.sqrt((M**2).mean()))
