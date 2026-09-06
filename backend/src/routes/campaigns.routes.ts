import csvParser from 'csv-parser';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { Readable } from 'stream';
import { config } from '../config/env';
import { db } from '../db/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { emailQueue } from '../queues/emailQueue';
import { mailer } from '../services/mailer';
import { search } from '../services/search';

const router = Router();

router.use(authMiddleware);

function parseCsvBuffer(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const results: string[] = [];
    const stream = Readable.from(buffer.toString('utf-8'));

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        // Look for common email headers or first column
        const email =
          row.email ||
          row.Email ||
          row.EMAIL ||
          row.recipient ||
          row.Recipient ||
          Object.values(row)[0];
        if (email && typeof email === 'string' && email.includes('@')) {
          results.push(email.trim().toLowerCase());
        }
      })
      .on('end', () => {
        if (results.length === 0) {
          // If no rows parsed via headers, fallback to line-by-line regex parsing
          const lines = buffer.toString('utf-8').split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim().replace(/^["']|["']$/g, '');
            if (trimmed.includes('@') && !trimmed.toLowerCase().includes('email')) {
              results.push(trimmed.toLowerCase());
            }
          }
        }
        resolve(results);
      })
      .on('error', reject);
  });
}

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const campaigns = await db.campaign.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { email: true },
        },
        _count: {
          select: { emails: true },
        },
      },
    });
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('csv'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const {
      subject,
      body,
      senderId: reqSenderId,
      startTime,
      delayMs,
      hourlyLimit,
    } = req.body;

    if (!subject || !body) {
      res.status(400).json({ error: 'Subject and body are required' });
      return;
    }

    let recipientList: string[] = [];

    if (req.file) {
      recipientList = await parseCsvBuffer(req.file.buffer);
    } else if (req.body.recipients) {
      if (Array.isArray(req.body.recipients)) {
        recipientList = req.body.recipients;
      } else if (typeof req.body.recipients === 'string') {
        try {
          recipientList = JSON.parse(req.body.recipients);
        } catch {
          recipientList = req.body.recipients
            .split(/[\n,]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.includes('@'));
        }
      }
    }

    // Clean, deduplicate and validate
    const uniqueRecipients = Array.from(
      new Set(recipientList.map((r) => r.trim().toLowerCase()).filter((r) => r.includes('@')))
    );

    if (uniqueRecipients.length === 0) {
      res.status(400).json({ error: 'No valid recipient email addresses provided' });
      return;
    }

    // Resolve or create sender
    let senderId = reqSenderId;
    if (!senderId) {
      let existingSender = await db.sender.findFirst({
        where: { userId: req.user!.id },
      });
      if (!existingSender) {
        existingSender = await mailer.provisionSender(req.user!.id);
      }
      senderId = existingSender.id;
    }

    const calculatedDelayMs = Math.max(
      config.MIN_DELAY_MS,
      Number(delayMs) || config.MIN_DELAY_MS
    );
    const calculatedHourlyLimit =
      Number(hourlyLimit) || config.MAX_EMAILS_PER_HOUR_PER_SENDER;

    const baseStart = startTime ? new Date(startTime).getTime() : Date.now();
    const safeStart = Math.max(Date.now(), baseStart);

    // Create campaign record
    const campaign = await db.campaign.create({
      data: {
        userId: req.user!.id,
        senderId,
        subject,
        body,
        startTime: new Date(safeStart),
        delayMs: calculatedDelayMs,
        hourlyLimit: calculatedHourlyLimit,
        totalRecipients: uniqueRecipients.length,
      },
    });

    // Prepare email rows
    const emailRows = uniqueRecipients.map((recipientEmail, index) => {
      const emailId = randomUUID();
      const scheduledTime = new Date(safeStart + index * calculatedDelayMs);
      return {
        id: emailId,
        campaignId: campaign.id,
        recipientEmail,
        subject,
        body,
        status: 'SCHEDULED' as const,
        scheduledTime,
        bullJobId: `email-${emailId}`,
      };
    });

    // Bulk insert into Postgres
    await db.email.createMany({
      data: emailRows,
    });

    // Prepare BullMQ bulk job items
    const jobs = emailRows.map((e) => ({
      name: 'send-email',
      data: {
        emailId: e.id,
        senderId,
        recipient: e.recipientEmail,
        subject: e.subject,
        body: e.body,
      },
      opts: {
        jobId: e.bullJobId,
        delay: Math.max(0, e.scheduledTime.getTime() - Date.now()),
      },
    }));

    // Enqueue jobs in BullMQ in one round trip
    await emailQueue.addBulk(jobs);

    // Mirror to Elasticsearch index asynchronously
    Promise.allSettled(emailRows.map((e) => search.indexEmail(e.id))).catch((err) =>
      console.warn('[Search] Background indexing notice:', (err as Error).message)
    );

    res.status(201).json({
      campaignId: campaign.id,
      recipients: emailRows.length,
      firstScheduledAt: emailRows[0].scheduledTime.toISOString(),
      lastScheduledAt: emailRows[emailRows.length - 1].scheduledTime.toISOString(),
      status: 'queued',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
