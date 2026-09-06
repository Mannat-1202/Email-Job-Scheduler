import { Client } from '@elastic/elasticsearch';
import { config } from '../config/env';
import { db } from '../db/client';

export const esClient = new Client({
  node: config.ELASTICSEARCH_URL,
  maxRetries: 3,
  requestTimeout: 5000,
});

export const EMAILS_INDEX = 'emails';

export async function initSearchIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledTime: { type: 'date' },
            sentTime: { type: 'date' },
            bullJobId: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Search] Created Elasticsearch index '${EMAILS_INDEX}'`);
    }
  } catch (err) {
    console.warn('[Search] Elasticsearch index init failed or ES unavailable, will use Postgres fallback:', (err as Error).message);
  }
}

export async function indexEmail(emailId: string): Promise<void> {
  try {
    const email = await db.email.findUnique({
      where: { id: emailId },
      include: {
        campaign: {
          select: {
            userId: true,
            senderId: true,
          },
        },
      },
    });

    if (!email) return;

    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        campaignId: email.campaignId,
        userId: email.campaign.userId,
        senderId: email.campaign.senderId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledTime: email.scheduledTime.toISOString(),
        sentTime: email.sentTime ? email.sentTime.toISOString() : null,
        bullJobId: email.bullJobId,
        createdAt: email.createdAt.toISOString(),
      },
      refresh: true,
    });
  } catch (err) {
    console.warn(`[Search] Failed to index email ${emailId} into Elasticsearch:`, (err as Error).message);
  }
}

export async function searchEmails(query: string, userId?: string, status?: string) {
  try {
    const mustConditions: any[] = [];

    if (query && query.trim().length > 0) {
      mustConditions.push({
        multi_match: {
          query: query.trim(),
          fields: ['recipientEmail^3', 'subject^2', 'body', 'status'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (userId) {
      mustConditions.push({ term: { userId } });
    }

    if (status) {
      mustConditions.push({ term: { status } });
    }

    const result = await esClient.search({
      index: EMAILS_INDEX,
      query: mustConditions.length > 0 ? { bool: { must: mustConditions } } : { match_all: {} },
      sort: [{ scheduledTime: { order: 'desc' } }],
      size: 50,
    });

    const hits = result.hits.hits.map((hit: any) => hit._source);
    return { source: 'elasticsearch', data: hits };
  } catch (err) {
    console.warn('[Search] Elasticsearch query failed, falling back to PostgreSQL:', (err as Error).message);
    const where: any = {};

    if (userId) {
      where.campaign = { userId };
    }

    if (status) {
      where.status = status;
    }

    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const fallbackResults = await db.email.findMany({
      where,
      orderBy: { scheduledTime: 'desc' },
      take: 50,
      include: {
        campaign: {
          select: { userId: true, senderId: true },
        },
      },
    });

    return {
      source: 'postgres_fallback',
      data: fallbackResults.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        userId: e.campaign.userId,
        senderId: e.campaign.senderId,
        recipientEmail: e.recipientEmail,
        subject: e.subject,
        body: e.body,
        status: e.status,
        scheduledTime: e.scheduledTime.toISOString(),
        sentTime: e.sentTime ? e.sentTime.toISOString() : null,
        bullJobId: e.bullJobId,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

export const search = {
  initSearchIndex,
  indexEmail,
  searchEmails,
};
