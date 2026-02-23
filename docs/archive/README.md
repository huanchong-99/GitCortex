# Docs Archive

本目录用于收纳历史/阶段性文档，按完成度分类，避免根 `docs/` 目录被大量阶段文档干扰。

## 目录结构

- `docs/archive/completed/issues/`：已完成的问题分析与归档记录
- `docs/archive/completed/plans/`：明确标记为完成的计划文档（`completion` / `summary` / `report`）
- `docs/archive/pending/issues/`：仍未闭环的问题（如 `open-issue`）
- `docs/archive/pending/plans/`：未明确完结的阶段计划/实施文档
- `docs/archive/pending/misc/`：待执行或参考型文档（如发布清单、测试数据）

## 本次分类规则

1. 原 `docs/issue-archive/`：除 `open-issue` 外，全部归入 `completed/issues`。
2. 原 `docs/plans/`：文件名含 `completion` / `summary` / `report` / `修复完成报告` 归入 `completed/plans`，其余归入 `pending/plans`。
3. `docs/RELEASE_CHECKLIST.md`、`docs/TEST_DATA.md` 归入 `pending/misc`。

## 维护约定

- 新增阶段性文档时，优先落到 `docs/archive/pending/*`。
- 阶段完成后，将对应文档移动到 `docs/archive/completed/*`。
- 若文档状态存在争议，优先放 `pending`，待确认后再转移。
