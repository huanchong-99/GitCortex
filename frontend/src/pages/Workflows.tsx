import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Play, Pause, Square, Trash2, Rocket } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import {
  useWorkflows,
  useCreateWorkflow,
  usePrepareWorkflow,
  useStartWorkflow,
  usePauseWorkflow,
  useStopWorkflow,
  useDeleteWorkflow,
  useWorkflow,
  getWorkflowActions,
} from '@/hooks/useWorkflows';
import { useProjects } from '@/hooks/useProjects';
import type { WorkflowTaskDto } from 'shared/types';
import { WorkflowWizard } from '@/components/workflow/WorkflowWizard';
import { PipelineView, type WorkflowStatus, type WorkflowTask } from '@/components/workflow/PipelineView';
import { WizardConfig } from '@/components/workflow/types';
import { wizardConfigToCreateRequest } from '@/components/workflow/types';
import type { TerminalStatus } from '@/components/workflow/TerminalCard';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui-new/dialogs/ConfirmDialog';
import { useTranslation } from 'react-i18next';

export function Workflows() {
  const { t } = useTranslation('workflow');
  const [searchParams, setSearchParams] = useSearchParams();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  // Get projectId from URL query params
  const projectIdFromUrl = searchParams.get('projectId');

  // Load projects list for project selector
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  // Validate projectId exists in projects list, fallback to first project if invalid
  const validProjectId = projectIdFromUrl && projects.some(p => p.id === projectIdFromUrl)
    ? projectIdFromUrl
    : (projects.length > 0 ? projects[0].id : null);

  // Update URL when projectId is invalid or missing
  useEffect(() => {
    if (projects.length > 0 && projectIdFromUrl !== validProjectId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('projectId', validProjectId!);
      setSearchParams(newParams, { replace: true });
    }
  }, [projectIdFromUrl, validProjectId, projects.length, searchParams, setSearchParams]);

  const { data: workflows, isLoading, error } = useWorkflows(validProjectId || '');
  const createMutation = useCreateWorkflow();
  const prepareMutation = usePrepareWorkflow();
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

  // Handle project change (preserve other URL params)
  const handleProjectChange = (newProjectId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('projectId', newProjectId);
    setSearchParams(newParams, { replace: true });
    setSelectedWorkflowId(null); // Clear selected workflow when switching projects
  };

  // Get current project name for display
  const currentProject = projects.find(p => p.id === validProjectId);

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader message="Loading projects..." />
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-error mb-4">{t('errors.loadFailed')}</p>
            <p className="text-sm text-low">{projectsError.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-sm text-low">
              Please create a project first in Settings → Projects before creating workflows.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    // Use working directory from wizard config
    const workingDir = wizardConfig.project.workingDirectory;
    if (!workingDir) return;

    try {
      // First, resolve the project ID from the working directory path
      const resolveResponse = await fetch('/api/projects/resolve-by-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: workingDir }),
      });

      if (!resolveResponse.ok) {
        throw new Error('Failed to resolve project from path');
      }

      const resolveData = await resolveResponse.json();
      if (!resolveData.success || !resolveData.data?.projectId) {
        throw new Error(resolveData.message || 'Failed to resolve project');
      }

      const projectId = resolveData.data.projectId;

      // Transform WizardConfig to CreateWorkflowRequest using the resolved project ID
      const request = wizardConfigToCreateRequest(projectId, wizardConfig);

      const newWorkflow = await createMutation.mutateAsync(request);

      // Update URL with the project ID so the workflow list can be refreshed (preserve other params)
      const newParams = new URLSearchParams(searchParams);
      newParams.set('projectId', projectId);
      setSearchParams(newParams, { replace: true });

      // Select the newly created workflow to show its details
      setSelectedWorkflowId(newWorkflow.id);

      setShowWizard(false);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      // Error is already handled by the mutation's onError callback
    }
  };

  const handlePrepareWorkflow = async (workflowId: string) => {
    await prepareMutation.mutateAsync(workflowId);
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
      <div className="h-full min-h-0 overflow-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedWorkflowId(null)}>
            ← Back to Workflows
          </Button>
          <div className="flex gap-2">
            {actions.canPrepare && (
              <Button
                onClick={() => handlePrepareWorkflow(selectedWorkflowDetail.id)}
                disabled={prepareMutation.isPending}
              >
                <Rocket className="w-4 h-4 mr-2" />
                {prepareMutation.isPending ? 'Preparing...' : 'Prepare Workflow'}
              </Button>
            )}
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
            cliTypeId: selectedWorkflowDetail.mergeTerminalCliId ?? '',
            modelConfigId: selectedWorkflowDetail.mergeTerminalModelId ?? '',
            status: 'not_started' as TerminalStatus,
          }}
          onTerminalClick={undefined}
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-low">
              Manage multi-terminal workflows for parallel task execution
            </p>
          </div>
          {projects.length > 1 && (
            <Select value={validProjectId || ''} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select project">
                  {currentProject?.name || 'Select project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      {!showWizard && (
        !workflows || workflows.length === 0 ? (
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
                      (workflow.status === 'running' ||
                        workflow.status === 'merging') &&
                        "bg-blue-100 text-blue-800",
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
        )
      )}
    </div>
  );
}
