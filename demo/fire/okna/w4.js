'use strict';
// Window 4 "The cave near Beijing". Phrases S3a, S3b, S4.
// Pictures: w4-pol (the cave floor, a fire on a slab), w4-sloi (the slab rises as a cube: a section through layers of
// ash and charcoal), w4-rost (the same cube with two small people for scale).
// Direction: the cut lands in the dark cave; light finds the slab on "раскопали"; in the pause the section rises; on
// "золой" a caption points at the layers, on "шесть" the people appear and a glowing ruler draws the height with
// "6 метров"; on "тысяч" a hand note. Slides down into window 5.
(function () {
  let sloi, rost, spot, tagAsh, ruler, tag6, hand, embers;
  (window.KINO_OKNA = window.KINO_OKNA || []).push({n: 4, id: 'razrez', beats: ['S3a', 'S3b', 'S4'],
    setup(k) {
      const {W4, fr} = k, E = k.EFF.L, KE = window.KE;
      W4.breath = {x: .1, y: .04, f: .05};
      k.bg(W4, 'w4-pol');
      sloi = k.bg(W4, 'w4-sloi', {o: 0});
      rost = k.bg(W4, 'w4-rost', {o: 0});
      const [sx, sy] = fr(.45, .62);
      spot = KE.spot(k, W4, sx, sy, {r: 120, rgb: '255,214,160', z: -5});
      embers = k.fx(W4, 0, E.embers, {x0: fr(.48)[0], y0: fr(0, .02)[1], x1: fr(.64)[0], y1: fr(0, .2)[1], a: 0, n: 16, seed: 12, rgb: '255,190,120', vy: 20, size: 1.8, z: -6});
      tagAsh = KE.tag(k, W4, 'зола и угли', 520, 196, {f: 13});
      // the ruler: a glowing line up the left edge of the cube (x .225 of the picture), drawn by its field p
      const [rx, ry0] = fr(.225, .9), [, ry1] = fr(.225, .2);
      ruler = k.fx(W4, 0, (c, W, it) => {
        if (it.p <= .003) return;
        const y = ry0 + (ry1 - ry0) * Math.min(1, it.p);
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 7; c.beginPath(); c.moveTo(rx - 22, ry0); c.lineTo(rx - 22, y); c.stroke();
        c.strokeStyle = 'rgba(255,248,236,.95)'; c.lineWidth = 1.8; c.stroke();
        for (const yy of [ry0, y]) { c.beginPath(); c.moveTo(rx - 30, yy); c.lineTo(rx - 14, yy); c.stroke(); }
        c.restore();
      }, {p: 0, z: 3});
      tag6 = KE.tag(k, W4, '6 метров', 96, 176, {f: 14});
      hand = k.chand(W4, 'много тысяч лет', 500, 92, {f: 16, z: 4});
      k.motesLayer(W4, '255,226,190');
      W4.fact = 'Под Пекином в пещере нашли <em>слой с золой и углями</em> толщиной <em>6 метров</em>';
    },
    build(tl, k) {
      const {W4, end, wordAt, X, Y, move, drift} = k, KE = window.KE;
      k.cut(k.M.cut34, W4, {x: X(W4, 400), y: Y(W4, 250), z: 1.12}, 'razrez');
      move(k.M.cut34 + .05, {x: X(W4, 380), y: Y(W4, 262), z: 1.2}, 3.2, 'sine.inOut');
      k.chapter(W4, wordAt('S3a', 'археологи') - .2, {hold: 2.6});
      KE.pulse(tl, spot, wordAt('S3a', 'раскопали') - .1, {a0: 1, a1: .3, up: .4, hold: .5, down: 1.2});
      // pause: the section rises out of the floor
      KE.FT(tl, sloi, 'o', 0, 1, end('S3a') + .15, 1.4, 'sine.inOut');
      move(end('S3a') + .2, {x: X(W4, 330), y: Y(W4, 232), z: 1.06}, 1.7, 'sine.inOut');
      // S3b: layers, then the height
      const wZ = wordAt('S3b', 'золой'), wS = wordAt('S3b', 'шесть');
      k.ctype(tagAsh, wZ - .1);
      KE.FT(tl, rost, 'o', 0, 1, wS - .25, .6, 'sine.inOut');
      KE.FT(tl, ruler, 'p', 0, 1, wS - .05, .9, 'sine.inOut');
      k.cappear(tag6, wS + .3);
      // S4: thousands of years of fires: embers over the top, a hand note, a slow drift
      const wK = wordAt('S4', 'костры'), wT = wordAt('S4', 'тысяч');
      KE.FT(tl, embers, 'a', 0, .9, wK - .2, .9, 'sine.out');
      drift(wK, end('S4') + .1, -10, -6);
      k.cwrite(hand, wT - .3, .8);
      // slide down to window 5 right after the phrase (the next phrase follows quickly)
      k.M.go45 = Math.max(k.last + .02, end('S4') + .12);
      k.exit(W4, t => { k.cleave([tagAsh, tag6, hand], t); tl.to(ruler, {p: 0, duration: .4}, t + .3); tl.to(embers, {a: 0, duration: .5}, t + .5); });
    }});
})();
