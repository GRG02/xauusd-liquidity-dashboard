// app/utils/priceDataProvider.ts

export interface PowerUpdate {
    bin: number;
    buy: number;
    sell: number;
}

// ปรับ Interface ให้รองรับข้อมูลที่หลากหลายขึ้น
export interface TickData {
    type: "POWER_UPDATE" | "INIT_DATA";
    bid: number;
    velocity: number;
    candletime?: string;
    updates?: PowerUpdate[]; // รอยเท้าใหม่ที่เกิดขึ้น
    history?: any[];        // ข้อมูลประวัติศาสตร์ตอนเริ่มต้น
    time_msc: number;
}

 class PriceManager {
    private static instance: PriceManager;
    private ws: WebSocket | null = null;
    private listeners: ((data: TickData) => void)[] = [];

    private constructor() { }

    public static getInstance(): PriceManager {
        if (!PriceManager.instance) {
            PriceManager.instance = new PriceManager();
        }
        return PriceManager.instance;
    }

    /**
     * 🛰️ จัดการการเชื่อมต่อ WebSocket
     */
    public connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.ws = new WebSocket('ws://127.0.0.1:8000/ws/price');

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // ตรวจสอบโครงสร้างข้อมูลใหม่จาก Python
                const price = data.price !== undefined ? data.price : (data.current_price || 0);
                
                // กระจายข้อมูลไปยังผู้ติดตาม (Subscribers)
                this.notify({
                    type: data.type,
                    bid: price,
                    velocity: data.vel || 0,
                    candletime: data.candletime,
                    updates: data.updates || [],
                    history: data.history || [],
                    time_msc: Date.now() 
                });
                
            } catch (e) {
                console.error("❌ WS Message Error:", e);
            }
        };

        this.ws.onerror = (error) => {
            console.error("❌ WS Connection Error:", error);
        };

        this.ws.onclose = () => {
            console.warn("⚠️ WS Connection Closed. Reconnecting in 3s...");
            this.ws = null;
            setTimeout(() => this.connect(), 3000);
        };
    }

    /**
     * 📢 ระบบ Observer: ให้คอมโพเนนต์ต่างๆ มาติดตามราคาและ Footprint ได้
     */
    public subscribe(callback: (data: TickData) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify(data: TickData) {
        this.listeners.forEach(callback => callback(data));
    }
}

export const priceManager = PriceManager.getInstance();