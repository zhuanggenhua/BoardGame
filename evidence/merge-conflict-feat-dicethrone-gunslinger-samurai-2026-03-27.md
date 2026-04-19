# 冲突解决汇报：feat-dicethrone-gunslinger-samurai

## 1. 背景
- base: `4a44bef9`（本地分支合并前 HEAD）
- head: `origin/main`（最新远端主分支）
- 触发命令: `git merge origin/main --no-commit --no-ff`

## 2. 冲突文件
- `findings.md`
- `progress.md`
- `task_plan.md`
- `src/games/dicethrone/domain/index.ts`

## 3. 解决策略
### `findings.md`
- 策略：以当前 worktree 的武士/枪手审计现场为主，保留本地版本。
- 合并要点：补了一段 `Merge Note`，说明 `origin/main` 新增的历史发现改为转存到本汇报，不直接混进当前任务主记录。
- 原因：该文件当前承担当前 worktree 的调查依据；直接把主分支多条历史专题混写进来，会破坏“当前任务唯一现场”的可读性。

### `progress.md`
- 策略：以当前 worktree 的执行日志为主，保留本地版本。
- 合并要点：补了一段 `Merge Note`，说明主分支历史进度另存于本汇报。
- 原因：该文件是当前任务的会话执行日志，不适合把 `origin/main` 的其他历史任务日志直接混写。

### `task_plan.md`
- 策略：保留当前 worktree 的正式任务计划结构。
- 合并要点：补了一段 `Merge Note`，明确本文件仍是当前 worktree 的唯一正式计划入口。
- 原因：项目规范要求正式 plan 唯一落点；当前 worktree 正在推进武士/枪手审计，不能让主分支历史 Addendum 再次扩展成并行主计划。

### `src/games/dicethrone/domain/index.ts`
- 策略：真实合并两侧导出。
- 合并要点：
  - 保留本地新增的 `SAMURAI_DICE_FACE_IDS`、`DICETHRONE_CARD_ATLAS_IDS`、`DICETHRONE_STATUS_ATLAS_IDS`
  - 同时带入主分支新增的 `DICETHRONE_COMMANDS`
- 原因：两侧都新增了有效导出，正确结果应是并集，而不是取单边。

## 4. 主分支历史补充摘要
- `origin/main` 在 2026-03-25~2026-03-26 新增了多条历史记录，主题主要包括：
  - 移动端 `exit fab sheet` 滚动锁
  - `board-shell` 横屏裁剪/滚动条修复
  - 大厅入口改成“教程 / 单机 / 对战AI”
  - OpenSpec active/archive 清理
  - AstrBot provider 与训练数据治理
- 这些历史结论没有直接丢弃，而是以摘要方式记录在此，避免污染当前 worktree 的主计划/主进度文件。

## 5. 风险与验证
- 风险点：
  - 三件套采用“当前任务优先”的单边保留策略，若后续需要查主分支历史细节，应回看 `origin/main` 或本汇报。
  - `src/games/dicethrone/domain/index.ts` 的导出并集需要至少跑一次类型/引用检查，确认无重复导出或循环依赖副作用。
- 验证命令：
  - `git diff --name-only --diff-filter=U`
  - 后续计划补跑：与武士线直接相关的 E2E / lint / 必要类型检查
- 验证结果：
  - 冲突文件已人工审阅并逐项给出策略
  - 业务验证尚未完成，待合并提交后继续执行

## 6. 结果
- 合并提交：待生成
- 推送：未执行
