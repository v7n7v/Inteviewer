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

// Track repeated 401s per IP for abuse detection
const authFailures = new Map<string, { count: number; resetAt: number }>();

/** Fire-and-forget alert to internal monitor endpoint (Edge-safe) */
function edgeAlert(req: NextRequest, severity: string, title: string, details: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;
  const origin = req.nextUrl.origin;
  const secret = webhookUrl.slice(-16);
  fetch(`${origin}/api/monitor/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-monitor-secret': secret },
    body: JSON.stringify({ severity, title, details }),
  }).catch(() => {});
}

// API routes that explicitly allow unauthenticated access
const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/contact',
  '/api/stripe/webhook',
  '/api/teams/interest',
  '/api/monitor/alert',
];

// Routes that allow optionally-authenticated access (freemium anonymous)
const FREEMIUM_API_PATHS = [
  '/api/gauntlet/generate',
  '/api/gauntlet/grade',
  '/api/gauntlet/parse-resume',
  '/api/chat',
  '/api/ai',
  '/api/jobs/search',
  '/api/resume/morph',
  '/api/resume/parse',
  '/api/writing/humanize-free',
  '/api/tools/free',
  '/api/onboarding',
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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    edgeAlert(request, 'critical', 'Scanner Path Detected', `IP: ${ip}\nPath: ${pathname}`);
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
    pathname === '/help' ||
    pathname.startsWith('/templates') ||
    pathname.startsWith('/tools') ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/for-teams')
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
      // Track repeated auth failures per IP
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const now = Date.now();
      const entry = authFailures.get(ip);
      if (!entry || now > entry.resetAt) {
        authFailures.set(ip, { count: 1, resetAt: now + 60_000 });
      } else {
        entry.count++;
        if (entry.count === 5) {
          edgeAlert(request, 'warning', 'Repeated Auth Failures', `IP: ${ip}\n5 unauthenticated API requests in 1 minute\nLatest: ${pathname}`);
        }
      }
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
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
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
  // Cross-Origin isolation
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Restrict cross-origin resource access for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  }
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
