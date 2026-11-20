import {chromium} from 'playwright';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';
import fs from 'node:fs';
await ensureServer();

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

const url=adres(POS[0]||'demo/fire/index.html'),POR=+(POS[1]||2.5),STRICT=(POS[2]??process.env.STRICT??'0')==='1';

const skip=w=>w.startsWith('leave')||(STRICT&&(w==='camera'||w==='light'||w==='shade'));
const b=await chromium.launch({...launchOpts()});
const {ctx,p,errs}=await otkryt(b,url,[735,587]);
const ev=await p.evaluate(async()=>{
 const tl=window.multik.tl,k=window.kino,out=[],strong=[];
 const WINS=k.WINS||[],ITEMS=new Set(WINS.flatMap(W=>W.items)),MV=k.MV||[],FXT=k.FXT||[],FL=k.FL||null;
 const gst=tw=>{let s=tw.startTime(),q=tw.parent;while(q&&q!==tl){s=q.startTime()+s/(q.timeScale?q.timeScale():1);q=q.parent;}return s;};
 const pos=v=>typeof v==='number'&&v>0;
 for(const tw of tl.getChildren(true,true,false)){const st=gst(tw),du=tw.duration();
  const tg=(tw.targets&&tw.targets())||[];const t0=tg[0];if(!t0)continue;const v=tw.vars||{};let what='';
  if(t0===k.cam)what=pos(v.sh)?'shake':'camera';
  else if(t0 instanceof Element)what=String(t0.textContent||t0.className||'').replace(/\s+/g,' ').trim().slice(0,40)||String(t0.className);
  else if(t0.s!=null&&Object.keys(t0).length===1){
   const m=MV.find(m=>Math.abs(m.t-st)<.03);what=m&&!/^fly/.test(m.kind)?'camera':'flight';}
  else if(FL&&t0===FL)what='flash';
  else if(WINS.includes(t0))what='shade';
  else if(t0.img)what='sprite';
  else if(t0.draw)what=('p' in v)?'drawing':'light';
  else what='?';
  if(v.opacity===0||v.o===0||v.a===0||v.autoAlpha===0||v.amt===0)what='leave: '+what;
  if(du<=8)out.push({t:+st.toFixed(2),d:+du.toFixed(2),what});

  let sk=null;
  if(pos(v.amt)&&(ITEMS.has(t0)||t0===k.cam))sk='patch (amt)';
  else if(t0===k.cam&&pos(v.sh))sk='shake';
  else if(FL&&t0===FL&&pos(v.a))sk='flash';
  else if(ITEMS.has(t0)&&t0.strong&&!what.startsWith('leave'))sk='strong: '+(t0.name||t0.strong===true?(t0.name||'layer'):t0.strong);
  if(sk)strong.push({t:+st.toFixed(3),d:+du.toFixed(2),kind:sk,word:(v.data&&v.data.word)||t0.word||null,win:(WINS.find(W=>W.items.includes(t0))||{}).num||null});
 }

 for(const f of FXT){if(f.kind==='shake'&&!strong.some(s=>s.kind==='shake'&&Math.abs(s.t-f.t)<.05))strong.push({t:+f.t.toFixed(3),d:+(f.end-f.t).toFixed(2),kind:'shake',word:null,win:null});
  if(f.kind==='flash'&&!strong.some(s=>s.kind==='flash'&&Math.abs(s.t-f.t)<.05))strong.push({t:+f.t.toFixed(3),d:+(f.end-f.t).toFixed(2),kind:'flash',word:null,win:null});}

 const shA=tl.getChildren(true,true,false).filter(tw=>(tw.targets?.()||[])[0]===k.cam&&typeof tw.vars?.shA==='number').map(tw=>tw.vars.shA);

 let glMax=0,glAt=null;const hasAmt=[...ITEMS].filter(it=>'amt' in it);
 if(hasAmt.length){const T0=tl.time();for(let t=0;t<=window.multik.total;t+=.1){tl.time(t);const n=hasAmt.filter(it=>it.amt>.003).length;if(n>glMax){glMax=n;glAt=+t.toFixed(1);}}tl.time(T0);}
 let words={};try{const f=(window.KINO&&window.KINO.files&&window.KINO.files.words)||'words.json';const r=await fetch(f);if(r.ok)words=await r.json();}catch(e){}
 return {ev:out.sort((a,b)=>a.t-b.t),strong:strong.sort((a,b)=>a.t-b.t),shA,glMax,glAt,nAmt:hasAmt.length,FXT,MV,words,
  beats:window.multik.beats.map(b=>({id:b.id,start:b.start,end:b.end})),total:window.multik.total};});
await ctx.close();await b.close();
const words=ev.words;
const gaps=[],perBeat=[];
const busy=ev.ev.filter(e=>!skip(e.what)).map(e=>[e.t,e.t+Math.max(e.d,.6)]);
for(const bt of ev.beats){
 const inBeat=ev.ev.filter(e=>!e.what.startsWith('leave')&&e.t>=bt.start-.3&&e.t<=bt.end);

 let t=bt.start;while(t<bt.end){const b2=busy.filter(([a,z])=>a<=t+.05&&z>t);if(b2.length){t=Math.max(...b2.map(x=>x[1]));continue;}
  const nx=busy.map(([a])=>a).filter(a=>a>t).sort((a,b)=>a-b)[0]??bt.end;const z=Math.min(nx,bt.end);
  if(z-t>=POR){const ws=(words[bt.id]||[]).filter(w=>w[1]>=t-.1&&w[1]<z).map(w=>w[0]).join(' ');gaps.push({beat:bt.id,from:+t.toFixed(1),to:+z.toFixed(1),dur:+(z-t).toFixed(1),words:ws});}
  t=z+.01;}
 const first=inBeat.filter(e=>e.what!=='camera'&&e.what!=='flight'&&e.what!=='shade'&&e.t>=bt.start-.3)[0];
 perBeat.push({id:bt.id,start:bt.start,end:bt.end,sobytiy:inBeat.length,pervoe:first?{cherez:+(first.t-bt.start).toFixed(1),what:first.what}:null});
 console.log(bt.id.padEnd(9),'phrase',bt.start.toFixed(1)+'-'+bt.end.toFixed(1),' events',inBeat.length,' first new thing in frame after',first?(first.t-bt.start).toFixed(1)+' s ('+first.what+')':'-');
}
console.log(`\nDEAD STRETCHES >= ${POR} s (the voice speaks, nothing new in frame)${STRICT?'; STRICT: camera, shade and light do not count':''}:`);
for(const g of gaps)console.log(' ',g.beat.padEnd(9),g.from+'-'+g.to,'('+g.dur+' s)  heard:',g.words);
if(!gaps.length)console.log('  none');

const beatOf=t=>ev.beats.find(b=>t>=b.start-.05&&t<=b.end+.05)||null;
const groups=[];for(const s of ev.strong){const g=groups[groups.length-1];if(g&&s.t-g.t<.25&&s.kind!=='flash'&&g.kind!=='flash'){g.parts.push(s.kind);continue;}groups.push(Object.assign({},s,{parts:[s.kind]}));}
const wn=s=>s.toLowerCase().replace(/\u0451/g,'\u0435').replace(/[^\u0430-\u044fa-z0-9]/g,'');
const narusheniya=[];
for(const g of groups){const bt=beatOf(g.t);g.beat=bt?bt.id:'pause';
 if(g.kind==='flash'){g.ok=true;continue;}
 if(!bt){g.note='in a pause between phrases';g.ok=true;continue;}
 const ws=words[bt.id]||[];
 let best=null;
 if(g.word){const k=wn(g.word),stem=k.slice(0,Math.max(3,k.length-2));const w=ws.find(w=>wn(w[0]).startsWith(stem));if(w)best={w:w[0],d:g.t-w[1]};else g.note=`key word "${g.word}" not found in the phrase`;}
 else for(const w of ws){const d=g.t-w[1];if(!best||Math.abs(d-.1)<Math.abs(best.d-.1))best={w:w[0],d};}
 g.slovo=best?best.w:null;g.sdvig=best?+best.d.toFixed(2):null;
 const vOkne=best&&best.d>=-.3-1e-6&&best.d<=.5+1e-6;const rano=g.t-bt.start<.5;
 g.ok=!!vOkne&&!rano&&!g.note;
 if(!vOkne)narusheniya.push(`${g.t.toFixed(2)} s ${g.parts.join('+')}: not on a word (nearest "${g.slovo||'-'}", offset ${g.sdvig??'-'} s; must be -0.3...+0.5)`);
 if(rano)narusheniya.push(`${g.t.toFixed(2)} s ${g.parts.join('+')}: in the first 0.5 s of phrase ${bt.id} (after ${(g.t-bt.start).toFixed(2)} s)`);
 if(g.note)narusheniya.push(`${g.t.toFixed(2)} s ${g.parts.join('+')}: ${g.note}`);
}
const naFrazu={};for(const g of groups)if(g.kind!=='flash'&&g.beat!=='pause')(naFrazu[g.beat]=naFrazu[g.beat]||[]).push(g.t.toFixed(2)+' '+g.parts.join('+'));
for(const [id,a] of Object.entries(naFrazu))if(a.length>1)narusheniya.push(`phrase ${id}: ${a.length} strong effects (${a.join('; ')}), one is allowed`);
const tryaski=groups.filter(g=>g.parts.includes('shake')),vspyshki=groups.filter(g=>g.kind==='flash');
if(tryaski.length>3)narusheniya.push(`shake ${tryaski.length} times, more than 3`);
for(const g of tryaski)if(g.d>.3+1e-6)narusheniya.push(`shake at ${g.t.toFixed(2)} s lasts ${g.d} s, more than 0.3`);
if(ev.shA.some(a=>a>2))narusheniya.push(`shake amplitude ${Math.max(...ev.shA)} px, more than 2`);
if(vspyshki.length>3)narusheniya.push(`full-frame flashes ${vspyshki.length}, more than 3`);
if(ev.glMax>2)narusheniya.push(`WebGL patches at once ${ev.glMax} (at ${ev.glAt} s), more than 2`);
const cuts=ev.MV.filter(m=>/^cut/.test(m.kind));
console.log(`\nSTRONG EFFECTS: ${groups.length?'':'none (no layers with amt, shakes, flashes or strong:true in the scene)'}`);
for(const g of groups)console.log(`  ${g.ok?'✓':'✗'} ${g.t.toFixed(2)} s  ${g.parts.join(' + ')}${g.win?' (window '+g.win+')':''}  phrase ${g.beat}${g.slovo!=null?`  word "${g.slovo}" ${g.sdvig>=0?'+':''}${g.sdvig} s`:''}${g.note?'  - '+g.note:''}${g.kind==='flash'?(cuts.some(c=>c.t>=g.t-.05&&c.t<=g.t+g.d)?'  (a cut under it)':'  (no cut under it)'):''}`);
console.log(`  shakes: ${tryaski.length}${ev.shA.length?', amplitude up to '+Math.max(...ev.shA)+' px':''} · flashes: ${vspyshki.length} · WebGL patches at once up to ${ev.glMax}${ev.glAt!=null?' (at '+ev.glAt+' s)':''} · layers with amt: ${ev.nAmt}`);
console.log(narusheniya.length?'  VIOLATIONS:\n   '+narusheniya.join('\n   '):'  no violations of the strong-effect rules');
console.log(errs.length?'console:\n  '+[...new Set(errs)].join('\n  '):'no errors');
const res={url,por:POR,strict:STRICT,total:ev.total,beats:perBeat,gaps,strong:groups,tryaski:tryaski.length,vspyshki:vspyshki.length,glMax:ev.glMax,narusheniya,ev:ev.ev,errs:[...new Set(errs)]};
if(FLAG.json)fs.writeFileSync(FLAG.json,JSON.stringify(res,null,1));
