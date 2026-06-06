# FantasyRealms Mahjong-Table Layout Reference Study

日期：2026-06-06

## 目标

把 `fantasyrealms` 从当前的网页三栏布局，重构成更接近成熟麻将产品的信息层级。这里借用的是麻将桌的空间组织，不是麻将题材元素。

## 当前页面问题

基于当前真实桌面截图 `[fantasyrealms-atlas-desktop-2026-06-06.png](./fantasyrealms-atlas-desktop-2026-06-06.png)`：

- 左、中、右三栏都在抢主位，玩家的视线需要在状态盒子之间跳转。
- 中央公开区在空态时变成最大空盒，反而压过真正可操作的手牌。
- 焦点区像独立内容栏，不像桌边辅助物件。
- 桌面看起来像“牌桌内容后台”，不是“正在进行的牌局”。

## 参考来源

- Mahjong Soul 官方新手指南  
  <https://mahjongsoul.com/startguide/assets/jantama_startguide.pdf>
- Mahjong Soul Google Play  
  <https://play.google.com/store/apps/details?id=com.YoStarEN.MahjongSoul>
- Riichi City Google Play  
  <https://play.google.com/store/apps/details?id=com.riichicity.happywoods>

## 迁移结论

从成熟麻将产品可迁移到 `fantasyrealms` 的不是具体皮肤，而是以下稳定规律：

1. 自手牌必须贴近玩家
   `fantasyrealms` 的 7 张手牌应该成为底部最长、最连续的操作带。

2. 公共信息必须回桌面中心
   `fantasyrealms` 的公开弃牌堆应改造成中央“公开河”，而不是右栏说明的附属物。

3. 状态信息必须退到边缘
   牌库、回合、当前总分、终局阈值应收成角标或窄带，不再切出等权侧栏。

4. 策略提示只能贴边
   焦点卡与推演有价值，但它们应该像桌边便签，不该继续占用整列主区域。

## 设计决策

- 桌面端先改为麻将桌式布局：
  - 左上：牌库 + 回合
  - 右上：紧凑分数带
  - 中央：公开弃牌河
  - 底部：7 张手牌操作带
  - 右下：焦点牌 + 推演便签
- 终局态优先考虑浮层化复盘，而不是继续把进行中侧栏加长。
- 实施顺序固定为 `PC 先过真实页，再做移动端`，除非用户明确要求例外。

## 草图

- 低保真 SVG：`[fantasyrealms-mahjong-table-layout.svg](../../design-system/games/fantasyrealms-mahjong-table-layout.svg)`

## 结论

下一步不应继续微调当前三栏布局，而应直接按麻将桌式构图重做桌面端主页面。移动端适配必须等桌面端真实页通过后再进入。
