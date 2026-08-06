# DiceThrone 工匠 closeout 证据

> 2026-08-06 FAQ 覆盖：本文原来关于“技能在伤害后付费激活机器人”的口径已经失效。当前以 `王权骰铸常见问题总览2.1.1.docx` 第 2、7 页和 `dicethrone-artificer-full-audit-2026-06-24.md` 顶部最新回写为准：五条技能忽略“然后”，在伤害结算前免费选择机器人；仍要求机器人已建造、仍受每回合次数限制，同一技能不能重复选择同一机器人；电能机器人 `+3` 并入当前攻击。工坊 / Token 正常主动激活的 2/1 合成器成本不变。

> 2026-06-27 回写：本文仍只作为工匠“实现 closeout / L2 机制证据 / 部分真实入口证据”的历史入口继续有效。2026-06-24 时“仍有残余范围”的判断，已被当前工作目录后续补证覆盖；当前应以 `evidence/dicethrone/dicethrone-artificer-full-audit-2026-06-24.md` 顶部 2026-06-27 补充为准，不再用本文去反推“工匠当前仍未完成”。

> 2026-06-24 当前有效口径：本文最初创建时记录的是工匠第二批 L2 机制进度；当前工作目录 `main` 的最新结论已经推进到 closeout 完成。以下“已覆盖对象”表继续保留，作为当前完成态依赖的机制证据明细。

## 2026-06-24 最终 closeout 结论

工匠（`artificer` / 工匠）当前已完成 closeout，不再属于“实施中但只完成了部分 L2 命令级能力”的状态。当前工作目录里的真实完成态证据已经同时具备：

| 范围 | 当前完成态 | 当前权威证据 | 不得再复述的旧口径 |
| --- | --- | --- | --- |
| 角色目录 | 已摘掉实施中徽标 | `src/games/dicethrone/domain/core-types.ts`、`src/games/dicethrone/__tests__/character-catalog-status.test.ts`、`src/games/dicethrone/__tests__/artificer-intake.test.ts` | 不得再说“工匠必须继续保留 implementation_in_progress” |
| 对象收口 | 已完成 closeout 分组 | `src/games/dicethrone/__tests__/artificer-closeout.test.ts` | 不得再说“对象矩阵还没进入最终审计分组” |
| 机制实现 | 已覆盖玩家板、专属手牌、状态、机器人与工坊关键链路 | `src/games/dicethrone/__tests__/artificer-mechanics.test.ts` + 下文对象表 | 不得再说“目前只有 L1 静态接入” |
| 真实入口 | 已覆盖在线双玩家开局，以及工坊按钮激活纳米机器人并引爆纳米爆弹 | `e2e/dicethrone/artificer-intake.e2e.ts`；截图：`01-工匠在线开局-玩家板与手牌.png`、`03-工坊-纳米机器人引爆后.png` | 不得再说“真实入口 E2E 仍缺关键链” |

当前有效结论就是：工匠规则实现已落地，目录完成态已生效，真实入口证据已经并入本工作目录的未提交改动。

## 已覆盖对象

| 对象 | 当前结论 | 证据 |
| --- | --- | --- |
| 收集配件 | 基础版维护阶段获得 1 合成器；II 版改为维护阶段投 1 骰，扳手得 1 合成器，齿轮/电能得 2 合成器 | `src/games/dicethrone/__tests__/artificer-mechanics.test.ts` |
| 合成器 | 可花费 4 个对 1 名对手施加 1 纳米爆弹；2 人局直落唯一对手，4 人 / 2v2 会先进入仅列敌方的 `selectPlayer` 再写入所选目标；基础/高级机器人激活成本已接成 2/1 | `artificer-workshop` 被动动作 + `activeUse.additionalTokenCosts` + `artificer-mechanics.test.ts` 4 人目标链 |
| 合成器制造机器人 | 可花费 2 合成器制造 1 个基础机器人使用机会；满额时动作不可用且不会扣合成器 | `artificer-build-*` custom action |
| 合成器升级机器人 | 可花费 3 合成器将已有基础机器人升级为 2 次使用机会；没有基础机器人时动作不可用且不会扣合成器 | `artificer-upgrade-*` custom action |
| 纳米爆弹 | 持有者维护阶段每层投 1 骰，投 6 移除 1 层 | `flowHooks` upkeep 结算测试 |
| 纳米机器人 | 消耗 1 个后引爆所有玩家的纳米爆弹，按 1/2/3 层造成 1/3/5 伤害并清空；基础/高级激活额外花费 2/1 合成器 | `artificer-nanobot-detonate` + `artificer-workshop` |
| 电能机器人 | 攻击加伤窗口消耗 1 个，本次攻击伤害 +3；基础/高级激活额外花费 2/1 合成器 | `activeUse.beforeDamageDealt` |
| 治疗机器人 | 至少 6 点攻击伤害的防御响应窗口可用，投 1 骰后治疗 1 或 2；基础/高级激活额外花费 2/1 合成器 | `artificer-heal-bot-use` |
| 机械的反击！ | 受击响应时可打出，授予 2 点伤害护盾并对攻击者施加 1 纳米爆弹 | `card-artificer-mechanical-strike` |
| 电弧盾 | 受击响应时可打出；无合成器时防止 2 点伤害，有合成器时可选择花费 1 合成器防止 3 点伤害；作为响应型升级牌进入弃牌堆，不进入 `replaceAbility` 升级链 | `upgrade-artificer-shock-bot-2` |
| 扳手攻击 / 扳手攻击 II | 无合成器时自动追加投 1 骰；有合成器时可选择花费 1 合成器改为扳手（+1 伤害）/齿轮（+2 伤害）/电能（获得 1 合成器），且追加伤害会并入同一次攻击结算 | `wrench-strike-*` / `wrench-strike-2-*` |
| 电路图 II | 在抽 2、治疗 2、获得 4 合成器之外，额外获得 2 CP | `schematics-2` |
| 超频运行 II / 能量提升 | 下半区改为 3 电能，对 1 名对手施加 3 纳米爆弹；不再错误授予合成器或造成 4 点伤害 | `overclock-2-energy-boost` |
| 唤醒机械 II / 精密制造 | 下半区改为 3 扳手 + 1 电能，获得 5 合成器 | `activate-bots-2-precision-fabrication` |
| 电能脉冲 III / 机械大军 | 下半区改为 1 扳手 + 2 齿轮 + 1 电能，造成 5 点伤害，并按当前拥有的机器人种类数再 +1 伤害 | `shock-bot-3-mechanical-army` + `artificer-mechanical-army` |
| 超频运行 / 超频运行 II | 上半区在伤害结算前免费选择至多 2 个不同机器人；无视正常激活条件，但仍要求已建造并保留每回合次数限制，可提前跳过 | `artificer-activate-bots` + `overclock*` |
| 电能脉冲 / 电能脉冲 III | 上半区在伤害结算前免费选择 1 个机器人；电能机器人把 `+3` 并入当前攻击，治疗机器人投骰治疗，纳米机器人引爆所有纳米爆弹 | `artificer-activate-bots` + `shock-bot*` |
| 稍作调整 | 基础版防御掷 4：每个齿轮获得 1 合成器；只要投出电能就施加 1 纳米爆弹 | `artificer-tinker-defense` |
| 稍作调整 II | 防御掷 5；若投出 2 个扳手则反击 1；每个齿轮获得 1 合成器；每个电能施加 1 纳米爆弹 | `artificer-tinker-2-defense` |
| 真本能量！ | 终极上半区在伤害结算前免费选择至多 2 个不同机器人，不能重复选择同一机器人，完成后继续当前攻击结算 | `maximum-power` + `artificer-activate-bots` |
| 灵感突现 II / 从头构建 | 下半区改为 2 扳手 + 2 齿轮；可直接制造 1 个任意高级机器人，或把 1 个基础机器人升级为高级机器人，且不消耗合成器 | `eureka-2-build-from-scratch` |
| 合成大师！ | 投 1 骰；电能获得 5 合成器，否则抽 1 张牌 | `card-artificer-masterpiece` |
| 超高电压！ | 即时获得 2 合成器 | `card-artificer-voltage` |
| 纳米袭击！ | 对 1 名对手施加 1 个纳米爆弹；2 人局直落唯一对手，4 人 / 2v2 会先进入仅列敌方的 `selectPlayer` 再写入所选目标 | `card-artificer-nano-attack` |
| 万能电流！ | 投 1 骰；扳手治疗 2，齿轮获得 1 合成器，电能施加 1 纳米爆弹；4 人 / 2v2 下整张牌先走敌方 `selectPlayer`，再按所选目标结算电能分支 | `card-artificer-overdrive` |
| 这玩意儿真棒！ | 投 1 骰并获得投掷数值一半向上取整的合成器 | `artificer-perfectly-calibrated-roll` |

## 验证命令

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/artificer-intake.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx eslint src/games/dicethrone/__tests__/artificer-mechanics.test.ts src/games/dicethrone/domain/customActions/artificer.ts src/games/dicethrone/domain/customActions/index.ts src/games/dicethrone/domain/characters.ts src/games/dicethrone/domain/executeTokens.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/domain/tokenResponse.ts src/games/dicethrone/domain/tokenTypes.ts src/games/dicethrone/heroes/artificer/abilities.ts src/games/dicethrone/heroes/artificer/index.ts src/games/dicethrone/heroes/artificer/tokens.ts
npx tsc --noEmit --pretty false
npx eslint src/games/dicethrone/domain/passiveAbility.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/ui/PassiveAbilityPanel.tsx src/games/dicethrone/domain/customActions/artificer.ts src/games/dicethrone/heroes/artificer/tokens.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts
npx eslint src/games/dicethrone/domain/attack.ts src/games/dicethrone/domain/customActions/artificer.ts src/games/dicethrone/heroes/artificer/abilities.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/artificer-intake.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
npx eslint src/games/dicethrone/heroes/artificer/abilities.ts src/games/dicethrone/domain/customActions/artificer.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts
```

结果：Vitest 41 项通过；ESLint 0 error / 0 warning；TypeScript 通过。

## 当前收口说明

- 这份 evidence 现已从“L2 中途态进度单”升级为“closeout 证据入口”。
- 下文对象表仍然有价值，因为它说明当前完成态具体依赖了哪些机制实现；但这些对象不再构成继续保留 `implementation_in_progress` 的理由。
- 若后续还要补更多多人目标选择、图标 DOM 断言或额外在线交互 E2E，应归类为扩充证据，而不是回退当前 closeout 结论。
