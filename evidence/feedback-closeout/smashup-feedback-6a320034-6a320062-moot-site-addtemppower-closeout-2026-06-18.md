# SmashUp 线上反馈待回写（6a320034e7db65695ded8e08 / 6a320062e7db65695ded8e10）

## 范围

- 反馈 ID：
  - `6a320034e7db65695ded8e08`
  - `6a320062e7db65695ded8e10`
- 游戏：`smashup`
- 反馈来源：`player-command-failure`
- 生产错误正文：`pipeline_error: addTempPower is not defined`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 命中的真实现场含义：
  - 发生在 `playCards` 阶段，AI 尝试执行 `su:play_minion`
  - 现场 `stateSnapshot` 同时包含 `base_moot_site（集会场）`
  - 其中一条样本明确报：
    - `commandType: "su:play_minion"`
    - `reason: "pipeline_error: addTempPower is not defined"`

## 根因

- 真正出错位置在 `src/games/smashup/domain/baseAbilities.ts`
- `base_moot_site（集会场）` 的能力会在“本回合第一个打到这里的随从”时调用 `addTempPower(...)`
- 但该文件顶部没有把 `addTempPower` 从 `abilityHelpers` 导入
- 结果是：
  - 一旦真实对局首次打出随从到《集会场》
  - 运行时直接抛 `ReferenceError: addTempPower is not defined`
  - 反馈就落成 `player-command-failure`

## 本轮修复

- 文件：
  - `src/games/smashup/domain/baseAbilities.ts`
- 改动：
  - 在 `abilityHelpers` 导入列表里补回 `addTempPower`

## 验证

### 原始失败位点复现

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/bases/moot-site-base.test.ts --configLoader native`
- 修复前结果：
  - `ReferenceError: addTempPower is not defined`
  - 报错位置：
    - `src/games/smashup/domain/baseAbilities.ts:1098`

### 修复后回归

- 同一验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/bases/moot-site-base.test.ts --configLoader native`
- 修复后结果：
  - `4 passed`

## 当前状态

- 反馈本体结论：`resolved（待正式回写）`
- 结论口径：
  - 这是**真实现存 bug**
  - 当前树已修复，并且已经回到原始失败位点完成定向回归
- 当前边界：
  - 还没有正式回写到生产真源，因为：
    - HTTP 开放回写接口当前为 `404`
    - 本轮没有拿到“可改生产 Mongo”的明确授权

## 收口结论

- 这两条 `player-command-failure` 是同根因重复项
- 当前代码已经覆盖根因，下一步只剩：
  - 提交 / push 本轮修复
  - 在用户明确授权后，把生产反馈状态正式回写为 `resolved`
