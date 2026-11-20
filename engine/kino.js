'use strict';
// Scene core ("kino"): the engine behind every cartoon. One file draws a board of comic/photo windows on a canvas,
// animates layers, labels and a camera on a paused GSAP timeline, and hands that timeline to the player
// (engine/player.js), which sets it to the narration's current time on every frame. Every frame is therefore a pure
// function of audio time: seek, rewind, 2x speed and ?t=31 all give the identical frame.
//
// A scene page loads, in order: gsap, engine/rng.js, engine/player.js, engine/fxgl.js, engine/effekty*.js,
// window.KINO = {...config...}, engine/kit-epik.js (optional helpers), the window files (okna/w1.js ... itog.js)
// and finally this file. Each window file registers itself in window.KINO_OKNA as {n, setup(k), build(tl,k)}:
// setup lays out layers, glows and labels once; build adds its piece of the timeline once the word timings are in.
// All setups run in order of n, then the board is prepared; all builds run in order of n.
// The window API (k.*) is documented in docs/ENGINE_API.md.

const KINO=Object.assign({art:'art/',cover:{kicker:'',title:'',sub:''},
 files:{audio:'narration.mp3',beats:'beats.json',words:'words.json',voAudio:'narration-vopros.mp3',voBeats:'beats-vopros.json'},
 finaleLabel:'Доска'},window.KINO||{});
KINO.files=Object.assign({audio:'narration.mp3',beats:'beats.json',words:'words.json',voAudio:'narration-vopros.mp3',voBeats:'beats-vopros.json'},KINO.files||{});

// ── theme: the "material" of the core's painters (canvas tags, big words, hand notes, lines, frame, board, flash,
//    motion softness). window.KINO.theme overrides the defaults below; without it the core draws the comic look.
const TH=(()=>{const D={
 ctk:{},
 word:{font:'Oswald, sans-serif',w:700,k:1.15,ls:.06,fill:'#ffd23f',stroke:'#15110d',sw:.07,shadow:'#15110d',glow:null,gb:.35,dark:null,db:.12,scrim:null,drop:16,sc:1.18,dur:.4},
 hand:{font:'Neucha, cursive',style:'',w:400,fill:'#c8321f',halo:'rgba(255,248,230,.95)',haloW:.24,lfill:'#fff4d6',lstroke:'#15110d',lW:.2,plate:'rgba(18,12,8,.55)',shadow:null,sb:.3,scrim:null,rotK:1},
 line:{style:'pencil',color:'#d0412c',alpha:.92,rgb:'255,214,150',core:'255,246,225'},
 river:{style:'ink',edge:'rgba(20,40,60,.55)',color:'#3d86c6',rgb:'140,205,255',core:'225,245,255'},
 dot:{style:'ink',rgb:'255,214,120',core:'255,246,225'},
 bird:{color:'#17120e',w:.38},
 frame:{style:'paper'},
 board:{bg:'#221b15',base:[43,35,28],lamp:'255,200,140',lampA:.12,edgeA:.25},
 flash:{leak:false},
 motion:{soft:false,rotK:1}};
 const U=(window.KINO&&window.KINO.theme)||{},o={};
 for(const k in D)o[k]=k==='ctk'?Object.assign({},U.ctk||{}):Object.assign({},D[k],U[k]||{});
 return o;})();
const {rng}=window.Paper;
// ── page, flags. ?still=1 freezes background life (T=0) for frame checks; light mode (slow machine: median frame
//    interval of the first 90 played frames > 22 ms) drops WebGL patches, halves particles and uses dpr 1.
//    ?light=1 forces it, ?light=0 never switches.
const cv=document.getElementById('cv'),ctx=cv.getContext('2d'),OV=document.getElementById('ov');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs=new URLSearchParams(location.search);

const STILL=qs.get('still')==='1';
let LIGHT=qs.get('light')==='1';const LIGHT_AUTO=qs.get('light')!=='0';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;

// ── torn edges and noise
function tearPoly(seed,j=1.2,n=22){const r=rng(seed),pts=[];const e=(a,b,c,d)=>{for(let i=0;i<n;i++){const t=i/n;pts.push([a+(c-a)*t,b+(d-b)*t]);}};
 e(0,0,100,0);e(100,0,100,100);e(100,100,0,100);e(0,100,0,0);
 return 'polygon('+pts.map(([x,y])=>{const dx=(x===0?1:x===100?-1:0)*r()*j,dy=(y===0?1:y===100?-1:0)*r()*j;return `${(x+dx).toFixed(2)}% ${(y+dy).toFixed(2)}%`;}).join(',')+')';}
const root=document.documentElement.style;
root.setProperty('--tear3',tearPoly(3,6,30));root.setProperty('--tearT',tearPoly(8,2.2,40));root.setProperty('--tearcap',tearPoly(4,1.1,70));
function noiseCanvas(size,seed,fn){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');const d=x.createImageData(size,size),r=rng(seed);for(let i=0;i<d.data.length;i+=4)fn(d.data,i,r);x.putImageData(d,0,0);return c;}
root.setProperty('--noise',`url(${noiseCanvas(256,11,(d,i,r)=>{const v=r()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}).toDataURL()})`);

// ── pictures: original + downscaled copies (mip levels), picked by on-screen size
const IMG={},WARM=[];
function img(name){if(IMG[name])return IMG[name];const o={lv:[],ar:1};const im=new Image();im.decoding='async';
 im.onload=async()=>{o.ar=im.naturalHeight/im.naturalWidth;let base=im;try{if(window.createImageBitmap)base=await createImageBitmap(im);}catch(e){}
  o.lv=[base];WARM.push(base);let src=base,w=im.naturalWidth,h=im.naturalHeight;
  while(w>360&&window.createImageBitmap){w=Math.round(w/2);h=Math.round(h/2);try{src=await createImageBitmap(src,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'});o.lv.push(src);WARM.push(src);}catch(e){break;}}};
 im.src=KINO.art+name+'.webp';return IMG[name]=o;}
function pick(o,px){let b=o.lv[0];for(const l of o.lv)if(l.width>=px*.85)b=l;return b;}

// ── masks: grey images over the whole window picture (white = "here"), used to draw a layer only inside a region
const MASK={};
function maskImg(name,inv){const key=name+(inv?'~':'');if(MASK[key])return MASK[key];
 const m={ok:false,c:null,bb:[0,0,0,0],w:0,h:0,data:null,name};MASK[key]=m;const im=new Image();im.decoding='async';
 im.onload=async()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height),a=d.data,W=c.width;let x0=W,y0=c.height,x1=-1,y1=-1;
  for(let i=0,p=0;i<a.length;i+=4,p++){const v=inv?255-a[i]:a[i];a[i]=a[i+1]=a[i+2]=0;a[i+3]=v;
   if(v>6){const px=p%W,py=(p/W)|0;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}}
  x.putImageData(d,0,0);let src=c;try{if(window.createImageBitmap)src=await createImageBitmap(c);}catch(e){}
  Object.assign(m,{c:src,w:W,h:c.height,data:a,bb:x1<0?[0,0,0,0]:[x0/W,y0/c.height,(x1+1)/W,(y1+1)/c.height],ok:true});};
 im.onerror=()=>console.warn('mask missing',name);im.src=KINO.art+name+'.webp';return m;}

const MPTS={};
function maskPts(name,n=40,seed=1,{min=.85,inv=false,rect=null}={}){const key=[name,n,seed,min,inv,rect].join('|');if(MPTS[key])return MPTS[key];
 const m=maskImg(name,inv);if(!m.ok)return [];const r=rng(seed),out=[],t=min*255,[rx0,ry0,rx1,ry1]=rect||m.bb;
 for(let k=0;k<n*300&&out.length<n;k++){const fx=rx0+r()*(rx1-rx0),fy=ry0+r()*(ry1-ry0),px=Math.min(m.w-1,fx*m.w|0),py=Math.min(m.h-1,fy*m.h|0);
  if(m.data[(py*m.w+px)*4+3]>=t)out.push([PL.x+fx*PL.w,PL.y+fy*PL.h]);}
 return MPTS[key]=out;}

const BOARD=Object.assign({w:3120,h:1760},KINO.board||{});BOARD.cx=BOARD.w/2;BOARD.cy=BOARD.h/2;
const LIST=Object.assign({x:1020,y:200,w:1080,h:1360},KINO.list||{});
// ── board and windows. Windows are 800x450 units; their pictures are 2000x1116 and cover the window with a bleed
//    (PL). fr(fx,fy) converts picture fractions to window units. The scene declares windows in KINO.windows.
const WINS=[];
function win(id,x,y,w,h,title,num,anchor){const W={id,x,y,w,h,cx:x+w/2,cy:y+h/2,title,num,anchor,p:{x:0,y:0,z:0},items:[],hl:0};WINS.push(W);return W;}
const WDEF=KINO.windows||[];
if(!WDEF.length)throw new Error('KINO.windows is empty: a scene needs at least one window');
WDEF.forEach((d,i)=>win(d.id,d.x,d.y,d.w||800,d.h||450,d.title,i+1,d.anchor||(d.x<BOARD.cx?'r':'l')));
const [W1,W2,W3,W4,W5,W6,W7,W8]=WINS;

const PL={x:-20,y:-9.35,w:840,h:468.7};
const fr=(fx,fy)=>[PL.x+fx*PL.w,PL.y+fy*PL.h];

function lay(W,name,o){const it=Object.assign({img:img(name),x:400,y:225,w:800,d:0,o:1,s:1,r:0,fx:1,dx:0,dy:0,clipY:null,amb:null,foot:false},o);
 if(it.mask)it.mask=maskOpt(it.mask);W.items.push(it);return it;}
const maskOpt=m=>{if(typeof m==='string')m={src:m};m=Object.assign({d:0,inv:false,own:false,pmax:null},m);m.key=[m.src,m.d,m.inv,m.own,m.pmax].join('|');maskImg(m.src,m.inv);return m;};

const bg=(W,name,o)=>lay(W,name,Object.assign({x:400,y:225,w:PL.w,z:-10},o));

const part=(W,name,rect,o)=>{const [x0,y0]=fr(rect[0],rect[1]),[x1,y1]=fr(rect[2],rect[3]);
 return lay(W,name,Object.assign({x:(x0+x1)/2,y:(y0+y1)/2,w:x1-x0,crop:rect.slice(0,4)},o));};

function fx(W,d,draw,o){const it=Object.assign({draw,d,o:1},o);if(it.mask)it.mask=maskOpt(it.mask);W.items.push(it);return it;}
function sortLayers(){for(const W of WINS)W.items.sort((a,b)=>(a.z||0)-(b.z||0));}

let GLN=0,GLWARN=false,GLEV=0,GLF=0,FRAME=0;
const MSTAT={n:0,px:0,ev:0,fon:0};
// ── FXGL patches: a WebGL shader over a rectangle of the window picture (engine/fxgl.js). At most 2 in frame;
//    without WebGL, in reduced motion or light mode nothing is drawn and the picture stays.
function glPatch(W,name,rect,sh,U,o={}){
 const FX=window.FXGL,ok=!!(FX&&FX.SH&&FX.SH[sh]);if(FX&&FX.SH&&!FX.SH[sh])console.warn('glPatch: FXGL has no shader',sh);
 const {mask,alt,...rest}=o,mk=mask?maskOpt(mask):null,fon=!!o.fon;
 const P=ok?FX.patch(rect,FX.SH[sh],{max:1200,mask:mk?()=>{const m=maskImg(mk.src,mk.inv);return m.ok?m.c:null;}:null}):null;
 const R=()=>{const r=P?P.rect:rect,[x0,y0]=fr(r[0],r[1]),[x1,y1]=fr(r[2],r[3]);return [x0,y0,x1-x0,y1-y0];};

 const it=fx(W,0,fon?(c,W,it,T,px)=>{if(it.pre)it.pre();it.on=0;if(!(it.fa>.003))return;const o=IMG[name],has=!!(P&&o&&o.lv.length&&FX.ok&&!reduce);
   if(has&&!(!free.on&&W.sh>.9)&&GLEV+GLF<(FX.maxPerFrame||2)){const [x,y,w,h]=R();
    if(FX.draw(P,o.lv[0],c,x,y,w,h,U(it,T),px||2)){GLF++;GLN++;it.on=FRAME;return;}}
   else if(has)FX.prep(P,o.lv[0]);
   if(alt)alt(c,W,it,T,px);}
  :(c,W,it,T,px)=>{if(it.pre)it.pre();if(!P||reduce||!FX.ok)return;const o=IMG[name];if(!o||!o.lv.length)return;
  if(!(it.amt>.003)){FX.prep(P,o.lv[0]);return;}
  const u=U(it,T);if(u&&u.uAmt!=null&&!(u.uAmt>.003)){FX.prep(P,o.lv[0]);return;}
  if(++GLN>2&&!GLWARN){GLWARN=true;console.warn('more than 2 WebGL patches in frame',+(K.tl?K.tl.time():0).toFixed(2));}
  const [x,y,w,h]=R();FX.draw(P,o.lv[0],c,x,y,w,h,u,px||2);},Object.assign({z:-9},fon?{fa:1,on:0}:{amt:0},rest));
 it.U=U;it.P=P;(W.glp||(W.glp=[])).push(it);return it;}

function glCount(vis,T){let n=0;const FX=window.FXGL;if(reduce||!FX||!FX.ok)return 0;
 for(const W of WINS){if(!W.glp||!vis(W.x-90,W.y-90,W.w+180,W.h+180))continue;
  for(const it of W.glp){if(it.fon||!it.P||!(it.o>.003)||!(it.amt>.003))continue;const u=it.U(it,T);if(u&&u.uAmt!=null&&!(u.uAmt>.003))continue;n++;}}
 return n;}

function walker(it,step=3.2,amp=1.7){it.wk=0;it.amb=T=>({y:-Math.abs(Math.sin(T*step))*amp*it.wk,r:Math.sin(T*step)*.7*it.wk});return it;}

// ── background life of layers (k.A.*): it.amb is a pure function of page time T (no state between frames)
const wrapPos=(v,a,b)=>a+((v-a)%(b-a)+(b-a))%(b-a);

const wrapMargin=(W,it)=>it.w*(it.s||1)*1.15/2+2*Math.abs(it.d||0)*46*(W.par??1)+12;
const A={

 drift(W,it,{vx=4,ph=0,bob=0,f=.07}={}){const m=wrapMargin(W,it),a=-m,b=W.w+m,x0=it.x;
  it.amb=T=>({x:wrapPos(x0+it.dx+vx*T+ph,a,b)-x0-it.dx,y:bob?bob*Math.sin(2*Math.PI*f*T+x0*.01):0});return it;},

 bob(it,{amp=1.2,rot=1.4,f=.2,ph=0}={}){const w=2*Math.PI*f;it.amb=T=>({y:amp*Math.sin(w*T+ph),r:rot*Math.sin(w*.83*T+ph+1.1)});return it;},

 sail(W,it,{vx=3,ph=0,amp=1,rot=1.2,f=.22}={}){const m=wrapMargin(W,it),a=-m,b=W.w+m,x0=it.x,w=2*Math.PI*f;
  it.amb=T=>({x:wrapPos(x0+it.dx+vx*T+ph,a,b)-x0-it.dx,y:amp*Math.sin(w*T+ph*.05),r:rot*Math.sin(w*.83*T+ph*.05+1.1)});return it;},

 sway(it,{deg=.6,f=.18,ph=0,breathe=0,pv=1}={}){const w=2*Math.PI*f;if(it.pv==null)it.pv=pv;
  it.amb=T=>({r:deg*(.75*Math.sin(w*T+ph)+.25*Math.sin(w*2.3*T+ph*1.7)),sy:breathe?1+breathe*Math.sin(w*1.4*T+ph+.6):1});return it;},

 hover(it,{ax=3,ay=2,f=.12,ph=0,rot=0}={}){const w=2*Math.PI*f;it.amb=T=>({x:ax*Math.sin(w*T+ph),y:ay*Math.sin(w*1.37*T+ph+.9),r:rot*Math.sin(w*T+ph+.4)});return it;},
};

const birds=(W,o)=>fx(W,o.d??.3,(c,W,it,T)=>{const E=window.EFF;if(E&&E.L&&E.L.flock)E.L.flock(c,W,it,T);},
 Object.assign({p:0,s:1,list:[[0,0,1],[-26,-9,.85],[-22,11,.8],[-48,1,.7]],bb:null},o));

function water(W,name,o={}){
 const mk=maskOpt(o.mask),rect=o.rect?o.rect.slice():[0,0,1,1],amp=o.amp??2.2,glint=o.glint??1,speed=o.speed??1,hor=o.hor||null,d=o.d||0;
 let rip=null;

 const fix=()=>{if(fix.done)return;const m=maskImg(mk.src,mk.inv);if(!m.ok)return;fix.done=true;if(o.rect)return;const e=.004,b=m.bb;
  rect.splice(0,4,Math.max(0,b[0]-e),Math.max(0,b[1]-e),Math.min(1,b[2]+e),Math.min(1,b[3]+e));
  if(rip){const [x0,y0]=fr(rect[0],rect[1]),[x1,y1]=fr(rect[2],rect[3]);Object.assign(rip,{crop:rect.slice(),x:(x0+x1)/2,y:(y0+y1)/2,w:x1-x0});}};
 const ry=y=>(y-rect[1])/Math.max(1e-3,rect[3]-rect[1]);
 const gl=glPatch(W,name,rect,'water',(it,T)=>({uAmt:it.fa,uPh:T*speed,uAmp:amp,uGlint:glint,uHor:hor?[ry(hor[0]),ry(hor[1])]:[0,0],uTint:o.tint||[1,.98,.9],uScale:o.scale||1}),
  {fon:true,mask:mk,d,pre:fix});

 const off=()=>gl.on===FRAME||!(gl.fa>.003)||(!free.on&&W.sh>.9);
 rip=lay(W,name,{x:400,y:225,w:PL.w,crop:[0,0,1,1],d,mask:mk,z:-9,gate:off,
  wave:{axis:'h',amp:amp*.3,len:o.len||10,sp:1.6*speed,persp:hor?.35:0,step:3}});
 if(o.ripple===false)rip.o=0;
 const gli=fx(W,d,(c,W,it,T)=>{fix();if(off()||o.glints===false)return;
  const pts=maskPts(mk.src,o.n||32,o.seed||7,{min:.9,inv:mk.inv});
  if(pts.length)window.EFF?.glints?.(c,pts,T,glint*gl.fa,{hor:hor?[fr(0,hor[0])[1],fr(0,hor[1])[1]]:null,seed:o.seed||7});},{z:-9});
 return {gl,rip,gli};}

const dimBox=(W,[fx0,fy0,fx1,fy1],k=.62)=>fx(W,.05,(c,W,it)=>{if(it.a<=0)return;const [x0,y0]=fr(fx0,fy0),[x1,y1]=fr(fx1,fy1);
 const g=c.createLinearGradient(x0,0,x0+60,0);g.addColorStop(0,'rgba(12,8,5,0)');g.addColorStop(1,`rgba(12,8,5,${k*it.a})`);
 const F=y1<W.h-2?70:0;c.fillStyle=g;c.fillRect(x0,y0,x1-x0,y1-y0-F);
 if(F){const v=c.createLinearGradient(0,y1-F,0,y1);v.addColorStop(0,`rgba(12,8,5,${k*it.a})`);v.addColorStop(1,'rgba(12,8,5,0)');c.fillStyle=v;c.fillRect(x0,y1-F,x1-x0,F);}},{a:0});

// ── dust motes in the light
const MOTE={};
function moteSprite(rgb){if(MOTE[rgb])return MOTE[rgb];const m=document.createElement('canvas');m.width=m.height=32;const x=m.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);
 g.addColorStop(0,`rgba(${rgb},1)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,32,32);return MOTE[rgb]=m;}
function motes(c,W,T,seed,rgb,dir,mul=1){const r=rng(seed),sp=moteSprite(rgb);c.save();c.globalCompositeOperation='screen';
 for(let i=0,n=LIGHT?17:34;i<n;i++){const bx=r()*W.w,by=r()*W.h,vx=(r()-.5)*9,vy=(4+r()*8)*dir,ph=r()*6.28,s=.5+r()*1.7,big=r()<.18;
  const x=((bx+T*vx+Math.sin(T*.7+ph)*12)%W.w+W.w)%W.w,y=((by-T*vy)%W.h+W.h)%W.h,a=(.25+.35*Math.sin(T*1.3+ph)**2)*(big?.5:1);
  const R=big?s*4.5:s;c.globalAlpha=a*mul*Math.min(1,y/28,(W.h-y)/28);c.drawImage(sp,x-R,y-R,2*R,2*R);}
 c.restore();}

const motesLayer=(W,tint)=>fx(W,.75,(c,W,it,T)=>motes(c,W,T,W.num*13,tint,1));

// ── painters (pure functions of their arguments)
function glow(c,x,y,r,rgb,a){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(.45,`rgba(${rgb},${a*.35})`);g.addColorStop(1,`rgba(${rgb},0)`);
 c.save();c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
function rays(c,src,dst,spread,a,rgb){c.save();c.globalCompositeOperation='screen';for(const [x,y] of dst){const g=c.createLinearGradient(src[0],src[1],x,y);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(1,`rgba(${rgb},0)`);
 const dx=y-src[1],dy=-(x-src[0]),l=Math.hypot(dx,dy)||1;c.fillStyle=g;c.beginPath();c.moveTo(src[0],src[1]);c.lineTo(x+dx/l*spread,y+dy/l*spread);c.lineTo(x-dx/l*spread,y-dy/l*spread);c.closePath();c.fill();}c.restore();}
function dust(c,T,[[x0,y0],[x1,y1]],n,seed){const r=rng(seed);c.save();c.fillStyle='rgba(255,236,190,.55)';for(let i=0;i<n;i++){const bx=x0+r()*(x1-x0),by=y0+r()*(y1-y0),sp=4+r()*8,ph=r()*6.28,s=.6+r()*1.2;
 const x=bx+Math.sin(T*.3+ph)*14,y=y0+((by-y0+T*sp)%(y1-y0));c.globalAlpha=(.3+.4*Math.sin(T*.8+ph)**2)*Math.min(1,(y-y0)/20,(y1-y)/20);c.beginPath();c.arc(x,y,s,0,7);c.fill();}c.restore();}

function sparks(c,x0,y0,T,a){const r=rng(41);c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<22;i++){const life=1.2+r()*1.4,ph=r()*life,t=((T+ph)%life)/life,vx=(r()-.5)*40,h=30+r()*60;
  const x=x0+(r()-.5)*22+vx*t+Math.sin(T*3+i)*4,y=y0-h*t,s=.7+r()*1.2;c.globalAlpha=a*(1-t)*(.6+.4*Math.sin(T*20+i));
  c.fillStyle=t<.4?'#fff1b8':'#ff9a3c';c.beginPath();c.arc(x,y,s,0,7);c.fill();}c.restore();}

function flock(c,it,T){if(it.p<=0||it.p>=1)return;const x=lerp(it.from[0],it.to[0],it.p),y=lerp(it.from[1],it.to[1],it.p)+Math.sin(it.p*9)*6;
 for(const [ox,oy,s] of it.list){const k=s*it.s*5,f=Math.sin(T*9+ox);const bx=x+(it.flip?-ox:ox),by=y+oy;
  c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(bx-2*k,by+(.3-1.3*f)*k*.8);c.quadraticCurveTo(bx-k,by-(.6+f*.5)*k*.8,bx,by);c.quadraticCurveTo(bx+k,by-(.6+f*.5)*k*.8,bx+2*k,by+(.3-1.3*f)*k*.8);
  c.strokeStyle=TH.bird.color;c.lineWidth=TH.bird.w*k;c.stroke();c.restore();}}
function poly(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));}
function plen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return L;}

function ptAt(pts,s){for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],d=Math.hypot(bx-ax,by-ay);if(s<=d||i===pts.length-1){const t=d?Math.min(1,s/d):0;return [ax+(bx-ax)*t,ay+(by-ay)*t];}s-=d;}return pts[0];}

function glowLine(c,pts,L,p,w,rgb,core,head=true){c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([L*p,L+10]);
 c.strokeStyle='rgba(16,10,5,.26)';c.lineWidth=w*3.2;poly(c,pts);c.stroke();
 c.globalCompositeOperation='lighter';c.strokeStyle=`rgba(${rgb},.12)`;c.lineWidth=w*4.6;c.stroke();c.strokeStyle=`rgba(${rgb},.3)`;c.lineWidth=w*2.1;c.stroke();
 c.strokeStyle=`rgba(${core},.95)`;c.lineWidth=w*.75;c.stroke();c.setLineDash([]);
 if(head&&p<1){const [hx,hy]=ptAt(pts,L*p);glow(c,hx,hy,w*4.5,core,.45*Math.min(1,p*8));}
 c.restore();}

function pencil(c,it){if(it.p<=0)return;const pts=it.pts;const L=it.L||(it.L=plen(pts));
 if(TH.line.style==='glow')return glowLine(c,pts,L,it.p,it.w||2,TH.line.rgb,TH.line.core);
 c.save();c.strokeStyle=TH.line.color;c.globalAlpha=TH.line.alpha;c.lineWidth=it.w||2;c.lineCap='round';c.lineJoin='round';c.setLineDash([L*it.p,L+10]);poly(c,pts);c.stroke();c.restore();}

function river(c,it){if(it.p<=0)return;const pts=it.pts;const L=it.L||(it.L=plen(pts));
 if(TH.river.style==='glow')return glowLine(c,pts,L,it.p,1.9,TH.river.rgb,TH.river.core);
 c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([L*it.p,L+10]);
 c.strokeStyle=TH.river.edge;c.lineWidth=3.4;poly(c,pts);c.stroke();c.strokeStyle=TH.river.color;c.lineWidth=2;poly(c,pts);c.stroke();c.restore();}
function ellipsePts(cx,cy,rx,ry,seed){const r=rng(seed),pts=[];for(let i=0;i<=70;i++){const a=-1.3+i/70*Math.PI*2*1.12,k=1+(r()-.5)*.07;pts.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]);}return pts;}

function curvePts(a,m,b,n){const p=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;p.push([u*u*a[0]+2*u*t*m[0]+t*t*b[0],u*u*a[1]+2*u*t*m[1]+t*t*b[1]]);}return p;}
function arrowHead(c,pts,k){const [x1,y1]=pts[pts.length-1],[x0,y0]=pts[pts.length-3],a=Math.atan2(y1-y0,x1-x0),s=13*k;
 if(TH.line.style==='glow'){if(k<=0)return;const h=[[x1-Math.cos(a-.5)*s,y1-Math.sin(a-.5)*s],[x1,y1],[x1-Math.cos(a+.5)*s,y1-Math.sin(a+.5)*s]];return glowLine(c,h,plen(h),1,3/1.5,TH.line.rgb,TH.line.core,false);}
 c.save();c.strokeStyle=TH.line.color;c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(x1-Math.cos(a-.5)*s,y1-Math.sin(a-.5)*s);c.lineTo(x1,y1);c.lineTo(x1-Math.cos(a+.5)*s,y1-Math.sin(a+.5)*s);c.stroke();c.restore();}

function cityDot(c,x,y,it,T){if(it.p<=0)return;const k=Math.min(1,it.p*1.4),pop=1+.5*Math.max(0,1-Math.abs(it.p*2-1.2)*2.5);
 if(TH.dot.style==='glow'){const D=TH.dot;c.save();glow(c,x,y,30*k*(1+.08*Math.sin(T*2.4+x)),D.rgb,.5*k);
  const u=((T*.45+x*.013)%1+1)%1;c.globalCompositeOperation='lighter';c.lineWidth=1.2;
  c.strokeStyle=`rgba(${D.rgb},${(.4*(1-u)*k).toFixed(3)})`;c.beginPath();c.arc(x,y,8+u*16,0,7);c.stroke();
  c.globalCompositeOperation='source-over';c.fillStyle='rgba(12,8,5,.45)';c.beginPath();c.arc(x,y,7.8*pop,0,7);c.fill();
  c.globalCompositeOperation='lighter';c.globalAlpha=k;c.strokeStyle=`rgba(${D.core},.95)`;c.lineWidth=1.7;c.beginPath();c.arc(x,y,6.4*pop,0,7);c.stroke();
  c.fillStyle=`rgba(${D.core},1)`;c.beginPath();c.arc(x,y,2.6*pop,0,7);c.fill();c.restore();return;}
 c.save();glow(c,x,y,34*k*(1+.08*Math.sin(T*2.4+x)),'255,214,120',.55*k);
 c.globalAlpha=k;c.fillStyle='#fff4e0';c.strokeStyle='#17120e';c.lineWidth=2.4;c.beginPath();c.arc(x,y,7.5*pop,0,7);c.fill();c.stroke();
 c.fillStyle='#d0412c';c.beginPath();c.arc(x,y,3.6*pop,0,7);c.fill();c.restore();}

// ── shared sprites: window frame, board texture
const BB=TH.board.base;
const boardPat=ctx.createPattern(noiseCanvas(256,31,(d,i,r)=>{const v=r();const b=v<.5?-14*v:18*(v-.5);d[i]=BB[0]+b;d[i+1]=BB[1]+b*.9;d[i+2]=BB[2]+b*.8;d[i+3]=255;}),'repeat');
function frameSprite(w,h){const M=70,B=16,k=1.3,c=document.createElement('canvas');c.width=(w+2*M)*k;c.height=(h+2*M)*k;const x=c.getContext('2d');x.scale(k,k);x.translate(M,M);
 x.save();x.shadowColor='rgba(0,0,0,.62)';x.shadowBlur=38;x.shadowOffsetY=20;x.fillStyle='#e9dfc7';x.fillRect(-B,-B,w+2*B,h+2*B);x.restore();
 const g=x.createLinearGradient(0,-B,0,h+B);g.addColorStop(0,'#fbf6ea');g.addColorStop(1,'#efe6d2');x.fillStyle=g;x.fillRect(-B,-B,w+2*B,h+2*B);
 const r=rng(w+h);for(let i=0;i<900;i++){x.fillStyle=`rgba(${r()<.5?'120,95,60':'255,255,255'},${.05+r()*.08})`;const px=-B+r()*(w+2*B),py=-B+r()*(h+2*B);if(px>0&&px<w&&py>0&&py<h)continue;x.fillRect(px,py,1+r()*2,1);}
 const rim=(j,lw,a)=>{x.strokeStyle=`rgba(21,17,13,${a})`;x.lineWidth=lw;x.lineJoin='round';x.beginPath();
  const P=[[0,0],[w,0],[w,h],[0,h]];for(let s=0;s<4;s++){const [ax,ay]=P[s],[bx,by]=P[(s+1)%4];for(let i=0;i<=24;i++){const t=i/24,px=ax+(bx-ax)*t+(r()-.5)*j,py=ay+(by-ay)*t+(r()-.5)*j;s||i?x.lineTo(px,py):x.moveTo(px,py);}}x.closePath();x.stroke();};
 rim(1.2,5.2,1);rim(2.2,1.4,.55);
 for(let i=0;i<60;i++){const px=-B+r()*(w+2*B),py=-B+r()*(h+2*B);if(px>-3&&px<w+3&&py>-3&&py<h+3)continue;x.fillStyle=`rgba(21,17,13,${.25+r()*.5})`;x.beginPath();x.arc(px,py,.4+r()*1.6,0,7);x.fill();}
 return {c,M,k};}

function frameSpriteFilm(w,h){const M=70,B=16,k=1.3,c=document.createElement('canvas');c.width=(w+2*M)*k;c.height=(h+2*M)*k;const x=c.getContext('2d');x.scale(k,k);x.translate(M,M);
 x.save();x.shadowColor='rgba(0,0,0,.78)';x.shadowBlur=44;x.shadowOffsetY=22;x.fillStyle='#120f0c';x.fillRect(-B,-B,w+2*B,h+2*B);x.restore();
 const g=x.createLinearGradient(0,-B,0,h+B);g.addColorStop(0,'#231e19');g.addColorStop(.5,'#1a1612');g.addColorStop(1,'#15110e');x.fillStyle=g;x.fillRect(-B,-B,w+2*B,h+2*B);
 const hw=8.5,hh=5.6,st=21.5,n=Math.floor((w-8)/st),x0=(w-n*st)/2;x.fillStyle='#080605';
 for(let i=0;i<n;i++)for(const cy of [-B/2,h+B/2]){const px=x0+i*st+(st-hw)/2;x.beginPath();if(x.roundRect)x.roundRect(px,cy-hh/2,hw,hh,1.4);else x.rect(px,cy-hh/2,hw,hh);x.fill();}
 x.strokeStyle='rgba(255,236,205,.09)';x.lineWidth=1;x.strokeRect(-B+.5,-B+.5,w+2*B-1,h+2*B-1);
 x.strokeStyle='rgba(0,0,0,.7)';x.lineWidth=1.6;x.strokeRect(-.8,-.8,w+1.6,h+1.6);
 return {c,M,k};}
const FR={};for(const W of WINS){const key=W.w+'x'+W.h;W.fr=FR[key]||(FR[key]=TH.frame.style==='film'?frameSpriteFilm(W.w,W.h):frameSprite(W.w,W.h));}

// ── labels: DOM elements over the canvas (#ov), in board coordinates
const rotK=cls=>/\bhand\b/.test(cls)?TH.hand.rotK:/\b(tag|dymo)\b/.test(cls)?TH.motion.rotK:1;
function put(el,x,y,{f=null,rot=0,cls=''}={}){rot*=rotK(cls);el.className=(el.className?el.className+' ':'')+cls;if(f)el.style.fontSize=f+'px';el.style.left=x+'px';el.style.top=y+'px';gsap.set(el,{xPercent:-50,yPercent:-50,rotation:rot,opacity:0});el.dataset.rot=rot;OV.appendChild(el);return el;}

function chars(r){const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT),ns=[];while(w.nextNode())ns.push(w.currentNode);
 for(const n of ns){const f=document.createDocumentFragment();for(const ch of n.textContent){const s=document.createElement('span');s.className='ch';s.textContent=ch;f.appendChild(s);}n.replaceWith(f);}return r;}

function T(text,W,x,y,o={}){const e=document.createElement('div'),ls=text.split(/<br\s*\/?>/i);
 e.innerHTML=`<span class="tx">${ls.length>1?ls.map(l=>`<span class="ln">${l}</span>`).join('<br>'):text}</span>`;chars(e);
 put(e,W.x+x,W.y+y,Object.assign({cls:'tag inwin'},o));if(ls.length>1)e.classList.add('multi');return e;}
function D(text,W,x,y,o={}){const e=document.createElement('div');e.innerHTML=`<span class="tx">${text}</span>`;chars(e);return put(e,W.x+x,W.y+y,Object.assign({cls:'dymo inwin'},o));}
function H(html,W,x,y,o={}){const e=document.createElement('div');e.innerHTML=html;return put(e,W.x+x,W.y+y,Object.assign({},o,{cls:'hand inwin '+(o.cls||'')}));}

// ── canvas labels (k.ctag, k.chand, k.cword): drawn into the window's canvas so they move with the picture pixel
//    for pixel. DOM letters snap to whole pixels on slow camera drifts and visibly jitter; canvas labels do not.
const CTK={tag:{w:500,ls:.05,px:.7,py:.66,bg:'#fff1c2',ink:'#15110d',bd:.12,bdc:'#15110d',sh:[.18,.2],shc:'#15110d'},
 maptag:{w:500,ls:.05,px:.5,py:.5,bg:'#fff1c2',ink:'#15110d',bd:.12,bdc:'#15110d',sh:[.12,.14],shc:'#15110d'},
 dymo:{w:600,ls:.1,px:.7,py:.8,bg:'#15110d',ink:'#fff4d6',bd:0,bdc:'#15110d',sh:[.16,.18],shc:'rgba(0,0,0,.35)'}};
for(const q in TH.ctk)CTK[q]=Object.assign({},CTK[q]||CTK.tag,TH.ctk[q]);
function ctagDraw(c,W,it,T,px2){if(!(it.p>.003)||!(it.u>0))return;if(it.kind==='hand')return chandDraw(c,W,it,T,px2);const S=Object.assign({},CTK[it.kind]||CTK.tag,it.st||{}),f=it.f;
 c.save();c.globalAlpha*=Math.min(1,it.p);c.translate(it.x,it.y);if(it.rot)c.rotate(it.rot*Math.PI/180);if(it.s!==1)c.scale(it.s,it.s);
 c.font=`${S.w} ${f}px ${S.font||'Oswald, sans-serif'}`;if('letterSpacing' in c)c.letterSpacing=(f*S.ls).toFixed(2)+'px';c.textBaseline='middle';

 const shown=Math.round(Math.min(1,it.c)*(it.text.length+(it.n?1:0))),vis=it.text.slice(0,Math.max(0,shown-(it.n?1:0)));
 const twF=c.measureText(it.text).width,tw=it.c>=1?twF:(vis?c.measureText(vis).width:0),cw=it.n?1.5*f:0,gap=it.n?.45*f:0,px=S.px*f,b=S.bd*f,h=(it.n?1.3:1.02)*f+S.py*f,
  wF=px*2+cw+gap+twF,w=it.c>=1?wF:Math.max(px*2+(it.n?cw:.4*f),px*2+cw+gap+tw),x0=-wF/2,y0=-h/2;
 if(it.u<1){c.beginPath();c.rect(x0-b-1,y0-b-1,(w+2*b+S.sh[0]*f+2)*it.u,h+2*b+S.sh[1]*f+2+(S.blur?S.blur*f:0));c.clip();}
 if(S.r!=null){
  const R=S.r*f,q=px2||2,rr=()=>{c.beginPath();if(c.roundRect)c.roundRect(x0,y0,w,h,R);else c.rect(x0,y0,w,h);};
  c.save();if(S.blur){c.shadowColor=S.shc;c.shadowBlur=S.blur*f*q;c.shadowOffsetX=S.sh[0]*f*q;c.shadowOffsetY=S.sh[1]*f*q;}
  rr();c.fillStyle=S.bg;c.fill();c.restore();
  if(S.bar){c.save();rr();c.clip();c.fillStyle=S.bar;c.fillRect(x0,y0,(S.barW||.16)*f,h);c.restore();}
  if(b){rr();c.strokeStyle=S.bdc;c.lineWidth=b;c.stroke();}}
 else{
 c.fillStyle=S.shc;c.fillRect(x0-b+S.sh[0]*f,y0-b+S.sh[1]*f,w+2*b,h+2*b);
 if(b){c.fillStyle=S.bdc;c.fillRect(x0-b,y0-b,w+2*b,h+2*b);}
 c.fillStyle=S.bg;c.fillRect(x0,y0,w,h);}
 if(it.n){c.fillStyle=S.nbg||'#15110d';c.beginPath();c.ellipse(x0+px+cw/2,0,cw/2,.62*f,0,0,7);c.fill();if(S.nring){c.strokeStyle=S.nring;c.lineWidth=.07*f;c.stroke();}
  if(shown>0){c.fillStyle=S.nink||'#fff4d6';c.textAlign='center';c.fillText(String(it.n),x0+px+cw/2,.07*f);}}
 if(vis){c.fillStyle=S.ink;c.textAlign='left';c.fillText(vis,x0+px+cw+gap,.07*f);}
 c.restore();}

function chandDraw(c,W,it,T,px){const f=it.f,ls=String(it.text).split('\n'),lh=f*1.08,Hd=TH.hand;
 c.save();c.globalAlpha*=Math.min(1,it.p);c.translate(it.x,it.y);if(it.rot)c.rotate(it.rot*Math.PI/180);if(it.s!==1)c.scale(it.s,it.s);
 c.font=`${Hd.style?Hd.style+' ':''}${Hd.w} ${f}px ${Hd.font}`;c.textBaseline='middle';c.textAlign='center';c.lineJoin='round';
 const tw=Math.max(...ls.map(l=>c.measureText(l).width)),hh=lh*ls.length;
 if(it.u<1){c.beginPath();c.rect(-tw/2-f*.3,-hh/2-f*.4,(tw+f*.6)*it.u,hh+f*.8);c.clip();}
 if(it.plate){c.fillStyle=Hd.plate;const r=f*.35,x=-tw/2-f*.35,y=-hh/2-f*.12,w=tw+f*.7,h=hh+f*.2;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill();}

 if(Hd.scrim&&!it.plate){const rx=tw*.62+f*.6,ry=hh*.5+f*.75;c.save();c.scale(1,ry/rx);const g=c.createRadialGradient(0,0,0,0,0,rx);
  g.addColorStop(0,`rgba(${Hd.scrim},.5)`);g.addColorStop(.62,`rgba(${Hd.scrim},.3)`);g.addColorStop(1,`rgba(${Hd.scrim},0)`);c.fillStyle=g;c.fillRect(-rx,-rx,2*rx,2*rx);c.restore();}

 if(Hd.shadow){c.shadowColor=Hd.shadow;c.shadowBlur=Hd.sb*f*(px||2);c.shadowOffsetY=.04*f*(px||2);}
 ls.forEach((l,i)=>{const y=-hh/2+lh*(i+.5);
  if(it.light){if(Hd.lstroke){c.strokeStyle=Hd.lstroke;c.lineWidth=f*Hd.lW;c.strokeText(l,0,y);}c.fillStyle=Hd.lfill;c.fillText(l,0,y);}
  else{if(Hd.halo){c.strokeStyle=Hd.halo;c.lineWidth=f*Hd.haloW;c.strokeText(l,0,y);}c.fillStyle=Hd.fill;c.fillText(l,0,y);}

  if(Hd.shadow&&!it.plate){c.save();c.shadowBlur=.07*f*(px||2);c.shadowOffsetY=0;c.fillText(l,0,y);c.restore();}});
 c.restore();}

const chand=(W,text,x,y,o={})=>{const L=fx(W,0,ctagDraw,Object.assign({x,y,f:15,rot:0,s:1,o:1,p:0,u:0,c:1,text,n:0,kind:'hand'},o));L.rot*=TH.hand.rotK;return L;};

const ctag=(W,text,x,y,o={})=>{const L=fx(W,0,ctagDraw,Object.assign({x,y,f:12,rot:0,s:1,o:1,p:0,u:1,c:1,text,n:0,kind:'tag'},o));L.rot*=L.kind==='hand'?TH.hand.rotK:TH.motion.rotK;return L;};

function cwordDraw(c,W,it,T,px){if(!(it.p>.003)||!(it.lt>0))return;const Wd=TH.word,fs=it.f*Wd.k,ch=[...it.word];
 c.save();c.globalAlpha*=Math.min(1,it.p);c.font=`${Wd.w} ${fs}px ${Wd.font}`;c.textBaseline='middle';c.textAlign='left';c.lineJoin='round';
 const adv=ch.map(q=>c.measureText(q).width+Wd.ls*fs),tot=adv.reduce((a,v)=>a+v,0);let x=it.x-tot/2;const q2=px||2;

 if(Wd.scrim){const s=Math.min(1,it.lt/(Wd.dur+(ch.length-1)*it.step*.5)),rx=tot*.64,ry=fs*.95;c.save();c.translate(it.x,it.y);c.scale(1,ry/rx);
  const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,`rgba(${Wd.scrim},${(.6*s).toFixed(3)})`);g.addColorStop(.6,`rgba(${Wd.scrim},${(.32*s).toFixed(3)})`);g.addColorStop(1,`rgba(${Wd.scrim},0)`);
  c.fillStyle=g;c.fillRect(-rx,-rx,2*rx,2*rx);c.restore();}
 ch.forEach((q,i)=>{const u=Math.max(0,Math.min(1,(it.lt-i*it.step)/Wd.dur)),e=1-(1-u)*(1-u);if(u>0){c.save();
   const cx=x+adv[i]/2,cy=it.y-Wd.drop*(1-e),k=Wd.sc-(Wd.sc-1)*e;c.globalAlpha*=e;c.translate(cx,cy);c.scale(k,k);
   const tx=-adv[i]/2+.03*fs;
   if(Wd.shadow){c.fillStyle=Wd.shadow;c.fillText(q,tx+.07*fs,.08*fs);}
   if(Wd.stroke){c.strokeStyle=Wd.stroke;c.lineWidth=Wd.sw*fs;c.strokeText(q,tx,0);}
   c.fillStyle=Wd.fill;

   if(Wd.dark){c.save();c.shadowColor=Wd.dark;c.shadowBlur=Wd.db*fs*q2;c.shadowOffsetY=.03*fs*q2;c.fillText(q,tx,0);c.restore();}
   if(Wd.glow){c.shadowColor=Wd.glow;c.shadowBlur=Wd.gb*fs*q2*(.6+.4*e);}
   c.fillText(q,tx,0);c.restore();}
  x+=adv[i];});
 c.restore();}
const cword=(W,word,x,y,o={})=>fx(W,0,cwordDraw,Object.assign({x,y,f:20,o:1,p:0,lt:0,step:.08,word},o));
function cutWord(word,W,x,y,{f=20}={}){const e=document.createElement('div');[...word].forEach(ch=>{const b=document.createElement('b');b.textContent=ch===' '?' ':ch;e.appendChild(b);});return put(e,W.x+x,W.y+y,{f,cls:'cut inwin'});}

// ── camera. z=1 means the window exactly covers the screen ("cover" scale, see COV). pin() keeps the camera
//    inside the window so its edge never enters the frame.
const cam={x:W1.cx,y:W1.cy,z:1.25,r:0,f:0,g:0,fl:0,sh:0,shA:2,gk:0,gy:.5};
let dpr=1,VW=0,VH=0;
function resize(){dpr=LIGHT?1:Math.min(devicePixelRatio||1,1.6);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*dpr);cv.height=Math.round(VH*dpr);}
resize();addEventListener('resize',resize);
const ss01=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};

const MINW=563,MINH=450;
const COV=()=>Math.min(Math.max(VW/800,VH/450),VW/MINW,VH/MINH);

const KN=36;
function soft(v,a,b){if(a>=b)return (a+b)/2;const m=(a+b)/2,r=(b-a)/2,k=Math.min(KN,r),u=v-m,t=Math.abs(u);
 if(t<=r-k)return v;return m+Math.sign(u)*((r-k)+k*(1-Math.exp(-(t-(r-k))/k)));}
function pin(x,y,Z,s=1){
 const W=WINS.find(W=>x>W.x&&x<W.x+W.w&&y>W.y&&y<W.y+W.h);if(!W||s<=0)return [x,y];
 const hw=VW/2/Z,hh=VH/2/Z,k=ss01((Z/COV()-.85)/.15)*s;if(k<=0)return [x,y];
 return [lerp(x,hw<W.w/2?soft(x,W.x+hw,W.x+W.w-hw):W.cx,k),lerp(y,hh<W.h/2?soft(y,W.y+hh,W.y+W.h-hh):W.cy,k)];
}
const pinned=(x,y,z)=>pin(x,y,z*COV());
function view(){
 const capH=Math.min(170,VH*.22),cover=COV();

 const zOv=Math.min(VW/BOARD.w,(VH-capH)/BOARD.h),zLi0=Math.min(VW/(LIST.w+560),(VH-capH)/(LIST.h+90)),zLi=zLi0*lerp(1,Math.max(1,16/36/zLi0),clamp(cam.gk,0,1));

 const visH=(VH-capH)/zLi,ly0=LIST.y-45+visH/2,ly1=LIST.y+LIST.h+45-visH/2,ly=ly1>ly0?lerp(ly0,ly1,cam.gy):LIST.y+LIST.h/2+10;
 const wW=Math.max(0,1-cam.f-cam.g);
 let Z=Math.exp(Math.log(cam.z*cover)*wW+Math.log(zOv)*cam.f+Math.log(zLi)*cam.g);
 let x=cam.x*wW+BOARD.cx*cam.f+(LIST.x+LIST.w/2)*cam.g,y=cam.y*wW+BOARD.cy*cam.f+ly*cam.g;
 if(wW>.5)[x,y]=pin(x,y,Z,(1-cam.fl)*ss01((wW-.6)/.4));
 let sx=VW/2,sy=VH/2-(cam.f+cam.g)*capH/2;
 if(cam.sh>0&&!reduce){const tt=K.tl?K.tl.time():0;sx+=cam.sh*cam.shA*Math.sin(tt*81.7);sy+=cam.sh*cam.shA*Math.sin(tt*69.1+1.3);}
 return {Z,x,y,sx,sy,r:cam.r*Math.PI/180};
}

function viewAt(p){const s={x:cam.x,y:cam.y,z:cam.z,f:cam.f,g:cam.g,fl:cam.fl,sh:cam.sh,r:cam.r};
 Object.assign(cam,{x:p.x,y:p.y,z:p.z??cam.z,f:0,g:0,fl:0,sh:0,r:0});const V=view();Object.assign(cam,s);return V;}

const SCRPOS=[];
function scrPlace(el,pose,bx,by){const f=()=>{const V=viewAt(pose);el.style.transform=`translate(${V.sx+(bx-V.x)*V.Z}px,${V.sy+(by-V.y)*V.Z}px) scale(${V.Z})`;};f();SCRPOS.push(f);}
addEventListener('resize',()=>{for(const f of SCRPOS)f();});

// ── API for the window files: everything a window needs, in one object k (setup(k) and build(tl,k)).
//    Shade: everything outside the open windows is darkened by 88 %. W.sh is a window's "closedness" driven by the
//    timeline (fly opens the target at the start and closes the source at the end; cut switches at once).
const SHADE={k:1};for(const W of WINS)W.sh=W===W1?0:1;

const FL={a:0,rgb:'255,240,205'};if(TH.flash.leak)Object.assign(FL,{p:0,n:1});
const K={KINO,reduce,still:STILL,rng,clamp,lerp,ss01,OV,IMG,img,BOARD,LIST,WINS,W1,W2,W3,W4,W5,W6,W7,W8,PL,fr,cam,view,viewAt,scrPlace,cover:COV,SHADE,FL,
 lay,bg,fx,glPatch,sortLayers,walker,dimBox,motes,motesLayer,moteSprite,glow,rays,dust,sparks,flock,poly,plen,pencil,river,ellipsePts,curvePts,arrowHead,cityDot,
 part,A,birds,water,mask:maskImg,maskPts,MSTAT,
 put,chars,T,D,H,cutWord,ctag,ctagDraw,cword,chand,
 M:{},
 ONBOARD:[],onboard:(...els)=>{K.ONBOARD.push(...els.flat());},
 under:[],over:[],
 FACTS:[],items:[],ITEM_Y:()=>0,threads:[],hiFact:[]};
Object.defineProperty(K,'EFF',{get:()=>window.EFF||{}});
Object.defineProperty(K,'light',{get:()=>LIGHT});

WINS.forEach((W,i)=>{W.where=WDEF[i].where||'';});
const GL=document.createElement('div');GL.id='gl';document.body.appendChild(GL);

const SCR=document.createElement('div');SCR.id='scr';document.body.insertBefore(SCR,document.getElementById('fx'));
K.SCR=SCR;
const OKNA=(window.KINO_OKNA||[]).slice().sort((a,b)=>a.n-b.n);
for(const o of OKNA)if(o.setup)o.setup(K);
if(typeof window.EFF?.setup==='function')window.EFF.setup(K);
sortLayers();

const BOARDTAGS='.onboard,.wtag,.badge';
for(const c of OV.querySelectorAll(BOARDTAGS)){const x=parseFloat(c.style.left),y=parseFloat(c.style.top),W=WINS.find(W=>x>=W.x-24&&x<=W.x+W.w+24&&y>=W.y-24&&y<=W.y+W.h+60);if(W)c.dataset.w=W.num;}

// ── frame loop
const t0=performance.now();
let fPrev=0;const fInt=[];
function setLight(){if(LIGHT)return;LIGHT=true;if(window.FXGL)window.FXGL.ok=false;resize();document.documentElement.classList.add('kino-light');}
if(LIGHT){LIGHT=false;setLight();}

let LIGHT_PEND=false;
function frame(){const pf0=performance.now();

 if(LIGHT_AUTO&&!LIGHT&&!LIGHT_PEND&&fInt.length<90&&document.body.classList.contains('mk-playing')&&!document.hidden){if(fPrev)fInt.push(pf0-fPrev);fPrev=pf0;

  if(fInt.length===30){const s=[...fInt].sort((a,b)=>a-b);if(s[15]>45)LIGHT_PEND=true;}
  if(fInt.length===90){const s=[...fInt].sort((a,b)=>a-b);if(s[45]>22)LIGHT_PEND=true;}}else fPrev=0;
 try{draw();}finally{if(window.__perf)window.__perf.push([performance.now()-pf0,window.multik?.audio?.currentTime||0]);}

 if(LIGHT_PEND&&(GLN-GLF===0||!document.body.classList.contains('mk-playing'))){LIGHT_PEND=false;setLight();}}

function leakScreen(c,w,h,a,p,n){const r=rng(97+n*13),dir=r()<.5?1:-1,R=Math.max(w,h),A=Math.pow(a,.6)*(1-.5*a);
 c.save();

 for(const [rgb,k,sz,op] of [['226,74,28',.55,.72,'source-over'],['255,160,60',.75,.6,'screen'],['255,236,190',.6,.42,'screen']]){const ph=r()*.35,sp=.9+r()*.6;c.globalCompositeOperation=op;
  const u=-.25+(p*sp+ph)*1.3,x=(dir>0?u:1-u)*w,y=(.15+r()*.7)*h,rr=R*sz*(.85+.3*r());
  const g=c.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,`rgba(${rgb},${(k*A).toFixed(3)})`);g.addColorStop(.45,`rgba(${rgb},${(k*A*.45).toFixed(3)})`);g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g;c.fillRect(0,0,w,h);}
 c.restore();}

function drawShade(c,x,y,hw,hh){
 const board=free.on,A=board?.62*free.fk:.88*SHADE.k*clamp(1-cam.f-cam.g,0,1);if(A<=.003)return;
 const m=16;c.save();c.fillStyle=`rgba(14,10,7,${A})`;c.beginPath();c.rect(x-hw,y-hh,hw*2,hh*2);
 for(const W of WINS)c.rect(W.x-m,W.y-m,W.w+2*m,W.h+2*m);
 c.fill('evenodd');
 for(const W of WINS){const k=board?(W===free.fw?0:1):Math.min(1,W.sh);if(k>.003){c.fillStyle=`rgba(14,10,7,${A*k})`;c.fillRect(W.x-m,W.y-m,W.w+2*m,W.h+2*m);}}
 c.restore();}

const capT=(v,m)=>m>0?m*Math.tanh(v/m):v;
function depthXf(c,W,d,q,par,pm){let px=-q.x*d*46*par,py=-q.y*d*26*par;const k=1+q.z*(.02+.14*d*par);
 if(pm){const [mx,my]=typeof pm==='number'?[pm,pm]:pm;px=capT(px,mx);py=capT(py,my);}
 c.translate(W.w/2+px,W.h/2+py);c.scale(k,k);c.translate(-W.w/2,-W.h/2);return k;}

function itemXf(c,W,it,T){const o=it.img;if(!o.lv.length)return null;
 const am=it.amb?it.amb(T):null,cr=it.crop,cw=cr?cr[2]-cr[0]:1,ch=cr?cr[3]-cr[1]:1;
 const w=it.w*it.s*(am&&am.s!=null?am.s:1),h=w*o.ar*ch/cw,pv=(it.pv||0)*h/2;
 c.translate(it.x+it.dx+(am?.x||0),(it.foot?it.y-h/2:it.y)+it.dy+(am?.y||0));
 const rot=(it.r||0)+(am?.r||0);
 if(rot){if(pv)c.translate(0,pv);c.rotate(rot*Math.PI/180);if(pv)c.translate(0,-pv);}
 if(it.fx!==1)c.scale(it.fx,1);
 if(am&&am.sy!=null&&am.sy!==1){c.translate(0,pv);c.scale(1,am.sy);c.translate(0,-pv);}
 return {w,h,cw,ch,cr,am};}

function drawItem(c,W,it,T,q,par,Zd,res=1){
 c.save();const k=depthXf(c,W,it.d||0,q,par,it.pmax);
 if(it.draw){c.globalAlpha=it.o;it.draw(c,W,it,T,Zd*k*res);c.restore();return;}
 if(it.clipY!=null&&it.img.lv.length){c.beginPath();c.rect(-400,-400,W.w+800,it.clipY+400);c.clip();}
 const L=itemXf(c,W,it,T);if(!L){c.restore();return;}
 const {w,h,cw,ch,cr,am}=L;
 c.globalAlpha=it.o*(am&&am.o!=null?am.o:1);
 const src=pick(it.img,w/cw*Zd*k*res*Math.abs(it.fx||1));
 if(cr||it.wave){const sx=cr?cr[0]*src.width:0,sy=cr?cr[1]*src.height:0,sw=cw*src.width,sh=ch*src.height;
  if(it.wave&&window.EFF?.strips)window.EFF.strips(c,src,sx,sy,sw,sh,-w/2,-h/2,w,h,T,it.wave,Zd*k*res);
  else c.drawImage(src,sx,sy,sw,sh,-w/2,-h/2,w,h);}
 else c.drawImage(src,-w/2,-h/2,w,h);
 if(it.mask&&it.mask.own){const mo=maskImg(it.mask.src,it.mask.inv);
  if(mo.ok){c.globalCompositeOperation='destination-in';c.globalAlpha=1;const [a,b,e,f]=cr||[0,0,1,1];c.drawImage(mo.c,a*mo.w,b*mo.h,(e-a)*mo.w,(f-b)*mo.h,-w/2,-h/2,w,h);}}
 c.restore();}

const MC=document.createElement('canvas'),MX=MC.getContext('2d');
function devBox(m,x0,y0,x1,y1){let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const [x,y] of [[x0,y0],[x1,y0],[x0,y1],[x1,y1]]){const X=m.a*x+m.c*y+m.e,Y=m.b*x+m.d*y+m.f;
 if(X<a)a=X;if(X>c)c=X;if(Y<b)b=Y;if(Y>d)d=Y;}return [a,b,c,d];}
const bbAnd=(p,q)=>{if(!p||!q)return null;const r=[Math.max(p[0],q[0]),Math.max(p[1],q[1]),Math.min(p[2],q[2]),Math.min(p[3],q[3])];return r[2]>r[0]&&r[3]>r[1]?r:null;};
const bbOr=(p,q)=>!p?q:!q?p:[Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[2],q[2]),Math.max(p[3],q[3])];

function itemBox(W,it,T,q,par,m0){MX.save();MX.setTransform(m0);depthXf(MX,W,it.d||0,q,par,it.pmax);let r;
 if(it.draw){const b=it.bb||[0,0,W.w,W.h];r=devBox(MX.getTransform(),b[0],b[1],b[2],b[3]);}
 else{const L=itemXf(MX,W,it,T);if(L){const e=it.wave?Math.abs(it.wave.amp||2)+Math.abs(it.wave.amp2||0)+1:1;r=devBox(MX.getTransform(),-L.w/2-e,-L.h/2-e,L.w/2+e,L.h/2+e);}}
 MX.restore();return r||null;}
function drawMaskRun(W,run,T,q,par,Zd){
 const M=run[0].mask,mo=maskImg(M.src,M.inv);if(!mo.ok)return;
 const m0=ctx.getTransform();
 let bb=bbAnd(devBox(m0,0,0,W.w,W.h),[0,0,cv.width,cv.height]);
 if(!M.own&&bb){MX.save();MX.setTransform(m0);depthXf(MX,W,M.d,q,par,M.pmax);const B=mo.bb;bb=bbAnd(bb,devBox(MX.getTransform(),PL.x+B[0]*PL.w,PL.y+B[1]*PL.h,PL.x+B[2]*PL.w,PL.y+B[3]*PL.h));MX.restore();}
 const live=run.filter(it=>it.o>.003&&!(it.gate&&it.gate()));if(!live.length)return;
 let ub=null;for(const it of live)ub=bbOr(ub,itemBox(W,it,T,q,par,m0));
 bb=bbAnd(bb,ub);if(!bb)return;

 const res=LIGHT||window.FXGL?.soft?.5:1,bx=Math.floor(bb[0]),by=Math.floor(bb[1]),bw=Math.ceil(bb[2])-bx,bh=Math.ceil(bb[3])-by,ow=Math.ceil(bw*res),oh=Math.ceil(bh*res);
 if(ow<1||oh<1)return;
 if(MC.width<ow||MC.height<oh){MC.width=Math.max(MC.width,ow);MC.height=Math.max(MC.height,oh);}
 MX.setTransform(1,0,0,1,0,0);MX.globalCompositeOperation='source-over';MX.globalAlpha=1;MX.clearRect(0,0,ow,oh);
 MX.setTransform(m0.a*res,m0.b*res,m0.c*res,m0.d*res,(m0.e-bx)*res,(m0.f-by)*res);MX.imageSmoothingQuality=res<1?'low':'medium';
 for(const it of live)drawItem(MX,W,it,T,q,par,Zd,res);
 if(!M.own){MX.save();MX.globalCompositeOperation='destination-in';MX.globalAlpha=1;depthXf(MX,W,M.d,q,par,M.pmax);MX.drawImage(mo.c,PL.x,PL.y,PL.w,PL.h);MX.restore();}
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;if(res<1)ctx.imageSmoothingQuality='low';ctx.drawImage(MC,0,0,ow,oh,bx,by,bw,bh);ctx.restore();
 MSTAT.n++;MSTAT.px+=ow*oh;}

function breathOf(b,T){if(!b||!T)return null;const a=2*Math.PI*(b.f||.06)*T;
 return {x:(b.x||0)*(.72*Math.sin(a)+.28*Math.sin(a*1.73)),y:(b.y||0)*(.7*Math.sin(a*.81)+.3*Math.sin(a*2.07)),z:(b.z||0)*Math.sin(a*.57)};}
// ── draw one frame: board, windows (layers sorted by z, parallax by depth d), shade, flash, film effects
function draw(){
 const T=(reduce||STILL)?0:(performance.now()-t0)/1000;GLN=0;GLF=0;FRAME++;MSTAT.n=0;MSTAT.px=0;
 boardStep();
 const V=free.on?freeView():view(),{Z,x,y,sx,sy,r}=V,co=Math.cos(r),si=Math.sin(r);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=TH.board.bg;ctx.fillRect(0,0,cv.width,cv.height);
 const a=Z*co,b=Z*si,e=sx-(a*x-b*y),f=sy-(b*x+a*y);
 ctx.setTransform(dpr*a,dpr*b,-dpr*b,dpr*a,dpr*e,dpr*f);
 ctx.imageSmoothingQuality='high';
 const hw=VW/2/Z*1.2+60,hh=VH/2/Z*1.2+60;
 ctx.fillStyle=boardPat;ctx.fillRect(x-hw,y-hh,hw*2,hh*2);
 const lamp=ctx.createRadialGradient(LIST.x+LIST.w/2,LIST.y+500,100,LIST.x+LIST.w/2,LIST.y+500,1900);lamp.addColorStop(0,`rgba(${TH.board.lamp},${TH.board.lampA})`);lamp.addColorStop(1,`rgba(0,0,0,${TH.board.edgeA})`);ctx.fillStyle=lamp;ctx.fillRect(x-hw,y-hh,hw*2,hh*2);
 const vis=(bx,by,bw,bh)=>bx<x+hw&&bx+bw>x-hw&&by<y+hh&&by+bh>y-hh;
 GLEV=glCount(vis,T);
 for(const u of K.under)u(ctx,vis,V,T);
 for(const W of WINS){if(!vis(W.x-90,W.y-90,W.w+180,W.h+180))continue;
  ctx.save();
  const F=W.fr;ctx.drawImage(F.c,W.x-F.M,W.y-F.M,F.c.width/F.k,F.c.height/F.k);
  ctx.save();ctx.beginPath();ctx.rect(W.x,W.y,W.w,W.h);ctx.clip();ctx.translate(W.x,W.y);
  const relx=clamp((x-W.cx)/W.w,-1.4,1.4),rely=clamp((y-W.cy)/W.h,-1.4,1.4),br=breathOf(W.breath,T),par=W.par??1;
  const q={x:W.p.x+relx+(br?br.x:0),y:W.p.y+rely+(br?br.y:0),z:W.p.z+(br?br.z:0)};
  const its=W.items;
  for(let i=0;i<its.length;i++){const it=its[i];if((it.o<=.003||(it.gate&&it.gate()))&&!(it.mask&&!it.mask.own))continue;
   if(it.mask){let j=i+1;if(!it.mask.own)while(j<its.length&&its[j].mask&&its[j].mask.key===it.mask.key)j++;
    drawMaskRun(W,its.slice(i,j),T,q,par,Z*dpr);i=j-1;continue;}
   drawItem(ctx,W,it,T,q,par,Z*dpr);}
  ctx.restore();
  const hl=free.on?(free.hover===W?1:0):Math.min(1,W.hl||0);
  if(hl>0){ctx.save();ctx.strokeStyle=`rgba(255,214,150,${.95*hl})`;ctx.lineWidth=7;ctx.shadowColor='rgba(255,190,110,.9)';ctx.shadowBlur=26*hl;ctx.strokeRect(W.x-22,W.y-22,W.w+44,W.h+44);ctx.restore();}
  ctx.restore();}
 drawShade(ctx,x,y,hw,hh);MSTAT.ev=GLEV;MSTAT.fon=GLF;
 for(const o of K.over)o(ctx,vis,V,T);
 const fa=free.on?0:FL.a;
 if(fa>.003){ctx.setTransform(1,0,0,1,0,0);const cx=cv.width/2,cy=cv.height*.42,g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(cv.width,cv.height)*.8);
  g.addColorStop(0,`rgba(${FL.rgb},${fa})`);g.addColorStop(1,`rgba(${FL.rgb},${fa*.8})`);ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);
  if(TH.flash.leak&&!reduce)leakScreen(ctx,cv.width,cv.height,fa,FL.p||0,FL.n||1);}
 OV.style.opacity=SCR.style.opacity=fa>.003?(1-fa).toFixed(3):'';
 OV.style.transform=`translate(${sx}px,${sy}px) rotate(${r*180/Math.PI}deg) scale(${Z}) translate(${-x}px,${-y}px)`;
}
gsap.ticker.add(frame);
gsap.ticker.add(()=>{if(!WARM.length)return;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.004;
 for(let i=0;i<2&&WARM.length;i++)ctx.drawImage(WARM.shift(),0,0,2,2);ctx.restore();});

// ── the board after the cartoon: the child drives the camera (drag, wheel or pinch, tap a picture to fly into
//    it, tap a list item to go to its window). While a quiz task runs (PROVERKA.lock) the board stands still.
const free={on:false,x:0,y:0,Z:1,sy:0,tx:0,ty:0,tZ:1,tsy:0,focus:null,hover:null,back:null,mx:0,my:0,greeted:false,fk:0,fw:null};
let lastStep=performance.now();
const bd=document.createElement('div');bd.id='bd';
bd.innerHTML=`<div class="bd-bar"><button class="bd-btn bd-quizbtn" type="button">Проверь себя</button><button class="bd-btn light bd-say" type="button" aria-label="Послушать вопрос ещё раз">🔊 Вопрос ещё раз</button><div class="bd-hint">Доска твоя: <b>тяни</b>: двигать, <b>колёсико</b> или два пальца: ближе, <b>нажми</b> на картинку или пункт списка.</div></div>
<button class="bd-btn light bd-back" type="button">← Ко всей доске</button>
<div class="bd-fact" aria-live="polite"></div>
<div class="bd-sub" aria-live="polite"></div>`;
document.body.appendChild(bd);
const $=s=>bd.querySelector(s);
const LOCK=()=>!!window.PROVERKA?.lock;
const syncQuiz=()=>{const q=bd.querySelector('.bd-quizbtn');if(q)q.hidden=!window.PROVERKA;};
function zLimits(){return [Math.min(VW/BOARD.w,(VH-60)/BOARD.h)*.9,Math.max(VW/800,VH/450)*2.6];}
function freeView(){return {Z:free.Z,x:free.x,y:free.y,sx:VW/2,sy:free.sy,r:0};}
function boardStep(){
 const now=performance.now(),dt=Math.min(.05,(now-lastStep)/1000);lastStep=now;
 const ended=document.body.classList.contains('mk-ended');
 if(ended&&!free.on)enterBoard();else if(!ended&&free.on)exitBoard();
 if(!free.on)return;
 const k=1-Math.exp(-dt*6);
 const dX=(free.tx-free.x)*free.Z,dY=(free.ty-free.y)*free.Z+(free.sy-free.tsy);
 free.Z=Math.exp(lerp(Math.log(free.Z),Math.log(free.tZ),k));free.sy+=(free.tsy-free.sy)*k;
 free.x=free.tx-dX*(1-k)/free.Z;free.y=free.ty-(dY*(1-k)-(free.sy-free.tsy))/free.Z;
 if(free.focus)free.fw=free.focus;free.fk+=((free.focus?1:0)-free.fk)*k;
 for(const W of WINS){const tp=W===free.focus&&!reduce?{x:(free.mx/VW-.5)*1.1,y:(free.my/VH-.5)*.8}:W.p0;W.p.x+=(tp.x-W.p.x)*k*.7;W.p.y+=(tp.y-W.p.y)*k*.7;}
}
function enterBoard(){
 const V=view();Object.assign(free,{on:true,x:V.x,y:V.y,Z:V.Z,sy:V.sy,tx:V.x,ty:V.y,tZ:V.Z,tsy:V.sy,focus:null,hover:null,back:null});
 for(const W of WINS)W.p0={x:W.p.x,y:W.p.y};
 document.body.classList.add('board');syncQuiz();
 if(window.PROVERKA?.onEnter?.())return;

 if(!free.greeted){free.greeted=true;setTimeout(()=>{if(free.on&&!LOCK())say(window.PROVERKA?'doska':'doska0');},700);}
 const hint=$('.bd-hint');gsap.killTweensOf(hint);gsap.set(hint,{autoAlpha:1});gsap.to(hint,{autoAlpha:0,duration:.6,delay:5});
}
function exitBoard(){
 window.PROVERKA?.onExit?.();vo.pause();bd.querySelector('.bd-sub').classList.remove('show');free.on=false;free.focus=null;unfocusUI();
 for(const W of WINS){if(W.p0){W.p.x=W.p0.x;W.p.y=W.p0.y;}}
 document.body.classList.remove('board','drag','point');setHover(null);
}

function overview(){const capH=Math.min(170,VH*.22);free.tx=BOARD.cx;free.ty=BOARD.cy;free.tZ=Math.min(VW/BOARD.w,(VH-capH)/BOARD.h);free.tsy=VH/2-capH/2;}
function clampFree(){free.tx=clamp(free.tx,-100,BOARD.w+100);free.ty=clamp(free.ty,-100,BOARD.h+100);}
const toBoard=(mx,my)=>[free.x+(mx-VW/2)/free.Z,free.y+(my-free.sy)/free.Z];
const factsOf=W=>K.FACTS.map((f,i)=>f[1]===W?i:-1).filter(i=>i>=0);
function hit(mx,my){
 const [bx,by]=toBoard(mx,my);
 const W=WINS.find(W=>bx>W.x-16&&bx<W.x+W.w+16&&by>W.y-16&&by<W.y+W.h+16);if(W)return {W};
 const i=K.FACTS.findIndex((f,i)=>bx>LIST.x+50&&bx<LIST.x+LIST.w-30&&by>K.ITEM_Y(i)-8&&by<K.ITEM_Y(i)+130);
 return i>=0?{i}:null;
}
function hiList(idx){K.hiFact=idx;K.items.forEach((e,j)=>e.classList.toggle('on',idx.includes(j)));}
function setHover(h){
 free.hover=h?.W||(h?.i!=null?K.FACTS[h.i][1]:null);
 document.body.classList.toggle('point',!!h);
 if(!free.focus)hiList(h?(h.W?factsOf(h.W):[h.i]):[]);
}

function focus(W){
 if(!free.focus)free.back={x:free.tx,y:free.ty,Z:free.tZ,sy:free.tsy};
 free.focus=W;
 $('.bd-fact').innerHTML=`<span class="n">${W.num}</span>${W.fact}`;
 $('.bd-fact').classList.add('show');$('.bd-back').classList.add('show');$('.bd-bar').classList.add('hide');hiList(factsOf(W));
 for(const c of OV.querySelectorAll(BOARDTAGS))c.classList.toggle('dim',+c.dataset.w!==W.num);
 const top=$('.bd-back').getBoundingClientRect().bottom+10,bot=$('.bd-fact').getBoundingClientRect().top-10,m=20;
 free.tZ=Math.min((VW-24)/(W.w+2*m),(bot-top)/(W.h+2*m));free.tx=W.cx;free.ty=W.cy;free.tsy=(top+bot)/2;
}
function unfocus(){const b=free.back;free.focus=null;free.back=null;if(b){free.tx=b.x;free.ty=b.y;free.tZ=b.Z;free.tsy=b.sy??(VH-60)/2;}else overview();unfocusUI();}
function unfocusUI(){for(const c of OV.querySelectorAll('.dim'))c.classList.remove('dim');$('.bd-fact').classList.remove('show');$('.bd-back').classList.remove('show');if(!LOCK())$('.bd-bar').classList.remove('hide');hiList([]);}
function click(mx,my){
 const h=hit(mx,my);
 if(h?.W){free.focus===h.W?unfocus():focus(h.W);return;}
 if(h?.i!=null){focus(K.FACTS[h.i][1]);return;}
 if(free.focus)unfocus();
}
function zoomAt(mx,my,Z){
 const [zmin,zmax]=zLimits();Z=clamp(Z,zmin,zmax);
 const bx=free.tx+(mx-VW/2)/free.tZ,by=free.ty+(my-free.tsy)/free.tZ;
 free.tZ=Z;free.tx=bx-(mx-VW/2)/Z;free.ty=by-(my-free.tsy)/Z;
 if(free.focus){free.focus=null;free.back=null;unfocusUI();}clampFree();
}
const ptrs=new Map();let drag=null,pinch=null;
cv.addEventListener('pointerdown',e=>{if(!free.on||LOCK())return;cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,Z:free.tZ};drag=null;}
 else drag={x:e.clientX,y:e.clientY,moved:0,vx:0,vy:0,t:performance.now()};});
cv.addEventListener('pointermove',e=>{free.mx=e.clientX;free.my=e.clientY;if(!free.on||LOCK())return;
 const p=ptrs.get(e.pointerId);if(p){p.x=e.clientX;p.y=e.clientY;}
 if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];zoomAt((a.x+b.x)/2,(a.y+b.y)/2,pinch.Z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d);return;}
 if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);
  if(drag.moved>6){document.body.classList.add('drag');if(free.focus){free.focus=null;free.back=null;unfocusUI();}
   free.tx-=dx/free.Z;free.ty-=dy/free.Z;free.x-=dx/free.Z;free.y-=dy/free.Z;clampFree();
   const now=performance.now(),dt=Math.max(8,now-drag.t);drag.vx=dx/dt;drag.vy=dy/dt;drag.t=now;}
  return;}
 setHover(hit(e.clientX,e.clientY));});
function endPtr(e){ptrs.delete(e.pointerId);if(pinch){if(ptrs.size<2)pinch=null;return;}
 if(!drag)return;const d=drag;drag=null;document.body.classList.remove('drag');
 if(d.moved<=6){click(e.clientX,e.clientY);return;}
 if(performance.now()-d.t<90){free.tx-=d.vx*240/free.Z;free.ty-=d.vy*240/free.Z;clampFree();}}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',()=>{if(free.on&&!drag)setHover(null);});
cv.addEventListener('wheel',e=>{if(!free.on||LOCK())return;e.preventDefault();zoomAt(e.clientX,e.clientY,free.tZ*Math.exp(-e.deltaY*.0015));},{passive:false});
addEventListener('keydown',e=>{if(!free.on)return;

 if(LOCK()){const t=e.target,ed=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if(!ed&&(e.code==='Space'||/^Arrow/.test(e.key)))e.stopImmediatePropagation();return;}
 if(e.key==='Escape'){free.focus?unfocus():overview();}
 const step=120/free.Z;
 if(e.key==='+'||e.key==='='){zoomAt(VW/2,free.tsy,free.tZ*1.25);}if(e.key==='-'){zoomAt(VW/2,free.tsy,free.tZ/1.25);}
 if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopImmediatePropagation();free.ty+=(e.key==='ArrowUp'?-step:step);clampFree();}
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();free.tx+=(e.key==='ArrowLeft'?-step:step);clampFree();}
},true);
$('.bd-back').onclick=unfocus;
$('.bd-say').onclick=()=>say(window.PROVERKA?'doska':'doska0');
$('.bd-quizbtn').onclick=()=>window.PROVERKA?.start();
syncQuiz();document.addEventListener('DOMContentLoaded',syncQuiz);

// ── the board's own short voice track (questions to the child), optional: KINO.vopros !== false
const gf=window.GF||(f=>f);

const VOPROS=KINO.vopros!==false;
const vo=VOPROS?new Audio(gf(KINO.files.voAudio)):new Audio();vo.preload=VOPROS?'auto':'none';const VB={};let voT=0;
if(VOPROS)fetch(gf(KINO.files.voBeats)).then(r=>r.json()).then(d=>{for(const b of d.beats)VB[b.id]=b;}).catch(()=>{});
if(!VOPROS){const sb=bd.querySelector('.bd-say');if(sb)sb.style.display='none';}

function say(id){const b=VB[id];if(!b)return;clearTimeout(voT);try{vo.currentTime=b.start;vo.play().catch(()=>{});}catch(e){}
 const sub=bd.querySelector('.bd-sub'),cap=/^doska/.test(id)&&b.show&&!LOCK();sub.textContent=cap?b.show:'';sub.classList.toggle('show',!!cap);
 voT=setTimeout(()=>{vo.pause();sub.classList.remove('show');},(b.end-b.start+.25)*1000);}

// ── timeline keyed to the voice. Camera moves are recorded in MV, strong effects in FXT (the QA scripts read
//    both). Every event is a tween of the paused GSAP timeline, so seeking backwards or forwards gives the same frame.
const MV=[];
// van Wijk & Nuij smooth zoom-and-pan: one arc between two views (w = visible width)
function zoomPath([ux0,uy0,w0],[ux1,uy1,w1],rho=1.3){
 const dx=ux1-ux0,dy=uy1-uy0,d2=dx*dx+dy*dy,r2=rho*rho,r4=r2*r2;
 if(d2<1e-6){const S=Math.log(w1/w0)/rho;return t=>[ux0+t*dx,uy0+t*dy,w0*Math.exp(rho*t*S)];}
 const d1=Math.sqrt(d2),b0=(w1*w1-w0*w0+r4*d2)/(2*w0*r2*d1),b1=(w1*w1-w0*w0-r4*d2)/(2*w1*r2*d1),
  r0=Math.log(Math.sqrt(b0*b0+1)-b0),r1=Math.log(Math.sqrt(b1*b1+1)-b1),S=(r1-r0)/rho;
 return t=>{const s=t*S,c0=Math.cosh(r0),u=w0/(r2*d1)*(c0*Math.tanh(rho*s+r0)-Math.sinh(r0));return [ux0+u*dx,uy0+u*dy,w0*c0/Math.cosh(rho*s+r0)];};
}

// word timings come from recognising the track itself (pipeline/narration/slova.py -> words.json)
const WORDS={};
const wnorm=s=>s.toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');
fetch(gf(KINO.files.words)).then(r=>r.ok?r.json():{}).catch(()=>({})).then(w=>{Object.assign(WORDS,w);start();});

const FXT=[];
function start(){
Multik.run(Object.assign({},KINO.player||{},{
 player:KINO.player||{},
 groups:OKNA.filter(o=>o.beats).map(o=>o.beats),
 audio:gf(KINO.files.audio),beats:gf(KINO.files.beats),
 cover:KINO.cover,
 finale:{label:KINO.finaleLabel},
 build(tl,B){
  const at=(id,f=0)=>B[id].start+B[id].dur*f,end=id=>B[id].end;
  const wordAt=(id,w)=>{const b=B[id],k=wnorm(w.split(/\s+/)[0]),stem=k.slice(0,Math.max(3,k.length-2));
   const hit=(WORDS[id]||[]).find(x=>wnorm(x[0]).startsWith(stem));if(hit)return hit[1];
   const i=b.show.indexOf(w);return b.start+b.dur*Math.max(0,i)/b.show.length;};
  const X=(W,x)=>W.x+x,Y=(W,y)=>W.y+y;
  const plan={x:cam.x,y:cam.y,z:cam.z};

  let last=0;const after=t=>Math.max(t,last+.02);
  let curW=W1;

  const exits=[];const leaveWins=(W,t)=>{for(const e of exits)if(!e.done&&e.W!==W){e.done=true;e.fn(t);}

   for(const V of WINS)if(V!==W&&V.chEl&&V.chOff==null){V.chOff=t;tl.to(V.chEl,{autoAlpha:0,duration:.3,ease:'sine.in'},t);}};

  const open=(t,W,dur=.35)=>tl.fromTo(W,{sh:1},{sh:0,duration:dur,ease:'sine.out',immediateRender:false},t);
  const close=(t,W,dur=.5)=>tl.fromTo(W,{sh:0},{sh:1,duration:dur,ease:'sine.inOut',immediateRender:false},t);
  const goto=(t,W,dur)=>{if(W===curW)return;open(t,W);close(t+Math.max(0,dur-.1),curW);curW=W;};

  const MOVES=[];
  const move=(t,o,dur=1.3,ease='sine.inOut',kind='move')=>{t=after(t);last=t+dur;MV.push({kind,t,end:t+dur});
   const x0=plan.x,y0=plan.y,z0=plan.z,x1=o.x??x0,y1=o.y??y0,z1=o.z??z0,pr={s:0},rec={t,end:t+dur,cutAt:Infinity,set:null};
   tl.fromTo(pr,{s:0},{s:1,duration:dur,ease,immediateRender:false,lazy:false,onUpdate(){const s=pr.s;
    if(rec.cutAt<Infinity&&t+this.time()>=rec.cutAt-1e-6)return;
    if(s<=0||s>=1){Object.assign(cam,s<=0?{x:x0,y:y0,z:z0}:{x:x1,y:y1,z:z1},{fl:0});return;}
    const z=Math.exp(lerp(Math.log(z0),Math.log(z1),s)),[ax,ay]=pinned(x0,y0,z0),[bx,by]=pinned(x1,y1,z1);
    cam.x=lerp(ax,bx,s);cam.y=lerp(ay,by,s);cam.z=z;cam.fl=1;}},t);
   rec.set=tl.set(cam,{x:x1,y:y1,z:z1,fl:0},t+dur).recent();MOVES.push(rec);Object.assign(plan,{x:x1,y:y1,z:z1});};

  const drift=(t0,t1,dx=0,dy=0)=>{const dur=t1-t0,pk=Math.PI/2*Math.hypot(dx,dy)/dur*2*plan.z/60;
   if(pk>.6)console.warn('drift faster than 0.6 px/frame (1440x900):',+pk.toFixed(2),'at',+t0.toFixed(2));
   move(t0,{x:plan.x+dx,y:plan.y+dy},dur,'sine.inOut','drift');};

  const fly=(t,W,{x=W.cx,y=W.cy,z=1,dur=2,rho=1.3,ease='power1.inOut'}={})=>{if(t<last-.02)console.warn('fly',W.id,'starts before the previous move ends',t,last);last=Math.max(last,t+dur);MV.push({kind:'fly '+W.id,t,end:t+dur});
   const x0=plan.x,y0=plan.y,z0=plan.z,pr={s:0};
   tl.fromTo(pr,{s:0},{s:1,duration:dur,ease,immediateRender:false,lazy:false,onUpdate(){
    const s=pr.s;if(s<=0||s>=1){Object.assign(cam,s<=0?{x:x0,y:y0,z:z0}:{x,y,z},{fl:0});return;}
    const [ax,ay]=pinned(x0,y0,z0),[bx,by]=pinned(x,y,z),[ux,uy,w]=zoomPath([ax,ay,800/z0],[bx,by,800/z],rho)(s);
    cam.x=ux;cam.y=uy;cam.z=800/w;cam.fl=1;}},t);
   tl.set(cam,{x,y,z,fl:0},t+dur);
   Object.assign(plan,{x,y,z});goto(t,W,dur);leaveWins(W,t);};

  const slide=(t,W,o,dur=1.6,ease='sine.inOut')=>{t=after(t);move(t,o,dur,ease,'fly '+W.id);goto(t,W,dur);leaveWins(W,t);return t;};

  const cut=(t,W,pose={},label)=>{const {x=W.cx,y=W.cy,z=1,r=0}=pose;

   let cutMove=false;for(const m of MOVES)if(m.t<t-1e-6&&m.end>t+1e-6&&m.cutAt===Infinity){m.cutAt=t;if(m.set)tl.remove(m.set);m.set=null;cutMove=true;
    const mv=MV.find(q=>Math.abs(q.t-m.t)<1e-9&&Math.abs(q.end-m.end)<1e-9);if(mv)mv.end=t;}
   if(cutMove)last=Math.max(t,...MOVES.filter(m=>m.cutAt===Infinity).map(m=>m.end),0);
   else if(t<last-.02)console.warn('cut',W.id,'before the previous move ends',+t.toFixed(2),+last.toFixed(2));
   last=Math.max(last,t);MV.push({kind:'cut '+(label||W.id),t,end:t});
   tl.set(cam,{x,y,z,r,fl:0},t);Object.assign(plan,{x,y,z});
   if(W!==curW){tl.set(W,{sh:0},t);tl.set(curW,{sh:1},t);curW=W;}
   leaveWins(W,t);};

  let nShake=0;const shake=(t,{amp=2,dur=.3}={})=>{if(++nShake>3)console.warn('shake #'+nShake+': more than 3 per cartoon',+t.toFixed(2));
   FXT.push({kind:'shake',t,end:t+dur});if(reduce)return;dur=Math.min(.3,dur);
   tl.set(cam,{shA:Math.min(2,amp)},t);tl.fromTo(cam,{sh:0},{sh:1,duration:.03,ease:'none',immediateRender:false},t);tl.to(cam,{sh:0,duration:dur-.03,ease:'power2.out'},t+.03);};

  let nFlash=0;const flash=(t,{peak=1,up=.25,hold=.12,down=.55,rgb='255,240,205'}={})=>{if(++nFlash>3)console.warn('flash #'+nFlash+': more than 3 per cartoon',+t.toFixed(2));
   FXT.push({kind:'flash',t,end:t+up+hold+down});if(reduce)rgb='34,27,21';

   if(TH.flash.leak&&!reduce){tl.set(FL,{n:nFlash},t);tl.fromTo(FL,{p:0},{p:1,duration:up+hold+down,ease:'none',immediateRender:false},t);}
   tl.set(FL,{rgb},t);tl.fromTo(FL,{a:0},{a:peak,duration:up,ease:'sine.in',immediateRender:false},t);tl.to(FL,{a:0,duration:down,ease:'sine.out'},t+up+hold);
   return t+up;};

  const chapter=(W,t,{hold=2.5,stay=true}={})=>{if(W.chEl)console.warn('chapter of window',W.num,'already exists');
   const e=W.chEl=document.createElement('div');e.className='chapter';e.innerHTML=`<b class="cn">${W.num}</b><span class="cb"><span class="ct">${W.title}</span><span class="cw">${W.where||''}</span></span>`+(stay&&W.where?`<span class="cs">${W.where}</span>`:'');
   GL.appendChild(e);gsap.set(e,{autoAlpha:0});const cb=e.querySelector('.cb'),cn=e.querySelector('.cn'),cs=e.querySelector('.cs');
   if(cs)gsap.set(cs,{autoAlpha:0});
   tl.fromTo(e,{autoAlpha:0,x:-24},{autoAlpha:1,x:0,duration:SOFT?.6:.35,ease:reduce?'sine.out':SOFT?'power2.out':'back.out(1.7)',immediateRender:false},t);
   tl.fromTo(cb,{autoAlpha:1,scaleX:1},{autoAlpha:0,scaleX:.2,duration:.4,ease:'power2.in',immediateRender:false},t+hold);
   if(cs){tl.fromTo(cs,{autoAlpha:0,scaleX:.3},{autoAlpha:1,scaleX:1,duration:.35,ease:'power2.out',immediateRender:false},t+hold+.3);
    tl.fromTo(cn,{scale:1},{scale:.82,duration:.4,ease:'sine.inOut',immediateRender:false},t+hold+.1);
    FXT.push({kind:'chapter '+W.num,t,end:t+hold+.65});return;}
   tl.fromTo(cn,{autoAlpha:1,scale:1},{autoAlpha:0,scale:.5,duration:.45,ease:'sine.in',immediateRender:false},t+hold+.5);
   FXT.push({kind:'chapter '+W.num,t,end:t+hold+.95});};

  const APP=new Map(),LEAVES=[],lbl=el=>(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,32);
  const noteIn=(el,t0,t1)=>{const a=APP.get(el)||[];a.push([t0,t1]);APP.set(el,a);};

  const SOFT=!!TH.motion.soft;
  const appear=(el,t,dur=.55)=>{const rot=+(el.dataset.rot||0);tl.fromTo(el,{opacity:0,scale:SOFT?1.03:1.05,rotation:rot+(SOFT?0:1.5)},{opacity:1,scale:1,rotation:rot,duration:dur,ease:'power2.out',immediateRender:false},t);noteIn(el,t,t+dur);};
  const unfold=(el,t)=>{tl.set(el,{opacity:1},t);tl.fromTo(el,{clipPath:'inset(-40% 100% -40% -8%)'},{clipPath:'inset(-40% -8% -40% -8%)',duration:.22,ease:'power2.out',immediateRender:false},t);};

  const type=(el,t,dur)=>{if(!el.querySelector('.ch'))chars(el);const cs=[...el.querySelectorAll('.ch')],d=dur||Math.max(.6,cs.length*.05);
   tl.set(cs,{opacity:0},t);unfold(el,t);
   tl.fromTo(cs,{opacity:0},{opacity:1,duration:.04,ease:'none',stagger:d/cs.length,immediateRender:false},t+.12);noteIn(el,t,t+.12+d);};

  const typeLines=(el,spans,{at:t0}={})=>{if(!el.querySelector('.ch'))chars(el);const lns=[...el.querySelectorAll('.ln')];
   if(lns.length!==spans.length)console.warn('typeLines: lines',lns.length,'spans',spans.length,lbl(el));
   const t=t0??spans[0][0]-.25;tl.set([...el.querySelectorAll('.ch')],{opacity:0},t);unfold(el,t);let e=t+.22;
   lns.forEach((ln,i)=>{const sp=spans[i],cs=[...ln.querySelectorAll('.ch')];if(!sp||!cs.length)return;const [a,b]=sp;
    tl.fromTo(cs,{opacity:0},{opacity:1,duration:.04,ease:'none',stagger:(b-a)/cs.length,immediateRender:false},a);e=Math.max(e,b+.04);});
   noteIn(el,t,e);};

  const pop=(el,t,dur=.5)=>{const rot=+(el.dataset.rot||0);
   if(SOFT){tl.fromTo(el,{opacity:0},{opacity:1,duration:Math.min(.35,dur),ease:'sine.out',immediateRender:false},t);
    tl.fromTo(el,{scale:.94,rotation:rot},{scale:1,rotation:rot,duration:dur,ease:'power2.out',immediateRender:false},t);noteIn(el,t,t+dur);return;}
   tl.fromTo(el,{opacity:0},{opacity:1,duration:.16,ease:'none',immediateRender:false},t);
   tl.fromTo(el,{scale:.35,rotation:rot-7},{scale:1,rotation:rot,duration:dur,ease:'back.out(2.4)',immediateRender:false},t);noteIn(el,t,t+dur);};

  const pulse=(el,t,{k=1.18,dur=.5}={})=>{if(SOFT)k=1+(k-1)*.35;tl.fromTo(el,{scale:1},{scale:k,duration:dur*.4,ease:'power2.out',immediateRender:false},t);
   tl.fromTo(el,{scale:k},{scale:1,duration:dur*.6,ease:'power2.inOut',immediateRender:false},t+dur*.4);};
  const write=(el,t,dur=1)=>{tl.fromTo(el,{opacity:0,clipPath:'inset(-20% 100% -20% 0)'},{opacity:1,clipPath:'inset(-20% 0% -20% 0)',duration:dur,ease:'sine.inOut',immediateRender:false},t);noteIn(el,t,t+dur);};

  const letters=(el,t,{step=.08}={})=>{const bs=[...el.querySelectorAll('b')];tl.set(bs,{opacity:0},t);tl.set(el,{opacity:1},t);
   const W0=TH.word,dd=W0.dur;
   bs.forEach((b,i)=>tl.fromTo(b,{opacity:0,y:-W0.drop,scale:W0.sc},{opacity:1,y:0,scale:1,duration:dd,ease:SOFT?'sine.out':'power2.out',immediateRender:false},t+i*step));noteIn(el,t,t+Math.max(0,bs.length-1)*step+dd);};

  const leave=(els,t,dur=.4)=>{const ok=[];for(const el of [].concat(els).filter(Boolean)){const bad=(APP.get(el)||[]).find(([a,b])=>a<=t+1e-6&&b>t+1e-3);
    if(bad){console.warn('leave before the appearance ends: "'+lbl(el)+'" leave',+t.toFixed(2),'appears until',+bad[1].toFixed(2),'(leave moved)');tl.to(el,{opacity:0,duration:dur,ease:'sine.in'},bad[1]);LEAVES.push([el,bad[1]]);}
    else{ok.push(el);LEAVES.push([el,t]);}}
   if(ok.length)tl.to(ok,{opacity:0,duration:dur,ease:'sine.in'},t);};

  const cappear=(L,t,dur=.55)=>tl.fromTo(L,{p:0,s:SOFT?1.03:1.05,rot:L.rot+(SOFT?0:1.5)},{p:1,s:1,rot:L.rot,duration:dur,ease:'power2.out',immediateRender:false},t);

  const ctype=(L,t,dur)=>{const d=dur||Math.max(.6,(L.text.length+(L.n?1:0))*.05);tl.fromTo(L,{p:0,c:0},{p:1,c:0,duration:.01,ease:'none',immediateRender:false},t);
   tl.fromTo(L,{u:0},{u:1,duration:.22,ease:'power2.out',immediateRender:false},t);tl.fromTo(L,{c:0},{c:1,duration:d,ease:'none',immediateRender:false},t+.12);};

  const cwrite=(L,t,dur=.8)=>{tl.fromTo(L,{p:0},{p:1,duration:.01,ease:'none',immediateRender:false},t);tl.fromTo(L,{u:0},{u:1,duration:dur,ease:'sine.inOut',immediateRender:false},t);};
  const cleave=(Ls,t,dur=.4)=>tl.to([].concat(Ls),{o:0,duration:dur,ease:'sine.in'},t);

  const cletters=(L,t)=>{const d=([...L.word].length-1)*L.step+TH.word.dur;tl.fromTo(L,{p:0},{p:1,duration:.01,ease:'none',immediateRender:false},t);
   tl.fromTo(L,{lt:0},{lt:d,duration:d,ease:'none',immediateRender:false},t);};
  const rise=(it,t,dur=1)=>tl.fromTo(it,{o:0,dy:it.dy||40},{o:1,dy:0,duration:dur,ease:'power3.out',immediateRender:false},t);
  const draw=(it,t,dur=.8)=>tl.fromTo(it,{p:0},{p:1,duration:dur,ease:'sine.inOut',immediateRender:false},t);
  const fade=(it,t,to,dur=1)=>tl.to(it,{a:to,duration:dur,ease:'sine.inOut'},t);
  const wing=(it,t,o)=>tl.to(it,Object.assign({duration:1.4,ease:'power3.out'},o),t);
  const walk=(its,t,a,b,dur)=>{for(const it of [].concat(its)){tl.fromTo(it,{dx:a},{dx:b,duration:dur,ease:'none',immediateRender:false},t);
   tl.fromTo(it,{wk:0},{wk:1,duration:.25,ease:'none',immediateRender:false},t);tl.fromTo(it,{wk:1},{wk:0,duration:.35,ease:'sine.out',immediateRender:false},t+dur-.2);}};

  Object.assign(K,{tl,B,at,end,wordAt,X,Y,plan,after,move,drift,fly,slide,cut,shake,flash,chapter,open,close,
   appear,pop,pulse,type,typeLines,write,letters,leave,cappear,ctype,cwrite,cleave,cletters,rise,draw,fade,wing,walk,MV,FXT,FG:.15,FD:1.7,
   exit:(W,fn)=>{exits.push({W,fn,done:false});},enter:(W,t)=>leaveWins(W,t)});
  Object.defineProperty(K,'last',{get:()=>last,configurable:true});
  Object.defineProperty(K,'curW',{get:()=>curW,configurable:true});
  for(const o of OKNA)if(o.build)o.build(tl,K);
  if(typeof window.EFF?.build==='function')window.EFF.build(tl,K);

  for(const [el,t] of LEAVES){const bad=(APP.get(el)||[]).find(([a,b])=>a<=t+1e-6&&b>t+1e-3);
   if(bad)console.warn('leave before the appearance ends: "'+lbl(el)+'" leave',+t.toFixed(2),'appears until',+bad[1].toFixed(2));}
 },
 ambient(){}
}));
}
window.kino={free,focus,unfocus,unfocusUI,overview,view,cam,MV,FXT,WINS,W1,W2,W3,W4,W5,W6,W7,W8,LIST,FACTS:K.FACTS,items:K.items,ITEM_Y:K.ITEM_Y,say,VB,vo,hiList,bd,
 quiz:{on:false},k:K,SHADE,FL,get light(){return LIGHT;},get VW(){return VW;},get VH(){return VH;}};
