import {
  EmailType,
  EmailDeliveryResult,
  SendVerificationEmailOptions,
  SendPasswordResetEmailOptions,
  IEmailProvider,
  maskEmail,
  extractDomain
} from './types';
import { buildVerificationEmail, buildPasswordResetEmail } from './templates';
import { ResendProvider } from './providers/ResendProvider';
import { SmtpProvider } from './providers/SmtpProvider';
import { DevelopmentFallbackProvider } from './providers/DevelopmentFallbackProvider';
import { Logger } from '../../utils/logger';
import { isEmailVerificationEnabled } from '../../middleware/authMiddleware';

export class EmailService {
  private static instance: EmailService | null = null;
  private provider: IEmailProvider;
  private isProduction: boolean;

  constructor(customProvider?: IEmailProvider) {
    this.isProduction = process.env.NODE_ENV === 'production';

    if (customProvider) {
      this.provider = customProvider;
    } else {
      this.provider = this.resolveProvider();
    }
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * For testing or dynamic reconfiguration: sets a custom provider.
   */
  public static setInstance(service: EmailService): void {
    EmailService.instance = service;
  }

  /**
   * Resolves the configured email provider based on environment variables.
   */
  private resolveProvider(): IEmailProvider {
    const configuredProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

    if (configuredProvider === 'resend') {
      return new ResendProvider();
    }

    if (configuredProvider === 'smtp') {
      return new SmtpProvider();
    }

    // Auto-detect based on credential variables if EMAIL_PROVIDER is not explicitly declared
    if (!configuredProvider) {
      if (process.env.EMAIL_API_KEY && process.env.EMAIL_API_KEY.trim().length > 0) {
        return new ResendProvider();
      }
      if (process.env.SMTP_HOST && process.env.SMTP_HOST.trim().length > 0) {
        return new SmtpProvider();
      }
    }

    // Default fallback in development/test
    return new DevelopmentFallbackProvider();
  }

  public getProvider(): IEmailProvider {
    return this.provider;
  }

  public setProvider(provider: IEmailProvider): void {
    this.provider = provider;
  }

  public getStatus(): {
    provider: string;
    isConfigured: boolean;
    deliveryMode: 'real' | 'development_fallback';
    isProduction: boolean;
  } {
    return {
      provider: this.provider.name,
      isConfigured: this.provider.isConfigured,
      deliveryMode: this.provider.name === 'development_fallback' ? 'development_fallback' : 'real',
      isProduction: this.isProduction
    };
  }

  /**
   * Sends an email verification message.
   */
  public async sendVerificationEmail(options: SendVerificationEmailOptions): Promise<EmailDeliveryResult> {
    const startTime = Date.now();
    const recipientDomain = extractDomain(options.to);
    const recipientMasked = maskEmail(options.to);
    const emailType: EmailType = 'VERIFICATION';

    // When email verification is disabled via feature flag, real email delivery is NOT required
    if (!isEmailVerificationEnabled()) {
      return {
        success: true,
        provider: this.provider.name || 'verification_disabled',
        emailType,
        recipientDomain,
        recipientMasked,
        deliveryMode: 'optional',
        messageId: `opt_verif_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    }

    // In production, require a real configured provider
    if (this.isProduction && (!this.provider.isConfigured || this.provider.name === 'development_fallback')) {
      const errorMsg = 'Email delivery provider is not configured for production environment';
      Logger.error('Email delivery aborted in production', new Error(errorMsg), {
        emailType,
        recipientDomain,
        recipientMasked,
        provider: this.provider.name,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        provider: this.provider.name,
        emailType,
        recipientDomain,
        recipientMasked,
        deliveryMode: 'real',
        error: 'Email delivery service is currently unavailable. Please contact administrator.',
        timestamp: new Date().toISOString()
      };
    }

    const { subject, html, text } = buildVerificationEmail(options);

    try {
      const result = await this.provider.sendEmail({
        to: options.to,
        name: options.name,
        subject,
        html,
        text,
        emailType
      });

      const durationMs = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      if (result.success) {
        Logger.info('Email verification sent successfully', {
          emailType,
          recipientDomain,
          recipientMasked,
          provider: this.provider.name,
          deliveryMode: result.deliveryMode,
          messageId: result.messageId,
          durationMs,
          timestamp
        });

        return {
          success: true,
          provider: this.provider.name,
          emailType,
          recipientDomain,
          recipientMasked,
          deliveryMode: result.deliveryMode,
          messageId: result.messageId,
          timestamp
        };
      } else {
        Logger.error('Failed to deliver verification email', new Error(result.error || 'Provider delivery error'), {
          emailType,
          recipientDomain,
          recipientMasked,
          provider: this.provider.name,
          durationMs,
          timestamp
        });

        return {
          success: false,
          provider: this.provider.name,
          emailType,
          recipientDomain,
          recipientMasked,
          deliveryMode: result.deliveryMode,
          error: this.isProduction ? 'Unable to deliver verification email. Please try again later.' : (result.error || 'Delivery failed'),
          timestamp
        };
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      Logger.error('Unhandled exception during email verification delivery', err, {
        emailType,
        recipientDomain,
        recipientMasked,
        provider: this.provider.name,
        durationMs,
        timestamp
      });

      return {
        success: false,
        provider: this.provider.name,
        emailType,
        recipientDomain,
        recipientMasked,
        deliveryMode: this.provider.name === 'development_fallback' ? 'development_fallback' : 'real',
        error: this.isProduction ? 'Unable to deliver verification email. Please try again later.' : (err?.message || 'Delivery exception'),
        timestamp
      };
    }
  }

  /**
   * Sends a password reset recovery message.
   */
  public async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<EmailDeliveryResult> {
    const startTime = Date.now();
    const recipientDomain = extractDomain(options.to);
    const recipientMasked = maskEmail(options.to);
    const emailType: EmailType = 'PASSWORD_RESET';

    // In production, require a real configured provider
    if (this.isProduction && (!this.provider.isConfigured || this.provider.name === 'development_fallback')) {
      const errorMsg = 'Email delivery provider is not configured for production environment';
      Logger.error('Password reset email delivery aborted in production', new Error(errorMsg), {
        emailType,
        recipientDomain,
        recipientMasked,
        provider: this.provider.name,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        provider: this.provider.name,
        emailType,
        recipientDomain,
        recipientMasked,
        deliveryMode: 'real',
        error: 'Email delivery service is currently unavailable. Please contact administrator.',
        timestamp: new Date().toISOString()
      };
    }

    const { subject, html, text } = buildPasswordResetEmail(options);

    try {
      const result = await this.provider.sendEmail({
        to: options.to,
        name: options.name,
        subject,
        html,
        text,
        emailType
      });

      const durationMs = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      if (result.success) {
        Logger.info('Password reset email sent successfully', {
          emailType,
          recipientDomain,
          recipientMasked,
          provider: this.provider.name,
          deliveryMode: result.deliveryMode,
          messageId: result.messageId,
          durationMs,
          timestamp
        });

        return {
          success: true,
          provider: this.provider.name,
          emailType,
          recipientDomain,
          recipientMasked,
          deliveryMode: result.deliveryMode,
          messageId: result.messageId,
          timestamp
        };
      } else {
        Logger.error('Failed to deliver password reset email', new Error(result.error || 'Provider delivery error'), {
          emailType,
          recipientDomain,
          recipientMasked,
          provider: this.provider.name,
          durationMs,
          timestamp
        });

        return {
          success: false,
          provider: this.provider.name,
          emailType,
          recipientDomain,
          recipientMasked,
          deliveryMode: result.deliveryMode,
          error: this.isProduction ? 'Unable to deliver password reset email. Please try again later.' : (result.error || 'Delivery failed'),
          timestamp
        };
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      Logger.error('Unhandled exception during password reset delivery', err, {
        emailType,
        recipientDomain,
        recipientMasked,
        provider: this.provider.name,
        durationMs,
        timestamp
      });

      return {
        success: false,
        provider: this.provider.name,
        emailType,
        recipientDomain,
        recipientMasked,
        deliveryMode: this.provider.name === 'development_fallback' ? 'development_fallback' : 'real',
        error: this.isProduction ? 'Unable to deliver password reset email. Please try again later.' : (err?.message || 'Delivery exception'),
        timestamp
      };
    }
  }
}
