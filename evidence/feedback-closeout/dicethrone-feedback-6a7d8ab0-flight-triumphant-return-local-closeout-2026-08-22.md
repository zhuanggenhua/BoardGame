# DiceThrone 本地反馈 6a7d8ab0：飞行后攻击技能未生效（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 反馈 ID：`6a7d8ab0d9ac56353b2633f0`
- 原始症状保真版：玩家反馈“流程很怪，为什么使用飞行导致无法切换攻击技能，攻击技能也没有生效”。

## 原始反馈命中的症状

这条反馈包含两段玩家可见链路，不能互相替换：

- “使用飞行导致无法切换攻击技能”：反馈行动记录里，玩家先发动“圣洁光辉”，随后使用“飞行（增伤）”，奖励骰分别掷出 3 和 2；当前截图与 E2E 证明，飞行临时奖励骰确认后会回到正式进攻骰和“结算攻击”入口。
- “攻击技能也没有生效”：同局后续玩家发动“凯旋归来”，奖励骰掷出 6；反馈保存的最终伤害记录是 0 点，这与“凯旋归来本应造成基础攻击伤害，但实际没有扣血”的症状一致。

本轮没有把“飞行”本身当作根因。飞行是同局前置链路；真正复现到的坏结果是后续“凯旋归来”奖励骰确认后，主攻击被直接收口为 0 伤害。

## 当前规则合同

- 炽天使“凯旋归来”基础版是小顺子攻击，先造成 6 点基础攻击伤害，再投 1 颗奖励骰；奖励骰结果可能让攻击变成不可防御。
- 炽天使“飞行”是可消耗标记：在进攻掷骰、造成伤害前、受到伤害前都可使用；作为进攻掷骰阶段的临时奖励骰时，确认后必须回到正式进攻骰和攻击技能结算链路。
- 代码合同入口：
  - `src/games/dicethrone/heroes/tianshi/abilities.ts`：`triumphant-return` 包含 6 点基础攻击伤害和 `tianshi-triumphant-return-roll` 奖励骰。
  - `src/games/dicethrone/heroes/tianshi/tokens.ts`：`flight` 可在 `duringRoll` 使用，并走 `tianshi-use-flight`。

## 根因

现实故障现象：玩家看到“凯旋归来”奖励骰出了 6，但攻击最后没有生效，结算为 0 伤害。

直接触发条件：凯旋归来奖励骰确认后，结算流程把当前攻击直接推进到“可以收口”的阶段。

导致持续发生的机制缺陷：`handleTriumphantReturnRoll` 以前创建的是展示型奖励骰收口，奖励骰确认后的后续流程是直接进入攻击收口阶段；最终伤害构建只读取当前攻击里已经解析好的结算伤害，但凯旋归来的 6 点基础攻击还没有重新进入正式伤害结算，所以被读成 0。

## 本轮处理

- 修改 `src/games/dicethrone/domain/customActions/tianshi.ts`：
  - 凯旋归来奖励骰改为使用可重投/可改骰的奖励骰流程，但最大重投次数仍为 0。
  - 奖励骰确认后的后续阶段改为回到正式攻击伤害结算，而不是直接进入攻击收口。
- 新增 `src/games/dicethrone/__tests__/tianshi-behavior.test.ts` 回归用例：
  - “凯旋归来奖励骰掷出 6 后应保留基础伤害并以不可防御攻击结算”。
  - 断言奖励骰 6 会生成不可防御攻击，并以 6 点伤害扣除对手生命。
- 复验真实入口 E2E：
  - 凯旋归来奖励骰 6：右侧确认后对手显示 -6，并回到主要阶段二。
  - 飞行临时奖励骰：确认后回到正式进攻骰，仍可点击“结算攻击”。

## 验证

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tianshi-behavior.test.ts --configLoader native -t "凯旋归来奖励骰掷出 6 后应保留基础伤害|进攻掷骰阶段飞行"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tianshi-rule-matrix.test.ts --configLoader native -t "凯旋归来 II 奖励骰"
node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts --grep "凯旋归来奖励骰掷出 6|消耗飞行 Token 的临时奖励骰应显示右侧确认"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/ability-reselection-prevention.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "攻击技能|奖励骰|reselection|bonus dice"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/roll-context.test.ts --configLoader native -t "临时骰|奖励骰|正式进攻骰|bonus"
```

结果：

- `tianshi-behavior.test.ts`：`1 file passed / 3 tests passed`
- `tianshi-rule-matrix.test.ts`：`1 file passed / 4 tests passed`
- `tianshi-ability-card-real-entry.e2e.ts`：`2 passed`
- `ability-reselection-prevention.test.ts` + `basic-commands-coverage.test.ts`：`2 files passed / 13 tests passed / 148 skipped`
- `roll-context.test.ts`：`1 file passed / 37 tests passed / 15 skipped`

截图核对：

- `test-results/evidence-screenshots/dicethrone/tianshi-ability-card-real-entry.e2e/凯旋归来奖励骰掷出-6-时应在右侧确认后使攻击不可防御并结算/tianshi-triumphant-return-after-auto-settle.jpg`
  - 画面显示对手头顶 `-6`，阶段回到主要阶段二。
- `test-results/evidence-screenshots/dicethrone/tianshi-ability-card-real-entry.e2e/消耗飞行-Token-的临时奖励骰应显示右侧确认，确认后回到正式进攻骰/tianshi-flight-token-right-tray-after-confirm-return-main-dice.jpg`
  - 画面显示飞行临时骰确认后，右侧回到正式进攻骰，且“结算攻击”按钮可用。

## 同类扩审

- 覆盖凯旋归来基础版与升级版奖励骰矩阵，确认奖励骰分支仍按规则给出伤害和不可防御状态。
- 覆盖攻击技能重选、奖励骰、临时骰和正式进攻骰上下文，确认本次改动没有把飞行、奖励骰确认或技能重选路径改坏。
- `ability-reselection-prevention.test.ts` 输出里的命令验证失败是负向用例故意提交非法技能，用来证明非法攻击技能不会被错误接受，不是测试失败。

## 收口结论

当前版本已经修复本条反馈后半段命中的真实结算问题：凯旋归来奖励骰掷出 6 后，会让攻击不可防御，并保留凯旋归来的 6 点基础伤害正常扣血，不会再以 0 伤害结束。

飞行临时奖励骰确认后回到正式进攻骰的链路也已复验通过。因此这条本地反馈按“当前版本已修复，并有领域测试与真实入口 E2E 覆盖”关闭。
