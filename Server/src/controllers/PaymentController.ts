import { Request, Response } from 'express';
import { PaymentProvider, PaymentStatus } from '@chargebd/shared';
import { paymentService } from '../services/PaymentService';
import { bKashService } from '../services/bKashService';
import { Reservation } from '../models/Reservation';
import { Session } from '../models/Session';
import { logger } from '../utils/logger';
import { z } from 'zod';

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
  async initiatePayment(req: Request, res: Response) {
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

      const userId = req.user!.id;
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
          name: req.user!.name,
          email: req.user!.email,
          phone: req.user!.phone || '',
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
        userId: req.user?.id,
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
  async executePayment(req: Request, res: Response) {
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

      if (paymentMethod !== paymentMethod.BKASH) {
        return res.status(400).json({
          success: false,
          error: 'Execute payment is only supported for bKash',
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
   */
  async verifyPayment(req: Request, res: Response) {
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
  async refundPayment(req: Request, res: Response) {
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
        payment.userId.toString() !== req.user!.id
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
          userId: req.user!.id,
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
  async getPaymentHistory(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = req.user!.id;

      const result = await paymentService.getUserPayments(userId, page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`Get payment history error`, {
        userId: req.user?.id,
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
  async getPayment(req: Request, res: Response) {
    try {
      const { transactionId } = req.params;

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
        payment.userId.toString() !== req.user!.id
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
      const signature = req.headers['x-signature'] as string;
      
      const response = await paymentService.handleWebhook(
        PaymentMethod.SSLCOMMERZ,
        req.body,
        signature
      );

      if (response.success) {
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
   * Handle bKash webhook
   */
  async bkashWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-signature'] as string;
      
      const response = await paymentService.handleWebhook(
        PaymentMethod.BKASH,
        req.body,
        signature
      );

      if (response.success) {
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
}