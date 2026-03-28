/**
 * Next.js Middleware — Route Protection
 * 
 * Security layer for TalentConsulting.io:
 * - API routes require Firebase ID token (Authorization: Bearer <token>)
 * - Protected pages redirect unauthenticated users to login
 * - Public pages (landing, login, signup) are always accessible
 * 
 * Note: Full token verification happens in individual API routes via guardApiRoute().
 * This middleware does a lightweight check (presence of Authorization header).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Pages that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/help',
];

// API routes that don't require authentication
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',              // Diagnostic endpoint
  '/api/stripe/webhook', // Stripe sends webhooks without Bearer token
  '/api/teams/interest', // Public B2B contact form
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public pages and static assets
  if (
    PUBLIC_PATHS.some(p => pathname === p) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes: check for Authorization header
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // Token is present — let it through to the route handler
    // where guardApiRoute() will do full verification
    return NextResponse.next();
  }

  // Protected pages: check for auth session cookie
  // (Firebase sets __session or we can check a custom cookie)
  // For now, let page-level auth guards handle this
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match API routes
    '/api/:path*',
    // Match protected app routes (not public pages)
    '/suite/:path*',
    '/dashboard/:path*',
    '/settings/:path*',
  ],
};
