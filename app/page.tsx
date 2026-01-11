"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

// --- TRADINGVIEW WIDGET COMPONENT ---
const TradingViewWidget = () => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": "OANDA:XAUUSD",
      "interval": "15",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "allow_symbol_change": true,
      "container_id": "tv_chart_container"
    });
    if (container.current) {
      container.current.innerHTML = "";
      container.current.appendChild(script);
    }
  }, []);

  return <div id="tv_chart_container" ref={container} className="w-full h-full" />;
};

export default function LiquidityDashboard() {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [maxAvailableId, setMaxAvailableId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<'pending' | 'position' | 'both'>('both');

  const [rawPayload, setRawPayload] = useState<{ pos: any, ord: any, price: number, time: string } | null>(null);
  const [priceRange, setPriceRange] = useState<number>(5.0);
  const [centerPrice, setCenterPrice] = useState<number | null>(null);

  const isDragging = useRef(false);
  const lastY = useRef(0);
  const [cursorClass, setCursorClass] = useState('cursor-grab');

  useEffect(() => { fetchLatestId(); }, []);

  const fetchLatestId = async () => {
    setLoading(true);
    const { data: latest } = await supabase
      .from('position_tb').select('id').order('id', { ascending: false }).limit(1).single();
    if (latest) {
      setCurrentIndex(latest.id);
      setMaxAvailableId(latest.id);
      fetchFullBatch(latest.id, true);
    }
  };

  const fetchFullBatch = async (id: number, resetCenter = false) => {
    if (!id) return;
    setLoading(true);
    try {
      const [posRes, ordRes] = await Promise.all([
        supabase.from('position_tb').select('*').eq('id', id).maybeSingle(),
        supabase.from('order_tb').select('*').eq('id', id).maybeSingle()
      ]);
      if (posRes.data && ordRes.data) {
        const cPrice = posRes.data.current_price;
        setRawPayload({ pos: posRes.data, ord: ordRes.data, price: cPrice, time: posRes.data.oanda_time });
        if (resetCenter) setCenterPrice(cPrice);
        setError(null);
      }
    } catch (err) { setError("Connection error."); } finally { setLoading(false); }
  };

  const chartData = useMemo(() => {
    if (!rawPayload || centerPrice === null) return [];
    const map = new Map();
    const minP = centerPrice - priceRange;
    const maxP = centerPrice + priceRange;
    
    // ระยะที่คลื่นลอยออกไป (Offset)
    const sideOffset = 1.0; 

    rawPayload.pos.buckets_data?.forEach((b: any) => {
      if (b.price >= minP - 0.5 && b.price <= maxP + 0.5) {
        const p = parseFloat(b.price).toFixed(2);
        const pL = parseFloat(b.longCountPercent) || 0;
        const pS = -parseFloat(b.shortCountPercent) || 0;
        map.set(p, { 
          price: p, 
          posLong: pL, 
          posShort: pS,
          posLongWave: sideOffset + pL, 
          posShortWave: -sideOffset + pS,
          rightBase: sideOffset, // สำหรับวาดเส้นฐานฝั่งขวา
          leftBase: -sideOffset,  // สำหรับวาดเส้นฐานฝั่งซ้าย
          ordLong: 0, 
          ordShort: 0,
          ordLongWave: sideOffset, 
          ordShortWave: -sideOffset
        });
      }
    });

    rawPayload.ord.buckets_data?.forEach((b: any) => {
      const p = parseFloat(b.price).toFixed(2);
      if (map.has(p)) {
        const existing = map.get(p)!;
        const oL = parseFloat(b.longCountPercent) || 0;
        const oS = -parseFloat(b.shortCountPercent) || 0;
        map.set(p, { 
          ...existing, 
          ordLong: oL, 
          ordShort: oS,
          ordLongWave: sideOffset + oL,
          ordShortWave: -sideOffset + oS
        });
      }
    });
    return Array.from(map.values()).sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
  }, [rawPayload, centerPrice, priceRange]);

  const handleIdNav = (direction: 'next' | 'prev') => {
    if (currentIndex === null) return;
    const nextId = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextId > maxAvailableId || nextId < 1) return;
    setCurrentIndex(nextId);
    fetchFullBatch(nextId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    setPriceRange(prev => {
      const step = prev * 0.1;
      return e.deltaY > 0 ? Math.min(100, prev + step) : Math.max(0.5, prev - step);
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastY.current = e.clientY;
    setCursorClass('cursor-grabbing');
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || centerPrice === null) return;
    const deltaY = e.clientY - lastY.current;
    const moveSensitivity = (priceRange / 600);
    setCenterPrice(prev => (prev !== null ? prev + (deltaY * moveSensitivity) : prev));
    lastY.current = e.clientY;
  }, [centerPrice, priceRange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setCursorClass('cursor-grab');
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0f172a] border border-slate-700 p-3 rounded-lg shadow-2xl text-[11px] font-mono">
          <p className="text-yellow-500 mb-1 font-bold text-xs uppercase">Price: {label}</p>
          <div className="h-[1px] bg-slate-700 my-2" />
          {payload.map((entry: any, index: number) => {
            const val = Math.abs(entry.value).toFixed(2);
            if (val === "0.00" || entry.dataKey.includes('Base')) return null;
            if (entry.dataKey.includes('Wave')) {
              const actualVal = Math.abs(parseFloat(val) - 1.0).toFixed(2);
              if (actualVal === "0.00") return null;
              return (
                <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
                  <span>Wave ({entry.dataKey.includes('Long') ? "Buy" : "Sell"}):</span>
                  <span className="font-bold">{actualVal}%</span>
                </p>
              );
            }
            return (
              <p key={index} style={{ color: entry.color }} className="flex justify-between gap-4">
                <span>{entry.dataKey.includes('pos') ? "Position" : "Order"} ({entry.dataKey.includes('Long') ? "Buy" : "Sell"}):</span>
                <span className="font-bold">{val}%</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-200 select-none overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-[#0f172a] border-b border-slate-800 shadow-xl z-20">
        <div className="flex items-center gap-6 w-1/3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-yellow-500 tracking-widest uppercase">LIQUIDITY DETECTOR</span>
            <h1 className="text-xl font-extrabold text-white leading-none mt-1">XAU/USD</h1>
          </div>
          {rawPayload && (
            <div className="flex flex-col border-l border-slate-700 pl-4">
              <span className="text-[10px] text-slate-400 uppercase leading-none">OANDA Price</span>
              <span className="text-lg font-mono text-emerald-400 font-bold tracking-tighter">{rawPayload.price.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-1 bg-slate-900/80 p-1 rounded-full border border-slate-800 backdrop-blur-md">
          <button onClick={() => setFocusMode('pending')} className={`px-5 py-1.5 rounded-full text-[10px] font-bold transition-all ${focusMode === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>PENDING</button>
          <button onClick={() => setFocusMode('position')} className={`px-5 py-1.5 rounded-full text-[10px] font-bold transition-all ${focusMode === 'position' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>POSITION</button>
          <button onClick={() => setFocusMode('both')} className={`px-5 py-1.5 rounded-full text-[10px] font-bold transition-all ${focusMode === 'both' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500'}`}>BOTH</button>
        </div>

        <div className="flex items-center justify-end gap-3 w-1/3">
          <button onClick={() => rawPayload?.price && setCenterPrice(rawPayload.price)} className="text-[9px] bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-700 text-slate-400 font-bold transition-colors uppercase">Re-Center</button>
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-inner">
            <button onClick={() => handleIdNav('prev')} disabled={currentIndex === 1} className={`p-1.5 rounded-md transition ${currentIndex === 1 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-600'}`}><ArrowLeft size={16} /></button>
            <div className="px-3 py-1 text-xs font-mono flex items-center border-x border-slate-700 mx-1 text-yellow-500 font-bold uppercase tracking-tighter">ID: {currentIndex}</div>
            <button onClick={() => handleIdNav('next')} disabled={currentIndex === maxAvailableId} className={`p-1.5 rounded-md transition ${currentIndex === maxAvailableId ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-600'}`}><ArrowRight size={16} /></button>
          </div>
          <button onClick={fetchLatestId} className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-lg text-orange-500"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-[#020617]">
        <section className="w-1/2 h-full border-r border-slate-800 relative">
          <TradingViewWidget />
        </section>

        <section
          className={`w-1/2 h-full p-4 flex flex-col overflow-hidden ${cursorClass}`}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          <div className="flex-1 bg-[#0f172a] rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart layout="vertical" data={chartData} margin={{ top: 20, right: 80, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />

                <XAxis
                  type="number"
                  domain={[-2, 2]} 
                  stroke="#475569"
                  fontSize={10}
                  ticks={[-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]}
                  tickFormatter={(v) => `${Math.abs(v)}%`}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  dataKey="price"
                  type="category"
                  orientation="right"
                  stroke="#fbbf24"
                  fontSize={11}
                  width={80}
                  tickFormatter={(v) => parseFloat(v).toFixed(2)}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />

                {rawPayload && (
                  <ReferenceLine
                    y={rawPayload.price.toFixed(2)}
                    stroke="#f97316"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    label={{ position: 'right', value: `LIVE ${rawPayload.price.toFixed(2)}`, fill: '#f97316', fontSize: 10, fontWeight: '900' }}
                    zIndex={100}
                  />
                )}

                <ReferenceLine x={0} stroke="#475569" strokeWidth={2} />

                {/* --- AREA WAVES (แก้ไข baseValue เป็นตัวเลข) --- */}
                <Area
                  type="monotone" dataKey="posLongWave" baseValue={1.0} stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={3}
                  opacity={focusMode === 'pending' ? 0 : 0.8} isAnimationActive={false} connectNulls
                />
                <Area
                  type="monotone" dataKey="ordLongWave" baseValue={1.0} stroke="#34d399" fill="none" strokeWidth={2} strokeDasharray="5 5"
                  opacity={focusMode === 'position' ? 0 : 0.6} isAnimationActive={false} connectNulls
                />

                <Area
                  type="monotone" dataKey="posShortWave" baseValue={-1.0} stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={3}
                  opacity={focusMode === 'pending' ? 0 : 0.8} isAnimationActive={false} connectNulls
                />
                <Area
                  type="monotone" dataKey="ordShortWave" baseValue={-1.0} stroke="#f87171" fill="none" strokeWidth={2} strokeDasharray="5 5"
                  opacity={focusMode === 'position' ? 0 : 0.6} isAnimationActive={false} connectNulls
                />

                {/* --- BARS --- */}
                <Bar dataKey="posLong" fill="#10b981" barSize={12} opacity={focusMode === 'pending' ? 0.2 : 0.8} isAnimationActive={false} />
                <Bar dataKey="posShort" fill="#ef4444" barSize={12} opacity={focusMode === 'pending' ? 0.2 : 0.8} isAnimationActive={false} />
                <Bar dataKey="ordLong" fill="#34d399" barSize={12} opacity={focusMode === 'position' ? 0.2 : 0.8} isAnimationActive={false} />
                <Bar dataKey="ordShort" fill="#f87171" barSize={12} opacity={focusMode === 'position' ? 0.2 : 0.8} isAnimationActive={false} />

              </ComposedChart>
            </ResponsiveContainer>

            {loading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center z-50">
                <RefreshCw className="animate-spin text-orange-500 mb-4" size={40} />
                <span className="text-orange-500 font-black tracking-[0.3em] text-[10px] animate-pulse uppercase">Syncing Market Map</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}