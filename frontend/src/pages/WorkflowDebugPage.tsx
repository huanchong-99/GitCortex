import { useParams } from 'react-router-dom';
import { useWorkflow } from '@/hooks/useWorkflows';
import { useWorkflowInvalidation } from '@/hooks/useWorkflowInvalidation';
import { TerminalDebugView } from '@/components/terminal/TerminalDebugView';
import type { Terminal } from '@/components/workflow/TerminalCard';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import { mapTerminalStatus } from '@/utils/terminalStatus';

export function WorkflowDebugPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  // G28-003: Use WebSocket events instead of 1.5s polling for real-time updates
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '');

  useWorkflowInvalidation(workflowId);

  const workflowTasks = workflow?.tasks ?? [];

  if (isLoading) return <div className="p-6 text-low">Loading...</div>;
  if (!workflow) return <div className="p-6 text-low">Workflow not found</div>;

  // Construct WebSocket URL for PTY connection
  // TerminalEmulator appends `/terminal/${terminalId}` to this base URL
  const wsProtocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${globalThis.location.host}/api`;

  // Map WorkflowTaskDto to WorkflowTask with Terminal type conversion
  const tasks: (WorkflowTask & { terminals: Terminal[] })[] = workflowTasks.map(
    (taskDto) => ({
      id: taskDto.id,
      name: taskDto.name,
      branch: taskDto.branch,
      terminals: (taskDto.terminals ?? []).map(
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
    })
  );

  return (
    <div className="flex h-screen bg-primary">
      <TerminalDebugView tasks={tasks} wsUrl={wsUrl} />
    </div>
  );
}
