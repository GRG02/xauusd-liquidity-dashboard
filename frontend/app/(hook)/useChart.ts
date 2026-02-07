// app/(hooks)/useChart.ts
import { useEffect, useRef, useState } from 'react';
import { 
    createChart, 
    IChartApi, 
    ISeriesApi, 
    CandlestickSeries, 
} from 'lightweight-charts';

export const useChart = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    // ใช้ useState เก็บ API แทน useRef ในการ Return เพื่อให้ Component อื่น Re-render เมื่อมันพร้อม
    const [chartApi, setChartApi] = useState<IChartApi | null>(null);
    const [seriesApi, setSeriesApi] = useState<ISeriesApi<"Candlestick"> | null>(null);
    const [isChartReady, setIsChartReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        // 🔥 จุดสำคัญ: ต้องคำนวณขนาดปัจจุบันก่อนสร้าง
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // 1. สร้าง Instance ของชาร์ตพร้อมระบุขนาด
        const chart = createChart(containerRef.current, {
            width: width || 800, // ป้องกันกรณีค่าเป็น 0
            height: height || 600,
            layout: {
                background: { color: '#020617' },
                textColor: '#94a3b8',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                barSpacing: 25,
            },
        });

        // 2. การสร้าง Series
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        // เก็บลง State เพื่อให้ Hook ส่งค่าใหม่ไปหา Container
        setChartApi(chart);
        setSeriesApi(candlestickSeries);
        setIsChartReady(true);

        // 3. จัดการเรื่อง Resize
        const handleResize = () => {
            if (containerRef.current) {
                chart.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            setIsChartReady(false);
        };
    }, [containerRef]);

    return {
        chart: chartApi,
        series: seriesApi,
        isChartReady
    };
};