import cors from 'cors';
import express from 'express';
import { setupBullBoard } from './admin/bullBoard';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import campaignsRoutes from './routes/campaigns.routes';
import emailsRoutes from './routes/emails.routes';
import sendersRoutes from './routes/senders.routes';
import slackRoutes from './routes/slack.routes';

export const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.NEXTAUTH_URL
      ? [process.env.NEXTAUTH_URL, 'http://localhost:3000', 'http://localhost:3001']
      : true,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Bull-Board UI mount
app.use('/admin/queues', setupBullBoard());

// API Routes
app.use('/api', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/senders', sendersRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/slack', slackRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);
