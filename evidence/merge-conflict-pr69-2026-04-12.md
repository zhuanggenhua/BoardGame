# merge 冲突处理记录：PR69（2026-04-12）

## 背景
- PR：#69（修复 Smash Up 乱码文本）
- 合并工作树：pr-merge-main
- 合并提交：b9b75c99

## 冲突文件
- src/games/smashup/abilities/titans.ts
- src/games/smashup/domain/index.ts
- src/games/smashup/domain/ongoingEffects.ts
- （merge audit 额外包含）src/games/smashup/__tests__/smashup.smoke.test.ts

## 处理策略
- 选择保留主分支（HEAD）逻辑与可读注释版本。
- 具体决策：
  - titans.ts：保留更完整的 `penguins_emperor_penguin` 持续能力校验（包含随从额度与牌库顶检查），避免“可点但无效果”。
  - domain/index.ts：保留主分支的完整后处理与去重逻辑（含 `_processedDestroyEvents`、`inputEventsAlreadyReduced` 等）。
  - ongoingEffects.ts：保留主分支已清理过的可读注释与现有结构，避免回退到空注释。

## 验证与审计
- ESLint（warnings-only，无 errors）：
  - `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/abilities/ongoing_modifiers.ts src/games/smashup/abilities/titans.ts src/games/smashup/data/cards.ts src/games/smashup/domain/index.ts src/games/smashup/domain/ongoingEffects.ts`
- i18n：`npm run i18n:check`（无缺失 key）
- merge audit：`npm run merge:audit -- HEAD`
  - 审计文件数：4
  - 混合结果：4
  - 完全等于父1/父2：0
- 预提交门禁自动运行：Typecheck / Build / SmashUp Tests（均通过；ESLint warnings 已记录）。

## 备注
- 以上冲突均已手动选择主分支版本并完成合并提交。
