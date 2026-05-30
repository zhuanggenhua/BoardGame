> 2026-05-30 更正说明：
> 当时文档中把隐形忍者（`ninjas_invisible_ninja`）描述成“消灭对手随从后触发抽牌”，该结论现已被正式英文卡图推翻。正式卡图是“每回合一次，消灭另一名玩家的一张卡，或将自己一个随从返回手牌后触发”；详见 `evidence/smashup/smashup-feedback-6a1a888c-invisible-ninja-card-destroy-trigger-2026-05-30.md`。本文档其余两条（Toll Bay / Shipwreck Cove）结论仍有效。

# SmashUp 线上反馈收口（69eb8173 / 69eb8447 / 69eb84a9）

## 范围
- 反馈 `69eb817353c8e640a4476025`：隐形忍者（泰坦）消灭对手随从后未触发抽牌。
- 反馈 `69eb844753c8e640a44760e3`：截图对应 `Shipwreck Cove`，用户反馈“这张牌好像没有任何效果”。
- 反馈 `69eb84a953c8e640a44760e5`：截图对应 `Toll Bay`，用户反馈“没让我选基地，也没有抽牌”。

## 代码修复
### 69eb84a9（Toll Bay）
- `src/games/smashup/data/factions/mermaids.ts`：`mermaids_toll_bay` 增加 `playNeedsBase: true`，出牌时必须选基地。
- `src/games/smashup/abilities/mermaids.ts`：`mermaidsTollBayOnPlay` 改为按“目标基地上的对手随从数量”即时抽牌。
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`：补/改两条回归：
  - 打出后按目标基地对手随从数抽牌。
  - 目标基地无对手随从时不抽牌。

### 69eb8173（Invisible Ninja）
- `src/games/smashup/abilities/titans.ts`：`invisibleNinjaTriggered` 改为基于 `sourceControllerId` 判定控制者，避免触发归属错到当前触发玩家。
- `src/games/smashup/abilities/titans.ts`：`onMinionDestroyed` / `onCardReturnedToHand` 注册为 `playerContext: 'sourceController'`。
- `src/games/smashup/domain/reducer.ts`：`processReturnToHandTriggers` 传入 `triggerMinionUid/triggerMinionDefId`，保证返回手牌链路也能命中泰坦触发。
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`：新增回归用例验证“自己消灭对手随从 -> 为泰坦控制者创建抽牌交互”。

### 69eb8447（Shipwreck Cove）
- `src/games/smashup/abilities/mermaids.ts`：`mermaidsShipwreckCoveAfterScoring` 额外随从额度改为绑定 `sourceBaseIndex/baseIndex`，确保额外随从只能落在“替换基地槽位”。
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`：补断言 `restrictToBase === 0`，防止回归到“可打任意基地”。

## 验证记录
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
  - 结果：`171 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism -t "mermaids_toll_bay|mermaids_shipwreck_cove|ninjas_invisible_ninja"`
  - 结果：`4 passed`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism -t "隐形忍者消灭对手随从后，抽牌反应归属于泰坦控制者并可正常抽牌"`
  - 结果：`1 passed`。
- `npm run i18n:check`
  - 结果：`no missing keys detected`。

## 证据路径
- 反馈原始包：`temp/feedback-closeout/query-feedback-target3-20260425-raw.json`
- 牌面截图：
  - `temp/feedback-closeout/69eb84a953c8e640a44760e5-card-crop-x4.jpg`（Toll Bay）
  - `temp/feedback-closeout/69eb844753c8e640a44760e3-card-crop-x6.jpg`（Shipwreck Cove）

## 收口结论
- `69eb817353c8e640a4476025`：`resolved`
- `69eb84a953c8e640a44760e5`：`resolved`
- `69eb844753c8e640a44760e3`：`resolved`（修复为仅可在替换基地触发额外随从额度）
