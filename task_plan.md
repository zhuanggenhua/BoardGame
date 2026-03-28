# Task Plan: Smash Up Titans 合并收口

## Context
- 当前工作树：`D:\gongzuo\webgame\BoardGame-smashup-titans`
- 当前分支：`feat/smashup-titans`
- 当前目标：完成 `origin/main` 合并收口，提交 merge commit，推送，并将 GitHub PR #43 合并到 `main`
- 用户口径：只保留“已有完整派系运行时支撑”的泰坦实现；未接入派系的占位泰坦直接隐藏，不继续实现

## Done
- 已完成 Smash Up Titans 本轮代码与规则收口
- 已人工融合关键冲突文件：
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/domain/commands.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/abilities/bear_cavalry.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
  - `src/games/smashup/manifest.ts`
  - `src/games/smashup/ui/DeckDiscardZone.tsx`
  - `scripts/infra/e2e-port-config.js`
- 已整理并保留本工作树三件套的当前版本口径
- 已完成回归：
  - `npm run typecheck`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native -t "ongoing -2 不应在回合开始被清零"`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native`

## Remaining
1. 确认已无冲突标记与 unresolved 文件
2. `git add` 标记所有已解决冲突
3. 再跑一轮最小回归
4. 提交 merge commit
5. `git push`
6. 检查并合并 PR #43

## Acceptance
- `git diff --name-only --diff-filter=U` 为空
- `npm run typecheck` 通过
- `src/games/smashup/__tests__/smashup.smoke.test.ts` 通过
- `feat/smashup-titans` 已推送
- PR #43 已进入终态（合并成功或明确记录阻塞）

## Risks
- 这棵工作树是并发环境，不能误覆盖用户或其他 AI 的非本任务改动
- 本轮只收口当前 Titans 任务，不扩散处理其他分支线
