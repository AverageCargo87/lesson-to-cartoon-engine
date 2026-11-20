// Shift word timings after only the PAUSES of a track changed, without recognising the voice again.
//
// When only the "after" pauses in text.json change and the track is rebuilt from the cache, every phrase sounds
// exactly as before and only its start moves. Re-running slova.py is not needed and can even hurt (words.json may hold
// hand corrections). This script takes the OLD beats and words and moves every word of a phrase by
// (new start - old start) of that phrase.
//
//   node pipeline/narration/pauzy-slova.mjs <scene dir> <folder with the old beats.json and words.json>
//
// Stops with an error when: phrases differ in id or order; a phrase's duration (end - start) changed by more than
// 0.01 s (the voice itself changed: run slova.py instead); a phrase has no words. The old files are read from a separate
// folder, so running the script twice never shifts the words twice.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';

const [sceneArg, oldArg] = process.argv.slice(2);
if (!sceneArg || !oldArg) { console.error('Usage: node pipeline/narration/pauzy-slova.mjs <scene dir> <folder with the old beats and words>'); process.exit(2); }
const scene = resolve(sceneArg), old = resolve(oldArg);
if (scene === old) throw new Error('The old beats/words must live in another folder, otherwise the words would move twice');
const read = f => { if (!existsSync(f)) throw new Error('No file ' + f); return JSON.parse(readFileSync(f, 'utf8')); };
const oldBeats = read(join(old, 'beats.json')).beats;
const newBeatsFile = read(join(scene, 'beats.json')), newBeats = newBeatsFile.beats;
const oldWords = read(join(old, 'words.json'));

const r3 = x => Math.round(x * 1000) / 1000;
if (oldBeats.length !== newBeats.length) throw new Error(`Number of phrases differs: was ${oldBeats.length}, now ${newBeats.length}`);
const out = {}, rows = [];
for (let i = 0; i < newBeats.length; i++) {
  const o = oldBeats[i], n = newBeats[i];
  if (o.id !== n.id) throw new Error(`Phrase #${i + 1}: was ${o.id}, now ${n.id}: the order changed`);
  const dOld = o.end - o.start, dNew = n.end - n.start;
  if (Math.abs(dOld - dNew) > .01) throw new Error(`${n.id}: duration was ${dOld.toFixed(3)} s, now ${dNew.toFixed(3)} s: the voice changed, run slova.py`);
  const ws = oldWords[o.id];
  if (!Array.isArray(ws) || !ws.length) throw new Error(`${o.id}: the old words.json has no words`);
  const d = r3(n.start - o.start);
  out[n.id] = ws.map(([w, s, e]) => [w, r3(s + d), r3(e + d)]);
  rows.push([n.id, o.start, n.start, d, ws.length]);
}
for (const id of Object.keys(oldWords)) if (!(id in out)) throw new Error(`The old words.json has "${id}", which is not in beats.json`);
writeFileSync(join(scene, 'words.json'), JSON.stringify(out));
console.log('phrase      old start -> new start   shift   words');
for (const [id, a, b, d, k] of rows) console.log(`${id.padEnd(10)} ${a.toFixed(3).padStart(8)} -> ${b.toFixed(3).padStart(8)}   ${(d >= 0 ? '+' : '') + d.toFixed(3)}   ${k}`);
console.log(`-> words.json (track total ${newBeatsFile.total} s)`);
