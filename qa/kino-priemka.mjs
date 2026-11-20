// Acceptance of a cartoon in one command: runs every measurement against the scene and writes one summary
// (txt + json) with green / red per check, plus a 1 fps contact sheet at 735x587 (the lesson's column size).
//
// What it runs (each script writes its own .txt and .json into the summary folder):
//   kino-nadpisi  (all sizes)   labels fully in frame, not on the subtitle, not overlapping, not hanging after leaving
//   kino-nadpisi --doska        the board after the cartoon: labels not under a button or card, the focused window whole
//   kino-migania  (735x587)     label flicker
//   kino-plavnost (all sizes)   camera flight speed, jerk, overlapping moves, share of time the camera stands still
//   kino-sobytiya (STRICT=1)    dead stretches >= 2.5 s while the voice speaks, rules of strong effects
//   kino-drozh    (735x587)     glyph jitter of labels while the camera moves
//   and here: seeking gives the same frame (jump forward, jump back, frame by frame), reduced motion without errors,
//   a 1 fps contact sheet.
//
//   node qa/kino-priemka.mjs <scene path or URL> [--out=folder] [--razmery=735x587,874x648,1440x900] [--plus815]
//        [--baza=previous summary folder] [--bez=drozh,migania,...] [--potoki=2] [--otrezok=0-72] [--bystro]
//   --baza compares with a previous summary ("was -> now"); --bystro runs only 735x587 and skips jitter.
import {chromium} from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sceneUrl, launchOpts, ensureServer} from './common.mjs';

const ARGV = process.argv.slice(2), FLAG = Object.fromEntries(ARGV.filter(a => a.startsWith('--')).map(a => {const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : '1'];})), POS = ARGV.filter(a => !a.startsWith('--'));
const DIR = path.dirname(fileURLToPath(import.meta.url));
const server = await ensureServer();
const SCENE = sceneUrl(POS[0] || 'demo/fire/index.html');
const BYSTRO = !!FLAG.bystro;
const RAZ = BYSTRO ? '735x587' : (FLAG.razmery || '735x587,874x648,1440x900') + (FLAG.plus815 ? ',735x815' : '');
const BEZ = new Set((FLAG.bez || '').split(',').filter(Boolean).concat(BYSTRO ? ['drozh'] : []));
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
const name = SCENE.split('?')[0].replace(/\/[^/]*$/, '').split('/').pop();
const OUT = path.resolve(FLAG.out || `qa/results/${name}-${stamp}`); fs.mkdirSync(OUT, {recursive: true});
const log = (...a) => console.log(...a);
const SV = {scene: SCENE.replace(/^https?:\/\/[^/]+\//, ''), sizes: RAZ.split(','), when: new Date().toISOString(), checks: [], numbers: {}, files: {}};
const check = (id, title, ok, detail, {info = false, numbers = null} = {}) => {SV.checks.push({id, title, status: info ? 'info' : ok ? 'green' : 'red', detail}); if (numbers) Object.assign(SV.numbers, numbers);};
const b = await chromium.launch(launchOpts());
log(`acceptance: ${SCENE}\nfolder: ${OUT}`);

// ── 1. the measurement scripts, two at a time ──────────────────────────────────────────────────────────────────
const RUNS = [
 {id: 'nadpisi', args: ['kino-nadpisi.mjs', SCENE, '0.2', `--razmery=${RAZ}`]},
 {id: 'doska', args: ['kino-nadpisi.mjs', SCENE, `--razmery=${RAZ}`, '--doska', `--snimki=${path.join(OUT, 'doska')}`]},
 {id: 'migania', args: ['kino-migania.mjs', SCENE, '1/30', '--razmery=735x587']},
 {id: 'plavnost', args: ['kino-plavnost.mjs', SCENE, '--legs=auto', `--razmery=${RAZ}`].concat(FLAG.otrezok ? [`--otrezok=${FLAG.otrezok}`] : [])},
 {id: 'sobytiya', args: ['kino-sobytiya.mjs', SCENE, '2.5', '1']},
 {id: 'drozh', args: ['kino-drozh.mjs', SCENE, '--razmery=735x587', '--n=8'], env: {PROBES: 'auto'}},
].filter(r => !BEZ.has(r.id));
function runOne(r) {return new Promise(res => {const t0 = Date.now(); const json = path.join(OUT, r.id + '.json'), txt = path.join(OUT, r.id + '.txt');
 const ch = spawn(process.execPath, [path.join(DIR, r.args[0]), ...r.args.slice(1), `--json=${json}`], {cwd: process.cwd(), env: Object.assign({}, process.env, r.env || {})});
 const out = fs.createWriteStream(txt); ch.stdout.pipe(out); ch.stderr.pipe(out);
 ch.on('close', code => {log(`  ${code === 0 ? 'done' : 'ERROR ' + code}: ${r.id} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); SV.files[r.id] = path.basename(txt); res({id: r.id, code, json, txt});});});}
async function pool(list, n) {const res = [], q = [...list]; await Promise.all(Array.from({length: n}, async () => {while (q.length) {const r = q.shift(); res.push(await runOne(r));}})); return res;}
const pRuns = pool(RUNS, +(FLAG.potoki || 2));

// ── 2. here, while the scripts measure: seeking, reduced motion, the contact sheet ─────────────────────────────
// A virtual clock: performance.now() is frozen to the frame time, CSS animations are set to that time too.
const INIT = () => {window.__vt = 0; performance.now = () => window.__vt; const VS = new WeakMap();
 window.__kadr = t => {window.__vt = t * 1000; window.multik.seek(t);
  for (const a of document.getAnimations()) {a.pause(); if (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation) a.currentTime = t * 1000; else {if (!VS.has(a)) VS.set(a, t); a.currentTime = Math.max(0, (t - VS.get(a)) * 1000);}}};
 window.__dovesti = () => {for (const a of document.getAnimations()) {if (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation) continue; VS.set(a, -1e6); a.pause(); try {a.currentTime = 1e9;} catch (e) {}}};};
async function open(W, H, {reduce = false, init = null} = {}) {
 const ctx = await b.newContext({viewport: {width: W, height: H}, reducedMotion: reduce ? 'reduce' : 'no-preference'});
 const p = await ctx.newPage(), errs = [];
 p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => {if ((m.type() === 'error' || m.type() === 'warning') && !/^Failed to load resource/.test(m.text())) errs.push(m.type() + ': ' + m.text());});
 p.on('response', q => {if (q.status() >= 400 && !/favicon/.test(q.url())) errs.push(q.status() + ' ' + q.url());});
 if (init) await p.addInitScript(init);
 await p.goto(SCENE, {waitUntil: 'networkidle', timeout: 180000});
 await p.waitForFunction(() => window.multik && window.kino && window.kino.MV && window.kino.MV.length, null, {timeout: 180000});
 await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
 return {ctx, p, errs};
}
const raf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const raw = async buf => (await sharp(buf).removeAlpha().raw().toBuffer());
const psnr = (a, c) => {let s = 0; for (let i = 0; i < a.length; i++) {const d = a[i] - c[i]; s += d * d;} const m = s / a.length; return m < 1e-9 ? 99 : +(10 * Math.log10(255 * 255 / m)).toFixed(1);};
let loadErrs = [];
{
 const {ctx, p, errs} = await open(735, 587, {init: INIT});
 const info = await p.evaluate(() => ({total: window.multik.total, beats: window.multik.beats.map(b => ({id: b.id, start: b.start, end: b.end}))}));
 SV.numbers.total = +info.total.toFixed(3);
 const frame = async t => {await p.evaluate(t => {window.__kadr(t); window.__dovesti(); window.__kadr(t);}, t); await raf(p); return p.screenshot({type: 'png'});};
 // the frame at t: reached by a jump from 0, by a jump back from t+5, and frame by frame (t-1 -> t at 1/30 s, like playback)
 const pts = [.2, .4, .6, .8].map(f => +(info.total * f).toFixed(2)); const per = [];
 for (const t of pts) {
  await p.evaluate(() => window.__kadr(0)); const A = await frame(t);
  await p.evaluate(t => window.__kadr(t), Math.min(info.total - .1, t + 5)); const B = await frame(t);
  for (let s = t - 1; s < t - 1e-6; s += 1 / 30) {await p.evaluate(s => window.__kadr(s), s); await raf(p);} const C = await frame(t);
  const a = await raw(A); per.push({t, back: psnr(a, await raw(B)), stepwise: psnr(a, await raw(C))});
 }
 const perOk = per.every(q => q.back >= 60 && q.stepwise >= 60);
 check('seek', 'Seeking gives the same frame (?t=, jump forward/back, frame by frame)', perOk,
  per.map(q => `${q.t} s: back ${q.back === 99 ? 'identical' : q.back + ' dB'}, stepwise ${q.stepwise === 99 ? 'identical' : q.stepwise + ' dB'}`).join('; ') + ' (PSNR, 99 = no difference; threshold 60 dB)',
  {numbers: {seekMinPSNR: Math.min(...per.flatMap(q => [q.back, q.stepwise]))}});
 // contact sheet, 1 fps: frame at t+0.5 s, half-size tiles with the time and the phrase
 const TW = 368, TH = 294, LH = 22, COLS = 4, ROWS = 5; const tiles = [];
 for (let t = .5; t < info.total; t += 1) {const buf = await frame(t); const bt = info.beats.filter(b => t >= b.start - .05).pop(); const sound = bt && t <= bt.end + .05 ? bt.id : (bt ? 'pause after ' + bt.id : '-');
  tiles.push({t, sound, img: await sharp(buf).resize(TW, TH).jpeg({quality: 82}).toBuffer()});}
 const esc = s => s.replace(/[<&>]/g, c => ({'<': '&lt;', '&': '&amp;', '>': '&gt;'}[c]));
 const sheets = [];
 for (let i = 0; i < tiles.length; i += COLS * ROWS) {const part = tiles.slice(i, i + COLS * ROWS), rows = Math.ceil(part.length / COLS);
  const comp = []; part.forEach((q, j) => {const x = (j % COLS) * TW, y = Math.floor(j / COLS) * (TH + LH); comp.push({input: q.img, left: x, top: y + LH});
   comp.push({input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${LH}"><rect width="100%" height="100%" fill="#15110d"/><text x="6" y="16" font-family="Arial" font-size="13" fill="#fff1c2">${esc(`${q.t.toFixed(1)} s · ${q.sound}`)}</text></svg>`), left: x, top: y});});
  const f = path.join(OUT, `contact-735x587-${String(sheets.length + 1).padStart(2, '0')}.jpg`);
  await sharp({create: {width: COLS * TW, height: rows * (TH + LH), channels: 3, background: '#2a2119'}}).composite(comp).jpeg({quality: 84}).toFile(f); sheets.push(f);}
 SV.files.contact = sheets.map(f => path.basename(f));
 check('contact', 'Contact sheet 1 fps, 735x587', true, `${tiles.length} frames on ${sheets.length} sheets: ${sheets.map(f => path.basename(f)).join(', ')}`, {info: true});
 loadErrs = [...new Set(errs)];
 await ctx.close();
}
{
 // prefers-reduced-motion: the whole timeline in 1.5 s steps and the finale (the board), without errors
 const {ctx, p, errs} = await open(735, 587, {reduce: true});
 const total = await p.evaluate(() => window.multik.total);
 for (let t = 0; t < total; t += 1.5) {await p.evaluate(t => window.multik.seek(t), t); await raf(p);}
 await p.evaluate(() => {window.multik.seek(window.multik.total - .06); window.multik.finish();}); await p.waitForTimeout(1500);
 const e = [...new Set(errs)].filter(x => !/^warning:/.test(x));
 check('reduce', 'prefers-reduced-motion: the whole timeline and the board without errors', !e.length, e.length ? e.slice(0, 6).join(' | ') : 'no errors');
 await ctx.close();
}
const runs = await pRuns;
await b.close();

// ── 3. summary ─────────────────────────────────────────────────────────────────────────────────────────────────
const J = id => {try {return JSON.parse(fs.readFileSync(path.join(OUT, id + '.json'), 'utf8'));} catch (e) {return null;}};
for (const r of runs) if (r.code !== 0) check('script-' + r.id, `Script ${r.id} finished`, false, `exit code ${r.code}, see ${path.basename(r.txt)}`);
const allErrs = new Set(loadErrs);
{const nad = J('nadpisi'); if (nad) for (const s of Object.values(nad.sizes)) for (const e of s.errs || []) allErrs.add(e);
 const errors = [...allErrs].filter(e => !/^warning:/.test(e)), warnings = [...allErrs].filter(e => /^warning:/.test(e));
 check('console', 'Loading: no console errors or warnings, no 404', !errors.length && !warnings.length,
  (errors.length ? 'errors: ' + errors.slice(0, 6).join(' | ') + '. ' : '') + (warnings.length ? 'warnings: ' + warnings.slice(0, 6).join(' | ') : (errors.length ? '' : 'clean')),
  {numbers: {errors: errors.length, warnings: warnings.length}});}
{const m = J('migania'); if (m) {const s = Object.values(m.sizes)[0];
 check('flicker', 'Label flicker (kino-migania, 735x587): 0', s.migayushchih === 0, s.migayushchih ? `${s.migayushchih}: ${s.nadpisi.join(' · ')}` : 'no flickering labels in frame' + (s.sloi.length ? ` (canvas layers / shade with findings: ${s.sloi.length}, see migania.txt)` : ''), {numbers: {flicker: s.migayushchih}});}}
{const n = J('nadpisi'); if (n) for (const [sz, s] of Object.entries(n.sizes)) {const it = s.itog, L = Object.entries(s.labels).filter(([, v]) => !v.ok);
 const kinds = [['obrezana', 'cut by the edge'], ['naSubtitre', 'on the subtitle or bar'], ['naezd', 'overlapping'], ['vneKadra', 'opaque outside the frame'], ['visit', 'hanging after leaving'], ['podVrezkoy', 'under the chapter inset'], ['poyavilasZaKadrom', 'appeared outside the frame'], ['zaRamkoy', 'beyond the window frame']];
 const txt = kinds.map(([k, t]) => `${t} ${it[k]}`).join(', ');
 const ex = L.slice(0, 8).map(([k]) => `"${k.slice(0, 26)}"`).join(' ');
 check('labels-' + sz, `Labels ${sz}: fully in frame, not on the subtitle, not overlapping, not hanging`, it.sProblemami === 0, `of ${it.nadpisey} labels with remarks: ${it.sProblemami}: ${txt}${ex ? '. For example: ' + ex : ''}`, {numbers: {[`labels_${sz}`]: it.sProblemami}});
 check('numbers-' + sz, `Window numbers hidden until the finale (${sz})`, !it.nomeraOkon, it.nomeraOkon ? `visible numbers ${Object.keys(s.extra.badge).join(', ')}` : 'not visible', {numbers: {[`numbers_${sz}`]: it.nomeraOkon || 0}});
 check('subtitle-' + sz, `Subtitle and chapter insets in frame (${sz})`, !it.subtitrObrezan && !it.vrezkiObrezany && !it.vrezkaNaSubtitre, `subtitle cut: ${it.subtitrObrezan ? 'yes' : 'no'}; chapter insets ${it.vrezok}, cut ${it.vrezkiObrezany}, on the subtitle ${it.vrezkaNaSubtitre}`);}}
{const d = J('doska'); if (d) for (const [sz, s] of Object.entries(d.sizes)) {const all = s.doska.flatMap(r => r.res.map(x => r.tag + ': ' + x));
 const whole = s.doska.filter(r => r.okno && !r.okno.celikom).length, under = all.filter(x => /bd-/.test(x)).length;
 check('board-' + sz, `Board ${sz}: labels not under a button or card, the focused window whole`, s.zamechaniy === 0,
  s.zamechaniy ? `remarks ${s.zamechaniy}: window not whole ${whole} of ${s.doska.length - 1}, under a button/card/bar ${under}. For example: ${all.slice(0, 4).join(' | ')}` : 'clean',
  {numbers: {[`board_${sz}`]: s.zamechaniy}});}}
{const pl = J('plavnost'); if (pl) for (const [sz, s] of Object.entries(pl.sizes)) {
 const main = sz === '735x587';
 check('flight-' + sz, `Flights not faster than 30 px/frame (${sz}${main ? '' : ', for reference'})`, s.maxFly <= 30, `fastest ${s.maxFly} px/frame${s.flyMax ? ' (' + s.flyMax + ')' : ''}; cuts (not counted): ${s.cuts.length}`, {info: !main, numbers: {[`flight_${sz}`]: s.maxFly}});
 check('jerk-' + sz, `Camera jerk <= 0.7 (${sz}${main ? '' : ', for reference'})`, s.maxJerk <= .7, `sharpest ${s.maxJerk}${s.jerkMax ? ' (' + s.jerkMax + ')' : ''}; overlapping: ${s.vnahlyost.length ? s.vnahlyost.join('; ') : 'none'}`, {info: !main, numbers: {[`jerk_${sz}`]: s.maxJerk}});
 if (main) {check('overlap', 'Camera moves do not overlap', !s.vnahlyost.length, s.vnahlyost.length ? s.vnahlyost.join('; ') : 'none');
  check('still', 'Camera stands still <= 40 % of the time before the finale', s.vsego.stoit <= 40, `still ${s.vsego.stoit} % (${s.vsego.stoitS} s), creeping another ${s.vsego.polzyot} %; per window: ${Object.entries(s.poOknam).map(([k, o]) => `${k} ${o.stoit} %`).join(', ')}; stills > 2.5 s: ${s.still.length}`,
   {numbers: {still: s.vsego.stoit, stills: s.still.length}});}}}
{const s = J('sobytiya'); if (s) {
 check('dead', 'No dead stretches >= 2.5 s (voice speaks, nothing new in frame; STRICT=1)', !s.gaps.length, s.gaps.length ? s.gaps.map(g => `${g.beat} ${g.from}-${g.to} (${g.dur} s)`).join('; ') : 'none', {numbers: {dead: s.gaps.length, deadS: +s.gaps.reduce((a, g) => a + g.dur, 0).toFixed(1)}});
 check('effects', 'Strong effects follow the rules (on the word, one per phrase, shake <= 3, flashes <= 3, WebGL <= 2)', !s.narusheniya.length,
  `${s.strong.length ? `effects ${s.strong.length}, shakes ${s.tryaski}, flashes ${s.vspyshki}, WebGL at once up to ${s.glMax}` : 'no strong effects in the scene'}${s.narusheniya.length ? '; violations: ' + s.narusheniya.slice(0, 6).join(' | ') : ''}`,
  {numbers: {effects: s.strong.length, violations: s.narusheniya.length}});}}
{const d = J('drozh'); if (d) for (const [sz, s] of Object.entries(d.sizes)) {
 const rows = Object.entries(s.probes).filter(([, r]) => typeof r === 'object' && r.kadrov > 1).map(([id, r]) => {const q = r.bukvyPlashka || r.bukvy; return {id, mean: q.mean, max: q.max, n02: q.n02, ok: q.mean <= .12 && q.n02 <= 8};});
 const bad = rows.filter(r => !r.ok), worst = rows.slice().sort((a, c) => c.mean - a.mean)[0];
 check('jitter-' + sz, `Glyph jitter <= 0.12 px on average and <= 8 jumps > 0.2 px per probe (${sz}, ${rows.length} probes)`, !bad.length,
  `${bad.length ? 'jittering: ' + bad.map(r => `"${r.id.slice(0, 30)}" ${r.mean}/${r.max} px, ${r.n02} jumps`).join('; ') : 'all probes calm'}${worst ? `; worst "${worst.id.slice(0, 30)}" ${worst.mean} px` : ''}`,
  {numbers: {jitterProbes: rows.length, jitterBad: bad.length, jitterWorst: worst ? worst.mean : 0}});}}

let diff = [];
if (FLAG.baza) {try {const old = JSON.parse(fs.readFileSync(path.join(path.resolve(FLAG.baza), 'summary.json'), 'utf8'));
 for (const [k, v] of Object.entries(SV.numbers)) if (k in old.numbers && old.numbers[k] !== v) diff.push(`${k}: ${old.numbers[k]} -> ${v}`);
 const oldSt = Object.fromEntries(old.checks.map(q => [q.id, q.status])); for (const q of SV.checks) if (oldSt[q.id] && oldSt[q.id] !== q.status) diff.push(`${q.title}: ${oldSt[q.id]} -> ${q.status}`);
 SV.compare = {base: path.basename(path.resolve(FLAG.baza)), changes: diff};} catch (e) {diff = ['comparison failed: ' + e.message];}}

const green = SV.checks.filter(q => q.status === 'green').length, red = SV.checks.filter(q => q.status === 'red').length;
const mark = {green: '✓', red: '✗', info: '·'};
const lines = [`CARTOON ACCEPTANCE: ${SV.scene}`, `sizes: ${RAZ} · ${SV.when}`, `result: green ${green}, red ${red}`, '',
 ...SV.checks.map(q => `${mark[q.status]} ${q.title}\n    ${q.detail}`), '',
 diff.length ? `WAS -> NOW (base ${FLAG.baza}):\n  ` + diff.join('\n  ') : '',
 '', `details: ${Object.entries(SV.files).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.length + ' sheets' : v)).join(' · ')}`].filter(x => x !== '');
fs.writeFileSync(path.join(OUT, 'summary.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(SV, null, 1));
log('\n' + lines.join('\n'));
log(`\nsummary: ${path.join(OUT, 'summary.txt')}`);
if (server) server.close();
