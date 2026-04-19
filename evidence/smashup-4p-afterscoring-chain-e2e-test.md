# SmashUp 4 人 afterScoring 复杂交互链 E2E 证据

## 测试目标

验证 4 人场景下，`pirate_king_move + base_tortuga + 4 * pirate_first_mate_choose_base` 共 6 个交互能串行完成，并且不会出现重复计分或流程锁死。

## 测试文件与命令

- 测试文件：`e2e/smashup-complex-multi-base-scoring.e2e.ts`
- 新增用例：`4p afterScoring chain handles 6 interactions without duplicate score`
- 运行命令：

```bash
npm run test:e2e:ci -- e2e/smashup-complex-multi-base-scoring.e2e.ts
```

- 结果：`2 passed`

## 证据截图

### 1) 初始态（4 人 + 复杂交互前）

![4p-initial](../test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/4p-afterScoring-chain-handles-6-interactions-without-duplicate-score/4p-01-initial.png)

观察：
- 已进入对局态（`TURN9 / PlayCards`），非派系选择界面。
- 4 人计分板可见，托尔图加一侧存在高压随从堆叠，满足触发复杂交互链条件。

### 2) 终态（6 交互串行完成后）

![4p-final](../test-results/evidence-screenshots/smashup-complex-multi-base-scoring.e2e/4p-afterScoring-chain-handles-6-interactions-without-duplicate-score/4p-02-final.png)

观察：
- 回到 `Play` 阶段，流程未卡死。
- 分数为 `4/3/2/0`（总分 9），符合 4 人单基地计分的一次结算分配。
- 托尔图加已被替换，链路已完整推进。

## 关键断言

- 交互链长度固定为 6：`1 * pirate_king_move + 1 * base_tortuga + 4 * pirate_first_mate_choose_base`。
- 最终无挂起交互/响应窗口，且相位回到 `playCards`，当前玩家推进到下家。
- 最终 VP 分布排序为 `[0, 2, 3, 4]`，总 VP 为 `9`，用于约束“只发生一次计分”。

## 备注

执行过程中出现一次前端控制台告警：`Received NaN for the 'children' attribute`。本次用例仍稳定通过，但该告警建议后续单独排查。
