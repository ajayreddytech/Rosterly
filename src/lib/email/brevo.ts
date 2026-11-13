import "server-only";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { dryRun: true }
  | { dryRun: false; messageId: string | null };

/**
 * Sends one transactional email through Brevo (v3 SMTP API).
 * Without BREVO_API_KEY or EMAIL_FROM it does nothing and reports dryRun, so
 * queued rows stay pending and nothing is marked as sent.
 */
export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return { dryRun: true };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: from, name: process.env.EMAIL_FROM_NAME || "Gala Volunteers" },
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { dryRun: false, messageId: body.messageId ?? null };
}

export function emailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}
