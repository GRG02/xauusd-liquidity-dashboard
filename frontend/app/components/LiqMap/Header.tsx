// app/components/LiqMap/Header.tsx
'use client';

import React from 'react';

interface HeaderProps {
  connectionStatus: boolean;
  onScanFocus: () => void;
  onClearCanvas: () => void;
  currentMode: 'view' | 'draw' | 'profile';
  setMode: (mode: 'view' | 'draw' | 'profile') => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  onScanFocus,
  onClearCanvas,
  currentMode,
  setMode
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 text-white select-none">
      {/* ฝั่งซ้าย: สถานะและการเชื่อมต่อ */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connectionStatus ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
          <span className="text-sm font-medium tracking-wider uppercase">
            {connectionStatus ? 'MT5 Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="h-4 w-[1px] bg-slate-700" />
        <span className="text-xs text-slate-400 font-mono">XAUUSD / Sniper Mode</span>
      </div>

      {/* ฝั่งกลาง: Painter Tools (ปุ่มควบคุมจิตรกร) */}
      <div className="flex items-center bg-slate-800 rounded-lg p-1 gap-1 border border-slate-700">
        <button
          onClick={() => setMode('view')}
          className={`px-3 py-1 text-xs rounded-md transition-all ${currentMode === 'view' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
        >
          View
        </button>
        <button
          onClick={() => setMode('draw')}
          className={`px-3 py-1 text-xs rounded-md transition-all ${currentMode === 'draw' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
        >
          Trendline
        </button>
        <button
          onClick={() => setMode('profile')}
          className={`px-3 py-1 text-xs rounded-md transition-all ${currentMode === 'profile' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
        >
          Focus Profile
        </button>
      </div>

      {/* ฝั่งขวา: Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onScanFocus}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-lg transition-colors"
        >
          SCAN LIQUIDITY
        </button>
        <button
          onClick={onClearCanvas}
          className="px-3 py-1.5 border border-slate-600 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};