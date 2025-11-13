# SSLCommerz Easy Checkout Integration Guide

## Overview

The AmarEV platform uses **SSLCommerz Easy Checkout** (Hosted Payment Page) method where users are redirected to SSLCommerz's secure payment gateway to complete their payment. This is the recommended method as it:

- ✅ Reduces PCI compliance requirements
- ✅ Provides a fully hosted and secure payment page
- ✅ Supports all payment methods (cards, mobile banking, internet banking)
- ✅ No need to handle sensitive card data
- ✅ Built-in fraud prevention

---

## How It Works

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│   User       │       │   AmarEV     │       │   SSLCommerz     │
│  (Browser)   │       │   Backend    │       │   Gateway        │
└──────┬───────┘       └──────┬───────┘       └────────┬─────────┘
       │                      │                         │
       │  1. Click "Pay Now"  │                         │
       ├─────────────────────>│                         │
       │                      │                         │
       │                      │  2. Initiate Payment    │
       │                      ├────────────────────────>│
       │                      │     (POST /gwprocess)   │
       │                      │                         │
       │                      │  3. Payment URL         │
       │                      │<────────────────────────┤
       │  4. Redirect         │     (GatewayPageURL)    │
       │<─────────────────────┤                         │
       │                      │                         │
       │  5. SSLCommerz Payment Page                    │
       ├───────────────────────────────────────────────>│
       │        (User enters payment details)           │
       │                                                 │
       │  6. Complete Payment                            │
       │<────────────────────────────────────────────────┤
       │    (Redirect to success/fail/cancel URL)        │
       │                      │                         │
       │  7. Verify Payment   │                         │
       ├─────────────────────>│                         │
       │                      │  8. Validate Transaction│
       │                      ├────────────────────────>│
       │                      │     (POST /validator)   │
       │                      │                         │
       │                      │  9. Confirmation        │
       │                      │<────────────────────────┤
       │  10. Payment Receipt │                         │
       │<─────────────────────┤                         │
       │                      │                         │
```

---

## Frontend Implementation

### 1. Payment Button in MyReservations.tsx

```tsx
{/* Pay Now Button - Shows for all PENDING reservations */}
{(reservation.status === 'PENDING' || reservation.status === 'pending') && !reservation.isPaid && (
  <Button
    onClick={() => setPayingReservation(reservation)}
    className="bg-green-600 hover:bg-green-700 font-semibold animate-pulse"
  >
    <CreditCard className="w-4 h-4" />
    Pay Now ৳{(reservation.totalCostBDT || 0).toFixed(0)}
  </Button>
)}
```

### 2. Payment Modal

```tsx
{/* Payment Modal */}
{payingReservation && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
      <PaymentIntegration
        reservationId={payingReservation._id}
        amount={payingReservation.totalCostBDT || 0}
        description={`Charging at ${payingReservation.stationId?.name}`}
        onPaymentSuccess={() => {
          setPayingReservation(null);
          fetchReservations();
        }}
        onPaymentCancel={() => setPayingReservation(null)}
      />
    </div>
  </div>
)}
```

### 3. PaymentIntegration Component

The `PaymentIntegration.tsx` component handles:

1. **Payment Summary Display**
   - Shows amount, description, reservation ID
   - Formatted in BDT currency

2. **Payment Method Selection**
   - Defaults to SSLCommerz
   - Can support multiple gateways

3. **Payment Initiation**
   ```tsx
   const handlePayment = async () => {
     const response = await paymentService.initiatePayment({
       reservationId,
       amount,
       currency: 'BDT',
       paymentMethod: PaymentProvider.SSLCOMMERZ,
       description,
       successUrl: `${frontendUrl}/payment/success`,
       failUrl: `${frontendUrl}/payment/failed`,
       cancelUrl: `${frontendUrl}/payment/cancelled`,
     });

     // Redirect to SSLCommerz
     window.location.href = response.data.gatewayPageURL;
   };
   ```

4. **Local Storage Tracking**
   ```tsx
   // Before redirect, store transaction details
   localStorage.setItem('pendingPaymentTransaction', transactionId);
   localStorage.setItem('pendingPaymentReservation', reservationId);
   ```

---

## Backend Implementation

### 1. SSLCommerz Service (SSLCommerzService.ts)

```typescript
async initiatePayment(paymentData: PaymentInitiationData) {
  const requestData = {
    store_id: this.config.storeId,
    store_passwd: this.config.storePassword,
    total_amount: paymentData.amount,
    currency: paymentData.currency,
    tran_id: paymentData.orderId,
    success_url: paymentData.successUrl,
    fail_url: paymentData.failUrl,
    cancel_url: paymentData.cancelUrl,
    desc: paymentData.description,
    cus_name: paymentData.customerInfo.name,
    cus_email: paymentData.customerInfo.email,
    cus_phone: paymentData.customerInfo.phone,
    product_name: 'EV Charging Service',
    product_category: 'Service',
    // Store metadata in value fields
    value_a: paymentData.metadata?.userId,
    value_b: paymentData.metadata?.reservationId,
  };

  const response = await axios.post(
    `${this.config.baseUrl}/gwprocess/v4/api.php`,
    requestData
  );

  if (response.data.status === 'SUCCESS') {
    return {
      success: true,
      gatewayPageURL: response.data.GatewayPageURL, // ← Redirect URL
      transactionId: paymentData.orderId,
    };
  }
}
```

### 2. Payment Controller (PaymentController.ts)

```typescript
async initiatePayment(req: Request, res: Response) {
  const { reservationId, amount, description } = req.body;
  const userId = req.user!.userId;

  const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create payment record
  const payment = await paymentService.initiatePayment(
    PaymentProvider.SSLCOMMERZ,
    transactionId,
    {
      amount,
      currency: 'BDT',
      orderId: transactionId,
      description,
      successUrl: `${process.env.FRONTEND_URL}/payment/success`,
      failUrl: `${process.env.FRONTEND_URL}/payment/failed`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment/cancelled`,
      customerInfo: {
        name: req.user!.email,
        email: req.user!.email,
        phone: '',
      },
      metadata: {
        userId,
        reservationId,
      },
    }
  );

  res.json({
    success: true,
    data: {
      transactionId,
      gatewayPageURL: payment.gatewayPageURL, // Frontend redirects here
      paymentUrl: payment.paymentUrl,
    },
  });
}
```

### 3. Payment Verification (After Redirect)

```typescript
async verifyPayment(req: Request, res: Response) {
  const { transactionId } = req.body;

  // Validate with SSLCommerz
  const response = await paymentService.verifyPayment(
    PaymentProvider.SSLCOMMERZ,
    transactionId
  );

  if (response.success && response.status === PaymentStatus.COMPLETED) {
    // Update reservation
    const payment = await paymentService.getPayment(transactionId);
    if (payment && payment.reservationId) {
      const reservation = await Reservation.findById(payment.reservationId);
      
      reservation.isPaid = true;
      reservation.paymentStatus = 'completed';
      reservation.status = 'confirmed';
      await reservation.save();

      // Cancel expiry jobs
      await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
      await paymentReminderQueue.remove(`reminder-${reservation._id}`);
    }
  }

  res.json({ success: true, data: response });
}
```

---

## Environment Configuration

### Required Environment Variables

```bash
# SSLCommerz Configuration
SSLCOMMERZ_STORE_ID=your-store-id
SSLCOMMERZ_STORE_PASSWORD=your-store-password
SSLCOMMERZ_SANDBOX=true  # Set to false in production
FRONTEND_URL=http://localhost:5173

# For Production
NODE_ENV=production
SSLCOMMERZ_STORE_ID=your-live-store-id
SSLCOMMERZ_STORE_PASSWORD=your-live-password
FRONTEND_URL=https://yourdomain.com
```

### Getting SSLCommerz Credentials

#### Sandbox/Testing:
1. Go to https://developer.sslcommerz.com/registration/
2. Sign up for a sandbox account
3. Use default sandbox credentials:
   - Store ID: `testbox`
   - Password: `qwerty`
4. Test cards provided by SSLCommerz:
   - Success: `4111111111111111` (any CVV, any future date)
   - Failed: `4242424242424242`

#### Production:
1. Visit https://sslcommerz.com/
2. Register as a merchant
3. Complete KYC verification
4. Get live store credentials
5. Update environment variables

---

## Callback URLs

SSLCommerz redirects users to these URLs based on payment outcome:

### Success URL
```
http://localhost:5173/payment/success?tran_id=TXN_123&val_id=VALIDATION_123&amount=500.00&status=VALID
```

**PaymentSuccess.tsx** handles this:
```tsx
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const transactionId = searchParams.get('tran_id');
  const valId = searchParams.get('val_id');
  
  // Verify payment
  const verifyPayment = async () => {
    const response = await paymentService.verifyPayment({
      transactionId: valId,
      paymentMethod: 'sslcommerz',
    });

    if (response.success) {
      // Show success message and receipt
      setPaymentData(response.data);
    }
  };

  verifyPayment();
}, []);
```

### Failed URL
```
http://localhost:5173/payment/failed?error=Card%20Declined&tran_id=TXN_123
```

**PaymentFailed.tsx** displays error message and retry option.

### Cancelled URL
```
http://localhost:5173/payment/cancelled?tran_id=TXN_123
```

**PaymentCancelled.tsx** allows user to retry or go back.

---

## Testing the Integration

### 1. Start Services

```bash
# Terminal 1 - Backend
cd Server
npm run dev

# Terminal 2 - Frontend
cd Client
npm run dev
```

### 2. Create a Reservation

1. Navigate to Find Stations
2. Select a station and connector
3. Choose time slot
4. Create reservation
   - Status: `PENDING`
   - `totalCostBDT`: Calculated automatically
   - `paymentDeadline`: +30 minutes
   - `isPaid`: `false`

### 3. Test Payment Flow

#### Step 1: Click "Pay Now"
- Green pulsing button appears on pending reservation
- Shows amount on button: "Pay Now ৳500"

#### Step 2: Payment Modal Opens
```
┌────────────────────────────────────────────┐
│  Complete Payment                      [X] │
│                                            │
│  💳 Payment Summary                        │
│  Description: Charging at Dhaka Hub        │
│  Reservation ID: b26e4b32                  │
│  Total Amount: ৳500.00                     │
│                                            │
│  ❌ Payment Error (if amount = 0)          │
│                                            │
│  Select Payment Method                     │
│  ○ bKash        ● SSLCommerz ✓             │
│                                            │
│  🔒 Secure Payment                         │
│  Encrypted and secure via SSLCommerz      │
│                                            │
│  [Cancel]    [Proceed to Payment]         │
└────────────────────────────────────────────┘
```

#### Step 3: Redirect to SSLCommerz
- Backend creates payment record
- Returns `gatewayPageURL`
- Frontend redirects: `window.location.href = gatewayPageURL`

#### Step 4: SSLCommerz Payment Page
```
┌────────────────────────────────────────────┐
│        SSLCommerz Payment Gateway          │
│                                            │
│  Amount: ৳500.00                           │
│  Merchant: AmarEV                          │
│                                            │
│  Choose Payment Method:                    │
│  [Credit/Debit Card] [bKash] [Rocket]     │
│  [Bank Transfer] [Internet Banking]       │
│                                            │
│  Card Number: ___-____-____-____          │
│  Expiry: __/__  CVV: ___                  │
│                                            │
│  [Pay Now]                                 │
└────────────────────────────────────────────┘
```

**Test Cards (Sandbox):**
- Success: `4111 1111 1111 1111`
- Failed: `4242 4242 4242 4242`
- CVV: Any 3 digits
- Expiry: Any future date

#### Step 5: Payment Callback
- **Success**: Redirect to `/payment/success?tran_id=...&val_id=...&status=VALID`
- **Failed**: Redirect to `/payment/failed?error=...`
- **Cancelled**: Redirect to `/payment/cancelled`

#### Step 6: Verification
```typescript
// Backend validates with SSLCommerz
POST https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
{
  val_id: "VALIDATION_ID",
  store_id: "testbox",
  store_passwd: "qwerty"
}

// Response
{
  status: "VALID",
  tran_id: "TXN_123",
  amount: "500.00",
  card_type: "VISA-Brac Bank",
  // ... more fields
}
```

#### Step 7: Database Update
```javascript
// Reservation updated
{
  _id: ObjectId("..."),
  status: "confirmed",        // PENDING → confirmed
  isPaid: true,               // false → true
  paymentStatus: "completed", // pending → completed
  paymentId: ObjectId("...")  // Linked to payment
}

// Payment record
{
  _id: ObjectId("..."),
  status: "completed",
  transactionId: "TXN_123",
  gatewayTransactionId: "BANK_TXN_123",
  amountBDT: 500,
  reservationId: ObjectId("...")
}
```

#### Step 8: Jobs Cancelled
```javascript
// BullMQ jobs removed
await reservationExpiryQueue.remove(`expiry-${reservationId}`);
await paymentReminderQueue.remove(`reminder-${reservationId}`);
```

---

## Common Issues & Solutions

### Issue 1: Amount Showing ৳0.00

**Cause**: `totalCostBDT` not calculated in backend

**Solution**:
```typescript
// ReservationController.createReservation
const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
const pricePerKWh = connector.pricePerKWhBDT || 15;
const estimatedKWh = Math.min(vehicle.usableKWh || 50, durationHours * connector.maxKw);
const totalCostBDT = estimatedKWh * pricePerKWh; // ← Must be set

const reservation = new Reservation({
  // ...
  totalCostBDT, // ← Include this
});
```

### Issue 2: "Payment Error" Alert

**Cause**: PaymentIntegration receives amount = 0

**Fix Frontend**:
```tsx
<PaymentIntegration
  amount={payingReservation.totalCostBDT || payingReservation.estimatedCostBDT || 0}
  // Use totalCostBDT (backend) or estimatedCostBDT (frontend alias)
/>
```

### Issue 3: Redirect Not Working

**Cause**: Missing `gatewayPageURL` in response

**Check**:
```typescript
// SSLCommerzService.ts
if (response.data.status === 'SUCCESS') {
  return {
    gatewayPageURL: response.data.GatewayPageURL, // ← Must exist
    paymentUrl: response.data.redirectGatewayURL,
  };
}
```

### Issue 4: Credentials Error

**Cause**: Environment variables not set

**Fix**:
```bash
# Check .env file
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
```

### Issue 5: CORS Error on Redirect

**Cause**: Frontend URL not whitelisted

**Solution**: SSLCommerz Easy Checkout handles CORS automatically. No action needed.

---

## Security Considerations

### 1. Transaction Validation
Always verify payments server-side:
```typescript
// NEVER trust client-side data alone
const response = await paymentService.verifyPayment(transactionId);
// Only update order status after verification
```

### 2. Signature Verification
```typescript
// SSLCommerz returns verify_sign
const calculatedHash = crypto
  .createHash('md5')
  .update(`${storePassword}${valId}`)
  .digest('hex');

if (calculatedHash !== verify_sign) {
  throw new Error('Invalid signature');
}
```

### 3. Amount Validation
```typescript
// Verify amount matches
if (parseFloat(response.amount) !== expectedAmount) {
  throw new Error('Amount mismatch');
}
```

### 4. Idempotency
```typescript
// Prevent duplicate processing
const payment = await Payment.findOne({ transactionId });
if (payment.status === 'completed') {
  return; // Already processed
}
```

---

## Production Checklist

Before going live:

- [ ] Update `SSLCOMMERZ_STORE_ID` with live credentials
- [ ] Update `SSLCOMMERZ_STORE_PASSWORD` with live password
- [ ] Set `NODE_ENV=production`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Enable HTTPS for all URLs
- [ ] Test live payment with real card
- [ ] Set up webhook for IPN notifications
- [ ] Configure payment reconciliation
- [ ] Set up refund process
- [ ] Add proper error logging
- [ ] Set up monitoring/alerts for failed payments

---

## Webhook/IPN Setup (Optional but Recommended)

SSLCommerz can send instant payment notifications:

```typescript
// Server/src/controllers/PaymentController.ts
async sslcommerzWebhook(req: Request, res: Response) {
  const { val_id, tran_id, status } = req.body;

  // Verify signature
  const verify_sign = req.body.verify_sign;
  const calculated = crypto
    .createHash('md5')
    .update(`${storePassword}${val_id}`)
    .digest('hex');

  if (verify_sign !== calculated) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Update payment status
  await Payment.updateOne(
    { transactionId: tran_id },
    { status: status === 'VALID' ? 'completed' : 'failed' }
  );

  res.json({ success: true });
}
```

Configure webhook URL in SSLCommerz dashboard:
```
https://yourdomain.com/api/payments/webhook/sslcommerz
```

---

## Support & Resources

- **SSLCommerz Documentation**: https://developer.sslcommerz.com/
- **API Reference**: https://developer.sslcommerz.com/doc/v4/
- **Sandbox Testing**: https://developer.sslcommerz.com/registration/
- **Support**: support@sslcommerz.com
- **Phone**: +880 9610001010

---

**Last Updated**: November 13, 2025  
**Version**: 1.0.0
