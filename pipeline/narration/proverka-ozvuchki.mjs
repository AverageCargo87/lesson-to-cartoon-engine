// TTS self-check: does the track say what the script says? A voice model sometimes stumbles and repeats or swallows a
// word, which is easy to miss by ear. Every phrase is compared with what a recogniser heard in it, as a word error rate.
//
//   node pipeline/narration/proverka-ozvuchki.mjs <scene dir> [text.json]               offline: uses words.json (Whisper)
//   node pipeline/narration/proverka-ozvuchki.mjs <scene dir> [text.json] --speechkit   cuts each phrase and sends it to
//        Yandex SpeechKit (YC_API_KEY, YC_FOLDER_ID in the environment)
//
// Prints the phrases where the heard words differ noticeably (WER > 20 % or two or more extra words). Numbers written in
// digits in "say" are false alarms.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dir = resolve(args[0]), textName = args[1] || 'text.json', SPEECHKIT = process.argv.includes('--speechkit');
const lines = JSON.parse(readFileSync(join(dir, textName), 'utf8'));
const {beats} = JSON.parse(readFileSync(join(dir, 'beats.json'), 'utf8'));
const words = s => s.toLowerCase().replace(/ё/g, 'е').replace(/\+/g, '').replace(/[^а-яa-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
function wer(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] / Math.max(1, a.length);
}
async function speechkit(b) {
  const key = process.env.YC_API_KEY, folder = process.env.YC_FOLDER_ID;
  if (!key) throw new Error('Set YC_API_KEY (and YC_FOLDER_ID) for --speechkit');
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(b.start), '-to', String(b.end), '-i', join(dir, 'narration.mp3'), '-ac', '1', '-ar', '16000', '-f', 's16le', '-']);
  const p = new URLSearchParams({lang: 'ru-RU', format: 'lpcm', sampleRateHertz: '16000'});
  if (folder) p.set('folderId', folder);
  for (let k = 0; k < 3; k++) {
    const r = await fetch('https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?' + p, {method: 'POST', headers: {Authorization: 'Api-Key ' + key}, body: pcm});
    if (r.ok) return (await r.json()).result || '';
    await new Promise(res => setTimeout(res, 1000));
  }
  return '';
}
const recognised = SPEECHKIT ? null : JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
let bad = 0, sum = 0;
for (const [i, b] of beats.entries()) {
  const say = [].concat(lines[i].say || lines[i].show).join(' ');
  const heard = SPEECHKIT ? await speechkit(b) : (recognised[b.id] || []).map(w => w[0]).join(' ');
  const w = wer(words(say), words(heard)), extra = words(heard).length - words(say).length;
  sum += w;
  if (w > 0.2 || extra >= 2) {
    bad++;
    console.log(`!! ${b.id.padEnd(12)} errors ${Math.round(w * 100)} %${extra > 0 ? `, extra words ${extra}` : ''}\n   text:  ${say.replace(/\+/g, '')}\n   heard: ${heard}`);
  }
}
console.log(`${textName}: phrases ${beats.length}, suspicious ${bad}, mean WER ${(100 * sum / beats.length).toFixed(1)} % (${SPEECHKIT ? 'SpeechKit' : 'words.json'})`);
