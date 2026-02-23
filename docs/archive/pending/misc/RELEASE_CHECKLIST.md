# GitCortex 发布清单

> 版本: 0.0.153
> 更新日期: 2026-01-30

## 发布前检查清单

### 1. 代码质量

- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有 E2E 测试通过
- [ ] 代码覆盖率 >= 80%
- [ ] 无 clippy 警告
- [ ] 代码格式化通过 (rustfmt)

```bash
# 运行测试
cargo test --workspace

# 运行 clippy
cargo clippy --workspace -- -D warnings

# 格式化检查
cargo fmt --check
```

### 2. 安全检查

- [ ] 依赖漏洞扫描通过
- [ ] API 密钥加密验证
- [ ] 日志脱敏验证
- [ ] SQL 注入防护验证
- [ ] XSS 防护验证

```bash
# 依赖审计
cargo audit

# 安全测试
cargo test --package server --test security -- --ignored
```

### 3. 性能验证

- [ ] 终端并发连接测试通过
- [ ] WebSocket 吞吐量测试通过
- [ ] 数据库查询性能达标
- [ ] 内存无泄漏

```bash
# 性能测试（需要运行服务器）
GITCORTEX_TEST_DATABASE_URL=sqlite:./test.db cargo test --package server --test performance -- --ignored

# 基准测试
cargo bench --package server
```

### 4. 文档完整性

- [ ] README.md 更新
- [ ] CHANGELOG.md 更新
- [ ] USER_GUIDE.md 更新
- [ ] OPERATIONS_MANUAL.md 更新
- [ ] API 文档更新

### 5. 版本号管理

- [ ] Cargo.toml 版本号更新
- [ ] package.json 版本号更新
- [ ] Git tag 创建

```bash
# 更新版本号
# 编辑 crates/server/Cargo.toml
# 编辑 frontend/package.json

# 创建 Git tag
git tag -a v0.0.153 -m "Release v0.0.153"
git push origin v0.0.153
```

---

## 数据库迁移

### 迁移前检查

- [ ] 备份当前数据库
- [ ] 验证迁移脚本
- [ ] 测试回滚脚本

```bash
# 备份数据库
cp data/gitcortex.db data/gitcortex.db.backup.$(date +%Y%m%d)

# 验证迁移
sqlx migrate info --source crates/db/migrations
```

### 迁移执行

```bash
# 运行迁移
sqlx migrate run --source crates/db/migrations

# 验证迁移结果
sqlx migrate info --source crates/db/migrations
```

### 迁移回滚

```bash
# 回滚最后一次迁移
sqlx migrate revert --source crates/db/migrations

# 或从备份恢复
cp data/gitcortex.db.backup.YYYYMMDD data/gitcortex.db
```

---

## 部署流程

### 1. 构建

```bash
# 构建后端
cargo build --release

# 构建前端
cd frontend && pnpm build
```

### 2. 部署

```bash
# 停止服务
systemctl stop gitcortex

# 备份当前版本
cp /opt/gitcortex/bin/server /opt/gitcortex/bin/server.backup

# 部署新版本
cp target/release/server /opt/gitcortex/bin/
cp -r frontend/dist /opt/gitcortex/frontend/

# 运行迁移
/opt/gitcortex/bin/server migrate

# 启动服务
systemctl start gitcortex

# 验证
curl http://localhost:3001/api/health
```

### 3. 验证

- [ ] 健康检查通过
- [ ] 基本功能测试
- [ ] 日志无错误

```bash
# 健康检查
curl http://localhost:3001/api/health

# 查看日志
journalctl -u gitcortex -n 100 --no-pager
```

---

## 回滚流程

### 快速回滚

```bash
# 停止服务
systemctl stop gitcortex

# 恢复二进制
cp /opt/gitcortex/bin/server.backup /opt/gitcortex/bin/server

# 恢复数据库（如需要）
cp /opt/gitcortex/backups/gitcortex.db.backup.YYYYMMDD /opt/gitcortex/data/gitcortex.db

# 启动服务
systemctl start gitcortex

# 验证
curl http://localhost:3001/api/health
```

### 完整回滚

如果需要回滚到特定版本：

```bash
# 1. 停止服务
systemctl stop gitcortex

# 2. 检出特定版本
cd /opt/gitcortex/src
git checkout v0.0.152

# 3. 重新构建
cargo build --release
cp target/release/server /opt/gitcortex/bin/

# 4. 恢复数据库
cp /opt/gitcortex/backups/gitcortex.db.backup.YYYYMMDD /opt/gitcortex/data/gitcortex.db

# 5. 启动服务
systemctl start gitcortex
```

---

## 发布后检查

### 立即检查（发布后 5 分钟）

- [ ] 服务健康检查通过
- [ ] 无错误日志
- [ ] 基本 API 响应正常

### 短期监控（发布后 1 小时）

- [ ] 错误率正常
- [ ] 响应延迟正常
- [ ] 内存使用稳定
- [ ] CPU 使用正常

### 长期监控（发布后 24 小时）

- [ ] 无内存泄漏
- [ ] 无性能退化
- [ ] 用户反馈正常

---

## 紧急联系人

| 角色 | 联系方式 |
|------|----------|
| 技术负责人 | tech-lead@example.com |
| 运维负责人 | ops@example.com |
| 值班电话 | +86-xxx-xxxx-xxxx |

---

## 版本历史

| 版本 | 发布日期 | 主要变更 |
|------|----------|----------|
| 0.0.153 | 2026-01-30 | Phase 18 全链路测试与发布就绪 |
| 0.0.152 | 2026-01-29 | Phase 18.1/18.2 E2E 测试 |
| 0.0.151 | 2026-01-28 | 工作流编排器优化 |

---

*本文档最后更新于 2026-01-30*
