import { NextRequest, NextResponse } from 'next/server';

// Firebase handles OAuth via client-side signInWithPopup
// This callback route redirects to the dashboard
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/suite', requestUrl.origin));
}
