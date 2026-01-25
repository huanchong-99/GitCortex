import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api';
import { useUserSystem } from '@/components/ConfigProvider';
import type { OrganizationMemberWithProfile } from 'shared/types';

export function useOrganizationMembers(organizationId?: string) {
  const { remoteFeaturesEnabled } = useUserSystem();

  return useQuery<OrganizationMemberWithProfile[]>({
    queryKey: ['organization', 'members', organizationId],
    queryFn: () => {
      if (!organizationId) {
        throw new Error('No organization ID available');
      }
      return organizationsApi.getMembers(organizationId);
    },
    enabled: Boolean(organizationId && remoteFeaturesEnabled),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
