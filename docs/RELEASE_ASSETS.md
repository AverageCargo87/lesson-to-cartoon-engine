# Release assets

Finished media that are too large for the repository live in `release-assets/` (ignored by git) and are meant to be
uploaded as assets of a GitHub release. They are rebuilt from the repository by the commands below.

| File | Size | What it is | How it is made |
|---|---|---|---|
| `fire-cartoon-1280x720.mp4` | 8.1 MB | the whole demo cartoon, 80 s, 1280x720, with narration and music (phone copy) | from the master: `ffmpeg -i <master> -vf hqdn3d=1.5:1.5:3:3 -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k -movflags +faststart <out>` |
| `fire-cartoon-1280x720-master.mp4` | 123.4 MB | the frame-exact export (CRF 18), 2,399 frames at 30 fps | `npm run video` (`qa/kino-video.mjs`), PSNR-verified against fresh seeks |

SHA-256:

```
5137f5aa2ced3afcb1a1edf109fd4595ed5e0fdaeddfb684bb1f1745295bf573  fire-cartoon-1280x720.mp4
8ca774d400e5af81616cddfab86e20a844262410ce6f50d1bea6473c08a34d14  fire-cartoon-1280x720-master.mp4
```

Tracked in the repository instead (small enough): `docs/media/hero.gif` (8 s, 560 px), `docs/media/fire-first-24s.mp4`
(the first 24 s with sound, 960x540, 1.4 MB), `docs/media/storyboard.jpg`, `docs/media/quiz.jpg` and the QA contact
sheets in `qa/results/fire/`.

Credits for everything in these files: see "Credits and licenses" in the README (renders and images by the author,
voice by ElevenLabs, music synthesised in code).
