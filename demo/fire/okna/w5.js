'use strict';
// Window 5 "Making fire". Phrases S5, S6, S7.
// Pictures: w5-trenie (a fire drill on a wooden board) -> w5-dymok (smoke under the drill) -> w5-ogonek (the tinder
// catches) -> w5-kremen (a flint over a lump of pyrite and a tinder nest) -> w5-iskry (the strike) -> w5-trut (flame).
// Direction: friction on "трением"; the smoke dissolves in on "дымок" and rises in billows; in the short pause the tinder
// flares; on "били" the stones, on "искры" a burst of sparks (the one strong effect of the phrase). In the pause after
// the phrase the tinder catches fire, then the camera slides down into window 6.
(function () {
  let dymok, ogonek, kremen, iskry, trut, smoke, burst, embers, tagT, tagI;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 5, id: 'dobycha', beats: ['S5', 'S6', 'S7'],
    setup(k) {
      const {W5, fr} = k, E = k.EFF.L, KE = window.KE;
      W5.breath = {x: .1, y: .04, f: .05};
      k.bg(W5, 'w5-trenie');
      dymok = k.bg(W5, 'w5-dymok', {o: 0});
      ogonek = k.bg(W5, 'w5-ogonek', {o: 0});
      kremen = k.bg(W5, 'w5-kremen', {o: 0});
      iskry = k.bg(W5, 'w5-iskry', {o: 0});
      trut = k.bg(W5, 'w5-trut', {o: 0});
      smoke = k.fx(W5, 0, E.billow, {x0: fr(.44)[0], y0: fr(0, .2)[1], x1: fr(.56)[0], y1: fr(0, .62)[1], a: 0, n: 10, rgb: '220,214,206', seed: 6, vx: 4, vy: -14, scale: .8, z: -6});
      const [bx, by] = fr(.42, .58);
      burst = k.fx(W5, 0, E.burst, {x: bx, y: by, p: 0, dur: 1.1, a: 1, n: 34, seed: 7, speed: 1.1, z: -5, strong: true, word: 'искры'});
      embers = k.fx(W5, 0, E.embers, {x0: fr(.4)[0], y0: fr(0, .1)[1], x1: fr(.66)[0], y1: fr(0, .7)[1], a: 0, n: 20, seed: 8, rgb: '255,180,100', vy: 26, size: 2, z: -6});
      tagT = KE.tag(k, W5, 'трением', 470, 120, {f: 14});
      tagI = KE.tag(k, W5, 'искрами из камня', 470, 120, {f: 14});
      k.motesLayer(W5, '255,226,190');
      W5.fact = 'Позже люди научились <em>добывать огонь сами</em>: трением и искрами из камня';
    },
    build(tl, k) {
      const {W5, end, wordAt, X, Y, move} = k, KE = window.KE;
      const t0 = k.slide(k.M.go45, W5, {x: X(W5, 400), y: Y(W5, 230), z: 1.08}, 1.5);
      k.chapter(W5, wordAt('S5', 'научились') - .1, {hold: 2.2});
      // S6: friction, then the smoke
      const wTr = wordAt('S6', 'трением'), wKr = wordAt('S6', 'крутили'), wDy = wordAt('S6', 'дымок');
      move(wordAt('S6', 'Его') - .1, {x: X(W5, 400), y: Y(W5, 252), z: 1.32}, 2.4, 'sine.inOut');
      k.ctype(tagT, wTr - .1);
      KE.FT(tl, dymok, 'o', 0, 1, wKr + .2, 1.0, 'sine.inOut');
      KE.FT(tl, smoke, 'a', 0, .8, wDy - .2, .9, 'sine.out');
      // pause: the tinder flares up
      KE.FT(tl, ogonek, 'o', 0, 1, end('S6') + .05, .7, 'sine.inOut');
      tl.to(smoke, {a: 0, duration: .6, ease: 'sine.in'}, end('S6') + .1);
      KE.FT(tl, embers, 'a', 0, .8, end('S6') + .2, .6, 'sine.out');
      k.cleave([tagT], end('S6') + .2);
      move(end('S6') + .15, {x: X(W5, 400), y: Y(W5, 236), z: 1.12}, 1.4, 'sine.inOut');
      // S7: the stones, the strike, the sparks
      const wB = wordAt('S7', 'били'), wV = wordAt('S7', 'высекали'), wI = wordAt('S7', 'искры');
      KE.FT(tl, kremen, 'o', 0, 1, wordAt('S7', 'Или') - .25, .5, 'sine.inOut');
      tl.to(embers, {a: 0, duration: .4}, wordAt('S7', 'Или') - .2);
      KE.FT(tl, iskry, 'o', 0, 1, wB + .25, .35, 'sine.out');
      k.ctype(tagI, wV - .1);
      tl.fromTo(burst, {p: 0}, {p: 1, duration: 1.1, ease: 'none', immediateRender: false, data: {word: 'искры'}}, wI - .05);
      k.EFF.hit(wI - .05, 'spark', {a: .3, w: 'sparks'});
      // pause: the tinder catches fire (the music's flame chord follows)
      KE.FT(tl, trut, 'o', 0, 1, end('S7') + .2, .9, 'sine.inOut');
      KE.FT(tl, embers, 'a', 0, .9, end('S7') + .4, .8, 'sine.out');
      move(end('S7') + .1, {x: X(W5, 420), y: Y(W5, 226), z: 1.24}, 1.5, 'sine.inOut');
      k.M.go56 = Math.max(k.last + .05, end('S7') + 1.75);
      k.exit(W5, t => { k.cleave([tagI], t); tl.to(embers, {a: 0, duration: .6}, t + .6); });
    }});
})();
