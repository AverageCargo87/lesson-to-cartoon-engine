'use strict';
// Window 3 "Fire is kept". Phrase S2b.
// Pictures: w3-noch (the cave at night, a small fire inside) and w3-utro (the same cave in the morning light).
// Direction: the camera slides down from window 2 and pushes towards the fire in the cave; on "день" the morning
// dissolves in, on "ночь" the night comes back: the fire keeps burning through both. Then a soft flash and a cut
// across the board to window 4 (the right column).
(function () {
  let utro, glowFire, embers, tag, hDay, hNight;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 3, id: 'peshchera', beats: ['S2b'],
    setup(k) {
      const {W3, fr} = k, E = k.EFF.L, KE = window.KE;
      W3.breath = {x: .1, y: .04, f: .05};
      k.bg(W3, 'w3-noch');
      utro = k.bg(W3, 'w3-utro', {o: 0});
      const [cx, cy] = fr(.5, .66);
      glowFire = k.fx(W3, 0, (c, W, it, T) => { if (it.a <= .003) return; k.glow(c, cx, cy, 70 + 8 * Math.sin(T * 3.1) + 5 * Math.sin(T * 7.3), '255,160,70', .5 * it.a); }, {a: .6, z: -8});
      embers = k.fx(W3, 0, E.embers, {x0: fr(.44)[0], y0: fr(0, .42)[1], x1: fr(.56)[0], y1: fr(0, .68)[1], a: .7, n: 14, seed: 9, rgb: '255,180,100', vy: 18, size: 1.8, z: -7});
      tag = KE.tag(k, W3, 'огонь берегут день и ночь', 400, 300, {f: 13});
      hDay = k.chand(W3, 'день', 250, 205, {f: 17, z: 4});
      hNight = k.chand(W3, 'ночь', 560, 205, {f: 17, z: 4});
      k.motesLayer(W3, '255,226,190');
      W3.fact = 'В пещере огонь <em>берегли</em>: день и ночь не давали ему погаснуть';
    },
    build(tl, k) {
      const {W3, end, wordAt, X, Y, move} = k, KE = window.KE;
      const t0 = k.slide(k.M.go23, W3, {x: X(W3, 400), y: Y(W3, 236), z: 1.06}, 1.6);
      k.chapter(W3, t0 + 1.7, {hold: 2.0});
      // S2b: push towards the fire; the caption on "берегли"; day and night on their words
      const wT = wordAt('S2b', 'Там'), wB = wordAt('S2b', 'берегли'), wD = wordAt('S2b', 'день'), wN = wordAt('S2b', 'ночь');
      move(wT - .1, {x: X(W3, 400), y: Y(W3, 262), z: 1.3}, 3.6, 'sine.inOut');
      KE.pulse(tl, glowFire, wT + .3, {a0: 1, a1: .7, up: .4, hold: .3, down: .9});
      k.ctype(tag, wB - .1);
      KE.FT(tl, utro, 'o', 0, 1, wD - .15, .7, 'sine.inOut');
      k.cwrite(hDay, wD - .05, .5);
      KE.FT(tl, utro, 'o', 1, 0, wN - .1, .8, 'sine.inOut');
      k.cwrite(hNight, wN, .5);
      k.cleave([hDay, hNight], end('S2b') - .2);
      // a soft flash "through the light of the fire" hides the cut to the right column
      const peak = k.flash(end('S2b') + .1, {peak: .85, up: .3, hold: .1, down: .6, rgb: '255,226,180'});
      k.M.cut34 = peak;
      k.exit(W3, t => { k.cleave([tag], t); });
    }});
})();
