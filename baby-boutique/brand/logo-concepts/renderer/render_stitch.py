"""Concept 5 — Cross-stitch: YAOUA embroidered in stranded floss on frayed Aida cloth,
with a sage running-stitch underline and the needle still threaded."""
import time
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from yarn import Scene, bez, linen

t0 = time.time()
K = 1.5                               # print-resolution scale (30 px cells at K=1)
CELL = int(30 * K)
COLS, ROWS = 29, 7
MX, MY = 3, 2                         # margin in cells
FW, FH = (COLS + 2 * MX) * CELL, (ROWS + 2 * MY + 2) * CELL
PAD = int(140 * K)
W, H = FW + 2 * PAD + int(260 * K), FH + 2 * PAD
rs = np.random.default_rng(9)

# ---------------- Aida fabric: woven blocks, stitch holes, frayed edge
yy, xx = np.mgrid[0:FH, 0:FW].astype(np.float32)
u, v = (xx % CELL) / CELL, (yy % CELL) / CELL
block = np.clip(np.sin(np.pi * u) * np.sin(np.pi * v), 0, 1) ** 0.35
cx, cy = (xx // CELL).astype(int), (yy // CELL).astype(int)
weave = np.where((cx + cy) % 2 == 0, np.sin(v * np.pi * 6) ** 2, np.sin(u * np.pi * 6) ** 2)
hole_d = np.minimum.reduce([np.hypot(u, v), np.hypot(1 - u, v), np.hypot(u, 1 - v), np.hypot(1 - u, 1 - v)])
hole = np.clip((0.13 - hole_d) / 0.05, 0, 1)
shade = (0.80 + 0.17 * block + 0.04 * weave - 0.08 * (1 - block)) * (1 - 0.55 * hole)
noise = ndimage.gaussian_filter(rs.normal(0, 1, (FH, FW)), 1.2 * K) * 0.02
base = np.array([250, 246, 236], np.float32) / 255
fab = np.clip(base[None, None, :] * (shade + noise)[..., None], 0, 1)
edge = np.ones((FH, FW), np.float32)
fr = 10 * K
for side in range(4):
    n = FW if side < 2 else FH
    prof = ndimage.gaussian_filter1d(rs.uniform(0, 1, n), 2 * K) * fr
    for i in range(n):
        d = int(prof[i])
        if side == 0: edge[:d, i] = 0
        if side == 1: edge[FH - d:, i] = 0
        if side == 2: edge[i, :d] = 0
        if side == 3: edge[i, FW - d:] = 0
fabric = Image.fromarray((np.dstack([fab, edge]) * 255).astype(np.uint8), 'RGBA')

# ---------------- stitches
sc = Scene(W, H)
ox, oy = PAD + MX * CELL, PAD + MY * CELL
glyphs = {
    'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
}
RUST_B, RUST_T, SAGE, STEEL = (150, 60, 34), (184, 82, 50), (132, 156, 122), (205, 205, 210)
FLOSS = 5.4 * K
ins, bow = 3 * K, 8.5 * K
last_hole = None
for li, ch in enumerate('YAOUA'):
    for r, row in enumerate(glyphs[ch]):
        for c, on in enumerate(row):
            if on != '1':
                continue
            x = ox + (li * 6 + c) * CELL; y = oy + r * CELL
            j = lambda: rs.normal(0, 0.8 * K)
            a, b = (x + ins + j(), y + CELL - ins + j()), (x + CELL - ins + j(), y + ins + j())
            sc.tube(bez(a, (a[0] + bow, a[1] - bow), (b[0] - bow, b[1] + bow), b), FLOSS, RUST_B, z=0, period=9 * K, fuzz=0.25)
            a, b = (x + ins + j(), y + ins + j()), (x + CELL - ins + j(), y + CELL - ins + j())
            sc.tube(bez(a, (a[0] + bow, a[1] + bow), (b[0] - bow, b[1] - bow), b), FLOSS, RUST_T, z=6 * K, period=9 * K, fuzz=0.25)
            last_hole = (x + CELL - ins, y + ins)

# running-stitch underline: over two holes, under one
uy = oy + (ROWS + 1) * CELL + CELL / 2
for k in range(0, COLS - 1, 3):
    x0 = ox + k * CELL
    sc.tube(bez((x0 + ins, uy), (x0 + 20 * K, uy - ins), (x0 + 2 * CELL - 20 * K, uy - ins), (x0 + 2 * CELL - ins, uy)), 5.0 * K, SAGE, z=0, period=9 * K, fuzz=0.25)

# thread rising from the final stitch to the needle's eye
nx0, ny0 = ox + COLS * CELL + 120 * K, oy - 40 * K          # eye end
nx1, ny1 = nx0 + 150 * K, oy + ROWS * CELL + 140 * K        # point
d = np.array([nx1 - nx0, ny1 - ny0], float); d /= np.linalg.norm(d)
nrm = np.array([-d[1], d[0]])
eye = np.array([nx0, ny0]) + d * 18 * K
thread = bez(last_hole, (last_hole[0] + 60 * K, last_hole[1] - 120 * K), (eye[0] - 120 * K, eye[1] - 60 * K), eye)
sc.tube(thread, 5.0 * K, RUST_T, z=20 * K, period=9 * K, fuzz=0.5)
sc.tube(bez(eye, eye + np.array([20, -6]) * K, eye + np.array([36, 18]) * K, eye + np.array([30, 46]) * K), 5.0 * K, RUST_T, z=22 * K, period=9 * K, fuzz=0.5)

# needle: tapered steel shaft with an open eye
n = 300
t = np.linspace(0, 1, n)
shaft = np.stack([nx0 + (nx1 - nx0) * t, ny0 + (ny1 - ny0) * t], 1)
radius = np.where(t > 0.86, 6.2 * K * (1 - (t - 0.86) / 0.14) + 0.8, 6.2 * K)
start = int(n * 0.12)
sc.tube(shaft[start:], radius[start:], STEEL, z=18 * K, material=1, fuzz=0)
p0 = np.array([nx0, ny0])
for side in (-1, 1):
    sc.tube(np.array([p0, eye + d * 18 * K]) + nrm * side * 4.2 * K, 2.6 * K, STEEL, z=21 * K, material=1, fuzz=0)
sc.tube(bez(p0 - nrm * 4.2 * K, p0 - d * 8 * K - nrm * 3 * K, p0 - d * 8 * K + nrm * 3 * K, p0 + nrm * 4.2 * K), 2.6 * K, STEEL, z=21 * K, material=1, fuzz=0)

stitches = sc.shade(ao=0.45, shadow=(int(3 * K), int(4 * K), 3 * K, 0.45))

# ---------------- compose: fabric patch with its own shadow, then the stitches
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sh = Image.new('RGBA', (W, H), (58, 38, 28, 0))
a = Image.new('L', (W, H), 0); a.paste(fabric.getchannel('A'), (PAD, PAD))
sh.putalpha(a.filter(ImageFilter.GaussianBlur(10 * K)).point(lambda q: int(q * 0.30)))
out.alpha_composite(sh, (int(8 * K), int(12 * K)))
out.alpha_composite(fabric, (PAD, PAD))
out.alpha_composite(stitches)
bb = out.getbbox(); out = out.crop((bb[0] - 30, bb[1] - 30, bb[2] + 45, bb[3] + 45))
out.save('out/stitch_logo.png')
bg = linen(out.width, out.height, base=(237, 226, 212)); bg.alpha_composite(out); bg.convert('RGB').save('out/stitch_on_linen.jpg', quality=92)
print('stitch done', out.size, round(time.time() - t0, 1), 's')
