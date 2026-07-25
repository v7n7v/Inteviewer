import { StructuredEmail } from '../components/StructuredEmail';

export default function InternalDisputeAlertPreview() {
  return <StructuredEmail content={{
    subject: '[CRITICAL] Dispute escalation — dp_preview',
    preheader: 'A Stripe dispute requires operations review.',
    category: 'Internal operations',
    title: 'Dispute escalation',
    paragraphs: ['Stripe reported a dispute that requires an internal response. Customer-facing email contains only a safe lifecycle summary.'],
    details: [{ label: 'Reference', value: 'dp_preview' }, { label: 'Severity', value: 'Critical' }, { label: 'Amount', value: '$159.00 USD' }, { label: 'Evidence due', value: 'July 26, 2026' }],
    callout: { tone: 'danger', body: 'Keep evidence, card details, and dispute artifacts in Stripe and approved internal systems.' },
    action: { label: 'Open Stripe dashboard', url: 'https://dashboard.stripe.com/test/disputes/dp_preview' },
  }} />;
}
