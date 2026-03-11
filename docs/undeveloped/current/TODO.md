# GitCortex TODO

> 更新时间：2026-03-11
> 目的：统一维护入口，按"已完成 / 未完成"直接查看当前交付状态。

## 当前状态

- 最新完成：Phase 28 — 编排层进化（信息流补全 + 闭环补全 + 韧性补全 + 飞书接入 + 智能熔断）
- Phase 28 共 18 项任务：18/18 已完成 ✅
- 仅剩 Backlog 5 项低优先级保留项

## 未完成（Backlog）

| ID | 描述 | 优先级 |
|----|------|--------|
| BACKLOG-001 | Docker Deployment 抽象 | 低 |
| BACKLOG-002 | Runner 容器分离 | 低 |
| BACKLOG-003 | CLI 安装状态 API | 中 |
| BACKLOG-004 | K8s 部署支持 | 低 |
| BACKLOG-005 | 镜像体积优化 | 中 |

## 文档入口

- 已完成任务清单：`docs/developed/misc/TODO-completed.md`
- 历史全量快照（只读）：`docs/developed/misc/TODO-legacy-full-2026-02-23.md`
- 历史执行看板归档：`docs/developed/misc/TODO-pending-archived-2026-03-11.md`
- Phase 28 计划文档：`docs/developed/plans/2026-03-11-phase-28-orchestrator-evolution.md`

## 维护规则

1. 新完成事项从"未完成"移动到 `TODO-completed.md`，并同步更新日期。
2. "未完成"仅保留当前确实未交付内容。
3. 里程碑完成后，把稳定沉淀内容归档到 `docs/developed/`。
4. 若某阶段全部完成，保留"未完成：暂无"占位，避免状态歧义。
