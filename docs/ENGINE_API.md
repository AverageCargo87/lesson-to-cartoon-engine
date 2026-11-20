# Engine API

How a scene is put together and what a window file can call. The working example is `demo/fire/`.

## Files and load order

```
scene/index.html
  gsap                      (CDN, fallback node_modules)
  engine/rng.js             deterministic random numbers: window.Paper.rng(seed)
  engine/player.js          the player: audio clock, subtitles, transport, postMessage   (window.Multik)
  engine/fxgl.js            WebGL patches over the 2D canvas                              (window.FXGL)
  engine/effekty.js         2D painters, part 1                                           (window.EFF)
  engine/effekty-film.js    "film" look: light, focus, fog, flicker, grade
  engine/effekty-epik.js    "epic" photo look: embers, bursts, impacts, flares, grade
  window.KINO = {...}       the scene config (below)
  quiz/proverki-kit.js      quiz frame (optional)
  scene/quiz-<topic>.js     the scene's task data: window.QUIZ (optional)
  quiz/proverka-bank.js     8 task kinds + rotation (optional)
  engine/kit-epik.js        helpers for photo windows                                     (window.KE)
  scene/okna/w1.js ... itog.js   one file per window + the summary sheet
  engine/kino.js            the core: board, windows, layers, camera, labels, timeline   (last)
```

Every window file registers itself and does nothing else:

```js
(window.KINO_OKNA = window.KINO_OKNA || []).push({n: 1, id: 'molniya', beats: ['S1a', 'S1b'],
  setup(k) { /* layers, glows, labels: once, at load */ },
  build(tl, k) { /* its piece of the timeline: once the word timings are in */ }
});
```

All `setup` calls run in order of `n` (windows 1..8, the summary sheet 9), then the board is prepared; all `build` calls
run in order of `n`, so window 5 sees what window 4 stored in `k.M`, `k.plan` and `k.last`.

## Scene config: `window.KINO`

| Field | Meaning |
|---|---|
| `art` | folder of the window pictures (`'art/'`): `k.bg(W, 'w1-noch')` loads `art/w1-noch.webp` |
| `windows` | `[{id, x, y, w?, h?, title, where?, anchor?}]` in board units; a window is 800x450 units |
| `board`, `list` | board size `{w, h}` and the rectangle of the summary sheet `{x, y, w, h}` |
| `cover` | `{kicker, title, sub}` of the cover with the play button |
| `files` | `{audio, beats, words, voAudio, voBeats}` (defaults `narration.mp3`, `beats.json`, `words.json`) |
| `player` | subtitle and clock flags: `capGap`, `capWords`, `capPages`, `capLines`, `smoothClock`, `dotGroups` |
| `theme` | the material of the core's painters: canvas tags, big words, hand notes, lines, frame, board, flash, motion |
| `palette` | colours of the `KE` helpers |
| `look` | `'film'` switches `effekty.js` to the film variants |
| `vopros` | `false`: the board has no voice track of its own |
| `finaleLabel` | tooltip of the "go to the board" button |

## Units and sizes

- A window is 800x450 units, origin at its top-left corner. `W.x, W.y` is its corner on the board, `W.cx, W.cy` its
  centre. Labels and the camera use board coordinates: `k.X(W, x) = W.x + x`, `k.Y(W, y) = W.y + y`.
- The picture (2000x1116) covers the window with a bleed: `k.PL = {x: -20, y: -9.35, w: 840, h: 468.7}`.
  `k.fr(fx, fy)` converts picture fractions to window units: always place things with `fr`.
- Camera `z = 1` means the window exactly covers the screen ("cover" scale, `k.cover()`). On screen a label of size
  `f` is `f x cover x z` px. At 735x587 (the lesson column) `cover` is 1.30 and 563 units of width are visible.
- Everything that must be seen stays above ~70 % of the picture height (`fr(0, .70)`); the subtitle lives below.

## Time rules

- Time is seconds of the narration. Bind to words, not numbers: `k.wordAt(id, 'word')` is the start of that word in
  phrase `id` (by stem, first match), `k.at(id, f)` a fraction of the phrase, `k.end(id)` its end.
- Every event is a tween of the timeline `tl` (`tl.to / fromTo / set` or the `k.*` helpers). Background life (embers,
  dust, flicker) is a pure function of page time `T` inside a painter. `tl.call`, `setTimeout` and state accumulated
  between frames are not allowed: seeking backwards would not undo them.
- `tl.fromTo(x, {a: 0}, {a: 1}, t)` holds the from-value before `t`. Something that flashes and fades is a 0 -> 1 tween
  plus a separate fade, never 1 -> 0.
- The camera never starts a move before the previous one ends: `k.after(t)`; `move` does it by itself, `fly`/`cut`
  warn in the console.
- One strong effect per phrase, on its key word (-0.3...+0.5 s), not in the first 0.5 s of the subtitle. At most 3 shakes
  and 3 full-frame flashes per cartoon, at most 2 WebGL patches in frame.

## setup(k): laying out a window

| Call | What it does |
|---|---|
| `k.bg(W, name, {o})` | background picture over the whole window (z -10); stack several and tween `o` to cross-fade |
| `k.lay(W, name, {x, y, w, d, o, s, r, fx, mask, crop, wave, pmax, amb, z})` | an image layer; `d` is the parallax depth (0 = like the background), `mask` draws it only inside a mask, `amb` a background motion |
| `k.fx(W, d, (c, W, it, T, px) => {...}, fields)` | a painter layer in window coordinates; its own fields (`a`, `p`, `amt`...) are tweened in `build` |
| `k.glPatch(W, name, rect, shader, (it, T) => uniforms, {fon})` | a WebGL patch over a rectangle of the picture (`FXGL.SH`: vortex, rise, haze, dissolve, sketch, grade, godrays, stages, water); `fon: true` = background patch driven by `fa` |
| `k.water(W, name, {mask, ...})`, `k.birds(W, {...})`, `k.A.drift/bob/sail/sway/hover` | water by mask, a flock along a path, background motions of layers |
| `k.ctag(W, text, x, y, {f, kind})`, `k.chand(...)`, `k.cword(...)` | labels drawn on the window canvas (move with the picture pixel for pixel) |
| `k.T / k.D / k.H / k.cutWord` | DOM labels (tag, dymo, hand note, big word of letters) |
| `k.onboard(...els)` | DOM copies shown on the board after the cartoon |
| `k.motesLayer(W, rgb)` | dust motes in the light (by convention the last layer) |
| `W.fact`, `W.item` | the board's fact card and the summary-sheet item of the window |
| `k.EFF.L.*` | effect painters as layer wrappers: `k.fx(W, 0, k.EFF.L.embers, {x0, y0, x1, y1, a, n})` |
| `KE.title / KE.tag / KE.hand / KE.spot / KE.akcent / KE.card ...` | photo-window helpers (`engine/kit-epik.js`) |

## build(tl, k): the window's piece of the timeline

Camera (board coordinates):

| Call | What it does |
|---|---|
| `k.move(t, {x, y, z}, dur, ease)` | pan/zoom inside the window between pinned ends (no "knee" at the window edge) |
| `k.drift(t0, t1, dx, dy)` | a slow pan while the camera "stands" (<= 0.6 px per frame) |
| `k.fly(t, W, {x, y, z, dur, rho})` | a flight to another window along one arc (van Wijk & Nuij zoom-pan) |
| `k.slide(t, W, {x, y, z}, dur)` | a straight slide to the neighbouring window, both open during the slide; returns the start time |
| `k.cut(t, W, pose, label)` | an instant cut (hide it under a flash) |
| `k.flash(t, {...})` | a full-frame flash; returns the moment of its peak (cut under it) |
| `k.shake(t, {amp, dur})` | a shake (<= 2 px, <= 0.3 s) |
| `k.chapter(W, t, {hold, stay})` | the chapter inset "No. · title · where/when" in the top-left corner |

Labels: `k.appear`, `k.type`, `k.typeLines`, `k.pop`, `k.pulse`, `k.write`, `k.letters`, `k.leave` for DOM labels;
`k.cappear`, `k.ctype`, `k.cwrite`, `k.cleave`, `k.cletters` for canvas labels. A label never leaves before its
appearance has finished (the core moves the leave and warns).

Joints between windows: a window stores the moment of the next transition in `k.M` (for example `k.M.go12`) and its
clean-up in `k.exit(W, t => {...})`, which runs when the camera departs.

## The player: `window.multik`

`seek(t)`, `play()`, `finish()`, `playRange(t0, t1, onDone)`, `tl`, `audio`, `beats`, `total`, `B` (phrases by id).
URL parameters: `?t=31` a still frame, `?beat=<id>` start at a phrase, `?fin=1` straight to the board,
`?go=1` play at once, `?test=v1|v2|vall|none` quiz set, `?lenta=1` lesson flow, `?still=1` background life frozen,
`?light=1|0` light mode on / never.

## postMessage protocol

The scene posts `{source: 'multik', type, ...}` to its parent (same origin):
`ready {total, beats}`, `beat {id, index, start, text}`, `end`, `proverka-set {set}`, `proverka {kind, r, set}`,
`proverka-itog {set, res}`, `next`. The host may send `{target: 'multik', cmd: 'play' | 'pause' | 'seek', t}`.
`demo/index.html` shows the whole protocol with a live log.

## Quiz data: `window.QUIZ`

`names`, `about` (catalogue texts), `lenta.steps[]`, `karta {img, places, decoy}`, `pairs`, `tf`, `cloze`, `caps` +
`lies`, `errs`, `voice` (questions with keyword groups for the offline judge), `thumbs`, `key` (localStorage prefix).
See `demo/fire/quiz-fire.js`. A server judge for voice answers is used when `window.QUIZ_API` is set.
