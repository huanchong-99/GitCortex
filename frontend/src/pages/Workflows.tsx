import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Play, Pause, Square, Trash2, Edit } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import {
  useWorkflows,
  useCreateWorkflow,
  useStartWorkflow,
  usePauseWorkflow,
  useStopWorkflow,
  useDeleteWorkflow,
  useWorkflow,
  getWorkflowActions,
} from '@/hooks/useWorkflows';
import type { WorkflowTaskDto } from 'shared/types';
import { WorkflowWizard } from '@/components/workflow/WorkflowWizard';
import { PipelineView, type WorkflowStatus, type WorkflowTask } from '@/components/workflow/PipelineView';
import type { WizardConfig } from '@/components/workflow/types';
import { wizardConfigToCreateRequest } from '@/components/workflow/types';
import type { CreateWorkflowRequest } from '@/hooks/useWorkflows';
import type { TerminalStatus } from '@/components/workflow/TerminalCard';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui-new/dialogs/ConfirmDialog';
import { useTranslation } from 'react-i18next';

export function Workflows() {
  const { t } = useTranslation('workflow');
  const { projectId } = useParams<{ projectId: string }>();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading, error } = useWorkflows(projectId || '');
  const createMutation = useCreateWorkflow();
  const startMutation = useStartWorkflow();
  const pauseMutation = usePauseWorkflow();
  const stopMutation = useStopWorkflow();
  const deleteMutation = useDeleteWorkflow();

  // Fetch workflow detail when selected
  const { data: selectedWorkflowDetail } = useWorkflow(selectedWorkflowId || '');

  // Helper to map DTO status to PipelineView status
  const mapWorkflowStatus = (status: string): WorkflowStatus => {
    const statusMap: Record<string, WorkflowStatus> = {
      'created': 'idle',
      'starting': 'running',
      'ready': 'idle',
      'running': 'running',
      'paused': 'paused',
      'merging': 'running',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'failed',
    };
    return statusMap[status] || 'idle';
  };

  // Helper to map DTO tasks to PipelineView tasks
  const mapWorkflowTasks = (dtoTasks: WorkflowTaskDto[]): WorkflowTask[] => {
    return dtoTasks.map(task => ({
      id: task.id,
      name: task.name,
      branch: task.branch,
      terminals: task.terminals.map(terminal => ({
        id: terminal.id,
        workflowTaskId: task.id,
        cliTypeId: terminal.cliTypeId,
        modelConfigId: terminal.modelConfigId,
        role: terminal.role || undefined,
        orderIndex: terminal.orderIndex,
        status: terminal.status as TerminalStatus,
      })),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader message="Loading workflows..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-error mb-4">{t('errors.loadFailed')}</p>
            <p className="text-sm text-low">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateWorkflow = async (wizardConfig: WizardConfig) => {
    if (!projectId) return;

    try {
      // Transform WizardConfig to CreateWorkflowRequest using the helper function
      const request = wizardConfigToCreateRequest(projectId, wizardConfig);

      await createMutation.mutateAsync(request);
      setShowWizard(false);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      // Error is already handled by the mutation's onError callback
    }
  };

  const handleStartWorkflow = async (workflowId: string) => {
    await startMutation.mutateAsync({ workflow_id: workflowId });
  };

  const handlePauseWorkflow = async (workflowId: string) => {
    await pauseMutation.mutateAsync({ workflow_id: workflowId });
  };

  const handleStopWorkflow = async (workflowId: string) => {
    const result = await ConfirmDialog.show({
      title: 'Stop Workflow',
      message: t('errors.deleteConfirm'),
      confirmText: 'Stop',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (result === 'confirmed') {
      await stopMutation.mutateAsync({ workflow_id: workflowId });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    const result = await ConfirmDialog.show({
      title: 'Delete Workflow',
      message: t('errors.deleteConfirm'),
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (result === 'confirmed') {
      await deleteMutation.mutateAsync(workflowId);
    }
  };

  if (selectedWorkflowDetail && selectedWorkflowId) {
    const actions = getWorkflowActions(selectedWorkflowDetail.status as any);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedWorkflowId(null)}>
            ← Back to Workflows
          </Button>
          <div className="flex gap-2">
            {actions.canStart && (
              <Button
                onClick={() => handleStartWorkflow(selectedWorkflowDetail.id)}
                disabled={startMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Workflow
              </Button>
            )}
            {actions.canPause && (
              <Button
                variant="outline"
                onClick={() => handlePauseWorkflow(selectedWorkflowDetail.id)}
                disabled={pauseMutation.isPending}
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            {actions.canStop && (
              <Button
                variant="destructive"
                onClick={() => handleStopWorkflow(selectedWorkflowDetail.id)}
                disabled={stopMutation.isPending}
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
            {actions.canDelete && (
              <Button
                variant="outline"
                onClick={() => handleDeleteWorkflow(selectedWorkflowDetail.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <PipelineView
          name={selectedWorkflowDetail.name}
          status={mapWorkflowStatus(selectedWorkflowDetail.status)}
          tasks={mapWorkflowTasks(selectedWorkflowDetail.tasks)}
          mergeTerminal={{
            cliTypeId: selectedWorkflowDetail.mergeTerminalCliId,
            modelConfigId: selectedWorkflowDetail.mergeTerminalModelId,
            status: 'not_started' as TerminalStatus,
          }}
          onTerminalClick={undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-low">
            Manage multi-terminal workflows for parallel task execution
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {showWizard && (
        <WorkflowWizard
          onComplete={handleCreateWorkflow}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {!workflows || workflows.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
          <p className="text-low mb-6">{t('empty.description')}</p>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('empty.button')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                "border-2 hover:border-brand"
              )}
              onClick={() => setSelectedWorkflowId(workflow.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">{workflow.name}</h3>
                  <span
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      workflow.status === 'running' && "bg-blue-100 text-blue-800",
                      workflow.status === 'completed' && "bg-green-100 text-green-800",
                      workflow.status === 'failed' && "bg-red-100 text-red-800",
                      workflow.status === 'draft' && "bg-gray-100 text-gray-800"
                    )}
                  >
                    {workflow.status}
                  </span>
                </div>
                {workflow.description && (
                  <p className="text-sm text-low mb-4">{workflow.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-low">
                  <span>{workflow.tasksCount} tasks</span>
                  <span>{workflow.terminalsCount} terminals</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
