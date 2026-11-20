'use strict';
/* Shared helpers for photo ("epik") windows: window.KE. Load before the window files.
 *
 *  - window skeleton from a picture: KE.flat (light mode: the flat frame), KE.sloj (a depth layer from sloi/),
 *    KE.obj (a cut-out from obj/), KE.breathe (a cut-out "breathes"); tweens KE.FT / KE.go / KE.pulse;
 *    labels KE.tag / KE.hand (canvas label + a DOM copy for the board)
 *  - light and focus: KE.spot (soft light on an object + sparkles), KE.band (a band of light over a polygon),
 *    KE.pyl (pollen or dust in a beam), KE.rosa (dew sparkles over points), KE.inset (picture in picture),
 *    KE.vosp (a round "memory" inset)
 *  - visual inserts drawn in code: KE.title (a calm large title), KE.znak (round "?" / "!" badge), KE.lenta (a ribbon
 *    label), KE.card (a dark-glass card: lines with **bold**, _italic_, {accent}, bullets, two columns, a table);
 *    every card row is its own layer with a field p, so it appears on its own word
 *  - KE.gap (cover the board gap on a slide), KE.board (a DOM copy for the board after the cartoon),
 *    KE.akcent (an accent ring of sparks on a word), KE.ugolki (corner brackets)
 * Timing rules are the core's: every event is a timeline tween of a field (p, o, a, hl...), background life is a pure
 * function of T, nothing accumulates. Canvas fonts used here: Lora 700/italic, PT Sans, PT Serif.
 */

(function(){
const PM=[56,32];
const LT=()=>!!(window.kino&&window.kino.light);
const G=W=>W._G||{};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const e3=u=>1-Math.pow(1-clamp(u,0,1),3);

const C=Object.assign({leaf:'#7cc46a',leaf2:'#b8e6a0',leaf3:'#e4f6d8',cream:'#f5f0e1',ink:'#f5f0e1',dim:'rgba(232,236,222,.42)',dim2:'rgba(232,236,222,.24)',
 glass:'rgba(10,18,13,.84)',edge:'rgba(150,215,130,.5)',red:'#d43a2c',purple:'#6d3fa8',blue:'#2662ad',scrim:'5,10,7'},(window.KINO&&window.KINO.palette)||{});
const F={sans:"'PT Sans', sans-serif",serif:"'PT Serif', serif",lora:"Lora, 'PT Serif', serif"};

function parse(s){const out=[];let st={b:0,i:0,g:0,s:0},buf='';const push=()=>{if(buf){out.push(Object.assign({t:buf},st));buf='';}};
 for(let i=0;i<s.length;i++){const ch=s[i];
  if(ch==='*'&&s[i+1]==='*'){push();st=Object.assign({},st,{b:st.b?0:1});i++;continue;}
  if(ch==='_'){push();st=Object.assign({},st,{i:st.i?0:1});continue;}
  if(ch==='{'||ch==='}'){push();st=Object.assign({},st,{g:ch==='{'?1:0});continue;}
  if(ch==='^'){push();st=Object.assign({},st,{s:st.s?0:1});continue;}
  buf+=ch;}
 push();return out;}
const fontOf=(r,f,o={})=>`${r.i?'italic ':''}${r.b?700:(o.w||400)} ${f}px ${r.s||o.ser?F.serif:o.lora?F.lora:F.sans}`;
const MC=document.createElement('canvas').getContext('2d');

function layoutText(text,f,maxW,o={}){const words=[];for(const r of parse(text)){const parts=r.t.split(/(\s+)/);for(const p of parts){if(!p)continue;words.push(Object.assign({},r,{t:p,sp:/^\s+$/.test(p)}));}}
 const lines=[];let cur=[],x=0;
 for(const w of words){MC.font=fontOf(w,f,o);const ww=MC.measureText(w.t).width;
  if(w.sp){if(cur.length){cur.push(Object.assign({},w,{x,ww,font:MC.font}));x+=ww;}continue;}
  if(x+ww>maxW&&cur.length){while(cur.length&&cur[cur.length-1].sp){x-=cur.pop().ww;}lines.push({runs:cur,w:x});cur=[];x=0;}
  cur.push(Object.assign({},w,{x,ww,font:MC.font}));x+=ww;}
 while(cur.length&&cur[cur.length-1].sp){x-=cur.pop().ww;}
 if(cur.length)lines.push({runs:cur,w:x});
 return lines;}
function drawRuns(c,line,x,y,o={}){for(const r of line.runs){if(r.sp)continue;c.font=r.font;c.fillStyle=r.g?(o.g||C.leaf2):(o.ink||C.ink);c.fillText(r.t,x+r.x,y);}}
const rr=(c,x,y,w,h,r)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);};
const fontsReady=()=>!document.fonts||document.fonts.status==='loaded';

function drawZnak(c,x,y,r,ch,{a=1,s=1,g=0,px=2}={}){if(a<=.003)return;c.save();c.globalAlpha*=a;c.translate(x,y);c.scale(s,s);
 if(g>0){const gr=c.createRadialGradient(0,0,r*.6,0,0,r*2.4);gr.addColorStop(0,`rgba(255,120,100,${(.45*g).toFixed(3)})`);gr.addColorStop(1,'rgba(255,120,100,0)');c.fillStyle=gr;c.fillRect(-r*2.4,-r*2.4,r*4.8,r*4.8);}
 c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=r*.5*px;c.shadowOffsetY=r*.08*px;c.beginPath();c.arc(0,0,r,0,7);c.fillStyle=C.red;c.fill();c.restore();
 const gg=c.createLinearGradient(0,-r,0,r);gg.addColorStop(0,'rgba(255,255,255,.18)');gg.addColorStop(.5,'rgba(255,255,255,0)');c.fillStyle=gg;c.beginPath();c.arc(0,0,r,0,7);c.fill();
 c.lineWidth=r*.09;c.strokeStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(0,0,r*.9,0,7);c.stroke();
 c.fillStyle='#fff';c.font=`700 ${(r*1.32).toFixed(2)}px ${F.sans}`;c.textAlign='center';c.textBaseline='middle';c.fillText(ch,0,r*.06);
 c.restore();}

function drawLenta(c,x,y,text,f,{color=C.purple,a=1,u=1,px=2}={}){if(a<=.003||u<=0)return;c.save();c.globalAlpha*=a;
 c.font=`700 ${f}px ${F.sans}`;const tw=c.measureText(text).width,h=f*1.62,w=tw+f*1.5,n=f*.5;
 if(u<1){c.beginPath();c.rect(x-2,y-h,(w+n+4)*u,h*2);c.clip();}
 c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=f*.5*px;c.shadowOffsetY=f*.1*px;
 c.beginPath();c.moveTo(x+h*.18,y-h/2);c.lineTo(x+w+n,y-h/2);c.lineTo(x+w,y);c.lineTo(x+w+n,y+h/2);c.lineTo(x+h*.18,y+h/2);c.quadraticCurveTo(x,y+h/2,x,y+h/2-h*.18);c.lineTo(x,y-h/2+h*.18);c.quadraticCurveTo(x,y-h/2,x+h*.18,y-h/2);c.closePath();
 c.fillStyle=color;c.fill();c.restore();
 const gg=c.createLinearGradient(0,y-h/2,0,y+h/2);gg.addColorStop(0,'rgba(255,255,255,.2)');gg.addColorStop(.5,'rgba(255,255,255,0)');gg.addColorStop(1,'rgba(0,0,0,.14)');c.fillStyle=gg;c.fill();
 c.fillStyle='#fff';c.textBaseline='middle';c.textAlign='left';c.fillText(text,x+f*.62,y+f*.05);
 c.restore();}

window.KE={PM,LT,C,F,parse,layoutText,drawRuns,drawZnak,drawLenta,

 flat(k,W,name,{noBreath=false}={}){W._G={gate:LT};
  return k.bg(W,name,{gate:()=>{if(!LT())return true;if(!W.flat){W.flat=1;W.par=0;if(noBreath)W.breath=null;}return false;}});},

 sloj(k,W,name,d,o={}){if(!d)return k.bg(W,'sloi/'+name,Object.assign({},G(W),o));
  return k.lay(W,'sloi/'+name,Object.assign({x:400,y:225,w:920.64,d,pmax:PM},G(W),o));},

 obj(k,W,name,{x,y,w,d=0,z=-9.5,o}={}){return k.lay(W,'obj/'+name,Object.assign({x,y,w,d,z,pmax:d?PM:null},G(W),o||{}));},

 breathe(it,W,{f=.18,ph=0,b=.003,deg=0,pv=1}={}){it.pv=pv;
  it.amb=T=>W.flat?null:{sy:1+b*(.5+.5*Math.sin(2*Math.PI*f*T+ph)),r:deg*Math.sin(2*Math.PI*f*.55*T+ph*1.7)};return it;},

 FT(tl,o,p,a,b,t,d,e='sine.inOut'){return tl.fromTo(o,{[p]:a},{[p]:b,duration:d,ease:e,immediateRender:false},t);},

 go(tl,o,t,d,e='none'){return tl.fromTo(o,{p:0},{p:1,duration:d,ease:e,immediateRender:false},t);},

 pulse(tl,o,t,{a0=1,a1=0,up=.35,hold=.2,down=1.1}={}){tl.fromTo(o,{a:0},{a:a0,duration:up,ease:'power2.out',immediateRender:false},t);
  tl.to(o,{a:a1,duration:down,ease:'sine.inOut'},t+up+hold);},

 tag(k,W,text,x,y,o={}){const L=k.ctag(W,text,x,y,Object.assign({z:4},o));
  if(o.board!==false){const e=k.T(text,W,o.bx??x,o.by??y,{f:o.f||12,rot:o.rot||0});k.onboard(e);L.dom=e;}return L;},

 hand(k,W,text,x,y,o={}){const L=k.chand(W,text,x,y,Object.assign({z:4},o));
  if(o.board){const e=k.H(text.replace(/\n/g,'<br>'),W,o.bx??x,o.by??y,{f:o.f||15,rot:o.rot||0,cls:o.light?'light':''});k.onboard(e);}return L;},

 cwords(k,L,ts,frs,step=.45){const tl=k.tl;tl.fromTo(L,{p:0},{p:1,duration:.01,ease:'none',immediateRender:false},ts[0]-.05);
  let u0=0;ts.forEach((t,i)=>{tl.fromTo(L,{u:u0},{u:frs[i],duration:step,ease:'sine.inOut',immediateRender:false},t-.05);u0=frs[i];});},
 doli(text,words){const out=[];let pos=0;for(const w of words){const i=text.indexOf(w,pos);pos=i+w.length;out.push(Math.min(1,(pos+.5)/text.length));}out[out.length-1]=1;return out;},

 gap(k,Wa,Wb,{feather=28}={}){const st={p:0};
  k.over.push(ctx=>{const p=st.p;if(!(p>0)||!(p<1)||k.free)return;const K=Math.min(.96,1.9*Math.sin(Math.PI*p));if(K<=.003)return;
   const vert=Math.abs(Wa.x-Wb.x)<Math.abs(Wa.y-Wb.y),[A,B]=vert?(Wa.y<Wb.y?[Wa,Wb]:[Wb,Wa]):(Wa.x<Wb.x?[Wa,Wb]:[Wb,Wa]),ft=feather;ctx.save();
   const z0=vert?A.y+A.h-ft:A.x+A.w-ft,z1=vert?B.y+ft:B.x+ft,f=ft/(z1-z0),g=vert?ctx.createLinearGradient(0,z0,0,z1):ctx.createLinearGradient(z0,0,z1,0);
   g.addColorStop(0,'rgba(4,9,6,0)');g.addColorStop(f,`rgba(4,9,6,${K.toFixed(3)})`);g.addColorStop(1-f,`rgba(4,9,6,${K.toFixed(3)})`);g.addColorStop(1,'rgba(4,9,6,0)');ctx.fillStyle=g;
   if(vert){const x0=Math.min(A.x,B.x)-60,x1=Math.max(A.x+A.w,B.x+B.w)+60;ctx.fillRect(x0,z0,x1-x0,z1-z0);}
   else{const y0=Math.min(A.y,B.y)-60,y1=Math.max(A.y+A.h,B.y+B.h)+60;ctx.fillRect(z0,y0,z1-z0,y1-y0);}
   ctx.restore();});
  return st;},

 board(k,W,text,x,y,{f=14,kind='tag'}={}){const e=kind==='hand'?k.H(text,W,x,y,{f}):k.T(text,W,x,y,{f});k.onboard(e);return e;},

 akcent(k,W,x,y,{r=40,d=0,z=5,word=null,rgb='236,255,224',n=10,seed=1}={}){const R0=k.rng(seed),A=[];for(let i=0;i<n;i++)A.push([R0()*Math.PI*2,.75+R0()*.4,R0()*.25]);
  return k.fx(W,d,(c,W_,it,T,px)=>{const p=it.p;if(!(p>0&&p<1))return;const e=e3(p),fa=Math.sin(Math.PI*clamp(p,0,1));c.save();c.globalCompositeOperation='lighter';
   const rr_=r*(.35+.65*e),g=c.createRadialGradient(x,y,rr_*.55,x,y,rr_*1.15);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.7,`rgba(${rgb},${(.26*fa).toFixed(3)})`);g.addColorStop(1,`rgba(${rgb},0)`);
   c.fillStyle=g;c.fillRect(x-rr_*1.2,y-rr_*1.2,rr_*2.4,rr_*2.4);
   for(const [a,k_,ph] of A){const u=clamp((p-ph)/(1-ph),0,1);if(u<=0||u>=1)continue;const v=Math.sin(Math.PI*u),px_=x+Math.cos(a)*rr_*k_,py_=y+Math.sin(a)*rr_*k_,s=2.2+2.6*v;
    c.strokeStyle=`rgba(250,255,244,${(.9*v).toFixed(3)})`;c.lineWidth=.7;c.beginPath();c.moveTo(px_-s,py_);c.lineTo(px_+s,py_);c.moveTo(px_,py_-s);c.lineTo(px_,py_+s);c.stroke();}
   c.restore();},{p:0,z,strong:true,word,pmax:d?PM:null});},

 spot(k,W,x,y,{r=40,rgb='255,248,220',pts=null,d=0,z=1.2,sr=6,ring=null}={}){const E=k.EFF;
  return k.fx(W,d,(c,W_,it,T,px)=>{if(it.a>.003){c.save();c.globalCompositeOperation='lighter';const R=r*(.85+.15*it.a),g=c.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0,`rgba(255,252,236,${Math.min(1,.3*it.a).toFixed(3)})`);g.addColorStop(.4,`rgba(${rgb},${Math.min(1,.17*it.a).toFixed(3)})`);g.addColorStop(1,`rgba(${rgb},0)`);
    c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);
    if(ring){c.globalCompositeOperation='source-over';c.lineWidth=1.6;c.strokeStyle=`rgba(236,255,224,${(.8*it.a).toFixed(3)})`;c.shadowColor='rgba(170,240,150,.9)';c.shadowBlur=6*(px||2);
     c.beginPath();c.ellipse(x,y,ring[0],ring[1],0,0,7);c.stroke();}
    c.restore();}
   if(it.pts&&it.p>0&&it.p<1&&E.sparkles)E.sparkles(c,it.pts,it.p,1,{r:sr,win:.5,rgb:'240,255,220'});},{a:0,p:0,pts,z,pmax:d?PM:null});},

 band(k,W,poly,{rgb='170,235,140',d=0,z=2,edge=true}={}){const xs=poly.map(q=>q[0]),x0=Math.min(...xs),x1=Math.max(...xs);
  return k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1),A=it.a;if(p<=0||A<=.003)return;c.save();
   c.beginPath();poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.save();c.clip();
   const xe=x0+(x1-x0)*e3(p),g=c.createLinearGradient(x0,0,xe,0);g.addColorStop(0,`rgba(${rgb},${(.32*A).toFixed(3)})`);g.addColorStop(Math.max(0,1-12/Math.max(1,xe-x0)),`rgba(${rgb},${(.42*A).toFixed(3)})`);g.addColorStop(1,`rgba(240,255,230,${(.7*A).toFixed(3)})`);
   c.globalCompositeOperation='screen';c.fillStyle=g;c.fillRect(x0,-500,xe-x0,2000);c.restore();
   if(edge&&p>=1){c.lineWidth=1.2;c.strokeStyle=`rgba(220,255,205,${(.75*A).toFixed(3)})`;c.shadowColor='rgba(150,230,120,.9)';c.shadowBlur=5*(px||2);c.stroke();}
   c.restore();},{p:0,a:1,z,pmax:d?PM:null});},

 pyl(k,W,d,box,{kind='pyl',n=22,a=.8,seed=3,z=1}={}){const L=k.EFF.L,[x0,y0,x1,y1]=box;
  const o=kind==='luch'?{rgb:'255,238,200',vy:4,wind:2,size:.75,sway:9,hot:.05}:{rgb:'236,240,170',vy:7,wind:5,size:.9,sway:16,hot:.08};
  return k.fx(W,d,L.embers,Object.assign({x0,y0,x1,y1,a,n,seed,z,pmax:d?PM:null},o,G(W)));},

 rosa(k,W,pts,{d=0,a=.85,r=3.2,f=.35,z=1}={}){return k.fx(W,d,(c,W_,it,T)=>{if(!pts.length||it.a<=.003)return;c.save();c.globalCompositeOperation='lighter';
   for(let i=0;i<pts.length;i++){const [x,y]=pts[i],ph=(i*.6180339)%1,u=((T*f+ph)%1+1)%1,v=Math.pow(Math.max(0,Math.sin(u*Math.PI)),6)*it.a;if(v<.02)continue;
    const R=r*(.6+.6*v);c.strokeStyle=`rgba(250,255,240,${(.9*v).toFixed(3)})`;c.lineWidth=.6;c.beginPath();c.moveTo(x-R,y);c.lineTo(x+R,y);c.moveTo(x,y-R);c.lineTo(x,y+R);c.stroke();
    const g=c.createRadialGradient(x,y,0,x,y,R*.7);g.addColorStop(0,`rgba(255,255,250,${v.toFixed(3)})`);g.addColorStop(1,'rgba(255,255,250,0)');c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);}
   c.restore();},{a,z,pmax:d?PM:null});},

 inset(k,W,name,{crop,x,y,w,rot=0,z=4.2}={}){const im=k.img(name);
  const ar=(crop[3]-crop[1])*1116/((crop[2]-crop[0])*2000),h=w*ar;
  return k.fx(W,0,(c,W_,it,T,px)=>{const p=it.p;if(!(p>.003)||!im.lv.length)return;const src=im.lv[0],sw=src.width,sh=src.height,e=e3(p),s=.94+.06*e;
   c.save();c.globalAlpha*=Math.min(1,p*1.6);c.translate(x,y);c.rotate(rot*Math.PI/180);c.scale(s,s);
   c.save();c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=16*(px||2);c.shadowOffsetY=3*(px||2);c.fillStyle='rgba(7,12,9,.94)';rr(c,-w/2-3,-h/2-3,w+6,h+6,4);c.fill();c.restore();
   const kz=it.kz||1,cw=(crop[2]-crop[0])/kz,ch=(crop[3]-crop[1])/kz,cx=(crop[0]+crop[2])/2+(it.shx||0)*(crop[2]-crop[0]),cy=(crop[1]+crop[3])/2+(it.shy||0)*(crop[3]-crop[1]);
   c.save();rr(c,-w/2,-h/2,w,h,2.5);c.clip();c.drawImage(src,(cx-cw/2)*sw,(cy-ch/2)*sh,cw*sw,ch*sh,-w/2,-h/2,w,h);
   if(it.sw>0&&it.sw<1&&k.EFF.sweep)k.EFF.sweep(c,0,0,w,h,it.sw,.7,{ang:.5,width:.35});c.restore();
   c.strokeStyle='rgba(150,215,130,.85)';c.lineWidth=1.1;rr(c,-w/2-.6,-h/2-.6,w+1.2,h+1.2,3);c.stroke();
   c.restore();},{p:0,kz:1,shx:0,shy:0,sw:0,z});},

 vosp(k,W,name,{crop,x,y,r,tx,ty,z=4.4}={}){const im=k.img(name);let cache=null;
  const make=()=>{if(cache||!im.lv.length)return cache;const src=im.lv[0],S=Math.round(r*2*3.2),cv=document.createElement('canvas');cv.width=cv.height=S;const x_=cv.getContext('2d');
   const cw=(crop[2]-crop[0])*src.width,ch=(crop[3]-crop[1])*src.height,sc=Math.max(S/cw,S/ch);
   x_.drawImage(src,crop[0]*src.width,crop[1]*src.height,cw,ch,(S-cw*sc)/2,(S-ch*sc)/2,cw*sc,ch*sc);

   x_.globalCompositeOperation='saturation';x_.fillStyle='hsl(0,0%,50%)';x_.globalAlpha=.78;x_.fillRect(0,0,S,S);
   x_.globalCompositeOperation='multiply';x_.globalAlpha=1;x_.fillStyle='rgb(255,232,196)';x_.fillRect(0,0,S,S);
   x_.globalCompositeOperation='screen';x_.fillStyle='rgba(60,40,20,.25)';x_.fillRect(0,0,S,S);

   x_.globalCompositeOperation='destination-in';const g=x_.createRadialGradient(S/2,S/2,S*.32,S/2,S/2,S/2);g.addColorStop(0,'#000');g.addColorStop(.82,'rgba(0,0,0,.85)');g.addColorStop(1,'rgba(0,0,0,0)');x_.fillStyle=g;x_.fillRect(0,0,S,S);
   return cache=cv;};
  return k.fx(W,0,(c,W_,it,T,px)=>{const p=it.p;if(!(p>.003)&&!(it.d3>0))return;const cv=make();

   if(tx!=null&&it.d3>0){for(let i=0;i<3;i++){const u=clamp(it.d3*3-i,0,1);if(u<=0)continue;const f=(i+1)/4,px_=tx+(x-tx)*f,py_=ty+(y-ty)*f,R=2+i*1.3;
     c.save();c.globalAlpha*=u*.9;c.fillStyle='rgba(250,246,232,.95)';c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=4*(px||2);c.beginPath();c.arc(px_,py_,R,0,7);c.fill();c.restore();}}
   if(!cv||!(p>.003))return;const e=e3(p),s=.75+.25*e;
   c.save();c.globalAlpha*=Math.min(1,p*1.4);c.translate(x,y);c.scale(s,s);
   const gl=c.createRadialGradient(0,0,r*.8,0,0,r*1.35);gl.addColorStop(0,'rgba(250,240,215,.0)');gl.addColorStop(.3,'rgba(250,240,215,.22)');gl.addColorStop(1,'rgba(250,240,215,0)');c.fillStyle=gl;c.fillRect(-r*1.4,-r*1.4,r*2.8,r*2.8);
   c.drawImage(cv,-r,-r,2*r,2*r);
   c.lineWidth=1.2;c.strokeStyle='rgba(250,240,215,.55)';c.setLineDash([3,4]);c.beginPath();c.arc(0,0,r*.94,0,7);c.stroke();c.setLineDash([]);
   c.restore();},{p:0,d3:0,z});},

 ugolki(k,W,x0,y0,x1,y1,{d=0,z=3,L=9}={}){return k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1);if(p<=0)return;const l=L*e3(p);
   c.save();c.lineWidth=1.5;c.lineCap='round';c.strokeStyle='rgba(250,252,240,.92)';c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=3*(px||2);c.beginPath();
   for(const [x,y,sx,sy] of [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]]){c.moveTo(x,y+sy*l);c.lineTo(x,y);c.lineTo(x+sx*l,y);}
   c.stroke();c.restore();},{p:0,z,pmax:d?PM:null});},

 title(k,W,lines,x,y,{gap=.18,z=5,line=null,d=0}={}){
  return k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1);if(p<=.003)return;const e=e3(p);
   c.save();c.globalAlpha*=Math.min(1,p*1.3);c.translate(x,y+6*(1-e));const s=(it.s||1)*(1.03-.03*e);c.scale(s,s);
   const hs=lines.map(l=>l.f*(1+gap)),H=hs.reduce((a,b)=>a+b,0);let wMax=0;
   for(const l of lines){c.font=`${l.it?'italic 500':'700'} ${l.f}px ${F.lora}`;wMax=Math.max(wMax,c.measureText(l.t).width);}
   const rx=wMax*.62+30,ry=H*.62+22;c.save();c.scale(1,ry/rx);const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(${C.scrim},.55)`);g.addColorStop(.6,`rgba(${C.scrim},.32)`);g.addColorStop(1,`rgba(${C.scrim},0)`);c.fillStyle=g;c.fillRect(-rx,-rx,2*rx,2*rx);c.restore();
   c.textAlign='center';c.textBaseline='middle';let yy=-H/2;
   lines.forEach((l,i)=>{const cy=yy+hs[i]/2;c.font=`${l.it?'italic 500':'700'} ${l.f}px ${F.lora}`;
    c.save();c.shadowColor='rgba(0,0,0,.85)';c.shadowBlur=l.f*.28*(px||2);c.shadowOffsetY=l.f*.04*(px||2);c.fillStyle=l.g?C.leaf2:'#fbf7ea';c.fillText(l.t,0,cy);c.restore();
    c.fillStyle=l.g?C.leaf2:'#fbf7ea';c.fillText(l.t,0,cy);yy+=hs[i];});
   if(line&&it.u>0){const lw=line.w||wMax,ly=line.y??(H/2+8),u=e3(it.u);c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
    c.strokeStyle='rgba(124,196,106,.35)';c.lineWidth=5;c.beginPath();c.moveTo(-lw/2,ly);c.lineTo(-lw/2+lw*u,ly);c.stroke();
    c.strokeStyle='rgba(236,255,226,.95)';c.lineWidth=1.4;c.stroke();c.restore();}
   c.restore();},{p:0,o:1,s:1,u:0,z});},

 znak(k,W,ch,x,y,{r=14,z=5,d=0}={}){return k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1);if(p<=.003)return;const e=e3(p);
   drawZnak(c,x,y,r,ch,{a:Math.min(1,p*1.6),s:(it.s||1)*(.6+.4*e+.06*Math.sin(Math.PI*clamp(p,0,1))),g:it.g||0,px});},{p:0,o:1,s:1,g:0,z,pmax:d?PM:null});},

 lenta(k,W,text,x,y,{color='fiolet',f=13,z=5,d=0}={}){const col=color==='fiolet'?C.purple:color==='sin'?C.blue:color;
  return k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1);if(p<=.003)return;drawLenta(c,x,y,text,f,{color:col,a:Math.min(1,p*2),u:e3(p),px});},{p:0,o:1,z,pmax:d?PM:null});},

 card(k,W,{x,y,w,f=12,rows=[],pad=null,z=4.6,d=0,glass=C.glass,minH=0}={}){const P=pad??f*.9,K={x,y,w,h:0,lay:null,ver:-1};
  const IW=()=>w-P*2-f*.25;
  const layout=()=>{const ok=fontsReady();if(K.lay&&(K.ok||!ok)&&K.ver===(ok?1:0))return K.lay;K.ok=ok;K.ver=ok?1:0;let yy=P*.85;const out=[];
   for(const r0 of rows){const r=typeof r0==='string'?{t:r0}:r0,fr=r.f||f;let h=0,L={r,y:yy};
    if(r.gap!=null)h=r.gap;
    else if(r.title!=null){h=fr*1.55;}
    else if(r.lines){h=r.lines.length*fr*1.15+fr*.15;}
    else if(r.toc!=null){h=fr*1.42;}
    else if(r.cols){h=fr*1.5+(Math.max(...r.cols.map(q=>q.n||3)))*fr*1.22+fr*.2;}
    else if(r.table){h=((r.n||2)+1)*fr*1.85+2;}
    else if(r.draw){h=r.h||fr*2;}
    else{const ind=(r.icon?fr*1.75:0)+(r.bul?fr*1.05:0)+(r.ind||0);L.ind=ind;L.lines=layoutText(r.t,fr,IW()-ind,{ser:r.ser});h=Math.max(r.icon?fr*1.75:0,L.lines.length*fr*1.3)+fr*.12;}
    L.h=h;out.push(L);yy+=h;}
   K.h=Math.max(minH,yy+P*.7);K.lay=out;return out;};

  const visH=()=>{const lay=layout();let y=0;for(let i=0;i<lay.length;i++){const q=K.rows[i]?clamp(K.rows[i].p,0,1):0;if(q>0)y=Math.max(y,lay[i].y+lay[i].h*e3(Math.min(1,q*1.6)));}
   return Math.max(minH,y>0?y+P*.7:P*1.9);};
  const bg=k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1);if(p<=.003)return;layout();const e=e3(p),s=.97+.03*e,H=visH();
   c.save();c.globalAlpha*=Math.min(1,p*1.5);c.translate(x+w/2,y);c.scale(s,s);c.translate(-w/2,0);
   c.save();c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=14*(px||2);c.shadowOffsetY=3*(px||2);rr(c,0,0,w,H,f*.5);c.fillStyle=glass;c.fill();c.restore();
   c.save();rr(c,0,0,w,H,f*.5);c.clip();const gg=c.createLinearGradient(0,0,0,H);gg.addColorStop(0,'rgba(200,255,190,.06)');gg.addColorStop(1,'rgba(200,255,190,0)');c.fillStyle=gg;c.fillRect(0,0,w,H);
   c.fillStyle=C.leaf;c.fillRect(0,0,f*.26,H);c.restore();
   c.lineWidth=.9;c.strokeStyle=C.edge;rr(c,.45,.45,w-.9,H-.9,f*.5);c.stroke();
   if(it.hl>0){c.save();c.lineWidth=1.6;c.strokeStyle=`rgba(220,255,205,${(.9*it.hl).toFixed(3)})`;c.shadowColor='rgba(150,230,120,.95)';c.shadowBlur=10*it.hl*(px||2);rr(c,.45,.45,w-.9,H-.9,f*.5);c.stroke();c.restore();}
   c.restore();},{p:0,o:1,hl:0,z,pmax:d?PM:null});
  const rowL=rows.map((r0,i)=>k.fx(W,d,(c,W_,it,T,px)=>{const p=clamp(it.p,0,1),cp=clamp(bg.p,0,1);if(p<=.003||cp<=.003||bg.o<=.003)return;const lay=layout(),L=lay[i];if(!L)return;
   const r=L.r,fr=r.f||f,e=e3(p),es=.97+.03*e3(cp);
   c.save();c.globalAlpha*=Math.min(1,p*1.5)*Math.min(1,cp*1.5)*bg.o;c.translate(x+w/2,y);c.scale(es,es);c.translate(-w/2,0);
   c.translate(P+f*.25-(1-e)*6,L.y);const IWv=IW();
   if(it.hl>0){c.save();c.fillStyle=`rgba(124,196,106,${(.3*it.hl).toFixed(3)})`;rr(c,-P*.45,-fr*.08,IWv+P*.9,L.h+fr*.02,fr*.3);c.fill();c.restore();}
   c.textBaseline='middle';c.textAlign='left';
   if(r.gap!=null){}
   else if(r.title!=null){c.font=`700 ${fr}px ${F.lora}`;c.fillStyle='#fbf7ea';c.fillText(r.title,0,fr*.62);c.fillStyle='rgba(124,196,106,.75)';c.fillRect(0,fr*1.28,IWv*Math.min(1,e*1.2),1.1);}
   else if(r.lines){r.lines.forEach((q,j)=>{c.fillStyle=C.dim2;rr(c,0,j*fr*1.15+fr*.32,IWv*q*e,fr*.42,fr*.21);c.fill();});}
   else if(r.toc!=null){const ind=(r.lvl||0)*fr*1.2;c.font=`${r.lvl?400:700} ${fr}px ${F.sans}`;c.fillStyle=r.lvl?C.ink:'#fbf7ea';c.fillText(r.toc,ind,fr*.7);
    const tw=c.measureText(r.toc).width,bx=IWv-fr*1.5;c.fillStyle=C.dim;for(let xx=ind+tw+fr*.45;xx<bx-fr*.4;xx+=fr*.42){c.beginPath();c.arc(xx,fr*.92,.75,0,7);c.fill();}
    c.fillStyle=C.dim2;rr(c,bx,fr*.4,fr*1.4,fr*.62,fr*.2);c.fill();}
   else if(r.cols){const n=r.cols.length,cw=IWv/n;r.cols.forEach((q,j)=>{const cx=j*cw;c.font=`700 ${fr}px ${F.sans}`;c.fillStyle=C.leaf2;c.fillText(q.h,cx,fr*.7);
     for(let m=0;m<(q.n||3);m++){const yy=fr*1.5+m*fr*1.22+fr*.55;c.fillStyle=C.leaf;c.beginPath();c.arc(cx+fr*.3,yy,fr*.17,0,7);c.fill();c.fillStyle=C.dim2;rr(c,cx+fr*.8,yy-fr*.21,(cw-fr*1.6)*(.95-.12*((m+j)%3)),fr*.42,fr*.21);c.fill();}});}
   else if(r.table){const n=r.table.length,cw=IWv/n,rh=fr*1.85,R=(r.n||2)+1;c.strokeStyle='rgba(150,215,130,.55)';c.lineWidth=.9;
    c.fillStyle='rgba(124,196,106,.18)';c.fillRect(0,0,IWv,rh);c.strokeRect(0,0,IWv,rh*R);
    for(let j=1;j<n;j++){c.beginPath();c.moveTo(j*cw,0);c.lineTo(j*cw,rh*R);c.stroke();}for(let m=1;m<R;m++){c.beginPath();c.moveTo(0,m*rh);c.lineTo(IWv,m*rh);c.stroke();}
    c.font=`700 ${fr}px ${F.sans}`;c.textAlign='center';c.fillStyle='#fbf7ea';r.table.forEach((h,j)=>c.fillText(h,j*cw+cw/2,rh*.52));c.textAlign='left';}
   else if(r.draw){r.draw(c,0,0,IWv,it,K,px);}
   else{const lh=fr*1.3,top=Math.max(0,((r.icon?fr*1.75:0)-L.lines.length*lh)/2);
    if(r.icon)drawZnak(c,fr*.78,Math.max(fr*.85,top+lh*.5+(L.lines.length>1?0:0)),fr*.72,r.icon,{px});
    if(r.bul){c.fillStyle=C.leaf;c.beginPath();c.arc((r.icon?fr*1.75:0)+fr*.32,top+lh*.5,fr*.18,0,7);c.fill();}
    L.lines.forEach((ln,j)=>{const xx=r.center?(IWv-ln.w)/2:L.ind;drawRuns(c,ln,xx,top+lh*(j+.5),{ink:r.ink});});}
   c.restore();},{p:0,hl:0,sel:0,z:z+.01+i*.001,pmax:d?PM:null}));
  K.bg=bg;K.rows=rowL;return {bg,rows:rowL,C:K,layout};},

 rowsAt(tl,card,ts,dur=.45){let last=null;ts.forEach((t,i)=>{const L=card.rows[i];if(!L||t===false)return;const tt=t==null?last:t;if(tt==null)return;last=tt;
  tl.fromTo(L,{p:0},{p:1,duration:dur,ease:'sine.out',immediateRender:false},tt);});},

 cardIn(tl,card,t,dur=.5){tl.fromTo(card.bg,{p:0},{p:1,duration:dur,ease:'sine.out',immediateRender:false},t);},
 cardOut(tl,card,t,dur=.45){tl.to(card.bg,{o:0,duration:dur,ease:'sine.in'},t);},

 rowHl(tl,L,t,{h1=0,up=.35,hold=1.2,down=.8}={}){tl.fromTo(L,{hl:0},{hl:1,duration:up,ease:'sine.out',immediateRender:false},t);if(h1!==1)tl.to(L,{hl:h1,duration:down,ease:'sine.inOut'},t+up+hold);},
};
})();
