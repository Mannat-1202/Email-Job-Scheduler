import { app } from './app';
import { config } from './config/env';
import { startEmailWorker } from './queues/emailWorker';
import { reconcile } from './services/reconcile';
import { initSearchIndex } from './services/search';

async function bootstrap() {
  console.log('[Server] Initializing ReachInbox Email Job Scheduler backend...');
  console.log(`[Config] Environment: ${config.NODE_ENV}`);
  console.log(`[Config] Worker Concurrency: ${config.WORKER_CONCURRENCY}`);
  console.log(`[Config] Minimum Delay: ${config.MIN_DELAY_MS}ms`);
  console.log(`[Config] Max Hourly Emails: ${config.MAX_EMAILS_PER_HOUR_PER_SENDER}/sender`);

  // 1. Initialize search index if Elasticsearch is reachable
  try {
    await initSearchIndex();
  } catch (err: any) {
    console.warn('[Server] Search index initialization notice:', err.message);
  }

  // 2. Execute boot-time reconciliation (re-enqueue missing jobs, reset orphaned processing state)
  try {
    await reconcile();
  } catch (err: any) {
    console.warn('[Server] Boot-time reconciliation notice:', err.message);
  }

  // 3. Start BullMQ worker
  startEmailWorker();

  // 4. Start HTTP listener
  app.listen(config.PORT, () => {
    console.log(`[Server] ReachInbox backend running on http://localhost:${config.PORT}`);
    console.log(`[Server] Bull-Board live dashboard: http://localhost:${config.PORT}/admin/queues`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
