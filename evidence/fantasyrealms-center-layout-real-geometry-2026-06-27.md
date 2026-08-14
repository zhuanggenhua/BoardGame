# Fantasy Realms 中央公开牌固定槽位几何复核 2026-06-27

## 本轮结论

- 本轮只收 `Fantasy Realms` 牌桌中央公开牌布局，不动手牌逻辑。
- 当前正式实现已经统一为固定 `10` 槽：
  - `1 张` 仍落在满铺时的第一个槽位。
  - `2 张` 仍落在前两个前缀槽位。
  - 同排中心距为 `2 张卡宽`，也就是卡与卡之间空 `1 张卡宽`。
  - 第二排相对第一排改为**右偏一张卡宽**，落在第一排两张牌之间的奇数槽位。
- 这轮没有拿“少牌单独回中”或“某个视口单独特判”过图；改的是同一套固定槽位几何公式。

## 代码落点

- 中央牌区几何常量与尺寸公式：
  - [src/games/fantasyrealms/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/Board.tsx:268)
  - [src/games/fantasyrealms/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/Board.tsx:1376)
  - [src/games/fantasyrealms/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/Board.tsx:1430)
- 基础回归断言：
  - [src/games/fantasyrealms/__tests__/Board.foundation.test.tsx](/D:/gongzuo/webgame/BoardGame/src/games/fantasyrealms/__tests__/Board.foundation.test.tsx:1021)
- 真实在线房几何断言：
  - [e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts:226)
- 规范补强：
  - [.spec/knowledge/standards/e2e-verification.md](/D:/gongzuo/webgame/BoardGame/.spec/knowledge/standards/e2e-verification.md:82)
  - [.spec/knowledge/standards/e2e-verification.md](/D:/gongzuo/webgame/BoardGame/.spec/knowledge/standards/e2e-verification.md:83)

## 实际看图结论

### 1 张公开牌

- 图：
  - [real-online-prefix-one-card.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中/real-online-prefix-one-card.png)
- 看到的现象：
  - 单张牌仍落在最左前缀槽位，不是整体回中。
  - 牌宽和宽桌面代表态一致，没有因为“只剩 1 张”被单独放大。
- 验收判断：
  - 达到本轮“第一张必须还是满铺第一槽”的要求。

### 2 张公开牌

- 图：
  - [real-online-prefix-two-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中/real-online-prefix-two-cards.png)
- 看到的现象：
  - 两张牌落在前两个前缀槽位。
  - 两张之间空隙明显大于之前那版“挤在一起”的状态，已经是整张卡宽级别的间距。
- 验收判断：
  - 达到本轮“前缀落位 + 不再半宽挤压”的要求。

### 9 张公开牌

- 图：
  - [real-online-prefix-nine-cards.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中/real-online-prefix-nine-cards.png)
- 看到的现象：
  - 第一排保持前缀槽位不动。
  - 第二排现在整体右错一张卡宽，直接占第一排两张牌之间的奇数槽位。
  - 两排之间仍然是交错牌河，但横向间距已经回到整卡宽级别，不再是之前那种靠叠盖制造的半宽挤压感。
- 验收判断：
  - 达到本轮“第二排不要遮到左边界外，同时仍保持整齐交错”的要求。

### 1281 宽真实桌面

- 图：
  - [real-online-prefix-two-cards-1281w.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中/real-online-prefix-two-cards-1281w.png)
- 看到的现象：
  - 较窄桌面下第一张牌仍在可视区内，不再出现“第一张被挤出左边界”的问题。
  - 牌宽变小，但仍和当前公式一致，不是旧那种被最小宽度硬撑出来的假大牌。
- 验收判断：
  - 达到本轮“改宽度后仍不漂”的要求。

## 运行时几何 JSON

- 文件：
  - [real-online-prefix-two-card-widths.json](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中/real-online-prefix-two-card-widths.json)
- 关键值：
  - 宽桌面 `wide.centerLayout.cards[0].x = 16`
  - 宽桌面 `wide.oneCardLayout.cards[0].x = 16`
  - 宽桌面 `wide.nineCardLayout.cards[0].x = 16`
  - 宽桌面 `wide.centerLayout.cards[0].width = 189`
  - 宽桌面同排步长：`394 - 16 = 378 = 2 * 189`
  - 宽桌面第二排第一张：`205 - 16 = 189 = 1 * 189`
  - 窄桌面 `narrow.centerLayout.cards[0].x = 16`
  - 窄桌面 `narrow.centerLayout.cards[0].width = 125`，与 `expectedCardWidth = 124.9` 一致
  - 紧桌面 `tight.centerLayout.cards[0].x = 16`
  - 紧桌面 `tight.centerLayout.cards[0].width = 101`
- 结论：
  - `1/2/9 张` 的首张槽位对齐关系成立。
  - 宽度变化现在来自统一公式 `内容宽度 / 10`，不是低张数特判。

## 验证命令

- `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - `53 passed`
- `node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts --grep "低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中"`
  - `passed`
- `node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts --grep "真实在线房间低张数公开弃牌保持满铺起始槽位，不再按牌组整体回中"`
  - `passed`

## 仍需明确的边界

- 这份证据证明的是：当前代码在真实在线房 E2E 和几何 JSON 下，中央公开牌固定槽位几何已经一致。
- 这不等于“已经直接读到了用户当时那个旧 Chrome 标签页的 DOM”；那条浏览器桥页面工具链之前已确认整体超时，本轮没有把这件事偷换成“已读真实旧 tab”。
