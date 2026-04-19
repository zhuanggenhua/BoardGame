# 冲突解决汇报：feat-ai-repo-workbench

## 1. 背景
- base: `origin/main` @ `ab89f957`
- head: `feat/ai-repo-workbench` @ `c9d2ce87`
- 触发命令: `git merge origin/main --no-commit --no-ff`

## 2. 冲突文件
- `e2e/_shared/lobby.e2e.ts`
- `openspec/changes/add-ai-repo-workbench/design.md`
- `openspec/changes/add-ai-repo-workbench/proposal.md`
- `openspec/changes/add-ai-repo-workbench/specs/ai-repo-workbench/spec.md`
- `openspec/changes/add-ai-repo-workbench/tasks.md`
- `server.ts`
- `src/App.tsx`
- `src/components/lobby/CreateRoomModal.tsx`
- `src/pages/Home.tsx`

## 3. 解决策略
### `e2e/_shared/lobby.e2e.ts`
- 策略：合并两侧断言。
- 合并要点：保留当前分支对“加入 AI”按钮文案状态的断言，同时带入主分支新增的默认难度断言、截图留证和切换到“困难”难度的操作。
- 原因：两边覆盖的是同一条房间创建链路，但验证点不同，合并后覆盖更完整。

### `openspec/changes/add-ai-repo-workbench/design.md`
- 策略：保留当前分支版本。
- 合并要点：采用当前分支已收敛到 LangGraph + Flowise fork 基线、五层骨架和实施边界的设计稿。
- 原因：主分支版本是较早期的 capability 方案；当前分支版本已经反映真实实现状态，信息更完整。

### `openspec/changes/add-ai-repo-workbench/proposal.md`
- 策略：保留当前分支版本。
- 合并要点：保留当前分支关于 fork 裁决、local-first、`new-faction` 模板收敛和后续接入边界的说明。
- 原因：当前分支版本已覆盖主分支早期提案内容，并进一步明确了真实实施范围。

### `openspec/changes/add-ai-repo-workbench/specs/ai-repo-workbench/spec.md`
- 策略：保留当前分支版本。
- 合并要点：保留当前分支的规范条目与状态定义。
- 原因：当前分支 spec 对应已完成实现，主分支版本较旧。

### `openspec/changes/add-ai-repo-workbench/tasks.md`
- 策略：保留当前分支版本。
- 合并要点：保留当前分支已完成/未完成任务状态，尤其是 LangGraph orchestrator、Flowise shell 接入和未完成的 schema / remote repo 细化项。
- 原因：当前分支任务清单更贴近真实进度。

### `server.ts`
- 策略：合并双方。
- 合并要点：保留主分支新增的 `APP_CORS_ORIGINS` 合并白名单，同时保留当前分支 `isDevLoopbackOrigin()` 和 `isAllowedCorsOrigin()` 对开发期动态 loopback 端口的放行逻辑。
- 原因：主分支修复了 app/web 多来源 CORS；当前分支修复了本地 dev 端口弹性，两者都不能丢。

### `src/App.tsx`
- 策略：合并双方。
- 合并要点：保留主分支对 Android 壳构建的 devtools 路由屏蔽，同时接回当前分支新增的 `AIRepoWorkbench` 懒加载和 `/dev/ai-repo-workbench` 路由。
- 原因：Android 壳不应暴露这些开发页，但桌面端需要保留工作台入口。

### `src/components/lobby/CreateRoomModal.tsx`
- 策略：合并双方。
- 合并要点：保留主分支新增的 `setAiDifficulty(resolveLocalAiDifficulty(...))`，同时使用 `hasSavedPreferences` 作为 `setEnableAi()` 的条件。
- 原因：主分支修复了本地 AI 难度默认值恢复；当前分支旧写法会丢掉这部分状态。

### `src/pages/Home.tsx`
- 策略：合并双方。
- 合并要点：保留当前分支的 `AIRepoWorkbench` 预加载逻辑，并补入主分支对 Android 壳 devtools 卡片的屏蔽；同时在 Android 壳下屏蔽 `airepoworkbench`。
- 原因：桌面端仍需预加载体验，Android 壳不能误开开发工具入口。

## 4. 风险与验证
- 风险点：
  - `AIRepoWorkbench` 入口与 Android 壳屏蔽逻辑同时存在，后续若首页 devtools 清单再扩展，需要同步维护白名单。
  - `server.ts` 的 CORS 行为同时叠加静态白名单和 dev loopback 放行，后续若继续调整跨端来源配置，需要一起回归。
  - `add-ai-repo-workbench` OpenSpec 当前采用当前分支版本，若主分支后续再更新同一 change，需要避免重复并行编辑。
- 验证命令：
  - `npm run typecheck`
  - `npx openspec validate add-ai-repo-workbench --strict --no-interactive`
  - `npm run merge:audit:strict -- HEAD`
- 验证结果：
  - `typecheck` 通过
  - `openspec validate` 通过
  - `merge:audit:strict` 通过；17 个审计文件全部为“混合结果”，没有单边覆盖

## 5. 回归与行为变化登记
- 原 PR 目标问题：
  - `feat/ai-repo-workbench` 继续推进 LangGraph 后端编排、Flowise workflow shell 接入、工作台页面重写与上游 Flowise fork 基线落地。
- 本次额外发现的真实回归：
  - 本地房间创建弹窗的 AI 难度默认值恢复逻辑仅存在于主分支，若直接保留当前分支版本会回退该修复；已在 `src/components/lobby/CreateRoomModal.tsx` 合并保留。
  - Android 壳对开发工具路由的屏蔽仅存在于主分支，若直接保留当前分支版本会重新暴露 dev 页面；已在 `src/App.tsx` 与 `src/pages/Home.tsx` 合并保留。
- 仅业务口径 / 规则变化：
  - `add-ai-repo-workbench` OpenSpec 文档采用当前分支版本，不是行为回归，而是以已落地实现为准收敛 capability 口径。

## 6. 结果
- 提交：`503cb937` `merge(main): 同步主分支到 ai-repo-workbench`
- 推送：未执行
