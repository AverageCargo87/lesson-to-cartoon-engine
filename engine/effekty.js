'use strict';
/* Effects package, part 1: 2D painters + a helper for FXGL patches (window.EFF).
 *
 * Every painter is a PURE function: (ctx, parameters in window units 800x450, time T or progress p) -> drawing.
 * Nothing is accumulated between frames (only finished sprites are cached), so seeking and ?t= give the same frame.
 * Drive an "event" (a strike, a stamp, a loupe) by a progress field p or by timeline time; drive background life
 * (flame, ripples) by page time T. ctx is already translated into the window, the picture lies in PL.
 * Into a layer you pass the wrappers EFF.L.* with signature (c,W,it,T,px), whose parameters are the layer's fields:
 *   k.fx(W,0,k.EFF.L.smoke,{x:..,y:..,a:.8})
 *
 * Index (x, y, r in window units; p 0..1; T seconds; a strength 0..1)
 *   EFF.glDraw(c,P,bitmap,PL,U)              lay an FXGL patch on its place; false when there is no WebGL
 *   EFF.phase(t,base,[[t_i,dv_i,w_i],...])   flow phase: base speed + sum of sigmoid speed-ups, integrated (no state)
 *   EFF.loupe(c,bitmap,PL,x,y,R,k,{a,ang})   a magnifier with REAL magnification of the picture under the glass
 *   EFF.puffs / EFF.trickle / EFF.inkSplat / EFF.stamp   dust puffs, falling sand, ink splat, stamp hit
 *   EFF.iris / EFF.lampFlicker / EFF.laurel / EFF.motes  iris, oil-lamp flicker, laurel wreath, motes in a beam
 *   EFF.spiralMotes / EFF.flyPages / EFF.flashScreen     spiral sparks, pages pulled into a spiral, full-frame flash
 *   EFF.orderArrow / EFF.spearGlints / EFF.tint          pencil arrow, running glints, multiply tint
 *   EFF.gleam / EFF.star / EFF.sparksBurst / EFF.hits / EFF.lastHit   diagonal gleam, star glint, spark burst, hit lists
 *   EFF.potteryArcs / EFF.goldGlints / EFF.gradeBands    potter's wheel, gold glints, 2D "spotlight of ages"
 *   EFF.wash / EFF.riverRipple / EFF.shipRipples / EFF.pin   watercolour wash, river ripple, rings on water, map pin
 *   EFF.strips(c,src,...)                    a picture in strips with offsets: flag, cloth ('v'); water ripple ('h')
 *   EFF.glints(c,pts,T,a,...)                glints on water (points from k.maskPts over a water mask)
 *   EFF.flock(c,path,u,T,list,...)           a flock along a curve, every bird with its own wing beat
 *   EFF.smoke(c,x,y,T,...)                   2D smoke or steam (no WebGL, does not use the patch budget)
 */


(function(){
const EFF=window.EFF=window.EFF||{};
const INK='#15110d',INK2='#17120e',RED='#d0412c';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ss=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};

const FILM=()=>!!(window.KINO&&window.KINO.look==='film');
EFF.FILM=FILM;
function rng(seed){let s=(seed*2654435761)>>>0||1;return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const backOut=(t,k=1.9)=>{t=clamp(t,0,1)-1;return t*t*((k+1)*t+k)+1;};
EFF.util={clamp,lerp,ss,rng,backOut};

const SPR={};
function mote(rgb){const k='m'+rgb;if(SPR[k])return SPR[k];const m=document.createElement('canvas');m.width=m.height=32;const x=m.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);
 g.addColorStop(0,`rgba(${rgb},1)`);g.addColorStop(.4,`rgba(${rgb},.45)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,32,32);return SPR[k]=m;}
function puffSpr(rgb){const k='p'+rgb;if(SPR[k])return SPR[k];const m=document.createElement('canvas');m.width=m.height=64;const x=m.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,32);
 g.addColorStop(0,`rgba(${rgb},.9)`);g.addColorStop(.6,`rgba(${rgb},.55)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,64,64);return SPR[k]=m;}
const plen=pts=>{let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return L;};
const LEN=new WeakMap();const lenOf=pts=>{let L=LEN.get(pts);if(L==null){L=plen(pts);LEN.set(pts,L);}return L;};
function path(c,pts,close){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(close)c.closePath();}

EFF.glDraw=function(c,P,src,PLr,U){
 if(!window.FXGL||!FXGL.ok||!src)return false;
 const [x0,y0,x1,y1]=P.rect,m=c.getTransform?c.getTransform():null,px=m?Math.hypot(m.a,m.b):2;
 return FXGL.draw(P,src,c,PLr.x+x0*PLr.w,PLr.y+y0*PLr.h,(x1-x0)*PLr.w,(y1-y0)*PLr.h,U,px);};
const softplus=x=>x>30?x:Math.log1p(Math.exp(x));

EFF.phase=function(t,base,steps){let ph=base*t;for(const [ti,dv,w] of steps||[])ph+=dv*w*softplus((t-ti)/w);return ph;};

EFF.forgetVeil=function(c,cx,cy,rx,ry,k,a=1){if(k<=0||a<=0)return;
 c.save();c.translate(cx,cy);c.scale(1,ry/rx);
 const R0=rx*lerp(3.2,1.05,k),g=c.createRadialGradient(0,0,R0*.72,0,0,R0*1.25);
 g.addColorStop(0,'rgba(239,228,201,0)');g.addColorStop(.55,`rgba(239,228,201,${.8*a})`);g.addColorStop(1,`rgba(239,228,201,${.97*a})`);
 c.fillStyle=g;c.fillRect(-2000,-2000*rx/ry,4000,4000*rx/ry);
 if(!FILM()){c.lineWidth=5;c.strokeStyle=`rgba(21,17,13,${.55*a*ss(.2,.6,k)})`;c.beginPath();c.ellipse(0,0,R0*.98,R0*.98,0,0,7);c.stroke();}c.restore();};   

EFF.loupe=function(c,src,PLr,x,y,R,k=1.8,o={}){
 const a=o.a==null?1:o.a;if(a<=0||!src)return;const ang=o.ang==null?2.35:o.ang;const INK=FILM()?'rgba(48,30,14,.85)':'#15110d';   
 c.save();c.globalAlpha*=a;
 
 c.save();c.globalAlpha*=.28;c.fillStyle='#000';c.beginPath();c.ellipse(x+6,y+9,R+5,R+4,0,0,7);c.fill();c.restore();
 
 const hx=Math.cos(ang),hy=Math.sin(ang),L=R*1.05,hw=R*.17;
 c.save();c.translate(x+hx*(R+2),y+hy*(R+2));c.rotate(ang);
 c.fillStyle='#8a5a2b';c.strokeStyle=INK;c.lineWidth=2.2;c.beginPath();c.roundRect?c.roundRect(0,-hw,L,hw*2,hw*.9):c.rect(0,-hw,L,hw*2);c.fill();c.stroke();
 c.fillStyle='rgba(255,236,190,.35)';c.fillRect(hw*.6,-hw*.55,L-hw*1.4,hw*.35);
 c.fillStyle='#c89a3e';c.beginPath();c.rect(-2,-hw*1.15,R*.2,hw*2.3);c.fill();c.stroke();
 c.restore();
 
 c.save();c.beginPath();c.arc(x,y,R,0,7);c.clip();
 c.translate(x,y);c.scale(k,k);c.translate(-x,-y);c.drawImage(src,PLr.x,PLr.y,PLr.w,PLr.h);c.restore();
 
 c.save();c.beginPath();c.arc(x,y,R,0,7);c.clip();
 let g=c.createRadialGradient(x,y,R*.62,x,y,R);g.addColorStop(0,'rgba(20,14,8,0)');g.addColorStop(1,'rgba(20,14,8,.32)');c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);
 g=c.createRadialGradient(x-R*.42,y-R*.45,0,x-R*.42,y-R*.45,R*.55);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);
 c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=R*.06;c.lineCap='round';c.beginPath();c.arc(x,y,R*.78,3.6,4.3);c.stroke();
 c.restore();
 
 c.lineWidth=R*.13;c.strokeStyle='#b8873a';c.beginPath();c.arc(x,y,R+R*.05,0,7);c.stroke();
 c.lineWidth=R*.04;c.strokeStyle='rgba(255,230,160,.8)';c.beginPath();c.arc(x,y,R+R*.05,3.5,4.6);c.stroke();
 c.lineWidth=2.4;c.strokeStyle=INK;c.beginPath();c.arc(x,y,R-R*.015,0,7);c.stroke();c.beginPath();c.arc(x,y,R+R*.12,0,7);c.stroke();
 c.restore();};

EFF.puffs=function(c,x,y,T,period=.7,seed=5,o={}){
 const a=o.a==null?1:o.a;if(a<=0)return;const dir=o.dir||1,sp=puffSpr(o.rgb||'250,238,212');
 const k=Math.floor(T/period),u=(T-k*period)/period;
 const G=c.globalAlpha;c.save();
 for(let b=0;b<2;b++){const kk=k-b,uu=u+b;if(uu>1.6)continue;const r=rng(seed*97+kk*13+1000);
  for(let i=0;i<6;i++){const ang=.25+r()*1.1,v=12+r()*18,s=5+r()*6,del=r()*.12,t=clamp((uu-del)/1.1,0,1);if(t<=0||t>=1)continue;
   const e=1-(1-t)*(1-t),px=x+dir*Math.cos(ang)*v*e,py=y-Math.sin(ang)*v*e*.8;
   const R=s*(.6+e*1.3);c.globalAlpha=G*(a*(1-t)*(t<.15?t/.15:1)*.95);c.drawImage(sp,px-R,py-R,2*R,2*R);}}
 c.restore();};

EFF.trickle=function(c,x,y,T,seed=9,o={}){
 const a=o.a==null?1:o.a;if(a<=0)return;const w=o.w||26,fall=o.fall||40,n=o.n||44;const r=rng(seed);
 const G=c.globalAlpha;c.save();
 for(let i=0;i<n;i++){const off=r(),rate=.9+r()*.6,bx=(r()-.5)*w,s=.8+r()*1,dark=r()<.5,jit=(r()-.5)*4;
  const t=((T*rate+off)%1+1)%1,yy=y+t*t*fall,xx=x+bx*(1-t*.35)+jit*t;
  c.globalAlpha=G*(a*(t<.08?t/.08:1)*(1-ss(.75,1,t))*.9);c.fillStyle=dark?'#8a6a3e':'#e6cf98';c.fillRect(xx-s*.5,yy-s,s,s*1.8);}
 c.restore();};

EFF.inkSplat=function(c,x,y,s,p,seed=3,o={}){
 if(p<=0)return;const a=o.a==null?1:o.a;const r=rng(seed),k=backOut(p/.35,2.2);
 
 if(FILM()&&!o.color){const e=ss(0,.35,p),f=1-ss(.45,1,p),R=s*(1.4+1.2*e),sx=o.sx||1;if(f<=0)return;c.save();c.globalCompositeOperation='lighter';c.translate(x,y);c.scale(sx>1?Math.sqrt(sx):1,1);
  const g=c.createRadialGradient(0,0,0,0,0,R);g.addColorStop(0,`rgba(255,244,214,${(.75*a*f).toFixed(3)})`);g.addColorStop(.4,`rgba(255,196,110,${(.32*a*f).toFixed(3)})`);g.addColorStop(1,'rgba(255,170,80,0)');
  c.fillStyle=g;c.fillRect(-R,-R,2*R,2*R);c.restore();return;}
 c.save();c.globalAlpha*=a;c.fillStyle=o.color||INK;c.translate(x,y);c.scale(k,k);
 const n=26,pts=[];for(let i=0;i<n;i++){const an=i/n*Math.PI*2,rr=s*(.78+r()*.38+(r()<.18?r()*.45:0));pts.push([Math.cos(an)*rr,Math.sin(an)*rr*.86]);}
 c.beginPath();for(let i=0;i<n;i++){const [x0,y0]=pts[i],[x1,y1]=pts[(i+1)%n];const mx=(x0+x1)/2,my=(y0+y1)/2;i?c.quadraticCurveTo(x0,y0,mx,my):c.moveTo(mx,my);}c.closePath();c.fill();
 const nd=o.drops==null?6:o.drops,sx=o.sx||1;
 for(let i=0;i<nd;i++){const an=r()*Math.PI*2,d=s*(1.2+r()*.6),rr=s*(.06+r()*.1),tail=r()<.5;
  const dx=Math.cos(an)*d*sx,dy=Math.sin(an)*d*.86;c.beginPath();c.arc(dx,dy,rr,0,7);c.fill();
  if(tail){c.lineWidth=rr*.9;c.strokeStyle=o.color||INK;c.lineCap='round';c.beginPath();c.moveTo(dx*.82,dy*.82);c.lineTo(dx*.97,dy*.97);c.stroke();}}
 c.restore();};

EFF.stamp=function(c,x,y,w,h,p,seed=4,o={}){
 if(p<=0)return;const a=o.a==null?1:o.a;const r=rng(seed);const film=FILM()&&!o.color;   
 const G=c.globalAlpha;c.save();c.globalAlpha*=a;c.strokeStyle=film?'rgba(255,226,170,.95)':o.color||INK;c.lineCap='round';if(film)c.globalCompositeOperation='lighter';
 const t=clamp(p/.45,0,1),e=1-(1-t)*(1-t),fade=1-ss(.55,1,t);
 for(let i=0;i<12;i++){const an=(i/12)*Math.PI*2+r()*.25,ca=Math.cos(an),sa=Math.sin(an);
  const ex=w/2+6,ey=h/2+6,d0=Math.min(Math.abs(ex/(ca||1e-3)),Math.abs(ey/(sa||1e-3))),L=8+r()*10;
  const d1=d0+4+e*14,d2=d1+L*(1-e*.5);c.globalAlpha=G*(a*fade);c.lineWidth=2.6-1.2*e;
  c.beginPath();c.moveTo(x+ca*d1,y+sa*d1);c.lineTo(x+ca*d2,y+sa*d2);c.stroke();}
 c.restore();if(film)return;
 
 c.save();c.globalAlpha*=a*ss(.05,.25,p);c.fillStyle=o.color||INK;
 for(let i=0;i<(o.drops==null?4:o.drops);i++){const an=r()*Math.PI*2,ca=Math.cos(an),sa=Math.sin(an),d=Math.min(Math.abs((w/2+4)/(ca||1e-3)),Math.abs((h/2+4)/(sa||1e-3)))+2+r()*5,rr=.9+r()*1.6;
  c.beginPath();c.arc(x+ca*d,y+sa*d,rr,0,7);c.fill();}
 c.restore();};

EFF.iris=function(c,W,x,y,r,a=1,o={}){
 if(a<=0)return;
 
 if(FILM()&&!o.fill){const e=Math.max(18,r*.35),R=Math.max(1,r),g=c.createRadialGradient(x,y,Math.max(0,R-e*.5),x,y,R+e*.5);
  g.addColorStop(0,'rgba(8,6,4,0)');g.addColorStop(1,`rgba(8,6,4,${(.9*a).toFixed(3)})`);
  c.save();c.fillStyle=g;c.fillRect(-60,-60,W.w+120,W.h+120);c.restore();return;}
 const r0=rng(o.seed||17),n=72,ph=r0()*6.28,ph2=r0()*6.28;
 const ring=[];for(let i=0;i<n;i++){const an=i/n*Math.PI*2,rr=r*(1+.010*Math.sin(an*5+ph)+.006*Math.sin(an*11+ph2));ring.push([x+Math.cos(an)*rr,y+Math.sin(an)*rr]);}
 c.save();c.globalAlpha*=a;c.fillStyle=o.fill||'rgba(12,8,5,.9)';
 c.beginPath();c.rect(-60,-60,W.w+120,W.h+120);ring.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.fill('evenodd');
 const lw=Math.max(3,r*.035);c.strokeStyle=INK;c.lineJoin='round';c.lineWidth=lw;path(c,ring,true);c.stroke();
 c.lineWidth=1.3;c.strokeStyle='rgba(21,17,13,.6)';c.beginPath();c.arc(x,y,r*1.03+lw+2,0,7);c.stroke();
 c.restore();};

EFF.lampFlicker=function(c,x,y,r,T,a=1){
 if(a<=0)return;const f=.62*Math.sin(T*7.3)+.27*Math.sin(T*11.7+1.3)+.11*Math.sin(T*17.9+.4),k=1+.15*f;
 c.save();c.globalCompositeOperation='lighter';
 let g=c.createRadialGradient(x,y,0,x,y,r*k*3.2);g.addColorStop(0,`rgba(255,200,110,${.42*a})`);g.addColorStop(.35,`rgba(255,170,80,${.16*a})`);g.addColorStop(1,'rgba(255,150,60,0)');
 c.fillStyle=g;c.fillRect(x-r*4,y-r*4,r*8,r*8);
 g=c.createRadialGradient(x,y-r*.2,0,x,y-r*.2,r*k);g.addColorStop(0,`rgba(255,250,215,${.9*a})`);g.addColorStop(.5,`rgba(255,214,120,${.45*a})`);g.addColorStop(1,'rgba(255,190,90,0)');
 c.fillStyle=g;c.beginPath();c.ellipse(x+.6*f,y-r*.25,r*.55*k,r*k,0,0,7);c.fill();
 c.restore();};

EFF.laurel=function(c,x,y,r,p,o={}){
 if(p<=0)return;const a=o.a==null?1:o.a,ry=o.ry||r*.42,n=o.n||9,rot=o.rot||0,film=FILM();   
 c.save();c.globalAlpha*=a;c.translate(x,y);c.rotate(rot);c.lineJoin='round';
 if(o.glow){const g=c.createRadialGradient(0,0,0,0,0,r*1.5);g.addColorStop(0,`rgba(255,214,120,${.45*o.glow*Math.min(1,p*2)})`);g.addColorStop(1,'rgba(255,200,100,0)');
  c.save();c.globalCompositeOperation='lighter';c.scale(1,Math.max(.35,ry/r));c.fillStyle=g;c.fillRect(-r*1.5,-r*1.5,r*3,r*3);c.restore();}
 const leaf=(lx,ly,an,s,k)=>{if(k<=0)return;c.save();c.translate(lx,ly);c.rotate(an);c.scale(k,k);
  c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(s*.55,-s*.42,s*1.15,0);c.quadraticCurveTo(s*.55,s*.42,0,0);
  const g=c.createLinearGradient(0,-s*.4,0,s*.4);g.addColorStop(0,'#ffe08a');g.addColorStop(.55,'#e2a93a');g.addColorStop(1,'#a8701c');c.fillStyle=g;c.fill();
  c.strokeStyle=film?'rgba(110,70,15,.7)':INK;c.lineWidth=Math.min(1.15,s*.09);c.stroke();c.beginPath();c.moveTo(s*.1,0);c.lineTo(s*.9,0);c.strokeStyle='rgba(120,70,15,.8)';c.lineWidth=Math.min(.7,s*.05);c.stroke();c.restore();};
 for(const side of [-1,1]){
  const a0=Math.PI/2,a1=Math.PI/2-side*Math.PI*.86;            
  const pt=t=>{const an=lerp(a0,a1,t);return [Math.cos(an)*r,Math.sin(an)*ry];};
  const pb=clamp(p*1.15,0,1);
  c.beginPath();for(let i=0;i<=24;i++){const t=i/24*pb,[px,py]=pt(t);i?c.lineTo(px,py):c.moveTo(px,py);}
  c.strokeStyle='#8a5a1c';c.lineWidth=Math.min(2.2,r*.09);c.stroke();if(!film){c.strokeStyle=INK;c.lineWidth=Math.min(.8,r*.035);c.stroke();}
  for(let i=0;i<n;i++){const t=(i+.5)/n,k=backOut((p*1.15-t*.95)/.18,2);if(k<=0)continue;
   const [px,py]=pt(t),[qx,qy]=pt(Math.min(1,t+.02)),tan=Math.atan2(qy-py,qx-px),s=r*(.30-.1*t);
   leaf(px,py,tan-side*.75,s,k);leaf(px,py,tan+side*.55+(side>0?0:0),s*.9,k*(i<n-1?1:0));}}
 c.restore();};

EFF.motes=function(c,x0,y0,x1,y1,T,seed=21,a=1,o={}){
 if(a<=0)return;const r=rng(seed),sp=mote(o.rgb||'255,226,160'),n=o.n||26,dir=o.dir||1,W=x1-x0,H=y1-y0;
 const G=c.globalAlpha;c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const bx=r()*W,by=r()*H,vx=(r()-.5)*7,vy=(3+r()*6)*dir,ph=r()*6.28,s=.6+r()*1.5,big=r()<.2;
  const x=x0+((bx+T*vx+Math.sin(T*.6+ph)*8)%W+W)%W,y=y0+((by+T*vy)%H+H)%H;
  const al=(.3+.5*Math.sin(T*1.2+ph)**2)*(big?.55:1),R=big?s*3.6:s*1.2;c.globalAlpha=G*(a*al);c.drawImage(sp,x-R,y-R,2*R,2*R);}
 c.restore();};

EFF.spiralMotes=function(c,cx,cy,rx,ry,ph,a,o={}){
 if(a<=.003)return;const r=rng(o.seed||91),sp=mote(o.rgb||'255,226,150'),n=o.n||46,dir=o.dir||-1,fr=o.from;
 const G=c.globalAlpha;c.save();c.globalCompositeOperation=o.comp||'lighter';
 for(let i=0;i<n;i++){const off=r(),a0=r()*6.283,big=r()<.2,s=.8+r()*1.6,u=((ph*.55+off)%1+1)%1;
  const rad=1.9*Math.pow(1-u,1.4),an=a0+dir*(u*2.6+u*u*2.2)*Math.PI;let x=cx+Math.cos(an)*rx*rad,y=cy+Math.sin(an)*ry*rad;
  if(fr){const e=ss(0,.55,u);x=lerp(fr[0]+(r()-.5)*rx*.6,x,e);y=lerp(fr[1]+(r()-.5)*ry*.6,y,e);}
  c.globalAlpha=G*(a*Math.sin(u*Math.PI)*(big?.55:.9));const R=big?s*3.2:s*1.3;c.drawImage(sp,x-R,y-R,2*R,2*R);}
 c.restore();};

EFF.flyPages=function(c,cx,cy,rx,ry,p,o={}){
 if(p<=0||p>=1)return;const r=rng(o.seed||7),n=o.n||5,dir=o.dir||-1;
 for(let k=0;k<n;k++){const a0=r()*6.283,rot0=r()*6.283,u=clamp((p-k*.09)/.62,0,1);if(u<=0||u>=1)continue;
  const e=u*u*(3-2*u),rad=2.3*Math.pow(1-e,1.25),an=a0+dir*e*2.2*Math.PI;
  const x=cx+Math.cos(an)*rx*rad,y=cy+Math.sin(an)*ry*rad,s=1-e*.85,al=Math.min(1,u*8)*(1-clamp((e-.85)/.15,0,1));
  c.save();c.globalAlpha*=al;c.translate(x,y);c.rotate(rot0+an*1.3);c.scale(s,s*(.55+.45*Math.abs(Math.cos(an*2+rot0))));
  c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-11,-6,26,18);c.fillStyle='#fbf3df';c.strokeStyle=FILM()?'rgba(80,60,40,.55)':INK;c.lineWidth=FILM()?.8:1.4;c.fillRect(-13,-9,26,18);c.strokeRect(-13,-9,26,18);
  c.strokeStyle='rgba(60,45,30,.55)';c.lineWidth=1;for(let j=0;j<4;j++){c.beginPath();c.moveTo(-9,-5+j*3.6);c.lineTo(9-(j===3?7:0),-5+j*3.6);c.stroke();}
  c.restore();}};

EFF.flashScreen=function(c,w,h,a,o={}){
 if(a<=0)return;const x=o.x==null?w/2:o.x,y=o.y==null?h/2:o.y,R=Math.hypot(Math.max(x,w-x),Math.max(y,h-y));
 const core=o.core||'255,249,228',mid=o.rgb||'255,214,120',edge=o.edge||'240,170,70';
 c.save();
 const g=c.createRadialGradient(x,y,0,x,y,R);
 g.addColorStop(0,`rgba(${core},${Math.min(1,a*1.05)})`);g.addColorStop(.35,`rgba(${mid},${.96*a})`);g.addColorStop(1,`rgba(${edge},${.86*a})`);
 c.fillStyle=g;c.fillRect(0,0,w,h);
 const n=o.rays||0;if(n){const r=rng(o.seed||12),T=o.T||0;c.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){const an=i/n*Math.PI*2+r()*.2+T*.15,wd=.035+r()*.05;c.fillStyle=`rgba(255,250,230,${(o.rayA||.2)*a*(.5+r()*.5)})`;
   c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(an-wd)*R,y+Math.sin(an-wd)*R);c.lineTo(x+Math.cos(an+wd)*R,y+Math.sin(an+wd)*R);c.closePath();c.fill();}}
 c.restore();};

EFF.orderArrow=function(c,from,to,p,o={}){
 if(p<=0)return;const a=o.a==null?1:o.a,bend=o.bend==null?.18:o.bend,w=o.w||3,dash=o.dash||[11,7];
 const [x0,y0]=from,[x1,y1]=to,dx=x1-x0,dy=y1-y0,L0=Math.hypot(dx,dy),mx=(x0+x1)/2-dy*bend,my=(y0+y1)/2+dx*bend;
 const N=40,pts=[];for(let i=0;i<=N;i++){const t=i/N,u=1-t;pts.push([u*u*x0+2*u*t*mx+t*t*x1,u*u*y0+2*u*t*my+t*t*y1]);}
 const L=lenOf(pts),D=L*clamp(p/.86,0,1);
 
 if(FILM()&&!o.color){const pat=[];let acc=0,di=0;while(acc<D){const s=Math.min(dash[di%2],D-acc);pat.push(s);acc+=s;di++;}if(pat.length%2)pat.push(L+10);else pat.push(0,L+10);
  c.save();c.globalAlpha*=a;c.lineCap='round';c.lineJoin='round';c.setLineDash(pat);path(c,pts);
  c.strokeStyle='rgba(16,10,5,.28)';c.lineWidth=w*2.6;c.stroke();c.globalCompositeOperation='lighter';
  c.strokeStyle='rgba(255,204,138,.3)';c.lineWidth=w*2;c.stroke();c.strokeStyle='rgba(255,244,222,.95)';c.lineWidth=w*.6;c.stroke();c.setLineDash([]);
  if(p>.86){const k=ss(.86,1,p),[ex,ey]=pts[N],[qx,qy]=pts[N-3],an=Math.atan2(ey-qy,ex-qx),s=(10+w*2)*k;c.beginPath();c.moveTo(ex-Math.cos(an-.5)*s,ey-Math.sin(an-.5)*s);c.lineTo(ex,ey);c.lineTo(ex-Math.cos(an+.5)*s,ey-Math.sin(an+.5)*s);
   c.strokeStyle='rgba(255,204,138,.3)';c.lineWidth=w*2;c.stroke();c.strokeStyle='rgba(255,244,222,.95)';c.lineWidth=w*.6;c.stroke();}
  c.restore();return;}
 c.save();c.globalAlpha*=a*.92;c.strokeStyle=o.color||RED;c.lineCap='round';c.lineJoin='round';c.lineWidth=w;
 
 const pat=[];let acc=0,on=true,di=0;while(acc<D){const s=Math.min(dash[di%2],D-acc);pat.push(s);acc+=s;di++;}if(pat.length%2)pat.push(L+10);else pat.push(0,L+10);
 c.setLineDash(pat);path(c,pts);c.stroke();c.setLineDash([]);
 if(p>.86){const k=ss(.86,1,p),[ex,ey]=pts[N],[qx,qy]=pts[N-3],an=Math.atan2(ey-qy,ex-qx),s=(10+w*2)*k;
  c.lineWidth=w+.4;c.beginPath();c.moveTo(ex-Math.cos(an-.5)*s,ey-Math.sin(an-.5)*s);c.lineTo(ex,ey);c.lineTo(ex-Math.cos(an+.5)*s,ey-Math.sin(an+.5)*s);c.stroke();}
 c.restore();};

EFF.star=function(c,x,y,r,a=1,rot=0){
 if(a<=0||r<=0)return;c.save();c.globalCompositeOperation='lighter';c.translate(x,y);c.rotate(rot);
 const g=c.createRadialGradient(0,0,0,0,0,r*.9);g.addColorStop(0,`rgba(255,246,210,${.6*a})`);g.addColorStop(.4,`rgba(255,214,120,${.22*a})`);g.addColorStop(1,'rgba(255,200,110,0)');
 c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);
 c.fillStyle=`rgba(255,252,235,${a})`;c.beginPath();
 for(let i=0;i<8;i++){const an=i*Math.PI/4-Math.PI/2,rr=i%2?r*.11:(i%4===0?r:r*.7);const px=Math.cos(an)*rr,py=Math.sin(an)*rr;i?c.lineTo(px,py):c.moveTo(px,py);}
 c.closePath();c.fill();c.restore();};

EFF.spearGlints=function(c,tips,p,T,o={}){
 if(p<=0||p>=1||!tips.length)return;const a=o.a==null?1:o.a,n=tips.length,s=o.size||7,win=o.win||1.6/n;
 for(let i=0;i<n;i++){const d=Math.abs(p-(i+.5)/n)/win;if(d>=1)continue;const k=Math.cos(d*Math.PI/2)**2;
  EFF.star(c,tips[i][0],tips[i][1],s*(.6+.5*k)*(1+.08*Math.sin(T*20+i)),a*k,.3*Math.sin(i*1.7));}};

EFF.tint=function(c,W,rgb,a){if(a<=0)return;c.save();c.globalCompositeOperation='multiply';c.fillStyle=`rgba(${rgb},${a})`;c.fillRect(-40,-40,W.w+80,W.h+80);c.restore();};

EFF.gleam=function(c,poly,p,o={}){
 if(p<=0||p>=1)return;const a=o.a==null?1:o.a,w=o.w||34,ang=o.ang==null?.42:o.ang;
 let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const [x,y] of poly){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const cy=(y0+y1)/2,H=y1-y0,sx=Math.tan(ang)*H/2,X=lerp(x0-w-sx,x1+w+sx,p);
 c.save();path(c,poly,true);c.clip();c.globalCompositeOperation='lighter';
 c.translate(X,cy);c.transform(1,0,-Math.tan(ang),1,0,0);
 const g=c.createLinearGradient(-w,0,w,0);g.addColorStop(0,'rgba(255,230,160,0)');g.addColorStop(.42,`rgba(255,236,180,${.55*a})`);g.addColorStop(.5,`rgba(255,252,235,${.9*a})`);g.addColorStop(.58,`rgba(255,236,180,${.55*a})`);g.addColorStop(1,'rgba(255,230,160,0)');
 c.fillStyle=g;c.fillRect(-w,-H,w*2,H*2);c.restore();};

EFF.hits=function(t0,t1,period){const out=[];let t=t0;while(t<=t1+1e-9){out.push(t);t+=typeof period==='function'?period(t):period;}return out;};

EFF.lastHit=function(t,hits){let lo=0,hi=hits.length-1,i=-1;while(lo<=hi){const m=(lo+hi)>>1;if(hits[m]<=t){i=m;lo=m+1;}else hi=m-1;}return i<0?null:{i,dt:t-hits[i]};};

EFF.sparksBurst=function(c,x,y,dt,o={}){
 if(dt<0||dt>.6)return;const a=o.a==null?1:o.a,r=rng(o.seed||41),n=o.n||18,GR=260;
 const G=c.globalAlpha;c.save();c.globalCompositeOperation='lighter';
 if(dt<.16){const k=1-dt/.16,R=(o.flash||34)*(.6+.4*k);const g=c.createRadialGradient(x,y,0,x,y,R);
  g.addColorStop(0,`rgba(255,250,220,${.95*a*k})`);g.addColorStop(.35,`rgba(255,200,90,${.5*a*k})`);g.addColorStop(1,'rgba(255,140,40,0)');c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);}
 c.lineCap='round';
 for(let i=0;i<n;i++){const an=-Math.PI/2+(r()-.5)*2.5,v=70+r()*120,life=.22+r()*.3;const t=dt;if(t>life){r();continue;}
  const vx=Math.cos(an)*v,vy=Math.sin(an)*v,px=x+vx*t,py=y+vy*t+GR*t*t/2,qx=px-vx*.035,qy=py-(vy+GR*t)*.035,k=1-t/life;
  c.globalAlpha=G*(a*k);c.strokeStyle=k>.55?'#fff4c4':'#ffa040';c.lineWidth=1.1+r()*.9;c.beginPath();c.moveTo(qx,qy);c.lineTo(px,py);c.stroke();}
 c.restore();};

EFF.potteryArcs=function(c,cx,cy,rx,ry,T,a=1,o={}){
 if(a<=0)return;const sp=o.speed||5.5;
 const G=c.globalAlpha;c.save();c.lineCap='round';
 for(let i=0;i<3;i++){const a0=T*sp+i*2.094,len=1.0;            
  for(let j=0;j<5;j++){const t0=a0-len*j/5,t1=a0-len*(j+1)/5;
   c.globalAlpha=G*(a*(1-j/5)*.8);c.strokeStyle='rgba(255,238,205,1)';c.lineWidth=2.2-j*.25;c.beginPath();c.ellipse(cx,cy,rx*(.62+.12*i),ry*(.62+.12*i),0,t1,t0);c.stroke();}}
 c.strokeStyle=FILM()?'rgba(255,238,205,.55)':INK;   
 const pot=o.pot;if(pot){const [px,py,hw,hh]=pot;c.setLineDash([7,5]);c.lineDashOffset=-T*26;c.lineWidth=1.8;c.globalAlpha=G*(a*.9);
  for(const [dy,k] of [[-.18,1],[.16,1.08]])for(const side of [0,Math.PI]){c.beginPath();c.ellipse(px,py+hh*dy,hw*1.28*k,hh*.2,0,side+.15,side+.85);c.stroke();}
  c.setLineDash([]);}
 c.restore();};

EFF.goldGlints=function(c,pts,p,o={}){
 if(p<=0||p>=1)return;const a=o.a==null?1:o.a,n=pts.length,win=o.win||1.8/n;
 for(let i=0;i<n;i++){const d=Math.abs(p-(i+.5)/n)/win;if(d>=1)continue;const k=Math.cos(d*Math.PI/2)**2,[x,y,rr]=pts[i];
  const R=(rr||14)*1.6;c.save();c.globalCompositeOperation='lighter';const g=c.createRadialGradient(x,y,0,x,y,R);
  g.addColorStop(0,`rgba(255,226,140,${.5*a*k})`);g.addColorStop(1,'rgba(255,200,90,0)');c.fillStyle=g;c.fillRect(x-R,y-R,2*R,2*R);c.restore();
  EFF.star(c,x+(rr||14)*.3,y-(rr||14)*.35,(o.size||6)*(.7+.4*k),a*k);}};

EFF.gradeBands=function(c,W,cents,focus,half,a){
 if(a<=0)return;const f=clamp(focus,0,3),i=Math.min(2,Math.floor(f)),cx=lerp(cents[i],cents[i+1],f-i),h=half||100,e=26;
 const band=(fill,comp,al)=>{c.save();c.globalCompositeOperation=comp;const x0=cx-h-e,L=2*(h+e),g=c.createLinearGradient(x0,0,x0+L,0);
  const s0=`rgba(${fill},${al})`,s1=`rgba(${fill},0)`,q=2*e/L;
  g.addColorStop(0,s0);g.addColorStop(q,s1);g.addColorStop(1-q,s1);g.addColorStop(1,s0);
  c.fillStyle=g;c.fillRect(x0,-40,L,W.h+80);c.fillStyle=s0;c.fillRect(-40,-40,x0+40,W.h+80);c.fillRect(x0+L,-40,W.w+80-(x0+L),W.h+80);c.restore();};
 band('128,128,128','saturation',.78*a);band('150,140,128','multiply',.55*a);};

EFF.strips=function(c,src,sx,sy,sw,sh,x,y,w,h,T,o={},pxu=2){
 const ax=o.axis||'v',amp=o.amp==null?2:o.amp,len=o.len||(ax==='v'?w*.8:Math.max(4,h*.5)),sp=o.sp==null?2.2:o.sp,ph=o.ph||0,K=2*Math.PI/len,a2=o.amp2||0;
 const q=Math.max(.05,pxu),Lx=ax==='v'?w:h,n=Math.max(2,Math.min(o.nmax||160,Math.ceil(Lx*q/(o.step||(ax==='v'?10:3))))),ov=.6/q;
 if(ax==='v'){const pin=o.pin||'l';
  for(let i=0;i<n;i++){const u0=i/n,uc=(i+.5)/n,lx=uc*w,env=pin==='r'?1-uc:pin==='none'?1:uc;
   const dy=env*(amp*Math.sin(K*lx-sp*T+ph)+a2*Math.sin(K*2.3*lx-sp*1.6*T+ph*1.7));
   c.drawImage(src,sx+u0*sw,sy,sw/n+ov*sw/w,sh,x+u0*w,y+dy,w/n+ov,h);}}
 else{const pr=o.persp||0;
  for(let i=0;i<n;i++){const u0=i/n,uc=(i+.5)/n,ly=uc*h,s=pr>0?pr+(1-pr)*uc:1;
   const dx=s*(amp*Math.sin(K*ly/s+sp*T+ph)+a2*Math.sin(K*2.1*ly/s-sp*1.3*T+ph*1.9));
   c.drawImage(src,sx,sy+u0*sh,sw,sh/n+ov*sh/h,x+dx,y+u0*h,w,h/n+ov);}}};

EFF.glints=function(c,pts,T,a=1,o={}){
 if(a<=.003||!pts||!pts.length)return;const per=o.period||3.2,L0=o.len||6,G=c.globalAlpha,hor=o.hor;
 
 const soft=FILM()&&!hor&&!o.color;
 c.save();c.lineCap='round';c.strokeStyle=o.color||(soft?'rgb(226,238,250)':'rgb(255,252,238)');
 for(let i=0;i<pts.length;i++){const r=rng((o.seed||7)*977+i*31),ph=r()*per,u=(((T+ph)/per)%1+1)%1,l=r(),wd=r(),st=r();if(u>.38)continue;
  const k=Math.sin(u/.38*Math.PI),[x,y]=pts[i],s=hor?clamp((y-hor[0])/Math.max(1,hor[1]-hor[0]),0,1)*.75+.25:1;
  const len=L0*s*(.55+.8*l)*(.6+.4*k)*(soft?.7:1),dx=(u-.19)*(o.drift||4)*s;
  if(soft){const lw=(.45+.35*wd)+.15;c.globalAlpha=G*a*k*.09;c.lineWidth=lw*3.4;c.beginPath();c.moveTo(x+dx-len/2,y);c.lineTo(x+dx+len/2,y);c.stroke();
   c.globalAlpha=G*a*k*.3;c.lineWidth=lw;c.beginPath();c.moveTo(x+dx-len/2,y);c.lineTo(x+dx+len/2,y);c.stroke();continue;}
  c.globalAlpha=G*a*k*.75;c.lineWidth=(.7+.5*wd)*s+.25;c.beginPath();c.moveTo(x+dx-len/2,y);c.lineTo(x+dx+len/2,y);c.stroke();
  if(st<.08&&k>.75)EFF.star(c,x+dx,y,(2.4+1.6*l)*s,a*(k-.75)/.25*.6,0);}
 c.restore();};

const PATHC=new WeakMap();
function pathOf(pts){let P=PATHC.get(pts);if(P)return P;const S=[],n=pts.length,at=i=>pts[Math.max(0,Math.min(n-1,i))];
 for(let i=0;i<n-1;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
  for(let k=0;k<16;k++){const t=k/16,t2=t*t,t3=t2*t,cr=j=>.5*(2*p1[j]+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3);S.push([cr(0),cr(1)]);}}
 S.push(pts[n-1].slice());const D=[0];for(let i=1;i<S.length;i++)D.push(D[i-1]+Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]));
 P={S,D,L:D[D.length-1]||1};PATHC.set(pts,P);return P;}

EFF.pathAt=function(pts,u){const P=pathOf(pts),s=clamp(u,0,1)*P.L;let lo=0,hi=P.D.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(P.D[m]<=s)lo=m;else hi=m;}
 const d=P.D[hi]-P.D[lo]||1,t=(s-P.D[lo])/d,a=P.S[lo],b=P.S[hi];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,Math.atan2(b[1]-a[1],b[0]-a[0])];};

EFF.flock=function(c,path,u,T,list,o={}){
 if(!(u>0)||!(u<1)||!path||path.length<2)return;const P=pathOf(path),s0=o.s==null?1:o.s,s1=o.s1==null?s0:o.s1;
 const film=FILM();   
 c.save();c.lineCap='round';c.lineJoin='round';c.strokeStyle=o.color||(film?'#24232a':INK2);
 for(let i=0;i<list.length;i++){const [bx,by,bs]=list[i],r=rng((o.seed||3)*71+i*13),fq=8.5+r()*3,phf=r()*6.28,gs=.5+r()*.4;
  const ub=u+bx/P.L;if(ub<=0||ub>=1)continue;
  const [x0,y0,an]=EFF.pathAt(path,ub),sc=lerp(s0,s1,ub),nx=-Math.sin(an),ny=Math.cos(an);
  const glide=.5+.5*Math.sin(T*gs+phf),f=Math.sin(T*fq+phf)*(.25+.75*ss(.15,.6,glide)),k=bs*sc*5;
  const x=x0+nx*by*sc+Math.sin(T*1.3+phf)*1.2*sc,y=y0+ny*by*sc+Math.sin(T*1.7+phf*1.3)*1.4*sc;
  c.beginPath();c.moveTo(x-2*k,y+(.3-1.3*f)*k*.8);c.quadraticCurveTo(x-k,y-(.6+f*.5)*k*.8,x,y);c.quadraticCurveTo(x+k,y-(.6+f*.5)*k*.8,x+2*k,y+(.3-1.3*f)*k*.8);
  c.lineWidth=(film?.32:.38)*k;c.stroke();}
 c.restore();};

EFF.smoke=function(c,x,y,T,o={}){const a=o.a==null?1:o.a;if(a<=.003)return;
 const n=o.n||9,life=o.life||5,h=o.h||60,r0=o.r0||4,r1=o.r1||16,wind=o.wind==null?20:o.wind,sp=puffSpr(o.rgb||'238,234,226'),G=c.globalAlpha,ink=FILM()?0:o.ink||0;   
 const P=[];for(let i=0;i<n;i++){const r=rng((o.seed||3)*53+i),off=i/n+(r()-.5)*.06;P.push([(((T/life+off)%1)+1)%1,r()-.5,r()*6.28]);}
 P.sort((p,q)=>q[0]-p[0]);   
 c.save();
 for(const [u,j,wob] of P){const e=1-Math.pow(1-u,1.7),px=x+wind*Math.pow(u,1.35)+j*r1*.6*u+Math.sin(T*.8+wob)*2.2*u,py=y-h*e,R=r0+(r1-r0)*Math.sqrt(u);
  const al=a*Math.min(1,u/.1)*Math.pow(1-u,1.3)*(o.alpha||.8);if(al<=.003)continue;
  c.globalAlpha=G*al;c.drawImage(sp,px-R,py-R,2*R,2*R);
  if(ink>0){c.globalAlpha=G*al*ink*.55;c.strokeStyle=INK;c.lineWidth=Math.max(.5,R*.07);c.beginPath();c.arc(px,py,R*.62,Math.PI*1.05,Math.PI*1.85);c.stroke();}}
 c.restore();};

EFF.wash=function(c,x,y,R,p,rgb,a=.25,o={}){
 if(p<=0)return;const e=1-Math.pow(1-clamp(p,0,1),3),rr=R*e,r=rng(o.seed||33),n=48,f1=r()*6.28,f2=r()*6.28,f3=r()*6.28;
 c.save();c.globalCompositeOperation='multiply';c.beginPath();
 for(let i=0;i<=n;i++){const an=i/n*Math.PI*2,k=.92+.07*Math.sin(3*an+f1)+.05*Math.sin(5*an+f2)+.03*Math.sin(9*an+f3);const px=x+Math.cos(an)*rr*k,py=y+Math.sin(an)*rr*k*.92;i?c.lineTo(px,py):c.moveTo(px,py);}
 c.closePath();const g=c.createRadialGradient(x,y,0,x,y,rr*1.1);
 g.addColorStop(0,`rgba(${rgb},${a*.75})`);g.addColorStop(.75,`rgba(${rgb},${a*.85})`);g.addColorStop(.93,`rgba(${rgb},${a*1.25})`);g.addColorStop(1,`rgba(${rgb},${a*.5})`);
 c.fillStyle=g;c.fill();c.restore();};

EFF.riverRipple=function(c,pts,T,a=1,o={}){
 if(a<=0||!pts||pts.length<2)return;const sp=o.speed||24;
 c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash(o.dash||[5,17]);c.lineDashOffset=-T*sp;
 c.strokeStyle=`rgba(225,244,255,${.75*a})`;c.lineWidth=o.w||1.3;path(c,pts);c.stroke();c.restore();};

EFF.shipRipples=function(c,x,y,T,a=1,o={}){
 if(a<=0)return;const R=o.r||16,per=o.period||2.6,ph=(rng(o.seed||1)())*per;
 c.save();c.lineWidth=1.1;
 for(let i=0;i<3;i++){const u=(((T+ph)/per+i/3)%1+1)%1,rx=R*(.35+u*1.1),ry=rx*.32,al=a*(1-u)*ss(0,.12,u);
  c.strokeStyle=`rgba(235,246,255,${.85*al})`;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.stroke();
  if(!FILM()){c.strokeStyle=`rgba(21,17,13,${.35*al})`;c.beginPath();c.ellipse(x,y+1.2,rx,ry,0,.2,Math.PI-.2);c.stroke();}}
 c.restore();};

EFF.pin=function(c,x,y,r=24,a=1,o={}){
 if(a<=0)return;const s=o.s==null?1:o.s;if(s<=0)return;
 c.save();c.globalAlpha*=a;c.translate(x,y);c.scale(s,s);
 
 if(FILM()){const g=c.createRadialGradient(0,2,r*.6,0,2,r*1.35);g.addColorStop(0,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(-r*1.4,-r*1.4,r*2.8,r*2.8);
  c.fillStyle='rgba(16,13,10,.62)';c.beginPath();c.arc(0,0,r,0,7);c.fill();c.strokeStyle='rgba(217,173,95,.9)';c.lineWidth=1.6;c.stroke();
  c.strokeStyle='rgba(255,236,200,.18)';c.lineWidth=1;c.beginPath();c.arc(0,0,r-3.5,0,7);c.stroke();c.restore();return;}
 c.fillStyle='rgba(0,0,0,.30)';c.beginPath();c.arc(2.5,3.5,r,0,7);c.fill();
 c.fillStyle='#f6eedb';c.beginPath();c.arc(0,0,r,0,7);c.fill();
 c.strokeStyle=INK2;c.lineWidth=2.4;c.stroke();
 c.strokeStyle='rgba(21,17,13,.25)';c.lineWidth=1;c.beginPath();c.arc(0,0,r-4.5,0,7);c.stroke();
 c.restore();};
})();

(function(){
const EFF=window.EFF,L=EFF.L={};
const src=it=>typeof it.src==='function'?it.src():it.src;
L.loupe=(c,W,it)=>{const b=src(it);if(b)EFF.loupe(c,b,it.PL,it.x,it.y,it.R||54,it.k||1.8,it);};               
L.puffs=(c,W,it,T)=>EFF.puffs(c,it.x,it.y,T,it.period||.7,it.seed||5,it);                                     
L.trickle=(c,W,it,T)=>EFF.trickle(c,it.x,it.y,T,it.seed||9,it);                                              
L.inkSplat=(c,W,it)=>EFF.inkSplat(c,it.x,it.y,it.s||16,it.p,it.seed||3,it);                                    
L.stamp=(c,W,it)=>EFF.stamp(c,it.x,it.y,it.w,it.h,it.p,it.seed||4,it);                                       
L.iris=(c,W,it)=>EFF.iris(c,W,it.x,it.y,it.r,it.a,it);                                                       
L.lampFlicker=(c,W,it,T)=>EFF.lampFlicker(c,it.x,it.y,it.r||5,T,it.a);                                       
L.laurel=(c,W,it)=>EFF.laurel(c,it.x,it.y,it.r,it.p,it);                                                     
L.motes=(c,W,it,T)=>EFF.motes(c,it.x0,it.y0,it.x1,it.y1,T,it.seed||21,it.a,it);                              
L.orderArrow=(c,W,it)=>EFF.orderArrow(c,it.from,it.to,it.p,it);                                              
L.spearGlints=(c,W,it,T)=>EFF.spearGlints(c,it.tips,it.p,T,it);                                              
L.tint=(c,W,it)=>EFF.tint(c,W,it.rgb||'200,80,50',it.a);                                                     
L.gleam=(c,W,it)=>EFF.gleam(c,it.poly,it.p,it);                                                              
L.potteryArcs=(c,W,it,T)=>EFF.potteryArcs(c,it.x,it.y,it.rx,it.ry,T,it.a==null?1:it.a,it);                   
L.goldGlints=(c,W,it)=>EFF.goldGlints(c,it.pts,it.p,it);                                                     
L.wash=(c,W,it)=>EFF.wash(c,it.x,it.y,it.R||90,it.p,it.rgb,it.a==null?.25:it.a,it);                          
L.riverRipple=(c,W,it,T)=>EFF.riverRipple(c,it.pts,T,it.a,it);                                               
L.shipRipples=(c,W,it,T)=>{for(let i=0;i<it.ships.length;i++)EFF.shipRipples(c,it.ships[i][0],it.ships[i][1],T,it.a,{seed:i+1,r:it.r});};   
L.pin=(c,W,it)=>EFF.pin(c,it.x,it.y,it.r||21,it.a,it);                                                       

L.flock=(c,W,it,T)=>{let u=it.p;if(it.loop){const {period=24,dur=10,ph=0}=it.loop;u=((((T+ph)%period)+period)%period)/dur;}EFF.flock(c,it.path,u,T,it.list,it);};
L.smoke=(c,W,it,T)=>EFF.smoke(c,it.x,it.y,T,it);                                                             
L.glints=(c,W,it,T)=>EFF.glints(c,typeof it.pts==='function'?it.pts():it.pts,T,it.a==null?1:it.a,it);        

L.smith=(c,W,it)=>{const h=EFF.lastHit(it.t,it.hits||[]);if(h)EFF.sparksBurst(c,it.x,it.y,h.dt,{seed:41+h.i*7,a:it.a==null?1:it.a});};   
})();
