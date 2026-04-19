# 冲突解决汇报：remote-branch-2026-03-28

## 1. 背景
- base: `origin/chore/mobile-adaptive-spec-split` @ `a0c218bf`
- head: `chore/mobile-adaptive-spec-split` @ `39f18037`
- 触发命令: `git merge origin/chore/mobile-adaptive-spec-split --no-commit --no-ff`

## 2. 冲突文件
- `src/components/game/framework/CriticalImageGate.tsx`
- `src/components/game/framework/__tests__/CriticalImageGate.test.tsx`
- `src/games/cardia/criticalImageResolver.ts`

## 3. 解决策略
### `src/components/game/framework/CriticalImageGate.tsx`
- 策略：保留当前分支的 `warmPreloadScheduler` 调度实现。
- 合并要点：保留页面可见性暂停/恢复 warm 队列，以及 `enqueue` 调度；不回退为直接 `preloadWarmImages`。
- 原因：当前分支的图片暖加载调度更完整，能避免后台页继续抢占连接池。

### `src/components/game/framework/__tests__/CriticalImageGate.test.tsx`
- 策略：合并两边测试，保留当前分支新增的容器锚定断言。
- 原因：远端没有这条测试，直接丢弃会降低当前分支覆盖率。

### `src/games/cardia/criticalImageResolver.ts`
- 策略：吸收远端修复，把 `location` 图片恢复为 critical，并从 warm 中移除。
- 原因：远端提交明确修复了 `cardia critical location images`，应保留该热修复。

## 4. 风险与验证
- 风险点：`CriticalImageGate` 调度策略与 `cardia` 关键图列表同时变化，可能影响首屏加载表现。
- 验证命令：待 merge commit 后执行 push 前校验。
- 验证结果：待执行。

## 5. 结果
- 提交：待生成 merge commit
- 推送：未执行
