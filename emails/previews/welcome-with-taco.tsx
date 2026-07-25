import { StructuredEmail } from '../components/StructuredEmail';

export default function WelcomeWithTacoPreview() {
  return <StructuredEmail content={{
    subject: 'Welcome—your career command center is ready',
    preheader: 'Meet Taco and create your first useful career win in about 10 minutes.',
    category: 'Welcome to TalentConsulting',
    title: 'Your next career move starts here',
    greeting: 'Hi Jordan,',
    paragraphs: [
      'Your private career workspace is ready. TalentConsulting turns scattered career work into one clear, review-first system built around your goals.',
      'Start with a little context once, then let Taco help you find the signal, strengthen your story, and prepare your next best move.',
    ],
    items: [
      'Add or review your resume.',
      'Name the role, location, and compensation you want.',
      'Review your first personalized next steps.',
    ],
    callout: {
      tone: 'success',
      title: 'Your first win is about 10 minutes away',
      body: 'Leave with one practical next move you understand and chose—not another overwhelming list.',
    },
    persona: {
      kind: 'taco',
      presentation: 'hero',
      role: 'Your review-first career copilot',
      message: 'I’ll connect your experience, goals, and opportunities—without taking control away from you.',
    },
    action: { label: 'Start my first win', url: 'https://talentconsulting.io/suite' },
    secondaryAction: { label: 'Say hello to Taco', url: 'https://talentconsulting.io/suite/agent' },
    socialLinks: [
      { platform: 'x', label: 'X', url: 'https://x.com/' },
      { platform: 'bluesky', label: 'Bluesky', url: 'https://bsky.app/' },
      { platform: 'reddit', label: 'Reddit community', url: 'https://www.reddit.com/' },
    ],
    footerNote: 'Nothing is submitted to an employer without your decision.',
  }} />;
}
