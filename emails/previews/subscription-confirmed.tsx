import { StructuredEmail } from '../components/StructuredEmail';

export default function SubscriptionConfirmedPreview() {
  return (
    <StructuredEmail content={{
      subject: 'Your Pro subscription is active',
      preheader: 'Your TalentConsulting.io Pro subscription is ready.',
      category: 'Billing',
      title: 'Subscription confirmed',
      greeting: 'Hi Jordan,',
      paragraphs: ['Your subscription is active and your account access has been updated. Stripe remains the source of record for your receipt and invoice.'],
      details: [
        { label: 'Plan', value: 'Pro' },
        { label: 'Billing interval', value: 'Annual' },
        { label: 'Price', value: '$159/year' },
      ],
      action: { label: 'View Stripe receipt', url: 'https://billing.stripe.com/p/login/preview' },
      secondaryAction: { label: 'Manage billing settings', url: 'https://talentconsulting.io/suite/settings?tab=billing' },
      footerNote: 'This confirmation complements Stripe’s official receipt; it does not replace it.',
    }} />
  );
}
