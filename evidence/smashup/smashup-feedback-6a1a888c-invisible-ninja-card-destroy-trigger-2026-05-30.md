# SmashUp 线上反馈收口（6a1a888c28a10815f5b10d65）

## 范围

- 反馈 ID：`6a1a888c28a10815f5b10d65`
- 游戏：`smashup`
- 反馈原文：`泰坦效果卡片是消灭任意一张卡就可以触发效果`
- 对象：隐形忍者（`ninjas_invisible_ninja`）

## 真相源

- 用户截图：`temp/feedback-closeout/feedback-6a1a888c28a10815f5b10d65.jpg`
- 本地正式英文图集裁图：`temp/feedback-closeout/invisible-ninja-pod-atlas-crop.webp`
- 图集来源：`public/assets/i18n/en/smashup/cards/compressed/tts_atlas_8789f47742.webp`

正式卡图规则明确包含三点：

1. `Once per turn`
2. `after you destroy another player's card`
3. `or return one of your minions to your hand, you may look at the top two cards of your deck, draw one, and shuffle the other into your deck`

结论：用户反馈成立，现网实现与正式卡图不一致。

## 旧问题定位

### 1. i18n 录入错误

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`

旧录入把 `another player's card` 错写成了“对手随从”，并且漏掉了：

- `Once per turn`
- `shuffle the other into your deck`

### 2. 运行时触发范围不完整

旧实现只覆盖：

- 自己消灭对手随从
- 将自己随从返回手牌

未覆盖：

- 自己消灭对手持续行动牌
- 自己消灭对手附着行动牌

## 本轮修复

### 触发上下文补全

- `src/games/smashup/domain/types.ts`
- `src/games/smashup/domain/affect.ts`
- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/reactionSession.ts`
- `src/games/smashup/domain/reactionResources.ts`

补充并透传以下字段：

- `triggerCardUid`
- `triggerCardDefId`
- `triggerCardOwnerId`
- `triggerCardKind`

### 销毁行动牌也进入泰坦触发链

- `src/games/smashup/domain/ongoingEffects.ts`

对“在场行动牌被消灭/离场”的 destroy affect 入队 `onCardDestroyed`。

### 隐形忍者触发器扩展

- `src/games/smashup/abilities/titans.ts`

隐形忍者现在同时支持：

- `onMinionDestroyed`：自己消灭对手随从
- `onCardDestroyed`：自己消灭对手持续行动牌或附着行动牌
- `onCardReturnedToHand`：将自己随从返回手牌

### 文案修正

- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`

将隐形忍者描述修正为与正式卡图一致，补回“每回合一次”和“将另一张洗回牌库”。

## 回归验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/invisible-ninja-ongoing-draw-trigger.test.ts --configLoader native --maxWorkers 1
```

- 结果：`4 passed`

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 --testNamePattern "活动泰坦静态契约与当前已接入范围保持一致|隐形忍者消灭对手随从后，抽牌反应归属于泰坦控制者并可正常抽牌"
```

- 结果：`2 passed`

```powershell
npm run i18n:check
```

- 结果：通过；仅存在仓库既有 3 条 warning，非本轮新增。

## 关联文件

- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/smashup/domain/affect.ts`
- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/domain/reactionSession.ts`
- `src/games/smashup/domain/reactionResources.ts`
- `src/games/smashup/abilities/titans.ts`
- `src/games/smashup/__tests__/invisible-ninja-ongoing-draw-trigger.test.ts`
- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`

## 收口结论

- `6a1a888c28a10815f5b10d65`：`resolved`
- 根因：正式卡图、i18n 录入与运行时触发范围三者不一致
- 现状：已按正式卡图修正文案与触发实现，并补定向回归测试
