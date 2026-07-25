import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { isPromoActive, promoConfig } from '@/lib/promo-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await getAdminDb().doc('settings/promo').get();
    const data = snapshot.data() || {};
    return NextResponse.json(
      {
        active: data.active !== false && isPromoActive(),
        headline: promoConfig.headline,
        code: promoConfig.code,
        ctaText: promoConfig.ctaText,
        automatic: promoConfig.automatic,
        expiresAt: promoConfig.expiresAt,
      },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json(
      {
        active: isPromoActive(),
        headline: promoConfig.headline,
        code: promoConfig.code,
        ctaText: promoConfig.ctaText,
        automatic: promoConfig.automatic,
        expiresAt: promoConfig.expiresAt,
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  }
}
