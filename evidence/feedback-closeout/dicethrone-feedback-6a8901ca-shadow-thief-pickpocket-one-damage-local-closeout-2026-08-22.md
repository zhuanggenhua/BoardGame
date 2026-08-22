# DiceThrone 本地反馈 6a8901ca：5CP 小顺子只打 1 点血（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 反馈 ID：`6a8901ca3da9bb2687de01d7`
- 原始症状保真版：玩家反馈“5cp为什么小顺子只打一点血”。

## 原始反馈命中的症状

反馈快照显示：

- 攻击方是暗影盗贼，发动的小顺子技能是“迅捷突袭”。
- 行动记录显示“迅捷突袭”先让攻击方获得 3 CP。
- 攻击方当时总 CP 是 5，因此“迅捷突袭”的基础攻击伤害是当前 CP 的一半，向上取整为 3 点。
- 防御方是普通面诅咒海盗，发动防御技能“你还嫩了点”。
- 防御骰最终包含 1 个骷髅、2 个战利品、1 个弯刀：
  - 1 个骷髅防止 2 点攻击伤害；
  - 2 个战利品让防御方获得 2 CP；
  - 1 个弯刀对攻击方造成 1 点直接伤害。
- 所以最终链路是：暗影盗贼 3 点攻击伤害 - 诅咒海盗防止 2 点 = 对防御方实际造成 1 点伤害。

这与玩家看到的“5 CP、小顺子只打 1 点血”一致，但不是“5 CP 应该直接打 5 点”的规则 bug。

## 当前规则合同

- `src/games/dicethrone/heroes/shadow_thief/abilities.ts`：
  - 暗影盗贼“迅捷突袭”基础版是小顺子触发；
  - 效果是获得 3 CP，然后造成等同于当前 CP 一半、向上取整的攻击伤害。
- `src/games/dicethrone/domain/customActions/shadow_thief.ts`：
  - `shadow_thief-damage-half-cp` 读取获得 CP 后的当前 CP，并用 `Math.ceil(currentCp / 2)` 计算基础攻击伤害。
- `src/games/dicethrone/heroes/cursed_pirate/abilities.ts` 和 `src/games/dicethrone/domain/customActions/cursed_pirate.ts`：
  - 普通面诅咒海盗“你还嫩了点”投 4 颗防御骰；
  - 骷髅每个防止 2 点伤害，战利品每个获得 1 CP，弯刀每个对攻击者造成 1 点直接伤害。

## 本轮处理

- 本轮未修改规则实现。
- 本轮补了反馈诊断采集：DiceThrone 的玩家 / 对手 HP、CP 显示节点现在会随手工反馈写入“页面可见资源快照”，用于对照正式状态和玩家当时看到的 UI 数字是否一致。
- 本轮按反馈自带快照还原数字链，判断为规则解释 / 已按当前合同正确结算。
- 反馈中的“5 CP”不是最终攻击伤害；它是“迅捷突袭”计算前的当前 CP 总数，技能文本要求取一半，之后还要进入防御结算。

## 验证

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native -t "damage-half-cp|human 面嘿，老兄会结算反击|human 面防御技能获得诅咒金币"
```

结果：

- `2 files passed`
- `6 tests passed / 154 skipped`

补充诊断采集验证：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/components/__tests__/GameHUDChatPreview.test.ts --configLoader native
npm run typecheck
node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts src/components/system/__tests__/FeedbackModal.test.tsx --configLoader native
```

结果：

- `GameHUDChatPreview.test.ts`：`23 passed`
- `typecheck`：通过
- `clientAutoReport.test.ts` + `FeedbackModal.test.tsx`：`51 passed`

覆盖项：

- 暗影盗贼“迅捷突袭”按当前 CP 的一半计算攻击伤害。
- 普通面诅咒海盗“你还嫩了点”正确结算反击伤害、获得 CP、防止伤害和诅咒金币选择。
- 手工反馈操作日志会附带页面上实际显示的资源读数；该读数只作诊断证据，不进入正式结算状态。

## 收口结论

这条反馈不是当前实现 bug。该局 1 点伤害来自规则正常叠加：暗影盗贼 5 CP 的“迅捷突袭”先形成 3 点攻击伤害，对手诅咒海盗防御骰又防止 2 点，因此最后只扣 1 点血。

本地反馈按“规则解释，当前实现与反馈快照一致”关闭；另外已补后续反馈诊断能力，之后同类反馈可以直接对照正式血量和页面显示血量。
