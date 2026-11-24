"""Procedural yarn renderer: strands are lit 3D tubes with ply twist, fibre texture,
ambient occlusion, fuzz and cast shadows. Used to render the YAOUA logo concepts."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

rng = np.random.default_rng(7)
LIGHT = np.array([-0.45, -0.62, 0.65]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
HALF = LIGHT + np.array([0, 0, 1.0]); HALF = HALF / np.linalg.norm(HALF)


# ---------------------------------------------------------------- geometry
def bez(p0, p1, p2, p3, n=None):
    p0, p1, p2, p3 = map(np.asarray, (p0, p1, p2, p3))
    L = np.linalg.norm(p1 - p0) + np.linalg.norm(p2 - p1) + np.linalg.norm(p3 - p2)
    n = n or max(8, int(L * 2))
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def line(p0, p1):
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    n = max(4, int(np.linalg.norm(p1 - p0) * 2))
    t = np.linspace(0, 1, n)[:, None]
    return p0 + (p1 - p0) * t


def arc(c, rx, ry, a0, a1):
    n = max(12, int(abs(a1 - a0) / 360 * 2 * math.pi * max(rx, ry) * 2))
    a = np.radians(np.linspace(a0, a1, n))
    return np.stack([c[0] + rx * np.cos(a), c[1] + ry * np.sin(a)], 1)


def chain(*parts):
    return np.concatenate(parts, 0)


def resample(pts, step):
    """Even arc-length resampling."""
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    if d[-1] < step:
        return pts
    s = np.arange(0, d[-1], step)
    return np.stack([np.interp(s, d, pts[:, 0]), np.interp(s, d, pts[:, 1])], 1)


# ---------------------------------------------------------------- canvas
class Scene:
    def __init__(self, W, H):
        self.W, self.H = W, H
        self.Z = np.full((H, W), -1e9, np.float32)
        self.A = np.zeros((H, W), np.float32)
        self.NX = np.zeros((H, W), np.float32)
        self.NY = np.zeros((H, W), np.float32)
        self.NZ = np.zeros((H, W), np.float32)
        self.S = np.zeros((H, W), np.float32)
        self.TH = np.zeros((H, W), np.float32)
        self.R = np.ones((H, W), np.float32)
        self.COL = np.zeros((H, W, 3), np.float32)
        self.P = np.ones((H, W), np.float32)       # ply period (px)
        self.MAT = np.zeros((H, W), np.uint8)      # 0 yarn, 1 metal, 2 bead
        self.G = np.ones((H, W), np.float32)       # per-strand exposure (light yarns)
        self.fuzz = []                              # (x, y, nx, ny, r, color)

    def tube(self, pts, r, color, z=0.0, period=None, material=0, fuzz=1.0, zarr=None, clip=None, gain=1.0):
        """Draw a strand along pts (N,2) with radius r (scalar or per-point)."""
        raw = np.asarray(pts, float)
        d0 = np.r_[0, np.cumsum(np.linalg.norm(np.diff(raw, axis=0), axis=1))]
        pts = resample(raw, 0.6)
        if len(pts) < 2:
            return
        dn = np.linspace(0, d0[-1], len(pts)) if d0[-1] > 0 else np.zeros(len(pts))
        if zarr is not None and np.ndim(zarr) > 0:
            zarr = np.interp(dn, d0, np.asarray(zarr, float))
        if np.ndim(r) > 0:
            r = np.interp(dn, d0, np.asarray(r, float))
        tan = np.gradient(pts, axis=0)
        tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
        nrm = np.stack([-tan[:, 1], tan[:, 0]], 1)
        s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
        rr = np.broadcast_to(np.asarray(r, float), (len(pts),))
        zz = np.broadcast_to(np.asarray(zarr if zarr is not None else 0.0, float), (len(pts),)) + z
        col = np.asarray(color, np.float32) / 255.0
        per = period if period is not None else max(rr) * 2.6
        for i in range(len(pts)):
            x, y = pts[i]; R = rr[i]
            x0, x1 = int(x - R - 2), int(x + R + 3)
            y0, y1 = int(y - R - 2), int(y + R + 3)
            if x1 <= 0 or y1 <= 0 or x0 >= self.W or y0 >= self.H:
                continue
            x0c, y0c, x1c, y1c = max(x0, 0), max(y0, 0), min(x1, self.W), min(y1, self.H)
            gy, gx = np.mgrid[y0c:y1c, x0c:x1c]
            dx = gx + 0.5 - x; dy = gy + 0.5 - y
            d2 = dx * dx + dy * dy
            dist = np.sqrt(d2)
            cov = np.clip(R - dist + 0.5, 0, 1)
            inside = cov > 0
            if not inside.any():
                continue
            lat = np.clip((dx * nrm[i, 0] + dy * nrm[i, 1]) / R, -1, 1)
            hgt = np.sqrt(np.clip(R * R - d2, 0, None)) + zz[i]
            Zw = self.Z[y0c:y1c, x0c:x1c]
            m = inside & (hgt > Zw)
            if clip is not None:
                m &= clip[y0c:y1c, x0c:x1c]
            if not m.any():
                continue
            nz = np.sqrt(np.clip(1 - lat * lat, 0, 1))
            Zw[m] = hgt[m]
            self.NX[y0c:y1c, x0c:x1c][m] = (nrm[i, 0] * lat)[m]
            self.NY[y0c:y1c, x0c:x1c][m] = (nrm[i, 1] * lat)[m]
            self.NZ[y0c:y1c, x0c:x1c][m] = nz[m]
            self.S[y0c:y1c, x0c:x1c][m] = s[i]
            self.TH[y0c:y1c, x0c:x1c][m] = np.arcsin(lat)[m]
            self.R[y0c:y1c, x0c:x1c][m] = R
            self.P[y0c:y1c, x0c:x1c][m] = per
            self.MAT[y0c:y1c, x0c:x1c][m] = material
            self.COL[y0c:y1c, x0c:x1c][m] = col
            self.G[y0c:y1c, x0c:x1c][m] = gain
            Aw = self.A[y0c:y1c, x0c:x1c]
            Aw[m] = np.maximum(Aw[m], cov[m])
        if material == 0 and fuzz > 0:
            k = max(1, int(len(pts) / 3 * fuzz))
            for i in rng.choice(len(pts), size=k):
                self.fuzz.append((pts[i, 0], pts[i, 1], nrm[i, 0], nrm[i, 1], rr[i], col))

    def ball(self, cx, cy, R, color, z=0.0):
        """Solid sphere (bead, knot)."""
        self.tube([[cx - 0.01, cy], [cx + 0.01, cy]], R, color, z=z, material=2, fuzz=0)

    # ------------------------------------------------------------ shading
    def shade(self, ply=True, ao=0.55, fuzz_alpha=0.32, shadow=(7, 10, 9, 0.34), gain=1.0):
        H, W = self.H, self.W
        cov = self.A
        has = cov > 0
        N = np.stack([self.NX, self.NY, self.NZ], -1)
        diff = np.clip((N * LIGHT).sum(-1), 0, 1)
        spec = np.clip((N * HALF).sum(-1), 0, 1)
        Zc = np.where(has, self.Z, -50)
        blurZ = ndimage.gaussian_filter(Zc, 6)
        occ = np.clip((ndimage.maximum_filter(blurZ, 9) - Zc) / (self.R * 1.6 + 1e-6), 0, 1)
        AO = 1 - ao * occ
        # ply twist: helical grooves
        g = 0.5 + 0.5 * np.cos(2 * np.pi * (self.S + self.R * self.TH * 1.15) / self.P * 2)
        groove = 0.56 + 0.44 * np.power(g, 0.5)
        # fibre streaks along the strand
        noise = rng.random((64, 1024)).astype(np.float32)
        noise = ndimage.gaussian_filter(noise, (1.2, 4), mode='wrap')
        noise = (noise - noise.mean()) / (noise.std() + 1e-6)
        ui = ((self.TH / np.pi + 0.5) * 63).astype(int) % 64
        vi = (self.S * 1.3).astype(int) % 1024
        fib = 1 + 0.07 * noise[ui, vi]
        yarn = self.COL * (0.30 + 0.80 * diff)[..., None] * (groove * fib * AO)[..., None] + 0.06 * np.power(spec, 12)[..., None]
        metal = self.COL * (0.25 + 0.55 * diff)[..., None] * AO[..., None] + 0.85 * np.power(spec, 40)[..., None] + 0.15 * np.power(spec, 4)[..., None]
        bead = self.COL * (0.30 + 0.75 * diff)[..., None] * AO[..., None] + 0.35 * np.power(spec, 30)[..., None]
        rgb = np.where((self.MAT == 0)[..., None], yarn, np.where((self.MAT == 1)[..., None], metal, bead))
        rgb = np.clip(rgb * gain * self.G[..., None], 0, 1)

        layer = np.dstack([rgb, cov]).astype(np.float32)
        img = Image.fromarray((layer * 255).astype(np.uint8), 'RGBA')

        # fuzz: loose fibres around edges, drawn at 2x then reduced
        fz = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
        dr = ImageDraw.Draw(fz)
        for (x, y, nx, ny, r, col) in self.fuzz:
            side = 1 if rng.random() < 0.5 else -1
            off = r * rng.uniform(0.82, 1.0) * side
            px, py = x + nx * off, y + ny * off
            ang = math.atan2(ny * side, nx * side) + rng.normal(0, 0.9)
            L = rng.uniform(1.5, 4.5) * (r / 10 + 0.5)
            pts = [(px * 2, py * 2)]
            for _ in range(4):
                ang += rng.normal(0, 0.35)
                px += math.cos(ang) * L / 4; py += math.sin(ang) * L / 4
                pts.append((px * 2, py * 2))
            c = np.clip(col * rng.uniform(1.0, 1.35), 0, 1)
            dr.line(pts, fill=(int(c[0] * 255), int(c[1] * 255), int(c[2] * 255), int(255 * fuzz_alpha * rng.uniform(0.4, 1))), width=1)
        fz = fz.resize((W, H), Image.LANCZOS)

        # cast + contact shadow
        ox, oy, blur, op = shadow
        a = (cov * 255).astype(np.uint8)
        sh = Image.fromarray(a).filter(ImageFilter.GaussianBlur(blur))
        sh2 = Image.fromarray(a).filter(ImageFilter.GaussianBlur(2))
        base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        shadow_l = Image.new('RGBA', (W, H), (58, 38, 28, 0))
        shadow_l.putalpha(sh.point(lambda v: int(v * op)))
        base.alpha_composite(shadow_l, (ox, oy))
        contact = Image.new('RGBA', (W, H), (58, 38, 28, 0))
        contact.putalpha(sh2.point(lambda v: int(v * 0.25)))
        base.alpha_composite(contact, (1, 2))
        base.alpha_composite(fz)
        base.alpha_composite(img)
        return base


# ---------------------------------------------------------------- letters (single-stroke skeletons, 140 units tall)
def letters(word, x=0.0, y=0.0, scale=1.0, gap=26):
    """Return list of strands (point arrays) per letter, and total width."""
    glyphs = {
        'Y': (96, lambda: [chain(bez((6, 8), (18, 30), (34, 54), (48, 74))),
                           chain(bez((90, 8), (78, 30), (62, 54), (48, 74)), line((48, 74), (48, 134)))]),
        'A': (102, lambda: [chain(line((6, 134), (43, 18)), bez((43, 18), (46, 4), (56, 4), (59, 18)), line((59, 18), (96, 134))),
                            line((26, 92), (76, 92))]),
        'O': (106, lambda: [arc((53, 70), 46, 63, -100, 275)]),
        'U': (96, lambda: [chain(line((8, 6), (8, 86)), arc((48, 86), 40, 48, 180, 0), line((88, 86), (88, 6)))]),
    }
    # The U's arc runs 180 -> 0 degrees, passing 90 (the bottom, since y points down).
    out = []
    cx = x
    for ch in word:
        w, fn = glyphs[ch]
        strands = fn()
        out.append([np.asarray(s) * scale + [cx, y] for s in strands])
        cx += (w + gap) * scale
    return out, cx - gap * scale - x


def linen(W, H, base=(246, 240, 230), seed=3):
    r = np.random.default_rng(seed)
    img = np.ones((H, W, 3), np.float32) * np.array(base, np.float32) / 255
    rows = ndimage.gaussian_filter1d(r.normal(0, 1, H), 0.8)[:, None]
    cols = ndimage.gaussian_filter1d(r.normal(0, 1, W), 0.8)[None, :]
    weave = 0.018 * rows + 0.018 * cols + 0.012 * r.normal(0, 1, (H, W))
    slub = ndimage.gaussian_filter(r.normal(0, 1, (H, W)), (0.6, 18)) * 0.06
    img = img * (1 + weave + slub)[..., None]
    yy, xx = np.mgrid[0:H, 0:W]
    vig = 1 - 0.10 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    img = img * vig[..., None]
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGB').convert('RGBA')


def wobble(pts, amp=1.2, freq=0.02, seed=0):
    """Low-frequency sideways drift so strands look laid by hand, not plotted."""
    pts = resample(np.asarray(pts, float), 1.0)
    r = np.random.default_rng(seed)
    n = len(pts)
    t = np.arange(n)
    off = np.zeros(n)
    for k in range(3):
        f = freq * (k + 1) * r.uniform(0.7, 1.3)
        off += amp / (k + 1) * np.sin(2 * np.pi * f * t + r.uniform(0, 6.28))
    tan = np.gradient(pts, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True) + 1e-9
    nrm = np.stack([-tan[:, 1], tan[:, 0]], 1)
    return pts + nrm * off[:, None]


def letter_mask(words, W, H, radius):
    """Chunky letterform mask: every skeleton strand stroked at 2*radius with round joins."""
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    for strands in words:
        for s in strands:
            pts = resample(np.asarray(s, float), 2.0)
            d.line([tuple(p) for p in pts], fill=255, width=int(radius * 2), joint='curve')
            for p in (pts[0], pts[-1]):
                d.ellipse([p[0] - radius, p[1] - radius, p[0] + radius, p[1] + radius], fill=255)
    return np.asarray(m, np.float32) / 255.0


def contours(mask, level=0.5, min_len=40):
    from skimage import measure
    out = []
    for c in measure.find_contours(mask, level):
        if len(c) >= min_len:
            out.append(c[:, ::-1])  # (row, col) -> (x, y)
    return out


def fill_flat(scene, mask, color, z=-20.0):
    """Flat matte backing (e.g. purl side of knitting) under the stitches."""
    m = mask > 0.5
    col = np.asarray(color, np.float32) / 255.0
    upd = m & (z > scene.Z)
    scene.Z[upd] = z
    scene.NX[upd] = 0; scene.NY[upd] = 0; scene.NZ[upd] = 1
    scene.COL[upd] = col
    scene.MAT[upd] = 2
    scene.R[upd] = 6
    scene.A[upd] = np.maximum(scene.A[upd], 1.0)


def fill_small_holes(m, max_area=6000):
    """Close tiny enclosed gaps (e.g. where strokes meet) so they do not get their own outline."""
    holes = ndimage.binary_fill_holes(m > 0.5) & ~(m > 0.5)
    lab, n = ndimage.label(holes)
    if n:
        sizes = ndimage.sum(holes, lab, range(1, n + 1))
        for i, sz in enumerate(sizes, 1):
            if sz < max_area:
                m = np.where(lab == i, 1.0, m)
    return m
