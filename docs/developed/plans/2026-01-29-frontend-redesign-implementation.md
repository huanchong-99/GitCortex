# GitCortex 前端重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 将前端从 Vibe Kanban 任务看板重构为 GitCortex 工作流编排系统，严格遵循 `2026-01-16-orchestrator-design.md` 设计文档

**架构:** 删除所有 vibe-kanban 遗留代码，保留已实现的 GitCortex 功能（Workflow/Terminal/Orchestrator），按照设计文档重建 UI/UX

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI, Zustand, React Query, xterm.js, WebSocket

---

## 📋 目录

1. [问题分析](#问题分析)
2. [删除 Vibe Kanban 遗留](#删除-vibe-kanban-遗留)
3. [保留的 GitCortex 功能](#保留的-gitcortex-功能)
4. [新页面实施计划](#新页面实施计划)
5. [组件重构计划](#组件重构计划)
6. [路由重构](#路由重构)
7. [样式与主题](#样式与主题)
8. [测试策略](#测试策略)

---

## 问题分析

### 当前状态

**问题 1: 路由结构错误**
- 当前主路由: `/projects` (项目列表)
- 设计要求: `/board` (工作流看板)

**问题 2: 看板视角错误**
- 当前: 任务视角 (todo/inprogress/inreview/done)
- 设计要求: 工作流视角 (created/ready/running/completed)

**问题 3: 页面布局错误**
- 当前: 项目卡片 + 任务看板
- 设计要求: 工作流列表 + 工作流看板 + 底部状态栏

**问题 4: 核心视图缺失**
- 流水线视图: 简化版，缺少 Orchestrator 头部
- 调试视图: 扁平终端列表，未按任务分组
- 向导 UI: 存在但不符合设计规范

### 设计文档关键要求

**路由架构**:
```
/ → /board (重定向)
/board - 工作流看板（主页）
/pipeline/:workflowId - 流水线视图
/debug/:workflowId - 终端调试视图
/wizard - 分步向导入口
/wizard/step/0 - 步骤0：工作目录
/wizard/step/1 - 步骤1：基础配置
/wizard/step/2 - 步骤2：任务配置
/wizard/step/3 - 步骤3：模型配置
/wizard/step/4 - 步骤4：终端配置
/wizard/step/5 - 步骤5：斜杠命令
/wizard/step/6 - 步骤6：高级配置
/settings/cli - CLI 配置
/settings/models - 模型配置
/settings/presets - 命令预设
```

**看板视图布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  GitCortex            [看板/流水线/调试 ▼]      [⚙️]        │
├─────────────────────────────────────────────────────────────┤
│  工作流列表  │  created  │  ready  │  running  │ completed │
│             │  [WF-1]   │  [WF-2]  │  [WF-3]   │   [WF-4]   │
│  ┌─────┐    │  Task-1  │  Task-3  │  Task-5  │  Task-7   │
│  │WF-1 │    │  Task-2  │  Task-4  │  Task-6  │           │
│  │WF-2 │    │          │          │          │           │
│  └─────┘    │          │          │          │           │
├─────────────────────────────────────────────────────────────┤
│  📡 终端实时活动面板                                              │
│  [T1] $ git status                                              │
│  [T2] ╭────────────────────────────────╮                        │
│  [T2] │ impl Login {                 │                        │
│  [T2] │   pub fn new()               │                        │
│  [T2] ╰────────────────────────────────╯                        │
├─────────────────────────────────────────────────────────────┤
│  ● Orchestrator Active | 3 Terminals Running | Tokens: 12.5k   │
└─────────────────────────────────────────────────────────────┘
```

---

## 删除 Vibe Kanban 遗留

### Task 1: 删除项目/任务管理页面

**Files to Delete:**
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/ProjectTasks.tsx`
- `frontend/src/components/projects/` (整个目录)
- `frontend/src/components/tasks/TaskKanbanBoard.tsx`
- `frontend/src/components/layout/TasksLayout.tsx`

**Step 1: 备份当前代码**
```bash
cd E:/GitCortex
git checkout -b frontend-redesign-backup
git add frontend/src/pages/Projects.tsx frontend/src/pages/ProjectTasks.tsx
git commit -m "backup: vibe-kanban project/task pages before deletion"
```

**Step 2: 删除文件**
```bash
cd E:/GitCortex/frontend
rm -rf src/components/projects
rm -f src/pages/Projects.tsx src/pages/ProjectTasks.tsx
rm -f src/components/tasks/TaskKanbanBoard.tsx
rm -f src/components/layout/TasksLayout.tsx
```

**Step 3: 更新 App.tsx 移除路由**
```typescript
// frontend/src/App.tsx
// 删除以下路由:
// <Route path="/projects" element={<Projects />} />
// <Route path="/projects/:projectId/tasks" element={<ProjectTasks />} />
```

**Step 4: 验证编译**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

Expected: PASS (如果其他页面不依赖这些文件)

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): remove vibe-kanban project/task management pages"
```

---

### Task 2: 删除 Vibe Kanban 特定组件

**Files to Delete:**
- `frontend/src/components/ui/shadcn-io/kanban/` (整个目录)
- `frontend/src/components/tasks/` (保留以后重构)
- `frontend/src/components/project/` (整个目录)

**Step 1: 删除 shadcn-io kanban 组件**
```bash
cd E:/GitCortex/frontend
rm -rf src/components/ui/shadcn-io/kanban
```

**Step 2: 删除项目相关组件**
```bash
cd E:/GitCortex/frontend
rm -rf src/components/project
```

**Step 3: 更新组件导出**
```typescript
// frontend/src/components/ui/shadcn-io/index.ts
// 删除: export * from './kanban';
```

**Step 4: 验证编译**
```bash
pnpm run check
```

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): remove vibe-kanban specific components"
```

---

### Task 3: 删除 vibe-kanban-companion 依赖

**Files to Modify:**
- `frontend/package.json`
- `frontend/src/main.tsx`

**Step 1: 从 package.json 删除依赖**
```bash
cd E:/GitCortex/frontend
# 编辑 package.json，删除:
"vibe-kanban-web-companion": "0.0.4",
```

**Step 2: 从 main.tsx 删除引用**
```typescript
// frontend/src/main.tsx
// 删除:
import '@vibe-kanban-web-companion';
```

**Step 3: 重新安装依赖**
```bash
cd E:/GitCortex/frontend
pnpm install
```

**Step 4: 验证编译**
```bash
pnpm run check
```

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): remove vibe-kanban-companion dependency"
```

---

## 保留的 GitCortex 功能

### Task 4: 验证保留的核心功能

**需要保留并验证的功能:**

1. **Workflow 管理**
   - `frontend/src/pages/Workflows.tsx`
   - `frontend/src/components/workflow/WorkflowWizard.tsx`
   - `frontend/src/components/workflow/PipelineView.tsx`

2. **Terminal 调试**
   - `frontend/src/pages/WorkflowDebug.tsx`
   - `frontend/src/components/terminal/TerminalDebugView.tsx`
   - `frontend/src/components/terminal/TerminalEmulator.tsx`

3. **Slash Commands**
   - `frontend/src/pages/SlashCommands.tsx`

4. **API 集成**
   - `frontend/src/hooks/useWorkflows.ts`
   - `frontend/src/hooks/useTerminals.ts`
   - `frontend/src/services/api.ts`

**Step 1: 检查这些文件的导入依赖**
```bash
cd E:/GitCortex/frontend
grep -r "from.*projects" src/
grep -r "from.*tasks" src/
grep -r "from.*TaskKanbanBoard" src/
```

Expected: 无输出（或者只在已删除的文件中）

**Step 2: 确保编译通过**
```bash
pnpm run build
```

Expected: PASS

---

## 新页面实施计划

### Task 5: 实现工作流看板视图（/board）

**目标:** 创建符合设计文档的主看板页面

**Files:**
- Create: `frontend/src/pages/Board.tsx`
- Create: `frontend/src/components/board/WorkflowSidebar.tsx`
- Create: `frontend/src/components/board/WorkflowKanbanBoard.tsx`
- Create: `frontend/src/components/board/WorkflowCard.tsx`
- Create: `frontend/src/components/board/TaskCard.tsx`
- Create: `frontend/src/components/board/TerminalDots.tsx`
- Create: `frontend/src/components/board/TerminalActivityPanel.tsx`
- Create: `frontend/src/components/board/StatusBar.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 创建 Board 页面骨架**
```typescript
// frontend/src/pages/Board.tsx
import { useState } from 'react';
import { WorkflowSidebar } from '../components/board/WorkflowSidebar';
import { WorkflowKanbanBoard } from '../components/board/WorkflowKanbanBoard';
import { StatusBar } from '../components/board/StatusBar';

export function Board() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-bg-primary">
      <WorkflowSidebar
        selectedWorkflow={selectedWorkflow}
        onSelectWorkflow={setSelectedWorkflow}
      />
      <main className="flex-1 flex flex-col">
        <WorkflowKanbanBoard workflowId={selectedWorkflow} />
        <TerminalActivityPanel />
        <StatusBar />
      </main>
    </div>
  );
}
```

**Step 2: 运行类型检查**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

Expected: FAIL (组件不存在)

**Step 3: 创建 WorkflowSidebar 组件**
```typescript
// frontend/src/components/board/WorkflowSidebar.tsx
import { useWorkflows } from '../../hooks/useWorkflows';

interface WorkflowSidebarProps {
  selectedWorkflow: string | null;
  onSelectWorkflow: (id: string) => void;
}

export function WorkflowSidebar({ selectedWorkflow, onSelectWorkflow }: WorkflowSidebarProps) {
  const { workflows } = useWorkflows();

  return (
    <div className="w-64 bg-bg-secondary border-r border-border p-4">
      <h2 className="text-lg font-bold mb-4">工作流</h2>
      <ul className="space-y-2">
        {workflows.map((workflow) => (
          <li
            key={workflow.id}
            onClick={() => onSelectWorkflow(workflow.id)}
            className={`p-2 rounded cursor-pointer ${
              selectedWorkflow === workflow.id ? 'bg-brand/10 text-brand' : ''
            }`}
          >
            {workflow.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 4: 创建 WorkflowKanbanBoard 组件**
```typescript
// frontend/src/components/board/WorkflowKanbanBoard.tsx
import { useWorkflowTasks } from '../../hooks/useWorkflows';

interface WorkflowKanbanBoardProps {
  workflowId: string | null;
}

export function WorkflowKanbanBoard({ workflowId }: WorkflowKanbanBoardProps) {
  const { tasks, isLoading } = useWorkflowTasks(workflowId);

  if (isLoading) return <div>Loading...</div>;
  if (!workflowId) return <div>请选择工作流</div>;

  const columns = [
    { id: 'created', title: 'Created' },
    { id: 'ready', title: 'Ready' },
    { id: 'running', title: 'Running' },
    { id: 'completed', title: 'Completed' },
  ];

  return (
    <div className="flex-1 p-6 grid grid-cols-4 gap-4">
      {columns.map((column) => (
        <div key={column.id} className="bg-bg-secondary rounded border border-border p-4">
          <h3 className="font-bold mb-4">{column.title}</h3>
          {tasks.filter(t => t.status === column.id).map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 5: 创建 TaskCard 组件**
```typescript
// frontend/src/components/board/TaskCard.tsx
import { Task } from '@shared/types';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="bg-bg-primary rounded border border-border p-4 mb-2">
      <h4 className="font-bold">{task.name}</h4>
      <p className="text-sm text-text-low">{task.branch}</p>
      <TerminalDots terminalCount={task.terminals.length} />
    </div>
  );
}
```

**Step 6: 创建 TerminalDots 组件**
```typescript
// frontend/src/components/board/TerminalDots.tsx
interface TerminalDotsProps {
  terminalCount: number;
}

export function TerminalDots({ terminalCount }: TerminalDotsProps) {
  return (
    <div className="flex gap-1 mt-2">
      {Array.from({ length: terminalCount }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-brand"
          title={`Terminal ${i + 1}`}
        />
      ))}
    </div>
  );
}
```

**Step 7: 创建 TerminalActivityPanel 组件**
```typescript
// frontend/src/components/board/TerminalActivityPanel.tsx
export function TerminalActivityPanel() {
  return (
    <div className="h-32 bg-bg-secondary border-t border-border p-4">
      <h4 className="font-bold mb-2">📡 终端实时活动</h4>
      <div className="space-y-1 text-sm font-mono">
        <div className="text-text-low">[T1] $ git status</div>
        <div className="text-text-low truncate">[T2] impl Login {`{`}`}</div>
      </div>
    </div>
  );
}
```

**Step 8: 创建 StatusBar 组件**
```typescript
// frontend/src/components/board/StatusBar.tsx
export function StatusBar() {
  return (
    <div className="h-8 bg-bg-secondary border-t border-border px-4 flex items-center text-sm">
      <span className="text-brand">● Orchestrator Active</span>
      <span className="ml-4">3 Terminals Running</span>
      <span className="ml-4">Tokens: 12.5k</span>
      <span className="ml-4">Git: Listening</span>
    </div>
  );
}
```

**Step 9: 更新 App.tsx 添加 /board 路由**
```typescript
// frontend/src/App.tsx
import { Board } from './pages/Board';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/board" replace />} />
        <Route path="/board" element={<Board />} />
        {/* 其他路由 */}
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 10: 运行测试**
```bash
cd E:/GitCortex/frontend
pnpm run check
pnpm run build
```

Expected: PASS

**Step 11: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "feat(frontend): implement workflow board view (/board)"
```

---

### Task 6: 实现流水线视图（/pipeline/:workflowId）

**目标:** 创建带 Orchestrator 头部的流水线视图

**Files:**
- Create: `frontend/src/pages/Pipeline.tsx`
- Create: `frontend/src/components/pipeline/OrchestratorHeader.tsx`
- Create: `frontend/src/components/pipeline/TaskPipeline.tsx`
- Create: `frontend/src/components/pipeline/TerminalNode.tsx`
- Create: `frontend/src/components/pipeline/MergeTerminalNode.tsx`
- Create: `frontend/src/components/pipeline/TerminalDetailPanel.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 创建 Pipeline 页面**
```typescript
// frontend/src/pages/Pipeline.tsx
import { useParams } from 'react-router-dom';
import { OrchestratorHeader } from '../components/pipeline/OrchestratorHeader';
import { TaskPipeline } from '../components/pipeline/TaskPipeline';
import { useWorkflow } from '../hooks/useWorkflows';

export function Pipeline() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { workflow, isLoading } = useWorkflow(workflowId);

  if (isLoading) return <div>Loading...</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      <OrchestratorHeader workflow={workflow} />
      <TaskPipeline workflowId={workflowId} />
    </div>
  );
}
```

**Step 2: 创建 OrchestratorHeader 组件**
```typescript
// frontend/src/components/pipeline/OrchestratorHeader.tsx
import { Workflow } from '@shared/types';

interface OrchestratorHeaderProps {
  workflow: Workflow;
}

export function OrchestratorHeader({ workflow }: OrchestratorHeaderProps) {
  return (
    <div className="h-16 bg-bg-secondary border-b border-border px-6 flex items-center">
      <div className="flex-1">
        <h1 className="text-xl font-bold">{workflow.name}</h1>
        <div className="text-sm text-text-low mt-1">
          Status: {workflow.status} | Model: {workflow.orchestrator_model}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm">Tokens Used</div>
        <div className="text-lg font-bold">12.5k</div>
      </div>
    </div>
  );
}
```

**Step 3: 创建 TaskPipeline 组件**
```typescript
// frontend/src/components/pipeline/TaskPipeline.tsx
import { useWorkflowTasks } from '../../hooks/useWorkflows';
import { TerminalNode } from './TerminalNode';
import { MergeTerminalNode } from './MergeTerminalNode';

interface TaskPipelineProps {
  workflowId: string;
}

export function TaskPipeline({ workflowId }: TaskPipelineProps) {
  const { tasks } = useWorkflowTasks(workflowId);

  return (
    <div className="flex-1 p-6 overflow-x-auto">
      <div className="flex gap-8 min-w-max">
        {/* Tasks */}
        {tasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-4">
            <h3 className="font-bold text-center">{task.name}</h3>
            {task.terminals.map((terminal) => (
              <TerminalNode key={terminal.id} terminal={terminal} />
            ))}
          </div>
        ))}

        {/* Merge Terminal */}
        <MergeTerminalNode workflowId={workflowId} />
      </div>
    </div>
  );
}
```

**Step 4: 创建 TerminalNode 组件**
```typescript
// frontend/src/components/pipeline/TerminalNode.tsx
import { Terminal } from '@shared/types';
import { useState } from 'react';

interface TerminalNodeProps {
  terminal: Terminal;
}

export function TerminalNode({ terminal }: TerminalNodeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="relative"
      onClick={() => setExpanded(!expanded)}
    >
      <div className={`w-32 h-20 rounded border-2 ${
        terminal.status === 'completed' ? 'border-green-500' :
        terminal.status === 'working' ? 'border-brand' :
        'border-gray-500'
      } flex items-center justify-center bg-bg-secondary`}>
        <div className="text-center">
          <div className="text-2xl">
            {terminal.status === 'completed' ? '✓' :
             terminal.status === 'working' ? '●' : '○'}
          </div>
          <div className="text-xs mt-1">{terminal.cli_type}</div>
        </div>
      </div>

      {expanded && (
        <div className="absolute top-full mt-2 p-4 bg-bg-secondary rounded border border-border z-10">
          {/* Terminal Detail Panel */}
          <h4 className="font-bold mb-2">{terminal.role}</h4>
          <p className="text-sm text-text-low">Status: {terminal.status}</p>
          <p className="text-sm text-text-low">Model: {terminal.model}</p>
        </div>
      )}
    </div>
  );
}
```

**Step 5: 创建 MergeTerminalNode 组件**
```typescript
// frontend/src/components/pipeline/MergeTerminalNode.tsx
import { useWorkflow } from '../../hooks/useWorkflows';

interface MergeTerminalNodeProps {
  workflowId: string;
}

export function MergeTerminalNode({ workflowId }: MergeTerminalNodeProps) {
  const { workflow } = useWorkflow(workflowId);

  if (!workflow) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-bold text-center">Merge</h3>
      <div className="w-32 h-20 rounded border-2 border-purple-500 flex items-center justify-center bg-bg-secondary">
        <div className="text-center">
          <div className="text-2xl">⎇</div>
          <div className="text-xs mt-1">main</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 6: 更新 App.tsx 添加路由**
```typescript
// frontend/src/App.tsx
import { Pipeline } from './pages/Pipeline';

// 在 Routes 中添加:
<Route path="/pipeline/:workflowId" element={<Pipeline />} />
```

**Step 7: 测试**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

**Step 8: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "feat(frontend): implement pipeline view with orchestrator header"
```

---

### Task 7: 重构终端调试视图（/debug/:workflowId）

**目标:** 按设计文档重构调试视图

**Files:**
- Modify: `frontend/src/pages/WorkflowDebug.tsx`
- Modify: `frontend/src/components/terminal/TerminalDebugView.tsx`
- Modify: `frontend/src/components/terminal/TerminalSidebar.tsx`

**Step 1: 重构 WorkflowDebug 页面**
```typescript
// frontend/src/pages/WorkflowDebug.tsx
import { useParams } from 'react-router-dom';
import { TerminalDebugView } from '../components/terminal/TerminalDebugView';
import { useWorkflow } from '../hooks/useWorkflows';

export function WorkflowDebug() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { workflow } = useWorkflow(workflowId);

  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="flex h-screen flex-col bg-bg-primary">
      {/* Workflow Status Bar */}
      <div className="h-16 bg-bg-secondary border-b border-border px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{workflow.name}</h1>
          <div className="text-sm text-text-low mt-1">
            Status: {workflow.status}
          </div>
        </div>
        <button className="px-4 py-2 bg-brand text-white rounded hover:bg-brand/90">
          直接开始
        </button>
      </div>

      {/* Terminal Debug View */}
      <TerminalDebugView workflowId={workflowId} />

      {/* Status Bar */}
      <div className="h-8 bg-bg-secondary border-t border-border px-6 flex items-center text-sm">
        <span>Terminal: T1</span>
        <span className="ml-4">CLI: claude-code</span>
        <span className="ml-4">Model: claude-sonnet-4</span>
        <span className="ml-4">PTY: Active</span>
      </div>
    </div>
  );
}
```

**Step 2: 重构 TerminalDebugView 组件**
```typescript
// frontend/src/components/terminal/TerminalDebugView.tsx
import { useState } from 'react';
import { TerminalSidebar } from './TerminalSidebar';
import { TerminalEmulator } from './TerminalEmulator';
import { useWorkflowTerminals } from '../../hooks/useTerminals';

interface TerminalDebugViewProps {
  workflowId: string;
}

export function TerminalDebugView({ workflowId }: TerminalDebugViewProps) {
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const { terminals, isLoading } = useWorkflowTerminals(workflowId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="flex-1 flex">
      <TerminalSidebar
        workflowId={workflowId}
        terminals={terminals}
        selectedTerminal={selectedTerminal}
        onSelectTerminal={setSelectedTerminal}
      />
      <div className="flex-1 bg-black">
        {selectedTerminal ? (
          <TerminalEmulator terminalId={selectedTerminal} />
        ) : (
          <div className="h-full flex items-center justify-center text-text-low">
            选择一个终端开始调试
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: 重构 TerminalSidebar 按任务分组**
```typescript
// frontend/src/components/terminal/TerminalSidebar.tsx
import { useWorkflowTasks } from '../../hooks/useWorkflows';
import { Terminal } from '@shared/types';

interface TerminalSidebarProps {
  workflowId: string;
  terminals: Terminal[];
  selectedTerminal: string | null;
  onSelectTerminal: (id: string) => void;
}

export function TerminalSidebar({
  workflowId,
  terminals,
  selectedTerminal,
  onSelectTerminal,
}: TerminalSidebarProps) {
  const { tasks } = useWorkflowTasks(workflowId);

  // 按任务分组终端
  const terminalsByTask = tasks.map((task) => ({
    task,
    terminals: terminals.filter((t) => t.workflow_task_id === task.id),
  }));

  return (
    <div className="w-64 bg-bg-secondary border-r border-border overflow-y-auto">
      {terminalsByTask.map(({ task, terminals: taskTerminals }) => (
        <div key={task.id} className="border-b border-border">
          <h3 className="px-4 py-2 font-bold text-sm bg-bg-primary">
            {task.name}
          </h3>
          {taskTerminals.map((terminal) => (
            <div
              key={terminal.id}
              onClick={() => onSelectTerminal(terminal.id)}
              className={`px-4 py-2 cursor-pointer hover:bg-bg-primary ${
                selectedTerminal === terminal.id ? 'bg-brand/10' : ''
              }`}
            >
              <div className="font-medium">{terminal.role || 'Terminal'}</div>
              <div className="text-xs text-text-low mt-1">
                {terminal.cli_type} | {terminal.status}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 4: 测试**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): restructure debug view with task-grouped terminals"
```

---

### Task 8: 重构分步向导 UI

**目标:** 让向导符合设计文档的 7 步规范

**Files:**
- Modify: `frontend/src/components/workflow/WorkflowWizard.tsx`
- Modify: `frontend/src/components/workflow/steps/*.tsx` (所有步骤组件)

**Step 1: 重构 WorkflowWizard 主组件**
```typescript
// frontend/src/components/workflow/WorkflowWizard.tsx
import { useState } from 'react';
import { StepIndicator } from './StepIndicator';
import { Step0Project } from './steps/Step0Project';
import { Step1Basic } from './steps/Step1Basic';
// ... 导入其他步骤

export function WorkflowWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowData, setWorkflowData] = useState({});

  const steps = [
    { title: '工作目录', component: Step0Project },
    { title: '基础配置', component: Step1Basic },
    { title: '任务配置', component: Step2Tasks },
    { title: '模型配置', component: Step3Models },
    { title: '终端配置', component: Step4Terminals },
    { title: '斜杠命令', component: Step5Commands },
    { title: '高级配置', component: Step6Advanced },
  ];

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">创建新工作流</h1>
        <button className="text-text-low hover:text-text-normal">✕ 取消</button>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} steps={steps.map(s => s.title)} />

      {/* Current Step */}
      <div className="max-w-4xl mx-auto p-6">
        <CurrentStepComponent
          data={workflowData}
          onChange={setWorkflowData}
          onNext={() => setCurrentStep(currentStep + 1)}
          onBack={() => setCurrentStep(currentStep - 1)}
        />
      </div>
    </div>
  );
}
```

**Step 2: 创建 StepIndicator 组件**
```typescript
// frontend/src/components/workflow/StepIndicator.tsx
interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex justify-center py-8 border-b border-border">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              index === currentStep
                ? 'border-brand bg-brand text-white'
                : index < currentStep
                ? 'border-brand text-brand'
                : 'border-gray-500 text-text-low'
            }`}
          >
            {index + 1}
          </div>
          <span className="mx-2 text-sm">{step}</span>
          {index < steps.length - 1 && (
            <div className="w-16 h-0.5 bg-gray-300 mx-4" />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: 测试**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

**Step 4: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): restructure wizard with proper step indicator"
```

---

## 组件重构计划

### Task 9: 更新品牌标识

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/index.html`
- Modify: `frontend/vite.config.ts`

**Step 1: 更新 package.json**
```json
{
  "name": "gitcortex-frontend",
  "displayName": "GitCortex"
}
```

**Step 2: 更新 index.html**
```html
<title>GitCortex - AI 驱动的工作流编排系统</title>
<meta name="description" content="GitCortex 是一个 AI 驱动的跨终端工作流编排系统，支持多 AI 模型协同工作。" />
```

**Step 3: 更新 vite.config.ts**
```typescript
export default defineConfig({
  plugins: [
    sentry({
      org: "gitcortex",
      project: "gitcortex",
      // ...
    }),
  ],
});
```

**Step 4: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): update brand identity from vibe-kanban to gitcortex"
```

---

## 路由重构

### Task 10: 重建路由架构

**目标:** 实现设计文档要求的新路由结构

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/hooks/useWorkflows.ts`
- Modify: `frontend/src/services/api.ts`

**Step 1: 重写 App.tsx 路由**
```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Board } from './pages/Board';
import { Pipeline } from './pages/Pipeline';
import { WorkflowDebug } from './pages/WorkflowDebug';
import { WorkflowWizard } from './components/workflow/WorkflowWizard';
import { SlashCommands } from './pages/SlashCommands';
import { SettingsLayout } from './components/settings/SettingsLayout';
import { CliSettings } from './components/settings/CliSettings';
import { ModelSettings } from './components/settings/ModelSettings';
import { PresetsSettings } from './components/settings/PresetsSettings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/board" replace />} />

        {/* Main views */}
        <Route path="/board" element={<Board />} />
        <Route path="/pipeline/:workflowId" element={<Pipeline />} />
        <Route path="/debug/:workflowId" element={<WorkflowDebug />} />

        {/* Wizard */}
        <Route path="/wizard" element={<WorkflowWizard />} />

        {/* Commands */}
        <Route path="/commands" element={<SlashCommands />} />

        {/* Settings */}
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="cli" element={<CliSettings />} />
          <Route path="models" element={<ModelSettings />} />
          <Route path="presets" element={<PresetsSettings />} />
        </Route>

        {/* Legacy workflow routes (keep for compatibility) */}
        <Route path="/workflows" element={<Board />} />
        <Route path="/workflows/:workflowId/debug" element={<WorkflowDebug />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Step 2: 更新导航链接**
```bash
cd E:/GitCortex/frontend
grep -r "to=/projects" src/ --include="*.tsx" --include="*.ts"
```

将所有 `/projects` 链接改为 `/board`

**Step 3: 测试路由**
```bash
pnpm run check
```

**Step 4: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "refactor(frontend): restructure routing according to design document"
```

---

## 样式与主题

### Task 11: 实现 GitCortex 设计主题

**目标:** 创建符合设计文档的色彩方案和视觉风格

**Files:**
- Create: `frontend/src/styles/gitcortex/index.css`
- Modify: `frontend/src/styles/index.css`
- Modify: `frontend/tailwind.config.ts`

**Step 1: 定义 GitCortex 色彩方案**
```css
/* frontend/src/styles/gitcortex/index.css */

:root {
  /* Brand Colors - 工作流编排系统的活力橙色 */
  --brand-50: #fff7ed;
  --brand-100: #ffedd5;
  --brand-200: #fed7aa;
  --brand-300: #fdba74;
  --brand-400: #fb923c; /* Main brand color */
  --brand-500: #f97316;
  --brand-600: #ea580c;
  --brand-700: #c2410c;

  /* Semantic Colors */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  /* Status Colors */
  --status-created: #6b7280;
  --status-ready: #3b82f6;
  --status-running: #f97316;
  --status-completed: #10b981;
  --status-failed: #ef4444;

  /* Neutral Colors - 深色主题 */
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #262626;
  --bg-panel: #171717;

  --text-high: #fafafa;
  --text-normal: #a1a1a1;
  --text-low: #737373;

  /* Border */
  --border: #262626;
  --border-hover: #404040;

  /* Font Families */
  --font-sans: 'IBM Plex Sans', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Light mode support */
@media (prefers-color-scheme: light) {
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f4f4f5;
    --bg-tertiary: #e4e4e7;
    --bg-panel: #ffffff;

    --text-high: #1a1a1a;
    --text-normal: #4b5563;
    --text-low: #9ca3af;

    --border: #e5e7eb;
    --border-hover: #d1d5db;
  }
}
```

**Step 2: 更新 Tailwind 配置**
```typescript
// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
        },
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-panel': 'var(--bg-panel)',
        'text-high': 'var(--text-high)',
        'text-normal': 'var(--text-normal)',
        'text-low': 'var(--text-low)',
        border: 'var(--border)',
        'border-hover': 'var(--border-hover)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 3: 应用主题到全局样式**
```css
/* frontend/src/styles/index.css */
@import './gitcortex/index.css';

/* Base styles */
body {
  @apply bg-bg-primary text-text-high font-sans antialiased;
}

/* Custom component styles */
.card {
  @apply bg-bg-secondary border border-border rounded;
}

.btn {
  @apply px-4 py-2 rounded bg-brand text-white hover:bg-brand-600;
}
```

**Step 4: 测试主题**
```bash
cd E:/GitCortex/frontend
pnpm run check
```

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "feat(frontend): implement GitCortex design theme and color scheme"
```

---

## 测试策略

### Task 12: 确保重构不破坏功能

**目标:** 通过所有现有测试

**Step 1: 运行测试**
```bash
cd E:/GitCortex/frontend
pnpm test
```

Expected: 所有测试通过

**Step 2: 检查测试覆盖率**
```bash
pnpm test:run --coverage
```

**Step 3: 手动测试关键路径**
1. 访问 http://localhost:3000/board
2. 验证工作流列表显示
3. 验证任务卡片显示
4. 点击任务，验证终端状态点显示
5. 验证底部状态栏显示

**Step 4: 创建端到端测试**
```bash
cd E:/GitCortex/frontend
# 创建 E2E 测试文件
```

**Step 5: Commit**
```bash
cd E:/GitCortex
git add frontend/
git commit -m "test(frontend): ensure all tests pass after refactoring"
```

---

## 总结

### 预期成果

1. **删除所有 Vibe Kanban 遗留代码**
2. **实现设计文档要求的完整 UI**
3. **路由架构完全符合设计**
4. **品牌身份更新为 GitCortex**
5. **所有测试通过**

### 风险与缓解

**风险 1: 破坏现有功能**
- 缓解: 保留 GitCortex 核心功能（Workflow/Terminal/Orchestrator）
- 测试: 每个任务后运行 `pnpm test`

**风险 2: 设计文档不完整**
- 缓解: 基于现有代码推断合理实现
- 测试: 用户验收测试

**风险 3: 时间超支**
- 缓解: 按 Task 划分，可随时停止
- 策略: 优先实现核心页面，细节可迭代

### 下一步行动

**计划完成后，提供两个执行选项：**

1. **Subagent-Driven (this session)** - 我逐任务 dispatch subagent，review between tasks
2. **Parallel Session (separate)** - 新会话执行，批量处理

**选择建议：** 由于这是大规模前端重构，建议使用 **Parallel Session** 配合 superpowers:executing-plans 技能。
