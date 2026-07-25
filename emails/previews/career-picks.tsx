import { StructuredEmail } from '../components/StructuredEmail';

export default function CareerPicksPreview() {
  return <StructuredEmail content={{
    subject: 'Your Career Picks by Taco are ready',
    preheader: 'Review curated job matches and decide what to pursue.',
    category: 'Career Picks by Taco',
    title: 'Your career picks are ready',
    greeting: 'Hi Jordan,',
    paragraphs: ['Three verified roles matched your current profile. The strongest Talent Fit score is 91%.'],
    items: ['Director of Talent Strategy at Northstar — Remote — 91% Talent Fit', 'People Analytics Lead at Acme — New York, NY — 87% Talent Fit', 'Workforce Planning Manager at Contoso — Hybrid — 84% Talent Fit'],
    callout: { tone: 'neutral', body: 'Taco prepared recommendations for your review. Nothing was submitted or sent to an employer.' },
    persona: {
      kind: 'taco',
      presentation: 'byline',
      role: 'Your review-first career copilot',
      message: 'I found a focused set of opportunities for you to review.',
    },
    action: { label: 'Review career picks', url: 'https://talentconsulting.io/suite/job-search' },
    preferenceUrl: 'https://talentconsulting.io/suite/settings',
    unsubscribeUrl: 'https://talentconsulting.io/email/unsubscribe?token=preview',
    socialLinks: [
      { platform: 'x', label: 'X', url: 'https://x.com/' },
      { platform: 'bluesky', label: 'Bluesky', url: 'https://bsky.app/' },
      { platform: 'reddit', label: 'Reddit community', url: 'https://www.reddit.com/' },
    ],
  }} />;
}
