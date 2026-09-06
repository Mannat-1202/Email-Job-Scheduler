import { Router } from 'express';
import { config } from '../config/env';
import { db } from '../db/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { slack } from '../services/slack';

const router = Router();

router.get('/install', authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!config.SLACK_CLIENT_ID) {
    if (req.headers.accept?.includes('application/json')) {
      res.status(400).json({
        error: 'SLACK_CLIENT_ID is not configured in .env. Use direct Webhook URL or set SLACK_CLIENT_ID.',
      });
      return;
    }
    res.redirect(`${config.NEXTAUTH_URL}/dashboard?slack_error=missing_slack_credentials`);
    return;
  }

  const installUrl = slack.getInstallUrl(userId);
  if (req.headers.accept?.includes('application/json')) {
    res.json({ installUrl });
  } else {
    res.redirect(installUrl);
  }
});

router.post('/webhook', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      res.status(400).json({ error: 'A valid HTTP or HTTPS Webhook URL is required' });
      return;
    }

    const integration = await slack.connectWebhook(req.user!.id, webhookUrl.trim());
    res.json({ success: true, integration });
  } catch (err) {
    next(err);
  }
});

router.post('/test', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    await slack.sendTestNotification(req.user!.id);
    res.json({ success: true, message: 'Test alert delivered to Slack webhook successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to dispatch Slack test message' });
  }
});


router.get('/oauth/callback', async (req, res, next) => {
  try {
    const code = req.query.code as string;
    const stateUserId = req.query.state as string;

    if (!code || !stateUserId) {
      res.redirect(`${config.NEXTAUTH_URL}/dashboard?slack_error=missing_code_or_state`);
      return;
    }

    await slack.handleOAuthCallback(code, stateUserId);
    res.redirect(`${config.NEXTAUTH_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error('[Slack Callback Error]', err.message);
    res.redirect(`${config.NEXTAUTH_URL}/dashboard?slack_error=${encodeURIComponent(err.message)}`);
  }
});

router.delete('/', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    await slack.disconnectSlack(userId);
    res.json({ success: true, message: 'Slack integration removed' });
  } catch (err) {
    next(err);
  }
});

router.get('/status', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const integration = await db.slackIntegration.findUnique({
      where: { userId: req.user!.id },
      select: {
        teamId: true,
        connectedAt: true,
      },
    });

    res.json({
      connected: !!integration,
      details: integration,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
