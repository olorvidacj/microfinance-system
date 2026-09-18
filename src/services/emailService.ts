import nodemailer from 'nodemailer';

interface SendOtpEmailOptions {
  to: string;
  code: string;
  purpose?: 'registration' | 'password_reset';
}

export function isDirectSmtpConfigured(): boolean {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  return Boolean(user && pass);
}

function getMailTransporter() {
  const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  // Default to standard Gmail SMTP service
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });
}

export async function sendOtpEmail({ to, code, purpose = 'registration' }: SendOtpEmailOptions): Promise<{ sent: boolean; method: string }> {
  const subject = purpose === 'registration'
    ? `Your HOSCOMCO Verification Code: ${code}`
    : `HOSCOMCO Password Reset Code: ${code}`;

  if (isDirectSmtpConfigured()) {
    try {
      const transporter = getMailTransporter();
      const fromAddress = process.env.GMAIL_USER || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@HOSCOMCO.coop';

      await transporter.sendMail({
        from: `"HOSCOMCO Cooperative" <${fromAddress}>`,
        to,
        subject,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 800;">HOSCOMCO Multi-Purpose Cooperative</h2>
              <p style="color: #059669; font-weight: 600; font-size: 13px; margin: 4px 0 0 0;">Mobile Client Portal Security</p>
            </div>
            
            <p style="color: #334155; font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
              Hello,
            </p>
            <p style="color: #334155; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0;">
              Here is your official verification code to complete your ${purpose === 'registration' ? 'membership registration' : 'password reset'}:
            </p>

            <div style="background-color: #f8fafc; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
              <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0284c7; display: block;">
                ${code}
              </span>
            </div>

            <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 12px 0;">
              ⏳ This verification code expires in <strong>10 minutes</strong>.
            </p>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              If you did not request this verification code, please disregard this email. Never share this code with anyone.
            </p>
          </div>
        `,
      });

      console.log(`[Email Service] ✉️ Successfully sent OTP email via Gmail to ${to}`);
      return { sent: true, method: 'gmail-smtp' };
    } catch (err: any) {
      console.warn(`[Email Service] SMTP send failed (${err.message}). Logging code to console.`);
    }
  }

  // Console fallback ensures development & testing is never blocked
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📬 [SUPABASE GMAIL VERIFICATION] Recipient: ${to}`);
  console.log(`🔑 Verification Code: ${code}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { sent: false, method: 'console' };
}
