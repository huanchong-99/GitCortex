import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowLiveStatus } from '@/hooks/useWorkflowLiveStatus';
import { WorkflowProgressView } from '../views/WorkflowProgressView';

interface WorkflowProgressContainerProps {
  readonly workflowId: string;
  readonly onOpenBoard: () => void;
}

export function WorkflowProgressContainer({
  workflowId,
  onOpenBoard,
}: WorkflowProgressContainerProps) {
  const { t } = useTranslation('tasks');
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);

  const {
    workflowStatus,
    tasks,
    events,
    isLoading,
    connectionStatus,
  } = useWorkflowLiveStatus(workflowId);

  const handleToggleEvents = useCallback(() => {
    setIsEventsExpanded((prev) => !prev);
  }, []);

  return (
    <WorkflowProgressView
      workflowStatus={workflowStatus}
      tasks={tasks}
      events={events}
      isEventsExpanded={isEventsExpanded}
      onToggleEvents={handleToggleEvents}
      onOpenBoard={onOpenBoard}
      connectionStatus={connectionStatus}
      isLoading={isLoading}
      t={t}
    />
  );
}
