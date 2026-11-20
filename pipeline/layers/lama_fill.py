"""Clean background plate for a window: LaMa inpainting over the union of (grown) object masks. Once an object is cut
out into its own layer, the hole it leaves in the background must be filled, or the layer could not move.

    python lama_fill.py <src.webp> <out.png> <grow px> mask1.png [mask2.png ...] [--protect '[[[x,y],...]]']

Inpainting runs per piece around every mask (160 px margins), so LaMa sees the surroundings at full resolution.
--protect: polygons (picture fractions) that must not be painted over (another object right next to the hole).
Needs simple-lama-inpainting (downloads the big-lama checkpoint on first use).
"""
import json
import sys

import cv2
import numpy as np
from PIL import Image
from simple_lama_inpainting import SimpleLama

args = sys.argv[1:]
prot = []
if '--protect' in args:
    i = args.index('--protect'); prot = json.loads(args[i + 1]); del args[i:i + 2]
src, out, grow, masks = args[0], args[1], int(args[2]), args[3:]
im = np.array(Image.open(src).convert('RGB'))
h, w = im.shape[:2]
M = np.zeros((h, w), np.uint8)
for p in masks:
    m = (cv2.imread(p, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
    M |= cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
if prot:
    Pm = np.zeros((h, w), np.uint8)
    for p in prot:
        cv2.fillPoly(Pm, [np.round(np.array([[x * w, y * h] for x, y in p])).astype(np.int32)], 1)
    allm = np.zeros((h, w), np.uint8)
    for p in masks:
        allm |= (cv2.imread(p, cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
    M &= 1 - (Pm & (1 - allm))   # the protected neighbour is not painted over
lama = SimpleLama()
res = im.copy()
n, lab, st, _ = cv2.connectedComponentsWithStats(M, 8)
P = 160
for i in range(1, n):
    x, y, bw, bh, a = st[i]
    x0, y0, x1, y1 = max(0, x - P), max(0, y - P), min(w, x + bw + P), min(h, y + bh + P)
    sub = res[y0:y1, x0:x1]
    mm = (lab[y0:y1, x0:x1] == i).astype(np.uint8) * 255
    r = np.array(lama(Image.fromarray(sub), Image.fromarray(mm)))[:y1 - y0, :x1 - x0]
    sel = mm > 0
    sub2 = sub.copy(); sub2[sel] = r[sel]
    res[y0:y1, x0:x1] = sub2
    print('piece', i, (x0, y0, x1, y1), 'px', int(a))
Image.fromarray(res).save(out)
cv2.imwrite(out.replace('.png', '-mask.png'), M * 255)
print('ok', out)
