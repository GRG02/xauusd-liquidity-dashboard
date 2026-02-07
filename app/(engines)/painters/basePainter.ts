// app/(engine)/painters/basePainter.ts
import { TransformationMatrix } from '../../utils/mathUtils';

export abstract class BasePainter {
    protected ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    /**
     * ❌ ยกเลิกการใช้ setTransform แบบเดิม 
     * เพราะเราจะใช้การคำนวณพิกัดแบบ Relative Screen Space ในตัว Painter เอง
     * เพื่อความคมชัดของ Font และความหนึบที่ควบคุมได้ง่ายกว่า
     */
    protected applyWorldTransform(matrix: TransformationMatrix) {
        // ในระบบใหม่เราแทบไม่ต้องใช้ตัวนี้แล้ว 
        // แต่ถ้าจะเก็บไว้ ต้องมั่นใจว่า Painter ลูกไม่ได้คำนวณ screenX/Y ซ้ำ
        this.ctx.save();
    }

    protected restoreTransform() {
        this.ctx.restore();
    }

    /**
     * 💡 ฟังก์ชันช่วยคำนวณพิกัด (Helper) 
     * ย้าย Logic การคำนวณ Relative มาไว้ที่นี่เพื่อให้ Painter ทุกตัวใช้มาตรฐานเดียวกัน
     */
    protected getScreenPos(matrix: TransformationMatrix, t: number, price: number) {
        return {
            x: matrix.e + (t - matrix.refTime) * matrix.a,
            y: matrix.f + (price - matrix.refPrice) * matrix.d
        };
    }

    /**
     * บังคับให้จิตรกรลูกทุกตัวต้องมี Method สำหรับวาด
     */
    abstract paint(matrix: TransformationMatrix, data: any): void;
}