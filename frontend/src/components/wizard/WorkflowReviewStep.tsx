export function WorkflowReviewStep() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Review Workflow</h2>
      <div className="bg-secondary rounded p-4 text-sm">
        <p className="text-low mb-2">Review your workflow configuration before execution.</p>
        <div className="space-y-2">
          <div>
            <span className="font-semibold">Name:</span> Workflow Configuration
          </div>
          <div>
            <span className="font-semibold">Tasks:</span> 3 tasks configured
          </div>
        </div>
      </div>
    </div>
  );
}
