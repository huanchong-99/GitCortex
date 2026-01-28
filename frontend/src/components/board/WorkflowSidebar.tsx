import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { WorkflowCard } from './WorkflowCard';

interface WorkflowSidebarProps {
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
}

export function WorkflowSidebar({
  selectedWorkflowId,
  onSelectWorkflow,
}: WorkflowSidebarProps) {
  const { projects } = useProjects();
  const activeProjectId = projects[0]?.id ?? '';
  const { data: workflows = [], isLoading } = useWorkflows(activeProjectId);

  return (
    <aside className="w-64 bg-panel border-r border-border p-4">
      <div className="text-sm font-semibold mb-3">Workflows</div>
      {isLoading ? (
        <div className="text-xs text-low">Loading...</div>
      ) : (
        <div className="space-y-2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              name={workflow.name}
              status={workflow.status}
              selected={selectedWorkflowId === workflow.id}
              onClick={() => onSelectWorkflow(workflow.id)}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
