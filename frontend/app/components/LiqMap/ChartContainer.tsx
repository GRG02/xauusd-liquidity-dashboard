'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useChart } from '../../(hook)/useChart';
import { useCoordinateSync } from '../../(hook)/useCoordinateSync';
import { Header } from './Header';
import { CanvasOverlay } from './CanvasOverlay';
import { priceManager, TickData } from '../../utils/priceDataProvider';
import { historyManager, BinData } from '../../utils/historyDataProvider';

export const ChartContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, dpr: 1 });
  const [mode, setMode] = useState<'view' | 'draw' | 'profile'>('view');

  // 📦 Data States
  const [livePrice, setLivePrice] = useState<number>(0);
  const [velocity, setVelocity] = useState<number>(0);
  const [footprint, setFootprint] = useState<Record<number, Record<number, BinData>>>({});
  const [loading, setLoading] = useState(true);
  const [isInitialDataReady, setIsInitialDataReady] = useState(false);

  // 1. ระบบ Chart & Coordinates (ปลดล็อคเมื่อ Data พร้อม)
  const { chart, series, isChartReady } = useChart(containerRef);
  useCoordinateSync(chart, series, isInitialDataReady);

  // 🛰️ 2. Real-time Price Updates
  useEffect(() => {
    priceManager.connect();
    const unsubscribe = priceManager.subscribe((data: TickData) => {
      if (data.type === "POWER_UPDATE") {
        setLivePrice(data.bid);
        setVelocity(data.velocity);

        if (data.candletime && isChartReady && series) {
          // 🎯 แปลง Server Time เป็น Unix Seconds ทันที
          let serverTs = Math.floor(new Date(data.candletime).getTime() / 1000);
          if (isNaN(serverTs)) serverTs = Number(data.candletime);

          const lastBar = (series as any).data().at(-1);

          series.update({
            time: serverTs as any,
            open: lastBar && lastBar.time === serverTs ? lastBar.open : data.bid,
            high: lastBar && lastBar.time === serverTs ? Math.max(lastBar.high, data.bid) : data.bid,
            low: lastBar && lastBar.time === serverTs ? Math.min(lastBar.low, data.bid) : data.bid,
            close: data.bid,
          });

          if (data.updates) {
            setFootprint(prev => {
              const newBins = { ...(prev[serverTs] || {}) };
              data.updates!.forEach(update => {
                const binIdx = Math.floor(update.bin);
                const current = newBins[binIdx] || { buy: 0, sell: 0 };
                newBins[binIdx] = {
                  buy: current.buy + update.buy,
                  sell: current.sell + update.sell
                };
              });
              return { ...prev, [serverTs]: newBins };
            });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [isChartReady, series]);

  // 🕯️ 3+4. Initial History Sync & Base Setup
  useEffect(() => {
    const loadAndSync = async () => {
      if (!isChartReady || !series || !chart) return;
      setLoading(true);
      console.log("🚀 Starting Sniper Sync Sequence...");

      try {
        const candleHistory = await historyManager.fetchOHLCHistory(2000);
        if (candleHistory?.length) {
          // จัดระเบียบ OHLC
          const cleanCandles = candleHistory
            .map(d => ({
              time: Number(d.time) as any,
              open: Number(d.open), high: Number(d.high),
              low: Number(d.low), close: Number(d.close),
            }))
            .sort((a, b) => (a.time as number) - (b.time as number))
            .filter((v, i, a) => i === 0 || v.time !== a[i - 1].time);

          series.setData(cleanCandles);

          // 🔍 CRITICAL DEBUG: ตรวจสอบพิกัดสมอเรือหลังจาก LW-Chart รับข้อมูล
          await new Promise(r => setTimeout(r, 150));
          const anchorTime = cleanCandles[0].time;
          const timeScale = chart.timeScale();
          const xPos = timeScale.timeToCoordinate(anchorTime as any);
          const visibleFrom = timeScale.getVisibleRange()?.from;

          console.log("------------------------------------------");
          console.log("⚓ SNIPER ANCHOR AUDIT:");
          console.log("- Anchor Time (First Bar):", anchorTime);
          console.log("- Pixel X Location:", xPos);
          console.log("- Visible Start (Time):", visibleFrom);
          console.log("- Visible Start (Pixel):", timeScale.timeToCoordinate(visibleFrom as any));
          console.log("------------------------------------------");

          // โหลด Footprint History
          await historyManager.fetchFootprintHistory(50);
          const cachedMap = historyManager.getFootprintAsMap();
          const processedFootprint: Record<number, Record<number, BinData>> = {};

          Object.entries(cachedMap).forEach(([time, bins]) => {
            let ts = Math.floor(new Date(time).getTime() / 1000);
            if (isNaN(ts)) ts = Number(time);
            
            const snappedBins: Record<number, BinData> = {};
            Object.entries(bins as any).forEach(([p, val]) => {
              snappedBins[Math.floor(Number(p))] = val as BinData;
            });
            processedFootprint[ts] = snappedBins;
          });

          setFootprint(prev => ({ ...processedFootprint, ...prev }));
          setIsInitialDataReady(true);
          console.log("🎯 Sniper Engine: Ready to Fire!");
        }
      } catch (err) {
        console.error("❌ Sync Failed:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAndSync();
  }, [isChartReady, series, chart]);

  // 🎨 5. Formatted Footprint for Canvas (Simplified)
  const formattedFootprint = useMemo(() => {
    const items: any[] = [];
    Object.entries(footprint).forEach(([tsStr, bins]) => {
      const ts = Number(tsStr);
      Object.entries(bins).forEach(([price, val]) => {
        items.push({
          t: ts,
          price: Number(price),
          buyV: val.buy,
          sellV: val.sell,
          isHighV: (val.buy + val.sell) > 1000
        });
      });
    });
    return items;
  }, [footprint]);

  // 📏 6. Responsive Resize Logic
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      const dpr = window.devicePixelRatio || 1;
      setDimensions({ width: w, height: h, dpr });
      if (chart) chart.applyOptions({ width: w, height: h });
    };

    const observer = new ResizeObserver(() => requestAnimationFrame(updateSize));
    if (containerRef.current) observer.observe(containerRef.current);
    updateSize();
    return () => observer.disconnect();
  }, [chart]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#020617] text-white overflow-hidden">
      <Header
        connectionStatus={livePrice > 0}
        currentMode={mode}
        setMode={setMode}
        onScanFocus={() => { }}
        onClearCanvas={() => setFootprint({})}
      />

      <div className="flex-1 relative" ref={containerRef}>
        {isChartReady && isInitialDataReady && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <CanvasOverlay
              width={dimensions.width}
              height={dimensions.height}
              dpr={dimensions.dpr}
              footprintData={formattedFootprint}
              focusZones={[]}
            />
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-50 backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="animate-pulse font-mono tracking-[0.2em] text-sm text-blue-400 uppercase">
              Syncing Sniper Engine...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};