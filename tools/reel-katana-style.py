#!/usr/bin/env python3
"""🪓 "KATANA-STYLE" REEL — usi copywriting formula me jo FB reel 1Eu6rUL3V7 use karta hai.

Reference (25/10/2026, Ai.Akshu, 32K views / 387 reactions / 279 comments) ka structure,
r.jina.ai se caption utha ke verify kiya:
  1) CTA-first hook : "Comment “KATANA” and I'll send you the setup link + 3-day free trial"
  2) Shock line     : "HOLY SH*T. I created these motion graphics without even opening After Effects"
  3) Product intro  : "Meet Higgsfield KATANA. Describe your animation to Claude…"
  4) Feature list   : "Kinetic typography. Morphing shapes. 3D elements. Fluid camera movements."
  5) OLD vs NEW     : "Old workflow: Layers → Keyframes → Graph Editor → Render"
                      "New workflow: Prompt → Generate → Render"   ← sabse strong device
  6) One-liner      : "One prompt. From the first idea to the final frame."
  7) CTA dobara     : comment keyword + brand + hashtags

Ye script usi 7-part beat me APEX ka version banati hai, aur 5 ke liye **background hi
badal deti hai** (purana = laal-kaala, naya = teal) — tools/reel-chapters.py se (shared).
Honest note: reference "3D elements / fluid camera" claim karta hai; hamare engine me wo
nahi hai, isliye ye reel sirf jo actually banta hai wahi dikhati hai (kinetic type,
springs, word-pop, motion blur, counters, logo sting, auto-post).

Run:  python3 tools/reel-katana-style.py           (render ~60 s ka, ~2 min)
      APEX_SMOKE=1 python3 tools/reel-katana-style.py   → sirf 1-1 frame PNG
Out:  /home/user/preview/APEX-KATANA-STYLE.mp4
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("APEX_KATANA_OUT", "/home/user/preview/APEX-KATANA-STYLE.mp4")


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


sys.path.insert(0, HERE)
chapters_lib = load("apex_chapters", os.path.join(HERE, "reel-chapters.py"))
rr = load("apex_engine_katana", os.path.join(HERE, "reel-render.py"))
os.environ["APEX_LOGO_LIB"] = "1"
ll = load("apex_logo_lib_katana", os.path.join(HERE, "reel-logo-reveal.py"))

# brand colour = black + cyan (inkable colour yahi change karke poora reel recolor)
CH = [
    dict(name="hook", base=(8, 9, 16), blobs=[(24, 110, 190), (96, 34, 180), (0, 150, 170)],
         gain=1.35, logo=True, beats=[
             ("hero", ["COMMENT", "\u201cAPEX\u201d"], "setup link + free APK, DM me", 6.5),
             ("hero", ["BINA", "AFTER EFFECTS"], "motion graphics · phone ke andar", 6.0)]),
    dict(name="intro", base=(14, 10, 30), blobs=[(74, 30, 150), (14, 92, 140), (150, 32, 110)],
         gain=1.35, beats=[
             ("type", ["Meet", "APEX", "Motion", "Forge"], 5.5),
             ("type", ["Prompt", "do", "→", "motion", "graphics"], 5.5)]),
    dict(name="features", base=(6, 14, 34), blobs=[(10, 90, 170), (70, 20, 160), (0, 170, 150)],
         gain=1.30, beats=[
             ("type", ["Kinetic", "type", "·", "springs", "·", "blur"], 5.0),
             ("count", "SPRING CURVES PER WORD", 0, 42, 5.0)]),
    dict(name="old", base=(22, 6, 8), blobs=[(160, 26, 40), (70, 14, 90), (190, 80, 20)],
         gain=1.30, beats=[
             ("hero", ["PURANA", "TAREEKA"], "After Effects + GPU + ₹ subscription", 5.0),
             ("type", ["Layers", "→", "Keyframes", "→", "Graph"], 5.5)]),
    dict(name="new", base=(4, 20, 20), blobs=[(10, 130, 120), (28, 92, 190), (60, 200, 150)],
         gain=1.35, beats=[
             ("hero", ["NAYA", "TAREEKA"], "1 line prompt · render · post", 5.0),
             ("type", ["Prompt", "→", "Generate", "→", "Post"], 5.0),
             ("hero", ["EK", "PROMPT"], "soch se final frame tak", 6.0)]),
    dict(name="cta", base=(8, 9, 16), blobs=[(24, 110, 190), (96, 34, 180), (0, 150, 170)],
         gain=1.35, logo=True, beats=[
             ("count", "PLATFORMS · 1 TAP ME", 0, 3, 5.0),
             ("hero", ["COMMENT", "\u201cAPEX\u201d"], "APK + 6 step process, DM me", 6.0)]),
]

DUR = chapters_lib.install(rr, CH, logo_img=ll.LOGO)
print(f"🪓 KATANA-style: {rr.N} frames / {DUR:.1f}s / {len(CH)} chapter → {OUT}", flush=True)
for c in CH:
    print(f"   • {c['name']:<9} {c['t0']:6.1f}s → {c['t1']:6.1f}s  ({c['t1'] - c['t0']:.1f}s, {len(c['beats'])} beat)", flush=True)

if os.environ.get("APEX_SMOKE") == "1":
    chapters_lib.smoke(rr, CH, tag="kat")
    raise SystemExit(0)

sys.argv = ["reel-render", "--out", OUT]
rr.main()
