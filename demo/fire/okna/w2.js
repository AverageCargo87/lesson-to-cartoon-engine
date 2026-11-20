'use strict';
// Window 2 "Fire is carried to the cave". Phrase S2a.
// Picture: w2-golovnya, a man carries a burning branch through the night grass, the lightning tree burns behind him.
// Direction: the flight from window 1 lands on the torch; the flame flickers (firelight on the man, heat haze over the
// flame, embers), the camera follows the way he walks; the caption on "уносили". Slides down into window 3.
(function () {
  let embers, flick, tag, haze;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 2, id: 'golovnya', beats: ['S2a'],
    setup(k) {
      const {W2, fr} = k, E = k.EFF.L, KE = window.KE;
      W2.breath = {x: .1, y: .05, f: .06};
      k.bg(W2, 'w2-golovnya');
      // heat haze over the torch flame: a background WebGL patch (no WebGL: the picture stays as it is)
      haze = k.glPatch(W2, 'w2-golovnya', [.30, .05, .47, .36], 'haze', (it, T) => ({uAmt: .9, uBand: [.05, .95], uPh: T * .9}), {fon: true, fa: 0});
      const [fx0, fy0] = fr(.385, .25);
      flick = k.fx(W2, 0, E.flicker, {x: fx0, y: fy0, a: 0, r: 150, rgb: '255,170,80', shadow: .25, rate: 1, seed: 4, z: -7});
      embers = k.fx(W2, 0, E.embers, {x0: fr(.32)[0], y0: fr(0, .02)[1], x1: fr(.46)[0], y1: fr(0, .3)[1], a: 0, n: 22, seed: 5, rgb: '255,180,100', vy: 30, size: 2.2, z: -6});
      tag = KE.tag(k, W2, 'огонь несут в пещеру', 470, 300, {f: 13});
      k.motesLayer(W2, '255,226,190');
      W2.fact = 'Горящую ветку <em>уносили в пещеру</em>';
    },
    build(tl, k) {
      const {W2, end, wordAt, X, Y, move} = k, KE = window.KE;
      const t0 = k.M.go12;
      k.fly(t0, W2, {x: X(W2, 330), y: Y(W2, 190), z: 1.18, dur: 2.0});
      KE.FT(tl, flick, 'a', 0, 1, t0 + 1.2, 1.0, 'sine.out');
      KE.FT(tl, embers, 'a', 0, .9, t0 + 1.3, 1.0, 'sine.out');
      KE.FT(tl, haze, 'fa', 0, 1, t0 + 1.0, .6, 'sine.out');
      k.chapter(W2, t0 + 2.15, {hold: 2.2});
      // S2a: the camera walks with him to the right; the caption on "уносили"
      const wG = wordAt('S2a', 'Горящую'), wU = wordAt('S2a', 'уносили');
      move(wG - .1, {x: X(W2, 420), y: Y(W2, 200), z: 1.22}, 2.7, 'sine.inOut');
      k.ctype(tag, wU - .1);
      // slide down to window 3 (the cave), after the phrase
      k.M.go23 = Math.max(k.last + .05, end('S2a') + .3);
      k.exit(W2, t => { k.cleave([tag], t + .2); tl.to(haze, {fa: 0, duration: .5, ease: 'sine.in'}, t + .8); tl.to([flick, embers], {a: 0, duration: .6}, t + .9); });
    }});
})();
