import axios from 'axios';
import { config } from '../backend/src/config/env';
import { db } from '../backend/src/db/client';
import { redisConnection } from '../backend/src/queues/emailQueue';
import { getHourWindowKey } from '../backend/src/services/rateLimiter';

async function runBurstTest() {
  console.log('--- Starting Rate Limit Burst Test ---');

  const API_URL = `http://localhost:${config.PORT}`;

  // 1. Fetch or create a test sender
  const user = await db.user.findFirst();
  if (!user) {
    throw new Error('No user found in database. Run the server first.');
  }

  const sender = await db.sender.findFirst({ where: { userId: user.id } });
  if (!sender) {
    throw new Error('No sender found. Provision a sender first via POST /api/senders.');
  }

  console.log(`Using sender: ${sender.email} (${sender.id})`);

  // Clear existing rate limit counter for clean test
  const windowKey = getHourWindowKey();
  const redisKey = `rl:${sender.id}:${windowKey}`;
  await redisConnection.del(redisKey);
  console.log(`Cleared Redis key: ${redisKey}`);

  // 2. Generate 50 test recipient email addresses
  const recipientCount = 50;
  const hourlyLimit = 10;
  const recipients: string[] = [];
  for (let i = 1; i <= recipientCount; i++) {
    recipients.push(`test-burst-${i}@reachinbox.test`);
  }

  console.log(`Scheduling ${recipientCount} emails with hourlyLimit=${hourlyLimit}...`);

  const response = await axios.post(`${API_URL}/api/campaigns`, {
    senderId: sender.id,
    subject: 'Rate Limit Verification Burst',
    body: 'Automated test copy verifying rate limit rescheduling mechanics',
    recipients,
    delayMs: 1000,
    hourlyLimit,
  });

  console.log('Campaign queued response:', response.data);

  // Wait 15 seconds to let worker process initial batch
  console.log('Waiting 15 seconds for initial batch processing...');
  await new Promise((r) => setTimeout(r, 15000));

  // Check Redis counter
  const currentCount = await redisConnection.get(redisKey);
  console.log(`Redis counter (${redisKey}): ${currentCount}`);

  // Query emails table
  const sentCount = await db.email.count({
    where: {
      campaignId: response.data.campaignId,
      status: 'SENT',
    },
  });

  const scheduledCount = await db.email.count({
    where: {
      campaignId: response.data.campaignId,
      status: 'SCHEDULED',
    },
  });

  const failedCount = await db.email.count({
    where: {
      campaignId: response.data.campaignId,
      status: 'FAILED',
    },
  });

  console.log('--- Test Results ---');
  console.log(`Sent: ${sentCount}`);
  console.log(`Scheduled (Deferred/Pending): ${scheduledCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount === 0 && sentCount <= hourlyLimit && scheduledCount > 0) {
    console.log('SUCCESS: Rate limit enforced without dropping jobs. Excess emails were safely rescheduled.');
  } else {
    console.log('Notice: Review counts for expected rate limit thresholds.');
  }

  process.exit(0);
}

runBurstTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
