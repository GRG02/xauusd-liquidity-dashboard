// app/(engine)/painters/footprintPainter.ts
import { BasePainter } from './basePainter';
import { TransformationMatrix } from '../../utils/mathUtils';

export interface FootprintData {
    t: number;      
    price: number;  
    buyV: number;   
    sellV: number;  
    isHighV?: boolean; 
}

export class FootprintPainter extends BasePainter {
    paint(matrix: TransformationMatrix, data: FootprintData[]): void {
        if (data.length === 0 || !matrix || matrix.a === 0) return;
        const { ctx } = this;

        const rowHeight = Math.abs(matrix.d); 
        const boxWidth = 50;

        // เตรียมข้อมูลสำหรับการปักธง
        const dataMap = new Map<string, FootprintData>();
        const timeGroups = data.reduce((acc, curr) => {
            dataMap.set(`${curr.t}-${curr.price}`, curr);
            
            if (!acc[curr.t]) acc[curr.t] = { bins: [] as FootprintData[], buy: 0, sell: 0, total: 0, maxBinVol: 0 };
            acc[curr.t].bins.push(curr);
            acc[curr.t].buy += curr.buyV;
            acc[curr.t].sell += curr.sellV;
            acc[curr.t].total += (curr.buyV + curr.sellV);
            
            const binVol = curr.buyV + curr.sellV;
            if (binVol > acc[curr.t].maxBinVol) acc[curr.t].maxBinVol = binVol;
            
            return acc;
        }, {} as Record<number, { bins: FootprintData[], buy: number, sell: number, total: number, maxBinVol: number }>);

        Object.entries(timeGroups).forEach(([timeStr, group]) => {
            const t = Number(timeStr);
            
            // 🎯 1. แก้ไข X: ใช้ Math.round ให้เหมือนจุดไข่ปลา
            const screenX = matrix.e + (t - matrix.refTime) * matrix.a;
            const xPos = Math.round(screenX);

            if (xPos < -boxWidth || xPos > ctx.canvas.width + boxWidth) return;

            let lowestY = -1;

            group.bins.forEach((bin) => {
                // 🎯 2. แก้ไข Y: ใช้ Math.round เพื่อหาจุดกึ่งกลางที่แม่นยำ
                const screenY = matrix.f + (bin.price - matrix.refPrice) * matrix.d;
                const centerY = Math.round(screenY); 
                
                // 🎯 3. Center Alignment: สั่งวาดโดยให้ screenY เป็นจุดกึ่งกลางกล่อง
                // สูตรเดิม: centerY - rowHeight (ผิด เพราะมันจะดันกล่องไปอยู่เหนือเส้น)
                // สูตรใหม่: centerY - (rowHeight / 2) (ถูกต้อง กล่องจะคร่อมเส้นพอดี)
                const yTop = centerY - (rowHeight / 2);

                if (yTop + rowHeight > lowestY) lowestY = yTop + rowHeight;

                // 📊 1. Heatmap Opacity
                const volRatio = group.maxBinVol > 0 ? (bin.buyV + bin.sellV) / group.maxBinVol : 0;
                const bgOpacity = Math.max(0.05, volRatio * 0.4); 

                // --- วาด Heatmap ---
                ctx.fillStyle = `rgba(16, 185, 129, ${bgOpacity})`; 
                ctx.fillRect(xPos - boxWidth / 2, yTop, boxWidth / 2, rowHeight); // ไม่ต้อง Math.ceil rowHeight ตรงนี้เพื่อให้ต่อกันเนียน
                ctx.fillStyle = `rgba(244, 63, 94, ${bgOpacity})`; 
                ctx.fillRect(xPos, yTop, boxWidth / 2, rowHeight);

                // --- เส้นตาราง ---
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                ctx.strokeRect(xPos - boxWidth / 2, yTop, boxWidth, rowHeight);

                // ... (Logic ปักธง เหมือนเดิม) ...
                const upperBin = dataMap.get(`${t}-${bin.price + 1}`);
                const lowerBin = dataMap.get(`${t}-${bin.price - 1}`);
                const isBuyWinner = upperBin ? bin.buyV > upperBin.sellV * 1.5 : false;
                const isSellWinner = lowerBin ? bin.sellV > lowerBin.buyV * 1.5 : false;

                const textOpacity = (isBuyWinner || isSellWinner || bin.buyV + bin.sellV > 500) 
                                    ? 1.0 
                                    : Math.max(0.3, volRatio * 1.0);

                ctx.font = 'bold 10px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;

                // 🎯 4. Text Position: วางที่ centerY ตรงๆ ได้เลย เพราะ textBaseline = 'middle'
                ctx.textAlign = 'right';
                ctx.fillText(Math.round(bin.buyV).toString() + (isBuyWinner ? '🚩' : ''), xPos - 4, centerY);
                
                ctx.textAlign = 'left';
                ctx.fillText((isSellWinner ? '🚩' : '') + Math.round(bin.sellV).toString(), xPos + 4, centerY);
            });

            // ... (Summary วาดเหมือนเดิม) ...
            if (lowestY !== -1) {
                const barDelta = group.buy - group.sell;
                const summaryY = lowestY + 12;
                ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
                ctx.fillRect(xPos - boxWidth / 2, lowestY + 2, boxWidth, 24);
                // ... (Text Summary)
                 ctx.textAlign = 'center';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = barDelta >= 0 ? '#10b981' : '#f43f5e';
                ctx.fillText(`D: ${barDelta > 0 ? '+' : ''}${Math.round(barDelta)}`, xPos, summaryY);
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`V: ${Math.round(group.total).toLocaleString()}`, xPos, summaryY + 11);
            }
        });
    }
}