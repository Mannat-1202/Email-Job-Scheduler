'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, MessageSquare, Send, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useCurrentUser } from '../hooks/useEmails';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

export interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  const [webhookUrl, setWebhookUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const connectWebhookMutation = useMutation({
    mutationFn: (url: string) => api.connectSlackWebhook(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSuccessMsg('Slack webhook connected successfully.');
      setErrorMsg(null);
      setWebhookUrl('');
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to connect webhook.');
      setSuccessMsg(null);
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: () => api.testSlackWebhook(),
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'Test notification sent to Slack successfully.');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to dispatch test notification.');
      setSuccessMsg(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectSlack(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setSuccessMsg('Slack integration removed.');
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Failed to disconnect Slack.');
      setSuccessMsg(null);
    },
  });

  const handleOAuthConnect = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.location.href = `${apiUrl}/api/slack/install`;
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      setErrorMsg('Please provide a valid HTTP or HTTPS webhook URL.');
      return;
    }
    connectWebhookMutation.mutate(webhookUrl.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Slack Workspace Integration"
      description="Receive real-time notifications whenever a sender reaches their hourly rate limit"
      maxWidth="md"
    >
      <div className="space-y-5">
        {errorMsg && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {user?.slackConnected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-300">
                  Slack Integration Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hourly quota breaches for any sender under this account will trigger live alert cards in your Slack channel.
              </p>
              {user.slackInfo?.connectedAt && (
                <p className="text-[11px] text-slate-500">
                  Connected on {new Date(user.slackInfo.connectedAt).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => testWebhookMutation.mutate()}
                isLoading={testWebhookMutation.isPending}
              >
                <Send className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                <span>Send Test Notification</span>
              </Button>

              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                isLoading={disconnectMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Disconnect</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Method 1: Incoming Webhook */}
            <form onSubmit={handleSaveWebhook} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Method 1: Connect via Webhook URL (Recommended for Testing)
                </label>
                <p className="text-[11px] text-slate-400">
                  Paste a Slack Incoming Webhook URL (e.g. from Slack App &gt; Incoming Webhooks, or a test receiver like webhook.site)
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  isLoading={connectWebhookMutation.isPending}
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                  <span>Connect Webhook URL</span>
                </Button>
              </div>
            </form>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-slate-500 font-medium">Or</span>
              </div>
            </div>

            {/* Method 2: OAuth Flow */}
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200">
                  Method 2: Connect via Slack OAuth v2
                </label>
                <p className="text-[11px] text-slate-400">
                  Requires SLACK_CLIENT_ID and SLACK_CLIENT_SECRET configured in .env
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleOAuthConnect}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-[#E01E5A]" />
                <span>Authorize via Slack OAuth</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
