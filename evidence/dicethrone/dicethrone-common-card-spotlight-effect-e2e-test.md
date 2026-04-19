# DiceThrone 新角色通用卡图 / 响应链路 E2E 证据

## 范围

- 适用游戏：`dicethrone`
- 目标对象：
  - `samurai` 的 `card-boss-generous`
  - `gunslinger` 的 `card-next-time`
- 本文档修订原因：
  - 旧版本曾把 `gunslinger` 的 `card-next-time` 记录为“主阶段直接点击后获得 6 护盾”。
  - 该结论现已失效，原因不是截图看错，而是规则门禁此前缺失；2026-04-05 已改为“必须存在待结算伤害，且只能在受伤响应链路中打出”。
  - 因此，旧文档中“主阶段直接点击 `card-next-time` 并生效”这一条，**不再是有效证据**。

## 当前代码口径

- `card-next-time` 现已要求：
  - `playCondition.pendingDamage.role = target`
  - `playCondition.pendingDamage.responseType = beforeDamageReceived`
- 直接结果：
  - `main1` 预先打出会被拒绝，错误码为 `requirePendingDamage`
  - AI 仅应在 `afterAttackResolved` 响应窗口里把它当作 `response-play-card`

## 本轮执行与结果

### 1. 规则 / AI 定向测试

执行命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-system.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native
npm run i18n:check
```

结果：

- 通过
- 关键断言：
  - `下次不算不能在主阶段预先打出`
  - `本地 AI 不应在 main1 把下次不算当成主动出牌`
  - `本地 AI 在受伤响应窗口应能把下次不算作为 response-play-card 打出`

### 2. E2E 尝试与当前状态

执行命令：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "opponent common-card spotlight should match actual effect for samurai and gunslinger"
```

结果：

- `samurai / card-boss-generous` 子链路在本轮运行中继续产出有效截图
- `gunslinger / card-next-time` 已切到“待结算伤害 + 响应窗口”链路，不再沿用旧的主阶段非法路径
- 但整条 E2E 目前**尚未完全收口**

当前未收口原因：

- 响应窗口里无可用 Token 时，旧 UI 会弹“没有可用标记”的阻塞层，遮住手牌
- 本轮已补前端修正：无可用 Token 时不再弹该阻塞层
- 新一轮完整 E2E 复跑又被仓库内其他重任务门禁拦下，暂未拿到“枪手响应后弃牌 + 6 护盾最终态”的新正式证据图

## 肉眼证据

### 1. 武士 `card-boss-generous` 本轮仍然对图成功

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-common-card-spotlight-should-match-actual-effect-for-samurai-and-gunslinger\20-samurai-boss-generous-spotlight.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-common-card-spotlight-should-match-actual-effect-for-samurai-and-gunslinger\21-samurai-boss-generous-state.png`
- 我实际看到什么：
  - 对手特写出现的是 `Boss Generous` 对应卡图，不是别的通用牌
  - 状态图里 `CP` 变为 `3`
  - 这部分达到本轮验收标准

### 2. 枪手 `card-next-time` 已不再走旧的主阶段非法路径

- 路径：
  - 待补：需要重跑 `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` 中对应用例，产出新的稳定截图后回填（避免引用已不存在的旧 artifacts 路径）。
- 我实际看到什么：
  - 角色已切到枪手
  - 当前处于受伤响应场景，而不是“主阶段直接点牌就结算”
  - 页面不再出现旧文档里那种“直接结算完 6 护盾”的假链路
  - 这张图只能证明旧非法路径已被拿掉，**还不能单独证明最终响应结算已完成**

### 3. 枪手 `card-next-time` 的卡图与响应确认入口已出现

- 路径：
  - 待补：需要重跑 `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` 中对应用例，产出新的稳定截图后回填（避免引用已不存在的旧 artifacts 路径）。
- 我实际看到什么：
  - 手牌弹出的就是黄色盾牌图的 `这次不算！`
  - 卡面下方出现“目标玩家抵抗 6 进攻伤害”的描述
  - 卡牌上方出现“可以响应 / 跳过”的确认入口，说明当前确实被当成响应牌，而不是主阶段普通主动牌
  - 这张图说明卡图与响应语义已对上，但**还没达到“最终结算已完成”的验收标准**

## 当前结论

- 旧结论“枪手在主阶段直接点 `card-next-time` 获得 6 护盾”已明确作废，不能再作为已修复证据。
- 当前已确认两件事：
  - 规则 / AI 层已把 `card-next-time` 从主阶段收回到受伤响应窗口
  - 当前响应链路里出现的卡图就是 `这次不算！`，不是 `card-play-six`
- 当前仍未完全确认的一件事：
  - 线上双页 E2E 中，`gunslinger / card-next-time` 响应后“弃牌 + 6 护盾最终态”的正式成功截图还没补齐

## 后续收口要求

- 需要在仓库重任务门禁空闲后，重新运行：

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "opponent common-card spotlight should match actual effect for samurai and gunslinger"
```

- 收口标准：
  - 产出新的 `30-gunslinger-next-time-spotlight.png`
  - 产出新的 `31-gunslinger-next-time-state.png`
  - 肉眼确认：
    - 卡图是 `这次不算！`
    - 手牌移除，弃牌堆出现 `card-next-time`
    - `CP` 从 `2` 变为 `1`
    - 枪手获得 `6` 护盾
