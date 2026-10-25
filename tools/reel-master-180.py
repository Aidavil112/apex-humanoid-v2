#!/usr/bin/env python3
"""🎬 APEX MASTER — 3-minute (≈181 s) "sab kuch ek video me" reel.

User bola: length = 3 min, background = "all use karo", type = "all".
To ye 5 chapter ka master hai, har chapter ka APNA background + APNA style:
  CH1 🅰️ brand      (kaala + cyan, logo sting on)
  CH2 🎬 process    (neon violet-cyan-magenta)
  CH3 📈 proof      (red-black)
  CH4 🚀 offer      (LIGHT mode — yahan text dark ho jaata hai, warna safed bg par gayab)
  CH5 📣 CTA        (teal-black, logo wapas)
Engine wahi tools/reel-render.py — koi duplicate render nahi. Sirf 3 cheezein patch hoti hain:
bg_layer (per-chapter palette + 0.8 s cross-fade), text_image (light chapter me colour swap),
render_frame (chapter ke andar logo composite). Logo = tools/reel-logo-reveal.py ka LOGO
(lib mode se import, isliye brand mark dono videos me byte-identical hai).

Layout had (tools/reel-render.py:render_frame se verify): hero line1 168px → ~9 char,
line2 132px → ~11 char, type beat = 1 word/line (max 6 words), sub 52px (fit() guard
1080px se badi line ko shrink kar deta hai).

Run:  python3 tools/reel-master-180.py
Out:  /home/user/preview/APEX-MASTER-180.mp4     (~5400 frame, render ~6 min)
"""
import importlib.util
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_MASTER_OUT", "/home/user/preview/APEX-MASTER-180.mp4")


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


rr = load("apex_engine_master", os.path.join(HERE, "reel-render.py"))  # engine (render abhi nahi)
os.environ["APEX_LOGO_LIB"] = "1"  # logo module ko sirf image banane do
ll = load("apex_logo_lib", os.path.join(HERE, "reel-logo-reveal.py"))
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

# ── chapters ────────────────────────────────────────────────────────────────
CH = [
    dict(name="brand", base=(10, 10, 18), blobs=[(24, 110, 190), (96, 34, 180), (0, 150, 170)],
         gain=1.35, light=False, logo=True),
    dict(name="process", base=(14, 10, 30), blobs=[(74, 30, 150), (14, 92, 140), (150, 32, 110)],
         gain=1.35, light=False, logo=False),
    dict(name="proof", base=(18, 8, 10), blobs=[(150, 26, 40), (60, 16, 90), (190, 90, 20)],
         gain=1.30, light=False, logo=False),
    dict(name="offer", base=(238, 242, 248), blobs=[(176, 206, 238), (216, 192, 238), (255, 214, 172)],
         gain=1.0, light=True, logo=False),
    dict(name="cta", base=(6, 18, 22), blobs=[(12, 120, 130), (30, 80, 190), (210, 60, 140)],
         gain=1.35, light=False, logo=True),
]

# beats: (kind, ...) + dur ; chapter ke beats = total 181 s
RAW = [
    (0, [("hero", ["APEX", "HUMANOID"], "AI that ships itself", 6.5),
         ("type", ["1", "Tap", "→", "Full", "Reel"], 6.0),
         ("count", "AGENTS · SAB JAAGTE", 0, 41, 5.5)]),
    (0, [("hero", ["₹0", "DOWNLOAD"], "APK link · bio me", 6.0)]),
    (1, [("type", ["Subah", "5", "baje", "sab", "ho", "gaya"], 5.0),
         ("count", "SPRING CURVES TUNED", 0, 42, 5.0),
         ("type", ["Word", "pop", "+", "real", "blur"], 5.0),
         ("count", "HD FRAMES · 1080×1920", 0, 5400, 5.0),
         ("hero", ["30", "FPS"], "vertical · no crop", 5.0),
         ("type", ["Prompt", "likho", "→", "script", "khud"], 5.0),
         ("count", "PROCESS KE STEPS", 0, 6, 5.0),
         ("hero", ["0%", "COMPRESSION"], "quality jaisi thi, waisi hai", 5.0),
         ("type", ["Koi", "editor", "nahi", "·", "koi", "GPU"], 5.0)]),
    (2, [("count", "PLATFORMS POSTED", 0, 3, 5.0),
         ("type", ["IG", "·", "FB", "·", "YT"], 5.0),
         ("count", "NIGHT SHIFT REPLIES", 0, 37, 5.0),
         ("type", ["Comment", "aaya", "→", "DM", "chala"], 5.0),
         ("count", "FOLLOWERS KO DM", 0, 214, 5.0),
         ("count", "REELS / MONTH", 0, 90, 5.0),
         ("hero", ["10", "GB FREE"], "R2 me · egress ₹0", 5.0),
         ("type", ["Hosting", "ka", "bill", "=", "₹0"], 5.0)]),
    (3, [("hero", ["APEX", "PRO"], "v6.6.15 · build 56", 5.0),
         ("type", ["Android", "13", "tak", "·", "HD", "videos"], 5.0),
         ("count", "APP KE ANDAR VIDEO", 0, 79, 5.0),
         ("type", ["Asli", "HD", "clip", "·", "0", "crop"], 5.0),
         ("hero", ["NO", "BILL"], "monthly subscription: ₹0", 5.0),
         ("count", "FIXED FEATURES", 0, 118, 5.0),
         ("type", ["1", "tap", "→", "3", "platforms"], 5.0),
         ("hero", ["ABHI", "LE LO"], "link bio me · APK", 5.0)]),
    (4, [("type", ["Comment", "karo", "\u201cMOTION\u201d"], 4.5),
         ("count", "AUTO DM · PER DAY", 0, 120, 4.5),
         ("type", ["Process", "ka", "PDF", "DM", "me"], 4.5),
         ("hero", ["SO", "JAO"], "night-shift on hai", 4.5),
         ("count", "SECOND ME REEL", 0, 72, 4.5),
         ("type", ["Skill", "ki", "zaroorat", "nahi"], 4.5)]),
    (4, [("hero", ["APEX", "HUMANOID"], "link bio me · comment karo", 5.0)]),
]

BEATS = []
t = 0.0
for ci, beats in RAW:
    for spec in beats:
        kind = spec[0]
        dur = spec[-1]
        if kind == "hero":
            b = dict(kind="hero", lines=spec[1], sub=spec[2], t0=t, t1=t + dur)
        elif kind == "type":
            b = dict(kind="type", words=spec[1], t0=t, t1=t + dur)
        else:
            b = dict(kind="count", label=spec[1], a=spec[2], b=spec[3], fmt="{:.0f}", t0=t, t1=t + dur)
        b["ch"] = ci
        BEATS.append(b)
        t += dur
DUR = t

# chapter ke absolute start/dur (cross-fade + logo animation ke liye)
for c in CH:
    c["t0"] = min((b["t0"] for b in BEATS if b["ch"] == CH.index(c)), default=0.0)
    c["t1"] = max((b["t1"] for b in BEATS if b["ch"] == CH.index(c)), default=DUR)
    c["dur"] = c["t1"] - c["t0"]

CUR = {"ch": 0, "light": False}


def chapter_at(time):
    for i, c in enumerate(CH):
        if time < c["t1"]:
            return i
    return len(CH) - 1


def bg_for(time, c):
    """engine ke bg_layer ka same idea, par base/palette/gain chapter ke hisaab se."""
    lw, lh = rr.W // 3, rr.H // 3
    img = Image.new("RGB", (lw, lh), c["base"])
    d = ImageDraw.Draw(img)
    for i, col in enumerate(c["blobs"]):
        ph = time * 0.42 + i * 2.1
        cx = lw * (0.5 + 0.34 * math.sin(ph * 0.8 + i))
        cy = lh * (0.32 + 0.42 * i + 0.10 * math.cos(ph * 1.1))
        rad = lw * (0.46 + 0.10 * math.sin(ph * 1.7))
        d.ellipse([cx - rad, cy - rad * 1.15, cx + rad, cy + rad * 1.15], fill=col)
    img = img.filter(ImageFilter.GaussianBlur(30))
    g = c["gain"]
    if abs(g - 1.0) > 1e-3:  # light chapter ko 1.35 gain se clip karke safed page ho jaata
        img = Image.eval(img, lambda v: min(255, int(v * g)))
    img = img.resize((rr.W, rr.H), Image.BILINEAR)
    ov = Image.new("RGBA", (rr.W, rr.H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    va = 10 if c["light"] else 40  # light chapter me rings dikhte the — halka kiya
    for r in range(10):
        dr.rectangle([r * 9, r * 13, rr.W - r * 9, rr.H - r * 13], outline=(0, 0, 0, int(va * ((10 - r) / 10) ** 2)), width=8)
    return Image.alpha_composite(img.convert("RGBA"), ov)


_orig_bg = rr.bg_layer


def bg_layer(time):  # noqa: D103
    i = chapter_at(time)
    cur = bg_for(time, CH[i])
    c0 = CH[i]["t0"]
    if i > 0 and time - c0 < 0.8:  # chapter transition par 0.8 s cross-fade
        mix = rr.ease_out((time - c0) / 0.8)
        cur = Image.blend(bg_for(time, CH[i - 1]), cur, mix)
    return cur


# light background par engine ka safed text gayab ho jaata hai → colour swap
LIGHT_MAP = {
    (240, 250, 255, 255): (8, 16, 28, 255),      # hero lines
    (255, 236, 150, 255): (168, 82, 6, 255),     # type words (yellow)
    (236, 246, 255, 255): (24, 34, 52, 255),      # type words (white)
    (120, 240, 210, 255): (0, 106, 98, 255),      # sub line
    (150, 200, 235, 255): (52, 80, 110, 255),     # count label
    (110, 250, 190, 255): (0, 122, 92, 255),      # count number
}
_orig_ti = rr.text_image


def text_image(txt, sz, color, bold=True):  # noqa: D103
    return _orig_ti(txt, sz, LIGHT_MAP.get(tuple(color), color) if CUR["light"] else color, bold)


_orig_render = rr.render_frame
SIZE = 0.40


def render_frame(time):  # noqa: D103
    i = chapter_at(time)
    CUR["ch"], CUR["light"] = i, CH[i]["light"]
    f = _orig_render(time)
    if CH[i]["logo"]:
        t0, span = CH[i]["t0"], CH[i]["dur"]
        rel = time - t0
        k = rr.spring(min(1.0, rel / 0.9))
        out = rr.ease_out(max(0.0, min(1.0, (rel - (span - 0.9)) / 0.9)))
        size = max(10, int(rr.W * (SIZE + 0.30 * (1.0 - k)) * (1.0 - 0.16 * out)))
        lay = ll.LOGO.resize((size, size), Image.LANCZOS)
        lay = lay.rotate(2.0 * math.sin(rel * 0.55), resample=Image.BICUBIC)
        a = lay.getchannel("A").point(lambda v: int(v * min(1.0, 0.25 + k) * (1.0 - 0.75 * out)))
        lay.putalpha(a)
        f.alpha_composite(lay, (int(rr.W / 2 - size / 2), int(rr.H * 0.135 - size / 2)))
    return f


rr.BEATS = BEATS
rr.DUR = DUR
rr.N = int(rr.FPS * rr.DUR)
rr.bg_layer = bg_layer
rr.text_image = text_image
rr.render_frame = render_frame

sys.argv = ["reel-render", "--out", OUT]  # ll ne apna argv bhar diya tha — ab final
print(f"🎬 MASTER: {rr.N} frames / {DUR:.1f}s / {len(CH)} chapter → {OUT}", flush=True)
for c in CH:
    print(f"   • {c['name']:<8} {c['t0']:6.1f}s → {c['t1']:6.1f}s   ({c['t1']-c['t0']:.1f}s)", flush=True)

if os.environ.get("APEX_MASTER_SMOKE") == "1":
    # self-check: har chapter ke beech ka 1 frame PNG, bina ffmpeg ke (crash pakadne ke liye)
    for c in CH:
        tt = c["t0"] + min(3.0, c["dur"] * 0.5)
        f = render_frame(tt)
        path = f"/tmp/master-smoke-{c['name']}.png"
        f.convert("RGB").save(path)
        px = f.convert("RGB").getpixel((20, 20))
        print(f"   smoke {c['name']:<8} t={tt:6.1f} corner={px} → {path}", flush=True)
    raise SystemExit(0)

rr.main()
