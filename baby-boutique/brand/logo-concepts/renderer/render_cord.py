"""Concept 3 — Twisted cord: YAOUA written in chunky 3-ply yarn, trailing into a wound ball with a crochet hook."""
import sys, time, math
import numpy as np
from yarn import Scene, letters, bez, line, linen, wobble
from PIL import Image

t0 = time.time()
SC = 3.4
W, H = 2900, 820
sc = Scene(W, H)
RUST = (176, 78, 46)
words, width = letters('YAOUA', x=150, y=150, scale=SC)
r = 9.5 * SC
for li, strands in enumerate(words):
    for si, s in enumerate(strands):
        jitter = 1 + 0.03 * (li % 2)
        sc.tube(wobble(s, amp=5, freq=0.004, seed=li * 7 + si), r, tuple(c * jitter for c in RUST), z=si * 6, period=r * 2.5)

# ball of yarn
bx, by, BR = 150 + width + 430, 470, 205
rs = np.random.default_rng(11)
for k in range(46):
    n = rs.normal(size=3); n /= np.linalg.norm(n)
    u = np.cross(n, [0.3, 0.5, 0.8]); u /= np.linalg.norm(u)
    v = np.cross(n, u)
    rad = BR * (0.9 + 0.1 * k / 46)
    t = np.linspace(0, 2 * np.pi, 900)
    P = rad * (np.outer(np.cos(t), u) + np.outer(np.sin(t), v))
    front = P[:, 2] > -rad * 0.05
    # split into contiguous front runs
    idx = np.flatnonzero(front)
    if len(idx) == 0:
        continue
    runs = np.split(idx, np.flatnonzero(np.diff(idx) > 1) + 1)
    for run in runs:
        if len(run) < 10:
            continue
        pts = P[run, :2] + [bx, by]
        sc.tube(pts, 15, RUST, zarr=P[run, 2] + 10 * k / 46, period=40, fuzz=0.6)

# tail from the final A into the ball
ax, ay = words[-1][0][-1]
tail = wobble(bez((ax, ay), (ax + 70, ay + 110), (bx - BR - 220, by + 230), (bx - BR * 0.72, by + BR * 0.5)), amp=4, freq=0.006, seed=99)
sc.tube(tail, r * 0.9, RUST, z=0, period=r * 2.4)

# brass crochet hook pushed through the ball
hx0, hy0, hx1, hy1 = bx - 150, by - 300, bx + 210, by + 260
hook = np.array([[hx0 + (hx1 - hx0) * t, hy0 + (hy1 - hy0) * t] for t in np.linspace(0, 1, 400)])
sc.tube(hook, 13, (214, 160, 58), z=BR + 30, material=1, fuzz=0)
tip = bez((hx0, hy0), (hx0 - 34, hy0 - 22), (hx0 - 30, hy0 - 62), (hx0 + 4, hy0 - 58))
sc.tube(tip, 11, (214, 160, 58), z=BR + 31, material=1, fuzz=0)
grip = np.array([[hx0 + (hx1 - hx0) * t, hy0 + (hy1 - hy0) * t] for t in np.linspace(0.42, 0.62, 120)])
sc.tube(grip, 17, (196, 136, 40), z=BR + 32, material=1, fuzz=0)

img = sc.shade()
bbox = img.getbbox()
img = img.crop((bbox[0] - 30, bbox[1] - 30, bbox[2] + 40, bbox[3] + 40))
img.save('out/cord_logo.png')
bg = linen(img.width, img.height)
bg.alpha_composite(img)
bg.convert('RGB').save('out/cord_on_linen.jpg', quality=92)
print('cord done', img.size, round(time.time() - t0, 1), 's')
