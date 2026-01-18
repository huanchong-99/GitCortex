import { useParams } from 'react-router-dom';
import { useWorkflow } from '@/hooks/useWorkflows';
import { TerminalDebugView } from '@/components/terminal/TerminalDebugView';
import { PipelineView } from '@/components/workflow/PipelineView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import type { Terminal } from '@/components/workflow/TerminalCard';

// Map workflow status to pipeline view status
function mapWorkflowStatus(status: string): 'idle' | 'running' | 'paused' | 'completed' | 'failed' {
  switch (status) {
    case 'draft':
      return 'idle';
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}

export function WorkflowDebugPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data, isLoading, error } = useWorkflow(workflowId!);

  if (isLoading) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  if (error || !data) {
    return <div className="p-8 text-center text-red-500">加载失败</div>;
  }

  const wsUrl = `ws://${window.location.host}`;

  // Transform workflow config to task format
  const tasks: WorkflowTask[] = data.config.tasks.map((taskConfig) => ({
    id: taskConfig.id,
    name: taskConfig.name,
    branch: taskConfig.branch,
    terminals: data.config.terminals
      .filter((termConfig) => termConfig.taskId === taskConfig.id)
      .map(
        (termConfig): Terminal => ({
          id: termConfig.id,
          cliTypeId: termConfig.cliTypeId,
          modelConfigId: termConfig.modelConfigId,
          role: termConfig.role || `Terminal ${termConfig.orderIndex + 1}`,
          orderIndex: termConfig.orderIndex,
          status: 'not_started' as const,
        })
      ),
  }));

  const pipelineStatus = mapWorkflowStatus(data.status);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> 返回
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              状态: {data.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {data.status === 'draft' && (
            <Button size="sm">
              <Play className="w-4 h-4 mr-2" /> 开始
            </Button>
          )}
          {data.status === 'running' && (
            <>
              <Button variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-2" /> 暂停
              </Button>
              <Button variant="destructive" size="sm">
                <Square className="w-4 h-4 mr-2" /> 停止
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="pipeline" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="pipeline">流水线视图</TabsTrigger>
            <TabsTrigger value="terminals">终端调试</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="flex-1 p-4 overflow-auto">
            <PipelineView
              name={data.name}
              status={pipelineStatus}
              tasks={tasks}
              mergeTerminal={{
                cliTypeId: data.config.orchestrator.mergeTerminal.cliTypeId,
                modelConfigId: data.config.orchestrator.mergeTerminal.modelConfigId,
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
