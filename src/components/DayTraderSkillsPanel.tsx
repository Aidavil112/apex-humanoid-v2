import React, { useState, useEffect, useCallback } from 'react';
import { hubFetch } from '../engine/api';

export interface ScannedSetup {
  symbol: string;
  market: string;
  coin: string;
  setupType: string;
  price: number;
  entry: number;
  stopLoss: number;
  target: number;
  riskPct: number;
  rewardPct: number;
  rrRatio: string;
  spreadPct: number;
  change24h: number;
  rangePosPct: number;
  simulations: number;
  winOddsPct: number;
  expectedProfitInr: number;
  skillsPassed: string[];
}

interface DayTraderSkillsPanelProps {
  orderInrAmount: number;
  orderBusy: boolean;
  onApproveSetup: (marketSymbol: string) => void;
}

const ELEVEN_SKILLS = [
  '1. 500+ Chart Scanner',
  '2. Entry + SL + Target Planner',
  '3. 10,000× Time-Machine Odds',
  '4. Bid-Ask Spread Guard',
  '5. Volume Surge Filter',
  '6. 24h Support Mapper',
  '7. Momentum Breakout',
  '8. 1:2.15 Risk:Reward',
  '9. Smart Position Sizer',
  '10. CoinDCX Precision Engine',
  '11. YES-Gate Execution',
];

export const DayTraderSkillsPanel: React.FC<DayTraderSkillsPanelProps> = ({
  orderInrAmount,
  orderBusy,
  onApproveSetup,
}) => {
  const [scanning, setScanning] = useState(false);
  const [totalCharts, setTotalCharts] = useState<number>(0);
  const [setups, setSetups] = useState<ScannedSetup[]>([]);
  const [requireYes, setRequireYes] = useState<boolean>(true);
  const [showAllSkills, setShowAllSkills] = useState<boolean>(false);

  const runFullScan = useCallback(async () => {
    setScanning(true);
    try {
      const r = await hubFetch('/api/coindcx/scan-all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tradeInr: orderInrAmount }),
      });
      const j = await r.json();
      if (j?.ok) {
        setTotalCharts(Number(j.totalChartsScanned || 0));
        setSetups(Array.isArray(j.setups) ? j.setups : []);
      }
    } catch {}
    setScanning(false);
  }, [orderInrAmount]);

  useEffect(() => {
    runFullScan();
  }, [runFullScan]);

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-[#140e08] via-[#07131e] to-[#081926] border border-[rgba(255,153,79,0.45)] space-y-3">
      {/* Header matching Reel #1: 11 Day-Trader AI Skills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-extrabold tracking-wider uppercase text-[#ffb36b]">
              🧡 AI DAY TRADER · 11 SKILLS ENGINE
            </span>
            <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-[rgba(255,153,79,0.16)] border border-[rgba(255,153,79,0.45)] text-[#ffd2a6] font-bold">
              {totalCharts > 0 ? `${totalCharts} LIVE CHARTS SCANNED` : 'SCANNING ALL CHARTS…'}
            </span>
          </div>
          <div className="text-[10.5px] text-[#9ec3db] mt-0.5">
            <b>1. Scan</b> ({totalCharts || '500+'} CoinDCX charts) · <b>2. Plan</b> (Entry + Stop + Target) ·{' '}
            <b>3. Replay</b> (10,000× Honest Win Odds)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowAllSkills((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.16)] text-[10px] font-bold text-[#ffd2a6] cursor-pointer"
          >
            {showAllSkills ? 'Hide 11 Skills' : '🧩 View 11 AI Skills'}
          </button>
          <button
            onClick={runFullScan}
            disabled={scanning}
            className="px-3 py-1.5 rounded-lg bg-[#ff944d] hover:brightness-110 disabled:opacity-50 text-[#1a0b02] text-[10.5px] font-extrabold uppercase tracking-wider cursor-pointer"
          >
            {scanning ? '🔍 Scanning…' : '🔍 Scan All Charts'}
          </button>
        </div>
      </div>

      {/* 11 Specialized AI Skills Pills */}
      {showAllSkills && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[rgba(255,255,255,0.08)]">
          {ELEVEN_SKILLS.map((sk) => (
            <span
              key={sk}
              className="text-[9.5px] px-2 py-0.5 rounded-md bg-[rgba(255,148,77,0.12)] border border-[rgba(255,148,77,0.3)] text-[#ffe0c2]"
            >
              ✓ {sk}
            </span>
          ))}
        </div>
      )}

      {/* Safety Gate Banner: "Nothing trades without your YES" */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.35)] border border-[rgba(79,210,255,0.16)] text-[10.5px]">
        <span className="text-[#cde8f8]">
          🛡️ <b>Confirmation Gate:</b>{' '}
          {requireYes
            ? 'Nothing trades without your YES — har setup ka Entry, Stop, Target & 10,000× Odds dekh kar YES dabayein!'
            : 'Direct Quick Execution Active'}
        </span>
        <button
          onClick={() => setRequireYes((v) => !v)}
          className={`px-2.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer border ${
            requireYes
              ? 'bg-[rgba(0,245,160,0.18)] border-[#00f5a0] text-[#00f5a0]'
              : 'bg-[rgba(255,209,59,0.2)] border-[#ffd13b] text-[#ffd13b]'
          }`}
        >
          {requireYes ? '🔒 Ask My YES First: ON' : '⚡ Instant Execute'}
        </button>
      </div>

      {/* Top Ranked Setups from 10,000x Time-Machine Simulation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {scanning && setups.length === 0 ? (
          <div className="col-span-full text-center py-5 text-xs text-[#9ec3db]">
            ⚡ Scanning 500+ live CoinDCX charts &amp; running 10,000× Monte Carlo simulations…
          </div>
        ) : setups.length === 0 ? (
          <div className="col-span-full text-center py-4 text-xs text-[#9ec3db]">
            No high-odds low-spread setup right this second — click Scan All Charts again in a moment.
          </div>
        ) : (
          setups.slice(0, 4).map((s) => (
            <div
              key={s.market}
              className="p-3 rounded-xl bg-[#06111c] border border-[rgba(79,210,255,0.2)] flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-white">{s.symbol}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(79,210,255,0.15)] text-[#7fe0ff] font-bold">
                    {s.setupType === 'OVERSOLD_DIP_REVERSAL' ? 'DIP REVERSAL' : 'BREAKOUT'}
                  </span>
                </div>
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded-full font-extrabold ${
                    s.winOddsPct >= 58
                      ? 'bg-[rgba(0,245,160,0.18)] text-[#00f5a0] border border-[#00f5a0]'
                      : 'bg-[rgba(255,209,59,0.18)] text-[#ffd13b] border border-[#ffd13b]'
                  }`}
                >
                  🎲 {s.winOddsPct}% Odds (10k Sim)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-[#040b12] p-2 rounded-lg border border-[rgba(255,255,255,0.06)]">
                <div>
                  <div className="text-[#5c859e]">Entry</div>
                  <div className="text-white font-bold">₹{s.entry.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-[#ff7b93]">Stop (-{s.riskPct}%)</div>
                  <div className="text-[#ff8fa3] font-bold">₹{s.stopLoss.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-[#00f5a0]">Target (+{s.rewardPct}%)</div>
                  <div className="text-[#00f5a0] font-bold">₹{s.target.toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[9.5px] text-[#7ca4bd]">
                  R:R <b className="text-white">{s.rrRatio}</b> · Spread <b className="text-white">{s.spreadPct}%</b>
                </span>
                <button
                  disabled={orderBusy}
                  onClick={() => {
                    if (
                      requireYes &&
                      !window.confirm(
                        `Execute REAL CoinDCX Spot BUY on ${s.symbol}?\n\n• Amount: ₹${orderInrAmount}\n• Entry: ₹${s.entry}\n• Stop-Loss: ₹${s.stopLoss} (-${s.riskPct}%)\n• Target: ₹${s.target} (+${s.rewardPct}%)\n• 10,000× Honest Odds: ${s.winOddsPct}%`
                      )
                    ) {
                      return;
                    }
                    onApproveSetup(s.symbol);
                  }}
                  className="px-3 py-1 rounded-lg bg-[#00f5a0] hover:bg-[#00da8e] disabled:opacity-50 text-[#041a12] text-[10.5px] font-extrabold uppercase cursor-pointer"
                >
                  {orderBusy ? 'Executing…' : `✅ YES · BUY ₹${orderInrAmount}`}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
