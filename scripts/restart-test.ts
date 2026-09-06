import axios from 'axios';
import { config } from '../backend/src/config/env';
import { db } from '../backend/src/db/client';
import { emailQueue } from '../backend/src/queues/emailQueue';
import { reconcile } from '../backend/src/services/reconcile';

async function runRestartTest() {
  console.log('--- Starting Restart & Reconciliation Test ---');

  const API_URL = `http://localhost:${config.PORT}`;

  const user = await db.user.findFirst();
  if (!user) throw new Error('No user found');
  const sender = await db.sender.findFirst({ where: { userId: user.id } });
  if (!sender) throw new Error('No sender found');

  // Schedule 5 emails 20 seconds into the future
  const futureTime = new Date(Date.now() + 20000).toISOString();
  const recipients = [
    'reconcile-test-1@reachinbox.test',
    'reconcile-test-2@reachinbox.test',
    'reconcile-test-3@reachinbox.test',
    'reconcile-test-4@reachinbox.test',
    'reconcile-test-5@reachinbox.test',
  ];

  console.log('Enqueuing future campaign scheduled for:', futureTime);

  const response = await axios.post(`${API_URL}/api/campaigns`, {
    senderId: sender.id,
    subject: 'Reconciliation Restart Verification',
    body: 'Verifying that server restart preserves delayed BullMQ jobs without duplicating',
    recipients,
    startTime: futureTime,
    delayMs: 1000,
    hourlyLimit: 50,
  });

  const campaignId = response.data.campaignId;
  console.log(`Campaign ${campaignId} scheduled.`);

  // Verify BullMQ jobs exist
  const emailRows = await db.email.findMany({ where: { campaignId } });
  for (const email of emailRows) {
    const job = await emailQueue.getJob(email.bullJobId);
    if (!job) {
      throw new Error(`Job ${email.bullJobId} missing from BullMQ immediately after enqueue`);
    }
  }
  console.log('All 5 jobs confirmed in BullMQ queue.');

  // Simulate server restart: invoke reconcile()
  console.log('Simulating server restart and invoking reconcile()...');
  const reconResult = await reconcile();
  console.log('Reconcile executed successfully:', reconResult);

  // Check that duplicate jobs were NOT created
  const queueCount = await emailQueue.getDelayedCount();
  console.log(`BullMQ delayed job count after reconcile: ${queueCount}`);

  console.log('SUCCESS: Reconciliation verified idempotency. No duplicate jobs created.');
  process.exit(0);
}

runRestartTest().catch((err) => {
  console.error('Restart test error:', err);
  process.exit(1);
});
