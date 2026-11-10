# 线上反馈 6a1118c965c7c371dcef9083

- 反馈原文：`为什么选到空啊`
- 发现的问题：现场快照阶段为 `startTurn`，`sourceId=smashup_reaction_choose`，选项实际包含 `trigger:onTurnStart:time_travelers_time_box:0:1` 和 `pass`；同时存在 `changerbots_mergacon` 必选触发。不是没有选项，而是玩家视角把统一 reaction prompt 看成了空选择。
- 处理方式 / 结果：复核 reaction prompt 的 live options 生成和 `timingOpportunities.test.ts` 的“只有 Pass 时不创建假 optional prompt”回归；该规则链不需要改动。
- 验证边界：当前诊断包已证明选项存在，但没有同房间截图回放来证明 UI 文案是否造成误导；不能把本条外推成所有“空选项”问题都解决。
- 当前状态：`closed`（当前现场未复现空选项，按实际选项存在关闭）。

