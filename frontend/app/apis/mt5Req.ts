import { useState, useEffect, useRef, useCallback } from 'react';

// --- 1. Interfaces ---
interface PowerUpdate {
  bin: number;
  buy: number;
  sell: number;
}

interface FootprintHistoryItem {
  candletime: string;
  bins: Record<number, { buy: number; sell: number }>;
}

interface FootprintMessage {
  type: "POWER_UPDATE" | "INIT_DATA";
  history?: FootprintHistoryItem[];
  current_price?: number;
  candletime?: string;
  price?: number;
  vel?: number;
  updates?: PowerUpdate[];
}

// โครงสร้างข้อมูลสำหรับ Profile เฉพาะโซน
export interface ZoneProfileData {
  max_vol: number;
  profile: Record<number, { buy: number; sell: number; total: number }>;
  p_top: number;
  p_bottom: number;
}

export type BinData = { buy: number; sell: number };
export type CandleMap = Record<string, Record<number, BinData>>;

export const useOandaStream = (url: string) => {
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [velocity, setVelocity] = useState<number>(0);
  const [footprint, setFootprint] = useState<CandleMap>({});
  
  // 🔥 State สำหรับเก็บข้อมูล Profile ของโซนที่เลือก
  const [zoneProfile, setZoneProfile] = useState<ZoneProfileData | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  // --- 🔥 ฟังก์ชันใหม่: สั่ง Python ให้ขุดข้อมูลเฉพาะโซน ---
  const fetchZoneProfile = useCallback(async (pTop: number, pBottom: number, bars: number = 100) => {
    setIsScanning(true);
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/zone-profile?p_top=${pTop}&p_bottom=${pBottom}&bars=${bars}`
      );
      const data = await response.json();
      setZoneProfile(data);
      console.log(`✅ Zone Scanned: ${Object.keys(data.profile).length} levels found.`);
    } catch (err) {
      console.error("❌ Failed to fetch zone profile:", err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // --- WebSocket Logic ---
  useEffect(() => {
    if (!url) return;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const msg: FootprintMessage = JSON.parse(event.data);
        
        if (msg.type === "INIT_DATA" && msg.history) {
          console.log("📜 Initializing History Data...");
          setLivePrice(msg.current_price || null);
          const historyMap: CandleMap = {};
          msg.history.forEach(item => {
            historyMap[item.candletime] = item.bins;
          });
          setFootprint(historyMap);
        }

        if (msg.type === "POWER_UPDATE" && msg.updates && msg.candletime) {
          setLivePrice(msg.price ?? livePrice);
          setVelocity(msg.vel ?? 0);

          setFootprint(prev => {
            const timeKey = msg.candletime!;
            const newCandleMap = { ...prev };
            if (!newCandleMap[timeKey]) newCandleMap[timeKey] = {};

            msg.updates!.forEach(update => {
              const bKey = update.bin;
              const currentBinData = newCandleMap[timeKey][bKey] || { buy: 0, sell: 0 };
              newCandleMap[timeKey][bKey] = {
                buy: currentBinData.buy + update.buy,
                sell: currentBinData.sell + update.sell
              };
            });

            const keys = Object.keys(newCandleMap).sort();
            if (keys.length > 50) {
              keys.slice(0, keys.length - 50).forEach(k => delete newCandleMap[k]);
            }
            return newCandleMap;
          });
        }
      } catch (err) {
        console.error("❌ Error parsing data:", err);
      }
    };

    socket.onclose = () => console.log("🔴 Sniper Stream Disconnected");
    return () => { if (socketRef.current) socketRef.current.close(); };
  }, [url]);

  return { 
    livePrice, 
    velocity, 
    footprint, 
    zoneProfile,    // ข้อมูล Profile เฉพาะโซน
    fetchZoneProfile, // ฟังก์ชันสำหรับสั่ง Scan
    isScanning      // สถานะว่ากำลังโหลดอยู่ไหม
  };
};