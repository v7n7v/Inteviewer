import { render, toPlainText } from 'react-email';
import { StructuredEmail } from '@/emails/components/StructuredEmail';
import { emailCatalog, type EmailCatalog, type ImplementedEmailEventKey } from './catalog';
import { assertEmailStreamEnabled, resolveEmailSender, resolveEmailSocialLinks, resolveMailingAddress, resolveReplyTo } from './config';
import type { RenderedEmail, StructuredEmailContent } from './contracts';
import type { z } from 'zod';

export interface RenderEmailOptions {
  allowDisabledMarketingPreview?: boolean;
}

export async function renderEmail<TKey extends ImplementedEmailEventKey>(
  event: TKey,
  payload: z.input<EmailCatalog[TKey]['schema']>,
  options: RenderEmailOptions = {},
): Promise<RenderedEmail> {
  const definition = emailCatalog[event];
  assertEmailStreamEnabled(definition.stream, options.allowDisabledMarketingPreview);

  const parsed = definition.schema.parse(payload) as never;
  const unsafeContent = definition.build(parsed);
  const content = normalizeContent(unsafeContent, definition.stream);
  const html = await render(<StructuredEmail content={content} />);
  const text = toPlainText(html).trim();
  const from = safeHeaderValue(resolveEmailSender(definition.sender), 'from');
  const replyToValue = resolveReplyTo(definition.sender);
  const replyTo = replyToValue ? safeHeaderValue(replyToValue, 'reply-to') : undefined;

  const headers: Record<string, string> = {
    'X-TalentConsulting-Event': event,
    'X-TalentConsulting-Template-Version': definition.templateVersion,
  };

  if (content.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${content.unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return {
    event,
    stream: definition.stream,
    sender: definition.sender,
    preferenceKey: definition.preferenceKey,
    templateVersion: definition.templateVersion,
    subject: safeSubject(content.subject),
    preheader: safeSingleLine(content.preheader, 180),
    html,
    text,
    from,
    replyTo,
    headers,
    tags: [
      { name: 'event', value: tagValue(event) },
      { name: 'stream', value: tagValue(definition.stream) },
      { name: 'category', value: tagValue(event.split('.')[0]) },
      { name: 'template', value: tagValue(definition.templateVersion) },
    ],
  };
}

function normalizeContent(content: StructuredEmailContent, stream: RenderedEmail['stream']): StructuredEmailContent {
  return {
    ...content,
    subject: safeSubject(content.subject),
    preheader: safeSingleLine(content.preheader, 180),
    category: safeSingleLine(content.category, 60),
    title: safeSingleLine(content.title, 160),
    action: content.action ? { ...content.action, label: safeSingleLine(content.action.label, 100), url: safeHttpUrl(content.action.url) } : undefined,
    secondaryAction: content.secondaryAction
      ? { ...content.secondaryAction, label: safeSingleLine(content.secondaryAction.label, 100), url: safeHttpUrl(content.secondaryAction.url) }
      : undefined,
    persona: content.persona
      ? {
          ...content.persona,
          role: content.persona.role ? safeSingleLine(content.persona.role, 100) : undefined,
          message: content.persona.message ? safeSingleLine(content.persona.message, 220) : undefined,
        }
      : undefined,
    socialLinks: content.showSocialFooter ? resolveEmailSocialLinks() : undefined,
    preferenceUrl: content.preferenceUrl ? safeHttpUrl(content.preferenceUrl) : undefined,
    unsubscribeUrl: content.unsubscribeUrl ? safeHttpUrl(content.unsubscribeUrl) : undefined,
    mailingAddress: content.mailingAddress || resolveMailingAddress(stream),
  };
}

export function safeHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Email action URL must be an absolute HTTP(S) URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Email action URL must use HTTP(S)');
  }
  return parsed.toString();
}

export function safeSubject(value: string): string {
  return safeSingleLine(value.replace(/<[^>]*>/g, ' '), 200) || 'TalentConsulting.io update';
}

function safeSingleLine(value: string, maxLength: number): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeHeaderValue(value: string, label: string): string {
  if (/[\r\n\u2028\u2029]/.test(value)) throw new Error(`Invalid ${label} header value`);
  return value.trim();
}

function tagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
}
