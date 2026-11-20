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

const url=adres(POS[0]||'demo/fire/index.html');
const STEP=POS[1]?(POS[1].includes('/')?POS[1].split('/').reduce((a,b)=>a/b):+POS[1]):1/30;
const HI=.6,LO=.15,MID=.5;
const b=await chromium.launch({...launchOpts()});
const OUT={url,step:STEP,sizes:{}};
for(const [VW,VH] of razmery()){
 const {ctx,p,errs}=await otkryt(b,url,[VW,VH],{wait:300});
 const res=await p.evaluate(STEP=>{
  const OV=document.getElementById('ov'),K=window.kino,M=window.multik;
  const els=[...OV.children].filter(e=>!e.classList.contains('onboard'));
  const chs=[...document.querySelectorAll('.chapter')];
  const name=e=>(e.className.split(' ')[0]+' "'+e.textContent.replace(/\s+/g,' ').trim().slice(0,34)+'"');
  const op=e=>+(e.style.opacity===''?1:e.style.opacity)*(e.style.visibility==='hidden'?0:1);
  const reveal=e=>{let k=1;for(const x of [e,e.querySelector('.tx')]){if(!x)continue;const c=x.style.clipPath||'';const m=c.match(/inset\(([-\d.]+)%\s+([-\d.]+)%/);if(m)k*=Math.max(0,Math.min(1,1-(+m[2])/100));}return k;};

  const letters=e=>{const bs=e.classList.contains('cut')?e.querySelectorAll('b'):e.querySelectorAll('.ch');if(!bs.length)return 1;let s=0;bs.forEach(b=>s+=+(b.style.opacity===''?1:b.style.opacity));return s/bs.length;};
  const items=[];(K.WINS||[]).forEach(W=>W.items.forEach((it,i)=>items.push({W,it,n:W.id+'#'+i+(it.img?'':':fx')})));
  const shut=(K.WINS||[]).filter(W=>W.sh!=null);
  const S=els.map(()=>[]),C=chs.map(()=>[]),I=items.map(()=>[]),Sh=shut.map(()=>[]),onScr=els.map(()=>[]);
  for(let t=0;t<=M.total+1e-6;t+=STEP){
   M.seek(t);
   const V=K.view();const {Z,x,y,sx,sy}=V;
   els.forEach((e,j)=>{S[j].push(+(op(e)*reveal(e)*letters(e)).toFixed(3));
    const L=parseFloat(e.style.left),T=parseFloat(e.style.top),X=sx+(L-x)*Z,Y=sy+(T-y)*Z;
    onScr[j].push(X>-20&&X<innerWidth+20&&Y>-20&&Y<innerHeight+20?1:0);});

   chs.forEach((e,j)=>{const kids=[...e.children];C[j].push(+(op(e)*(kids.length?Math.max(...kids.map(op)):1)).toFixed(3));});
   items.forEach(({it},j)=>I[j].push([it.o==null?1:+it.o.toFixed(3),it.a==null?null:+it.a.toFixed(3)]));
   shut.forEach((W,j)=>Sh[j].push(+(1-Math.min(1,Math.max(0,W.sh))).toFixed(3)));
  }
  const uniq=(arr,f)=>arr.map((e,i,a)=>{const n=f(e);return a.slice(0,i).some(q=>f(q)===n)?n+' #'+i:n;});
  return {names:uniq(els,name),S,onScr,cnames:chs.map(e=>'chapter inset "'+([...e.querySelectorAll('*')].filter(c=>!c.children.length).map(c=>c.textContent.trim()).filter(Boolean).join(' · ')||e.textContent.trim()).slice(0,40)+'"'),C,
   inames:items.map(q=>q.n),I,snames:shut.map(W=>'shade of window '+W.num+' (openness)'),Sh,total:M.total};
 },STEP);
 const T=i=>+(i*STEP).toFixed(2);
 const out=[];
 function scan(nm,v,scr,kind,{noFlash=false}={}){
  const ivs=[];let s=-1;
  v.forEach((o,i)=>{if(o>=MID&&s<0)s=i;if(o<MID&&s>=0){ivs.push([s,i]);s=-1;}});if(s>=0)ivs.push([s,v.length]);
  for(let k=1;k<ivs.length;k++){
   const gap=(ivs[k][0]-ivs[k-1][1])*STEP;const mn=Math.min(...v.slice(ivs[k-1][1],ivs[k][0]));
   if(mn<=LO)out.push({kind:gap<1?'flicker':'visible again',nm,from:T(ivs[k-1][1]),to:T(ivs[k][0]),gap:+gap.toFixed(2),inFrame:scr?!!scr[ivs[k][0]]:true,what:kind});
  }
  if(!noFlash)for(const [a,z] of ivs){const d=(z-a)*STEP;if(d<1&&z<v.length)out.push({kind:'flash',nm,from:T(a),to:T(z),dur:+d.toFixed(2),peak:Math.max(...v.slice(a,z)),inFrame:scr?scr.slice(a,z).some(Boolean):true,what:kind});}
  for(let i=1;i<v.length-1;i++)if(v[i]>LO&&v[i]<.9&&v[i]>=v[i-1]&&v[i]>v[i+1]&&v[i-1]<v[i]){
   const pre=v.slice(Math.max(0,i-40),i);if(pre.length&&Math.min(...pre)<LO)out.push({kind:'incomplete appearance',nm,at:T(i),peak:v[i],inFrame:scr?!!scr[i]:true,what:kind});
  }
  for(let i=1;i<v.length;i++)if(Math.abs(v[i]-v[i-1])>.6)out.push({kind:'jump',nm,at:T(i),from:v[i-1],to:v[i],inFrame:scr?!!(scr[i]||scr[i-1]):true,what:kind});
  return ivs.map(([a,z])=>[T(a),T(z)]);
 }
 const vis={};
 res.names.forEach((nm,j)=>{vis[nm]=scan(nm,res.S[j],res.onScr[j],'label');});
 res.cnames.forEach((nm,j)=>{vis[nm]=scan(nm,res.C[j],null,'inset');});
 res.inames.forEach((nm,j)=>{const o=res.I[j].map(q=>q[0]);scan(nm+' (o)',o,null,'canvas layer');
  if(res.I[j][0][1]!=null)scan(nm+' (a)',res.I[j].map(q=>q[1]),null,'glow');});

 res.snames.forEach((nm,j)=>scan(nm,res.Sh[j],null,'shade',{noFlash:true}));
 const vKadre=[...new Set(out.filter(f=>(f.what==='label'||f.what==='inset')&&f.inFrame).map(f=>f.nm))];
 const sloi=[...new Set(out.filter(f=>f.what!=='label'&&f.what!=='inset').map(f=>f.nm))];
 console.log(`\n== ${VW}x${VH}  step ${STEP.toFixed(4)} s`);
 for(const f of out)console.log(JSON.stringify(f));
 console.log('\nvisibility intervals of labels:');
 for(const [k,v] of Object.entries(vis))console.log(k.padEnd(60),v.map(([a,z])=>a+'-'+z).join(', '));
 console.log(`\nTOTAL ${VW}x${VH}: flickering labels in frame: ${vKadre.length}${vKadre.length?': '+vKadre.join(' · '):''}`);
 console.log(`  findings in all ${out.length} (labels ${out.filter(f=>f.what==='label').length}, canvas layers/glow/shade ${out.filter(f=>f.what!=='label'&&f.what!=='inset').length}${sloi.length?': '+sloi.slice(0,12).join(', ')+(sloi.length>12?'...':''):''})`);
 console.log(errs.length?'console:\n  '+[...new Set(errs)].join('\n  '):'no errors');
 OUT.sizes[`${VW}x${VH}`]={migayushchih:vKadre.length,nadpisi:vKadre,sloi,out,vis,errs:[...new Set(errs)]};
 await ctx.close();
}
await b.close();
if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(OUT,null,1));
