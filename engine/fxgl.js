'use strict';

(function(){
const qs=new URLSearchParams(location.search);
const glc=document.createElement('canvas');glc.width=glc.height=4;
let gl=null;
if(qs.get('gl')!=='0'){try{gl=glc.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});}catch(e){}}
const FX={ok:!!gl,gl,canvas:glc,sync:qs.get('sync')==='1',stat:{n:0,ms:0,last:0,up:0,upMs:0},renderer:'',light:false,maxPerFrame:2,soft:false,resScale:1};

FX.reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(FX.reduce)FX.ok=false;
if(gl){try{const ext=gl.getExtension('WEBGL_debug_renderer_info');FX.renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}catch(e){}
 FX.soft=/swiftshader|llvmpipe|softpipe|software|basic render/i.test(FX.renderer);   
 glc.addEventListener('webglcontextlost',e=>{e.preventDefault();FX.ok=false;});
 glc.addEventListener('webglcontextrestored',()=>{FX.ok=!FX.light&&!FX.reduce;PROG.clear();for(const P of PATCHES){P.tex=null;P.mtex=null;}quad=null;NOISE=null;});}

const VS='attribute vec2 a;varying vec2 uv;uniform vec4 uSub;void main(){uv=mix(uSub.xy,uSub.zw,vec2(a.x*.5+.5,.5-a.y*.5));gl_Position=vec4(a,0.,1.);}';
const PROG=new Map(),PATCHES=[];let quad=null;
const clamp01=v=>v<0?0:v>1?1:v;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('FXGL shader: '+gl.getShaderInfoLog(s));return s;}
function program(fs){let p=PROG.get(fs);if(p)return p;
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(pr,0,'a');gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error('FXGL program: '+gl.getProgramInfoLog(pr));
 p={pr,loc:{}};PROG.set(fs,p);return p;}
function loc(p,n){return n in p.loc?p.loc[n]:(p.loc[n]=gl.getUniformLocation(p.pr,n));}
function setSub(p,a,b,c,d){gl.uniform4f(loc(p,'uSub'),a,b,c,d);}

FX.patch=function(rect,fs,opt={}){
 const d=FORCE.get(fs);if(d)opt=Object.assign({},opt,d);                
 const P={rect,fs,opt,tex:null,mtex:null,tw:0,th:0,used:0};PATCHES.push(P);return P;};
const FORCE=new Map();
function upload(P,src){
 const t0=performance.now();
 const W=src.width,H=src.height,[x0,y0,x1,y1]=P.rect;
 const sx=Math.max(0,Math.round(x0*W)),sy=Math.max(0,Math.round(y0*H)),ex=Math.min(W,Math.round(x1*W)),ey=Math.min(H,Math.round(y1*H));
 const k=Math.min(1,(P.opt.max||2048)/Math.max(ex-sx,ey-sy));
 const c=document.createElement('canvas');c.width=Math.max(2,Math.round((ex-sx)*k));c.height=Math.max(2,Math.round((ey-sy)*k));
 c.getContext('2d').drawImage(src,sx,sy,ex-sx,ey-sy,0,0,c.width,c.height);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 P.tex=t;P.tw=c.width;P.th=c.height;
 FX.stat.up++;FX.stat.upMs+=performance.now()-t0;}

function uploadMask(P,m){
 const W=m.width,H=m.height,[x0,y0,x1,y1]=P.rect;
 const sx=Math.max(0,Math.floor(x0*W)),sy=Math.max(0,Math.floor(y0*H)),ex=Math.min(W,Math.ceil(x1*W)),ey=Math.min(H,Math.ceil(y1*H));
 const c=document.createElement('canvas');c.width=Math.max(2,ex-sx);c.height=Math.max(2,ey-sy);
 
 c.getContext('2d').drawImage(m,x0*W,y0*H,(x1-x0)*W,(y1-y0)*H,0,0,c.width,c.height);
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 P.mtex=t;}

function maskReady(P){if(!P.opt.mask)return true;if(P.mtex)return true;const m=P.opt.mask();if(!m||!m.width)return false;uploadMask(P,m);return true;}

let lastPrepKey=-1;
FX.prep=function(P,src){
 if(!FX.ok||!src||!src.width)return false;if(P.tex)return true;
 if(P.opt.mask&&!P.opt.mask())return false;                          
 const key=frameKey();if(key===lastPrepKey)return false;lastPrepKey=key;
 try{upload(P,src);maskReady(P);program(P.fs);}catch(e){console.warn(e);FX.ok=false;return false;}return true;};   
FX.free=function(P){if(gl){for(const k of ['tex','mtex'])if(P[k]){try{gl.deleteTexture(P[k]);}catch(e){}}}P.tex=null;P.mtex=null;};

let NOISE=null;
function noiseTex(){if(NOISE)return NOISE;const N=256,d=new Uint8Array(N*N*4);
 let sd=12345;const rnd=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296;};
 const lat=(px,py)=>{const a=new Float32Array(px*py);for(let i=0;i<a.length;i++)a[i]=rnd();return a;};
 const vn=(a,px,py,x,y)=>{const fx=x*px/N,fy=y*py/N,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
  const g=(i,j)=>a[((j%py+py)%py)*px+((i%px+px)%px)];return (g(ix,iy)*(1-sx)+g(ix+1,iy)*sx)*(1-sy)+(g(ix,iy+1)*(1-sx)+g(ix+1,iy+1)*sx)*sy;};
 const L8=lat(8,8),L16=lat(16,16),L32=lat(32,32),L64=lat(64,64),G32=lat(32,32),B=lat(4,64);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4;
  d[i]=Math.round(255*(.5*vn(L8,8,8,x,y)+.25*vn(L16,16,16,x,y)+.125*vn(L32,32,32,x,y)+.0625*vn(L64,64,64,x,y))/.9375);
  d[i+1]=Math.round(255*vn(G32,32,32,x,y));d[i+2]=Math.round(255*vn(B,4,64,x,y));d[i+3]=Math.round(255*rnd());}
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 return NOISE=t;}
function bindNoise(p){const l=loc(p,'uNoise');if(l==null)return;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,noiseTex());gl.uniform1i(l,1);gl.activeTexture(gl.TEXTURE0);}

function frameKey(){const t=document.timeline&&document.timeline.currentTime;return t!=null?t:Math.floor(performance.now()/8);}
let fKey=-1,fSet=new Set(),warned=false;

FX.draw=function(P,src,ctx,dx,dy,dw,dh,U,pxPerUnit){
 if(!FX.ok||!src||!src.width)return false;
 if(P.opt.mask&&!P.mtex&&!P.opt.mask())return false;                  
 const t0=performance.now();
 const key=frameKey();if(key!==fKey||fSet.has(P)){fKey=key;fSet.clear();}   
 fSet.add(P);
 if(fSet.size>FX.maxPerFrame&&!warned){warned=true;console.warn('FXGL: more than '+FX.maxPerFrame+' patches in one frame (budget)');}
 try{
  if(!P.tex)upload(P,src);
  if(!maskReady(P))return false;
  const p=program(P.fs);
  
  const rs=(P.opt.res||1)*(FX.soft?.5:1)*FX.resScale,owF=Math.max(2,Math.min(P.tw,Math.ceil(dw*pxPerUnit*rs))),ohF=Math.max(2,Math.min(P.th,Math.ceil(dh*pxPerUnit*rs)));
  let u0=0,v0=0,u1=1,v1=1;
  if(ctx.getTransform){const m=ctx.getTransform(),det=m.a*m.d-m.b*m.c;
   if(Math.abs(det)>1e-9){const cw=ctx.canvas.width,ch=ctx.canvas.height;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const [X,Y] of [[0,0],[cw,0],[0,ch],[cw,ch]]){const px=X-m.e,py=Y-m.f,lx=(m.d*px-m.c*py)/det,ly=(-m.b*px+m.a*py)/det;
     if(lx<x0)x0=lx;if(lx>x1)x1=lx;if(ly<y0)y0=ly;if(ly>y1)y1=ly;}
    
    const qx=v=>Math.round(clamp01(v)*owF)/owF,qy=v=>Math.round(clamp01(v)*ohF)/ohF;
    u0=qx((x0-dx)/dw-2/owF);u1=qx((x1-dx)/dw+2/owF);v0=qy((y0-dy)/dh-2/ohF);v1=qy((y1-dy)/dh+2/ohF);
    if(u1<=u0||v1<=v0)return true;}}                                    
  const ow=Math.max(1,Math.round((u1-u0)*owF)),oh=Math.max(1,Math.round((v1-v0)*ohF));
  if(glc.width<ow||glc.height<oh){glc.width=Math.max(glc.width,ow);glc.height=Math.max(glc.height,oh);}
  gl.viewport(0,0,ow,oh);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(p.pr);setSub(p,u0,v0,u1,v1);
  if(!quad){quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);}
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,P.tex);gl.uniform1i(loc(p,'uTex'),0);
  gl.uniform2f(loc(p,'uPx'),1/P.tw,1/P.th);bindNoise(p);
  if(P.mtex){const l=loc(p,'uMask');if(l!=null){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,P.mtex);gl.uniform1i(l,2);gl.activeTexture(gl.TEXTURE0);}}
  {const l=loc(p,'uRes');if(l!=null)gl.uniform2f(l,owF,ohF);}
  {const l=loc(p,'uAsp');if(l!=null)gl.uniform1f(l,P.tw/P.th);}
  for(const k in U){const v=U[k],l=loc(p,k);if(l==null||v==null)continue;
   if(typeof v==='number')gl.uniform1f(l,v);else if(v.length===2)gl.uniform2f(l,v[0],v[1]);else if(v.length===3)gl.uniform3f(l,v[0],v[1],v[2]);else gl.uniform4f(l,v[0],v[1],v[2],v[3]);}
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if(FX.sync)gl.finish();                     
  const X=dx+u0*dw,Y=dy+v0*dh,Wd=(u1-u0)*dw,Hd=(v1-v0)*dh;
  if(P.opt.comp){const g=ctx.globalCompositeOperation;ctx.globalCompositeOperation=P.opt.comp;ctx.drawImage(glc,0,glc.height-oh,ow,oh,X,Y,Wd,Hd);ctx.globalCompositeOperation=g;}
  else ctx.drawImage(glc,0,glc.height-oh,ow,oh,X,Y,Wd,Hd);
  FX.stat.px=ow*oh;P.last={ow,oh,owF,ohF,sub:[u0,v0,u1,v1]};
 }catch(e){console.warn(e);FX.ok=false;return false;}
 P.used=t0;
 const ms=performance.now()-t0;FX.stat.n++;FX.stat.ms+=ms;FX.stat.last=ms;return true;
};

FX.timeGL=function(P,src,U,ow,oh,n=10){
 const ext=gl&&gl.getExtension('EXT_disjoint_timer_query');if(!FX.ok||!ext)return Promise.resolve(-1);
 if(!P.tex)upload(P,src);const p=program(P.fs);
 let sub=[0,0,1,1],owF,ohF;
 if(ow==null&&P.last){({ow,oh,owF,ohF,sub}=P.last);}                
 else{ow=Math.min(ow,P.tw);oh=Math.min(oh,P.th);owF=ow;ohF=oh;}
 if(glc.width<ow||glc.height<oh){glc.width=Math.max(glc.width,ow);glc.height=Math.max(glc.height,oh);}
 gl.viewport(0,0,ow,oh);gl.useProgram(p.pr);setSub(p,...sub);
 if(!quad){quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);}
 gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,P.tex);gl.uniform1i(loc(p,'uTex'),0);gl.uniform2f(loc(p,'uPx'),1/P.tw,1/P.th);bindNoise(p);
 {const l=loc(p,'uRes');if(l!=null)gl.uniform2f(l,owF,ohF);}{const l=loc(p,'uAsp');if(l!=null)gl.uniform1f(l,P.tw/P.th);}
 for(const k in U){const v=U[k],l=loc(p,k);if(l==null||v==null)continue;if(typeof v==='number')gl.uniform1f(l,v);else if(v.length===2)gl.uniform2f(l,v[0],v[1]);else if(v.length===3)gl.uniform3f(l,v[0],v[1],v[2]);else gl.uniform4f(l,v[0],v[1],v[2],v[3]);}
 const q=ext.createQueryEXT();ext.beginQueryEXT(ext.TIME_ELAPSED_EXT,q);for(let i=0;i<n;i++)gl.drawArrays(gl.TRIANGLE_STRIP,0,4);ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
 return new Promise(res=>{const poll=()=>{if(!ext.getQueryObjectEXT(q,ext.QUERY_RESULT_AVAILABLE_EXT)){setTimeout(poll,5);return;}
  const bad=gl.getParameter(ext.GPU_DISJOINT_EXT),ns=ext.getQueryObjectEXT(q,ext.QUERY_RESULT_EXT);ext.deleteQueryEXT(q);res(bad?-2:ns/1e6/n);};poll();});};

const WATCH=[];
FX.watch=function(ms){
 if(FX.light||WATCH.length>=90)return FX.light;
 if(!(ms>0)||ms>250)return FX.light;          
 WATCH.push(ms);
 if(WATCH.length===90){const a=[...WATCH].sort((x,y)=>x-y),med=a[45];FX.watchMedian=med;
  if(med>22){FX.light=true;FX.ok=false;try{dispatchEvent(new CustomEvent('fxgl-light',{detail:{median:med}}));}catch(e){}}}
 return FX.light;};

const HEAD=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;uniform sampler2D uTex;uniform vec2 uPx;uniform vec2 uRes;uniform float uAsp;uniform float uAmt;uniform float uPh;
`;

const LIB=`
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){return .5*vnoise(p)+.25*vnoise(p*2.03+7.1)+.125*vnoise(p*4.01+3.7)+.0625*vnoise(p*8.05+1.3);}
float fbm2(vec2 p){return .62*vnoise(p)+.31*vnoise(p*2.03+7.1);}
float fbm3(vec2 p){return .53*vnoise(p)+.27*vnoise(p*2.03+7.1)+.13*vnoise(p*4.01+3.7);}
uniform sampler2D uNoise;
float tfbm(vec2 p){return texture2D(uNoise,p*.125).r;}
float tfine(vec2 p){return texture2D(uNoise,p*.03125).g;}
float tfib(vec2 p){return texture2D(uNoise,p*vec2(.25,.015625)).b;}
float thash(vec2 cell){return texture2D(uNoise,(cell+.5)/256.).a;}
vec3 sat(vec3 c,float s){return mix(vec3(lum(c)),c,s);}
vec2 aq(vec2 p){return vec2(p.x*uAsp,p.y);}

vec3 paper(vec2 p){vec2 q=aq(p);float n=tfbm(q*7.),f=tfib(q*vec2(9.,150.)),g=thash(floor(q*700.));
 return vec3(.945,.900,.795)*(.95+.07*n)-vec3(.028,.032,.04)*smoothstep(.62,.95,f)-vec3(.02)*step(.985,g);}
float edgeMask(vec2 p,float e){vec2 d=min(p,1.-p);return smoothstep(0.,e,min(d.x,d.y));}

vec3 sketchAt(vec2 p,vec3 ink,float wash){
 vec2 o=1.15/uRes;
 float a=lum(texture2D(uTex,p+vec2(-o.x,-o.y)).rgb),b=lum(texture2D(uTex,p+vec2(0.,-o.y)).rgb),c=lum(texture2D(uTex,p+vec2(o.x,-o.y)).rgb),
       d=lum(texture2D(uTex,p+vec2(-o.x,0.)).rgb),l=lum(texture2D(uTex,p).rgb),e=lum(texture2D(uTex,p+vec2(o.x,0.)).rgb),
       f=lum(texture2D(uTex,p+vec2(-o.x,o.y)).rgb),g=lum(texture2D(uTex,p+vec2(0.,o.y)).rgb),h=lum(texture2D(uTex,p+vec2(o.x,o.y)).rgb);
 float gx=(c+2.*e+h)-(a+2.*d+f),gy=(f+2.*g+h)-(a+2.*b+c),gr=length(vec2(gx,gy));
 float line=max(smoothstep(.18,.56,gr)*.66,smoothstep(.31,.10,l));
 vec3 pap=paper(p)*mix(1.,.80+.25*l,wash);
 return mix(pap,ink,line*.9);}
`;
FX.SH={

vortex:HEAD+`uniform vec2 uC;uniform vec2 uR;uniform float uTw;uniform float uPull;uniform float uGlint;
vec2 flow(vec2 d,float ph,float w){float a=-uTw*ph*w*uAmt,s=sin(a),c=cos(a);
 return vec2(c*d.x-s*d.y,s*d.x+c*d.y)*(1.+uPull*ph*w*uAmt);}
void main(){
 vec2 d=(uv-uC)/uR;float r=length(d);
 float w=1.-smoothstep(0.,.86,r);w*=w;
 float p0=fract(uPh),p1=fract(uPh+.5),k=abs(1.-2.*p0);
 vec4 col=mix(texture2D(uTex,uC+flow(d,p0,w)*uR),texture2D(uTex,uC+flow(d,p1,w)*uR),k);
 float ang=atan(d.y,d.x);
 float arm=sin(2.*ang*sign(uTw)+5.*log(r+.05)+uPh*6.2832);
 float lum=dot(col.rgb,vec3(.3,.59,.11));
 col.rgb+=vec3(1.,.8,.42)*pow(max(arm,0.),6.)*w*uGlint*uAmt*smoothstep(.45,.85,lum);
 float m=1.-smoothstep(.8,1.,r);
 gl_FragColor=clamp(col,0.,1.)*m;}`,

rise:HEAD+`uniform vec4 uB;uniform float uLen;uniform float uWob;
void main(){
 vec2 d=(uv-uB.xy)/uB.zw;float r=length(d);
 float w=1.-smoothstep(.45,.95,r);
 float p0=fract(uPh),p1=fract(uPh+.5),k=abs(1.-2.*p0);
 vec2 o0=vec2(sin(uv.y*23.+uPh*1.7)*uWob,uLen*p0)*w*uAmt,o1=vec2(sin(uv.y*23.+uPh*1.7+1.3)*uWob,uLen*p1)*w*uAmt;
 vec4 col=mix(texture2D(uTex,uv+o0),texture2D(uTex,uv+o1),k);
 float m=1.-smoothstep(.8,1.,r);
 gl_FragColor=clamp(col,0.,1.)*m;}`,

haze:HEAD+`uniform vec2 uBand;
void main(){
 float b=smoothstep(uBand.x,uBand.x+.15,uv.y)*(1.-smoothstep(uBand.y-.15,uBand.y,uv.y));
 vec2 o=vec2(sin(uv.y*170.+uPh*6.2832)*1.4+sin(uv.y*67.-uPh*4.1+uv.x*11.)*.9,sin(uv.x*95.+uPh*5.)*.7)*uPx*b*uAmt;
 gl_FragColor=texture2D(uTex,uv+o)*b;}`,

dissolve:HEAD+LIB+`uniform float uK;uniform vec2 uC;uniform vec2 uR;
void main(){
 vec2 far=max(abs(uC),abs(1.-uC))/uR;
 float thr=mix(length(far)+1.6,1.42,uK);
 float d=length((uv-uC)/uR);
 if(uAmt<.003||d+1.1<thr-.72){gl_FragColor=vec4(0.);return;}
 vec4 col=texture2D(uTex,uv);
 vec2 q=aq(uv);
 float n=tfbm(q*3.)*1.0+(tfine(q*30.)-.5)*.06;
 float v=d+n;
 if(v<thr-.72){gl_FragColor=vec4(0.);return;}
 vec3 pp=paper(uv);
 float fadeK=smoothstep(thr-.7,thr-.02,v);
 vec3 faded=mix(col.rgb,pp*(.78+.3*lum(col.rgb)),fadeK*.72);
 float pxv=1./(min(uR.x,uR.y)*max(uRes.x,uRes.y));
 float rimW=max(.012,2.6*pxv),dv=v-thr;
 float ink=1.-smoothstep(rimW*.5,rimW*1.2,abs(dv+rimW*.4));
 float scorch=smoothstep(.0,.02,dv)*(1.-smoothstep(.02,.18,dv));
 vec3 pap=pp*(1.-.06*(1.-smoothstep(.0,.5,lum(col.rgb))));
 pap=mix(pap,vec3(.55,.38,.21),scorch*.42);
 vec3 o=mix(faded,pap,smoothstep(-pxv,pxv,dv));
 float sp=step(.9975,thash(floor(q*90.)))*(1.-smoothstep(.0,.25,dv))*step(0.,dv);
 o=mix(o,vec3(.085,.067,.051),max(ink*.95,sp));
 gl_FragColor=vec4(mix(col.rgb,o,uAmt),1.);}`,

sketch:HEAD+LIB+`uniform vec2 uQ0;uniform vec2 uQ1;uniform vec2 uQ2;uniform vec2 uQ3;uniform vec2 uY;uniform float uLevel;uniform float uTiers;
float sdE(vec2 p,vec2 a,vec2 b,float s){vec2 e=aq(b)-aq(a);float L=length(e);return L<1e-5?1e3:s*(e.x*(aq(p).y-aq(a).y)-e.y*(aq(p).x-aq(a).x))/L;}
float quad(vec2 p){
 float ar=(uQ1.x-uQ0.x)*(uQ2.y-uQ0.y)-(uQ1.y-uQ0.y)*(uQ2.x-uQ0.x)+(uQ2.x-uQ0.x)*(uQ3.y-uQ0.y)-(uQ2.y-uQ0.y)*(uQ3.x-uQ0.x);
 float s=ar>0.?1.:-1.;
 return min(min(sdE(p,uQ0,uQ1,s),sdE(p,uQ1,uQ2,s)),min(sdE(p,uQ2,uQ3,s),sdE(p,uQ3,uQ0,s)));}
void main(){
 float m=smoothstep(-.006,.010,quad(uv));
 if(m<.001||uAmt<.003){gl_FragColor=vec4(0.);return;}
 vec4 col=texture2D(uTex,uv);
 float px=1.5/uRes.y;
 float H=uY.x-uY.y,h=(uY.x-uv.y)/H,ph=px/H;
 float built,front,live=step(.001,uLevel)*step(uLevel,.999);
 if(uTiers>.5){
  float N=uTiers,lv=clamp(uLevel,0.,1.)*N,k=floor(lv),f=lv-k;
  float x0=min(min(uQ0.x,uQ1.x),min(uQ2.x,uQ3.x)),x1=max(max(uQ0.x,uQ1.x),max(uQ2.x,uQ3.x));
  float fx=(uv.x-x0)/(x1-x0),lay=f<.001?-.1:smoothstep(0.,.8,f)*1.1-.05;
  float hk=k/N,hk1=(k+1.)/N;
  float left=1.-smoothstep(lay-.01,lay+.01,fx);
  float done=1.-smoothstep(hk-ph,hk+ph,h);
  float row=smoothstep(hk-ph,hk+ph,h)*(1.-smoothstep(hk1-ph,hk1+ph,h))*left;
  built=max(done,row);
  front=max((1.-smoothstep(0.,6.*ph,abs(h-hk)))*(1.-left)*step(.5,k),(1.-smoothstep(0.,6.*ph,abs(h-hk1)))*left)*live;
 }else{
  float yl=clamp(uLevel,0.,1.);built=1.-smoothstep(yl-ph,yl+ph,h);
  front=(1.-smoothstep(0.,2.5*ph,abs(h-yl)))*live;}
 if(built>.999&&front<.001){gl_FragColor=vec4(0.);return;}

 vec3 sk=sketchAt(uv,vec3(.32,.20,.11),.5);
 sk=mix(sk*vec3(1.03,.92,.74),col.rgb,.22);
 vec3 o=mix(sk,col.rgb,built);
 o+=vec3(.95,.70,.32)*front*.28;
 o=mix(col.rgb,o,uAmt);
 gl_FragColor=vec4(clamp(o,0.,1.),1.)*m;}`,

grade:HEAD+LIB+`uniform float uFocus;uniform float uHalf;uniform vec4 uCent;
void main(){
 vec4 C=uCent.w>0.?uCent:vec4(.14,.38,.62,.84);
 float f=clamp(uFocus,0.,3.);
 float c=mix(mix(mix(C.x,C.y,clamp(f,0.,1.)),C.z,clamp(f-1.,0.,1.)),C.w,clamp(f-2.,0.,1.));
 float h=uHalf>0.?uHalf:.13;
 float a=(1.-(1.-smoothstep(h-.035,h+.035,abs(uv.x-c))))*clamp(uAmt,0.,1.);
 if(a<.002){gl_FragColor=vec4(0.);return;}
 vec3 col=texture2D(uTex,uv).rgb;
 vec3 era=mix(mix(mix(vec3(1.,.86,.64),vec3(.84,.88,.95),clamp(f,0.,1.)),vec3(.74,.92,.9),clamp(f-1.,0.,1.)),vec3(.76,.84,1.),clamp(f-2.,0.,1.));
 vec3 dim=(sat(col,.22)*.62+vec3(.045,.038,.032))*mix(vec3(1.),era,.25);
 gl_FragColor=vec4(dim*a,a);}`,                                      

godrays:HEAD+LIB+`uniform vec2 uSrc;uniform float uThr;uniform float uLen;uniform vec3 uTint;
void main(){
 float m=edgeMask(uv,.12);
 if(uAmt<.003||m<.001){gl_FragColor=vec4(0.);return;}
 float thr=uThr>0.?uThr:.72,len=uLen>0.?uLen:.6;
 vec3 tint=uTint.r+uTint.g+uTint.b>0.?uTint:vec3(1.,.82,.52);
 vec2 dir=uSrc-uv;
 float j=thash(floor(uv*uRes))*.9;
 float acc=0.,w=1.,ws=0.;
 for(int i=0;i<24;i++){float t=(float(i)+j)/24.;vec3 s=texture2D(uTex,clamp(uv+dir*t*len,0.,1.)).rgb;
  acc+=max(lum(s)-thr,0.)/(1.-thr)*w;ws+=w;w*=.93;}
 acc/=ws;
 vec2 dd=aq(uv)-aq(uSrc);float ang=atan(dd.x,dd.y);
 float br=.55+.75*vnoise(vec2(ang*9.,uPh*.35))*(.6+.4*vnoise(vec2(ang*23.+3.,uPh*.6)));
 vec3 ray=clamp(tint*acc*br*1.6*uAmt,0.,1.)*m;
 gl_FragColor=vec4(ray,max(ray.r,max(ray.g,ray.b)));}`,   

stages:HEAD+LIB+`uniform vec4 uE1;uniform vec4 uE2;uniform vec4 uE3;uniform float uBorn;uniform float uBloom;uniform float uFall;
float em(vec4 E,vec2 p){return 1.-smoothstep(.72,1.,length((p-E.xy)/E.zw));}
void main(){
 vec2 q=aq(uv);float px=1.5/uRes.y;
 vec4 col=texture2D(uTex,uv);

 float keep=max(smoothstep(.03,.12,(col.g+col.b)*.5-col.r),smoothstep(.72,.82,lum(col.rgb))*(1.-smoothstep(.06,.12,max(col.r,max(col.g,col.b))-min(col.r,min(col.g,col.b)))));
 float m1=uBorn<.999?em(uE1,uv):0.,m2=uBloom>.001?em(uE2,uv):0.,m3=uFall>.001?(1.-smoothstep(.62,1.,length((uv-uE3.xy)/uE3.zw)+(tfbm(q*7.+3.)-.42)*.38*uFall))*(1.-keep):0.;
 float act=max(m1,max(m2,m3));
 if(uAmt<.003||act<.001){gl_FragColor=vec4(0.);return;}
 vec3 o=col.rgb;
 if(m1>.001){ 
  float h=clamp((uE1.y+uE1.w-uv.y)/(2.*uE1.w),0.,1.);
  float yl=clamp(uBorn,0.,1.)*1.04;
  float built=1.-smoothstep(yl-px/uE1.w,yl+px/uE1.w,h);
  float front=(1.-smoothstep(0.,2.5*px/uE1.w,abs(h-yl)))*step(.001,uBorn);
  vec3 sk=sketchAt(uv,vec3(.30,.28,.27),.45);
  o=mix(o,mix(sk,col.rgb,built)+vec3(1.,.8,.4)*front*.7,m1);}
 if(m2>.001){ 
  vec3 rich=sat(col.rgb,1.+.38*uBloom)*(1.+.08*uBloom);
  float diag=((uv.x-uE2.x)/uE2.z-(uv.y-uE2.y)/uE2.w)*.5;
  float band=exp(-pow((diag-mix(-1.4,1.4,uBloom))/.16,2.))*step(uBloom,.999);
  o=mix(o,rich+vec3(1.,.86,.55)*band*.55*smoothstep(.25,.75,lum(col.rgb)),m2);}
 if(m3>.001){ 
  vec2 d3=(uv-uE3.xy)/uE3.zw;
  float n=tfbm(q*9.)*.86+(tfine(q*55.)-.5)*.12;
  float v=n+length(d3)*.2+(.5-d3.y*.5)*.35;
  float thr=1.45-uFall*1.5;
  float gone=smoothstep(thr-.012,thr+.012,v);
  float slide=uFall*.035*tfine(vec2(q.x*30.,1.));
  vec3 c3=texture2D(uTex,uv-vec2(0.,slide*(1.-gone))).rgb;
  float l3=lum(c3);
  vec3 dune=mix(vec3(.66,.49,.29),vec3(.97,.84,.58),smoothstep(.15,.85,l3))*(.94+.1*tfine(q*90.));
  vec3 pale=mix(c3,dune,uFall*.5);
  float rim=1.-smoothstep(.0,.03,abs(v-thr));
  vec3 o3=mix(pale,mix(dune,vec3(.92,.76,.50),.4),gone);o3=mix(o3,vec3(.47,.33,.18),rim*.6);
  o=mix(o,o3,m3);}
 o=clamp(mix(col.rgb,o,uAmt),0.,1.);
 gl_FragColor=vec4(col.rgb*act+(o-col.rgb),act);}`,               

water:HEAD+LIB+`uniform sampler2D uMask;uniform float uAmp;uniform float uGlint;uniform vec2 uHor;uniform vec3 uTint;uniform float uScale;
void main(){
 float m0=texture2D(uMask,uv).a;
 if(m0<.004||uAmt<.003){gl_FragColor=vec4(0.);return;}
 float sc=1.;
 if(uHor.y>uHor.x)sc=mix(.32,1.,clamp((uv.y-uHor.x)/(uHor.y-uHor.x),0.,1.));
 vec2 q=vec2(uv.x*uAsp,uv.y)*8./(sc*max(.2,uScale));
 float t=uPh;
 float n1=tfbm(vec2(q.x*.35+t*.045,q.y*1.7+t*.10));
 float n2=tfbm(vec2(q.x*.5-t*.037+3.3,q.y*2.2-t*.07+1.7));

 vec2 off=vec2((n1-n2)*1.6+sin(q.y*9.+t*1.6+n1*4.)*.35,(n1+n2-.93)*.35)*uAmp*sc*uPx*uAmt;
 vec4 c0=texture2D(uTex,uv);
 float mo=texture2D(uMask,uv+off).a;
 vec3 col=mix(c0.rgb,texture2D(uTex,uv+off).rgb,smoothstep(.35,.9,mo));
 col*=1.+(n1-n2)*.10*uAmt;
 vec2 gq=vec2(q.x*1.6+t*.06,q.y*7.5);
 float g=tfine(gq*1.3)*.6+tfbm(gq*.5+vec2(-t*.03,0.))*.4;
 float tw=.5+.5*sin(t*1.9+thash(floor(gq*vec2(.9,1.)))*6.2832);
 float gs=smoothstep(.72,.88,g)*tw*smoothstep(.2,.6,lum(c0.rgb));
 vec3 tint=uTint.r+uTint.g+uTint.b>0.?uTint:vec3(1.,.98,.9);
 col+=tint*gs*.42*uGlint*uAmt;
 gl_FragColor=vec4(clamp(col,0.,1.),1.)*m0;}`,
};

FORCE.set(FX.SH.dissolve,{max:2048});FORCE.set(FX.SH.water,{max:2048});FORCE.set(FX.SH.grade,{max:2048});FORCE.set(FX.SH.stages,{max:2048});FORCE.set(FX.SH.sketch,{max:2048});
FORCE.set(FX.SH.godrays,{comp:'screen',res:.5});
window.FXGL=FX;
})();
