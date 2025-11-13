# Redis Optional Setup - Development Mode

## Overview

The AmarEV server has been updated to make Redis optional for development. This allows you to run the server without installing Redis, with graceful degradation of features that depend on it.

## What Changed

### 1. Worker Initialization (Conditional)

**Files Modified:**
- `Server/src/jobs/reservationExpiryWorker.ts`
- `Server/src/jobs/paymentReminderWorker.ts`
- `Server/src/jobs/index.ts`

**What Changed:**
Workers now use conditional initialization instead of connecting immediately on import:

```typescript
// Before (crashed without Redis):
export const reservationExpiryWorker = new Worker(...);

// After (checks Redis first):
let reservationExpiryWorker: Worker | null = null;

export const initializeReservationExpiryWorker = async () => {
  const { redisConnection } = await import('../config/queue');
  
  if (!redisConnection || redisConnection.status !== 'ready') {
    logger.warn('Redis not available - worker will not start');
    return null;
  }
  
  reservationExpiryWorker = new Worker(...);
  return reservationExpiryWorker;
};
```

### 2. Server Startup (Graceful Redis Handling)

**File Modified:** `Server/src/index.ts`

**What Changed:**
Redis connection is now wrapped in try-catch with specific error handling:

```typescript
// Redis is now optional
try {
  await connectRedis();
  logger.info('✅ Redis connected successfully');
  
  // Only initialize workers if Redis is available
  const { initializeWorkers } = await import('@/jobs');
  await initializeWorkers();
} catch (error: any) {
  if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
    logger.warn('⚠️ Redis is not available - continuing without Redis');
    logger.warn('⚠️ Payment timeout and reminder features will be disabled');
  } else {
    throw error; // Re-throw non-Redis errors
  }
}
```

### 3. Queue Configuration (Availability Checker)

**File Modified:** `Server/src/config/queue.ts`

**What Added:**
New function to check if Redis is available:

```typescript
export const isRedisAvailable = (): boolean => {
  return redisAvailable && redisConnection.status === 'ready';
};
```

### 4. Controller Updates (Already Had Error Handling)

**Files:** 
- `Server/src/controllers/ReservationController.ts`
- `Server/src/controllers/PaymentController.ts`

**Status:** ✅ Already had proper null checks and try-catch blocks

Both controllers already check if queues are available before scheduling/canceling jobs:

```typescript
if (reservationExpiryQueue && paymentReminderQueue) {
  await reservationExpiryQueue.add(...);
  await paymentReminderQueue.add(...);
} else {
  logger.warn('Queue not available - Redis may not be running');
}
```

## Features Affected When Redis is Unavailable

### ❌ Disabled Features (without Redis):

1. **Automatic Reservation Expiry**
   - Unpaid reservations won't auto-expire after 30 minutes
   - Status won't automatically change from PENDING → EXPIRED
   - Manual cleanup required

2. **Payment Reminder Emails**
   - No automated reminder emails 25 minutes after reservation
   - Users won't receive "5 minutes left to pay" warnings

3. **Background Job Processing**
   - No BullMQ workers running
   - No job queuing or scheduling

### ✅ Still Working (without Redis):

1. **Reservation Creation**
   - Users can create reservations normally
   - `paymentDeadline` field still set correctly
   - `paymentStatus` tracked properly

2. **Payment Processing**
   - SSLCommerz payment gateway works fully
   - bKash payment works (if configured)
   - Payment verification works
   - Reservation status updated on payment

3. **Core Application Features**
   - Authentication & authorization
   - Station browsing & search
   - Vehicle management
   - Session tracking
   - Reviews & ratings
   - Admin dashboard

## Starting the Server Without Redis

### What You'll See:

```bash
✅ MongoDB connected successfully
⚠️ Redis is not available - continuing without Redis
⚠️ Payment timeout and reminder features will be disabled
✅ Socket.IO configured successfully
⚠️ Redis not available - background workers disabled
🚀 Server running on port 5000
📱 Environment: development
🌐 CORS origin: http://localhost:3000
```

### No More Error Spam:

❌ **Before (with errors):**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
error: Reservation expiry worker error: connect ECONNREFUSED 127.0.0.1:6379
error: Reservation expiry worker error: Connection is closed.
(repeated 100+ times)
```

✅ **After (clean warnings):**
```
⚠️ Redis is not available - continuing without Redis
⚠️ Payment timeout and reminder features will be disabled
```

## Installing Redis (Optional)

If you want the full payment timeout features, install Redis:

### Windows:

```powershell
# Using winget
winget install Redis.Redis

# Or download from:
# https://github.com/microsoftarchive/redis/releases

# Start Redis
redis-server
```

### Linux:

```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Fedora/RHEL
sudo dnf install redis
sudo systemctl start redis
```

### macOS:

```bash
# Using Homebrew
brew install redis
brew services start redis
```

### Docker:

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Or use existing docker-compose.yml
docker-compose up redis
```

## Environment Variables

The following Redis configuration variables are available in `.env`:

```env
# Redis Configuration (optional for development)
REDIS_HOST=localhost        # Default: localhost
REDIS_PORT=6379            # Default: 6379
REDIS_PASSWORD=            # Optional password
```

## Verifying Redis Connection

### Check if Redis is Running:

```bash
# Windows/Linux/macOS
redis-cli ping
# Should return: PONG
```

### Check Server Logs:

When Redis is connected, you'll see:
```
✅ Redis connected successfully
✅ Background workers initialized successfully
```

When Redis is unavailable:
```
⚠️ Redis is not available - continuing without Redis
⚠️ Payment timeout and reminder features will be disabled
⚠️ Background workers not started - Redis is not available
```

## Monitoring Payment Timeouts (Without Redis)

If running without Redis, you'll need to manually handle expired reservations:

### Option 1: Manual Database Cleanup

Run this query periodically to mark expired reservations:

```javascript
// MongoDB Query
db.reservations.updateMany(
  {
    status: 'PENDING',
    isPaid: false,
    paymentDeadline: { $lt: new Date() }
  },
  {
    $set: { status: 'EXPIRED' }
  }
)
```

### Option 2: Scheduled Task

Create a simple cron job or scheduled task:

```bash
# Linux/macOS cron (every 5 minutes)
*/5 * * * * /path/to/cleanup-script.sh

# Windows Task Scheduler
# Create task to run every 5 minutes
```

### Option 3: Application-Level Check

Add manual checks in your code when users view reservations:

```typescript
// Check and update expired reservations on fetch
const now = new Date();
const expiredReservations = await Reservation.updateMany(
  {
    userId,
    status: 'PENDING',
    isPaid: false,
    paymentDeadline: { $lt: now }
  },
  { $set: { status: 'EXPIRED' } }
);
```

## Production Deployment

### ⚠️ Important: Redis is REQUIRED for Production

For production deployments, Redis should be installed and configured:

1. **Automatic Expiry**: Critical for preventing indefinite holds on charging stations
2. **Payment Reminders**: Improves conversion rates and user experience
3. **Job Reliability**: BullMQ provides retry logic and failure handling
4. **Monitoring**: BullMQ UI available for job queue monitoring

### Production Redis Setup:

```env
NODE_ENV=production
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
```

**Recommended Services:**
- Redis Cloud (redis.com)
- AWS ElastiCache
- Azure Cache for Redis
- DigitalOcean Managed Redis
- Self-hosted on dedicated server

## Testing the Payment Flow

### Without Redis:

1. ✅ Create reservation → Success (with 30-minute deadline)
2. ❌ Wait 25 minutes → No reminder email sent
3. ❌ Wait 30 minutes → Reservation stays PENDING (manual cleanup needed)
4. ✅ Click "Pay Now" → Works normally
5. ✅ Complete payment → Reservation marked as paid

### With Redis:

1. ✅ Create reservation → Success (with 30-minute deadline)
2. ✅ Wait 25 minutes → Reminder email sent automatically
3. ✅ Wait 30 minutes → Reservation auto-expires (status → EXPIRED)
4. ✅ Click "Pay Now" → Works normally (if before expiry)
5. ✅ Complete payment → Jobs cancelled, reservation confirmed

## Troubleshooting

### Server Still Won't Start

**Issue:** Server exits immediately
**Cause:** Unrelated error (not Redis)
**Solution:** Check logs for actual error:

```bash
npm run dev
# Look for non-Redis errors in output
```

### Workers Not Starting (With Redis)

**Issue:** Redis running but workers not initialized
**Logs:** "Redis connected" but no "Background workers initialized"
**Solution:**

1. Check Redis connection status:
```bash
redis-cli info
```

2. Verify BullMQ can connect:
```bash
npm run dev
# Check for BullMQ errors in logs
```

3. Clear Redis if corrupted:
```bash
redis-cli FLUSHALL
```

### Payment Not Working

**Issue:** Payment fails after Redis is disabled
**Note:** ❌ This is NOT a Redis issue - payments work without Redis

**Likely Causes:**
1. SSLCommerz credentials not configured
2. Network/firewall blocking payment gateway
3. Validation errors in payment data
4. User authentication issues

**Check:**
```bash
# Server logs
tail -f logs/combined.log

# Look for payment-related errors
grep "payment" logs/combined.log
```

## Summary

✅ **Server now starts without Redis**
✅ **No error spam about ECONNREFUSED**
✅ **Payments work without Redis**
✅ **Clear warning messages about disabled features**
❌ **No automatic expiry/reminders without Redis**
⚠️ **Redis required for production deployments**

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Applies To:** AmarEV v0.1.0+
