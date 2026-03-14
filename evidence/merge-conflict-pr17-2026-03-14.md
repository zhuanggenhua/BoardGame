# 冲突解决汇报：PR#17（merge-open-prs-preview -> main）

## 1. 背景
- 日期：2026-03-14
- base：`origin/main`（`48581f82`）
- head：`merge-open-prs-preview`（`dd8275c0`）
- 复现命令：`git merge origin/main --no-commit --no-ff`
- GitHub 状态：`mergeable_state=dirty`

## 2. 冲突文件清单
- `src/games/smashup/abilities/wizards.ts`

## 3. 冲突原因与解决策略
### src/games/smashup/abilities/wizards.ts
- 冲突原因：主线与预合并分支都修改了巫师派系“学徒/额外行动”链路与能力注册逻辑。
- 解决策略：
  - 以 `origin/main` 的“外部行动合法性校验链路”实现为主，避免回退主线已修复逻辑。
  - 在此基础上补回预合并分支需要保留的 `wizard_archmage_pod` talent 注册能力。
- 具体保留点：
  - 新增 `wizardArchmagePodTalent`。
  - 在 `registerWizardAbilities` 中注册 `wizard_archmage_pod`。
  - 注册时机按 `wizard_archmage_pod => talent`、其余 `onPlay`。
- 具体不回退点：
  - `wizardNeophyte` 及相关 `ExternalAction*` 合法性判断函数维持主线版本。
  - 相关 imports 与 `resolveSpecial/validateActionPlaySemantics` 链路维持主线版本。

## 4. 风险评估
- 风险点 1：`wizard_neophyte` 的交互选项在不同目标类型（base/minion/special）下可能出现可选项不一致。
- 风险点 2：`wizard_archmage_pod` 的 talent 注册与 ongoing 触发路径可能出现重复或漏触发。

## 5. 验证清单
- 冲突标记检查：`git diff --name-only --diff-filter=U` => 空（已解完冲突）。
- 最小回归测试（实际执行）：
  - `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts`
  - `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`
- 执行命令：
  - `npx vitest run src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts --config vitest.config.core.ts --pool threads --no-file-parallelism --maxWorkers 1`
- 结果：
  - `wizard-neophyte-ongoing.test.ts`：`2 passed`
  - `wizard-archmage-zombie-interaction.test.ts`：`1 skipped`
  - 总结：`1 passed file | 1 skipped file`
- 环境说明：
  - 临时工作树默认无 `node_modules`，首次执行报 `ERR_MODULE_NOT_FOUND`。
  - 已将 `F:\\gongzuo\\webgame\\BoardGame\\node_modules` 通过目录联接映射到当前工作树后复测通过。

## 6. 结果状态
- 当前分支：`merge-pr17-resolve2`（用于修复冲突）
- 当前状态：冲突已解，待补测、待提交 merge commit、待推送回 `merge-open-prs-preview`
