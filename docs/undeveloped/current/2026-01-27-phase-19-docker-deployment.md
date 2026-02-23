# Phase 19: Docker 容器化部署（开源发布优化）

> **状态:** 📦 延后实施（Phase 18 完成后执行）
> **进度追踪:** 查看 `TODO.md`
> **前置条件:** Phase 18 全链路测试完成
> **优先级:** 🚀 中（开源部署便利性）
> **目标:** 方便开源后其他开发者一键部署

## 调整背景 (2026-01-27)

### 原计划定位（已废弃）
~~**Phase 17.5: Docker 环境适配（开发测试容器化）**~~
- ~~优先级: 🔥 高（解决 Windows CMake 编译阻塞）~~

### 新计划定位（当前）
**Phase 19: Docker 容器化部署（开源发布优化）**
- 优先级: 🚀 中（提升开源部署体验）
- 目标用户: 开源项目的使用者和贡献者

### 调整原因

**✅ CMake 问题已解决：**
- CMake v4.2.2 已安装，Windows 原生开发环境完全可用
- `aws-lc-sys v0.35.0` 编译通过，无需 Docker 绕过
- SQLx 查询缓存已生成，`cargo test` 正常运行

**🎯 Docker 新价值定位：**
1. **部署便利性:** 使用者无需安装 Rust/Node.js 环境
2. **环境一致性:** 避免不同开发者的环境差异
3. **快速上手:** `docker compose up` 即可启动完整服务
4. **CI/CD 集成:** 统一的测试和构建环境
5. **生产部署:** 可直接用于生产环境部署

## 开发环境状态

### ✅ Windows 原生开发（当前方案）

**完全可用，无需 Docker：**
```bash
# 1. 检查 CMake
cmake --version  # v4.2.2 已安装

# 2. 准备 SQLx 缓存（首次或修改 migrations 后）
node scripts/prepare-db.js

# 3. 开发构建
cargo build
cargo test --workspace
cargo run -p server

# 4. 前端开发
cd frontend && pnpm dev
```

**适用场景：**
- ✅ 项目贡献者开发调试
- ✅ 本地测试和迭代
- ✅ CI/CD 构建（已有原生环境）

---

## 开源部署方案

---

### 🐳 Docker 一键部署（开源优化）

**目标用户：**
- 🌍 不熟悉 Rust/Node.js 的使用者
- 🚀 想快速体验项目的开发者
- 🏢 需要生产环境部署的团队

**核心价值：**
```bash
# 使用者只需：
git clone https://github.com/xxx/gitcortex.git
cd gitcortex
docker compose up -d

# 访问 http://localhost:3000 即可使用
```

**优势：**
- ✅ **零依赖安装:** 无需 Rust/Node.js/pnpm/CMake
- ✅ **跨平台统一:** Windows/macOS/Linux 体验一致
- ✅ **快速启动:** 5 分钟内从克隆到运行
- ✅ **生产就绪:** 包含优化的镜像和配置
- ✅ **隔离性强:** 不影响主机环境

---

## 目标与范围

### 生产部署容器化（主要目标）

**核心功能：**
1. **单机部署:** `docker compose up` 一键启动
2. **生产镜像:** 优化后的多阶段构建镜像
3. **数据持久化:** Volume 挂载保存数据库和配置
4. **健康检查:** 容器状态监控和自动重启

**使用场景：**
- 个人服务器部署
- 小团队内部工具
- 演示环境搭建
- 开源项目快速体验

### 开发调试容器化（次要目标）

**可选功能：**
1. **开发环境:** 支持热重载的开发容器
2. **测试容器:** CI/CD 集成测试环境

**说明：** 开发者仍推荐使用原生环境（详见上方"开发环境状态"）

---

## 参考资料

- Docker 官方文档: https://docs.docker.com/
- Rust Docker 镜像: https://hub.docker.com/_/rust
- Node.js Docker 镜像: https://hub.docker.com/_/node
- Docker Compose: https://docs.docker.com/compose/

---

## Task 19.1: 创建生产部署 Dockerfile

**状态:** ⬜ 未开始

**目标:**
创建多阶段构建的生产级 Dockerfile，优化镜像大小和启动速度。

**涉及文件:**
- 新增: `Dockerfile`
- 新增: `.dockerignore`

**实施步骤:**

Step 19.1.1: 创建 `.dockerignore`
```dockerignore
# 构建产物
target/
node_modules/
dist/

# 开发文件
.git/
.gitignore
.vscode/
.idea/
.worktrees/

# 文档
*.md
docs/

# 测试
tests/
*.test.rs
*.spec.ts

# 环境
.env.*
!.env.example

# 其他
*.log
.DS_Store
```

Step 19.1.2: 创建多阶段生产 Dockerfile

**Stage 1: 前端构建**
```dockerfile
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY frontend/pnpm-lock.yaml frontend/package*.json ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY frontend/ ./

# 构建前端
RUN pnpm build
```

**Stage 2: 后端构建**
```dockerfile
FROM rust:1.83-bookworm-slim AS backend-builder

WORKDIR /app

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 复制 Cargo 配置
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/

# 构建后端（利用 Docker 缓存）
RUN cargo build --release

# 复制前端构建产物到后端静态资源
COPY --from=frontend-builder /app/frontend/dist ./static/
```

**Stage 3: 运行时镜像**
```dockerfile
FROM debian:bookworm-slim

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    ca-certificates \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制二进制文件
COPY --from=backend-builder /app/target/release/gitcortex /usr/local/bin/
COPY --from=backend-builder /app/static ./static/

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["gitcortex"]
```

**验收标准:**
- `docker build -t gitcortex:latest .` 成功
- 镜像大小合理（< 2GB）

---

## Task 19.2: 创建生产部署 Docker Compose

**状态:** ⬜ 未开始

**目标:**
创建支持热重载的开发环境配置。

**涉及文件:**
- 新增: `docker-compose.dev.yml`
- 新增: `docker-compose.prod.yml`

**实施步骤:**

Step 17.5.2.1: 开发环境 Compose

**docker-compose.dev.yml:**
```yaml
version: '3.8'

services:
  # 后端开发服务
  backend:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: backend
    volumes:
      - ./crates:/app/crates:cached
      - cargo-registry:/usr/local/cargo/registry
    ports:
      - "3000:3000"
    environment:
      - RUST_LOG=debug
      - DATABASE_URL=sqlite:///data/gitcortex.db
    command: cargo watch -x run

  # 前端开发服务
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: frontend
    volumes:
      - ./frontend:/app/frontend:cached
      - node-modules:/app/frontend/node_modules
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    command: pnpm dev

volumes:
  cargo-registry:
  node-modules:
```

**Dockerfile.dev:**
```dockerfile
# 前端开发环境
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
RUN npm install -g pnpm
COPY frontend/pnpm-lock.yaml frontend/package*.json ./
RUN pnpm install
COPY frontend/ ./

# 后端开发环境
FROM rust:1.83-bookworm-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev cmake \
    && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-watch
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
RUN cargo build
```

**验收标准:**
- `docker compose -f docker-compose.dev.yml up` 启动开发环境
- 代码修改自动重载（后端 cargo-watch，前端 Vite HMR）
- 访问 http://localhost:5173 可用

---

## Task 19.3: 创建开发调试 Docker Compose（可选）

**状态:** ⬜ 未开始

**目标:**
创建可运行所有测试的容器化环境。

**涉及文件:**
- 新增: `docker-compose.test.yml`
- 新增: `scripts/docker-test.sh`

**实施步骤:**

Step 17.5.3.1: 测试环境 Compose

**docker-compose.test.yml:**
```yaml
version: '3.8'

services:
  test-backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: backend-builder
    volumes:
      - ./crates:/app/crates:cached
      - cargo-registry:/usr/local/cargo/registry
    environment:
      - RUST_TEST_THREADS=4
      - RUST_BACKTRACE=1
    command: cargo test --all

  test-frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: frontend
    volumes:
      - ./frontend:/app/frontend:cached
      - node-modules:/app/frontend/node_modules
    environment:
      - CI=true
    command: pnpm test

volumes:
  cargo-registry:
  node-modules:
```

Step 17.5.3.2: 测试脚本

**scripts/docker-test.sh:**
```bash
#!/bin/bash
set -e

echo "🐳 Starting Docker test environment..."

# 构建测试镜像
echo "📦 Building test images..."
docker compose -f docker-compose.test.yml build

# 运行后端测试
echo "🦀 Running backend tests..."
docker compose -f docker-compose.test.yml run --rm test-backend

# 运行前端测试
echo "🎨 Running frontend tests..."
docker compose -f docker-compose.test.yml run --rm test-frontend

echo "✅ All tests passed!"
```

**验收标准:**
- `docker compose -f docker-compose.test.yml run --rm test-backend` 通过
- `docker compose -f docker-compose.test.yml run --rm test-frontend` 通过
- 所有测试在 Linux 容器中运行（避开 Windows CMake 问题）

---

## Task 19.4: 优化 Docker 镜像构建

**状态:** ⬜ 未开始

**目标:**
优化镜像大小和构建速度。

**实施步骤:**

Step 17.5.4.1: 缓存优化
- 使用 BuildKit 缓存挂载
- 分层 COPY（依赖 → 源码）
- 多阶段构建减少最终镜像大小

Step 17.5.4.2: 依赖预编译
```dockerfile
# 利用 Docker 缓存：只重新编译变化的 crate
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release || true
COPY crates/ ./crates/
RUN cargo build --release
```

Step 17.5.4.3: 减小镜像体积
- 使用 `alpine` 基础镜像
- 清理构建工具
- 压缩静态资源

**验收标准:**
- 镜像大小 < 1GB
- 构建时间 < 5 分钟（增量构建 < 1 分钟）

---

## Task 19.5: 创建 Docker 部署文档

**状态:** ⬜ 未开始

**目标:**
编写清晰的 Docker 使用文档。

**涉及文件:**
- 新增: `docs/DOCKER.md`
- 修改: `README.md`（添加 Docker 快速开始）

**实施步骤:**

Step 17.5.5.1: 编写 DOCKER.md

```markdown
# Docker 开发指南

## 快速开始

### 启动开发环境
\`\`\`bash
docker compose -f docker-compose.dev.yml up
\`\`\`

### 运行测试
\`\`\`bash
# 后端测试
docker compose -f docker-compose.test.yml run --rm test-backend

# 前端测试
docker compose -f docker-compose.test.yml run --rm test-frontend

# 全部测试
./scripts/docker-test.sh
\`\`\`

## 常见问题

### Q: Docker 镜像太大？
A: 使用多阶段构建，只复制必要的文件到最终镜像。

### Q: 代码修改不生效？
A: 检查 volumes 配置，确保正确挂载源代码目录。

### Q: 端口冲突？
A: 修改 docker-compose.yml 中的 ports 映射。
```

**验收标准:**
- 文档清晰易懂
- 包含常见问题解答

---

## Task 19.6: CI/CD 集成

**状态:** ⬜ 未开始

**目标:**
在 CI 中使用 Docker 进行测试和构建。

**涉及文件:**
- 新增: `.github/workflows/docker-ci.yml`

**实施步骤:**

Step 17.5.6.1: GitHub Actions 配置

**.github/workflows/docker-ci.yml:**
```yaml
name: Docker CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build test images
        run: docker compose -f docker-compose.test.yml build

      - name: Run backend tests
        run: docker compose -f docker-compose.test.yml run --rm test-backend

      - name: Run frontend tests
        run: docker compose -f docker-compose.test.yml run --rm test-frontend

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build production image
        run: docker build -t gitcortex:${{ github.sha }} .

      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: docker push gitcortex:${{ github.sha }}
```

**验收标准:**
- CI 在 Docker 容器中运行所有测试
- 测试通过后构建生产镜像

---

## 完成标准

> **验收条件:** 完成所有 6 个任务后，满足以下条件

### 功能验收
- [ ] Docker 开发环境可启动（`docker compose up`）
- [ ] 代码热重载正常工作
- [ ] 所有测试在容器中通过（后端 + 前端）
- [ ] 生产镜像可构建和运行

### 性能验收
- [ ] 镜像大小 < 1GB
- [ ] 增量构建时间 < 1 分钟
- [ ] 冷启动时间 < 30 秒

### 文档验收
- [ ] DOCKER.md 文档完整
- [ ] README.md 包含 Docker 快速开始
- [ ] 常见问题文档覆盖 80% 问题

### CI/CD 验收
- [ ] GitHub Actions 使用 Docker 运行测试
- [ ] PR 检查通过后自动构建镜像

---

## 已知风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Docker Windows 性能问题 | 中 | 中 | 使用 WSL2 后端 |
| 镜像体积过大 | 中 | 低 | 多阶段构建 + Alpine |
| volumes 权限问题 | 中 | 中 | 明确配置 user/group |
| 构建时间过长 | 低 | 低 | BuildKit 缓存优化 |

---

## 附录

### Docker 命令速查

```bash
# 构建镜像
docker build -t gitcortex:latest .

# 启动开发环境
docker compose -f docker-compose.dev.yml up

# 运行测试
docker compose -f docker-compose.test.yml run --rm test-backend

# 进入容器
docker exec -it gitcortex-backend bash

# 查看日志
docker compose -f docker-compose.dev.yml logs -f

# 清理资源
docker compose -f docker-compose.dev.yml down -v
```

### 参考资源

- [Docker 官方文档](https://docs.docker.com/)
- [Rust Docker 最佳实践](https://github.com/rust-lang/docker-rust)
- [Docker Compose 文档](https://docs.docker.com/compose/)
