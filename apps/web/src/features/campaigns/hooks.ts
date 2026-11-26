import { useQuery } from '@tanstack/react-query';
import { getCampaign, listCampaigns } from './api';

export const campaignsKey = (workspaceId: string | undefined) =>
  ['campaigns', workspaceId] as const;
export const campaignKey = (id: string | undefined) => ['campaign', id] as const;

export function useCampaigns(workspaceId: string | undefined) {
  return useQuery({
    queryKey: campaignsKey(workspaceId),
    queryFn: () => listCampaigns(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: campaignKey(id),
    queryFn: () => getCampaign(id!),
    enabled: Boolean(id),
  });
}
