export type EmailType = 'VERIFICATION' | 'PASSWORD_RESET';

export interface EmailDeliveryResult {
  success: boolean;
  provider: string;
  emailType: EmailType;
  recipientDomain: string;
  recipientMasked: string;
  deliveryMode: 'real' | 'development_fallback' | 'optional';
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface SendVerificationEmailOptions {
  to: string;
  name?: string;
  verificationUrl: string;
}

export interface SendPasswordResetEmailOptions {
  to: string;
  name?: string;
  resetUrl: string;
}

export interface EmailPayload {
  to: string;
  name?: string;
  subject: string;
  html: string;
  text: string;
  emailType: EmailType;
  from?: string;
  replyTo?: string;
}

export interface IEmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendEmail(payload: EmailPayload): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    deliveryMode: 'real' | 'development_fallback';
  }>;
}

/**
 * Safely masks an email address for logging and auditing.
 * Example: john.doe@example.com -> j***e@example.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '[EMPTY]';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '[INVALID_EMAIL]';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local.charAt(0)}*@${domain}`;
  }
  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}

/**
 * Safely extracts the domain of an email address.
 */
export function extractDomain(email: string): string {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.trim().split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : 'unknown';
}
