import { useCallback, useEffect, useRef, useState } from 'react';
import { KanbanCard } from '@/components/ui/shadcn-io/kanban';
import { Link, Loader2, XCircle } from 'lucide-react';
import type { TaskWithAttemptStatus } from 'shared/types';
import { ActionsDropdown } from '@/components/ui/actions-dropdown';
import { Button } from '@/components/ui/button';
import { useNavigateWithSearch, useAuth } from '@/hooks';
import { paths } from '@/lib/paths';
import { useUserSystem } from '@/components/ConfigProvider';

type Task = TaskWithAttemptStatus;

interface TaskCardProps {
  task: Task;
  index: number;
  status: string;
  onViewDetails: (task: Task) => void;
  isOpen?: boolean;
  projectId: string;
  sharedTask?: SharedTaskRecord;
}

export function TaskCard({
  task,
  index,
  status,
  onViewDetails,
  isOpen,
  projectId,
  sharedTask,
}: Readonly<TaskCardProps>) {
  const { t } = useTranslation('tasks');
  const navigate = useNavigateWithSearch();
  const [isNavigatingToParent, setIsNavigatingToParent] = useState(false);
  const { isSignedIn } = useAuth();
  const { remoteFeaturesEnabled } = useUserSystem();

  const isRemoteShared =
    remoteFeaturesEnabled &&
    (Boolean(sharedTask) || Boolean(task.sharedTaskId));

  const handleClick = useCallback(() => {
    onViewDetails(task);
  }, [task, onViewDetails]);

  const handleParentClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!task.parentWorkspaceId || isNavigatingToParent) return;

      setIsNavigatingToParent(true);
      try {
        const parentAttempt = await attemptsApi.get(task.parentWorkspaceId);
        navigate(
          paths.attempt(projectId, parentAttempt.taskId, task.parentWorkspaceId)
        );
      } catch (error) {
        console.error('Failed to navigate to parent task attempt:', error);
      } finally {
        setIsNavigatingToParent(false);
      }
    },
    [task.parentWorkspaceId, projectId, navigate, isNavigatingToParent]
  );

  const localRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !localRef.current) return;
    const el = localRef.current;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  }, [isOpen]);

  return (
    <KanbanCard
      key={task.id}
      id={task.id}
      name={task.title}
      index={index}
      parent={status}
      onClick={handleClick}
      isOpen={isOpen}
      forwardedRef={localRef}
      dragDisabled={isRemoteShared && !isSignedIn}
      className={
        isRemoteShared
          ? 'relative overflow-hidden pl-5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-card-foreground before:content-[""]'
          : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <TaskCardHeader
          title={task.title}
          avatar={
            sharedTask
              ? {
                  firstName: sharedTask.assignee_first_name ?? undefined,
                  lastName: sharedTask.assignee_last_name ?? undefined,
                  username: sharedTask.assignee_username ?? undefined,
                }
              : undefined
          }
          right={
            <>
              {task.hasInProgressAttempt && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {task.lastAttemptFailed && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {task.parentWorkspaceId && (
                <Button
                  variant="icon"
                  onClick={handleParentClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isNavigatingToParent}
                  title={t('navigateToParent')}
                >
                  <Link className="h-4 w-4" />
                </Button>
              )}
              <ActionsDropdown task={task} sharedTask={sharedTask} />
            </>
          }
        />
        {task.description && (
          <p className="text-sm text-secondary-foreground break-words">
            {task.description.length > 130
              ? `${task.description.substring(0, 130)}...`
              : task.description}
          </p>
        )}
      </div>
    </KanbanCard>
  );
}
