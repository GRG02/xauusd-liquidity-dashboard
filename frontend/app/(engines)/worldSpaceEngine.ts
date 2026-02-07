// app/(engines)/worldSpaceEngine.ts
import { TransformationMatrix } from '../utils/mathUtils';

export class WorldSpaceEngine {
    private matrix: TransformationMatrix | null = null;
    private listeners: Array<(matrix: TransformationMatrix) => void> = [];

    /**
     * อัปเดต Matrix เมื่อชาร์ตมีการเลื่อนหรือซูม
     */
    updateMatrix(newMatrix: TransformationMatrix | null) {
        if (!newMatrix) return;

        // 🛡️ ป้องกันค่า 0 หรือค่าที่ไม่สมบูรณ์หลุดเข้าไป (สาเหตุหลักที่ทำให้ลอยชิดขอบ)
        if (newMatrix.a === 0 || newMatrix.d === 0) return;
        
        // เปรียบเทียบเฉพาะค่าที่จำเป็นเพื่อความเร็ว (แทน JSON.stringify)
        const isChanged = !this.matrix || 
            this.matrix.a !== newMatrix.a || 
            this.matrix.d !== newMatrix.d ||
            this.matrix.e !== newMatrix.e || 
            this.matrix.f !== newMatrix.f ||
            this.matrix.refTime !== newMatrix.refTime ||
            this.matrix.refPrice !== newMatrix.refPrice;

        if (isChanged) {
            this.matrix = newMatrix;
            this.notifyListeners();
        }
    }

    getMatrix(): TransformationMatrix | null {
        return this.matrix;
    }

    subscribe(callback: (matrix: TransformationMatrix) => void) {
        this.listeners.push(callback);
        // ⚡ ถ้ามี Matrix อยู่แล้ว ให้ส่งให้ Painter ทันทีที่กด Subscribe (แก้บัคต้องเลื่อนกราฟก่อนถึงจะมา)
        if (this.matrix) {
            callback(this.matrix);
        }
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notifyListeners() {
        if (this.matrix) {
            // ใช้ requestAnimationFrame เพื่อให้แน่ใจว่าการแจ้งเตือนสอดคล้องกับรอบการเรนเดอร์ของจอ
            requestAnimationFrame(() => {
                this.listeners.forEach(listener => {
                    if (this.matrix) listener(this.matrix);
                });
            });
        }
    }
}

export const worldSpaceEngine = new WorldSpaceEngine();