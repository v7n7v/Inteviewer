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
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Dynamic Ambient Mesh Background */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {/* Obsidian Base */}
          <div className="absolute inset-0 bg-[#030303]" />

          {/* Ambient Orbs */}
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
          <div className="ambient-orb orb-3" />

          {/* Mesh Overlay */}
          <div className="mesh-gradient" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}
