import sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k=Kokoro('/opt/kokoro/kokoro-v1.0.onnx','/opt/kokoro/voices-v1.0.bin')
voice=sys.argv[1]; which=sys.argv[2]; out=sys.argv[3]
main=[(.35,3.3,'A remodeler told me he spent six thousand dollars on ads.'),(3.6,5.0,'Every lead was fake.')]
alt=[(.4,2.6,'Getting lots of leads from Meta,'),(2.8,4.4,'but nobody picks up?')]
rest=[(5.6,6.0,'Why?'),(6.2,7.4,'Some leads aren’t people.'),(7.6,8.3,'They’re bots.'),(8.6,10.6,'They fill out forms to look human.'),(11.1,13.5,'Every fake lead teaches Meta the wrong thing.'),(13.8,15.6,'So Meta sends you more bots.'),(16.6,17.7,'The fix is simple.'),(17.9,20.1,'Send clicks to a landing page you control,'),(20.3,22.3,'and put bot protection on that page.'),(23.1,24.2,'Fewer fake leads.'),(24.4,26.6,'Meta learns to send real homeowners.'),(27.6,29.8,'Want real kitchen and bath leads in Florida?'),(30.0,30.7,'DM us.')]
lines=(main if which=='main' else alt)+rest
if which=='audition': lines=main
SR=24000; trackL=int((5.6 if which=='audition' else 32)*SR); track=np.zeros(trackL)
def trim(a,th=.01):
    idx=np.where(np.abs(a)>th)[0]; return a[max(0,idx[0]-120):idx[-1]+240] if len(idx) else a
nxt=[l[0] for l in lines[1:]]+[32]
for i,(s,e,txt) in enumerate(lines):
    room=min(nxt[i]-.08,e+.35)-s   # may spill slightly past nominal end, never into next line
    sp=1.05
    for _ in range(4):
        a,sr=k.create(txt,voice=voice,speed=sp,lang='en-us'); a=trim(a); d=len(a)/sr
        if d<=room or sp>=1.35: break
        sp=min(1.35,sp*d/room*1.02)
    st=int(s*SR); a=a[:trackL-st]; track[st:st+len(a)]+=a
    print(f'{s:5.2f}s  {d:4.2f}s/{room:4.2f}s  speed {sp:.2f}  {txt}',file=sys.stderr)
sf.write(out,track/np.max(np.abs(track))*.9,SR)
