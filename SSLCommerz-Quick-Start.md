# SSLCommerz Payment - Quick Start Guide

## Prerequisites
- Backend server running on port 5000
- Frontend server running on port 5173
- MongoDB running
- SSLCommerz sandbox credentials

## Step-by-Step Testing

### 1. Configure Environment

Create `.env` file in Server folder:
```bash
# Copy from .env.example
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### 2. Test Payment Integration

#### Option A: Using the PaymentIntegration Component

```tsx
// Add to any page where you want payment
import { PaymentIntegration } from './components/Payment/PaymentIntegration';

<PaymentIntegration
  reservationId="test_reservation_123"
  amount={500}
  description="Test EV Charging Payment"
  onPaymentSuccess={(transactionId) => {
    console.log('Payment Success:', transactionId);
    alert('Payment completed successfully!');
  }}
  onPaymentCancel={() => {
    console.log('Payment Cancelled');
  }}
/>
```

#### Option B: Direct API Call

```typescript
import paymentService from './services/paymentService';
import { PaymentProvider } from '@chargebd/shared';

const testPayment = async () => {
  const response = await paymentService.initiatePayment({
    amount: 500,
    currency: 'BDT',
    paymentMethod: PaymentProvider.SSLCOMMERZ,
    description: 'Test Payment',
    successUrl: 'http://localhost:5173/payment/success',
    failUrl: 'http://localhost:5173/payment/failed',
    cancelUrl: 'http://localhost:5173/payment/cancelled',
  });

  if (response.success && response.data) {
    console.log('Payment URL:', response.data.gatewayPageURL);
    window.location.href = response.data.gatewayPageURL;
  }
};
```

### 3. SSLCommerz Sandbox Testing

When redirected to SSLCommerz sandbox:

1. **Select Payment Method**: Choose "Card Payment"

2. **Test Card Details**:
   ```
   Card Number: 4111111111111111 (Visa)
                5555555555554444 (MasterCard)
   Expiry Date: 12/25 (Any future date)
   CVV: 123
   Card Holder: Test User
   ```

3. **Click "Proceed"** → Payment will be processed

4. **Success**: Redirected to `/payment/success?tran_id=xxx&val_id=yyy&status=VALID`

### 4. Verify Payment

The Payment Success page will automatically:
- Extract transaction details from URL
- Verify payment with backend
- Display payment receipt
- Update reservation status

### 5. Check Database

```javascript
// In MongoDB Compass or Shell
use amar_ev

// Check payment record
db.payments.find({ transactionId: "YOUR_TRANSACTION_ID" })

// Check updated reservation
db.reservations.find({ _id: ObjectId("YOUR_RESERVATION_ID") })
```

## Quick Test Script

Create `test-payment.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Test SSLCommerz Payment</title>
</head>
<body>
    <h1>Test SSLCommerz Payment</h1>
    <button onclick="testPayment()">Start Payment</button>

    <script>
        async function testPayment() {
            const response = await fetch('http://localhost:5000/api/payments/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_ACCESS_TOKEN'
                },
                body: JSON.stringify({
                    amount: 500,
                    currency: 'BDT',
                    paymentMethod: 'SSLCOMMERZ',
                    description: 'Test Payment',
                    successUrl: 'http://localhost:5173/payment/success',
                    failUrl: 'http://localhost:5173/payment/failed',
                    cancelUrl: 'http://localhost:5173/payment/cancelled'
                })
            });

            const data = await response.json();
            console.log('Response:', data);

            if (data.success && data.data.gatewayPageURL) {
                window.location.href = data.data.gatewayPageURL;
            } else {
                alert('Payment initiation failed: ' + data.error);
            }
        }
    </script>
</body>
</html>
```

## Common Test Scenarios

### ✅ Successful Payment
1. Use valid test card
2. Complete payment
3. Should redirect to `/payment/success`
4. Check database for payment record with status "COMPLETED"

### ❌ Failed Payment
1. Use invalid card (e.g., `4000000000000002`)
2. Payment fails
3. Should redirect to `/payment/failed`
4. Check database for payment record with status "FAILED"

### 🚫 Cancelled Payment
1. Start payment
2. Click "Cancel" button on SSLCommerz page
3. Should redirect to `/payment/cancelled`
4. Check database - no payment record or status "CANCELED"

## Debugging

### Enable Logging

```typescript
// In SSLCommerzService.ts
console.log('Initiating payment:', {
  amount,
  transactionId,
  urls: {
    success: successUrl,
    fail: failUrl,
    cancel: cancelUrl
  }
});
```

### Check Network Requests

```javascript
// In browser DevTools → Network tab
// Filter: XHR
// Look for:
// - POST /api/payments/initiate
// - POST /api/payments/verify
// - GET /payment/success?tran_id=...
```

### Test Webhook Locally

Use ngrok to expose your local server:

```bash
ngrok http 5000

# Copy ngrok URL and update in SSLCommerz dashboard:
# IPN URL: https://your-ngrok-url.ngrok.io/api/payments/webhook/sslcommerz
```

## Expected API Responses

### Payment Initiation Success
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN_1699876543210",
    "gatewayPageURL": "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=...",
    "sessionKey": "ABC123XYZ789"
  }
}
```

### Payment Verification Success
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": "COMPLETED",
    "transactionId": "TXN_1699876543210",
    "amount": 500,
    "currency": "BDT",
    "paidAt": "2025-11-13T10:30:00.000Z",
    "gatewayTransactionId": "201234567890"
  }
}
```

## Troubleshooting

### Issue: "Failed to fetch"
**Solution**: 
- Check backend is running on port 5000
- Check CORS is enabled
- Verify API_BASE_URL in frontend .env

### Issue: "Invalid credentials"
**Solution**:
- Verify SSLCommerz credentials in backend .env
- Ensure no extra spaces in credentials
- For sandbox, use: `testbox` / `qwerty`

### Issue: "Payment URL not received"
**Solution**:
- Check SSLCommerz API response in backend logs
- Verify store ID and password
- Ensure all required fields are sent

### Issue: "Callback not working"
**Solution**:
- Check callback URLs are correct
- Verify routes are registered in App.tsx
- Check URL parameters are being extracted

## Next Steps

1. ✅ Test all payment scenarios
2. ✅ Verify database updates
3. ✅ Test webhook with ngrok
4. ✅ Integrate into booking flow
5. 🔄 Add error handling
6. 🔄 Implement refund functionality
7. 🔄 Add payment history page
8. 🔄 Deploy to production with live credentials

## Support Resources

- **Backend Logs**: `Server/logs/`
- **Frontend Console**: Browser DevTools
- **SSLCommerz Dashboard**: https://developer.sslcommerz.com/
- **API Documentation**: Check `SSLCommerz-Integration-Guide.md`

Happy Testing! 🚀
