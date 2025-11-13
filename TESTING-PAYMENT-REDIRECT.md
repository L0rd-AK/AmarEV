# Testing Payment Redirect Fix

## Quick Test Guide

### Prerequisites
1. MongoDB running on localhost:27017
2. Backend server running on localhost:5000
3. Frontend running on localhost:3000

### Environment Setup

Ensure your `.env` file has these variables:
```env
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
SSLCOMMERZ_STORE_ID=testbox
SSLCOMMERZ_STORE_PASSWORD=qwerty
```

### Test Steps

#### 1. Start the Servers

**Terminal 1 - Backend:**
```bash
cd Server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd Client
npm run dev
```

#### 2. Test the Payment Flow

1. **Login/Register**
   - Go to http://localhost:3000
   - Login or create an account

2. **Find a Station**
   - Browse charging stations
   - Click on a station to view details

3. **Make a Reservation**
   - Click "Book Now" or "Reserve"
   - Fill in reservation details
   - Submit reservation

4. **Initiate Payment**
   - You'll be redirected to SSLCommerz sandbox
   - Use test credentials (sandbox mode)

5. **Complete Payment**
   - On SSLCommerz page, click "Success" or complete test payment
   - **EXPECTED RESULT**: You should be automatically redirected to:
     ```
     http://localhost:3000/payment/success?tran_id=XXX&val_id=YYY&...
     ```
   - **Page should load immediately without manual refresh**
   - You should see the payment success page with transaction details

#### 3. Verify Backend Logs

Watch the backend terminal for these log entries:

```
SSLCommerz success callback received { transactionId: 'TXN_...', valId: '...' }
Redirecting to frontend { redirectUrl: 'http://localhost:3000/payment/success?...' }
```

#### 4. Verify Frontend Behavior

The PaymentSuccess component should:
- Show loading spinner briefly
- Call `/api/payments/verify` endpoint
- Display payment receipt
- Show success message
- Provide navigation buttons

### Test Different Scenarios

#### Success Case
1. Complete payment normally
2. Should redirect to `/payment/success`
3. Should see green success message

#### Failure Case
1. Click "Fail" on SSLCommerz test page
2. Should redirect to `/payment/failed`
3. Should see red error message

#### Cancel Case
1. Click "Cancel" on SSLCommerz test page
2. Should redirect to `/payment/cancelled`
3. Should see cancel message

### Troubleshooting

#### Issue: Page doesn't load after payment
**Check:**
- Backend server is running and accessible
- BACKEND_URL and FRONTEND_URL are correct in .env
- SSLCommerz callback URLs are pointing to backend

**Verify Routes:**
```bash
# Test backend callback endpoint
curl http://localhost:5000/api/payment/sslcommerz/success
```

#### Issue: Getting 404 on callback
**Check:**
- Routes are registered correctly in `Server/src/index.ts`
- Payment routes are at `/api/payments`
- Callback routes exist in `Server/src/routes/payments.ts`

#### Issue: Frontend shows "Invalid payment callback"
**Check:**
- Query parameters are present in URL
- `tran_id` and `val_id` are being passed
- Payment verification endpoint is working

### Debug Mode

Enable detailed logging:

**Backend (`Server/src/controllers/PaymentController.ts`):**
```typescript
// Already has logger.info statements - check terminal output
```

**Frontend (`Client/src/pages/PaymentSuccess.tsx`):**
```typescript
// Already has console.log statements - check browser console
```

### Expected Flow Diagram

```
User clicks "Pay"
    ↓
Frontend → Backend: POST /api/payments/initiate
    ↓
Backend → SSLCommerz: Initialize payment
    ↓
Backend → Frontend: Return payment URL
    ↓
Frontend: Redirect user to SSLCommerz
    ↓
[User completes payment on SSLCommerz]
    ↓
SSLCommerz → Backend: POST /api/payment/sslcommerz/success
    ↓
Backend: Extract POST data
    ↓
Backend → Frontend: HTTP 302 Redirect with query params
    ↓
Frontend: React Router loads /payment/success
    ↓
Frontend → Backend: POST /api/payments/verify
    ↓
Backend: Verify with SSLCommerz
    ↓
Backend: Update reservation status
    ↓
Backend → Frontend: Return verification result
    ↓
Frontend: Display success page ✅
```

### Success Criteria

✅ No manual page refresh needed
✅ Payment success page loads automatically
✅ Transaction details are displayed
✅ Reservation status is updated to CONFIRMED
✅ Payment record is saved in database
✅ User can navigate to dashboard/reservations

### Common Test Credentials

**SSLCommerz Sandbox:**
- Store ID: `testbox`
- Store Password: `qwerty`
- Any test card: Will show success/fail/cancel buttons

### Next Steps After Successful Test

1. Test with real SSLCommerz credentials (not testbox)
2. Test in production environment
3. Monitor logs for any issues
4. Set up proper error handling
5. Add payment notification emails (optional)

## Questions?

If the test fails, check:
1. PAYMENT-REDIRECT-FIX.md for implementation details
2. Server logs in terminal
3. Browser console for errors
4. Network tab in browser DevTools
