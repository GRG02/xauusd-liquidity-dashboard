"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useOandaStream } from './apis/mt5Req';
import { Header } from './components/LiqMap/Header';
import { PriceAction } from './components/LiqMap/PriceAction';
import { historyManager } from './utils/historyData';

export default function LiquidityDashboard() {
  const [loading, setLoading] = useState(false);
  const [mt5Data, setMt5Data] = useState<any[]>([]);
  const [focusMode, setFocusMode] = useState<'pending' | 'position' | 'both'>('both');
  const [visiblePriceRange, setVisiblePriceRange] = useState<{min: number, max: number} | null>(null);

  // 🛰️ Stream Data
  const { livePrice, velocity, footprint } = useOandaStream('ws://127.0.0.1:8000/ws/price');

  // 🕯️ Load History (แก้ไขชื่อฟังก์ชันให้ตรงกับ historyManager ล่าสุด)
  useEffect(() => {
    const fetchInitialHistory = async () => {
      setLoading(true);
      try {
        const data = await historyManager.fetchOHLCHistory(2000);
        if (data) setMt5Data(data);
        await historyManager.fetchFootprintHistory(50);
      } catch (e) {
        console.error("❌ Failed to load initial history:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialHistory();
  }, []);

  // Set initial visible range
  useEffect(() => {
    if (livePrice && visiblePriceRange === null) {
      const initialSpan = 5.0;
      setVisiblePriceRange({
        min: livePrice - initialSpan,
        max: livePrice + initialSpan,
      });
    }
  }, [livePrice, visiblePriceRange]);

  const handleVisibleRangeChange = useCallback((range: { min: number, max: number }) => {
    setVisiblePriceRange(range);
  }, []);

  return (
    // 🟢 h-screen + flex-col: บังคับให้ทั้งหน้าจอสูงพอดีเป๊ะ
    <div className="flex flex-col h-screen w-screen bg-[#020617] text-slate-200 select-none overflow-hidden font-sans">
      
      {/* 1. Header: ความสูงคงที่ */}
      <Header 
        price={livePrice} 
        velocity={velocity} 
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        currentDate={new Date().toLocaleDateString('th-TH')}
        currentTime={new Date().toLocaleTimeString('th-TH')}
        onRefresh={() => window.location.reload()}
        onCenter={() => setVisiblePriceRange(null)}
        loading={loading}
      />
      
      {/* 2. Main Content Area: flex-1 คือยืดเต็มพื้นที่ที่เหลือจาก Header */}
      <main className="flex-1 w-full relative overflow-hidden">
        {/* Container ชั้นนี้ต้องเป็น absolute inset-0 
           เพื่อให้ PriceAction รับรู้ขนาดที่แท้จริงของพื้นที่ที่เหลือ 
        */}
        <div className="absolute inset-0">
          <PriceAction 
            mt5Data={mt5Data}
            livePrice={livePrice}
            velocity={velocity}
            footprint={footprint} 
            visiblePriceRange={visiblePriceRange}
            setVisiblePriceRange={handleVisibleRangeChange}
          />
        </div>
      </main>
    </div>
  );
}