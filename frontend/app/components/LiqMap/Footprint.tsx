"use client";

import React, { useMemo } from 'react';
import { ISeriesApi } from 'lightweight-charts';

interface BinData {
  buy: number;
  sell: number;
}

interface FootprintProps {
  footprint: Record<string, Record<number, BinData>>;
  series: ISeriesApi<"Candlestick"> | null;
  chart: any;
}

export const Footprint = ({ footprint, series, chart }: FootprintProps) => {
  if (!series || !chart) return null;

  const timeScale = chart.timeScale();
  const seriesData = series.data();
  if (seriesData.length === 0) return null;

  const lastBar = seriesData[seriesData.length - 1];
  const lastBarTime = Number(lastBar.time);

  // 1. คำนวณความสูงช่องราคา 1.0$
  const rowHeight = useMemo(() => {
    const p1 = series.priceToCoordinate(5000);
    const p2 = series.priceToCoordinate(5001);
    if (p1 !== null && p2 !== null) return Math.round(Math.abs(p1 - p2));
    return 20; 
  }, [series, chart]);

  const maxVolInView = useMemo(() => {
    let max = 1;
    Object.values(footprint).forEach(bins => {
      Object.values(bins).forEach(d => {
        const total = d.buy + d.sell;
        if (total > max) max = total;
      });
    });
    return max;
  }, [footprint]);

  return (
    <g>
      {Object.entries(footprint).map(([time, bins]) => {
        const dateObj = new Date(time);
        const unixTime = Math.floor(dateObj.getTime() / 1000);
        
        let x = timeScale.timeToCoordinate(unixTime as any);
        if (unixTime === lastBarTime || x === null) {
          x = timeScale.timeToCoordinate(lastBar.time);
        }

        if (x === null || x < -100 || x > chart.options().width + 100) return null;

        const boxWidth = 50; 

        // --- 📊 คำนวณ Delta & Total ของแท่งนี้ ---
        let barTotal = 0;
        let barBuy = 0;
        let barSell = 0;
        let minPriceY = -9999; // เก็บตำแหน่ง Y ล่างสุดเพื่อวาด Summary

        Object.entries(bins).forEach(([price, data]) => {
          barBuy += data.buy;
          barSell += data.sell;
          barTotal += (data.buy + data.sell);
          const y = series.priceToCoordinate(Number(price));
          if (y !== null && y > minPriceY) minPriceY = y;
        });
        const barDelta = barBuy - barSell;

        return (
          <g key={time} transform={`translate(${Math.round(x)}, 0)`}>
            {Object.entries(bins).map(([price, data]) => {
              const priceNum = Number(price);
              const rawY = series.priceToCoordinate(priceNum);
              if (rawY === null) return null;
              const yCenter = Math.round(rawY);

              const totalVol = data.buy + data.sell;
              const intensity = Math.min(totalVol / maxVolInView, 1);
              
              // 🟢 Logic สีตัวหนังสือ: ถ้า Intensity (ความเข้มพื้นหลัง) เกิน 0.5 ให้ใช้สีขาวสว่าง
              const getTextColor = (baseColor: string, isDominant: boolean) => {
                if (intensity > 0.6) return "#ffffff"; // พื้นหลังเข้มมาก ใช้ขาวล้วน
                return isDominant ? baseColor : "#cbd5e1";
              };

              const isBuyDominant = data.buy > data.sell * 2.5 && data.buy > 10;
              const isSellDominant = data.sell > data.buy * 3 && data.sell > 10;

              return (
                <g key={price} transform={`translate(0, ${yCenter})`} className="select-none">
                  <rect 
                    x={-boxWidth/2} y={-(rowHeight / 2)} 
                    width={boxWidth/2} height={rowHeight} 
                    fill={`rgba(16, 185, 129, ${0.1 + intensity * 0.5})`}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth="0.5"
                    shapeRendering="crispEdges"
                  />
                  <rect 
                    x="0" y={-(rowHeight / 2)} 
                    width={boxWidth/2} height={rowHeight} 
                    fill={`rgba(244, 63, 94, ${0.1 + intensity * 0.5})`}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth="0.5"
                    shapeRendering="crispEdges"
                  />

                  {/* ตัวเลข Buy */}
                  <text 
                    x="-4" y="3" 
                    textAnchor="end" fontSize="8" 
                    fill={getTextColor("#10b981", isBuyDominant)}
                    fontWeight={isBuyDominant || intensity > 0.6 ? "bold" : "normal"}
                  >
                    {Math.round(data.buy)}
                  </text>
                  
                  <text x="0" y="2.5" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.2)">|</text>

                  {/* ตัวเลข Sell */}
                  <text 
                    x="4" y="3" 
                    textAnchor="start" fontSize="8" 
                    fill={getTextColor("#f43f5e", isSellDominant)}
                    fontWeight={isSellDominant || intensity > 0.6 ? "bold" : "normal"}
                  >
                    {Math.round(data.sell)}
                  </text>
                </g>
              );
            })}

            {/* 🟢 ส่วนแสดง Delta & Total ด้านล่างแท่งเทียน [Image of Order Flow Summary] */}
            {minPriceY !== -9999 && (
              <g transform={`translate(0, ${minPriceY + rowHeight})`}>
                {/* พื้นหลัง Summary */}
                <rect x={-boxWidth/2} y="5" width={boxWidth} height="22" fill="rgba(15, 23, 42, 0.8)" rx="2" />
                
                {/* Delta */}
                <text x="0" y="14" textAnchor="middle" fontSize="20" fontWeight="bold" 
                  fill={barDelta >= 0 ? "#10b981" : "#f43f5e"}>
                  D: {barDelta > 0 ? `+${barDelta}` : barDelta}
                </text>
                
                {/* Total Volume */}
                <text x="0" y="23" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#94a3b8">
                  T: {barTotal.toLocaleString()}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
};