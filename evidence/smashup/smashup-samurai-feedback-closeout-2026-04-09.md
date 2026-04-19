# Smash Up Samurai 反馈收口（2026-04-09）

## 覆盖反馈
- `69d3d7bfa81293593109072b`：武士酱在樱花公园送去弃牌时只抽了 1 次牌
- `69d3d908a812935931090779`：基地计分后武士酱没有触发抽牌
- `69d3daf1a812935931090793`：浪人 POD 登场只放了 1 个 +1
- `69d3dc19a812935931090795`：战斗力 5 的将军在计分送去弃牌堆后没有 +1

## 结论

### 1) `69d3d7bfa81293593109072b` → `resolved`
- 当前代码下，`base_sakura_garden_pod` + `samurai_samurai_chan_pod` 会同时入队两个触发：
  - `samurai_samurai_chan_pod`
  - `base_sakura_garden_pod`
- 两个触发都会各自结算 `draw 1`，合计 2 次抽牌。
- 说明这条反馈对应的问题在当前工作区已被修复，不再复现。

### 2) `69d3d908a812935931090779` → `resolved`
- 当前代码下，`samurai_samurai_chan_pod` 在基地计分弃置时会单独入队并自动结算 `draw 1`。
- 在非樱花公园基地（如大图书馆）不会多出额外来源，但武士酱自己的抽牌会正常触发。
- 说明这条反馈对应的问题在当前工作区已被修复，不再复现。

### 3) `69d3daf1a812935931090793` → `resolved`
- 当前代码下，`samurai_ronin_pod` 在“它是你在该基地唯一随从”时，确认发动后得到 `2` 个 `+1` 指示物。
- 仓库已有精确回归测试覆盖该行为，且我又用最小脚本复核，结果为 `powerCounters = 2`。
- 说明这条反馈对应的问题在当前工作区已被修复，不再复现。

### 4) `69d3dc19a812935931090795` → `closed`
- 这条从反馈包自身就能证明不是 bug：
  - 操作日志已出现 `战力+1： 将军 → 大图书馆`
  - 最终快照里 `samurai_shogun_pod.powerCounters = 2`
- 所以“没有 +1”与实际状态不符，应按误读/误报关闭。

## 验证
1. `npx eslint src/games/smashup/abilities/samurai.ts src/games/smashup/domain/ongoingEffects.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --config temp/smashup/vitest-smashup-node.config.ts --configLoader native`
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts -t "base_sakura_garden_pod reuses the first discard draw trigger" --config temp/smashup/vitest-smashup-node.config.ts --configLoader native`
4. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newOngoingAbilities.test.ts --configLoader native`
5. `node --import tsx -`（内联脚本，复核：
   - `samurai_ronin_pod` 最终 `powerCounters = 2`
   - `samurai_samurai_chan_pod + base_sakura_garden_pod` 合计触发 2 次抽牌
   - `samurai_samurai_chan_pod + base_great_library` 触发 1 次抽牌）

## 关键观察
- `newFactionAbilities.test.ts` 全文件通过，包含 Samurai 相关回归。
- `newBaseAbilities.test.ts` 中 `base_sakura_garden_pod reuses the first discard draw trigger` 通过。
- `newOngoingAbilities.test.ts` 全文件通过，其中包含 `samurai_samurai_chan_pod` 的弃置抽牌回归。
- 内联脚本结果：
  - 樱花公园场景队列：`['samurai_samurai_chan_pod', 'base_sakura_garden_pod']`
  - 樱花公园场景抽牌：两次 `count = 1`
  - 大图书馆场景队列：`['samurai_samurai_chan_pod']`
  - 大图书馆场景抽牌：一次 `count = 1`
  - 浪人 POD 场景：`powerCounters = 2`
