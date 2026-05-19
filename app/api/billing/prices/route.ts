import { NextResponse } from 'next/server';
import { getBillingPrices } from '@/lib/billing-prices';

export async function GET() {
  const prices = await getBillingPrices();

  return NextResponse.json(prices, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    },
  });
}
