import { Resend } from 'resend';
import type { Config } from './config.js';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(email: Email): Promise<void>;
}

/**
 * EMAIL_MODE=log writes emails to the server log instead of sending them. Use it while testing with
 * friends before a custom domain is verified: Resend only delivers to your own address until then.
 */
export function createEmailSender(config: Config): EmailSender {
  if (config.EMAIL_MODE === 'log') {
    return {
      async send({ to, subject, text }) {
        console.log(`[email] to=${to} subject="${subject}"\n${text}`);
      },
    };
  }
  const resend = new Resend(config.RESEND_API_KEY);
  return {
    async send({ to, subject, text }) {
      const { error } = await resend.emails.send({ from: config.EMAIL_FROM, to, subject, text });
      if (error) throw new Error(`Resend failed: ${error.message}`);
    },
  };
}

export function codeEmail(purpose: 'verify' | 'reset', code: string): Omit<Email, 'to'> {
  const what = purpose === 'verify' ? 'verify your email' : 'reset your password';
  return {
    subject: purpose === 'verify' ? `Your Dungeon Drill code: ${code}` : `Reset your Dungeon Drill password: ${code}`,
    text: `Your code to ${what} is ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.`,
  };
}
