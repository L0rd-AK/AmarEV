import nodemailer from 'nodemailer';
import { logger } from '@/utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailVerificationData {
  email: string;
  displayName?: string;
  verificationToken: string;
  verificationLink: string;
}

interface PasswordResetData {
  email: string;
  displayName?: string;
  resetToken: string;
  resetLink: string;
}

export class EmailService {
  private static instance: EmailService | null = null;
  private transporter: nodemailer.Transporter | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private initialized: boolean = false;

  private constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@amarev.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'AmarEV';
    this.transporter = null;
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    if (!EmailService.instance.initialized) {
      EmailService.instance.initialize();
    }
    return EmailService.instance;
  }

  private initialize(): void {
    if (this.initialized) return;

    // Check if SMTP credentials are provided
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP credentials not provided. Email service will be disabled.');
      this.transporter = null;
      this.initialized = true;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection configuration
    this.verifyConnection();
    this.initialized = true;
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service is disabled - no SMTP credentials provided');
      return;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
    } catch (error) {
      logger.error('Email service connection failed:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Cannot send email - Email service is disabled');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', { messageId: info.messageId, to: options.to });
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  async sendEmailVerification(data: EmailVerificationData): Promise<boolean> {
    const html = this.generateEmailVerificationHTML(data);
    const text = this.generateEmailVerificationText(data);

    return await this.sendEmail({
      to: data.email,
      subject: 'Verify Your Email - AmarEV',
      html,
      text,
    });
  }

  async sendPasswordReset(data: PasswordResetData): Promise<boolean> {
    const html = this.generatePasswordResetHTML(data);
    const text = this.generatePasswordResetText(data);

    return await this.sendEmail({
      to: data.email,
      subject: 'Reset Your Password - AmarEV',
      html,
      text,
    });
  }

  async sendWelcomeEmail(email: string, displayName?: string): Promise<boolean> {
    const name = displayName || 'User';
    const html = this.generateWelcomeHTML(name);
    const text = this.generateWelcomeText(name);

    return await this.sendEmail({
      to: email,
      subject: 'Welcome to AmarEV!',
      html,
      text,
    });
  }

  async sendAccountLockedNotification(email: string, displayName?: string): Promise<boolean> {
    const name = displayName || 'User';
    const html = this.generateAccountLockedHTML(name);
    const text = this.generateAccountLockedText(name);

    return await this.sendEmail({
      to: email,
      subject: 'Account Security Alert - AmarEV',
      html,
      text,
    });
  }

  private generateEmailVerificationHTML(data: EmailVerificationData): string {
    const name = data.displayName || 'User';
    return `<h1>Welcome ${name}!</h1><p>Please verify your email: <a href="${data.verificationLink}">Verify</a></p>`;
  }

  private generateEmailVerificationText(data: EmailVerificationData): string {
    const name = data.displayName || 'User';
    return `Welcome ${name}! Please verify your email: ${data.verificationLink}`;
  }

  private generatePasswordResetHTML(data: PasswordResetData): string {
    const name = data.displayName || 'User';
    return `<h1>Password Reset</h1><p>Hello ${name}, reset your password: <a href="${data.resetLink}">Reset</a></p>`;
  }

  private generatePasswordResetText(data: PasswordResetData): string {
    const name = data.displayName || 'User';
    return `Password Reset - Hello ${name}, reset your password: ${data.resetLink}`;
  }

  private generateWelcomeHTML(name: string): string {
    return `<h1>Welcome to AmarEV, ${name}!</h1><p>Your account is now active.</p>`;
  }

  private generateWelcomeText(name: string): string {
    return `Welcome to AmarEV, ${name}! Your account is now active.`;
  }

  private generateAccountLockedHTML(name: string): string {
    return `<h1>Account Locked</h1><p>Hello ${name}, your account has been temporarily locked.</p>`;
  }

  private generateAccountLockedText(name: string): string {
    return `Account Locked - Hello ${name}, your account has been temporarily locked.`;
  }
}

export function getEmailService(): EmailService {
  return EmailService.getInstance();
}
