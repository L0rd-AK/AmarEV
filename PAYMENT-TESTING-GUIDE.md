# Payment Testing Guide - AmarEV

## ✅ All Issues Fixed!

### What Was Fixed:

1. **JWT Signature Error** ✅
   - Changed `authenticate` middleware to use `jwtService` instead of `AuthService`
   - Both token generation and verification now use the same service
   
2. **PaymentController Bug** ✅
   - Fixed all `req.user!.userId` → `req.userId!`
   - Added proper TypeScript types
   
3. **Missing Payment Routes** ✅
   - Added `/payment/success` route
   - Added `/payment/failed` route
   - Added `/payment/cancelled` route

## 🧪 How to Test Payment Flow

### Step 1: Clear Browser Storage
Open browser console (F12) and run:
```javascript
localStorage.clear();
sessionStorage.clear();
console.log('✅ Storage cleared');
```

### Step 2: Login
1. Go to: `http://localhost:3000/login`
2. Login with your credentials
3. Verify token exists:
```javascript
const token = localStorage.getItem('accessToken');
console.log('Token:', token ? '✅ Present' : '❌ Missing');
```

### Step 3: Make a Test Payment

**Option A: Book a Charging Slot**
1. Go to Stations page
2. Find a station
3. Click "Book Now"
4. Select time slot
5. Proceed to payment
6. Complete payment with test card

**Option B: Direct Payment Test**
If you have a reservation ID, test directly:
```javascript
// In browser console
fetch('http://localhost:5000/api/payments/initiate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reservationId: 'YOUR_RESERVATION_ID',
    amount: 100,
    currency: 'BDT',
    paymentMethod: 'sslcommerz',
    description: 'Test payment'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Payment initiation:', data);
  if (data.success && data.data.paymentUrl) {
    window.open(data.data.paymentUrl, '_blank');
  }
});
```

### Step 4: Test Payment Pages

**Success Page:**
```
http://localhost:3000/payment/success?tran_id=TEST123&status=VALID
```

**Failed Page:**
```
http://localhost:3000/payment/failed?error=Payment+Failed&reason=Insufficient+funds
```

**Cancelled Page:**
```
http://localhost:3000/payment/cancelled
```

## 🎯 Expected Results

### ✅ Success Flow:
1. Payment initiation returns `paymentUrl`
2. User redirects to SSLCommerz
3. After payment, redirects to `/payment/success`
4. Page verifies payment with backend
5. Shows success message and receipt
6. Reservation marked as paid

### ❌ Failure Flow:
1. If payment fails at gateway
2. Redirects to `/payment/failed`
3. Shows error message
4. Option to try again

### ⚠️ Cancellation Flow:
1. If user cancels at gateway
2. Redirects to `/payment/cancelled`
3. Shows cancellation message
4. Option to complete payment

## 🐛 Debugging Payment Issues

### Check Server Logs:
Look for these in terminal:
```
✅ "Payment initiated successfully"
✅ "Token decoded successfully"
❌ "JWT verification failed"
❌ "Payment initiation error"
```

### Check Browser Console:
```javascript
// Check if token is valid
const token = localStorage.getItem('accessToken');
console.log('Token parts:', token?.split('.').length); // Should be 3

// Check payment service
console.log('Payment service:', typeof paymentService);

// Test auth
fetch('http://localhost:5000/api/auth/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => console.log('Auth test:', data));
```

### Common Issues:

**Issue: "Access token is required"**
- Solution: Clear storage and login again

**Issue: "Invalid signature"**
- Solution: Server was restarted, clear tokens and login

**Issue: "Payment initiation error"**
- Check server logs for actual error
- Verify reservation exists
- Check payment amount is valid

**Issue: "Page not found" for payment URLs**
- Fixed! Routes are now added to App.tsx

## 📋 SSLCommerz Test Cards

### Test Credit/Debit Cards:
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date
CVV: Any 3 digits
```

### Test Mobile Banking:
Use the test credentials provided by SSLCommerz in sandbox mode.

## 🔍 Verification Checklist

- [ ] Server is running on port 5000
- [ ] Client is running on port 3000
- [ ] MongoDB is connected
- [ ] Cleared browser storage
- [ ] Logged in successfully
- [ ] Token exists in localStorage
- [ ] Can view stations
- [ ] Can create reservation
- [ ] Can initiate payment
- [ ] Payment pages load correctly
- [ ] Can verify payment status

## 📞 Still Having Issues?

### Check These:

1. **Is server running?**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Is JWT configured?**
   ```bash
   curl http://localhost:5000/api/debug/jwt-check
   ```

3. **Server logs showing errors?**
   - Look for red error messages
   - Check MongoDB connection
   - Verify .env file is loaded

4. **Client console errors?**
   - Open DevTools (F12)
   - Check Console tab
   - Check Network tab for failed requests

### Get Help:
- Check server terminal for error logs
- Share the actual error message
- Include what step fails
- Provide browser console output

---

**Status**: ✅ Payment system is ready for testing!
**Last Updated**: 2025-11-13 20:54
