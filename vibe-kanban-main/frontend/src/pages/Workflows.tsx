import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Play, Trash2, Edit } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { useWorkflows, useCreateWorkflow, useStartWorkflow, useDeleteWorkflow } from '@/hooks/useWorkflows';
import { WorkflowWizard } from '@/components/workflow/WorkflowWizard';
import { PipelineView } from '@/components/workflow/PipelineView';
import type { WizardConfig } from '@/components/workflow/types';
import { cn } from '@/lib/utils';

export function Workflows() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows, isLoading, error } = useWorkflows(projectId || '');
  const createMutation = useCreateWorkflow();
  const startMutation = useStartWorkflow();
  const deleteMutation = useDeleteWorkflow();

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
            <p className="text-error">Failed to load workflows: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateWorkflow = async (config: WizardConfig) => {
    if (!projectId) return;

    // Transform WizardConfig to CreateWorkflowRequest
    const request = {
      project_id: projectId,
      name: config.basic.name,
      description: config.basic.description,
      config: {
        tasks: config.tasks.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          branch: t.branch,
          terminalCount: t.terminalCount,
        })),
        models: config.models.map(m => ({
          id: m.id,
          displayName: m.displayName,
          apiType: m.apiType,
          baseUrl: m.baseUrl,
          modelId: m.modelId,
          isVerified: m.isVerified,
        })),
        terminals: config.terminals,
        commands: config.commands,
        orchestrator: config.advanced.orchestrator,
        errorTerminal: config.advanced.errorTerminal,
        mergeTerminal: config.advanced.mergeTerminal,
        targetBranch: config.advanced.targetBranch,
      },
    };

    await createMutation.mutateAsync(request);
    setShowWizard(false);
  };

  const handleStartWorkflow = async (workflowId: string) => {
    await startMutation.mutateAsync({ workflow_id: workflowId });
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      await deleteMutation.mutateAsync(workflowId);
    }
  };

  const selectedWorkflow = workflows?.find(w => w.id === selectedWorkflowId);

  if (selectedWorkflow && selectedWorkflowId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedWorkflowId(null)}>
            ← Back to Workflows
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => handleStartWorkflow(selectedWorkflow.id)}
              disabled={startMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Workflow
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowWizard(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <PipelineView
          workflow={selectedWorkflow}
          tasks={[]} // TODO: Fetch workflow tasks
          onTerminalClick={(terminal) => console.log('Terminal clicked:', terminal)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-low">
            Manage multi-terminal workflows for parallel task execution
          </p>
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

      {!workflows || workflows.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-low mb-4">No workflows yet</p>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Workflow
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
                      workflow.status === 'running' && "bg-blue-100 text-blue-800",
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
                  <span>{workflow.config.tasks.length} tasks</span>
                  <span>{workflow.config.terminals.length} terminals</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
