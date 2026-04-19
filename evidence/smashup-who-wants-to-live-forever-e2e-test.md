# SmashUp 无人想要永生交互回归验证

## 问题

- 用户反馈：`无人想要永生` 在移除力量指示物过程中，交互会自动关闭，而且没有进入确认抽牌。
- 根因：这张牌是“移除 1 个指示物后立刻重建下一轮交互”的多步流程，但原实现沿用了默认 `snapshot` 响应校验。
- 当玩家快速连点最后一个仍显示在旧快照里的目标时，旧 `optionId` 会先把当前交互消费掉；随后 handler 发现目标已经没有指示物，就不再补出下一轮交互，于是表现成“交互自动关闭”。

## 修复

- 文件：[giant_ants.ts](/F:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/giant_ants.ts)
- 修改：给 `giant_ant_who_wants_to_live_forever` 显式声明 `responseValidationMode: 'live'`。
- 效果：响应阶段改为按最新状态重验候选，过期 `optionId` 会被拒绝，不会吞掉当前交互。

## 覆盖范围

### 单元 / 审计

- [newFactionAbilities.test.ts](/F:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/newFactionAbilities.test.ts#L557)
  - 保留原有 happy path：逐次移除指示物，确认后抽牌。
  - 新增回归：旧 `optionId` 在最后一个指示物移除后应返回“无效的选择”，且当前交互必须继续存在。
- [interactionTargetTypeAudit.test.ts](/F:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts#L79)
  - 锁定 `giant_ant_who_wants_to_live_forever` 的交互契约必须包含 `targetType: 'minion'` 和 `responseValidationMode: 'live'`。

### 端到端

- [smashup-robot-hoverbot-chain.e2e.ts](/F:/gongzuo/webgame/BoardGame/e2e/smashup-robot-hoverbot-chain.e2e.ts#L331)
  - 正常完整流程：打出 `无人想要永生` -> 连续两次点选同一随从移除 2 个指示物 -> 只剩确认/取消 -> 点击确认 -> 手牌成功增加 2 张、行动进入弃牌堆。
- [smashup-robot-hoverbot-chain.e2e.ts](/F:/gongzuo/webgame/BoardGame/e2e/smashup-robot-hoverbot-chain.e2e.ts#L417)
  - UI 回归流程：只有 1 个指示物时快速双击目标 -> 交互仍停留在确认步骤 -> 点击确认后正常抽牌，不会自动关闭。

## E2E 截图自审结论

- 已在本次会话中查看 happy path 和双击回归截图。
- happy path 最后一张截图显示：交互已关闭，目标随从指示物为 0，抽到的卡已进入手牌，`无人想要永生` 已进入弃牌堆。
- 双击回归中间截图显示：双击最后一个目标后，界面仍停留在“确认并抽牌”阶段，没有被提前吞掉。
- 双击回归最终截图显示：确认后交互正常结束，抽牌结果正确落到手牌。

## 实际执行结果

### 已通过

- 本次修改后，`PW_USE_DEV_SERVERS=true` 模式下，这个文件的 7 条 Playwright 用例已实际跑通，包含上面两条 `无人想要永生` 用例。

### 当前阻塞：正式 E2E CI

- 在当前 Codex 沙箱里，正式命令

```bash
npm run test:e2e:ci -- e2e/smashup-robot-hoverbot-chain.e2e.ts
```

  会在启动测试基础设施前失败，不是业务断言失败：
  - 单 worker `global-setup` 等待 `http://127.0.0.1:20000/games` 超时。
  - 前台复现显示根因是测试启动脚本里的子进程拉起被沙箱拦截，报 `spawn EPERM`。
  - 这属于当前执行环境限制，不是 `无人想要永生` 逻辑回归。

### 当前阻塞：Vitest 复跑

- 本次会话里重新执行

```bash
npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts
npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts
```

  也被同一类沙箱限制阻塞，在加载 Vitest 配置阶段触发 `esbuild` 的 `spawn EPERM`。
- 代码层面的回归覆盖已经补齐，但当前沙箱无法稳定复跑这两条命令。
