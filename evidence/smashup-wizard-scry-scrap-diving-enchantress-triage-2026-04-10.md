# SmashUp 反馈 69d66115119046d0b061f5f7 排查记录（2026-04-10）

## 反馈

> 最后几步，大法师跳出，多一战术，用占卜搜索废物利用，然后上女巫的瞬间，废物利用消失，重新变成了占卜

诊断包：`temp/feedback-closeout/2026-04-09T16-03-47-321Z/69d66115119046d0b061f5f7.md`

## 诊断包事实

- 当前权威快照里，玩家 0 手牌仍是 `c39 wizard_scry`，没有 `steampunk_scrap_diving`
- 牌库里仍保留 `c14/c13 steampunk_scrap_diving`
- 动作日志里有：
  - `22:05:57` 召唤
  - `22:06:01` 时间法师登场
  - `22:06:13` 女巫登场
- 但没有对应的：
  - 占卜施放日志
  - 时间法师额外行动日志
  - 女巫抽牌日志

这说明线上异常是真实存在的，但诊断包更像是**联机链路里某一步没有被服务端最终确认**，而不是卡牌规则本身稳定复现错误。

## 本地最小复现结论

我在能力/领域层补了回归测试：

- 文件：`src/games/smashup/__tests__/query6Abilities.test.ts`
- 用例：`wizard_scry: 召唤→时间法师→占卜→女巫链中，废物利用不应回退成占卜`

测试链路：

1. 打出 `wizard_summon`
2. 打出 `wizard_chronomage`
3. 打出 `wizard_scry`
4. 选择牌库中的 `steampunk_scrap_diving`
5. 再打出 `wizard_enchantress`

预期与实际一致：

- 时间法师正常提供额外行动
- 占卜选中的 `steampunk_scrap_diving` 正常进入手牌
- `wizard_scry` 自己不会回到手牌
- 女巫正常抽 1 张牌
- 最终手牌保留 `steampunk_scrap_diving`

## 结论

- **这是个真 bug**，但当前允许写入边界（`abilities/**`、`__tests__/**`、`evidence/**`）内没有复现出规则层错误。
- 本地最小复现表明：
  - `src/games/smashup/abilities/wizards.ts` 中
    - `wizardChronomage`
    - `wizardScry`
    - `wizardEnchantress`
  - 以及 `wizard_scry` 交互 handler
  在服务端/领域测试链路里表现正常。
- 因此当前更可疑的真实根因是：**联机 transport / optimistic reconcile / 命令确认链路**，而不是这些巫师/蒸汽朋克能力实现本身。

## 新增收敛：联机乐观调和脚本实锤

我又用 `npx tsx -` 跑了一个**更接近线上时序**的最小脚本，直接模拟：

1. 客户端先 burst 发出  
   - `PLAY_ACTION wizard_summon`
   - `PLAY_MINION wizard_chronomage`
   - `PLAY_ACTION wizard_scry`
   - `SYS_INTERACTION_RESPOND(card-0)`
   - `PLAY_MINION wizard_enchantress`
2. 服务端再按顺序逐拍回传确认状态

结果：

- **领域/服务端顺序执行完全正常**
  - `play scry` 后：手牌只剩 `wizard_enchantress`，当前交互是 `wizard_scry`
  - `respond card-0` 后：手牌变成 `wizard_enchantress + steampunk_scrap_diving`
  - `play enchantress` 后：手牌保留 `steampunk_scrap_diving`
- **但乐观引擎在第 3 拍 reconcile（服务端确认 play_scry）时发生回滚**
  - `stateToRender` 被拉回到：手牌只剩 `wizard_enchantress`
  - `sys.interaction.current` 又重新变回 `wizard_scry`
  - 控制台同时出现：
    - `命令验证失败 ... su:play_action ... wizard_scry ... 本回合行动额度已用完`

这和用户描述的“**看到废物利用进手，随后一瞬间又变回占卜**”高度一致。

### 当前最可疑文件

- `src/engine/transport/latency/optimisticEngine.ts`
  - `reconcile()`：`622-733`
  - `replayPending()`：`413-471`
- `src/games/smashup/latencyConfig.ts`
  - `PLAY_ACTION / PLAY_MINION` 被声明为 `optimistic`
  - `SYS_INTERACTION_RESPOND` 虽然即时发送，但当前没有游戏层专门的 animationMode/确认策略

### 当前判断

- 这条反馈的**主根因已从“能力层可疑”收敛到“联机乐观调和链路可疑”**。
- 更具体地说，是：
  - `wizard_scry` 已被服务端确认后，
  - 后续 pending 的 `RESPOND + enchantress` 在客户端 `reconcile/replayPending` 过程中被错误回滚/重放失败，
  - 导致 UI 短暂甚至持续回到“占卜还没选”的状态。
- 这已经超出当前允许写入边界，**不能继续在 `abilities/**` 里硬修**，否则只是掩盖症状。

## 本轮验证

1. `npx eslint src/games/smashup/__tests__/query6Abilities.test.ts --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/query6Abilities.test.ts --configLoader native -t "wizard_scry: 召唤→时间法师→占卜→女巫链中，废物利用不应回退成占卜"`
   - 结果：通过

## 状态建议

- **当前不足以把状态板改成 `resolved`**
- 更准确状态应为：
  - `in_progress`：已确认真 bug，但根因不在当前允许修改的能力层
  - 若允许继续改 `src/engine/transport/**` / `src/games/smashup/latencyConfig.ts`，下一轮应直接围绕 `optimisticEngine.reconcile/replayPending` 做修复与回归

---

## transport 收口（2026-04-10，本轮）

本轮已在允许范围内直接修 transport：

- `src/engine/transport/latency/optimisticEngine.ts`
- `src/engine/transport/latency/types.ts`
- `src/engine/transport/latency/__tests__/optimisticEngine.test.ts`

### 修复点

1. `processCommand()` 本地乐观执行时，不再让命令缺失时间戳；改为基于当前状态生成单调递增的本地 `timestamp`。
2. `PendingCommand` 现在会保存这次乐观执行实际使用的 `timestamp`。
3. `replayPending()` 重放未确认命令时，会把原始 `timestamp` 带回去，而不是重建成“无 timestamp 命令”。

### 为什么这能对上该反馈

- 之前 `replayPending()` 把 `PLAY_MINION wizard_chronomage` 重放成“无时间戳命令”，会让依赖命令时间戳的额外行动链丢失。
- 一旦时间法师额外行动在 replay 中丢失，后续 `wizard_scry` 会因为“行动额度已用完”被丢弃，客户端就会回到“占卜还没完成”的旧画面。
- 这正对应反馈里的表现：**废物利用一瞬间进手，随后又被还原回占卜。**

### 本轮新增验证

1. `npx eslint src/engine/transport/latency/optimisticEngine.ts src/engine/transport/latency/types.ts src/engine/transport/latency/__tests__/optimisticEngine.test.ts --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/latency/__tests__/optimisticEngine.test.ts --configLoader native -t "replayPending 重放 pending 命令时必须保留原始 timestamp，避免依赖时间戳的后续命令失效"`
   - 结果：通过
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/query6Abilities.test.ts --configLoader native -t "wizard_scry: 召唤→时间法师→占卜→女巫链中，废物利用不应回退成占卜"`
   - 结果：通过

### 当前判断

- 结合领域回归 + transport 回归，这条反馈已从“仅定位”推进到“已有低风险修复”。
- 若后续没有发现同类交互链的新反例，这条反馈**已具备改为 resolved 的技术基础**。
