// app/(hook)/useCoordinateSync.ts
import { useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { worldSpaceEngine } from '../(engines)/worldSpaceEngine';
import { createTransformationMatrix } from '../utils/mathUtils';

export const useCoordinateSync = (
    chart: IChartApi | null,
    series: ISeriesApi<"Candlestick"> | null,
    isInitialDataReady: boolean
) => {
    useEffect(() => {
        if (!chart || !series || !isInitialDataReady) return;

        const timeScale = chart.timeScale();

        const updateMatrix = () => {
            // ✅ ใน v5 ใช้ getVisibleRange() เพื่อเอาเวลาขอบจอ
            const visibleRange = timeScale.getVisibleRange();
            if (!visibleRange || visibleRange.from === null) return;

            const anchorTime = visibleRange.from as number;
            
            // ✅ ราคา (Y) ใช้จาก series.coordinateToPrice
            // ถามที่พิกัด 0 (ขอบบนของจอ)
            const anchorPrice = series.coordinateToPrice(0);
            if (anchorPrice === null) return;

            const xPos = timeScale.timeToCoordinate(anchorTime as any);
            if (xPos === null) return;

            // 🔍 สร้าง Matrix ใหม่ทุกครั้งที่ขยับ
            const newMatrix = createTransformationMatrix(
                (t) => timeScale.timeToCoordinate(t as any),
                (p) => series.priceToCoordinate(p),
                anchorTime,
                Number(anchorPrice)
            );

            if (newMatrix) {
                worldSpaceEngine.updateMatrix(newMatrix);
            }
        };

        // 🔗 หัวใจของ v5: ต้อง Subscribe 'LogicalRange' เพื่อให้มันทำงานตอนซูมละเอียด
        timeScale.subscribeVisibleLogicalRangeChange(updateMatrix);
        
        // 🔗 ทำงานตอนเลื่อนซ้าย-ขวา
        timeScale.subscribeVisibleTimeRangeChange(updateMatrix);

        updateMatrix();

        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(updateMatrix);
            timeScale.unsubscribeVisibleTimeRangeChange(updateMatrix);
        };
    }, [chart, series, isInitialDataReady]);
};