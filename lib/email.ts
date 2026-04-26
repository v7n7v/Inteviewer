import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(key);
  }
  return _resend;
}
const FROM_EMAIL = 'TalentConsulting <hello@talentconsulting.io>';

export async function sendUpgradeEmail(toEmail: string, plan: string, months?: number) {
  try {
    if (!toEmail) return false;

    const planName = plan === 'studio' ? 'Max Tier' : plan === 'pro' ? 'Pro Tier' : 'Free Tier';
    const durationText = months ? `for the next ${months} months` : 'permanently';

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Your Account has been Upgraded!</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
            Hello,
          </p>
          <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
            We are excited to let you know that your Talent Consulting account has just been upgraded to the <strong>${planName}</strong>.
          </p>
          <div style="margin: 24px 0; padding: 16px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">New Access Level</p>
            <p style="margin: 8px 0 0; color: #059669; font-size: 24px; font-weight: bold;">${planName}</p>
            ${months ? `<p style="margin: 4px 0 0; color: #6b7280; font-size: 12px;">Valid ${durationText}</p>` : ''}
          </div>
          <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
            You now have access to enhanced features, increased AI generation limits, and premium tools.
          </p>
          <div style="margin-top: 32px; text-align: center;">
            <a href="https://talentconsulting.io/suite" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Go to Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
            TalentConsulting.io &bull; The Industrial Tech Forge
          </p>
        </div>
      </div>
    `;

    await getResend().emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: `Account Upgrade: ${planName} unlocked!`,
      html,
    });

    return true;
  } catch (error) {
    console.error('[email] Failed to send upgrade email:', error);
    return false;
  }
}
