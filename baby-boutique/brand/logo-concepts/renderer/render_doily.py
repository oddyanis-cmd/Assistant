"""Concept 4 — Crochet doily: an ivory cotton doily (chain loops, treble spokes, chain arcs,
shell scallops with picots) with YAOUA laid in rust yarn at its centre."""
import time, math
import numpy as np
from yarn import Scene, letters, bez, line, arc, linen, wobble

t0 = time.time()
W = H = 1500
C = np.array([750.0, 750.0])
sc = Scene(W, H)
rs = np.random.default_rng(31)
CREAM, RUST = (241, 230, 210), (176, 78, 46)


def cream():
    v = rs.uniform(0.96, 1.03)
    return tuple(min(255, c * v) for c in CREAM)


def polar(r, a):
    return C + r * np.array([math.cos(a), math.sin(a)])


# inner ring framing the name
ring = arc(C, 318, 318, 0, 361)
sc.tube(ring, 7.5, CREAM, z=4, gain=1.32, period=20, fuzz=0.6)

# treble-stitch spokes growing out of the centre ring, with their wraps
N2 = 48
tips = []
for i in range(N2):
    a = 2 * math.pi * (i + 0.5) / N2
    p0, p1 = polar(322, a), polar(500, a)
    sc.tube(line(p0, p1), 6.0, cream(), z=3, gain=1.32, period=16, fuzz=0.5)
    n = np.array([-math.sin(a), math.cos(a)])
    for f in (0.62, 0.8):
        m = p0 + (p1 - p0) * f
        sc.tube(bez(m - n * 9, m - n * 3 + (p1 - p0) * 0.02, m + n * 3 + (p1 - p0) * 0.02, m + n * 9), 3.4, cream(), z=6, gain=1.32, period=10, fuzz=0.3)
    tips.append(p1)

# interlocking chain ring woven through the spokes
Rc = 400
nch = int(2 * math.pi * Rc / 24)
for i in range(nch):
    a = 2 * math.pi * i / nch
    c = polar(Rc, a)
    tv = np.array([-math.sin(a), math.cos(a)]); rv = np.array([math.cos(a), math.sin(a)])
    t = np.linspace(0, 2 * math.pi, 50)
    pts = c + np.outer(np.cos(t) * 15, tv) + np.outer(np.sin(t) * 8, rv)
    sc.tube(pts, 4.0, cream(), z=7 if i % 2 else 5, gain=1.32, period=10, fuzz=0.4)

# chain arcs joining the spoke tips
arc_mid = []
for i in range(N2):
    p, q = tips[i], tips[(i + 1) % N2]
    mid = (p + q) / 2
    out = (mid - C) / np.linalg.norm(mid - C)
    sc.tube(bez(p, p + out * 24 + (q - p) * 0.2, q + out * 24 - (q - p) * 0.2, q), 4.4, cream(), z=5, gain=1.32, period=12, fuzz=0.4)
    arc_mid.append(mid + out * 18)

# shell scallops sitting edge to edge on every other arc, picot-edged
N3 = 24
for i in range(N3):
    base = arc_mid[2 * i]
    a = math.atan2(base[1] - C[1], base[0] - C[0])
    fan_tips = []
    for k in range(7):
        da = (k - 3) * math.radians(2.45)
        tip = polar(642 - abs(k - 3) * 5, a + da)
        sc.tube(bez(base, base + (tip - base) * 0.3, tip - (tip - base) * 0.25, tip), 5.0, cream(), z=2 + k * 0.1, gain=1.32, period=14, fuzz=0.5)
        fan_tips.append(tip)
    edge = np.concatenate([bez(fan_tips[k], fan_tips[k] + (fan_tips[k + 1] - C) * 0.02, fan_tips[k + 1] + (fan_tips[k] - C) * 0.02, fan_tips[k + 1]) for k in range(6)])
    sc.tube(edge, 4.2, cream(), z=6, gain=1.32, period=12, fuzz=0.4)
    for tip in fan_tips[1:-1:2]:
        outv = (tip - C) / np.linalg.norm(tip - C)
        pc = tip + outv * 9
        t = np.linspace(0, 2 * math.pi, 40)
        sc.tube(np.stack([pc[0] + 7 * np.cos(t), pc[1] + 7 * np.sin(t)], 1), 3.0, cream(), z=7, gain=1.32, period=9, fuzz=0.3)

# the name, in rust yarn
SC = 0.92
words, width = letters('YAOUA', x=0, y=0, scale=SC)
ox, oy = C[0] - width / 2, C[1] - 140 * SC / 2
for li, strands in enumerate(words):
    for si, s in enumerate(strands):
        sc.tube(wobble(s + [ox, oy], amp=1.5, freq=0.01, seed=li * 5 + si), 11.5, RUST, z=12 + si * 3, period=24, fuzz=0.7)

img = sc.shade(ao=0.45, shadow=(6, 9, 8, 0.36), gain=1.0)
img.save('out/doily_logo.png')
bg = linen(W, H, base=(240, 222, 214)); bg.alpha_composite(img); bg.convert('RGB').save('out/doily_on_linen.jpg', quality=92)
print('doily done', img.size, round(time.time() - t0, 1), 's')
