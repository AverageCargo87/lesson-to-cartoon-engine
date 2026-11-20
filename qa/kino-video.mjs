import {chromium} from 'playwright';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';
await ensureServer();
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ARGV=process.argv.slice(2),FLAG=Object.fromEntries(ARGV.filter(a=>a.startsWith('--')).map(a=>{const [k,...v]=a.slice(2).split('=');return [k,v.length?v.join('='):'1'];})),POS=ARGV.filter(a=>!a.startsWith('--'));
const adres=sceneUrl;
async function otkryt(b,url,[W,H],{dsf=1,reduce=false,wait=500,init=null}={}){
 const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:dsf,reducedMotion:reduce?'reduce':'no-preference'});
 const p=await ctx.newPage(),errs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if((m.type()==='error'||m.type()==='warning')&&!/^Failed to load resource/.test(m.text()))errs.push(m.type()+': '+m.text());});
 p.on('response',r=>{if(r.status()>=400&&!/favicon/.test(r.url()))errs.push(r.status()+' '+r.url());});
 if(init)await p.addInitScript(init);
 if(process.env.KINO){const k=url.split('?')[0].replace(/[^/]*$/,'')+'kino.js';await p.route(u=>u.href.split('?')[0]===k,r=>r.fulfill({path:process.env.KINO,contentType:'text/javascript'}));}
 await p.goto(url,{waitUntil:'networkidle',timeout:180000});
 await p.waitForFunction(()=>window.multik&&window.kino&&window.kino.MV&&window.kino.MV.length,null,{timeout:180000});
 await p.waitForTimeout(wait);
 return {ctx,p,errs};
}

const url=adres(POS[0]||'demo/fire/index.html'),scena=url.split('?')[0].replace(/\/[^/]*$/,'').split('/').pop();
const FPS=+(FLAG.fps||30),CRF=+(FLAG.crf||18),NSV=+(FLAG.sverka??3);
const REZ=(FLAG.rezhim||'oba')==='oba'?[[735,587],[1280,720]]:FLAG.rezhim.split(',').map(s=>s.split(/[x×]/).map(Number));
const OUTDIR=path.resolve(FLAG.out||'release-assets/video');fs.mkdirSync(OUTDIR,{recursive:true});
if(spawnSync('ffmpeg',['-version']).status!==0){console.error('ffmpeg is not on PATH');process.exit(2);}

const INIT=()=>{
 window.__vt=0;performance.now=()=>window.__vt;
 const VS=new WeakMap();
 
 window.__kadr=t=>{window.__vt=t*1000;window.multik.seek(t);
  for(const a of document.getAnimations()){a.pause();
   if(typeof CSSAnimation!=='undefined'&&a instanceof CSSAnimation)a.currentTime=t*1000;
   else{if(!VS.has(a))VS.set(a,t);a.currentTime=Math.max(0,(t-VS.get(a))*1000);}}};
 
 window.__dovesti=()=>{for(const a of document.getAnimations()){if(typeof CSSAnimation!=='undefined'&&a instanceof CSSAnimation)continue;VS.set(a,-1e6);a.pause();try{a.currentTime=1e9;}catch(e){}}};
};
const HIDE='.mk-bar,.mk-again,.mk-big,.mk-cover,.mk-fin,.mk-play{visibility:hidden!important}'+(FLAG['bez-subtitrov']?'.mk-cap{visibility:hidden!important}':'');
const raf=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function prigotovit(b,W,H){
 const o=await otkryt(b,url,[W,H],{wait:800,init:INIT});
 await o.p.addStyleTag({content:HIDE});
 await o.p.evaluate(()=>document.fonts.ready);
 
 await o.p.waitForTimeout(1500);
 return o;
}
async function rgb(buf,W2,H2){const {data}=await sharp(buf).extract({left:0,top:0,width:W2,height:H2}).removeAlpha().raw().toBuffer({resolveWithObject:true});return data;}

async function seroe(buf,W2,H2){const {data}=await sharp(buf).extract({left:0,top:0,width:W2,height:H2}).resize(W2>>1,H2>>1).greyscale().blur(.8).raw().toBuffer({resolveWithObject:true});return data;}
function psnr(a,b){let s=0;for(let i=0;i<a.length;i++){const d=a[i]-b[i];s+=d*d;}const mse=s/a.length;return mse<1e-9?99:10*Math.log10(255*255/mse);}

const b=await chromium.launch({...launchOpts()});
const ITOG=[];
for(const [W,H] of REZ){
 const W2=W&~1,H2=H&~1;   
 const {ctx,p,errs}=await prigotovit(b,W,H);
 const info=await p.evaluate(()=>({total:window.multik.total,audio:window.multik.audio.currentSrc||window.multik.audio.src,beats:window.multik.beats.map(b=>[b.start,b.end]),MV:window.kino.MV.filter(m=>!/^cut/.test(m.kind)).map(m=>[m.t,m.end])}));
 const t0=Math.max(0,+(FLAG.ot||0)),t1=Math.min(info.total-.05,FLAG.do!=null?+FLAG.do:info.total-.05),N=Math.max(1,Math.floor((t1-t0)*FPS)+1);
 
 const mp3=path.join(OUTDIR,`${scena}-narration.mp3`);
 const ar=await ctx.request.get(info.audio);if(!ar.ok())throw new Error('the audio track did not download: '+ar.status()+' '+info.audio);
 fs.writeFileSync(mp3,await ar.body());
 
 const near=t=>info.beats.some(([a,z])=>Math.abs(t-a)<.7||Math.abs(t-z)<.7);
 const moving=k=>{const t=t0+k/FPS;return info.MV.some(([a,z])=>t>a+.25&&t<z-.25);};
 const SV=[];const cand=[];for(let k=1;k<N-1;k++)if(moving(k)&&!near(t0+k/FPS))cand.push(k);
 for(let j=1;j<=NSV;j++){let k;if(cand.length>=NSV)k=cand[Math.round((cand.length-1)*(j-.5)/NSV)];
  else{k=Math.round((N-1)*j/(NSV+1));for(let d=0;d<FPS*3&&near(t0+k/FPS);d++)k=Math.min(N-2,Math.max(1,k+(d%2?d:-d)));}
  SV.push(Math.min(N-2,Math.max(1,k)));}
 const keep=new Map();
 const imya=`${scena}-${W}x${H}`+(FLAG.ot||FLAG.do?`-${t0.toFixed(1)}-${t1.toFixed(1)}`:'');
 const mp4=path.join(OUTDIR,imya+'.mp4');
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v',FLAG.png?'png':'mjpeg','-i','-',
  '-ss',t0.toFixed(3),'-t',(N/FPS+.5).toFixed(3),'-i',mp3,'-map','0:v','-map','1:a',
  '-vf',`crop=${W2}:${H2}:0:0,format=yuv420p`,'-c:v','libx264','-preset','medium','-crf',String(CRF),'-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',mp4],{stdio:['pipe','inherit','inherit']});
 const ffDone=new Promise(r=>ff.on('close',r));
 await p.evaluate(t=>{window.__kadr(t);},t0);await p.waitForTimeout(700);await p.evaluate(()=>window.__dovesti());
 const tStart=Date.now();
 for(let i=0;i<N;i++){
  const t=t0+i/FPS;
  await p.evaluate(t=>window.__kadr(t),t);await raf(p);
  const buf=FLAG.png?await p.screenshot({type:'png'}):await p.screenshot({type:'jpeg',quality:+(FLAG.jpeg||95)});
  if(SV.some(k=>Math.abs(k-i)<=1))keep.set(i,FLAG.png?buf:await p.screenshot({type:'png'}));   
  if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
  if(i%150===0&&i)process.stdout.write(`  ${W}x${H}: ${i}/${N} frames (${((Date.now()-tStart)/i).toFixed(0)} ms/frame)\n`);
 }
 ff.stdin.end();const code=await ffDone;
 await ctx.close();
 if(code!==0){console.log(`✗ ${W}x${H}: ffmpeg exited with code ${code}`);ITOG.push({W,H,ok:false});continue;}
 const pr=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=nb_read_frames,width,height,r_frame_rate','-show_entries','format=duration','-of','json',mp4]);
 const meta=JSON.parse(pr.stdout.toString());
 
 const sv=[];
 const fresh=await prigotovit(b,W,H);
 for(const k of SV){
  const t=t0+k/FPS,png=path.join(OUTDIR,`${imya}-sverka-${k}.png`);
  spawnSync('ffmpeg',['-y','-loglevel','error','-i',mp4,'-vf',`select=eq(n\\,${k})`,'-vsync','0','-frames:v','1',png]);
  await fresh.p.evaluate(t=>window.__kadr(t),t);await fresh.p.waitForTimeout(600);await fresh.p.evaluate(t=>{window.__dovesti();window.__kadr(t);},t);await raf(fresh.p);
  const seekPng=await fresh.p.screenshot({type:'png'});fs.writeFileSync(path.join(OUTDIR,`${imya}-sverka-${k}-seek.png`),seekPng);
  const V=await rgb(fs.readFileSync(png),W2,H2),S=await rgb(seekPng,W2,H2);
  const Vs=await seroe(fs.readFileSync(png),W2,H2);
  const sos={};for(const d of [-1,0,1])if(keep.has(k+d))sos[d]=+psnr(Vs,await seroe(keep.get(k+d),W2,H2)).toFixed(1);
  const best=Object.entries(sos).sort((a,b)=>b[1]-a[1])[0];
  const snyatSeek=keep.has(k)?+psnr(await rgb(keep.get(k),W2,H2),S).toFixed(1):null;   
  sv.push({k,t:+t.toFixed(3),psnrSeek:+psnr(V,S).toFixed(1),snyatSeek,tochno:snyatSeek>=60,sosedi:sos,nomer:best&&(+best[0]===0||sos[0]===best[1])?'match':`closer frame ${best?.[0]}`});
 }
 await fresh.ctx.close();
 const ok=sv.every(s=>s.psnrSeek>=30&&s.nomer==='match'&&s.tochno);
 const st=meta.streams?.[0]||{};
 console.log(`${ok?'✓':'✗'} ${W}x${H}: ${mp4}\n   ${st.width}x${st.height}, ${st.r_frame_rate} fps, frames ${st.nb_read_frames} (captured ${N}), duration ${(+meta.format?.duration||0).toFixed(2)} s, stretch ${t0.toFixed(2)}-${t1.toFixed(2)} s, ${((Date.now()-tStart)/1000).toFixed(0)} s of work`);
 for(const s of sv)console.log(`   check frame ${s.k} (${s.t} s): video vs seek PSNR ${s.psnrSeek} dB · captured vs seek (no codec) ${s.snyatSeek} dB · video vs captured k-1/k/k+1 (grey, half size) ${[-1,0,1].map(d=>s.sosedi[d]??'-').join(' / ')} dB, frame number ${s.nomer}`);
 if(errs.length)console.log('   console:\n    '+[...new Set(errs)].join('\n    '));
 ITOG.push({W,H,mp4,ok,kadrov:+st.nb_read_frames,snyato:N,dlit:+meta.format?.duration,sverka:sv,errs:[...new Set(errs)]});
}
await b.close();
fs.writeFileSync(path.join(OUTDIR,`${scena}-video.json`),JSON.stringify({url,fps:FPS,itog:ITOG},null,1));
process.exit(ITOG.every(x=>x.ok)?0:1);
