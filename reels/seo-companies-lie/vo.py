# Eric voiceover (Kokoro am_eric, en-us, speed 1.05), one clip per sentence.
# Writes vo.wav (24 kHz voice track) and vo.js (scene + sentence timings the animation reads).
import numpy as np, soundfile as sf, json, re
from kokoro_onnx import Kokoro
import os
M=os.environ.get("KOKORO_DIR",".")  # folder holding kokoro-v1.0.onnx and voices-v1.0.bin
k=Kokoro(f"{M}/kokoro-v1.0.onnx",f"{M}/voices-v1.0.bin")
T=[0,3.9,9.4,13.5,21.0,27.8,32]
L=["Anyone who promises| you number one| on Google| is lying.",
"Google says it themselves. No one can guarantee number one. It's all up to Google.",
"Contractors report paying for months, then getting no real leads.",
"Real SEO is work. New pages for each service and city. Backlinks every month. Fix weak pages. A report every month.",
"And it takes six months or more. Need leads now? Run ads. Show up when homeowners are searching today.",
"Want kitchen and bath leads in Florida? DM us."]
SR=24000; track=np.zeros(int(40*SR),np.float32); out=[]
for i,line in enumerate(L):
    sents=re.findall(r'[^.?!]+[.?!]',line); clips=[]
    for s in sents:
        a,sr=k.create(s.replace('|','').strip(),voice="am_eric",speed=1.05,lang="en-us"); assert sr==SR
        a=a.astype(np.float32); w=int(sr*.01); e=np.sqrt(np.convolve(a**2,np.ones(w)/w,'same')); idx=np.where(e>max(e.max()*.03,1e-3))[0]
        a=a[max(0,idx[0]-int(.015*sr)):idx[-1]+int(.08*sr)]; f=int(.01*sr); a[:f]*=np.linspace(0,1,f); a[-f:]*=np.linspace(1,0,f)
        clips.append((s.strip(),a))
    LEAD=.28 if i else .2; GAP=.2; TAIL=.32 if i<5 else 1.0
    t=T[i]+LEAD; sc=[]
    for s_,a_ in clips:
        n=int(t*SR); track[n:n+len(a_)]+=a_; sc.append({"text":s_,"s":round(t,3),"e":round(t+len(a_)/SR-.08,3)}); t+=len(a_)/SR+GAP
    T[i+1]=round((t-GAP+TAIL)*30)/30
    out.append(sc); print(i,T[i],T[i+1])
sf.write("vo.wav",track[:int(T[6]*SR)],SR)
open("vo.js","w").write("window.VOT="+json.dumps({"T":T,"S":out})+";")
