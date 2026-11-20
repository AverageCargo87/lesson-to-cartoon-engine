'use strict';
/* Effects package, part 2: the "film" look (light and focus instead of pencil and ink). Load after effekty.js.
 * Pure 2D painters, same rules as effekty.js; wrappers EFF.L.* take their parameters from layer fields.
 *
 *   EFF.leak(c,x0,y0,w,h,p,a,{seed,dir,rgb,comp})      film light leak                    L.leak
 *   EFF.flare(c,x,y,T,a,{len,rgb,core,breath,...})     lens flare that breathes           L.flare
 *   EFF.dof(k,W,layer,{r,bl}) -> layer copy            depth of field: a blurred copy, strength bl 0..1
 *   EFF.pull(tl,[blur],[focus],t,dur)                  focus pull between layers
 *   EFF.fog(c,x0,y0,x1,y1,T,a,{vx,rgb,scale,...})      drifting fog between layers            L.fog
 *   EFF.beams(c,src,ang,T,a,{n,len,spread,...})        light beams with motes                 L.beams
 *   EFF.flicker(c,W,x,y,T,a,{r,rgb,shadow,rate,...})   firelight flicker on the picture       L.flicker
 *   EFF.grade(c,W,a,{warm,lift,vig,cx,cy})             warm grade + vignette                  L.grade
 *   EFF.filmEnv() -> {light,reduce}
 */

(function(){
const EFF=window.EFF=window.EFF||{};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let s=(seed*2654435761)>>>0||1;return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const RED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const env=EFF.filmEnv=()=>({light:!!(window.kino&&window.kino.light),reduce:RED});
const fa=v=>(+v).toFixed(3);

EFF.leak=function(c,x0,y0,w,h,p,a=1,o={}){
 if(!(a>.003)||!(p>0)||!(p<1))return;const lt=env().light,r=rng((o.seed||5)*131),dir=o.dir||(r()<.5?1:-1),R=Math.max(w,h);
 const A=a*(RED?.35:1)*Math.sin(Math.PI*p);if(A<=.003)return;

 const cols=o.rgb?[[o.rgb,.85,.75,'screen']]:[['226,74,28',.5,.8,'source-over'],['255,160,62',.7,.62,'screen'],['255,236,190',.55,.42,'screen']];
 c.save();
 const list=lt&&cols.length>1?[cols[1]]:cols;
 for(let i=0;i<list.length;i++){const [rgb,k,sz,op]=list[i],ph=r()*.3,sp=.8+r()*.5;c.globalCompositeOperation=o.comp||op;
  const u=-.3+(p*sp+ph)*1.25,x=x0+(dir>0?u:1-u)*w,y=y0+(.1+r()*.8)*h,rr=R*sz*(.8+.35*r());
  const g=c.createRadialGradient(x,y,0,x,y,rr);g.addColorStop(0,`rgba(${rgb},${fa(k*A)})`);g.addColorStop(.5,`rgba(${rgb},${fa(k*A*.4)})`);g.addColorStop(1,`rgba(${rgb},0)`);
  c.fillStyle=g;c.fillRect(x0,y0,w,h);}
 if(!lt){c.globalCompositeOperation=o.comp||'screen';const u=-.2+p*1.4,x=x0+(dir>0?u:1-u)*w,bw=w*.06,g=c.createLinearGradient(x-bw,0,x+bw,0);
  g.addColorStop(0,'rgba(255,200,140,0)');g.addColorStop(.5,`rgba(255,214,160,${fa(.35*A)})`);g.addColorStop(1,'rgba(255,200,140,0)');c.fillStyle=g;c.fillRect(x-bw,y0,2*bw,h);}
 c.restore();};

EFF.flare=function(c,x,y,T,a=1,o={}){
 if(!(a>.003))return;const lt=env().light,rgb=o.rgb||'255,196,128',core=o.core||'255,246,226',L=o.len||220;
 const br=1+(o.breath==null?.06:o.breath)*(Math.sin(T*.83+1.3)*.7+Math.sin(T*2.17)*.3),A=a*br;
 c.save();c.globalCompositeOperation='lighter';
 let g=c.createRadialGradient(x,y,0,x,y,L*.32*br);g.addColorStop(0,`rgba(${core},${fa(.55*A)})`);g.addColorStop(.25,`rgba(${rgb},${fa(.25*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);
 c.fillStyle=g;c.fillRect(x-L*.4,y-L*.4,L*.8,L*.8);
 c.save();c.translate(x,y);if(o.ang)c.rotate(o.ang);c.scale(1,o.thin||.045);
 g=c.createRadialGradient(0,0,0,0,0,L*br);g.addColorStop(0,`rgba(${core},${fa(.8*A)})`);g.addColorStop(.2,`rgba(${rgb},${fa(.38*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);
 c.fillStyle=g;c.fillRect(-L*br,-L*br,2*L*br,2*L*br);c.restore();
 c.save();c.translate(x,y);if(o.ang)c.rotate(o.ang);g=c.createLinearGradient(-L*.7,0,L*.7,0);
 g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(.5,`rgba(${core},${fa(.7*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(-L*.7,-.6,L*1.4,1.2);c.restore();
 const n=o.ghosts==null?3:o.ghosts;
 if(!lt&&n>0){const [tx,ty]=o.to||[400,225],dx=tx-x,dy=ty-y,gs=o.gs||1;
  for(let i=0;i<n;i++){const t=[.55,1.25,1.7,.9,1.45][i%5],gx=x+dx*t,gy=y+dy*t,rr=[10,18,7,13,24][i%5]*gs,cc=i%2?'150,200,255':'255,190,120';
   g=c.createRadialGradient(gx,gy,rr*.55,gx,gy,rr);g.addColorStop(0,`rgba(${cc},${fa(.07*A)})`);g.addColorStop(.85,`rgba(${cc},${fa(.12*A)})`);g.addColorStop(1,`rgba(${cc},0)`);
   c.fillStyle=g;c.beginPath();c.arc(gx,gy,rr,0,7);c.fill();}}
 c.restore();};

const BL=new Map();
function blurObj(src,r){let m=BL.get(src);if(!m){m={};BL.set(src,m);}return m[r]||(m[r]={lv:[],ar:src.ar||1,ready:false,busy:false,opaque:false});}
function makeBlur(B,src,r,ppu){if(B.busy||!src.lv||!src.lv.length)return;B.busy=true;B.ar=src.ar;
 let s=src.lv[0];for(const l of src.lv)if(l.width>=900)s=l;

 try{const q=document.createElement('canvas');q.width=64;q.height=36;const qx=q.getContext('2d',{willReadFrequently:true});qx.drawImage(s,0,0,64,36);
  const d=qx.getImageData(0,0,64,36).data;let mn=255;for(let i=3;i<d.length;i+=4)if(d[i]<mn)mn=d[i];B.opaque=mn>=250;}catch(e){}
 const rp=Math.max(1,r*ppu*s.width/src.lv[0].width),cv=document.createElement('canvas');cv.width=s.width;cv.height=s.height;const x=cv.getContext('2d');
 if('filter' in x){x.filter=`blur(${rp.toFixed(1)}px)`;x.drawImage(s,0,0);x.filter='none';}
 else{const q=Math.max(1,Math.round(rp/1.5)),t=document.createElement('canvas');t.width=Math.max(1,Math.round(s.width/q));t.height=Math.max(1,Math.round(s.height/q));
  const tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(s,0,0,t.width,t.height);x.imageSmoothingQuality='high';x.drawImage(t,0,0,cv.width,cv.height);}
 const done=b=>{B.lv=[b];B.ready=true;};
 if(window.createImageBitmap)createImageBitmap(cv).then(done,()=>done(cv));else done(cv);}

EFF.dof=function(k,W,base,o={}){
 const src=base&&base.img;if(!src){console.warn('EFF.dof: layer without a picture');return null;}
 const r=o.r||4,cr=base.crop,cw=cr?cr[2]-cr[0]:1,B=blurObj(src,r),L=Object.create(base);
 const ppu=()=>src.lv.length?src.lv[0].width*cw/(base.w||800):1,fade=o.fade!=null?o.fade:1;
 L.img=B;L.bl=o.bl||0;L.dof=base;L._gsap=null;
 Object.defineProperty(L,'o',{get(){return base.o*Math.sqrt(clamp(this.bl,0,1));},set(){},configurable:true,enumerable:true});

 const own=T=>base._amb0?base._amb0(T):null;
 const wrap=T=>{const a=own(T),m=1-fade*Math.pow(clamp(L.bl,0,1),3)*(B.ready&&!B.opaque&&!env().light?1:0);if(m>=1)return a;return Object.assign({},a||{},{o:((a&&a.o!=null)?a.o:1)*m});};
 const rewrap=()=>{if(base.amb!==wrap){base._amb0=base.amb||null;base.amb=wrap;}};
 if(fade>0)rewrap();L.amb=own;
 L.gate=()=>{if(fade>0)rewrap();if(!B.ready){makeBlur(B,src,r,ppu());return true;}if(env().light)return true;return !!(base.gate&&base.gate());};

 const prep=()=>{if(B.ready||B.busy)return;if(src.lv.length){(window.requestIdleCallback||(f=>setTimeout(f,60)))(()=>makeBlur(B,src,r,ppu()));return;}setTimeout(prep,400);};prep();
 const i=W.items.indexOf(base);W.items.splice(i<0?W.items.length:i+1,0,L);return L;};

EFF.pull=function(tl,toBlur,toSharp,t,dur=1.1,ease='sine.inOut'){
 const a=[].concat(toBlur||[]).filter(Boolean),b=[].concat(toSharp||[]).filter(Boolean);
 if(a.length)tl.to(a,{bl:1,duration:dur,ease},t);if(b.length)tl.to(b,{bl:0,duration:dur,ease},t);};

const FOG={};
function fogTex(seed,rgb){const key=seed+'|'+rgb;if(FOG[key])return FOG[key];const Wt=512,Ht=128,cv=document.createElement('canvas');cv.width=Wt;cv.height=Ht;
 const x=cv.getContext('2d'),d=x.createImageData(Wt,Ht),r=rng(seed*7+3),oct=[[8,4,.5],[16,8,.27],[32,12,.15],[64,20,.08]];
 const lat=oct.map(([px,py])=>{const a=new Float32Array(px*(py+1));for(let i=0;i<a.length;i++)a[i]=r();return a;});
 const sm=t=>t*t*(3-2*t),[cr,cg,cb]=rgb.split(',').map(Number);
 for(let j=0;j<Ht;j++){const vy=j/Ht,env=Math.pow(Math.sin(Math.PI*vy),1.3);
  for(let i=0;i<Wt;i++){let v=0;oct.forEach(([px,py,w],o)=>{const fx=i/Wt*px,fy=vy*py,ix=Math.floor(fx),iy=Math.floor(fy),tx=sm(fx-ix),ty=sm(fy-iy),A=lat[o];
    const at=(a,b)=>A[(b)*px+((a%px)+px)%px],v0=at(ix,iy)+(at(ix+1,iy)-at(ix,iy))*tx,v1=at(ix,iy+1)+(at(ix+1,iy+1)-at(ix,iy+1))*tx;v+=w*(v0+(v1-v0)*ty);});
   const al=clamp((v-.32)*2.1,0,1)*env,p=(j*Wt+i)*4;d.data[p]=cr;d.data[p+1]=cg;d.data[p+2]=cb;d.data[p+3]=al*255;}}
 x.putImageData(d,0,0);return FOG[key]=cv;}

EFF.fog=function(c,x0,y0,x1,y1,T,a=1,o={}){
 if(!(a>.003)||!(y1>y0))return;const lt=env().light,rgb=o.rgb||'236,226,210',tex=fogTex(o.seed||1,rgb),vx=o.vx==null?5:o.vx,sc=o.scale||1,H=y1-y0;
 c.save();c.globalCompositeOperation=o.comp||'source-over';
 const layer=(k,spd,al,dy)=>{const hh=H*k,tw=hh*4*sc,off=((T*vx*spd)%tw+tw)%tw,yy=y0+(H-hh)/2+dy;c.globalAlpha=a*al*(o.dens||1);
  for(let x=x0-tw+off;x<x1;x+=tw)c.drawImage(tex,x,yy,tw,hh);};
 layer(1,1,.75,0);if(!lt)layer(.7,1.7,.5,H*.08);
 c.restore();};

EFF.beams=function(c,src,ang,T,a=1,o={}){
 if(!(a>.003)||!src)return;const lt=env().light,n=lt?Math.min(3,o.n||5):(o.n||5),L=o.len||420,sp=o.spread==null?.32:o.spread,rgb=o.rgb||'255,226,170',r=rng(o.seed||7);
 const polys=[];let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;
 c.save();c.globalCompositeOperation='screen';
 for(let i=0;i<n;i++){const t=n>1?i/(n-1)-.5:0,an=ang+t*sp+(r()-.5)*sp*.25,w0=(o.w0||6)*(.6+.8*r()),w1=(o.w1||46)*(.6+.8*r()),len=L*(.75+.5*r()),ph=r()*6.28,fq=.35+.25*r();
  const br=.62+.38*Math.sin(T*fq+ph),ca=Math.cos(an),sa=Math.sin(an),nx=-sa,ny=ca,ex=src[0]+ca*len,ey=src[1]+sa*len;
  for(const [kw,ka] of [[1,.16],[.45,.22]]){const g=c.createLinearGradient(src[0],src[1],ex,ey);
   g.addColorStop(0,`rgba(${rgb},${fa(ka*2*a*br)})`);g.addColorStop(.35,`rgba(${rgb},${fa(ka*a*br)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;
   c.beginPath();c.moveTo(src[0]+nx*w0*kw,src[1]+ny*w0*kw);c.lineTo(ex+nx*w1*kw,ey+ny*w1*kw);c.lineTo(ex-nx*w1*kw,ey-ny*w1*kw);c.lineTo(src[0]-nx*w0*kw,src[1]-ny*w0*kw);c.closePath();c.fill();}
  const P=[[src[0]+nx*w0,src[1]+ny*w0],[ex+nx*w1,ey+ny*w1],[ex-nx*w1,ey-ny*w1],[src[0]-nx*w0,src[1]-ny*w0]];polys.push(P);
  for(const [px,py] of P){bx0=Math.min(bx0,px);by0=Math.min(by0,py);bx1=Math.max(bx1,px);by1=Math.max(by1,py);}}
 if(o.motes!==false&&!lt&&EFF.motes){c.beginPath();for(const P of polys){P.forEach(([px,py],j)=>j?c.lineTo(px,py):c.moveTo(px,py));c.closePath();}c.clip();
  c.globalCompositeOperation='source-over';EFF.motes(c,bx0,by0,bx1,by1,T,(o.seed||7)+11,a*.9,{n:o.mn||30,rgb:o.mrgb||'255,238,205',dir:-1});}
 c.restore();};

const flk=EFF.flk=(T,rate=1,seed=1)=>{const s=seed*1.7;return .5*Math.sin(T*7.1*rate+s)+.28*Math.sin(T*12.9*rate+s*2.3)+.14*Math.sin(T*19.7*rate+s*.7)+.22*Math.sin(T*1.3*rate+s*3.1)*Math.sin(T*3.7*rate+s);};

EFF.flicker=function(c,W,x,y,T,a=1,o={}){
 if(!(a>.003))return;const f=flk(T,o.rate||1,o.seed||1),R=o.r||120,rgb=o.rgb||'255,170,80',k=1+.07*f;
 if(o.shadow){c.save();c.globalCompositeOperation='multiply';const S=o.shadow*a*(.85-.15*f),g=c.createRadialGradient(x,y,R*.4,x,y,R*(o.far||3.2)*k);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,`rgba(70,45,25,${fa(clamp(S,0,1))})`);c.fillStyle=g;c.fillRect(-40,-40,W.w+80,W.h+80);c.restore();}
 c.save();c.globalCompositeOperation='lighter';const A=a*(.8+.2*f),g=c.createRadialGradient(x,y,0,x,y,R*k);
 g.addColorStop(0,`rgba(${rgb},${fa(.45*A)})`);g.addColorStop(.35,`rgba(${rgb},${fa(.18*A)})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-R*1.2,y-R*1.2,R*2.4,R*2.4);
 c.restore();};

EFF.grade=function(c,W,a=1,o={}){
 if(!(a>.003))return;const warm=o.warm||'255,222,182',lift=o.lift===undefined?'46,26,10':o.lift,v=o.vig==null?.35:o.vig;
 c.save();c.globalCompositeOperation='multiply';c.fillStyle=`rgba(${warm},${fa(clamp(a,0,1))})`;c.fillRect(-40,-40,W.w+80,W.h+80);
 if(lift){c.globalCompositeOperation='screen';c.fillStyle=`rgba(${lift},${fa(clamp(a*(o.liftA==null?.6:o.liftA),0,1))})`;c.fillRect(-40,-40,W.w+80,W.h+80);}
 if(v>0&&!env().light){c.globalCompositeOperation='multiply';const cx=o.cx==null?W.w/2:o.cx,cy=o.cy==null?W.h*.45:o.cy,R=Math.hypot(W.w,W.h)*.62,g=c.createRadialGradient(cx,cy,R*.45,cx,cy,R);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,`rgba(40,26,14,${fa(clamp(v*a,0,1))})`);c.fillStyle=g;c.fillRect(-40,-40,W.w+80,W.h+80);}
 c.restore();};

const L=EFF.L=EFF.L||{};
L.leak=(c,W,it)=>EFF.leak(c,it.x0==null?0:it.x0,it.y0==null?0:it.y0,it.w==null?W.w:it.w,it.h==null?W.h:it.h,it.p,it.a==null?1:it.a,it);
L.flare=(c,W,it,T)=>EFF.flare(c,it.x,it.y,T,it.a==null?1:it.a,it);
L.fog=(c,W,it,T)=>EFF.fog(c,it.x0==null?-20:it.x0,it.y0,it.x1==null?W.w+20:it.x1,it.y1,T,it.a==null?1:it.a,it);
L.beams=(c,W,it,T)=>EFF.beams(c,it.src,it.ang==null?Math.PI/2:it.ang,T,it.a==null?1:it.a,it);
L.flicker=(c,W,it,T)=>EFF.flicker(c,W,it.x,it.y,T,it.a==null?1:it.a,it);
L.grade=(c,W,it)=>EFF.grade(c,W,it.a==null?1:it.a,it);
})();
