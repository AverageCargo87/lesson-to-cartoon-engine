/* Quiz kit: the shared frame of every check after a cartoon: a task card on top, a tray at the bottom, a "finish"
 * button, the microphone and the tutor's voice. The task bank (quiz/proverka-bank.js) registers itself in
 * window.PROVERKI[set]; the page picks one by ?test= and hands it to the scene core as window.PROVERKA (the core takes
 * start, lock, stops, onEnter/onExit from it). While a task runs the board after the cartoon stands still.
 * Without window.QUIZ_API (no keys): spoken feedback is silent, a voice answer goes through the browser's speech
 * recognition (an online service in Chrome) or is typed (fully offline) and is graded by the bank's local keyword judge
 * (window.PvLocalJudge).
 * With window.QUIZ_API set: PCM is recorded and posted to <API>proverka?q=..&n=.. for server-side recognition and an
 * LLM rubric, the tutor's feedback is synthesised by <API>golos.
 */
window.PROVERKI={};
window.PvKit=(function(){
'use strict';
const K=()=>window.kino,M=()=>window.multik;
const API=window.QUIZ_API||null;   // server for voice answers and spoken feedback; null = offline demo
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function say(id){if(document.querySelector('.mx-cat.on'))return;try{K().say(id);}catch(e){}}
function sayLen(id){const b=K()?.VB?.[id];return b?(b.end-b.start)*1000+250:1200;}

let root=null;
function ui(){if(root)return root;root=document.createElement('div');root.id='pv';root.innerHTML=`
<div class="pv-card" aria-live="polite"><small></small><p></p><div class="pv-msg"></div><div class="pv-row"></div></div>
<div class="pv-tray"></div>
<button class="pv-exit" type="button">✕ Закончить</button>
<div class="pv-toast" aria-live="polite"></div>`;document.body.appendChild(root);

 if(window.ResizeObserver){new ResizeObserver(trayH).observe(root.querySelector('.pv-tray'));new ResizeObserver(cardB).observe(root.querySelector('.pv-card'));}return root;}
const $=s=>ui().querySelector(s);
function card(title,text){if(title!=null)$('.pv-card small').innerHTML=title;if(text!=null)$('.pv-card p').innerHTML=text;$('.pv-card').classList.add('show');cardB();}
function hideCard(){$('.pv-card').classList.remove('show');cardB();}

function cardB(){const c=root?.querySelector('.pv-card');if(!c)return;let b=0;
 if(c.classList.contains('show')){const m=c.querySelector('.pv-msg');b=Math.ceil(c.getBoundingClientRect().bottom-(m&&m.offsetHeight?Math.min(m.offsetHeight+6,29):0));}
 document.documentElement.style.setProperty('--card-b',b+'px');}
function msg(html,cls=''){const m=$('.pv-msg');m.innerHTML=html||'';m.className='pv-msg '+cls;}
function row(...btns){const r=$('.pv-row');r.innerHTML='';for(const b of btns){if(!b)continue;const [label,fn,cls]=b;const e=document.createElement('button');e.type='button';e.className='pv-btn '+(cls||'');e.innerHTML=label;e.onclick=fn;r.appendChild(e);}}
function tray(html){const t=$('.pv-tray');t.innerHTML=html||'';t.classList.toggle('show',!!html);trayH();return t;}
function trayH(){const t=root?.querySelector('.pv-tray');document.documentElement.style.setProperty('--tray-h',(t&&t.classList.contains('show')?Math.ceil(t.offsetHeight):0)+'px');}
let toastT=0;
function toast(text,ms=3800){const t=$('.pv-toast');t.innerHTML=text;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);}
function exit(fn){const b=$('.pv-exit');b.classList.toggle('show',!!fn);b.onclick=fn||null;}

function lockBoard(P,on){const k=K();P.lock=on;document.body.classList.toggle('pv-on',on);
 const bar=k?.bd?.querySelector('.bd-bar');if(!bar)return;
 if(on){k.unfocusUI();bar.classList.add('hide');}else bar.classList.remove('hide');}
function reset(){hideCard();tray('');msg('');row();exit(null);$('.pv-toast').classList.remove('show');}

let tutorAudio=null;
let gen=0;
function tutor(text){const g=gen;return new Promise(async done=>{
 if(!API)return done();
 try{K().vo.pause();tutorAudio?.pause();
  const r=await fetch(`${API}golos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,golos:window.GOLOS||undefined})});
  if(!r.ok)return done();
  const blob=await r.blob();if(g!==gen)return done();
  const a=tutorAudio=new Audio(URL.createObjectURL(blob));a.onended=a.onerror=()=>done();a.play().catch(()=>done());
 }catch(e){done();}});}
function hush(){gen++;tutorAudio?.pause();try{K().vo.pause();}catch(e){}}

let rec=null;
function micTray({placeholder='Напиши ответ',onSend}){
 const t=tray(`<div class="pv-mic-row"><button type="button" class="pv-mic" aria-label="Говорить"><svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg></button>
  <div class="pv-mic-side"><b class="pv-mic-label">Нажми и скажи</b><span class="pv-level"><i></i></span><button type="button" class="pv-write">или напиши ответ</button></div></div>
  <form class="pv-text" hidden><input type="text" maxlength="300" placeholder="${esc(placeholder)}" aria-label="Твой ответ"><button type="submit" class="pv-btn">Отправить</button></form>`);
 t.querySelector('.pv-mic').onclick=()=>rec?stopRec(true):startRec(onSend);
 t.querySelector('.pv-write').onclick=()=>{const f=t.querySelector('.pv-text');f.hidden=false;f.querySelector('input').focus();};
 t.querySelector('.pv-text').onsubmit=e=>{e.preventDefault();const v=t.querySelector('.pv-text input').value.trim();if(v.length<3){msg('Напиши хотя бы несколько слов.','no');return;}onSend({text:v});};
}
// a tiny AudioWorklet that posts 16-bit PCM blocks and their RMS (replaces the lesson shell's capture module)
const WORKLET='class C extends AudioWorkletProcessor{process(i){const x=i[0]&&i[0][0];if(x){const p=new Int16Array(x.length);let s=0;for(let k=0;k<x.length;k++){const v=Math.max(-1,Math.min(1,x[k]));p[k]=v*32767;s+=v*v;}this.port.postMessage({audio:p.buffer,rms:Math.sqrt(s/x.length)},[p.buffer]);}return true;}}registerProcessor("voice-capture",C);';
function recognise(onSend){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition,t=$('.pv-tray'),label=t.querySelector('.pv-mic-label');
 if(!SR){msg('Здесь нет распознавания речи: напиши ответ словами.','no');t.querySelector('.pv-text').hidden=false;return;}
 const r=new SR();r.lang='ru-RU';r.interimResults=false;r.maxAlternatives=1;
 rec={offline:r};t.querySelector('.pv-mic').classList.add('on');label.textContent='Говори… нажми ещё раз, когда закончишь';msg('');
 r.onresult=e=>{const text=[...e.results].map(x=>x[0].transcript).join(' ').trim();stopRec(false);if(text)onSend({text});};
 r.onerror=()=>{stopRec(false);msg('Не расслышала. Скажи ещё раз или напиши ответ.','no');t.querySelector('.pv-text').hidden=false;};
 r.onend=()=>{if(rec&&rec.offline===r)stopRec(false);};
 r.start();
}
async function startRec(onSend){
 const t=$('.pv-tray'),label=t.querySelector('.pv-mic-label');hush();
 if(!API)return recognise(onSend);
 try{
  const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  const ctx=new AudioContext({sampleRate:16000});await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET],{type:'text/javascript'})));
  const src=ctx.createMediaStreamSource(media),node=new AudioWorkletNode(ctx,'voice-capture'),mute=ctx.createGain();mute.gain.value=0;
  src.connect(node);node.connect(mute);mute.connect(ctx.destination);
  rec={media,ctx,node,chunks:[],spoke:false,loud:performance.now(),t0:performance.now(),onSend};
  t.querySelector('.pv-mic').classList.add('on');label.textContent='Говори… нажми ещё раз, когда закончишь';msg('');
  node.port.onmessage=e=>{if(!rec)return;rec.chunks.push(new Int16Array(e.data.audio));const r=e.data.rms,now=performance.now();
   t.querySelector('.pv-level i').style.width=Math.min(100,r*900)+'%';
   if(r>.02){rec.spoke=true;rec.loud=now;}
   if((rec.spoke&&now-rec.loud>1900)||now-rec.t0>25000)stopRec(true);};
 }catch(e){rec=null;msg('Микрофон не разрешён или не найден: напиши ответ словами.','no');t.querySelector('.pv-text').hidden=false;}
}
function stopRec(send){
 if(!rec)return;const r=rec;rec=null;
 if(r.offline){try{r.offline.onend=null;r.offline.abort();}catch(e){}const t=$('.pv-tray');t?.querySelector('.pv-mic')?.classList.remove('on');const lb=t?.querySelector('.pv-mic-label');if(lb)lb.textContent='Нажми и скажи';return;}
 try{r.node.port.onmessage=null;r.media.getTracks().forEach(x=>x.stop());r.ctx.close();}catch(e){}
 const t=$('.pv-tray');t?.querySelector('.pv-mic')?.classList.remove('on');const l=t?.querySelector('.pv-level i');if(l)l.style.width='0';
 if(!send)return;
 const n=r.chunks.reduce((a,c)=>a+c.length,0),pcm=new Int16Array(n);let o=0;for(const c of r.chunks){pcm.set(c,o);o+=c.length;}
 if(!r.spoke||n<16000*.5){msg('Не расслышала. Нажми на микрофон и скажи чуть громче.','no');const lb=t?.querySelector('.pv-mic-label');if(lb)lb.textContent='Нажми и скажи';return;}
 r.onSend({pcm});
}

async function judge(q,attempt,{pcm,text}){
 if(!API)return window.PvLocalJudge?window.PvLocalJudge(q,attempt,text||''):{error:'Проверка ответа здесь не настроена.'};
 try{
  const r=await fetch(`${API}proverka?q=${q}&n=${attempt}`,pcm?{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:pcm.buffer}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  const j=await r.json();if(!r.ok||j.error)return {error:j.error||'Не получилось проверить. Попробуй ещё раз или напиши ответ.'};return j;
 }catch(e){return {error:'Не получилось проверить. Попробуй ещё раз или напиши ответ.'};}
}

const MARK={ok:['✓','помнишь отлично'],help:['◐','помнишь, но не сразу'],again:['○','повторим в следующий раз']};
function facts(list,marks=MARK){return `<ul class="pv-facts">${list.map(([name,st])=>`<li class="${st}"><b>${marks[st][0]}</b><span>${name}</span><em>${marks[st][1]}</em></li>`).join('')}</ul>`;}
function save(key,data){try{localStorage.setItem(key,JSON.stringify(Object.assign({date:new Date().toISOString()},data)));}catch(e){}}

let actx=null;
function tone(f0,f1,t0,dur,type,vol){const c=actx,o=c.createOscillator(),g=c.createGain();o.type=type;
 o.frequency.setValueAtTime(f0,c.currentTime+t0);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,c.currentTime+t0+dur);
 g.gain.setValueAtTime(0,c.currentTime+t0);g.gain.linearRampToValueAtTime(vol,c.currentTime+t0+.012);g.gain.exponentialRampToValueAtTime(.0008,c.currentTime+t0+dur);
 o.connect(g);g.connect(c.destination);o.start(c.currentTime+t0);o.stop(c.currentTime+t0+dur+.02);}
function sfx(kind){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();
 if(kind==='ok'){tone(880,880,0,.13,'sine',.2);tone(1318,1318,.09,.22,'sine',.18);}
 else if(kind==='no'){tone(220,180,0,.16,'triangle',.22);tone(175,140,.13,.22,'triangle',.2);}
 else if(kind==='step'){[523,659,784].forEach((f,i)=>tone(f,f,i*.09,.22,'triangle',.16));}
 else if(kind==='fin'){[523,659,784,1046].forEach((f,i)=>tone(f,f,i*.11,i===3?.5:.24,'triangle',.17));}
}catch(e){}}

function fx(el,kind){if(!el)return;const cls=kind==='ok'?'fx-ok':'fx-no';el.classList.remove('fx-ok','fx-no');void el.offsetWidth;el.classList.add(cls);
 setTimeout(()=>el.classList.remove(cls),kind==='ok'?900:700);
 const r=el.getBoundingClientRect();if(!r.width)return;const b=document.createElement('div');b.className='fx-badge '+kind;b.textContent=kind==='ok'?'✓':'✕';
 b.style.left=Math.min(innerWidth-24,r.right-6)+'px';b.style.top=Math.max(24,r.top+6)+'px';document.body.appendChild(b);setTimeout(()=>b.remove(),900);}
const good=el=>{sfx('ok');fx(el,'ok');},bad=el=>{sfx('no');fx(el,'no');};

const gf=window.GF||(f=>f);
return {K,M,API,gf,esc,wait,shuffle,say,sayLen,ui,$,card,hideCard,msg,row,tray,toast,exit,lockBoard,reset,tutor,hush,micTray,stopRec,judge,facts,save,sfx,fx,good,bad};
})();
