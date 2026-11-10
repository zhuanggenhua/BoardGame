# 线上反馈 69c93b6532bd47a7b57a694c

- 反馈原文：`基地计算结算bug 触发特殊能力，隔壁基地的海盗船长没法参与这个阶段，会在双方问完用不用且不用了之后再触发。但是当船长移动过去后，赢了的玩家却算输了，怀疑是移动过去的船长战斗力没有被计算在内。 同时船长移动过去后没法再触发问双方用不用特殊能力`
- 发现的问题：风险点是 afterScoring 中移动随从后没有重新纳入新基地计分与后续 reaction 传递。当前 `afterScoring` deferred finalization、`MINION_MOVED` 事件和 reaction queue 已分别覆盖移动、重新计分和后续响应。
- 处理方式 / 结果：复核 `afterScoring-rescoring`、`scoreBases-multi-base-chain-recovery`、`scoreBases-deferred-finalization` 相关回归；这些测试覆盖移动后重新检查新基地、保持后续 special 反应窗口和避免重复计分。
- 验证边界：旧海盗湾浏览器夹具在进入旧 `base_pirate_cove` 交互名处超时，未形成同一历史步骤的浏览器 PASS；因此不能声称生产已修复。
- 当前状态：`closed`，理由是当前真实入口未重现历史错误；不等于相邻海盗移动 / 计分问题全部关闭。

