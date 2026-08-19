# DiceThrone 咒缚海盗“赎金！”自选骰修复收口证据

## 基本信息

- 对象：DiceThrone / 咒缚海盗手牌 `赎金！`。
- 日期：2026-08-19。
- 作者：Codex。
- 文档类型：`closeout`。
- 关联任务：用户反馈“海盗赎金为什么能选自己的；必须要端到端；如果没有就是审计文档有问题”。

## 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：DiceThrone 咒缚海盗 `card-cursed-pirate-ransom` 的出牌合法性、选骰候选、支付 / 重掷收口和旧 evidence 回写。
- 本轮覆盖的规则子句或共享链路：C1 只有当前投骰者是对手时，才能选择当前唯一投骰结果中的一颗骰子；C2 目标对手支付 2 CP 或重掷该骰；负向路径为投骰者自己不能在自己投骰窗口打出赎金来选择自己的骰子。
- 本轮使用的目标入口 / 环境：领域机制测试、真实浏览器 E2E `zhanshujia-cursed-pirate-intake.e2e.ts`、咒缚海盗规则录入表和旧对象审计总账。
- 明确不在本轮范围内的对象：咒缚海盗其它手牌、其它英雄全部响应牌、线上部署、反馈后台状态回写、整份咒缚海盗 completion audit。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 赎金旧实现允许投骰者自己打出并选择当前活跃骰 | `功能实现阻塞` | 是 | 是 | 当前范围内，已修复 | 出牌合法性拒绝投骰者自打；候选与 resolver 绑定目标对手骰区 |
| 旧 E2E 名称写“跨玩家双步选择”，但场景实际是 Guest 自己投骰后打赎金 | `当前范围验证缺口` | 否 | 是 | 当前范围内，已替换为对手投骰窗口 E2E | Host 投骰、Guest 打赎金、Host 支付收口 |
| 旧对象审计总账继续传播“赎金已由旧截图 36-38 证明” | `审计留档缺口` | 否 | 是 | 当前范围内，已回写降级 | 旧行标为历史证据，新行引用 2026-08-19 证据 |
| 其它普通改骰 / 重掷对手骰牌是否同坑 | `非阻塞扩展` | 否 | 否 | 已做同类扩审；未命中同一自定义双步缺陷 | 记录横向搜索范围和排除依据 |

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 锁定为 `赎金！` 自选骰问题，不扩成整份咒缚海盗审计。 |
| 真相源状态 | `passed` | 录入合同写明“选择对手一颗骰子”；规则表已回写为只有当前投骰者是对手时才可选择当前唯一投骰结果。 |
| 原子语义断言 | `passed` | C1 / C2 与负向路径已在“逐项结论”拆开。 |
| 实现消费链 | `passed` | `rules.ts` 出牌合法性、`cursed_pirate.ts` 候选生成、两个 resolver 都消费同一目标骰过滤。 |
| 最终权威结果 | `passed` | 领域测试断言拒绝自打、支付 CP 转移、重掷目标骰并保持阶段可继续、流程收口、无残留。 |
| 交互真实入口 | `passed` | 新 E2E 从 Host 投骰、Guest 打赎金、Host 决策支付到弃牌收口。 |
| 验证证据 | `passed` | 领域测试、真实入口 E2E、目标 ESLint 和 evidence 自检均记录在本文。 |
| 共享影响与代表链依据 | `passed` | 同类扩审覆盖通用改骰 helper 与已有骰子工具集合；代表对象为通用 `reroll-opponent-die-1` / 改骰 helper，判等依据是其已有 `diceOwnerId / targetOpponentDice / allowedDieIds`，赎金为独立双步链，未用代表链替代直接修复。 |
| 缺口分类与范围裁定 | `passed` | 本节缺口表已区分功能实现、验证缺口、留档缺口和非阻塞扩展。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧对象审计总账已把 2026-06-01 旧 E2E 降级为历史证据。 |
| 残余范围声明 | `passed` | 本轮不声明整份咒缚海盗已完成；只声明 `赎金！` 自选骰当前范围已收口。 |

## 结论等级

- 结论等级：`当前范围已收口`。
- 判定理由：
  - 用户原始症状命中：赎金应选择“对手骰子”，旧实现会在自己投骰窗口列出自己的当前活跃骰。
  - 规则合同已锁定：咒缚海盗录入表和卡牌录入表都写明“选择对手一颗骰子”。
  - 实现已修到规则入口：投骰者自己打出 `target=opponent` 的已有骰子牌会被出牌合法性拒绝；赎金候选、付款后继续、重掷 resolver 都要求目标对手就是当前投骰者，然后只消费当前唯一投骰结果。
  - 验证已回到真实入口：新 E2E 不是旧的“自己投骰后选骰”，而是 Host 正在投骰，Guest 从手牌打赎金并让 Host 进入支付 / 重掷决策。

## 权威来源

- 主真相源：[咒缚海盗录入核对.md](../../src/games/dicethrone/rule/咒缚海盗录入核对.md) 中 `card-cursed-pirate-ransom` C1 / C2。
- 对照源：[咒缚海盗卡牌录入核对.md](../../src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md)、[game-dicethrone.json](../../public/locales/zh-CN/game-dicethrone.json) 里的赎金选择 / 支付文案。
- 关键规则裁定：`赎金！` 的现实语义是“如果当前投骰者是对手，出牌者选择当前唯一投骰结果中的一颗骰子；该对手支付 2 CP 或重掷该骰”，不是“当前投骰者可以选择任意当前活跃骰”。
- 合同状态：`locked`。
- 是否需要回原始规则图 / 规则书：不需要。本轮用户反馈与现有录入合同一致，问题是实现没有正确消费合同。

## 逐项结论

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 赎金 C1 候选 | 出牌者只能在当前投骰者是对手时选择当前唯一投骰结果中的一颗骰子 | [cursed_pirate.ts](../../src/games/dicethrone/domain/customActions/cursed_pirate.ts) `getRansomEligibleCurrentDice`、`requestRansomDieChoice` | 只有“目标玩家就是当前投骰者”时才生成候选；非当前投骰者或旧编码值无法继续 resolver | 领域测试断言提示为对手骰候选；E2E 36 图显示 Guest 看到“选择一颗对手骰子” | 无 | 通过 |
| 赎金 C1 负向 | 投骰者自己不能在自己投骰窗口打出赎金来选择自己的骰子 | [rules.ts](../../src/games/dicethrone/domain/rules.ts) `hasExistingDiceToolEffect` + `requireIsNotRoller` | `checkPlayCard` 返回 `{ ok:false, reason:'requireIsNotRoller' }` | 领域测试 `赎金只能在对手投骰窗口选择对手骰子...` | 无 | 通过 |
| 赎金 C2 支付 | 被选骰玩家支付 2 CP 给出牌者，源卡收口 | [cursed_pirate.ts](../../src/games/dicethrone/domain/customActions/cursed_pirate.ts) `RANSOM_RESOLVE_CHOICE_ID` 支付分支 | Guest CP `5 - 1 + 2 = 6`，Host CP `5 -> 3`，源卡进入弃牌堆 | E2E 37 / 38 图和资源断言 | 无 | 通过 |
| 赎金 C2 重掷 | 若不支付，则重掷被选择的那颗当前投骰 | [cursed_pirate.ts](../../src/games/dicethrone/domain/customActions/cursed_pirate.ts) 重掷分支再次调用 `getRansomEligibleCurrentDice` | 目标骰 `oldValue 6 -> newValue 4`，`playerId` 为目标对手，阶段仍在 `offensiveRoll` | 领域测试重掷分支 | 无 | 通过 |
| 旧 E2E 结论 | 旧标题“跨玩家双步选择”不能证明排除自己骰 | [zhanshujia-cursed-pirate-object-audit-2026-05-31.md](zhanshujia-cursed-pirate-object-audit-2026-05-31.md) 赎金行与验证记录 | 旧证据降级为“只证明付款收口”，不再支撑“对手骰”合法性 | 旧总账已回写 2026-08-19 新 E2E | 审计留档缺口已修 | 通过 |

## 验证证据

### 领域测试

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "赎金"`。
- 结果：`1 passed`，其余同文件用例按筛选跳过。
- 证明了什么：投骰者自己打赎金被拒绝；对手投骰窗口里可以选对手骰；支付分支完成 CP 转移；重掷分支只重掷被选对手骰；重掷后阶段可继续、流程收口、无残留。
- 没有证明什么：不证明咒缚海盗其它所有手牌都完成真实入口收口。

### 真实入口 E2E

- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链"`。
- 结果：`1 passed`。
- 证明了什么：Host 是当前投骰者，Guest 从手牌打出赎金，Guest 选择当前唯一投骰结果中的 Host 骰，Host 决定支付 2 CP，最终 Guest / Host CP 与源卡弃牌收口。
- 没有证明什么：不证明线上已部署，也不证明旧 E2E 标题本身曾经正确。
- 截图 / 人工观察：
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链/36-guest-ransom-die-choice.jpg`：画面显示 Guest 的赎金选择弹窗，候选为“骰子 1-5”，文案是“选择一颗对手骰子”。
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链/37-host-ransom-pay-or-reroll.jpg`：画面显示 Host 收到“是否支付 2 CP”的决策，右侧可见 Host 当前投骰骰区。
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链/38-guest-ransom-paid-applied.jpg`：画面显示 Guest CP 为 6、Host CP 为 3，源卡进入右侧弃牌 / 已打出区域。

### 代码静态验证

- 命令：`npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/domain/rules.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`。
- 结果：通过。
- 证明了什么：本轮触及文件没有 ESLint 报错。
- 没有证明什么：不替代领域测试和真实入口 E2E。

### Evidence 自检

- 命令：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-cursed-pirate-ransom-self-dice-fix-2026-08-19.md`。
- 结果：`[audit-evidence-completeness] OK`。

## 测试语义对账

| 测试 | 断言了什么最终状态 / 命令 | 负向或边界 |
| --- | --- | --- |
| `赎金只能在对手投骰窗口选择对手骰子，再由对手支付 2CP 或重掷该骰子` | `checkPlayCard` 拒绝投骰者自打；支付后 CP 转移；重掷后 `DIE_REROLLED` 写入目标对手骰 | 负向断言 `requireIsNotRoller`；重掷 resolver 再次校验目标骰仍属于当前投骰对手 |
| `真实入口应展示并结算赎金在对手投骰窗口的跨玩家双步选择链` | Guest 真实打出手牌，Host 真实收到支付 / 重掷选择，最终 CP 与弃牌收口 | 纠正旧 E2E 的自投骰场景；不再用付款收口冒充“对手骰”证明 |

## 共享根因与残余范围

- 根因分级：单点实现缺陷 + 审计验证缺口。
- 现实故障现象：玩家在自己投骰窗口能打出“赎金！”并选择自己的当前骰子。
- 直接触发条件：旧 `requestRansomDieChoice` 从全局当前活跃骰区生成候选，没有先确认“目标玩家就是当前投骰者”。
- 根本机制：赎金没有被纳入“确认骰后修改 / 重掷已有骰子”的响应牌集合，导致投骰者自己可以走直接出牌路径；随后候选生成又只读全局活跃骰区，自己的骰被误当成可选目标。
- 本轮处置：
  - 在 `rules.ts` 中把 `cursed-pirate-ransom-die-choice` 纳入已有骰子工具集合，使其参与响应窗口和 `requireIsNotRoller` 门控。
  - 在 `cursed_pirate.ts` 中新增目标骰过滤，候选生成、付款后继续和重掷 resolver 都消费同一过滤结果。
  - 在领域测试和真实入口 E2E 中补回负向路径与对手投骰窗口路径。
- 同类扩审记录：
  - 搜索范围：`src/games/dicethrone/domain`、`src/games/dicethrone/heroes`、`src/games/dicethrone/__tests__`、`e2e/dicethrone`。
  - 根因关键词 / helper：`EXISTING_DICE_TOOL_CUSTOM_ACTION_IDS`、`hasExistingDiceToolEffect`、`target: 'opponent'`、`getActiveDice(state)`、`resolveTargetOpponentDice`、`resolveDiceOwnerId`、`allowedDieIds`、`reroll-opponent-die-1`。
  - 命中项：通用改骰 / 重掷牌走 [customActions/common.ts](../../src/games/dicethrone/domain/customActions/common.ts) 的 `resolveDiceOwnerId`、`resolveTargetOpponentDice` 和 `resolveAllowedDieIdsForDiceInteraction`，与本次赎金独立双步 choice 链不同。
  - 已一并处理项：赎金独立双步链；旧 `reroll-opponent-die-1` 等普通已有骰子工具已在 `EXISTING_DICE_TOOL_CUSTOM_ACTION_IDS` 内。
  - 判定不受影响项及理由：通用改骰 helper 已携带骰子归属和允许骰 ID；本轮没有发现其它 `target=opponent` 的独立双步选骰链直接用全局活跃骰绕过目标玩家。
- 残余范围：整份咒缚海盗 completion audit、其它英雄全部骰子响应牌和线上发布不由本文证明。

## 修订 / 失效记录

- 旧文档路径：[zhanshujia-cursed-pirate-object-audit-2026-05-31.md](zhanshujia-cursed-pirate-object-audit-2026-05-31.md)。
- 旧结论：赎金行把旧 2026-06-01 E2E 截图 36-38 写成“证明 Guest 选骰、Host 支付 2CP 的跨玩家双步选择链”，并据此支撑对象级 L3。
- 失效原因：旧场景实际上让 Guest 自己处于进攻投骰并打赎金，只证明后续付款收口，不能证明候选骰属于对手，也没有负向断言“投骰者自己不能打赎金”。
- 替代旧结论的新证据：2026-08-19 领域测试和 E2E 均锁定对手投骰窗口；旧总账已回写新结论。
- 新结论：旧截图只保留为历史付款收口证据；当前有效证据是本文记录的新测试、新 E2E 和已回写规则合同。
- 是否需要修改旧文档正文中的误导行：已修改赎金对象行和验证记录行。

## 漏审归因

- 漏审归因：测试断言过窄 + 证据停在中间态 / 付款收口 + 旧测试已经失效。
- 旧测试为什么没挡住：旧 E2E 只断言“选择后目标玩家能支付 2 CP、CP 能收口、源卡能弃牌”，没有断言选项属于对手骰，也没有断言投骰者自己打出会被拒绝。
- 旧 evidence 为什么误导：旧 evidence 名称和文字写“跨玩家双步选择”，但没有回查构造状态里的当前投骰者是谁；于是“付款玩家和出牌玩家不同”被误当成“被选骰属于对手”。
- 规范回代判断：本次问题已经被现有 `rule-contract-audit`、`regression-closeout`、`e2e-verification` 和 `audit-evidence-template` 覆盖，属于旧 evidence 未按现有口径消费，不需要新增项目规范；单游戏合同和旧 evidence 已回写。

## 对外汇报口径

- 允许说：
  - `赎金！` 自选自己骰的问题已在当前代码中修复，并补了领域负向测试和真实入口 E2E。
  - 旧端到端“有现成但不合格”：它只证明付款收口，没证明不能选自己骰；审计文档确实有问题，已回写。
  - 当前范围已收口，范围限定为 `赎金！` 自选骰问题。
- 禁止说：
  - 禁止说整份咒缚海盗审计已经全面完成。
  - 禁止说所有 DiceThrone 骰子响应牌都重新做过端到端。
  - 禁止说线上已经部署或反馈后台已关闭。
