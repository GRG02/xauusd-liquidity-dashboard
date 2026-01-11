import axios from 'axios';

export const fetchOandaBook = async (instrument: string, bookType: 'ORDER' | 'POSITION') => {
  try {
    // ตรวจสอบก่อนว่า ENV มาครบไหม
    if (!process.env.OANDA_COOKIE) {
      throw new Error('OANDA_COOKIE is missing in .env.local');
    }

    const response = await axios.post(
      'https://labs-api.oanda.com/graphql',
      {
        // ใช้ Query string แบบสะอาดๆ
        query: `query GetOrderPositionBook($instrument: String!, $bookType: BookType!, $recentHours: Int) {
          orderPositionBook(instrument: $instrument, bookType: $bookType, recentHours: $recentHours) {
            bucketWidth
            price
            time
            buckets {
              price
              longCountPercent
              shortCountPercent
            }
          }
        }`,
        variables: { 
          instrument: instrument, 
          bookType: bookType, 
          recentHours: 1 
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': process.env.OANDA_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': process.env.OANDA_COOKIE,
          'Referer': 'https://trading.oanda.com/',
          'Origin': 'https://trading.oanda.com'
        }
      }
    );

    // ตรวจสอบว่ามี Error จาก GraphQL หรือไม่ (บางทีได้ 200 แต่ข้างในมี errors array)
    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data.orderPositionBook;

  } catch (error: any) {
    // พ่น Error ออกมาดูที่ Terminal ของ VS Code
    console.error('❌ Axios/Fetcher Error:', error.response?.data || error.message);
    throw error; // ส่งต่อให้ API Route จัดการ
  }
};