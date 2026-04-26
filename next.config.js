/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin', 'mammoth', 'pdf-parse'],
  images: {
    domains: [],
  },
  webpack: (config) => {
    // PDF.js worker configuration
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), payment=(self)'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.google.com https://js.stripe.com https://cdnjs.cloudflare.com",
              "worker-src 'self' blob: https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' data: blob: https://*.firebaseio.com https://*.googleapis.com https://api.groq.com https://api.deepgram.com https://api.elevenlabs.io https://generativelanguage.googleapis.com wss://*.firebaseio.com https://api.stripe.com https://cdnjs.cloudflare.com",
              "media-src 'self' blob:",
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://js.stripe.com",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; ')
          }
        ]
      }
    ]
  },
}

module.exports = nextConfig
