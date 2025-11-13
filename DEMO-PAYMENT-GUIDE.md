# Demo Payment Implementation Guide

## Overview

This guide explains how the payment system is configured to work in **demo/sandbox mode** for development and testing without requiring actual SSLCommerz credentials.

## What Was Fixed

### 1. **SSLCommerz Demo Credentials**

The payment gateway now automatically uses SSLCommerz's test credentials when running in development mode:

**Default Test Credentials:**
- Store ID: `testbox`
- Store Password: `qwerty`
- Base URL: `https://sandbox.sslcommerz.com`

### 2. **User Data Handling**

Fixed authentication issues where the payment controller was trying to access user fields that weren't available:

**Before (Broken):**
```typescript
// ❌ These fields don't exist in req.user
name: req.user!.name
phone: req.user!.phone
id: req.user!.id
```

**After (Fixed):**
```typescript
// ✅ Fetches full user data from database
const user = await User.findById(userId);
name: user.name || user.email.split('@')[0]
phone: user.phone || 'N/A'
userId: req.user!.userId
```

## Configuration

### Using Your Own SSLCommerz Sandbox Account

If you have your own SSLCommerz sandbox credentials, add them to `.env`:

```env
# SSLCommerz Configuration
SSLCOMMERZ_STORE_ID=your_sandbox_store_id
SSLCOMMERZ_STORE_PASSWORD=your_sandbox_password
```

### Using Demo Mode (No Credentials Needed)

Simply don't set the environment variables, and the system will use the default test credentials:

```env
# Leave these commented out or empty for demo mode
# SSLCOMMERZ_STORE_ID=
# SSLCOMMERZ_STORE_PASSWORD=
```

**You'll see this log message:**
```
warn: SSLCOMMERZ running in DEMO mode with test credentials (testbox)
warn: For actual testing, set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in .env
```

## How to Test Payment Flow

### Step 1: Create a Reservation

1. Go to http://localhost:3001 (or your frontend URL)
2. Login with your account
3. Browse stations and create a reservation
4. You'll see a reservation with:
   - Status: PENDING
   - Payment deadline: 30 minutes from creation
   - Amount: e.g., ৳283.80
   - **Pay Now** button (pulsing green)

### Step 2: Initiate Payment

1. Click the **"Pay Now"** button
2. Payment modal opens showing:
   - Payment Summary
   - Reservation ID
   - Total Amount
   - Payment method selection (bKash / Card Payment)
3. Select **"Card Payment"** (recommended for testing)
4. Click **"Proceed to Payment"**

### Step 3: SSLCommerz Test Gateway

You'll be redirected to SSLCommerz sandbox payment page with multiple options:

#### Option A: Test Card Payment (Recommended)
- **Card Number:** `4111 1111 1111 1111` (Test Visa)
- **Expiry:** Any future date (e.g., 12/25)
- **CVV:** Any 3 digits (e.g., 123)
- **Name:** Any name
- Click **Submit**

#### Option B: Direct Success/Fail Buttons
SSLCommerz sandbox provides quick test buttons:
- **Success Button:** Simulates successful payment
- **Fail Button:** Simulates failed payment
- **Cancel Button:** Simulates user cancellation

### Step 4: Payment Completion

After successful payment:
- Redirected to: `http://localhost:3001/payment/success`
- Backend verifies payment with SSLCommerz
- Reservation status updates: PENDING → CONFIRMED
- `isPaid` flag set to `true`
- Payment jobs cancelled (expiry & reminder)

### Step 5: View Result

Go back to My Reservations page:
- Status shows: **CONFIRMED**
- **Pay Now** button disappears
- Reservation details updated

## Testing Scenarios

### Scenario 1: Successful Payment
```
1. Create reservation → Status: PENDING
2. Click Pay Now → Opens modal
3. Proceed to Payment → Redirects to SSLCommerz
4. Use test card or click Success → Payment succeeds
5. Redirected to success page → Reservation: CONFIRMED
```

### Scenario 2: Failed Payment
```
1. Create reservation → Status: PENDING
2. Click Pay Now → Opens modal
3. Proceed to Payment → Redirects to SSLCommerz
4. Click Fail button → Payment fails
5. Redirected to failed page → Reservation: Still PENDING
6. Can try again
```

### Scenario 3: Cancelled Payment
```
1. Create reservation → Status: PENDING
2. Click Pay Now → Opens modal
3. Proceed to Payment → Redirects to SSLCommerz
4. Click Cancel button → Payment cancelled
5. Redirected to cancelled page → Reservation: Still PENDING
6. Can try again
```

### Scenario 4: Expired Reservation (Manual)
```
⚠️ Without Redis, expiry doesn't happen automatically

Option A - Wait 30 minutes naturally:
1. Create reservation → Status: PENDING
2. Don't pay
3. Wait 30+ minutes
4. Reservation stays PENDING (no auto-expiry without Redis)

Option B - Manual database update:
db.reservations.updateOne(
  { _id: ObjectId("your-reservation-id") },
  { $set: { status: "EXPIRED" } }
)
```

## SSLCommerz Sandbox Test Cards

### Visa Cards
- **Success:** `4111 1111 1111 1111`
- **Fail:** `4000 0000 0000 0002`

### Mastercard
- **Success:** `5555 5555 5555 4444`
- **Fail:** `5105 1051 0510 5100`

### American Express
- **Success:** `3782 822463 10005`

**All test cards:**
- Expiry: Any future date
- CVV: Any 3-4 digits
- Name: Any name

## Payment Flow Architecture

```
┌─────────────┐
│   Client    │
│ (React App) │
└──────┬──────┘
       │ 1. Click "Pay Now"
       ▼
┌─────────────────────┐
│ PaymentIntegration  │
│    Component        │
└──────┬──────────────┘
       │ 2. POST /api/payments/initiate
       ▼
┌─────────────────────┐
│ PaymentController   │
│  .initiatePayment() │
└──────┬──────────────┘
       │ 3. Create transaction
       ▼
┌─────────────────────┐
│ SSLCommerzService   │
│  .initiatePayment() │
└──────┬──────────────┘
       │ 4. POST to SSLCommerz API
       ▼
┌─────────────────────┐
│  SSLCommerz Gateway │
│   (Sandbox Mode)    │
└──────┬──────────────┘
       │ 5. User completes payment
       ▼
┌─────────────────────┐
│  Success/Fail/      │
│  Cancel Callback    │
└──────┬──────────────┘
       │ 6. Redirect back to app
       ▼
┌─────────────────────┐
│ PaymentController   │
│  .verifyPayment()   │
└──────┬──────────────┘
       │ 7. Verify with SSLCommerz
       │ 8. Update reservation
       ▼
┌─────────────────────┐
│    Reservation      │
│  Status: CONFIRMED  │
│   isPaid: true      │
└─────────────────────┘
```

## API Endpoints

### 1. Initiate Payment
```http
POST /api/payments/initiate
Authorization: Bearer {token}
Content-Type: application/json

{
  "reservationId": "64d60649...",
  "amount": 283.80,
  "currency": "BDT",
  "paymentMethod": "SSLCOMMERZ",
  "description": "Charging at Dhaka City Center Charging Hub",
  "successUrl": "http://localhost:3001/payment/success",
  "failUrl": "http://localhost:3001/payment/failed",
  "cancelUrl": "http://localhost:3001/payment/cancelled"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_1699999999999_abc123",
    "gatewayPageURL": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=...",
    "sessionKey": "SESSIONKEY123..."
  }
}
```

### 2. Verify Payment
```http
POST /api/payments/verify
Authorization: Bearer {token}
Content-Type: application/json

{
  "transactionId": "TXN_1699999999999_abc123",
  "paymentMethod": "SSLCOMMERZ"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": "COMPLETED",
    "transactionId": "TXN_1699999999999_abc123",
    "amount": 283.80,
    "currency": "BDT",
    "paidAt": "2025-11-13T19:30:00.000Z",
    "gatewayTransactionId": "BANK_TXN_123456"
  }
}
```

## Frontend Implementation

### PaymentIntegration Component Usage

```tsx
import { PaymentIntegration } from '@/components/Payment/PaymentIntegration';

function MyReservations() {
  const [payingReservation, setPayingReservation] = useState(null);

  return (
    <>
      {/* Reservation list */}
      {reservations.map(reservation => (
        <div key={reservation._id}>
          {reservation.status === 'PENDING' && !reservation.isPaid && (
            <Button onClick={() => setPayingReservation(reservation)}>
              Pay Now ৳{reservation.totalCostBDT}
            </Button>
          )}
        </div>
      ))}

      {/* Payment Modal */}
      {payingReservation && (
        <Modal onClose={() => setPayingReservation(null)}>
          <PaymentIntegration
            reservationId={payingReservation._id}
            amount={payingReservation.totalCostBDT}
            description={`Charging at ${payingReservation.stationId?.name}`}
            onPaymentSuccess={(transactionId) => {
              console.log('Payment successful:', transactionId);
              refetchReservations();
              setPayingReservation(null);
            }}
            onPaymentCancel={() => setPayingReservation(null)}
          />
        </Modal>
      )}
    </>
  );
}
```

## Troubleshooting

### Error: 401 Unauthorized

**Cause:** Empty or invalid SSLCommerz credentials

**Solution:**
1. Check `.env` file has valid credentials, OR
2. Remove credentials to use demo mode
3. Restart server after changing `.env`

**Check server logs:**
```
✅ Good: "SSLCOMMERZ running in DEMO mode with test credentials"
❌ Bad: "SSLCOMMERZ service running with placeholder credentials"
```

### Error: Payment button not showing

**Checklist:**
- [ ] Reservation status is PENDING
- [ ] `isPaid` is false
- [ ] User is logged in
- [ ] Frontend fetched latest reservation data

**Solution:** Check MyReservations component conditions:
```tsx
{(reservation.status === 'PENDING') && !reservation.isPaid && (
  <Button>Pay Now</Button>
)}
```

### Error: Amount showing ৳0.00

**Cause:** Missing `totalCostBDT` field

**Solution:** Use fallback in frontend:
```tsx
amount={reservation.totalCostBDT || reservation.estimatedCostBDT || 0}
```

### Error: Port 5000 already in use

**Solution:**
```bash
# Option 1: Kill process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Option 2: Change port in .env
PORT=5001

# Option 3: Let server auto-restart (nodemon)
# Just wait for file changes to trigger restart
```

### Error: Redis connection refused

**This is normal!** Redis is optional in development.

**You'll see:**
```
warn: ⚠️ Redis not available - continuing without Redis
warn: ⚠️ Payment timeout and reminder features will be disabled
```

**Impact:**
- ✅ Payments still work
- ✅ Manual payment processing works
- ❌ Auto-expiry disabled (need manual cleanup)
- ❌ Reminder emails disabled

## Production Deployment

### SSLCommerz Production Setup

1. **Get Production Credentials:**
   - Register at https://sslcommerz.com
   - Complete business verification
   - Get production Store ID and Password

2. **Update Environment Variables:**
```env
NODE_ENV=production
SSLCOMMERZ_STORE_ID=your_production_store_id
SSLCOMMERZ_STORE_PASSWORD=your_production_password
```

3. **SSL Certificate:**
   - SSLCommerz requires HTTPS in production
   - Use Let's Encrypt or similar
   - Update callback URLs to HTTPS

4. **Test in Production:**
   - Use real cards in small amounts first
   - Verify payment flow end-to-end
   - Check webhook integration
   - Monitor transaction logs

### Security Checklist

- [ ] Never commit `.env` file to git
- [ ] Use strong passwords for production
- [ ] Enable rate limiting on payment endpoints
- [ ] Implement CSRF protection
- [ ] Validate all payment amounts server-side
- [ ] Log all transactions for audit
- [ ] Set up monitoring alerts
- [ ] Implement idempotency keys
- [ ] Use HTTPS for all API calls
- [ ] Verify payment signatures

## Monitoring & Logging

### Key Logs to Watch

**Successful Payment:**
```
info: Payment initiated successfully
info: Payment verified successfully
info: Reservation marked as paid
info: Cancelled expiry and reminder jobs
```

**Failed Payment:**
```
error: Payment initiation failed
error: Payment verification failed
warn: Payment marked as failed
```

### Database Queries

**Check pending payments:**
```javascript
db.reservations.find({
  status: "PENDING",
  isPaid: false,
  paymentDeadline: { $gt: new Date() }
})
```

**Check completed payments:**
```javascript
db.reservations.find({
  status: "CONFIRMED",
  isPaid: true
})
```

**Check expired reservations:**
```javascript
db.reservations.find({
  status: "PENDING",
  isPaid: false,
  paymentDeadline: { $lt: new Date() }
})
```

## Support & Resources

### SSLCommerz Resources
- Sandbox Dashboard: https://sandbox.sslcommerz.com
- Production Dashboard: https://securepay.sslcommerz.com
- API Documentation: https://developer.sslcommerz.com
- Test Cards: https://developer.sslcommerz.com/doc/v4/#test-card-numbers

### AmarEV Documentation
- Main README: `/README.md`
- Redis Setup: `/Redis-Optional-Setup.md`
- SSLCommerz Guide: `/SSLCommerz-Easy-Checkout-Setup.md`
- Payment Timeout: `/Payment-Timeout-System.md`

---

**Last Updated:** November 13, 2025  
**Version:** 1.0.0  
**Status:** ✅ Demo Mode Working
