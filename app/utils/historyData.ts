// app/utils/historyData.ts

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BinData {
  buy: number;
  sell: number;
}

export interface FootprintCandle {
  candletime: string;
  bins: Record<number, BinData>;
}

class HistoryDataManager {
  private static instance: HistoryDataManager;
  private ohlcCache: CandleData[] = [];
  private footprintCache: FootprintCandle[] = [];

  private constructor() {}

  public static getInstance(): HistoryDataManager {
    if (!HistoryDataManager.instance) {
      HistoryDataManager.instance = new HistoryDataManager();
    }
    return HistoryDataManager.instance;
  }

  // 1. 🕯️ ดึงราคา OHLC จาก MT5 (สำหรับวาดกราฟแท่งเทียน)
  public async fetchOHLCHistory(count: number = 2000): Promise<CandleData[]> {
    try {
      // API นี้ต้องไปดึงจาก mt5.copy_rates_from_pos ใน Python
      const response = await fetch(`http://127.0.0.1:8000/api/ohlc?count=${count}`);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];

      const cleanedData = data.map((item: any) => ({
        time: item.time, // ตรวจสอบว่าเป็น Unix timestamp (วินาที)
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }));

      this.ohlcCache = cleanedData;
      return cleanedData;
    } catch (err) {
      console.error("Failed to fetch OHLC", err);
      return [];
    }
  }

  // 2. 👣 ดึงรอยเท้าจาก SQLite (สำหรับคำนวณคะแนนในโซน)
  public async fetchFootprintHistory(limit: number = 50): Promise<FootprintCandle[]> {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/history?limit=${limit}`);
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];

      const cleanedData: FootprintCandle[] = data.map((item: any) => ({
        candletime: item.candletime,
        bins: item.bins,
      }));

      this.footprintCache = cleanedData.reverse(); 
      return this.footprintCache;
    } catch (err) {
      console.error("Failed to fetch Footprint", err);
      return [];
    }
  }

  public getOHLCCache() { return this.ohlcCache; }
  
  public getFootprintAsMap(): Record<string, Record<number, BinData>> {
    const map: Record<string, Record<number, BinData>> = {};
    this.footprintCache.forEach(c => { map[c.candletime] = c.bins; });
    return map;
  }
}

export const historyManager = HistoryDataManager.getInstance();