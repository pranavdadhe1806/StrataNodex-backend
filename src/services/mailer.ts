import { BrevoClient } from '@getbrevo/brevo';

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY as string,
});

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await client.transactionalEmails.sendTransacEmail({
    subject: 'Your StrataNodex verification code',
    sender: {
      name: 'StrataNodex',
      email: process.env.BREVO_SENDER_EMAIL as string,
    },
    to: [{ email: to }],
    htmlContent: `
      <div style="font-family: monospace; background: #0d1117; color: #e6edf3; padding: 32px; border-radius: 8px; max-width: 400px;">
        <h2 style="color: #00bfff; margin: 0 0 8px;">StrataNodex</h2>
        <p style="color: #8b949e; margin: 0 0 24px;">Your verification code</p>
        <div style="background: #161b22; border: 1px solid #00bfff; border-radius: 6px; padding: 20px; text-align: center;">
          <span style="font-size: 32px; letter-spacing: 8px; color: #00bfff; font-weight: bold;">${otp}</span>
        </div>
        <p style="color: #8b949e; margin: 24px 0 0; font-size: 12px;">Expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendDailyReminderEmail(
  to: string,
  username: string,
  formattedMessage: string
): Promise<void> {
  const htmlMessage = formattedMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/📁 (.+)/g, '<strong>📁 $1</strong>')
    .replace(/📋 (.+)/g, '&nbsp;&nbsp;📋 $1')

  await client.transactionalEmails.sendTransacEmail({
    subject: '📋 Your StrataNodex Daily Tasks',
    sender: {
      name: 'StrataNodex',
      email: process.env.BREVO_SENDER_EMAIL as string,
    },
    to: [{ email: to }],
    htmlContent: `
      <div style="font-family: 'Poppins', sans-serif; background: #1B1D21; color: #EDEFF3; padding: 32px; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #00bfff; margin-bottom: 24px;">StrataNodex</h2>
        <div style="line-height: 1.8; font-size: 15px;">
          ${htmlMessage}
        </div>
        <hr style="border-color: #32363C; margin: 24px 0;" />
        <p style="color: #7D828B; font-size: 12px;">
          You're receiving this because you enabled daily reminders.
          <a href="${process.env.WEB_APP_URL}/settings" style="color: #00bfff;">Manage preferences</a>
        </p>
      </div>
    `,
  });
}
