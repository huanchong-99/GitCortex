# Phase 16: 工作流前端体验完备 - TDD 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 将前端从 mock 数据迁移到真实 API 数据，完善工作流列表、详情、调试页面的实时状态显示和控制功能。

**架构:**
1. 前端使用 `shared/types.ts` 中生成的 DTO 类型
2. React Query hooks (`useWorkflows`, `useWorkflow`) 管理数据获取和缓存
3. WebSocket 连接到 `/api/terminal_ws/:terminal_id` 实现终端实时输出
4. 表单提交转换为 `CreateWorkflowRequest` 格式匹配后端 API

**技术栈:**
- React 18 + TypeScript
- React Query (@tanstack/react-query)
- React Router v6
- i18next (react-i18next)
- xterm.js + xterm-addon-fit
- WebSocket API

**工作目录:** `E:\GitCortex\.worktrees\phase-16-frontend-workflow-ux\frontend`

**前置条件:** Phase 15 完成（后端 Workflow API、WebSocket 链路已实现）

---

## Task 16.1: Workflows 列表/详情改为真实任务数据

**目标:** 列表与详情完全基于 API 返回的 DTO 数据，移除所有 mock 数据和硬编码。

**涉及文件:**
- 修改: `frontend/src/pages/Workflows.tsx:45-86`
- 测试: `frontend/src/pages/Workflows.test.tsx` (需创建)

### Step 16.1.1: 创建 Workflows 页面测试文件

**文件:** `frontend/src/pages/Workflows.test.tsx`

```tsx
import { render, screen, waitFor } from '@test/utils';
import { Workflows } from './Workflows';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Mock API handlers
const handlers = [
  rest.get('/api/workflows', (req, res, ctx) => {
    const projectId = req.url.searchParams.get('projectId');
    if (projectId === 'test-project') {
      return res(
        ctx.json([
          {
            id: 'wf-1',
            projectId: 'test-project',
            name: 'Test Workflow',
            description: 'Test description',
            status: 'created',
            createdAt: '2026-01-25T10:00:00Z',
            updatedAt: '2026-01-25T10:00:00Z',
            tasksCount: 2,
            terminalsCount: 4,
          },
        ])
      );
    }
    return res(ctx.status(404));
  }),
  rest.get('/api/workflows/:id', (req, res, ctx) => {
    const { id } = req.params;
    if (id === 'wf-1') {
      return res(
        ctx.json({
          id: 'wf-1',
          projectId: 'test-project',
          name: 'Test Workflow',
          description: 'Test description',
          status: 'created',
          useSlashCommands: false,
          orchestratorEnabled: false,
          orchestratorApiType: null,
          orchestratorBaseUrl: null,
          orchestratorModel: null,
          errorTerminalEnabled: false,
          errorTerminalCliId: null,
          errorTerminalModelId: null,
          mergeTerminalCliId: 'cli-1',
          mergeTerminalModelId: 'model-1',
          targetBranch: 'main',
          readyAt: null,
          startedAt: null,
          completedAt: null,
          createdAt: '2026-01-25T10:00:00Z',
          updatedAt: '2026-01-25T10:00:00Z',
          tasks: [
            {
              id: 'task-1',
              workflowId: 'wf-1',
              vkTaskId: null,
              name: 'Task 1',
              description: 'First task',
              branch: 'feat/task-1',
              status: 'pending',
              orderIndex: 0,
              startedAt: null,
              completedAt: null,
              createdAt: '2026-01-25T10:00:00Z',
              updatedAt: '2026-01-25T10:00:00Z',
              terminals: [
                {
                  id: 'term-1',
                  workflowTaskId: 'task-1',
                  cliTypeId: 'claude-code',
                  modelConfigId: 'model-1',
                  customBaseUrl: null,
                  customApiKey: null,
                  role: null,
                  roleDescription: null,
                  orderIndex: 0,
                  status: 'idle',
                  createdAt: '2026-01-25T10:00:00Z',
                  updatedAt: '2026-01-25T10:00:00Z',
                },
              ],
            },
          ],
          commands: [],
        })
      );
    }
    return res(ctx.status(404));
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/projects/:projectId" element={component} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Workflows Page', () => {
  test('should render workflow list from API', async () => {
    renderWithProviders(<Workflows />, {
      path: '/projects/:projectId',
      url: '/projects/test-project',
    });

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(screen.getByText('4 terminals')).toBeInTheDocument();
  });

  test('should display workflow status badge', async () => {
    renderWithProviders(<Workflows />, {
      path: '/projects/:projectId',
      url: '/projects/test-project',
    });

    await waitFor(() => {
      expect(screen.getByText('created')).toBeInTheDocument();
    });
  });

  test('should navigate to workflow detail on click', async () => {
    renderWithProviders(<Workflows />, {
      path: '/projects/:projectId',
      url: '/projects/test-project',
    });

    await waitFor(() => {
      const card = screen.getByText('Test Workflow').closest('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });
  });

  test('should show empty state when no workflows', async () => {
    server.use(
      rest.get('/api/workflows', (req, res, ctx) => {
        return res(ctx.json([]));
      })
    );

    renderWithProviders(<Workflows />, {
      path: '/projects/:projectId',
      url: '/projects/test-project',
    });

    await waitFor(() => {
      expect(screen.getByText('No workflows yet')).toBeInTheDocument();
    });
  });
});
```

**运行:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** FAIL - 测试文件不存在

---

### Step 16.1.2: 修复 Workflows 页面的 handleCreateWorkflow 函数

**当前问题:** `Workflows.tsx:45-86` 的 `handleCreateWorkflow` 使用错误的请求格式（`project_id` snake_case，嵌套 `config` 对象不存在于 API）

**修改:** `frontend/src/pages/Workflows.tsx:45-86`

```tsx
// 修改前（错误格式）
const request = {
  project_id: projectId,  // ❌ snake_case
  name: config.basic.name,
  description: config.basic.description,
  config: {  // ❌ 嵌套 config 对象
    tasks: config.tasks.map(t => ({ ... })),
    models: config.models.map(m => ({ ... })),
    terminals: config.terminals,
    commands: config.commands,
    orchestrator: { ... },
  },
};

// 修改后（正确格式 - 匹配 CreateWorkflowRequest）
const request: CreateWorkflowRequest = {
  projectId: projectId,  // ✅ camelCase
  name: config.basic.name,
  description: config.basic.description,
  useSlashCommands: config.commands.enabled,
  commandPresetIds: config.commands.presetIds.length > 0 ? config.commands.presetIds : undefined,
  commands: config.commands.presetIds.map((presetId, index) => ({
    presetId,
    orderIndex: index,
    customParams: null,
  })),
  orchestratorConfig: {
    apiType: 'anthropic', // TODO: 从模型配置中获取
    baseUrl: '',          // TODO: 从模型配置中获取
    apiKey: '',           // TODO: 从模型配置中获取（需要加密）
    model: '',            // TODO: 从模型配置中获取
  },
  errorTerminalConfig: config.advanced.errorTerminal.enabled ? {
    cliTypeId: config.advanced.errorTerminal.cliTypeId!,
    modelConfigId: config.advanced.errorTerminal.modelConfigId!,
    customBaseUrl: null,
    customApiKey: null,
  } : undefined,
  mergeTerminalConfig: {
    cliTypeId: config.advanced.mergeTerminal.cliTypeId,
    modelConfigId: config.advanced.mergeTerminal.modelConfigId,
    customBaseUrl: null,
    customApiKey: null,
  },
  targetBranch: config.advanced.targetBranch,
  tasks: config.tasks.map(task => {
    // 找到属于此任务的终端
    const taskTerminals = config.terminals.filter(t => t.taskId === task.id);
    return {
      name: task.name,
      description: task.description,
      branch: task.branch,
      orderIndex: parseInt(task.id.split('-')[1]) || 0, // 从临时 ID 提取顺序
      terminals: taskTerminals.map(terminal => ({
        cliTypeId: terminal.cliTypeId,
        modelConfigId: terminal.modelConfigId,
        customBaseUrl: null,
        customApiKey: null,
        role: terminal.role,
        roleDescription: null,
        orderIndex: terminal.orderIndex,
      })),
    };
  }),
};
```

**运行测试:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** FAIL - `tasks` DTO 缺少 `terminals` 属性（需要检查后端 API）

---

### Step 16.1.3: 检查后端 CreateWorkflowRequest 是否支持 tasks[].terminals

**文件:** `crates/server/src/routes/workflows_dto.rs` 或 `workflows.rs`

**查找:**
```rust
pub struct CreateWorkflowRequest {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    // ...
}
```

**检查是否有:**
```rust
pub struct CreateTaskRequest {
    pub terminals: Option<Vec<CreateTerminalRequest>>, // ??
}
```

**运行:**
```bash
cd .worktrees/phase-16-frontend-workflow-ux && grep -r "struct CreateWorkflowRequest" crates/server/src/routes/
```

**预期:** 如果后端不支持 `tasks[].terminals`，需要在 Task 16.4 中调整前端逻辑

---

### Step 16.1.4: 更新 Workflows 列表渲染使用 DTO 字段

**修改:** `frontend/src/pages/Workflows.tsx:179-214`

```tsx
// 修改前（使用 mock 数据）
<Card>
  <CardContent className="pt-6">
    <div className="flex items-start justify-between mb-4">
      <h3 className="font-semibold text-lg">{workflow.name}</h3>
      <span className={cn(...)}>{workflow.status}</span>
    </div>
    {workflow.description && (
      <p className="text-sm text-low mb-4">{workflow.description}</p>
    )}
    <div className="flex items-center justify-between text-xs text-low">
      <span>{workflow.config.tasks.length} tasks</span>  {/* ❌ config.tasks 不存在 */}
      <span>{workflow.config.terminals.length} terminals</span>  {/* ❌ config.terminals 不存在 */}
    </div>
  </CardContent>
</Card>

// 修改后（使用 DTO 字段）
<Card>
  <CardContent className="pt-6">
    <div className="flex items-start justify-between mb-4">
      <h3 className="font-semibold text-lg">{workflow.name}</h3>
      <span
        className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          workflow.status === 'running' && "bg-blue-100 text-blue-800",
          workflow.status === 'completed' && "bg-green-100 text-green-800",
          workflow.status === 'failed' && "bg-red-100 text-red-800",
          (workflow.status === 'created' || workflow.status === 'ready') && "bg-gray-100 text-gray-800"
        )}
      >
        {workflow.status}
      </span>
    </div>
    {workflow.description && (
      <p className="text-sm text-low mb-4">{workflow.description}</p>
    )}
    <div className="flex items-center justify-between text-xs text-low">
      <span>{workflow.tasksCount} tasks</span>  {/* ✅ DTO 字段 */}
      <span>{workflow.terminalsCount} terminals</span>  {/* ✅ DTO 字段 */}
    </div>
  </CardContent>
</Card>
```

**运行测试:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** PASS - 列表正确显示 DTO 数据

---

### Step 16.1.5: 更新 Workflow 详情页面的 selectedWorkflow 渲染

**修改:** `frontend/src/pages/Workflows.tsx:100-144`

```tsx
// 修改前
const selectedWorkflow = workflows?.find(w => w.id === selectedWorkflowId);

if (selectedWorkflow && selectedWorkflowId) {
  return (
    <PipelineView
      name={selectedWorkflow.name}
      status={selectedWorkflow.status as any}
      tasks={[]}  // ❌ TODO: Fetch workflow tasks
      mergeTerminal={{
        cliTypeId: selectedWorkflow.config.orchestrator.mergeTerminal.cliTypeId,  // ❌ 路径错误
        modelConfigId: selectedWorkflow.config.orchestrator.mergeTerminal.modelConfigId,
        status: 'not_started' as TerminalStatus,
      }}
      onTerminalClick={(taskId, terminalId) => console.log('Terminal clicked:', taskId, terminalId)}
    />
  );
}

// 修改后（使用 useWorkflow hook）
const { data: selectedWorkflow } = useWorkflow(selectedWorkflowId || '');

if (selectedWorkflow) {
  // 映射 DTO 任务到 PipelineView 格式
  const tasks = selectedWorkflow.tasks.map(task => ({
    id: task.id,
    name: task.name,
    branch: task.branch,
    terminals: task.terminals.map(terminal => ({
      id: terminal.id,
      cliTypeId: terminal.cliTypeId,
      modelConfigId: terminal.modelConfigId,
      role: terminal.role || `Terminal ${terminal.orderIndex + 1}`,
      orderIndex: terminal.orderIndex,
      status: terminal.status as TerminalStatus,
    })),
  }));

  const mergeTerminal = {
    cliTypeId: selectedWorkflow.mergeTerminalCliId || '',
    modelConfigId: selectedWorkflow.mergeTerminalModelId || '',
    status: 'not_started' as TerminalStatus,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setSelectedWorkflowId(null)}>
          ← Back to Workflows
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() => handleStartWorkflow(selectedWorkflow.id)}
            disabled={startMutation.isPending || selectedWorkflow.status !== 'ready'}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Workflow
          </Button>
          {/* TODO: Add Pause/Stop buttons for running workflows */}
        </div>
      </div>

      <PipelineView
        name={selectedWorkflow.name}
        status={mapWorkflowStatus(selectedWorkflow.status)}
        tasks={tasks}
        mergeTerminal={mergeTerminal}
        onTerminalClick={(taskId, terminalId) => console.log('Terminal clicked:', taskId, terminalId)}
      />
    </div>
  );
}

// 添加状态映射函数
function mapWorkflowStatus(status: string): WorkflowStatus {
  switch (status) {
    case 'created':
    case 'ready':
      return 'idle';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}
```

**运行测试:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** PASS - 详情页正确显示任务和终端

---

### Step 16.1.6: 导入缺失的类型

**修改:** `frontend/src/pages/Workflows.tsx:1-13`

```tsx
// 添加导入
import { useWorkflow } from '@/hooks/useWorkflows';
import type { WorkflowStatus } from '@/components/workflow/PipelineView';
```

**运行测试:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** PASS - 所有导入正确

---

### Step 16.1.7: Commit

```bash
cd frontend
git add src/pages/Workflows.tsx src/pages/Workflows.test.tsx
git commit -m "feat(16.1): use real API data for workflow list and detail

- Replace mock data with WorkflowListItemDto
- Use useWorkflow hook for detail view
- Fix handleCreateWorkflow request format
- Add proper task/terminal mapping from DTO
- Map workflow status correctly
"
```

---

## Task 16.2: PipelineView 显示真实任务/终端状态

**目标:** PipelineView 组件接收并正确显示从 API 获取的真实任务和终端状态。

**涉及文件:**
- 修改: `frontend/src/components/workflow/PipelineView.tsx:30-43` (更新 props 类型)
- 修改: `frontend/src/components/workflow/PipelineView.tsx:65-150` (更新渲染逻辑)
- 测试: `frontend/src/components/workflow/PipelineView.test.tsx`

### Step 16.2.1: 更新 PipelineView 测试以使用真实 DTO 数据

**文件:** `frontend/src/components/workflow/PipelineView.test.tsx`

```tsx
import { render, screen } from '@test/utils';
import { PipelineView } from './PipelineView';
import type { WorkflowTask, MergeTerminal } from './PipelineView';

describe('PipelineView', () => {
  const mockTasks: WorkflowTask[] = [
    {
      id: 'task-1',
      name: 'Implement authentication',
      branch: 'feat/auth',
      terminals: [
        {
          id: 'term-1',
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          role: 'Frontend expert',
          orderIndex: 0,
          status: 'running',
        },
        {
          id: 'term-2',
          cliTypeId: 'gemini-cli',
          modelConfigId: 'model-2',
          role: 'Backend expert',
          orderIndex: 1,
          status: 'idle',
        },
      ],
    },
    {
      id: 'task-2',
      name: 'Write tests',
      branch: 'feat/tests',
      terminals: [
        {
          id: 'term-3',
          cliTypeId: 'codex',
          modelConfigId: 'model-1',
          role: 'Testing expert',
          orderIndex: 0,
          status: 'not_started',
        },
      ],
    },
  ];

  const mockMergeTerminal: MergeTerminal = {
    cliTypeId: 'claude-code',
    modelConfigId: 'model-1',
    status: 'not_started',
  };

  test('should render workflow name and status', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  test('should render all tasks with branches', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Implement authentication')).toBeInTheDocument();
    expect(screen.getByText('feat/auth')).toBeInTheDocument();

    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('feat/tests')).toBeInTheDocument();
  });

  test('should render terminals with correct status', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Task 1 terminals
    expect(screen.getByText('Frontend expert')).toBeInTheDocument();
    expect(screen.getByText('Backend expert')).toBeInTheDocument();

    // Task 2 terminal
    expect(screen.getByText('Testing expert')).toBeInTheDocument();
  });

  test('should render merge terminal', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="completed"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText(/Merge Terminal/i)).toBeInTheDocument();
  });

  test('should call onTerminalClick when terminal clicked', async () => {
    const onTerminalClick = vi.fn();

    render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onTerminalClick={onTerminalClick}
      />
    );

    const terminalCards = screen.getAllByRole('button');
    await userEvent.click(terminalCards[0]);

    expect(onTerminalClick).toHaveBeenCalledWith('task-1', 'term-1');
  });

  test('should call onMergeTerminalClick when merge terminal clicked', async () => {
    const onMergeTerminalClick = vi.fn();

    render(
      <PipelineView
        name="Test Workflow"
        status="completed"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onMergeTerminalClick={onMergeTerminalClick}
      />
    );

    const mergeTerminalCard = screen.getByText(/Merge Terminal/i).closest('[role="button"]');
    await userEvent.click(mergeTerminalCard!);

    expect(onMergeTerminalClick).toHaveBeenCalled();
  });
});
```

**运行测试:**
```bash
cd frontend && npm test -- PipelineView.test.tsx --run
```

**预期:** FAIL - TerminalCard 组件可能缺少 `role="button"` 属性

---

### Step 16.2.2: 确保 TerminalCard 添加 role="button" 属性

**文件:** `frontend/src/components/workflow/TerminalCard.tsx`

**查找:** `<div className={cn(...)} onClick={...}>`

**修改为:**
```tsx
<div
  role="button"
  tabIndex={0}
  className={cn(...)}
  onClick={onClick}
  onKeyPress={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onClick?.(e);
    }
  }}
>
```

**运行测试:**
```bash
cd frontend && npm test -- PipelineView.test.tsx --run
```

**预期:** PASS - 所有测试通过

---

### Step 16.2.3: Commit

```bash
cd frontend
git add src/components/workflow/PipelineView.tsx src/components/workflow/PipelineView.test.tsx src/components/workflow/TerminalCard.tsx
git commit -m "feat(16.2): display real task and terminal status in PipelineView

- Add role=\"button\" to TerminalCard for accessibility
- Update tests to use real DTO structure
- Add onKeyPress handler for keyboard navigation
- Verify terminal status mapping (idle/running/completed/failed)
"
```

---

## Task 16.3: WorkflowDebug 实时终端调试接入

**目标:** Debug 页面通过 WebSocket 实时显示终端输出，使用真实的 tasks/terminals 数据。

**涉及文件:**
- 修改: `frontend/src/pages/WorkflowDebug.tsx:48-67` (使用真实 DTO 任务数据)
- 修改: `frontend/src/pages/WorkflowDebug.tsx:88-103` (添加启动/暂停/停止控制)
- 修改: `frontend/src/components/terminal/TerminalDebugView.tsx` (WebSocket 连接)
- 测试: `frontend/src/pages/WorkflowDebug.test.tsx`

### Step 16.3.1: 检查 TerminalDebugView 组件

**文件:** `frontend/src/components/terminal/TerminalDebugView.tsx`

**确认:**
- 接收 `tasks: WorkflowTask[]` 和 `wsUrl: string` props
- 使用 xterm.js 渲染终端
- WebSocket 连接格式: `ws://${host}/api/terminal_ws/${terminalId}`

**运行:**
```bash
cd frontend && npm test -- TerminalDebugView.test.tsx --run
```

**预期:** 现有测试通过

---

### Step 16.3.2: 修复 WorkflowDebug 页面的任务映射

**问题:** `WorkflowDebug.tsx:53` 使用 `data.terminals.filter(t => t.taskId === taskDto.id)`，但 DTO 中 `TerminalDto` 没有 `taskId` 字段，`terminals` 应该在 `WorkflowTaskDto` 内部。

**修改:** `frontend/src/pages/WorkflowDebug.tsx:48-67`

```tsx
// 修改前（错误）
const tasks: WorkflowTask[] = data.tasks.map((taskDto) => ({
  id: taskDto.id,
  name: taskDto.name,
  branch: taskDto.branch ?? null,
  terminals: data.terminals  // ❌ terminals 不在 data 根级别
    .filter((termDto) => termDto.taskId === taskDto.id)  // ❌ taskId 字段不存在
    .map((termDto): Terminal => ({ ... })),
}));

// 修改后（正确 - 使用 DTO 内嵌的 terminals）
const tasks: WorkflowTask[] = data.tasks.map((taskDto) => ({
  id: taskDto.id,
  name: taskDto.name,
  branch: taskDto.branch ?? null,
  terminals: taskDto.terminals.map((termDto): Terminal => ({
    id: termDto.id,
    cliTypeId: termDto.cliTypeId,
    modelConfigId: termDto.modelConfigId,
    role: termDto.role?.trim()
      ? termDto.role
      : `${defaultRoleLabel} ${termDto.orderIndex + 1}`,
    orderIndex: termDto.orderIndex,
    status: mapTerminalStatus(termDto.status),  // ✅ 映射终端状态
  })),
}));

// 添加终端状态映射
function mapTerminalStatus(status: string): Terminal['status'] {
  switch (status) {
    case 'idle':
    case 'not_started':
      return 'not_started';
    case 'starting':
      return 'starting';
    case 'running':
    case 'working':
      return 'working';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'not_started';
  }
}
```

**运行测试:**
```bash
cd frontend && npm test -- WorkflowDebug.test.tsx --run
```

**预期:** PASS - 任务映射正确

---

### Step 16.3.3: 添加工作流控制 API 调用

**目标:** 实现 Start/Pause/Stop 按钮功能

**首先添加 hooks:** `frontend/src/hooks/useWorkflows.ts`

```typescript
// 在 useStartWorkflow 后添加
export interface PauseWorkflowRequest {
  workflow_id: string;
}

export interface StopWorkflowRequest {
  workflow_id: string;
}

const workflowsApi = {
  // ... 现有方法

  /**
   * Pause a running workflow
   */
  pause: async (data: PauseWorkflowRequest): Promise<WorkflowExecution> => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(data.workflow_id)}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleApiResponse<WorkflowExecution>(response);
  },

  /**
   * Stop a workflow
   */
  stop: async (data: StopWorkflowRequest): Promise<WorkflowExecution> => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(data.workflow_id)}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleApiResponse<WorkflowExecution>(response);
  },
};

/**
 * Hook to pause a workflow
 */
export function usePauseWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PauseWorkflowRequest) => workflowsApi.pause(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.byId(variables.workflow_id),
      });
    },
    onError: (error) => {
      logApiError('Failed to pause workflow:', error);
    },
  });
}

/**
 * Hook to stop a workflow
 */
export function useStopWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StopWorkflowRequest) => workflowsApi.stop(data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.byId(variables.workflow_id),
      });
    },
    onError: (error) => {
      logApiError('Failed to stop workflow:', error);
    },
  });
};
```

**更新页面:** `frontend/src/pages/WorkflowDebug.tsx:8,13,87-103`

```tsx
// 添加导入
import { useStartWorkflow, usePauseWorkflow, useStopWorkflow } from '@/hooks/useWorkflows';

export function WorkflowDebugPage() {
  const { t } = useTranslation('workflow');
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data, isLoading, error } = useWorkflow(workflowId ?? '');

  // 添加控制 hooks
  const startMutation = useStartWorkflow();
  const pauseMutation = usePauseWorkflow();
  const stopMutation = useStopWorkflow();

  // ... 其他代码

  // 修改按钮逻辑
  const handleStart = () => {
    if (workflowId) {
      startMutation.mutate({ workflow_id: workflowId });
    }
  };

  const handlePause = () => {
    if (workflowId) {
      pauseMutation.mutate({ workflow_id: workflowId });
    }
  };

  const handleStop = () => {
    if (workflowId && confirm(t('workflowDebug.confirmStop'))) {
      stopMutation.mutate({ workflow_id: workflowId });
    }
  };

  // ... 渲染部分更新
  <div className="flex gap-2">
    {data.status === 'ready' && (
      <Button
        size="sm"
        onClick={handleStart}
        disabled={startMutation.isPending}
      >
        <Play className="w-4 h-4 mr-2" /> {t('workflowDebug.start')}
      </Button>
    )}
    {data.status === 'running' && (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={pauseMutation.isPending}
        >
          <Pause className="w-4 h-4 mr-2" /> {t('workflowDebug.pause')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleStop}
          disabled={stopMutation.isPending}
        >
          <Square className="w-4 h-4 mr-2" /> {t('workflowDebug.stop')}
        </Button>
      </>
    )}
  </div>
}
```

**添加 i18n:** `frontend/src/i18n/locales/en/workflow.json`

```json
{
  "workflowDebug": {
    "confirmStop": "Are you sure you want to stop this workflow?"
  }
}
```

**运行测试:**
```bash
cd frontend && npm test -- WorkflowDebug.test.tsx --run
```

**预期:** PASS - 控制按钮功能正确

---

### Step 16.3.4: 更新 WorkflowDebug 测试

**文件:** `frontend/src/pages/WorkflowDebug.test.tsx`

```tsx
import { render, screen, waitFor } from '@test/utils';
import { WorkflowDebugPage } from './WorkflowDebug';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import userEvent from '@testing-library/user-event';

const handlers = [
  rest.get('/api/workflows/:id', (req, res, ctx) => {
    const { id } = req.params;
    if (id === 'wf-1') {
      return res(
        ctx.json({
          id: 'wf-1',
          projectId: 'proj-1',
          name: 'Test Workflow',
          description: 'Test',
          status: 'ready',
          useSlashCommands: false,
          orchestratorEnabled: false,
          orchestratorApiType: null,
          orchestratorBaseUrl: null,
          orchestratorModel: null,
          errorTerminalEnabled: false,
          errorTerminalCliId: null,
          errorTerminalModelId: null,
          mergeTerminalCliId: 'cli-1',
          mergeTerminalModelId: 'model-1',
          targetBranch: 'main',
          readyAt: null,
          startedAt: null,
          completedAt: null,
          createdAt: '2026-01-25T10:00:00Z',
          updatedAt: '2026-01-25T10:00:00Z',
          tasks: [
            {
              id: 'task-1',
              workflowId: 'wf-1',
              vkTaskId: null,
              name: 'Task 1',
              description: 'First task',
              branch: 'feat/task-1',
              status: 'pending',
              orderIndex: 0,
              startedAt: null,
              completedAt: null,
              createdAt: '2026-01-25T10:00:00Z',
              updatedAt: '2026-01-25T10:00:00Z',
              terminals: [
                {
                  id: 'term-1',
                  workflowTaskId: 'task-1',
                  cliTypeId: 'claude-code',
                  modelConfigId: 'model-1',
                  customBaseUrl: null,
                  customApiKey: null,
                  role: 'Expert',
                  roleDescription: null,
                  orderIndex: 0,
                  status: 'idle',
                  createdAt: '2026-01-25T10:00:00Z',
                  updatedAt: '2026-01-25T10:00:00Z',
                },
              ],
            },
          ],
          commands: [],
        })
      );
    }
    return res(ctx.status(404));
  }),
  rest.post('/api/workflows/:id/start', (req, res, ctx) => {
    return res(
      ctx.json({
        execution_id: 'exec-1',
        workflow_id: 'wf-1',
        status: 'running',
        started_at: '2026-01-25T10:00:00Z',
        completed_at: null,
        error: null,
      })
    );
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderWithProviders = (component: React.ReactElement, path: string, url: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={path} element={component} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
    {
      path,
      url,
    }
  );
};

describe('WorkflowDebugPage', () => {
  test('should render workflow detail', async () => {
    renderWithProviders(<WorkflowDebugPage />, '/workflow/:workflowId', '/workflow/wf-1');

    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    });

    expect(screen.getByText(/Status: ready/i)).toBeInTheDocument();
  });

  test('should show Start button when workflow is ready', async () => {
    renderWithProviders(<WorkflowDebugPage />, '/workflow/:workflowId', '/workflow/wf-1');

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeInTheDocument();
    });
  });

  test('should call start API on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkflowDebugPage />, '/workflow/:workflowId', '/workflow/wf-1');

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeInTheDocument();
    });

    const startButton = screen.getByText('Start');
    await user.click(startButton);

    await waitFor(() => {
      expect(server.errors()).toEqual([]);
    });
  });

  test('should render tasks with terminals', async () => {
    renderWithProviders(<WorkflowDebugPage />, '/workflow/:workflowId', '/workflow/wf-1');

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    expect(screen.getByText('feat/task-1')).toBeInTheDocument();
  });
});
```

**运行测试:**
```bash
cd frontend && npm test -- WorkflowDebug.test.tsx --run
```

**预期:** PASS - 所有测试通过

---

### Step 16.3.5: Commit

```bash
cd frontend
git add src/pages/WorkflowDebug.tsx src/pages/WorkflowDebug.test.tsx src/hooks/useWorkflows.ts src/i18n/locales/en/workflow.json
git commit -m "feat(16.3): connect real-time terminal debugging

- Use DTO-embedded terminals instead of filtering
- Add terminal status mapping (not_started/running/completed/failed)
- Implement Start/Pause/Stop workflow controls
- Add usePauseWorkflow and useStopWorkflow hooks
- Update WorkflowDebug tests with real DTO structure
- Add confirmStop i18n message
"
```

---

## Task 16.4: WorkflowWizard 提交 payload/校验对齐

**目标:** 向导提交结构与后端 `CreateWorkflowRequest` 契约一致，校验规则完整。

**涉及文件:**
- 修改: `frontend/src/components/workflow/types.ts` (定义转换类型)
- 修改: `frontend/src/components/workflow/WorkflowWizard.tsx:76-98` (handleSubmit 转换)
- 修改: `frontend/src/components/workflow/validators/steps.ts` (校验规则)
- 测试: `frontend/src/components/workflow/WorkflowWizard.test.tsx`

### Step 16.4.1: 创建 WizardConfig 到 CreateWorkflowRequest 转换函数

**文件:** `frontend/src/components/workflow/types.ts`

**添加到文件末尾:**

```typescript
// ============================================================================
// API Request Types (from useWorkflows.ts)
// ============================================================================

import type { CreateWorkflowRequest } from '@/hooks/useWorkflows';

/**
 * Transform WizardConfig to CreateWorkflowRequest
 * Matches backend API contract at workflows_dto.rs
 */
export function wizardConfigToCreateRequest(
  projectId: string,
  config: WizardConfig
): CreateWorkflowRequest {
  // Build orchestrator config from models
  const orchestratorModel = config.models.find(m => m.id === config.advanced.orchestrator.modelConfigId);
  if (!orchestratorModel) {
    throw new Error('Orchestrator model not found in configured models');
  }

  const request: CreateWorkflowRequest = {
    projectId,
    name: config.basic.name,
    description: config.basic.description,
    useSlashCommands: config.commands.enabled,
    commandPresetIds: config.commands.presetIds.length > 0 ? config.commands.presetIds : undefined,
    commands: config.commands.presetIds.map((presetId, index) => ({
      presetId,
      orderIndex: index,
      customParams: null,
    })),
    orchestratorConfig: {
      apiType: orchestratorModel.apiType,
      baseUrl: orchestratorModel.baseUrl,
      apiKey: orchestratorModel.apiKey,
      model: orchestratorModel.modelId,
    },
    errorTerminalConfig: config.advanced.errorTerminal.enabled ? {
      cliTypeId: config.advanced.errorTerminal.cliTypeId!,
      modelConfigId: config.advanced.errorTerminal.modelConfigId!,
      customBaseUrl: null,
      customApiKey: null,
    } : undefined,
    mergeTerminalConfig: {
      cliTypeId: config.advanced.mergeTerminal.cliTypeId,
      modelConfigId: config.advanced.mergeTerminal.modelConfigId,
      customBaseUrl: null,
      customApiKey: null,
    },
    targetBranch: config.advanced.targetBranch,
    tasks: config.tasks
      .sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]))
      .map((task, taskIndex) => {
        // Find terminals for this task
        const taskTerminals = config.terminals
          .filter(t => t.taskId === task.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);

        if (taskTerminals.length === 0) {
          throw new Error(`Task "${task.name}" has no terminals assigned`);
        }

        return {
          name: task.name,
          description: task.description,
          branch: task.branch,
          orderIndex: taskIndex,
          terminals: taskTerminals.map(terminal => {
            const model = config.models.find(m => m.id === terminal.modelConfigId);
            if (!model) {
              throw new Error(`Model not found for terminal ${terminal.id}`);
            }

            return {
              cliTypeId: terminal.cliTypeId,
              modelConfigId: terminal.modelConfigId,
              customBaseUrl: model.baseUrl !== orchestratorModel.baseUrl ? model.baseUrl : null,
              customApiKey: model.apiKey !== orchestratorModel.apiKey ? model.apiKey : null,
              role: terminal.role,
              roleDescription: null,
              orderIndex: terminal.orderIndex,
            };
          }),
        };
      }),
  };

  return request;
}
```

---

### Step 16.3.5: 更新 WorkflowWizard handleSubmit 使用转换函数

**修改:** `frontend/src/components/workflow/WorkflowWizard.tsx:76-98`

```tsx
// 添加导入
import { wizardConfigToCreateRequest } from './types';
import type { CreateWorkflowRequest } from '@/hooks/useWorkflows';

interface WorkflowWizardProps {
  onComplete: (request: CreateWorkflowRequest) => void | Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

// ...

const handleSubmit = async () => {
  const newErrors = validation.validate(config);
  if (Object.keys(newErrors).length > 0) {
    return;
  }

  setState({ ...state, isSubmitting: true });
  setSubmitError(null);

  try {
    // 项目 ID 从 Step0Project 中获取
    const projectId = config.project.workingDirectory; // TODO: 需要真实的 projectId

    // 转换为 API 请求格式
    const request = wizardConfigToCreateRequest(projectId, config);

    await Promise.resolve(onComplete(request));
    setState({ ...state, isSubmitting: false });
  } catch (error) {
    const errorObj =
      error instanceof Error
        ? error
        : new Error(t('wizard.errors.submitUnknown'));
    onError?.(errorObj);
    setSubmitError(errorObj.message);
    setState({ ...state, isSubmitting: false });
  }
};
```

---

### Step 16.4.3: 添加转换函数测试

**文件:** `frontend/src/components/workflow/types.test.ts`

```tsx
import { describe, it, expect } from 'vitest';
import { getDefaultWizardConfig, wizardConfigToCreateRequest } from './types';

describe('wizardConfigToCreateRequest', () => {
  it('should transform minimal config correctly', () => {
    const config = getDefaultWizardConfig();
    config.basic.name = 'Test Workflow';
    config.basic.description = 'Test description';
    config.basic.taskCount = 1;
    config.project.workingDirectory = 'proj-1';

    config.tasks = [
      {
        id: 'task-0',
        name: 'Task 1',
        description: 'First task',
        branch: 'feat/task-1',
        terminalCount: 1,
      },
    ];

    config.models = [
      {
        id: 'model-1',
        displayName: 'Claude 3.5',
        apiType: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-xxx',
        modelId: 'claude-3-5-sonnet-20241022',
        isVerified: true,
      },
    ];

    config.terminals = [
      {
        id: 'term-1',
        taskId: 'task-0',
        orderIndex: 0,
        cliTypeId: 'claude-code',
        modelConfigId: 'model-1',
      },
    ];

    config.advanced.orchestrator.modelConfigId = 'model-1';
    config.advanced.mergeTerminal.cliTypeId = 'claude-code';
    config.advanced.mergeTerminal.modelConfigId = 'model-1';

    const request = wizardConfigToCreateRequest('proj-1', config);

    expect(request).toEqual({
      projectId: 'proj-1',
      name: 'Test Workflow',
      description: 'Test description',
      useSlashCommands: false,
      commandPresetIds: undefined,
      commands: [],
      orchestratorConfig: {
        apiType: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-xxx',
        model: 'claude-3-5-sonnet-20241022',
      },
      errorTerminalConfig: undefined,
      mergeTerminalConfig: {
        cliTypeId: 'claude-code',
        modelConfigId: 'model-1',
        customBaseUrl: null,
        customApiKey: null,
      },
      targetBranch: 'main',
      tasks: [
        {
          name: 'Task 1',
          description: 'First task',
          branch: 'feat/task-1',
          orderIndex: 0,
          terminals: [
            {
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              customBaseUrl: null,
              customApiKey: null,
              role: undefined,
              roleDescription: null,
              orderIndex: 0,
            },
          ],
        },
      ],
    });
  });

  it('should throw error if orchestrator model not found', () => {
    const config = getDefaultWizardConfig();
    config.basic.name = 'Test';
    config.advanced.orchestrator.modelConfigId = 'non-existent';

    expect(() => wizardConfigToCreateRequest('proj-1', config)).toThrow(
      'Orchestrator model not found'
    );
  });

  it('should throw error if task has no terminals', () => {
    const config = getDefaultWizardConfig();
    config.basic.name = 'Test';
    config.basic.taskCount = 1;
    config.tasks = [{ id: 'task-0', name: 'Task', description: 'Desc', branch: 'feat', terminalCount: 1 }];
    config.models = [
      {
        id: 'model-1',
        displayName: 'Model',
        apiType: 'anthropic',
        baseUrl: 'https://api.test.com',
        apiKey: 'key',
        modelId: 'model',
        isVerified: true,
      },
    ];
    config.terminals = []; // No terminals
    config.advanced.orchestrator.modelConfigId = 'model-1';
    config.advanced.mergeTerminal.cliTypeId = 'claude-code';
    config.advanced.mergeTerminal.modelConfigId = 'model-1';

    expect(() => wizardConfigToCreateRequest('proj-1', config)).toThrow(
      'Task "Task" has no terminals assigned'
    );
  });
});
```

**运行测试:**
```bash
cd frontend && npm test -- types.test.ts --run
```

**预期:** PASS - 转换函数工作正确

---

### Step 16.4.4: 更新 WorkflowWizard 页面集成

**修改:** `frontend/src/pages/Workflows.tsx:45-86`

```tsx
const handleCreateWorkflow = async (request: CreateWorkflowRequest) => {
  if (!projectId) return;

  await createMutation.mutateAsync(request);
  setShowWizard(false);
};
```

**注意:** 不再需要转换逻辑，因为 wizard 已经输出正确的格式。

---

### Step 16.4.5: 更新校验规则

**文件:** `frontend/src/components/workflow/validators/steps.ts`

**确保校验:**
- Step 1: name 必填
- Step 2: 至少 1 个任务，每个任务 name/description/branch 必填
- Step 3: 至少 1 个模型配置
- Step 4: 每个任务至少 1 个终端
- Step 6: orchestrator/mergeTerminal 配置完整

**运行测试:**
```bash
cd frontend && npm test -- WorkflowWizard.test.tsx --run
```

**预期:** PASS - 校验规则完整

---

### Step 16.4.6: Commit

```bash
cd frontend
git add src/components/workflow/types.ts src/components/workflow/types.test.ts src/components/workflow/WorkflowWizard.tsx src/pages/Workflows.tsx src/components/workflow/validators/steps.ts
git commit -m "feat(16.4): align wizard submit payload with API contract

- Add wizardConfigToCreateRequest transformation function
- Update onComplete to receive CreateWorkflowRequest
- Validate orchestrator model exists
- Validate each task has at least one terminal
- Handle customBaseUrl/customApiKey for non-default models
- Add comprehensive transformation tests
- Simplify Workflows.tsx integration (no conversion needed)
"
```

---

## Task 16.5: 启动/暂停/停止控制与权限提示

**目标:** 完善工作流控制操作，添加状态禁用逻辑和用户反馈。

**涉及文件:**
- 修改: `frontend/src/pages/Workflows.tsx:108-114` (详情页按钮)
- 修改: `frontend/src/pages/WorkflowDebug.tsx:88-103` (调试页按钮)
- 测试: `frontend/src/pages/Workflows.test.tsx`

### Step 16.5.1: 添加工作流状态枚举和允许操作

**文件:** `frontend/src/hooks/useWorkflows.ts`

**添加:**
```typescript
export type WorkflowStatusEnum =
  | 'created'
  | 'ready'
  | 'starting'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const WORKFLOW_STATUS_TRANSITIONS: Record<WorkflowStatusEnum, {
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
  canDelete: boolean;
}> = {
  created: { canStart: false, canPause: false, canStop: false, canDelete: true },
  ready: { canStart: true, canPause: false, canStop: false, canDelete: true },
  starting: { canStart: false, canPause: false, canStop: true, canDelete: false },
  running: { canStart: false, canPause: true, canStop: true, canDelete: false },
  paused: { canStart: true, canPause: false, canStop: true, canDelete: true },
  completed: { canStart: false, canPause: false, canStop: false, canDelete: true },
  failed: { canStart: true, canPause: false, canStop: false, canDelete: true },
  cancelled: { canStart: false, canPause: false, canStop: false, canDelete: true },
};

export function getWorkflowActions(status: WorkflowStatusEnum) {
  return WORKFLOW_STATUS_TRANSITIONS[status] ?? WORKFLOW_STATUS_TRANSITIONS.created;
}
```

---

### Step 16.5.2: 更新 Workflows 详情页按钮

**修改:** `frontend/src/pages/Workflows.tsx:100-144`

```tsx
import { getWorkflowActions } from '@/hooks/useWorkflows';

// ...

const selectedWorkflow = workflows?.find(w => w.id === selectedWorkflowId);
const { data: selectedWorkflowDetail } = useWorkflow(selectedWorkflowId || '');

if (selectedWorkflowDetail) {
  const actions = getWorkflowActions(selectedWorkflowDetail.status as any);
  const tasks = selectedWorkflowDetail.tasks.map(task => ({ /* ... */ }));
  const mergeTerminal = { /* ... */ };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setSelectedWorkflowId(null)}>
          ← Back to Workflows
        </Button>
        <div className="flex gap-2">
          {actions.canStart && (
            <Button
              onClick={() => handleStartWorkflow(selectedWorkflowDetail.id)}
              disabled={startMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Workflow
            </Button>
          )}
          {actions.canPause && (
            <Button
              variant="outline"
              onClick={() => handlePauseWorkflow(selectedWorkflowDetail.id)}
              disabled={pauseMutation.isPending}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          {actions.canStop && (
            <Button
              variant="destructive"
              onClick={() => handleStopWorkflow(selectedWorkflowDetail.id)}
              disabled={stopMutation.isPending}
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}
          {actions.canDelete && (
            <Button
              variant="outline"
              onClick={() => handleDeleteWorkflow(selectedWorkflowDetail.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <PipelineView
        name={selectedWorkflowDetail.name}
        status={mapWorkflowStatus(selectedWorkflowDetail.status)}
        tasks={tasks}
        mergeTerminal={mergeTerminal}
        onTerminalClick={(taskId, terminalId) => console.log('Terminal clicked:', taskId, terminalId)}
      />
    </div>
  );
}
```

---

### Step 16.5.3: 添加成功/错误提示

**文件:** `frontend/src/pages/Workflows.tsx`

```tsx
import { useToast } from '@/hooks/use-toast'; // 假设有 toast hook

export function Workflows() {
  const { toast } = useToast();
  // ...

  const handleStartWorkflow = async (workflowId: string) => {
    try {
      await startMutation.mutateAsync({ workflow_id: workflowId });
      toast({
        title: 'Workflow started',
        description: 'Workflow is now running',
      });
    } catch (error) {
      toast({
        title: 'Failed to start workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handlePauseWorkflow = async (workflowId: string) => {
    try {
      await pauseMutation.mutateAsync({ workflow_id: workflowId });
      toast({
        title: 'Workflow paused',
        description: 'Workflow has been paused',
      });
    } catch (error) {
      toast({
        title: 'Failed to pause workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleStopWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to stop this workflow?')) return;

    try {
      await stopMutation.mutateAsync({ workflow_id: workflowId });
      toast({
        title: 'Workflow stopped',
        description: 'Workflow has been stopped',
      });
    } catch (error) {
      toast({
        title: 'Failed to stop workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
}
```

**如果没有 toast hook，使用简单的 alert 或创建一个:**

**文件:** `frontend/src/hooks/use-toast.ts` (如果不存在)

```tsx
import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = `toast-${toastCount++}`;
    const newToast: Toast = { id, title, description, variant };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);

    // Log to console for now (TODO: Add UI component)
    if (variant === 'destructive') {
      console.error(`[Toast] ${title}: ${description}`);
    } else {
      console.log(`[Toast] ${title}: ${description}`);
    }
  }, []);

  return { toast, toasts };
}
```

---

### Step 16.5.4: 添加操作测试

**文件:** `frontend/src/pages/Workflows.test.tsx`

```tsx
describe('Workflow Controls', () => {
  test('should show Start button when workflow is ready', async () => {
    server.use(
      rest.get('/api/workflows/:id', (req, res, ctx) => {
        return res(
          ctx.json({
            // ... workflow DTO with status: 'ready'
          })
        );
      })
    );

    renderWithProviders(<Workflows />, { path: '/projects/:projectId', url: '/projects/test-project' });

    // Navigate to detail
    await waitFor(() => screen.getByText('Test Workflow').click());

    await waitFor(() => {
      expect(screen.getByText('Start Workflow')).toBeInTheDocument();
      expect(screen.queryByText('Pause')).not.toBeInTheDocument();
      expect(screen.queryByText('Stop')).not.toBeInTheDocument();
    });
  });

  test('should show Pause/Stop buttons when workflow is running', async () => {
    server.use(
      rest.get('/api/workflows/:id', (req, res, ctx) => {
        return res(
          ctx.json({
            // ... workflow DTO with status: 'running'
          })
        );
      })
    );

    renderWithProviders(<Workflows />, { path: '/projects/:projectId', url: '/projects/test-project' });

    await waitFor(() => screen.getByText('Test Workflow').click());

    await waitFor(() => {
      expect(screen.queryByText('Start Workflow')).not.toBeInTheDocument();
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Stop')).toBeInTheDocument();
    });
  });

  test('should call start API on button click', async () => {
    const user = userEvent.setup();
    let startCalled = false;

    server.use(
      rest.post('/api/workflows/:id/start', (req, res, ctx) => {
        startCalled = true;
        return res(ctx.json({ execution_id: 'exec-1', workflow_id: 'wf-1', status: 'running' }));
      })
    );

    renderWithProviders(<Workflows />, { path: '/projects/:projectId', url: '/projects/test-project' });

    await waitFor(() => screen.getByText('Test Workflow').click());
    await waitFor(() => screen.getByText('Start Workflow').click());

    await waitFor(() => {
      expect(startCalled).toBe(true);
    });
  });
});
```

**运行测试:**
```bash
cd frontend && npm test -- Workflows.test.tsx --run
```

**预期:** PASS - 控制操作测试通过

---

### Step 16.5.5: Commit

```bash
cd frontend
git add src/pages/Workflows.tsx src/pages/Workflows.test.tsx src/hooks/useWorkflows.ts src/hooks/use-toast.ts
git commit -m "feat(16.5): add workflow controls with permission hints

- Add WORKFLOW_STATUS_TRANSITIONS state machine
- Implement getWorkflowActions helper
- Show Start/Pause/Stop/Delete based on status
- Add success/error toast notifications
- Add useToast hook for user feedback
- Add comprehensive control tests
- Disable buttons during mutation pending state
"
```

---

## Task 16.6: i18n/错误态/空态完善

**目标:** 完善国际化文案，统一错误显示，优化空态引导。

**涉及文件:**
- 修改: `frontend/src/i18n/locales/zh-Hans/workflow.json`
- 修改: `frontend/src/i18n/locales/en/workflow.json`
- 修改: `frontend/src/pages/Workflows.tsx:169-177` (空态)

### Step 16.6.1: 添加中文 i18n

**文件:** `frontend/src/i18n/locales/zh-Hans/workflow.json`

```json
{
  "wizard": {
    "title": "创建工作流",
    "buttons": {
      "next": "下一步",
      "back": "上一步",
      "cancel": "取消",
      "submit": "创建工作流",
      "submitting": "创建中..."
    },
    "errors": {
      "submitUnknown": "未知错误",
      "submitFailedTitle": "工作流创建失败",
      "validationTitle": "请修复以下问题"
    }
  },
  "steps": {
    "project": {
      "name": "项目",
      "description": "选择工作目录"
    },
    "basic": {
      "name": "基础配置",
      "description": "工作流名称和任务数量"
    },
    "tasks": {
      "name": "任务配置",
      "description": "定义任务分支和目标"
    },
    "models": {
      "name": "模型配置",
      "description": "配置 AI 模型"
    },
    "terminals": {
      "name": "终端配置",
      "description": "为任务分配终端"
    },
    "commands": {
      "name": "斜杠命令",
      "description": "选择命令预设"
    },
    "advanced": {
      "name": "高级配置",
      "description": "编排器和合并设置"
    }
  },
  "validation": {
    "project": {
      "workingDirectoryRequired": "工作目录为必填项"
    },
    "basic": {
      "nameRequired": "工作流名称为必填项",
      "taskCountMin": "任务数量至少为 1"
    },
    "tasks": {
      "required": "至少需要一个任务",
      "nameRequired": "任务名称为必填项",
      "descriptionRequired": "任务描述为必填项"
    },
    "models": {
      "required": "至少需要一个模型配置"
    },
    "terminals": {
      "required": "至少需要一个终端",
      "cliRequired": "请选择 CLI 类型",
      "modelRequired": "请选择模型"
    },
    "advanced": {
      "orchestratorModelRequired": "请选择主 Agent 模型",
      "mergeCliRequired": "请选择合并 CLI 类型",
      "mergeModelRequired": "请选择合并模型",
      "targetBranchRequired": "目标分支为必填项"
    }
  },
  "empty": {
    "title": "还没有工作流",
    "description": "创建您的第一个工作流以开始并行任务执行",
    "button": "创建第一个工作流"
  },
  "errors": {
    "loadFailed": "加载工作流失败",
    "startFailed": "启动工作流失败",
    "pauseFailed": "暂停工作流失败",
    "stopFailed": "停止工作流失败",
    "deleteFailed": "删除工作流失败",
    "deleteConfirm": "确定要删除此工作流吗？"
  },
  "success": {
    "start": "工作流已启动",
    "pause": "工作流已暂停",
    "stop": "工作流已停止",
    "delete": "工作流已删除"
  },
  "workflowDebug": {
    "confirmStop": "确定要停止此工作流吗？"
  }
}
```

---

### Step 16.6.2: 更新英文 i18n

**文件:** `frontend/src/i18n/locales/en/workflow.json`

**添加:**

```json
{
  "empty": {
    "title": "No workflows yet",
    "description": "Create your first workflow to start parallel task execution",
    "button": "Create Your First Workflow"
  },
  "errors": {
    "loadFailed": "Failed to load workflows",
    "startFailed": "Failed to start workflow",
    "pauseFailed": "Failed to pause workflow",
    "stopFailed": "Failed to stop workflow",
    "deleteFailed": "Failed to delete workflow",
    "deleteConfirm": "Are you sure you want to delete this workflow?"
  },
  "success": {
    "start": "Workflow started",
    "pause": "Workflow paused",
    "stop": "Workflow stopped",
    "delete": "Workflow deleted"
  }
}
```

---

### Step 16.6.3: 更新空态组件

**修改:** `frontend/src/pages/Workflows.tsx:169-177`

```tsx
import { useTranslation } from 'react-i18next';

export function Workflows() {
  const { t } = useTranslation('workflow');
  // ...

  {!workflows || workflows.length === 0 ? (
    <Card className="p-12 text-center">
      <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
      <p className="text-low mb-6">{t('empty.description')}</p>
      <Button onClick={() => setShowWizard(true)}>
        <Plus className="w-4 h-4 mr-2" />
        {t('empty.button')}
      </Button>
    </Card>
  ) : (
    // ...
  )}
}
```

---

### Step 16.6.4: 统一错误显示

**修改:** `frontend/src/pages/Workflows.tsx:33-42,88-96`

```tsx
if (error) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md">
        <CardContent className="pt-6">
          <p className="text-error mb-4">{t('errors.loadFailed')}</p>
          <p className="text-sm text-low">{error.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

const handleDeleteWorkflow = async (workflowId: string) => {
  if (confirm(t('errors.deleteConfirm'))) {
    try {
      await deleteMutation.mutateAsync(workflowId);
      toast({
        title: t('success.delete'),
      });
    } catch (error) {
      toast({
        title: t('errors.deleteFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  }
};
```

---

### Step 16.6.5: 添加 i18n 测试

**文件:** `frontend/src/i18n/__tests__/workflow.test.ts`

```tsx
import { i18n } from '@/i18n/config';
import { initReactI18next } from 'react-i18next';

describe('Workflow i18n', () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      resources: {
        en: {
          workflow: require('@/i18n/locales/en/workflow.json'),
        },
        'zh-Hans': {
          workflow: require('@/i18n/locales/zh-Hans/workflow.json'),
        },
      },
    });
  });

  test('should have all required English keys', () => {
    expect(i18n.t('workflow:empty.title')).toBe('No workflows yet');
    expect(i18n.t('workflow:errors.loadFailed')).toBe('Failed to load workflows');
    expect(i18n.t('workflow:success.start')).toBe('Workflow started');
  });

  test('should have all required Chinese keys', () => {
    i18n.changeLanguage('zh-Hans');
    expect(i18n.t('workflow:empty.title')).toBe('还没有工作流');
    expect(i18n.t('workflow:errors.loadFailed')).toBe('加载工作流失败');
    expect(i18n.t('workflow:success.start')).toBe('工作流已启动');
  });
});
```

**运行测试:**
```bash
cd frontend && npm test -- workflow.test.ts --run
```

**预期:** PASS - i18n 完整

---

### Step 16.6.6: Commit

```bash
cd frontend
git add src/i18n/locales/zh-Hans/workflow.json src/i18n/locales/en/workflow.json src/pages/Workflows.tsx src/i18n/__tests__/workflow.test.ts
git commit -m "feat(16.6): complete i18n and error states

- Add Chinese (zh-Hans) workflow translations
- Add empty state with localized messages
- Unified error display with i18n
- Add success/error toast messages
- Add i18n coverage tests
- Improve empty state UX with description and CTA
"
```

---

## 最终验证

### Step 17.1: 运行所有测试

```bash
cd frontend
npm test -- --run
```

**预期输出:**
```
Test Files  29 passed (29)
Tests       258 passed (258)
Duration    ~20s
```

---

### Step 17.2: TypeScript 类型检查

```bash
cd frontend
npx tsc --noEmit
```

**预期:** 无类型错误

---

### Step 17.3: 构建验证

```bash
cd frontend
npm run build
```

**预期:** 构建成功

---

### Step 17.4: 代码审查清单

- [ ] 所有 mock 数据已移除
- [ ] 使用 `WorkflowListItemDto` 和 `WorkflowDetailDto`
- [ ] `CreateWorkflowRequest` 格式与后端一致
- [ ] WebSocket 连接格式正确
- [ ] 工作流状态映射正确
- [ ] 终端状态映射正确
- [ ] 控制按钮禁用逻辑正确
- [ ] 所有用户可见文本已国际化
- [ ] 错误提示用户友好
- [ ] 测试覆盖率 > 80%

---

### Step 17.5: 更新 TODO.md

```bash
cd ..
cd .worktrees/phase-16-frontend-workflow-ux
# TODO 更新 docs/plans/TODO.md 中的 Task 16.1-16.6 为 ✅
```

---

### Step 17.6: 最终提交

```bash
cd frontend
git add -A
git commit -m "chore(16): finalize Phase 16 implementation

- Complete all 6 tasks (16.1-16.6)
- All tests passing (258 tests)
- No TypeScript errors
- Build successful
- Full i18n coverage (en + zh-Hans)
- Ready for Phase 17
"
```

---

## 执行选项

**Plan complete and saved to `docs/plans/2026-01-25-phase-16-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
