import type { Metadata } from 'next';
import { Google_Sans_Flex, Inter, JetBrains_Mono, Poppins } from 'next/font/google';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';
import ConsentAwareAnalytics from '@/components/privacy/ConsentAwareAnalytics';

const BRAND_NAME = 'TalentConsulting.io';
const BRAND_WORDMARK = '/brand/talentconsulting-logo-white.png';
const BRAND_OG_IMAGE = '/brand/brand-og-v2.png';
const BRAND_MARK_192 = '/brand/brand-icon-192.png';
const BRAND_MARK_512 = '/brand/brand-icon-512.png';
const BRAND_APPLE_ICON = '/brand/brand-icon-180.png';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const googleSansFlex = Google_Sans_Flex({
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
  weight: 'variable',
  axes: ['GRAD', 'opsz'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/* Display face for the landing page. Self-hosted through next/font rather than
   fetched from fonts.googleapis.com, so the marketing page adds no third-party
   origin and no render-blocking request. */
const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Talent Studio — AI-Powered Career Intelligence Platform',
    template: '%s | Talent Studio',
  },
  description: 'AI career workspace for resumes, ATS checks, interview prep, job tracking, and Taco-guided application workflows. Start with free tools.',
  keywords: [
    'free AI humanizer',
    'free AI text detector',
    'AI writing detector',
    'humanize AI text',
    'AI text humanizer free',
    'AI content detector',
    'AI resume builder',
    'ATS resume optimizer',
    'AI interview practice',
    'interview simulator',
    'AI text detector',
    'AI writing humanizer',
    'career intelligence platform',
    'job application tracker',
    'resume morph',
    'AI career coach',
    'job description analyzer',
    'resume templates',
    'cover letter generator',
    'market oracle salary data',
    'skill gap analysis',
    'ChatGPT detector',
    'AI writing trust checker',
    'AI checker free',
    'free grammar checker',
    'free paraphraser online',
    'free ATS resume checker',
    'ATS resume score free',
    'free word counter',
    'online word counter',
    'talent studio',
    'talentconsulting.io',
  ],
  authors: [{ name: BRAND_NAME, url: 'https://talentconsulting.io' }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  category: 'Career Tools',
  metadataBase: new URL('https://talentconsulting.io'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://talentconsulting.io',
    siteName: BRAND_NAME,
    title: 'Talent Studio — AI Career Intelligence Platform',
    description: 'AI writing trust tools, ATS resume builder, AI interview simulator, and 22+ career intelligence tools.',
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'TalentConsulting.io — AI Career Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Humanizer & Text Detector — Talent Studio',
    description: 'AI writing trust tools, ATS resume builder, AI interview simulator, and 22+ career intelligence tools.',
    images: [BRAND_OG_IMAGE],
    creator: '@talentconsulting',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: BRAND_MARK_192, sizes: '192x192', type: 'image/png' },
      { url: BRAND_MARK_512, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: [
      { url: BRAND_APPLE_ICON, sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        verification: {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebaseinstallations.googleapis.com" />
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />

        {/* Material Symbols — loaded via stylesheet (not a font we can self-host via next/font) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" />

        {/* Google Analytics 4 — deferred to not block first paint */}
        {/* FOUC prevention — set theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                /* The .js gate. Every rule that HIDES something on the landing
                   page is scoped to html.js, so if this line never runs -
                   script error, blocked inline script, an in-app WebView with
                   JS off - the page is fully readable instead of blank.
                   Reveals are an enhancement; they are never the thing that
                   makes content exist. It sits outside the try below because
                   it must not be skipped when localStorage throws. */
                document.documentElement.classList.add('js');
                try {
                  var s = localStorage.getItem('talent-studio-theme') || 'system';
                  var t = s;
                  if (s === 'system') {
                    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', t);
                  document.documentElement.classList.add(t);
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        {/* Global JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: BRAND_NAME,
                  url: 'https://talentconsulting.io',
                  logo: `https://talentconsulting.io${BRAND_WORDMARK}`,
                  sameAs: [],
                },
                {
                  '@type': 'WebSite',
                  name: 'Talent Studio',
                  url: 'https://talentconsulting.io',
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${googleSansFlex.variable} ${jetbrainsMono.variable} ${poppins.variable} font-sans antialiased`}>
        <ConsentAwareAnalytics />
        <div className="relative z-10">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
