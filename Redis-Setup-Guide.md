# Redis Setup for Payment Timeout Features (Optional)

## Overview

Redis is **optional** for the basic payment functionality. However, it enables advanced features:

- ✅ **Without Redis**: Payment works normally (manual monitoring needed)
- 🚀 **With Redis**: Automatic reservation expiry after 30 minutes, email reminders

---

## Quick Decision

### Do I Need Redis?

**You DON'T need Redis if:**
- You're just testing the payment flow
- You want to manually manage unpaid reservations
- You're in early development

**You SHOULD install Redis if:**
- You want automatic reservation expiry after 30 minutes
- You want email reminders before expiry
- You're preparing for production

---

## Installing Redis on Windows

### Option 1: Using WSL (Recommended)

```bash
# 1. Install WSL (if not already installed)
wsl --install

# 2. In WSL terminal, install Redis
sudo apt update
sudo apt install redis-server

# 3. Start Redis
sudo service redis-server start

# 4. Test Redis
redis-cli ping
# Should return: PONG

# 5. To start Redis on boot
sudo systemctl enable redis-server
```

### Option 2: Using Docker (Easiest)

```bash
# Pull and run Redis container
docker run --name amarev-redis -d -p 6379:6379 redis:alpine

# Verify it's running
docker ps

# Start on system reboot
docker update --restart unless-stopped amarev-redis
```

### Option 3: Using Memurai (Native Windows)

1. Download: https://www.memurai.com/get-memurai
2. Install the MSI package
3. Memurai will run as a Windows service automatically
4. Test: `memurai-cli ping`

---

## Verifying Redis is Running

### Check Connection

```bash
# Windows (if using Memurai)
memurai-cli ping

# WSL or Linux
redis-cli ping

# Should return: PONG
```

### Check Port is Listening

```powershell
# PowerShell
netstat -ano | findstr :6379

# Should show:
# TCP    127.0.0.1:6379         0.0.0.0:0              LISTENING       1234
```

### Test from Node.js

```javascript
const Redis = require('ioredis');
const redis = new Redis({ host: 'localhost', port: 6379 });

redis.ping().then((result) => {
  console.log('Redis connection:', result); // Should print: PONG
  redis.disconnect();
});
```

---

## Current System Behavior

### Without Redis (Current State)

Your application will run normally, but you'll see warnings:
```
warn: Redis not available - payment timeout features will be disabled
warn: Background workers not started - Redis is not available
warn: Payment reminder queue not available - Redis may not be running
```

**What Still Works:**
- ✅ Creating reservations
- ✅ Payment processing with SSLCommerz
- ✅ Payment verification
- ✅ Reservation confirmation
- ✅ All frontend features

**What's Disabled:**
- ❌ Auto-expiry after 30 minutes
- ❌ Email reminders before expiry
- ❌ Countdown timer features

### With Redis (Full Features)

When Redis is running:
```
info: Redis connected for BullMQ
info: BullMQ queues initialized successfully
info: Background workers initialized successfully
```

**Additional Features Enabled:**
- ✅ Automatic expiry of unpaid reservations (30 min)
- ✅ Email reminder sent 5 minutes before expiry
- ✅ Background job processing
- ✅ Real-time countdown timers

---

## Configuration

### Environment Variables

No changes needed! The system auto-detects Redis:

```bash
# .env (Redis is optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=           # Leave empty if no password
```

### Testing Redis Connection

```bash
# Start your server
npm run dev

# Look for these log messages:
✅ "Redis connected for BullMQ" → Redis is working
⚠️  "Redis not available" → Redis is not running (but app still works)
```

---

## Manual Reservation Management (Without Redis)

If you choose not to use Redis, you can manually manage unpaid reservations:

### Option 1: Scheduled Job (Simple)

Create a cron job or scheduled task:

```javascript
// scripts/expireReservations.js
const mongoose = require('mongoose');
const Reservation = require('./models/Reservation');

async function expireOldReservations() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  await Reservation.updateMany(
    {
      status: 'pending',
      isPaid: false,
      createdAt: { $lte: thirtyMinutesAgo }
    },
    {
      status: 'expired',
      paymentStatus: 'expired'
    }
  );
  
  console.log('Expired old reservations');
}

// Run every minute
setInterval(expireOldReservations, 60 * 1000);
```

Run it:
```bash
node scripts/expireReservations.js
```

### Option 2: Database Trigger (Advanced)

Use MongoDB TTL index:

```javascript
// In Reservation model
reservationSchema.index(
  { createdAt: 1 },
  { 
    expireAfterSeconds: 1800, // 30 minutes
    partialFilterExpression: { 
      status: 'pending',
      isPaid: false 
    }
  }
);
```

---

## Production Considerations

### Cloud Redis Options

If deploying to cloud, consider:

1. **AWS ElastiCache** (if using AWS)
   ```bash
   REDIS_HOST=your-redis.cache.amazonaws.com
   REDIS_PORT=6379
   ```

2. **Azure Cache for Redis** (if using Azure)
   ```bash
   REDIS_HOST=your-redis.redis.cache.windows.net
   REDIS_PORT=6380
   REDIS_PASSWORD=your-access-key
   ```

3. **Redis Cloud** (Free tier available)
   - Sign up: https://redis.com/try-free/
   - Get connection details
   - Update `.env` file

4. **Upstash Redis** (Serverless, free tier)
   - Sign up: https://upstash.com/
   - Create database
   - Use REST API or Redis protocol

---

## Troubleshooting

### Issue: "ECONNREFUSED 127.0.0.1:6379"

**Solution**: Redis is not running. Either:
- Start Redis (see installation above)
- Or just ignore the warnings - payment still works!

### Issue: Redis starts then stops

**Check logs**:
```bash
# WSL/Linux
sudo journalctl -u redis-server -n 50

# Docker
docker logs amarev-redis
```

**Common fix** (WSL):
```bash
# Restart Redis service
sudo service redis-server restart
```

### Issue: High memory usage

**Configure Redis memory limit**:
```bash
# Edit redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

---

## Summary

- ✅ **Redis is OPTIONAL** - Your payment system works without it
- 🚀 **With Redis** - You get automatic expiry and reminders
- 🐳 **Easiest Setup** - Use Docker (`docker run -d -p 6379:6379 redis:alpine`)
- ⚠️ **Warnings are OK** - App continues to function normally

**Recommendation**: Start without Redis for initial testing, add it later when you need automatic expiry features.

---

**Need Help?**
- Redis Documentation: https://redis.io/docs/
- BullMQ Documentation: https://docs.bullmq.io/
- Docker Redis: https://hub.docker.com/_/redis
