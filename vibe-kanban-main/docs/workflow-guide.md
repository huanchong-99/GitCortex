# GitCortex Workflow Guide

## Overview

The GitCortex Workflow System is a powerful orchestration engine that enables you to coordinate multiple AI coding agents working in parallel or sequence. It provides:

- **Parallel Task Execution**: Run multiple AI agents simultaneously on different branches
- **Main Orchestrator**: Optional AI coordinator that manages task distribution and coordination
- **Slash Commands**: Pre-built command patterns for common development workflows
- **Merge Terminal**: Dedicated terminal for merging completed work
- **Error Handling**: Optional error terminal for automated error recovery
- **Terminal Debugging**: Real-time monitoring and intervention in running workflows

## Quick Start

### 1. Create a Workflow

```bash
# Via the Web UI
1. Navigate to your project
2. Click "New Workflow"
3. Configure basic settings
4. Add tasks and terminals
5. Click "Create"
```

```javascript
// Via API
const response = await fetch('http://localhost:3001/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'your-project-id',
    name: 'My First Workflow',
    description: 'Automated feature development',
    useSlashCommands: true,
    mergeTerminalConfig: {
      cliTypeId: 'claude-code',
      modelConfigId: 'claude-3-5-sonnet'
    },
    targetBranch: 'main'
  })
});
```

### 2. Start the Workflow

Once created, the workflow will:
1. Spin up all configured terminals
2. Wait for all terminals to be ready
3. Prompt you to confirm start
4. Execute tasks according to configuration
5. Merge completed work to target branch

### 3. Monitor Progress

Use the Workflow Debug page to:
- View terminal output in real-time
- Send manual commands to terminals
- Monitor task status
- Handle errors and interventions

## Configure Workflow

### Basic Settings

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `name` | string | Yes | Workflow name for identification |
| `description` | string | No | Detailed description of workflow purpose |
| `projectId` | string | Yes | ID of the project this workflow belongs to |
| `targetBranch` | string | No | Target branch for merging (default: "main") |

### Parallel Tasks

Define tasks that will execute in parallel. Each task:
- Runs on its own git branch
- Has its own set of terminals
- Operates independently until merge time

```javascript
{
  "tasks": [
    {
      "name": "Frontend Feature",
      "description": "Implement user authentication UI",
      "branch": "feature/frontend-auth",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Frontend Developer",
          "roleDescription": "Focus on React components and user experience"
        }
      ]
    },
    {
      "name": "Backend API",
      "description": "Implement authentication endpoints",
      "branch": "feature/backend-auth",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Backend Developer",
          "roleDescription": "Focus on API design and security"
        }
      ]
    }
  ]
}
```

### Terminals

Each terminal represents an AI coding agent session. Configuration:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cliTypeId` | string | Yes | ID of the CLI type (e.g., "claude-code", "gemini-cli") |
| `modelConfigId` | string | Yes | ID of the model configuration |
| `customBaseUrl` | string | No | Override default API base URL |
| `customApiKey` | string | No | Override default API key |
| `role` | string | No | Role name for the agent |
| `roleDescription` | string | No | Detailed role description for context |

**Terminal Roles Example:**

```javascript
{
  "terminals": [
    {
      "cliTypeId": "claude-code",
      "modelConfigId": "claude-3-5-sonnet",
      "role": "Frontend Specialist",
      "roleDescription": "You are a frontend developer specializing in React, TypeScript, and modern UI patterns. Focus on component reusability, accessibility, and performance."
    },
    {
      "cliTypeId": "gemini-cli",
      "modelConfigId": "gemini-2-0-flash",
      "role": "Backend Architect",
      "roleDescription": "You are a backend architect focused on API design, database optimization, and scalable microservices patterns."
    }
  ]
}
```

### Main Orchestrator

The Main Orchestrator is an optional AI agent that coordinates task execution, monitors progress, and makes decisions about task distribution and error handling.

**Configuration:**

```javascript
{
  "orchestratorConfig": {
    "apiType": "anthropic",  // or "openai", "custom"
    "baseUrl": "https://api.anthropic.com",
    "apiKey": process.env.ANTHROPIC_API_KEY,  // Use environment variable
    "model": "claude-sonnet-4-20250514"
  }
}
```

**Orchestrator Capabilities:**
- Distributes work among parallel terminals
- Monitors terminal output for errors
- Triggers error recovery workflows
- Coordinates merge operations
- Makes decisions about task dependencies

**When to Use:**
- Complex workflows with >3 parallel tasks
- Tasks with complex dependencies
- Error-prone workflows needing automated recovery
- Scenarios requiring dynamic task allocation

**When NOT to Use:**
- Simple parallel workflows
- Fully deterministic workflows
- Low-latency requirements (orchestrator adds overhead)

### Slash Commands

Slash commands are pre-built command patterns that streamline common workflows.

**Enable Slash Commands:**

```javascript
{
  "useSlashCommands": true,
  "commandPresetIds": ["cmd-1", "cmd-2", "cmd-3"]
}
```

**Available Built-in Commands:**

| Command | Description | Use Case |
|---------|-------------|----------|
| `/write-code` | Write new code features | Feature development |
| `/fix-bug` | Debug and fix issues | Bug fixing workflows |
| `/refactor` | Refactor existing code | Code improvement |
| `/test` | Generate and run tests | Test coverage |
| `/review` | Code review and analysis | Quality assurance |
| `/docs` | Generate documentation | Documentation tasks |

**Creating Custom Commands:**

```javascript
// Via API
await fetch('http://localhost:3001/api/workflows/presets/commands', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: '/deploy',
    description: 'Deploy application to production',
    promptTemplate: 'Deploy the application to production environment. Ensure all tests pass and documentation is updated.',
    isSystem: false
  })
});
```

### Merge Terminal

The merge terminal is responsible for:
- Merging completed branches to target branch
- Resolving merge conflicts
- Running post-merge validation
- Updating documentation

**Configuration:**

```javascript
{
  "mergeTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  }
}
```

**Merge Process:**
1. All parallel tasks report completion
2. Merge terminal creates merge request
3. Automated conflict resolution attempts
4. Manual intervention if needed
5. Post-merge validation
6. Update workflow status to "completed"

## Start Workflow

### Workflow States

| State | Description | Can Transition To |
|-------|-------------|-------------------|
| `created` | Workflow created, not started | `starting`, `cancelled` |
| `starting` | Terminals are being initialized | `ready`, `failed` |
| `ready` | All terminals ready, awaiting user confirmation | `running`, `cancelled` |
| `running` | Workflow is executing | `paused`, `merging`, `completed`, `failed` |
| `paused` | Workflow paused by user | `running`, `cancelled` |
| `merging` | Merging branches to target | `completed`, `failed` |
| `completed` | Workflow completed successfully | - |
| `failed` | Workflow failed | - |
| `cancelled` | Workflow cancelled by user | - |

### Starting a Workflow

```javascript
// Update workflow to ready state
await fetch(`http://localhost:3001/api/workflows/${workflowId}/status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'ready' })
});

// Start the workflow
await fetch(`http://localhost:3001/api/workflows/${workflowId}/start`, {
  method: 'POST'
});
```

**Startup Sequence:**

1. **Terminal Initialization**: All terminals are created and connected
2. **Ready Check**: System waits for all terminals to be ready
3. **User Confirmation**: User confirms start (via web UI or API)
4. **Task Execution**: Tasks begin executing according to workflow configuration
5. **Monitoring**: Orchestrator (if enabled) monitors progress
6. **Merge**: Merge terminal merges completed work
7. **Completion**: Workflow marked as completed

## Terminal Debugging

### View Terminal Output

Monitor real-time output from any terminal in your workflow using WebSocket:

```javascript
// WebSocket connection for real-time terminal I/O
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

// Handle incoming messages (output from terminal)
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'output') {
    console.log(message.data);
  } else if (message.type === 'error') {
    console.error('Error:', message.message);
  }
};

// Send input to terminal
ws.send(JSON.stringify({
  type: 'input',
  data: 'git status\n'
}));

// Resize terminal (optional)
ws.send(JSON.stringify({
  type: 'resize',
  cols: 80,
  rows: 24
}));
```

**WebSocket Message Format:**

```json
// Server → Client (Output)
{
  "type": "output",
  "data": "Running npm install...\n"
}

// Server → Client (Error)
{
  "type": "error",
  "message": "Terminal not found"
}

// Client → Server (Input)
{
  "type": "input",
  "data": "ls -la\n"
}

// Client → Server (Resize)
{
  "type": "resize",
  "cols": 120,
  "rows": 30
}
```

### Manual Intervention

Send commands to terminals during workflow execution using WebSocket:

```javascript
// Connect to terminal WebSocket
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

// Send manual intervention commands
ws.send(JSON.stringify({
  type: 'input',
  data: 'git status\n'
}));

// Correct agent behavior
ws.send(JSON.stringify({
  type: 'input',
  data: 'Stop, use TypeScript instead\n'
}));

// Provide guidance
ws.send(JSON.stringify({
  type: 'input',
  data: 'Consider using React hooks for state management\n'
}));
```

**Common Intervention Commands:**

| Command Type | Example | Purpose |
|--------------|---------|---------|
| Direct command | `git status\n` | Check repository state |
| Correction | `Use TypeScript instead\n` | Correct agent approach |
| Guidance | `Consider React hooks\n` | Suggest improvements |
| Approval | `yes\n` | Confirm action |
| Rejection | `no\n` | Cancel action |
| Control-C | `\x03` | Send interrupt signal |

### Terminal Status

Monitor terminal health and status:

| Status | Description | Action Required |
|--------|-------------|-----------------|
| `initializing` | Terminal is starting up | Wait |
| `ready` | Terminal ready for commands | None |
| `busy` | Terminal is executing | Wait or intervene |
| `waiting_for_input` | Terminal awaits user input | Provide input |
| `error` | Terminal encountered error | Debug and retry |
| `completed` | Terminal finished task | None |
| `cancelled` | Terminal was cancelled | None |

**Get Terminal List via API:**

```javascript
// Get all terminals for a task
const response = await fetch(`http://localhost:3001/api/workflows/${workflowId}/tasks/${taskId}/terminals`);
const terminals = await response.json();

terminals.forEach(terminal => {
  console.log(`Terminal ${terminal.id}: ${terminal.status}`);
  console.log(`  Role: ${terminal.role}`);
  console.log(`  CLI: ${terminal.cliTypeId}`);
});
```

## Slash Commands

### Available Commands

| Command | Template | Parameters |
|---------|----------|------------|
| `/write-code` | Write code to implement: {feature} | feature: string |
| `/fix-bug` | Fix the following bug: {bug_description} | bug_description: string |
| `/refactor` | Refactor {file_or_function} to {goal} | file_or_function: string, goal: string |
| `/test` | Generate tests for {code} | code: string |
| `/review` | Review the following code: {code} | code: string |
| `/docs` | Generate documentation for {code} | code: string |

### Creating Custom Commands

**Step 1: Define the Command**

```javascript
const customCommand = {
  command: '/optimize',
  description: 'Optimize code for performance',
  promptTemplate: 'Optimize the following code for performance. Focus on:\n1. Algorithm efficiency\n2. Memory usage\n3. Caching strategies\n4. Lazy loading\n\nCode to optimize:\n{code}',
  isSystem: false
};
```

**Step 2: Register the Command**

```javascript
const response = await fetch('http://localhost:3001/api/workflows/presets/commands', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customCommand)
});

const preset = await response.json();
console.log(`Command created with ID: ${preset.id}`);
```

**Step 3: Use in Workflow**

```javascript
const workflow = {
  // ... other config
  useSlashCommands: true,
  commandPresetIds: [preset.id]
};
```

**Best Practices for Custom Commands:**
- Use clear, descriptive command names
- Provide detailed prompt templates
- Include specific parameters in braces `{parameter}`
- Test commands thoroughly before production use
- Document expected inputs and outputs

## Best Practices

### 1. Workflow Design

**Start Simple:**
- Begin with basic parallel workflows
- Add orchestrator only when needed
- Test each component independently

**Example Simple Workflow:**

```javascript
{
  "name": "Simple Feature",
  "useSlashCommands": false,
  "tasks": [
    {
      "name": "Implement Feature",
      "branch": "feature/new-functionality",
      "terminals": [{
        "cliTypeId": "claude-code",
        "modelConfigId": "claude-3-5-sonnet"
      }]
    }
  ]
}
```

**Plan Dependencies:**
- Identify tasks that can run in parallel
- Document dependencies between tasks
- Use orchestrator for complex dependencies

**Example Workflow with Dependencies:**

```javascript
{
  "name": "Complex Feature",
  "orchestratorConfig": {
    "apiType": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "tasks": [
    {
      "name": "Database Schema",
      "branch": "feature/db-schema",
      "orderIndex": 0
    },
    {
      "name": "API Layer",
      "branch": "feature/api-layer",
      "orderIndex": 1,
      "dependsOn": ["feature/db-schema"]
    },
    {
      "name": "Frontend UI",
      "branch": "feature/frontend-ui",
      "orderIndex": 1,
      "dependsOn": ["feature/db-schema"]
    }
  ]
}
```

### 2. Terminal Configuration

**Role Clarity:**
- Define clear, specific roles for each terminal
- Provide detailed role descriptions
- Align roles with task objectives

**Example Role Definitions:**

```javascript
{
  "terminals": [
    {
      "role": "Database Architect",
      "roleDescription": "You are a database architect specializing in PostgreSQL optimization, indexing strategies, and query performance. Always consider data integrity and scalability."
    },
    {
      "role": "API Designer",
      "roleDescription": "You are an API designer focused on RESTful best practices, OpenAPI documentation, and endpoint security. Prioritize consistency and developer experience."
    },
    {
      "role": "UI/UX Developer",
      "roleDescription": "You are a UI/UX developer specializing in responsive design, accessibility (WCAG 2.1), and user-centric interfaces. Focus on intuitive navigation and visual feedback."
    }
  ]
}
```

**Model Selection:**
- Choose models appropriate for task complexity
- Balance cost vs. capability
- Consider latency for real-time interactions

**Model Selection Guide:**

| Task Type | Recommended Models |
|-----------|-------------------|
| Simple code generation | Claude 3 Haiku, Gemini Flash |
| Complex features | Claude 3.5 Sonnet, GPT-4 |
| Architecture decisions | Claude Opus, GPT-4 Turbo |
| Documentation | Claude 3 Sonnet, Gemini Pro |
| Testing | Claude 3.5 Sonnet, GPT-4 |

### 3. Error Handling

**Enable Error Terminal:**
- Configure dedicated error handling terminal
- Define error recovery strategies
- Set up error notifications

**Example Error Terminal Configuration:**

```javascript
{
  "errorTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "errorHandling": {
    "maxRetries": 3,
    "retryDelay": 5000,
    "escalationTimeout": 60000
  }
}
```

**Monitor Workflow Health:**
- Set up alerts for workflow failures
- Log all errors with context
- Review error patterns regularly

**Error Monitoring:**

```javascript
// Monitor terminal output for errors
const monitorErrors = (terminalId) => {
  const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'error') {
      console.error(`[ERROR] ${message.message}`);
      // Send alert
      sendAlert({
        terminal: terminalId,
        error: message.message
      });
    } else if (message.type === 'output') {
      // Check for error patterns in output
      if (message.data.includes('ERROR') || message.data.includes('FAIL')) {
        console.warn('Potential error detected in terminal output');
      }
    }
  };
};

// Helper function for alerts
const sendAlert = (alert) => {
  // Implement your alerting logic (email, Slack, etc.)
  console.log('ALERT:', JSON.stringify(alert));
};
```

### 4. Performance Optimization

**Parallel Execution:**
- Maximize parallel tasks for independent work
- Limit parallel tasks to 3-5 for optimal performance
- Consider resource constraints

**Performance Benchmarks:**

```
1 terminal:  1x baseline
2 terminals: 1.8x faster (10% overhead)
3 terminals: 2.5x faster (17% overhead)
4 terminals: 3.0x faster (25% overhead)
5 terminals: 3.3x faster (34% overhead)
```

**Resource Management:**
- Monitor terminal memory usage
- Set appropriate timeouts
- Clean up completed terminals

**Example Resource Limits:**

```javascript
{
  "terminal": {
    "memoryLimit": "4GB",
    "timeout": 3600000,  // 1 hour
    "idleTimeout": 300000  // 5 minutes
  }
}
```

### 5. Security

**API Key Management:**
- Never hardcode API keys
- Use environment variables
- Rotate keys regularly
- Monitor key usage

**Example Secure Configuration:**

```javascript
// Set environment variable (outside of code)
// export ANTHROPIC_API_KEY="your-actual-key-here"

// Workflow configuration (no hardcoded keys)
{
  "orchestratorConfig": {
    "apiType": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "apiKey": process.env.ANTHROPIC_API_KEY
  }
}
```

**Access Control:**
- Limit workflow creation permissions
- Audit workflow executions
- Review terminal outputs for sensitive data

**Audit Logging:**

```javascript
const auditWorkflow = async (workflowId, userId, action) => {
  await fetch('http://localhost:3001/api/audit/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowId,
      userId,
      action,
      timestamp: new Date().toISOString(),
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    })
  });
};
```

## Example Workflows

### Example 1: Simple Feature Development

**Use Case:** Implement a new authentication feature

**Configuration:**

```javascript
{
  "name": "Authentication Feature",
  "description": "Implement OAuth2 authentication with Google and GitHub",
  "projectId": "my-web-app",
  "useSlashCommands": true,
  "commandPresetIds": ["cmd-write-code", "cmd-test"],
  "mergeTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "targetBranch": "main",
  "tasks": [
    {
      "name": "Backend OAuth",
      "description": "Implement OAuth2 endpoints and token management",
      "branch": "feature/backend-oauth",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Backend Developer",
          "roleDescription": "You are a backend developer specializing in Node.js, Express, and OAuth2 security. Implement secure authentication flows with proper error handling."
        }
      ]
    },
    {
      "name": "Frontend Login",
      "description": "Create login UI and integrate OAuth buttons",
      "branch": "feature/frontend-login",
      "terminals": [
        {
          "cliTypeId": "gemini-cli",
          "modelConfigId": "gemini-2-0-flash",
          "role": "Frontend Developer",
          "roleDescription": "You are a frontend developer specializing in React, TypeScript, and modern UI frameworks. Create accessible, responsive login components."
        }
      ]
    }
  ]
}
```

**Expected Flow:**
1. Two branches created: `feature/backend-oauth` and `feature/frontend-login`
2. Backend terminal implements OAuth endpoints
3. Frontend terminal creates login UI
4. Both terminals run tests
5. Merge terminal merges both branches
6. Integration tests validate complete flow

### Example 2: Multi-Agent Refactoring

**Use Case:** Refactor legacy codebase with multiple agents

**Configuration:**

```javascript
{
  "name": "Legacy Refactoring",
  "description": "Refactor monolithic app to microservices architecture",
  "projectId": "legacy-app",
  "useSlashCommands": false,
  "orchestratorConfig": {
    "apiType": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "apiKey": process.env.ORCHESTRATOR_API_KEY,
    "model": "claude-opus-4-20250514"
  },
  "mergeTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "errorTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "targetBranch": "main",
  "tasks": [
    {
      "name": "Extract User Service",
      "description": "Extract user management to separate microservice",
      "branch": "refactor/user-service",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Backend Architect",
          "roleDescription": "You are a backend architect specializing in microservices, API design, and service mesh patterns. Ensure service independence and proper API boundaries."
        }
      ]
    },
    {
      "name": "Extract Payment Service",
      "description": "Extract payment processing to separate microservice",
      "branch": "refactor/payment-service",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Payment Specialist",
          "roleDescription": "You are a payment systems specialist with expertise in PCI compliance, Stripe integration, and secure transaction handling."
        }
      ]
    },
    {
      "name": "Update API Gateway",
      "description": "Configure API gateway for new microservices",
      "branch": "refactor/api-gateway",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "DevOps Engineer",
          "roleDescription": "You are a DevOps engineer specializing in API gateways, service mesh, and cloud infrastructure. Implement robust routing and load balancing."
        }
      ]
    },
    {
      "name": "Database Migration",
      "description": "Migrate database to service-specific instances",
      "branch": "refactor/database-migration",
      "terminals": [
        {
          "cliTypeId": "gemini-cli",
          "modelConfigId": "gemini-2-0-flash-exp",
          "role": "Database Architect",
          "roleDescription": "You are a database architect specializing in PostgreSQL, migration strategies, and data consistency. Ensure zero data loss and minimal downtime."
        }
      ]
    }
  ]
}
```

**Expected Flow:**
1. Orchestrator analyzes dependencies between services
2. Four terminals work in parallel on different services
3. Orchestrator monitors progress and coordinates data flow
4. Error terminal handles any migration issues
5. Merge terminal coordinates final integration
6. API gateway configured last (depends on all services)

### Example 3: Testing and Documentation Workflow

**Use Case:** Comprehensive test suite and documentation generation

**Configuration:**

```javascript
{
  "name": "Test and Document",
  "description": "Generate comprehensive tests and documentation",
  "projectId": "api-project",
  "useSlashCommands": true,
  "commandPresetIds": ["cmd-test", "cmd-docs", "cmd-review"],
  "mergeTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "targetBranch": "main",
  "tasks": [
    {
      "name": "Unit Tests",
      "description": "Generate unit tests for all modules",
      "branch": "test/unit-tests",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "Test Engineer",
          "roleDescription": "You are a test engineer specializing in Jest, unit testing, and test coverage. Aim for >80% code coverage."
        }
      ]
    },
    {
      "name": "Integration Tests",
      "description": "Create integration test suite",
      "branch": "test/integration-tests",
      "terminals": [
        {
          "cliTypeId": "claude-code",
          "modelConfigId": "claude-3-5-sonnet",
          "role": "QA Engineer",
          "roleDescription": "You are a QA engineer specializing in integration testing, API testing, and end-to-end workflows. Focus on realistic user scenarios."
        }
      ]
    },
    {
      "name": "API Documentation",
      "description": "Generate OpenAPI documentation",
      "branch": "docs/api-docs",
      "terminals": [
        {
          "cliTypeId": "gemini-cli",
          "modelConfigId": "gemini-2-0-flash",
          "role": "Technical Writer",
          "roleDescription": "You are a technical writer specializing in API documentation, OpenAPI specs, and developer guides. Ensure clarity and completeness."
        }
      ]
    },
    {
      "name": "User Guides",
      "description": "Create user documentation and tutorials",
      "branch": "docs/user-guides",
      "terminals": [
        {
          "cliTypeId": "gemini-cli",
          "modelConfigId": "gemini-2-0-flash",
          "role": "Documentation Specialist",
          "roleDescription": "You are a documentation specialist creating user guides, tutorials, and getting-started content. Focus on beginner-friendly explanations."
        }
      ]
    }
  ]
}
```

**Expected Flow:**
1. Test terminals generate comprehensive test suites
2. Documentation terminals create API docs and user guides
3. All terminals run in parallel
4. Merge terminal validates test coverage
5. Merge terminal ensures documentation completeness
6. All changes merged to main branch

## Troubleshooting

### Issue 1: Workflow Stuck in "Starting" State

**Symptoms:**
- Workflow status remains "starting" for >5 minutes
- Terminals not appearing in debug view
- No error messages

**Diagnosis:**

```javascript
// Check workflow status via API
const response = await fetch(`http://localhost:3001/api/workflows/${workflowId}`);
const workflowDetail = await response.json();

console.log('Workflow status:', workflowDetail.status);
console.log('Tasks:', workflowDetail.tasks);
```

**Solutions:**

1. **Check CLI Installation:**
   ```bash
   # Verify CLI is installed
   claude --version
   gemini --version
   ```

2. **Check API Keys:**
   ```bash
   # Verify environment variables
   echo $ANTHROPIC_API_KEY
   echo $OPENAI_API_KEY
   ```

3. **Check Network Connectivity:**
   ```bash
   # Test API endpoints
   curl https://api.anthropic.com/v1/messages
   curl https://api.openai.com/v1/models
   ```

4. **Review Terminal Output via WebSocket:**
   ```javascript
   // Connect to each terminal to review output
   const terminals = await fetch(`http://localhost:3001/api/workflows/${workflowId}/tasks/${taskId}/terminals`);
   const terminalList = await terminals.json();

   terminalList.forEach(terminal => {
     const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminal.id}`);
     ws.onmessage = (event) => {
       const message = JSON.parse(event.data);
       console.log(`[${terminal.id}]`, message.data);
     };
   });
   ```

### Issue 2: Merge Conflicts

**Symptoms:**
- Workflow stuck in "merging" state
- Merge terminal showing conflict errors
- Multiple branches with conflicting changes

**Diagnosis:**

```javascript
// Get workflow details to check merge terminal
const response = await fetch(`http://localhost:3001/api/workflows/${workflowId}`);
const workflow = await response.json();

// Find merge terminal in tasks
const mergeTask = workflow.tasks.find(t => t.name.includes('merge') || t.branch.includes('merge'));
console.log('Merge task:', mergeTask);

// Connect to merge terminal WebSocket to see conflicts
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${mergeTask.terminals[0].id}`);
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Merge output:', message.data);
};
```

**Solutions:**

1. **Manual Conflict Resolution via WebSocket:**
   ```javascript
   // Connect to merge terminal
   const ws = new WebSocket(`ws://localhost:3001/api/terminal/${mergeTerminalId}`);

   // Send resolution commands
   ws.send(JSON.stringify({
     type: 'input',
     data: 'git checkout --ours src/conflicting-file.ts\n'
   }));

   ws.send(JSON.stringify({
     type: 'input',
     data: 'git add src/conflicting-file.ts\n'
   }));

   ws.send(JSON.stringify({
     type: 'input',
     data: 'git commit -m "Resolved conflicts"\n'
   }));
   ```

2. **Prevent Conflicts with Task Separation:**
   ```javascript
   {
     "tasks": [
       {
         "name": "Frontend Changes",
         "branch": "feature/frontend-only",
         "pathFilters": ["src/frontend/**", "public/**"]
       },
       {
         "name": "Backend Changes",
         "branch": "feature/backend-only",
         "pathFilters": ["src/backend/**", "api/**"]
       }
     ]
   }
   ```

3. **Use Orchestrator for Coordination:**
   - Enable orchestrator to monitor file conflicts
   - Orchestrator can coordinate file access
   - Automatic conflict prevention strategies

### Issue 3: Terminal Timeout

**Symptoms:**
- Terminal stops responding
- WebSocket connection closes unexpectedly
- Task marked as failed

**Diagnosis:**

```javascript
// WebSocket will automatically close after 5 minutes of inactivity
// Check server logs for timeout messages
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  if (event.code === 1006) {
    console.log('Connection closed abnormally - possible timeout');
  }
};
```

**Solutions:**

1. **Implement Keep-Alive:**
   ```javascript
   // Send periodic input to keep connection alive
   const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

   // Send keep-alive every 2 minutes
   setInterval(() => {
     if (ws.readyState === WebSocket.OPEN) {
       ws.send(JSON.stringify({
         type: 'input',
         data: '\n' // Send newline to keep session active
       }));
     }
   }, 120000);
   ```

2. **Handle Reconnection:**
   ```javascript
   function connectWithRetry(terminalId, maxRetries = 3) {
     let retries = 0;

     function connect() {
       const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

       ws.onclose = (event) => {
         if (retries < maxRetries) {
           retries++;
           console.log(`Reconnecting... (${retries}/${maxRetries})`);
           setTimeout(() => connect(), 5000);
         } else {
           console.error('Max retries reached');
         }
       };

       return ws;
     }

     return connect();
   }
   ```

3. **Monitor and Reconnect:**
   ```javascript
   // Monitor terminal connection health
   const monitorTerminal = (terminalId) => {
     const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);
     let lastActivity = Date.now();

     ws.onmessage = (event) => {
       lastActivity = Date.now();
       const message = JSON.parse(event.data);
       // Process message...
     };

     ws.onclose = () => {
       console.log('Terminal disconnected, attempting reconnect...');
       setTimeout(() => {
         monitorTerminal(terminalId); // Recursive reconnect
       }, 5000);
     };

     // Check for inactivity timeout
     setInterval(() => {
       if (Date.now() - lastActivity > 240000) { // 4 minutes
         console.warn('No activity for 4 minutes, connection may be stale');
         ws.close(); // Trigger reconnection
       }
     }, 60000); // Check every minute
   };

   monitorTerminal(terminalId);
   ```

### Issue 4: High API Costs

**Symptoms:**
- Unexpectedly high API usage
- Large token consumption
- Expensive workflow runs

**Diagnosis:**

```javascript
// Monitor terminal output to estimate usage
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);
let totalChars = 0;

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'output') {
    totalChars += message.data.length;
    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(totalChars / 4);
    console.log(`Estimated tokens: ${estimatedTokens}`);
  }
};
```

**Solutions:**

1. **Use Efficient Models:**
   ```javascript
   {
     "terminals": [
       {
         "modelConfigId": "claude-3-haiku",  // Faster, cheaper
         "role": "Code Generator"
       },
       {
         "modelConfigId": "claude-3-5-sonnet",  // Balanced
         "role": "Code Reviewer"
       }
     ]
   }
   ```

2. **Optimize Prompts:**
   - Use concise role descriptions
   - Provide only necessary context
   - Use slash commands for common patterns

3. **Monitor Usage in Real-Time:**
   ```javascript
   const budget = 100000; // Token budget
   let usedTokens = 0;

   const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     if (message.type === 'output') {
       // Estimate tokens from output length
       const messageTokens = Math.ceil(message.data.length / 4);
       usedTokens += messageTokens;

       if (usedTokens > budget) {
         console.warn('Budget exceeded!');
         // Send interrupt to stop further processing
         ws.send(JSON.stringify({
           type: 'input',
           data: '\x03' // Control-C to interrupt
         }));
       }
     }
   };
   ```

## API Reference

### Workflow Endpoints

#### List Workflows

```http
GET /api/workflows?projectId={projectId}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workflow-123",
      "name": "My Workflow",
      "status": "running",
      "createdAt": "2025-01-19T10:00:00Z"
    }
  ]
}
```

#### Create Workflow

```http
POST /api/workflows
Content-Type: application/json

{
  "projectId": "project-123",
  "name": "My Workflow",
  "description": "Workflow description",
  "useSlashCommands": true,
  "commandPresetIds": ["cmd-1", "cmd-2"],
  "orchestratorConfig": {
    "apiType": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "apiKey": process.env.ANTHROPIC_API_KEY,
    "model": "claude-sonnet-4-20250514"
  },
  "errorTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "mergeTerminalConfig": {
    "cliTypeId": "claude-code",
    "modelConfigId": "claude-3-5-sonnet"
  },
  "targetBranch": "main"
}
```

#### Get Workflow

```http
GET /api/workflows/{workflowId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow": {
      "id": "workflow-123",
      "name": "My Workflow",
      "status": "running"
    },
    "tasks": [
      {
        "task": {
          "id": "task-456",
          "name": "Task 1",
          "status": "running"
        },
        "terminals": [
          {
            "id": "term-789",
            "status": "busy"
          }
        ]
      }
    ],
    "commands": [
      {
        "command": {
          "id": "cmd-1",
          "orderIndex": 0
        },
        "preset": {
          "id": "preset-1",
          "command": "/write-code",
          "description": "Write code"
        }
      }
    ]
  }
}
```

#### Update Workflow Status

```http
PUT /api/workflows/{workflowId}/status
Content-Type: application/json

{
  "status": "ready"
}
```

#### Start Workflow

```http
POST /api/workflows/{workflowId}/start
```

#### Delete Workflow

```http
DELETE /api/workflows/{workflowId}
```

### Terminal Endpoints

#### List Task Terminals

```http
GET /api/workflows/{workflowId}/tasks/{taskId}/terminals
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "term-789",
      "workflowTaskId": "task-456",
      "cliTypeId": "claude-code",
      "modelConfigId": "claude-3-5-sonnet",
      "role": "Frontend Developer",
      "status": "busy"
    }
  ]
}
```

### Command Presets

#### List Command Presets

```http
GET /api/workflows/presets/commands
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "preset-1",
      "command": "/write-code",
      "description": "Write new code",
      "isSystem": true
    }
  ]
}
```

### WebSocket Events

#### Terminal WebSocket Connection

Connect to a terminal's WebSocket for real-time bidirectional communication:

```javascript
const ws = new WebSocket(`ws://localhost:3001/api/terminal/${terminalId}`);

// Send input to terminal
ws.send(JSON.stringify({
  type: 'input',
  data: 'ls -la\n'
}));

// Handle terminal output
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'output':
      console.log('Terminal output:', message.data);
      break;
    case 'error':
      console.error('Terminal error:', message.message);
      break;
  }
};

// Resize terminal
ws.send(JSON.stringify({
  type: 'resize',
  cols: 120,
  rows: 30
}));
```

**WebSocket Message Types:**

| Direction | Type | Fields | Description |
|-----------|------|--------|-------------|
| Client → Server | `input` | `data: string` | Send input to terminal |
| Client → Server | `resize` | `cols: number, rows: number` | Resize terminal |
| Server → Client | `output` | `data: string` | Terminal output |
| Server → Client | `error` | `message: string` | Error message |

## Support

### Getting Help

- **Documentation**: [vibekanban.com/docs](https://vibekanban.com/docs)
- **GitHub Issues**: [github.com/BloopAI/vibe-kanban/issues](https://github.com/BloopAI/vibe-kanban/issues)
- **Discord Community**: [discord.gg/AC4nwVtJM3](https://discord.gg/AC4nwVtJM3)

### Reporting Issues

When reporting workflow issues, include:

1. Workflow configuration (sanitized)
2. Terminal logs and error messages
3. Workflow state and status history
4. Steps to reproduce
5. Expected vs. actual behavior

**Issue Template:**

```markdown
## Issue Description
[Brief description of the issue]

## Workflow Configuration
```json
{
  "name": "My Workflow",
  ...
}
```

## Error Logs
```
[Paste relevant error logs]
```

## Steps to Reproduce
1. Create workflow with config X
2. Start workflow
3. Observe error Y

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- OS: [e.g., Ubuntu 22.04]
- Node.js: [e.g., 18.17.0]
- Vibe Kanban: [e.g., 1.2.3]
```

### Feature Requests

Have an idea for improving the workflow system? Please:

1. Check existing discussions and issues
2. Use [GitHub Discussions](https://github.com/BloopAI/vibe-kanban/discussions) for feature proposals
3. Provide detailed use cases and examples
4. Consider contributing to the implementation

---

**Last Updated:** 2025-01-19

**Version:** 1.0.0
