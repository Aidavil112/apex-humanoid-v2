import React from 'react';
import { MoodType, SentimentResult } from '../types';

interface HudOverlayProps {
  mood: MoodType;
  fps: number;
  points: number;
  gestureActive: boolean;
  gestureCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  showHint: boolean;
  themeAccent: [number, number, number];
  sentiment?: SentimentResult | null;
  heartRate?: number;
  heartPulse?: number;
  isElevated?: boolean;
}

const MOOD_COLORS: Record<MoodType, string> = {
  idle: '#4fd2ff',
  listening: '#4fd2ff',
  thinking: '#ffb329',
  speaking: '#ff6b38',
  happy: '#ffd13b',
  excited: '#ff7a18',
  sad: '#5b82ff',
  angry: '#ff3322',
  surprised: '#f04aff',
  calm: '#29f0aa',
  neutral: '#b0d6f5',
};

export const HudOverlay: React.FC<HudOverlayProps> = ({
  mood,
  fps,
  points,
  gestureActive,
  gestureCanvasRef,
  showHint,
  themeAccent,
  sentiment,
  heartRate = 72,
  heartPulse = 0,
  isElevated = false,
}) => {
  const accentColor = `rgb(${themeAccent.map((v) => Math.round(v * 255)).join(',')})`;
  const moodColor = MOOD_COLORS[mood] || accentColor;

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10">
      {/* Top Left Brand Telemetry (Clean, unblocking humanoid) */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 text-[9.5px] sm:text-[10.5px] tracking-[0.16em] sm:tracking-[0.22em] text-[#5d90ae] uppercase leading-relaxed pointer-events-auto max-w-[52vw] sm:max-w-none">
        <b className="text-[#bfe6ff] tracking-[0.2em] sm:tracking-[0.3em] block font-semibold whitespace-nowrap">APEX HUMANOID</b>
        <span className="text-[#2d556d] hidden sm:inline">rebuilt · raw webgl2 · sentiment ai</span>
      </div>

      {/* Top Right Status, Sentiment & Biometrics */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 text-right text-[9px] sm:text-[10px] tracking-[0.14em] sm:tracking-[0.22em] text-[#5d90ae] uppercase pointer-events-auto">
        <div className="flex items-center justify-end gap-2">
          <span className="hidden sm:inline">status:</span>
          <b style={{ color: moodColor }} className="font-semibold tracking-[0.2em] transition-colors duration-300">
            {mood}
          </b>
          <span
            className="inline-block w-[6px] h-[6px] rounded-full pulse-dot transition-colors duration-300"
            style={{ backgroundColor: moodColor, boxShadow: `0 0 8px ${moodColor}` }}
          />
          {/* Unobtrusive minimal Heart Rate indicator */}
          <span className="text-[#78a4bf] text-[9.5px] pl-1 font-mono flex items-center gap-1">
            <span
              className="inline-block transition-transform duration-75 text-[11px]"
              style={{
                transform: `scale(${1.0 + heartPulse * 0.35})`,
                color: isElevated ? '#ffd13b' : '#ff4d6d',
              }}
            >
              ❤️
            </span>
            <b className="text-white font-semibold">{heartRate}</b>
            <span className="text-[8px] text-[#4f7f9c]">BPM</span>
          </span>
        </div>

        {sentiment && sentiment.mood !== 'idle' && sentiment.mood !== 'neutral' && (
          <div className="text-[9px] tracking-[0.16em] mt-0.5 text-[#88b9d6]">
            tone:{' '}
            <span style={{ color: moodColor }} className="font-semibold">
              {sentiment.label} [{(sentiment.score * 100).toFixed(0)}%]
            </span>
          </div>
        )}
        <span className="text-[#2d556d] text-[9.5px] hidden sm:block mt-0.5">
          {fps > 0 ? `${fps} fps · ${(points / 1000).toFixed(0)}k pts` : '— fps'}
        </span>
      </div>

      {/* Center Subtle Hint */}
      {showHint && (
        <div className="absolute left-1/2 bottom-24 -translate-x-1/2 text-[10px] tracking-[0.2em] text-[#38627a] uppercase text-center transition-opacity duration-700 pointer-events-none hidden sm:block">
          move pointer — head follows · 1–4 mood · emotions in menu · t theme · g gesture · b bot
        </div>
      )}

      {/* Gesture Camera Mini Preview (Hidden per user request) */}
      <canvas
        ref={gestureCanvasRef}
        width={120}
        height={90}
        className="hidden opacity-0 pointer-events-none"
      />

      {/* Bottom Left Info */}
      <div className="absolute left-6 bottom-7 text-[9.5px] leading-relaxed tracking-[0.08em] text-[#2f566d] max-w-[260px] hidden md:block pointer-events-auto">
        <b className="text-[#4d86a4] font-medium">cardiac particle sync active</b> — core pulses with virtual heart rate.
        <br />
        <span className="text-[#234254]">excited / happy sentiment accelerates BPM to 135+</span>
      </div>
    </div>
  );
};
