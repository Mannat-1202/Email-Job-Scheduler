import { Campaign, Email, PaginatedResponse, Sender, User } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function fetcher<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  async getCurrentUser(): Promise<User> {
    return fetcher<User>('/api/me');
  },

  async getSenders(): Promise<Sender[]> {
    return fetcher<Sender[]>('/api/senders');
  },

  async provisionSender(email?: string): Promise<Sender> {
    return fetcher<Sender>('/api/senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  async createCampaign(payload: FormData | Record<string, any>): Promise<{
    campaignId: string;
    recipients: number;
    firstScheduledAt: string;
    lastScheduledAt: string;
    status: string;
  }> {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;

    return fetcher('/api/campaigns', {
      method: 'POST',
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  async getScheduledEmails(page = 1, limit = 20): Promise<PaginatedResponse<Email>> {
    return fetcher<PaginatedResponse<Email>>(`/api/emails?status=scheduled&page=${page}&limit=${limit}`);
  },

  async getSentEmails(page = 1, limit = 20): Promise<PaginatedResponse<Email>> {
    return fetcher<PaginatedResponse<Email>>(`/api/emails?status=sent&page=${page}&limit=${limit}`);
  },

  async searchEmails(q: string, status?: string): Promise<{ source: string; data: Email[] }> {
    const queryParams = new URLSearchParams({ q });
    if (status) queryParams.set('status', status);
    return fetcher(`/api/emails/search?${queryParams.toString()}`);
  },

  async connectSlackWebhook(webhookUrl: string): Promise<{ success: boolean; integration: any }> {
    return fetcher('/api/slack/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
  },

  async testSlackWebhook(): Promise<{ success: boolean; message: string }> {
    return fetcher('/api/slack/test', {
      method: 'POST',
    });
  },

  async getSlackStatus(): Promise<{ connected: boolean; details?: { teamId: string; connectedAt: string } }> {
    return fetcher('/api/slack/status');
  },

  async disconnectSlack(): Promise<{ success: boolean }> {
    return fetcher('/api/slack', {
      method: 'DELETE',
    });
  },
};

