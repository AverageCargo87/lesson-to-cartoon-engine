/* Deterministic random numbers for the engine: window.Paper.rng(seed) returns a generator of floats in [0, 1).
 * mulberry32 (public-domain algorithm). Every particle field, torn edge and sparkle position is seeded, so a scene
 * draws the same frame after every reload and every seek. */
(function () {
  'use strict';
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  window.Paper = Object.assign(window.Paper || {}, {rng});
})();
