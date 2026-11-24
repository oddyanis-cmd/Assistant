"""Concept 1 — Knit stitch: YAOUA as real stockinette fabric with a crocheted edge, above a k2p2 ribbed sage hem."""
import os, time
import numpy as np
from scipy import ndimage
from yarn import Scene, letters, letter_mask, contours, fill_flat, bez, linen, wobble

t0 = time.time()
SC = 3.4
W, H = 2600, 1000
sc = Scene(W, H)
rs = np.random.default_rng(5)
RUST, RUST_DK = (176, 78, 46), (112, 44, 24)
SAGE, SAGE_DK = (150, 170, 138), (88, 108, 80)

WORD = os.environ.get('WORD', 'YAOUA')
SUFFIX = '' if WORD == 'YAOUA' else '_' + WORD
words, width = letters(WORD, x=140, y=110, scale=SC)
mask = letter_mask(words, W, H, 19 * SC)


def fill_small_holes(m, max_area=6000):
    holes = ndimage.binary_fill_holes(m > 0.5) & ~(m > 0.5)
    lab, n = ndimage.label(holes)
    if n:
        sizes = ndimage.sum(holes, lab, range(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < max_area:
                m = np.where(lab == i, 1.0, m)
    return m


mask = fill_small_holes(mask)


def knit_area(m, color, dark, sw, sh, legr, rib=None):
    fill_flat(sc, ndimage.binary_erosion(m > 0.5, iterations=3), dark, z=-30)
    ys, xs = np.nonzero(m > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    clipm = ndimage.binary_erosion(m > 0.5, iterations=2)
    grow = ndimage.binary_dilation(m > 0.5, iterations=int(sw * 0.6))
    for row, cy in enumerate(np.arange(y0 - sh, y1 + sh, sh)):
        for col, cx in enumerate(np.arange(x0 - sw, x1 + sw, sw)):
            if not grow[min(max(int(cy), 0), H - 1), min(max(int(cx), 0), W - 1)]:
                continue
            v = rs.uniform(0.93, 1.07)
            z = -row * 0.8
            if rib and (col % 4) in (2, 3):   # purl columns: horizontal bumps, sunk back
                c = tuple(min(255, ch * v * 0.88) for ch in color)
                bump = bez((cx - sw * 0.5, cy + sh * 0.1), (cx - sw * 0.2, cy - sh * 0.45), (cx + sw * 0.2, cy - sh * 0.45), (cx + sw * 0.5, cy + sh * 0.1))
                sc.tube(bump, legr * 0.95, c, z=z - 6, period=legr * 2.2, fuzz=0.3, clip=clipm)
                continue
            c = tuple(min(255, ch * v) for ch in color)
            left = bez((cx - sw * 0.50, cy - sh * 0.62), (cx - sw * 0.58, cy + sh * 0.05), (cx - sw * 0.22, cy + sh * 0.42), (cx - sw * 0.02, cy + sh * 0.56))
            right = bez((cx + sw * 0.50, cy - sh * 0.62), (cx + sw * 0.58, cy + sh * 0.05), (cx + sw * 0.22, cy + sh * 0.42), (cx + sw * 0.02, cy + sh * 0.56))
            sc.tube(left, legr, c, z=z, period=legr * 2.2, fuzz=0.35, clip=clipm)
            sc.tube(right, legr, c, z=z + 0.2, period=legr * 2.2, fuzz=0.35, clip=clipm)


knit_area(mask, RUST, RUST_DK, sw=32, sh=27, legr=9.5)

# crocheted edging along every letter outline
for c in contours(mask, min_len=260):
    c = wobble(c[::2], amp=1.2, freq=0.02, seed=len(c))
    sc.tube(c, 8.5, (150, 62, 34), z=12, period=22, fuzz=0.5)

# k2p2 ribbed hem
hem = np.zeros((H, W), np.float32)
hx0, hx1 = 140, 140 + width
hy0, hy1 = 110 + 140 * SC + 60, 110 + 140 * SC + 190
yy, xx = np.mgrid[0:H, 0:W]
rad = 40
inside = (xx >= hx0) & (xx <= hx1) & (yy >= hy0) & (yy <= hy1)
for (cx, cy) in [(hx0 + rad, hy0 + rad), (hx1 - rad, hy0 + rad), (hx0 + rad, hy1 - rad), (hx1 - rad, hy1 - rad)]:
    corner = ((xx < hx0 + rad) | (xx > hx1 - rad)) & ((yy < hy0 + rad) | (yy > hy1 - rad))
    inside &= ~(corner & ((xx - cx) ** 2 + (yy - cy) ** 2 > rad ** 2) & (np.abs(xx - cx) < rad) & (np.abs(yy - cy) < rad))
hem[inside] = 1
knit_area(hem, SAGE, SAGE_DK, sw=30, sh=25, legr=9, rib=True)
for c in contours(hem):
    sc.tube(c[::2], 8, (120, 140, 108), z=12, period=22, fuzz=0.5)

img = sc.shade(ao=0.6)
bb = img.getbbox(); img = img.crop((bb[0] - 30, bb[1] - 30, bb[2] + 40, bb[3] + 40))
img.save(f'out/knit_logo{SUFFIX}.png')
bg = linen(img.width, img.height); bg.alpha_composite(img); bg.convert('RGB').save(f'out/knit_on_linen{SUFFIX}.jpg', quality=92)
print('knit done', img.size, round(time.time() - t0, 1), 's')
