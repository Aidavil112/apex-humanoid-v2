#!/usr/bin/env python3
"""🅰️ APEX LOGO STING — animated logo reveal reel (8 second, 1080×1920, audio ke saath).

tools/reel-render.py ka HI engine use hota hai (duplicate nahi): sirf BEATS + palette
override kiye jaate hain, aur logo layer render_frame ko wrap karke upar composite hota hai.
Logo = procedural PIL drawing (hexagon ring + APEX monogram + orbit dots + shine sweep),
isliye koi image file / internet nahi chahiye.

Run:  python3 tools/reel-logo-reveal.py
Out:  /home/user/preview/APEX-LOGO-STING.mp4
"""
import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_LOGO_OUT", "/home/user/preview/APEX-LOGO-STING.mp4")

sys.argv = ["reel-render", "--out", OUT]
spec = importlib.util.spec_from_file_location("apex_reel_engine", os.path.join(HERE, "reel-render.py"))
rr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rr)

from PIL import Image, ImageDraw, ImageFilter  # noqa: E402  (engine bhi inhi ko use karta hai)

CYAN = (34, 211, 238)
MAG = (232, 62, 158)
WHITE = (238, 246, 255)

SS = 1  # 1 = source logo 900px (2 karte per-frame resize mehnga padta hai)
LW = LH = 900 * SS


def hexagon(cx, cy, r, rot=0.0):
    return [(cx + r * math.cos(rot + i * math.pi / 3), cy + r * math.sin(rot + i * math.pi / 3)) for i in range(6)]


def build_logo():
    img = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = LW / 2
    R = LW * 0.36
    # 1) outer hexagon ring (double stroke = neon tube look)
    for rr_, col, w in ((1.00, CYAN, 9 * SS), (0.90, (*MAG, 190), 5 * SS)):
        d.polygon(hexagon(cx, cy, R * rr_, -math.pi / 2), outline=col, width=w)
    # 2) inner fill glow
    fill = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    ImageDraw.Draw(fill).polygon(hexagon(cx, cy, R * 0.88, -math.pi / 2), fill=(*CYAN, 26))
    img = Image.alpha_composite(img, fill)
    d = ImageDraw.Draw(img)
    # 3) APEX monogram: 'A' = chevron + crossbar, area-preserving moti
    m = R * 0.52
    d.line([(cx - m, cy + m * 0.95), (cx, cy - m * 0.85)], fill=WHITE, width=int(26 * SS))
    d.line([(cx, cy - m * 0.85), (cx + m, cy + m * 0.95)], fill=WHITE, width=int(26 * SS))
    d.line([(cx - m * 0.52, cy + m * 0.18), (cx + m * 0.52, cy + m * 0.18)], fill=WHITE, width=int(17 * SS))
    # 4) orbit dots = 41 agents / head-bot motif
    for i, ang in enumerate((-math.pi / 2, math.pi / 6, 5 * math.pi / 6)):
        ox, oy = cx + R * 1.0 * math.cos(ang), cy + R * 1.0 * math.sin(ang)
        rad = (16 - 4 * i) * SS
        col = [CYAN, MAG, WHITE][i]
        d.ellipse([ox - rad, oy - rad, ox + rad, oy + rad], fill=(*col, 255))
    # 5) wordmark ISMEIN nahi — engine ka hero beat "APEX / HUMANOID" chhapta hai;
    #    900px canvas me letterspaced line kaat rahi thi (frame check me "PEX HUMANOI" dikha)
    glow = img.filter(ImageFilter.GaussianBlur(16 * SS))
    out = Image.new("RGBA", (LW, LH), (0, 0, 0, 0))
    out = Image.alpha_composite(out, glow)
    return Image.alpha_composite(out, img)


LOGO = build_logo()
_orig_render = rr.render_frame


def render_frame(time):  # noqa: D103 - engine ki jagah wahi signature
    f = _orig_render(time)
    dur = rr.DUR
    # reveal: 1.75x se spring karke 1.0, alpha 0→255 (0.9 s me)
    p = min(1.0, time / 0.90)
    k = rr.spring(p)
    settle = 1.0 + 0.75 * (1.0 - k)
    # end card pe logo chhota hoke upar khisakta hai
    lift = 0.0
    if time > dur - 2.6:
        q = rr.ease_out(min(1.0, (time - (dur - 2.6)) / 1.1))
        settle *= (1.0 - 0.30 * q)
        lift = -0.085 * rr.H * q
    # saans (idle motion) + halka jhool
    breathe = 1.0 + 0.014 * math.sin(time * 1.25)
    ang = 2.2 * math.sin(time * 0.55)
    size = max(8, int(rr.W * 0.50 * settle * breathe / SS))
    layer = LOGO.resize((size, size), Image.LANCZOS).rotate(ang, resample=Image.BICUBIC, expand=False)
    a = layer.getchannel("A").point(lambda v: int(v * min(1.0, 0.15 + k)))
    layer.putalpha(a)
    # shine sweep: logo ke upar se guzarti hui patti (0.55 s → 1.45 s)
    if 0.55 <= time <= 1.55:
        s = (time - 0.55) / 1.0
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        dd = ImageDraw.Draw(sh)
        x0 = int(-0.35 * layer.width + 1.7 * s * layer.width)
        dd.polygon([(x0, 0), (x0 + layer.width // 10, 0), (x0 - layer.width // 6, layer.height),
                    (x0 - layer.width // 6 - layer.width // 10, layer.height)], fill=(255, 255, 255, 70))
        sh = sh.filter(ImageFilter.GaussianBlur(9))
        lit = layer.copy()
        layer = Image.alpha_composite(lit, sh)
        # shine sirf logo ke pixels par rahe, pure frame par patti na bane
        layer = Image.composite(layer, lit, layer.getchannel("A").point(lambda v: 255 if v > 18 else 0))
    px = int(rr.W / 2 - layer.width / 2)
    py = int(rr.H * 0.185 - layer.height / 2 + lift)
    f.alpha_composite(layer, (px, py))
    return f


rr.BG = [(18, 96, 178), (98, 32, 198), (10, 178, 196)]
rr.DUR = 8.0
rr.N = int(rr.FPS * rr.DUR)
rr.BEATS = [
    dict(kind="hero", lines=["APEX", "HUMANOID"], sub="logo sting · 8 second", t0=0.0, t1=2.4),
    dict(kind="type", words=["1", "Tap", "→", "Full", "Reel"], t0=2.4, t1=4.0),
    dict(kind="count", label="AGENTS AWAKE", a=0, b=41, t0=4.0, t1=5.6, fmt="{:.0f}"),
    dict(kind="hero", lines=["COMMENT", "\u201cAPEX\u201d"], sub="APK + process, DM me", t0=5.6, t1=8.0),
]
rr.render_frame = render_frame

if os.environ.get("APEX_LOGO_LIB") == "1":
    # lib mode: APEX-MASTER-180.mp4 driver sirf LOGO image maangta hai, render nahi
    print("🅰️  logo lib mode (LOGO ready, render skip)")
else:
    print(f"🅰️  rendering logo sting: {rr.N} frames @ {rr.W}x{rr.H} → {OUT}", flush=True)
    rr.main()
