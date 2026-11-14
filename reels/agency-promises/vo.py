import numpy as np, soundfile as sf, json
from kokoro_onnx import Kokoro
k=Kokoro('/opt/kokoro/kokoro-v1.0.onnx','/opt/kokoro/voices-v1.0.bin')
L=["A remodeler said this.","And I get it.","They promise the world to win your account.","Then you check your CRM, and it's mostly spam leads.",
"Before you hire anyone, ask three things.","Who checks the leads?","How fast do you call back?","Do you track booked consults, or just clicks?",
"If they only talk about clicks, walk away.","Leads don't pay you.","Booked jobs do.","Want kitchen and bath leads that turn into booked consults?","DM us."]
def trim(a,th=.01):
    i=np.where(np.abs(a)>th)[0]; return a[max(0,i[0]-120):i[-1]+240]
info=[]
for n,t in enumerate(L):
    a,sr=k.create(t,voice='am_eric',speed=1.05,lang='en-us'); a=trim(a); sf.write(f'l{n:02d}.wav',a,sr); info.append([t,round(len(a)/sr,3)])
json.dump(info,open('durs.json','w'),indent=0); [print(f'{d:5.2f}s  {t}') for t,d in info]; print('total',round(sum(d for _,d in info),2))
