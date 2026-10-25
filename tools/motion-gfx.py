#!/usr/bin/env python3
"""🪄 MOTION GFX — "us reel jaisa look", software renderer (koi Blender/GPU nahi).

User: "same bana sakta ho?" (reference FB reel 1Eu6rUL3V7 = After Effects grade motion
graphics: morphing shapes, 3D elements, fluid camera movement, kinetic typography).

Ye script us LOOK ki 4 cheezein sach me banata hai, sirf PIL + numpy + ffmpeg se:
  • 3D element  : polygon extrude → solid plate, perspective projection, painter-sort,
                  face-normal shading + rim light, brand "A" front face par 3D lines me
  • morphing    : radius(θ) jo superellipse ↔ hexagon ↔ star me circular-blend hoti hai
  • fluid camera: eased zoom push-in + pan + roll (frame-rate independent easing)
  • kinetic type: engine ke word-pop springs + area-preserving squash (reel-render.py se)
  • bloom       : ⅓-scale additive blur (cheap; full-res blur 1.5 s/frame le jaata tha)

Jo SACCH me nahi ho sakta yahan (honest limit): global illumination, ray-traced reflection,
roughness/subsurface materials, motion-vector true motion blur, real bezier camera rig,
subsurface DOF. Yahan 3D = flat-shaded extrusion + rim light + bloom → "close, same nahi".

SS-space rule (pehle isme hi bug tha): projection SAARA kaam 2160×3840 me karta hai,
draw karte waqt dobara *SS MAT karo, aur text ko 132*SS px par banao.

Run:  python3 tools/motion-gfx.py
      APEX_MG_SMOKE=1 python3 tools/motion-gfx.py   → 6 PNG frame, ffmpeg nahi
Out:  /home/user/preview/APEX-MOTION-GFX.mp4   (15 s · 1080×1920 · 30 fps)
"""
import importlib.util
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_MG_OUT", "/home/user/preview/APEX-MOTION-GFX.mp4")
SS = 2
W, H, FPS = 1080, 1920, 24  # 24 fps: 360 frame (30 par 9 min lag rahe the; reel me farak dikhta hi nahi)
DUR = 15.0
SW, SH = W * SS, H * SS


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


eng = load("apex_engine_mg", os.path.join(HERE, "reel-render.py"))
clamp, ease_out, spring = eng.clamp, eng.ease_out, eng.spring

CYAN = (60, 214, 255)
MAG = (236, 62, 158)
INK = (7, 9, 16)
LDIR = np.array([0.45, -0.5, 0.74])
LDIR = LDIR / np.linalg.norm(LDIR)


def poly_hex(n=6, r=1.0, rot=-math.pi / 2):
    return np.array([[r * math.cos(rot + i * 2 * math.pi / n), r * math.sin(rot + i * 2 * math.pi / n)] for i in range(n)])


def blob_poly(phase, n=110):
    """morph: superellipse ↔ hexagon ↔ star (radius(θ) ka circular blend)."""
    th = np.linspace(0, 2 * math.pi, n, endpoint=False)
    p = (phase % 3.0) / 3.0
    r1 = 1.0 / (0.55 + (np.abs(np.cos(th * 2)) ** 4 + np.abs(np.sin(th * 2)) ** 4) ** 0.28)
    r2 = 1.0 / (0.86 + 0.16 * np.cos(6 * th))
    r3 = 1.0 + 0.30 * np.cos(5 * th)
    w = np.array([max(0.0, 1 - abs(p * 3 - k) * 1.6) for k in range(3)])
    w = np.maximum(w, 1e-4)
    r = (r1 * w[0] + r2 * w[1] + r3 * w[2]) / w.sum()
    return np.stack([r * np.cos(th), r * np.sin(th)], axis=1)


def project(pts3, cam):
    x, y, z = pts3[:, 0], pts3[:, 1], pts3[:, 2]
    cy_, sy_ = math.cos(cam["yaw"]), math.sin(cam["yaw"])
    x, z = x * cy_ + z * sy_, -x * sy_ + z * cy_
    cx_, sx_ = math.cos(cam["pitch"]), math.sin(cam["pitch"])
    y, z = y * cx_ - z * sx_, y * sx_ + z * cx_
    if cam["roll"]:
        cr, sr = math.cos(cam["roll"]), math.sin(cam["roll"])
        x, y = x * cr - y * sr, x * sr + y * cr
    zz = np.maximum(z + cam["dist"], 0.18)
    f = cam["zoom"] * (cam["dist"] / zz)
    return np.stack([x * f, -y * f], axis=1) + np.array([cam["cx"], cam["cy"]])


def extrude(poly2, depth, cam, base_col):
    """2D outline → solid plate (front/side/back), painter-sorted, flat shaded."""
    n = len(poly2)
    front = np.concatenate([poly2, np.full((n, 1), depth * 0.5)], axis=1)
    back = np.concatenate([poly2, np.full((n, 1), -depth * 0.5)], axis=1)
    pf, pb = project(front, cam), project(back, cam)
    faces = [(pf, front.mean(axis=0)[2], base_col)]
    for i in range(n):
        j = (i + 1) % n
        quad3 = np.array([front[i], front[j], back[j], back[i]])
        nrm = np.cross(quad3[1] - quad3[0], quad3[3] - quad3[0])
        ln = np.linalg.norm(nrm)
        if ln < 1e-9:
            continue
        sh = 0.18 + 0.86 * max(0.0, float(np.dot(nrm / ln, LDIR)))
        faces.append((project(quad3, cam), quad3.mean(axis=0)[2],
                       tuple(min(255, int(c * sh)) for c in base_col)))
    faces.append((pb, back.mean(axis=0)[2], tuple(int(c * 0.3) for c in base_col)))
    faces.sort(key=lambda f: -f[1])
    img = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for poly, _z, col in faces:
        d.polygon([(x, y) for x, y in poly], fill=(*col, 255), outline=(255, 255, 255, 22))
    return img, front


def a_mark_lines(scale=0.46):
    """brand 'A' = 3 segments (2 leg + crossbar), world-space me."""
    s = scale
    return [[(-0.60 * s, -0.78 * s), (0.06 * s, 0.78 * s)],
            [(0.06 * s, 0.78 * s), (0.72 * s, -0.78 * s)],
            [(-0.30 * s, 0.02 * s), (0.42 * s, 0.02 * s)]]


def scene(t):
    cam = {
        "yaw": 0.50 * math.sin(t * 0.72) + 0.12 * t,
        "pitch": 0.19 * math.sin(t * 0.55 + 1.1),
        "roll": 0.05 * math.sin(t * 0.40),
        # fluid camera: pehle 4 s me eased push-in, phir breathing
        "zoom": SW * 0.185 * (1.0 + 0.40 * ease_out(clamp(t / 4.2, 0, 1)) + 0.045 * math.sin(t * 0.8)),
        "cx": SW / 2 + SS * 24 * math.sin(t * 0.5),
        "cy": SH * 0.285 + SS * 18 * math.cos(t * 0.42),
        "dist": 3.4,
    }
    # backdrop: 2-light gradient (bloom wali feeling) — low-res me bana ke upscale
    lw, lh = W // 2, H // 2
    gx = np.linspace(0, 1, lw)[None, :] ** 1.5
    arr = np.zeros((lh, lw, 3), dtype=np.float32)
    arr[..., 0], arr[..., 1], arr[..., 2] = (1 - gx) * 24, (1 - gx) * 72, (1 - gx) * 126
    arr += np.linspace(0, 1, lh)[:, None, None] * np.array([8, 6, 20], dtype=np.float32)
    base = Image.fromarray(np.clip(arr, 0, 255).astype("uint8")).resize((SW, SH), Image.BILINEAR).convert("RGBA")

    if t < 4.4:
        k = spring(clamp(t / 0.8, 0, 2))
        depth = 0.70 * (0.30 + 0.70 * min(1.0, k))
        layer, front = extrude(poly_hex(6, 0.86), depth, cam, (186, 214, 246))
        d = ImageDraw.Draw(layer)
        for seg in a_mark_lines(0.74):  # 1.0 karke A plate se bahar nikal raha tha
            p3 = np.array([[x, y, depth * 0.5 + 0.02] for x, y in seg])
            pp = project(p3, cam)
            d.line([(pp[0][0], pp[0][1]), (pp[1][0], pp[1][1])], fill=(246, 251, 255, 255), width=int(30 * SS))
    elif t < 7.8:
        ph = 1.0 + (t - 4.4) / 3.4 * 2.0
        layer, _ = extrude(blob_poly(ph) * 0.80, 0.46, cam, (156, 96, 226))
    else:
        layer, _ = extrude(poly_hex(6, 0.26), 0.26, cam, (70, 208, 244))

    f = Image.alpha_composite(base, layer)
    # bloom: ⅓-scale blur + ImageChops.screen. Pehle yahan np.int16 full-res arrays the
    # (2160×3840×4×2 = 133 MB × 3) → peak RSS 780 MB, aur render frame 317 par OOM-kill
    # ho gaya tha (python ka exit code `| tail` ne chupa diya, file 13.21 s par atki rahi).
    small = f.resize((SW // 3, SH // 3), Image.BILINEAR).filter(ImageFilter.GaussianBlur(9))
    glow = ImageChops.screen(f.convert("RGB"), small.resize((SW, SH), Image.BILINEAR).convert("RGB"))
    f = Image.blend(f.convert("RGB"), glow, 0.50).convert("RGBA")

    ov = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for i in range(7):  # foreground bokeh = depth ka feel
        px = SW * (0.10 + 0.13 * i + 0.05 * math.sin(t * 0.6 + i))
        py = SH * (0.60 + 0.30 * math.cos(t * 0.35 + i * 1.7))
        rad = SS * (14 + 8 * (i % 3))
        d.ellipse([px - rad, py - rad, px + rad, py + rad], fill=(120, 220, 255, 24))
    f = Image.alpha_composite(f, ov.filter(ImageFilter.GaussianBlur(3 * SS)))

    spans = [(1.0, 2.6, ["APEX", "MOTION"]), (2.6, 4.4, ["GFX", "ENGINE"]),
             (7.8, 9.2, ["MORPHING", "SHAPES"]), (9.2, 10.6, ["3D", "ELEMENTS"]),
             (10.6, 11.8, ["FLUID", "CAMERA"]), (11.8, 13.8, ["BINA", "AFTER EFFECTS"]),
             (13.8, 15.0, ["COMMENT", "\u201cAPEX\u201d"])]
    for t0, t1, ws in spans:
        if t0 <= t < t1:
            u = t - t0
            for i, w_ in enumerate(ws):
                k = spring(clamp((u - i * 0.12) / 0.38, 0, 2)) - 1.0
                img = eng.fit(eng.text_image(w_, 128 * SS, (242, 250, 255, 255)), maxw=SW - 70 * SS)
                sx, sy = eng.area_squash(k)
                im = img.resize((max(2, int(img.width * sx)), max(2, int(img.height * sy))), Image.LANCZOS)
                f.alpha_composite(im, (int(SW / 2 - im.width / 2), int(SH * (0.615 + i * 0.105) - im.height / 2)))
            if t1 == 15.0:
                sm = eng.text_image("phone ke andar · 0 GPU · 0 ₹", 40 * SS, (126, 240, 214, 255), bold=False)
                f.alpha_composite(sm, (int(SW / 2 - sm.width / 2), int(SH * 0.885)))
            break
    return f


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.environ.get("APEX_MG_SMOKE") == "1":
        for tt in (1.5, 3.2, 6.0, 8.4, 12.4, 14.4):
            scene(tt).resize((W, H), Image.LANCZOS).convert("RGB").save(f"/tmp/mg-{tt}.png")
            print(f"   smoke t={tt:5.1f} → /tmp/mg-{tt}.png", flush=True)
        return
    N = int(DUR * FPS)
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = OUT.rsplit(".", 1)[0] + ".wav"
    eng.DUR = DUR
    eng.make_audio(wav)
    # ⚠️ tmix=frames=3 ne 360 me se 43 frame khaa liye the (mp4 = 317 frame = 13.21 s, jabki
    #    render 15.0 s tha). frames=2 = wahi jo reel engine use karta hai aur dur exact deta
    #    hai (41 s reel = 1230 frame verify). -shortest hatake -t DUR: length command se fix.
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-vf", "tmix=frames=2:weights=0.62 0.38",
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k", "-t", f"{DUR}", "-movflags", "+faststart", OUT]
    log = open("/tmp/mg-ff.log", "wb")
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
    for i in range(N):
        p.stdin.write(scene(i / FPS).resize((W, H), Image.LANCZOS).convert("RGB").tobytes())
        if i % 120 == 0:
            print(f"  frame {i}/{N} ({time_str(i)})", flush=True)
    p.stdin.close()
    p.wait()
    log.close()
    if p.returncode:
        print(open("/tmp/mg-ff.log", "rb").read().decode("utf8", "ignore")[-1200:])
        sys.exit("render fail")
    print("✅", OUT, os.path.getsize(OUT), "bytes")


def time_str(i):
    return f"{i / FPS:.1f}s"


if __name__ == "__main__":
    main()
