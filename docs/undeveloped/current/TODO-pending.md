# GitCortex 未完成任务清单

> **更新时间:** 2026-02-24
> **当前重点:** Phase 19 已完成，待规划下一阶段

## A. Phase 19 — Docker 部署 MVP ✅ 已完成

> **实施计划:** `docs/undeveloped/current/2026-01-27-phase-19-docker-deployment.md`
> **合并 PR:** #1（2026-02-24）
> **CI 验证:** Check Baseline ✅ + Docker Build Check ✅

| Task | 目标 | 状态 |
|---|---|---|
| 19.1 | 路径函数环境变量覆盖 | ✅ |
| 19.2 | 健康检查路由 + HOST 绑定 + 跳过浏览器 | ✅ |
| 19.3 | 多阶段 Dockerfile | ✅ |
| 19.4 | CLI 安装脚本体系 | ✅ |
| 19.5 | 容器启动入口脚本 | ✅ |
| 19.6 | Docker Compose 编排 | ✅ |
| 19.7 | CI/CD Docker 构建验证 | ✅ |
| 19.8 | E2E 冒烟测试脚本 | ✅ |
| 19.9 | 运维文档 | ✅ |

## B. 继承未完成项（延后）

| Task | 阶段 | 描述 | 状态 |
|---|---|---|---|
| 21.10 | Phase 21 | 将 Git 事件写入 `git_event` 表并更新处理状态 | ⬜ 延后 |
| 21.12 | Phase 21 | 支持 workflow 级别 Git 监测开关 | ⬜ 可选 |

## C. 未来增强（Phase 19 之后）

| 目标 | 描述 | 优先级 |
|---|---|---|
| DockerDeployment 抽象 | 新建 `crates/docker-deployment` 实现 `Deployment` trait，支持容器级隔离执行 | 低 |
| Runner 容器分离 | 控制面与执行面解耦，CLI 执行在独立 Runner 容器 | 低 |
| CLI 安装状态 API | `/api/cli_install` 查询/重试安装状态 | 中 |
| K8s 部署支持 | Helm chart、多副本、高可用 | 低 |
| 镜像体积优化 | 分层缓存、CLI 按需安装、distroless 基础镜像 | 中 |
