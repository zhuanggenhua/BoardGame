# 冲突解决汇报：PR 21

## 1. 背景
- base: `origin/main` at `d882a00391a07c101f768f708cdf11fd943a5f40`
- head: `pr/21` at `7f1a49a99e682c8288754093f894470176f4b4a7`
- 触发命令: `git merge pr/21 --no-commit --no-ff`

## 2. 冲突文件
- `src/games/smashup/abilities/robots.ts`

## 3. 解决策略
### `src/games/smashup/abilities/robots.ts`
- 策略: 以主分支现有引擎 API 为准，保留 PR 的功能改动。
- 合并要点:
  - `robotHoverbot` 保留主分支已升级的 `peekDeckTop(state, random, ...)` 调用方式，避免回退到旧签名。
  - `robot_microbot_archive` 保留主分支已存在的“同玩家多个 Archive 可叠加抽牌”语义。
  - 去除冲突标记，保留通过现有 `smashup` 测试覆盖验证的执行路径。
- 原因:
  - 主分支在 PR 提出后已经演进了 `peekDeckTop` helper 和机器人派系修复。
  - 直接接受 PR 侧旧实现会把 `robots.ts` 回退到过期接口，属于高风险回归。

## 4. 风险与验证
- 风险点:
  - `robots.ts` 中仍有部分历史乱码注释，未继续清理，避免在冲突修复之外扩大编辑面。
  - 本次验证聚焦 `smashup` 领域和 PR 直接相关回归，未额外跑全仓库非相关套件。
- 验证命令:
  - `npx eslint src/games/smashup/abilities/robots.ts`
  - `npm test -- src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/robot-hoverbot-stable.test.ts src/games/smashup/__tests__/robot-hoverbot-chain.test.ts`
  - `npm test -- src/games/smashup/__tests__/buryEngine.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/frankensteinFaq.test.ts src/games/smashup/__tests__/vampiresPod.test.ts`
  - `npm test -- smashup`
- 验证结果:
  - ESLint: 0 errors / 6 warnings（均为既有 `any` 警告，未新增 error）
  - 定向回归: 通过
  - `smashup` 全量回归: `140 passed / 9 skipped`

## 5. 结果
- 提交: `ecf66098f2764b7171455dcab7d1bf17a87764d5`
- 推送目标: `deathcats4/BoardGame:smashup-faction-fixes-v2`
