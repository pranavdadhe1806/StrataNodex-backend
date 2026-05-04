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
