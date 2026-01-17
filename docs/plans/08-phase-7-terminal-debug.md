# Phase 7: 终端调试视图

> **状态:** ⬜ 未开始
> **进度追踪:** 查看 `TODO.md`
> **前置条件:** Phase 6 完成

## 概述

集成 xterm.js 实现终端调试视图，支持实时查看终端输出。

---

### Task 7.1: 集成 xterm.js

**状态:** ⬜ 未开始

**前置条件:**
- Phase 6 已完成

**目标:**
集成 xterm.js 终端模拟器，实现终端调试视图。

**涉及文件:**
- 修改: `vibe-kanban-main/frontend/package.json`
- 创建: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx`

---

**Step 7.1.1: 安装依赖**

```bash
cd vibe-kanban-main/frontend
pnpm add xterm xterm-addon-fit xterm-addon-web-links @xterm/xterm @xterm/addon-fit
```

---

**Step 7.1.2: 创建 TerminalEmulator.tsx**

文件路径: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx`

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  terminalId: string;
  wsUrl?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export function TerminalEmulator({ terminalId, wsUrl, onData, onResize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 初始化终端
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // 处理用户输入
    terminal.onData((data) => {
      onData?.(data);
      wsRef.current?.send(JSON.stringify({ type: 'input', data }));
    });

    // 处理窗口大小变化
    const handleResize = () => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      onResize?.(cols, rows);
      wsRef.current?.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [onData, onResize]);

  // WebSocket 连接
  useEffect(() => {
    if (!wsUrl || !terminalRef.current) return;

    const ws = new WebSocket(`${wsUrl}/terminal/${terminalId}`);

    ws.onopen = () => {
      console.log('Terminal WebSocket connected');
      // 发送初始大小
      const { cols, rows } = terminalRef.current!;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'output') {
        terminalRef.current?.write(message.data);
      }
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Terminal WebSocket closed');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [wsUrl, terminalId]);

  // 写入数据到终端
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  // 清空终端
  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[300px] bg-[#1e1e1e] rounded-lg overflow-hidden"
    />
  );
}
```

---

**交付物:** `TerminalEmulator.tsx`

---

### Task 7.2: 实现 PTY WebSocket 后端

**状态:** ⬜ 未开始

**涉及文件:**
- 创建: `vibe-kanban-main/crates/server/src/routes/terminal_ws.rs`
- 修改: `vibe-kanban-main/crates/server/src/routes/mod.rs`

---

**Step 7.2.1: 创建 terminal_ws.rs**

文件路径: `vibe-kanban-main/crates/server/src/routes/terminal_ws.rs`

```rust
//! 终端 WebSocket 路由

use axum::{
    extract::{Path, State, WebSocketUpgrade, ws::{Message, WebSocket}},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use crate::AppState;

/// 创建终端 WebSocket 路由
pub fn terminal_ws_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/terminal/:terminal_id", get(terminal_ws_handler))
}

/// WebSocket 消息类型
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WsMessage {
    Input { data: String },
    Output { data: String },
    Resize { cols: u16, rows: u16 },
    Error { message: String },
}

/// WebSocket 处理器
async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    Path(terminal_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_terminal_socket(socket, terminal_id, state))
}

/// 处理终端 WebSocket 连接
async fn handle_terminal_socket(
    socket: WebSocket,
    terminal_id: String,
    state: Arc<AppState>,
) {
    tracing::info!("Terminal WebSocket connected: {}", terminal_id);

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<String>(100);

    // 获取终端进程信息
    let terminal = match db::models::terminal_dao::get_terminal_by_id(
        &state.db.pool,
        &terminal_id,
    ).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            let _ = ws_sender.send(Message::Text(
                serde_json::to_string(&WsMessage::Error {
                    message: "Terminal not found".to_string(),
                }).unwrap()
            )).await;
            return;
        }
        Err(e) => {
            let _ = ws_sender.send(Message::Text(
                serde_json::to_string(&WsMessage::Error {
                    message: format!("Database error: {}", e),
                }).unwrap()
            )).await;
            return;
        }
    };

    // 发送任务：从 rx 接收数据并发送到 WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            let msg = WsMessage::Output { data };
            if ws_sender.send(Message::Text(serde_json::to_string(&msg).unwrap())).await.is_err() {
                break;
            }
        }
    });

    // 接收任务：从 WebSocket 接收数据
    let tx_clone = tx.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        match ws_msg {
                            WsMessage::Input { data } => {
                                // TODO: 发送到 PTY
                                tracing::debug!("Input: {}", data);
                            }
                            WsMessage::Resize { cols, rows } => {
                                // TODO: 调整 PTY 大小
                                tracing::debug!("Resize: {}x{}", cols, rows);
                            }
                            _ => {}
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // 等待任务完成
    tokio::select! {
        _ = send_task => {}
        _ = recv_task => {}
    }

    tracing::info!("Terminal WebSocket disconnected: {}", terminal_id);
}
```

---

**Step 7.2.2: 更新 routes/mod.rs**

在路由注册中添加：

```rust
pub mod terminal_ws;

// 在 api_routes 函数中添加
.merge(terminal_ws::terminal_ws_routes())
```

---

**交付物:** `terminal_ws.rs`

---

### Task 7.3: 创建终端调试页面

**状态:** ⬜ 未开始

**涉及文件:**
- 创建: `vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.tsx`
- 创建: `vibe-kanban-main/frontend/src/pages/WorkflowDebug.tsx`

---

**Step 7.3.1: 创建 TerminalDebugView.tsx**

```tsx
import { useState } from 'react';
import { TerminalEmulator } from './TerminalEmulator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Terminal, WorkflowTask } from '@/shared/types';

interface Props {
  tasks: Array<WorkflowTask & { terminals: Terminal[] }>;
  wsUrl: string;
}

export function TerminalDebugView({ tasks, wsUrl }: Props) {
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);

  const allTerminals = tasks.flatMap(task =>
    task.terminals.map(t => ({ ...t, taskName: task.name }))
  );

  const selectedTerminal = allTerminals.find(t => t.id === selectedTerminalId);

  return (
    <div className="flex h-full">
      {/* 终端列表 */}
      <div className="w-64 border-r bg-muted/30 overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="font-semibold">终端列表</h3>
        </div>
        <div className="p-2">
          {allTerminals.map((terminal) => (
            <button
              key={terminal.id}
              className={cn(
                'w-full p-3 rounded-lg text-left mb-2 transition-colors',
                selectedTerminalId === terminal.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={() => setSelectedTerminalId(terminal.id)}
            >
              <div className="font-medium text-sm">
                {terminal.role || `Terminal ${terminal.orderIndex + 1}`}
              </div>
              <div className="text-xs opacity-70">{terminal.taskName}</div>
              <div className="flex items-center gap-2 mt-1">
                <StatusDot status={terminal.status} />
                <span className="text-xs">{terminal.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 终端视图 */}
      <div className="flex-1 flex flex-col">
        {selectedTerminal ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {selectedTerminal.role || `Terminal ${selectedTerminal.orderIndex + 1}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTerminal.cliTypeId} - {selectedTerminal.modelConfigId}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">清空</Button>
                <Button variant="outline" size="sm">重启</Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <TerminalEmulator
                terminalId={selectedTerminal.id}
                wsUrl={wsUrl}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个终端开始调试
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-400',
    starting: 'bg-yellow-400',
    waiting: 'bg-blue-400',
    working: 'bg-green-400 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return <div className={cn('w-2 h-2 rounded-full', colors[status] || 'bg-gray-400')} />;
}
```

---

**Step 7.3.2: 创建 WorkflowDebug.tsx 页面**

```tsx
import { useParams } from 'react-router-dom';
import { useWorkflow } from '@/hooks/useWorkflows';
import { TerminalDebugView } from '@/components/terminal/TerminalDebugView';
import { PipelineView } from '@/components/workflow/PipelineView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Square } from 'lucide-react';
import { Link } from 'react-router-dom';

export function WorkflowDebugPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data, isLoading, error } = useWorkflow(workflowId!);

  if (isLoading) {
    return <div className="p-8 text-center">加载中...</div>;
  }

  if (error || !data) {
    return <div className="p-8 text-center text-red-500">加载失败</div>;
  }

  const wsUrl = `ws://${window.location.host}`;

  return (
    <div className="h-screen flex flex-col">
      {/* 头部 */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> 返回
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold">{data.workflow.name}</h1>
            <p className="text-sm text-muted-foreground">
              状态: {data.workflow.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {data.workflow.status === 'ready' && (
            <Button size="sm">
              <Play className="w-4 h-4 mr-2" /> 开始
            </Button>
          )}
          {data.workflow.status === 'running' && (
            <>
              <Button variant="outline" size="sm">
                <Pause className="w-4 h-4 mr-2" /> 暂停
              </Button>
              <Button variant="destructive" size="sm">
                <Square className="w-4 h-4 mr-2" /> 停止
              </Button>
            </>
          )}
        </div>
      </header>

      {/* 主内容 */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="pipeline" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="pipeline">流水线视图</TabsTrigger>
            <TabsTrigger value="terminals">终端调试</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="flex-1 p-4 overflow-auto">
            <PipelineView workflow={data.workflow} tasks={data.tasks} />
          </TabsContent>

          <TabsContent value="terminals" className="flex-1 overflow-hidden">
            <TerminalDebugView tasks={data.tasks} wsUrl={wsUrl} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

---

**交付物:** `TerminalDebugView.tsx`, `WorkflowDebug.tsx`

**验收标准:**
1. 编译通过
2. 终端模拟器可以正常显示
3. WebSocket 连接正常

---

## Phase 7 完成检查清单

- [ ] Task 7.1: xterm.js 集成完成
- [ ] Task 7.2: PTY WebSocket 后端完成
- [ ] Task 7.3: 终端调试页面完成

---
