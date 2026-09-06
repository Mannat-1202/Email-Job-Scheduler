import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgrespassword@localhost:5432/reachinbox_scheduler?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.string().default('development'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(100),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(50),
  JWT_SECRET: z.string().default('reachinbox-scheduler-super-secret-jwt-key-2026'),
  NEXTAUTH_SECRET: z.string().default('reachinbox-scheduler-super-secret-jwt-key-2026'),
  NEXTAUTH_URL: z.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/oauth/callback'),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),
});

export const config = envSchema.parse(process.env);
