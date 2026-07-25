import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbJsonLd, buildMetadata, faqJsonLd } from '@/lib/seo';
import TemplatesGallery from './TemplatesGallery';

const FAQS = [
  { q: 'Are these resume templates free?', a: 'Three foundational templates are free. The 17-template Signature Collection is included with Standard and remains visible for evaluation before upgrading.' },
  { q: 'Are the templates ATS-compatible?', a: 'Each template is labeled ATS-first, ATS-conscious, or Human-first. Every design includes a linear Word companion, but compatibility varies by employer and software and is not guaranteed.' },
  { q: 'Can I customize the templates?', a: 'Yes. You can customize sections, content, and formatting in the resume builder.' },
  { q: 'What file formats can I download?', a: 'You can export resume documents in formats designed for both human review and ATS submission.' },
];

export const metadata: Metadata = buildMetadata({
  title: '20 professional resume templates',
  description: 'Browse 20 curated resume formats for executive, technical, specialist, early-career, and creative roles, with PDF and linear Word export.',
  path: '/templates',
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
});

export default function TemplatesPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Templates', path: '/templates' },
          ]),
          faqJsonLd(FAQS),
        ]}
      />
      <TemplatesGallery />
    </>
  );
}
