// Word timings from a TTS character alignment (pipeline/narration/alignment.mjs).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wordsFromAlignment, sentenceRanges} from '../../pipeline/narration/alignment.mjs';

// "Огонь горел. Ночь." with a stress mark after the first "о" of "горел" (U+0301 is not a letter)
const chars = [...'Огонь го\u0301рел. Ночь.'];
const al = {characters: chars, character_start_times_seconds: chars.map((_, i) => i * .1), character_end_times_seconds: chars.map((_, i) => i * .1 + .1)};

test('splits characters into words, drops the stress mark, keeps punctuation on the word', () => {
  const w = wordsFromAlignment(al);
  assert.deepEqual(w.map(x => x[0]), ['Огонь', 'горел.', 'Ночь.']);
  assert.equal(w[0][1], 0);
  assert.equal(w[0][2], .5);
});

test('shift moves every word onto the track timeline', () => {
  const w = wordsFromAlignment(al, {shift: 10});
  assert.equal(w[1][1], 10.6);
});

test('sentence ranges walk the characters and the texts together', () => {
  const r = sentenceRanges(al, [{id: 'a', text: 'Огонь го\u0301рел.'}, {id: 'b', text: 'Ночь.'}]);
  assert.equal(r[0].id, 'a');
  assert.deepEqual(wordsFromAlignment(al, {from: r[1].from, to: r[1].to}).map(x => x[0]), ['Ночь.']);
  assert.throws(() => sentenceRanges(al, [{id: 'x', text: 'Вода.'}]));
});
