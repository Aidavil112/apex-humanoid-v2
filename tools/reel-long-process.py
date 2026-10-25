#!/usr/bin/env python3
"""🎬 APEX — LONG "PROCESS" REEL (41 second, 1080×1920, beat-synced audio).

Chhota version (12 s) me sirf hook tha; ye wala poora story batata hai — hook → kaise banta
hai (springs / word-pop / blur / frames) → auto post → comment funnel → ₹0 hosting → CTA.
Engine wahi tools/reel-render.py (koi duplicate nahi): sirf BEATS + DUR + palette override.

Engine ki layout had (tools/reel-render.py:render_frame se verify kiya):
  • hero  : line-1 168px, line-2 132px → 1080px me ~9 / ~11 character se zyada = kinare katre
  • type  : har word apni line, H*0.44 + i*132 → 6 words ke baad screen se bahar
  • count : label 50px + number 300px + progress bar → label lamba chalega, number nahi
Isliye neeche ke beats in had me rakhe gaye hain.

Run:  python3 tools/reel-long-process.py
Out:  /home/user/preview/APEX-MOTION-REEL-LONG.mp4
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_LONG_OUT", "/home/user/preview/APEX-MOTION-REEL-LONG.mp4")

sys.argv = ["reel-render", "--out", OUT]
spec = importlib.util.spec_from_file_location("apex_reel_engine", os.path.join(HERE, "reel-render.py"))
rr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rr)

rr.BG = [(74, 30, 150), (14, 92, 140), (150, 32, 110)]
rr.DUR = 41.0
rr.N = int(rr.FPS * rr.DUR)
rr.BEATS = [
    dict(kind="hero", lines=["SOYA HUA", "JAAGTA HUA"], sub="subah 5 baje · 3 post done", t0=0.0, t1=4.2),
    dict(kind="type", words=["1", "prompt", "→", "poora", "reel"], t0=4.2, t1=7.0),
    dict(kind="count", label="SPRING CURVES · AREA PRESERVING", a=0, b=42, t0=7.0, t1=9.6, fmt="{:.0f}"),
    dict(kind="type", words=["Word", "pop", "+", "real", "blur"], t0=9.6, t1=12.2),
    dict(kind="count", label="HD FRAMES · 1080×1920", a=0, b=1200, t0=12.2, t1=15.0, fmt="{:.0f}"),
    dict(kind="hero", lines=["AUTO", "POST"], sub="IG + FB + YT Shorts · 1 tap", t0=15.0, t1=18.4),
    dict(kind="count", label="PLATFORMS · 1 TAP ME", a=0, b=3, t0=18.4, t1=20.8, fmt="{:.0f}"),
    dict(kind="type", words=["Comment", "aaya", "→", "DM", "chala"], t0=20.8, t1=24.4),
    dict(kind="count", label="RAAT BHAR KE REPLIES", a=0, b=37, t0=24.4, t1=27.0, fmt="{:.0f}"),
    dict(kind="hero", lines=["₹0", "HOSTING"], sub="Worker + R2 · 0% compression", t0=27.0, t1=30.8),
    dict(kind="count", label="FREE R2 STORAGE · GB", a=0, b=10, t0=30.8, t1=33.0, fmt="{:.0f}"),
    dict(kind="type", words=["GPU", "nahi", "·", "editor", "nahi"], t0=33.0, t1=35.8),
    dict(kind="count", label="AGENTS · SAB JAAGTE HAIN", a=0, b=41, t0=35.8, t1=37.8, fmt="{:.0f}"),
    dict(kind="hero", lines=["COMMENT", "\u201cMOTION\u201d"], sub="6 step process, DM me", t0=37.8, t1=41.0),
]

print(f"🎬 long reel: {rr.N} frames ({rr.DUR:.0f}s) @ {rr.W}x{rr.H} → {OUT}", flush=True)
rr.main()
