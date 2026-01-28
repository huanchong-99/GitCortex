interface WorkflowConfigureStepProps {
  projectId: string;
}

export function WorkflowConfigureStep({ projectId }: WorkflowConfigureStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Configure Workflow</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <div className="px-3 py-2 bg-secondary rounded border text-sm text-low">{projectId}</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Workflow Name</label>
          <input
            type="text"
            placeholder="Enter workflow name"
            className="w-full px-3 py-2 bg-primary rounded border text-sm focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>
    </div>
  );
}
