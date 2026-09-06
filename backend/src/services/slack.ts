import axios from 'axios';
import { config } from '../config/env';
import { db } from '../db/client';

export function getInstallUrl(userId: string): string {
  if (!config.SLACK_CLIENT_ID) {
    return '#';
  }
  const params = new URLSearchParams({
    client_id: config.SLACK_CLIENT_ID,
    scope: 'incoming-webhook',
    redirect_uri: config.SLACK_REDIRECT_URI,
    state: userId,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleOAuthCallback(code: string, stateUserId: string) {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: config.SLACK_CLIENT_ID,
      client_secret: config.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: config.SLACK_REDIRECT_URI,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error || 'Unknown error'}`);
  }

  const incomingWebhook = data.incoming_webhook;
  if (!incomingWebhook || !incomingWebhook.url) {
    throw new Error('No incoming webhook returned from Slack authorization');
  }

  const integration = await db.slackIntegration.upsert({
    where: { userId: stateUserId },
    create: {
      userId: stateUserId,
      teamId: data.team?.id || 'unknown',
      incomingWebhookUrl: incomingWebhook.url,
      accessToken: data.access_token || '',
    },
    update: {
      teamId: data.team?.id || 'unknown',
      incomingWebhookUrl: incomingWebhook.url,
      accessToken: data.access_token || '',
      connectedAt: new Date(),
    },
  });

  return integration;
}

export async function disconnectSlack(userId: string): Promise<boolean> {
  const deleted = await db.slackIntegration.deleteMany({
    where: { userId },
  });
  return deleted.count > 0;
}

export async function notifyRateLimitHit(senderId: string): Promise<void> {
  try {
    const sender = await db.sender.findUnique({
      where: { id: senderId },
      include: {
        user: {
          include: {
            slack: true,
          },
        },
      },
    });

    if (!sender || !sender.user.slack || !sender.user.slack.incomingWebhookUrl) {
      // Slack not connected for this user, gracefully return
      return;
    }

    const webhookUrl = sender.user.slack.incomingWebhookUrl;
    const now = new Date().toISOString();

    await axios.post(webhookUrl, {
      text: `Rate limit threshold reached for sender ${sender.email}. Jobs rescheduled to next window.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Sender Hourly Rate Limit Alert',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender Account:*\n${sender.email}`,
            },
            {
              type: 'mrkdwn',
              text: `*Timestamp:*\n${now}`,
            },
            {
              type: 'mrkdwn',
              text: '*Status:*\nHourly quota reached',
            },
            {
              type: 'mrkdwn',
              text: '*Action Taken:*\nRescheduled to top of next hour',
            },
          ],
        },
      ],
    });

    console.log(`[Slack] Successfully posted rate limit notification for sender ${sender.email}`);
  } catch (err) {
    // Non-blocking error handling: Slack alert failure must never crash the worker
    console.warn(`[Slack] Failed to post webhook notification: ${(err as Error).message}`);
  }
}

export async function connectWebhook(userId: string, webhookUrl: string) {
  return await db.slackIntegration.upsert({
    where: { userId },
    create: {
      userId,
      teamId: 'manual-webhook',
      incomingWebhookUrl: webhookUrl,
      accessToken: 'manual',
    },
    update: {
      incomingWebhookUrl: webhookUrl,
      connectedAt: new Date(),
    },
  });
}

export async function sendTestNotification(userId: string) {
  const integration = await db.slackIntegration.findUnique({
    where: { userId },
  });
  if (!integration || !integration.incomingWebhookUrl) {
    throw new Error('No Slack webhook configured for this user.');
  }

  const response = await axios.post(integration.incomingWebhookUrl, {
    text: 'ReachInbox Email Scheduler: Slack test notification succeeded.',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'ReachInbox Slack Connection Test',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Slack integration is verified. Sender rate limit breaches will post alerts to this channel.',
        },
      },
    ],
  });
  return response.data;
}

export const slack = {
  getInstallUrl,
  handleOAuthCallback,
  disconnectSlack,
  notifyRateLimitHit,
  connectWebhook,
  sendTestNotification,
};

