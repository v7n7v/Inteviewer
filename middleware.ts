/**
 * Next.js Middleware — Security Hardening Layer
 * 
 * Responsibilities:
 * 1. Inject security headers on every response
 * 2. Lightweight Bearer token presence check for API routes
 * 3. Bot/scanner fingerprint blocking
 * 4. Route matching for protected paths
 * 
 * Note: Full token verification happens in guardApiRoute().
 * This is a fast, edge-level gatekeeper.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// API routes that explicitly allow unauthenticated access
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/stripe/webhook',
  '/api/teams/interest',
];

// Routes that allow optionally-authenticated access (freemium anonymous)
const FREEMIUM_API_PATHS = [
  '/api/gauntlet/generate',
  '/api/gauntlet/grade',
  '/api/chat',
  '/api/ai',
  '/api/jobs/search',
];

// Known scanner/exploit paths to reject instantly
const BLOCKED_PATHS = [
  '/wp-admin', '/wp-login', '/xmlrpc.php', '/.env',
  '/admin/config', '/cgi-bin', '/phpmyadmin',
  '/actuator', '/.git', '/debug', '/trace',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Block known scanner paths instantly ──
  if (BLOCKED_PATHS.some(p => pathname.toLowerCase().startsWith(p))) {
    return new NextResponse(null, { status: 404 });
  }

  // ── 2. Allow static assets and public pages through ──
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/help'
  ) {
    return addSecurityHeaders(NextResponse.next(), request);
  }

  // ── 3. Public API routes — no auth required ──
  if (PUBLIC_API_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next(), request);
  }

  // ── 4. Freemium API routes — allow without Bearer but let guardApiRoute handle caps ──
  if (FREEMIUM_API_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next(), request);
  }

  // ── 5. All other API routes: require Bearer token presence ──
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Authentication required. Please sign in.' },
          { status: 401 }
        ),
        request
      );
    }
    return addSecurityHeaders(NextResponse.next(), request);
  }

  // ── 6. Protected suite pages — pass through (page-level guards handle auth) ──
  return addSecurityHeaders(NextResponse.next(), request);
}

/**
 * Inject security headers on every response.
 * These supplement the headers in next.config.js (which only apply to static responses).
 * Middleware headers apply to ALL responses including API routes.
 */
function addSecurityHeaders(response: NextResponse, _request: NextRequest): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Disable unused browser APIs
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(self)');
  // HSTS — force HTTPS for 2 years
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // Prevent leaking server info
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/suite/:path*',
    '/dashboard/:path*',
    '/settings/:path*',
    // Block scanner paths at edge
    '/wp-admin/:path*',
    '/wp-login.php',
    '/.env',
    '/.git/:path*',
  ],
};
