#!/usr/bin/env python3
"""🧊 APEX 3D — asli 3D renderer (Blender/OpenGL nahi, isliye numba se likha gaya).

Sandbox me `blender`, `pyrender`, `moderngl`, `osmesa` — ek bhi NAHI (check kiya).
Jo HAI: numba + numpy + OpenCV + imageio-ffmpeg. To ye file ek chhota scanline
3D renderer khud implement karti hai:

  • geometry   : UV sphere, torus, box, extruded polygon (bevel ke saath) — triangles
  • camera     : look-at basis + perspective divide, roll/FOV/boom, eased keyframes
  • shading    : per-pixel normal interpolation (perspective-correct barycentric),
                 Lambert diffuse + Blinn-Phong spec + Fresnel rim (neon metal look)
  • z-buffer   : float32 depth test, 2× supersample → Lanczos downsample = AA
  • shadow     : scene ko light-dir se ground par project karke ¼-res mask + blur
  • bloom      : ⅓-scale Gaussian + screen blend
  • text       : tools/reel-render.py ke text_image/spring/fit/make_audio (duplicate nahi)

Jo SACCH me nahi hai (honest): global illumination, ray-traced reflections, refractive
glass, textured UV maps, subdivision surfaces, true DOF. Ye rasterized 3D hai — clean,
neon-shaded, "AE/C4D jaisa dikhta hai", par offline-renderer grade nahi.

Run:  python3 tools/motion-gfx3d.py
      APEX_3D_SMOKE=1 python3 tools/motion-gfx3d.py     → PNG frame, ffmpeg nahi
      APEX_3D_SECONDS=20 python3 tools/motion-gfx3d.py   → lamba
Out:  /home/user/preview/APEX-3D-REEL.mp4
"""
import importlib.util
import math
import os
import subprocess
import sys
import time

import cv2
import numpy as np
from numba import njit
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_3D_OUT", "/home/user/preview/APEX-3D-REEL.mp4")
FPS = 30
DUR = float(os.environ.get("APEX_3D_SECONDS", "16.0"))
SS = 2
W, H = 1080, 1920
SW, SH = W * SS, H * SS


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


eng = load("apex_engine_3d", os.path.join(HERE, "reel-render.py"))
spring, ease_out, clamp = eng.spring, eng.ease_out, eng.clamp

# ── geometry helpers ────────────────────────────────────────────────────────
def uv_sphere(rad=1.0, nu=72, nv=36):
    vs, fs = [], []
    for j in range(nv + 1):
        ph = math.pi * j / nv
        for i in range(nu):
            th = 2 * math.pi * i / nu
            vs.append([rad * math.sin(ph) * math.cos(th), rad * math.cos(ph), rad * math.sin(ph) * math.sin(th)])
    for j in range(nv):
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            fs.append([a, b, b + nu])
            fs.append([a, b + nu, a + nu])
    return np.array(vs, np.float32), np.array(fs, np.int32)


def torus(R=0.85, r=0.30, nu=96, nv=40):
    vs, fs = [], []
    for j in range(nv + 1):
        u = 2 * math.pi * j / nv
        for i in range(nu):
            v = 2 * math.pi * i / nu
            cx, cz = R * math.cos(u), R * math.sin(u)
            vs.append([cx + r * math.cos(v) * math.cos(u), r * math.sin(v), cz + r * math.cos(v) * math.sin(u)])
    for j in range(nv):
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            fs.append([a, b, b + nu])
            fs.append([a, b + nu, a + nu])
    V = np.array(vs, np.float32)
    # normals = direction from tube centre
    ctr = np.zeros_like(V)
    for j in range(nv + 1):
        u = 2 * math.pi * j / nv
        ctr[j * nu:(j + 1) * nu, 0] = R * math.cos(u)
        ctr[j * nu:(j + 1) * nu, 2] = R * math.sin(u)
    N = V - ctr
    N /= np.maximum(1e-6, np.linalg.norm(N, axis=1, keepdims=True))
    return V, np.array(fs, np.int32)


def box(w=1, h=1, d=1):
    x, y, z = w / 2, h / 2, d / 2
    V = np.array([[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
                  [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], np.float32)
    F = np.array([[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1],
                  [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]], np.int32)
    return V, F


def extrude(poly, depth=0.35, bevel=0.06):
    """2D outline → solid plate with front/back caps + side wall (bevel = inset cap)."""
    poly = np.asarray(poly, np.float32)
    n = len(poly)
    ctr = poly.mean(axis=0)
    inner = ctr + (poly - ctr) * (1.0 - bevel)
    rings = [poly, inner]
    V, F = [], []
    z = depth / 2
    # front: outer ring + inner ring (quad strip) + cap fan
    for k, zz in enumerate([z, z * 0.72, -z * 0.72, -z]):
        for p in (rings[0] if k in (0, 3) else rings[1] if k in (1, 2) else rings[0]):
            V.append([p[0], p[1], zz])
    V = np.array(V, np.float32)
    N = n * 4
    front_o, front_i, back_i, back_o = 0, n, 2 * n, 3 * n

    def add(a, b, c):
        F.append([a, b, c])

    for i in range(n):
        j = (i + 1) % n
        add(front_o + i, front_o + j, front_i + j)      # front annulus
        add(front_o + i, front_i + j, front_i + i)
        add(back_i + i, back_i + j, back_o + j)          # back annulus
        add(back_i + i, back_o + j, back_o + i)
        add(front_o + j, front_o + i, back_o + i)        # outer wall
        add(front_o + j, back_o + i, back_o + j)
        add(front_i + i, front_i + j, back_i + j)        # inner wall
        add(front_i + i, back_i + j, back_i + i)
        add(front_i + j, front_i + i, front_o + j)       # bevel front
        add(front_o + j, front_i + i, front_o + i)
        add(back_i + i, back_i + j, back_o + j)           # bevel back
        add(back_o + j, back_i + j, back_o + i)
    # caps (fans) — front outer polygon cover karne ke liye centre vertex
    c = len(V)
    V = np.vstack([V, np.array([[0, 0, z]], np.float32), np.array([[0, 0, -z]], np.float32)])
    for i in range(n):
        add(front_o + i, front_o + (i + 1) % n, c)
        add(back_o + (i + 1) % n, back_o + i, c + 1)
    return V, np.array(F, np.int32)


def hex_poly(r=1.0, n=6, rot=-math.pi / 2):
    return np.array([[r * math.cos(rot + i * 2 * math.pi / n), r * math.sin(rot + i * 2 * math.pi / n)] for i in range(n)], np.float32)


def star_poly(r=1.0, n=5, k=0.52, samples=90):
    th = np.linspace(0, 2 * math.pi, samples, endpoint=False)
    rr = r * (1.0 - (1.0 - k) * (0.5 + 0.5 * np.cos(n * th)))
    return np.stack([rr * np.cos(th - math.pi / 2), rr * np.sin(th - math.pi / 2)], axis=1).astype(np.float32)


def superell_poly(expo=0.62, r=1.0, samples=90):
    th = np.linspace(0, 2 * math.pi, samples, endpoint=False)
    d = (np.abs(np.cos(th)) ** (2 / expo) + np.abs(np.sin(th)) ** (2 / expo)) ** (-expo / 2)
    return np.stack([r * d * np.cos(th), r * d * np.sin(th)], axis=1).astype(np.float32)


def morph_poly(p):
    """superellipse ↔ hexagon ↔ star ka smooth blend (p 0..1)."""
    n = 90
    a = superell_poly(0.62, 1.0, n)
    th = np.linspace(0, 2 * math.pi, n, endpoint=False)
    hb = (1.0 / (0.86 + 0.16 * np.cos(6 * th)))[:, None] * np.stack([np.cos(th - math.pi / 2), np.sin(th - math.pi / 2)], axis=1)
    c = star_poly(1.0, 5, 0.52, n)
    seg = clamp(p, 0, 0.999999) * 2.0
    k = seg // 1.0
    f = ease_out(seg - k)
    A, B = (a, hb) if k < 1 else (hb, c)
    return (A * (1 - f) + B * f).astype(np.float32)


def fused(Vs, Fs, Ns=None):
    V = np.vstack(Vs)
    F = np.vstack([f + off for f, off in zip(Fs, np.cumsum([0] + [len(v) for v in Vs[:-1]])[: len(Fs)])])
    return V.astype(np.float32), F.astype(np.int32)


def face_normals(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    return (n / np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True))).astype(np.float32)


# ── the renderer (numba) ────────────────────────────────────────────────────
@njit(cache=True, fastmath=True)
def raster(Vc, Fn, Nc, FM, Ldir, scale, cx, cy, zbuf, img, mode, gmask, glow, iw, ih):
    """Vc: (N,3) camera-space (z>0 aage). Nc: (N,3) camera-space normals.
    FM: (M,10) per-face: base(3) tint(3) specPow specInt emis rimC.
    scale = focal in px, cx/cy = screen centre. mode 0=shade, 1=ground shadow mask."""
    nf = Fn.shape[0]
    # iw/ih call-site se aate hain: numba ko img 1-D flat buffer hai, uska .shape[1]
    # type-inference hi fail kar deta tha.
    for f in range(nf):
        i0 = Fn[f, 0]
        i1 = Fn[f, 1]
        i2 = Fn[f, 2]
        X0 = Vc[i0, 0]; Y0 = Vc[i0, 1]; Z0 = Vc[i0, 2]
        X1 = Vc[i1, 0]; Y1 = Vc[i1, 1]; Z1 = Vc[i1, 2]
        X2 = Vc[i2, 0]; Y2 = Vc[i2, 1]; Z2 = Vc[i2, 2]
        if Z0 < 0.05 or Z1 < 0.05 or Z2 < 0.05:
            continue
        u0 = cx + scale * X0 / Z0; v0 = cy - scale * Y0 / Z0
        u1 = cx + scale * X1 / Z1; v1 = cy - scale * Y1 / Z1
        u2 = cx + scale * X2 / Z2; v2 = cy - scale * Y2 / Z2
        area = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)
        if area > -0.75 and area < 0.75:
            continue
        bR = FM[f, 0]; bG = FM[f, 1]; bB = FM[f, 2]
        tR = FM[f, 3]; tG = FM[f, 4]; tB = FM[f, 5]
        spow = FM[f, 6]; spin = FM[f, 7]; emis = FM[f, 8]; rimc = FM[f, 9]
        # (culling nahi ki — meri winding har helper me consistent nahi hai, isliye
        # z-buffer hi decide karta kaun aage hai. Warna geometry gayab ho jaati.)
        ix0 = int(min(u0, u1, u2)) - 1
        ix1 = int(max(u0, u1, u2)) + 2
        iy0 = int(min(v0, v1, v2)) - 1
        iy1 = int(max(v0, v1, v2)) + 2
        if ix0 < 0: ix0 = 0
        if iy0 < 0: iy0 = 0
        if ix1 > iw: ix1 = iw
        if iy1 > ih: iy1 = ih
        inv_a = 1.0 / area
        w00 = Nc[i0, 0]; w01 = Nc[i0, 1]; w02 = Nc[i0, 2]
        w10 = Nc[i1, 0]; w11 = Nc[i1, 1]; w12 = Nc[i1, 2]
        w20 = Nc[i2, 0]; w21 = Nc[i2, 1]; w22 = Nc[i2, 2]
        iz0 = 1.0 / Z0; iz1 = 1.0 / Z1; iz2 = 1.0 / Z2
        for py in range(iy0, iy1):
            pcy = py + 0.5
            for px in range(ix0, ix1):
                pcx = px + 0.5
                c0 = ((u1 - pcx) * (v2 - pcy) - (u2 - pcx) * (v1 - pcy)) * inv_a
                c1 = ((u2 - pcx) * (v0 - pcy) - (u0 - pcx) * (v2 - pcy)) * inv_a
                c2 = 1.0 - c0 - c1
                if c0 < 0.0 or c1 < 0.0 or c2 < 0.0:
                    continue
                if mode == 1:
                    gmask[py * iw + px] = 1.0
                    continue
                izp = c0 * iz0 + c1 * iz1 + c2 * iz2
                zp = 1.0 / izp
                idx = py * iw + px
                if zp >= zbuf[idx]:
                    continue
                zbuf[idx] = zp
                px3 = (c0 * iz0 * X0 + c1 * iz1 * X1 + c2 * iz2 * X2) * zp
                py3 = (c0 * iz0 * Y0 + c1 * iz1 * Y1 + c2 * iz2 * Y2) * zp
                pz3 = (c0 * iz0 * Z0 + c1 * iz1 * Z1 + c2 * iz2 * Z2) * zp
                nx = (c0 * iz0 * w00 + c1 * iz1 * w10 + c2 * iz2 * w20) * zp
                ny = (c0 * iz0 * w01 + c1 * iz1 * w11 + c2 * iz2 * w21) * zp
                nz = (c0 * iz0 * w02 + c1 * iz1 * w12 + c2 * iz2 * w22) * zp
                nl = 1.0 / math.sqrt(nx * nx + ny * ny + nz * nz + 1e-9)
                nx *= nl; ny *= nl; nz *= nl
                dx = nx * Ldir[0] + ny * Ldir[1] + nz * Ldir[2]
                if dx < 0.0:
                    dx = 0.0
                vl = 1.0 / math.sqrt(px3 * px3 + py3 * py3 + pz3 * pz3 + 1e-9)
                vx = px3 * vl; vy = py3 * vl; vz = pz3 * vl
                # camera origin se surface ki taraf jaane wala vector P hai, isliye
                # face-on surface par n·v = -1. Pehle `1 - nz*vz` se har front face ka
                # rim 2.0 (max) ho jaata tha → poora frame safed. Sign theek kiya.
                nd = -(nx * vx + ny * vy + nz * vz)
                if nd < 0.0:
                    nd = 0.0
                if nd > 1.0:
                    nd = 1.0
                fr = 1.0 - nd
                fr = fr * fr * fr * rimc
                hx = Ldir[0] + vx; hy = Ldir[1] + vy; hz = Ldir[2] + vz
                hl = 1.0 / math.sqrt(hx * hx + hy * hy + hz * hz + 1e-9)
                sp = (nx * hx + ny * hy + nz * hz) * hl
                if sp < 0.0:
                    sp = 0.0
                sp = sp ** spow
                val = 0.12 + 0.62 * dx
                e = emis * 255.0 + glow
                r = bR * val + tR * spin * sp * 0.0016 + fr * tR * 0.85 + e
                g = bG * val + tG * spin * sp * 0.0016 + fr * tG * 0.85 + e
                b = bB * val + tB * spin * sp * 0.0016 + fr * tB * 0.85 + e
                o = idx * 3
                img[o] = r
                img[o + 1] = g
                img[o + 2] = b


def mat4_rot(x=0.0, y=0.0, z=0.0):
    """world-space rotation matrix (Rx then Ry then Rz order matter only visually)."""
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]], np.float32)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], np.float32)
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], np.float32)
    return (Rz @ Ry @ Rx).astype(np.float32)


def cam_basis(eye, target, roll, fov_deg):
    fwd = target - eye
    fwd = fwd / max(1e-6, float(np.linalg.norm(fwd)))
    up = np.array([0.0, 1.0, 0.0], np.float32)
    right = np.cross(fwd, up)
    right = right / max(1e-6, float(np.linalg.norm(right)))
    up2 = np.cross(right, fwd)
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        r2, u2 = right * c + up2 * s, up2 * c - right * s
        right, up2 = r2, u2
    R = np.stack([right, up2, fwd]).astype(np.float32)
    focal = (SH / 2.0) / math.tan(math.radians(fov_deg) / 2.0)
    return R, np.float32(focal)


def to_cam(V, eye, R):
    return (V - eye) @ R.T


def obj_from(V, F, M, T, FM):
    """FN = per-VERTEX normal (raster vertex index se pool karta hai — per-face deta to
    galat index / crash), flat shading se smooth shading behtar."""
    V = V.astype(np.float32)
    F = F.astype(np.int32)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    vn = np.zeros((len(V), 3), np.float32)
    for k in range(3):
        np.add.at(vn, F[:, k], fn)
    vn = vn / np.maximum(1e-9, np.linalg.norm(vn, axis=1, keepdims=True))
    return dict(V=V, F=F, FN=vn.astype(np.float32), M=M.astype(np.float32),
                T=T.astype(np.float32), FM=np.asarray(FM, np.float32))


def draw_scene(objs, eye, R, focal, light_cam, ground=-0.72, do_shadow=True, glow=0.0):
    zbuf = np.full(SH * SW, 1e9, np.float32)
    img = np.zeros(SH * SW * 3, np.float32)
    gmask = np.zeros(SH * SW, np.float32) if do_shadow else np.zeros(1, np.float32)
    Vc_all, Fn_all, Nc_all, FM_all, off = [], [], [], [], 0
    SV_all = []
    for o in objs:
        V = (o["V"] @ o["M"].T) + o["T"]
        N = o["FN"] @ o["M"].T
        N = N / np.maximum(1e-9, np.linalg.norm(N, axis=1, keepdims=True))
        p = to_cam(V, eye, R).astype(np.float32)
        nc = (N @ R.T).astype(np.float32)   # direction: translation cancel ho jaati hai
        F = o["F"] + off
        fm = np.tile(o["FM"], (len(F), 1)) if o["FM"].shape[0] == 1 else o["FM"]
        Vc_all.append(p); Fn_all.append(F.astype(np.int32)); Nc_all.append(nc); FM_all.append(fm.astype(np.float32))
        off += len(V)
        if do_shadow:
            L = light_cam.copy()
            L = L / max(1e-6, abs(L[1]))
            sv = V.copy()
            k = (sv[:, 1] - ground) / max(1e-6, -L[1])
            sv[:, 0] -= L[0] * k
            sv[:, 2] -= L[2] * k
            sv[:, 1] = ground + 0.004
            SV_all.append(to_cam(sv, eye, R).astype(np.float32))
    Vc = np.vstack(Vc_all); Fn = np.vstack(Fn_all); Nc = np.vstack(Nc_all); FM = np.vstack(FM_all)
    raster(Vc, Fn, Nc, FM, light_cam.astype(np.float32), float(focal), SW / 2.0, SH / 2.0,
           zbuf, img, 0, gmask, np.float32(glow), SW, SH)
    gm = None
    if do_shadow and SV_all:
        sv = np.vstack(SV_all)
        zbuf2 = np.zeros(SH * SW, np.float32)
        # mode=1 shading nahi karta, par raster bounds img.shape se leta hai → full-size
        # hi pass karo, warna bounding box 3 px me clamp ho ke shadow gayab.
        raster(sv, Fn, Nc, FM, light_cam.astype(np.float32), float(focal), SW / 2.0, SH / 2.0,
               zbuf2, np.zeros(SH * SW * 3, np.float32), 1, gmask, np.float32(0.0), SW, SH)
        gm = gmask
    return img.reshape(SH, SW, 3), gm


def bg_plate(t):
    """dark studio gradient — ½-res me bana ke upscale (full-res numpy math mehnga hai)."""
    lw, lh = SW // 2, SH // 2
    gx = np.linspace(0, 1, lw, dtype=np.float32).reshape(1, lw)
    gy = np.linspace(0, 1, lh, dtype=np.float32).reshape(lh, 1)
    a = np.zeros((lh, lw, 3), np.float32)
    a[..., 0] = 8 + 26 * gx * (1 - 0.55 * gy)
    a[..., 1] = 14 + 54 * gx * (1 - 0.5 * gy)
    a[..., 2] = 30 + 104 * gx * (1 - 0.45 * gy)
    a += (10 * (1 - gy) ** 2)[..., None]
    return np.array(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((SW, SH), Image.BILINEAR), np.float32)


def logo_mesh():
    """hex plate + uske upar ubhra hua 'A' (2 leg + crossbar) — EK hi transform me,
    isliye spin ke saath dono saath ghoomte hain. Returns (V,F) plate, (V,F) mark."""
    Vp, Fp = extrude(hex_poly(1.02), 0.30, 0.12)
    parts = []
    # leg ka angle: box ka top (0,+h/2) rotate karne par (-sinθ·h/2) khiskaata hai, isliye
    # LEFT leg ko NEGATIVE angle chahiye taaki dono legs upar mil ke 'A' banein
    # (pehle dono ulti taraf jhuk rahe the → frame me 'V' dikh raha tha).
    for w, h, px, py, ang in ((0.115, 1.10, -0.235, 0.06, -0.245), (0.115, 1.10, 0.235, 0.06, 0.245),
                              (0.46, 0.10, 0.0, -0.16, 0.0)):
        Vb, Fb = box(w, h, 0.16)
        Ml = mat4_rot(z=ang)
        parts.append(((Vb @ Ml.T) + np.array([px, py, -0.22], np.float32), Fb))  # -z = camera ki taraf
    # plate local z ±0.15 extrude hota hai aur camera world me z=-6 par hai, isliye
    # mark ko NEGATIVE z par rakhna hai warna wo plate ke Peehe chala jaata hai
    # (frame check me mark 100% invisible tha: cam z 5.69 vs plate front 5.17).
    Vm = np.vstack([pp[0] for pp in parts])
    Fm = np.vstack([pp[1] + off for pp, off in zip(parts, np.cumsum([0] + [len(pp[0]) for pp in parts[:-1]])[: len(parts)])])
    return Vp, Fp, Vm.astype(np.float32), Fm.astype(np.int32)


def scene(t):
    """0-5.4 hex plate + 3D 'A' · 5.4-9.2 morph solid + torus · 9.2-end sphere + EQ bars"""
    # turntable: pehle spin = 0.6*t tha → t=1.8 par 71° ghoom ke plate edge-on (ek slabs)
    # dikh rahi thi. Ab oscillating ±30°: front face hamesha padhne layak rehti hai.
    spin = 0.12 + 0.52 * math.sin(t * 0.55)
    # frame-check: morph+torus section (t 5.4-9.2) me object itna paas tha ki poora frame
    # bhar gaya aur torus ring screen se bahar. Camera ab section-ke-hisaab se door jaata hai.
    dsec = 5.95 if t < 5.4 else (7.45 if t < 9.2 else 6.95)
    dolly = dsec - 0.55 * ease_out(clamp(t / 5.0, 0, 1))
    eye = np.array([0.52 * math.sin(t * 0.28), 0.92 + 0.34 * math.sin(t * 0.35), -dolly], np.float32)
    target = np.array([0, 0.06, 0], np.float32)
    roll = 0.030 * math.sin(t * 0.4)
    R, focal = cam_basis(eye, target, roll, 33.0)
    light_w = np.array([0.40, 0.80, -0.48], np.float32)
    light_w /= np.linalg.norm(light_w)
    light_c = (light_w @ R.T).astype(np.float32)
    metal = [[62, 80, 104, 190, 224, 255, 46.0, 7200.0, 0.0, 0.42]]
    neon = [[20, 118, 158, 110, 236, 255, 30.0, 2600.0, 0.10, 0.80]]
    hot = [[46, 176, 214, 180, 255, 255, 24.0, 1500.0, 0.30, 0.55]]  # emissive brand mark
    objs = []
    if t < 5.4:
        V, F, V2, F2 = logo_mesh()
        M = mat4_rot(y=spin, x=0.26)
        T = np.array([0, 0.34, 0], np.float32)
        objs.append(obj_from(V, F, M, T, metal))
        objs.append(obj_from(V2, F2, M, T, hot))
    elif t < 9.2:
        ph = (t - 5.4) / 3.8
        V, F = extrude(morph_poly(ph) * 0.92, 0.30 + 0.14 * math.sin(ph * math.pi), 0.13)
        objs.append(obj_from(V, F, mat4_rot(y=spin * 0.8, x=0.22), np.array([0, 0.30, 0], np.float32), metal))
        Vt, Ft = torus(1.30, 0.048, 96, 22)
        objs.append(obj_from(Vt, Ft, mat4_rot(x=1.5708 + 0.18 * math.sin(t * 0.6)), np.array([0, 0.30, 0], np.float32), neon))
    else:
        Vs, Fs = uv_sphere(0.92, 64, 32)
        Ns = Vs / np.maximum(1e-6, np.linalg.norm(Vs, axis=1, keepdims=True))
        objs.append(obj_from(Vs, Fs, mat4_rot(y=spin * 0.35, x=0.12), np.array([0, 0.42, 0], np.float32), metal))
        for i in range(5):
            h = 0.16 + 0.46 * abs(math.sin(t * 1.25 + i * 0.75))
            Vb, Fb = box(0.15, h, 0.15)
            objs.append(obj_from(Vb, Fb, np.eye(3, dtype=np.float32),
                                 np.array([-0.85 + i * 0.43, -0.70 + h / 2, 0.85], np.float32), neon))
    img, gm = draw_scene(objs, eye, R, focal, light_c, ground=-0.72,
                         do_shadow=True, glow=0.0)
    return img + bg_plate(t), gm


SPANS = [(0.7, 2.6, ["APEX", "3D"]), (2.6, 4.6, ["REAL", "GEOMETRY"]),
         (5.6, 7.6, ["MORPH", "SOLID"]), (7.6, 9.2, ["TORUS", "RING"]),
         (9.6, 11.4, ["Z-BUFFER", "PHONG"]), (11.4, 13.4, ["BINA", "AFTER EFFECTS"]),
         (13.4, 16.0, ["COMMENT", "\u201cAPEX\u201d"])]


def overlay(f, t):
    strip = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    ImageDraw.Draw(strip).rectangle([0, int(SH * 0.635), SW, int(SH * 0.855)], fill=(4, 8, 14, 118))
    f = Image.alpha_composite(f, strip)
    for t0, t1, ws in SPANS:
        if t0 <= t < t1:
            u = t - t0
            for i, w_ in enumerate(ws):
                k = spring(clamp((u - i * 0.12) / 0.38, 0, 2)) - 1.0
                img = eng.fit(eng.text_image(w_, 118 * SS, (244, 250, 255, 255)), maxw=SW - 70 * SS)
                sx, sy = eng.area_squash(k)
                im = img.resize((max(2, int(img.width * sx)), max(2, int(img.height * sy))), Image.LANCZOS)
                f.alpha_composite(im, (int(SW / 2 - im.width / 2), int(SH * (0.685 + i * 0.10) - im.height / 2)))
            if t1 == 16.0:
                sm = eng.text_image("numba rasterizer · koi Blender nahi · ₹0", 34 * SS, (126, 240, 214, 255), bold=False)
                f.alpha_composite(sm, (int(SW / 2 - sm.width / 2), int(SH * 0.885)))
            break
    return f


def frame(t):
    img, gm = scene(t)
    a = np.clip(img, 0, 255).astype(np.uint8)
    if gm is not None and gm.any():
        m = (gm * 255).astype(np.uint8).reshape(SH, SW)
        m = cv2.GaussianBlur(m, (0, 0), 11)
        m = cv2.resize(m, (SW // 2, SH // 2), interpolation=cv2.INTER_AREA)
        m = cv2.resize(m, (SW, SH), interpolation=cv2.INTER_LINEAR)[..., None].astype(np.float32) / 255.0
        a = np.clip(a.astype(np.float32) * (1.0 - 0.40 * m), 0, 255).astype(np.uint8)
    im = Image.fromarray(a)
    small = im.resize((SW // 3, SH // 3), Image.BILINEAR).filter(ImageFilter.GaussianBlur(9))
    im = Image.blend(im, ImageChops.screen(im, small.resize((SW, SH), Image.BILINEAR)), 0.44)
    return overlay(im.convert("RGBA"), t).resize((W, H), Image.LANCZOS).convert("RGB")


def main():
    if os.environ.get("APEX_3D_SMOKE") == "1":
        import time as _t
        for tt in (1.8, 3.4, 6.4, 8.4, 10.5, 14.6):
            t0 = _t.time()
            frame(tt).save(f"/tmp/d-{tt}.png")
            print(f"   smoke t={tt:5.1f} {_t.time() - t0:.2f}s → /tmp/d-{tt}.png", flush=True)
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    N = int(DUR * FPS)
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    wav = OUT.rsplit(".", 1)[0] + ".wav"
    eng.DUR = DUR
    eng.make_audio(wav)
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", wav, "-vf", "tmix=frames=2:weights=0.62 0.38",
           "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-t", f"{DUR}", "-movflags", "+faststart", OUT]
    log = open("/tmp/d-ff.log", "wb")
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=log)
    import time as _t
    t0 = _t.time()
    for i in range(N):
        try:
            p.stdin.write(frame(i / FPS).tobytes())
        except BrokenPipeError:
            break
        if i % 60 == 0:
            el = _t.time() - t0
            print(f"  frame {i}/{N} · {el:.0f}s el · ~{el / max(1, i + 1) * (N - i):.0f}s left", flush=True)
    p.stdin.close()
    p.wait()
    log.close()
    if p.returncode:
        print(open("/tmp/d-ff.log", "rb").read().decode("utf8", "ignore")[-1500:])
        sys.exit("3D render fail")
    print("✅", OUT, os.path.getsize(OUT), "bytes", flush=True)


if __name__ == "__main__":
    main()
