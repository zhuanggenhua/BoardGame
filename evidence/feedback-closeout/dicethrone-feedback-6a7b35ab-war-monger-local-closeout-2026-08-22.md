# DiceThrone 本地反馈 6a7b35ab：战争贩子没效果（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 反馈 ID：`6a7b35aba49fa4df314e7731`
- 原始症状保真版：玩家反馈“战争贩子没效果”。

## 原始反馈命中的症状

反馈快照能命中一个旧的真实问题形状：

- 事件流里已经出现 `BONUS_DIE_ROLLED`，来源能力是 `war-monger`，骰面是军刀。
- 随后 `PENDING_ATTACK_UPDATED` 曾写入 `damage: 5`。
- 但后面又出现 `ATTACK_RESOLVED`，来源仍是 `war-monger`，`totalDamage: 0`。

这与玩家看到的“战争贩子没效果”一致：军刀结果本应把战争贩子转成 5 点可防御攻击，但旧现场被 0 伤害提前收口。

## 当前规则合同

- `docs/games/dicethrone/card-timing-terms.md` 已登记：战争贩子的军刀结果固定为基础版 5 点、II 版 6 点可防御攻击，并恢复到防御前伤害结算，随后进入防御投掷。
- 当前领域测试也覆盖：基础战争贩子军刀分支必须先进入防御投掷，防御减伤后才结算攻击伤害。

## 本轮处理

- 本轮没有改战争贩子规则实现。
- 本轮修正了战争贩子真实入口 E2E 的操作步骤：玩家选中战争贩子技能后，需要先点击页面上的“结算攻击”按钮，才进入防御前效果与奖励骰链路。
- 修正文件：`e2e/dicethrone/dicethrone-die-modification.e2e.ts`
  - 新增 `clickResolveAttack(...)` 测试 helper。
  - 两条战争贩子 E2E 都改为：选中技能 -> 确认 `pendingAttack` 来源是 `war-monger` -> 点击“结算攻击” -> 再断言奖励骰。

## 验证

命令：

```powershell
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/dicethrone-die-modification.e2e.ts --grep "战争贩子"
```

结果：

- `2 passed`
- 覆盖项：
  - 战术家真实战争贩子奖励骰可用战术优势重投军刀，并在确认后才进入 5 点攻击结算。
  - 战争贩子军刀奖励骰确认后进入防御投掷，不能以零伤害提前收口。

## 收口结论

当前版本已经证明战争贩子不是 0 伤害无效收口：真实入口中，选中战争贩子并点击“结算攻击”后会打开奖励骰；军刀确认后进入 5 点可防御攻击，防御完成后会正常扣血。

因此本地反馈按“当前版本已恢复，并有真实入口回归覆盖”关闭。
