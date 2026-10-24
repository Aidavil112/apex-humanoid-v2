import React from 'react';
import { SiriOrbGraphic } from './SiriAssistantSheet';

interface IntroGateProps {
  onEnter: () => void;
}

export const IntroGate: React.FC<IntroGateProps> = ({ onEnter }) => {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center text-center bg-[radial-gradient(60%_60%_at_50%_50%,#07111c_0%,#03070c_70%,#000_100%)] select-none px-6">
      <div className="mb-6">
        <SiriOrbGraphic active stage="speaking" size="sheet" />
      </div>
      <h1 className="m-0 text-[18px] sm:text-[21px] tracking-[0.42em] text-white font-semibold indent-[0.42em]">
        APEX AI
      </h1>
      <p className="mt-2.5 text-[12px] tracking-[0.06em] text-[#7ea6c2]">
        3D Intelligent Assistant · Day Trader · Phone Control
      </p>
      <button
        onClick={onEnter}
        className="cursor-pointer mt-8 px-9 py-3.5 rounded-full font-sans text-[13px] font-semibold tracking-[0.14em] uppercase text-[#04141f] bg-gradient-to-r from-[#00f5d4] via-[#4fd2ff] to-[#9b7cff] shadow-[0_12px_38px_rgba(79,210,255,0.42)] hover:scale-[1.03] active:scale-[0.98] transition-all"
      >
        Start APEX
      </button>
    </div>
  );
};
