import { useParams } from 'react-router-dom';
import { useWorkflow, useStartWorkflow, usePauseWorkflow, useStopWorkflow } from '@/hooks/useWorkflows';
import { TerminalDebugView } from '@/components/terminal/TerminalDebugView';
import { PipelineView } from '@/components/workflow/PipelineView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import type { Terminal } from '@/components/workflow/TerminalCard';
import { useTranslation } from 'react-i18next';

function mapWorkflowStatus(status: string): 'idle' | 'running' | 'paused' | 'completed' | 'failed' {
  switch (status) {
    case 'created':
    case 'starting':
    case 'ready':
      return 'idle';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}

export function WorkflowDebugPage() {
  const { t } = useTranslation('workflow');
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data, isLoading, error } = useWorkflow(workflowId ?? '');

  // Workflow control hooks
  const startMutation = useStartWorkflow();
  const pauseMutation = usePauseWorkflow();
  const stopMutation = useStopWorkflow();

  const handleStart = () => {
    if (workflowId) {
      startMutation.mutate({ workflow_id: workflowId });
    }
  };

  const handlePause = () => {
    if (workflowId) {
      pauseMutation.mutate({ workflow_id: workflowId });
    }
  };

  const handleStop = () => {
    if (workflowId && confirm(t('workflowDebug.confirmStop'))) {
      stopMutation.mutate({ workflow_id: workflowId });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">{t('workflowDebug.loading')}</div>;
  }

  if (error !== null || !data) {
    return <div className="p-8 text-center text-red-500">{t('workflowDebug.error')}</div>;
  }

  const wsUrl = `ws://${window.location.host}`;
  const defaultRoleLabel = t('terminalCard.defaultRole');

  // Map DTO tasks to internal WorkflowTask format
  // NOTE: terminals are embedded within each task in the DTO (not at root level)
  const tasks: WorkflowTask[] = data.tasks.map((taskDto) => ({
    id: taskDto.id,
    name: taskDto.name,
    branch: taskDto.branch ?? null,
    terminals: taskDto.terminals.map(
      (termDto): Terminal => ({
        id: termDto.id,
        cliTypeId: termDto.cliTypeId,
        modelConfigId: termDto.modelConfigId,
        role: termDto.role?.trim()
          ? termDto.role
          : `${defaultRoleLabel} ${termDto.orderIndex + 1}`,
        orderIndex: termDto.orderIndex,
        status: mapTerminalStatus(termDto.status),
      })
    ),
  }));

  // Map terminal status from DTO to internal format
  function mapTerminalStatus(status: string): Terminal['status'] {
    switch (status) {
      case 'idle':
      case 'not_started':
        return 'not_started';
      case 'starting':
        return 'starting';
      case 'running':
      case 'working':
        return 'working';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'not_started';
    }
  }

  const pipelineStatus = mapWorkflowStatus(data.status);

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> {t('workflowDebug.back')}
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t('workflowDebug.statusLabel', { status: data.status })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {data.status === 'ready' && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={startMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" /> {t('workflowDebug.start')}
            </Button>
          )}
          {data.status === 'running' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={pauseMutation.isPending}
              >
                <Pause className="w-4 h-4 mr-2" /> {t('workflowDebug.pause')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                disabled={stopMutation.isPending}
              >
                <Square className="w-4 h-4 mr-2" /> {t('workflowDebug.stop')}
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="pipeline" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="pipeline">{t('workflowDebug.tabs.pipeline')}</TabsTrigger>
            <TabsTrigger value="terminals">{t('workflowDebug.tabs.terminals')}</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="flex-1 p-4 overflow-auto">
            <PipelineView
              name={data.name}
              status={pipelineStatus}
              tasks={tasks}
              mergeTerminal={{
                cliTypeId: data.mergeTerminalCliId ?? '',
                modelConfigId: data.mergeTerminalModelId ?? '',
                status: 'not_started' as const,
              }}
            />
          </TabsContent>

          <TabsContent value="terminals" className="flex-1 overflow-hidden">
            <TerminalDebugView tasks={tasks} wsUrl={wsUrl} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
