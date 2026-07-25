import { StructuredEmail } from '../components/StructuredEmail';

export default function SupportReceiptPreview() {
  return <StructuredEmail content={{
    subject: 'We received your message (CASE-2048)',
    preheader: 'Your message reached TalentConsulting.io support.',
    category: 'Support',
    title: 'Message received',
    greeting: 'Hi Jordan,',
    paragraphs: ['Thanks for contacting TalentConsulting.io. Your message is in our support queue.'],
    details: [{ label: 'Reference', value: 'CASE-2048' }, { label: 'Received', value: 'July 19, 2026 at 2:30 PM ET' }],
    callout: { tone: 'neutral', title: 'Your message', body: 'I need help reconciling a subscription charge with my Stripe receipt.' },
    action: { label: 'Contact support', url: 'https://talentconsulting.io/suite/feedback' },
  }} />;
}
