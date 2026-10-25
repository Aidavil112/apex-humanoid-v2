#!/usr/bin/env python3
"""🎬 APEX REEL RENDER — OneTake-style motion graphics, locally, ₹0.

Ye script usi "cinematic reel" look ko reproduce karti hai jo Claude Code + OneTake
skill banata hai (staggered springs, area-preserving squash, word-pop captions,
whip/glitch transitions, stat count-up, calm idle background motion, real motion blur)
— farak sirf itna: yahan **NVIDIA GPU / Remotion / Python env ki zaroorat nahi**,
sirf PIL + numpy + static ffmpeg chahiye. App me isi look ka version **Motion Forge**
(phone ke andar Canvas + MediaRecorder) banata hai.

Usage:  python3 tools/reel-render.py --out /home/user/preview/APEX-REEL-DEMO.mp4
"""
import argparse
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
DUR = 12.0
N = int(DUR * FPS)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(sz, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_R, sz)


def clamp(x, a, b):
    return a if x < a else b if x > b else x


def ease_out(t):
    return 1 - (1 - t) ** 3


def spring(t, zeta=0.42, omega=13.0):
    """Underdamped spring 0→1 (jo cheez 'aakar' ruki hui lage, linear nahi)."""
    if t <= 0:
        return 0.0
    wd = omega * math.sqrt(max(1e-6, 1 - zeta * zeta))
    return 1 - math.exp(-zeta * omega * t) * math.cos(wd * t)


def area_squash(v):
    """Area-preserving squash: x badhe to y 1/x ho jaaye (cartoon weight)."""
    sx = 1 + 0.30 * v
    return sx, 1.0 / sx


# ── beats: kaun sa line kab, kya kare ────────────────────────────────────────
BEATS = [
    dict(kind="hero", lines=["APEX", "HUMANOID"], sub="AI that ships itself", t0=0.0, t1=2.5),
    dict(kind="type", words=["Subah", "5", "baje", "video", "ready"], t0=2.5, t1=4.4),
    dict(kind="count", label="PLATFORMS POSTED", a=0, b=3, t0=4.4, t1=6.3, fmt="{:.0f}"),
    dict(kind="type", words=["1 tap", "→", "IG", "+ FB", "+ YT"], t0=6.3, t1=8.0),
    dict(kind="count", label="NIGHT SHIFT · REPLIES", a=0, b=15, t0=8.0, t1=9.6, fmt="{:.0f}"),
    dict(kind="hero", lines=["₹0", "HOSTING"], sub="Cloudflare Worker + R2", t0=9.6, t1=12.0),
]
BG = [(74, 30, 150), (14, 92, 140), (150, 32, 110)]


def text_image(txt, sz, color, bold=True):
    f = font(sz, bold)
    d0 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    l, t, r, b = d0.textbbox((0, 0), txt, font=f)
    pad = int(sz * 0.45)
    img = Image.new("RGBA", (int(r - l) + pad * 2, int(b - t) + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((pad - l, pad - t), txt, font=f, fill=color)
    return img


def fit(img, maxw=None):
    """Koi bhi text image frame se badi ho to proportional shrink — kinare se katna jaayega nahi.
    (41-second reel me hero ka sub-line 1100px ho gaya tha aur "…kar di thi" cut ho raha tha.)"""
    maxw = maxw or (W - 70)
    if img.width <= maxw:
        return img
    sc = maxw / img.width
    return img.resize((max(2, int(img.width * sc)), max(2, int(img.height * sc))), Image.LANCZOS)


def paste_spring(frame, img, cx, cy, k, scale=1.0, alpha=255):
    """k = spring overshoot (0 = settled). Squash area-preserving."""
    sx, sy = area_squash(k)
    w = max(2, int(img.width * scale * sx))
    h = max(2, int(img.height * scale * sy))
    layer = img.resize((w, h), Image.LANCZOS)
    if alpha < 255:
        a = layer.getchannel("A").point(lambda v: int(v * alpha / 255))
        layer.putalpha(a)
    frame.alpha_composite(layer, (int(cx - w / 2), int(cy - h / 2)))


def bg_layer(time):
    """Calm idle motion: 3 soft blobs jo saans lete hain (low-res par blur = sasta)."""
    lw, lh = W // 3, H // 3
    img = Image.new("RGB", (lw, lh), (14, 10, 30))
    d = ImageDraw.Draw(img)
    for i, col in enumerate(BG):
        ph = time * 0.42 + i * 2.1
        cx = lw * (0.5 + 0.34 * math.sin(ph * 0.8 + i))
        cy = lh * (0.32 + 0.42 * i + 0.10 * math.cos(ph * 1.1))
        rad = lw * (0.46 + 0.10 * math.sin(ph * 1.7))
        d.ellipse([cx - rad, cy - rad * 1.15, cx + rad, cy + rad * 1.15], fill=col)
    img = img.filter(ImageFilter.GaussianBlur(30))
    img = Image.eval(img, lambda v: min(255, int(v * 1.35)))
    img = img.resize((W, H), Image.BILINEAR)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    # grain-free vignette taaki text pop kare
    for r in range(0, 10):
        a = int(40 * ((10 - r) / 10) ** 2)
        dr.rectangle([r * 9, r * 13, W - r * 9, H - r * 13], outline=(0, 0, 0, a), width=8)
    return Image.alpha_composite(img.convert("RGBA"), ov)


def beat_at(time):
    for b in BEATS:
        if b["t0"] <= time < b["t1"]:
            return b, time - b["t0"], b["t1"] - b["t0"]
    return None, 0.0, 1.0


def render_frame(time):
    fr = bg_layer(time)
    b, u, span = beat_at(time)
    if b is None:
        return fr
    in_k = spring(clamp(u / 0.42, 0, 2)) - 1.0
    out_t = clamp((u - (span - 0.34)) / 0.34, 0, 1)
    out_e = ease_out(out_t)
    lift = -260 * out_e
    fade = int(255 * (1 - out_t))
    whip = int(46 * (1 - clamp(u / 0.18, 0, 1)))  # transition par horizontal whip

    if b["kind"] == "hero":
        y = H * 0.42
        for i, ln in enumerate(b["lines"]):
            k = spring(clamp((u - i * 0.13) / 0.42, 0, 2)) - 1.0
            img = fit(text_image(ln, 168 if i == 0 else 132, (240, 250, 255, 255)))
            paste_spring(fr, img, W / 2 + whip, y + i * 200 + lift, k, 1.0, fade)
        img = fit(text_image(b["sub"], 52, (120, 240, 210, 255), bold=False))
        paste_spring(fr, img, W / 2 + whip, y + 430 + lift, in_k * 0.5, 1.0, fade)
    elif b["kind"] == "type":
        for i, w_ in enumerate(b["words"]):
            st = 0.10 + i * 0.17
            k = spring(clamp((u - st) / 0.36, 0, 2)) - 1.0
            live = clamp((u - st) / 0.16, 0, 1)
            img = text_image(w_, 96, (255, 236, 150, 255) if i % 2 == 0 else (236, 246, 255, 255))
            paste_spring(
                fr, img, W / 2 + whip, H * 0.44 + i * 132 + lift, k * live, 0.6 + 0.4 * live,
                min(fade, int(255 * live)),
            )
    else:  # count-up
        v = b["a"] + (b["b"] - b["a"]) * ease_out(clamp(u / (span * 0.72), 0, 1))
        img = text_image(b["label"], 50, (150, 200, 235, 255), bold=False)
        paste_spring(fr, img, W / 2 + whip, H * 0.34 + lift, in_k * 0.4, 1.0, fade)
        num = text_image(b["fmt"].format(v), 300, (110, 250, 190, 255))
        paste_spring(fr, num, W / 2 + whip, H * 0.48 + lift, in_k, 1.0, fade)
        bar = Image.new("RGBA", (W - 200, 14), (255, 255, 255, 30))
        ImageDraw.Draw(bar).rectangle(
            [0, 0, int((W - 200) * clamp(u / (span * 0.72), 0, 1)), 14], fill=(110, 250, 190, 255)
        )
        fr.alpha_composite(bar, (100, int(H * 0.56)))
    return fr


def make_audio(path):
    """Beat: 128 BPM kick + offbeat hat + sub bass, sab numpy se (koi file nahi)."""
    sr = 44100
    t = np.arange(int(DUR * sr)) / sr
    out = np.zeros_like(t)
    bpm, spb = 128.0, 60.0 / 128.0
    for beat in np.arange(0, DUR, spb / 2):
        i0 = int(beat * sr)
        n = min(int(0.24 * sr), len(t) - i0)
        if n <= 1:
            continue
        tt = np.arange(n) / sr
        kick = np.sin(2 * np.pi * (58 + 42 * np.exp(-tt * 22)) * tt) * np.exp(-tt * 13)
        out[i0:i0 + n] += 0.62 * kick
        if int(round(beat / (spb / 2))) % 2 == 1:  # off-beat hat
            hat = (np.random.default_rng(int(beat * 1000)).standard_normal(n)) * np.exp(-tt * 40)
            out[i0:i0 + n] += 0.10 * hat
    bass_t = t
    bass = np.sin(2 * np.pi * np.where((bass_t % (spb * 2)) < spb, 55.0, 73.4)) * 0.16
    out += bass * (1 - 0.35 * np.cos(2 * np.pi * bass_t / (spb * 8)))
    out *= np.minimum(1.0, (1 - np.exp(-t * 6)) * (1 - np.exp(-(DUR - t) * 3.2)))
    out = np.clip(out * 0.85, -1, 1)
    pcm = (out * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/home/user/preview/APEX-REEL-DEMO.mp4")
    ap.add_argument("--from-cache", default="", help="sirf audio dobara mux karne ke liye")
    a = ap.parse_args()
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    import imageio_ffmpeg

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = a.out.rsplit(".", 1)[0] + ".wav"
    if not a.from_cache:
        make_audio(wav)
        cmd = [
            ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
            "-i", "-", "-i", wav, "-vf", "tmix=frames=2:weights=0.62 0.38",  # sasta real motion blur
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", a.out,
        ]
        log = open("/tmp/ff.log", "wb")
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
        for i in range(N):
            p.stdin.write(render_frame(i / FPS).convert("RGB").tobytes())
            if i % 60 == 0:
                print(f"  frame {i}/{N}", flush=True)
        p.stdin.close()
        p.wait()
        log.close()
        if p.returncode:
            log.close(); print(open("/tmp/ff.log","rb").read().decode("utf8","ignore")[-1200:]); sys.exit("ffmpeg render fail")
    print("✅", a.out, os.path.getsize(a.out), "bytes")


if __name__ == "__main__":
    main()
