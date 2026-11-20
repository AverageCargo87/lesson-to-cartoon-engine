import {chromium} from 'playwright';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';
await ensureServer();
import sharp from 'sharp';
import fs from 'node:fs';

const ARGV=process.argv.slice(2),FLAG=Object.fromEntries(ARGV.filter(a=>a.startsWith('--')).map(a=>{const [k,...v]=a.slice(2).split('=');return [k,v.length?v.join('='):'1'];})),POS=ARGV.filter(a=>!a.startsWith('--'));
const adres=sceneUrl;
const razmery=(def=['735x587','874x648','1440x900'])=>{const r=(FLAG.razmery?FLAG.razmery.split(','):def).map(s=>s.trim().split(/[x×]/).map(Number));if(FLAG.plus815&&!r.some(([w,h])=>w===735&&h===815))r.push([735,815]);return r;};
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

const url=adres(POS[0]||'demo/fire/index.html'),variants=POS.slice(1);
const MODE=process.env.PROBES||'auto';
const HEADED=!!process.env.HEADED,DSF=+(process.env.DSF||1);
const b=await chromium.launch({...launchOpts(),headless:!HEADED});


const N=+(FLAG.n||10),TOLKO=process.env.TOLKO?process.env.TOLKO.split(','):null;

const HIDE='#cv{visibility:hidden!important}html,body{background:#8a8a8a!important}#fx,#gl{display:none!important}.mk-cap{display:none!important}.kd-c{visibility:hidden!important}'+
 '.kd-b,.kd-b *{color:transparent!important;-webkit-text-stroke:0!important;text-shadow:none!important}';   
const raf=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function grab(p,clip){const png=await p.screenshot({clip,type:'png'});const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});return {data,w:info.width,h:info.height};}
function centroid(A,B){
 let sx=0,sy=0,n=0;const W=A.w,H=A.h,wv=new Float32Array(W*H);
 for(let i=0,k=0;k<W*H;i+=3,k++){const w=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);wv[k]=w;if(w>6){sx+=(k%W)*w;sy+=((k/W)|0)*w;n+=w;}}
 let g=0;for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x;g+=Math.hypot(wv[k+1]-wv[k-1],wv[k+W]-wv[k-W]);}
 return n?{x:sx/n,y:sy/n,n,sharp:g/n}:null;
}

async function naytiProby(p,VW,VH){
 return p.evaluate(({N,TOLKO,VW,VH})=>{
  const K=window.kino,M=window.multik,OV=document.getElementById('ov'),STEP=1/30,LEN=24;   
  const SKIP=/(^|\s)(onboard|badge|ltitle|lunder|litem|lq|wtag)(\s|$)/;
  const els=[...OV.children].map((e,i)=>({e,i})).filter(({e})=>!SKIP.test(e.className)&&e.textContent.trim()&&(!TOLKO||TOLKO.some(s=>e.textContent.includes(s))));
  const op=e=>+(e.style.opacity===''?1:e.style.opacity);
  const shown=e=>{for(const x of [e,e.querySelector('.tx')]){if(!x)continue;const m=(x.style.clipPath||'').match(/inset\(([-\d.]+)%\s+([-\d.]+)%/);if(m&&+m[2]>0.5)return false;}
   for(const q of e.querySelectorAll('.ch,.cut b'))if(q.style.opacity!==''&&+q.style.opacity<.99)return false;return true;};
  const CUTS=(K.MV||[]).filter(m=>/^cut/.test(m.kind)).map(m=>m.t),FL=K.FL;
  const S=els.map(()=>[]),mot=[];let P=null;
  for(let t=0;t<=M.total;t+=STEP){M.seek(t);const V=K.view();
   const pan=P?Math.hypot(V.x-P.x,V.y-P.y)*V.Z/2:0,zoom=P?Math.abs(Math.log(V.Z/P.Z))*VW/2:0;   
   const bad=(FL&&FL.a>.02)||CUTS.some(c=>Math.abs(c-t)<.3)||((K.cam.f||0)+(K.cam.g||0)>.001)||document.body.classList.contains('board');
   mot.push({t,pan,zoom,bad});P={x:V.x,y:V.y,Z:V.Z};
   els.forEach(({e},j)=>{if(bad||op(e)<.99||!shown(e)){S[j].push(0);return;}
    const L=parseFloat(e.style.left),T=parseFloat(e.style.top),X=V.sx+(L-V.x)*V.Z,Y=V.sy+(T-V.y)*V.Z,hw=e.offsetWidth*V.Z/2+3,hh=e.offsetHeight*V.Z/2+3;
    S[j].push(X-hw>4&&X+hw<VW-4&&Y-hh>4&&Y+hh<VH-4&&hw>6?1:0);});
  }
  const cand=[];
  els.forEach(({e,i},j)=>{let best=null;const s=S[j];
   for(let a=0;a+LEN<=s.length;a++){let ok=true,sc=0,zs=0;for(let k=a;k<a+LEN;k++){if(!s[k]){ok=false;break;}sc+=mot[k].pan+3*mot[k].zoom;zs+=mot[k].zoom;}
    if(ok&&sc>LEN*.05&&(!best||sc>best.sc))best={a,sc,zs};}
   const L=parseFloat(e.style.left),T=parseFloat(e.style.top),W=(K.WINS||[]).find(W=>L>=W.x-5&&L<=W.x+W.w+5&&T>=W.y-5&&T<=W.y+W.h+5);
   if(best)cand.push({i,okno:W?W.num:0,text:e.textContent.replace(/\s+/g,' ').trim().slice(0,40),cls:e.className.split(' ')[0],a:+(best.a*STEP).toFixed(3),z:+((best.a+LEN-1)*STEP).toFixed(3),
    skor:+(best.sc/LEN).toFixed(2),zoom:+(best.zs/LEN).toFixed(2)});});
  
  const seen=new Set(),perW={},res=[];
  for(const c of cand.sort((x,y)=>y.skor-x.skor)){if(seen.has(c.text)||(perW[c.okno]||0)>=2)continue;seen.add(c.text);perW[c.okno]=(perW[c.okno]||0)+1;res.push(c);if(res.length>=N)break;}
  return res.sort((x,y)=>x.a-y.a);
 },{N,TOLKO,VW,VH});
}
async function svoi(p,list){   
 return p.evaluate(list=>list.map(([text,a,z])=>{const ch=[...document.getElementById('ov').children];const i=ch.findIndex(e=>!e.classList.contains('onboard')&&e.textContent.includes(text));
  return i<0?{text,miss:true}:{i,text:ch[i].textContent.replace(/\s+/g,' ').trim().slice(0,40),cls:ch[i].className.split(' ')[0],a,z};}),list);
}
const OUT={url,dsf:DSF,mode:MODE,sizes:{}};
const SIZES=process.env.VW?[[+process.env.VW,+(process.env.VH||815)]]:razmery();
for(const [VW,VH] of SIZES){
 for(const css of ['',...variants]){
  
  const {ctx,p,errs}=await otkryt(b,url,[VW,VH],process.env.REDUCE?{dsf:DSF,wait:500,reduce:true}:{dsf:DSF,wait:500,init:()=>{performance.now=()=>0;}});   
  await p.evaluate(()=>document.fonts.ready);
  const probes=MODE==='auto'?await naytiProby(p,VW,VH):await svoi(p,MODE.split(';').map(s=>{const [t,r]=s.split('@');const [a,z]=r.split('-').map(Number);return [t,a,z];}));
  await p.addStyleTag({content:HIDE+(css||'')});
  const res={};
  for(const pr of probes){
   const id=`${pr.text}`+(pr.miss?'':` @${pr.a.toFixed(2)}-${pr.z.toFixed(2)}`);
   if(pr.miss){res[id]='no label';continue;}
   await p.evaluate(i=>{document.querySelectorAll('.kd-probe').forEach(e=>e.classList.remove('kd-probe'));document.getElementById('ov').children[i].classList.add('kd-probe');},pr.i);
   const d=[];let w0=0;
   
   for(let i=15;i>0;i--){await p.evaluate(t=>window.multik.seek(t),pr.a-i/60);await raf(p);if(i<=3)await p.screenshot({clip:{x:0,y:0,width:64,height:64}});}
   for(let i=0;pr.a+i/60<=pr.z+1e-6;i++){
    const t=pr.a+i/60;
    await p.evaluate(t=>window.multik.seek(t),t);await raf(p);
    const rect=await p.evaluate(()=>{const el=document.querySelector('.kd-probe');const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,o:+getComputedStyle(el).opacity};});
    if(rect.o<.99||rect.w<8||rect.x<0||rect.y<0||rect.x+rect.w>VW||rect.y+rect.h>VH)continue;
    
    const G=8,x0=Math.floor((rect.x-10)/G)*G,y0=Math.floor((rect.y-10)/G)*G;
    const clip={x:Math.max(0,x0),y:Math.max(0,y0),width:Math.ceil((rect.x+rect.w+14-Math.max(0,x0))/G)*G,height:Math.ceil((rect.y+rect.h+14-Math.max(0,y0))/G)*G};
    clip.width=Math.min(clip.width,Math.floor((VW-clip.x)/G)*G);clip.height=Math.min(clip.height,Math.floor((VH-clip.y)/G)*G);
    const A=await grab(p,clip);
    await p.evaluate(()=>document.querySelector('.kd-probe').classList.add('kd-b'));await raf(p);
    const B=await grab(p,clip);
    await p.evaluate(()=>{const e=document.querySelector('.kd-probe');e.classList.remove('kd-b');e.classList.add('kd-c');});await raf(p);
    const C=await grab(p,clip);
    await p.evaluate(()=>document.querySelector('.kd-probe').classList.remove('kd-c'));
    const k=A.w/clip.width,Lc=centroid(A,B);let Pc=centroid(B,C);if(!Lc)continue;
    if(Pc&&Pc.n<.15*Lc.n)Pc=null;   
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2;if(!w0)w0=rect.w;const s=w0/rect.w;   
    d.push({t,L:[(clip.x+Lc.x/k-cx)*s,(clip.y+Lc.y/k-cy)*s],P:Pc?[(clip.x+Pc.x/k-cx)*s,(clip.y+Pc.y/k-cy)*s]:null,sh:Lc.sharp,z:1/s});
   }
   if(process.env.DUMP)for(const q of d)console.log('   ',q.t.toFixed(3),'L',q.L.map(v=>v.toFixed(2)).join(','),'P',q.P?q.P.map(v=>v.toFixed(2)).join(','):'-','sh',q.sh.toFixed(2));
   const jump=(f,dd=d)=>{const j=dd.slice(1).map((q,i)=>Math.hypot(f(q)[0]-f(dd[i])[0],f(q)[1]-f(dd[i])[1]));const mean=j.reduce((a,v)=>a+v,0)/(j.length||1),mx=Math.max(0,...j);return {mean:+mean.toFixed(3),max:+mx.toFixed(3),at:+(dd[j.indexOf(mx)+1]?.t||0).toFixed(2),n02:j.filter(v=>v>.2).length};};
   const dp=d.filter(q=>q.P);
   res[id]={kadrov:d.length,cls:pr.cls,a:pr.a,z:pr.z,dvizhenie:pr.skor!=null?{skor:pr.skor,zoom:pr.zoom}:null,bukvy:jump(q=>q.L),
    plashka:dp.length>1&&dp.length>=.8*d.length?jump(q=>q.P,dp):null,bukvyPlashka:dp.length>1&&dp.length>=.8*d.length?jump(q=>[q.L[0]-q.P[0],q.L[1]-q.P[1]],dp):null,
    rezkost:+(d.reduce((a,q)=>a+q.sh,0)/(d.length||1)).toFixed(3),masshtab:d.length?`${d[0].z.toFixed(3)}→${d[d.length-1].z.toFixed(3)}`:''};
  }
  const key=`${VW}x${VH}`+(css?' css: '+css:'');
  console.log(`\n== ${VW}x${VH} @${DSF}${HEADED?', headed':''}${css?' · with CSS: '+css:' · as is'}  (${MODE==='auto'?'probes from the scene':'own probes'}: ${probes.length})`);
  for(const [id,r] of Object.entries(res)){if(typeof r==='string'){console.log('  '+id+': '+r);continue;}
   const f=(q,n)=>q?`${n} ${q.mean.toFixed(2)}/${q.max.toFixed(2)}`:`${n} -`;
   console.log(`  "${id}" frames ${String(r.kadrov).padStart(3)} · ${f(r.bukvy,'letters')} · ${f(r.plashka,'plate')} · ${f(r.bukvyPlashka,'letters/plate')}${r.bukvyPlashka?` (at ${r.bukvyPlashka.at}, jumps>0.2px: ${r.bukvyPlashka.n02})`:` (jumps>0.2px: ${r.bukvy.n02})`} · sharpness ${r.rezkost} · scale ${r.masshtab}${r.dvizhenie?` · camera motion ${r.dvizhenie.skor} (zoom ${r.dvizhenie.zoom} px/frame)`:''}`);}
  if(errs.length)console.log('  console:\n   '+[...new Set(errs)].join('\n   '));
  OUT.sizes[key]={probes:res,errs:[...new Set(errs)]};
  await ctx.close();
 }
}
await b.close();
if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
