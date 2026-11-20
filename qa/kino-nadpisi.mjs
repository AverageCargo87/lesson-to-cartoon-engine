import {chromium} from 'playwright';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';
import fs from 'node:fs';
await ensureServer();

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

const url=adres(POS[0]||'krit-dvorec'),STEP=+(POS[1]||.2),OLD=!!FLAG['tolko-staroe'];
const b=await chromium.launch({...launchOpts()});
const ranges=a=>{const r=[];for(const t of a){const l=r[r.length-1];if(l&&t-l[1]<=STEP*1.5)l[1]=t;else r.push([t,t]);}return r.map(([x,y])=>x===y?x.toFixed(1):`${x.toFixed(1)}-${y.toFixed(1)}`).join(', ');};
const dlit=a=>{const r=[];for(const t of a){const l=r[r.length-1];if(l&&t-l[1]<=STEP*1.5)l[1]=t;else r.push([t,t]);}return r;};
const OUT={url,step:STEP,sizes:{}};

if(FLAG.doska){
 if(FLAG.snimki)fs.mkdirSync(FLAG.snimki,{recursive:true});
 for(const [W,H] of razmery()){
  const {ctx,p,errs}=await otkryt(b,url,[W,H],{wait:1300});
  await p.evaluate(()=>{window.multik.seek(window.multik.total-.06);window.multik.finish();});
  await p.waitForTimeout(2500);
  const measure=tag=>p.evaluate(tag=>{
   const box=e=>e.getBoundingClientRect(),hit=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
   const seen=e=>{const cs=getComputedStyle(e);return cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>.3;};
   const blockers=[...document.querySelectorAll('#bd .bd-back,#bd .bd-fact,#bd .bd-bar,#bd .bd-quizbtn')].filter(e=>seen(e)&&!e.classList.contains('hide')&&(e.classList.contains('show')||!/bd-back|bd-fact/.test(e.className)));
   const res=[];
   for(const e of document.querySelectorAll('#ov .onboard')){const r=box(e);if(r.right<0||r.left>innerWidth||r.bottom<0||r.top>innerHeight||!seen(e))continue;
    const t=e.textContent.trim().replace(/\s+/g,' ').slice(0,40);
    if(!(r.left>=1&&r.top>=1&&r.right<=innerWidth-1&&r.bottom<=innerHeight-1))res.push(`cut by the edge: "${t}"`);
    for(const bl of blockers)if(hit(r,box(bl)))res.push(`under ${bl.className.split(' ').filter(c=>c.startsWith('bd-')).join('.')}: "${t}"`);}

   const K=window.kino,F=K.free,Wf=F&&F.focus;let okno=null;
   if(Wf&&F.on){const sx=x=>(x-F.x)*F.Z+innerWidth/2,sy=y=>(y-F.y)*F.Z+F.sy;const r={left:sx(Wf.x),top:sy(Wf.y),right:sx(Wf.x+Wf.w),bottom:sy(Wf.y+Wf.h)};
    okno={celikom:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,pod:blockers.filter(bl=>hit(r,box(bl))).map(bl=>bl.className.split(' ').filter(c=>c.startsWith('bd-')).join('.'))};
    if(!okno.celikom)res.push('the window is not fully visible');}
   const fact=document.querySelector('.bd-fact');const fr=fact&&box(fact);
   return {tag,res,okno,fact:fact&&getComputedStyle(fact).opacity>.5?[Math.round(fr.top),Math.round(fr.bottom),Math.round(fr.width)]:null};
  },tag);
  const rep=[await measure('overview')];
  if(FLAG.snimki)await p.screenshot({path:`${FLAG.snimki}/${W}x${H}_doska-obshiy.png`});
  const n=await p.evaluate(()=>window.kino.WINS.length);
  for(let i=0;i<n;i++){
   await p.evaluate(i=>window.kino.focus(window.kino.WINS[i]),i);await p.waitForTimeout(2200);
   if(FLAG.snimki)await p.screenshot({path:`${FLAG.snimki}/${W}x${H}_doska-okno${i+1}.png`});
   rep.push(await measure('window '+(i+1)+' '+await p.evaluate(i=>window.kino.WINS[i].id,i)));
  }
  console.log(`\n== BOARD ${W}x${H}`);
  let bad=0;for(const r of rep){bad+=r.res.length;console.log(`${r.res.length?'✗':'✓'} ${r.tag}${r.fact?`  (fact card: y ${r.fact[0]}-${r.fact[1]}, width ${r.fact[2]})`:''}${r.res.length?'\n     - '+r.res.join('\n     - '):''}`);}
  console.log(`  board total: remarks ${bad}`);if(errs.length)console.log('  console:\n   '+[...new Set(errs)].join('\n   '));
  OUT.sizes[`${W}x${H}`]={doska:rep,zamechaniy:bad,errs:[...new Set(errs)]};
  await ctx.close();
 }
 await b.close();
 if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
 process.exit(0);
}

for(const [W,H] of razmery()){
 const {ctx,p,errs}=await otkryt(b,url,[W,H]);
 const res=await p.evaluate(async({step,OLD})=>{
  const out={},total=window.multik.total,K=window.kino;document.body.classList.add('mk-started');
  const box=e=>e.getBoundingClientRect(),hit=(a,b)=>a.left<b.right-2&&a.right>b.left+2&&a.top<b.bottom-2&&a.bottom>b.top+2;
  const SKIP=/(^|\s)(onboard|badge|ltitle|lunder)(\s|$)/;
  const els=OLD?[...document.querySelectorAll('#ov .inwin')]:[...document.querySelectorAll('#ov>*')].filter(e=>!SKIP.test(e.className));

  const keyOf=e=>e.classList.contains('inwin')?e.textContent.trim().slice(0,40):e.className.split(' ')[0]+' "'+e.textContent.trim().replace(/\s+/g,' ').slice(0,36)+'"';
  const WINS=K.WINS||[];
  const winAt=(x,y,m=0)=>WINS.find(W=>x>=W.x-m&&x<=W.x+W.w+m&&y>=W.y-m&&y<=W.y+W.h+m)||null;
  const WOF=new Map(els.map(e=>[e,winAt(parseFloat(e.style.left),parseFloat(e.style.top),5)]));
  const badges=[...document.querySelectorAll('#ov .badge')];
  const extra={badge:{},capCut:[],capChap:[],chapCut:[],chapters:{}};
  const visited=new Set(),first={};
  for(let t=.2;t<total-.1;t+=step){window.multik.seek(t);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const T=+t.toFixed(1);
   const capEl=document.querySelector('.mk-cap'),cap=document.querySelector('.mk-cap .strip');
   const capOn=cap&&+getComputedStyle(capEl).opacity>.5&&cap.textContent.trim();
   const bar=document.querySelector('.mk-bar');
   const V=K.view(),fin=((K.cam&&K.cam.f)||0)+((K.cam&&K.cam.g)||0)>.02,board=document.body.classList.contains('board');
   const toS=(bx,by)=>[(bx-V.x)*V.Z+V.sx,(by-V.y)*V.Z+V.sy];
   const camWin=fin||board?null:winAt(V.x,V.y);if(camWin)visited.add(camWin);

   const seen=e=>{const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>.5;};
   const chs=[],chBoxes=[];
   for(const e of document.querySelectorAll('.chapter')){if(!seen(e))continue;const kids=[...e.children].filter(seen);if(e.children.length&&!kids.length)continue;
    const bs=(kids.length?kids:[e]).map(box);chs.push(e);chBoxes.push({left:Math.min(...bs.map(q=>q.left)),top:Math.min(...bs.map(q=>q.top)),right:Math.max(...bs.map(q=>q.right)),bottom:Math.max(...bs.map(q=>q.bottom))});}
   if(!OLD){
    for(const [i,e] of chs.entries()){const r=chBoxes[i],k=([...e.querySelectorAll('*')].filter(c=>!c.children.length).map(c=>c.textContent.trim()).filter(Boolean).join(' · ')||e.textContent.trim()).slice(0,48);(extra.chapters[k]||(extra.chapters[k]=[])).push(T);
     if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)extra.chapCut.push(T+' '+k);
     if(capOn&&hit(r,box(cap)))extra.capChap.push(T);}
    if(capOn){const r=box(cap);if(r.left<0||r.right>innerWidth||r.bottom>innerHeight||r.top<0)extra.capCut.push(T);}
    if(!fin&&!board)for(const e of badges){const q=box(e);const area=Math.max(0,Math.min(q.right,innerWidth)-Math.max(q.left,0))*Math.max(0,Math.min(q.bottom,innerHeight)-Math.max(q.top,0));
     if(area>60&&+getComputedStyle(e).opacity>.5)(extra.badge[e.textContent]||(extra.badge[e.textContent]=[])).push(T);}
   }
   const vis=els.filter(e=>+getComputedStyle(e).opacity>.85);
   for(const e of els){const k=keyOf(e);if(first[k]==null&&+getComputedStyle(e).opacity>.05)first[k]=T;}
   for(const e of vis){const k=keyOf(e),r=box(e);

    const o=out[k]||(out[k]={cls:e.className.split(' ')[0],okno:WOF.get(e)?.num??null,first:null,firstFull:null,full:[],cut:[],cap:[],over:[],off:[],hang:[],chap:[],edge:[],fs:[]});
    o.first=first[k];
    const inV=r.left>=2&&r.top>=2&&r.right<=innerWidth-2&&r.bottom<=innerHeight-2;
    const onScreen=r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;
    if(!inV&&onScreen)o.cut.push(T);
    else if(inV){o.full.push(T);if(o.firstFull==null)o.firstFull=T;}
    if(inV&&((capOn&&hit(r,box(cap)))||(bar&&hit(r,box(bar)))))o.cap.push(T);
    for(const f of vis)if(f!==e&&hit(r,box(f))&&inV)o.over.push(T+' "'+f.textContent.trim().slice(0,18)+'"');
    if(OLD)continue;
    if(!onScreen)o.off.push(T);
    const Wn=WOF.get(e);
    if(Wn&&!fin&&!board&&camWin!==Wn&&visited.has(Wn))o.hang.push(T);
    if(inV&&chBoxes.some(c=>hit(r,c)))o.chap.push(T);
    if(Wn&&inV&&!fin&&!board){const [x0,y0]=toS(Wn.x,Wn.y),[x1,y1]=toS(Wn.x+Wn.w,Wn.y+Wn.h);if(r.left<x0-1||r.right>x1+1||r.top<y0-1||r.bottom>y1+1)o.edge.push(T);}
    if(inV){const tx=e.querySelector('.tx,b')||e;o.fs.push(+(parseFloat(getComputedStyle(tx).fontSize)*V.Z).toFixed(1));}
   }
  }
  return {out,extra};},{step:STEP,OLD});
 console.log(`\n== ${W}x${H}`);
 const itog={nadpisey:0,sProblemami:0,obrezana:0,naSubtitre:0,naezd:0,vneKadra:0,visit:0,podVrezkoy:0,zaRamkoy:0,poyavilasZaKadrom:0},labels={};
 for(const [k,o] of Object.entries(res.out)){
  const fullS=(o.full.length*STEP).toFixed(1),probs=[];itog.nadpisey++;
  if(o.cut.length){probs.push('cut: '+ranges(o.cut));itog.obrezana++;}
  if(o.cap.length){probs.push('on the subtitle/bar: '+ranges(o.cap));itog.naSubtitre++;}
  if(o.over.length){probs.push('overlaps: '+[...new Set(o.over.map(x=>x.replace(/^\S+ /,'')))].join(' ')+' ('+ranges(o.over.map(x=>+x.split(' ')[0]))+')');itog.naezd++;}
  const L={cls:o.cls,okno:o.okno,first:o.first,firstFull:o.firstFull,fullS:+fullS,cut:dlit(o.cut),cap:dlit(o.cap),over:[...new Set(o.over.map(x=>x.replace(/^\S+ /,'')))],off:dlit(o.off),hang:dlit(o.hang),chap:dlit(o.chap),edge:dlit(o.edge)};
  if(!OLD){
   if(o.off.length){probs.push('opaque but outside the frame: '+ranges(o.off));itog.vneKadra++;}

   const hang=dlit(o.hang).filter(([a,z])=>z-a>=.4-1e-6);if(hang.length){probs.push('hangs after the camera left the window: '+ranges(o.hang.filter(t=>hang.some(([a,z])=>t>=a&&t<=z))));itog.visit++;}L.hang=hang;
   if(o.chap.length){probs.push('under the chapter inset: '+ranges(o.chap));itog.podVrezkoy++;}
   if(o.edge.length){probs.push('beyond the window frame: '+ranges(o.edge));itog.zaRamkoy++;}
   if(o.first!=null&&o.firstFull!=null&&o.firstFull-o.first>.5){probs.push(`fully in frame only from ${o.firstFull} (visible from ${o.first})`);itog.poyavilasZaKadrom++;L.late=+(o.firstFull-o.first).toFixed(1);}
   if(o.first!=null&&o.firstFull==null&&o.full.length===0&&(o.cut.length||o.off.length)){probs.push('never fully in frame');}
   if(o.fs.length){const s=[...o.fs].sort((x,y)=>x-y);L.fs=[s[0],s[s.length>>1]];L.melk13=+(o.fs.filter(x=>x<13).length*STEP).toFixed(1);}
  }
  if(probs.length)itog.sProblemami++;
  labels[k]=Object.assign(L,{ok:!probs.length});
  const kegl=!OLD&&L.fs?`  [size ${L.fs[0]}/${L.fs[1]} px${L.melk13?`, under 13 px ${L.melk13} s`:''}]`:'';
  console.log(`${probs.length?'✗':'✓'} "${k}" fully in frame ${fullS} s${o.full.length?' ('+ranges(o.full).split(', ')[0]+'...)':''}${probs.length?'  - '+probs.join('; '):''}${kegl}`);
 }
 if(!OLD){
  const ex=res.extra;
  const badge=Object.entries(ex.badge).map(([n,a])=>`#${n}: ${(a.length*STEP).toFixed(1)} s (${ranges(a)})`);
  console.log(`  window numbers in frame before the finale: ${badge.length?badge.join('; '):'none'}`);
  console.log(`  chapter insets: ${Object.keys(ex.chapters).length?Object.entries(ex.chapters).map(([k,a])=>`"${k}" ${ranges(a)}`).join('; '):'none in the scene'}${ex.chapCut.length?'  ✗ cut: '+[...new Set(ex.chapCut)].join(', '):''}${ex.capChap.length?'  ✗ on the subtitle: '+ranges(ex.capChap):''}`);
  console.log(`  subtitle cut by the edge: ${ex.capCut.length?'✗ '+ranges(ex.capCut):'no'}`);
  console.log(`  total: labels ${itog.nadpisey}, with remarks ${itog.sProblemami}: cut ${itog.obrezana}, on the subtitle ${itog.naSubtitre}, overlapping ${itog.naezd}, outside the frame ${itog.vneKadra}, hanging after leaving ${itog.visit}, under the inset ${itog.podVrezkoy}, beyond the window frame ${itog.zaRamkoy}, appeared outside the frame ${itog.poyavilasZaKadrom}`);
  if(errs.length)console.log('  console:\n   '+[...new Set(errs)].join('\n   '));
  Object.assign(itog,{nomeraOkon:Object.keys(ex.badge).length,vrezkiObrezany:ex.chapCut.length,vrezkaNaSubtitre:ex.capChap.length,subtitrObrezan:ex.capCut.length,vrezok:Object.keys(ex.chapters).length});
 }
 OUT.sizes[`${W}x${H}`]={itog,labels,extra:res.extra,errs:[...new Set(errs)]};
 await ctx.close();
}
await b.close();
if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
