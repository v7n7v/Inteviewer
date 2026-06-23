/**
 * Shared Email Template System
 * Provides a unified shell (header + footer) and template builders
 * for all transactional and marketing emails.
 *
 * Design tokens:
 *   Header: #0f172a (slate-900)
 *   Accent: #10b981 (emerald-500)
 *   Text:   #1f2937 / #6b7280 / #9ca3af
 *   Border: #e5e7eb
 */

// ── Shared Constants ──────────────────────────────────────────

export const EMAIL_FROM = 'Talent Consulting <hello@talentconsulting.io>';

const BRAND_URL = 'https://talentconsulting.io';
const SUITE_URL = `${BRAND_URL}/suite`;
const SETTINGS_URL = `${SUITE_URL}/settings?tab=notifications`;
const BRAND_MARK_URL = `${BRAND_URL}/brand/talent-consulting-mark-512.png`;
const MAILING_ADDRESS = process.env.EMAIL_MAILING_ADDRESS || 'Talent Consulting, United States';

// ── Shell Builder ─────────────────────────────────────────────

interface ShellOptions {
  title: string;
  content: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

export function buildEmailShell(opts: ShellOptions): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px">
        <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 32px;background:#10b981;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;border-radius:10px;letter-spacing:0.01em">
          ${opts.ctaLabel}
        </a>
      </div>`
    : '';

  const unsubLine = opts.showUnsubscribe
    ? `<span style="margin:0 6px;color:#d1d5db">·</span><a href="${opts.unsubscribeUrl || SETTINGS_URL}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>`
    : '';

  const footerNote = opts.footerNote
    ? `<p style="font-size:11px;color:#9ca3af;margin:6px 0 0;line-height:1.5">${opts.footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
      <table role="presentation" style="border-collapse:collapse;margin:0 0 12px">
        <tr>
          <td style="width:44px;padding:0 10px 0 0;vertical-align:middle">
            <img src="${BRAND_MARK_URL}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none" />
          </td>
          <td style="vertical-align:middle">
            <a href="${BRAND_URL}" style="color:#ffffff;text-decoration:none;font-size:18px;font-weight:700;letter-spacing:-0.01em">Talent Consulting</a>
          </td>
        </tr>
      </table>
      <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">${opts.title}</h1>
    </div>

    <!-- Content -->
    <div style="background:#ffffff;padding:28px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
      ${opts.content}
      ${cta}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;text-align:center">
      <p style="font-size:11px;color:#9ca3af;margin:0">
        &copy; ${new Date().getFullYear()} <a href="${BRAND_URL}" style="color:#9ca3af;text-decoration:none">TalentConsulting.io</a>
        ${unsubLine}
      </p>
      ${footerNote}
      <p style="font-size:10px;color:#c0c4cc;margin:6px 0 0;line-height:1.5">${MAILING_ADDRESS}</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Helper: score badge color ─────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '';
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '';
}

// ── Template: Welcome ─────────────────────────────────────────

export function buildWelcomeEmail(name: string): { subject: string; html: string } {
  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 20px">
      Welcome to Talent Consulting. Your account is ready. Here's how to get the most out of it:
    </p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 8px">
      ${[
        { step: '1', icon: '📄', text: 'Upload your resume to the Vault' },
        { step: '2', icon: '🎯', text: 'Set your job preferences for AI-curated matches' },
        { step: '3', icon: '🎙️', text: 'Practice with the Interview Simulator' },
        { step: '4', icon: '📬', text: '<a href="' + SETTINGS_URL + '" style="color:#10b981;text-decoration:underline">Enable weekly job alerts</a> — get curated matches in your inbox every Monday' },
      ].map(s => `
        <tr>
          <td style="padding:10px 12px;vertical-align:top;width:32px">
            <div style="width:28px;height:28px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0;text-align:center;line-height:28px;font-size:13px;font-weight:700;color:#16a34a">${s.step}</div>
          </td>
          <td style="padding:10px 12px;font-size:14px;color:#374151;line-height:1.5">
            ${s.text}
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  return {
    subject: 'Welcome to Talent Consulting',
    html: buildEmailShell({
      title: 'Welcome to Talent Consulting',
      content,
      ctaLabel: 'Go to Dashboard →',
      ctaUrl: SUITE_URL,
    }),
  };
}

// ── Template: Subscription Confirmed ──────────────────────────

export function buildSubscriptionConfirmedEmail(
  name: string,
  plan: string,
  interval: string,
  priceDisplay?: string
): { subject: string; html: string } {
  const planLabel = plan === 'studio' ? 'Max' : 'Pro';
  const price = priceDisplay || '';

  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 20px">
      Your Talent ${planLabel} plan is active. Your tools and limits are ready in Talent Studio.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Current plan</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#059669">Talent ${planLabel}</p>
      ${price ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280">${price}</p>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse">
      ${[
        'Resume tailoring with higher limits',
        'Interview practice with AI feedback',
        'Cover letters, LinkedIn, and career writing tools',
        'Weekly curated job matches',
        'Priority AI processing',
      ].map(f => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151">
            <span style="color:#10b981;margin-right:8px">✓</span>${f}
          </td>
        </tr>
      `).join('')}
    </table>
  `;

  return {
    subject: `Talent ${planLabel} is active`,
    html: buildEmailShell({
      title: `Talent ${planLabel} Is Active`,
      content,
      ctaLabel: 'Open Talent Studio',
      ctaUrl: SUITE_URL,
      footerNote: 'Billing is processed securely by Stripe. You can manage your plan from Settings.',
    }),
  };
}

// ── Template: Subscription Cancelled ──────────────────────────

export function buildSubscriptionCancelledEmail(name: string, accessEndsAt?: string): { subject: string; html: string } {
  const accessLine = accessEndsAt
    ? `Your paid access stays active until <strong>${accessEndsAt}</strong>.`
    : 'Your paid access stays active through the end of the current billing period.';
  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Your plan is set to end. ${accessLine}
    </p>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 8px">
      Your resumes, applications, preferences, and saved work stay in place. After access ends, your account moves to Free and you can restart a paid plan anytime.
    </p>
  `;

  return {
    subject: 'Your plan is scheduled to end',
    html: buildEmailShell({
      title: 'Plan Cancellation Scheduled',
      content,
      ctaLabel: 'Review Plan',
      ctaUrl: `${SUITE_URL}/settings?tab=subscription`,
      footerNote: 'Billing changes are handled securely through Stripe.',
    }),
  };
}

// ── Template: Plan Change ─────────────────────────────────────

export function buildPlanChangeEmail(
  name: string,
  oldPlan: string,
  newPlan: string
): { subject: string; html: string } {
  const labels: Record<string, string> = { free: 'Free', pro: 'Pro', studio: 'Max' };
  const oldLabel = labels[oldPlan] || oldPlan;
  const newLabel = labels[newPlan] || newPlan;
  const isUpgrade = newPlan === 'studio' || (newPlan === 'pro' && oldPlan === 'free');

  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 20px">
      Your plan has been ${isUpgrade ? 'upgraded' : 'changed'}.
    </p>

    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin:0 0 20px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="text-align:center;padding:16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;width:42%">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Previous</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#6b7280">${oldLabel}</p>
          </td>
          <td style="text-align:center;width:16%;color:#9ca3af;font-size:20px">→</td>
          <td style="text-align:center;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;width:42%">
            <p style="margin:0 0 4px;font-size:11px;color:#059669;text-transform:uppercase;letter-spacing:0.05em">Current</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#059669">${newLabel}</p>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">
      ${isUpgrade
        ? 'You now have access to additional features and higher limits.'
        : 'Your access has been adjusted to match your new plan. Your data and preferences are preserved.'}
    </p>
  `;

  return {
    subject: `Your plan has been ${isUpgrade ? 'upgraded' : 'updated'} to ${newLabel}`,
    html: buildEmailShell({
      title: isUpgrade ? 'Plan Upgraded' : 'Plan Updated',
      content,
      ctaLabel: 'View Your Plan →',
      ctaUrl: `${SUITE_URL}/settings?tab=subscription`,
    }),
  };
}

// ── Template: Trial Ending ────────────────────────────────────

export function buildTrialEndingEmail(name: string, daysLeft: number): { subject: string; html: string } {
  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hi ${name},
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 20px">
      Your free trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. After that, you'll be moved to the Free tier.
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin:0 0 20px">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5">
        <strong>What changes:</strong> Higher limits, interview sessions, AI cover letters, and priority queue access return to the Free tier.
      </p>
    </div>

    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">
      Upgrade now to keep uninterrupted access.
    </p>
  `;

  return {
    subject: `Your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: buildEmailShell({
      title: 'Your Trial Is Ending Soon',
      content,
      ctaLabel: 'Upgrade Now →',
      ctaUrl: `${SUITE_URL}/settings?tab=subscription`,
    }),
  };
}

// ── Template: Account Upgrade (admin-granted) ─────────────────

export function buildUpgradeEmail(plan: string, months?: number): { subject: string; html: string } {
  const planName = plan === 'studio' ? 'Max Tier' : plan === 'pro' ? 'Pro Tier' : 'Free Tier';
  const durationText = months ? `for the next ${months} months` : '';

  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 16px">
      Hello,
    </p>
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 20px">
      Your Talent Consulting account has been upgraded to the <strong>${planName}</strong>.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">New Access Level</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#059669">${planName}</p>
      ${durationText ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280">Valid ${durationText}</p>` : ''}
    </div>

    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0">
      You now have access to enhanced features, increased AI generation limits, and premium tools.
    </p>
  `;

  return {
    subject: `Account Upgrade: ${planName} unlocked!`,
    html: buildEmailShell({
      title: 'Your Account Has Been Upgraded',
      content,
      ctaLabel: 'Go to Dashboard →',
      ctaUrl: SUITE_URL,
    }),
  };
}

// ── Template: Job Digest (weekly picks) ───────────────────────

export interface JobForDigest {
  title: string;
  company: string;
  location: string;
  acceptanceChance: number;
  acceptanceReason: string;
  url: string;
  salary?: { min: number | null; max: number | null };
  freshnessNote?: string;
  ghostRisk?: 'low' | 'medium' | 'high';
  prepareUrl?: string;
  saveUrl?: string;
  viewUrl?: string;
}

export function buildJobDigestEmail(
  name: string,
  jobs: JobForDigest[],
  topScore: number,
  opts: {
    tier?: string;
    frequencyLabel?: string;
    unsubscribeUrl?: string;
    campaign?: string;
  } = {}
): { subject: string; html: string } {
  const jobCards = jobs.slice(0, 15).map(job => {
    const color = scoreColor(job.acceptanceChance);
    const sal = job.salary ? formatSalary(job.salary.min ?? null, job.salary.max ?? null) : '';
    const riskColor = job.ghostRisk === 'high' ? '#ef4444' : job.ghostRisk === 'medium' ? '#f59e0b' : '#10b981';
    const prepareUrl = job.prepareUrl || `${SUITE_URL}/resume`;
    const saveUrl = job.saveUrl || `${SUITE_URL}/applications`;
    const viewUrl = job.viewUrl || job.url;

    return `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 12px;background:#ffffff">
        <!-- Score + salary row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 10px">
          <span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700;color:${color};background:${color}12;border:1px solid ${color}25">
            ${job.acceptanceChance}% match
          </span>
          ${sal ? `<span style="font-size:12px;font-weight:600;color:#10b981">${sal}</span>` : ''}
        </div>

        <!-- Title + company -->
        <h3 style="margin:0 0 2px;font-size:15px;font-weight:600;color:#111827;line-height:1.3">${job.title}</h3>
        <p style="margin:0 0 6px;font-size:13px;color:#6b7280">${job.company} · ${job.location}</p>

        <!-- AI reason -->
        <p style="margin:0 0 12px;font-size:12px;color:#9ca3af;font-style:italic;line-height:1.4">${job.acceptanceReason}</p>
        ${job.freshnessNote || job.ghostRisk ? `
          <p style="margin:0 0 12px;font-size:11px;color:${riskColor};line-height:1.4">
            ${job.freshnessNote || `${job.ghostRisk} posting-risk signal`}
          </p>
        ` : ''}

        <!-- CTAs -->
        <div>
          <a href="${prepareUrl}" style="display:inline-block;padding:8px 16px;border-radius:7px;font-size:12px;font-weight:700;color:#ffffff;background:#10b981;text-decoration:none;margin-right:8px">Prepare Application</a>
          <a href="${saveUrl}" style="display:inline-block;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:600;color:#06b6d4;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.18);text-decoration:none;margin-right:8px">Save to Pipeline</a>
          <a href="${viewUrl}" style="display:inline-block;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:600;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;text-decoration:none" target="_blank">View Job</a>
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <p style="font-size:15px;color:#1f2937;line-height:1.7;margin:0 0 4px">
      Hi ${name},
    </p>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 20px">
      Here are your top ${jobs.length} Sona-crafted matches${opts.frequencyLabel ? ` for this ${opts.frequencyLabel.toLowerCase()} digest` : ''}. Best match: <strong style="color:${scoreColor(topScore)}">${topScore}%</strong>.
    </p>
    ${jobCards}
  `;

  return {
    subject: `Sona Picks: ${jobs.length} crafted jobs — up to ${topScore}% fit`,
    html: buildEmailShell({
      title: 'Sona Picks',
      content,
      ctaLabel: 'View All Suggestions →',
      ctaUrl: `${SUITE_URL}/job-search`,
      showUnsubscribe: true,
      unsubscribeUrl: opts.unsubscribeUrl,
      footerNote: 'You\'re receiving this because you enabled Sona Picks job alerts.',
    }),
  };
}

// ── Template: Study Reminder (Skill Bridge) ───────────────────

export interface SkillProgress {
  skill: string;
  completedDays: number;
  totalDays: number;
  todayFocus?: string;
  todayTasks?: string[];
}

export function buildStudyReminderEmail(
  name: string,
  skills: SkillProgress[],
  totalCompleted: number,
  totalDays: number,
  streak: number
): { subject: string; html: string } {
  const overallPercent = Math.round((totalCompleted / totalDays) * 100);

  const motivationalMessages = [
    "You're building something no AI can fake — real knowledge.",
    "Every day you study is a day closer to landing that interview.",
    "Skills aren't built overnight — but 7 days? That's doable.",
    "The best candidates aren't the ones with the best resumes. They're the ones who can back it up.",
  ];
  const motivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

  const skillRows = skills.map(s => {
    const pct = Math.round((s.completedDays / s.totalDays) * 100);
    const bar = '█'.repeat(s.completedDays) + '░'.repeat(s.totalDays - s.completedDays);

    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6">
          <div style="font-weight:600;color:#1a1a1a;margin:0 0 4px;font-size:14px">${s.skill}</div>
          <div style="font-family:monospace;font-size:13px;color:#10b981;letter-spacing:2px;margin:0 0 4px">${bar} ${pct}%</div>
          <div style="font-size:12px;color:#9ca3af">Day ${s.completedDays} of ${s.totalDays}${pct >= 100 ? ' — Complete!' : ''}</div>
          ${s.todayFocus ? `<div style="font-size:12px;color:#3b82f6;margin-top:6px;font-weight:500">Today: ${s.todayFocus}</div>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  const content = `
    <!-- Overall Progress -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px;padding:20px;color:white;margin:0 0 16px">
      <div style="font-size:32px;font-weight:800;margin:0 0 4px">${overallPercent}%</div>
      <div style="font-size:13px;opacity:0.7;margin:0 0 12px">Overall Progress · ${totalCompleted}/${totalDays} days · ${streak} day streak</div>
      <div style="background:rgba(255,255,255,0.15);border-radius:6px;height:6px;overflow:hidden">
        <div style="background:linear-gradient(to right,#10b981,#06b6d4);height:100%;width:${overallPercent}%;border-radius:6px"></div>
      </div>
    </div>

    <!-- Motivation -->
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin:0 0 16px;text-align:center">
      <p style="margin:0;font-size:13px;color:#92400e;font-style:italic;line-height:1.5">${motivation}</p>
    </div>

    <!-- Skill Table -->
    <table style="width:100%;border-collapse:collapse">
      ${skillRows}
    </table>
  `;

  const subject = overallPercent >= 100
    ? 'You completed all your study plans!'
    : overallPercent >= 50
      ? `${overallPercent}% done — you're past the halfway mark!`
      : `Day ${totalCompleted + 1} awaits — keep the momentum going!`;

  return {
    subject,
    html: buildEmailShell({
      title: 'Skill Bridge Daily',
      content,
      ctaLabel: 'Continue Studying →',
      ctaUrl: `${SUITE_URL}/skill-bridge`,
      showUnsubscribe: true,
      footerNote: 'You\'re receiving this because you opted in to Skill Bridge reminders.',
    }),
  };
}

// ── Template: Contact Form (internal notification) ────────────

export function buildContactEmail(
  safeName: string,
  safeEmail: string,
  categoryLabel: string,
  safeMessage: string
): { subject: string; html: string } {
  const content = `
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px;width:80px">From:</td>
        <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1f2937">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px">Email:</td>
        <td style="padding:8px 0;font-size:14px"><a href="mailto:${safeEmail}" style="color:#10b981">${safeEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:14px">Category:</td>
        <td style="padding:8px 0;font-size:14px;color:#1f2937">${categoryLabel}</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px" />
    <div style="font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap">${safeMessage}</div>
  `;

  return {
    subject: `[TalentConsulting] ${categoryLabel} from ${safeName}`,
    html: buildEmailShell({ title: `New ${categoryLabel}`, content }),
  };
}

// ── Outcome Check Email ───────────────────────────────────────

interface PendingApp {
  company: string;
  jobTitle: string;
  daysAgo: number;
  appId: string;
}

export function buildOutcomeCheckEmail(
  name: string,
  pendingApps: PendingApp[]
): { subject: string; html: string } {
  const appRows = pendingApps.slice(0, 5).map(app => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6">
        <div style="font-weight:600;color:#1f2937;font-size:14px">${app.company}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${app.jobTitle} · ${app.daysAgo} days ago</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap">
        <a href="${SUITE_URL}/applications?outcome=${app.appId}&result=callback" style="display:inline-block;padding:4px 10px;background:#10b981;color:white;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600;margin:0 2px">✓ Heard back</a>
        <a href="${SUITE_URL}/applications?outcome=${app.appId}&result=ghosted" style="display:inline-block;padding:4px 10px;background:#6b7280;color:white;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600;margin:0 2px">⌛ Nothing</a>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="font-size:15px;color:#1f2937;line-height:1.6;margin-bottom:20px">
      Hi ${name}, quick check-in on ${pendingApps.length} application${pendingApps.length > 1 ? 's' : ''} — any updates?
    </div>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <tbody>
        ${appRows}
      </tbody>
    </table>
    <div style="font-size:12px;color:#9ca3af;margin-top:16px;text-align:center">
      Tracking outcomes helps us personalize your job matches over time.
    </div>
  `;

  return {
    subject: `Quick check-in on ${pendingApps.length} application${pendingApps.length > 1 ? 's' : ''} — any updates?`,
    html: buildEmailShell({
      title: 'Application Check-in',
      content,
      ctaLabel: 'View All Applications',
      ctaUrl: `${SUITE_URL}/applications`,
      footerNote: 'You can log outcomes anytime from your Applications page.',
    }),
  };
}

// ── Agent Digest Email ────────────────────────────────────────

export interface AgentJobForDigest {
  title: string;
  company: string;
  location: string;
  matchScore: number;
  salary: string;
  reason?: string;
  nextAction?: string;
  riskCount?: number;
}

export function buildAgentDigestEmail(
  name: string,
  jobs: AgentJobForDigest[]
): { subject: string; html: string } {
  const scoreColor = (s: number) => s >= 85 ? '#2563eb' : s >= 75 ? '#10b981' : '#f59e0b';
  const topScore = jobs.reduce((max, job) => Math.max(max, job.matchScore || 0), 0);
  const riskCount = jobs.reduce((sum, job) => sum + (job.riskCount || 0), 0);

  const jobRows = jobs.map(j => `
    <tr>
      <td style="padding:18px 18px;border-bottom:1px solid #e8eef8">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,${scoreColor(j.matchScore)}24,#ffffff);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:${scoreColor(j.matchScore)};flex-shrink:0;border:1px solid ${scoreColor(j.matchScore)}42;box-shadow:0 10px 24px ${scoreColor(j.matchScore)}18">
            ${j.matchScore}%
          </div>
          <div style="min-width:0">
            <div style="font-weight:700;color:#111827;font-size:15px;line-height:1.35">${j.title}</div>
            <div style="font-size:12px;color:#4b5563;margin-top:3px">${j.company} · ${j.location}${j.salary ? ` · ${j.salary}` : ''}</div>
            ${j.reason ? `<div style="font-size:12px;color:#374151;line-height:1.55;margin-top:8px">${j.reason}</div>` : ''}
            <div style="margin-top:10px">
              <span style="display:inline-block;padding:4px 9px;background:#10b98114;color:#047857;border:1px solid #10b98124;border-radius:999px;font-size:10px;font-weight:700;margin-right:5px">Packet ready</span>
              <span style="display:inline-block;padding:4px 9px;background:#2563eb12;color:#1d4ed8;border:1px solid #2563eb24;border-radius:999px;font-size:10px;font-weight:700;margin-right:5px">${j.nextAction || 'Review next'}</span>
              ${j.riskCount ? `<span style="display:inline-block;padding:4px 9px;background:#f59e0b14;color:#b45309;border:1px solid #f59e0b24;border-radius:999px;font-size:10px;font-weight:700">${j.riskCount} check${j.riskCount > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;width:54px;height:54px;border-radius:18px;background:linear-gradient(135deg,#dbeafe,#e0f2fe 48%,#f5d0fe);margin-bottom:12px;line-height:54px;font-size:24px;border:1px solid #bfdbfe;color:#2563eb;font-weight:900">S</div>
      <div style="font-size:18px;font-weight:800;color:#111827">Sona prepared ${jobs.length} high-fit packet${jobs.length > 1 ? 's' : ''}</div>
      <div style="font-size:13px;color:#4b5563;margin-top:5px;line-height:1.6">Review the shortlist, inspect the tailored assets, then decide what to submit. Nothing was sent for you.</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#f8fafc">
        <div style="font-size:20px;font-weight:800;color:#111827">${jobs.length}</div>
        <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Packets</div>
      </div>
      <div style="border:1px solid #dbeafe;border-radius:14px;padding:12px;background:#eff6ff">
        <div style="font-size:20px;font-weight:800;color:#1d4ed8">${topScore}%</div>
        <div style="font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Top fit</div>
      </div>
      <div style="border:1px solid #fef3c7;border-radius:14px;padding:12px;background:#fffbeb">
        <div style="font-size:20px;font-weight:800;color:#b45309">${riskCount}</div>
        <div style="font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Checks</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <tbody>
        ${jobRows}
      </tbody>
    </table>
    <div style="margin-top:16px;padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;color:#475569;font-size:12px;line-height:1.6">
      Sona only prepared these packets. Open Talent Studio to review the resume, cover letter, posting, and fit notes before you apply.
    </div>
  `;

  return {
    subject: `Sona prepared ${jobs.length} high-fit opportunit${jobs.length > 1 ? 'ies' : 'y'} for review`,
    html: buildEmailShell({
      title: 'Agent Digest',
      content,
      ctaLabel: 'Review Agent Queue',
      ctaUrl: `${SUITE_URL}/agent/queue`,
      footerNote: 'Sona digest emails are opt-in. Manage them from Job Search preferences.',
    }),
  };
}

// ── Template: Custom Admin Email ──────────────────────────────

export function buildCustomEmail(
  subject: string,
  bodyHtml: string,
  ctaLabel?: string,
  ctaUrl?: string
): { subject: string; html: string } {
  return {
    subject,
    html: buildEmailShell({
      title: subject,
      content: `<div style="font-size:15px;color:#1f2937;line-height:1.7">${bodyHtml}</div>`,
      ctaLabel,
      ctaUrl,
    }),
  };
}
