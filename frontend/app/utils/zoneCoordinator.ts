// app/utils/ZoneCoordinator.ts

export interface ZoneData {
  id: string;
  topPrice: number;
  bottomPrice: number;
  startTime: number;
  endTime: number;
}

export interface RenderPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export class ZoneCoordinator {
  // 🎯 Snap Logic: จุดละ 1 นาที และ 0.2 ราคา
  static snap(price: number, time: number) {
    return {
      price: Math.round(price / 0.2) * 0.2,
      time: Math.floor(time / 60) * 60
    };
  }

  // 🔄 แปลง ZoneData ทั้งหมดเป็นพิกัดพิกเซลบนหน้าจอ
  static getRenderPositions(
    zones: ZoneData[],
    series: any,
    timeScale: any
  ): RenderPosition[] {
    if (!series || !timeScale) return [];

    return zones.map(zone => {
      const yTop = series.priceToCoordinate(zone.topPrice);
      const yBottom = series.priceToCoordinate(zone.bottomPrice);
      const xStart = timeScale.timeToCoordinate(zone.startTime);
      const xEnd = timeScale.timeToCoordinate(zone.endTime);

      // ตรวจสอบว่าพิกัดอยู่บนหน้าจอหรือไม่
      const isVisible = yTop !== null && yBottom !== null && xStart !== null && xEnd !== null;

      return {
        id: zone.id,
        x: Math.min(xStart, xEnd),
        y: Math.min(yTop, yBottom),
        w: Math.abs(xEnd - xStart),
        h: Math.abs(yBottom - yTop),
        visible: isVisible
      };
    });
  }
}