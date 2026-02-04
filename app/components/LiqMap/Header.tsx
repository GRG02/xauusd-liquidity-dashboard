"use client";

import React from 'react';
import { 
  Target, RefreshCw, Calendar, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';

export const Header = ({ 
  price, metrics, focusMode, setFocusMode, 
  currentDate, currentTime, onRefresh, onCenter, onIdNav, loading 
}: any) => {
  return (
    <header className="grid grid-cols-3 items-center bg-[#0f172a] px-6 py-3 border-b border-slate-800 shadow-xl w-full z-[100] font-sans">
      
      {/* ฝั่งซ้าย: โลโก้ และ ราคา Live */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-orange-500 tracking-tighter italic">LIQUIDITY DETECTOR</span>
          <h1 className="text-xl font-black text-white leading-none">XAU/USD</h1>
        </div>
        
        <div className="flex flex-col border-l border-slate-700 pl-4">
          <span className="text-[9px] text-slate-500 font-bold">OANDA LIVE</span>
          <span className="text-lg font-mono font-bold text-emerald-400">
            {price?.toFixed(2) || "0.00"}
          </span>
        </div>
      </div>

      {/* ตรงกลาง: Mode Selector (Pending, Position, Both) */}
      <div className="justify-self-center flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
        {(['pending', 'position', 'both'] as const).map((m) => (
          <button 
            key={m} 
            onClick={() => setFocusMode(m)} 
            className={`px-5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all 
              ${focusMode === m ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ฝั่งขวา: กลุ่มเครื่องมือ (ปฏิทิน, ลูกศร, ปุ่มจัดการ) */}
      <div className="flex items-center justify-end gap-3 text-slate-400">
        {/* วันที่และเวลา Snapshot */}
        <div className="flex items-center gap-3 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 mr-2">
           <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
             <Calendar size={14} className="text-orange-500" />
             {currentDate}
           </div>
           <div className="text-[11px] font-mono font-bold text-orange-400 border-l border-slate-700 pl-3">
             {currentTime}
           </div>
        </div>

        {/* ปุ่ม Center & Refresh */}
        <div className="flex gap-1.5">
          <button onClick={onCenter} className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:text-blue-400 transition-colors shadow-sm">
            <Target size={18} />
          </button>
          <button onClick={onRefresh} className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:text-emerald-400 transition-colors shadow-sm">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* ปุ่มเลื่อน Snapshot ID */}
        <div className="flex bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-sm">
          <button onClick={() => onIdNav('prev')} className="p-2 hover:bg-slate-800 border-r border-slate-800 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => onIdNav('next')} className="p-2 hover:bg-slate-800 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};