import { StructuredEmail } from '../components/StructuredEmail';

export default function WeeklyRecapWithTacoPreview() {
  return <StructuredEmail content={{
    subject: 'Your weekly career progress recap',
    preheader: 'Review progress, open actions, and the next useful steps.',
    category: 'Weekly recap',
    title: 'Your week in review',
    greeting: 'Hi Jordan,',
    paragraphs: ['You created useful momentum this week. Here is the progress worth noticing and the next move worth considering.'],
    items: [
      'Updated your target role and compensation preferences.',
      'Reviewed three high-fit career opportunities.',
      'Prepared one interview story for your next conversation.',
    ],
    persona: {
      kind: 'taco',
      presentation: 'byline',
      role: 'Your review-first career copilot',
      message: 'I organized the signal from your week into one focused review.',
    },
    action: { label: 'Open my dashboard', url: 'https://talentconsulting.io/suite' },
    preferenceUrl: 'https://talentconsulting.io/suite/settings?tab=notifications',
    unsubscribeUrl: 'https://talentconsulting.io/email/unsubscribe?token=preview',
    socialLinks: [
      { platform: 'x', label: 'X', url: 'https://x.com/' },
      { platform: 'bluesky', label: 'Bluesky', url: 'https://bsky.app/' },
      { platform: 'reddit', label: 'Reddit community', url: 'https://www.reddit.com/' },
    ],
  }} />;
}
