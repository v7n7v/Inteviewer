import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center — Talent Studio Guides & Documentation',
  description:
    'Learn how to use Talent Studio: AI resume morphing, interview simulation, market intelligence, application tracking, and all career tools. Step-by-step guides.',
  openGraph: {
    title: 'Help Center — Talent Studio',
    description: 'Comprehensive guides for every Talent Studio tool.',
    url: 'https://talentconsulting.io/help',
    type: 'website',
  },
  alternates: {
    canonical: '/help',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
