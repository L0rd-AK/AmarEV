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
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@amarev.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'AmarEV';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
    } catch (error) {
      logger.error('Email service connection failed:', error);
    }
  }

  /**
   * Send generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
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

  /**
   * Send email verification email
   */
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

  /**
   * Send password reset email
   */
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

  /**
   * Send welcome email after successful verification
   */
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

  /**
   * Send account locked notification
   */
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

  /**
   * Generate email verification HTML template
   */
  private generateEmailVerificationHTML(data: EmailVerificationData): string {
    const name = data.displayName || 'User';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AmarEV</h1>
          </div>
          <div class="content">
            <h2>Welcome to AmarEV, ${name}!</h2>
            <p>Thank you for registering with AmarEV, Bangladesh's premier electric vehicle charging platform.</p>
            <p>To complete your registration and start using our services, please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${data.verificationLink}" class="button">Verify Email Address</a>
            </p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${data.verificationLink}">${data.verificationLink}</a></p>
            <p><strong>This verification link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with AmarEV, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 AmarEV. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate email verification text template
   */
  private generateEmailVerificationText(data: EmailVerificationData): string {
    const name = data.displayName || 'User';
    
    return `
Welcome to AmarEV, ${name}!

Thank you for registering with AmarEV, Bangladesh's premier electric vehicle charging platform.

To complete your registration and start using our services, please verify your email address by visiting this link:

${data.verificationLink}

This verification link will expire in 24 hours.

If you didn't create an account with AmarEV, please ignore this email.

© 2024 AmarEV. All rights reserved.
This is an automated message. Please do not reply to this email.
    `;
  }

  /**
   * Generate password reset HTML template
   */
  private generatePasswordResetHTML(data: PasswordResetData): string {
    const name = data.displayName || 'User';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AmarEV</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello ${name},</p>
            <p>We received a request to reset the password for your AmarEV account.</p>
            <p>If you made this request, click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${data.resetLink}" class="button">Reset Password</a>
            </p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${data.resetLink}">${data.resetLink}</a></p>
            <div class="warning">
              <p><strong>Important Security Information:</strong></p>
              <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged if you don't click the link</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 AmarEV. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate password reset text template
   */
  private generatePasswordResetText(data: PasswordResetData): string {
    const name = data.displayName || 'User';
    
    return `
Password Reset Request - AmarEV

Hello ${name},

We received a request to reset the password for your AmarEV account.

If you made this request, visit this link to reset your password:
${data.resetLink}

IMPORTANT SECURITY INFORMATION:
- This password reset link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged if you don't click the link

© 2024 AmarEV. All rights reserved.
This is an automated message. Please do not reply to this email.
    `;
  }

  /**
   * Generate welcome HTML template
   */
  private generateWelcomeHTML(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to AmarEV</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .feature { margin: 15px 0; padding: 15px; background: white; border-radius: 5px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to AmarEV!</h1>
          </div>
          <div class="content">
            <h2>Your account is now active, ${name}!</h2>
            <p>Congratulations! Your email has been verified and your AmarEV account is now fully activated.</p>
            
            <h3>What you can do now:</h3>
            <div class="feature">
              <h4>🔍 Find Charging Stations</h4>
              <p>Locate nearby electric vehicle charging stations across Bangladesh</p>
            </div>
            <div class="feature">
              <h4>📱 Make Reservations</h4>
              <p>Reserve charging slots in advance to ensure availability</p>
            </div>
            <div class="feature">
              <h4>💳 Easy Payments</h4>
              <p>Pay for charging sessions using multiple payment methods</p>
            </div>
            <div class="feature">
              <h4>📊 Track Usage</h4>
              <p>Monitor your charging history and energy consumption</p>
            </div>
            
            <p>Ready to get started? Log in to your account and explore the future of electric mobility in Bangladesh!</p>
          </div>
          <div class="footer">
            <p>© 2024 AmarEV. All rights reserved.</p>
            <p>Need help? Contact us at support@amarev.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate welcome text template
   */
  private generateWelcomeText(name: string): string {
    return `
Welcome to AmarEV!

Your account is now active, ${name}!

Congratulations! Your email has been verified and your AmarEV account is now fully activated.

What you can do now:
• Find Charging Stations - Locate nearby EV charging stations across Bangladesh
• Make Reservations - Reserve charging slots in advance
• Easy Payments - Pay using multiple payment methods
• Track Usage - Monitor your charging history

Ready to get started? Log in to your account and explore the future of electric mobility in Bangladesh!

© 2024 AmarEV. All rights reserved.
Need help? Contact us at support@amarev.com
    `;
  }

  /**
   * Generate account locked HTML template
   */
  private generateAccountLockedHTML(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Security Alert</h1>
          </div>
          <div class="content">
            <h2>Account Temporarily Locked</h2>
            <p>Hello ${name},</p>
            <div class="alert">
              <p><strong>Your AmarEV account has been temporarily locked due to multiple failed login attempts.</strong></p>
            </div>
            <p>This is a security measure to protect your account from unauthorized access.</p>
            
            <h3>What happens next?</h3>
            <ul>
              <li>Your account will be automatically unlocked after 2 hours</li>
              <li>You can try logging in again after this time period</li>
              <li>If you forgot your password, you can reset it using the "Forgot Password" option</li>
            </ul>
            
            <h3>If this wasn't you:</h3>
            <p>If you weren't trying to access your account, someone else might have been attempting to log in. Please consider:</p>
            <ul>
              <li>Changing your password once the account is unlocked</li>
              <li>Using a strong, unique password</li>
              <li>Enabling two-factor authentication if available</li>
            </ul>
          </div>
          <div class="footer">
            <p>© 2024 AmarEV. All rights reserved.</p>
            <p>If you need assistance, contact us at security@amarev.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate account locked text template
   */
  private generateAccountLockedText(name: string): string {
    return `
Account Security Alert - AmarEV

Account Temporarily Locked

Hello ${name},

Your AmarEV account has been temporarily locked due to multiple failed login attempts.

This is a security measure to protect your account from unauthorized access.

What happens next?
• Your account will be automatically unlocked after 2 hours
• You can try logging in again after this time period  
• If you forgot your password, you can reset it using the "Forgot Password" option

If this wasn't you:
If you weren't trying to access your account, someone else might have been attempting to log in. Please consider:
• Changing your password once the account is unlocked
• Using a strong, unique password
• Enabling two-factor authentication if available

© 2024 AmarEV. All rights reserved.
If you need assistance, contact us at security@amarev.com
    `;
  }
}

// Export singleton instance
export const emailService = new EmailService();