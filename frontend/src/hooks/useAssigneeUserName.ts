import { useQuery } from '@tanstack/react-query';
import { getSharedTaskAssignees } from '@/lib/remoteApi';
import type { SharedTask, UserData } from 'shared/types';
import { useEffect, useMemo } from 'react';

interface UseAssigneeUserNamesOptions {
  projectId: string | undefined;
  sharedTasks?: SharedTask[];
  enabled?: boolean;
}

export function useAssigneeUserNames(options: UseAssigneeUserNamesOptions) {
  const { projectId, sharedTasks, enabled = true } = options;

  const { data: assignees, refetch } = useQuery<UserData[], Error>({
    queryKey: ['project', 'assignees', projectId],
    queryFn: () => getSharedTaskAssignees(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const assignedUserIds = useMemo(() => {
    if (!sharedTasks) return null;
    return Array.from(
      new Set(sharedTasks.map((task) => task.assignee_user_id))
    );
  }, [sharedTasks]);

  // Refetch when assignee ids change
  useEffect(() => {
    if (!assignedUserIds || !enabled) return;
    refetch();
  }, [assignedUserIds, refetch, enabled]);

  return {
    assignees,
    refetchAssignees: refetch,
  };
}
