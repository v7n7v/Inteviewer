import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Talent Studio — AI-Powered Career Intelligence',
    template: '%s | Talent Studio',
  },
  description: 'AI-powered career intelligence platform. Build ATS-optimized resumes, practice with AI interviews, decode job descriptions, and track applications — all in one dashboard.',
  keywords: ['AI resume builder', 'interview prep', 'career intelligence', 'job application tracker', 'ATS resume', 'talent studio', 'resume morph', 'AI career coach'],
  authors: [{ name: 'Talent Consulting' }],
  creator: 'Talent Consulting',
  metadataBase: new URL('https://talentconsulting.io'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://talentconsulting.io',
    siteName: 'Talent Studio',
    title: 'Talent Studio — AI-Powered Career Intelligence',
    description: 'Build ATS-optimized resumes, practice AI interviews, and decode any job description. Your unfair advantage in the job market.',
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
    title: 'Talent Studio — AI-Powered Career Intelligence',
    description: 'Build ATS-optimized resumes, practice AI interviews, and decode any job description.',
    images: ['/og-image.png'],
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
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" />
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
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="relative z-10">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
