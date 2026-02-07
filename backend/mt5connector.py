import sqlite3
import os
import math
import json
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import MetaTrader5 as mt5
import asyncio
import uvicorn

app = FastAPI()

# 1. CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database & Manager
class TradingDB:
    def __init__(self, db_path="D:/TradingData"):
        self.db_path = db_path
        if not os.path.exists(db_path):
            os.makedirs(db_path)
        self.conn = None
        self.current_date = ""

    def get_connection(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if self.current_date != today:
            if self.conn: self.conn.close()
            db_file = os.path.join(self.db_path, f"{today}_XAUUSD.db")
            self.conn = sqlite3.connect(db_file)
            self.create_tables()
            self.current_date = today
        return self.conn

    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS footprint_history 
                          (candletime DATETIME PRIMARY KEY, bins_json TEXT)''')
        self.conn.commit()

    def update_footprint(self, candle_time, bin_id, buy_val, sell_val):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT bins_json FROM footprint_history WHERE candletime = ?", (candle_time,))
        row = cursor.fetchone()
        bins_data = json.loads(row[0]) if row else {}
        bin_str = str(bin_id)
        if bin_str not in bins_data: bins_data[bin_str] = {"buy": 0, "sell": 0}
        bins_data[bin_str]["buy"] += buy_val
        bins_data[bin_str]["sell"] += sell_val
        cursor.execute('''INSERT INTO footprint_history (candletime, bins_json) 
                          VALUES (?, ?) ON CONFLICT(candletime) DO UPDATE SET 
                          bins_json = EXCLUDED.bins_json''', (candle_time, json.dumps(bins_data)))
        conn.commit()

    def get_last_history(self, limit=50):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT candletime, bins_json FROM footprint_history ORDER BY candletime DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [{"candletime": r[0], "bins": json.loads(r[1])} for r in rows]

    # 🔥 ระบบใหม่: ขุดข้อมูลเฉพาะช่วงราคา (Zone Scanner)
    def get_zone_profile(self, p_top: float, p_bottom: float, bar_limit: int = 100):
        now = datetime.now()
        dates_to_scan = [(now - timedelta(days=1)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")]
        
        zone_profile = {}
        max_vol = 0
        
        # กรองราคาให้เป็น Integer (Bin) เพื่อความแม่นยำในการ Match
        top_bin = math.floor(p_top)
        bottom_bin = math.floor(p_bottom)

        for date_str in dates_to_scan:
            db_file = os.path.join(self.db_path, f"{date_str}_XAUUSD.db")
            if os.path.exists(db_file):
                try:
                    with sqlite3.connect(db_file) as temp_conn:
                        cursor = temp_conn.cursor()
                        # ดึงประวัติย้อนหลังตามจำนวนแท่งที่ Web ร้องขอ
                        cursor.execute("SELECT bins_json FROM footprint_history ORDER BY candletime DESC LIMIT ?", (bar_limit,))
                        rows = cursor.fetchall()
                        for row in rows:
                            bins_data = json.loads(row[0])
                            for price_str, data in bins_data.items():
                                p = int(price_str)
                                # 🔥 Scan เฉพาะราคาที่อยู่ใน Zone
                                if bottom_bin <= p <= top_bin:
                                    if p not in zone_profile:
                                        zone_profile[p] = {"buy": 0, "sell": 0, "total": 0}
                                    
                                    zone_profile[p]["buy"] += data["buy"]
                                    zone_profile[p]["sell"] += data["sell"]
                                    zone_profile[p]["total"] += (data["buy"] + data["sell"])
                                    
                                    if zone_profile[p]["total"] > max_vol:
                                        max_vol = zone_profile[p]["total"]
                except Exception as e:
                    print(f"Zone Scan Error ({date_str}): {e}")
        
        return {"max_vol": max_vol, "profile": zone_profile, "p_top": p_top, "p_bottom": p_bottom}

db_manager = TradingDB()

# 3. WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        history = db_manager.get_last_history(30)
        tick = mt5.symbol_info_tick("XAUUSD.iux")
        await websocket.send_json({
            "type": "INIT_DATA",
            "history": history,
            "current_price": tick.bid if tick else 0
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections[:]:
            try: await connection.send_json(message)
            except: self.disconnect(connection)

manager = ConnectionManager()

# 4. State Management
state = {"last_price": 0.0, "last_time_msc": 0}

# 5. Core Logic
async def price_broadcaster():
    if not mt5.initialize(): return
    symbol = "XAUUSD.iux"
    while True:
        tick = mt5.symbol_info_tick(symbol)
        if tick and tick.time_msc != state["last_time_msc"]:
            current_price = tick.bid
            candle_time = datetime.now().replace(second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:00")
            
            if state["last_price"] != 0:
                vel = round(current_price - state["last_price"], 2)
                if vel != 0:
                    scaled_abs_vel = int(abs(vel) * 100)
                    prev_bin, curr_bin = math.floor(state["last_price"]), math.floor(current_price)
                    update_payload = []
                    
                    if prev_bin == curr_bin:
                        db_manager.update_footprint(candle_time, curr_bin, (scaled_abs_vel if vel > 0 else 0), (scaled_abs_vel if vel < 0 else 0))
                        update_payload.append({"bin": curr_bin, "buy": (scaled_abs_vel if vel > 0 else 0), "sell": (scaled_abs_vel if vel < 0 else 0)})
                    else:
                        boundary = float(curr_bin) if vel > 0 else float(prev_bin)
                        p_old = int(abs(boundary - state["last_price"]) * 100)
                        p_new = scaled_abs_vel - p_old
                        side = "buy" if vel > 0 else "sell"
                        db_manager.update_footprint(candle_time, prev_bin, (p_old if side=="buy" else 0), (p_old if side=="sell" else 0))
                        db_manager.update_footprint(candle_time, curr_bin, (p_new if side=="buy" else 0), (p_new if side=="sell" else 0))
                        update_payload.append({"bin": prev_bin, "buy": (p_old if side=="buy" else 0), "sell": (p_old if side=="sell" else 0)})
                        update_payload.append({"bin": curr_bin, "buy": (p_new if side=="buy" else 0), "sell": (p_new if side=="sell" else 0)})

                    await manager.broadcast({
                        "type": "POWER_UPDATE",
                        "candletime": candle_time,
                        "price": current_price,
                        "vel": vel,
                        "updates": update_payload
                    })
            
            state["last_price"] = current_price
            state["last_time_msc"] = tick.time_msc
        await asyncio.sleep(0.01)

# --- 🎯 API Endpoints ---

@app.get("/api/history")
async def get_history(limit: int = 50):
    return db_manager.get_last_history(limit)

@app.get("/api/ohlc")
async def get_ohlc(count: int = 1000):
    if not mt5.initialize(): return []
    rates = mt5.copy_rates_from_pos("XAUUSD.iux", mt5.TIMEFRAME_M1, 0, count)
    if rates is None: return []
    return [{"time": int(r['time']), "open": float(r['open']), "high": float(r['high']), "low": float(r['low']), "close": float(r['close'])} for r in rates]

# 🔥 API ใหม่: รับค่าช่วงราคาจาก Web แล้วส่ง Profile กลับไป
@app.get("/api/zone-profile")
async def get_zone_profile(p_top: float, p_bottom: float, bars: int = 100):
    """
    ดึงวอลลุ่มสะสมเฉพาะโซนที่กำหนด
    Usage: /api/zone-profile?p_top=2050&p_bottom=2040&bars=200
    """
    try:
        return db_manager.get_zone_profile(p_top, p_bottom, bars)
    except Exception as e:
        return {"error": str(e)}

@app.on_event("startup")
async def startup():
    asyncio.create_task(price_broadcaster())

@app.websocket("/ws/price")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)