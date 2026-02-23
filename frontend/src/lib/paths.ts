export const paths = {
  // GitCortex paths
  board: () => '/board',
  wizard: () => '/wizard',
  workflows: () => '/workflows',
  pipeline: (workflowId: string) => `/pipeline/${workflowId}`,
  debug: (workflowId: string) => `/debug/${workflowId}`,

  // Settings paths
  settings: (section?: string) => (section ? `/settings/${section}` : '/settings'),

  // Workspaces paths
  workspaces: (page?: string) => (page ? `/workspaces/${page}` : '/workspaces'),
  workspacesCreate: () => '/workspaces/create',

  // Task paths
  task: (projectId: string, taskId: string) => `/projects/${projectId}/tasks/${taskId}`,

  // Attempt paths
  attempt: (projectId: string, taskId: string, attemptId: string) =>
    `/projects/${projectId}/tasks/${taskId}/attempts/${attemptId}`,
};
