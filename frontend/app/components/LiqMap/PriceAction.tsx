"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CandlestickSeries, IChartApi, ISeriesApi } from 'lightweight-charts';
import { priceManager, TickData } from '../../utils/priceDataProvider';
import { historyManager, BinData } from '../../utils/historyDataProvider';
import { ZoneCoordinator } from '../../utils/zoneCoordinator'; 

// --- Interface สำหรับ Zone Data ---
interface ZoneProfileData {
  max_vol: number;
  profile: Record<number, { buy: number; sell: number; total: number }>;
}

export const PriceAction = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const footprintRef = useRef<Record<string, Record<number, BinData>>>({});
  const [, setUpdateTrigger] = useState(0);

  // 🛡️ Safety Flag สำหรับป้องกัน Error: Object is disposed
  const isMounted = useRef(true);

  // 🔥 ใช้ Ref เก็บพิกัดเมาส์แทน State เพื่อแก้ปัญหาจอกระพริบตอนลาก
  const selectionRef = useRef<{ yStart: number; yCurrent: number } | null>(null);
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoneProfile, setZoneProfile] = useState<ZoneProfileData | null>(null);

  const toSeconds = (t: any): number => {
    if (typeof t === 'number') return t;
    if (t && typeof t === 'object') return t.value || Math.floor(Date.now() / 1000);
    return Math.floor(Date.now() / 1000);
  };

  // --- 🎨 1. ฟังก์ชันวาด Canvas ---
  const renderCanvas = useCallback(() => {
    if (!isMounted.current || !canvasRef.current || !chartRef.current || !seriesRef.current) return;

    requestAnimationFrame(() => {
      if (!isMounted.current || !canvasRef.current || !chartRef.current || !seriesRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      // 🧹 ล้างกระดาน
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timeScale = chartRef.current.timeScale();
      const seriesData = (seriesRef.current as any).data();
      if (seriesData.length === 0) return;

      // 📏 คำนวณความสูงแถว (ใช้ 1.0 ตาม Logic Math.floor ของกัปตัน)
      const pTopRef = seriesRef.current.priceToCoordinate(5001);
      const pBottomRef = seriesRef.current.priceToCoordinate(5000);
      const rowHeight = pTopRef !== null && pBottomRef !== null ? Math.abs(pBottomRef - pTopRef) : 20;

      // --- 🏗️ 1. วาด Zone Profile (แสดงผลทางขวาเมื่อสแกนเสร็จ) ---
      if (zoneProfile) {
        const { max_vol, profile } = zoneProfile;
        Object.entries(profile).forEach(([price, data]) => {
          const y = seriesRef.current!.priceToCoordinate(Number(price) + 1);
          if (y === null) return;
          const barWidth = (data.total / max_vol) * 150; 
          ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.fillRect(canvas.width - barWidth - 5, Math.floor(y), barWidth, Math.ceil(rowHeight));
        });
      }

      // --- 🏗️ 2. วาด Selection Box (ดึงจาก Ref โดยตรง ไม่ผ่าน State เพื่อความลื่นไหล) ---
      const selection = selectionRef.current;
      if (selection) {
        const yTop = Math.min(selection.yStart, selection.yCurrent);
        const yHeight = Math.abs(selection.yStart - selection.yCurrent);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.fillRect(0, yTop, canvas.width, yHeight);
        ctx.strokeRect(0, yTop, canvas.width, yHeight);
      }

      // --- 📊 3. วาด Footprint (Logic เดิมของกัปตัน 100%) ---
      Object.entries(footprintRef.current).forEach(([time, bins]) => {
        const unixTime = Math.floor(new Date(time).getTime() / 1000);
        let x = timeScale.timeToCoordinate(unixTime as any);
        
        if (x === null) {
          const lastBar = seriesData[seriesData.length - 1];
          if (toSeconds(lastBar.time) === unixTime) {
            x = timeScale.timeToCoordinate(lastBar.time);
          }
        }

        if (x === null || x < -100 || x > canvas.width + 100) return;

        const boxWidth = 50;
        const xPos = Math.floor(x);

        let barTotal = 0;
        let barBuy = 0;
        let barSell = 0;
        let lowestY = -1;

        Object.entries(bins).forEach(([price, data]) => {
          const priceNum = Number(price);
          barBuy += data.buy;
          barSell += data.sell;
          barTotal += (data.buy + data.sell);

          const yTopRaw = seriesRef.current!.priceToCoordinate(priceNum + 1);
          if (yTopRaw === null) return;
          const yTop = Math.floor(yTopRaw);
          
          if (yTop + rowHeight > lowestY) lowestY = yTop + rowHeight;

          // 🔥 เงื่อนไขปักธง 🚩 (Diagonal Imbalance)
          const upperPrice = priceNum + 1;
          const lowerPrice = priceNum - 1;
          const isBuyWinner = bins[upperPrice] ? data.buy > bins[upperPrice].sell : false;
          const isSellWinner = bins[lowerPrice] ? data.sell > bins[lowerPrice].buy : false;

          // วาดกล่องพื้นหลัง
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.fillRect(xPos - boxWidth / 2, yTop, boxWidth / 2, Math.ceil(rowHeight));
          ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
          ctx.fillRect(xPos, yTop, boxWidth / 2, Math.ceil(rowHeight));

          // เส้นตาราง
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(xPos - boxWidth / 2, yTop, boxWidth, Math.ceil(rowHeight));

          // วาดตัวเลข Buy/Sell
          ctx.font = 'bold 10px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff'; 
          
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(data.buy).toString() + (isBuyWinner ? '🚩' : ''), xPos - 4, yTop + rowHeight / 2);
          
          ctx.textAlign = 'left';
          ctx.fillText((isSellWinner ? '🚩' : '') + Math.round(data.sell).toString(), xPos + 4, yTop + rowHeight / 2);
        });

        // --- 🟢 วาด Summary (Delta & Total) ---
        if (lowestY !== -1) {
          const barDelta = barBuy - barSell;
          const summaryY = lowestY + 12;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
          ctx.fillRect(xPos - boxWidth / 2, lowestY + 2, boxWidth, 22);
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = barDelta >= 0 ? '#10b981' : '#f43f5e';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`D: ${barDelta > 0 ? '+' : ''}${barDelta}`, xPos, summaryY);
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`V: ${barTotal.toLocaleString()}`, xPos, summaryY + 10);
        }
      });
    });
  }, [zoneProfile]); // ลด Dependency เหลือแค่ zoneProfile ไม่ใส่ selectionRef เพื่อป้องกัน Re-render

  // --- 🖱️ 2. Mouse Handlers (ใช้ Ref เพื่อแก้จอกระพริบ) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelecting) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    selectionRef.current = { yStart: y, yCurrent: y };
    renderCanvas();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    selectionRef.current.yCurrent = e.clientY - rect.top;
    renderCanvas(); // วาดกล่องสดๆ ลง Canvas ทันที
  };

  const handleMouseUp = async () => {
    const selection = selectionRef.current;
    if (!selection || !seriesRef.current) {
      selectionRef.current = null;
      return;
    }

    const p1 = seriesRef.current.coordinateToPrice(selection.yStart);
    const p2 = seriesRef.current.coordinateToPrice(selection.yCurrent);

    if (p1 !== null && p2 !== null) {
      const top = Math.max(p1, p2);
      const bottom = Math.min(p1, p2);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/zone-profile?p_top=${top}&p_bottom=${bottom}&bars=200`);
        const data = await res.json();
        setZoneProfile(data);
      } catch (err) { console.error("Scan Error:", err); }
    }
    
    selectionRef.current = null;
    setIsSelecting(false); 
    renderCanvas();
  };

  // --- ⚙️ 3. ระบบ Chart Lifecycle (เดิม) ---
  useEffect(() => {
    isMounted.current = true;
    if (!chartContainerRef.current || !canvasRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#020617' }, textColor: '#94a3b8' },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: { 
        timeVisible: true,  // ✅ บังคับให้แสดงเวลา
        secondsVisible: false,
        barSpacing: 25, 
        rightOffset: 30, 
        shiftVisibleRangeOnNewBar: true 
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const series = chart.addSeries(CandlestickSeries, { 
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false 
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const loadHistory = async () => {
      const ohlc = await historyManager.fetchOHLCHistory(1000);
      if (ohlc.length > 0 && isMounted.current) series.setData(ohlc);

      const fpHistory = await historyManager.fetchFootprintHistory(50);
      const fpMap: Record<string, Record<number, BinData>> = {};
      fpHistory.forEach(item => {
        const cleanedBins: Record<number, BinData> = {};
        Object.entries(item.bins).forEach(([p, val]) => {
          cleanedBins[Math.floor(Number(p))] = val as BinData;
        });
        fpMap[item.candletime] = cleanedBins;
      });
      footprintRef.current = fpMap;
      if (isMounted.current) renderCanvas();
    };
    loadHistory();

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current && canvasRef.current && isMounted.current) {
        const w = chartContainerRef.current.clientWidth;
        const h = chartContainerRef.current.clientHeight;
        chart.applyOptions({ width: w, height: h });
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        renderCanvas();
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    chart.timeScale().subscribeVisibleTimeRangeChange(renderCanvas);

    return () => {
      isMounted.current = false;
      chart.remove();
    };
  }, [renderCanvas]);

  // --- ⚡ 4. ระบบ Live Update (เดิม) ---
  useEffect(() => {
    priceManager.connect();
    const unsubscribe = priceManager.subscribe((tick: TickData) => {
      if (!seriesRef.current || !isMounted.current) return;
      const price = tick.bid;
      const lastBar = (seriesRef.current as any).data().at(-1);
      const barTime = Math.floor(Date.now() / 1000 / 60) * 60;
      
      if (tick.updates) {
        const date = new Date(barTime * 1000);
        // Format เวลาให้เป็น Key สำหรับ Footprint Map
        const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;

        if (!footprintRef.current[timeStr]) footprintRef.current[timeStr] = {};
        tick.updates.forEach(u => {
          const snappedPrice = Math.floor(u.bin);
          const current = footprintRef.current[timeStr][snappedPrice] || { buy: 0, sell: 0 };
          footprintRef.current[timeStr][snappedPrice] = { 
            buy: current.buy + u.buy, 
            sell: current.sell + u.sell 
          };
        });
      }

      seriesRef.current.update({
        time: barTime as any,
        open: lastBar && toSeconds(lastBar.time) === barTime ? lastBar.open : price,
        high: lastBar && toSeconds(lastBar.time) === barTime ? Math.max(lastBar.high, price) : price,
        low: lastBar && toSeconds(lastBar.time) === barTime ? Math.min(lastBar.low, price) : price,
        close: price
      });
      renderCanvas();
    });
    return () => unsubscribe();
  }, [renderCanvas]);

  return (
    <div className="relative w-full h-full bg-[#020617] overflow-hidden">
      {/* 🔘 Control Buttons */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button 
          onClick={() => setIsSelecting(!isSelecting)}
          className={`px-4 py-2 rounded-md font-bold text-sm shadow-xl transition-all ${
            isSelecting ? 'bg-sky-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {isSelecting ? '🎯 Drag to Select Zone' : '🔍 Scan Zone'}
        </button>
        {zoneProfile && (
          <button onClick={() => setZoneProfile(null)} className="px-3 py-1 bg-rose-900/50 text-rose-200 rounded text-xs hover:bg-rose-800">Clear Scan</button>
        )}
      </div>

      <div ref={chartContainerRef} className="absolute inset-0 z-0 w-full h-full" />
      
      {/* 🖱️ Canvas ปรับให้รับ Mouse Events เมื่อเข้าโหมด Selecting */}
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`absolute inset-0 z-10 w-full h-full ${isSelecting ? 'cursor-crosshair' : 'pointer-events-none'}`} 
        style={{ pointerEvents: isSelecting ? 'auto' : 'none' }}
      />
    </div>
  );
};