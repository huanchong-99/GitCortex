$base = 'http://localhost:64206'
$projectId = '0f24059f-72d1-4a1e-b09f-d6425f09e791'

# Create workflow with valid CLI and model IDs
$workflowPayload = @{
  projectId = $projectId
  name = 'Test Workflow'
  description = 'Test workflow for UI'
  useSlashCommands = $false
  orchestratorConfig = $null
  errorTerminalConfig = $null
  mergeTerminalConfig = @{
    cliTypeId = 'cli-claude-code'
    modelConfigId = 'model-claude-sonnet'
    customBaseUrl = $null
    customApiKey = $null
  }
  targetBranch = 'main'
  tasks = @(
    @{
      name = 'Task 1'
      description = 'Test task'
      branch = $null
      orderIndex = 0
      terminals = @(
        @{
          cliTypeId = 'cli-claude-code'
          modelConfigId = 'model-claude-sonnet'
          customBaseUrl = $null
          customApiKey = $null
          role = 'Planner'
          roleDescription = 'Test terminal'
          orderIndex = 0
        }
      )
    }
  )
}

$workflowResp = Invoke-RestMethod -Method Post -Uri "$base/api/workflows" `
  -ContentType 'application/json' `
  -Body ($workflowPayload | ConvertTo-Json -Depth 6)

if (-not $workflowResp.success) {
  throw "Workflow create failed: $($workflowResp.message)"
}

Write-Output "SUCCESS!"
Write-Output "WORKFLOW_ID=$($workflowResp.data.id)"
Write-Output "WORKFLOW_STATUS=$($workflowResp.data.status)"
Write-Output "TASKS_COUNT=$($workflowResp.data.tasks.Count)"
Write-Output "TERMINALS_COUNT=$($workflowResp.data.tasks[0].terminals.Count)"
