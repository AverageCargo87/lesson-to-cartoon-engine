/* Cartoon player: drives a scene's paused GSAP timeline from the narration audio.
 *
 * A restructured port of the author's own production player code (audio clock, word-highlight subtitles, phrase
 * paging, grouped dots, postMessage protocol); later per-lesson extensions made by others are not included. Design:
 *  - the scene builds ONE paused GSAP timeline; the player never plays it. On every animation frame it sets
 *    tl.time(audio time). Seeking, rewinding, changing playbackRate or opening ?t=31 therefore all produce the
 *    same frame, exactly like scrubbing a video;
 *  - beats.json says when each phrase sounds; words.json (optional) gives word start/end times, so the subtitle
 *    highlights the word being spoken and long phrases are paged at punctuation;
 *  - a progress bar with one dot per phrase (grouped per window), a cover with a play button, "again" at the end;
 *  - the host page (a lesson shell) talks to the scene by postMessage: the scene sends ready / beat / end,
 *    the host may send {target:'multik', cmd:'play'|'pause'|'seek', t}.
 *
 *   Multik.run({build(tl,B,api){...}, cover:{kicker,title,sub}, audio:'narration.mp3', beats:'beats.json',
 *               player:{capGap, capWords, capPages, capLines, smoothClock, dotGroups}, finale:{label}, stops:[...]})
 *
 * Debug: ?t=31 opens a still frame at 31 s, ?beat=<id> opens a phrase, ?fin=1 jumps to the end (the board),
 * ?go=1 starts playing at once. window.multik exposes seek/play/finish/tl/audio/beats/total for tests.
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = {
    capGap: false, capGapAfter: 0.4, capGapMin: 1.5, // hide the subtitle in long pauses
    capWords: false,                                  // highlight the word being spoken
    capPages: false, capLines: 2,                     // page long phrases at , ; :
    capSmooth: null,                                  // morph the subtitle box between phrases (default: on with any cap* flag)
    smoothClock: false,                               // drive the timeline by a smoothed clock pulled towards audio time
    dotGroups: null, dotGap: 5, dotGapOff: 10.5       // first phrase ids of the windows: split the bar into segments
  };

  // ── small helpers ──────────────────────────────────────────────────────────────────────────────────────────
  function make(tag, cls, parent, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }
  const clockText = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const letters = s => [...String(s).toLowerCase().replace(/ё/g, 'е')].filter(ch => /[0-9a-zа-я]/.test(ch));
  function tell(msg) {
    if (parent === window) return;
    try { parent.postMessage(Object.assign({source: 'multik'}, msg), location.origin); } catch (e) { /* cross-origin host */ }
  }
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>',
    board: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2"/></svg>'
  };

  // ── word timing: map recognised words (ASR) onto the displayed words of a phrase ───────────────────────────
  // Both sides become letter sequences; each recognised letter gets an evenly split share of its word's time.
  // If the sequences are identical the mapping is 1:1, otherwise a longest-common-subsequence alignment is used
  // (hyphens, quotes and numbers often differ between the script and the recogniser).
  function lcsPairs(a, b) {
    const n = a.length, m = b.length, w = m + 1, T = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        T[i * w + j] = a[i] === b[j] ? T[(i + 1) * w + j + 1] + 1 : Math.max(T[(i + 1) * w + j], T[i * w + j + 1]);
      }
    }
    const pairs = [];
    for (let i = 0, j = 0; i < n && j < m;) {
      if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; } else if (T[(i + 1) * w + j] >= T[i * w + j + 1]) i++; else j++;
    }
    return pairs;
  }
  function timePhrase(beat, recognised) {
    const words = [];
    for (const m of beat.show.matchAll(/\S+/g)) words.push({text: m[0], at: m.index, s: null, e: null});
    let timed = false;
    if (recognised && recognised.length) {
      const shown = [], owner = [];
      words.forEach((w, k) => letters(w.text).forEach(ch => { shown.push(ch); owner.push(k); }));
      const heard = [], times = [];
      for (const [word, s, e] of recognised) {
        const ls = letters(word), d = (e - s) / (ls.length || 1);
        ls.forEach((ch, k) => { heard.push(ch); times.push([s + d * k, s + d * (k + 1)]); });
      }
      const pairs = shown.join('') === heard.join('') ? shown.map((_, i) => [i, i]) : lcsPairs(shown, heard);
      for (const [i, j] of pairs) {
        const w = words[owner[i]], [s, e] = times[j];
        w.s = w.s == null ? s : Math.min(w.s, s);
        w.e = w.e == null ? e : Math.max(w.e, e);
      }
      timed = pairs.length > 0;
    }
    // words without a time share the gap between their timed neighbours (or the whole phrase)
    for (let i = 0; i < words.length;) {
      if (words[i].s != null) { i++; continue; }
      let j = i;
      while (j < words.length && words[j].s == null) j++;
      const from = i ? words[i - 1].e : beat.start, to = j < words.length ? words[j].s : beat.end, step = (to - from) / (j - i);
      for (let k = i; k < j; k++) { words[k].s = from + step * (k - i); words[k].e = from + step * (k - i + 1); }
      i = j;
    }
    return {beat, words, timed, pages: null, layout: -1};
  }

  // ── the player ─────────────────────────────────────────────────────────────────────────────────────────────
  async function run(opts) {
    const base = opts.base || './';
    const beatsFile = opts.beats || 'beats.json';
    const data = await fetch(base + beatsFile).then(r => r.json());
    const beats = data.beats, total = data.total;
    const B = {};
    beats.forEach((b, i) => { b.i = i; b.dur = b.end - b.start; B[b.id] = b; });
    const P = Object.assign({}, DEFAULTS, window.KINO && window.KINO.player, opts.player);
    const capFlags = !!(P.capGap || P.capWords || P.capPages || P.capSmooth);
    const morphing = P.capSmooth != null ? !!P.capSmooth : capFlags;
    let WORDS = {};
    if (P.capWords || P.capPages) {
      const src = opts.words || P.words || beatsFile.replace(/beats([^/]*)$/, 'words$1');
      WORDS = typeof src === 'object' ? src : await fetch(base + src).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    }

    // timeline: built once by the scene, never played
    const tl = gsap.timeline({paused: true, defaults: {ease: 'power2.out'}});
    const api = {B, beats, total, tl, reduce: REDUCED, el: make};
    opts.build(tl, B, api);
    tl.set({}, {}, total);               // the timeline is never shorter than the audio
    tl.progress(1, true).progress(0, true); // render every tween once, so time 0 shows the first frame, not the last

    const audio = new Audio(base + (opts.audio || 'narration.mp3'));
    audio.preload = 'auto';

    // ── UI ──
    const ui = make('div', 'mk-ui', document.body);
    const cap = document.querySelector('.mk-cap') || make('div', 'mk-cap', ui);
    const capText = cap.querySelector('.mk-cap-text') || make('span', 'mk-cap-text', cap);
    const capBox = capText.parentElement || cap;
    const bar = make('div', 'mk-bar', ui);
    const playBtn = make('button', 'mk-play', bar);
    playBtn.type = 'button';
    const track = make('div', 'mk-track', bar);
    const fill = make('div', 'mk-fill', track);
    const dots = beats.map(b => {
      const d = make('button', 'mk-dot', track);
      d.type = 'button';
      d.style.left = `${(b.start / total) * 100}%`;
      d.title = b.show;
      d.setAttribute('aria-label', `Фраза ${b.i + 1}: ${b.show}`);
      d.addEventListener('click', e => { e.stopPropagation(); seek(b.start + 0.01, true); });
      return d;
    });
    if (Array.isArray(P.dotGroups) && P.dotGroups.length) groupDots();
    let finBtn = null;
    if (opts.finale) {
      finBtn = make('button', 'mk-fin', track, ICONS.board);
      finBtn.type = 'button';
      finBtn.title = opts.finale.label || 'Board';
      finBtn.setAttribute('aria-label', finBtn.title);
      finBtn.addEventListener('click', e => { e.stopPropagation(); finish(); });
      document.body.classList.add('mk-has-fin');
    }
    const timeLabel = make('span', 'mk-time', bar);
    track.addEventListener('click', e => { const r = track.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total, true); });
    const cover = make('div', 'mk-cover', ui);
    const cv = opts.cover || {};
    make('div', 'mk-cover-kicker', cover, cv.kicker || '');
    make('div', 'mk-cover-title', cover, cv.title || '');
    if (cv.sub) make('div', 'mk-cover-sub', cover, cv.sub);
    const bigBtn = make('button', 'mk-big', cover, `${ICONS.play}<span>Смотреть</span>`);
    bigBtn.type = 'button';
    const againBtn = make('button', 'mk-again', ui, '↺ Ещё раз');
    againBtn.type = 'button';
    againBtn.addEventListener('click', () => seek(0, true));

    // bar split into one segment per window: the first phrase of a window gets a big dot and a gap before it
    function groupDots() {
      const rail = make('div', 'mk-rail');
      track.insertBefore(rail, fill);
      rail.appendChild(fill);
      track.classList.add('mk-grouped');
      const starts = P.dotGroups.map(id => B[id]).filter(b => b && b.i > 0).map(b => b.start).sort((a, b) => a - b);
      const stops = starts.map(s => {
        const p = `${((s / total) * 100).toFixed(3)}%`, a = `calc(${p} - ${P.dotGapOff + P.dotGap / 2}px)`, z = `calc(${p} - ${P.dotGapOff - P.dotGap / 2}px)`;
        return `#000 ${a},transparent ${a},transparent ${z},#000 ${z}`;
      });
      const mask = `linear-gradient(90deg,#000 0px,${stops.join(',')},#000 100%)`;
      rail.style.webkitMaskImage = mask;
      rail.style.maskImage = mask;
      let group = -1;
      beats.forEach((b, i) => {
        const head = i === 0 || P.dotGroups.includes(b.id);
        if (head) group++;
        dots[i].classList.add(head ? 'mk-dot-g' : 'mk-dot-sub');
        dots[i].dataset.group = group;
      });
    }

    // ── subtitle ──
    const info = {};
    const infoOf = b => info[b.id] || (info[b.id] = timePhrase(b, WORDS[b.id]));
    let layoutVersion = 0, measure = null, measureText = null, lineH = 0;
    function linesOf(text) {
      if (!measure) {
        measure = cap.cloneNode(true);
        measure.classList.remove('in', 'empty');
        measure.classList.add('mk-cap-measure');
        measure.setAttribute('aria-hidden', 'true');
        measure.removeAttribute('style');
        measure.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'));
        cap.parentNode.appendChild(measure);
        measureText = measure.querySelector('.mk-cap-text') || measure;
        measureText.style.display = 'block';
      }
      if (!lineH) { measureText.textContent = 'Ш'; lineH = measureText.offsetHeight || 1; }
      measureText.textContent = text;
      return Math.round(measureText.offsetHeight / lineH);
    }
    // pages of a phrase: cut at , ; : while the text fits capLines lines; a piece that is still too long is cut by words
    function pagesOf(inf) {
      if (inf.layout === layoutVersion) return inf.pages;
      const W = inf.words, n = W.length, show = inf.beat.show;
      const slice = (a, z) => show.slice(W[a].at, W[z].at + W[z].text.length);
      const fits = (a, z) => linesOf(slice(a, z)) <= P.capLines;
      const ranges = [];
      if (!P.capPages || n < 2 || fits(0, n - 1)) ranges.push([0, n - 1]);
      else {
        const breaks = [];
        W.forEach((w, i) => { if (i < n - 1 && /[,;:][»"”)\]]*$/.test(w.text)) breaks.push(i); });
        breaks.push(n - 1);
        let a = 0;
        while (a < n) {
          let z = -1;
          for (const br of breaks) if (br >= a && fits(a, br)) z = br;
          if (z < 0) { z = a; while (z < n - 1 && fits(a, z + 1)) z++; }
          ranges.push([a, z]);
          a = z + 1;
        }
      }
      // a page switches a little before its first word, but not before the previous page's last word has ended
      let prev = -Infinity;
      inf.pages = ranges.map(([a, z], k) => {
        const t0 = k ? Math.max(prev + 0.3, Math.min(W[a].s - 0.02, Math.max(W[a].s - 0.15, W[a - 1].e - 0.05))) : -Infinity;
        prev = t0;
        return {a, z, t0, text: slice(a, z)};
      });
      inf.layout = layoutVersion;
      return inf.pages;
    }
    let shownKey = null, shownText = '', shownBeat = -1, visible = false, spans = [], lit = -1, morphTimer = 0;
    function fillText(inf, page) {
      spans = [];
      lit = -1;
      if (!P.capWords || !inf.timed) { capText.textContent = page.text; return; }
      capText.textContent = '';
      const W = inf.words, show = inf.beat.show;
      for (let i = page.a; i <= page.z; i++) {
        if (i > page.a) capText.appendChild(document.createTextNode(show.slice(W[i - 1].at + W[i - 1].text.length, W[i].at)));
        spans[i] = make('span', 'mk-w', capText);
        spans[i].textContent = W[i].text;
      }
    }
    // the box changes size smoothly while the letters already stand on their final places
    // Sizes are written rounded to 1/64 px (the layout grid), otherwise a box that is mid-morph would sit a fraction
    // of a pixel off and a frame reached by seeking would differ from the same frame reached by playing.
    const px = v => `${Math.round(v * 64) / 64}px`;
    function swapText(inf, page, morph) {
      const size = () => { const cs = getComputedStyle(capBox); return [parseFloat(cs.width), parseFloat(cs.height)]; };
      const [w0, h0] = morph ? size() : [0, 0];
      clearTimeout(morphTimer);
      Object.assign(capBox.style, {transition: 'none', width: '', height: '', overflow: ''});
      capText.style.width = '';
      fillText(inf, page);
      if (!morph || !(w0 > 0 && h0 > 0)) return;
      const [w1, h1] = size();
      if (Math.abs(w1 - w0) < 0.5 && Math.abs(h1 - h0) < 0.5) return;
      const cs = getComputedStyle(capBox);
      // the text gets its final width now, so letters do not reflow while the box grows or shrinks
      capText.style.width = px(Math.max(0, capBox.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
      Object.assign(capBox.style, {overflow: 'hidden', width: px(Math.max(w0, w1)), height: px(h0)});
      void capBox.offsetWidth;
      capBox.style.transition = 'width .3s cubic-bezier(.3,.7,.3,1),height .3s cubic-bezier(.3,.7,.3,1)';
      Object.assign(capBox.style, {width: px(w1), height: px(h1)});
      morphTimer = setTimeout(endMorph, 340);
    }
    // the morph is over: back to the natural layout. Also on transitionend, so a transition that was finished early
    // (a frame-exact test fast-forwards all animations) leaves no inline sizes behind
    function endMorph() {
      clearTimeout(morphTimer);
      Object.assign(capBox.style, {transition: 'none', width: '', height: '', overflow: ''});
      capText.style.width = '';
    }
    capBox.addEventListener('transitionend', e => { if (e.target === capBox && (e.propertyName === 'width' || e.propertyName === 'height')) endMorph(); });
    function highlight(inf, page, t) {
      let on = -1;
      for (let i = page.a; i <= page.z; i++) { if (t >= inf.words[i].s - 0.05) on = i; else break; }
      if (on >= 0 && t > inf.words[on].e + 0.3) on = -1;
      if (on === lit) return;
      if (spans[lit]) spans[lit].classList.remove('on');
      if (spans[on]) spans[on].classList.add('on');
      lit = on;
    }
    function drawCaption(t, k) {
      // the next phrase's subtitle starts on its first recognised word (that can be up to 0.15 s before the beat)
      const next = beats[k + 1];
      if (next && WORDS[next.id]) { const ni = infoOf(next); if (ni.timed && t >= ni.words[0].s - 0.05) k++; }
      const b = beats[k];
      let inf = null, page = null, hide = !b;
      if (b) {
        inf = infoOf(b);
        if (P.capGap) { const nb = beats[k + 1]; if ((nb ? nb.start : total) - b.end >= P.capGapMin && t > b.end + P.capGapAfter) hide = true; }
        const pages = pagesOf(inf);
        let p = 0;
        while (p < pages.length - 1 && t >= pages[p + 1].t0) p++;
        page = pages[p];
      }
      const key = hide ? '-' : `${k}:${page.a}-${page.z}`;
      if (key !== shownKey) {
        shownKey = key;
        if (hide) {
          if (!b) { capText.textContent = ''; shownText = ''; shownBeat = -1; spans = []; lit = -1; }
          cap.classList.add('empty');
          visible = false;
        } else {
          if (page.text !== shownText || shownBeat !== k) {
            const morph = morphing && visible && !REDUCED;
            swapText(inf, page, morph);
            if (morph && capText.animate) capText.animate([{opacity: 0.15}, {opacity: 1}], {duration: 260, easing: 'ease-out'});
            shownText = page.text;
            shownBeat = k;
          }
          cap.classList.remove('empty');
          cap.classList.add('in');
          visible = true;
        }
      }
      if (P.capWords && !hide && inf.timed) highlight(inf, page, t);
    }
    function simpleCaption(b) {
      cap.classList.remove('in');
      void cap.offsetWidth;
      capText.textContent = b ? b.show : '';
      cap.classList.toggle('empty', !b);
      if (b) cap.classList.add('in');
    }
    if (morphing) { cap.classList.add('mk-cap-smooth'); capBox.classList.add('mk-cap-box'); }
    if (capFlags) {
      // pre-compute pages in idle time: measuring lines must not cost a frame on a phrase change during playback
      const idle = window.requestIdleCallback || (f => setTimeout(() => f(null), 40));
      let warmed = -1;
      const warm = () => {
        if (warmed === layoutVersion) return;
        warmed = layoutVersion;
        const v = layoutVersion;
        let i = 0;
        const step = dl => {
          if (v !== layoutVersion) return;
          while (i < beats.length && (!dl || dl.timeRemaining() > 3)) pagesOf(infoOf(beats[i++]));
          if (i < beats.length) idle(step);
        };
        idle(step);
      };
      if (P.capPages) {
        const relayout = () => { layoutVersion++; lineH = 0; if (audio.paused && current >= 0) drawCaption(lastTime, current); warm(); };
        addEventListener('resize', relayout);
        if (document.fonts) { document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', relayout); document.fonts.ready.then(relayout); }
      }
      warm();
    }

    // ── rendering one moment ──
    let current = -1, lastTime = 0;
    const beatIndexAt = t => { let k = -1; for (const b of beats) { if (t >= b.start - 0.05) k = b.i; else break; } return k; };
    function render(t) {
      lastTime = t;
      tl.time(Math.min(t, total));
      fill.style.width = `${(t / total) * 100}%`;
      timeLabel.textContent = `${clockText(t)} / ${clockText(total)}`;
      const k = beatIndexAt(t);
      if (k !== current) {
        current = k;
        dots.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('past', i < k); });
        const b = beats[k];
        if (!capFlags) simpleCaption(b);
        if (b) { tell({type: 'beat', id: b.id, index: k, start: b.start, text: b.show}); if (opts.onBeat) opts.onBeat(b, api); }
      }
      if (capFlags) drawCaption(t, k);
    }

    // ── smoothed clock: audio.currentTime advances unevenly from frame to frame; on fast camera flights that reads as
    // micro-stutter. The clock advances by frame time and is pulled towards audio time (time constant 0.15 s), never
    // more than 0.03 s ahead or 0.05 s behind; after a seek or a jump of more than 0.15 s it snaps to audio time.
    let clk = null;
    function smooth(audioT) {
      const now = performance.now();
      if (!clk || audio.seeking) { clk = {t: audioT, a: audioT, at: now, moving: false, runs: 0, still: 0}; return audioT; }
      const dt = Math.min(1, (now - clk.at) / 1000) * (audio.playbackRate || 1);
      clk.at = now;
      if (audioT !== clk.a) { clk.still = 0; if (++clk.runs >= 2) clk.moving = true; } else { clk.still++; clk.runs = 0; }
      if (clk.moving && clk.still <= 2) clk.t += dt;
      clk.a = audioT;
      clk.t += (audioT - clk.t) * (1 - Math.exp(-dt / 0.15));
      clk.t = Math.abs(audioT - clk.t) > 0.15 ? audioT : Math.min(audioT + 0.03, Math.max(audioT - 0.05, clk.t));
      return Math.max(0, Math.min(total, clk.t));
    }

    // ── transport ──
    // stops: [{t | beat+at+dt, run(resume)}]: playback pauses when it reaches t by itself (seeking past does not count)
    const stops = (opts.stops || []).map(s => Object.assign({done: false}, s, {
      t: s.t != null ? s.t : ((B[s.beat] && B[s.beat][s.at || 'end']) ?? total) + (s.dt || 0)
    }));
    let raf = 0, prevT = 0, range = null;
    function frameLoop() {
      cancelAnimationFrame(raf);
      prevT = audio.currentTime;
      clk = null;
      const step = () => {
        const t = audio.currentTime;
        if (range && t >= range.t1) { const r = range; range = null; audio.pause(); render(r.t1); if (r.onDone) r.onDone(); return; }
        if (!range) {
          for (const s of stops) {
            if (!s.done && prevT < s.t && t >= s.t) { s.done = true; audio.pause(); render(s.t); s.run(() => start()); return; }
          }
        }
        prevT = t;
        render(P.smoothClock ? smooth(t) : t);
        if (!audio.paused) raf = requestAnimationFrame(step);
      };
      step();
    }
    function setPlaying(on) {
      playBtn.innerHTML = on ? ICONS.pause : ICONS.play;
      playBtn.setAttribute('aria-label', on ? 'Пауза' : 'Смотреть');
      document.body.classList.toggle('mk-playing', on);
    }
    function seek(t, andPlay) {
      t = Math.max(0, Math.min(total - 0.05, t));
      audio.currentTime = t;
      prevT = t;
      clk = null;
      render(t);
      document.body.classList.remove('mk-ended');
      if (andPlay) start();
    }
    function start() {
      document.body.classList.add('mk-started');
      if (audio.ended || audio.currentTime >= total - 0.1) audio.currentTime = 0;
      audio.play().catch(() => document.body.classList.remove('mk-started'));
    }
    const toggle = () => (audio.paused ? start() : audio.pause());
    function finish() {
      document.body.classList.add('mk-started');
      audio.pause();
      // not exactly the end: the browser would fire 'ended' once more
      try { if (audio.currentTime < total - 0.1) audio.currentTime = Math.max(0, total - 0.05); } catch (e) { /* not loaded yet */ }
      setPlaying(false);
      render(total);
      document.body.classList.add('mk-ended');
      tell({type: 'end'});
    }
    function playRange(t0, t1, onDone) { range = {t1, onDone}; seek(t0, true); }

    playBtn.addEventListener('click', toggle);
    bigBtn.addEventListener('click', start);
    audio.addEventListener('play', () => { setPlaying(true); document.body.classList.remove('mk-ended'); frameLoop(); });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', finish);
    addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight') { const b = beats[Math.min(beats.length - 1, current + 1)]; seek(b.start + 0.01, !audio.paused); }
      if (e.code === 'ArrowLeft') {
        const into = audio.currentTime - ((beats[current] && beats[current].start) || 0);
        const b = beats[Math.max(0, current - (into > 1.2 ? 0 : 1))];
        seek(b.start + 0.01, !audio.paused);
      }
    });
    addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data || e.data.target !== 'multik') return;
      if (e.data.cmd === 'pause') audio.pause();
      if (e.data.cmd === 'play') start();
      if (e.data.cmd === 'seek') seek(+e.data.t || 0, false);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); });

    setPlaying(false);
    if (opts.ambient && !REDUCED) opts.ambient(api);
    const fromBeat = B[params.get('beat')], t0 = fromBeat ? fromBeat.start + 0.05 : parseFloat(params.get('t'));
    if (!isNaN(t0)) { document.body.classList.add('mk-started'); seek(t0, false); } else render(0);
    if (params.get('fin') === '1') setTimeout(finish, 60);
    else if (params.get('go') === '1') start();
    window.multik = {
      seek: t => { document.body.classList.add('mk-started'); seek(t, false); },
      tl, audio, B, beats, total, play: start, finish, playRange, stops, cancelRange: () => { range = null; }, player: P
    };
    tell({type: 'ready', total, beats: beats.map(b => ({id: b.id, start: b.start, text: b.show}))});
  }

  window.Multik = {run};
})();
