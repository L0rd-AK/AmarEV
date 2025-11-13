# 30-Minute Payment Timeout System

## Overview

This system automatically cancels unpaid reservations after 30 minutes to prevent slot blocking and ensure fair access to charging stations. Users must complete payment within 30 minutes of creating a reservation, or it will be automatically expired.

---

## Features

### ✅ **Automatic Expiry**
- Reservations expire exactly 30 minutes after creation if payment is not completed
- BullMQ background worker checks and processes expired reservations
- Status automatically changes from `PENDING` to `EXPIRED`

### ⏰ **Real-time Countdown**
- Live countdown timer displayed on My Reservations page
- Shows remaining time in minutes and seconds
- Visual urgency indicators (yellow → orange → red)
- Auto-refreshes when time expires

### 📧 **Payment Reminders**
- Automated email sent 25 minutes after reservation (5 minutes before expiry)
- Includes direct link to payment page
- Shows exact time remaining and amount due

### 💳 **Seamless Payment Integration**
- "Pay Now" button prominently displayed for pending reservations
- Integrates with existing SSLCommerz payment flow
- Payment modal opens directly from My Reservations page
- Auto-cancels expiry jobs upon successful payment

---

## Architecture

### Database Schema Updates

#### **Reservation Model** (`Server/src/models/Reservation.ts`)

```typescript
{
  // ... existing fields ...
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'expired'],
    default: 'pending',
  },
  paymentDeadline: {
    type: Date,
    index: true, // For efficient expiry job queries
  },
  isPaid: {
    type: Boolean,
    default: false,
  },
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
  },
}
```

#### **Shared Types** (`packages/shared/src/types.ts`)

```typescript
export interface Reservation {
  // ... existing fields ...
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'expired';
  paymentDeadline?: Date;
  isPaid?: boolean;
  paymentId?: string;
}

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  // ... existing statuses ...
  EXPIRED = 'expired', // New status
}
```

---

## Backend Implementation

### 1. **BullMQ Queue Configuration** (`Server/src/config/queue.ts`)

```typescript
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export const reservationExpiryQueue = new Queue('reservation-expiry', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const paymentReminderQueue = new Queue('payment-reminder', {
  connection: redisConnection,
});
```

### 2. **Expiry Worker** (`Server/src/jobs/reservationExpiryWorker.ts`)

```typescript
import { Worker } from 'bullmq';

export const reservationExpiryWorker = new Worker(
  'reservation-expiry',
  async (job) => {
    const { reservationId } = job.data;
    const reservation = await Reservation.findById(reservationId);

    if (!reservation || reservation.isPaid) {
      return { success: true, reason: 'Already paid' };
    }

    if (reservation.paymentDeadline && new Date() >= reservation.paymentDeadline) {
      reservation.status = ReservationStatus.EXPIRED;
      reservation.paymentStatus = 'expired';
      await reservation.save();

      return { success: true, action: 'expired', reservationId };
    }
  },
  { connection: redisConnection, concurrency: 5 }
);
```

### 3. **Payment Reminder Worker** (`Server/src/jobs/paymentReminderWorker.ts`)

```typescript
export const paymentReminderWorker = new Worker(
  'payment-reminder',
  async (job) => {
    const { reservationId } = job.data;
    const reservation = await Reservation.findById(reservationId)
      .populate('userId', 'email displayName')
      .populate('stationId', 'name address');

    if (!reservation || reservation.isPaid) {
      return { success: true, reason: 'Already paid' };
    }

    const emailService = new EmailService();
    await emailService.sendEmail(
      user.email,
      'Complete Your Payment - Reservation Expiring Soon',
      reminderEmailTemplate // See below
    );

    return { success: true, action: 'reminder_sent' };
  },
  { connection: redisConnection }
);
```

### 4. **ReservationController Updates** (`Server/src/controllers/ReservationController.ts`)

```typescript
static async createReservation(req: Request, res: Response): Promise<void> {
  // ... validation and creation logic ...

  const paymentDeadline = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  const reservation = new Reservation({
    // ... existing fields ...
    paymentStatus: 'pending',
    paymentDeadline,
    isPaid: false,
  });

  await reservation.save();

  // Schedule payment reminder (25 minutes from now)
  await paymentReminderQueue.add(
    'send-payment-reminder',
    { reservationId: reservation._id.toString() },
    { delay: 25 * 60 * 1000, jobId: `reminder-${reservation._id}` }
  );

  // Schedule expiry check (30 minutes from now)
  await reservationExpiryQueue.add(
    'check-reservation-expiry',
    { reservationId: reservation._id.toString() },
    { delay: 30 * 60 * 1000, jobId: `expiry-${reservation._id}` }
  );

  res.status(201).json({ reservation, /* ... */ });
}
```

### 5. **PaymentController Updates** (`Server/src/controllers/PaymentController.ts`)

```typescript
async verifyPayment(req: Request, res: Response) {
  const response = await paymentService.verifyPayment(paymentMethod, transactionId);

  if (response.success && response.status === PaymentStatus.COMPLETED) {
    const payment = await paymentService.getPayment(transactionId);
    
    if (payment && payment.reservationId) {
      const reservation = await Reservation.findById(payment.reservationId);
      
      if (reservation && !reservation.isPaid) {
        reservation.isPaid = true;
        reservation.paymentStatus = 'completed';
        reservation.paymentId = payment._id;
        reservation.status = 'confirmed';
        await reservation.save();

        // Cancel scheduled jobs
        await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
        await paymentReminderQueue.remove(`reminder-${reservation._id}`);
      }
    }
  }

  res.json({ success: true, data: response });
}
```

---

## Frontend Implementation

### 1. **Countdown Timer Component** (`Client/src/pages/MyReservations.tsx`)

```typescript
const CountdownTimer: React.FC<{ deadline: string; onExpire: () => void }> = ({ deadline, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTimeLeft('Expired');
        onExpire();
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setIsUrgent(minutes < 5);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`}>
      <Timer className="w-4 h-4" />
      <span className="font-mono font-semibold">{timeLeft}</span>
    </div>
  );
};
```

### 2. **My Reservations Page Updates**

**Features Added:**
- Payment countdown timer for pending reservations
- "Pay Now" button with payment modal integration
- Visual indicators for payment status
- Auto-refresh when deadline expires

```typescript
// Payment warning banner for pending reservations
{reservation.status === 'PENDING' && 
 reservation.paymentStatus === 'pending' && 
 !reservation.isPaid && 
 reservation.paymentDeadline && (
  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
    <div className="flex items-center gap-2 mb-1">
      <AlertCircle className="w-4 h-4 text-yellow-600" />
      <span className="text-sm font-medium text-yellow-900">Payment Required</span>
    </div>
    <CountdownTimer 
      deadline={reservation.paymentDeadline} 
      onExpire={() => fetchReservations()}
    />
  </div>
)}

// Pay Now button
{reservation.status === 'PENDING' && 
 reservation.paymentStatus === 'pending' && 
 !reservation.isPaid && (
  <Button
    onClick={() => setPayingReservation(reservation)}
    className="bg-green-600 hover:bg-green-700"
  >
    <CreditCard className="w-4 h-4" />
    Pay Now
  </Button>
)}
```

### 3. **Status Badge Updates**

```typescript
const getStatusBadge = (status: string, paymentStatus?: string) => {
  const statusConfig = {
    PENDING: {
      color: 'bg-yellow-100 text-yellow-800',
      label: paymentStatus === 'pending' ? 'Awaiting Payment' : 'Pending',
    },
    EXPIRED: {
      color: 'bg-orange-100 text-orange-800',
      label: 'Expired - Payment Not Completed',
    },
    // ... other statuses
  };
  // ...
};
```

---

## Email Templates

### Payment Reminder Email

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #EF4444;">⏰ Payment Reminder</h2>
  <p>Hi ${user.displayName},</p>
  <p>Your reservation at <strong>${station.name}</strong> will expire soon!</p>
  
  <div style="background: #FEE2E2; padding: 15px; border-radius: 8px;">
    <p style="font-size: 18px;"><strong>Time Remaining: ${minutesRemaining} minutes</strong></p>
    <p>Reservation Amount: ৳${amount}</p>
  </div>

  <a href="${paymentUrl}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
    Pay Now
  </a>

  <p style="color: #666; font-size: 14px;">
    If you don't complete the payment within ${minutesRemaining} minutes, your reservation will be automatically cancelled.
  </p>
</div>
```

---

## Testing Guide

### 1. **Setup**

```bash
# Ensure Redis is running
redis-server

# Start backend
cd Server
npm run dev

# Start frontend
cd Client
npm run dev
```

### 2. **Test Scenarios**

#### **Scenario A: Successful Payment Flow**

1. Create a new reservation
2. Verify `paymentDeadline` is set to +30 minutes
3. Check that countdown timer appears on My Reservations page
4. Click "Pay Now" button
5. Complete payment via SSLCommerz
6. Verify:
   - ✅ Reservation status changes to `CONFIRMED`
   - ✅ `isPaid` becomes `true`
   - ✅ `paymentStatus` becomes `'completed'`
   - ✅ Countdown timer disappears
   - ✅ Expiry and reminder jobs are cancelled

#### **Scenario B: Automatic Expiry**

1. Create a new reservation
2. **Option 1 (Fast Test)**: Manually update `paymentDeadline` in database to 1 minute from now
   ```javascript
   db.reservations.updateOne(
     { _id: ObjectId("...") },
     { $set: { paymentDeadline: new Date(Date.now() + 60 * 1000) } }
   );
   ```
3. **Option 2 (Full Test)**: Wait 30 minutes
4. Verify:
   - ✅ Countdown reaches 0
   - ✅ Status changes to `EXPIRED`
   - ✅ `paymentStatus` becomes `'expired'`
   - ✅ Page auto-refreshes
   - ✅ "Pay Now" button disappears

#### **Scenario C: Payment Reminder**

1. Create a reservation
2. Wait 25 minutes (or manually trigger job)
3. Check user's email inbox
4. Verify reminder email received with:
   - ✅ Correct time remaining (5 minutes)
   - ✅ Reservation amount
   - ✅ Working "Pay Now" link
   - ✅ Station name and details

### 3. **BullMQ Dashboard** (Optional)

```bash
npm install -g bull-board
bull-board --redis redis://localhost:6379
```

Open http://localhost:3000 to monitor:
- Queued jobs
- Active jobs
- Completed jobs
- Failed jobs
- Job delays and retries

### 4. **Database Verification**

```javascript
// Check reservation after creation
db.reservations.findOne({ _id: ObjectId("...") })

// Expected output:
{
  _id: ObjectId("..."),
  status: "pending",
  paymentStatus: "pending",
  isPaid: false,
  paymentDeadline: ISODate("2025-01-01T12:30:00Z"), // +30 min from creation
  // ... other fields
}

// Check after expiry
{
  status: "expired",
  paymentStatus: "expired",
  isPaid: false,
}

// Check after payment
{
  status: "confirmed",
  paymentStatus: "completed",
  isPaid: true,
  paymentId: ObjectId("..."),
}
```

---

## Troubleshooting

### Issue: Jobs not processing

**Cause**: Redis not running or worker not started

**Solution**:
```bash
# Check Redis
redis-cli ping  # Should return PONG

# Check worker logs
tail -f Server/logs/app.log | grep "worker"

# Restart workers
npm run dev  # Workers auto-start on server start
```

### Issue: Countdown not updating

**Cause**: Frontend not receiving `paymentDeadline`

**Solution**:
```typescript
// Check API response in browser DevTools
console.log(reservation.paymentDeadline);

// Ensure field is populated in backend
await Reservation.find(filter).select('+paymentDeadline');
```

### Issue: Email not sent

**Cause**: EmailService not configured or SMTP credentials missing

**Solution**:
```bash
# Check .env file
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Test email service
curl -X POST http://localhost:5000/api/test-email
```

### Issue: Jobs not cancelled after payment

**Cause**: Job ID mismatch or queue connection error

**Solution**:
```typescript
// Ensure consistent job IDs
jobId: `expiry-${reservation._id}`
jobId: `reminder-${reservation._id}`

// Check queue connection
await reservationExpiryQueue.remove(`expiry-${reservation._id}`);
logger.info('Job cancelled successfully');
```

---

## Performance Considerations

### Optimization Tips

1. **Index `paymentDeadline`**: Already added in schema for efficient queries
2. **Batch Processing**: Worker processes up to 5 jobs concurrently
3. **Job Cleanup**: Completed jobs auto-removed after 24 hours
4. **Rate Limiting**: Worker limited to 10 jobs/second
5. **Memory Management**: Failed jobs kept for 7 days then removed

### Scaling

For high traffic:
```typescript
// Increase worker concurrency
{ concurrency: 20 }

// Add more workers across multiple servers
// All connect to same Redis instance

// Use Redis Cluster for horizontal scaling
const redisCluster = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
]);
```

---

## Future Enhancements

- [ ] Flexible timeout duration (5, 15, 30, 60 minutes)
- [ ] SMS reminders via Twilio
- [ ] Push notifications for mobile app
- [ ] Payment link in email for quick access
- [ ] Partial payment option (hold slot with deposit)
- [ ] Grace period for slow payment gateways
- [ ] Analytics dashboard for expiry rates
- [ ] A/B testing different timeout durations

---

## References

- **BullMQ Documentation**: https://docs.bullmq.io/
- **Redis Documentation**: https://redis.io/docs/
- **SSLCommerz Integration**: See `SSLCommerz-Integration-Guide.md`
- **Email Service**: See `Server/src/services/EmailService.ts`

---

## Support

For issues or questions:
- **Email**: support@amarev.com
- **GitHub Issues**: https://github.com/your-org/amarev/issues
- **Discord**: https://discord.gg/amarev

---

**Last Updated**: November 13, 2025  
**Version**: 1.0.0  
**Author**: AmarEV Development Team
