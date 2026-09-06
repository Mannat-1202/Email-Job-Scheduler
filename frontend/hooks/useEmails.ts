import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.getCurrentUser(),
    retry: 1,
    staleTime: 30000,
  });
}

export function useSenders() {
  return useQuery({
    queryKey: ['senders'],
    queryFn: () => api.getSenders(),
    staleTime: 30000,
  });
}

export function useScheduledEmails(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['emails', 'scheduled', page, limit],
    queryFn: () => api.getScheduledEmails(page, limit),
    refetchInterval: 5000, // Poll every 5s for live status updates
  });
}

export function useSentEmails(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['emails', 'sent', page, limit],
    queryFn: () => api.getSentEmails(page, limit),
    refetchInterval: 5000, // Poll every 5s for live status updates
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData | Record<string, any>) => api.createCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useProvisionSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email?: string) => api.provisionSender(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectSlack(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}
