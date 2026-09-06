import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/env';

export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const QUEUE_NAME = 'email-send';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
}

export const emailQueue = new Queue<EmailJobData, any, string>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
    },
    removeOnFail: false,
  },
});

export const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});
