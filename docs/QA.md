# Visual QA: measuring a cartoon instead of watching it

A cartoon is a moving picture with labels, a camera and a voice. Most of its defects are invisible in a code review and
easy to miss by eye: a label that sits half outside the column of a lesson on a phone, a caption that flickers for two
frames, a camera that jerks when two moves overlap, a stretch where the voice speaks and nothing changes. The QA suite
turns each of those into a number with a threshold. Most checks were added after such a defect slipped into a
production cartoon: word timings after captions came 1-1.5 s late, the jitter probe after DOM letters were seen shaking
on a slow drift. One more defect was found and fixed while extracting this repository: after a subtitle morph, a seek
gave a different frame than playback.

`node qa/kino-priemka.mjs <scene> [--plus815]` runs everything in one command and writes `summary.txt` / `summary.json`
plus a 1 fps contact sheet. The scene is served statically (`qa/serve.mjs`, HTTP Range for audio) and driven by
Playwright with a virtual clock: `performance.now()` is frozen to the timeline time and CSS animations are set to it, so
every measurement sees exactly the frame a viewer would see at that moment.

## The checks and their thresholds

| Script | What it measures | Threshold |
|---|---|---|
| `kino-priemka` (built in) | the same frame is reached by a jump from 0, a jump back from t+5 s and stepping frame by frame from t-1 s | PSNR >= 60 dB (99 = identical) |
| `kino-priemka` (built in) | the whole timeline and the board in `prefers-reduced-motion` | no errors |
| `kino-priemka` (built in) | console errors, warnings and 404s while loading | none |
| `kino-nadpisi` | every DOM label at every 0.2 s: fully inside the frame, not on the subtitle or the bar, not overlapping another label, not opaque outside the frame, not hanging after the camera left its window, not under the chapter inset, not beyond its window | 0 labels with remarks, at every viewport |
| `kino-nadpisi --doska` | the board after the cartoon: labels not under a button or a card, the focused window shown whole | 0 remarks |
| `kino-migania` | opacity of every label at 1/30 s: flicker (gone and back within 1 s), flashes, jumps, incomplete appearances | 0 flickering labels in frame |
| `kino-plavnost` | camera speed per frame on flights, jerk (change of speed per frame), overlapping moves, share of time the camera stands still | flight <= 30 px/frame, jerk <= 0.7, no overlaps, still <= 40 % |
| `kino-sobytiya` | dead stretches: the voice speaks and nothing new appears for >= 2.5 s (camera, shade and light do not count in STRICT mode); strong effects: on the key word within -0.3...+0.5 s, not in the first 0.5 s of a phrase, one per phrase | 0 dead stretches, 0 violations; shakes <= 3 (<= 0.3 s, <= 2 px), flashes <= 3, WebGL patches at once <= 2 |
| `kino-drozh` | glyph jitter: label letters against their plate while the camera moves, by differencing two screenshots | mean <= 0.12 px, <= 8 jumps > 0.2 px per probe |
| `kino-video` | the exported MP4 against frames re-rendered by a seek, plus the frame number (the video frame k is closest to the captured k, not k +- 1) | PSNR >= 30 dB, number matches |
| `quiz-walk` | solves every task kind through the UI with right answers, then with planned mistakes, and checks the rotation | right: all "ok"; wrong: failed kinds first in the next set |
| `node --test qa/tests/` | data consistency: beats, word timings, pictures, quiz references, TTS alignment parser | all pass |

## Results on the demo scene

Measured on 2026-11-20 in this repo, full run at 4 viewports (`735x587` is the lesson column, `874x648` the lesson at
1440 px, `1440x900` a full window, `735x815` a tall phone-like frame): **27 green, 0 red**. The complete output is in
[`qa/results/fire/summary.txt`](../qa/results/fire/summary.txt); the contact sheets are next to it.

```
CARTOON ACCEPTANCE: demo/fire/index.html
sizes: 735x587,874x648,1440x900,735x815
result: green 27, red 0
✓ Seeking gives the same frame (?t=, jump forward/back, frame by frame)
    16 s: back identical, stepwise 103.2 dB; 32 s: identical; 48 s: identical; 64 s: identical
✓ prefers-reduced-motion: the whole timeline and the board without errors
✓ Loading: no console errors or warnings, no 404
✓ Label flicker (kino-migania, 735x587): 0
✓ Labels (all 4 sizes): 11 labels, 0 with remarks
✓ Window numbers hidden until the finale (all 4 sizes)
✓ Subtitle and chapter insets in frame (all 4 sizes): 6 insets, 0 cut
✓ Board (all 4 sizes): clean
✓ Flights not faster than 30 px/frame (735x587): fastest 15.5 px/frame
✓ Camera jerk <= 0.7 (735x587): sharpest 0.54
✓ Camera moves do not overlap
✓ Camera stands still <= 40 % of the time before the finale: 36.4 %
✓ No dead stretches >= 2.5 s (STRICT=1): none
✓ Strong effects follow the rules: 4 effects, 0 shakes, 2 flashes, WebGL at once up to 0
✓ Glyph jitter: 0 probes
```

Honest notes on this run:

- **Glyph jitter has nothing to measure here.** The demo draws every in-frame caption on the window canvas
  (`k.ctag`), exactly because DOM letters jitter on slow camera drifts; DOM labels exist only as copies for the board.
  The jitter probe therefore found 0 DOM labels in motion. The check matters for scenes with DOM captions.
- **Camera jerk at 1440x900 is 0.92** (flight into window 2). Jerk is gated only at the lesson column size (735x587),
  as in production; the other sizes are reported for reference.
- **WebGL patches at once: 0** counts patches switched on by the timeline (`amt`). The demo's heat-haze patches are
  background patches (`fon`), which the core itself limits to 2 per frame.

Other measurements on the demo (2026-11-20, this repo):

| | |
|---|---|
| Video export | 80 s at 1280x720, 30 fps: 2,399 frames in 163 s; three check frames 38.7-39.3 dB against a fresh seek, captured frames identical to seeks (99 dB), frame numbers match |
| Quiz walk | right answers: 8 of 8 kinds "ok"; planned mistakes in cloze (x3), true/false and find-the-mistake: graded again / help / help, and the next "after the cartoon" set starts with cloze, true/false, find-the-mistake |
| Voice over music | median 25.0 dB per phrase, worst phrase 18.5 dB (music set 24 dB under the voice while speaking) |
| Word timings | Whisper word starts vs the TTS character alignment: 92 words, mean difference 159 ms (Whisper earlier), 90th percentile 250 ms |
| Unit tests | 9 of 9 pass |

## In production

The same suite gated the production cartoons of the platform. Recorded results: the biology scenes 27 green / 0 red
each; two of the history "epic" scenes 25 green / 2 red, where the 2 red were intentional whip pans faster than
30 px/frame. In one history cartoon the music bus sat 24 dB under the voice, moving its median intelligibility from 20
to 38 dB.
