import React, { useEffect, useRef } from 'react';

interface MotionGraphicsOverlayProps {
  mood: string;
  stage: 'closed' | 'standby' | 'listening' | 'thinking' | 'speaking';
  micLevel: number;
  themeAccent: [number, number, number];
}

interface FloatingMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alpha: number;
}

/**
 * 60 FPS GPU-Accelerated Holographic Motion Graphics Layer:
 * - Silky gyroscopic 3D orbital energy rings around the 3D Humanoid
 * - Smooth spring-damped audio-reactive sonar ripples & harmonic wave arcs
 * - Ambient floating quantum motes for an ultra-fluid, alive feel
 */
export const MotionGraphicsOverlay: React.FC<MotionGraphicsOverlayProps> = ({
  mood,
  stage,
  micLevel,
  themeAccent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ mood, stage, micLevel, themeAccent });
  stateRef.current = { mood, stage, micLevel, themeAccent };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let smoothEnergy = 0.15;
    let smoothR = themeAccent[0] * 255;
    let smoothG = themeAccent[1] * 255;
    let smoothB = themeAccent[2] * 255;

    const motes: FloatingMote[] = Array.from({ length: 34 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00028,
      vy: -0.00018 - Math.random() * 0.00038,
      size: 1.1 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.5,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (nowMs: number) => {
      const t = nowMs * 0.001;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const { stage: st, micLevel: lvl, themeAccent: acc } = stateRef.current;

      // Smooth color transition depending on voice stage & theme
      let targetR = acc[0] * 255;
      let targetG = acc[1] * 255;
      let targetB = acc[2] * 255;
      if (st === 'listening') {
        targetR = 0;
        targetG = 245;
        targetB = 185;
      } else if (st === 'thinking') {
        targetR = 168;
        targetG = 125;
        targetB = 255;
      } else if (st === 'speaking') {
        targetR = 79;
        targetG = 215;
        targetB = 255;
      }

      smoothR += (targetR - smoothR) * 0.07;
      smoothG += (targetG - smoothG) * 0.07;
      smoothB += (targetB - smoothB) * 0.07;

      const targetEnergy =
        st === 'speaking'
          ? 0.72 + Math.sin(t * 9.5) * 0.22
          : st === 'thinking'
          ? 0.55 + Math.sin(t * 5.0) * 0.15
          : st === 'listening'
          ? 0.26 + Math.min(0.7, lvl * 1.15)
          : 0.14;
      smoothEnergy += (targetEnergy - smoothEnergy) * 0.12;

      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.46;
      const baseR = Math.min(w, h) * 0.34;
      const rgb = `${Math.round(smoothR)}, ${Math.round(smoothG)}, ${Math.round(smoothB)}`;

      // 1. Soft Ambient Radial Aura Halo behind 3D Humanoid
      const grad = ctx.createRadialGradient(cx, cy, baseR * 0.12, cx, cy, baseR * (1.28 + smoothEnergy * 0.22));
      grad.addColorStop(0, `rgba(${rgb}, ${0.09 + smoothEnergy * 0.11})`);
      grad.addColorStop(0.55, `rgba(${rgb}, ${0.035 + smoothEnergy * 0.05})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // 2. Three Silky 3D Tilted Gyroscopic Orbital Rings
      const orbits = [
        { rx: baseR * 0.96, ry: baseR * 0.28, rot: t * 0.24, tilt: -0.22, dash: [14, 10], width: 1.25, alpha: 0.26 },
        { rx: baseR * 1.14, ry: baseR * 0.36, rot: -t * 0.18, tilt: 0.26, dash: [42, 22], width: 1.1, alpha: 0.19 },
        { rx: baseR * 0.78, ry: baseR * 0.2, rot: t * 0.36, tilt: 0.06, dash: [], width: 1.4, alpha: 0.22 },
      ];

      for (const orb of orbits) {
        ctx.save();
        ctx.translate(cx, cy + baseR * 0.22);
        ctx.rotate(orb.tilt + Math.sin(t * 0.4) * 0.04);
        ctx.setLineDash(orb.dash);
        ctx.lineDashOffset = -orb.rot * 120;
        ctx.strokeStyle = `rgba(${rgb}, ${orb.alpha + smoothEnergy * 0.18})`;
        ctx.lineWidth = orb.width;
        ctx.beginPath();
        ctx.ellipse(0, 0, orb.rx * (1 + smoothEnergy * 0.05), orb.ry * (1 + smoothEnergy * 0.08), 0, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting glowing node dot on each ring
        const nx = Math.cos(orb.rot * 2.2) * orb.rx * (1 + smoothEnergy * 0.05);
        const ny = Math.sin(orb.rot * 2.2) * orb.ry * (1 + smoothEnergy * 0.08);
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(${rgb}, 0.9)`;
        ctx.shadowColor = `rgba(${rgb}, 0.85)`;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(nx, ny, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Expanding Sonar Energy Ripples when Listening / Speaking / Thinking
      const rippleCount = 3;
      const speed = st === 'speaking' ? 0.85 : st === 'thinking' ? 0.65 : 0.42;
      for (let i = 0; i < rippleCount; i++) {
        const prog = (t * speed + i / rippleCount) % 1;
        const r = baseR * (0.45 + prog * (0.85 + smoothEnergy * 0.3));
        const a = (1 - prog) * (0.08 + smoothEnergy * 0.2);
        ctx.strokeStyle = `rgba(${rgb}, ${a.toFixed(3)})`;
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Smooth Horizon Audio Sine Ribbon near lower torso
      ctx.save();
      ctx.beginPath();
      const ribbonW = Math.min(w * 0.78, 520);
      const startX = cx - ribbonW * 0.5;
      const ribbonY = h * 0.77;
      for (let i = 0; i <= 64; i++) {
        const u = i / 64;
        const envelope = Math.sin(u * Math.PI);
        const wave =
          Math.sin(u * 12 + t * 5.2) * 0.6 +
          Math.sin(u * 21 - t * 7.8) * 0.4;
        const amp = (4 + smoothEnergy * 24) * envelope;
        const px = startX + u * ribbonW;
        const py = ribbonY + wave * amp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(${rgb}, ${0.24 + smoothEnergy * 0.42})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();

      // 5. Floating Quantum Light Motes
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy * (1 + smoothEnergy * 1.5);
        if (m.y < -0.04) {
          m.y = 1.04;
          m.x = Math.random();
        }
        if (m.x < -0.04) m.x = 1.04;
        if (m.x > 1.04) m.x = -0.04;

        const twinkle = 0.55 + 0.45 * Math.sin(t * 2.6 + m.phase);
        ctx.fillStyle = `rgba(${rgb}, ${(m.alpha * twinkle * (0.5 + smoothEnergy * 0.7)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-10 w-full h-full pointer-events-none"
    />
  );
};
