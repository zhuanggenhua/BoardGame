# DiceThrone Ninja Dojo 真实手牌 E2E（2026-05-17）

> 2026-06-05 当前有效口径：本文只保留 `ninja-card-dojo / 道场！` 这张卡的对象级真实手牌 `L3` 证据，不代表 Ninja 其它行动卡、升级卡或技能本体的当前完成态。若要判断 Ninja 当前整英雄残余，应回到 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 与升级重审主文档。

## 范围

- 对象：`ninja-card-dojo / 道场！`
- 真相源：`src/games/dicethrone/rule/ninja卡牌录入核对.md` 与本地卡图；Wiki 只作对照。
- 验收点：真实手牌入口打出后投 1 骰；面具分支获得 `smoke_bomb=1` 与 `ninjutsu=2`；非面具分支抽 1；两条分支都正常收口。

## 运行命令

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者道场应通过真实手牌打出并按骰面分支结算"
```

结果：`1 passed`。

## 截图与肉眼结论

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\01-dojo-mask-before-drag.png`
   - 真实 Ninja 对局主阶段画面可见，手牌区存在 `道场！`。
   - 这是从真实手牌入口开始的链路，不是直接调用卡牌 effect 的单元场景。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\02-dojo-mask-bonus-die-overlay.png`
   - 画面中央出现奖励骰特写，骰面为 `6 / 面具`。
   - 文案显示“道场：面具，获得烟雾弹和 2 忍术”，左侧 token 区可见烟雾弹与忍术数量变化。
   - 该截图证明旧“直接给 token”已经被真实投骰分支替代。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\03-dojo-mask-after-closeout.png`
   - 奖励骰特写已关闭，流程回到主阶段棋盘。
   - 左侧 token 区保留烟雾弹与 `2/3` 忍术，手牌中的 Dojo 已被打出。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\04-dojo-other-before-drag.png`
   - 第二段场景重新进入 Ninja 主阶段手牌链路。
   - 该段用于非面具分支，测试随机队列固定为非面具骰面。

5. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\05-dojo-other-bonus-die-overlay.png`
   - 出牌后画面进入卡牌/奖励骰结算层；断言侧确认本次没有获得烟雾弹或忍术。
   - 该截图主要作为非面具结算过程证据，最终状态以第 6 张和状态断言为准。

6. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者道场应通过真实手牌打出并按骰面分支结算\06-dojo-other-after-closeout.png`
   - 流程回到主阶段，手牌区出现新抽到的卡牌，牌库数量减少 1。
   - 状态断言确认 `smoke_bomb=0`、`ninjutsu=0`、`handCount=1`、`deckDelta=1`，达到“否则抽 1”的验收标准。

## 结论

- `ninja-card-dojo` 已从 L2 提升到 L3：真实手牌打出、奖励骰特写、面具成功分支、非面具抽牌分支和收口状态均已覆盖。
- 这只提升 Dojo 单卡结论，不外推 Ninja 其它专属卡或升级卡全量收口。
