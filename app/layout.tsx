import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TalentConsulting.io | Talent Density, Decoded',
  description: "The world's first AI Interview Co-Pilot that transcribes, analyzes, and calibrates human judgment in real-time",
  keywords: ['AI', 'interview', 'hiring', 'talent', 'assessment', 'recruitment'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          {/* Dynamic Ambient Background */}
          <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none theme-root-bg">
            <div className="absolute inset-0 theme-base-bg" />
            <div
              className="absolute inset-0 theme-radial-glow"
            />
            <div className="mesh-gradient" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <ClientProviders>{children}</ClientProviders>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
