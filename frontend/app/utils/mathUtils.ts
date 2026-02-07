// app/utils/mathUtils.ts
export interface TransformationMatrix {
    a: number; d: number; e: number; f: number;
    refTime: number;    // 👈 เพิ่มเพื่อใช้ลบพิกัด X
    refPrice: number;   // 👈 เพิ่มเพื่อใช้ลบพิกัด Y
}

// app/utils/mathUtils.ts

export const createTransformationMatrix = (
    timeToPixel: (time: number) => number | null,
    priceToPixel: (price: number) => number | null,
    referenceTime: number,
    referencePrice: number
): TransformationMatrix | null => {
    const x0 = timeToPixel(referenceTime);
    const y0 = priceToPixel(referencePrice);
    
    if (x0 === null || y0 === null) return null;

    // 📏 กลยุทธ์วัดระยะแบบ Adaptive (แก้ปัญหาซูมเข้าแล้ว x1 เป็น null)
    let x1 = timeToPixel(referenceTime + 3600); // ลอง 1 ชม.
    let divisor = 3600;

    if (x1 === null) {
        x1 = timeToPixel(referenceTime + 60); // ถ้า 1 ชม. หลุดจอ ลองแค่ 1 นาที
        divisor = 60;
    }

    if (x1 === null) {
        // 🚨 ถ้ายัง null อีก (ซูมลึกสุดๆ) ให้ลองหาพิกัดถัดไป 1 วินาที 
        // หรือใช้ค่าความกว้างเฉลี่ยของ TimeScale
        x1 = timeToPixel(referenceTime + 1);
        divisor = 1;
    }

    // ถ้ายังไม่ได้อีกจริงๆ ให้คืนค่า null เพื่อรอจังหวะถัดไป
    if (x1 === null || x1 === x0) return null;

    // สำหรับราคา (Y) ก็เช่นกัน
    let y1 = priceToPixel(referencePrice + 1);
    let yDivisor = 1;
    
    if (y1 === null) {
        y1 = priceToPixel(referencePrice - 1);
        yDivisor = -1;
    }

    if (y1 === null) return null;

    return {
        a: (x1 - x0) / divisor, 
        d: (y1 - y0) / yDivisor, 
        e: x0, // ❌ ห้าม Math.round(x0) ตรงนี้ครับ! จะทำให้ Canvas กระตุกตอนเลื่อน
        f: y0, 
        refTime: referenceTime,
        refPrice: referencePrice
    };
};