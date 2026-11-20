// Word timings from the TTS service's own character alignment (ElevenLabs /with-timestamps), as an alternative to
// recognising the finished track with Whisper (slova.py). Both write the same words.json format:
//   {"<phrase id>": [["word", start, end], ...]}   seconds from the start of the track.
// The stress mark U+0301 that a script may carry for pronunciation is not a letter and is dropped.

/** Split a character alignment into words. alignment = {characters:[], character_start_times_seconds:[],
 *  character_end_times_seconds:[]}; from/to select a character range (one sentence of a group); shift moves the
 *  times onto the track timeline. */
export function wordsFromAlignment(alignment, {from = 0, to = alignment.characters.length, shift = 0} = {}) {
  const ch = alignment.characters, st = alignment.character_start_times_seconds, en = alignment.character_end_times_seconds;
  const out = [];
  let word = '', s = null, e = null;
  const flush = () => { if (word && /[\p{L}\p{N}]/u.test(word)) out.push([word, +(s + shift).toFixed(3), +(e + shift).toFixed(3)]); word = ''; s = e = null; };
  for (let i = from; i < to; i++) {
    const c = ch[i];
    if (/\s/.test(c)) { flush(); continue; }
    if (c === '\u0301') continue;
    if (s == null) s = st[i];
    e = en[i];
    word += c;
  }
  flush();
  return out;
}

/** Find where each sentence of a group starts and ends in the alignment, by walking the characters and the texts
 *  together (the service may normalise spaces). Returns [{id, from, to, s, e}] with character ranges and times. */
export function sentenceRanges(alignment, sentences) {
  const ch = alignment.characters, st = alignment.character_start_times_seconds, en = alignment.character_end_times_seconds;
  const res = [];
  let i = 0;
  for (const {id, text} of sentences) {
    while (i < ch.length && /\s/.test(ch[i])) i++;
    const i0 = i;
    let k = 0;
    while (i < ch.length && k < text.length) { if (ch[i] === text[k]) k++; i++; }
    if (k < text.length) throw new Error(`alignment does not match the text of ${id}`);
    res.push({id, from: i0, to: i, s: st[i0], e: en[i - 1]});
  }
  return res;
}
