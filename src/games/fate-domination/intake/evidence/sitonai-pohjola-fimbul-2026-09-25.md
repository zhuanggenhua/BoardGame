# Sitonai / Pohjola Fimbul 证据记录

状态：`disputed`

## 目标对象

- Servant：Sitonai
- 技能牌：Pohjola Fimbul
- 项目字段：`sc_sitonai_2`
- 中文运行时名称：`冻结吧，天上的诸力`

## 主真相源证据

1. Wiki 对象页：`https://fatedomination.fandom.com/wiki/Sitonai`
2. Wiki 卡牌页：`https://fatedomination.fandom.com/wiki/Pohjola_Fimbul`
3. Wiki 卡面原图：`https://static.wikia.nocookie.net/fatedomination/images/9/95/Pohjola_Fimbul.png/revision/latest/scale-to-width-down/1200?cb=20230703084436`
4. 本地 TTS Workshop 对象：
   `C:\Users\zhuagenbao\Documents\My Games\Tabletop Simulator\Mods\Workshop\2047461756.json`
   约第 229180 行，`Nickname = Pohjola Fimbul`。

## 已核对原文

卡面原文为：

```text
[Reveal Servant Name]

Freeze, Forces of Heaven - Action: Until the end of the next round players cannot draw cards, Alter: or gain mana.
```

TTS 对象 `Description` 与卡面原文一致，没有补充 `Alter` 后面的对象、数量或目标。

Wiki `Sitonai` 对象页进一步确认：

- Sitonai 是 `Alter Ego` class、在 `Rider` slot 召唤的 Servant。
- `Pohjola Fimbul` 被列为 `Combination Attack`，并关联 `Alter Ego Class`。
- 页面 ruling 明确：“cannot draw cards”只指 attack deck 和 discard；
  不包含 Leonardo Da Vinci 的 Item deck、Nrvnqsr Chaos 的 beast deck 等其它专用牌堆。

Wiki `Keywords` / `Alter Ego Class` 页面确认：

- `Alter` 是需要 Alter Ego 类能力启用的关键词，并不是自动生效的普通句子。
- Alter Ego Class 的规则是：打出卡牌前可以停用该 Class，以获得该卡的 Alter text；
  没有来源就不能据此补出目标、数量或玩家范围。

## 已锁定语义

- `[Reveal Servant Name]`：打出时需要公开该 Servant 真名。
- 行动效果：直到下回合结束，玩家不能从牌库或弃牌堆抽牌。
- 原文明确出现 `Alter` 和 `gain mana` 两个反转相关词。

## 未锁定语义

- `Alter` 的完整目标对象。
- 反转状态下获得魔力的玩家范围。
- 获得魔力的数量。
- 反转效果是否替换整段行动效果，还是只替换“不能抽牌”子句。
- `Alter` 段落的完整页面正文或卡面排版是否还有被裁切/折行遗漏的内容。

## 处置

- `sc_sitonai_2.desc` 暂保留原始不完整文本，不把 `2` 点魔力写入正式数据。
- 旧开发原型里曾出现“反转：获得2点魔力”的实现；该数字没有在当前 Wiki 卡面或 TTS `Description` 中得到来源支持，降级为历史猜测，不能作为正式规则。
- 在补到规则书页码、官方完整卡面或作者明确裁定前，该对象保持 `disputed`，不得进入“规则已锁定”或“效果已完成”口径。

## 下一步

- 已补抓 `Sitonai`、`Keywords`、`Alter Ego Class` 页面正文；继续抓取
  `Pohjola Fimbul` 页面正文、图片修订历史和其它 Alter Ego 卡牌作为对照。
- 若外部主源仍只有上述不完整句子，回到用户确认“反转对象/数量”后再升级为 `locked`。
