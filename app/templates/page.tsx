import type { Metadata } from 'next';
import TemplatesGallery from './TemplatesGallery';

export const metadata: Metadata = {
  title: 'Free ATS Resume Templates 2026 — Modern, Professional & ATS-Optimized',
  description: 'Browse free, ATS-friendly resume templates designed to pass applicant tracking systems. Professional, modern, creative, and executive styles. Build your resume in minutes with AI-powered tools.',
  keywords: [
    'free resume templates',
    'ATS resume templates',
    'ATS friendly resume template',
    'modern resume template 2026',
    'professional resume template',
    'resume template download free',
    'resume design',
    'resume examples',
    'best resume format',
    'resume template for job application',
  ],
  openGraph: {
    title: 'Free ATS Resume Templates — Talent Studio',
    description: 'Professional, ATS-optimized resume templates. Build your perfect resume with AI.',
    url: 'https://talentconsulting.io/templates',
  },
  alternates: {
    canonical: '/templates',
  },
};

export default function TemplatesPage() {
  return <TemplatesGallery />;
}
