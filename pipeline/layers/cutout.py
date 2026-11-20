"""Cut objects out of a flat grey background (an image model asked for cut-outs paints them on #bdbdbd).
The background is removed by flood fill from the edges with a tolerance, the edge is softened; a sheet with several
objects is split by connected regions (not by columns).

    python cutout.py <src.png> <out dir> name1 [name2 ...] [--crop x0,y0,x1,y1] [--w 900]

Names follow the regions "top to bottom, left to right" by their centres. Output: <name>.webp with transparency.
"""
import os
import sys

import cv2
import numpy as np

args = sys.argv[1:]
crop = None
width = 900
if '--crop' in args:
    i = args.index('--crop'); crop = [int(v) for v in args[i + 1].split(',')]; del args[i:i + 2]
if '--w' in args:
    i = args.index('--w'); width = int(args[i + 1]); del args[i:i + 2]
src, out, names = args[0], args[1], args[2:]
im = cv2.imread(src, cv2.IMREAD_COLOR)
if crop:
    im = im[crop[1]:crop[3], crop[0]:crop[2]]
h, w = im.shape[:2]
# background = pixels close to the colour of the edges and connected to an edge
edge = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]]).astype(int)
bg = np.median(edge, 0)
near = (np.abs(im.astype(int) - bg).max(2) < 26).astype(np.uint8)
ff = near.copy()
mask = np.zeros((h + 2, w + 2), np.uint8)
for x in range(0, w, 7):
    for y in (0, h - 1):
        if ff[y, x] == 1:
            cv2.floodFill(ff, mask, (x, y), 2)
for y in range(0, h, 7):
    for x in (0, w - 1):
        if ff[y, x] == 1:
            cv2.floodFill(ff, mask, (x, y), 2)
# closed "windows" of background (between ropes, arms) are background too, if large, flat and of the same grey
rest = (ff == 1).astype(np.uint8)
nr, lr, sr, _ = cv2.connectedComponentsWithStats(rest, 8)
for j in range(1, nr):
    if sr[j, cv2.CC_STAT_AREA] <= 900:
        continue
    px = im[lr == j].astype(int)   # shadows on stone and cloth are not flat: they stay
    if np.abs(px.mean(0) - bg).max() < 9 and px.std(0).max() < 5:
        ff[lr == j] = 2
fg = (ff != 2).astype(np.uint8)
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(fg, 8)
parts = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 0.004 * h * w]
# order: rows from top to bottom (by centre), left to right inside a row
parts.sort(key=lambda i: (round(cent[i][1] / (h / 3)), cent[i][0]))
if len(parts) != len(names):
    print(f'regions {len(parts)}, names {len(names)}', [tuple(stats[i, :4]) for i in parts])
    sys.exit(1)
alpha_all = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 1.1)
for name, i in zip(names, parts):
    x, y, bw, bh = stats[i, :4]
    pad = 6
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(w, x + bw + pad), min(h, y + bh + pad)
    a = alpha_all[y0:y1, x0:x1] * (lab[y0:y1, x0:x1] == i).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), .8)
    rgba = np.dstack([im[y0:y1, x0:x1], (a * 255).clip(0, 255).astype(np.uint8)])
    s = min(1, width / rgba.shape[1])
    rgba = cv2.resize(rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else rgba
    p = os.path.join(out, name + '.webp')
    cv2.imwrite(p, rgba, [cv2.IMWRITE_WEBP_QUALITY, 90])
    print(name, rgba.shape[1], 'x', rgba.shape[0])
