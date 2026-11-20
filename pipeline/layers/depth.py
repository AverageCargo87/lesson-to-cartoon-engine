"""Depth map of a window picture with Depth-Anything-V2-Large (GPU). Larger = closer to the viewer.
The depth map drives the split of a flat picture into parallax layers (far / middle / near) for the engine.

    python depth.py <art dir> <out dir> w1-agora w2-raskopki ...
    -> <out>/<name>-depth.npy (float32 0..1, same size as the picture) + <out>/d-<name>.jpg (preview)

Needs torch, transformers, opencv-python; the model is fetched by transformers on first use.
"""
import os
import sys

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

ART, OUT, NAMES = sys.argv[1], sys.argv[2], sys.argv[3:]
M = 'depth-anything/Depth-Anything-V2-Large-hf'
os.makedirs(OUT, exist_ok=True)
proc = AutoImageProcessor.from_pretrained(M)
model = AutoModelForDepthEstimation.from_pretrained(M).cuda().eval()


def run(im, h):
    w = int(round(im.width * h / im.height / 14)) * 14
    x = proc(images=im, return_tensors='pt', size={'height': h, 'width': w}, keep_aspect_ratio=False, do_resize=True)['pixel_values'].cuda()
    with torch.no_grad():
        d = model(pixel_values=x).predicted_depth
    d = torch.nn.functional.interpolate(d[:, None], size=(im.height, im.width), mode='bicubic', align_corners=False)[0, 0].float().cpu().numpy()
    return d


for n in NAMES:
    im = Image.open(os.path.join(ART, n + '.webp')).convert('RGB')
    d = .5 * run(im, 518) + .5 * run(im, 756)   # two scales: the overall plan + the detail of contours
    lo, hi = np.percentile(d, .5), np.percentile(d, 99.5)
    d = np.clip((d - lo) / (hi - lo), 0, 1).astype(np.float32)
    np.save(os.path.join(OUT, f'{n}-depth.npy'), d)
    c = cv2.applyColorMap((d * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    c = cv2.resize(c, (1000, round(1000 * im.height / im.width)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, f'd-{n}.jpg'), c)
    print(n, 'ok', flush=True)
