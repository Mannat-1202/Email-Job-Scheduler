export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface Email {
  id: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledTime: string;
  sentTime: string | null;
  error: string | null;
  bullJobId: string;
  createdAt: string;
  campaign?: {
    id: string;
    subject: string;
    sender?: {
      email: string;
    };
  };
}

export interface Sender {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  slackConnected: boolean;
  slackInfo?: {
    teamId: string;
    connectedAt: string;
  } | null;
  senders?: Sender[];
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  totalRecipients: number;
  createdAt: string;
  sender?: {
    email: string;
  };
  _count?: {
    emails: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
