import React, { useState } from 'react';
import {
  ApexMemberProfile,
  loginWithCredentials,
  registerPersonalAccount,
} from '../engine/authStore';

interface AuthGateModalProps {
  onAuthenticated: (user: ApexMemberProfile) => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === 'login') {
      const res = loginWithCredentials(identifier, pin);
      if (!res.ok || !res.user) {
        setError(res.error || 'Login failed');
        return;
      }
      onAuthenticated(res.user);
    } else {
      const res = registerPersonalAccount(name, identifier, pin);
      if (!res.ok || !res.user) {
        setError(res.error || 'Sign up failed');
        return;
      }
      onAuthenticated(res.user);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(3,8,15,0.88)] backdrop-blur-2xl">
      <div className="w-full max-w-[390px] rounded-3xl bg-[rgba(9,18,32,0.96)] border border-[rgba(79,210,255,0.28)] shadow-[0_24px_80px_rgba(0,0,0,0.95)] p-6 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[rgba(79,210,255,0.12)] border border-[rgba(79,210,255,0.3)] text-[11px] font-semibold tracking-[0.22em] text-[#7be0ff] uppercase">
            <span className="w-2 h-2 rounded-full bg-[#00f5d4]" />
            APEX AI
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {tab === 'login' ? 'Sign In to Personal AI' : 'Create Personal Account'}
          </h1>
          <p className="text-xs text-[#8db2cc]">
            Har member ka apna alag personal AI Memory, Tasks aur Personal Trading Wallet rehta hai.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-full bg-white/[0.06] border border-white/10">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`cursor-pointer py-2 rounded-full text-xs font-semibold transition-all ${
              tab === 'login'
                ? 'bg-[#4fd2ff] text-[#03131f] shadow'
                : 'text-[#9bbcd4] hover:text-white'
            }`}
          >
            Member Login
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`cursor-pointer py-2 rounded-full text-xs font-semibold transition-all ${
              tab === 'signup'
                ? 'bg-[#00f5d4] text-[#031a15] shadow'
                : 'text-[#9bbcd4] hover:text-white'
            }`}
          >
            New Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === 'signup' && (
            <div>
              <label className="block text-[11px] text-[#9bbcd4] mb-1">Aapka Naam</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-xl bg-white/[0.06] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-[#5e7e96] focus:outline-none focus:border-[#4fd2ff]"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-[#9bbcd4] mb-1">
              Mobile Number / Email / Member ID
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={tab === 'login' ? 'Mobile / Email / admin' : '9876543210 ya email'}
              className="w-full rounded-xl bg-white/[0.06] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-[#5e7e96] focus:outline-none focus:border-[#4fd2ff]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#9bbcd4] mb-1">Secret PIN / Password</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4+ digit PIN"
              className="w-full rounded-xl bg-white/[0.06] border border-white/15 px-3.5 py-2.5 text-sm text-white placeholder-[#5e7e96] focus:outline-none focus:border-[#4fd2ff]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[rgba(255,77,109,0.14)] border border-[rgba(255,77,109,0.4)] px-3 py-2 text-xs text-[#ff9ebb]">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="cursor-pointer w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#00f5d4] to-[#4fd2ff] text-[#031520] shadow-[0_10px_28px_rgba(79,210,255,0.35)] hover:brightness-105 transition-all"
          >
            {tab === 'login' ? 'Sign In & Start APEX' : 'Create Personal Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
