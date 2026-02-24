# GitCortex 未完成任务清单

> **更新时间:** 2026-02-24
> **当前重点:** 待规划下一阶段

## A. 继承未完成项（延后）

| Task | 阶段 | 描述 | 状态 |
|---|---|---|---|
| 21.10 | Phase 21 | 将 Git 事件写入 `git_event` 表并更新处理状态 | ⬜ 延后 |
| 21.12 | Phase 21 | 支持 workflow 级别 Git 监测开关 | ⬜ 可选 |

## B. 未来增强

| 目标 | 描述 | 优先级 |
|---|---|---|
| DockerDeployment 抽象 | 新建 `crates/docker-deployment` 实现 `Deployment` trait，支持容器级隔离执行 | 低 |
| Runner 容器分离 | 控制面与执行面解耦，CLI 执行在独立 Runner 容器 | 低 |
| CLI 安装状态 API | `/api/cli_install` 查询/重试安装状态 | 中 |
| K8s 部署支持 | Helm chart、多副本、高可用 | 低 |
| 镜像体积优化 | 分层缓存、CLI 按需安装、distroless 基础镜像 | 中 |
