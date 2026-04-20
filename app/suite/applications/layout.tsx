import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Job Application Tracker — Organize Your Job Search',
  description: 'Track every application, interview, and offer in one dashboard. Status updates, deadline reminders, and progress analytics for your entire job search.',
  alternates: { canonical: '/suite/applications' },
};

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
