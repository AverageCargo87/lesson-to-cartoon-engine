/* "Check yourself" after a cartoon: a bank of 8 task kinds on top of the quiz kit (quiz/proverki-kit.js).
 *
 * Kinds: lenta (put events in order) · karta (label a picture or a map) · pairs (word and meaning) · tf (true or a
 * mistake, by button or by swiping the card) · cloze (blanks in the "what we learned" sheet) · caps (captions for
 * frames, one caption is a lie) · err (find the wrong word in a phrase) · voice (answer in your own words, by voice
 * or in writing). The scene's DATA lives in window.QUIZ (see demo/fire/quiz-fire.js); this file holds no content.
 *
 * Sets (?test=): v1 "after the cartoon" = 3 kinds + voice, chosen Duolingo-style: kinds the child got wrong last
 * time (saved per kind in localStorage) come first, the rest in a seeded random order; v2 "another set" = 3 other
 * kinds + another voice question; vall = every kind; none = no check. "? All kinds" opens a catalogue of every kind.
 * Right and wrong answers get a sound and a green or red flash. Every task result goes to the host lesson:
 * parent.postMessage({source:'multik',type:'proverka',kind,r,set}); at the end {type:'proverka-itog',set,res}.
 * r is ok | help | again. Lesson flow (?lenta=1): the check starts by itself after the cartoon, the final card has
 * "Дальше ->" which posts {type:'next'}.
 */
(function () {
'use strict';
const Q = window.QUIZ || {};
const Kit = window.PvKit, {K, esc, say, sayLen, wait, shuffle, card, msg, row, tray, exit, lockBoard, reset, tutor, micTray, judge, good, bad, sfx} = Kit;
const ART = () => (window.KINO?.testArt || window.KINO?.art || 'art/');
const PAN = id => ART() + 'paneli/' + id + '.webp';
const TUTOR = Q.tutor || 'Учитель';
const MARK = {ok: ['✓', 'отлично'], help: ['◐', 'хорошо'], again: ['○', 'повторим ещё раз'], skip: ['-', 'не пройдено']};
const grade = m => m === 0 ? 'ok' : m <= 2 ? 'help' : 'again';
const KEY = Q.key || 'quiz';
const NAV = KEY + '-skills';   // the last result per task kind: the rotation reads it
const SEED = KEY + '-seed';
function post(m) { try { if (parent !== window) parent.postMessage(Object.assign({source: 'multik'}, m), location.origin); } catch (e) {} }

const mx = document.createElement('div'); mx.className = 'mx vv'; mx.innerHTML = '<div class="mx-stage"></div>';
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(mx));
const stage = () => mx.querySelector('.mx-stage');
let S = null;
const alive = run => S === run;

// ── lesson flow ("lenta"): the check starts by itself one second after the board appears
const LENTA = !!window.LENTA, IN_LESSON = parent !== window;
let LAST = null, autoT = 0;
let paused = null;   // a set interrupted by a task from the catalogue: "back to the check ->" resumes it
const ITOG = KEY + '-lenta-result';
function saveLast(run) { try { localStorage.setItem(ITOG, JSON.stringify({set: run.set, steps: run.steps, res: run.res})); } catch (e) {} }
document.documentElement.classList.toggle('mx-lenta', LENTA);
function lentaEnter(P) {
 clearTimeout(autoT);
 autoT = setTimeout(() => {const k = K(); if (!k?.free?.on || P.lock || S) return;
  if (k.free.focus) {k.free.focus = null; k.free.back = null;}
  if (LAST) {reopen(LAST); final(LAST, true);} else P.start();}, 1000);
 return true;}
function reopen(run) {clearTimeout(autoT); lockBoard(run.P, true); reset(); K().overview(); document.documentElement.classList.remove('mx-fin'); mx.classList.add('on'); S = run;}
function cut(run) {const fin = Object.assign({}, run, {res: run.res.slice(), cut: true}); end(run.P); reopen(fin); final(fin);}
function replay() {const m = window.multik; if (!m) return; m.seek(0); m.play();}
function resume(r) {start(r.P, r.src, null, r.set, {steps: r.steps, res: r.res});}

function variant(id, label, steps, intro, extra) {
 const P = Object.assign({id, lock: false, stops: [], label, miks: true, onEnter: () => LENTA ? lentaEnter(P) : false, onExit() {clearTimeout(autoT); if (P.lock) end(P);}, start() {start(P, steps, intro);},
  kinds: () => (typeof steps === 'function' ? steps() : steps).map(s => s.kind)}, extra || {});
 window.PROVERKI[id] = P;
}

function zvuk(n) { try { const a = new Audio((Q.sounds || '../../engine/sound/') + n + '.mp3'); a.volume = .9; a.play().catch(() => {}); } catch (e) {} }
async function start(P, steps, intro, set, prev) {
 clearTimeout(autoT); if (LENTA) intro = null;
 lockBoard(P, true); reset(); K().overview();
 document.documentElement.classList.remove('mx-fin');
 const list = prev ? prev.steps : typeof steps === 'function' ? steps() : steps;
 const run = S = {P, set: set || P.id, steps: list, res: prev ? prev.res.slice() : [], audio: null, src: steps, again: () => start(P, steps, intro, set)};
 if (run.set !== 'katalog') paused = null;
 exit(() => LENTA && alive(run) ? cut(run) : end(P));
 post({type: 'proverka-set', set: run.set});
 mx.classList.add('on'); stage().innerHTML = '';
 if (LENTA && !prev && run.set !== 'katalog') {zvuk('sting-test'); await wait(1400); if (!alive(run)) return;}
 if (intro && !prev) {await intro(run); if (!alive(run)) return;}
 for (let i = run.res.length; i < list.length; i++) {
  if (!alive(run)) return;
  stage().innerHTML = ''; tray(''); msg(''); row();
  await catClosed(); if (!alive(run)) return;
  const st = list[i], r = await EX[st.kind](st, run, i) || 'again';
  if (!alive(run)) return;
  run.res.push([st.name, r, st.kind]); saveSkill(st.kind, r); sfx('step');
  if (!(LENTA && run.set === 'katalog')) post({type: 'proverka', kind: st.kind, r, set: run.set});
  await wait(700);
 }
 await catClosed(); if (alive(run)) final(run);
}
const title = (i, t) => `Задание ${i + 1} из ${S.steps.length} · ${t}`;

function final(run, again) {
 if (LENTA) return finalLenta(run, again);
 stage().innerHTML = ''; tray(''); document.documentElement.classList.add('mx-fin'); sfx('fin');
 post({type: 'proverka-itog', set: run.set, res: run.res.map(([, r, kind]) => ({kind, r}))});
 card('Проверка пройдена!', `Вот что у тебя получилось:${Kit.facts(run.res.map(([n, r]) => [esc(n), r]), MARK)}`); msg(''); say('x_done');
 row(['Вернуться к мультику', () => end(run.P), ''], ['↺ Пройти ещё раз', () => {const a = run.again; end(run.P); a();}, 'light'], ['? Все виды заданий', catalog, 'light']);
}
function finalLenta(run, again) {
 if (run.set === 'katalog') return katalogDone(run);
 stage().innerHTML = ''; tray(''); exit(null); document.documentElement.classList.add('mx-fin');
 const done = run.res.map(([n, r]) => [esc(n), r]), left = run.cut ? run.steps.slice(run.res.length).map(s => [esc(s.name), 'skip']) : [];
 const rest = !!(run.cut && run.src && run.res.length < run.steps.length);
 if (!run.cut) {LAST = run; saveLast(run);}
 if (!again && !run.cut) {sfx('fin'); post({type: 'proverka-itog', set: run.set, res: run.res.map(([, r, kind]) => ({kind, r}))});}
 card(run.cut ? 'Проверка остановлена' : 'Проверка пройдена!',
  (run.cut ? (done.length ? 'Вот что ты успел:' : 'Задания ещё не пройдены:') : 'Вот что у тебя получилось:') + Kit.facts(done.concat(left), MARK));
 msg(''); if (!again && !run.cut) say('x_done');
 row(rest ? ['Продолжить проверку →', () => {end(run.P); resume(run);}, ''] : null,
  IN_LESSON ? ['Дальше →', () => post({type: 'next'}), rest ? 'light' : ''] : null,
  rest ? null : ['↺ Пройти ещё раз', () => {const a = run.again; end(run.P); a();}, IN_LESSON ? 'light' : ''],
  ['Посмотреть мультик ещё раз', () => {end(run.P); replay();}, 'light']);
}
function katalogDone(run) {
 stage().innerHTML = ''; tray(''); exit(null); document.documentElement.classList.add('mx-fin');
 const p = paused, done = run.res.map(([n, r]) => [esc(n), r]);
 card(done.length ? 'Задание из каталога пройдено' : 'Задание из каталога остановлено',
  done.length ? `Вот что получилось:${Kit.facts(done, MARK)}` : 'Его можно пройти позже: в каталоге «?».');
 msg(''); if (done.length) {sfx('fin'); say('x_done');}
 row(p ? ['Вернуться к проверке →', () => {end(run.P); resume(p);}, '']
  : LAST ? ['К итогу проверки →', () => {const l = LAST; end(run.P); reopen(l); final(l, true);}, '']
  : ['Начать проверку →', () => {end(run.P); (window.PROVERKA || window.PROVERKI.v1).start();}, ''],
  ['? Все виды заданий', catalog, 'light']);
}
function end(P) {if (S?.audio) S.audio.pause(); S = null; Kit.stopRec(false); Kit.hush(); mx.classList.remove('on'); stage().innerHTML = '';
 document.documentElement.classList.remove('mx-fin'); reset(); lockBoard(P, false); K()?.overview();}
function skills() { try { return JSON.parse(localStorage.getItem(NAV) || '{}'); } catch (e) { return {}; } }
function saveSkill(kind, r) { try { const s = skills(); s[kind] = r; localStorage.setItem(NAV, JSON.stringify(s)); } catch (e) {} }

// ── drag and drop (a copy follows the finger, the place under it lights up; a short tap selects, a second tap drops)
function dnd(itemSel, targetSel, drop) {
 const items = () => document.querySelectorAll(itemSel), targets = () => [...document.querySelectorAll(targetSel)];
 let sel = null;
 const select = it => {sel = sel === it ? null : it; items().forEach(x => x.classList.toggle('sel', x === sel)); targets().forEach(t => t.classList.toggle('want', !!sel));};
 const at = (x, y) => targets().find(t => {const r = t.getBoundingClientRect(); return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;});
 targets().forEach(t => t.onclick = e => {e.stopPropagation(); if (sel) {const it = sel; select(null); targets().forEach(x => x.classList.remove('want')); drop(it, t);}});
 items().forEach(it => {
  it.onpointerdown = e => {if (it.disabled) return; e.preventDefault(); it.setPointerCapture(e.pointerId);
   const g = it.cloneNode(true); g.classList.add('mx-ghost'); document.body.appendChild(g);
   const d = {x: e.clientX, y: e.clientY, moved: 0, over: null}, put = (x, y) => {g.style.left = x + 'px'; g.style.top = y + 'px';}; put(e.clientX, e.clientY);
   it.onpointermove = ev => {d.moved += Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y); d.x = ev.clientX; d.y = ev.clientY; put(ev.clientX, ev.clientY); g.style.opacity = d.moved > 6 ? 1 : 0;
    const t = at(ev.clientX, ev.clientY); if (t !== d.over) {d.over?.classList.remove('over'); t?.classList.add('over'); d.over = t;}};
   it.onpointerup = ev => {it.onpointermove = it.onpointerup = null; g.remove(); d.over?.classList.remove('over');
    if (d.moved <= 6) {select(it); return;}
    const t = at(ev.clientX, ev.clientY); if (t) {select(null); targets().forEach(x => x.classList.remove('want')); drop(it, t);}};
  };
 });
}
const icon = (z, cls = 'vv-ic') => z ? `<img class="${cls}" src="${PAN(z)}" alt="" draggable="false">` : '';

const EX = {};

// ── 1. order (a timeline arrow with slots; every step: Q.lenta.steps[] = {text, items:[[name, clue, panel?]], done})
const mixed = a => {let m; do m = shuffle(a); while (a.length > 1 && m.every((x, k) => x === a[k])); return m;};
function strip(n, cls = '') {return `<div class="vv-lenta ${cls}" style="--n:${n}"><div class="vv-ends"><i>← раньше</i><i>позже →</i></div>
 <div class="vv-slots">${Array.from({length: n}, (_, k) => `<div class="mx-drop vv-slot" data-k="${k}"><i>${k + 1}</i></div>`).join('')}</div></div>`;}
function orderStep(list, run, finalText) {
 return new Promise(done => {let miss = 0, left = list.length; const tries = {};
  const bind = () => dnd('.pv-tray .mx-chip:not([disabled])', '.vv-slot:not(.ok)', (c, t) => {const k = +c.dataset.k;
   if (String(k) === t.dataset.k) {t.classList.add('ok'); t.classList.remove('hint'); t.innerHTML = `<span>${icon(list[k][2], 'vv-ic s')}${esc(list[k][0])}</span>`; c.remove(); left--; good(t); msg('');
    if (!left) {tray(''); msg(finalText, 'ok'); setTimeout(() => done(miss), 2400); return;}}
   else {miss++; tries[k] = (tries[k] || 0) + 1; bad(c);
    if (tries[k] >= 2) {stage().querySelector(`.vv-slot[data-k="${k}"]`)?.classList.add('hint'); msg(`${list[k][1]} Подсказка: нужная ячейка мигает.`, 'no');}
    else msg(list[k][1], 'no');}
   bind();});
  bind();});
}
EX.lenta = async (st, run, i) => {
 let miss = 0;
 for (const [n, step] of Q.lenta.steps.entries()) {
  if (!alive(run)) return;
  const L = step.items;
  stage().innerHTML = `<div class="vv-lwrap vv-l3"><div class="vv-ltitle">${esc(step.title || '')}</div>${strip(L.length, L.length < 4 ? 'big' : '')}</div>`;
  card(n ? null : title(i, Q.names.lenta), step.text); msg(''); say(n ? 'x_lenta2' : 'x_lenta');
  tray(`<div class="mx-chips">${mixed(L.map((x, k) => k)).map(k => `<button type="button" class="mx-chip vv-icchip" data-k="${k}">${icon(L[k][2])}${esc(L[k][0])}</button>`).join('')}</div>`);
  miss += await orderStep(L, run, step.done);
 }
 return grade(miss);
};

// ── 2. label a picture (Q.karta = {img, ar, text, places:{id:{at:[x,y], name, clue}}, decoy:{name, why}})
EX.karta = async (st, run, i) => {
 const D = Q.karta, ids = Object.keys(D.places), tries = {}; let miss = 0, left = ids.length;
 stage().innerHTML = `<div class="mx-pic vv-karta" style="--ar:${D.ar || 1.792}"><img src="${ART()}${D.img}.webp" alt="" draggable="false">
  ${ids.map(id => {const [x, y] = D.places[id].at; return `<div class="mx-drop mx-room vv-place" data-id="${id}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%"><i>?</i></div>`;}).join('')}</div>`;
 card(title(i, Q.names.karta), D.text); say('x_karta');
 tray(`<div class="mx-chips">${shuffle([...ids, D.decoy ? '_decoy' : null].filter(Boolean)).map(id => `<button type="button" class="mx-chip" data-id="${id}">${esc(id === '_decoy' ? D.decoy.name : D.places[id].name)}</button>`).join('')}</div>`);
 await new Promise(done => {const bind = () => dnd('.pv-tray .mx-chip:not([disabled])', '.vv-place:not(.ok)', (c, t) => {const id = c.dataset.id;
  if (id === '_decoy') {miss++; bad(c); c.disabled = true; c.classList.add('off'); msg(D.decoy.why, 'no');}
  else if (id === t.dataset.id) {t.classList.add('ok'); t.classList.remove('hint'); t.innerHTML = `<span>${esc(D.places[id].name)}</span>`; c.remove(); left--; good(t); msg('');
   if (!left) {tray(''); msg(D.done || 'Всё подписано!', 'ok'); setTimeout(done, 1500); return;}}
  else {miss++; tries[id] = (tries[id] || 0) + 1; bad(c);
   if (tries[id] >= 2) {stage().querySelector(`.vv-place[data-id="${id}"]`)?.classList.add('hint'); msg(`${D.places[id].clue} Подсказка: нужный кружок мигает.`, 'no');}
   else msg(D.places[id].clue, 'no');}
  bind();}); bind();});
 return grade(miss);
};

// ── 3. pairs "word and meaning": tap a word, then its meaning
EX.pairs = async (st, run, i) => {
 const ps = shuffle(Q.pairs).slice(0, st.n || 5); let miss = 0, left = ps.length, sel = {}, found = 0; const tries = {};
 const L = shuffle(ps.map((p, k) => [p[0], k])), R = shuffle(ps.map((p, k) => [p[1], k]));
 stage().innerHTML = `<div class="mx-pairs"><div class="mx-col">${L.map(([t, k]) => `<button type="button" class="mx-pair l" data-k="${k}">${esc(t)}</button>`).join('')}</div>
  <div class="mx-col">${R.map(([t, k]) => `<button type="button" class="mx-pair r" data-k="${k}">${esc(t)}</button>`).join('')}</div></div>`;
 card(title(i, Q.names.pairs), 'Найди пары: выбери слово, затем его значение.'); say('x_pairs');
 await new Promise(done => {stage().querySelectorAll('.mx-pair').forEach(b => b.onclick = () => {
  if (b.disabled || !alive(run)) return; const side = b.classList.contains('l') ? 'l' : 'r';
  if (sel[side] === b) {b.classList.remove('sel'); sel[side] = null; return;}
  sel[side]?.classList.remove('sel'); sel[side] = b; b.classList.add('sel');
  if (!sel.l || !sel.r) return;
  const a = sel.l, c = sel.r; sel = {}; a.classList.remove('sel'); c.classList.remove('sel');
  if (a.dataset.k === c.dataset.k) {found++; a.disabled = c.disabled = true; a.classList.add('done'); c.classList.add('done'); stage().querySelectorAll('.mx-pair.hint').forEach(x => x.classList.remove('hint'));
   for (const x of [a, c]) x.insertAdjacentHTML('afterbegin', `<i class="vv-pn">${found}</i>`); good(a); Kit.fx(c, 'ok'); left--; msg('');
   if (!left) {msg('Все пары найдены!', 'ok'); setTimeout(done, 1300);}}
  else {miss++; bad(a); Kit.fx(c, 'no'); const k = a.dataset.k; tries[k] = (tries[k] || 0) + 1;
   if (tries[k] >= 2) {stage().querySelector(`.mx-pair.r[data-k="${k}"]`)?.classList.add('hint'); msg(`Подсказка: значение слова «${esc(a.textContent)}» мигает.`, 'no');}
   else msg('Это не пара. Попробуй ещё.', 'no');}});});
 return grade(miss);
};

// ── 4. true or a mistake (a button or a swipe: right = true, left = mistake)
function swipe(el, done) {let x0 = null;
 el.onpointerdown = e => {x0 = e.clientX; el.setPointerCapture(e.pointerId); el.style.transition = 'none';};
 el.onpointermove = e => {if (x0 == null) return; const dx = e.clientX - x0; el.style.transform = `translateX(${dx}px) rotate(${dx / 28}deg)`; el.dataset.lean = dx > 40 ? 'yes' : dx < -40 ? 'no' : '';};
 el.onpointerup = e => {if (x0 == null) return; const dx = e.clientX - x0; x0 = null; el.style.transition = ''; el.style.transform = ''; el.dataset.lean = '';
  if (Math.abs(dx) > 90) {el.onpointerdown = el.onpointermove = el.onpointerup = null; done(dx > 0);}};}
EX.tf = async (st, run, i) => {
 const half = Math.round(st.n / 2), list = shuffle([...shuffle(Q.tf.filter(x => x.ok)).slice(0, half), ...shuffle(Q.tf.filter(x => !x.ok)).slice(0, st.n - half)]); let miss = 0;
 say('x_tf');
 for (const [k, x] of list.entries()) {
  if (!alive(run)) return;
  card(title(i, Q.names.tf), 'Прочитай и реши: это верно или ошибка? Нажми кнопку или смахни карточку: вправо значит верно, влево значит ошибка.'); msg(''); row();
  stage().innerHTML = `<div class="mx-tf"><div class="mx-tfcard"><img src="${PAN(x.img)}" alt="" draggable="false"><p>${esc(x.t)}</p><em>${k + 1} из ${list.length}</em><b class="mx-stamp"></b></div></div>`;
  tray(`<div class="mx-tfbtns"><button type="button" class="mx-tfb no" data-v="0">✗ Ошибка</button><button type="button" class="mx-tfb yes" data-v="1">✓ Верно</button></div>`);
  const v = await new Promise(done => {document.querySelectorAll('.mx-tfb').forEach(b => b.onclick = () => done(b.dataset.v === '1')); swipe(stage().querySelector('.mx-tfcard'), done);});
  if (!alive(run)) return;
  const hit = v === x.ok, c = stage().querySelector('.mx-tfcard'); tray('');
  c.classList.add(hit ? 'right' : 'wrong', x.ok ? 'is-true' : 'is-false'); c.querySelector('.mx-stamp').textContent = x.ok ? 'Верно' : 'Ошибка';
  if (hit) good(c); else {miss++; bad(c);}
  msg(hit ? (x.ok ? 'Правильно: это верно.' : `Правильно, здесь ошибка: ${x.why}`) : (x.ok ? 'Нет, это как раз верно.' : `Нет, здесь ошибка: ${x.why}`), hit ? 'ok' : 'no');
  await wait(hit ? 1300 : 2900);
 }
 return grade(miss);
};

// ── 5. blanks in the sheet (Q.cloze = {title, lines:[[before, word, after]], extra:[...]})
const flashBlank = b => {b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 600);};
EX.cloze = async (st, run, i) => {
 const blanks = []; let miss = 0;
 stage().innerHTML = `<div class="mx-sheet"><div class="mx-sheet-t">${esc(Q.cloze.title)}</div>${Q.cloze.lines.map((l, n) => `<p><b>${n + 1}</b><span>${l.map((p, j) => j % 2 ? (blanks.push(p), `<span class="mx-blank" data-w="${esc(p)}" style="--len:${p.length}"></span>`) : esc(p)).join('')}</span></p>`).join('')}</div>`;
 let left = blanks.length;
 card(title(i, Q.names.cloze), 'Заполни пропуски: перетащи слова на пустые места.<span class="pv-sub">Осторожно: есть лишние слова.</span>'); say('x_cloze');
 tray(`<div class="mx-chips">${shuffle([...blanks, ...(Q.cloze.extra || [])]).map(w => `<button type="button" class="mx-chip" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>`);
 await new Promise(done => {const bind = () => dnd('.pv-tray .mx-chip:not([disabled])', '.mx-blank:not(.ok)', (c, b) => {
  if (c.dataset.w === b.dataset.w) {b.classList.add('ok'); b.textContent = c.dataset.w; c.remove(); left--; good(b); msg('');
   if (!left) {document.querySelectorAll('.pv-tray .mx-chip').forEach(x => {x.disabled = true; x.classList.add('off');}); msg('Лист заполнен! Лишние слова не понадобились.', 'ok'); setTimeout(done, 1700); return;}}
  else {miss++; bad(c); flashBlank(b); msg('Не подходит. Прочитай строку целиком.', 'no');}
  bind();}); bind();});
 return grade(miss);
};

// ── 6. captions for frames: 3 panels + a caption with a mistake (Q.caps = {panel id: caption}, Q.lies = [{t, why}])
EX.caps = async (st, run, i) => {
 const ids = st.panels, lies = shuffle(Q.lies).slice(0, st.lies || 1); let miss = 0, left = ids.length;
 stage().innerHTML = `<div class="mx-panels" style="--n:${ids.length}">${ids.map(id => `<div class="mx-panel" data-id="${id}"><img src="${PAN(id)}" alt="" draggable="false"><div class="mx-cap"><i>перетащи сюда подпись</i></div></div>`).join('')}</div>`;
 card(title(i, Q.names.caps), `Подбери к каждой картинке подпись и перетащи её под картинку.<span class="pv-sub">${lies.length > 1 ? 'Две подписи лишние: в них ошибки.' : 'Одна подпись лишняя: в ней ошибка.'}</span>`); say('x_caps');
 const cards = shuffle([...ids.map(id => ({t: Q.caps[id], id})), ...lies.map((l, j) => ({t: l.t, lie: j}))]);
 tray(`<div class="mx-caps" style="--n:${Math.min(4, cards.length)}">${cards.map(c => `<button type="button" class="mx-capcard" ${c.lie != null ? `data-lie="${c.lie}"` : `data-id="${c.id}"`}>${esc(c.t)}</button>`).join('')}</div>`);
 await new Promise(done => {const bind = () => dnd('.mx-capcard:not([disabled])', '.mx-panel:not(.ok) .mx-cap', (c, z) => {const p = z.closest('.mx-panel');
  if (c.dataset.lie != null) {miss++; c.disabled = true; c.classList.add('lie'); bad(c); msg(`В этой подписи ошибка: ${lies[+c.dataset.lie].why}`, 'no');}
  else if (c.dataset.id === p.dataset.id) {z.innerHTML = ''; z.appendChild(c); c.disabled = true; p.classList.add('ok'); left--; good(p); msg('');
   if (!left) {document.querySelectorAll('.mx-capcard[data-lie]:not(.lie)').forEach(x => {x.disabled = true; x.classList.add('lie');});
    msg(lies.length > 1 ? 'Все картинки подписаны! Подписи с ошибками остались лишними.' : 'Все картинки подписаны! Подпись с ошибкой осталась лишней.', 'ok'); setTimeout(done, 1900); return;}}
  else {miss++; bad(c); msg('Эта подпись подходит к другой картинке.', 'no');}
  bind();}); bind();});
 return grade(miss);
};

// ── 7. find the mistake in a phrase (Q.errs = {id:{img, show, wrong, fix:[right, ...wrong]}}). The phrase is read aloud
// when the scene has a voiced track for it (Q.errAudio = {audio, beats}); otherwise it is shown only.
let ERRB = null;
const errBeats = () => ERRB || (ERRB = Q.errAudio ? fetch(Q.errAudio.beats).then(r => r.json()).then(d => Object.fromEntries(d.beats.map(b => [b.id, b]))).catch(() => ({})) : Promise.resolve({}));
function play(b) {if (!b || !Q.errAudio || !S || cat?.classList.contains('on')) return; Kit.hush(); const a = S.audio || (S.audio = new Audio(Q.errAudio.audio));
 a.pause(); a.currentTime = Math.max(0, b.start - .05); a.play().catch(() => {}); clearInterval(a._iv);
 a._iv = setInterval(() => {if (a.currentTime >= b.end + .15 || a.paused) {clearInterval(a._iv); a.pause();}}, 60);}
const bare = w => w.replace(/[.,!?«»:;\u2014]/g, '');
EX.err = async (st, run, i) => {
 const B = await errBeats(); let miss = 0;
 for (const [k, id] of st.items.entries()) {
  if (!alive(run)) return;
  const e = Q.errs[id], b = B[id];
  stage().innerHTML = `<div class="mx-pic mx-err" style="--ar:${e.ar || 1.778}"><img src="${PAN(e.img)}" alt="" draggable="false">
   <div class="mx-bubble${e.low ? ' low' : ''}"><small>${esc(TUTOR)}</small><p>${e.show.split(/(\s+)/).map(w => /^\s+$/.test(w) ? w : `<span class="mx-w">${esc(w)}</span>`).join('')}</p></div></div>`;
  card(title(i, Q.names.err + (st.items.length > 1 ? ` · ${k + 1} из ${st.items.length}` : '')), `${b ? 'Послушай' : 'Прочитай'}: в этой фразе одно слово неверное. Найди его и нажми на него.`); msg('');
  row(b ? ['▶ Послушать ещё раз', () => play(b), 'light'] : null);
  let tries = 0;
  const intro = k === 0 ? (say('x_err'), wait(sayLen('x_err'))) : Promise.resolve();
  intro.then(() => {if (alive(run) && !stage().querySelector('.mx-w.bad,.mx-w.fixed')) play(b);});
  await new Promise(done => {const ws = stage().querySelectorAll('.mx-w'); ws.forEach(w => w.onclick = () => {
   if (!alive(run)) return;
   if (bare(w.textContent) === e.wrong) {
    const right = e.fix[0];
    ws.forEach(x => {x.onclick = null; x.classList.remove('hint');}); w.classList.add('bad'); S.audio?.pause(); Kit.hush(); row(); good(w);
    msg('Точно, ошибка здесь! А как правильно?', 'ok');
    tray(`<div class="mx-chips">${shuffle(e.fix).map(f => `<button type="button" class="mx-chip" data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>`);
    document.querySelectorAll('.pv-tray .mx-chip').forEach(c => c.onclick = () => {if (c.disabled) return;
     if (c.dataset.f === right) {w.textContent = w.textContent.replace(e.wrong, right); w.classList.replace('bad', 'fixed'); tray(''); good(w); msg('Правильно! Теперь во фразе всё верно.', 'ok'); setTimeout(done, 1600);}
     else {miss++; bad(c); c.disabled = true; c.classList.add('off'); msg('Нет, не так. Вспомни мультик.', 'no');}});
   } else {miss++; tries++; bad(w);
    if (tries >= 2) {ws.forEach(x => {if (bare(x.textContent) === e.wrong) x.classList.add('hint');}); msg('Подсказка: слово с ошибкой мигает.', 'no');}
    else msg('Это слово верное. Ищи другое.', 'no');}});});
 }
 return grade(Math.ceil(miss / st.items.length));
};

// ── 8. answer in your own words (Q.voice = {id:{text, imgs, hint, ...rubric for the offline judge}})
function bubble(who, html) {const log = stage().querySelector('.mx-chat'); if (!log) return; const b = document.createElement('div'); b.className = 'rz-b ' + who;
 b.innerHTML = `<small>${who === 'tutor' ? esc(TUTOR) : 'Ты'}</small><p>${html}</p>`; log.appendChild(b); while (log.children.length > 3) log.firstElementChild.remove();
 requestAnimationFrame(() => {b.classList.add('in'); inView(b);});}
function inView(el) {const cs = getComputedStyle(mx), top = parseFloat(cs.paddingTop), bottom = innerHeight - parseFloat(cs.paddingBottom) - 8, r = el.getBoundingClientRect();
 const d = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top < top ? r.top - top : 0; if (d) mx.scrollBy({top: d, behavior: 'smooth'});}
EX.voice = async (st, run, i) => {
 const v = Q.voice[st.q]; let attempt = 1, res = 'again';
 stage().innerHTML = `<div class="mx-voice"><div class="mx-vpics" style="--n:${v.imgs.length}">${v.imgs.map(id => `<img src="${PAN(id)}" alt="" draggable="false">`).join('')}</div><div class="mx-chat"></div></div>`;
 card(title(i, Q.names.voice), `${esc(v.text)}<span class="pv-sub">Нажми на микрофон и ответь своими словами, или напиши ответ.</span>`);
 bubble('tutor', esc(v.text)); say(v.voice);
 await new Promise(done => {const ask = () => micTray({placeholder: 'Напиши свой ответ', onSend: async ans => {
  const t = Kit.$('.pv-tray'); t.classList.add('busy'); msg(`${esc(TUTOR)} слушает твой ответ…`, 'wait');
  const j = await judge(st.q, attempt, ans); if (!alive(run)) return; t.classList.remove('busy');
  if (j.error) {msg(esc(j.error), 'no'); return;}
  msg(''); tray(''); bubble('kid', `«${esc(j.text)}»`); bubble('tutor', esc(j.feedback)); await tutor(j.feedback); if (!alive(run)) return;
  if (j.verdict === 'full' || attempt >= 2) {res = j.verdict === 'full' ? (attempt > 1 ? 'help' : 'ok') : 'again';
   card(null, `${esc(v.text)}<span class="pv-sub">${j.verdict === 'full' ? 'Молодец! Хороший ответ.' : 'Прочитай ответ выше: так было в мультике.'}</span>`); done(); return;}
  attempt++; card(null, `${esc(v.text)}<span class="pv-sub">${j.verdict === 'no' ? 'Попробуй ещё раз. ' + esc(v.hint) : 'Дополни свой ответ.'}</span>`); ask();
  requestAnimationFrame(() => requestAnimationFrame(() => {const l = stage().querySelector('.mx-chat')?.lastElementChild; if (l) inView(l);}));}}); ask();});
 if (!alive(run)) return;
 await new Promise(done => row(['Дальше →', done, '']));
 return res;
};
// Offline judge for the static demo: the answer is matched against keyword groups (word stems). full = enough
// groups named, partial = some, no = none. A server judge (speech recognition + an LLM rubric) replaces it when
// window.QUIZ_API is set (see quiz/proverki-kit.js).
window.PvLocalJudge = (q, attempt, text) => {
 const v = Q.voice[q], low = ' ' + String(text).toLowerCase().replace(/ё/g, 'е') + ' ';
 const hit = v.groups.map(g => g.stems.some(s => low.includes(s)));
 const n = hit.filter(Boolean).length, need = v.need || v.groups.length;
 const verdict = n >= need ? 'full' : n > 0 ? 'partial' : 'no';
 const missing = v.groups.filter((g, k) => !hit[k]).map(g => g.name);
 const feedback = verdict === 'full' ? v.full : verdict === 'partial' ? `${v.partial} ${missing.length ? 'Ещё: ' + missing.join(', ') + '.' : ''}`.trim() : v.none;
 return {text, verdict, feedback};
};

// ── sets: v1 rotates the kinds Duolingo-style (the kinds with mistakes last time come back first)
const NAMES = Q.names;
function rng(seed) {return () => {seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;};}
const shuf = (a, r) => {a = [...a]; for (let i = a.length - 1; i > 0; i--) {const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];} return a;};
const KINDS = ['lenta', 'karta', 'pairs', 'tf', 'cloze', 'caps', 'err'];
function stepFor(kind, r, q) {const s = {kind, name: NAMES[kind]};
 if (kind === 'tf') s.n = 5;
 if (kind === 'err') s.items = shuf(Object.keys(Q.errs), r).slice(0, 2);
 if (kind === 'caps') {s.panels = shuf(Object.keys(Q.caps), r).slice(0, 3); s.lies = 1;}
 if (kind === 'pairs') s.n = 5;
 if (kind === 'voice') {s.q = q || shuf(Object.keys(Q.voice), r)[0]; s.name = NAMES.voice + ': ' + Q.voice[s.q].text;}
 return s;}
function seed() { try { let s = +localStorage.getItem(SEED); if (!s) {s = Math.floor(Math.random() * 1e9) + 1; localStorage.setItem(SEED, s);} return s; } catch (e) { return 12345; } }
function reseed() { try { localStorage.setItem(SEED, Math.floor(Math.random() * 1e9) + 1); } catch (e) {} }
const r0 = () => rng(Math.floor(Math.random() * 1e9) + 1);
const RANK = {again: 0, help: 1, ok: 2};
// v1: 3 kinds, the worst remembered results first (unseen kinds rank between "help" and "ok"), ties in seeded order
function planV1() {const sd = seed(), sk = skills(), r = rng(sd);
 const kinds = shuf(KINDS, r).map((k, j) => [k, RANK[sk[k]] ?? 1.5, j]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, 3).map(x => x[0]);
 const steps = kinds.map((k, j) => stepFor(k, rng(sd + 7 * (j + 1)))).concat(stepFor('voice', r, Object.keys(Q.voice)[0]));
 steps.meta = kinds.map(k => ({k, tag: sk[k] === 'again' ? 'повтор: было много ошибок' : sk[k] === 'help' ? 'повтор: были ошибки' : sk[k] ? 'для закрепления' : 'новое'})).concat({k: 'voice', tag: 'голосом'});
 return steps;}
function setV2() {const sd = seed() + 1, r = rng(sd), v1 = new Set(planV1().map(s => s.kind));
 const pool = KINDS.filter(k => !v1.has(k)), kinds = shuf(pool.length >= 3 ? pool : KINDS, r).slice(0, 3);
 return [...kinds.map((k, j) => stepFor(k, rng(sd + 7 * (j + 1)))), stepFor('voice', r, Object.keys(Q.voice)[1] || Object.keys(Q.voice)[0])];}
const setAll = () => KINDS.map(k => stepFor(k, r0())).concat(stepFor('voice', r0(), Object.keys(Q.voice)[0]));
function setIntro(head, another) {return async run => {
 const n = run.steps.length, meta = run.steps.meta;
 card(head, `Тебя ждут ${n} ${n < 5 ? 'задания' : 'заданий'}:<ul class="mx-plan">${run.steps.map((s, j) => `<li><b>${NAMES[s.kind]}</b><em>${meta ? meta[j].tag : s.kind === 'voice' ? esc(Q.voice[s.q].text) : esc(Q.about[s.kind][1])}</em></li>`).join('')}</ul>`);
 await new Promise(done => row(['Начать', done, ''], another ? ['↻ Другой набор', () => {reseed(); const P = window.PROVERKI.v2; end(run.P); window.PROVERKA = P; P.start();}, 'light'] : null));
};}

// ── the catalogue "?" of every kind
const CAT_ORDER = ['lenta', 'karta', 'pairs', 'tf', 'cloze', 'caps', 'err', 'voice'];
const im = (src, cls = '') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
const THUMB = {
 lenta: () => im(PAN(Q.thumbs.lenta)) + '<i class="vv-th-lenta"><b></b><b></b><b></b><b></b></i>',
 karta: () => im(ART() + Q.karta.img + '.webp') + Object.values(Q.karta.places).slice(0, 2).map(p => `<i class="mx-th-q" style="left:${(p.at[0] * 100).toFixed(1)}%;top:${(p.at[1] * 100).toFixed(1)}%">?</i>`).join(''),
 pairs: () => `<i class="mx-th-pairs">${Q.pairs.slice(0, 2).map(p => `<b>${esc(p[0])}</b><b>${esc(p[1])}</b>`).join('')}</i>`,
 tf: () => im(PAN(Q.thumbs.tf)) + '<i class="mx-th-tf"><b class="no">✗</b><b class="yes">✓</b></i>',
 cloze: () => `<i class="mx-th-sheet"><b>${esc(Q.cloze.title)}</b>${Q.cloze.lines.slice(0, 2).map(l => `<span>${esc(l[0])}<u></u>${esc(l[2])}</span>`).join('')}</i>`,
 caps: () => im(PAN(Q.thumbs.caps)) + '<i class="mx-th-cap">подпись</i>',
 err: () => {const e = Object.values(Q.errs)[0]; return im(PAN(e.img)) + `<i class="mx-th-bub">${esc(e.show.replace(e.wrong, '\u0000')).replace('\u0000', `<s>${esc(e.wrong)}</s>`)}</i>`;},
 voice: () => im(PAN(Q.thumbs.voice)) + '<i class="mx-th-mic"><svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg></i>'};
let cat = null, opener = null;
const catClosed = () => new Promise(r => {const c = () => cat?.classList.contains('on') ? setTimeout(c, 200) : r(); c();});
addEventListener('keydown', e => {if (!cat?.classList.contains('on')) return; e.stopImmediatePropagation();
 if (e.key === 'Escape') {e.preventDefault(); closeCatalog();}}, true);
function catalog() {
 if (!cat) {cat = document.createElement('div'); cat.className = 'mx-cat'; cat.setAttribute('role', 'dialog'); cat.setAttribute('aria-modal', 'true'); cat.setAttribute('aria-label', 'Все виды заданий'); document.body.appendChild(cat);}
 opener = document.activeElement; Kit.stopRec(false);
 const P = S && S.steps.length > 1 ? S.P : window.PROVERKA, kinds = S && S.steps.length > 1 ? S.steps.map(s => s.kind) : (P?.tag ? P.kinds() : null);
 const inSet = !LENTA && kinds && P?.tag ? new Set(kinds) : null;
 cat.innerHTML = `<div class="mx-cat-in"><button type="button" class="mx-cat-x">✕ Закрыть</button>
  <h2>Все виды заданий</h2><p class="mx-cat-sub">Здесь все виды заданий к мультику. Нажми «Попробовать», чтобы пройти любое из них.</p>
  <div class="mx-cat-grid">${CAT_ORDER.map((k, i) => `<div class="mx-cat-card"><div class="mx-cat-th">${THUMB[k]()}</div>
   <b><span>${i + 1}</span>${esc(Q.about[k][0])}</b><p>${esc(Q.about[k][1])}</p>${inSet?.has(k) ? `<em>${P.tag}</em>` : ''}
   <button type="button" class="pv-btn" data-k="${k}">Попробовать</button></div>`).join('')}</div></div>`;
 cat.querySelector('.mx-cat-x').onclick = closeCatalog;
 cat.querySelectorAll('[data-k]').forEach(b => b.onclick = () => tryKind(b.dataset.k));
 Kit.hush(); S?.audio?.pause(); cat.classList.add('on'); cat.scrollTop = 0;
 for (const e of document.body.children) if (e !== cat) e.inert = true;
 cat.querySelector('.mx-cat-x').focus();
}
function closeCatalog() {if (!cat?.classList.contains('on')) return; cat.classList.remove('on'); for (const e of document.body.children) e.inert = false; opener?.focus?.();}
function tryKind(k) {const P = window.PROVERKA || window.PROVERKI.v1; closeCatalog(); if (!P?.miks) return;
 if (LENTA && S && S.set !== 'katalog' && S.src && S.res.length < S.steps.length) paused = {P: S.P, src: S.src, set: S.set, steps: S.steps, res: S.res.slice()};
 if (S) end(S.P); window.PROVERKA = P;
 start(P, [stepFor(k, r0())], null, 'katalog');}
const helpBtn = document.createElement('button'); helpBtn.type = 'button'; helpBtn.className = 'mx-help'; helpBtn.textContent = '?';
helpBtn.title = 'Все виды заданий'; helpBtn.setAttribute('aria-label', 'Все виды заданий'); helpBtn.onclick = catalog; mx.appendChild(helpBtn);
document.addEventListener('DOMContentLoaded', () => {const q = window.kino?.bd?.querySelector('.bd-quizbtn'); if (!q || !window.PROVERKA?.miks) return;
 const r = document.createElement('div'); r.className = 'bd-row'; q.replaceWith(r); const h = document.createElement('button'); h.type = 'button'; h.className = 'bd-btn light bd-help';
 h.textContent = '?'; h.title = 'Все виды заданий'; h.setAttribute('aria-label', 'Все виды заданий'); h.onclick = catalog; r.append(q, h);});

variant('v1', 'После мультика', planV1, setIntro('Проверь себя · после мультика', true), {tag: 'есть в наборе после мультика'});
variant('v2', 'Другой набор', setV2, setIntro('Проверь себя · другой набор', true), {tag: 'есть в другом наборе'});
variant('vall', 'Все задания', setAll, setIntro('Проверь себя · все задания', false));

if (LENTA && new URLSearchParams(location.search).get('fin') === '1') try {
 const d = JSON.parse(localStorage.getItem(ITOG) || 'null'), P = d && d.set === window.TEST && window.PROVERKI[d.set];
 if (P && Array.isArray(d.steps) && Array.isArray(d.res) && d.steps.length && d.res.length === d.steps.length)
  LAST = {P, set: d.set, steps: d.steps, res: d.res, src: null, audio: null, again: () => P.start()};
} catch (e) {}
})();
