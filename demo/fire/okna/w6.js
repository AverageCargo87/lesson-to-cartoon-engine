'use strict';
// Window 6 "Why people needed fire". Phrases S8a, S8b, S9, S10.
// Pictures: w6-eda (a campfire with meat on a stick), w6-koster (the campfire in the cave), w6-stena (the cave wall with
// the shadows of people), w6-zver (a hyena in the grass, its eyes catch the firelight).
// Direction: four uses of fire, one per phrase, each on its word: food, warmth, light, protection. The firelight
// flickers over every frame, heat haze rises over the flames. On "зверей" the fire flares and throws sparks.
(function () {
  let koster, stena, zver, flick, haze1, haze2, embers, flare, eyes, tags, wallLight;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 6, id: 'koster', beats: ['S8a', 'S8b', 'S9', 'S10'],
    setup(k) {
      const {W6, fr} = k, E = k.EFF.L, KE = window.KE;
      W6.breath = {x: .1, y: .04, f: .05};
      k.bg(W6, 'w6-eda');
      koster = k.bg(W6, 'w6-koster', {o: 0});
      stena = k.bg(W6, 'w6-stena', {o: 0});
      zver = k.bg(W6, 'w6-zver', {o: 0});
      haze1 = k.glPatch(W6, 'w6-eda', [.12, .0, .48, .5], 'haze', (it, T) => ({uAmt: .9, uBand: [.05, .95], uPh: T * .8}), {fon: true, fa: 0});
      haze2 = k.glPatch(W6, 'w6-koster', [.4, .2, .65, .62], 'haze', (it, T) => ({uAmt: .9, uBand: [.05, .95], uPh: T * .8}), {fon: true, fa: 0});
      const [fx0, fy0] = fr(.33, .55);
      flick = k.fx(W6, 0, E.flicker, {x: fx0, y: fy0, a: 0, r: 220, rgb: '255,170,80', shadow: .3, rate: 1, seed: 11, z: -7});
      embers = k.fx(W6, 0, E.embers, {x0: fr(.15)[0], y0: fr(0, .0)[1], x1: fr(.5)[0], y1: fr(0, .55)[1], a: 0, n: 30, seed: 13, rgb: '255,180,100', vy: 30, size: 2.2, z: -6});
      const [ex, ey] = fr(.03, .78);
      flare = k.fx(W6, 0, E.burst, {x: ex, y: ey, p: 0, dur: 1.2, a: 1, n: 30, seed: 17, speed: 1.2, ang: -1.1, spread: .9, z: -5, strong: true, word: 'зверей'});
      eyes = k.fx(W6, 0, E.sparkles, {pts: [fr(.448, .582), fr(.468, .582)], p: 0, a: 0, r: 7, win: .5, rgb: '255,236,180', z: -4});
      // firelight thrown on the cave wall (the S9 frame): a warm breathing glow from the right, where the fire is
      const [gx, gy] = fr(.62, .48);
      wallLight = k.fx(W6, 0, (c, W, it, T) => { if (it.a <= .003) return; c.save(); c.globalCompositeOperation = 'screen';
        k.glow(c, gx, gy, 300 + 14 * Math.sin(T * 2.7) + 9 * Math.sin(T * 6.1), '255,150,70', .55 * it.a); c.restore(); }, {a: 0, z: -7.5});
      tags = {
        eda: KE.tag(k, W6, 'еда', 520, 120, {f: 15}),
        teplo: KE.tag(k, W6, 'тепло', 300, 120, {f: 15}),
        svet: KE.tag(k, W6, 'свет', 470, 120, {f: 15}),
        zashchita: KE.tag(k, W6, 'защита', 210, 120, {f: 15})
      };
      k.motesLayer(W6, '255,226,190');
      W6.fact = 'Огонь давал людям <em>еду</em>, <em>тепло</em>, <em>свет</em> и <em>защиту</em> от зверей';
    },
    build(tl, k) {
      const {W6, end, wordAt, X, Y, move, drift} = k, KE = window.KE;
      const t0 = k.slide(k.M.go56, W6, {x: X(W6, 330), y: Y(W6, 214), z: 1.14}, 1.6);
      KE.FT(tl, flick, 'a', 0, 1, t0 + .8, .8, 'sine.out');
      KE.FT(tl, embers, 'a', 0, .9, t0 + .9, .8, 'sine.out');
      KE.FT(tl, haze1, 'fa', 0, 1, t0 + .9, .6, 'sine.out');
      k.chapter(W6, t0 + 1.7, {hold: 2.0});
      // S8a food
      k.ctype(tags.eda, wordAt('S8a', 'еду') - .1);
      drift(wordAt('S8a', 'На'), end('S8a') + .3, 16, 0);
      // pause -> S8b warmth: the campfire in the cave
      k.cleave([tags.eda], end('S8a') + .4);
      KE.FT(tl, koster, 'o', 0, 1, end('S8a') + .5, 1.0, 'sine.inOut');
      tl.to(haze1, {fa: 0, duration: .5}, end('S8a') + .5);
      KE.FT(tl, haze2, 'fa', 0, 1, end('S8a') + 1.4, .5, 'sine.out');
      move(end('S8a') + .5, {x: X(W6, 420), y: Y(W6, 222), z: 1.18}, 1.6, 'sine.inOut');
      k.ctype(tags.teplo, wordAt('S8b', 'грелись') - .1);
      drift(wordAt('S8b', 'холодными') - .2, end('S8b') + .2, -12, 0);
      // pause -> S9 light: the wall with the shadows
      k.cleave([tags.teplo], end('S8b') + .2);
      KE.FT(tl, stena, 'o', 0, 1, end('S8b') + .3, .8, 'sine.inOut');
      tl.to(haze2, {fa: 0, duration: .4}, end('S8b') + .3);
      tl.to(embers, {a: .4, duration: .6}, end('S8b') + .3);
      k.ctype(tags.svet, wordAt('S9', 'освещал') - .1);
      KE.FT(tl, wallLight, 'a', 0, 1, wordAt('S9', 'освещал') - .2, 1.2, 'sine.out');
      move(wordAt('S9', 'Огонь') - .1, {x: X(W6, 360), y: Y(W6, 214), z: 1.26}, 2.2, 'sine.inOut');
      // pause -> S10 protection: the beast, the fire flares on "зверей"
      k.cleave([tags.svet], end('S9') + .1);
      KE.FT(tl, zver, 'o', 0, 1, end('S9') + .15, .55, 'sine.inOut');
      tl.to(wallLight, {a: 0, duration: .5}, end('S9') + .15);
      move(end('S9') + .2, {x: X(W6, 360), y: Y(W6, 236), z: 1.34}, 1.6, 'sine.inOut');
      k.ctype(tags.zashchita, wordAt('S10', 'отпугивал') + .1);
      const wZ = wordAt('S10', 'зверей');
      tl.fromTo(flare, {p: 0}, {p: 1, duration: 1.2, ease: 'none', immediateRender: false, data: {word: 'зверей'}}, wZ - .02);
      tl.fromTo(eyes, {a: 0, p: 0}, {a: 1, p: 1, duration: 1.2, ease: 'none', immediateRender: false}, wZ + .3);
      k.EFF.hit(wZ, 'flare', {a: .3, w: 'fire flares'});
      k.exit(W6, t => { k.cleave([tags.zashchita], t); tl.to([flick, embers], {a: 0, duration: .8}, t + .4); });
    }});
})();
