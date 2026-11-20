'use strict';
// Window 1 "Fire from lightning". Phrases S1a, S1b.
// Pictures (Blender renders): w1-noch (a dark savanna before the storm) -> w1-udar (the strike) -> w1-derevo (the tree burns).
// Direction: the title over the dark plain; in the pause the storm breaks: a flash on the music's lightning chord, the
// strike, then the burning tree; on "зажгла молния" the camera comes closer, embers rise, a caption names it.
// Leaves for window 2 by a flight along the left column.
(function () {
  let noch, udar, derevo, title, embers, tagFire, impact, glowTree, spot;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 1, id: 'molniya', beats: ['S1a', 'S1b'],
    setup(k) {
      const {W1, fr} = k, E = k.EFF.L, KE = window.KE;
      W1.breath = {x: .12, y: .05, f: .05};
      noch = k.bg(W1, 'w1-noch');
      udar = k.bg(W1, 'w1-udar', {o: 0});
      derevo = k.bg(W1, 'w1-derevo', {o: 0});
      // warm light breathing over the burning crown, rising embers (both follow page time T, nothing accumulates)
      const [tx, ty] = fr(.62, .42);
      glowTree = k.fx(W1, 0, (c, W, it, T) => { if (it.a <= .003) return; k.glow(c, tx, ty + 6 * Math.sin(T * 1.7), 210 + 18 * Math.sin(T * 2.3), '255,150,60', .32 * it.a); }, {a: 0, z: -8});
      embers = k.fx(W1, 0, E.embers, {x0: fr(.36)[0], y0: fr(0, .08)[1], x1: fr(.92)[0], y1: fr(0, .78)[1], a: 0, n: 46, seed: 3, rgb: '255,170,90', vy: 26, z: -7});
      // the lightning strike: flash in a point + shock ring + sparks (a pure function of p)
      const [sx, sy] = fr(.47, .52);
      impact = k.fx(W1, 0, E.impact, {x: sx, y: sy, p: 0, a: 1, r: 120, z: -6});
      spot = KE.spot(k, W1, tx, ty + 30, {r: 90, rgb: '255,214,160', z: -5});
      title = KE.title(k, W1, [{t: 'Огонь', f: 54}], 400, 132, {z: 5});
      tagFire = KE.tag(k, W1, 'огонь от молнии', 285, 112, {f: 13});
      k.motesLayer(W1, '255,226,190');
      W1.fact = 'Сначала люди не умели сами добывать огонь: его брали от дерева, которое <em>зажгла молния</em>';
    },
    build(tl, k) {
      const {W1, end, wordAt, X, Y, move} = k, KE = window.KE;
      // S1a: the dark plain, a slow push-in; the title appears on the first word and leaves before the storm
      k.cut(0, W1, {x: X(W1, 400), y: Y(W1, 214), z: 1.04}, 'molniya');
      move(.05, {x: X(W1, 412), y: Y(W1, 206), z: 1.16}, 4.4, 'sine.inOut');
      const tS = wordAt('S1a', 'Сначала');
      KE.go(tl, title, tS - .25, 1.0, 'sine.out');
      k.chapter(W1, wordAt('S1a', 'умели') - .1, {hold: 2.6});
      KE.FT(tl, title, 'o', 1, 0, end('S1a') + .25, .5, 'sine.in');
      // pause: the storm breaks. The flash peaks on the music's lightning chord; under it the strike frame cuts in.
      const peak = k.flash(4.93, {peak: .9, up: .25, hold: .1, down: .7, rgb: '235,240,255'});
      tl.set(udar, {o: 1}, peak);
      tl.fromTo(impact, {p: 0}, {p: 1, duration: 1.2, ease: 'none', immediateRender: false}, peak);
      k.EFF.hit(peak, 'boom', {a: .5, w: 'lightning'});
      move(peak + .05, {x: X(W1, 432), y: Y(W1, 214), z: 1.1}, 1.9, 'sine.inOut');
      // the tree catches fire: the burning frame dissolves in, embers and warm light come up
      KE.FT(tl, derevo, 'o', 0, 1, 6.3, 1.2, 'sine.inOut');
      KE.FT(tl, embers, 'a', 0, .85, 6.6, 1.4, 'sine.out');
      KE.FT(tl, glowTree, 'a', 0, 1, 6.5, 1.5, 'sine.out');
      // S1b: closer to the burning crown; the caption types itself on "дерева", a soft light ring on "молния"
      const wD = wordAt('S1b', 'дерева'), wM = wordAt('S1b', 'молния');
      move(wordAt('S1b', 'Его') - .2, {x: X(W1, 440), y: Y(W1, 212), z: 1.14}, 2.6, 'sine.inOut');
      k.ctype(tagFire, wD - .05);
      KE.pulse(tl, spot, wM - .1, {a0: 1, a1: .25, up: .4, hold: .35, down: 1.2});
      if (spot.pts) KE.go(tl, spot, wM - .05, 1);
      // leave for window 2: a flight down the left column right after the phrase
      k.M.go12 = Math.max(k.last + .05, end('S1b') + .15);
      k.exit(W1, t => { k.cleave([tagFire], t); tl.to([embers, glowTree], {a: 0, duration: .6, ease: 'sine.in'}, t + .6); });
    }});
})();
