import type { EmailSenderKey, EmailSocialLink, EmailStream } from './contracts';

const legacySender = 'TalentConsulting.io <hello@talentconsulting.io>';

const senderEnvironmentKeys: Record<EmailSenderKey, string> = {
  security: 'EMAIL_FROM_SECURITY',
  account: 'EMAIL_FROM_ACCOUNT',
  billing: 'EMAIL_FROM_BILLING',
  taco: 'EMAIL_FROM_TACO',
  support: 'EMAIL_FROM_SUPPORT',
  operations: 'EMAIL_FROM_OPERATIONS',
  marketing: 'EMAIL_FROM_MARKETING',
};

const socialLinkConfiguration = [
  {
    platform: 'x',
    label: 'X',
    environmentKey: 'EMAIL_SOCIAL_X_URL',
    allowedHosts: ['x.com', 'www.x.com'],
  },
  {
    platform: 'bluesky',
    label: 'Bluesky',
    environmentKey: 'EMAIL_SOCIAL_BLUESKY_URL',
    allowedHosts: ['bsky.app', 'www.bsky.app'],
  },
  {
    platform: 'reddit',
    label: 'Reddit community',
    environmentKey: 'EMAIL_SOCIAL_REDDIT_URL',
    allowedHosts: ['reddit.com', 'www.reddit.com'],
  },
] as const;

export function isEmailSystemV2Enabled(): boolean {
  return process.env.EMAIL_SYSTEM_V2_ENABLED === 'true';
}

export function resolveEmailSender(sender: EmailSenderKey): string {
  const configured = process.env[senderEnvironmentKeys[sender]]?.trim();
  if (configured) return configured;

  if (isEmailSystemV2Enabled()) {
    throw new Error(`${senderEnvironmentKeys[sender]} is required when EMAIL_SYSTEM_V2_ENABLED=true`);
  }

  return process.env.EMAIL_FROM?.trim() || legacySender;
}

export function resolveReplyTo(sender: EmailSenderKey): string | undefined {
  if (sender === 'operations') return process.env.EMAIL_OPS_REPLY_TO?.trim() || undefined;
  return process.env.EMAIL_SUPPORT_REPLY_TO?.trim() || undefined;
}

export function assertEmailStreamEnabled(stream: EmailStream, allowDisabledMarketingPreview = false): void {
  if (stream !== 'marketing' || allowDisabledMarketingPreview) return;
  if (process.env.EMAIL_MARKETING_ENABLED !== 'true') {
    throw new Error('Marketing email is disabled');
  }

  const address = process.env.EMAIL_MAILING_ADDRESS?.trim();
  if (!address || /placeholder|united states|tbd/i.test(address)) {
    throw new Error('A valid EMAIL_MAILING_ADDRESS is required before marketing email can be enabled');
  }
}

export function resolveMailingAddress(stream: EmailStream): string | undefined {
  return stream === 'marketing' ? process.env.EMAIL_MAILING_ADDRESS?.trim() || undefined : undefined;
}

export function resolveEmailSocialLinks(): EmailSocialLink[] {
  if (process.env.EMAIL_SOCIAL_LINKS_ENABLED !== 'true') return [];

  return socialLinkConfiguration.flatMap(configuration => {
    const value = process.env[configuration.environmentKey]?.trim();
    if (!value) return [];

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${configuration.environmentKey} must be an absolute HTTPS URL`);
    }

    if (url.protocol !== 'https:' || !(configuration.allowedHosts as readonly string[]).includes(url.hostname)) {
      throw new Error(`${configuration.environmentKey} must use an approved ${configuration.label} HTTPS host`);
    }

    return [{
      platform: configuration.platform,
      label: configuration.label,
      url: url.toString(),
    }];
  });
}
