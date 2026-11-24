"""Concept 2 — Open net: YAOUA as hand-knotted string netting framed in twisted cord, with a tasselled drawstring."""
import os, time
import numpy as np
from scipy import ndimage
from yarn import Scene, letters, letter_mask, contours, bez, linen, wobble, resample, fill_small_holes

t0 = time.time()
SC = 3.4
W, H = 2900, 1050
sc = Scene(W, H)
rs = np.random.default_rng(21)
RUST, KNOT, CORD = (178, 80, 48), (128, 50, 28), (160, 66, 38)

WORD = os.environ.get('WORD', 'YAOUA')
SUFFIX = '' if WORD == 'YAOUA' else '_' + WORD
words, width = letters(WORD, x=140, y=110, scale=SC)
mask = fill_small_holes(letter_mask(words, W, H, 20 * SC))
inner = ndimage.binary_erosion(mask > 0.5, iterations=10)

# diamond mesh: two families of diagonal cords; knots sit exactly on their crossings
G = 40
ys, xs = np.nonzero(mask > 0.5)
x0, x1, y0, y1 = xs.min() - G, xs.max() + G, ys.min() - G, ys.max() + G
S2 = np.sqrt(2)
def inside_pts(pts):
    return np.array([inner[int(min(max(y, 0), H - 1)), int(min(max(x, 0), W - 1))] for x, y in pts])
cs = np.arange(-(y1 - y0) - 2 * G, (x1 - x0) + (y1 - y0) + 2 * G, G * S2)
for fam in (1, -1):
    for c in cs:
        t = np.arange(-(y1 - y0) * 2, (x1 - x0) + (y1 - y0) * 2, 1.0)
        if fam == 1:      # x - y = c   (down-right)
            px, py = x0 + c + t, y0 + t
        else:             # x + y = c   (down-left)
            px, py = x0 + c - t + (y1 - y0), y0 + t
        keep = (px > 0) & (px < W) & (py > 0) & (py < H)
        pts = np.stack([px[keep], py[keep]], 1)
        if len(pts) < 3:
            continue
        idx = np.flatnonzero(inside_pts(pts))
        if len(idx) < 3:
            continue
        for run in np.split(idx, np.flatnonzero(np.diff(idx) > 1) + 1):
            if len(run) > 8:
                sc.tube(pts[run], 4.2, RUST, z=0.6 * fam, period=11, fuzz=0.4)
# knots: intersections of x - y = a and x + y = b
for a in cs:
    for b in cs:
        bb = b + (y1 - y0) + y0 + x0      # family-2 line: x + y = x0 + y0 + (y1 - y0) + b
        aa = a + x0 - y0                  # absolute x - y
        kx, ky = (aa + bb) / 2, (bb - aa) / 2
        if 0 < kx < W and 0 < ky < H and inner[int(ky), int(kx)]:
            ang = rs.uniform(0, 3.14)
            knot = np.array([[kx + 5.5 * np.cos(q + ang), ky + 4.2 * np.sin(q + ang)] for q in np.linspace(0, 6.6, 40)])
            sc.tube(knot, 5.2, KNOT, z=6, period=9, fuzz=0.2)

# twisted cord frame
for c in contours(mask, min_len=200):
    sc.tube(wobble(c[::2], amp=1.0, freq=0.015, seed=len(c)), 11, CORD, z=10, period=30, fuzz=0.6)

if WORD.endswith('A') and len(WORD) > 1:
    # drawstring with tassel hanging off the last A
    lastA = words[-1][0]
    apex = lastA[np.argmin(lastA[:, 1])]
    foot = lastA[-1]
    start = (apex[0] + 12, apex[1] - 4)
    string = wobble(bez(start, (apex[0] + 230, apex[1] - 90), (foot[0] + 170, apex[1] + 90), (foot[0] + 120, apex[1] + 320)), amp=3, freq=0.01, seed=3)
    sc.tube(string, 8, CORD, z=14, period=24, fuzz=0.6)
    tx, ty = string[-1]
    # tassel head: wrapped band
    for k in range(9):
        yb = ty + k * 4.2
        sc.tube(bez((tx - 20, yb), (tx - 10, yb + 3), (tx + 10, yb + 3), (tx + 20, yb)), 3.2, KNOT, z=16, period=8, fuzz=0.2)
    # tassel strands
    for k in range(34):
        sx = tx + rs.uniform(-18, 18)
        ex = tx + (sx - tx) * 2.1 + rs.normal(0, 6)
        L = rs.uniform(150, 190)
        strand = bez((sx, ty + 36), (sx + (ex - sx) * 0.2, ty + 36 + L * 0.3), (ex, ty + 36 + L * 0.7), (ex + rs.normal(0, 4), ty + 36 + L))
        sc.tube(strand, 2.6, tuple(ch * rs.uniform(0.92, 1.08) for ch in RUST), z=12 + rs.uniform(0, 2), period=9, fuzz=0.5)

img = sc.shade(ao=0.5)
bb = img.getbbox(); img = img.crop((bb[0] - 30, bb[1] - 30, bb[2] + 40, bb[3] + 40))
img.save(f'out/net_logo{SUFFIX}.png')
bg = linen(img.width, img.height); bg.alpha_composite(img); bg.convert('RGB').save(f'out/net_on_linen{SUFFIX}.jpg', quality=92)
print('net done', img.size, round(time.time() - t0, 1), 's')
