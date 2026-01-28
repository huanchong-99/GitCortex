import { useWorkflow } from '@/hooks/useWorkflows';

interface MergeTerminalNodeProps {
  workflowId: string;
}

export function MergeTerminalNode({ workflowId }: MergeTerminalNodeProps) {
  const { data: workflow } = useWorkflow(workflowId);

  if (!workflow) return null;

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="text-sm font-semibold">Merge</div>
      <div className="w-32 h-20 rounded border border-border bg-secondary flex items-center justify-center">
        <div className="text-xs">{workflow.targetBranch}</div>
      </div>
    </div>
  );
}
