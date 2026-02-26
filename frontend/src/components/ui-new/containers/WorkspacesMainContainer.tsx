import { useRef, useMemo } from 'react';
import type { Workspace, Session } from 'shared/types';
import { createWorkspaceWithSession } from '@/types/attempt';
import { WorkspacesMain } from '@/components/ui-new/views/WorkspacesMain';
import { useTask } from '@/hooks/useTask';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

interface WorkspacesMainContainerProps {
  readonly selectedWorkspace: Workspace | null;
  readonly selectedSession: Session | undefined;
  readonly sessions: Session[];
  readonly onSelectSession: (sessionId: string) => void;
  readonly isLoading: boolean;
  /** Whether user is creating a new session */
  readonly isNewSessionMode?: boolean;
  /** Callback to start new session mode */
  readonly onStartNewSession?: () => void;
}

export function WorkspacesMainContainer({
  selectedWorkspace,
  selectedSession,
  sessions,
  onSelectSession,
  isLoading,
  isNewSessionMode,
  onStartNewSession,
}: Readonly<WorkspacesMainContainerProps>) {
  const { diffStats } = useWorkspaceContext();
  const containerRef = useRef<HTMLElement>(null);

  // Fetch task to get projectId for file search
  const { data: task } = useTask(selectedWorkspace?.taskId, {
    enabled: !!selectedWorkspace?.taskId,
  });

  // Create WorkspaceWithSession for ConversationList
  const workspaceWithSession = useMemo(() => {
    if (!selectedWorkspace) return undefined;
    return createWorkspaceWithSession(selectedWorkspace, selectedSession);
  }, [selectedWorkspace, selectedSession]);

  return (
    <WorkspacesMain
      workspaceWithSession={workspaceWithSession}
      sessions={sessions}
      onSelectSession={onSelectSession}
      isLoading={isLoading}
      containerRef={containerRef}
      projectId={task?.projectId}
      isNewSessionMode={isNewSessionMode}
      onStartNewSession={onStartNewSession}
      diffStats={{
        filesChanged: diffStats.files_changed,
        linesAdded: diffStats.lines_added,
        linesRemoved: diffStats.lines_removed,
      }}
    />
  );
}
