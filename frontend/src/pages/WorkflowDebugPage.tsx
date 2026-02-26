import { useParams } from 'react-router-dom';
import { useWorkflow } from '@/hooks/useWorkflows';
import { TerminalDebugView } from '@/components/terminal/TerminalDebugView';
import type { Terminal, TerminalStatus } from '@/components/workflow/TerminalCard';
import type { WorkflowTask } from '@/components/workflow/PipelineView';

/**
 * Maps backend terminal status string to frontend TerminalStatus type
 */
function mapTerminalStatus(status: string): TerminalStatus {
  switch (status) {
    case 'idle':
    case 'not_started':
      return 'not_started';
    case 'starting':
      return 'starting';
    case 'waiting':
      return 'waiting';
    case 'running':
    case 'working':
      return 'working';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      // cancelled maps to not_started to allow restart
      return 'not_started';
    default:
      return 'not_started';
  }
}

export function WorkflowDebugPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '', {
    refetchInterval: 1500,
    staleTime: 0,
  });

  if (isLoading) return <div className="p-6 text-low">Loading...</div>;
  if (!workflow) return <div className="p-6 text-low">Workflow not found</div>;

  // Construct WebSocket URL for PTY connection
  // TerminalEmulator appends `/terminal/${terminalId}` to this base URL
  const wsProtocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${globalThis.location.host}/api`;

  // Map WorkflowTaskDto to WorkflowTask with Terminal type conversion
  const tasks: (WorkflowTask & { terminals: Terminal[] })[] = workflow.tasks.map((taskDto) => ({
    id: taskDto.id,
    name: taskDto.name,
    branch: taskDto.branch,
    terminals: taskDto.terminals.map(
      (termDto): Terminal => ({
        id: termDto.id,
        workflowTaskId: termDto.workflowTaskId,
        cliTypeId: termDto.cliTypeId,
        modelConfigId: termDto.modelConfigId ?? undefined,
        role: termDto.role ?? undefined,
        orderIndex: termDto.orderIndex,
        status: mapTerminalStatus(termDto.status),
      })
    ),
  }));

  return (
    <div className="flex h-screen bg-primary">
      <TerminalDebugView tasks={tasks} wsUrl={wsUrl} />
    </div>
  );
}
