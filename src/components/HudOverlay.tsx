import React from 'react';
import { MoodType, SentimentResult } from '../types';

interface HudOverlayProps {
  mood: MoodType;
  fps: number;
  points: number;
  gestureActive: boolean;
  gestureLabel?: string;
  gestureCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  showHint: boolean;
  themeAccent: [number, number, number];
  sentiment?: SentimentResult | null;
  heartRate?: number;
  heartPulse?: number;
  isElevated?: boolean;
  bgSoundActive?: boolean;
  onToggleBgSound?: () => void;
  onCloseGesture?: () => void;
}

const MOOD_COLORS: Record<MoodType, string> = {
  idle: '#4fd2ff',
  listening: '#00f5d4',
  thinking: '#ffd166',
  speaking: '#b388ff',
  happy: '#ffd13b',
  excited: '#ff7a18',
  sad: '#5b82ff',
  angry: '#ff4d6d',
  surprised: '#f04aff',
  calm: '#29f0aa',
  neutral: '#b0d6f5',
};

export const HudOverlay: React.FC<HudOverlayProps> = ({
  mood,
  gestureCanvasRef,
  themeAccent,
  heartRate = 72,
  heartPulse = 0,
  isElevated = false,
  bgSoundActive = false,
  onToggleBgSound,
}) => {
  const accentColor = `rgb(${themeAccent.map((v) => Math.round(v * 255)).join(',')})`;
  const moodColor = MOOD_COLORS[mood] || accentColor;

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-10">
      {/* Clean Top-Left APEX Pill */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[rgba(6,14,22,0.62)] border border-white/10 backdrop-blur-md pointer-events-auto">
        <span
          className="w-2 h-2 rounded-full transition-colors duration-300"
          style={{ backgroundColor: moodColor, boxShadow: `0 0 10px ${moodColor}` }}
        />
        <span className="text-[11px] font-semibold tracking-[0.24em] text-[#dff4ff] uppercase">
          APEX
        </span>
      </div>

      {/* Clean Top-Right Controls: FX Sound Toggle + Heart Rate (ZERO Camera Icon / Preview Box!) */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 pointer-events-auto">
        {onToggleBgSound && (
          <button
            onClick={onToggleBgSound}
            title="Background FX Sound ON/OFF"
            className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-medium transition-all backdrop-blur-md border ${
              bgSoundActive
                ? 'bg-[rgba(79,210,255,0.18)] text-[#dff6ff] border-[rgba(79,210,255,0.45)]'
                : 'bg-[rgba(6,14,22,0.62)] text-[#7d9db4] border-white/10 hover:text-white'
            }`}
          >
            <span>{bgSoundActive ? '🔉' : '🔇'}</span>
            <span>{bgSoundActive ? 'FX On' : 'FX Off'}</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(6,14,22,0.62)] border border-white/10 backdrop-blur-md text-[10.5px] font-mono text-[#c8e6f8]">
          <span
            className="inline-block transition-transform duration-75 text-[11px]"
            style={{
              transform: `scale(${1.0 + heartPulse * 0.28})`,
              color: isElevated ? '#ffd13b' : '#ff4d6d',
            }}
          >
            ♥
          </span>
          <b className="font-semibold text-white">{heartRate}</b>
        </div>
      </div>

      {/* Completely hidden offscreen buffer canvas — ZERO camera window or camera icon visible anywhere */}
      <canvas ref={gestureCanvasRef} width={160} height={120} className="hidden" />
    </div>
  );
};
