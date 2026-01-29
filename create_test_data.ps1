$base = 'http://localhost:64206'

# 1) Create project (requires repositories array)
$projectPayload = @{
  name = 'Test Project'
  repositories = @(
    @{ displayName = 'GitCortex'; gitRepoPath = 'E:\\GitCortex' }
  )
}
$projectResp = Invoke-RestMethod -Method Post -Uri "$base/api/projects" `
  -ContentType 'application/json' `
  -Body ($projectPayload | ConvertTo-Json -Depth 5)

if (-not $projectResp.success) {
  throw "Project create failed: $($projectResp.message)"
}

$projectId = $projectResp.data.id
Write-Output "PROJECT_ID=$projectId"

# 2) Create workflow (needs valid cli/model IDs from seeded data)
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

Write-Output "WORKFLOW_ID=$($workflowResp.data.id)"
Write-Output "WORKFLOW_STATUS=$($workflowResp.data.status)"
