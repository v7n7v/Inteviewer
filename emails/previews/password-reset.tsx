import { StructuredEmail } from '../components/StructuredEmail';

export default function PasswordResetPreview() {
  return (
    <StructuredEmail content={{
      subject: 'Reset your TalentConsulting.io password',
      preheader: 'Use this secure link to choose a new password.',
      category: 'Security',
      title: 'Reset your password',
      greeting: 'Hi Jordan,',
      paragraphs: ['We received a request to reset the password for your TalentConsulting.io account.'],
      callout: {
        tone: 'warning',
        title: 'Didn’t request this?',
        body: 'Ignore this email and your password will stay the same. Never share this link with anyone.',
      },
      action: { label: 'Reset password', url: 'https://talentconsulting.io/auth/reset-password?mode=resetPassword&oobCode=preview' },
      footerNote: 'This one-time link expires in 60 minutes.',
    }} />
  );
}
