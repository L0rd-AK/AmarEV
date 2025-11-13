# JWT Token Debugging Guide

## Steps to Debug the JWT Signature Error

### 1. Clear Browser Storage (Again, but properly)

Open your browser console (F12) and run:
```javascript
// Clear everything
localStorage.clear();
sessionStorage.clear();

// Also clear IndexedDB (for Redux Persist)
indexedDB.deleteDatabase('localforage');

// Verify it's cleared
console.log('Access Token:', localStorage.getItem('accessToken'));
console.log('Refresh Token:', localStorage.getItem('refreshToken'));
```

### 2. Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Then restart it
cd Server
npm run dev
```

**Important:** Make sure the server is loading the `.env` file from the correct location!

### 3. Test JWT Configuration

Once server is running, test the JWT setup:

```bash
# Test 1: Check JWT configuration
curl http://localhost:5000/api/debug/jwt-check
```

This will show you:
- If JWT_SECRET is loaded
- If both services generate compatible tokens
- Token verification status

### 4. Login Fresh and Get New Token

1. Go to your app: `http://localhost:3000/login`
2. Login with your credentials
3. Open browser console
4. Run:
```javascript
const token = localStorage.getItem('accessToken');
console.log('Token:', token);
```

### 5. Verify Your Token

Copy the token and test it:

```bash
# Windows PowerShell
$token = "YOUR_TOKEN_HERE"
$body = @{ token = $token } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/debug/verify-my-token" -Body $body -ContentType "application/json"
```

Or use this in browser console:
```javascript
const token = localStorage.getItem('accessToken');

fetch('http://localhost:5000/api/debug/verify-my-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
})
.then(r => r.json())
.then(data => console.log('Verification Result:', data));
```

### 6. Check Server Logs

Look for these log messages:
- ✅ "Token decoded successfully" - Good!
- ❌ "JWT verification failed" - Shows the actual error

## Common Causes & Solutions

### Cause 1: Wrong JWT_SECRET
**Symptoms:** "invalid signature" error
**Solution:** 
1. Check `Server/.env` file
2. Verify `JWT_SECRET=dev-super-secret-jwt-key-change-in-production-123456789`
3. Restart server
4. Clear tokens and login again

### Cause 2: Token Created by Different Service
**Symptoms:** Error about token type or missing fields
**Solution:** Fixed! AuthService now includes `type` field

### Cause 3: Cached/Old Tokens
**Symptoms:** Persistent errors even after login
**Solution:**
1. Hard refresh browser (Ctrl+Shift+F5)
2. Clear all storage (see step 1)
3. Try incognito mode

### Cause 4: Wrong .env File Being Loaded
**Symptoms:** Server using different JWT_SECRET
**Solution:**
1. Check `Server/.env` exists
2. Verify in server logs: "JWT_SECRET_DEFINED: true"
3. Check if there's a `.env.production` or `.env.local` overriding it

## Quick Fix: Force New Secret (Nuclear Option)

If nothing works, generate a completely new JWT_SECRET:

1. Generate new secret:
```bash
# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

2. Update `Server/.env`:
```
JWT_SECRET=<NEW_SECRET_HERE>
JWT_REFRESH_SECRET=<ANOTHER_NEW_SECRET_HERE>
```

3. Restart server
4. Clear ALL tokens
5. All users must login again

## What I Fixed

1. ✅ Fixed `AuthService` to include `type` field in tokens
2. ✅ Fixed `PaymentController` to use `req.userId` instead of `req.user!.userId`
3. ✅ Added better error logging in JWT verification
4. ✅ Created debug endpoints to test JWT configuration

## Still Not Working?

If you still get the error after all these steps, check:

1. **Are you logged in?**
   - Verify `localStorage.getItem('accessToken')` returns a token

2. **Is the token format correct?**
   - Should have 3 parts separated by dots: `xxxxx.yyyyy.zzzzz`

3. **Is the server error different now?**
   - Check the actual error message in server logs

4. **Server logs showing what?**
   - Look for "JWT verification failed" messages
   - Check what the actual error is

## Test Sequence

Run these commands in order:

```javascript
// In Browser Console:

// 1. Check current state
console.log('Logged in?', !!localStorage.getItem('accessToken'));

// 2. Clear everything
localStorage.clear();
sessionStorage.clear();

// 3. Go to login page and login

// 4. After login, verify token
const token = localStorage.getItem('accessToken');
console.log('Token parts:', token?.split('.').length); // Should be 3

// 5. Test the token
fetch('http://localhost:5000/api/debug/verify-my-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
})
.then(r => r.json())
.then(data => console.log('Result:', data));
```

---

**Need more help?** Share:
1. Server log output when error happens
2. Result from `/api/debug/jwt-check`
3. Result from `/api/debug/verify-my-token`
