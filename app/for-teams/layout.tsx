import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Talent Studio for Teams — Enterprise & Education Career Platform',
  description:
    'Empower your organization with AI-driven career tools. Bulk resume optimization, interview training, skill gap analysis, and market intelligence for HR teams, bootcamps, and universities.',
  openGraph: {
    title: 'Talent Studio for Teams — Enterprise Career Intelligence',
    description:
      'AI career tools for organizations: bulk resume optimization, structured interview training, and market intelligence dashboards.',
    url: 'https://talentconsulting.io/for-teams',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Talent Studio for Teams' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Talent Studio for Teams',
    description: 'AI career intelligence for HR teams, bootcamps, and universities.',
  },
  alternates: {
    canonical: '/for-teams',
  },
};

export default function ForTeamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
