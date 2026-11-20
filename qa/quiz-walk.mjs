// "Walk the quiz like a child": opens the scene at the board (?fin=1), starts the full set (?test=vall) and solves
// every task through the UI the way a child would (taps, not scripts): order, labels, pairs, true/false, blanks,
// captions, find the mistake, a typed voice answer. Answers come from the scene's own data (window.QUIZ).
// Mode "right" must end with every kind graded "ok"; mode "wrong" makes one mistake per task first and checks that
// the Duolingo-style rotation then puts the failed kinds at the front of the next "after the cartoon" set.
//
//   node qa/quiz-walk.mjs [scene=demo/fire/index.html] [--mode=right|wrong|both] [--size=874x648] [--json=file]
import {chromium} from 'playwright';
import fs from 'node:fs';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';

const ARGV = process.argv.slice(2), FLAG = Object.fromEntries(ARGV.filter(a => a.startsWith('--')).map(a => {const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : '1'];})), POS = ARGV.filter(a => !a.startsWith('--'));
const server = await ensureServer();
const URL0 = sceneUrl(POS[0] || 'demo/fire/index.html');
const [W, H] = (FLAG.size || '874x648').split('x').map(Number);
const MODES = (FLAG.mode || 'both') === 'both' ? ['right', 'wrong'] : [FLAG.mode];
const b = await chromium.launch(launchOpts());
const report = {scene: URL0.replace(/^https?:\/\/[^/]+\//, ''), runs: []};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// kinds answered with mistakes in the "wrong" run: cloze three times (graded again), tf and err once (graded help)
const WRONG = ['cloze', 'tf', 'err'];

async function walk(mode) {
  const ctx = await b.newContext({viewport: {width: W, height: H}});
  const p = await ctx.newPage(), errs = [], posted = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.exposeFunction('__posted', m => posted.push(m));
  // the scene talks to its host lesson by postMessage: a stub parent records every message
  await p.addInitScript(() => { const stub = {postMessage: m => window.__posted && window.__posted(m)}; try { Object.defineProperty(window, 'parent', {get: () => stub}); } catch (e) { window.parent = stub; } });
  await p.goto(URL0 + (URL0.includes('?') ? '&' : '?') + 'fin=1&test=vall', {waitUntil: 'networkidle'});
  await p.waitForFunction(() => window.multik && window.kino && document.body.classList.contains('board'), null, {timeout: 60000});
  await p.waitForTimeout(1500);
  const Q = await p.evaluate(() => window.QUIZ);
  await p.click('.bd-quizbtn');
  await p.waitForSelector('.pv-row .pv-btn');
  await p.click('.pv-row .pv-btn');                     // "Начать"
  const tap = async sel => { await p.locator(sel).first().click(); await sleep(120); };
  const kinds = await p.evaluate(() => window.PROVERKA.kinds());
  const done = [];
  for (const kind of kinds) {
    await p.waitForFunction(() => document.querySelector('.mx-stage')?.children.length > 0, null, {timeout: 20000});
    await sleep(400);
    const wrongOnce = mode === 'wrong' && WRONG.includes(kind);
    if (kind === 'lenta') {
      for (let step = 0; step < Q.lenta.steps.length; step++) {
        await p.waitForSelector('.pv-tray .mx-chip');
        const n = await p.locator('.vv-slot').count();
        if (wrongOnce && step === 0) { await tap('.pv-tray .mx-chip[data-k="0"]'); await tap('.vv-slot[data-k="1"]'); }
        for (let k = 0; k < n; k++) { await tap(`.pv-tray .mx-chip[data-k="${k}"]`); await tap(`.vv-slot[data-k="${k}"]`); }
        await sleep(2700);
      }
    } else if (kind === 'karta') {
      const ids = Object.keys(Q.karta.places);
      if (wrongOnce) { await tap(`.pv-tray .mx-chip[data-id="${ids[0]}"]`); await tap(`.vv-place[data-id="${ids[1]}"]`); }
      for (const id of ids) { await tap(`.pv-tray .mx-chip[data-id="${id}"]`); await tap(`.vv-place[data-id="${id}"]`); }
      await sleep(1800);
    } else if (kind === 'pairs') {
      const ks = await p.$$eval('.mx-pair.l', bs => bs.map(x => x.dataset.k));
      if (wrongOnce) { await tap(`.mx-pair.l[data-k="${ks[0]}"]`); await tap(`.mx-pair.r[data-k="${ks[1]}"]`); }
      for (const k of ks) { await tap(`.mx-pair.l[data-k="${k}"]`); await tap(`.mx-pair.r[data-k="${k}"]`); }
      await sleep(1600);
    } else if (kind === 'tf') {
      for (let n = 0; n < 5; n++) {
        await p.waitForSelector('.mx-tfb');
        const text = await p.textContent('.mx-tfcard p');
        const truth = Q.tf.find(x => x.t === text).ok;
        const answer = wrongOnce && n === 0 ? !truth : truth;
        await tap(`.mx-tfb.${answer ? 'yes' : 'no'}`);
        await sleep(answer === truth ? 1500 : 3100);
      }
    } else if (kind === 'cloze') {
      const words = await p.$$eval('.mx-blank', bs => bs.map(x => x.dataset.w));
      if (wrongOnce) for (const x of Q.cloze.extra) { await tap(`.pv-tray .mx-chip[data-w="${x}"]`); await tap(`.mx-blank[data-w="${words[0]}"]`); }
      for (const w of words) { await tap(`.pv-tray .mx-chip[data-w="${w}"]`); await tap(`.mx-blank[data-w="${w}"]:not(.ok)`); }
      await sleep(2000);
    } else if (kind === 'caps') {
      const ids = await p.$$eval('.mx-panel', ps => ps.map(x => x.dataset.id));
      if (wrongOnce) { await tap('.mx-capcard[data-lie]'); }
      for (const id of ids) { await tap(`.mx-capcard[data-id="${id}"]`); await tap(`.mx-panel[data-id="${id}"] .mx-cap`); }
      await sleep(2200);
    } else if (kind === 'err') {
      for (let n = 0; n < 2; n++) {
        await p.waitForSelector('.mx-bubble .mx-w');
        const show = (await p.textContent('.mx-bubble p')).trim();
        const e = Object.values(Q.errs).find(x => x.show === show);
        const words = await p.$$eval('.mx-bubble .mx-w', ws => ws.map(w => w.textContent));
        const bare = w => w.replace(/[.,!?«»:;\u2014]/g, '');
        if (wrongOnce && n === 0) { const ok = words.findIndex(w => bare(w) !== e.wrong); await p.locator('.mx-bubble .mx-w').nth(ok).click(); await sleep(200); }
        await p.locator('.mx-bubble .mx-w').nth(words.findIndex(w => bare(w) === e.wrong)).click(); await sleep(300);
        await tap(`.pv-tray .mx-chip[data-f="${e.fix[0]}"]`);
        await sleep(1900);
      }
    } else if (kind === 'voice') {
      const q = await p.evaluate(() => { const t = document.querySelector('.pv-card p').textContent; return Object.keys(window.QUIZ.voice).find(k => t.startsWith(window.QUIZ.voice[k].text)); });
      const v = Q.voice[q];
      const answer = wrongOnce ? 'не помню' : v.groups.map(g => g.stems[0] + (g.stems[0].length < 4 ? '' : 'ом')).join(', ');
      await tap('.pv-write'); await p.fill('.pv-text input', mode === 'right' ? v.full.replace(/^Верно! /, '') : answer); await tap('.pv-text button');
      await sleep(600);
      if (wrongOnce) { await tap('.pv-write'); await p.fill('.pv-text input', v.full.replace(/^Верно! /, '')); await tap('.pv-text button'); await sleep(600); }
      await p.waitForSelector('.pv-row .pv-btn'); await tap('.pv-row .pv-btn');   // "Дальше ->"
    }
    done.push(kind);
  }
  await p.waitForFunction(() => document.documentElement.classList.contains('mx-fin'), null, {timeout: 20000});
  const skills = await p.evaluate(() => JSON.parse(localStorage.getItem((window.QUIZ.key || 'quiz') + '-skills') || '{}'));
  const results = posted.filter(m => m && m.type === 'proverka').map(m => [m.kind, m.r]);
  const next = await p.evaluate(() => window.PROVERKI.v1.kinds());
  await ctx.close();
  return {mode, kinds: done, results, skills, nextV1: next, errors: [...new Set(errs)]};
}

let ok = true;
for (const mode of MODES) {
  const r = await walk(mode);
  report.runs.push(r);
  const allOk = r.results.length === r.kinds.length && r.results.every(([, g]) => g === 'ok');
  const failed = r.results.filter(([, g]) => g !== 'ok').map(([k]) => k);
  const rotationOk = mode !== 'wrong' || (r.nextV1[0] === 'cloze' && r.nextV1.slice(0, 3).every(k => WRONG.includes(k)));
  const pass = (mode === 'right' ? allOk : failed.length > 0 && rotationOk) && !r.errors.length;
  ok = ok && pass;
  console.log(`${pass ? '✓' : '✗'} ${mode}: ${r.results.map(([k, g]) => `${k}=${g}`).join(' ')}` +
    (mode === 'wrong' ? `\n    next "after the cartoon" set: ${r.nextV1.join(', ')} (failed kinds first: ${rotationOk ? 'yes' : 'NO'})` : '') +
    (r.errors.length ? `\n    errors: ${r.errors.join(' | ')}` : ''));
}
if (FLAG.json) fs.writeFileSync(FLAG.json, JSON.stringify(report, null, 1));
await b.close();
if (server) server.close();
process.exit(ok ? 0 : 1);
