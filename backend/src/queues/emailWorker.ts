import { DelayedError, Worker } from 'bullmq';
import { config } from '../config/env';
import { db } from '../db/client';
import { mailer } from '../services/mailer';
import { rateLimiter } from '../services/rateLimiter';
import { search } from '../services/search';
import { slack } from '../services/slack';
import { EmailJobData, QUEUE_NAME, redisConnection } from './emailQueue';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job) => {
      const { emailId, senderId, recipient, subject, body } = job.data;

      // 1. Idempotent claim
      const claimed = await db.email.updateMany({
        where: { id: emailId, status: 'SCHEDULED' },
        data: { status: 'PROCESSING' },
      });

      if (claimed.count === 0) {
        // Already processed or claimed by another worker instance
        return;
      }

      // 2. Per-sender hourly rate check (Redis)
      const allowed = await rateLimiter.tryConsume(senderId);
      if (!allowed) {
        // Revert status to SCHEDULED before delaying
        await db.email.update({
          where: { id: emailId },
          data: { status: 'SCHEDULED' },
        });

        const nextDelayMs = rateLimiter.getNextWindowDelayMs();
        const nextTimestamp = Date.now() + nextDelayMs;

        console.log(
          `[Worker] Hourly limit exceeded for sender ${senderId}. Moving job ${job.id} to delayed (in ${Math.round(
            nextDelayMs / 1000
          )}s).`
        );

        if (job.token) {
          await job.moveToDelayed(nextTimestamp, job.token);
        }

        // Notify Slack asynchronously (no-op if not configured)
        await slack.notifyRateLimitHit(senderId);

        // Throw DelayedError to notify BullMQ worker that job was deferred
        throw new DelayedError();
      }

      // 3. Send email
      try {
        const result = await mailer.sendEmail(senderId, {
          to: recipient,
          subject,
          body,
        });

        await db.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentTime: new Date(),
            error: result.previewUrl ? `Preview: ${result.previewUrl}` : null,
          },
        });

        await search.indexEmail(emailId);
      } catch (err: any) {
        const errorMsg = String(err?.message || err);
        console.error(`[Worker] Error sending email ${emailId}:`, errorMsg);

        await db.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            error: errorMsg,
          },
        });

        await search.indexEmail(emailId);
        throw err; // Allow BullMQ retry / exponential backoff
      }
    },
    {
      connection: redisConnection,
      concurrency: config.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: config.MIN_DELAY_MS,
      },
    }
  );

  worker.on('ready', () => {
    console.log(`[Worker] Email worker ready with concurrency=${config.WORKER_CONCURRENCY}, minDelay=${config.MIN_DELAY_MS}ms`);
  });

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError) {
      // Intentionally delayed due to rate limiting, not a failure
      return;
    }
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export let emailWorker: Worker<EmailJobData> | null = null;

export function startEmailWorker() {
  if (!emailWorker) {
    emailWorker = createEmailWorker();
  }
  return emailWorker;
}
