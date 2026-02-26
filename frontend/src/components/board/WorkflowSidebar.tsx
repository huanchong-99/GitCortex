import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';
import { WorkflowCard } from './WorkflowCard';
import { Button } from '@/components/ui-new/primitives/Button';

interface WorkflowSidebarProps {
  readonly selectedWorkflowId: string | null;
  readonly onSelectWorkflow: (id: string) => void;
}

export function WorkflowSidebar({
  selectedWorkflowId,
  onSelectWorkflow,
}: WorkflowSidebarProps) {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const activeProjectId = projects[0]?.id ?? '';
  const { data: workflows = [], isLoading } = useWorkflows(activeProjectId);

  return (
    <aside className="w-64 bg-panel border-r border-border p-4 flex flex-col">
      <div className="text-sm font-semibold mb-3">Workflows</div>
      {isLoading ? (
        <div className="text-xs text-low">Loading...</div>
      ) : (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
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
      <div className="mt-4 pt-4 border-t border-border">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => navigate('/wizard')}
        >
          <Plus className="w-4 h-4" />
          新建工作流
        </Button>
      </div>
    </aside>
  );
}
