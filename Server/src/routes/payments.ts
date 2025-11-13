import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();
const paymentController = new PaymentController();

// SSLCommerz callback handlers (GET/POST from payment gateway) - MUST BE FIRST!
// These routes must come before /:transactionId to avoid conflicts
router.get('/sslcommerz/success', paymentController.sslcommerzSuccess.bind(paymentController));
router.post('/sslcommerz/success', paymentController.sslcommerzSuccess.bind(paymentController));
router.get('/sslcommerz/fail', paymentController.sslcommerzFail.bind(paymentController));
router.post('/sslcommerz/fail', paymentController.sslcommerzFail.bind(paymentController));
router.get('/sslcommerz/cancel', paymentController.sslcommerzCancel.bind(paymentController));
router.post('/sslcommerz/cancel', paymentController.sslcommerzCancel.bind(paymentController));

// Payment initiation
router.post('/initiate', authenticate, paymentController.initiatePayment);

// bKash specific endpoints
router.post('/bkash/execute', authenticate, paymentController.executePayment);

// Payment verification
router.post('/verify', authenticate, paymentController.verifyPayment);

// Payment refund (admin/operator only)
router.post('/refund', authenticate, authorize('admin', 'operator'), paymentController.refundPayment);

// User payment history
router.get('/history', authenticate, paymentController.getPaymentHistory);

// Get payment statistics
router.get('/stats', authenticate, paymentController.getPaymentStats);

// Re-verify a payment (for troubleshooting stuck payments)
router.post('/:transactionId/re-verify', authenticate, paymentController.reVerifyPayment);

// Get specific payment details
router.get('/:transactionId', authenticate, paymentController.getPayment);

// Webhook endpoints (no auth required - for IPN notifications)
router.post('/webhook/sslcommerz', paymentController.sslcommerzWebhook.bind(paymentController));
router.post('/webhook/bkash', paymentController.bkashWebhook.bind(paymentController));

export default router;