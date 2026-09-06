import { db } from '../db/client';
import { emailQueue } from '../queues/emailQueue';

export async function reconcile(): Promise<{
  scanned: number;
  reEnqueued: number;
  resetFromProcessing: number;
}> {
  console.log('[Reconcile] Starting boot-time PostgreSQL <-> BullMQ reconciliation...');

  const pending = await db.email.findMany({
    where: {
      status: { in: ['SCHEDULED', 'PROCESSING'] },
    },
    include: {
      campaign: {
        select: { senderId: true },
      },
    },
  });

  let reEnqueued = 0;
  let resetFromProcessing = 0;

  for (const email of pending) {
    const jobId = email.bullJobId;
    const existing = await emailQueue.getJob(jobId);

    if (!existing) {
      if (email.status === 'PROCESSING') {
        // Worker died mid-send before job was finished, revert status to SCHEDULED
        await db.email.update({
          where: { id: email.id },
          data: { status: 'SCHEDULED' },
        });
        resetFromProcessing++;
      }

      const now = Date.now();
      const delay = Math.max(0, email.scheduledTime.getTime() - now);

      await emailQueue.add(
        'send-email',
        {
          emailId: email.id,
          senderId: email.campaign.senderId,
          recipient: email.recipientEmail,
          subject: email.subject,
          body: email.body,
        },
        {
          jobId,
          delay,
        }
      );
      reEnqueued++;
    }
  }

  console.log(
    `[Reconcile] Reconciliation complete. Scanned: ${pending.length}, Re-enqueued: ${reEnqueued}, Reset from PROCESSING: ${resetFromProcessing}`
  );

  return {
    scanned: pending.length,
    reEnqueued,
    resetFromProcessing,
  };
}
