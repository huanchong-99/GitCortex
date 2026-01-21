import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { useUserSystem } from '@/components/ConfigProvider';
import type { RemoteProjectMembersResponse } from 'shared/types';

export function useProjectRemoteMembers(projectId?: string) {
  const { remoteFeaturesEnabled } = useUserSystem();

  return useQuery<RemoteProjectMembersResponse, Error>({
    queryKey: ['project', 'remote-members', projectId],
    queryFn: () => projectsApi.getRemoteMembers(projectId!),
    enabled: Boolean(projectId && remoteFeaturesEnabled),
    staleTime: 5 * 60 * 1000,
  });
}
