import { EmailCallout, EmailDetails, EmailList, EmailParagraph } from './EmailPrimitives';
import { TalentEmailLayout } from './TalentEmailLayout';
import type { StructuredEmailContent } from '@/lib/email/contracts';

export function StructuredEmail({ content }: { content: StructuredEmailContent }) {
  return (
    <TalentEmailLayout
      preheader={content.preheader}
      category={content.category}
      title={content.title}
      action={content.action}
      secondaryAction={content.secondaryAction}
      persona={content.persona}
      socialLinks={content.socialLinks}
      footerNote={content.footerNote}
      preferenceUrl={content.preferenceUrl}
      unsubscribeUrl={content.unsubscribeUrl}
      mailingAddress={content.mailingAddress}
    >
      {content.greeting ? <EmailParagraph>{content.greeting}</EmailParagraph> : null}
      {content.paragraphs.map((paragraph, index) => (
        <EmailParagraph key={`${paragraph}-${index}`}>{paragraph}</EmailParagraph>
      ))}
      {content.details?.length ? <EmailDetails rows={content.details} /> : null}
      {content.items?.length ? <EmailList items={content.items} /> : null}
      {content.callout ? (
        <EmailCallout title={content.callout.title} tone={content.callout.tone}>
          {content.callout.body}
        </EmailCallout>
      ) : null}
    </TalentEmailLayout>
  );
}
