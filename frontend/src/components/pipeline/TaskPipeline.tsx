import { useWorkflow } from '@/hooks/useWorkflows';
import { TerminalNode } from './TerminalNode';
import { MergeTerminalNode } from './MergeTerminalNode';

interface TaskPipelineProps {
  workflowId: string;
}

export function TaskPipeline({ workflowId }: TaskPipelineProps) {
  const { data: workflow } = useWorkflow(workflowId);
  const tasks = workflow?.tasks ?? [];

  return (
    <div className="flex-1 p-6 overflow-x-auto">
      <div className="flex gap-8 min-w-max">
        {tasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-3">
            <div className="text-sm font-semibold text-center">{task.name}</div>
            {task.terminals.map((terminal) => (
              <TerminalNode key={terminal.id} terminal={terminal} />
            ))}
          </div>
        ))}
        <MergeTerminalNode workflowId={workflowId} />
      </div>
    </div>
  );
}
