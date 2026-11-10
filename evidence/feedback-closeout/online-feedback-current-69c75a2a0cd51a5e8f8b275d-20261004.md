# 线上反馈 69c75a2a0cd51a5e8f8b275d

- 反馈原文：`bug：冠军外可以移动随从的基地在结算后，被移动的随从消失了（同在一个基地的大幅倒是正常移动了）`
- 发现的问题：历史症状指向 `BASE_CLEARED` / afterScoring 时序导致随从先进入弃牌堆，随后 `MINION_MOVED` 按旧基地索引找不到对象。当前 reducer 已有 UID 级弃牌堆恢复逻辑。
- 处理方式 / 结果：`src/games/smashup/domain/reduce.ts:2967` 在基地已清除且随从已进弃牌堆时按 UID 恢复到目标基地；`pirates-ongoing`、`afterScoring-chain-propagation`、`afterScoring-rescoring` 共 49 项通过。
- 验证边界：专用浏览器夹具仍等待旧的 `base_pirate_cove` 交互名并超时，未获得同一历史步骤的浏览器 PASS；因此本轮只确认了本地 reducer 防线和规则链回归，不能声称生产已修复。
- 当前状态：`closed`，理由是当前真实入口未重现“随从消失”，但保留“未复现不等于已修复”的边界。

