import numpy as np, soundfile as sf, json
from kokoro_onnx import Kokoro
k=Kokoro('/opt/kokoro/kokoro-v1.0.onnx','/opt/kokoro/voices-v1.0.bin')
R=[("THE SEED",["You don't throw seeds away.","You plant them.","Working with us is planting.","Booked consults are the harvest."]),
("TWO REMODELERS",["Same skills, same city.","One waits for the phone.","One invests in a team that fills his calendar.","Guess who's booked."]),
("THE MATH FLIP",["Your first job from us pays us back.","Every job after that is money in your pocket."]),
("CHEAP IS EXPENSIVE",["Not hiring help to save money?","You just paid for it with empty weeks."]),
("THE FREE-WORK MYTH",["Nobody calls us asking us to work for free.","And you shouldn't build kitchens for free either.","Invest in leads that pay."]),
("THE RICH REMODELER'S SECRET",["Big remodelers don't get lucky.","They invest in growth first."]),
("YOUR TOOLS",["You bought tools to make money.","We're a tool too.","One that books consults."]),
("EMPTY CALENDAR",["An empty calendar costs more than hiring us ever will."]),
("THE SCARED MONEY TEST",["Scared to invest a dollar to make five?","That's not saving.","That's staying small."]),
("THE COUNTDOWN",["Today you invest with us.","Next month, consults on your calendar.","A few jobs later, it's paid for itself."])]
def trim(a,th=.01):
    i=np.where(np.abs(a)>th)[0]; return a[max(0,i[0]-120):i[-1]+240]
out=[]
for r,(title,lines) in enumerate(R):
    t=0.45; L=[]
    for n,txt in enumerate(lines+["DM us."]):
        a,sr=k.create(txt,voice='am_eric',speed=1.05,lang='en-us'); a=trim(a); d=len(a)/sr
        if n==len(lines):  # CTA: card in, typing, send, then "DM us."
            c0=t+0.75; t=c0+2.85
        sf.write(f'vo/r{r:02d}_{n}.wav',a,sr); L.append([round(t,3),round(t+d,3),txt]); t+=d+(0.45 if txt.endswith(('.','?')) else 0.3)
    dur=round(L[-1][1]+1.1,2)
    out.append({"title":title,"vo":L,"cta":round(c0,3),"dur":dur})
    print(f"{r+1:2d} {title:28s} {dur:5.2f}s  "+" | ".join(f"{s:.2f}-{e:.2f}" for s,e,_ in L))
json.dump(out,open('reels.json','w'),indent=1)
