"""Presentation set for each logo: hero on linen, gift tag, kraft box lid, Instagram avatar."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from scipy import ndimage
from yarn import Scene, bez, linen

rs = np.random.default_rng(4)
CONCEPTS = ['knit', 'net', 'cord', 'doily', 'stitch']
ICON_CROP = {  # fraction of the logo's width/height that frames its mark
    'knit': (0.0, 0.0, 0.205, 0.78), 'net': (0.0, 0.0, 0.205, 1.0), 'cord': (0.76, 0.0, 1.0, 1.0),
    'doily': (0.0, 0.0, 1.0, 1.0), 'stitch': (0.0, 0.0, 0.262, 1.0),
}


def fit(img, mw, mh):
    s = min(mw / img.width, mh / img.height)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)


def paper(W, H, color, grain=0.025, fibres=0, seed=1):
    r = np.random.default_rng(seed)
    base = np.ones((H, W, 3), np.float32) * np.array(color, np.float32) / 255
    n = ndimage.gaussian_filter(r.normal(0, 1, (H, W)), 1.0) * grain
    n += ndimage.gaussian_filter(r.normal(0, 1, (H, W)), 6) * grain * 0.8
    img = base * (1 + n)[..., None]
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGB').convert('RGBA')
    if fibres:
        d = ImageDraw.Draw(out)
        for _ in range(fibres):
            x, y = r.uniform(0, W), r.uniform(0, H)
            a = r.uniform(0, np.pi)
            L = r.uniform(8, 30)
            c = tuple(int(v * r.uniform(0.78, 0.92)) for v in color) + (110,)
            d.line([(x, y), (x + np.cos(a) * L, y + np.sin(a) * L)], fill=c, width=1)
    return out


def drop(img, off=(10, 14), blur=14, op=0.35):
    W, H = img.width + 80, img.height + 80
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    a = Image.new('L', (W, H), 0); a.paste(img.getchannel('A'), (40, 40))
    sh = Image.new('RGBA', (W, H), (60, 40, 28, 0)); sh.putalpha(a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * op)))
    out.alpha_composite(sh, off); out.alpha_composite(img, (40, 40))
    return out


def string_loop(W, H, hole, color=(176, 78, 46)):
    sc = Scene(W, H)
    hx, hy = hole
    sc.tube(bez((hx, hy), (hx - 40, hy - 160), (hx - 200, hy - 210), (hx - 320, hy - 260)), 7, color, z=4, period=18, fuzz=0.6)
    sc.tube(bez((hx, hy), (hx - 10, hy - 140), (hx - 160, hy - 240), (hx - 300, hy - 300)), 7, color, z=2, period=18, fuzz=0.6)
    return sc.shade(ao=0.4, shadow=(6, 9, 7, 0.32))


def first_letter(logo, name):
    """Cut the mark for the avatar: the Y itself (knit, net, stitch) or the existing mark (cord ball, doily)."""
    if name in ('cord', 'doily'):
        fx0, fy0, fx1, fy1 = ICON_CROP[name]
        icon = logo.crop((int(logo.width * fx0), int(logo.height * fy0), int(logo.width * fx1), int(logo.height * fy1)))
        return icon.crop(icon.getbbox())
    arr = np.asarray(logo).astype(np.int32)
    if name == 'stitch':
        rust = (arr[..., 0] > 120) & (arr[..., 1] < 105) & (arr[..., 2] < 80) & (arr[..., 3] > 200)
        cols = np.flatnonzero(rust.any(0))
        gaps = np.flatnonzero(np.diff(cols) > 20)
        x_end = cols[gaps[0]] if len(gaps) else cols[-1]
        fabric = np.flatnonzero((arr[..., 3] > 250).any(0))
        x0 = fabric[0]
        return logo.crop((x0, 0, x_end + 22, logo.height))
    y = Image.open(f'out/{name}_logo_Y.png').convert('RGBA')
    return y.crop(y.getbbox())


for name in CONCEPTS:
    logo = Image.open(f'out/{name}_logo.png').convert('RGBA')
    # hero on linen
    hero = linen(2000, 1000, base=(246, 240, 230) if name != 'doily' else (240, 223, 215), seed=11)
    L = fit(logo, 1720, 820)
    hero.alpha_composite(L, ((2000 - L.width) // 2, (1000 - L.height) // 2))
    hero.convert('RGB').save(f'out/{name}_hero.jpg', quality=90)

    # gift tag on blush linen
    TW, TH = 1100, 760
    tagimg = linen(TW, TH, base=(238, 214, 206), seed=21)
    tag = Image.new('RGBA', (840, 470), (0, 0, 0, 0))
    m = Image.new('L', tag.size, 0); dm = ImageDraw.Draw(m)
    dm.rounded_rectangle([90, 0, 840, 470], 26, fill=255)
    dm.polygon([(0, 235), (120, 0), (120, 470)], fill=255)
    tex = paper(840, 470, (252, 246, 236), fibres=180, seed=5)
    tag.paste(tex, (0, 0), m)
    dt = ImageDraw.Draw(tag)
    dt.ellipse([74, 213, 118, 257], fill=(0, 0, 0, 0))
    hole_mask = Image.new('L', tag.size, 0); ImageDraw.Draw(hole_mask).ellipse([78, 217, 114, 253], fill=255)
    tag.putalpha(ImageChops.subtract(tag.getchannel('A'), hole_mask))
    dt.ellipse([70, 209, 122, 261], outline=(190, 160, 110, 255), width=6)
    Lt = fit(logo, 600, 330)
    tag.alpha_composite(Lt, (170 + (630 - Lt.width) // 2, (470 - Lt.height) // 2))
    tag = tag.rotate(-6, resample=Image.BICUBIC, expand=True)
    tagd = drop(tag, off=(12, 16), blur=16, op=0.30)
    tx, ty = 170, 190
    tagimg.alpha_composite(tagd, (tx, ty))
    hole_abs = (tx + 40 + 96, ty + 40 + 245)
    tagimg.alpha_composite(string_loop(TW, TH, hole_abs))
    tagimg.convert('RGB').save(f'out/{name}_tag.jpg', quality=90)

    # kraft gift box lid
    box = paper(1100, 760, (196, 158, 114), grain=0.04, fibres=900, seed=8)
    d = ImageDraw.Draw(box)
    d.rectangle([0, 0, 1100, 18], fill=(170, 134, 94, 255)); d.rectangle([0, 742, 1100, 760], fill=(170, 134, 94, 255))
    Lb = fit(logo, 860, 520)
    box.alpha_composite(Lb, ((1100 - Lb.width) // 2, (760 - Lb.height) // 2))
    box.convert('RGB').save(f'out/{name}_box.jpg', quality=90)

    # instagram avatar
    icon = first_letter(logo, name)
    av = Image.new('RGBA', (760, 760), (237, 226, 212, 255))
    circ = linen(600, 600, base=(250, 246, 238), seed=3)
    cm = Image.new('L', (600, 600), 0); ImageDraw.Draw(cm).ellipse([0, 0, 599, 599], fill=255)
    Li = fit(icon, 470 if name != 'doily' else 560, 470 if name != 'doily' else 560)
    circ.alpha_composite(Li, ((600 - Li.width) // 2, (600 - Li.height) // 2))
    circ.putalpha(cm)
    av.alpha_composite(drop(circ, off=(6, 10), blur=12, op=0.25), (40, 40))
    ImageDraw.Draw(av).ellipse([80, 80, 679, 679], outline=(176, 78, 46, 255), width=5)
    av.convert('RGB').save(f'out/{name}_avatar.jpg', quality=90)
    print('composed', name)
