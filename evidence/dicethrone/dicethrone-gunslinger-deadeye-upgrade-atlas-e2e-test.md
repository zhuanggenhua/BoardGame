# DiceThrone 枪手死亡之眼 II Atlas / 正常出牌 E2E 证据

## 范围

- 用例：`e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts`
- 场景：枪手在正常 `main1` 主阶段，手牌只有 `upgrade-deadeye-2`
- 验收目标：
  - 手牌里的 `死亡之眼 II` 仍使用 `ability-cards.webp` 图集渲染，不是空白卡或 shimmer 占位
  - 真实点击手牌后，升级正常生效，不再出现“没进状态 / 没扣 CP / 还留在手牌里 / 被错误丢进弃牌堆”的异常
  - 自视角不应额外弹出卡牌特写；这不是缺陷，而是当前 UI 契约

## 运行命令

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "gunslinger deadeye upgrade should resolve without wrong spotlight in normal play"
```

## 截图证据

### 1. 出牌前手牌图

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-deadeye-upgrade-should-resolve-without-wrong-spotlight-in-normal-play\gunslinger-deadeye-upgrade-hand-before-play.png`

我实际看到：

- 右下手牌区只有一张 `死亡之眼 II`，卡面已经正常显示，不是空白框，也没有 shimmer 占位层。
- 左下资源条显示 `CP 10 / 生命 50`，说明这是可真实出牌的主阶段场景，不是伪造的无资源死状态。
- 验收结论：达到“卡图仍正常渲染”的验收标准。

### 2. 点击后的正常升级状态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-deadeye-upgrade-should-resolve-without-wrong-spotlight-in-normal-play\gunslinger-deadeye-upgrade-after-play.png`

我实际看到：

- 左下资源条变为 `CP 8`，与升级牌花费 2 CP 一致。
- 右下原手牌位置已经空出，说明 `upgrade-deadeye-2` 已从手牌移除。
- 中央出现升级飞向技能区的动画残影，没有出现“卡还留在手里却又触发别的效果”的画面。
- 右侧弃牌堆仍为空白占位，没有出现 `死亡之眼 II` 被塞进弃牌堆的现象。
- 验收结论：达到“正常点击后升级生效、资源扣减正确、手牌成功移除、且升级卡不进入弃牌堆”的验收标准。

## 状态断言证据

E2E 同时断言了以下运行时结果：

- `__BG_LAST_COMMAND_REJECTED__ === null`
- `deadeyeLevel === 2`
- `player0.resources.cp === 8`
- `handIds === []`
- `discardIds === []`
- `upgradeCardByAbilityId.deadeye === { cardId: 'upgrade-deadeye-2', cpCost: 2 }`
- 最近事件流为 `CP_CHANGED -> CARD_PLAYED -> ABILITY_REPLACED`
- `[data-testid="card-spotlight-overlay"]` 在自视角保持隐藏

## 结论

- 本轮没有改任何 DiceThrone 卡图资源文件。
- `死亡之眼 II` 的卡图仍来自 `ability-cards.webp`，正常渲染。
- 正常对局点击这张升级牌后，领域状态与 UI 出牌结果一致。
- 升级卡现在不会再被错误写进弃牌堆，而是只通过 `upgradeCardByAbilityId` 挂到技能上。
- “自视角没有卡牌特写”在当前实现里是既有契约，不应再被误判成“卡图不渲染”。
