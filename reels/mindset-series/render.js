// node render_any.js <page.html> <query> <out.mp4>   (streams PNG frames into ffmpeg; video only)
const {chromium}=require('playwright');const path=require('path');const {spawn}=require('child_process');
const [page,query,outp]=process.argv.slice(2);const NW=4;
(async()=>{const browser=await chromium.launch();
 const pages=await Promise.all([...Array(NW)].map(async()=>{const p=await browser.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
   await p.goto('file://'+path.resolve(page)+'?render'+query);await p.evaluate(()=>window.ready);return p}));
 const total=Math.round(await pages[0].evaluate(()=>DUR)*60);
 const ff=spawn('ffmpeg',['-loglevel','error','-y','-f','image2pipe','-framerate','60','-c:v','png','-i','-','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p',outp]);
 const done=new Map();let next=0;const write=async()=>{while(done.has(next)){const b=done.get(next);done.delete(next);next++;if(!ff.stdin.write(b))await new Promise(r=>ff.stdin.once('drain',r))}};
 await Promise.all(pages.map(async(p,w)=>{for(let f=w;f<total;f+=NW){while(f-next>40)await new Promise(r=>setTimeout(r,20));const d=await p.evaluate(f=>{renderFrame(f);return cv.toDataURL('image/png')},f);done.set(f,Buffer.from(d.split(',')[1],'base64'));await write()}}));
 ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('ok',outp,total);await browser.close()})();
