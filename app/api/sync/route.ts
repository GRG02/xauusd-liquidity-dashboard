import { fetchOandaBook } from '@/app/lib/oandaFetcher'
import { supabase } from '@/app/lib/supabaseClient';
import { INSTRUMENT_MAP } from '@/app/utils/constants';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const types: ('ORDER' | 'POSITION')[] = ['ORDER', 'POSITION'];
    let syncResults = []; // สร้างตัวแปรมาเก็บผลลัพธ์เพื่อส่งกลับไปโชว์

    for (const type of types) {
      // 1. ดึงข้อมูลและเก็บไว้ในตัวแปร data
      const data = await fetchOandaBook('XAUUSD', type);
      const table = type === 'ORDER' ? 'order_tb' : 'position_tb';

      // 2. บันทึกลง Supabase (ตาม Schema ที่คุณตั้งไว้)
      await supabase.from(table).insert({
        oanda_time: data.time,
        instrument: INSTRUMENT_MAP['XAUUSD'],
        bucket_width: data.bucketWidth,
        current_price: data.price,
        buckets_data: data.buckets
      });

      // 3. เก็บข้อมูลใส่ Array เพื่อส่งไป debug ที่หน้าจอ
      syncResults.push({ type, time: data.time, bucketCount: data.buckets.length, raw: data });
    }

    // ส่งกลับไปให้หน้า Frontend
    return NextResponse.json({ 
      message: 'Sync Completed', 
      results: syncResults // ตอนนี้ใน Console จะเห็นข้อมูลครบแล้วครับ!
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}