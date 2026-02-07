// app/(engine)/painters/focusProfilePainter.ts
import { BasePainter } from './basePainter';
import { TransformationMatrix } from '../../utils/mathUtils';

export interface FocusZoneData {
    id: string;
    startTime: number;
    endTime?: number;
    highPrice: number;
    lowPrice: number;
    color?: string;
    // ข้อมูล Profile เฉพาะเจาะจงในโซนที่โฟกัส
    profiles?: { price: number; volume: number; side: 'buy' | 'sell' }[]; 
}

export class FocusProfilePainter extends BasePainter {
    /**
     * @param matrix Transformation Matrix จาก WorldSpaceEngine
     * @param zones รายการโซนที่ต้องการเน้น (Focus Zones)
     */
    paint(matrix: TransformationMatrix, zones: FocusZoneData[]): void {
        if (zones.length === 0) return;

        // 1. เข้าสู่โลก World Space (Price/Time)
        this.applyWorldTransform(matrix);

        zones.forEach(zone => {
            const { startTime, endTime, highPrice, lowPrice, color, profiles } = zone;
            const finalEndTime = endTime || Date.now() / 1000;
            
            const width = finalEndTime - startTime;
            const height = highPrice - lowPrice;

            // --- วาดพื้นหลังโซนโฟกัส ---
            this.ctx.fillStyle = color || 'rgba(147, 51, 234, 0.15)'; 
            this.ctx.fillRect(startTime, lowPrice, width, height);

            // --- วาดขอบเน้น (Focus Border) ---
            this.ctx.strokeStyle = color ? color.replace('0.15', '0.4') : 'rgba(147, 51, 234, 0.4)';
            this.ctx.lineWidth = 0.03; 
            this.ctx.strokeRect(startTime, lowPrice, width, height);

            // --- วาด Detailed Profile ภายในโซนที่โฟกัส ---
            if (profiles && profiles.length > 0) {
                const maxVol = Math.max(...profiles.map(p => p.volume));
                
                profiles.forEach(p => {
                    const barWidth = (p.volume / maxVol) * (width * 0.4); // ยาว 40% ของโซน
                    
                    // แยกสีตามฝั่ง Buy/Sell ใน Profile
                    this.ctx.fillStyle = p.side === 'buy' 
                        ? 'rgba(16, 185, 129, 0.2)' 
                        : 'rgba(239, 68, 68, 0.2)';
                    
                    this.ctx.fillRect(startTime, p.price, barWidth, 0.1); 
                });
            }
        });

        // 2. ออกจาก World Space
        this.restoreTransform();
    }
}