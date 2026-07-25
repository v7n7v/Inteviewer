import { render, toPlainText } from 'react-email';
import { StructuredEmail } from '@/emails/components/StructuredEmail';
import { resolveEmailSocialLinks } from '@/lib/email/config';
import type { RenderedEmail, StructuredEmailContent } from '@/lib/email/contracts';

export type WelcomeConceptId = 'command_center' | 'first_win' | 'meet_taco' | 'your_story';

type WelcomeConcept = {
  id: WelcomeConceptId;
  label: string;
  content: StructuredEmailContent;
};

export const welcomeConcepts: readonly WelcomeConcept[] = [
  {
    id: 'command_center',
    label: 'Career command center',
    content: {
      subject: 'Your career command center is ready',
      preheader: 'One place for your resume, opportunities, interviews, and next best move.',
      category: 'Welcome to TalentConsulting',
      title: 'Your next career move starts here',
      greeting: 'Welcome, Alex.',
      paragraphs: [
        'TalentConsulting turns scattered career work into one clear, review-first system built around your goals.',
        'Bring us your experience and direction. We will help you find the signal, strengthen your story, and make every next step more intentional.',
      ],
      details: [
        { label: 'Your workspace', value: 'Private and ready' },
        { label: 'Your decisions', value: 'Always yours' },
        { label: 'Your first win', value: 'About 10 minutes away' },
      ],
      callout: {
        title: 'Start with what makes everything smarter',
        body: 'Add your resume and target role once. Your tools can then work from the same career context instead of making you repeat yourself.',
        tone: 'info',
      },
      persona: {
        kind: 'taco',
        presentation: 'hero',
        role: 'Your review-first career copilot',
        message: 'I’ll help turn your career context into a focused next move.',
      },
      action: { label: 'Build my career profile', url: 'https://talentconsulting.io/suite/vault?welcome_concept=command_center' },
      secondaryAction: { label: 'Explore my dashboard', url: 'https://talentconsulting.io/suite?welcome_concept=command_center' },
      showSocialFooter: true,
      footerNote: 'TalentConsulting is review-first. Nothing is submitted to an employer without your decision.',
    },
  },
  {
    id: 'first_win',
    label: 'First 10-minute win',
    content: {
      subject: 'Let’s create your first career win in 10 minutes',
      preheader: 'Three focused steps can make every TalentConsulting tool more useful.',
      category: 'Your first win',
      title: 'Ten minutes. One clearer direction.',
      greeting: 'You’re in, Alex.',
      paragraphs: [
        'You do not need to configure everything today. Start with one short path that gives the entire suite useful context.',
      ],
      items: [
        'Add or review your resume — about 3 minutes.',
        'Name the role, location, and compensation you want — about 2 minutes.',
        'Review your first personalized recommendations — about 5 minutes.',
      ],
      callout: {
        title: 'Your goal for today',
        body: 'Leave with one practical next move you understand and chose—not another overwhelming list.',
        tone: 'success',
      },
      persona: {
        kind: 'taco',
        presentation: 'hero',
        role: 'Your review-first career copilot',
        message: 'I’ll keep your first setup focused, useful, and completely in your control.',
      },
      action: { label: 'Start my 10-minute setup', url: 'https://talentconsulting.io/suite?welcome_concept=first_win' },
      secondaryAction: { label: 'See everything I can do', url: 'https://talentconsulting.io/templates?welcome_concept=first_win' },
      showSocialFooter: true,
      footerNote: 'Your account is private, and you stay in control of every action.',
    },
  },
  {
    id: 'meet_taco',
    label: 'Meet Taco',
    content: {
      subject: 'Meet Taco—your review-first career copilot',
      preheader: 'Taco helps you scout, prepare, and decide without taking control away from you.',
      category: 'Meet your career copilot',
      title: 'Taco does the digging. You make the call.',
      greeting: 'Welcome, Alex.',
      paragraphs: [
        'Taco connects the dots across your experience, goals, job opportunities, and preparation work so your next move feels less like guesswork.',
        'Ask for help finding roles, strengthening a resume, preparing for an interview, or deciding what deserves your attention next.',
      ],
      items: [
        'Scout opportunities that match your real priorities.',
        'Explain why a role fits—or where the risks are.',
        'Prepare application and interview work for your review.',
        'Learn from outcomes without applying or contacting anyone automatically.',
      ],
      callout: {
        title: 'The rule Taco never breaks',
        body: 'You review first. Taco never submits an application or contacts an employer on your behalf.',
        tone: 'neutral',
      },
      persona: {
        kind: 'taco',
        presentation: 'hero',
        role: 'Your review-first career copilot',
        message: 'I do the digging. You make the call.',
      },
      action: { label: 'Say hello to Taco', url: 'https://talentconsulting.io/suite/agent?welcome_concept=meet_taco' },
      secondaryAction: { label: 'Set my career target first', url: 'https://talentconsulting.io/suite/settings?welcome_concept=meet_taco' },
      showSocialFooter: true,
      footerNote: 'Taco is part of TalentConsulting and works from the context you choose to provide.',
    },
  },
  {
    id: 'your_story',
    label: 'Your story already has value',
    content: {
      subject: 'You already have a career story worth seeing clearly',
      preheader: 'TalentConsulting helps turn your experience into evidence, direction, and momentum.',
      category: 'Welcome—you belong here',
      title: 'You are not starting from scratch',
      greeting: 'We’re glad you’re here, Alex.',
      paragraphs: [
        'Your experience contains more signal than a job title or a page of keywords can show. TalentConsulting helps you uncover that signal and use it with confidence.',
        'We will help you translate what you have done into a stronger story, clearer options, and practical next steps—without pretending the hard parts are easy.',
      ],
      callout: {
        title: 'What you can expect from us',
        body: 'Honest guidance. Useful evidence. Clear tradeoffs. No fake guarantees, hidden applications, or pressure to become someone you are not.',
        tone: 'success',
      },
      items: [
        'See the strengths and proof already present in your resume.',
        'Find roles where those strengths create real leverage.',
        'Prepare with language that still sounds like you.',
      ],
      persona: {
        kind: 'taco',
        presentation: 'hero',
        role: 'Your review-first career copilot',
        message: 'I’ll help you see the evidence and leverage already present in your experience.',
      },
      action: { label: 'Show me my career story', url: 'https://talentconsulting.io/suite/resume?welcome_concept=your_story' },
      secondaryAction: { label: 'Take a quick tour', url: 'https://talentconsulting.io/suite?welcome_concept=your_story' },
      showSocialFooter: true,
      footerNote: 'Your work stays yours. TalentConsulting helps you see and use it more clearly.',
    },
  },
] as const;

export async function renderWelcomeConcepts(): Promise<Array<{ id: WelcomeConceptId; label: string; email: RenderedEmail }>> {
  return Promise.all(welcomeConcepts.map(async concept => {
    const content = {
      ...concept.content,
      socialLinks: concept.content.showSocialFooter ? resolveEmailSocialLinks() : undefined,
    };
    const html = await render(<StructuredEmail content={content} />);
    return {
      id: concept.id,
      label: concept.label,
      email: {
        event: 'account.welcome',
        stream: 'transactional',
        sender: 'account',
        preferenceKey: null,
        templateVersion: `concept-${concept.id}-1.0.0`,
        subject: concept.content.subject,
        preheader: concept.content.preheader,
        html,
        text: toPlainText(html).trim(),
        from: 'TalentConsulting <account@talentconsulting.io>',
        replyTo: 'support@talentconsulting.io',
        headers: {
          'X-TalentConsulting-Event': 'account.welcome',
          'X-TalentConsulting-Preview': `welcome-concept-${concept.id}`,
        },
        tags: [
          { name: 'event', value: 'account_welcome' },
          { name: 'stream', value: 'transactional' },
          { name: 'category', value: 'account' },
          { name: 'template', value: `welcome_${concept.id}` },
        ],
      },
    };
  }));
}
