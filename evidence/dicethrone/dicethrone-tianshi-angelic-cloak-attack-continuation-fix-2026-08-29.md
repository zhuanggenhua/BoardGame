# DiceThrone 炽天使天使斗篷防御骰与主攻击结算修复（2026-08-29）

## 反馈内容 / 现实症状

- 游戏：DiceThrone（王权骰铸）。
- 对象：炽天使的防御技能“天使斗篷”，对手为 AI 控制的僧侣。
- 玩家反馈原话：不管对面什么技能，炽天使都掉不了血。
- 保真场景：僧侣攻击炽天使；炽天使选择天使斗篷；防御阶段普通 1 骰为 1（炽炎剑），只产生 2 点防御反击，不获得飞行；确认防御骰并离开防御阶段后，僧侣的主攻击仍应结算。
- 实际错误：天使斗篷错误创建奖励骰结算，绕过了普通防御骰流程；此前回归测试还把这个错误模型固定成了预期。

## 规则合同

- 真相源：`src/games/dicethrone/rule/炽天使真相源表.md`、`src/games/dicethrone/rule/炽天使卡牌录入核对.md`。
- 合同状态：已锁定。
- 合同结论：天使斗篷使用防御阶段普通骰；炽炎剑造成反击，双翼、十字和圣洁吊坠按等级提供抵挡伤害；它不提供永久免伤，也不会因双翼授予飞行 Token。升级版的免费重投是普通防御骰的第二次投掷，不是奖励骰重掷。

## 根因分层

| 层级 | 证据 |
| --- | --- |
| 现实故障现象 | 确认天使斗篷防御骰后，主攻击伤害没有扣到炽天使。 |
| 直接触发条件 | 天使斗篷选择后，custom action 创建了 `BONUS_DICE_REROLL_REQUESTED`，而不是读取防御阶段的 `DICE_ROLLED` 结果。 |
| 错误执行 | 防御骰被挪进奖励骰交互，普通防御阶段的确认、重投和防御收口没有成为这条技能的真实流程。 |
| 根本机制 | `src/games/dicethrone/domain/customActions/tianshi.ts` 把防御技能误接到奖励骰 helper；普通防御技能应在 `withDamage` 中读取 `getActiveDice(state)`，并由技能触发器的 `rollLimit` / `rerollDieLimit` 提供普通防御骰重投规则。 |

## 改动

| 文件 | 改动 | 玩家可见结果 |
| --- | --- | --- |
| `src/games/dicethrone/heroes/tianshi/abilities.ts` | 基础版保留防御阶段 1 骰；II/III 版增加 2 次投掷上限和单次最多重投 1 颗。 | 只有升级版获得卡面规定的免费重投，且走普通防御骰流程。 |
| `src/games/dicethrone/domain/customActions/tianshi.ts` | 天使斗篷读取防御阶段当前骰面，移除其奖励骰结算 handler。 | 防御结果直接进入共享防御结算，主攻击继续正常结算。 |
| `src/games/dicethrone/__tests__/tianshi-behavior.test.ts` | 删除错误的奖励骰测试，加入普通防御骰结果、真实僧侣攻击链和普通骰重投测试。 | 骰面 1 时炽天使生命从 50 降到 42，僧侣收到 2 点不可防御反击，并确认没有奖励骰结算残留。 |
| `e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts` | 用真实防御投掷、确认、结束防御替换旧的奖励骰注入链，并断言确认后只有一次普通防御投掷事件。 | 页面链直接证明普通防御骰、不会凭空再次投掷、反击、主攻击扣血和阶段收口。 |

## 首跑失败证据

- 前一版 E2E 的测试模型把天使斗篷当作奖励骰，并且没有点击“开始防御”或普通“投掷”按钮；它不能作为普通防御骰覆盖证据。
- 本轮真实 E2E 调试中还发现并修正了三个测试自身问题：未先关闭攻击特写层、把既有 `data-tutorial-id` 错写成 `data-testid`，以及本地 AI 自动推进使收口阶段被推进到下一回合。它们均不是规则实现失败，但说明旧测试路径没有覆盖用户真实动作。
- 曾误加过“投掷动画期间防快速双击”的 UI 保护和测试；用户澄清后已撤掉，因为真实问题是确认后重复生成投掷，不是确认前双击。
- 修正后回到原始失败位点，单独断言普通防御骰、攻击后的最终生命值和临时状态清理；2 点反击伤害的目标是攻击者僧侣。

## 验证

- `npx vitest run src/games/dicethrone/__tests__/tianshi-behavior.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：56/56 通过。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：162/162 通过。
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts src/games/dicethrone/__tests__/auto-phase-progress.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：154/154 通过。
- `npx vitest run src/games/dicethrone/__tests__/tianshi-rule-matrix.test.ts src/games/dicethrone/__tests__/tianshi-intake.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：21/21 通过。
- `npm run typecheck`
  - 结果：通过。
- `npx eslint src/games/dicethrone/domain/customActions/tianshi.ts src/games/dicethrone/__tests__/tianshi-behavior.test.ts`
  - 结果：0 errors。
- `npm run test:dicethrone`
  - 结果：本轮运行超过 304 秒无输出并超时；不作为全量通过证据，已以前述直接相关测试组作为当前验证结果。
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "天使斗篷应通过一次普通防御投掷结算反击，并让主攻击扣除炽天使生命"`
  - 结果：`1 passed`。真实页面点击“开始防御”、天使斗篷、普通“投掷”、确认和“结束防御”；断言普通 `DICE_ROLLED`、无奖励骰结算、炽天使 HP 42、僧侣 HP 48、`main2` 和攻击临时状态清理。
- `npm run typecheck`、定向 ESLint、`git diff --check`
  - 结果：类型检查通过，ESLint `0 errors`，差异检查通过（仅 CRLF 提示）。

## 同类扩审与边界

- 横向检查了炽天使文件中的其它奖励骰入口：圣击、神圣惩戒、凯旋归来等仍是攻击技能或卡牌明确要求的额外骰；天使斗篷是唯一被错误接到奖励骰 helper 的防御技能。
- 横向检查了普通防御骰的共享读取与重投入口：其它防御技能读取 `getActiveDice(state)`，触发器用 `rollLimit` / `rerollDieLimit` 控制普通骰；本次未修改共享防御流程。
- 这次没有修改 AI 策略或把飞行改成永久免伤。AI 只是触发了同一条真实攻击流程；问题本体是防御骰类型接错和攻击结算没有正确承接。
- 本证据证明该代表链已修复，不外推为所有 DiceThrone 英雄、所有防御骰组合全部收口。

## 漏审归因与复盘

- 旧 E2E 直接注入了防御阶段与待攻击，点击技能后又直接推进阶段，随后断言“奖励骰结算”。它没有点击普通“防御投掷”按钮，没有检查普通骰事件，也没有检查主攻击最终扣血，所以会把错误模型当成通过。
- 旧领域测试覆盖了天使斗篷自己的反击、错误的双翼飞行、护盾和“奖励骰重投”，但没有校验它是否属于普通防御骰，也没有把“攻击发起 -> 防御普通骰 -> 防御收口 -> 主攻击最终扣血”作为连续链路；2026-09-01 已把“双翼飞行”纠正为双翼抵挡伤害，并补入防 1 的回归口径。
- 因此测试虽然包含局部血量断言，但断言的是错误构造的奖励骰链；它没有覆盖真实玩家流程，也没有检查普通 `DICE_ROLLED`、普通防御重投和最终攻击血量。
