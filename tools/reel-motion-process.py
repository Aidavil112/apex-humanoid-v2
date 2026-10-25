#!/usr/bin/env python3
"""🎬 APEX "MOTION PROCESS" REEL — @uiuxnikk style kinetic-typography reel, rendered here.

Reference (25/10/2026): instagram.com/reel/Dd5zI2cyBKC — "Comment “motion” i'll send you
the process", 10.7K likes / 4.5K comments. Wo format = 12 second me *process* dikhata hai
(prompt → curves → blur → frames) aur last beat comment-funnel maangta hai.

Ye driver tools/reel-render.py ko module ki tarah load karke sirf BEATS + palette badalta hai
(koi duplicate engine nahi — ek hi renderer, do script). 12.0s @ 30fps = 360 frames.

Run:  python3 tools/reel-motion-process.py
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "reel-render.py")
OUT = os.environ.get("APEX_REEL_OUT", "/home/user/preview/APEX-MOTION-REEL.mp4")

sys.argv = ["reel-render", "--out", OUT]
spec = importlib.util.spec_from_file_location("apex_reel_engine", ENGINE)
rr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rr)

# 12.0s hi rakha hai — make_audio isi DUR/N ko follow karta hai, warna -shortest video kaat deta.
rr.BG = [(36, 128, 226), (126, 44, 214), (222, 46, 128)]  # neon indigo→cyan→magenta (mograph look)
rr.BEATS = [
    dict(kind="hero", lines=["1 PROMPT", "1 REEL"], sub="motion process · phone ke andar", t0=0.0, t1=2.3),
    dict(kind="type", words=["Prompt", "likho", "→", "script", "khud"], t0=2.3, t1=4.0),
    dict(kind="count", label="SPRING CURVES TUNED", a=0, b=42, t0=4.0, t1=5.7, fmt="{:.0f}"),
    dict(kind="type", words=["Word", "pop", "+", "motion", "blur"], t0=5.7, t1=7.4),
    dict(kind="count", label="HD FRAMES RENDERED", a=0, b=360, t0=7.4, t1=9.1, fmt="{:.0f}"),
    dict(kind="type", words=["Comment", "\u201cMOTION\u201d", "→", "DM", "khud"], t0=9.1, t1=10.6),
    dict(kind="hero", lines=["\u20b90", "GPU NAHI"], sub="0% compression · isi app me", t0=10.6, t1=12.0),
]
rr.DUR = 12.0
rr.N = int(rr.FPS * rr.DUR)

print(f"🎬 rendering {rr.N} frames @ {rr.W}x{rr.H} → {OUT}", flush=True)
rr.main()
