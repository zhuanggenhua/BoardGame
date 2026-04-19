# Smash Up 武士反馈复核（2026-04-09）

## 覆盖反馈
- `69d3d7bfa81293593109072b`：武士酱在樱花公园送去弃牌时，排序后只抽 1 次
- `69d3d908a812935931090779`：基地计分后武士酱没有触发抽牌
- `69d3daf1a812935931090793`：浪人 POD 登场只放了一个 +1
- `69d3dc19a812935931090795`：5 力量武士计分送弃牌后没有 +1VP

## 结论

### 69d3d7bfa81293593109072b
- 当前分支已覆盖修复结果。
- 我补了精确回归：`base_sakura_garden_pod` 与 `samurai_samurai_chan_pod` 同时触发时，即使先结算基地，也仍会继续结算武士酱抓牌。
- 结论：**resolved**

### 69d3d908a812935931090779
- 我补了精确回归：`samurai_samurai_chan_pod` 在因基地结算进入弃牌堆时会正常抽牌。
- 该反馈与上一条同属“武士酱离场抓牌链路”复核范围，当前实现已满足规则。
- 结论：**resolved**

### 69d3daf1a812935931090793
- 我补了精确回归：`samurai_ronin_pod` 在 `base_shoguns_palace_pod` 登场且自己是该基地唯一己方随从时，完成其自身交互后会得到 **2 个** +1 指示物。
- 结论更像是当时对交互/展示的误读，而不是当前规则实现缺失。
- 结论：**closed（non-bug / 当前实现正确）**

### 69d3dc19a812935931090795
- 我补了精确回归：`samurai_bushi_pod` 以有效力量 5 因基地结算进入弃牌堆时，会给你 **1VP**；同时 `samurai_shogun_pod` 仍会得到 +1 指示物。
- 反馈包当前快照里也已经能看到 `samurai_shogun_pod` 的指示物从 1 到 2。
- 结论更像是结算观察误差，不是当前规则实现缺失。
- 结论：**closed（non-bug / 当前实现正确）**

## 本轮新增回归
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - `base_sakura_garden 与 samurai_samurai_chan_pod 同时触发时，先结算基地后仍会再结算武士酱抓牌`
- `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `samurai_samurai_chan_pod 在自己因基地结算进入弃牌堆后也会抽一张牌`
  - `samurai_ronin_pod 在天守阁登场且自己是该基地唯一己方随从时仍放置两个 +1 指示物`
  - `samurai_bushi_pod 在以 5 力量因基地结算进入弃牌堆时会给你 1VP，且 samurai_shogun_pod 仍会获得指示物`

## 验证
1. `npx eslint src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts --config temp/vitest-smashup-node.config.ts --configLoader native`

## 验证结果
- ESLint：0 errors（存在历史 warnings，无新增 errors）
- Vitest：`173 passed | 1 skipped`
