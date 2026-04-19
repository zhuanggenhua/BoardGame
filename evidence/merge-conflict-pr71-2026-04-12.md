# merge-conflict-pr71-2026-04-12

## 背景
- PR: #71 fix(smashup): complete titan logic gaps
- 合并工作树: .worktrees/pr-merge-main

## 冲突文件
- src/games/smashup/abilities/titans.ts
- src/games/smashup/data/titans.ts
- src/games/smashup/__tests__/smashup.smoke.test.ts

## 处理要点
- 保留并合并 PR 的泰坦规则缺口修复逻辑（special/talent/ongoing 行为补齐）。
- smoke 测试用例按新规则对齐：
  - 鲜血领主 special 需手动发动入场
  - 六足死神触发直接加指示物
  - 滑稽巨人：special 只能进空基地、对手无额外手牌不可入场、回合结束结算加指示物、talent 入口可用
- 未采纳的生成物改动：src/games/manifest.client.generated.tsx 已恢复到 HEAD，避免无关噪音。

## 验证
- npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts
- npm run i18n:check

## 备注
- 合并提交后将执行 merge:audit 与门禁测试。
