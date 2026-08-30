"""Compose the first-frame keyframe: VyronX coin in a holographic showcase.

Style follows the reference video: dark stage, trapezoidal neon glass case,
coin floating in the center, title above, tagline below, floor reflection.
Golden/amber neon to match the coin (reference used blue; coin is gold+black).
"""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

W = H = 1280
CX = W // 2

# ---------- canvas: dark radial backdrop ----------
bg = Image.new("RGB", (W, H), (4, 3, 8))
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    r = int(4 + 14 * t)
    g = int(3 + 10 * t)
    b = int(8 + 22 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# subtle radial glow behind coin
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([CX - 430, 500 - 430, CX + 430, 500 + 430], fill=90)
glow = glow.filter(ImageFilter.GaussianBlur(120))
amber = Image.new("RGB", (W, H), (255, 190, 80))
bg = Image.composite(amber, bg, glow.point(lambda v: v // 3))

# ---------- floor ----------
FLOOR_Y = 1035
d = ImageDraw.Draw(bg)
d.rectangle([0, FLOOR_Y, W, H], fill=(10, 8, 6))
d.line([(0, FLOOR_Y), (W, FLOOR_Y)], fill=(120, 95, 45), width=2)

# perspective floor lines converging to center (subtle, outside case footprint)
fl = ImageDraw.Draw(bg)
for i in (-5, -4, -3, 3, 4, 5):
    x0 = CX + i * 240
    fl.line([(x0, FLOOR_Y), (CX + i * 40, H)], fill=(30, 24, 13), width=1)
# horizontal receding lines
for j, yy in enumerate((1090, 1150, 1220)):
    a = 42 - j * 12
    fl.line([(0, yy), (W, yy)], fill=(a, int(a * 0.8), int(a * 0.4)), width=1)

# ---------- coin ----------
coin = Image.open("front.png").convert("RGBA")
# trim to alpha bbox and square-crop
bbox = coin.getchannel("A").getbbox()
coin = coin.crop(bbox)
side = max(coin.size)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(coin, ((side - coin.size[0]) // 2, (side - coin.size[1]) // 2), coin)
COIN_D = 640
sq = sq.resize((COIN_D, COIN_D), Image.LANCZOS)

COIN_CY = 560  # center of coin
# soft glow behind coin
cg = Image.new("L", (W, H), 0)
cd = ImageDraw.Draw(cg)
cd.ellipse([CX - COIN_D // 2 - 60, COIN_CY - COIN_D // 2 - 60,
            CX + COIN_D // 2 + 60, COIN_CY + COIN_D // 2 + 60], fill=110)
cg = cg.filter(ImageFilter.GaussianBlur(70))
warm = Image.new("RGB", (W, H), (255, 175, 60))
bg = Image.composite(warm, bg, cg.point(lambda v: v // 2))
d = ImageDraw.Draw(bg)

bg.paste(sq, (CX - COIN_D // 2, COIN_CY - COIN_D // 2), sq)

# floor reflection: flipped coin, short and clearly a reflection
refl = sq.transpose(Image.FLIP_TOP_BOTTOM)
refl = ImageEnhance.Brightness(refl).enhance(0.4)
mask = Image.new("L", refl.size, 0)
md = ImageDraw.Draw(mask)
for y in range(refl.size[1]):
    fade = max(0, 1 - y / (refl.size[1] * 0.38))
    md.line([(0, y), (refl.size[1], y)], fill=int(120 * fade))
bg.paste(refl, (CX - COIN_D // 2, FLOOR_Y + 8), mask)

# ---------- trapezoid showcase frame (perspective box) ----------
frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(frame)
NEON = (255, 200, 90)
NEON_SOFT = (255, 170, 60)

# trapezoid: top edge narrower than bottom (perspective)
TOP_Y, BOT_Y = 120, 1035
top_half, bot_half = 300, 410
# left/right slanted edges
fd.line([(CX - top_half, TOP_Y), (CX - bot_half, BOT_Y)], fill=NEON + (235,), width=5)
fd.line([(CX + top_half, TOP_Y), (CX + bot_half, BOT_Y)], fill=NEON + (235,), width=5)
# top and bottom edges
fd.line([(CX - top_half, TOP_Y), (CX + top_half, TOP_Y)], fill=NEON + (235,), width=5)
fd.line([(CX - bot_half, BOT_Y), (CX + bot_half, BOT_Y)], fill=NEON + (245,), width=6)
# inner secondary lines (glass panels), NOT crossing the coin: only near top
inset = 26
fd.line([(CX - top_half + inset, TOP_Y + inset), (CX - top_half - 90, 345)],
        fill=NEON_SOFT + (110,), width=2)
fd.line([(CX + top_half - inset, TOP_Y + inset), (CX + top_half + 90, 345)],
        fill=NEON_SOFT + (110,), width=2)
# horizontal glass hint lines: stop short of coin silhouette
coin_half_at = lambda yy: int(COIN_D / 2 * max(0.35, 1 - abs(yy - COIN_CY) / 900))
for frac, a in ((0.30, 34), (0.55, 42)):
    yy = TOP_Y + (BOT_Y - TOP_Y) * frac
    half = top_half + (bot_half - top_half) * frac
    stop = coin_half_at(yy) + 70
    fd.line([(CX - half + 12, yy), (CX - stop, yy)], fill=NEON_SOFT + (a,), width=2)
    fd.line([(CX + stop, yy), (CX + half - 12, yy)], fill=NEON_SOFT + (a,), width=2)

# corner accents
for sx in (-1, 1):
    for sy in (-1, 1):
        px = CX + sx * (top_half if sy < 0 else bot_half)
        py = TOP_Y if sy < 0 else BOT_Y
        dx = 40 * sx
        fd.line([(px, py), (px + dx, py)], fill=NEON + (255,), width=6)
        vy = 40 * -sy * -1
        fd.line([(px, py), (px, py - 44 * sy)], fill=NEON + (255,), width=6)

# glow pass for the neon lines
glow_layer = Image.new("RGB", (W, H), (0, 0, 0))
glow_layer.paste(frame, (0, 0), frame)
glow_blur = glow_layer.filter(ImageFilter.GaussianBlur(14))
bg = Image.blend(bg, Image.blend(bg, glow_blur, 0.0), 0.0)  # placeholder
bg = Image.composite(Image.new("RGB", (W, H), (255, 190, 90)), bg,
                     frame.getchannel("A").point(lambda v: v // 6))
bg = Image.blend(bg, glow_blur, 0.35)
d = ImageDraw.Draw(bg)
rgb_frame = frame.convert("RGB")
bg.paste(rgb_frame, (0, 0), frame)

# ---------- typography ----------
def load_font(size, bold=True):
    cands = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/seguisb.ttf",
    ]
    for c in cands:
        try:
            return ImageFont.truetype(c, size)
        except Exception:
            continue
    return ImageFont.load_default()

def draw_glow_text(draw, xy, text, font, fill, anchor, glow_color=(255, 190, 90), glow_r=10):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.text(xy, text, font=font, fill=glow_color + (255,), anchor=anchor)
    glow_img = layer.filter(ImageFilter.GaussianBlur(glow_r))
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(base)
    bd.text(xy, text, font=font, fill=fill + (255,), anchor=anchor)
    return Image.alpha_composite(glow_img, base)

title = "VYRONX"
tagline = "VISÃO · INOVAÇÃO · LIBERDADE"

f_title = load_font(108, bold=True)
f_tag = load_font(44, bold=False)

title_layer = draw_glow_text(d, (CX, 66), title, f_title, (255, 226, 160), "mm")
tag_layer = draw_glow_text(d, (CX, 1168), tagline, f_tag, (235, 205, 140), "mm")

bg_rgba = bg.convert("RGBA")
bg_rgba = Image.alpha_composite(bg_rgba, title_layer)
bg_rgba = Image.alpha_composite(bg_rgba, tag_layer)

# small footer text
fd2 = ImageDraw.Draw(bg_rgba)
f_small = load_font(26, bold=False)
fd2.text((CX, 1226), "TECNOLOGIA · CRIPTO · FUTURO", font=f_small, fill=(190, 160, 110), anchor="mm")

bg_rgba.convert("RGB").save("keyframe_first.png", quality=95)
print("saved keyframe_first.png", bg_rgba.size)
