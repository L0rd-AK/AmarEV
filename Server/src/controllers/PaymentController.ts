import { Request, Response } from 'express';
import { PaymentProvider, PaymentStatus, ReservationStatus } from '@chargebd/shared';
import { paymentService } from '../services/PaymentService';
import { bKashService } from '../services/bKashService';
import { Reservation } from '../models/Reservation';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { reservationExpiryQueue, paymentReminderQueue } from '../config/queue';
import { AuthenticatedRequest } from '../middleware/auth';
import { Types } from 'mongoose';

const initiatePaymentSchema = z.object({
  reservationId: z.string().optional(),
  sessionId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default('BDT'),
  paymentMethod: z.enum([PaymentProvider.SSLCOMMERZ, PaymentProvider.BKASH]),
  description: z.string().optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const executePaymentSchema = z.object({
  paymentId: z.string(),
  paymentMethod: z.enum([PaymentProvider.SSLCOMMERZ, PaymentProvider.BKASH]),
});

const verifyPaymentSchema = z.object({
  transactionId: z.string(),
  paymentMethod: z.enum([PaymentProvider.SSLCOMMERZ, PaymentProvider.BKASH]),
});

const refundPaymentSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive(),
  reason: z.string().optional(),
  paymentMethod: z.enum([PaymentProvider.SSLCOMMERZ, PaymentProvider.BKASH]),
});

export class PaymentController {
  /**
   * Initiate a payment
   */
  async initiatePayment(req: AuthenticatedRequest, res: Response) {
    try {
      const validation = initiatePaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const {
        reservationId,
        sessionId,
        amount,
        currency,
        paymentMethod,
        description,
        successUrl,
        failUrl,
        cancelUrl,
      } = validation.data;

      const userId = req.userId!;
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Fetch full user details for payment
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Validate reservation or session
      let contextData: any = {};
      if (reservationId) {
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
          return res.status(404).json({
            success: false,
            error: 'Reservation not found',
          });
        }
        if (reservation.userId.toString() !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
          });
        }
        contextData.reservationId = reservationId;
        contextData.stationId = reservation.stationId;
      }

      if (sessionId) {
        const session = await Session.findById(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
          });
        }
        if (session.userId.toString() !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
          });
        }
        contextData.sessionId = sessionId;
        contextData.stationId = session.stationId;
      }

      const paymentData = {
        amount,
        currency,
        orderId: transactionId,
        customerInfo: {
          name: user.displayName || user.email.split('@')[0] || 'Customer',
          email: user.email,
          phone: user.phone || 'N/A',
        },
        description: description || 'EV Charging Service',
        successUrl,
        failUrl,
        cancelUrl,
        metadata: {
          userId,
          idempotencyKey: `${userId}_${Date.now()}`,
          ...contextData,
        },
      };

      const response = await paymentService.initiatePayment(paymentMethod, paymentData);

      if (response.success) {
        logger.info(`Payment initiated successfully`, {
          userId,
          transactionId,
          paymentMethod,
          amount,
        });

        res.json({
          success: true,
          data: {
            transactionId,
            paymentUrl: response.paymentUrl,
            gatewayPageURL: response.gatewayPageURL,
            sessionKey: response.sessionKey,
          },
        });
      } else {
        logger.error(`Payment initiation failed`, {
          userId,
          transactionId,
          paymentMethod,
          error: response.error,
        });

        res.status(400).json({
          success: false,
          error: response.error,
          errorCode: response.errorCode,
        });
      }
    } catch (error) {
      logger.error(`Payment initiation error`, {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Execute bKash payment (after user authorization)
   */
  async executePayment(req: AuthenticatedRequest, res: Response) {
    try {
      const validation = executePaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { paymentId, paymentMethod } = validation.data;

      if (paymentMethod !== PaymentProvider.BKASH) {
        return res.status(400).json({
          success: false,
          error: 'Execute payment is only supported for bKash',
        });
      }

      if (!bKashService) {
        return res.status(503).json({
          success: false,
          error: 'bKash service is not available',
        });
      }

      const response = await bKashService.executePayment(paymentId);

      if (response.status_code === '0000') {
        logger.info(`bKash payment executed successfully`, {
          paymentId,
          trxId: response.trxID,
          amount: response.amount,
        });

        res.json({
          success: true,
          data: {
            paymentId: response.paymentID,
            transactionId: response.trxID,
            amount: parseFloat(response.amount),
            status: response.transactionStatus,
          },
        });
      } else {
        logger.error(`bKash payment execution failed`, {
          paymentId,
          error: response.errorMessage,
        });

        res.status(400).json({
          success: false,
          error: response.errorMessage || 'Payment execution failed',
          errorCode: response.errorCode,
        });
      }
    } catch (error) {
      logger.error(`Payment execution error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Verify payment status
   * 
   * This endpoint handles the complete payment verification flow:
   * 1. Verifies payment with the payment gateway (SSLCommerz/bKash)
   * 2. Updates payment record in Payment collection (transaction history)
   * 3. Deletes the reservation from Reservation collection after successful payment
   * 4. Cancels scheduled expiry and reminder jobs for the reservation
   * 5. Logs transaction details for audit trail
   * 
   * Note: Payments are permanently stored in the Payment collection which serves
   * as the complete transaction history. Reservations are removed after successful
   * payment completion as they are only needed during the booking process.
   */
  async verifyPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const validation = verifyPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { transactionId, paymentMethod } = validation.data;

      const response = await paymentService.verifyPayment(paymentMethod, transactionId);

      // If payment is successful, delete reservation and record transaction
      if (response.success && response.status === PaymentStatus.COMPLETED) {
        try {
          // Find payment record to get reservation ID
          const payment = await paymentService.getPayment(transactionId);
          
          if (payment && payment.reservationId) {
            // Find and delete the reservation
            const reservation = await Reservation.findById(payment.reservationId);
            
            if (reservation && !reservation.isPaid) {
              // Cancel scheduled expiry and reminder jobs before deletion
              try {
                if (reservationExpiryQueue && paymentReminderQueue) {
                  await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
                  await paymentReminderQueue.remove(`reminder-${reservation._id}`);
                  logger.info(`Cancelled expiry and reminder jobs for reservation ${reservation._id}`);
                } else {
                  logger.warn('Queue not available for job cancellation - Redis may not be running');
                }
              } catch (jobError) {
                logger.warn(`Failed to cancel jobs for reservation ${reservation._id}:`, jobError);
                // Don't fail the verification if job cancellation fails
              }

              // Delete the reservation from the collection
              await Reservation.findByIdAndDelete(reservation._id);
              
              logger.info(`Reservation ${reservation._id} deleted after successful payment. Transaction ${transactionId} recorded in Payment collection.`);
            } else if (reservation && reservation.isPaid) {
              logger.info(`Reservation ${reservation._id} already processed. Skipping deletion.`);
            }
          } else {
            logger.info(`Payment ${transactionId} completed and recorded in transaction history (Payment collection).`);
          }
        } catch (updateError) {
          logger.error('Error processing reservation after payment:', updateError);
          // Don't fail the verification response if reservation processing fails
        }
      }

      logger.info(`Payment verification completed`, {
        transactionId,
        paymentMethod,
        status: response.status,
        success: response.success,
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error(`Payment verification error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Process refund
   */
  async refundPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const validation = refundPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { transactionId, amount, reason, paymentMethod } = validation.data;

      // Check if user has permission to refund this payment
      const payment = await paymentService.getPayment(transactionId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      // Allow refund if user is admin, operator, or payment owner
      if (
        req.user!.role !== 'admin' &&
        req.user!.role !== 'operator' &&
        payment.userId.toString() !== req.userId!
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      const response = await paymentService.refundPayment(paymentMethod, transactionId, amount, reason);

      if (response.success) {
        logger.info(`Payment refund completed`, {
          transactionId,
          amount,
          refundId: response.refundId,
          userId: req.userId!,
        });

        res.json({
          success: true,
          data: response,
        });
      } else {
        logger.error(`Payment refund failed`, {
          transactionId,
          amount,
          error: response.error,
        });

        res.status(400).json({
          success: false,
          error: response.error,
        });
      }
    } catch (error) {
      logger.error(`Payment refund error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get user's payment history
   */
  async getPaymentHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.userId!;

      const result = await paymentService.getUserPayments(userId, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`Get payment history error`, {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get payment details
   */
  async getPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required',
        });
      }

      const payment = await paymentService.getPayment(transactionId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      // Check if user has permission to view this payment
      if (
        req.user!.role !== 'admin' &&
        req.user!.role !== 'operator' &&
        payment.userId.toString() !== req.userId!
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error(`Get payment error`, {
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Handle SSLCOMMERZ webhook
   */
  async sslcommerzWebhook(req: Request, res: Response) {
    try {
      const signature = (req.headers['x-signature'] || '') as string;
      
      const response = await paymentService.handleWebhook(
        PaymentProvider.SSLCOMMERZ,
        req.body,
        signature
      );

      if (response.success) {
        // If payment completed via webhook, delete the reservation
        if (response.status === PaymentStatus.COMPLETED) {
          try {
            const payment = await paymentService.getPayment(response.transactionId);
            
            if (payment && payment.reservationId) {
              const reservation = await Reservation.findById(payment.reservationId);
              
              if (reservation) {
                // Cancel scheduled jobs
                try {
                  if (reservationExpiryQueue && paymentReminderQueue) {
                    await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
                    await paymentReminderQueue.remove(`reminder-${reservation._id}`);
                    logger.info(`Cancelled expiry and reminder jobs for reservation ${reservation._id} via webhook`);
                  }
                } catch (jobError) {
                  logger.warn(`Failed to cancel jobs for reservation ${reservation._id} via webhook:`, jobError);
                }

                // Delete the reservation
                await Reservation.findByIdAndDelete(reservation._id);
                logger.info(`Reservation ${reservation._id} deleted after webhook payment completion`);
              }
            }
          } catch (deleteError) {
            logger.error('Error deleting reservation after webhook:', deleteError);
            // Don't fail the webhook if reservation deletion fails
          }
        }

        logger.info(`SSLCOMMERZ webhook processed successfully`, {
          transactionId: response.transactionId,
          status: response.status,
        });
        res.status(200).send('OK');
      } else {
        logger.error(`SSLCOMMERZ webhook processing failed`, {
          transactionId: response.transactionId,
        });
        res.status(400).send('Invalid webhook');
      }
    } catch (error) {
      logger.error(`SSLCOMMERZ webhook error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send('Internal server error');
    }
  }

  /**
   * Handle SSLCommerz success callback - redirect to frontend
   * SSLCommerz sends POST/GET with transaction data
   * This method verifies the payment and updates the database before redirecting
   */
  async sslcommerzSuccess(req: Request, res: Response) {
    try {
      // SSLCommerz sends data in either body (POST) or query (GET)
      const data = req.method === 'POST' ? req.body : req.query;
      
      const { tran_id, val_id, amount, card_type, status, bank_tran_id } = data;

      logger.info('SSLCommerz success callback received', {
        transactionId: tran_id,
        valId: val_id,
        amount,
        status,
      });

      // Verify the payment with SSLCommerz and update database
      try {
        const verificationResponse = await paymentService.verifyPayment(
          PaymentProvider.SSLCOMMERZ,
          val_id || tran_id
        );

        logger.info('Payment verification in success callback', {
          transactionId: tran_id,
          verificationSuccess: verificationResponse.success,
          paymentStatus: verificationResponse.status,
        });

        // If payment is successful, delete the reservation
        if (verificationResponse.success && verificationResponse.status === PaymentStatus.COMPLETED) {
          try {
            const payment = await paymentService.getPayment(tran_id);
            
            if (payment && payment.reservationId) {
              const reservation = await Reservation.findById(payment.reservationId);
              
              if (reservation && !reservation.isPaid) {
                // Cancel scheduled jobs
                try {
                  if (reservationExpiryQueue && paymentReminderQueue) {
                    await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
                    await paymentReminderQueue.remove(`reminder-${reservation._id}`);
                    logger.info(`Cancelled expiry and reminder jobs for reservation ${reservation._id} via success callback`);
                  }
                } catch (jobError) {
                  logger.warn(`Failed to cancel jobs for reservation ${reservation._id}:`, jobError);
                }

                // Delete the reservation
                await Reservation.findByIdAndDelete(reservation._id);
                logger.info(`Reservation ${reservation._id} deleted after payment success callback`);
              }
            }
          } catch (deleteError) {
            logger.error('Error deleting reservation after success callback:', deleteError);
            // Don't fail the redirect if reservation deletion fails
          }
        }
      } catch (verifyError) {
        logger.error('Error verifying payment in success callback:', verifyError);
        // Continue with redirect even if verification fails - frontend will handle it
      }

      // Build query parameters for frontend redirect
      const params = new URLSearchParams({
        tran_id: tran_id || '',
        val_id: val_id || '',
        amount: amount || '',
        status: status || 'VALID',
        provider: PaymentProvider.SSLCOMMERZ,
      });

      if (card_type) params.append('card_type', card_type);
      if (bank_tran_id) params.append('bank_tran_id', bank_tran_id);

      // Redirect to frontend success page with query parameters
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/payment/success?${params.toString()}`;
      
      logger.info('Redirecting to frontend', { redirectUrl });
      
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('SSLCommerz success callback error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Redirect to error page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment/failed?error=callback_error`);
    }
  }

  /**
   * Handle SSLCommerz fail callback - redirect to frontend
   */
  async sslcommerzFail(req: Request, res: Response) {
    try {
      const data = req.method === 'POST' ? req.body : req.query;
      const { tran_id, error } = data;

      logger.info('SSLCommerz fail callback received', {
        transactionId: tran_id,
        error,
      });

      const params = new URLSearchParams({
        tran_id: tran_id || '',
        error: error || 'Payment failed',
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment/failed?${params.toString()}`);
    } catch (error) {
      logger.error('SSLCommerz fail callback error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment/failed?error=callback_error`);
    }
  }

  /**
   * Handle SSLCommerz cancel callback - redirect to frontend
   */
  async sslcommerzCancel(req: Request, res: Response) {
    try {
      const data = req.method === 'POST' ? req.body : req.query;
      const { tran_id } = data;

      logger.info('SSLCommerz cancel callback received', {
        transactionId: tran_id,
      });

      const params = new URLSearchParams({
        tran_id: tran_id || '',
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment/cancelled?${params.toString()}`);
    } catch (error) {
      logger.error('SSLCommerz cancel callback error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/payment/cancelled?error=callback_error`);
    }
  }

  /**
   * Handle bKash webhook
   */
  async bkashWebhook(req: Request, res: Response) {
    try {
      const signature = (req.headers['x-signature'] || '') as string;
      
      const response = await paymentService.handleWebhook(
        PaymentProvider.BKASH,
        req.body,
        signature
      );

      if (response.success) {
        // If payment completed via webhook, delete the reservation
        if (response.status === PaymentStatus.COMPLETED) {
          try {
            const payment = await paymentService.getPayment(response.transactionId);
            
            if (payment && payment.reservationId) {
              const reservation = await Reservation.findById(payment.reservationId);
              
              if (reservation) {
                // Cancel scheduled jobs
                try {
                  if (reservationExpiryQueue && paymentReminderQueue) {
                    await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
                    await paymentReminderQueue.remove(`reminder-${reservation._id}`);
                    logger.info(`Cancelled expiry and reminder jobs for reservation ${reservation._id} via webhook`);
                  }
                } catch (jobError) {
                  logger.warn(`Failed to cancel jobs for reservation ${reservation._id} via webhook:`, jobError);
                }

                // Delete the reservation
                await Reservation.findByIdAndDelete(reservation._id);
                logger.info(`Reservation ${reservation._id} deleted after webhook payment completion`);
              }
            }
          } catch (deleteError) {
            logger.error('Error deleting reservation after webhook:', deleteError);
            // Don't fail the webhook if reservation deletion fails
          }
        }

        logger.info(`bKash webhook processed successfully`, {
          transactionId: response.transactionId,
          status: response.status,
        });
        res.status(200).send('OK');
      } else {
        logger.error(`bKash webhook processing failed`, {
          transactionId: response.transactionId,
        });
        res.status(400).send('Invalid webhook');
      }
    } catch (error) {
      logger.error(`bKash webhook error`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).send('Internal server error');
    }
  }

  /**
   * Get payment statistics for user
   */
  async getPaymentStats(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      
      const stats = await paymentService.getUserPaymentStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error(`Get payment stats error`, {
        userId: req.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Manually re-verify a pending payment (for troubleshooting)
   * This can be used to fix payments that were completed but stuck in pending status
   */
  async reVerifyPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const { transactionId } = req.params;
      
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required',
        });
      }

      // Get the payment record
      const payment = await paymentService.getPayment(transactionId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      // Check if user has permission (must be owner, operator, or admin)
      if (
        req.user!.role !== 'admin' &&
        req.user!.role !== 'operator' &&
        payment.userId.toString() !== req.userId!
      ) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      logger.info(`Manual re-verification requested for payment ${transactionId}`, {
        userId: req.userId,
        userRole: req.user!.role,
      });

      // Re-verify with the payment gateway
      const verificationResponse = await paymentService.verifyPayment(
        payment.provider as PaymentProvider,
        payment.gatewayTransactionId || transactionId
      );

      // If payment is completed, delete the reservation
      if (verificationResponse.success && verificationResponse.status === PaymentStatus.COMPLETED) {
        try {
          if (payment.reservationId) {
            const reservation = await Reservation.findById(payment.reservationId);
            
            if (reservation && !reservation.isPaid) {
              // Cancel scheduled jobs
              try {
                if (reservationExpiryQueue && paymentReminderQueue) {
                  await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
                  await paymentReminderQueue.remove(`reminder-${reservation._id}`);
                  logger.info(`Cancelled jobs for reservation ${reservation._id} during re-verification`);
                }
              } catch (jobError) {
                logger.warn(`Failed to cancel jobs:`, jobError);
              }

              // Delete the reservation
              await Reservation.findByIdAndDelete(reservation._id);
              logger.info(`Reservation ${reservation._id} deleted during re-verification`);
            }
          }
        } catch (deleteError) {
          logger.error('Error deleting reservation during re-verification:', deleteError);
        }
      }

      res.json({
        success: true,
        data: verificationResponse,
        message: 'Payment re-verified successfully',
      });
    } catch (error) {
      logger.error(`Re-verify payment error`, {
        transactionId: req.params.transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
