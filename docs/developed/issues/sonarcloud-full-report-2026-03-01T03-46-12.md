# SonarCloud 代码质量完整报告

**生成时间**: 2026/03/01 11:46
**项目**: huanchong-99_GitCortex

---

# SonarCloud Issues 报告

**生成时间**: 2026/03/01 11:46
**问题总数**: 3
**已加载**: 3
**收集数量**: 3

---

## 统计信息

### 按严重程度分类

- **Major**: 2 个
- **Critical**: 1 个

### 按类型分类

- **Code Smell**: 3 个

### 按影响分类

- **Maintainability**: 3 个

### 按属性分类

- **Consistency**: 2 个
- **Intentionality**: 1 个

### 按文件统计 (Top 20)

- **frontend/src/components/workflow/WorkflowWizard.tsx**: 1 个问题
- **scripts/run-dev.js**: 1 个问题
- **scripts/setup-dev-environment.js**: 1 个问题

---

## 问题列表（按文件分组）

## 1. frontend/src/components/workflow/WorkflowWizard.tsx

> 该文件共有 **1** 个问题

### 1.1 Remove this use of the "void" operator.

- **问题ID**: `AZylHFtY_TisDgi1dilX`
- **项目**: huanchong-99
- **行号**: L2275
- **类型**: Code Smell
- **严重程度**: Critical
- **属性**: Intentionality
- **影响**: Maintainability
- **工作量**: 2275min effort
- **创建时间**: 11 hours ago
- **标签**: confusing, type-dependent

**问题代码片段**:
```
1: import { useCallback, useEffect, useMemo, useState } from 'react';
2: import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
3: import { cn } from '@/lib/utils';
4: import { StepIndicator } from './StepIndicator';
5: import { WizardStep, WizardConfig, getDefaultWizardConfig } from './types';
6: import type { ModelConfig } from './types';
7: import { useWizardNavigation } from './hooks/useWizardNavigation';
8: import { useWizardValidation } from './hooks/useWizardValidation';
9: import { useTranslation } from 'react-i18next';
10: import { useUserSystem } from '@/components/ConfigProvider';
11: import {
12: Step0Project,
13: Step1Basic,
14: Step2Tasks,
15: Step3Models,
16: Step4Terminals,
17: Step5Commands,
18: Step6Advanced,
19: } from './steps';
21: interface WorkflowWizardProps {
22: onComplete: (config: WizardConfig) => void | Promise<void>;
23: onCancel: () => void;
24: onError?: (error: Error) => void;
25: }
27: /**
28: * Renders the multi-step workflow wizard with navigation and validation.
29: */
30: export function WorkflowWizard({
31: onComplete,
32: onCancel,
33: onError,
34: }: Readonly<WorkflowWizardProps>) {
35: const [state, setState] = useState<{
36: config: WizardConfig;
37: isSubmitting: boolean;
38: }>({
39: config: getDefaultWizardConfig(),
40: isSubmitting: false,
41: });
42: const navigation = useWizardNavigation();
43: const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
44: const [submitError, setSubmitError] = useState<string | null>(null);
46: const { config, isSubmitting } = state;
47: const { currentStep } = navigation;
48: const validation = useWizardValidation(currentStep);
49: const { errors } = validation;
50: const { t } = useTranslation('workflow');
51: const { config: userConfig, updateAndSaveConfig } = useUserSystem();
53: const globalModelLibrary = useMemo<ModelConfig[]>(() => {
54: const rawLibrary = (userConfig as { workflow_model_library?: unknown } | null)
```

---

## 2. scripts/run-dev.js

> 该文件共有 **1** 个问题

### 2.1 Prefer top-level await over an async IIFE.

- **问题ID**: `AZylNGeSa37z4KW-DQ1w`
- **项目**: huanchong-99
- **行号**: L4575
- **类型**: Code Smell
- **严重程度**: Major
- **属性**: Consistency
- **影响**: Maintainability
- **工作量**: 4575min effort
- **创建时间**: 10 hours ago
- **标签**: async, es2022, ...

**问题代码片段**:
```
1: #!/usr/bin/env node
3: const fs = require("node:fs");
4: const os = require("node:os");
5: const path = require("node:path");
6: const net = require("node:net");
7: const { spawn, spawnSync } = require("node:child_process");
8: const { getPorts } = require("./setup-dev-environment");
10: const children = new Set();
11: let shuttingDown = false;
12: const devLockPath = path.join(os.tmpdir(), "gitcortex", "run-dev.lock");
13: let lockFd = null;
15: function isProcessAlive(pid) {
16: if (!Number.isInteger(pid) || pid <= 0) return false;
17: try {
18: process.kill(pid, 0);
19: return true;
20: } catch {
21: return false;
22: }
23: }
25: function acquireDevLock() {
26: fs.mkdirSync(path.dirname(devLockPath), { recursive: true });
28: const tryAcquire = () => {
29: lockFd = fs.openSync(devLockPath, "wx");
30: fs.writeFileSync(lockFd, `${process.pid}\n`, { encoding: "utf8" });
31: };
33: try {
34: tryAcquire();
35: return;
36: } catch (error) {
37: if (error?.code !== "EEXIST") {
38: throw error;
39: }
40: }
42: let existingPid = null;
43: try {
44: const content = fs.readFileSync(devLockPath, "utf8").trim();
45: const parsed = Number(content);
46: if (Number.isInteger(parsed) && parsed > 0) {
47: existingPid = parsed;
48: }
49: } catch {
50: // Ignore stale/unreadable lock file content and attempt cleanup.
51: }
53: if (existingPid && isProcessAlive(existingPid)) {
54: throw new Error(
55: `Another dev environment is already running (pid ${existingPid}). Stop it before starting a new one.`
56: );
57: }
59: // Stale lock: remove once and retry.
```

---

## 3. scripts/setup-dev-environment.js

> 该文件共有 **1** 个问题

### 3.1 Prefer top-level await over an async IIFE.

- **问题ID**: `AZylNGgna37z4KW-DQ1x`
- **项目**: huanchong-99
- **行号**: L1365
- **类型**: Code Smell
- **严重程度**: Major
- **属性**: Consistency
- **影响**: Maintainability
- **工作量**: 1365min effort
- **创建时间**: 10 hours ago
- **标签**: async, es2022, ...

**问题代码片段**:
```
1: #!/usr/bin/env node
3: const fs = require("node:fs");
4: const path = require("node:path");
5: const net = require("node:net");
7: const DEV_ASSETS_SEED = path.join(__dirname, "..", "dev_assets_seed");
8: const DEV_ASSETS = path.join(__dirname, "..", "dev_assets");
10: // Fixed development ports - always use these
11: const FIXED_FRONTEND_PORT = 23457;
12: const FIXED_BACKEND_PORT = 23456;
14: /**
15: * Check if a port is available
16: */
17: function isPortAvailable(port) {
18: return new Promise((resolve) => {
19: const sock = net.createConnection({ port, host: "localhost" });
20: sock.on("connect", () => {
21: sock.destroy();
22: resolve(false);
23: });
24: sock.on("error", () => resolve(true));
25: });
26: }
28: /**
29: * Allocate ports for development - always use fixed ports
30: */
31: async function allocatePorts() {
32: const ports = {
33: frontend: FIXED_FRONTEND_PORT,
34: backend: FIXED_BACKEND_PORT,
35: timestamp: new Date().toISOString(),
36: };
38: const frontendAvailable = await isPortAvailable(ports.frontend);
39: const backendAvailable = await isPortAvailable(ports.backend);
41: if (process.argv[2] === "get") {
42: if (!frontendAvailable || !backendAvailable) {
43: console.log(
44: `Port availability check failed: frontend:${ports.frontend}=${frontendAvailable}, backend:${ports.backend}=${backendAvailable}`
45: );
46: }
48: console.log("Using fixed dev ports:");
49: console.log(`Frontend: ${ports.frontend}`);
50: console.log(`Backend: ${ports.backend}`);
51: }
53: return ports;
54: }
56: /**
57: * Get ports (allocate if needed)
58: */
59: async function getPorts() {
60: const ports = await allocatePorts();
```

---



---

# SonarCloud 重复代码报告

**生成时间**: 2026/03/01 11:46
**项目**: huanchong-99_GitCortex
**问题文件总数**: 5
**重复行总数**: 137
**重复块总数**: 80

---

## 统计信息

### 重复率分布

- **严重 (≥50%)**: 4 个文件
- **较高 (30-50%)**: 1 个文件

---

## 重复文件列表（按路径分组）

## 1. crates/db/migrations

> 该目录共有 **1** 个重复文件

### 1.1 20250716143725_add_default_templates.sql

- **路径**: `crates/db/migrations/20250716143725_add_default_templates.sql`
- **重复率**: 95.1%
- **重复行数**: 98 行
- **重复块数**: 26 个
- **SonarCloud 链接**: [查看详情](https://sonarcloud.io/component_measures?id=huanchong-99_GitCortex&metric=new_duplicated_lines_density&selected=huanchong-99_GitCortex%3Acrates%2Fdb%2Fmigrations%2F20250716143725_add_default_templates.sql)

---

## 2. frontend/src/components/ui-new/containers

> 该目录共有 **2** 个重复文件

### 2.1 NavbarContainer.tsx

- **路径**: `frontend/src/components/ui-new/containers/NavbarContainer.tsx`
- **重复率**: 100%
- **重复行数**: 4 行
- **重复块数**: 1 个
- **SonarCloud 链接**: [查看详情](https://sonarcloud.io/component_measures?id=huanchong-99_GitCortex&metric=new_duplicated_lines_density&selected=huanchong-99_GitCortex%3Afrontend%2Fsrc%2Fcomponents%2Fui-new%2Fcontainers%2FNavbarContainer.tsx)

### 2.2 ContextBarContainer.tsx

- **路径**: `frontend/src/components/ui-new/containers/ContextBarContainer.tsx`
- **重复率**: 66.7%
- **重复行数**: 4 行
- **重复块数**: 1 个
- **SonarCloud 链接**: [查看详情](https://sonarcloud.io/component_measures?id=huanchong-99_GitCortex&metric=new_duplicated_lines_density&selected=huanchong-99_GitCortex%3Afrontend%2Fsrc%2Fcomponents%2Fui-new%2Fcontainers%2FContextBarContainer.tsx)

---

## 3. frontend/src/hooks

> 该目录共有 **1** 个重复文件

### 3.1 useWorkflows.test.tsx

- **路径**: `frontend/src/hooks/useWorkflows.test.tsx`
- **重复率**: 37.5%
- **重复行数**: 3 行
- **重复块数**: 5 个
- **SonarCloud 链接**: [查看详情](https://sonarcloud.io/component_measures?id=huanchong-99_GitCortex&metric=new_duplicated_lines_density&selected=huanchong-99_GitCortex%3Afrontend%2Fsrc%2Fhooks%2FuseWorkflows.test.tsx)

---

## 4. frontend/src/pages

> 该目录共有 **1** 个重复文件

### 4.1 Workflows.test.tsx

- **路径**: `frontend/src/pages/Workflows.test.tsx`
- **重复率**: 62.2%
- **重复行数**: 28 行
- **重复块数**: 47 个
- **SonarCloud 链接**: [查看详情](https://sonarcloud.io/component_measures?id=huanchong-99_GitCortex&metric=new_duplicated_lines_density&selected=huanchong-99_GitCortex%3Afrontend%2Fsrc%2Fpages%2FWorkflows.test.tsx)

---



---

# SonarCloud 安全热点报告

**生成时间**: 2026/03/01 11:46
**项目**: huanchong-99_GitCortex
**安全热点总数**: 18

---

## 统计信息

### 按审核优先级分布

| 优先级 | 数量 |
|--------|------|
| High | 1 |
| Medium | 8 |
| Low | 9 |

### 按类别分布

- **Command Injection**: 1 个
- **Denial of Service (DoS)**: 3 个
- **Weak Cryptography**: 5 个
- **Others**: 9 个

---

## 安全热点列表

### 🔴 High 优先级 (1 个)

#### 1. Make sure that executing this OS command is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `scripts/prepare-db.js` |
| **规则ID** | [javascript:S4721](https://sonarcloud.io/organizations/huanchong-99/rules?open=javascript%3AS4721&rule_key=javascript%3AS4721) |
| **类别** | Command Injection |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

---

### 🟡 Medium 优先级 (8 个)

#### 2. Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/components/dialogs/org/InviteMemberDialog.tsx` |
| **规则ID** | [typescript:S5852](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5852&rule_key=typescript%3AS5852) |
| **类别** | Denial of Service (DoS) |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 3. Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/components/workflow/steps/Step2Tasks.tsx` |
| **规则ID** | [typescript:S5852](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5852&rule_key=typescript%3AS5852) |
| **类别** | Denial of Service (DoS) |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 4. Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/contexts/ClickedElementsProvider.tsx` |
| **规则ID** | [typescript:S5852](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5852&rule_key=typescript%3AS5852) |
| **类别** | Denial of Service (DoS) |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 5. Make sure that using this pseudorandom number generator is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/components/ui/toast.tsx` |
| **规则ID** | [typescript:S2245](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS2245&rule_key=typescript%3AS2245) |
| **类别** | Weak Cryptography |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 6. Make sure that using this pseudorandom number generator is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/hooks/usePreviousPath.ts` |
| **规则ID** | [typescript:S2245](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS2245&rule_key=typescript%3AS2245) |
| **类别** | Weak Cryptography |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 7. Make sure that using this pseudorandom number generator is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/stores/wsStore.ts` |
| **规则ID** | [typescript:S2245](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS2245&rule_key=typescript%3AS2245) |
| **类别** | Weak Cryptography |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 8. Make sure that using this pseudorandom number generator is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/utils/id.ts` |
| **规则ID** | [typescript:S2245](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS2245&rule_key=typescript%3AS2245) |
| **类别** | Weak Cryptography |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 9. Make sure that using this pseudorandom number generator is safe here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/vscode/bridge.ts` |
| **规则ID** | [typescript:S2245](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS2245&rule_key=typescript%3AS2245) |
| **类别** | Weak Cryptography |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

---

### 🟢 Low 优先级 (9 个)

#### 10. Use full commit SHA hash for this dependency.

| 属性 | 值 |
|------|----|
| **文件路径** | `.github/workflows/baseline-check.yml` |
| **规则ID** | [githubactions:S7637](https://sonarcloud.io/organizations/huanchong-99/rules?open=githubactions%3AS7637&rule_key=githubactions%3AS7637) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 11. Use full commit SHA hash for this dependency.

| 属性 | 值 |
|------|----|
| **文件路径** | `.github/workflows/baseline-check.yml` |
| **规则ID** | [githubactions:S7637](https://sonarcloud.io/organizations/huanchong-99/rules?open=githubactions%3AS7637&rule_key=githubactions%3AS7637) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 12. Use full commit SHA hash for this dependency.

| 属性 | 值 |
|------|----|
| **文件路径** | `.github/workflows/baseline-check.yml` |
| **规则ID** | [githubactions:S7637](https://sonarcloud.io/organizations/huanchong-99/rules?open=githubactions%3AS7637&rule_key=githubactions%3AS7637) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 13. Make sure publicly writable directories are used safely here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/contexts/ClickedElementsProvider.tsx` |
| **规则ID** | [typescript:S5443](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5443&rule_key=typescript%3AS5443) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 14. Make sure publicly writable directories are used safely here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/contexts/ClickedElementsProvider.tsx` |
| **规则ID** | [typescript:S5443](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5443&rule_key=typescript%3AS5443) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 15. Make sure publicly writable directories are used safely here.

| 属性 | 值 |
|------|----|
| **文件路径** | `frontend/src/contexts/ClickedElementsProvider.tsx` |
| **规则ID** | [typescript:S5443](https://sonarcloud.io/organizations/huanchong-99/rules?open=typescript%3AS5443&rule_key=typescript%3AS5443) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 16. Make sure the "PATH" variable only contains fixed, unwriteable directories.

| 属性 | 值 |
|------|----|
| **文件路径** | `scripts/prepare-db.js` |
| **规则ID** | [javascript:S4036](https://sonarcloud.io/organizations/huanchong-99/rules?open=javascript%3AS4036&rule_key=javascript%3AS4036) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 17. Make sure the "PATH" variable only contains fixed, unwriteable directories.

| 属性 | 值 |
|------|----|
| **文件路径** | `scripts/run-dev.js` |
| **规则ID** | [javascript:S4036](https://sonarcloud.io/organizations/huanchong-99/rules?open=javascript%3AS4036&rule_key=javascript%3AS4036) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

#### 18. Make sure the "PATH" variable only contains fixed, unwriteable directories.

| 属性 | 值 |
|------|----|
| **文件路径** | `scripts/run-dev.js` |
| **规则ID** | [javascript:S4036](https://sonarcloud.io/organizations/huanchong-99/rules?open=javascript%3AS4036&rule_key=javascript%3AS4036) |
| **类别** | Others |
| **状态** | To Review |
| **SonarCloud** | [查看详情](https://sonarcloud.io/project/security_hotspots?id=huanchong-99_GitCortex) |

---

