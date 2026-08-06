# 小黑屋房间板块规则定义字段重录门禁

日期：2026-07-29

## 结论

当前房间板块数据不能直接进入“探索抽牌实现重构”。原因不是单个字段名缺失，而是房间对象的规则定义字段没有完成 S0 录入合同。

必须先回到数据录入层，建立房间板块对象全集和字段合同，再改运行时探索抽牌逻辑。

## 规则真相源

- 第三版规则整理明确：探索并放置新房间板块后，先结算板块效果，再根据板块符号抽取并结算事件 / 物品 / 预兆卡。
  - `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:79`
- 房间板块正面可能带有事件、物品、预兆符号；放置带符号的新房间后抽对应卡牌。
  - `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:128`
  - `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:134`
  - `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:283`
- 旧版中文规则书对符号载体给出明确说明：漩涡是事件，公牛头是物品，乌鸦是预兆。
  - `src/games/betrayal/rule/legacy-zh/betrayal-2e-rulebook-zh-v1.1/betrayal-2e-rulebook-zh-v1.1.md:581`
  - `src/games/betrayal/rule/legacy-zh/betrayal-2e-rulebook-zh-v1.1/betrayal-2e-rulebook-zh-v1.1.md:584`
  - `src/games/betrayal/rule/legacy-zh/betrayal-2e-rulebook-zh-v1.1/betrayal-2e-rulebook-zh-v1.1.md:588`

## 当前实现差距

- 房间实例只有“发现结果”字段 `discoveryReward`，这不是房间板块印刷符号本身。
  - `src/games/betrayal/scenarioConfig.ts:115`
- 房间模板 `BetrayalRoomDiscoveryTemplate` 没有房间固有发现符号字段。
  - `src/games/betrayal/scenarioConfig.ts:121`
- 探索抽牌当前由运行时顺序决定：`resolveNextDeckKind(core)` 按 `drawOrder / exploreIndex` 选择事件 / 物品 / 预兆。
  - `src/games/betrayal/game.ts:13362`
- 探索放置房间时，把运行时选出的 `deckKind` 写入 `discoveryReward`。
  - `src/games/betrayal/game.ts:15791`

## S0 重录字段

房间板块对象全集至少需要逐房间记录：

| 字段 | 来源 / 说明 | 状态 |
| --- | --- | --- |
| 房间对象标识 | 房间名称、运行时 id / visual id / atlas frame | 待重录 |
| 楼层 / 背面区域 | 规则和房间背面区域：地下室 / 一楼 / 二楼 | 待重录 |
| 门位拓扑 | 房间板块门位和可连接边 | 待重录 |
| 印刷发现符号 | 规则定义字段：事件 / 物品 / 预兆 / 无 | 待重录 |
| 房间文字效果 | 房间正面文字、触发时机、检定 / 支付 / 分支 / 清理 | 待重录 |
| 图面 / atlas 定位 | 正式图、atlas frame、裁图或其它主真相源路径 | 待重录 |
| 对照源差异 | 规则书、旧版规则、当前实现和素材之间的差异 | 待重录 |
| 合同状态 | `locked / blocked / disputed / partial` | 待重录 |

## 禁止直接实施

- 不得用 `drawOrder`、`exploreIndex` 或当前运行时发现池顺序补房间符号。
- 不得因为教程写了“对应的发现牌”就认为房间符号合同已锁定。
- 不得只补教程文案后宣称基础探索规则完成。
- 不得在每张房间的规则定义字段未锁定前，把探索抽牌重构标为完成。

## 下一步

1. 建立房间板块对象全集。
2. 从规则和房间主真相源逐房间录入规则定义字段。
3. 将无法从现有来源确认的房间标为 `blocked / partial / disputed`，不得猜补。
4. 只有已锁定字段的房间进入实现：`roomTileCatalog.discoverySymbol` → 探索抽牌消费该字段 → 教程说明符号映射 → 回归测试和真实入口验证。
