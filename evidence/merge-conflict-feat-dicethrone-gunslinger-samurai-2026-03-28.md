# 冲突解决汇报：feat-dicethrone-gunslinger-samurai

## 1. 背景
- base: `main@ddb7ca69c1ee001ce0c0873b58d5a177c99fd64e`
- head: `feat/dicethrone-gunslinger-samurai@91862e3e95888f4b2682a4d1ad0c026621aaf7aa`
- 触发命令: `git merge feat/dicethrone-gunslinger-samurai --no-commit --no-ff`
- merge commit: `8207cedf2f528015d6125bd6466484386939c726`

## 2. 冲突文件
- `findings.md`

## 3. 解决策略

### `findings.md`
- 策略: 保留 `main` 上已有的 Batch 3 审计附录，同时追加本轮 `The Law` 四人 2v2 适配结论。
- 合并要点:
  - 不删除 `main` 已经写入的 `Shadow Manipulation / direct-dice / Batch 3` 收口结论。
  - 将功能分支新增的 `The Law` 四人 2v2 敌我过滤、单测、联机 E2E 和闭环结论作为新的附录追加。
- 原因:
  - 两侧都在追加事实记录，不存在互斥裁决。
  - 若单边取舍，会丢掉已有 Batch 3 审计结论或这轮 `The Law` 四人适配证据。

## 4. 自动合并但需关注的文件
- `e2e/dicethrone-simple-start.e2e.ts`
  - 自动合并结果保留了 `main` 现有四人交互用例，并带入 `The Law` 四人联机真实点击回归。
- `progress.md`
  - 自动合并结果同时保留了 `main` 的 Batch 3 进度和这轮 `The Law` 四人适配进度。
- `task_plan.md`
  - 自动合并结果同时保留了 `main` 当前计划上下文与这轮专项补充。

## 5. 风险评估
- 风险点 1: 四人联机 E2E 存在起服偶发，可能出现 `game_server_unavailable` 后跳过。
- 风险点 2: `The Law` 这条链路同时覆盖领域规则与在线 UI，若后续改坏 `getOpponents()` 或多人目标卡渲染，`2v2` 会重新把队友暴露为候选目标。

## 6. 回归与行为变化登记

### 原 PR / 本轮目标问题
- 修复 `The Law` 在 `4` 人 `2v2` 下错误包含队友目标的问题。
- 补齐四人联机真实点击回归，证明从手牌打出后只出现敌方目标并只对敌方结算。

### 本次额外发现的真实回归
- 未发现新的实现回归。
- 但验证过程中确认了在线四人 E2E 存在环境级偶发跳过，需要以实跑通过为准，不能把 `skipped` 误当成功。

### 仅业务口径或规则变化
- 无新增规则口径变更；本次属于把既有团队模式规则正确应用到 `The Law`。

## 7. 验证清单与结果
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts -t "the law can select up to two target players in multiplayer|the law should only target enemies in 4-player team mode" --configLoader native`
  - 结果: `2 passed`
- `npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player The Law: real hand play only offers enemies in 2v2 and resolves on both"`
  - 结果: 实跑通过 `1 passed`
  - 备注: 同批验证里出现过 `game_server_unavailable` 导致的跳过，最终以通过轮次为准。
- `npm run merge:audit:strict -- HEAD`
  - 结果: `混合结果 4`，`完全等于父1/父2 = 0`

## 8. 结果
- merge commit: `8207cedf2f528015d6125bd6466484386939c726`
- push 目标: `origin/main`
