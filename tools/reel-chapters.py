#!/usr/bin/env python3
"""🎛️ REEL CHAPTERS — ek hi engine, kai chapter, har chapter ka APNA background.

tools/reel-master-180.py me ye logic inline tha (aur wo file render ho chuki hai, isliye
usko chheda nahi). Ye wahi code shared module bana diya hai taaki chhote reels me bhi
"chapter par background badalna" ek line me mile — copy-paste duplicate na bane.

use:
    rr = load engine (importlib)
    chapters = [dict(name=, base=, blobs=[..], gain=, light=, logo=, beats=[...]), ...]
    DUR = reel_chapters.install(rr, chapters, logo_img=LOGO_or_None)

beat spec (engine ke BEATS dicts se match karta hai, tools/reel-render.py:render_frame):
    ("hero",  [line1, line2], sub, dur)
    ("type",  [word, ...], dur)              ← max 6 words (1 word = 1 line, H*0.44 + i*132)
    ("count", label, from, to, dur)
Had: hero line1 168px → ~9 char, line2 132px → ~11 char, sub 52px (fit() 1080px se badi
line ko shrink kar deta hai). Light chapter me engine ka safed text gayab ho jaata hai,
isliye `light: True` par colour swap hota hai.
"""
import math

from PIL import Image, ImageDraw, ImageFilter

LIGHT_MAP = {
    (240, 250, 255, 255): (8, 16, 28, 255),    # hero lines
    (255, 236, 150, 255): (168, 82, 6, 255),   # type words (yellow)
    (236, 246, 255, 255): (24, 34, 52, 255),    # type words (white)
    (120, 240, 210, 255): (0, 106, 98, 255),    # sub line
    (150, 200, 235, 255): (52, 80, 110, 255),  # count label
    (110, 250, 190, 255): (0, 122, 92, 255),   # count number + bar fill
}

CUR = {"light": False}


def _bg_for(rr, time, c):
    """engine ke bg_layer jaisa hi, par base/palette/gain chapter se aate hain."""
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
    g = c.get("gain", 1.35)
    if abs(g - 1.0) > 1e-3:  # light chapter ko 1.35 gain se clip karke plain white ho jaata
        img = Image.eval(img, lambda v: min(255, int(v * g)))
    img = img.resize((rr.W, rr.H), Image.BILINEAR)
    ov = Image.new("RGBA", (rr.W, rr.H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    va = 10 if c.get("light") else 40  # light me rings dikh jaate the → halka
    for r in range(10):
        dr.rectangle([r * 9, r * 13, rr.W - r * 9, rr.H - r * 13],
                     outline=(0, 0, 0, int(va * ((10 - r) / 10) ** 2)), width=8)
    return Image.alpha_composite(img.convert("RGBA"), ov)


def install(rr, chapters, logo_img=None, fade=0.8, logo_scale=0.40):
    """chapters ki beats se timeline banata hai + bg/text/logo patch karta hai. Returns DUR."""
    beats, t = [], 0.0
    for ci, c in enumerate(chapters):
        c["ci"] = ci
        c["t0"] = t
        for spec in c["beats"]:
            kind, dur = spec[0], spec[-1]
            if kind == "hero":
                b = dict(kind="hero", lines=spec[1], sub=spec[2], t0=t, t1=t + dur)
            elif kind == "type":
                b = dict(kind="type", words=spec[1], t0=t, t1=t + dur)
            else:
                b = dict(kind="count", label=spec[1], a=spec[2], b=spec[3], fmt="{:.0f}", t0=t, t1=t + dur)
            b["ch"] = ci
            beats.append(b)
            t += dur
        c["t1"] = t
        c["dur"] = c["t1"] - c["t0"]
    dur_total = t

    def chapter_at(time):
        for c in chapters:
            if time < c["t1"]:
                return c["ci"]
        return chapters[-1]["ci"]

    def bg_layer(time):
        i = chapter_at(time)
        cur = _bg_for(rr, time, chapters[i])
        c0 = chapters[i]["t0"]
        if i > 0 and fade > 0 and time - c0 < fade:  # chapter cut par cross-fade
            cur = Image.blend(_bg_for(rr, time, chapters[i - 1]), cur, rr.ease_out((time - c0) / fade))
        return cur

    orig_ti = rr.text_image

    def text_image(txt, sz, color, bold=True):
        return orig_ti(txt, sz, LIGHT_MAP.get(tuple(color), color) if CUR["light"] else color, bold)

    orig_render = rr.render_frame

    def render_frame(time):
        i = chapter_at(time)
        c = chapters[i]
        CUR["light"] = bool(c.get("light"))
        f = orig_render(time)
        if logo_img is not None and c.get("logo"):
            rel = time - c["t0"]
            k = rr.spring(min(1.0, rel / 0.9))
            out = rr.ease_out(max(0.0, min(1.0, (rel - (c["dur"] - 0.9)) / 0.9)))
            size = max(10, int(rr.W * (logo_scale + 0.30 * (1.0 - k)) * (1.0 - 0.16 * out)))
            lay = logo_img.resize((size, size), Image.LANCZOS)
            lay = lay.rotate(2.0 * math.sin(rel * 0.55), resample=Image.BICUBIC)
            a = lay.getchannel("A").point(lambda v: int(v * min(1.0, 0.25 + k) * (1.0 - 0.75 * out)))
            lay.putalpha(a)
            f.alpha_composite(lay, (int(rr.W / 2 - size / 2), int(rr.H * 0.135 - size / 2)))
        return f

    rr.BEATS = beats
    rr.DUR = dur_total
    rr.N = int(rr.FPS * dur_total)
    rr.bg_layer = bg_layer
    rr.text_image = text_image
    rr.render_frame = render_frame
    return dur_total


def smoke(rr, chapters, tag="ch"):
    """har chapter ke beech ka 1 frame PNG — crash/clipping pakadne ke liye, ffmpeg ke bina."""
    for c in chapters:
        tt = c["t0"] + min(3.0, c["dur"] * 0.5)
        f = rr.render_frame(tt).convert("RGB")
        path = f"/tmp/{tag}-{c['name']}.png"
        f.save(path)
        print(f"   smoke {c['name']:<9} t={tt:6.1f} corner={f.getpixel((20, 20))} → {path}", flush=True)
