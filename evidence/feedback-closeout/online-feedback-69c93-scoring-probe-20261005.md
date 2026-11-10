# 线上反馈 69c93：基地结算后移动随从的真实浏览器探针

- 反馈原文：`基地计算结算bug 触发特殊能力，隔壁基地的海盗船长没法参与这个阶段，会在双方问完用不用且不用了之后再触发。但是当船长移动过去后，赢了的玩家却算输了，怀疑是移动过去的船长战斗力没有被计算在内。 同时船长移动过去后没法再触发问双方用不用特殊能力`
- 本轮目标：验证“基地计分 → 海盗湾移动 → 移动后目标基地重新计分”的真实玩家可见运行链；不把单测或夹具输入当成运行事实。

## 真实入口

- 入口：`dev:lite` 纯内存 game server + Vite + Chromium。
- 探针：`e2e/smashup/feedback-69c93-scoring-probe.e2e.ts`。
- 运行：`PW_USE_DEV_SERVERS=true PW_ALLOW_DEV_SERVER_TESTS=true PW_START_SERVERS=false node scripts/infra/run-e2e-single.mjs dev e2e/smashup/feedback-69c93-scoring-probe.e2e.ts`。
- 结果：`1 passed`。

## 直接证据

- 第一次计分：`base_pirate_cove`，总力量 `19/17`，玩家 0 / 1 的排名力量分别为 `12 / 7`，VP 变为 `15 / 8`。
- 海盗湾交互被实际消费：`SYS_INTERACTION_RESOLVED` 记录玩家 1 选择 `m3`，随后 `su:minion_moved` 记录 `wizard_chronomage` 从海盗湾移动到绿洲丛林。
- 移动后的目标基地重新计分：`base_the_jungle` 总力量 `13/12`，第二次 `su:base_scored` 明确把玩家 1 的 `wizard_chronomage` 以力量 3 纳入排名；玩家 0 VP 从 15 增至 17。
- 移动随从没有在目标基地结算前消失；该随从随后随目标基地清除进入弃牌堆，属于结算链结果，不是 UID 丢失。
- 真实运行结束阶段为 `endTurn`，不是旧夹具等待的 `base_pirate_cove` 手动交互；旧夹具超时是因为它等待已被当前自动响应链消费掉的旧入口。

## 结论

- **已证明当前实现能复现实际计分链，并把移动随从的力量计入第二基地计分。**
- **未证明历史“赢者算输”症状已被同一线上房间完全复原或根治。** 本轮没有原反馈房间 / request / state 快照，使用的是按反馈语义重建的最小可玩场景，因此不能把这次 PASS 扩大为线上历史故障已修复。
- 原有“旧交互名超时 → 当前未复现 → closed”的证据不足；今后应按本报告保留阶段、interaction、actionLog、eventStream 和玩家可见截图后再下结论。
