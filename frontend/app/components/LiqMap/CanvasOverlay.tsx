// app/components/LiqMap/CanvasOverlay.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { worldSpaceEngine } from '../../(engines)/worldSpaceEngine';
import { FootprintPainter } from '../../(engines)/painters/footprintPainter';
import { FocusProfilePainter } from '../../(engines)/painters/focusProfilePainter';

interface CanvasOverlayProps {
    width: number;
    height: number;
    dpr: number; // รับค่า Device Pixel Ratio มาจาก Container
    footprintData: any[];
    focusZones: any[];
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
    width,
    height,
    dpr,
    footprintData,
    focusZones
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const paintersRef = useRef<{
        footprint: FootprintPainter | null;
        focusProfile: FocusProfilePainter | null;
    }>({ footprint: null, focusProfile: null });

    const render = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const matrix = worldSpaceEngine.getMatrix();

        if (!canvas || !ctx || !matrix) return;

        // 🎯 1. จัดการความละเอียดของ Canvas ให้ตรงกับจอ (Pixel Perfect)
        // ปรับ internal buffer ให้ใหญ่ตาม dpr แต่ขนาดบนหน้าจอยังเท่าเดิม
        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        // รีเซ็ตสเกลและล้างจอ
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        if (!paintersRef.current.footprint) paintersRef.current.footprint = new FootprintPainter(ctx);
        if (!paintersRef.current.focusProfile) paintersRef.current.focusProfile = new FocusProfilePainter(ctx);

        // 🏗️ 2. วาด Grid จุดไข่ปลา และ Debug Time
        ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.font = '12px JetBrains Mono, monospace'; // ใช้ Font ให้อ่านง่าย

        const startTime = matrix.refTime - Math.ceil(matrix.e / matrix.a);
        const endTime = startTime + Math.ceil(width / matrix.a) + 60;
        const startPrice = matrix.refPrice - Math.ceil(matrix.f / matrix.d);
        const endPrice = startPrice + Math.ceil(height / matrix.d) - 10;

        for (let t = Math.floor(startTime / 60) * 60; t <= endTime; t += 60) {
            // 🕵️ เช็คว่าเป็นต้นชั่วโมงไหม (ทุก 3600 วินาที)
            const isFullHour = t % 3600 === 0;

            for (let p = Math.floor(startPrice); p >= endPrice; p -= 1) {
                const x = Math.round(matrix.e + (t - matrix.refTime) * matrix.a);
                const y = Math.round(matrix.f + (p - matrix.refPrice) * matrix.d);

                if (x >= 0 && x <= width && y >= 0 && y <= height) {
                    // วาดจุดไข่ปลาปกติ
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, Math.PI * 2);
                    ctx.fill();

                    // 🎯 ถ้าเป็นต้นชั่วโมง ให้พ่นเลขชั่วโมงออกมา (วาดที่แถวบนๆ เพื่อให้สังเกตง่าย)
                    if (isFullHour && p === Math.floor(startPrice) - 5) {
                        const hour = new Date(t * 1000).getHours();
                        ctx.save();
                        ctx.fillStyle = '#fbbf24'; // สีสว่างกว่าจุด
                        ctx.fillText(`${hour}h`, x + 4, y - 4);

                        // วาดเส้นแนวดิ่ง Debug ต้นชั่วโมง
                        ctx.strokeStyle = 'rgba(251, 191, 36, 0.2)';
                        ctx.beginPath();
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, height);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }

        // 🏗️ 3. วาดข้อมูลจริง
        paintersRef.current.focusProfile.paint(matrix, focusZones);

        if (footprintData.length > 0) {
            paintersRef.current.footprint.paint(matrix, footprintData);
        }
    }, [footprintData, focusZones, width, height, dpr]);

    // app/components/LiqMap/CanvasOverlay.tsx

    useEffect(() => {
        const unsubscribe = worldSpaceEngine.subscribe(() => {
            requestAnimationFrame(render);
        });
        render(); // วาดทันที
        return () => unsubscribe();
    }, [render, width, height, footprintData]); // 🔥 ต้องมี footprintData ตรงนี้ด้วย!

    return (
        <canvas
            ref={canvasRef}
            // 🎯 กำหนดขนาดผ่าน Style แทน Attribute เพื่อให้ CSS จัดการเรื่อง dpr layout
            style={{
                width: `${width}px`,
                height: `${height}px`,
                imageRendering: 'pixelated', // บังคับให้ขอบคมชัดที่สุด
            }}
            className="absolute top-0 left-0 z-20 pointer-events-none"
        />
    );
};