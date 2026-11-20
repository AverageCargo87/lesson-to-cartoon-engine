// Consistency of a scene's data files: the timeline, the word timings, the pictures the windows and the quiz ask for.
//   node --test qa/tests/
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCENE = path.join(ROOT, 'demo/fire');
const json = f => JSON.parse(fs.readFileSync(path.join(SCENE, f), 'utf8'));
const beats = json('beats.json'), words = json('words.json'), text = json('text.json');

test('beats are ordered, non-overlapping and inside the track', () => {
  let prev = 0;
  for (const b of beats.beats) {
    assert.ok(b.start >= prev - 1e-9, `${b.id} starts before the previous phrase ends`);
    assert.ok(b.end > b.start, `${b.id} has no duration`);
    prev = b.end;
  }
  assert.ok(beats.total >= prev, 'total shorter than the last phrase');
});

test('every phrase has word timings inside the phrase (0.3 s tolerance)', () => {
  for (const b of beats.beats) {
    const ws = words[b.id];
    assert.ok(Array.isArray(ws) && ws.length, `${b.id}: no words`);
    for (const [w, s, e] of ws) {
      assert.ok(s >= b.start - .3 && e <= b.end + .3, `${b.id}: "${w}" ${s}-${e} outside ${b.start}-${b.end}`);
      assert.ok(e >= s, `${b.id}: "${w}" ends before it starts`);
    }
  }
});

test('recognised words spell the subtitle text (letters only)', () => {
  const letters = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я]/g, '');
  for (const b of beats.beats) assert.equal(letters(words[b.id].map(w => w[0]).join('')), letters(b.show), b.id);
});

test('text.json and beats.json describe the same phrases', () => {
  assert.deepEqual(text.map(t => t.id), beats.beats.map(b => b.id));
  for (const t of text) assert.equal(t.show, beats.beats.find(b => b.id === t.id).show);
});

test('every picture the windows load exists', () => {
  const okna = fs.readdirSync(path.join(SCENE, 'okna')).map(f => fs.readFileSync(path.join(SCENE, 'okna', f), 'utf8')).join('\n');
  const names = [...okna.matchAll(/k\.bg\(W\d, '([^']+)'/g)].map(m => m[1]);
  assert.ok(names.length >= 6);
  for (const n of names) assert.ok(fs.existsSync(path.join(SCENE, 'art', n + '.webp')), n);
});

test('the quiz bank references only existing panels and consistent answers', () => {
  const ctx = {window: {}};
  vm.runInNewContext(fs.readFileSync(path.join(SCENE, 'quiz-fire.js'), 'utf8'), ctx);
  const Q = ctx.window.QUIZ;
  const panels = new Set([...Q.lenta.steps.flatMap(s => s.items.map(i => i[2])), ...Q.tf.map(x => x.img), ...Object.keys(Q.caps),
    ...Object.values(Q.errs).map(e => e.img), ...Object.values(Q.voice).flatMap(v => v.imgs), ...Object.values(Q.thumbs)]);
  for (const id of panels) assert.ok(fs.existsSync(path.join(SCENE, 'art/paneli', id + '.webp')), 'panel ' + id);
  assert.ok(fs.existsSync(path.join(SCENE, 'art', Q.karta.img + '.webp')));
  for (const [id, e] of Object.entries(Q.errs)) {
    assert.ok(e.show.split(/\s+/).some(w => w.replace(/[.,!?«»:;]/g, '') === e.wrong), `${id}: the wrong word is not in the phrase`);
    assert.ok(!e.fix.slice(1).includes(e.fix[0]), `${id}: the right fix is duplicated`);
  }
  for (const l of Q.cloze.lines) assert.ok(!Q.cloze.extra.includes(l[1]), 'a decoy equals an answer: ' + l[1]);
  assert.equal(Object.keys(Q.names).length, 8, 'eight task kinds');
  assert.ok(Q.tf.filter(x => x.ok).length >= 3 && Q.tf.filter(x => !x.ok).length >= 3, 'enough true and false cards for a set of 5');
});
