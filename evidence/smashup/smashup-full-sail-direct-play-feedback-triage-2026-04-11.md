# SmashUp 反馈 69d8587f40fc4706b5b878c8 排查记录（2026-04-11）

## 反馈

> 这牌不是也可以直接打才对吗

诊断包：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8587f40fc4706b5b878c8.md`
原始快照：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8587f40fc4706b5b878c8.raw.json`
截图提取：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8587f40fc4706b5b878c8.jpg`

## 诊断事实

- 截图中底部手牌可见 `全速航行（pirate_full_sail_pod）`。
- toast 文案为：`该特殊行动卡只能在基地计分前的响应窗口中打出`。
- 但当前卡牌定义里：
  - `pirate_full_sail_pod.subtype === 'standard'`
  - 同时存在 `responseWindowTiming: 'beforeScoring'`
- 这表示它是**标准行动卡 + 额外支持 beforeScoring 响应窗口打出**，而不是“只能在响应窗口里打出的 special action”。

## 当前代码结论

我直接用诊断包里的 `stateSnapshot` 在当前代码上重放校验：

- 从快照中取到玩家 0 手牌里的 `pirate_full_sail_pod`（`cardUid = c36`）
- 调用：`validate(state, { type: 'su:play_action', playerId: '0', payload: { cardUid: 'c36' } })`
- 结果：`{ valid: true }`

这说明：

- **当前代码已经允许这张卡在普通出牌阶段直接打出**；
- 反馈截图中的拦截提示，要么来自旧版本，要么来自当时已被修复的瞬时状态/旧 bundle，而不是当前主干仍存在的规则错误。

## 新增回归保护

为了避免以后再把“标准行动卡 + responseWindowTiming”误判成“special-only 卡”，本轮补了一条最小回归：

- 文件：`src/games/smashup/__tests__/smashup.smoke.test.ts`
- 用例：`全速航行POD 作为标准行动卡，在普通出牌阶段也应允许直接打出`

断言：

- `SmashUpDomain.validate(...)` 对 `pirate_full_sail_pod` 的普通 `PLAY_ACTION` 校验返回 `valid: true`

## 本轮验证

1. `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "全速航行POD 作为标准行动卡，在普通出牌阶段也应允许直接打出"`
   - 结果：通过
3. `npx tsx -` 读取诊断包 `stateSnapshot` 并直接调用 `validate(...)`
   - 结果：`pirate_full_sail_pod` 在该快照下返回 `valid: true`

## 结论

- 这条反馈在当前代码上**未复现**，且用用户诊断包快照回放后也验证为可直接打出。
- 当前更合理的状态是：**已修复 / resolved**，而不是继续保留 open。
- 我已补最小回归测试，避免未来再次把 `responseWindowTiming` 标记误当成 `special-only` 限制。
