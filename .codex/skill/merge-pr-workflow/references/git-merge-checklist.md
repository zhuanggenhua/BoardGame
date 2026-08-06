# Git 合并冲突处理检查清单

> **目标**：确保 AI 和人工合并时都能正确处理冲突，避免误删文件或丢失代码。

## 合并前检查（Pre-Merge Checklist）

### 0. 先分类旧分支漂移与真实 PR 删除

不要直接把“当前主线相对 PR 分支显示为删除”理解成 PR 作者删除。先计算共同祖先：

```bash
MERGE_BASE=$(git merge-base main branch-name)
git diff --name-status "$MERGE_BASE" branch-name  # PR 实际提交范围
git diff --name-status "$MERGE_BASE" main         # 主线后续漂移范围
```

- 只有第一条结果中的 `D` 才是 PR 有意删除的候选项。
- 主线第二条结果中新增、而旧 PR 分支没有的测试、实现、规范、证据、资源，不算 PR 删除，默认保留主线内容。
- 旧分支导致的共享文件大改，必须从最新主线提取 PR 真实新增/修改块，禁止用旧分支整份覆盖。
- 测试和文档默认不能因为旧分支对比显示 `D` 就删除；需要 PR 明确删除记录和迁移/废弃证据。

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

**预警阈值**（删除只统计 PR 实际提交范围中的真实删除，不统计旧分支漂移）：
- ❌ PR 实际删除文件 > 50 → 必须人工审查
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

**预警阈值**（同样只统计 PR 实际提交范围中的真实删除）：
- ❌ PR 实际删除测试文件 > 0 → 必须确认测试已迁移或过时
- ❌ PR 实际删除工具脚本 > 5 → 必须确认脚本已废弃
- ⚠️ PR 实际删除文档 > 20 → 检查是否为临时文档

若只有当前主线对比显示大量删除，但共同祖先到 PR head 没有对应 `D`，应标记为“旧分支漂移”，先做有效改动提取；不得按删除阈值直接把 PR 整体判为删除意图。

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

#### 逐冲突点裁决规则（强制）

- **冲突裁决单位必须是“冲突点/冲突块”**，不是“整份文件”或“当前分支/目标分支二选一”。
- 处理 `MM/UU` 文件时，必须逐个冲突块判断：
  - 哪一侧是有效热修复 / 规则修正 / 测试补强
  - 哪一侧是有效新功能 / 新 UI / 新文档 / 新类型契约
  - 若双方都有效，**必须手工合并两边内容**
- 这不是只对 `git merge` 生效的技巧，而是根 `AGENTS.md` 中“**双边内容归并不得单边删边**”的 merge 场景具体化；凡是能看出两边都可能有效，就不能先定一边为唯一保留侧，再把另一边整份裁掉。
- **禁止**因为“主分支更权威”“当前分支是本轮工作分支”或 IDE 一键操作方便，就直接整段接受 `ours/theirs` 后结束。
- 如果某个冲突块最终只能保留单边内容，必须能明确说明：
  - 为什么另一边内容已过时、重复、错误或与当前实现冲突
  - 为什么单边保留不会把已上线/已验证的小功能、断言、文案、类型字段静默裁掉
- 对共享骨架、通用 UI、规则/校验、测试断言、i18n key、类型定义等高风险区域，默认按“**双方内容都可能有效**”处理，优先做块级合并而不是整份覆盖。
- `npm run merge:audit -- HEAD` 只能帮助发现“整份吃成单边”的风险，**不能替代逐冲突点的语义裁决**；审计通过不等于冲突解决正确。

#### 业务规则真相源优先（强制）

- **游戏核心规则、结算语义、交互口径、房规能力、公开信息边界** 发生冲突时，默认不得以“某个分支更近 / 旧 worktree 当前版本 / main 当前版本 / 最近跑通过的实现”作为裁决依据。
- 这类冲突的默认真相源只能是：
  - 规则书 / 权威规则说明 / 官方 FAQ
  - 已批准的 OpenSpec / 用户故事 / 项目专项规则文档
  - 能直接证明业务口径的现有测试与证据文档
- **允许**参考“哪一边实现更新”来缩小排查范围，但这只能用于找线索，**不能直接替代业务裁决**。
- 如果两边改动代表了**不同业务含义**，例如：
  - 是否允许查看余牌
  - 结算顺序 / 触发时机 / 控制权归属
  - 某项房规开启或关闭后的用户可见行为
  - 是否公开数量、名称、身份、候选集
  则必须先对照真相源判断哪边语义正确；没有真相源或真相源互相冲突时，必须停止并要求人工/用户裁决。
- **禁止**用“避免 main 偏置”“避免 feature 偏置”“优先对齐某边当前版本”这类实现视角，替代“规则本身要求什么”的判断。

#### 实际单边基线说明（强制）

- **不要只盯 `merge:audit` 是否显示“完全等于父1/父2”**。即使文件最终不是字节级单边，只要裁决策略本质上是“先采用某一边当前版本，再局部补几处”，也视为**实际采用单边基线**。
- 触发信号包括但不限于：
  - 汇报里出现“优先对齐某分支当前版本 / 旧 worktree 当前版本 / main 当前版本”
  - 某个高风险 UI/交互文件的大部分结构明显来自一侧，另一侧只剩零星补丁或被整体放弃
  - merge 后文件虽然不是完全等于父提交，但另一侧的功能入口、状态字段、测试断言或 UI 交互已整体消失
- **一旦命中，冲突汇报必须逐文件解释**：
  - 这份文件为什么以这一侧为基线
  - 另一侧当时有哪些仍然有效的功能/断言/契约
  - 为什么这些内容可以明确放弃、已被等价迁移，或与当前实现冲突
  - 用了哪些提交/三方 diff/测试来支撑这个判断
- **禁止**只写“高风险 UI 文件优先对齐 feat 分支当前版本”“保留 main 现有实现”“按旧 worktree 收口”这种口号式原因；这类表述只能算策略摘要，**不能替代文件级原因说明**。
- 若该文件同时承载业务规则语义，还必须补一句：**本次采用这侧基线，和规则真相源之间是什么对应关系**；否则仍视为原因不充分。

#### 恢复/回补必须对齐最新版（强制）

- **当冲突裁决或回补动作涉及“被删功能/被删 UI”的恢复时，必须确认“最新版迭代实现”**，禁止只凭直觉或旧片段直接补回。
- **不得把“最近一次出现”当作“最新版”**：最近出现可能是旧实现被重新加回，必须检查最近 2~3 次相关提交确认是否存在更迭代的版本。
- 恢复时必须写明依据（至少其一）：
  - 对应的提交号（例如 `git show <hash> -- <path>`）
  - 变更对比记录（`git diff <old> <new> -- <path>`）
  - 说明为什么选择该版本是“最新迭代版”

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
- e2e/smashup/ninja-hidden-ninja-skip-option.e2e.ts
  策略：保留文件
  原因：测试覆盖已修复的 bug，不应删除

- docs/bugs/smashup/smashup-igor-double-trigger.md
  策略：保留文件
  原因：文档记录了重要的 bug 修复过程

## 验证结果
- TypeScript 编译：✅ 通过
- 核心测试：✅ 通过 (99.8%)
- E2E 测试：✅ 通过 (95%)
```

### 5. 冲突解决汇报（强制）

每次出现冲突并完成解决后，必须额外提交一份独立汇报文档，不能只写在 commit message 里。

- **存放位置**：`evidence/merge-conflict-<分支或PR标识>-<YYYY-MM-DD>.md`
- **最低必填字段**：
  - 冲突背景（base/head、触发命令）
  - 冲突文件清单（必须列出每个 `UU` 文件）
  - 每个文件的解决策略（保留哪一侧、合并了哪些片段、原因）
  - 风险评估（可能回归点）
  - 回归与行为变化登记（区分“原 PR 目标问题 / 本次额外发现的真实回归 / 仅业务口径或规则变化”）
  - 验证清单与结果（已跑/未跑、命令、结论）
  - 最终提交信息（commit hash / push 目标分支）
- **额外强制要求**：
  - 只要某文件命中“高风险 UI/交互文件专项审查”或“实际采用单边基线说明”，该文件必须单列一段**文件级原因说明**。
  - 文件级原因说明至少回答：
    1. 为什么这份文件不能直接整份保留另一边
    2. 另一边哪些有效内容已确认迁移/放弃/失效
    3. 若判断失误，最可能丢掉哪条用户可感知行为
  - 缺少这三点时，该冲突汇报视为**未完成**，不得把“已留档”当作可 push 依据。

建议模板：

```md
# 冲突解决汇报：<分支或PR标识>

## 1. 背景
- base: <base分支/提交>
- head: <head分支/提交>
- 触发命令: `git merge <base> --no-commit --no-ff`

## 2. 冲突文件
- <path1>
- <path2>

## 3. 解决策略
### <path1>
- 策略：
- 冲突块裁决：
  - 块 A：保留左侧 / 右侧 / 双方合并
  - 块 B：保留左侧 / 右侧 / 双方合并
- 合并要点：
- 原因：
- 文件级原因说明：
  - 采用哪一侧作为基线，为什么：
  - 另一侧仍然有效但最终未保留/已迁移的内容：
  - 若这次判断错了，最可能丢失的用户行为/测试断言：
  - 支撑证据（提交号 / 三方 diff / 验证）：

## 4. 风险与验证
- 风险点：
- 验证命令：
- 验证结果：

## 5. 结果
- 提交：
- 推送：
```

### 6. 单边覆盖审计（强制）

冲突全部解决并生成 merge commit 后，必须立即运行一次单边覆盖审计，确认没有把某个冲突文件整份吃成单边结果却无人察觉。

```bash
# 默认审计 HEAD（HEAD 必须是 merge commit）
npm run merge:audit -- HEAD

# 严格模式：只要发现某个冲突文件完全等于某一侧父提交，就直接失败
npm run merge:audit:strict -- HEAD
```

**审计结果含义**：
- `混合结果`：通常符合预期，说明文件同时保留了两侧内容
- `完全等于父1` / `完全等于父2`：高风险，必须人工解释为什么整份取单边仍然正确
- `与两侧相同`：通常是格式化、空白或无实质差异

**强制要求**：
- 只要输出出现 `完全等于父1` 或 `完全等于父2`，就不能直接 push
- 必须在冲突汇报文档中逐个写明这些文件为什么可以单边保留
- 如果无法给出明确理由，回到三方对比重新检查

**典型风险信号**：
- 测试文件整份等于一侧，另一侧新加断言被静默覆盖
- 大文件（如 `reducer.ts` / `abilities/*.ts`）整份等于一侧，另一侧热修复未带入
- 冲突文件数量很多，但最终几乎全是单边结果

## 合并后验证（Post-Merge Verification）

### 0. 回归与行为变化登记（强制）

无论本次是否真的发生 `git merge` 冲突，只要任务包含 **PR 审查 / 修复 / 推送 / 合并**，在最终收尾前都必须补一份“回归与行为变化登记”。

**最低要求**：
- 必须列出本次任务识别到的所有回归点、行为变化点、规则口径变化点
- 每一项必须明确归类：
  - 原 PR 目标问题：作者本来就在修的 bug / 行为偏差
  - 本次额外发现的真实回归：在审查、补修、合并过程中额外发现的实现缺口
  - 仅业务口径 / 规则变化：不应作为 bug 统计，但需要同步更新规范、规则文档或测试口径
- 若某项属于“仅业务口径 / 规则变化”，必须补充建议更新落点，例如：
  - `src/games/<gameId>/rule/`
  - `AGENTS.md`
  - `docs/ai-rules/*.md`
  - 对应 `evidence` / spec / 测试注释
- 如果本次未发现额外回归，也必须显式写明“本次未发现额外回归，仅处理原 PR 目标问题”

**落点要求**：
- 若本次已经产出冲突汇报文档，则把该登记放进同一份 `evidence/merge-conflict-*.md`
- 若本次没有冲突汇报文档，也必须在最终 PR 收尾汇报中单列“回归与行为变化登记”
- 禁止只在脑中判断或口头带过，不落文档 / 汇报

**目的**：
- 防止把“原作者修的 bug”和“本次补修时额外挖出的回归”混为一谈
- 防止把“只是业务变更 / FAQ 口径变化”误报成代码回归
- 让后续规范更新、规则文档修订、测试口径调整都有可追溯入口

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

### 错误 4：把冲突裁决当成单边覆盖题

**问题**：看到 `both modified` / `UU` 就直接接受 `ours` 或 `theirs`，导致另一侧已存在的有效功能、规则修正、测试断言或共享 UI 能力被静默删掉。

**解决方案**：
```bash
# 1. 先看三方差异，不要直接点单边接受
git diff main...branch-name -- path/to/file

# 2. 逐个冲突块判断保留左侧、右侧还是双方合并
git mergetool path/to/file

# 3. 合并完成后运行单边覆盖审计
npm run merge:audit -- HEAD
```

**最低要求**：
- 对每个冲突块记录“保留哪边 / 为什么 / 是否合并双方”
- 不能用“编译通过了”代替语义确认
- 如果某文件最终整份等于单边结果，必须在冲突汇报里解释为什么这样仍然正确

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
