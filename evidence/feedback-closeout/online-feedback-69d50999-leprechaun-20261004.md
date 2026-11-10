# 线上反馈 69d50999：粗鲁少妇为什么被消灭

## 反馈内容 / 现实症状

- 游戏：大杀四方
- 反馈原文：`为什么粗鲁少妇被消灭了`
- 对象：粗鲁少妇、矮妖、蘑菇王国

## 发现的问题

现场日志显示粗鲁少妇在蘑菇王国登场后，紧接着被 `trickster_leprechaun` 消灭。规则原文为：`Ongoing: After another player plays a minion here with less power than this minion's power, destroy it (resolve its ability first).` 矮妖力量为 5，粗鲁少妇力量为 2，触发条件成立。

## 处理方式 / 验证结果

核对 `src/games/smashup/__tests__/fixtures/wikiSnapshots.ts`、矮妖卡面数据和 `src/games/smashup/abilities/tricksters.ts` 的触发实现；实现按力量比较并由矮妖触发消灭，符合规则。没有修改代码，避免把合法消灭改成错误保护。历史真实房间日志与当前实现一致。

## 漏审复盘

旧反馈只记录了消灭结果，没有把矮妖力量 5 与粗鲁少妇力量 2 的规则对账写进收口记录。现有反馈规范已覆盖“规则原文 + 完整对象 + 实现消费点”核对，本轮补齐记录。
