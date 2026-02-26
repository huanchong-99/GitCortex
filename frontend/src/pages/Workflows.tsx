import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  Rocket,
  GitMerge,
} from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import {
  useWorkflows,
  useCreateWorkflow,
  usePrepareWorkflow,
  useStartWorkflow,
  usePauseWorkflow,
  useStopWorkflow,
  useMergeWorkflow,
  useDeleteWorkflow,
  useWorkflow,
  workflowKeys,
  getWorkflowActions,
  useSubmitWorkflowPromptResponse,
} from '@/hooks/useWorkflows';
import { useProjects } from '@/hooks/useProjects';
import type { WorkflowTaskDto } from 'shared/types';
import { WorkflowWizard } from '@/components/workflow/WorkflowWizard';
import {
  PipelineView,
  type WorkflowStatus,
  type WorkflowTask,
} from '@/components/workflow/PipelineView';
import { WizardConfig, wizardConfigToCreateRequest } from '@/components/workflow/types';
import type { TerminalStatus } from '@/components/workflow/TerminalCard';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui-new/dialogs/ConfirmDialog';
import { CreateProjectDialog } from '@/components/ui-new/dialogs/CreateProjectDialog';
import { useTranslation } from 'react-i18next';
import { projectsApi } from '@/lib/api';
import {
  type TerminalPromptDecisionPayload,
  type TerminalPromptDetectedPayload,
  useWsStore,
  useWorkflowEvents,
} from '@/stores/wsStore';
import {
  ENTER_CONFIRM_RESPONSE_TOKEN,
  WorkflowPromptDialog,
} from '@/components/workflow/WorkflowPromptDialog';
import { useToast } from '@/components/ui/toast';

interface WorkflowPromptQueueItem {
  id: string;
  detected: TerminalPromptDetectedPayload;
  decision: TerminalPromptDecisionPayload | null;
}

const PROMPT_DUPLICATE_WINDOW_MS = 1500;
const PROMPT_HISTORY_TTL_MS = 60_000;

function getPromptContextKey(
  payload:
    | Pick<TerminalPromptDetectedPayload, 'workflowId' | 'terminalId' | 'sessionId'>
    | Pick<TerminalPromptDecisionPayload, 'workflowId' | 'terminalId' | 'sessionId'>
): string {
  return [payload.workflowId, payload.terminalId, payload.sessionId ?? ''].join(':');
}

function getPromptQueueItemId(payload: TerminalPromptDetectedPayload): string {
  const optionsHash = payload.options.join('|');
  return [
    getPromptContextKey(payload),
    payload.promptKind,
    payload.promptText,
    optionsHash,
  ].join('::');
}

function cleanupPromptHistory(history: Map<string, number>, now: number): void {
  for (const [key, timestamp] of history.entries()) {
    if (now - timestamp > PROMPT_HISTORY_TTL_MS) {
      history.delete(key);
    }
  }
}

function isSamePromptContext(
  prompt: TerminalPromptDetectedPayload,
  decision: TerminalPromptDecisionPayload
): boolean {
  if (prompt.workflowId !== decision.workflowId) {
    return false;
  }
  if (prompt.terminalId !== decision.terminalId) {
    return false;
  }
  if (prompt.sessionId && decision.sessionId) {
    return prompt.sessionId === decision.sessionId;
  }
  return true;
}

export function Workflows() {
  const { t } = useTranslation('workflow');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null
  );
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Get projectId from URL query params
  const projectIdFromUrl = searchParams.get('projectId');

  // Load projects list for project selector
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjects();

  // Validate projectId exists in projects list, fallback to first project if invalid
  const validProjectId =
    projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)
      ? projectIdFromUrl
      : projects[0]?.id ?? null;

  // Update URL when projectId is invalid or missing
  useEffect(() => {
    if (projects.length > 0 && projectIdFromUrl !== validProjectId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('projectId', validProjectId);
      setSearchParams(newParams, { replace: true });
      setSelectedWorkflowId(null);
    }
  }, [
    projectIdFromUrl,
    validProjectId,
    projects.length,
    searchParams,
    setSearchParams,
  ]);

  const {
    data: workflows,
    isLoading,
    error,
  } = useWorkflows(validProjectId || '');
  const createMutation = useCreateWorkflow();
  const prepareMutation = usePrepareWorkflow();
  const startMutation = useStartWorkflow();
  const pauseMutation = usePauseWorkflow();
  const stopMutation = useStopWorkflow();
  const mergeMutation = useMergeWorkflow();
  const deleteMutation = useDeleteWorkflow();
  const submitPromptResponseMutation = useSubmitWorkflowPromptResponse();

  const [promptQueue, setPromptQueue] = useState<WorkflowPromptQueueItem[]>([]);
  const [submittingPromptId, setSubmittingPromptId] = useState<string | null>(
    null
  );
  const [promptSubmitError, setPromptSubmitError] = useState<string | null>(
    null
  );

  const promptDetectedHistoryRef = useRef<Map<string, number>>(new Map());
  const promptSubmittedHistoryRef = useRef<Map<string, number>>(new Map());
  const submittingPromptRef = useRef<string | null>(null);
  const pendingPromptDecisionsRef = useRef<
    Map<string, TerminalPromptDecisionPayload>
  >(new Map());
  const sendPromptResponseOverWorkflowWs = useWsStore(
    (state) => state.sendPromptResponse
  );

  useEffect(() => {
    setPromptQueue([]);
    setSubmittingPromptId(null);
    submittingPromptRef.current = null;
    setPromptSubmitError(null);
    promptDetectedHistoryRef.current.clear();
    promptSubmittedHistoryRef.current.clear();
    pendingPromptDecisionsRef.current.clear();
  }, [selectedWorkflowId]);

  const handleTerminalPromptDetected = useCallback(
    (payload: TerminalPromptDetectedPayload) => {
      const now = Date.now();
      cleanupPromptHistory(promptDetectedHistoryRef.current, now);
      cleanupPromptHistory(promptSubmittedHistoryRef.current, now);

      const promptItemId = getPromptQueueItemId(payload);
      const lastDetectedAt = promptDetectedHistoryRef.current.get(promptItemId);
      if (
        lastDetectedAt !== undefined &&
        now - lastDetectedAt < PROMPT_DUPLICATE_WINDOW_MS
      ) {
        return;
      }

      const lastSubmittedAt = promptSubmittedHistoryRef.current.get(promptItemId);
      if (
        lastSubmittedAt !== undefined &&
        now - lastSubmittedAt < PROMPT_HISTORY_TTL_MS
      ) {
        return;
      }

      const pendingDecision = pendingPromptDecisionsRef.current.get(
        getPromptContextKey(payload)
      );
      if (pendingDecision && pendingDecision.decision !== 'ask_user') {
        return;
      }

      promptDetectedHistoryRef.current.set(promptItemId, now);

      setPromptQueue((previousQueue) => {
        if (previousQueue.some((item) => item.id === promptItemId)) {
          return previousQueue;
        }

        return [
          ...previousQueue,
          {
            id: promptItemId,
            detected: payload,
            decision:
              pendingDecision?.decision === 'ask_user'
                ? pendingDecision
                : null,
          },
        ];
      });

      setPromptSubmitError(null);
    },
    []
  );

  const handleTerminalPromptDecision = useCallback(
    (payload: TerminalPromptDecisionPayload) => {
      const contextKey = getPromptContextKey(payload);

      if (payload.decision === 'ask_user') {
        pendingPromptDecisionsRef.current.set(contextKey, payload);
      } else {
        pendingPromptDecisionsRef.current.delete(contextKey);
      }

      setPromptQueue((previousQueue) => {
        if (payload.decision === 'ask_user') {
          return previousQueue.map((item) =>
            isSamePromptContext(item.detected, payload)
              ? { ...item, decision: payload }
              : item
          );
        }

        return previousQueue.filter(
          (item) => !isSamePromptContext(item.detected, payload)
        );
      });

      if (payload.decision !== 'ask_user') {
        setPromptSubmitError(null);
      }
    },
    []
  );

  const handleRealtimeWorkflowSignal = useCallback(() => {
    if (!selectedWorkflowId) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: workflowKeys.byId(selectedWorkflowId),
    });

    if (validProjectId) {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.forProject(validProjectId),
      });
    }
  }, [queryClient, selectedWorkflowId, validProjectId]);

  const workflowEventHandlers = useMemo(
    () => ({
      onTerminalPromptDetected: handleTerminalPromptDetected,
      onTerminalPromptDecision: handleTerminalPromptDecision,
      onWorkflowStatusChanged: handleRealtimeWorkflowSignal,
      onTaskStatusChanged: handleRealtimeWorkflowSignal,
      onTerminalStatusChanged: handleRealtimeWorkflowSignal,
      onTerminalCompleted: handleRealtimeWorkflowSignal,
    }),
    [
      handleTerminalPromptDetected,
      handleTerminalPromptDecision,
      handleRealtimeWorkflowSignal,
    ]
  );

  useWorkflowEvents(selectedWorkflowId, workflowEventHandlers);

  const activePrompt = useMemo(() => promptQueue[0] ?? null, [promptQueue]);

  useEffect(() => {
    if (
      submittingPromptId &&
      !promptQueue.some((item) => item.id === submittingPromptId)
    ) {
      setSubmittingPromptId(null);
      if (submittingPromptRef.current === submittingPromptId) {
        submittingPromptRef.current = null;
      }
    }
  }, [promptQueue, submittingPromptId]);

  // Helper to handle successful prompt submission
  const handlePromptSubmitSuccess = useCallback(
    (promptId: string, promptContextKey: string) => {
      pendingPromptDecisionsRef.current.delete(promptContextKey);
      setPromptQueue((previousQueue) =>
        previousQueue.filter((item) => item.id !== promptId)
      );
    },
    []
  );

  // Helper to handle prompt submission error with WebSocket fallback
  const handlePromptSubmitErrorWithFallback = useCallback(
    (
      currentPrompt: WorkflowPromptQueueItem,
      isEnterConfirmResponse: boolean,
      sendPromptResponseOverWorkflowWs: (payload: any) => boolean
    ): boolean => {
      if (!isEnterConfirmResponse) return false;

      const sent = sendPromptResponseOverWorkflowWs({
        workflowId: currentPrompt.detected.workflowId,
        terminalId: currentPrompt.detected.terminalId,
        response: '',
      });

      if (sent) {
        const promptContextKey = getPromptContextKey(currentPrompt.detected);
        handlePromptSubmitSuccess(currentPrompt.id, promptContextKey);
        return true;
      }

      promptSubmittedHistoryRef.current.delete(currentPrompt.id);
      setPromptSubmitError('Failed to submit prompt response over WebSocket');
      return true;
    },
    [handlePromptSubmitSuccess]
  );

  // Helper to handle general prompt submission error
  const handlePromptSubmitError = useCallback(
    (currentPrompt: WorkflowPromptQueueItem, error: unknown) => {
      promptSubmittedHistoryRef.current.delete(currentPrompt.id);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to submit prompt response';
      setPromptSubmitError(message);
    },
    []
  );

  const handleSubmitPromptResponse = useCallback(
    async (response: string) => {
      const currentPrompt = activePrompt;
      if (!currentPrompt) return;

      const isEnterConfirmResponse =
        response === ENTER_CONFIRM_RESPONSE_TOKEN &&
        currentPrompt.detected.promptKind === 'enter_confirm';

      const requestResponse = isEnterConfirmResponse ? '' : response;

      if (submittingPromptRef.current === currentPrompt.id) return;

      submittingPromptRef.current = currentPrompt.id;
      setSubmittingPromptId(currentPrompt.id);
      setPromptSubmitError(null);

      const now = Date.now();
      cleanupPromptHistory(promptSubmittedHistoryRef.current, now);
      promptSubmittedHistoryRef.current.set(currentPrompt.id, now);

      try {
        const promptContextKey = getPromptContextKey(currentPrompt.detected);

        await submitPromptResponseMutation.mutateAsync({
          workflow_id: currentPrompt.detected.workflowId,
          terminal_id: currentPrompt.detected.terminalId,
          response: requestResponse,
        });

        handlePromptSubmitSuccess(currentPrompt.id, promptContextKey);
      } catch (error) {
        const handled = handlePromptSubmitErrorWithFallback(
          currentPrompt,
          isEnterConfirmResponse,
          sendPromptResponseOverWorkflowWs
        );

        if (!handled) {
          handlePromptSubmitError(currentPrompt, error);
        }
      } finally {
        if (submittingPromptRef.current === currentPrompt.id) {
          submittingPromptRef.current = null;
        }
        setSubmittingPromptId((currentId) =>
          currentId === currentPrompt.id ? null : currentId
        );
      }
    },
    [
      activePrompt,
      sendPromptResponseOverWorkflowWs,
      submitPromptResponseMutation,
      handlePromptSubmitSuccess,
      handlePromptSubmitErrorWithFallback,
      handlePromptSubmitError,
    ]
  );

  const isSubmittingActivePrompt =
    !!activePrompt &&
    (submittingPromptId === activePrompt.id ||
      submitPromptResponseMutation.isPending);

  const activePromptDecision = activePrompt?.decision ?? null;

  const promptDialog = activePrompt ? (
    <WorkflowPromptDialog
      prompt={activePrompt.detected}
      decision={activePromptDecision}
      submitError={promptSubmitError}
      isSubmitting={isSubmittingActivePrompt}
      onSubmit={(response) => handleSubmitPromptResponse(response)}
    />
  ) : null;

  // Fetch workflow detail when selected
  const { data: selectedWorkflowDetail } = useWorkflow(
    selectedWorkflowId || ''
  );

  // Helper to map DTO status to PipelineView status
  const mapWorkflowStatus = (status: string): WorkflowStatus => {
    const statusMap: Record<string, WorkflowStatus> = {
      created: 'idle',
      starting: 'running',
      ready: 'idle',
      running: 'running',
      paused: 'paused',
      merging: 'running',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'idle',
      draft: 'idle',
    };
    return statusMap[status] || 'idle';
  };

  const getWorkflowStatusBadgeClass = (status: string): string => {
    const statusClasses: Record<string, string> = {
      created: 'bg-gray-100 text-gray-800',
      ready: 'bg-gray-100 text-gray-800',
      draft: 'bg-gray-100 text-gray-800',
      starting: 'bg-blue-100 text-blue-800',
      running: 'bg-blue-100 text-blue-800',
      merging: 'bg-blue-100 text-blue-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-zinc-100 text-zinc-800',
    };
    return statusClasses[status] ?? 'bg-gray-100 text-gray-800';
  };

  const mapMergeTerminalStatus = (status: string): TerminalStatus => {
    switch (status) {
      case 'merging':
        return 'working';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'not_started';
    }
  };

  // Helper to map DTO tasks to PipelineView tasks
  const mapWorkflowTasks = (dtoTasks: WorkflowTaskDto[]): WorkflowTask[] => {
    return [...dtoTasks]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((task) => ({
      id: task.id,
      name: task.name,
      branch: task.branch,
      terminals: [...task.terminals]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((terminal) => ({
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

  const handleCreateProject = async () => {
    const result = await CreateProjectDialog.show({});
    if (result.status !== 'saved') {
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    newParams.set('projectId', result.project.id);
    setSearchParams(newParams, { replace: true });
    setSelectedWorkflowId(null);
    showToast(`Project "${result.project.name}" created`, 'success');
  };

  const handleDeleteProject = async () => {
    if (!validProjectId) {
      return;
    }

    if (projects.length <= 1) {
      showToast('Cannot delete the last project', 'error');
      return;
    }

    const deletingProject = projects.find((project) => project.id === validProjectId);
    const result = await ConfirmDialog.show({
      title: 'Delete Project',
      message: `Delete project "${deletingProject?.name ?? validProjectId}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (result !== 'confirmed') {
      return;
    }

    try {
      setIsDeletingProject(true);
      await projectsApi.delete(validProjectId);

      const remainingProjects = projects.filter(
        (project) => project.id !== validProjectId
      );
      const fallbackProjectId = remainingProjects[0]?.id;
      const newParams = new URLSearchParams(searchParams);

      if (fallbackProjectId) {
        newParams.set('projectId', fallbackProjectId);
      } else {
        newParams.delete('projectId');
      }

      setSearchParams(newParams, { replace: true });
      setSelectedWorkflowId(null);
      showToast('Project deleted', 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete project';
      showToast(message, 'error');
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Get current project name for display
  const currentProject = projects.find((p) => p.id === validProjectId);

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
              Please create a project first in Settings → Projects before
              creating workflows.
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
    const workingDir = wizardConfig.project.workingDirectory?.trim();
    const fallbackProjectId = validProjectId;

    try {
      let projectId = fallbackProjectId;

      if (workingDir) {
        try {
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

          projectId = resolveData.data.projectId;
        } catch (resolveError) {
          if (!projectId) {
            throw resolveError;
          }

          console.warn(
            'Failed to resolve project from path, using selected project fallback:',
            resolveError
          );
        }
      }

      if (!projectId) {
        throw new Error('No project selected to create workflow');
      }

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
      throw error instanceof Error
        ? error
        : new Error('Failed to create workflow');
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
      message: t('workflowDebug.confirmStop', {
        defaultValue: 'Are you sure you want to stop this workflow?',
      }),
      confirmText: 'Stop',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (result === 'confirmed') {
      await stopMutation.mutateAsync({ workflow_id: workflowId });
    }
  };

  const handleMergeWorkflow = async (workflowId: string) => {
    await mergeMutation.mutateAsync({
      workflow_id: workflowId,
      merge_strategy: 'squash',
    });
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
    const hasCompletedAllTasks = selectedWorkflowDetail.tasks.every(
      (task) => task.status === 'completed'
    );
    const canTriggerMerge =
      actions.canMerge && hasCompletedAllTasks && !mergeMutation.isPending;

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
                {prepareMutation.isPending
                  ? 'Preparing...'
                  : 'Prepare Workflow'}
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
            {actions.canMerge && (
              <Button
                onClick={() => handleMergeWorkflow(selectedWorkflowDetail.id)}
                disabled={!hasCompletedAllTasks || mergeMutation.isPending}
              >
                <GitMerge className="w-4 h-4 mr-2" />
                {mergeMutation.isPending ? 'Merging...' : 'Merge Workflow'}
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
            status: mapMergeTerminalStatus(selectedWorkflowDetail.status),
          }}
          onTerminalClick={undefined}
          onMergeTerminalClick={
            canTriggerMerge
              ? () => handleMergeWorkflow(selectedWorkflowDetail.id)
              : undefined
          }
        />
        {promptDialog}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-low">
              Manage multi-terminal workflows for parallel task execution
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={validProjectId || ''}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className="w-[220px]">
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
            <Button variant="outline" onClick={() => handleCreateProject()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDeleteProject()}
              disabled={!validProjectId || projects.length <= 1 || isDeletingProject}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeletingProject ? 'Deleting...' : 'Delete Project'}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/workspaces/create')}>
            Create Workspace
          </Button>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {projects.map((project) => (
          <Button
            key={project.id}
            variant={project.id === validProjectId ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleProjectChange(project.id)}
          >
            {project.name}
          </Button>
        ))}
      </div>

      {showWizard && (
        <WorkflowWizard
          onComplete={handleCreateWorkflow}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {!showWizard &&
        (!workflows || workflows.length === 0 ? (
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
                  'cursor-pointer transition-all hover:shadow-lg',
                  'border-2 hover:border-brand'
                )}
                onClick={() => setSelectedWorkflowId(workflow.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-lg">{workflow.name}</h3>
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        getWorkflowStatusBadgeClass(workflow.status)
                      )}
                    >
                      {t(`status.${workflow.status}`, {
                        defaultValue: workflow.status,
                      })}
                    </span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-low mb-4">
                      {workflow.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-low">
                    <span>{workflow.tasksCount} tasks</span>
                    <span>{workflow.terminalsCount} terminals</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      {promptDialog}
    </div>
  );
}
