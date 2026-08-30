"""VyronX coin showcase video — fully deterministic local render.
Coin faces come from the user's original PNGs (text never passes through any model).
Neon showcase + particles + typography composited per frame. 1280x1280, 30fps, 12s.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

W = H = 1280
CX = W // 2
FPS = 30
SECS = 12
FRAMES = FPS * SECS

TOP_Y, BOT_Y = 120, 1035
TOP_HALF, BOT_HALF = 300, 410
FLOOR_Y = 1035
COIN_D = 640
NEON = (255, 200, 90)
NEON_SOFT = (255, 170, 60)

# ---------------- static plates ----------------

def build_backdrop():
    bg = Image.new("RGB", (W, H), (4, 3, 8))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(4 + 14 * t), int(3 + 10 * t), int(8 + 22 * t)))
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([CX - 430, 500 - 430, CX + 430, 500 + 430], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    amber = Image.new("RGB", (W, H), (255, 190, 80))
    bg = Image.composite(amber, bg, glow.point(lambda v: v // 3))
    d = ImageDraw.Draw(bg)
    d.rectangle([0, FLOOR_Y, W, H], fill=(10, 8, 6))
    d.line([(0, FLOOR_Y), (W, FLOOR_Y)], fill=(120, 95, 45), width=2)
    fl = ImageDraw.Draw(bg)
    for i in (-5, -4, -3, 3, 4, 5):
        fl.line([(CX + i * 240, FLOOR_Y), (CX + i * 40, H)], fill=(30, 24, 13), width=1)
    for j, yy in enumerate((1090, 1150, 1220)):
        a = 42 - j * 12
        fl.line([(0, yy), (W, yy)], fill=(a, int(a * 0.8), int(a * 0.4)), width=1)
    # warm halo behind coin (static)
    cg = Image.new("L", (W, H), 0)
    cd = ImageDraw.Draw(cg)
    cd.ellipse([CX - COIN_D // 2 - 60, 560 - COIN_D // 2 - 60,
                CX + COIN_D // 2 + 60, 560 + COIN_D // 2 + 60], fill=110)
    cg = cg.filter(ImageFilter.GaussianBlur(70))
    warm = Image.new("RGB", (W, H), (255, 175, 60))
    bg = Image.composite(warm, bg, cg.point(lambda v: v // 2))
    return bg


def build_case_layer():
    """Neon trapezoid frame as RGBA layer (to paste over dynamic content)."""
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.line([(CX - TOP_HALF, TOP_Y), (CX - BOT_HALF, BOT_Y)], fill=NEON + (235,), width=5)
    fd.line([(CX + TOP_HALF, TOP_Y), (CX + BOT_HALF, BOT_Y)], fill=NEON + (235,), width=5)
    fd.line([(CX - TOP_HALF, TOP_Y), (CX + TOP_HALF, TOP_Y)], fill=NEON + (235,), width=5)
    fd.line([(CX - BOT_HALF, BOT_Y), (CX + BOT_HALF, BOT_Y)], fill=NEON + (245,), width=6)
    inset = 26
    fd.line([(CX - TOP_HALF + inset, TOP_Y + inset), (CX - TOP_HALF - 90, 345)],
            fill=NEON_SOFT + (110,), width=2)
    fd.line([(CX + TOP_HALF - inset, TOP_Y + inset), (CX + TOP_HALF + 90, 345)],
            fill=NEON_SOFT + (110,), width=2)
    for frac, a in ((0.30, 34), (0.55, 42)):
        yy = TOP_Y + (BOT_Y - TOP_Y) * frac
        half = TOP_HALF + (BOT_HALF - TOP_HALF) * frac
        stop = COIN_D // 2 + 70
        fd.line([(CX - half + 12, yy), (CX - stop, yy)], fill=NEON_SOFT + (a,), width=2)
        fd.line([(CX + stop, yy), (CX + half - 12, yy)], fill=NEON_SOFT + (a,), width=2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            px = CX + sx * (TOP_HALF if sy < 0 else BOT_HALF)
            py = TOP_Y if sy < 0 else BOT_Y
            fd.line([(px, py), (px + 40 * sx, py)], fill=NEON + (255,), width=6)
            fd.line([(px, py), (px, py - 44 * sy)], fill=NEON + (255,), width=6)
    # glow derived from the lines themselves
    glow_layer = Image.new("RGB", (W, H), (0, 0, 0))
    glow_layer.paste(frame, (0, 0), frame)
    glow_blur = glow_layer.filter(ImageFilter.GaussianBlur(14))
    return frame, glow_blur


def build_text_layers():
    def load_font(size, bold=True):
        cands = ["C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
                 "C:/Windows/Fonts/seguisb.ttf"]
        for c in cands:
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
        return ImageFont.load_default()

    def glow_text(xy, text, font, fill, glow_color=(255, 190, 90), glow_r=10):
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text(xy, text, font=font, fill=glow_color + (255,), anchor="mm")
        glow_img = layer.filter(ImageFilter.GaussianBlur(glow_r))
        base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(base)
        bd.text(xy, text, font=font, fill=fill + (255,), anchor="mm")
        return Image.alpha_composite(glow_img, base)

    title = glow_text((CX, 66), "VYRONX", load_font(108), (255, 226, 160))
    tag = glow_text((CX, 1168), "VISÃO · INOVAÇÃO · LIBERDADE", load_font(44, False), (235, 205, 140), glow_r=7)
    foot = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(foot)
    fd.text((CX, 1226), "TECNOLOGIA · CRIPTO · FUTURO", font=load_font(26, False),
            fill=(190, 160, 110), anchor="mm")
    return title, tag, foot


# ---------------- coin plates ----------------

def load_coin(path):
    coin = Image.open(path).convert("RGBA")
    bbox = coin.getchannel("A").getbbox()
    coin = coin.crop(bbox)
    side = max(coin.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
    return sq.resize((COIN_D, COIN_D), Image.LANCZOS)

FRONT = load_coin("front.png")
BACK = load_coin("back_from_wan.png")  # back face extracted from wan-3.0 video per user request

def build_edge_bar(h):
    """Gold reeded edge, full profile thickness."""
    t = max(2, int(COIN_D * 0.055))
    bar = Image.new("RGBA", (t, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    for x in range(t):
        v = 0.55 + 0.45 * math.sin(math.pi * x / t)
        r = int(212 * v); g = int(160 * v); b = int(60 * v)
        bd.line([(x, 0), (x, h)], fill=(r, g, b, 255))
    # reeding
    for x in range(0, t, 4):
        bd.line([(x, 0), (x, h)], fill=(120, 88, 30, 90), width=1)
    return bar

EDGE = build_edge_bar(COIN_D)

def specular_band(w, h, center_frac, strength=0.30, width_frac=0.22):
    """Horizontal moving highlight for metallic feel."""
    grad = Image.new("L", (w, 1), 0)
    px = grad.load()
    cx = center_frac * w
    sigma = max(1.0, w * width_frac / 2)
    for x in range(w):
        px[x, 0] = int(255 * strength * math.exp(-((x - cx) ** 2) / (2 * sigma ** 2)))
    return grad.resize((w, h))

# ---------------- animation schedule ----------------

def smooth(u):
    return u * u * (3 - 2 * u)

def angle_at(t):
    """Front hold -> 180 (back) -> 360 (front) -> hold. Degrees."""
    if t < 1.2:
        return 0.0
    if t < 4.2:
        return 180.0 * smooth((t - 1.2) / 3.0)
    if t < 5.4:
        return 180.0
    if t < 8.4:
        return 180.0 + 180.0 * smooth((t - 5.4) / 3.0)
    return 360.0

# ---------------- particles ----------------
import random
rnd = random.Random(42)
PARTICLES = [(rnd.uniform(120, W - 120), rnd.uniform(160, 1000),
              rnd.uniform(-6, 6), rnd.uniform(-16, -6),
              rnd.uniform(0, 6.28), rnd.uniform(2.2, 5.2)) for _ in range(42)]

def draw_particles(base, t):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for (x0, y0, vx, vy, ph, r) in PARTICLES:
        x = (x0 + vx * t) % (W - 240) + 120
        y = (y0 + vy * t) % 900 + 140
        a = int(70 + 60 * math.sin(t * 1.7 + ph))
        if a <= 4:
            continue
        ld.ellipse([x - r, y - r, x + r, y + r], fill=(255, 210, 120, a))
    layer = layer.filter(ImageFilter.GaussianBlur(1.4))
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")

# ---------------- render ----------------

BACKDROP = build_backdrop()
CASE_LAYER, CASE_GLOW = build_case_layer()
CASE_RGB = CASE_LAYER.convert("RGB")
TITLE, TAG, FOOT = build_text_layers()

os.makedirs("frames", exist_ok=True)

def render_frame(i):
    t = i / FPS
    a = angle_at(t)
    rad = math.radians(a)
    c = math.cos(rad)
    s = abs(math.sin(rad))

    cy = 560 + 7 * math.sin(2 * math.pi * t / 6.0)  # gentle float

    img = BACKDROP.copy()

    # floor shadow (soft ellipse; tighter when coin face-on)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sw = int(COIN_D * 0.5 * (0.55 + 0.45 * abs(c)))
    sd.ellipse([CX - sw, FLOOR_Y - 26, CX + sw, FLOOR_Y + 26], fill=(0, 0, 0, 110))
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img,
                          sh.getchannel("A").point(lambda v: v // 2)).convert("RGB")
    img.paste(sh.convert("RGB"), (0, 0), sh)

    # edge bar behind face
    if s > 0.02:
        bw = max(2, int(EDGE.size[0] * s))
        bar = EDGE.resize((bw, COIN_D))
        img.paste(bar, (CX - bw // 2, int(cy) - COIN_D // 2), bar)

    # face
    if abs(c) > 0.03:
        face = FRONT if c > 0 else BACK
        w = max(2, int(COIN_D * abs(c)))
        squeezed = face.resize((w, COIN_D), Image.LANCZOS)
        # specular sweep tied to angle
        band = specular_band(w, COIN_D, 0.5 - 0.45 * math.cos(rad * 1.0), 0.22)
        rgb = Image.new("RGB", squeezed.size, (255, 244, 220))
        lit = Image.composite(rgb, squeezed.convert("RGB"), band)
        squeezed = Image.merge("RGBA", (*lit.split(), squeezed.getchannel("A")))
        img.paste(squeezed, (CX - w // 2, int(cy) - COIN_D // 2), squeezed)
        cur = squeezed
    else:
        cur = None

    # reflection of current coin state
    if cur is not None:
        refl = cur.transpose(Image.FLIP_TOP_BOTTOM)
        refl = ImageEnhance.Brightness(refl).enhance(0.4)
        mask = Image.new("L", refl.size, 0)
        md = ImageDraw.Draw(mask)
        for y in range(refl.size[1]):
            fade = max(0, 1 - y / (refl.size[1] * 0.38))
            md.line([(0, y), (refl.size[1], y)], fill=int(120 * fade))
        img.paste(refl, (CX - refl.size[0] // 2, FLOOR_Y + 8), mask)
    else:
        rb = EDGE.resize((max(2, int(EDGE.size[0] * s)), COIN_D)).transpose(Image.FLIP_TOP_BOTTOM)
        mask = Image.new("L", rb.size, 0)
        md = ImageDraw.Draw(mask)
        for y in range(rb.size[1]):
            fade = max(0, 1 - y / (rb.size[1] * 0.38))
            md.line([(0, y), (rb.size[1], y)], fill=int(90 * fade))
        img.paste(rb, (CX - rb.size[0] // 2, FLOOR_Y + 8), mask)

    # particles
    img = draw_particles(img, t)

    # neon case (glow + lines) over scene
    img = Image.blend(img, CASE_GLOW, 0.35)
    img.paste(CASE_RGB, (0, 0), CASE_LAYER)

    # typography last: always razor sharp
    out = img.convert("RGBA")
    out = Image.alpha_composite(out, TITLE)
    out = Image.alpha_composite(out, TAG)
    out = Image.alpha_composite(out, FOOT)

    # subtle push-in (final text unaffected: scale applied before text)
    zoom = 1.0 + 0.05 * smooth(t / SECS)
    if zoom > 1.001:
        zw, zh = int(W / zoom), int(H / zoom)
        x0, y0 = (W - zw) // 2, (H - zh) // 2
        base = out.crop((x0, y0, x0 + zw, y0 + zh)).resize((W, H), Image.LANCZOS)
        out = Image.alpha_composite(base, TITLE)
        out = Image.alpha_composite(out, TAG)
        out = Image.alpha_composite(out, FOOT)

    out.convert("RGB").save(f"frames/f_{i:03d}.png")

for i in range(FRAMES):
    render_frame(i)
    if i % 60 == 0:
        print("frame", i, flush=True)
print("frames done:", FRAMES)
