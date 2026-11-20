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

const url=adres(POS[0]||'krit-dvorec');
const LEGS=FLAG.legs||(/\/krit-dvorec\//.test(url)?'krit':'auto');
const b=await chromium.launch({...launchOpts()});
const OUT={url,legs:LEGS,sizes:{}};

if(LEGS==='krit'){

 const [VW,VH]=FLAG.razmery?razmery()[0]:[1500,950];
 const {ctx,p,errs}=await otkryt(b,url,[VW,VH],{wait:400});
 const legs=[];
 const rows=[];
 for(const [name,a,z] of legs){
  const r=await p.evaluate(([a,z])=>{const out=[];for(let t=a;t<=z;t+=1/60){window.multik.seek(t);const v=window.kino.view();out.push([v.x,v.y,Math.log(v.Z)]);}return out;},[a,z]);
  const sp=r.slice(1).map((q,i)=>{const P=r[i],Z=Math.exp(q[2]);return Math.hypot((q[0]-P[0])*Z,(q[1]-P[1])*Z)+Math.abs(q[2]-P[2])*VW;});
  const acc=sp.slice(1).map((v,i)=>Math.abs(v-sp[i]));
  const zs=r.map(q=>q[2]);let turns=0;for(let i=2;i<zs.length;i++){const d1=zs[i-1]-zs[i-2],d2=zs[i]-zs[i-1];if(Math.abs(d1)>1e-5&&Math.abs(d2)>1e-5&&Math.sign(d1)!==Math.sign(d2))turns++;}
  const mx=Math.max(...sp);let stops=0;const mid=sp.slice(Math.floor(sp.length*.2),Math.floor(sp.length*.8));for(const v of mid)if(v<mx*.15)stops++;
  const ai=acc.indexOf(Math.max(...acc));console.log(name.padEnd(16),'jerk at',(a+ai/60).toFixed(2),'s ·','max speed',mx.toFixed(1),'px/frame · jerk',Math.max(...acc).toFixed(2),'· zoom reversals',turns,'· stops mid-way',stops);
  rows.push({move:name,from:a,to:z,'max_speed_px_per_frame':+mx.toFixed(1),jerk_max:+Math.max(...acc).toFixed(2),zoom_reversals:turns,stops});
 }
 const pe=errs.filter(e=>e.startsWith('pageerror: ')).map(e=>e.slice(11));
 console.log(pe.join('\n')||'no errors');
 OUT.sizes[`${VW}x${VH}`]={rows,errs};
 await ctx.close();await b.close();
 if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
 process.exit(0);
}

const OTR=FLAG.otrezok?FLAG.otrezok.split('-').map(Number):null;
for(const [VW,VH] of razmery()){
 const {ctx,p,errs}=await otkryt(b,url,[VW,VH],{wait:300});
 const {r,MV,total,wins}=await p.evaluate(()=>{
  const out=[];const M=window.multik,K=window.kino,c=K.cam;
  const WINS=K.WINS||[],winAt=(x,y)=>{const W=WINS.find(W=>x>=W.x&&x<=W.x+W.w&&y>=W.y&&y<=W.y+W.h);return W?W.num:0;};
  for(let i=0;i*(1/60)<=M.total;i++){const t=i/60;M.seek(t);const v=K.view();out.push([v.x,v.y,Math.log(v.Z),c.fl||0,c.f||0,c.g||0,winAt(v.x,v.y)]);}
  return {r:out,MV:K.MV,total:M.total,wins:WINS.map(W=>({num:W.num,id:W.id,title:W.title}))};
 });
 const sp=[0],vx=[0],vy=[0],vz=[0];
 for(let i=1;i<r.length;i++){const q=r[i],P=r[i-1],Z=Math.exp(q[2]);
  vx.push((q[0]-P[0])*Z);vy.push((q[1]-P[1])*Z);vz.push((q[2]-P[2])*VW);
  sp.push(Math.hypot((q[0]-P[0])*Z,(q[1]-P[1])*Z)+Math.abs(q[2]-P[2])*VW);}
 const acc=sp.map((_,i)=>i<2?0:Math.hypot(vx[i]-vx[i-1],vy[i]-vy[i-1])+Math.abs(vz[i]-vz[i-1]));

 const cutMask=new Uint8Array(r.length);const CUTS=MV.filter(m=>/^cut/.test(m.kind));
 for(const m of CUTS){const j=Math.ceil(m.t*60-1e-6);for(const k of [j,j+1,j+2])if(k>=0&&k<r.length)cutMask[k]=1;}
 for(let i=0;i<r.length;i++)if(cutMask[i]){sp[i]=sp[i-1]||0;acc[i]=0;}
 const T=i=>(i/60).toFixed(2),at=t=>Math.round(t*60);
 const rows=[];
 for(const m of MV){if(/^cut/.test(m.kind))continue;
  const a=at(m.t),z=Math.min(at(m.end),r.length-1);if(z<=a)continue;
  const seg=sp.slice(a,z+1),ac=acc.slice(a+1,z+1);
  const zs=r.slice(a,z+1).map(q=>q[2]);let turns=0;
  for(let i=2;i<zs.length;i++){const d1=zs[i-1]-zs[i-2],d2=zs[i]-zs[i-1];if(Math.abs(d1)>2e-4&&Math.abs(d2)>2e-4&&Math.sign(d1)!==Math.sign(d2))turns++;}
  const mx=Math.max(...seg);let stops=0;const mid=seg.slice(Math.floor(seg.length*.2),Math.floor(seg.length*.8));for(const v of mid)if(v<mx*.15)stops++;
  const amx=Math.max(...ac),ai=ac.indexOf(amx);
  rows.push({move:m.kind,from:+m.t.toFixed(2),to:+m.end.toFixed(2),'max_speed_px_per_frame':+mx.toFixed(1),'jerk_max':+amx.toFixed(2),'jerk_at_s':+T(a+1+ai),
   'jerk_per_speed':+(amx/Math.max(mx,.01)).toFixed(2),zoom_reversals:turns,stops,'speed_in':+(sp[a+1]||0).toFixed(2),'speed_out':+(sp[z]||0).toFixed(2)});
 }
 console.log(`\n== ${VW}x${VH}  (${url.replace(/^https?:\/\/[^/]+\//,'')})`);
 console.table(rows);
 if(CUTS.length)console.log('cuts (not a jerk, excluded from the measurements):',CUTS.map(m=>`${m.kind} ${m.t.toFixed(2)}`).join(', '));
 const idx=acc.map((v,i)=>[v,i]).sort((x,y)=>y[0]-x[0]);
 const top=[];for(const [v,i] of idx){if(top.some(j=>Math.abs(j-i)<20))continue;top.push(i);if(top.length>=12)break;}
 console.log('sharpest frames (|dv| px/frame per frame):');
 const topRows=[];
 for(const i of top){const ms=MV.filter(m=>i/60>=m.t-.02&&i/60<=m.end+.02).map(m=>m.kind).join(' + ')||'-';
  topRows.push({t:+T(i),dv:+acc[i].toFixed(2),idet:ms});
  console.log(`  ${T(i)} s: dv ${acc[i].toFixed(2)} (speed ${sp[i-1].toFixed(1)} -> ${sp[i].toFixed(1)}), running: ${ms}; fl ${r[i][3].toFixed(2)} f ${r[i][4].toFixed(2)} g ${r[i][5].toFixed(2)}`);}
 const MVn=MV.filter(m=>!/^cut/.test(m.kind)),vnahlyost=[];
 for(let k=1;k<MVn.length;k++)if(MVn[k].t<MVn[k-1].end-.001){
  const a=at(MVn[k].t)-3,z=at(MVn[k-1].end)+4;vnahlyost.push(`${MVn[k-1].kind} until ${MVn[k-1].end.toFixed(2)} and ${MVn[k].kind} from ${MVn[k].t.toFixed(2)}`);
  console.log(`overlap: ${MVn[k-1].kind} until ${MVn[k-1].end.toFixed(2)} and ${MVn[k].kind} from ${MVn[k].t.toFixed(2)}: speed per frame: `+sp.slice(a,z).map(v=>v.toFixed(2)).join(' ')+' · jerk: '+acc.slice(a,z).map(v=>v.toFixed(2)).join(' '));
 }

 let fin=r.findIndex(q=>q[4]+q[5]>.001);if(fin<0)fin=r.length;
 let s0=-1;const still=[];
 sp.forEach((v,i)=>{if(i>=fin)return;if(v<.05&&s0<0)s0=i;if((v>=.05||i===fin-1)&&s0>=0){if(i-s0>150)still.push([+T(s0),+T(i)]);s0=-1;}});
 const dolya=(a,z)=>{a=Math.max(0,a);z=Math.min(z,fin);let st=0,cr=0;for(let i=a;i<z;i++){if(sp[i]<.05)st++;else if(sp[i]<.3)cr++;}const n=Math.max(1,z-a);return {stoit:+(st/n*100).toFixed(1),stoitS:+(st/60).toFixed(1),polzyot:+(cr/n*100).toFixed(1),polzyotS:+(cr/60).toFixed(1),dlina:+(n/60).toFixed(1)};};
 const vsego=dolya(0,fin);
 console.log(`camera still > 2.5 s: ${still.map(([a,z])=>a+'-'+z).join(', ')||'none'}`);
 console.log(`before the finale (${T(fin)} s): camera still ${vsego.stoit} % (${vsego.stoitS} s), creeping < 0.3 px/frame another ${vsego.polzyot} % (${vsego.polzyotS} s)`);
 const poOknam={};for(const w of wins){let n=0,st=0;for(let i=0;i<fin;i++)if(r[i][6]===w.num){n++;if(sp[i]<.05)st++;}if(n)poOknam[w.num]={okno:w.title,s:+(n/60).toFixed(1),stoit:+(st/n*100).toFixed(1)};}
 console.log('per window (share "still"): '+Object.entries(poOknam).map(([n,o])=>`${n} ${o.stoit} % of ${o.s} s`).join(' · '));
 let otr=null;if(OTR){otr=dolya(at(OTR[0]),at(OTR[1]));console.log(`stretch ${OTR[0]}-${OTR[1]} s: camera still ${otr.stoit} % (${otr.stoitS} s of ${otr.dlina})`);}
 const pere=rows.filter(q=>/^fly/.test(q.move)),maxFly=pere.length?Math.max(...pere.map(q=>q['max_speed_px_per_frame'])):0,maxJerk=rows.length?Math.max(...rows.map(q=>q['jerk_max'])):0;
 const flyMax=pere.find(q=>q['max_speed_px_per_frame']===maxFly),jerkMax=rows.find(q=>q['jerk_max']===maxJerk);
 console.log(`TOTAL ${VW}x${VH}: fastest flight ${maxFly} px/frame${flyMax?' ('+flyMax.move+' '+flyMax.from+' s)':''} · sharpest jerk ${maxJerk}${jerkMax?' ('+jerkMax.move+' at '+jerkMax['jerk_at_s']+' s)':''} · overlapping ${vnahlyost.length} · still ${vsego.stoit} %`);
 console.log(errs.length?[...new Set(errs)].join('\n'):'no errors');
 OUT.sizes[`${VW}x${VH}`]={rows,cuts:CUTS,top:topRows,vnahlyost,still,fin:+T(fin),vsego,poOknam,otrezok:otr,maxFly,flyMax:flyMax?.move||null,maxJerk,jerkMax:jerkMax?.move||null,errs:[...new Set(errs)]};
 await ctx.close();
}
await b.close();
if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
