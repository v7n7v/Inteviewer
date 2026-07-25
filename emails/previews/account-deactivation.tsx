import { StructuredEmail } from '../components/StructuredEmail';

export default function AccountDeactivationPreview() {
  return <StructuredEmail content={{
    subject: 'Confirm account deactivation',
    preheader: 'Use this secure link to pause your TalentConsulting.io account.',
    category: 'Account',
    title: 'Confirm account deactivation',
    greeting: 'Hi Jordan,',
    paragraphs: ['A request was made to deactivate your account and pause optional email.'],
    callout: { tone: 'warning', title: 'Didn’t request this?', body: 'Ignore this email. Your account will stay active.' },
    action: { label: 'Confirm deactivation', url: 'https://talentconsulting.io/account/action?token=preview' },
    footerNote: 'This single-use link expires in 30 minutes.',
  }} />;
}
