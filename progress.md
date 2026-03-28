# Progress Log

## Session: 2026-03-28 Smash Up Titans merge 收口
- **Status:** in_progress
- Actions taken:
  - 确认当前处于 `git merge origin/main` 冲突态，目标是把 `feat/smashup-titans` 收口、推送并完成 PR #43 合并。
  - 解掉 Smash Up 关键代码冲突：
    - `src/games/smashup/domain/ongoingEffects.ts`
    - `src/games/smashup/domain/ongoingModifiers.ts`
    - `src/games/smashup/domain/commands.ts`
    - `src/games/smashup/domain/index.ts`
    - `src/games/smashup/abilities/bear_cavalry.ts`
    - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - `src/games/smashup/manifest.ts`
    - `src/games/smashup/ui/DeckDiscardZone.tsx`
    - `scripts/infra/e2e-port-config.js`
  - 关键融合点已经保留：
    - `deck inspection` 见证链
    - `onTitanMoved`
    - `titan power modifier`
    - `perInstance/sourceScope`
    - `skipImmediateStartTurnMinionTriggers`
    - `_ppseInputEventsReduced`
  - 同步清理根规范与文档冲突：
    - `AGENTS.md`
    - `docs/ai-rules/data-entry.md`
    - `docs/ai-rules/doc-index.md`
    - `docs/testing-best-practices.md`
    - 当前三件套文件
  - 运行回归并通过：
    - `npm run typecheck`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native -t "ongoing -2 不应在回合开始被清零"`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| TypeScript | `npm run typecheck` | 合并后类型层稳定 | 通过 | ✅ |
| Dinner Date POD 定向 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native -t "ongoing -2 不应在回合开始被清零"` | 不再出现重复附着/重复 -2 | 通过 | ✅ |
| Smash Up smoke 整份 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native` | 合并后泰坦与既有规则整体不回归 | `83 passed` | ✅ |

## Next Step
- 清完剩余未解决文件并 `git add` 标记冲突已解决
- 提交 merge commit
- `git push`
- 检查 PR #43 的 checks / mergeState，并执行 merge 或 auto-merge
