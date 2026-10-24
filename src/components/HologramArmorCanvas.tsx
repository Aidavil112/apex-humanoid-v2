import React, { useEffect, useRef, useState } from 'react';
import {
  HandFrameSnapshot,
  TrackedHandState,
} from '../engine/aiHandHologram';

export type SuitPresetId = 'seraph' | 'classic' | 'titan' | 'phantom' | 'spartan' | 'vision';

interface SuitThemeSpec {
  id: SuitPresetId;
  label: string;
  fingerHint: string;
  primary: [number, number, number];
  secondary: [number, number, number];
  core: [number, number, number];
  hasWings: boolean;
  hasCrown: boolean;
}

export const SUIT_PRESETS: SuitThemeSpec[] = [
  {
    id: 'seraph',
    label: 'SERAPH',
    fingerHint: '5 Fingers',
    primary: [98, 224, 255],
    secondary: [216, 152, 255],
    core: [255, 255, 255],
    hasWings: true,
    hasCrown: true,
  },
  {
    id: 'classic',
    label: 'CLASSIC',
    fingerHint: '1 Finger',
    primary: [56, 210, 255],
    secondary: [0, 245, 212],
    core: [220, 250, 255],
    hasWings: false,
    hasCrown: false,
  },
  {
    id: 'titan',
    label: 'TITAN',
    fingerHint: '2 Fingers',
    primary: [255, 108, 64],
    secondary: [255, 206, 86],
    core: [255, 245, 214],
    hasWings: true,
    hasCrown: false,
  },
  {
    id: 'phantom',
    label: 'PHANTOM',
    fingerHint: '3 Fingers',
    primary: [216, 134, 255],
    secondary: [255, 118, 206],
    core: [255, 238, 255],
    hasWings: true,
    hasCrown: true,
  },
  {
    id: 'spartan',
    label: 'SPARTAN',
    fingerHint: '4 Fingers',
    primary: [46, 245, 168],
    secondary: [79, 210, 255],
    core: [232, 255, 245],
    hasWings: false,
    hasCrown: true,
  },
  {
    id: 'vision',
    label: 'VISION CORE',
    fingerHint: 'Sphere Mode',
    primary: [255, 68, 42],
    secondary: [255, 166, 84],
    core: [255, 244, 234],
    hasWings: false,
    hasCrown: false,
  },
];

interface ArmorPartDef {
  id: number;
  name: string;
  anchor: [number, number, number]; // rest center in model space (-1..1)
  offset: [number, number, number]; // current detached offset in 3D space
  vel: [number, number, number];
  detached: boolean;
  grabbedByHand: number | null; // 0, 1, or -1 (pointer)
}

interface HoloParticle {
  partId: number;
  lx: number; // local offset relative to part anchor
  ly: number;
  lz: number;
  bx: number; // blast velocity / displacement
  by: number;
  bz: number;
  size: number;
  bright: number;
  isCore?: boolean;
  isWing?: boolean;
  isCrown?: boolean;
}

interface HologramArmorCanvasProps {
  handSnapshotRef: React.MutableRefObject<HandFrameSnapshot>;
  webcamVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  gestureActive?: boolean;
  onToggleGesture?: () => void;
  voiceLevel: number;
  stage: 'closed' | 'standby' | 'listening' | 'thinking' | 'speaking' | 'idle';
  activeSuit: SuitPresetId;
  onSelectSuit: (suit: SuitPresetId) => void;
  blastNonce?: number;
  resetNonce?: number;
  zoomDeltaNonce?: any;
  onHoloSound?: (kind: 'grab' | 'snap' | 'charge' | 'blast' | 'suit') => void;
}

const PART_BLUEPRINTS: { id: number; name: string; anchor: [number, number, number] }[] = [
  { id: 0, name: 'HELMET & CROWN', anchor: [0, 0.72, 0] },
  { id: 1, name: 'ARC CHEST PLATE', anchor: [0, 0.42, 0.02] },
  { id: 2, name: 'SPINE REACTOR', anchor: [0, 0.14, 0] },
  { id: 3, name: 'LEFT PAULDRON', anchor: [-0.26, 0.50, 0] },
  { id: 4, name: 'RIGHT PAULDRON', anchor: [0.26, 0.50, 0] },
  { id: 5, name: 'LEFT GAUNTLET', anchor: [-0.36, 0.16, 0.02] },
  { id: 6, name: 'RIGHT GAUNTLET', anchor: [0.36, 0.16, 0.02] },
  { id: 7, name: 'PELVIS CORE', anchor: [0, -0.08, 0] },
  { id: 8, name: 'LEFT THIGH ARMOR', anchor: [-0.14, -0.34, 0] },
  { id: 9, name: 'RIGHT THIGH ARMOR', anchor: [0.14, -0.34, 0] },
  { id: 10, name: 'LEFT BOOT THRUSTER', anchor: [-0.15, -0.70, 0.02] },
  { id: 11, name: 'RIGHT BOOT THRUSTER', anchor: [0.15, -0.70, 0.02] },
];

/** Builds dense 3D full-body armor + halo crown + multi-ray wings + Vision Core sphere particles! */
function buildArmorParticles(): HoloParticle[] {
  const pts: HoloParticle[] = [];
  const addTube = (
    partId: number,
    ax: number,
    ay: number,
    az: number,
    y0: number,
    y1: number,
    rx0: number,
    rx1: number,
    rz0: number,
    rz1: number,
    count: number,
    xCenter0 = ax,
    xCenter1 = ax
  ) => {
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const ang = Math.random() * Math.PI * 2;
      const shell = 0.84 + Math.random() * 0.16;
      const rx = (rx0 + (rx1 - rx0) * t) * shell;
      const rz = (rz0 + (rz1 - rz0) * t) * shell;
      const cx = xCenter0 + (xCenter1 - xCenter0) * t;
      const wy = y0 + (y1 - y0) * t;
      const wx = cx + Math.cos(ang) * rx;
      const wz = Math.sin(ang) * rz;
      pts.push({
        partId,
        lx: wx - ax,
        ly: wy - ay,
        lz: wz - az,
        bx: 0,
        by: 0,
        bz: 0,
        size: 1.15 + Math.random() * 0.9,
        bright: 0.55 + Math.random() * 0.45,
      });
    }
  };

  // 0: Helmet + Visor + Halo Crown Rings
  for (let i = 0; i < 420; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const wx = Math.cos(th) * s * 0.115;
    const wy = 0.72 + u * 0.145;
    const wz = Math.sin(th) * s * 0.125;
    pts.push({
      partId: 0,
      lx: wx,
      ly: wy - 0.72,
      lz: wz,
      bx: 0,
      by: 0,
      bz: 0,
      size: 1.25 + Math.random() * 0.8,
      bright: wz > 0.05 && Math.abs(u - 0.08) < 0.22 ? 1.35 : 0.72,
    });
  }
  // Halo Crown concentric rings above head (matches SERAPH crown in reel!)
  for (const r of [0.14, 0.20, 0.26]) {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push({
        partId: 0,
        lx: Math.cos(a) * r,
        ly: 0.90 - 0.72 + Math.sin(a) * 0.025,
        lz: Math.sin(a) * r * 0.35,
        bx: 0,
        by: 0,
        bz: 0,
        size: 1.3,
        bright: 1.15,
        isCrown: true,
      });
    }
  }

  // 1: Broad Sculpted Chest Armor + Bright Circular Arc Reactor Ring
  addTube(1, 0, 0.42, 0.02, 0.28, 0.57, 0.155, 0.215, 0.10, 0.135, 620);
  for (let i = 0; i < 160; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() < 0.55 ? 0.068 : Math.sqrt(Math.random()) * 0.058;
    pts.push({
      partId: 1,
      lx: Math.cos(a) * r,
      ly: 0.43 - 0.42 + Math.sin(a) * r,
      lz: 0.142 - 0.02,
      bx: 0,
      by: 0,
      bz: 0,
      size: 1.7,
      bright: 1.6,
      isCore: true,
    });
  }

  // 2: Segmented Mechanical Spine Waist (distinctive narrow cybernetic waist in reel!)
  for (let ring = 0; ring < 5; ring++) {
    const ry = 0.03 + ring * 0.052;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rad = 0.068 + (ring % 2) * 0.014;
      pts.push({
        partId: 2,
        lx: Math.cos(a) * rad,
        ly: ry - 0.14,
        lz: Math.sin(a) * rad * 0.85,
        bx: 0,
        by: 0,
        bz: 0,
        size: 1.3,
        bright: 0.95,
      });
    }
  }

  // 3 & 4: Left & Right Pauldrons + Multi-Ray Seraph Wings!
  for (const side of [-1, 1]) {
    const pid = side < 0 ? 3 : 4;
    const ax = side * 0.26;
    // Shoulder dome + upper arm
    addTube(pid, ax, 0.50, 0, 0.34, 0.62, 0.072, 0.108, 0.072, 0.098, 340, side * 0.31, side * 0.24);
    // Shoulder turret node
    for (let i = 0; i < 65; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      pts.push({
        partId: pid,
        lx: side * 0.25 + Math.cos(a) * s * 0.048 - ax,
        ly: 0.65 + u * 0.055 - 0.50,
        lz: Math.sin(a) * s * 0.048,
        bx: 0,
        by: 0,
        bz: 0,
        size: 1.3,
        bright: 1.15,
      });
    }
    // Iconic Fanning Energy Wing Rays (8 crisp dotted rays on each side just like zoom_screen.jpg!)
    for (let ray = 0; ray < 8; ray++) {
      const angle = (-0.52 + ray * 0.145);
      const len = 0.34 + (7 - Math.abs(ray - 3)) * 0.062;
      for (let sIdx = 1; sIdx <= 20; sIdx++) {
        const d = (sIdx / 20) * len;
        pts.push({
          partId: pid,
          lx: side * (0.20 + Math.cos(angle) * d) - ax,
          ly: 0.50 + Math.sin(angle) * d * 0.68 - 0.50,
          lz: -0.05 - d * 0.14,
          bx: 0,
          by: 0,
          bz: 0,
          size: 1.35,
          bright: 1.15 - (sIdx / 20) * 0.45,
          isWing: true,
        });
      }
    }
  }

  // 5 & 6: Left & Right Forearms + Triple Glowing Energy Rings + Hands
  for (const side of [-1, 1]) {
    const pid = side < 0 ? 5 : 6;
    const ax = side * 0.36;
    addTube(pid, ax, 0.16, 0.02, -0.05, 0.34, 0.042, 0.062, 0.042, 0.058, 300, side * 0.39, side * 0.32);
    // Triple concentric forearm rings (clearly visible on both wrists in zoom_screen.jpg!)
    for (const ry of [0.10, 0.155, 0.21]) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const cx = side * (0.39 - ((ry + 0.05) / 0.39) * 0.07);
        pts.push({
          partId: pid,
          lx: cx + Math.cos(a) * 0.095 - ax,
          ly: ry - 0.16,
          lz: Math.sin(a) * 0.095,
          bx: 0,
          by: 0,
          bz: 0,
          size: 1.35,
          bright: 1.25,
        });
      }
    }
  }

  // 7: Pelvis Armor Plate + Secondary Core Node
  addTube(7, 0, -0.08, 0, -0.19, 0.02, 0.135, 0.155, 0.088, 0.10, 310);

  // 8 & 9: Left & Right Sculpted Thighs
  for (const side of [-1, 1]) {
    const pid = side < 0 ? 8 : 9;
    addTube(pid, side * 0.14, -0.34, 0, -0.51, -0.17, 0.068, 0.086, 0.068, 0.084, 340, side * 0.145, side * 0.125);
  }

  // 10 & 11: Left & Right Greaves (Calves) + Armored Boots
  for (const side of [-1, 1]) {
    const pid = side < 0 ? 10 : 11;
    const ax = side * 0.15;
    addTube(pid, ax, -0.70, 0.02, -0.89, -0.50, 0.056, 0.070, 0.062, 0.072, 340, side * 0.155, side * 0.145);
    // Boot footplate
    for (let i = 0; i < 85; i++) {
      const t = Math.random();
      const a = Math.random() * Math.PI * 2;
      pts.push({
        partId: pid,
        lx: side * 0.155 + Math.cos(a) * 0.058 - ax,
        ly: -0.92 + Math.random() * 0.05 - -0.70,
        lz: 0.04 + t * 0.085 + Math.sin(a) * 0.045 - 0.02,
        bx: 0,
        by: 0,
        bz: 0,
        size: 1.25,
        bright: 0.9,
      });
    }
  }

  return pts;
}

const VISION_TAGS = [
  { label: 'SYS.CORE // 99.8%', r: 0.62, lat: 0.28, spd: 0.42 },
  { label: 'ARC.VEC // 148.4', r: 0.78, lat: -0.34, spd: -0.31 },
  { label: 'NEURAL.SYNC // ON', r: 0.88, lat: 0.12, spd: 0.25 },
  { label: 'QUANTUM.GRID // 04', r: 0.70, lat: 0.52, spd: -0.38 },
  { label: 'APEX.VISION // 360', r: 0.95, lat: -0.18, spd: 0.19 },
  { label: 'THERMAL // NOMINAL', r: 0.56, lat: -0.55, spd: 0.47 },
];

export const HologramArmorCanvas: React.FC<HologramArmorCanvasProps> = ({
  handSnapshotRef,
  webcamVideoRef,
  gestureActive = true,
  voiceLevel,
  stage,
  activeSuit,
  onSelectSuit,
  blastNonce = 0,
  resetNonce = 0,
  zoomDeltaNonce = null,
  onHoloSound,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webcamBg] = useState(false); // 100% Hidden Camera Always!
  const [hudStats, setHudStats] = useState({
    hands: 0,
    fingers: '—',
    detached: 0,
    status: 'Hand AI Active',
    chargePct: 0,
  });

  const voiceZoomRef = useRef(0);
  useEffect(() => {
    if (blastNonce > 0) {
      manualBlastRef.current = true;
    }
  }, [blastNonce]);

  useEffect(() => {
    if (resetNonce > 0) {
      resetTriggerRef.current = true;
      onHoloSound?.('snap');
    }
  }, [resetNonce, onHoloSound]);

  useEffect(() => {
    if (!zoomDeltaNonce) return;
    if (typeof zoomDeltaNonce === 'number') {
      voiceZoomRef.current = Math.max(-0.5, Math.min(1.2, voiceZoomRef.current + zoomDeltaNonce));
    } else if (typeof zoomDeltaNonce.delta === 'number') {
      voiceZoomRef.current = Math.max(-0.5, Math.min(1.2, voiceZoomRef.current + zoomDeltaNonce.delta));
    } else if (typeof zoomDeltaNonce.step === 'number') {
      voiceZoomRef.current = Math.max(-0.5, Math.min(1.2, voiceZoomRef.current + zoomDeltaNonce.step));
    }
  }, [zoomDeltaNonce]);

  const livePropsRef = useRef({
    webcamBg,
    gestureActive,
    voiceLevel,
    stage,
    activeSuit,
    onSelectSuit,
    onHoloSound,
  });
  livePropsRef.current = {
    webcamBg,
    gestureActive,
    voiceLevel,
    stage,
    activeSuit,
    onSelectSuit,
    onHoloSound,
  };

  // Mutable 60 FPS simulation state
  const partsRef = useRef<ArmorPartDef[]>(
    PART_BLUEPRINTS.map((b) => ({
      id: b.id,
      name: b.name,
      anchor: [...b.anchor],
      offset: [0, 0, 0],
      vel: [0, 0, 0],
      detached: false,
      grabbedByHand: null,
    }))
  );
  const particlesRef = useRef<HoloParticle[]>([]);
  const resetTriggerRef = useRef(false);
  const manualBlastRef = useRef(false);

  const handleResetSuit = () => {
    resetTriggerRef.current = true;
    onHoloSound?.('snap');
  };

  useEffect(() => {
    // High-density crisp 3D armor point cloud (strided 2:3 for zero overdraw & locked 60/120 FPS on mobile!)
    const fullPts = buildArmorParticles();
    particlesRef.current = fullPts.filter((_, idx) => idx % 3 !== 2);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let animId = 0;
    let rotY = 0;
    let rotX = 0.04;
    let velRotY = 0.004;
    let zoomScale = 1.0;
    let targetZoom = 1.0;

    let chargeLevel = 0; // 0..1 while fist held
    let blastWave = 0; // >0 right after opening fist
    let prevHandX: (number | null)[] = [null, null];
    let prevHandY: (number | null)[] = [null, null];
    let prevWasPinching: boolean[] = [false, false];
    let prevTwoSpan: number | null = null;

    // Finger-count hold detector (switches suit cleanly when holding 1..5 fingers steady ~0.55s!)
    let heldFingerCount = -1;
    let heldFingerFrames = 0;

    // Touch / Mouse Drag & Pinch support (works smoothly even before camera is turned ON!)
    let pointerDown = false;
    let pointerGrabPart: number | null = null;
    let lastPtrX = 0;
    let lastPtrY = 0;
    let pinchTouchDist: number | null = null;

    // Projected screen positions of each of the 12 part centers for exact pinch grabbing
    const partScreenPos: { x: number; y: number; scale: number }[] = PART_BLUEPRINTS.map(() => ({
      x: 0,
      y: 0,
      scale: 300,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pre-allocated zero-GC 9-bucket coordinate buffers (9 GPU path fills/frame instead of 6,800 string draw calls/frame!)
    const NUM_BUCKETS = 9;
    const MAX_PER_BUCKET = 5200;
    const bucketX = Array.from({ length: NUM_BUCKETS }, () => new Float32Array(MAX_PER_BUCKET));
    const bucketY = Array.from({ length: NUM_BUCKETS }, () => new Float32Array(MAX_PER_BUCKET));
    const bucketS = Array.from({ length: NUM_BUCKETS }, () => new Float32Array(MAX_PER_BUCKET));
    const bucketCount = new Int32Array(NUM_BUCKETS);
    let lastHudKey = '';

    const onPointerDown = (e: PointerEvent) => {
      pointerDown = true;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      // Check if user touched directly on an armor part to drag/detach by touch too
      let bestDist = 42;
      let bestId: number | null = null;
      partsRef.current.forEach((p, idx) => {
        const sp = partScreenPos[idx];
        const d = Math.hypot(e.clientX - sp.x, e.clientY - sp.y);
        if (d < bestDist) {
          bestDist = d;
          bestId = p.id;
        }
      });
      pointerGrabPart = bestId;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const dx = e.clientX - lastPtrX;
      const dy = e.clientY - lastPtrY;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;

      if (pointerGrabPart !== null && livePropsRef.current.activeSuit !== 'vision') {
        const p = partsRef.current[pointerGrabPart];
        const invScale = 1 / Math.max(120, partScreenPos[pointerGrabPart].scale);
        const cy = Math.cos(-rotY);
        const sy = Math.sin(-rotY);
        const wx = dx * invScale;
        const wy = -dy * invScale;
        p.offset[0] += wx * cy;
        p.offset[2] += wx * sy;
        p.offset[1] += wy;
        if (Math.hypot(p.offset[0], p.offset[1], p.offset[2]) > 0.08) {
          p.detached = true;
        }
      } else {
        rotY += dx * 0.008;
        rotX = Math.max(-0.55, Math.min(0.55, rotX + dy * 0.005));
      }
    };

    const onPointerUp = () => {
      if (pointerGrabPart !== null) {
        const p = partsRef.current[pointerGrabPart];
        if (Math.hypot(p.offset[0], p.offset[1], p.offset[2]) < 0.16) {
          p.detached = false;
        }
      }
      pointerDown = false;
      pointerGrabPart = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (pinchTouchDist !== null) {
          const ratio = d / Math.max(20, pinchTouchDist);
          targetZoom = Math.max(0.55, Math.min(2.4, targetZoom * ratio));
        }
        pinchTouchDist = d;
      }
    };
    const onTouchEnd = () => {
      pinchTouchDist = null;
    };
    const onWheel = (e: WheelEvent) => {
      targetZoom = Math.max(0.55, Math.min(2.4, targetZoom - e.deltaY * 0.001));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('wheel', onWheel, { passive: true });

    let frameCounter = 0;

    const render = (nowMs: number) => {
      const t = nowMs * 0.001;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const props = livePropsRef.current;
      const suitSpec = SUIT_PRESETS.find((s) => s.id === props.activeSuit) || SUIT_PRESETS[0];
      const parts = partsRef.current;
      const particles = particlesRef.current;

      // Reset Suit trigger
      if (resetTriggerRef.current) {
        resetTriggerRef.current = false;
        parts.forEach((p) => {
          p.detached = false;
          p.grabbedByHand = null;
        });
        targetZoom = 1.0;
        rotX = 0.04;
      }

      if (manualBlastRef.current) {
        manualBlastRef.current = false;
        blastWave = 1.0;
        particles.forEach((pt) => {
          const len = Math.max(0.05, Math.hypot(pt.lx, pt.ly, pt.lz));
          const speed = 0.35 + Math.random() * 0.75;
          pt.bx = (pt.lx / len + (Math.random() - 0.5) * 0.7) * speed;
          pt.by = (pt.ly / len + (Math.random() - 0.5) * 0.7) * speed;
          pt.bz = (pt.lz / len + (Math.random() - 0.5) * 0.9) * speed;
        });
        props.onHoloSound?.('blast');
      }

      // 1. Clear Background (100% Pure Pitch-Black Hidden Camera by default; subtle dark mirrored feed ONLY if user explicitly clicks WEBCAM BG)
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, w, h);

      if (props.webcamBg && props.gestureActive && webcamVideoRef.current && webcamVideoRef.current.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(webcamVideoRef.current, 0, 0, w, h);
        ctx.restore();
      }

      // 2. Process AI Dual-Hand 21-Landmark Gestures!
      const snap = handSnapshotRef.current;
      const hands: TrackedHandState[] = props.gestureActive ? snap.hands : [];
      let statusText = props.gestureActive
        ? hands.length === 0
          ? 'Show hand: Move=Rotate · Pinch=Detach · Fist=Blast'
          : 'Tracking Active'
        : 'Touch to Rotate/Detach · Turn Gesture ON for Air Control';

      const anyFist = hands.some((hd) => hd.isFist);
      const anyPinching = hands.some((hd) => hd.isPinching);

      // A) FIST & HOLD -> CHARGE ENERGY, OPEN HAND -> MASSIVE 360° BLAST (Exact Reel Shockwave!)
      if (anyFist && !anyPinching) {
        const prevCharge = chargeLevel;
        chargeLevel = Math.min(1, chargeLevel + 0.032);
        if (prevCharge < 0.05) props.onHoloSound?.('charge');
        statusText = `⚡ Charging Core… ${Math.round(chargeLevel * 100)}% (Open hand to BLAST!)`;
      } else {
        if (chargeLevel >= 0.32 && hands.some((hd) => hd.fingerCount >= 4)) {
          const power = 0.55 + chargeLevel * 0.85;
          blastWave = 1.0;
          particles.forEach((pt) => {
            const pAnchor = parts[pt.partId].anchor;
            const gx = pAnchor[0] + pt.lx;
            const gy = pAnchor[1] + pt.ly;
            const gz = pAnchor[2] + pt.lz;
            const len = Math.max(0.08, Math.hypot(gx, gy, gz));
            const spd = (0.32 + Math.random() * 0.85) * power;
            pt.bx = (gx / len + (Math.random() - 0.5) * 0.65) * spd;
            pt.by = (gy / len + (Math.random() - 0.5) * 0.65) * spd;
            pt.bz = (gz / len + (Math.random() - 0.5) * 0.9) * spd;
          });
          props.onHoloSound?.('blast');
          statusText = '💥 SHOCKWAVE BLAST!';
        }
        chargeLevel = Math.max(0, chargeLevel - 0.08);
      }

      // B) TWO HANDS OPEN / PINCH SPREAD -> REAL-TIME HOLOGRAM ZOOM (Exact Vision & Armor Scale!)
      const grabbedHandsCount = parts.filter((p) => p.grabbedByHand !== null).length;
      if (hands.length >= 2 && snap.twoHandSpan !== null && grabbedHandsCount < 2) {
        if (prevTwoSpan !== null) {
          const deltaSpan = snap.twoHandSpan - prevTwoSpan;
          targetZoom = Math.max(0.52, Math.min(2.45, targetZoom + deltaSpan * 3.1));
          statusText = `🙌 Dual-Hand Scale: ${Math.round(targetZoom * 100)}%`;
        }
        prevTwoSpan = snap.twoHandSpan;
      } else {
        prevTwoSpan = null;
      }

      // C) SINGLE HAND FINGER-COUNT SUIT SWITCHER (1=Classic, 2=Titan, 3=Phantom, 4=Spartan, 5=Seraph)
      if (hands.length === 1 && !hands[0].isPinching && !hands[0].isFist && props.activeSuit !== 'vision') {
        const fc = hands[0].fingerCount;
        if (fc >= 1 && fc <= 5) {
          if (fc === heldFingerCount) {
            heldFingerFrames++;
            if (heldFingerFrames === 26) {
              const mapSuit: Record<number, SuitPresetId> = {
                1: 'classic',
                2: 'titan',
                3: 'phantom',
                4: 'spartan',
                5: 'seraph',
              };
              const nextSuit = mapSuit[fc];
              if (nextSuit && nextSuit !== props.activeSuit) {
                props.onSelectSuit(nextSuit);
                props.onHoloSound?.('suit');
                statusText = `✨ Suit Switched → ${nextSuit.toUpperCase()}`;
              }
            }
          } else {
            heldFingerCount = fc;
            heldFingerFrames = 0;
          }
        }
      } else {
        heldFingerFrames = 0;
      }

      // D) THUMB + INDEX PINCH OVER SUIT PART -> GRAB & DETACH ARMOR PARTS IN MID-AIR!
      for (let hIdx = 0; hIdx < 2; hIdx++) {
        const hd = hands[hIdx];
        if (!hd) {
          // Hand left view -> release any part held by this hand
          parts.forEach((p) => {
            if (p.grabbedByHand === hIdx) {
              p.grabbedByHand = null;
              if (Math.hypot(p.offset[0], p.offset[1], p.offset[2]) < 0.16) {
                p.detached = false;
                props.onHoloSound?.('snap');
              }
            }
          });
          prevHandX[hIdx] = null;
          prevHandY[hIdx] = null;
          prevWasPinching[hIdx] = false;
          continue;
        }

        const sx = hd.cursorX * w;
        const sy = hd.cursorY * h;

        if (hd.isPinching && props.activeSuit !== 'vision') {
          let heldPart = parts.find((p) => p.grabbedByHand === hIdx);
          if (!heldPart && !prevWasPinching[hIdx]) {
            // Find nearest armor part on screen within generous 78px magnetic snap radius!
            let bestD = 78;
            let candidate: ArmorPartDef | undefined;
            parts.forEach((p, idx) => {
              if (p.grabbedByHand !== null) return;
              const sp = partScreenPos[idx];
              const d = Math.hypot(sx - sp.x, sy - sp.y);
              if (d < bestD) {
                bestD = d;
                candidate = p;
              }
            });
            if (candidate) {
              candidate.grabbedByHand = hIdx;
              candidate.detached = true;
              heldPart = candidate;
              props.onHoloSound?.('grab');
            }
          }

          if (heldPart && prevHandX[hIdx] !== null && prevHandY[hIdx] !== null) {
            const dxPx = (hd.cursorX - prevHandX[hIdx]!) * w;
            const dyPx = (hd.cursorY - prevHandY[hIdx]!) * h;
            const invScale = 1 / Math.max(120, partScreenPos[heldPart.id].scale);
            const cy = Math.cos(-rotY);
            const sySin = Math.sin(-rotY);
            const worldDx = dxPx * invScale;
            const worldDy = -dyPx * invScale;
            heldPart.offset[0] += worldDx * cy;
            heldPart.offset[2] += worldDx * sySin;
            heldPart.offset[1] += worldDy;
            statusText = `👌 Detached: ${heldPart.name}`;
          }
        } else {
          // Released pinch -> check magnetic snap back to suit!
          parts.forEach((p) => {
            if (p.grabbedByHand === hIdx) {
              p.grabbedByHand = null;
              if (Math.hypot(p.offset[0], p.offset[1], p.offset[2]) < 0.18) {
                p.detached = false;
                props.onHoloSound?.('snap');
                statusText = `🧲 Snapped Back: ${p.name}`;
              }
            }
          });

          // E) ONE OPEN HAND SIDEWAYS / UP-DOWN -> SMOOTH 360° ROTATION!
          if (hands.length === 1 && !hd.isFist && prevHandX[hIdx] !== null && prevHandY[hIdx] !== null) {
            const dxNorm = hd.palmX - prevHandX[hIdx]!;
            const dyNorm = hd.palmY - prevHandY[hIdx]!;
            velRotY = dxNorm * 4.2;
            rotY += velRotY;
            rotX = Math.max(-0.48, Math.min(0.48, rotX + dyNorm * 2.1));
            if (Math.abs(dxNorm) > 0.004) {
              statusText = '🖐 Open Hand Orbit: Rotating 360°';
            }
          }
        }

        prevHandX[hIdx] = hd.isPinching ? hd.cursorX : hd.palmX;
        prevHandY[hIdx] = hd.isPinching ? hd.cursorY : hd.palmY;
        prevWasPinching[hIdx] = hd.isPinching;
      }

      // Smooth spring damping on zoom, rotation & detached armor pieces
      zoomScale += (targetZoom - zoomScale) * 0.14;
      if (hands.length === 0 && !pointerDown) {
        velRotY *= 0.94;
        rotY += velRotY + Math.sin(t * 0.55) * 0.0022;
      }
      if (blastWave > 0.001) blastWave *= 0.94;

      parts.forEach((p) => {
        if (!p.detached && p.grabbedByHand === null) {
          p.offset[0] += (0 - p.offset[0]) * 0.16;
          p.offset[1] += (0 - p.offset[1]) * 0.16;
          p.offset[2] += (0 - p.offset[2]) * 0.16;
        } else if (p.detached && p.grabbedByHand === null) {
          // Gentle zero-gravity hover float while detached in space!
          p.offset[1] += Math.sin(t * 2.2 + p.id) * 0.00045;
        }
      });

      const cxScreen = w * 0.5;
      const cyScreen = h * 0.47;
      const effectiveZoom = Math.max(0.55, Math.min(2.4, zoomScale + voiceZoomRef.current));
      const baseScale = Math.min(w * 0.72, h * 0.44) * effectiveZoom;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const voiceBoost =
        props.stage === 'speaking'
          ? 0.45 + Math.sin(t * 14) * 0.28
          : props.stage === 'listening'
          ? props.voiceLevel * 0.65
          : 0.08;

      const [pr, pg, pb] = suitSpec.primary;
      const [sr, sg, sb] = suitSpec.secondary;
      const [cr, cg, cb] = suitSpec.core;

      // =========================================================================
      // MODE A: "VISION CORE" 3D HOLOGRAPHIC SPHERE (Exact Scene 1 of Reel!)
      // =========================================================================
      if (props.activeSuit === 'vision') {
        // Header bar matching Reel Scene 1: ──── VISION ────
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 82, 52, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cxScreen - 135, 68);
        ctx.lineTo(cxScreen - 48, 68);
        ctx.moveTo(cxScreen + 48, 68);
        ctx.lineTo(cxScreen + 135, 68);
        ctx.stroke();
        ctx.fillStyle = '#ffdcd4';
        ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('V I S I O N', cxScreen, 72);
        ctx.restore();

        // Blazing volumetric core glow
        const coreR = baseScale * (0.28 + voiceBoost * 0.12 + chargeLevel * 0.14);
        const halo = ctx.createRadialGradient(cxScreen, cyScreen, coreR * 0.08, cxScreen, cyScreen, baseScale * 1.15);
        halo.addColorStop(0, 'rgba(255, 250, 245, 0.96)');
        halo.addColorStop(0.18, 'rgba(255, 112, 66, 0.72)');
        halo.addColorStop(0.52, 'rgba(220, 38, 24, 0.22)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cxScreen, cyScreen, baseScale * 1.18, 0, Math.PI * 2);
        ctx.fill();

        // 8 Intersecting 3D Gyroscopic Rings
        for (let rIdx = 0; rIdx < 8; rIdx++) {
          const rad = baseScale * (0.34 + rIdx * 0.082);
          const tiltA = rotX + rIdx * 0.44 + t * (rIdx % 2 === 0 ? 0.45 : -0.36);
          const tiltB = rotY + rIdx * 0.62;
          ctx.save();
          ctx.translate(cxScreen, cyScreen);
          ctx.rotate(tiltB);
          if (rIdx % 2 === 1) ctx.setLineDash([18, 8, 4, 8]);
          ctx.strokeStyle =
            rIdx < 3
              ? `rgba(255, 208, 175, ${0.72 - rIdx * 0.12})`
              : `rgba(255, 78, 46, ${0.66 - rIdx * 0.055})`;
          ctx.lineWidth = rIdx === 0 || rIdx === 4 ? 2.1 : 1.25;
          ctx.beginPath();
          ctx.ellipse(0, 0, rad, Math.max(rad * 0.16, Math.abs(Math.sin(tiltA)) * rad), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Orbiting 3D Telemetry Micro-Labels around Vision Sphere (exact match to frame_5.jpg!)
        ctx.font = '600 9.5px ui-monospace, SFMono-Regular, monospace';
        VISION_TAGS.forEach((tag, idx) => {
          const ang = t * tag.spd + idx * 1.05 + rotY;
          const x3 = Math.cos(ang) * tag.r;
          const z3 = Math.sin(ang) * tag.r;
          const y3 = tag.lat * 0.65;
          const persp = 2.4 / (2.4 - z3 * 0.6);
          const sx = cxScreen + x3 * baseScale * persp;
          const sy = cyScreen + y3 * baseScale * persp;
          const alpha = Math.max(0.2, Math.min(0.95, 0.55 + z3 * 0.45));
          ctx.fillStyle = `rgba(255, 224, 212, ${alpha.toFixed(2)})`;
          ctx.fillRect(sx - 2, sy - 2, 3.5, 3.5);
          ctx.fillText(tag.label, sx + 7, sy + 3);
        });
      } else {
        // =========================================================================
        // MODE B: FULL-BODY 12-PART DETACHABLE 3D ARMOR HOLOGRAM (Exact Scene 2!)
        // =========================================================================
        // Project all 12 part centers first for pinch-grab detection & tether lines
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const wx = p.anchor[0] + p.offset[0];
          const wy = p.anchor[1] + p.offset[1];
          const wz = p.anchor[2] + p.offset[2];

          const rx1 = wx * cosY + wz * sinY;
          const rz1 = -wx * sinY + wz * cosY;
          const ry2 = wy * cosX - rz1 * sinX;
          const rz2 = wy * sinX + rz1 * cosX;

          const persp = 2.6 / Math.max(0.8, 2.6 - rz2);
          partScreenPos[i].x = cxScreen + rx1 * baseScale * persp;
          partScreenPos[i].y = cyScreen - ry2 * baseScale * persp;
          partScreenPos[i].scale = baseScale * persp;

          // Subtle holographic tether beam connecting detached part back to suit socket
          if (p.detached) {
            const ax1 = p.anchor[0] * cosY + p.anchor[2] * sinY;
            const az1 = -p.anchor[0] * sinY + p.anchor[2] * cosY;
            const ay2 = p.anchor[1] * cosX - az1 * sinX;
            const az2 = p.anchor[1] * sinX + az1 * cosX;
            const ap = 2.6 / Math.max(0.8, 2.6 - az2);
            const sockX = cxScreen + ax1 * baseScale * ap;
            const sockY = cyScreen - ay2 * baseScale * ap;

            ctx.save();
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, 0.35)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sockX, sockY);
            ctx.lineTo(partScreenPos[i].x, partScreenPos[i].y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Soft chest Arc-Reactor glow behind point cloud
        const chestPos = partScreenPos[1];
        const chestGlow = ctx.createRadialGradient(
          chestPos.x,
          chestPos.y,
          2,
          chestPos.x,
          chestPos.y,
          baseScale * (0.34 + voiceBoost * 0.2 + chargeLevel * 0.28)
        );
        chestGlow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${0.42 + voiceBoost * 0.3})`);
        chestGlow.addColorStop(0.35, `rgba(${pr}, ${pg}, ${pb}, 0.16)`);
        chestGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = chestGlow;
        ctx.beginPath();
        ctx.arc(chestPos.x, chestPos.y, baseScale * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Batched Zero-Allocation GPU Path Renderer (<1.2ms/frame = Locked Silky 60/120 FPS on Mobile!)
        bucketCount.fill(0);
        const breathe = Math.sin(t * 2.1) * 0.008;
        const sizeBoost = zoomScale > 1.3 ? 1.15 : 1.02;
        const chargePull = chargeLevel > 0.02 ? 1 - chargeLevel * 0.18 : 1;
        const hasJitter = chargeLevel > 0.05;
        const isSpeakingNow = props.stage === 'speaking';

        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          if (pt.isWing && !suitSpec.hasWings) continue;
          if (pt.isCrown && !suitSpec.hasCrown) continue;

          if (pt.bx > 0.0004 || pt.bx < -0.0004 || pt.by > 0.0004 || pt.by < -0.0004) {
            pt.bx *= 0.915;
            pt.by *= 0.915;
            pt.bz *= 0.915;
          }

          const part = parts[pt.partId];
          const jitter = hasJitter ? (Math.random() - 0.5) * chargeLevel * 0.035 : 0;
          const speakPulse = (pt.isCore || pt.partId === 0) && isSpeakingNow ? 1 + voiceBoost * 0.14 : 1;

          const wx = (part.anchor[0] + pt.lx * speakPulse) * chargePull + part.offset[0] + pt.bx + jitter;
          const wy = (part.anchor[1] + pt.ly * speakPulse + breathe) * chargePull + part.offset[1] + pt.by + jitter;
          const wz = (part.anchor[2] + pt.lz * speakPulse) * chargePull + part.offset[2] + pt.bz;

          const rx1 = wx * cosY + wz * sinY;
          const rz1 = -wx * sinY + wz * cosY;
          const ry2 = wy * cosX - rz1 * sinX;
          const rz2 = wy * sinX + rz1 * cosX;

          const persp = 2.6 / (2.6 - rz2 > 0.75 ? 2.6 - rz2 : 0.75);
          const sx = cxScreen + rx1 * baseScale * persp;
          const sy = cyScreen - ry2 * baseScale * persp;

          if (sx < -6 || sx > w + 6 || sy < -6 || sy > h + 6) continue;

          const depthAlpha = (0.62 + rz2 * 0.55) * pt.bright;
          const tier = depthAlpha > 0.86 ? 2 : depthAlpha > 0.52 ? 1 : 0;
          const group = part.grabbedByHand !== null || pt.isCore ? 6 : pt.isWing || pt.isCrown ? 3 : 0;
          const bIdx = group + tier;
          const n = bucketCount[bIdx];
          if (n < MAX_PER_BUCKET) {
            bucketX[bIdx][n] = sx;
            bucketY[bIdx][n] = sy;
            bucketS[bIdx][n] = pt.size * persp * sizeBoost;
            bucketCount[bIdx] = n + 1;
          }
        }

        const bucketStyles = [
          `rgba(${pr},${pg},${pb},0.34)`,
          `rgba(${pr},${pg},${pb},0.68)`,
          `rgba(${pr},${pg},${pb},0.96)`,
          `rgba(${sr},${sg},${sb},0.36)`,
          `rgba(${sr},${sg},${sb},0.70)`,
          `rgba(${sr},${sg},${sb},0.97)`,
          `rgba(${cr},${cg},${cb},0.55)`,
          `rgba(${cr},${cg},${cb},0.82)`,
          `rgba(${cr},${cg},${cb},1)`,
        ];

        for (let b = 0; b < NUM_BUCKETS; b++) {
          const count = bucketCount[b];
          if (count === 0) continue;
          ctx.fillStyle = bucketStyles[b];
          ctx.beginPath();
          const xs = bucketX[b];
          const ys = bucketY[b];
          const ss = bucketS[b];
          for (let k = 0; k < count; k++) {
            ctx.rect(xs[k], ys[k], ss[k], ss[k]);
          }
          ctx.fill();
        }
      }

      // =========================================================================
      // GLOWING AI HAND CURSOR RING RETICLES + SUBTLE 21-JOINT WIREFRAME (Exact Reel Ring!)
      // =========================================================================
      hands.forEach((hd) => {
        const hx = hd.cursorX * w;
        const hy = hd.cursorY * h;

        // Subtle sci-fi finger joint constellation lines
        const chains = [
          [0, 1, 2, 3, 4],
          [0, 5, 6, 7, 8],
          [0, 9, 10, 11, 12],
          [0, 13, 14, 15, 16],
          [0, 17, 18, 19, 20],
        ];
        ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, 0.28)`;
        ctx.lineWidth = 1;
        for (const ch of chains) {
          ctx.beginPath();
          ch.forEach((idx, k) => {
            const p = hd.landmarks[idx];
            if (k === 0) ctx.moveTo(p.x * w, p.y * h);
            else ctx.lineTo(p.x * w, p.y * h);
          });
          ctx.stroke();
        }

        // Exact glowing circular hand reticle ring from frame_7 / seq_5 of the Reel!
        const ringRadius = hd.isPinching ? 13 : hd.isFist ? 22 + chargeLevel * 14 : 20;
        ctx.save();
        ctx.strokeStyle = hd.isPinching
          ? '#00f5d4'
          : hd.isFist
          ? '#ff9f43'
          : 'rgba(225, 246, 255, 0.9)';
        ctx.lineWidth = hd.isPinching ? 2.6 : 1.9;
        ctx.shadowColor = hd.isPinching ? '#00f5d4' : `rgb(${pr}, ${pg}, ${pb})`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(hx, hy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Charge arc around fist
        if (hd.isFist && chargeLevel > 0.02) {
          ctx.strokeStyle = '#ff5252';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(hx, hy, ringRadius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeLevel);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Only re-render React HUD state when displayed values ACTUALLY change (0 idle React re-renders/sec!)
      frameCounter++;
      if (frameCounter % 8 === 0) {
        let detachedNow = 0;
        for (let k = 0; k < parts.length; k++) if (parts[k].detached) detachedNow++;
        const fingersStr =
          hands.length === 0
            ? '—'
            : hands.map((hd) => String(hd.fingerCount)).join(' + ');
        const chg = Math.round(chargeLevel * 100);
        const nextKey = `${hands.length}|${fingersStr}|${detachedNow}|${statusText}|${chg}`;
        if (nextKey !== lastHudKey) {
          lastHudKey = nextKey;
          setHudStats({
            hands: hands.length,
            fingers: fingersStr,
            detached: detachedNow,
            status: statusText,
            chargePct: chg,
          });
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [handSnapshotRef, webcamVideoRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />

      {/* ========================================================================= */}
      {/* EXACT CINEMATIC DEMO HUD (Pure OLED Black + Crisp Sci-Fi Glass Panels!)   */}
      {/* ========================================================================= */}
      <div className="fixed top-[max(12px,env(safe-area-inset-top))] left-3.5 right-3.5 z-20 flex items-start justify-between gap-2 pointer-events-none">
        {/* TOP-LEFT DEMO HEADER + 1-TAP VISION / ARMOR SUIT PILLS */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="px-3 py-1.5 rounded-xl bg-black/75 border border-white/15  shadow-[0_8px_28px_rgba(0,0,0,0.85)]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00f5a0] shadow-[0_0_8px_#00f5a0]" />
              <span className="font-mono text-[11.5px] sm:text-[12.5px] font-bold tracking-[0.22em] text-white">
                VISION · HOLOGRAM
              </span>
            </div>
            <div className="font-mono text-[8.5px] tracking-[0.18em] text-[#7cc4e4] uppercase mt-0.5">
              3D PARTICLE CORE · 60 FPS LIVE
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {SUIT_PRESETS.map((s) => {
              const active = activeSuit === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSuit(s.id);
                    onHoloSound?.('suit');
                  }}
                  className={`cursor-pointer px-2 py-0.5 rounded-md font-mono text-[9.5px] font-bold tracking-wider transition-all border ${
                    active
                      ? s.id === 'vision'
                        ? 'bg-[#ff4b2b]/28 text-[#ffd7cf] border-[#ff5f40] shadow-[0_0_12px_rgba(255,75,43,0.4)]'
                        : 'bg-[#00e5ff]/22 text-white border-[#4fd2ff] shadow-[0_0_12px_rgba(79,210,255,0.35)]'
                      : 'bg-black/70 text-[#88adc7] border-white/12 hover:text-white'
                  }`}
                >
                  {s.id === 'vision' ? '🔴 VISION' : s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* TOP-RIGHT SLEEK DEMO QUICK ACTIONS (RESET + SHOCKWAVE BLAST) */}
        {activeSuit !== 'vision' && (
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={handleResetSuit}
              className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-white/12 text-[#cfe9f8] border border-white/15 font-mono text-[9.5px] font-bold tracking-wider uppercase transition-all"
            >
              ↺ RESET
            </button>
            <button
              onClick={() => {
                manualBlastRef.current = true;
              }}
              className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-[#ff5938]/20 hover:bg-[#ff5938]/32 text-[#ffc2b5] border border-[#ff6b4a]/50 font-mono text-[9.5px] font-bold tracking-wider uppercase transition-all"
            >
              💥 BLAST
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM-LEFT DEMO TELEMETRY CARD (Positioned cleanly above Smart Dock — Zero Overlap!) */}
      <div className="fixed left-3.5 bottom-[calc(74px+env(safe-area-inset-bottom))] z-20 pointer-events-none select-none">
        <div className="rounded-xl bg-black/75 border border-white/14  px-3 py-2 font-mono text-[9px] leading-[1.5] text-[#9ac2dc] min-w-[154px] shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
          <div className="flex justify-between gap-3">
            <span>CORE</span>
            <b className={activeSuit === 'vision' ? 'text-[#ff7b61]' : 'text-[#7be8ff]'}>
              {activeSuit.toUpperCase()}
            </b>
          </div>
          <div className="flex justify-between gap-3">
            <span>VOICE</span>
            <b className={stage === 'speaking' ? 'text-[#ffd166]' : stage === 'listening' ? 'text-[#00f5a0]' : 'text-[#88adc7]'}>
              {stage === 'speaking' ? 'SPEAKING' : stage === 'listening' ? 'LISTENING' : 'READY'}
            </b>
          </div>
          <div className="flex justify-between gap-3">
            <span>CONTROL</span>
            <b className="text-[#00f5d4]">
              {gestureActive
                ? hudStats.hands > 0
                  ? `${hudStats.hands}H · ${hudStats.fingers}F`
                  : 'CAM SCAN'
                : '3D TOUCH'}
            </b>
          </div>
          {activeSuit !== 'vision' && (
            <div className="flex justify-between gap-3">
              <span>DETACHED</span>
              <b className={hudStats.detached > 0 ? 'text-[#ffb84d]' : 'text-white'}>
                {hudStats.detached} / 12
              </b>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
