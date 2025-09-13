import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { PaymentController } from '../controllers/PaymentController';

const router = Router();
const paymentController = new PaymentController();

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

// Get specific payment details
router.get('/:transactionId', authenticate, paymentController.getPayment);

// Webhook endpoints (no auth required)
router.post('/webhook/sslcommerz', paymentController.sslcommerzWebhook);
router.post('/webhook/bkash', paymentController.bkashWebhook);

export default router;