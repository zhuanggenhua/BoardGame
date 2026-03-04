# Git 合并冲突处理检查清单

> **目标**：确保 AI 和人工合并时都能正确处理冲突，避免误删文件或丢失代码。

## 合并前检查（Pre-Merge Checklist）

### 1. 分支状态检查

```bash
# 查看双方的提交历史
git log --oneline --graph main...branch-name -20

# 查看提交数量差异
COMMITS_AHEAD=$(git rev-list --count main..branch-name)
COMMITS_BEHIND=$(git rev-list --count branch-name..main)
echo "分支领先主分支: $COMMITS_AHEAD 个提交"
echo "分支落后主分支: $COMMITS_BEHIND 个提交"
```

**预警阈值**：
- ⚠️ 分支落后主分支 > 50 个提交 → 建议先同步主分支
- ⚠️ 分支领先主分支 > 100 个提交 → 建议拆分为多个 PR

### 2. 文件变更统计

```bash
# 查看文件变更统计
git diff --stat main...branch-name

# 统计新增/修改/删除的文件数量
ADDED=$(git diff --diff-filter=A --name-only main...branch-name | wc -l)
MODIFIED=$(git diff --diff-filter=M --name-only main...branch-name | wc -l)
DELETED=$(git diff --diff-filter=D --name-only main...branch-name | wc -l)

echo "新增文件: $ADDED"
echo "修改文件: $MODIFIED"
echo "删除文件: $DELETED"
```

**预警阈值**：
- ❌ 删除文件 > 50 → 必须人工审查
- ❌ 修改文件 > 200 → 建议拆分 PR
- ⚠️ 新增文件 > 100 → 检查是否包含不必要的文件

### 3. 关键文件检查

```bash
# 检查是否删除了测试文件
DELETED_TESTS=$(git diff --diff-filter=D --name-only main...branch-name | grep -E '\.(test|spec|e2e)\.(ts|tsx)$' | wc -l)
echo "删除的测试文件: $DELETED_TESTS"

# 检查是否删除了工具脚本
DELETED_SCRIPTS=$(git diff --diff-filter=D --name-only main...branch-name | grep -E '^scripts/.*\.(mjs|js|ts)$' | wc -l)
echo "删除的工具脚本: $DELETED_SCRIPTS"

# 检查是否删除了文档
DELETED_DOCS=$(git diff --diff-filter=D --name-only main...branch-name | grep -E '\.(md|txt)$' | wc -l)
echo "删除的文档: $DELETED_DOCS"
```

**预警阈值**：
- ❌ 删除测试文件 > 0 → 必须确认测试已迁移或过时
- ❌ 删除工具脚本 > 5 → 必须确认脚本已废弃
- ⚠️ 删除文档 > 20 → 检查是否为临时文档

### 4. 冲突预测

```bash
# 预测可能的冲突文件
git merge-tree $(git merge-base main branch-name) main branch-name | grep -E '^changed in both'
```

## 合并执行（Merge Execution）

### 1. 使用安全的合并策略

```bash
# 方案 A: 交互式合并（推荐）
git merge branch-name --no-commit --no-ff

# 方案 B: 使用 patience 算法（更保守）
git merge -X patience branch-name --no-commit --no-ff
```

### 2. 检查合并状态

```bash
# 查看所有变更
git status

# 查看文件状态变化
git diff --name-status

# 查看冲突文件
git diff --name-only --diff-filter=U
```

### 3. 处理冲突

#### 冲突类型识别

```bash
# 查看冲突类型
git status | grep -E '(both modified|deleted by|added by)'
```

**冲突类型**：
- `both modified` (MM) - 双方都修改了同一文件
- `deleted by us` (DU) - 我们删除了，对方修改了
- `deleted by them` (UD) - 对方删除了，我们修改了
- `both added` (AA) - 双方都新增了同名文件

#### 冲突解决策略

**对于 `both modified` (MM)**：
```bash
# 1. 查看双方的差异
git diff main...branch-name -- path/to/file

# 2. 使用 mergetool（推荐）
git mergetool path/to/file

# 3. 或手动编辑冲突标记
# <<<<<<< HEAD (当前分支)
# 我们的代码
# =======
# 对方的代码
# >>>>>>> branch-name
```

**对于 `deleted by them` (UD)**：
```bash
# 1. 检查文件在主分支的最后状态
git show main:path/to/file

# 2. 决策：
# - 如果文件确实应该删除 → git rm path/to/file
# - 如果文件应该保留 → git add path/to/file
```

**对于 `deleted by us` (DU)**：
```bash
# 1. 检查文件在分支的最后状态
git show branch-name:path/to/file

# 2. 决策：
# - 如果文件确实应该删除 → git rm path/to/file
# - 如果文件应该保留 → git checkout branch-name -- path/to/file && git add path/to/file
```

### 4. 冲突解决文档

在合并提交信息中记录：

```
Merge branch 'feature-x' into main

冲突解决记录：

## 双方都修改 (MM)
- src/games/smashup/game.ts
  策略：保留主分支的 bug 修复 + 合并分支的新功能
  原因：主分支修复了海盗王重复触发 bug，分支添加了 POD 派系支持

- src/engine/systems/FlowSystem.ts
  策略：保留主分支的 afterEvents 优化
  原因：主分支的优化修复了多个 bug

## 对方删除 (UD)
- e2e/ninja-hidden-ninja-skip-option.e2e.ts
  策略：保留文件
  原因：测试覆盖已修复的 bug，不应删除

- docs/bugs/smashup-igor-double-trigger.md
  策略：保留文件
  原因：文档记录了重要的 bug 修复过程

## 验证结果
- TypeScript 编译：✅ 通过
- 核心测试：✅ 通过 (99.8%)
- E2E 测试：✅ 通过 (95%)
```

## 合并后验证（Post-Merge Verification）

### 1. 文件完整性检查

```bash
# 检查实际删除的文件
git diff HEAD~1 HEAD --diff-filter=D --name-only

# 验证关键文件仍然存在
echo "测试文件数量: $(git ls-files | grep -E '\.(test|spec|e2e)\.(ts|tsx)$' | wc -l)"
echo "工具脚本数量: $(git ls-files | grep -E '^scripts/.*\.(mjs|js|ts)$' | wc -l)"
echo "文档数量: $(git ls-files | grep -E '\.(md|txt)$' | wc -l)"
```

**验证标准**：
- ✅ 测试文件数量不应减少（除非有明确的迁移记录）
- ✅ 工具脚本数量不应大幅减少
- ✅ 文档数量不应大幅减少

### 2. 代码质量检查

```bash
# TypeScript 编译检查
npx tsc --noEmit

# ESLint 检查
npx eslint src/ --ext .ts,.tsx

# 生产依赖检查
npm run check:prod-deps
```

### 3. 测试验证

```bash
# 运行核心测试
npm run test:games:core

# 运行 E2E 测试（可选）
npm run test:e2e

# 检查测试覆盖率
npm run test:coverage
```

### 4. 功能验证

- [ ] 启动开发服务器，确认无运行时错误
- [ ] 手动测试关键功能
- [ ] 检查控制台是否有警告或错误
- [ ] 验证新增功能正常工作

## AI 特定规范

### 合并前必须执行的检查

```typescript
// AI 必须运行以下命令并输出结果
const preMergeChecks = [
  'git log --oneline --graph main...branch-name -20',
  'git diff --stat main...branch-name',
  'git diff --diff-filter=D --name-only main...branch-name | wc -l',
  'git diff --diff-filter=D --name-only main...branch-name | grep -E "\\.(test|spec|e2e)\\.(ts|tsx)$"'
];
```

### 预警阈值触发

当检测到以下情况时，AI 必须：
1. 停止自动合并
2. 向用户报告详细信息
3. 等待用户明确指示

```typescript
const warningThresholds = {
  deletedFiles: 50,
  deletedTests: 0,
  deletedScripts: 5,
  deletedDocs: 20,
  commitsBehind: 50
};
```

### 假设验证规范

AI 在分析合并问题时，必须：

```bash
# ❌ 错误：看到删除就认为文件丢失
git diff A B --diff-filter=D  # 只能说明 B 相对 A 删除了文件

# ✅ 正确：验证合并后的实际状态
git ls-files | grep "path/to/file"  # 验证文件是否真的被删除
git diff merge-commit HEAD --diff-filter=D  # 验证合并后实际删除的文件
```

**禁止的假设**：
- ❌ "PR 分支删除了文件 → 合并后文件也被删除"
- ❌ "看到冲突标记 → 冲突解决一定有问题"
- ❌ "文件数量减少 → 一定是合并导致的"

**必须的验证**：
- ✅ 用 `git ls-files` 验证文件是否存在
- ✅ 用 `git show` 检查实际的冲突解决
- ✅ 用 `git diff` 对比合并前后的差异

## 常见错误与解决方案

### 错误 1：盲目选择"接受当前更改"

**问题**：在 IDE 中看到冲突，直接点击"接受当前更改"，丢失了对方的代码。

**解决方案**：
```bash
# 1. 查看双方的完整差异
git diff main...branch-name -- path/to/file

# 2. 使用三方对比工具
git mergetool path/to/file

# 3. 手动合并关键部分
```

### 错误 2：误判文件被删除

**问题**：看到 `git diff A B --diff-filter=D` 有输出，就认为合并后文件被删除。

**解决方案**：
```bash
# 验证文件是否真的被删除
git ls-files | grep "path/to/file"

# 检查合并后实际删除的文件
git diff merge-commit HEAD --diff-filter=D
```

### 错误 3：合并后没有运行测试

**问题**：合并完成后直接推送，没有验证功能完整性。

**解决方案**：
```bash
# 合并后必须运行
npx tsc --noEmit
npm run test:games:core
npm run dev  # 手动验证
```

## 总结

### 合并前（Pre-Merge）
1. ✅ 检查分支状态和提交历史
2. ✅ 统计文件变更（新增/修改/删除）
3. ✅ 检查关键文件（测试/脚本/文档）
4. ✅ 预测可能的冲突

### 合并中（During Merge）
1. ✅ 使用安全的合并策略（`--no-commit --no-ff`）
2. ✅ 逐个检查冲突文件
3. ✅ 记录冲突解决策略
4. ✅ 验证冲突解决的正确性

### 合并后（Post-Merge）
1. ✅ 检查文件完整性
2. ✅ 运行代码质量检查
3. ✅ 运行测试套件
4. ✅ 手动验证关键功能

### AI 特定
1. ✅ 必须运行预检查命令
2. ✅ 触发预警阈值时停止并报告
3. ✅ 验证假设，不凭部分信息下结论
4. ✅ 记录详细的冲突解决过程
