---
name: lesson-cartoon
description: Turn a lesson passage into a narrated 1-2 minute cartoon on the lesson-to-cartoon-engine (script, voice with word timings, window pictures and layers, scene keyed to words, quiz of 8 task kinds, numeric acceptance, independent review, video). Use when asked to "make a cartoon for this lesson", "re-voice the cartoon", "add a quiz to the cartoon", "finish the scene" or "export the cartoon video".
---

# Lesson cartoon (template)

A cartoon is one scene on this engine: 6-8 windows (picture-worlds), a camera and layers that move on the words of the
narration, subtitles with the spoken word highlighted, a "what we learned" sheet and a board at the end, then a quiz.
Audience: <grade / age>. Language of the lesson: <language>.

Reference scene: `demo/fire/` (copy its page, config and window files). Window API: `docs/ENGINE_API.md`.
Rules and thresholds: `docs/PIPELINE.md` and `docs/QA.md`. Read all three before starting.

## Ask before you start
- Which passage, and where it ends. Longer than ~2 minutes of narration: split into several cartoons.
- Budget: TTS characters (~3,000 per cartoon with quiz lines) and image credits (<= ~40 per cartoon).
- Visual style (photo or comic) and the voice (`ELEVENLABS_VOICE_ID`), the same voice as the live tutor.

## 1. Script: `<scene>/text.json`
`[{id, show, say, after}]`; `show` = subtitle, `say` = reading (numbers in words, `+` after a stressed vowel),
`after` = 2.0-2.4 s at window junctions. Write the facts in your own words, then run:
```bash
python pipeline/text/overlap_check.py --corpus <source texts> --check <scene>   # 0 runs of 8 shared words
```
Write `<scene>/STORYBOARD.md`: per window the picture brief, phrases, captions, the one strong effect on its key word,
moving objects, the transition, the chapter inset, and the sheet items.

## 2. Voice
```bash
node pipeline/narration/ozvuchka-11labs.mjs <scene> text.json            # narration-voice.mp3 + beats.json + words.json
python pipeline/narration/slova.py <scene> --audio narration-voice.mp3   # optional: word timings by ASR instead
python pipeline/audio/mix_narration.py <voice.wav> <music.wav> <phrases.json> <scene>   # music 24 dB under the voice
```
Re-voice one phrase: `--zanovo=<id>`. Only pauses changed: `pipeline/narration/pauzy-slova.mjs`.

## 3. Pictures and layers
Image model, 16:9, 2000x1116 (`pipeline/frames/frames_to_windows.py` for renders). Check every picture by eye:
anachronisms, generator letters, anatomy. Layers: `pipeline/layers/depth.py`, `sam_mask.py`, `lama_fill.py`,
`cutout.py`. Quiz panels: `pipeline/frames/make_panels.py` (re-cut after any picture fix).

## 4. Scene
`<scene>/index.html` with `window.KINO` (windows, board, theme, player flags), `okna/w1.js ... itog.js`.
Strong effect: one per phrase, on the key word. Camera: no zoom while small labels are in frame. No `setTimeout`,
no state between frames.

## 5. Quiz
`<scene>/quiz-<topic>.js` = `window.QUIZ` for `quiz/proverka-bank.js`: 8 kinds, sets with rotation, offline judge
keyword groups for voice answers. Walk it: `node qa/quiz-walk.mjs <scene>/index.html`.

## 6. Acceptance, then an independent review
```bash
node qa/kino-priemka.mjs <scene>/index.html --bystro      # fast, 735x587
node qa/kino-priemka.mjs <scene>/index.html --plus815     # full, 4 sizes
```
Target: 0 red, 0 flicker, clean console. Then start a separate reviewer agent that only reads and reports: text vs
sources, snapshots every 3-4 s through the eyes of the audience, motion vs the reference scene, anachronisms, cut labels.
Fix the blockers and important findings, re-run acceptance, review again.

## 7. Video
```bash
node qa/kino-video.mjs <scene>/index.html --rezhim=1280x720 --out=release-assets/video   # PSNR-verified MP4
```
One render at a time.

## Done when
- [ ] overlap check clean; captions = facts of the passage only
- [ ] narration + words for every track
- [ ] pictures checked by eye; panels re-cut
- [ ] acceptance: 0 red at all sizes, 0 flicker, clean console
- [ ] independent review passed
- [ ] quiz walk passes (right answers all "ok"; failed kinds come back first)
- [ ] video exported and verified
- [ ] nothing pushed or deployed without an explicit yes
