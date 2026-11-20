'use strict';
/* Effects package, part 3: the "epic" photo look. Load after effekty-film.js.
 * Pure 2D painters (no WebGL, so the "at most 2 patches in frame" budget stays free). An event is a layer field
 * (p, a, sw...) driven by the timeline; background life follows page time T (T=0 in reduced motion and ?still=1).
 * Light mode (window.kino.light): half the particles, no chromatic rings or ghosts. Reduced motion: particles
 * stand still, strikes become a soft light at the point.
 *
 *   EFF.hit(t,kind,{a,dur,w}) -> t                         register of hits for the sound mix (EFF.HITS)
 *   EFF.embers(c,x0,y0,x1,y1,T,a,{n,rgb,seed,vy,...})      embers and sparks rising, flickering   L.embers
 *   EFF.burst(c,x,y,dt,{n,seed,a,speed,grav,...})          a burst of sparks from a strike         L.burst
 *   EFF.billow(c,x0,y0,x1,y1,T,a,{n,rgb,vx,vy,...})        smoke or dust in billows                L.billow
 *   EFF.puffLine(c,x0,y0,x1,y1,dt,{...})                   dust knocked out of a line              L.puffLine
 *   EFF.impact(c,x,y,p,a,{r,rgb,ring,sparks,...})          a local strike: flash, shock ring, sparks L.impact
 *   EFF.burstRays(c,x,y,p,a,{n,len,rgb,...})               an explosion of light rays              L.burstRays
 *   EFF.blade / EFF.rift / EFF.sweep                       a blade of light, a glowing rift, a gleam sweep
 *   EFF.anaFlare(c,x,y,T,a,o)                              anamorphic flare                        L.anaFlare
 *   EFF.vortexDust / EFF.dissolve / EFF.petrify            sand vortex, crumble to dust, turn to stone
 *   EFF.gradeEpic(c,W,a,{teal,amber,vig,crush,...})        teal-and-amber grade                    L.gradeEpic
 *   EFF.smear(c,W,p,a,{dir,...})                           whip-pan smear across the frame         L.smear
 *   EFF.sparkles(c,pts,p,a,{r,win,rgb})                    sparkles running over points            L.sparkles
 *   EFF.gapCover(k,Wa,Wb,{feather,rgb,seed}) -> {p}        covers the board gap during a slide between windows
 *   EFF.epicText / L.epicTitle / L.epicWord                metal-gold titles and impact words
 *   EFF.epikEnv() -> {light,reduce}
 */

(function(){
const EFF=window.EFF=window.EFF||{};
EFF.HITS=[];
EFF.hit=(t,kind,o={})=>{EFF.HITS.push({t:+(+t).toFixed(3),kind,a:o.a==null?1:o.a,dur:o.dur||0,w:o.w||''});return t;};

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ss=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
function rng(seed){let s=(seed*2654435761)>>>0||1;return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const RED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const env=EFF.epikEnv=()=>({light:!!(window.kino&&window.kino.light),reduce:RED});
const fa=v=>(+v).toFixed(3);
const eo3=t=>1-Math.pow(1-clamp(t,0,1),3);

const SPR={};

function dot(rgb,core){const key=rgb+'|'+core;if(SPR[key])return SPR[key];const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
 const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,`rgba(${core},1)`);g.addColorStop(.12,`rgba(${core},.95)`);g.addColorStop(.28,`rgba(${rgb},.55)`);
 g.addColorStop(.6,`rgba(${rgb},.14)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,64,64);return SPR[key]=c;}

function puff(v,rgb){const key='puff'+v+'|'+rgb;if(SPR[key])return SPR[key];const S=128,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),r=rng(v*17+5);
 for(let i=0;i<26;i++){const a=r()*6.283,d=r()*.28*S,px=S/2+Math.cos(a)*d,py=S/2+Math.sin(a)*d*.8,R=S*(.12+r()*.2);
  const g=x.createRadialGradient(px,py,0,px,py,R);g.addColorStop(0,`rgba(${rgb},${fa(.16+r()*.12)})`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,S,S);}
 x.globalCompositeOperation='destination-in';const m=x.createRadialGradient(S/2,S/2,S*.2,S/2,S/2,S/2);m.addColorStop(0,'rgba(0,0,0,1)');m.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=m;x.fillRect(0,0,S,S);
 return SPR[key]=c;}
EFF.epikDot=dot;EFF.epikPuff=puff;

EFF.embers=function(c,x0,y0,x1,y1,T,a=1,o={}){
 if(!(a>.003))return;const lt=env().light,n=Math.round((o.n||50)*(lt?.5:1)),r=rng(o.seed||3),H=y1-y0,Wd=x1-x0,vy=o.vy==null?26:o.vy,wind=o.wind||0,sz=o.size||1.6,sw=o.sway==null?10:o.sway;
 const sOr=dot(o.rgb||'255,120,40','255,236,190'),sHot=dot('255,200,120','255,252,240');
 c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const bx=r()*Wd,by=r()*H,v=vy*(.6+.8*r()),ph=r()*6.283,fq=.4+r()*.9,s=sz*(.45+r()*1.1),hot=r()<(o.hot==null?.25:o.hot),fl=5+r()*9;
  const yy=((by-T*v)%H+H)%H,x=x0+((bx+T*wind+Math.sin(T*fq+ph)*sw+Math.sin(T*fq*2.7+ph*1.3)*sw*.35)%Wd+Wd)%Wd,y=y0+yy;
  const edge=Math.min(1,yy/(H*.18),(H-yy)/(H*.12)),A=a*edge*(.55+.45*Math.sin(T*fl+ph*3))*(hot?1:.85);if(A<=.01)continue;
  const R=s*(hot?3.2:2.6);c.globalAlpha=clamp(A,0,1);c.drawImage(hot?sHot:sOr,x-R,y-R,2*R,2*R);}
 c.restore();};

EFF.burst=function(c,x,y,dt,o={}){
 if(!(dt>=0))return;const life=o.life||1;if(dt>life*1.6)return;const lt=env().light,a=o.a==null?1:o.a;if(!(a>.003))return;
 if(env().reduce){const g=dot(o.rgb||'255,150,60','255,244,220'),A=a*(1-clamp(dt/life,0,1));if(A>.01){c.save();c.globalCompositeOperation='lighter';c.globalAlpha=A*.6;c.drawImage(g,x-14,y-14,28,28);c.restore();}return;}
 const n=Math.round((o.n||24)*(lt?.5:1)),r=rng(o.seed||7),sp=o.speed||150,g=o.grav==null?220:o.grav,ang=o.ang==null?-Math.PI/2:o.ang,spr=o.spread==null?Math.PI*.9:o.spread,rgb=o.rgb||'255,150,60',L=o.len==null?1:o.len;
 const sDot=dot(rgb,'255,246,220');c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 for(let i=0;i<n;i++){const an=ang+(r()-.5)*spr*2,v=sp*(.35+r()*.9),lf=life*(.45+r()*.8),k=2.6,t=Math.min(dt,lf);if(dt>lf)continue;
  const d=v*(1-Math.exp(-k*t))/k,vx=Math.cos(an),vy=Math.sin(an),px=x+vx*d,py=y+vy*d+.5*g*t*t*.5;
  const vv=v*Math.exp(-k*t),tx=vx*vv,ty=vy*vv+g*t*.5,tl=Math.hypot(tx,ty)||1,len=clamp(tl*.035*L,1,9);
  const A=a*(1-t/lf)*(i%3?1:.8);c.globalAlpha=clamp(A,0,1);
  c.strokeStyle=t/lf<.3?'rgba(255,248,225,1)':`rgba(${rgb},1)`;c.lineWidth=.9+(i%2)*.5;c.beginPath();c.moveTo(px,py);c.lineTo(px-tx/tl*len,py-ty/tl*len);c.stroke();
  c.drawImage(sDot,px-3,py-3,6,6);}
 c.restore();};

EFF.billow=function(c,x0,y0,x1,y1,T,a=1,o={}){
 if(!(a>.003))return;const lt=env().light,n=Math.round((o.n||10)*(lt?.5:1)),r=rng(o.seed||4),Wd=x1-x0,H=y1-y0,vx=o.vx==null?6:o.vx,vy=o.vy==null?-2:o.vy,S=o.scale||120,rgb=o.rgb||'200,196,190';
 c.save();c.globalCompositeOperation=o.comp||'source-over';
 for(let i=0;i<n;i++){const sp=puff(i%3,rgb),bx=r()*Wd,by=r()*H,ph=r()*6.283,s=S*(.6+r()*.8),k=.75+r()*.5,rot=r()*6.283,rs=(r()-.5)*.08;
  const px=((bx+T*vx*k)%(Wd+s)+(Wd+s))%(Wd+s)-s/2,py=((by+T*vy*k)%(H+s*.6)+(H+s*.6))%(H+s*.6)-s*.3;
  const e=Math.min(1,(px+s/2)/(s*.8),(Wd+s/2-px)/(s*.8),(py+s*.3)/(s*.5),(H+s*.3-py)/(s*.5));if(e<=0)continue;
  const g=1+(o.grow==null?.15:o.grow)*Math.sin(T*.13+ph),R=s*g;c.globalAlpha=clamp(a*e*(.7+.3*Math.sin(T*.21+ph)),0,1);
  c.save();c.translate(x0+px,y0+py);c.rotate(rot+T*rs);c.drawImage(sp,-R/2,-R/2,R,R);c.restore();}
 c.restore();};

EFF.puffLine=function(c,x0,y0,x1,y1,dt,o={}){
 if(!(dt>=0))return;const life=o.life||1.6;if(dt>life)return;const a=o.a==null?1:o.a;if(!(a>.003))return;
 const lt=env().light,n=Math.round((o.n||16)*(lt?.5:1)),r=rng(o.seed||9),dist=o.dist||40,S=o.size||22,rgb=o.rgb||'196,188,176',L=Math.hypot(x1-x0,y1-y0)||1,nx=-(y1-y0)/L,ny=(x1-x0)/L;
 const red=env().reduce;c.save();c.globalCompositeOperation=o.comp||'source-over';
 for(let i=0;i<n;i++){const u=r(),side=o.dir?Math.sign(o.dir):(r()<.5?-1:1),dd=dist*(.4+r()*.9),lf=life*(.6+r()*.4),t=red?0:Math.min(dt,lf),e=1-Math.exp(-3.2*t/lf*2);
  if(dt>lf)continue;const bx=lerp(x0,x1,u),by=lerp(y0,y1,u),px=bx+nx*side*dd*e+(r()-.5)*8*e,py=by+ny*side*dd*e-6*e*r();
  const R=S*(.6+r()*.6)*(1+1.6*e),A=a*(red?.4*(1-dt/life):Math.sin(Math.PI*Math.min(1,t/lf*1.15))*(1-t/lf*.4));if(A<=.01)continue;
  c.globalAlpha=clamp(A*.8,0,1);c.drawImage(puff(i%3,rgb),px-R/2,py-R/2,R,R);}
 c.restore();};

EFF.impact=function(c,x,y,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1))return;const lt=env().light,red=env().reduce,R=o.r||110,rgb=o.rgb||'255,196,120',core=o.core||'255,250,236',dur=o.dur||1.1;
 c.save();c.globalCompositeOperation='lighter';

 const fl=Math.pow(1-ss(0,.3,p),2)*ss(0,.03,p);
 if(fl>.003){const Rf=R*.6,g=c.createRadialGradient(x,y,0,x,y,Rf);g.addColorStop(0,`rgba(${core},${fa(.85*fl*a)})`);g.addColorStop(.12,`rgba(${core},${fa(.5*fl*a)})`);
  g.addColorStop(.35,`rgba(${rgb},${fa(.22*fl*a)})`);g.addColorStop(.7,`rgba(${rgb},${fa(.06*fl*a)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-Rf,y-Rf,2*Rf,2*Rf);

  c.save();c.translate(x,y);c.scale(1,.04);const h=c.createRadialGradient(0,0,0,0,0,R*1.3);h.addColorStop(0,`rgba(${core},${fa(.6*fl*a)})`);h.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=h;c.fillRect(-R*1.3,-R*1.3,R*2.6,R*2.6);c.restore();}
 if(!red){const q=eo3(p/.65),rr=R*(.08+.92*q),w=R*(.03+.16*Math.pow(1-q,1.4)),A=a*(1-ss(.25,.75,p))*ss(0,.04,p);

  const ann=(rad,col,al,ww)=>{if(al<=.003)return;const r0=Math.max(0,rad-ww),r1=rad+ww*.7,g=c.createRadialGradient(x,y,r0,x,y,r1),m=(rad-r0)/(r1-r0);
   g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(m,`rgba(${col},${fa(al)})`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.beginPath();c.arc(x,y,r1,0,7);c.arc(x,y,r0,0,7,true);c.fill();};
  const rk=o.ring==null?1:o.ring;ann(rr,rgb,.34*A*rk,w);ann(rr,core,.3*A*rk,w*.35);
  if(!lt&&(o.chroma==null?1:o.chroma)>0){const ch=(o.chroma==null?1:o.chroma)*R*.04*(1-q*.5);ann(rr+ch,'255,80,60',.16*A*rk,w*.6);ann(rr-ch,'80,190,255',.16*A*rk,w*.6);}

  if(A>.003){const g=c.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,`rgba(${rgb},${fa(.05*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-rr,y-rr,2*rr,2*rr);}
  if(o.sparks&&EFF.burst){c.restore();EFF.burst(c,x,y,p*dur,{n:o.n||22,seed:o.seed||11,a,speed:R*1.6,spread:Math.PI,ang:-Math.PI/2,grav:R*1.2,life:dur*.8,rgb:o.srgb||'255,170,80'});return;}}
 c.restore();};

EFF.burstRays=function(c,x,y,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1))return;const lt=env().light,n=lt?Math.min(8,o.n||14):(o.n||14),r=rng(o.seed||5),L=o.len||320,rgb=o.rgb||'255,206,130',core=o.core||'255,248,230',T=env().reduce?0:(o.T||0);
 const grow=eo3(p/.3),fade=1-ss(.35,1,p),A=a*fade;if(A<=.003)return;
 c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const an=i/n*6.283+r()*.3+T*.05,len=L*grow*(.55+.6*r()),w=(o.w||10)*(.5+r()),ca=Math.cos(an),sa=Math.sin(an);
  const g=c.createLinearGradient(x,y,x+ca*len,y+sa*len);g.addColorStop(0,`rgba(${core},${fa(.5*A)})`);g.addColorStop(.3,`rgba(${rgb},${fa(.22*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g;c.beginPath();c.moveTo(x-sa*w*.15,y+ca*w*.15);c.lineTo(x+ca*len-sa*w,y+sa*len+ca*w);c.lineTo(x+ca*len+sa*w,y+sa*len-ca*w);c.lineTo(x+sa*w*.15,y-ca*w*.15);c.closePath();c.fill();}
 const g=c.createRadialGradient(x,y,0,x,y,L*.35);g.addColorStop(0,`rgba(${core},${fa(.85*A)})`);g.addColorStop(.3,`rgba(${rgb},${fa(.35*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-L*.35,y-L*.35,L*.7,L*.7);
 c.restore();};

EFF.blade=function(c,x0,y0,x1,y1,w0,w1,a=1,o={}){
 if(!(a>.003))return;const rgb=o.rgb||'255,196,120',core=o.core||'255,248,230',gl=o.glow==null?14:o.glow,L=Math.hypot(x1-x0,y1-y0)||1,nx=-(y1-y0)/L,ny=(x1-x0)/L;
 c.save();c.globalCompositeOperation='lighter';
 const quad=(k,col,al)=>{c.fillStyle=`rgba(${col},${fa(al)})`;c.beginPath();c.moveTo(x0+nx*w0*k,y0+ny*w0*k);c.lineTo(x1+nx*w1*k,y1+ny*w1*k);c.lineTo(x1-nx*w1*k,y1-ny*w1*k);c.lineTo(x0-nx*w0*k,y0-ny*w0*k);c.closePath();c.fill();};
 if(gl>0){const mx=(x0+x1)/2,my=(y0+y1)/2;c.save();c.translate(mx,my);c.rotate(Math.atan2(y1-y0,x1-x0));c.scale(1,(gl+Math.max(w0,w1))/(L/2));
  const g=c.createRadialGradient(0,0,0,0,0,L/2);g.addColorStop(0,`rgba(${rgb},${fa(.35*a)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(-L/2,-L/2,L,L);c.restore();}
 quad(.5,rgb,.55*a);quad(.22,core,.9*a);
 c.restore();};

EFF.rift=function(c,x0,y0,x1,y1,T,a=1,o={}){
 if(!(a>.003))return;const lt=env().light,w=o.w||4,rgb=o.rgb||'255,190,110',core=o.core||'255,250,236',L=Math.hypot(x1-x0,y1-y0)||1,nx=-(y1-y0)/L,ny=(x1-x0)/L,jag=o.jag==null?7:o.jag;
 const n=o.n||Math.max(6,Math.round(L/16)),step=Math.floor(T*9),sd=(o.seed||1)*97,pts=[];
 for(let i=0;i<=n;i++){const u=i/n,e=Math.sin(Math.PI*u),r1=rng(sd+i*13+step*7)(),r0=rng(sd+i*13)(),off=(r0-.5)*jag*2*e+(r1-.5)*jag*.5*e;pts.push([lerp(x0,x1,u)+nx*off,lerp(y0,y1,u)+ny*off]);}
 const fl=.85+.15*Math.sin(T*23+sd)*Math.sin(T*7.3);
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
 const path=()=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));};
 path();c.strokeStyle=`rgba(${rgb},${fa(.16*a*fl)})`;c.lineWidth=w*5;c.stroke();
 c.strokeStyle=`rgba(${rgb},${fa(.5*a*fl)})`;c.lineWidth=w*1.6;c.stroke();
 c.strokeStyle=`rgba(${core},${fa(.95*a*fl)})`;c.lineWidth=Math.max(.7,w*.45);c.stroke();
 if((o.sparks||0)>0&&!lt){const sp=dot(rgb,core),r=rng(sd+3),m=Math.round(10*o.sparks);for(let i=0;i<m;i++){const per=.7+r()*.9,ph=r()*per,u=r(),t=(((T+ph)%per)+per)%per/per;
   const j=Math.min(n-1,Math.floor(u*n)),[px,py]=pts[j],dir=r()<.5?-1:1,d=t*(10+r()*22),A=a*(1-t)*.9;c.globalAlpha=A;c.drawImage(sp,px+nx*dir*d-2.5,py+ny*dir*d-2.5+t*6,5,5);}}
 c.restore();};

EFF.sweep=function(c,x,y,w,h,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1))return;const ang=o.ang==null?.45:o.ang,bw=(o.width||.22)*w,rgb=o.rgb||'255,236,196',cx=x-w/2-bw+p*(w+2*bw);
 c.save();if(o.clip){c.beginPath();o.clip.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();}else{c.beginPath();c.rect(x-w/2,y-h/2,w,h);c.clip();}
 c.globalCompositeOperation='lighter';c.translate(cx,y);c.rotate(ang);
 const g=c.createLinearGradient(-bw,0,bw,0);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.5,`rgba(${rgb},${fa(.55*a*Math.sin(Math.PI*p))})`);g.addColorStop(1,`rgba(${rgb},0)`);
 c.fillStyle=g;c.fillRect(-bw,-h*1.5,2*bw,h*3);c.restore();};

EFF.anaFlare=function(c,x,y,T,a=1,o={}){if(!EFF.flare||!(a>.003))return;
 EFF.flare(c,x,y,T,a*.8,Object.assign({len:260,thin:.03,ghosts:3,gs:1,breath:.07,rgb:'255,186,110',core:'255,248,232'},o,{ghosts:0}));
 EFF.flare(c,x,y,T,a*.55,Object.assign({len:(o.len||260)*1.6,thin:.012,breath:.05,rgb:'110,190,255',core:'225,245,255',ghosts:o.ghosts==null?3:o.ghosts,gs:1.1,to:o.to},o.blue||{}));};

EFF.vortexDust=function(c,cx,cy,rx,ry,ph,a=1,o={}){
 if(!(a>.003))return;const lt=env().light,red=env().reduce,n=Math.round((o.n||90)*(lt?.5:1)),r=rng(o.seed||13),rgb=o.rgb||'255,206,120',turns=o.turns||1.6,dir=o.dir||-1,sz=o.size||1.4;
 const sp=dot(rgb,'255,250,230');c.save();c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const ph0=r(),sp0=.6+r()*.8,a0=r()*6.283,rr0=.25+r()*.85,s=sz*(.5+r());
  const u=red?ph0:((ph*sp0+ph0)%1+1)%1,rad=rr0*(1-u)*(o.inward||1)+.03,an=a0+dir*u*turns*6.283;
  const x=cx+Math.cos(an)*rx*rad,y=cy+Math.sin(an)*ry*rad,A=a*Math.sin(Math.PI*u)*(.6+.4*Math.sin(i*1.7+ph*20));if(A<=.01)continue;
  const R=s*2.6*(.6+.4*(1-u));c.globalAlpha=clamp(A,0,1);c.drawImage(sp,x-R,y-R,2*R,2*R);}
 c.restore();};

const DSC=new Map();
function dsPts(src,rect,n,seed){const key=rect.join(',')+'|'+n+'|'+seed;let m=DSC.get(src);if(!m){m={};DSC.set(src,m);}if(m[key])return m[key];
 try{const sw=src.width,sh=src.height,[a,b,cc,d]=rect,w=Math.max(8,Math.round(64*(cc-a)/Math.max(cc-a,d-b))),h=Math.max(8,Math.round(64*(d-b)/Math.max(cc-a,d-b)));
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(src,a*sw,b*sh,(cc-a)*sw,(d-b)*sh,0,0,w,h);
  const D=x.getImageData(0,0,w,h).data,r=rng(seed),out=[];
  for(let k=0;k<n*30&&out.length<n;k++){const px=Math.floor(r()*w),py=Math.floor(r()*h),i=(py*w+px)*4,L=D[i]*.3+D[i+1]*.59+D[i+2]*.11;if(L<28)continue;
   out.push({u:(px+.5)/w,v:(py+.5)/h,rgb:`${D[i]},${D[i+1]},${D[i+2]}`,d:r(),s:.6+r()*.9,an:r()*6.283});}
  return m[key]=out;}catch(e){return m[key]=[];}}

EFF.dissolve=function(c,src,rect,PL,p,o={}){
 if(!src||!(p>0)||!(p<1.0001))return;const a=o.a==null?1:o.a;if(!(a>.003))return;const lt=env().light,red=env().reduce,n=Math.round((o.n||200)*(lt?.5:1));
 const P=dsPts(src,rect,n,o.seed||3);if(!P.length)return;const [r0,r1,r2,r3]=rect,to=o.to,sw=o.swirl||0,up=o.up==null?60:o.up,S=o.size||1.6;
 const SP=dot('255,196,120','255,244,214');c.save();c.globalCompositeOperation='source-over';
 for(const q of P){const st=q.d*.55,t=clamp((p-st)/.45,0,1);if(t<=0||t>=1)continue;
  const x0=PL.x+(r0+q.u*(r2-r0))*PL.w,y0=PL.y+(r1+q.v*(r3-r1))*PL.h;let x,y;const e=red?0:t*t*(3-2*t);
  if(to){const dx=x0-to[0],dy=y0-to[1],rad=Math.hypot(dx,dy)*(1-e),an=Math.atan2(dy,dx)+e*sw*6.283;x=to[0]+Math.cos(an)*rad;y=to[1]+Math.sin(an)*rad;}
  else{x=x0+Math.sin(q.an)*18*e;y=y0-up*e;}
  const A=a*(red?1-t:Math.min(1,t*6)*(1-ss(.55,1,t)));if(A<=.01)continue;const R=S*q.s*(1-.5*e);
  c.globalAlpha=A;c.fillStyle=`rgb(${q.rgb})`;if(R>1.3){c.beginPath();c.arc(x,y,R*.55,0,7);c.fill();}else c.fillRect(x-R/2,y-R/2,R,R);
  if(t>.15&&!lt){c.globalCompositeOperation='lighter';c.globalAlpha=A*.4;c.drawImage(SP,x-R*1.4,y-R*1.4,R*2.8,R*2.8);c.globalCompositeOperation='source-over';}}
 c.restore();};

EFF.petrify=function(c,W,cx,cy,rx,ry,k,a=1,o={}){
 if(!(a>.003)||!(k>.003))return;const R=Math.hypot(Math.max(cx,W.w-cx)/rx,Math.max(cy,W.h-cy)/ry),f=lerp(R+.3,1,clamp(k,0,1));
 c.save();c.translate(cx,cy);c.scale(rx,ry);
 const grad=(stops)=>{const g=c.createRadialGradient(0,0,0,0,0,R+.4);for(const [s,col] of stops)g.addColorStop(clamp(s/(R+.4),0,1),col);return g;};
 c.globalCompositeOperation='saturation';c.fillStyle=grad([[Math.max(0,f-.55),'rgba(128,128,128,0)'],[f,`rgba(128,128,128,${fa(.95*a)})`],[R+.4,`rgba(128,128,128,${fa(a)})`]]);c.fillRect(-R-1,-R-1,2*R+2,2*R+2);
 c.globalCompositeOperation='multiply';c.fillStyle=grad([[Math.max(0,f-.4),'rgba(255,255,255,0)'],[f+.25,`rgba(176,186,196,${fa(.62*a)})`],[R+.4,`rgba(132,142,152,${fa(.75*a)})`]]);c.fillRect(-R-1,-R-1,2*R+2,2*R+2);
 c.restore();
 const ash=o.ash==null?1:o.ash;if(ash>0&&!env().light){const T=o.T||0,r=rng(o.seed||17),n=80,sp=dot('190,190,186','236,234,228');c.save();
  for(let i=0;i<n;i++){const an=r()*6.283,sp0=.25+r()*.4,ph=r(),u=env().reduce?ph:((T*sp0+ph)%1+1)%1,ca=Math.cos(an),sa=Math.sin(an);
   const d0=f*(1+.05*r()),d=d0+u*.9,x=cx+ca*rx*d+Math.sin(T*1.3+i)*4,y=cy+sa*ry*d+u*30;if(x<-10||x>W.w+10||y<-10||y>W.h+10)continue;
   const A=a*ash*Math.sin(Math.PI*u)*.9*ss(.05,.3,k),s=1.4+r()*2.8;c.globalAlpha=A;c.drawImage(sp,x-s,y-s,2*s,2*s);}c.restore();}};

EFF.gradeEpic=function(c,W,a=1,o={}){
 if(!(a>.003))return;const teal=o.teal||'18,86,104',amber=o.amber||'255,168,84',v=o.vig==null?.5:o.vig;
 c.save();
 c.globalCompositeOperation='soft-light';c.fillStyle=`rgba(${teal},${fa(clamp(a*.75,0,1))})`;c.fillRect(-40,-40,W.w+80,W.h+80);
 c.globalCompositeOperation='overlay';c.fillStyle=`rgba(${amber},${fa(clamp(a*.22,0,1))})`;c.fillRect(-40,-40,W.w+80,W.h+80);
 if(o.crush){c.globalCompositeOperation='multiply';c.fillStyle=`rgba(${Math.round(255-60*o.crush)},${Math.round(255-50*o.crush)},${Math.round(255-46*o.crush)},${fa(a)})`;c.fillRect(-40,-40,W.w+80,W.h+80);}
 if(v>0&&!env().light){c.globalCompositeOperation='multiply';const cx=o.cx==null?W.w/2:o.cx,cy=o.cy==null?W.h*.45:o.cy,R=Math.hypot(W.w,W.h)*.6,g=c.createRadialGradient(cx,cy,R*.42,cx,cy,R);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,`rgba(10,26,32,${fa(clamp(v*a,0,1))})`);c.fillStyle=g;c.fillRect(-40,-40,W.w+80,W.h+80);}
 c.restore();};

EFF.smear=function(c,W,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1))return;
 if(o.vert){c.save();c.translate(W.w/2,W.h/2);c.rotate(Math.PI/2);c.translate(-W.h/2,-W.w/2);EFF.smear(c,{w:W.h,h:W.w},p,a,Object.assign({},o,{vert:false}));c.restore();return;}
 const lt=env().light,n=Math.round((o.n||26)*(lt?.5:1)),r=rng(o.seed||21),dir=o.dir||1,rgb=o.rgb||'255,226,180',A=a*Math.sin(Math.PI*p);
 c.save();
 if(o.fill){c.fillStyle=`rgba(3,6,8,${fa(clamp(o.fill*Math.pow(Math.sin(Math.PI*p),.7),0,1))})`;c.fillRect(-40,-40,W.w+80,W.h+80);}
 if(o.dark!==0){const d=o.dark==null?.55:o.dark,x=lerp(-.4,1.4,dir>0?1-p:p)*W.w,g=c.createLinearGradient(x-W.w*.45,0,x+W.w*.45,0);
  g.addColorStop(0,'rgba(4,8,10,0)');g.addColorStop(.5,`rgba(4,8,10,${fa(d*A)})`);g.addColorStop(1,'rgba(4,8,10,0)');c.fillStyle=g;c.fillRect(-40,-40,W.w+80,W.h+80);}
 c.globalCompositeOperation='lighter';
 for(let i=0;i<n;i++){const y=r()*W.h,len=W.w*(.15+r()*.45),sp=1.2+r()*1.4,ph=r(),u=(p*sp+ph)%1.6-.3,x=(dir>0?1-u:u)*W.w,th=.4+r()*1.6;
  const g=c.createLinearGradient(x-len/2,0,x+len/2,0);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.5,`rgba(${rgb},${fa(.5*A*(.4+.6*r()))})`);g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g;c.fillRect(x-len/2,y-th/2,len,th);}
 c.restore();};

const TX=new Map();
const FONT_T=()=>(window.KINO&&window.KINO.epikFont)||"700 X 'Cormorant SC', 'Forum', serif";
function metal(x,y0,y1){const g=x.createLinearGradient(0,y0,0,y1);
 g.addColorStop(0,'#fff8e2');g.addColorStop(.22,'#ffe2a0');g.addColorStop(.46,'#e2a548');g.addColorStop(.5,'#7a4a17');g.addColorStop(.56,'#a8702c');g.addColorStop(.8,'#f0c56e');g.addColorStop(1,'#fff0c4');return g;}
function lineRaster(t,f,ls,s,font){const fs=f*s,fnt=font.replace('X',fs.toFixed(1)+'px'),key=[t,f,ls,s.toFixed(2),font].join('|');if(TX.has(key))return TX.get(key);
 const ok=!document.fonts||document.fonts.check(fnt,t);
 const m=document.createElement('canvas').getContext('2d');m.font=fnt;if('letterSpacing' in m)m.letterSpacing=(fs*ls).toFixed(2)+'px';
 const tw=Math.ceil(m.measureText(t).width),pad=Math.ceil(fs*.6),cw=tw+2*pad,ch=Math.ceil(fs*1.5+2*pad);
 const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const x=cv.getContext('2d');x.font=fnt;if('letterSpacing' in x)x.letterSpacing=(fs*ls).toFixed(2)+'px';
 x.textBaseline='middle';x.textAlign='left';const bx=pad,by=ch/2,top=by-fs*.42,bot=by+fs*.42;
 x.save();x.shadowColor='rgba(0,0,0,.85)';x.shadowBlur=fs*.22;x.shadowOffsetY=fs*.05;x.fillStyle='rgba(20,12,4,.9)';x.fillText(t,bx,by);x.restore();
 x.lineJoin='round';x.strokeStyle='rgba(46,26,8,.95)';x.lineWidth=Math.max(1,fs*.06);x.strokeText(t,bx,by);
 x.fillStyle=metal(x,top,bot);x.fillText(t,bx,by);
 x.save();x.globalCompositeOperation='source-atop';x.strokeStyle='rgba(255,252,236,.55)';x.lineWidth=Math.max(.6,fs*.018);x.translate(0,-fs*.018);x.strokeText(t,bx,by);x.restore();
 const r={cv,w:cw,h:ch,pad,tw,s};if(ok)TX.set(key,r);return r;}

EFF.epicText=function(c,x,y,lines,o={}){
 const px=o.px||2,sb=Math.pow(1.15,Math.round(Math.log(Math.max(.2,px))/Math.log(1.15))),font=o.font||FONT_T(),lt=env().light;
 const R=lines.map(L=>lineRaster(L.t,L.f,L.ls||0,sb,L.font||font)),gaps=lines.map(L=>(L.gap==null?.18:L.gap)*L.f);
 let H=0;lines.forEach((L,i)=>{H+=L.f*1.05+(i?gaps[i]:0);});let yy=y-H/2;
 lines.forEach((L,i)=>{const r=R[i],cy=yy+(i?gaps[i]:0)+L.f*.525;yy=cy+L.f*.525;const w=r.w/sb,h=r.h/sb,x0=x-w/2,y0=cy-h/2;
  if(o.glow>0){c.save();c.globalCompositeOperation='lighter';const g=c.createRadialGradient(x,cy,0,x,cy,w*.55);g.addColorStop(0,`rgba(255,170,70,${fa(.22*o.glow)})`);g.addColorStop(1,'rgba(255,170,70,0)');
   c.save();c.translate(x,cy);c.scale(1,L.f*1.4/(w*.55));c.translate(-x,-cy);c.fillStyle=g;c.fillRect(x-w*.55,cy-w*.55,w*1.1,w*1.1);c.restore();c.restore();}
  const imp=o.imp||0;
  if(imp>0&&imp<1&&!lt){const d=L.f*.07*(1-imp),A=.55*(1-imp);c.save();c.globalCompositeOperation='lighter';c.globalAlpha*=A;
   c.drawImage(tinted(r,'255,60,40'),x0-d,y0,w,h);c.drawImage(tinted(r,'40,190,255'),x0+d,y0,w,h);c.restore();}
  c.drawImage(r.cv,x0,y0,w,h);
  if(o.sw>0&&o.sw<1){const sh=shine(r,o.sw);c.save();c.globalCompositeOperation='lighter';c.drawImage(sh,0,0,r.w,r.h,x0,y0,w,h);c.restore();}});
 return H;};

const TINT=new WeakMap();
function tinted(r,rgb){let m=TINT.get(r.cv);if(!m){m={};TINT.set(r.cv,m);}if(m[rgb])return m[rgb];const cv=document.createElement('canvas');cv.width=r.w;cv.height=r.h;const x=cv.getContext('2d');
 x.drawImage(r.cv,0,0);x.globalCompositeOperation='source-in';x.fillStyle=`rgb(${rgb})`;x.fillRect(0,0,r.w,r.h);return m[rgb]=cv;}

const SH=document.createElement('canvas'),SX=SH.getContext('2d');
function shine(r,p){if(SH.width<r.w||SH.height<r.h){SH.width=Math.max(SH.width,r.w);SH.height=Math.max(SH.height,r.h);}
 SX.setTransform(1,0,0,1,0,0);SX.globalCompositeOperation='source-over';SX.globalAlpha=1;SX.clearRect(0,0,r.w,r.h);
 const bw=r.h*1.15,cx=lerp(-bw,r.w+bw,p);SX.save();SX.translate(cx,r.h/2);SX.rotate(.38);
 const g=SX.createLinearGradient(-bw*.5,0,bw*.5,0);g.addColorStop(0,'rgba(255,240,205,0)');g.addColorStop(.35,'rgba(255,244,215,.35)');g.addColorStop(.5,'rgba(255,250,232,.78)');g.addColorStop(.65,'rgba(255,244,215,.35)');g.addColorStop(1,'rgba(255,240,205,0)');
 SX.fillStyle=g;SX.fillRect(-bw*.5,-r.h*1.5,bw,r.h*3);SX.restore();
 SX.globalCompositeOperation='destination-in';SX.drawImage(r.cv,0,0);SX.globalCompositeOperation='source-over';return SH;}

EFF.sparkles=function(c,pts,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1)||!pts||!pts.length)return;const n=pts.length,r=o.r||6,win=o.win||1.8/n,rgb=o.rgb||'255,214,140',core='255,252,236',sp=dot(rgb,core);
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 for(let i=0;i<n;i++){const d=Math.abs(p-(i+.5)/n)/win;if(d>=1)continue;const k=Math.pow(Math.cos(d*Math.PI/2),2)*a,[x,y]=pts[i],R=r*(.55+.45*k);
  c.globalAlpha=k*.9;c.drawImage(sp,x-R*.7,y-R*.7,R*1.4,R*1.4);
  c.save();c.translate(x,y);c.rotate(.35+i*.4);for(const [L,w] of [[R*1.6,.7],[R*.9,.5]]){const g=c.createLinearGradient(-L,0,L,0);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.5,`rgba(${core},${fa(k)})`);g.addColorStop(1,`rgba(${rgb},0)`);
   c.strokeStyle=g;c.lineWidth=w;c.globalAlpha=1;c.beginPath();c.moveTo(-L,0);c.lineTo(L,0);c.stroke();c.rotate(Math.PI/2);}c.restore();}
 c.restore();};

EFF.gapCover=function(k,Wa,Wb,o={}){const st={p:0,a:o.a==null?1:o.a};const ft=o.feather==null?28:o.feather,rgb=o.rgb||'255,220,170';
 k.over.push(ctx=>{const p=st.p;if(!(p>0)||!(p<1)||k.free)return;
  const vert=Math.abs(Wa.x-Wb.x)<Math.abs(Wa.y-Wb.y),[A,B]=vert?(Wa.y<Wb.y?[Wa,Wb]:[Wb,Wa]):(Wa.x<Wb.x?[Wa,Wb]:[Wb,Wa]);
  const K=Math.min(.97,1.9*Math.sin(Math.PI*p))*st.a;if(K<=.003)return;
  ctx.save();
  if(vert){const x0=Math.min(A.x,B.x)-60,x1=Math.max(A.x+A.w,B.x+B.w)+60,e0=A.y+A.h,e1=B.y,y0=e0-ft,y1=e1+ft,g=ctx.createLinearGradient(0,y0,0,y1),f=ft/(y1-y0);
   g.addColorStop(0,'rgba(4,8,10,0)');g.addColorStop(f,`rgba(4,8,10,${fa(K)})`);g.addColorStop(1-f,`rgba(4,8,10,${fa(K)})`);g.addColorStop(1,'rgba(4,8,10,0)');
   ctx.fillStyle=g;ctx.fillRect(x0,y0,x1-x0,y1-y0);ctx.translate(x0,y0);EFF.smear(ctx,{w:x1-x0,h:y1-y0},p,K*.8,{vert:true,dark:0,n:22,rgb,seed:o.seed||5});}
  else{const y0=Math.min(A.y,B.y)-60,y1=Math.max(A.y+A.h,B.y+B.h)+60,e0=A.x+A.w,e1=B.x,x0=e0-ft,x1=e1+ft,g=ctx.createLinearGradient(x0,0,x1,0),f=ft/(x1-x0);
   g.addColorStop(0,'rgba(4,8,10,0)');g.addColorStop(f,`rgba(4,8,10,${fa(K)})`);g.addColorStop(1-f,`rgba(4,8,10,${fa(K)})`);g.addColorStop(1,'rgba(4,8,10,0)');
   ctx.fillStyle=g;ctx.fillRect(x0,y0,x1-x0,y1-y0);ctx.translate(x0,y0);EFF.smear(ctx,{w:x1-x0,h:y1-y0},p,K*.8,{dark:0,n:22,rgb,seed:o.seed||5});}
  ctx.restore();});
 return st;};

const L=EFF.L=EFF.L||{};
L.embers=(c,W,it,T)=>EFF.embers(c,it.x0==null?0:it.x0,it.y0==null?0:it.y0,it.x1==null?W.w:it.x1,it.y1==null?W.h:it.y1,T,it.a==null?1:it.a,it);
L.burst=(c,W,it)=>{if(it.p>0&&it.p<1)EFF.burst(c,it.x,it.y,it.p*(it.dur||1),it);};
L.billow=(c,W,it,T)=>EFF.billow(c,it.x0==null?-40:it.x0,it.y0==null?-40:it.y0,it.x1==null?W.w+40:it.x1,it.y1==null?W.h+40:it.y1,T,it.a==null?1:it.a,it);
L.puffLine=(c,W,it)=>{if(it.p>0&&it.p<1)EFF.puffLine(c,it.x0,it.y0,it.x1,it.y1,it.p*(it.dur||1.6),Object.assign({},it,{life:it.dur||1.6}));};
L.impact=(c,W,it)=>EFF.impact(c,it.x,it.y,it.p,it.a==null?1:it.a,it);
L.burstRays=(c,W,it,T)=>EFF.burstRays(c,it.x,it.y,it.p,it.a==null?1:it.a,Object.assign({T},it));
L.blade=(c,W,it)=>EFF.blade(c,it.x0,it.y0,it.x1,it.y1,it.w0,it.w1,it.a==null?1:it.a,it);
L.rift=(c,W,it,T)=>EFF.rift(c,it.x0,it.y0,it.x1,it.y1,T,it.a==null?1:it.a,it);
L.sweep=(c,W,it)=>EFF.sweep(c,it.x,it.y,it.w,it.h,it.p,it.a==null?1:it.a,it);
L.anaFlare=(c,W,it,T)=>EFF.anaFlare(c,it.x,it.y,T,it.a==null?1:it.a,it);
L.vortexDust=(c,W,it)=>EFF.vortexDust(c,it.cx,it.cy,it.rx,it.ry,it.ph||0,it.a==null?1:it.a,it);
L.dissolve=(c,W,it)=>{const s=typeof it.src==='function'?it.src():it.src;if(s)EFF.dissolve(c,s,it.rect,it.PL,it.p,it);};
L.petrify=(c,W,it,T)=>EFF.petrify(c,W,it.cx,it.cy,it.rx,it.ry,it.k,it.a==null?1:it.a,Object.assign({T},it));
L.gradeEpic=(c,W,it)=>EFF.gradeEpic(c,W,it.a==null?1:it.a,it);
L.smear=(c,W,it)=>EFF.smear(c,W,it.p,it.a==null?1:it.a,it);
L.sparkles=(c,W,it)=>EFF.sparkles(c,typeof it.pts==='function'?it.pts():it.pts,it.p,it.a==null?1:it.a,it);

L.epicTitle=(c,W,it,T,px)=>{if(!(it.p>.003))return;const e=eo3(it.p/.4),k=(it.s||1)*(1+.3*Math.pow(1-e,2));
 c.save();c.globalAlpha*=Math.min(1,it.p/.25);c.translate(it.x,it.y);c.scale(k,k);EFF.epicText(c,0,0,it.lines,{px:(px||2)*k,sw:it.sw,imp:it.imp,glow:it.glow==null?1:it.glow,font:it.font});c.restore();};

L.epicWord=(c,W,it,T,px)=>{if(!(it.p>.003))return;const u=clamp(it.p/.45,0,1),k=1+.9*Math.pow(1-u,2.2),imp=it.imp!=null?it.imp:(it.p>.45?clamp((it.p-.45)/.4,0,1):0);
 c.save();c.globalAlpha*=Math.min(1,u*2.2);c.translate(it.x,it.y);c.scale(k,k);
 EFF.epicText(c,0,0,[{t:it.word,f:it.f||36,ls:it.ls==null?.06:it.ls}],{px:(px||2)*k,sw:it.sw,imp:imp>0&&imp<1?imp:0,glow:1,font:it.font});
 c.restore();
 if(it.sub&&it.sp!==0){const sp=it.sp==null?1:it.sp,f=it.sub.f||11;c.save();c.globalAlpha*=sp*Math.min(1,u*2);c.font=`${it.sub.style||'italic'} 500 ${f}px ${it.sub.font||'Lora, serif'}`;c.textAlign='center';c.textBaseline='middle';
  c.shadowColor='rgba(0,0,0,.9)';c.shadowBlur=f*.5*(px||2);c.fillStyle='#ffe9c4';c.fillText(it.sub.t,it.x,it.y+(it.f||36)*.72+f*.2);c.restore();}};
})();
