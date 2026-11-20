// Narration of a scene with ElevenLabs: every phrase is synthesised on its own, the phrases are joined with controlled
// pauses, and the timeline files the scene keys on are written next to the track.
//
//   node pipeline/narration/ozvuchka-11labs.mjs <scene dir> [text.json] [--zanovo=id1,id2] [--cena]
//     -> narration-voice.mp3 + beats.json + words.json (word timings from the service's character alignment)
//
// text.json: [{id, show, say?, after?, gap?, gaps?}]. show is the subtitle text, say is how to read it (numbers in
// words, a "+" after a stressed vowel becomes U+0301 so the voice stresses it), say may be an array of parts read with
// gaps; after is the pause after the phrase (2.0-2.4 s at a window junction, 0.8 s inside a window by default).
// Config (env, see .env.example): ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL (default eleven_v4).
// Responses are cached in <scene>/.tts by a hash of (voice, model, settings, text): an unchanged phrase costs nothing.
// --zanovo=<ids> re-synthesises those phrases (a voice sometimes stumbles); --cena only counts characters and quits.
// Same-voice rule: recorded narration and live tutor replies must use the same voice, model and settings.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {wordsFromAlignment} from './alignment.mjs';

const dir = resolve(process.argv[2] || '');
const textName = (process.argv[3] && !process.argv[3].startsWith('--')) ? process.argv[3] : 'text.json';
const zanovo = new Set((process.argv.find(a => a.startsWith('--zanovo=')) || '').slice(9).split(',').filter(Boolean));
const CENA = process.argv.includes('--cena');
const VOICE = process.env.ELEVENLABS_VOICE_ID, MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v4';
const SETTINGS = {stability: .5, similarity_boost: .75};
const RATE = 24000, LEAD = 0.8, PAUSE = 0.8, TAIL = 2.2;

const lines = JSON.parse(readFileSync(join(dir, textName), 'utf8'));
const U = s => s.replace(/\+/g, '\u0301');
const chars = lines.flatMap(l => [].concat(l.say || l.show)).reduce((a, s) => a + s.replace(/\+/g, '').length, 0);
console.log(`${lines.length} phrases, ${chars} characters`);
if (CENA) process.exit(0);
const key = process.env.ELEVENLABS_API_KEY;
if (!key || !VOICE) throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID (see .env.example)');

async function synth(text) {
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=pcm_${RATE}`, {method: 'POST', redirect: 'manual',
      headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
      body: JSON.stringify({text, model_id: MODEL, language_code: 'ru', voice_settings: SETTINGS})});
    if (res.status === 302 || res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; }
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.text();
  }
  throw new Error('ElevenLabs did not answer after 8 attempts');
}
const silence = s => Buffer.alloc(Math.round(s * RATE) * 2);
const tmp = join(dir, '.tts'); mkdirSync(tmp, {recursive: true});
async function piece(say, fresh) {
  const h = createHash('sha1').update(['11labs-ts', VOICE, MODEL, JSON.stringify(SETTINGS), RATE, U(say)].join('|')).digest('hex').slice(0, 12);
  const f = join(tmp, `11-${h}.json`);
  if (fresh || !existsSync(f)) writeFileSync(f, await synth(U(say)));
  return JSON.parse(readFileSync(f, 'utf8'));
}

const parts = [silence(LEAD)], beats = [], words = {};
let t = LEAD;
for (const [i, l] of lines.entries()) {
  const say = [].concat(l.say || l.show), start = t, marks = [];
  words[l.id] = [];
  for (const [j, p] of say.entries()) {
    const r = await piece(p, zanovo.has(l.id));
    const pcm = Buffer.from(r.audio_base64, 'base64');
    words[l.id].push(...wordsFromAlignment(r.alignment, {shift: t}));
    marks.push(+t.toFixed(3)); parts.push(pcm); t += pcm.length / 2 / RATE;
    if (j < say.length - 1) { const g = l.gaps?.[j] ?? l.gap ?? .6; parts.push(silence(g)); t += g; }
  }
  const b = {id: l.id, start: +start.toFixed(3), end: +t.toFixed(3), show: l.show};
  if (say.length > 1) b.marks = marks;
  beats.push(b);
  const gap = l.after ?? (i < lines.length - 1 ? PAUSE : TAIL);
  parts.push(silence(gap)); t += gap;
  console.log(`${String(i + 1).padStart(2)} ${l.id.padEnd(10)} ${(b.end - b.start).toFixed(2)} s${say.length > 1 ? ` (${say.length} parts)` : ''}`);
}
const raw = join(tmp, '_all.pcm');
writeFileSync(raw, Buffer.concat(parts));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', raw,
  '-af', 'highpass=f=70,loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '48000', '-b:a', '192k', join(dir, 'narration-voice.mp3')]);
const total = +t.toFixed(3);
writeFileSync(join(dir, 'beats.json'), JSON.stringify({total, beats}, null, 1));
writeFileSync(join(dir, 'words.json'), JSON.stringify(words));
console.log(`total ${total.toFixed(1)} s, ${chars} characters -> narration-voice.mp3 + beats.json + words.json`);
