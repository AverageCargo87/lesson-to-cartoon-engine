'use strict';
// The summary (n 9, after all windows): the sheet "what we learned" in the middle of the board, soft threads of light from
// the windows to the sheet items, window captions and numbers, a pull-back to the whole board (the finale), copies of the
// window captions for the board after the cartoon (ONBOARD). The narration has no summary phrase, so the sheet plays over
// the music tail after the last phrase.

(function(){
let sheet,wtags,badges,lt,lu,FACTS,ITEM_Y,items,threads;const embF={a:0},darkF={a:0};

// the sheet: its title, its items [window number, item number, html] and the last phrase before the summary
const TITLE='Что мы узнали об огне';
const PUNKTY=[[1,1,'Сначала огонь брали от дерева, которое <em>зажгла молния</em>'],
 [3,2,'В пещере огонь <em>берегли</em> день и ночь'],
 [4,3,'Под Пекином нашли <em>слой с золой и углями</em> в 6 метров'],
 [5,4,'Позже огонь научились <em>добывать сами</em>: трением и искрами'],
 [6,5,'Огонь давал <em>еду</em>, <em>тепло</em>, <em>свет</em> и <em>защиту</em>']];
const POSLE='S10';
(window.KINO_OKNA=window.KINO_OKNA||[]).push({n:9,id:'itog',beats:['itog'],
setup(k){const {WINS,LIST,OV,rng,put}=k,E=k.EFF;

 {const L=E.L||{},KEEP=new Set([L.gradeEpic,L.grade,L.tint,L.flicker].filter(Boolean));
  for(const W of WINS)for(const it of W.items){if(!it.draw||it.img||it.text!=null||KEEP.has(it.draw)||it.U)continue;const g0=it.gate;it.gate=g0?()=>k.cam.g>.5||g0():()=>k.cam.g>.5;}}

 wtags=WINS.map(W=>{const e=document.createElement('div');e.textContent=W.title;return put(e,W.cx,W.y+W.h+45,{cls:'wtag'});});
 badges=WINS.map(W=>{const e=document.createElement('div');e.textContent=W.num;return put(e,W.x-4,W.y-4,{cls:'badge',rot:0});});

 for(const el of k.ONBOARD){const c=el.cloneNode(true);c.classList.remove('inwin');c.classList.add('onboard');
  if(!el.classList.contains('legrow')&&el.style.fontSize)c.style.fontSize=parseFloat(el.style.fontSize)*1.3+'px';OV.appendChild(c);}
 const st=document.createElement('style');st.textContent='body.board .wtag{opacity:1!important}body.board .onboard{visibility:visible!important}';document.head.appendChild(st);

 sheet=(()=>{const {w,h}=LIST,M=70,c=document.createElement('canvas');c.width=w+2*M;c.height=h+2*M;const x=c.getContext('2d');x.translate(M,M);
  const rr=(a,b,cw,ch,r)=>{x.beginPath();if(x.roundRect)x.roundRect(a,b,cw,ch,r);else x.rect(a,b,cw,ch);};
  x.save();x.shadowColor='rgba(0,0,0,.8)';x.shadowBlur=50;x.shadowOffsetY=24;rr(0,0,w,h,16);x.fillStyle='#100b07';x.fill();x.restore();
  let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(34,24,16,.98)');g.addColorStop(.5,'rgba(22,15,10,.98)');g.addColorStop(1,'rgba(15,10,7,.98)');rr(0,0,w,h,16);x.fillStyle=g;x.fill();
  x.save();rr(0,0,w,h,16);x.clip();g=x.createRadialGradient(w/2,-h*.08,0,w/2,-h*.08,h*.95);g.addColorStop(0,'rgba(255,214,160,.12)');g.addColorStop(1,'rgba(255,214,160,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
  const r=rng(77);for(let i=0;i<2000;i++){x.fillStyle=`rgba(${r()<.5?'230,245,220':'0,0,0'},${.018+r()*.035})`;x.fillRect(r()*w,r()*h,1+r()*2,1);}x.restore();
  x.strokeStyle='rgba(232,161,74,.7)';x.lineWidth=2.4;rr(18,18,w-36,h-36,9);x.stroke();
  x.strokeStyle='rgba(232,161,74,.26)';x.lineWidth=1;rr(30,30,w-60,h-60,7);x.stroke();

  const leaf=(cx,cy,ang)=>{x.save();x.translate(cx,cy);x.rotate(ang);const gg=x.createLinearGradient(0,0,46,0);gg.addColorStop(0,'#c8752c');gg.addColorStop(1,'#ffd08a');
   x.fillStyle=gg;x.beginPath();x.moveTo(0,0);x.bezierCurveTo(14,-15,34,-14,48,0);x.bezierCurveTo(34,14,14,15,0,0);x.fill();
   x.strokeStyle='rgba(8,20,10,.55)';x.lineWidth=1.3;x.beginPath();x.moveTo(3,0);x.lineTo(44,0);x.stroke();x.restore();};
  leaf(12,12,Math.PI/4);leaf(w-12,12,Math.PI*3/4);leaf(12,h-12,-Math.PI/4);leaf(w-12,h-12,-Math.PI*3/4);
  return {c,M};})();

 k.under.unshift(c=>{if(!(darkF.a>.003))return;c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle=`rgba(3,6,4,${darkF.a.toFixed(3)})`;c.fillRect(0,0,c.canvas.width,c.canvas.height);c.restore();});
 k.under.push((c,vis)=>{if(vis(LIST.x-80,LIST.y-80,LIST.w+160,LIST.h+160))c.drawImage(sheet.c,LIST.x-sheet.M,LIST.y-sheet.M);});

 k.under.push((c,vis,V,T)=>{if(!(embF.a>.01)||!E.embers)return;E.embers(c,LIST.x-60,LIST.y-120,LIST.x+LIST.w+60,LIST.y+LIST.h+40,T,embF.a,{n:34,seed:131,rgb:'255,200,130',vy:18,size:2.6,sway:30,hot:.06});});
 lt=document.createElement('div');lt.innerHTML=TITLE;put(lt,LIST.x+LIST.w/2,LIST.y+126,{cls:'ltitle'});gsap.set(lt,{opacity:1,clipPath:'inset(-30% 100% -30% -4%)'});
 lu=document.createElement('div');lu.style.width='700px';put(lu,LIST.x+LIST.w/2,LIST.y+214,{cls:'lunder'});
 FACTS=PUNKTY.map(([n,num,html])=>[html,WINS.find(W=>W.num===n),num]);

 const TOP=LIST.y+250,BOT=LIST.y+LIST.h-70,tops=FACTS.map((f,i)=>LIST.y+262+i*170+6);
 ITEM_Y=i=>tops[i]-6;
 items=FACTS.map(([html,W,num],i)=>{const e=document.createElement('div');e.innerHTML=`<span class="n">${num}</span><span class="t">${html}</span>`;return put(e,LIST.x+LIST.w/2+18,ITEM_Y(i)+46,{cls:'litem'});});
 threads=FACTS.map(([,W],i)=>{const a=W.anchor==='r'?[W.x+W.w+10,W.cy]:[W.x-10,W.cy];const b=W.anchor==='r'?[LIST.x+30,ITEM_Y(i)+40]:[LIST.x+LIST.w-12,ITEM_Y(i)+40];return {a,b,p:0};});
 const lay=()=>{const hs=items.map(e=>e.offsetHeight);if(hs.some(h=>!(h>20)))return;const sum=hs.reduce((a,b)=>a+b,0),n=hs.length;
  const gap=Math.max(10,Math.min(78,(BOT-TOP-sum)/(n-1)));let y=TOP+Math.max(0,(BOT-TOP-sum-gap*(n-1))/2);
  hs.forEach((h,i)=>{tops[i]=y;items[i].style.top=(y+h/2)+'px';threads[i].b[1]=y+24;y+=h+gap;});};
 lay();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(lay);
 Object.assign(k,{FACTS,ITEM_Y,items,threads});

 k.over.push(ctx=>{const {lerp}=k;threads.forEach((th,ti)=>{if(th.p<=0)return;const [ax,ay]=th.a,[bx,by]=th.b,ex=lerp(ax,bx,th.p),ey=lerp(ay,by,th.p)+Math.sin(th.p*Math.PI)*28;
  const hot=k.hiFact.includes(ti),cx=(ax+ex)/2,cy=(ay+ey)/2+28,al=k.hiFact.length&&!hot?.45:1;ctx.save();ctx.globalAlpha=al;ctx.lineCap='round';
  const path=()=>{ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo(cx,cy,ex,ey);};
  path();ctx.strokeStyle='rgba(3,8,4,.4)';ctx.lineWidth=hot?9:6;ctx.stroke();
  ctx.globalCompositeOperation='lighter';ctx.strokeStyle=`rgba(240,170,90,${hot?.34:.22})`;ctx.lineWidth=hot?11:8;ctx.stroke();
  ctx.strokeStyle=`rgba(255,246,232,${hot?1:.88})`;ctx.lineWidth=hot?3.2:2.1;ctx.stroke();
  for(const [px,py] of [[ax,ay],[ex,ey]]){k.glow(ctx,px,py,hot?32:24,'255,200,140',hot?.85:.6);ctx.fillStyle='rgba(255,250,240,1)';ctx.beginPath();ctx.arc(px,py,hot?5.5:4,0,7);ctx.fill();}
  ctx.restore();});});
},
build(tl,k){const {WINS,cam,end,draw}=k,H=k.EFF.hit;
 const eT=end(POSLE)+.6;
 k.enter(null,eT);
 tl.to('.inwin',{opacity:0,duration:.6,ease:'sine.in'},eT);

 for(const W of WINS){if(W.par==null)W.par=1;const p0=W.par;
  if(p0>.3)tl.fromTo(W,{par:p0},{par:.3,duration:1.5,ease:'sine.inOut',immediateRender:false,modifiers:{par:v=>W.flat?0:+v}},eT);}
 tl.fromTo(cam,{fl:0},{fl:1,duration:.4,ease:'sine.inOut',immediateRender:false},eT-.1);
 tl.to(cam,{f:1,r:0,duration:2,ease:'sine.inOut',lazy:false},eT+.15);
 tl.fromTo(darkF,{a:0},{a:.86,duration:.6,ease:'sine.inOut',immediateRender:false},eT+.15);
 H(eT+1.1,'whoosh',{a:.4,w:'pull-back to the whole board'});

 tl.fromTo(lt,{clipPath:'inset(-30% 100% -30% -4%)'},{clipPath:'inset(-30% -4% -30% -4%)',duration:1.6,ease:'none',immediateRender:false},eT+1.2);
 tl.fromTo(badges,{opacity:0},{opacity:1,duration:.4,stagger:.12,immediateRender:false},eT+.55);
 tl.fromTo('#ov .onboard',{autoAlpha:0},{autoAlpha:1,duration:.6,ease:'sine.out',immediateRender:false},eT+.62);

 const tG=eT+2.15;
 tl.to(cam,{f:0,g:1,duration:1.5,ease:'sine.inOut',lazy:false},tG);
 tl.fromTo(cam,{gk:0,gy:0},{gk:1,gy:0,duration:1.5,ease:'sine.inOut',immediateRender:false,lazy:false},tG);
 tl.fromTo(embF,{a:0},{a:.8,duration:1.2,ease:'sine.inOut',immediateRender:false},tG+.3);
 tl.fromTo(lu,{opacity:0,scaleX:0},{opacity:1,scaleX:1,duration:.7,ease:'sine.out',immediateRender:false},tG+.5);

 const i0=tG+1.0,ST=1.0;
 FACTS.forEach(([,W],i)=>{const t=i0+i*ST,bi=WINS.indexOf(W);
  tl.to(badges[bi],{keyframes:[{scale:1.3,duration:.3,ease:'sine.out'},{scale:1,duration:.45,ease:'sine.inOut'}]},t);
  tl.fromTo(W,{hl:0},{hl:1,duration:.25,ease:'sine.out',immediateRender:false},t);tl.to(W,{hl:0,duration:.5,ease:'sine.in'},t+.9);
  draw(threads[i],t,.55);
  tl.fromTo(items[i],{opacity:0,x:-22},{opacity:1,x:0,duration:.55,ease:'power2.out',immediateRender:false},t+.15);
 });

 const tP=i0+2*ST+.1;
 tl.fromTo(cam,{gy:0},{gy:1,duration:2.6,ease:'sine.inOut',immediateRender:false,lazy:false},tP);
 const tQ=i0+(FACTS.length-1)*ST+.55,tC=Math.max(tQ+.6,k.B[POSLE].end+11.6);
 const capH=Math.min(170,innerHeight*.22),zL=Math.max(Math.min(innerWidth/(k.LIST.w+560),(innerHeight-capH)/(k.LIST.h+90)),16/36),visH=(innerHeight-capH)/zL,
  top1=k.LIST.y+k.LIST.h+45-visH,gone=items.filter((e,i)=>visH<k.LIST.h+90&&ITEM_Y(i)+6<top1+12);
 if(gone.length){tl.to(gone,{opacity:.3,duration:.45,ease:'sine.in'},tP+.2);tl.to(gone,{opacity:1,duration:.6,ease:'sine.out'},tC+.7);}

 tl.to(cam,{f:1,g:0,duration:1.55,ease:'sine.inOut',lazy:false},tC);
 tl.to(cam,{gk:0,gy:.5,duration:1.55,ease:'sine.inOut',lazy:false},tC);
 tl.to(embF,{a:0,duration:1.2,ease:'sine.inOut'},tC);
 tl.to(darkF,{a:0,duration:1.4,ease:'sine.inOut'},tC+.15);
 tl.fromTo(wtags,{opacity:0},{opacity:1,duration:.45,ease:'sine.out',immediateRender:false},tC+1);
}});
})();
