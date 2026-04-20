import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Talent Studio — AI-Powered Career Intelligence Platform',
    template: '%s | Talent Studio',
  },
  description: 'Free AI text humanizer & detector — bypass AI detection instantly. Build ATS-optimized resumes, practice AI interviews, detect AI writing patterns, humanize text, track applications, and decode job descriptions. All-in-one career platform, free to start.',
  keywords: [
    'free AI humanizer',
    'free AI text detector',
    'AI writing detector',
    'humanize AI text',
    'bypass AI detection',
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
    'undetectable AI writing',
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
  authors: [{ name: 'Talent Consulting', url: 'https://talentconsulting.io' }],
  creator: 'Talent Consulting',
  publisher: 'Talent Consulting',
  category: 'Career Tools',
  metadataBase: new URL('https://talentconsulting.io'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://talentconsulting.io',
    siteName: 'Talent Studio',
    title: 'Free AI Humanizer & Text Detector — Talent Studio Career Platform',
    description: 'Free AI humanizer: paste AI text, get human-sounding results instantly. Plus: ATS resume builder, AI interview simulator, and 22+ career tools. No sign-up required.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Talent Studio — AI Career Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Humanizer & Text Detector — Talent Studio',
    description: 'Free AI text humanizer: bypass detection in one click. Plus ATS resume builder, AI interview simulator, and 22+ career intelligence tools.',
    images: ['/og-image.png'],
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
    ],
    apple: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebaseinstallations.googleapis.com" />
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />

        {/* Material Symbols — loaded via stylesheet (not a font we can self-host via next/font) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" />

        {/* Google Analytics 4 — deferred to not block first paint */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-8HXZDQQ3YJ" strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8HXZDQQ3YJ');
          `}
        </Script>
        {/* FOUC prevention — set theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
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
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'SoftwareApplication',
                  name: 'Talent Studio',
                  applicationCategory: 'BusinessApplication',
                  operatingSystem: 'Web',
                  url: 'https://talentconsulting.io',
                  description: 'Free AI text humanizer and detector. AI-powered career intelligence platform with resume morphing, interview simulation, and 22+ career tools.',
                  offers: [
                    {
                      '@type': 'Offer',
                      price: '0',
                      priceCurrency: 'USD',
                      name: 'Free',
                      description: '3 resume morphs, 3 interviews, AI detector — free forever',
                    },
                    {
                      '@type': 'Offer',
                      price: '9.99',
                      priceCurrency: 'USD',
                      name: 'Pro',
                      description: 'Unlimited morphs, interviews, AI detection & humanizer (4K words/mo)',
                    },
                    {
                      '@type': 'Offer',
                      price: '19.99',
                      priceCurrency: 'USD',
                      name: 'Max',
                      description: 'Everything in Pro + Sona AI Agent, 50K word humanizer, unlimited detection, priority support',
                    },
                  ],
                  featureList: [
                    'Free AI Text Humanizer',
                    'Free AI Writing Detector',
                    'AI Resume Morphing',
                    'Interview Simulator with STAR Grading',
                    'AI Text Detection (100+ patterns)',
                    'AI Writing Humanizer',
                    'Market Intelligence & Salary Data',
                    'Job Application Tracker',
                    'Skill Gap Analysis',
                    'Resume Templates & Export',
                    'Sona AI Career Agent',
                    'Cover Letter Generator',
                  ],
                },
                {
                  '@type': 'Organization',
                  name: 'Talent Consulting',
                  url: 'https://talentconsulting.io',
                  logo: 'https://talentconsulting.io/logo.png',
                  sameAs: [],
                },
                {
                  '@type': 'WebSite',
                  name: 'Talent Studio',
                  url: 'https://talentconsulting.io',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://talentconsulting.io/suite/job-search?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <div className="relative z-10">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
