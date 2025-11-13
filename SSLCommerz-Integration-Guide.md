# SSLCommerz Payment Integration Guide

## Overview
This document explains how to integrate SSLCommerz payment gateway into the AmarEV platform for processing charging station reservations and session payments.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│   Client    │─────▶│   Backend    │─────▶│   SSLCommerz   │─────▶│   Bank/Card  │
│  (React)    │◀─────│  (Node.js)   │◀─────│    Gateway     │◀─────│   Provider   │
└─────────────┘      └──────────────┘      └────────────────┘      └──────────────┘
      │                     │                       │
      │                     │                       │
      └─────────────────────┴───────────────────────┘
              Payment Success/Failure Callback
```

## Setup Instructions

### 1. Environment Configuration

#### Backend (.env)
```bash
# SSLCommerz Credentials
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password

# Frontend URL for callbacks
FRONTEND_URL=http://localhost:5173

# Environment
NODE_ENV=development  # Use 'production' for live gateway
```

#### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:5000/api
```

### 2. SSLCommerz Sandbox Setup

1. **Register for Sandbox Account**
   - Visit: https://developer.sslcommerz.com/registration/
   - Fill in your details
   - Receive credentials via email

2. **Test Credentials**
   ```
   Store ID: Your sandbox store ID
   Store Password: Your sandbox password
   ```

3. **Sandbox URLs**
   - Initiation: https://sandbox.sslcommerz.com/gwprocess/v4/api.php
   - Validation: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php

4. **Test Cards**
   ```
   Card Type: Visa/MasterCard/Amex
   Card Number: Any valid test card number
   CVV: Any 3-digit number
   Expiry: Any future date
   ```

## Implementation

### Backend Implementation

#### 1. SSLCommerzService.ts (Already Implemented)
```typescript
// Location: Server/src/services/SSLCommerzService.ts

export class SSLCommerzPaymentService implements PaymentProvider {
  // Initiate payment session
  async initiatePayment(data: PaymentInitiationData): Promise<PaymentInitiationResponse>
  
  // Verify payment after callback
  async verifyPayment(transactionId: string): Promise<PaymentVerificationResponse>
  
  // Process refunds
  async refundPayment(transactionId: string, amount: number, reason?: string): Promise<PaymentRefundResponse>
  
  // Handle IPN webhooks
  async handleWebhook(payload: any, signature?: string): Promise<WebhookResponse>
}
```

#### 2. Payment Routes (Already Implemented)
```typescript
// Location: Server/src/routes/payments.ts

POST   /api/payments/initiate              // Initiate payment
POST   /api/payments/verify                // Verify payment status
POST   /api/payments/refund                // Process refund (admin/operator)
GET    /api/payments/history               // Get payment history
GET    /api/payments/stats                 // Get payment statistics
GET    /api/payments/:transactionId        // Get specific payment
POST   /api/payments/webhook/sslcommerz    // SSLCommerz IPN callback
```

### Frontend Implementation

#### 1. Payment Integration Component

```tsx
// Location: Client/src/components/Payment/PaymentIntegration.tsx
import { PaymentIntegration } from '../components/Payment/PaymentIntegration';

<PaymentIntegration
  reservationId="reservation_id"
  amount={500}
  description="EV Charging Reservation"
  onPaymentSuccess={(transactionId) => {
    console.log('Payment successful:', transactionId);
  }}
  onPaymentCancel={() => {
    console.log('Payment cancelled');
  }}
/>
```

#### 2. Add Payment to Booking Flow

```tsx
// In your BookingModal or Checkout component

const [showPayment, setShowPayment] = useState(false);
const [reservationId, setReservationId] = useState<string>('');

const handleCreateReservation = async () => {
  // Create reservation first
  const reservation = await createReservation(bookingData);
  setReservationId(reservation._id);
  setShowPayment(true);
};

{showPayment && (
  <PaymentIntegration
    reservationId={reservationId}
    amount={calculateAmount()}
    description="Charging Station Reservation"
    onPaymentSuccess={handlePaymentSuccess}
    onPaymentCancel={() => setShowPayment(false)}
  />
)}
```

#### 3. Payment Callback Pages (Already Implemented)

- **Success**: `/payment/success?tran_id=xxx&val_id=yyy&status=VALID`
- **Failed**: `/payment/failed?tran_id=xxx&error=reason`
- **Cancelled**: `/payment/cancelled?tran_id=xxx`

## Payment Flow

### 1. Initiate Payment

```typescript
const response = await paymentService.initiatePayment({
  reservationId: 'res_123',
  amount: 500,
  currency: 'BDT',
  paymentMethod: PaymentProvider.SSLCOMMERZ,
  description: 'EV Charging Reservation Payment',
  successUrl: `${window.location.origin}/payment/success`,
  failUrl: `${window.location.origin}/payment/failed`,
  cancelUrl: `${window.location.origin}/payment/cancelled`,
});

if (response.success) {
  // Redirect to SSLCommerz payment page
  window.location.href = response.data.gatewayPageURL;
}
```

### 2. User Completes Payment
User is redirected to SSLCommerz where they:
1. Select payment method (Card/Mobile Banking/Internet Banking)
2. Enter payment details
3. Confirm payment

### 3. Callback Handling

**Success Callback**:
```
GET /payment/success?
  tran_id=PAYMENT_TRANSACTION_ID
  &val_id=VALIDATION_ID
  &amount=500.00
  &status=VALID
  &card_type=VISA-Brac Bank
  &store_amount=490.00
  &bank_tran_id=201234567890
  &tran_date=2025-11-13 10:30:00
```

**Frontend verifies the payment**:
```typescript
const response = await paymentService.verifyPayment({
  transactionId: valId,
  paymentMethod: PaymentProvider.SSLCOMMERZ,
});

if (response.data.success) {
  // Payment verified successfully
  // Update UI, show receipt
}
```

### 4. IPN Webhook (Background Verification)

SSLCommerz also sends a server-to-server notification:
```
POST /api/payments/webhook/sslcommerz
{
  "tran_id": "PAYMENT_TRANSACTION_ID",
  "val_id": "VALIDATION_ID",
  "amount": "500.00",
  "status": "VALID",
  "bank_tran_id": "201234567890",
  "value_a": "user_id",
  "value_b": "reservation_id",
  "value_c": "session_id",
  "value_d": "station_id"
}
```

Backend automatically:
1. Verifies the signature
2. Updates payment status in database
3. Updates reservation status
4. Sends confirmation email

## Testing

### 1. Start Backend Server
```bash
cd Server
npm run dev
```

### 2. Start Frontend Server
```bash
cd Client
npm run dev
```

### 3. Test Payment Flow

1. **Create a Reservation**
   - Go to a charging station
   - Select connector and time slot
   - Click "Book Now"

2. **Initiate Payment**
   - Review booking details
   - Click "Proceed to Payment"
   - System redirects to SSLCommerz sandbox

3. **Complete Payment (Sandbox)**
   - Use any test card details
   - Click "Confirm"
   - System redirects back to your app

4. **Verify Success**
   - Check Payment Success page
   - View payment receipt
   - Check reservation status (should be "confirmed")

### 4. Test Scenarios

#### Successful Payment
```
1. Use valid test card
2. Complete payment
3. Verify callback at /payment/success
4. Check payment status in database
5. Confirm reservation is updated
```

#### Failed Payment
```
1. Use invalid card or decline
2. Payment fails
3. Redirected to /payment/failed
4. Reservation remains unpaid
5. User can retry payment
```

#### Cancelled Payment
```
1. Start payment process
2. Click "Cancel" on SSLCommerz page
3. Redirected to /payment/cancelled
4. Reservation remains pending
```

## Database Schema

### Payment Model
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  provider: 'SSLCOMMERZ',
  amountBDT: Number,
  currency: 'BDT',
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELED',
  transactionId: String,            // Our internal ID
  gatewayTransactionId: String,     // SSLCommerz bank_tran_id
  metadata: {
    reservationId: String,
    sessionId: String,
    stationId: String,
    valId: String,                  // SSLCommerz validation ID
    cardType: String,
    cardBrand: String,
    cardIssuer: String
  },
  paidAt: Date,
  refundedAmount: Number,
  refundId: String,
  failureReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

### 1. Signature Verification
```typescript
// Backend verifies SSLCommerz signature
const signString = `${storePassword}${valId}${amount}${currency}${storeAmount}${currency}`;
const hash = crypto.createHash('md5').update(signString).digest('hex');
return hash === verifySign;
```

### 2. HTTPS Only
- Always use HTTPS in production
- SSLCommerz requires HTTPS for webhooks

### 3. Store Credentials Securely
- Never commit credentials to git
- Use environment variables
- Rotate credentials regularly

### 4. Validate Amounts
```typescript
// Always verify amount matches reservation
if (payment.amountBDT !== reservation.estimatedCostBDT) {
  throw new Error('Amount mismatch');
}
```

## Production Deployment

### 1. Update Environment Variables
```bash
SSLCOMMERZ_STORE_ID=your_live_store_id
SSLCOMMERZ_STORE_PASSWORD=your_live_password
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
```

### 2. Update URLs
```typescript
// SSLCommerzService will automatically use production URLs
baseUrl: 'https://securepay.sslcommerz.com'  // Production
```

### 3. Configure Webhooks
In SSLCommerz dashboard, set:
- IPN URL: `https://your-domain.com/api/payments/webhook/sslcommerz`
- Success URL: `https://your-domain.com/payment/success`
- Fail URL: `https://your-domain.com/payment/failed`
- Cancel URL: `https://your-domain.com/payment/cancelled`

## Troubleshooting

### Issue: Payment initiation fails
**Solution**: Check SSLCommerz credentials, ensure backend is running, check network connectivity

### Issue: Callback not received
**Solution**: Verify callback URLs are accessible, check firewall settings, enable IPN in SSLCommerz dashboard

### Issue: Signature verification fails
**Solution**: Ensure store password is correct, check data encoding, verify hash algorithm (MD5)

### Issue: Payment shows pending indefinitely
**Solution**: Manually verify payment with SSLCommerz validation API, check IPN webhook logs

## Support

- **SSLCommerz Support**: support@sslcommerz.com
- **Documentation**: https://developer.sslcommerz.com/
- **API Reference**: https://developer.sslcommerz.com/docs/api

## Code Examples

### Complete Booking with Payment

```typescript
// 1. Create reservation
const reservation = await reservationService.createReservation({
  vehicleId,
  stationId,
  connectorId,
  startTime,
  endTime
});

// 2. Initiate payment
const payment = await paymentService.initiatePayment({
  reservationId: reservation._id,
  amount: reservation.estimatedCostBDT,
  currency: 'BDT',
  paymentMethod: PaymentProvider.SSLCOMMERZ,
  description: `Charging at ${station.name}`,
  successUrl: `${window.location.origin}/payment/success`,
  failUrl: `${window.location.origin}/payment/failed`,
  cancelUrl: `${window.location.origin}/payment/cancelled`,
});

// 3. Redirect to payment gateway
if (payment.success) {
  window.location.href = payment.data.gatewayPageURL;
}
```

### Handle Payment Callback

```typescript
// On payment success page
const verifyPayment = async () => {
  const valId = searchParams.get('val_id');
  const tranId = searchParams.get('tran_id');
  
  const response = await paymentService.verifyPayment({
    transactionId: valId,
    paymentMethod: PaymentProvider.SSLCOMMERZ
  });
  
  if (response.data.success) {
    // Fetch updated reservation
    const reservation = await reservationService.getReservationById(tranId);
    // Show success message and receipt
  }
};
```

## Conclusion

The SSLCommerz integration is fully implemented and ready to use. Follow this guide to:
1. Configure environment variables
2. Test in sandbox mode
3. Deploy to production with live credentials

For any issues, refer to the troubleshooting section or contact support.
