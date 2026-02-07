// app/page.tsx
'use client';

import { ChartContainer } from './components/LiqMap/ChartContainer';

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-black">
      {/* เราเรียกใช้ ChartContainer ตัวเดียวจบ 
         เพราะข้างในมันจัดการทั้ง Header, Chart และ Canvas ไว้ให้แล้วครับกัปตัน
      */}
      <ChartContainer />
    </main>
  );
}