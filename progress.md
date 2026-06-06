> 状态提示（2026-06-05）：本文件包含多条历史长期任务推进记录；其中的 `Next:`、`当前状态`、`继续下一批` 只对各自写入当时有效，**不自动构成当前对话任务**。未被用户当轮明确点名的条目，一律只作历史进度参考。

## 2026-06-06 intake 当前已收敛到长跑 soak 稳定性，而不是新的稳定规则红灯

- 收口对象：
  - `制胜高地`
  - `开拓战场（基础主分支）`
  - `4 人无情诅咒 targeting`
  - `4 人地毯式轰炸双敌目标链`
  - `战术家 / 咒缚海盗 intake` 最新验证口径
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
    - `2 files / 83 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过 ultimate 槽位触发并结算制胜高地的前置链"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应展示并结算地毯式轰炸的双敌目标链"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 当前 file 已扩到 `78` 条，不再适合沿用旧的 `71 passed / 0 failed` 口径
    - 整跑里中后段出现 `frontend readiness / route preload` 断连（`Failed to fetch` / `ECONNREFUSED 127.0.0.1:6273`）
    - 同次整跑里冒红的 4 条对象链均已在单条补跑中转绿，因此当前没有新增稳定规则红灯
- 当前边界：
  - 当前剩余已进一步收敛为 `intake.e2e.ts` 整文件长跑 soak 稳定性，以及双面 / family 级 completion audit。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 奖励骰 family 再补一轮负向/不串写机制回归

- 收口对象：
  - `起锚`
  - `虚张声势`
  - `死亡印记`
  - `抽筋剥皮`
  - `瞭望台`
  - 咒缚海盗奖励骰 family 的 `default / below-threshold / no-cross-write` 子 seam
- 代码动作：
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 新增 `起锚骷髅时只施加休战，非骷髅时只抽 1 张牌`
    - 新增 `虚张声势按弯刀伤害、战利品抽牌、骷髅火药桶三分支结算`
    - 新增 `抽筋剥皮弯刀不足 3 时只增加攻击伤害，不施加火药桶`
    - 强化 `死亡印记先获得 2CP...`：纯弯刀盘面显式锁定“不抽牌、不写诅咒金币，只写不可防御伤害”
    - 强化 `瞭望台按弯刀查看手牌...`：弯刀查看手牌确认后不产生 `CARD_DISCARDED`
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "死亡印记先获得 2CP|起锚骷髅时只施加休战|抽筋剥皮弯刀不足 3 时只增加攻击伤害|瞭望台按弯刀查看手牌" --configLoader native`
    - `4 passed`
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
    - `76 passed`
- 文档动作：
  - `task_plan.md`
    - 回写奖励骰 family 新增的负向 seam 与 `mechanics=76 passed` 口径。
  - `findings.md`
    - 回写当前正确结论：奖励骰 family 继续向 final verdict 收紧，但仍不能据此宣称整派系完成。
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 回写 `起锚 / 虚张声势 / 死亡印记 / 抽筋剥皮 / 瞭望台` 的负向或不串写机制证据。
- 当前边界：
  - 这一步收掉的是奖励骰 family 里“默认分支 / 未达阈值 / 不串写”这类机制层缺口，不等于咒缚海盗奖励骰 family 已整体封版。
  - 当前仍未收口的是 `诅咒金币 / 火药桶 / 奖励骰 family` 的 final verdict、双面 face-by-face completion audit，以及最终移除 `implementation_in_progress` 的门禁。

## 2026-06-06 火药桶 `upkeep transfer -> 目标已持有者` 已补机制回归

- 收口对象：
  - `火药桶 family` 的 `upkeep transfer` 子段
- 代码动作：
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 新增 `火药桶维持投骰 6 转交给已持有者时，目标旧火药桶会爆炸并保留新火药桶`
    - 这条回归显式锁定：`upkeep-powder-keg` 在转交给已持有目标时，必须同时满足 `源目标移除 / 目标旧桶爆炸 / 目标保留新桶`。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "火药桶维持投骰 6 转交给已持有者时，目标旧火药桶会爆炸并保留新火药桶" --configLoader native`
    - `1 passed`
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
    - `71 passed`
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 回写 `upkeep transfer` 的 overlap 机制证据，不再只靠对象级 E2E 兜底。
  - `task_plan.md`
    - 回写 `火药桶 family -> upkeep transfer` 子段新增硬证据，固定当前 `mechanics=71 passed` 口径。
- 当前边界：
  - 这一步收掉的是 `火药桶` transfer overlap 的机制层缺口，不等于 `火药桶 family` 已整体封版。
  - 当前仍未收口的是 `诅咒金币 / 火药桶 / 奖励骰 family` 的 final verdict、双面 face-by-face completion audit，以及最终移除 `implementation_in_progress` 的门禁。

## 2026-06-06 human continuation decline path 已补齐，`诅咒金币` family 再前进一步

- 收口对象：
  - `判决指令`
  - `无情劫掠`
  - `诅咒金币 family` 的 `continuation writer` 子段
- 代码动作：
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 新增 `human 面判决指令拒绝获得诅咒金币时仍会继续施加休战并造成不可防御伤害`
    - 新增 `human 面无情劫掠拒绝获得诅咒金币时仍会继续施加休战和火药桶`
    - 两条都锁同一个 family 事实：`decline` 只影响是否自得金币，不应中断后续 continuation。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面判决指令拒绝获得诅咒金币|human 面无情劫掠拒绝获得诅咒金币" --configLoader native`
    - `2 passed`
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
    - `70 passed`
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 回写 `decline` 路径已被显式锁定，`诅咒金币` family 不再只是 accept path 有硬证据。
  - `task_plan.md`
    - 回写 `continuation writer` 子段新增硬证据，固定当前 `mechanics=70 passed` 口径。
- 当前边界：
  - 这一步收掉的是 human continuation 的负向路径缺口，不等于 `诅咒金币 family` 已整体封版。
  - 当前仍未收口的是 `诅咒金币 / 火药桶 / 奖励骰 family` 的 final verdict、双面 face-by-face completion audit，以及最终移除 `implementation_in_progress` 的门禁。

## 2026-06-06 completion audit 再收紧：剩余项已落到可执行子 family，而不是“待重录”

- 收口对象：
  - `诅咒金币`
  - `火药桶`
  - `咒缚海盗奖励骰 family`
  - `双面 final gate`
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 把 `诅咒金币 / 火药桶` 的 L4 边界固定成可执行 seam：
      - `诅咒金币 = direct writer / continuation writer / self-remove / later consumer`
      - `火药桶 = direct grant / threshold writer / multi-target choice / upkeep transfer / no-attack passive`
    - 新增 `咒缚海盗奖励骰 family 最终 verdict`，把 remaining 从泛化“奖励骰还没封版”收紧成 5 类子 family：
      - `起锚 / 虚张声势` 的单骰即时分派
      - `瞭望台` 的信息/弃牌交互
      - `干票大的` 的双骰聚合资源
      - `死亡印记 / 抽筋剥皮` 的攻击期多骰
      - `啜呼` 的目标方 choice + 状态双写入
    - 维持双面 final gate 现状：`human 9 / 9`、`cursed 9 / 9`、`16 / 16` 专属手牌、`human-player-board` 资源链都已通过；hold 只剩状态 family 与奖励骰 family 仍待 final verdict。
  - `findings.md`
    - 修正一处过时口径：不再写“技能是不是要重录，答案仍然是要”，改成“不需要整套重录，只剩逐槽复核 + 双面审计 + family 封版”。
- 当前边界：
  - 这一步没有新增代码或测试，推进的是 completion audit 的判定精度。
  - 当前最小真实剩余集合已进一步固定为：
    - `诅咒金币 family final verdict`
    - `火药桶 family final verdict`
    - `咒缚海盗奖励骰子 family final verdict`
    - `双面 face-by-face completion audit`
    - 最终是否允许移除 `implementation_in_progress`

## 2026-06-06 用死亡吐息补齐凋零 / 休战的第二条 live consumer 直证

- 收口对象：
  - `凋零`
  - `休战`
  - 咒缚海盗状态 family 的 next-proof gate
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `真实入口应在持有凋零时通过咒缚面 combo 槽位触发并减少死亡吐息的攻击伤害`
    - 新增 `真实入口应在攻击者带有休战时通过咒缚面 combo 槽位阻断死亡吐息的攻击伤害并在阶段结束清理状态`
    - 两条都复用现成 `setupBreathOfDeathScenario(...)`，不再另开新对象；只是在现有 `死亡吐息` 真实入口上分别施加 `凋零 1 / 休战 1`，验证不同攻击来源下的 live consumer 收口。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在持有凋零时通过咒缚面 combo 槽位触发并减少死亡吐息的攻击伤害"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在攻击者带有休战时通过咒缚面 combo 槽位阻断死亡吐息的攻击伤害并在阶段结束清理状态"`
    - `1 passed`
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 回写 `凋零 / 休战` 的对象级条目、状态家族 completion 边界、L4 seam 矩阵、family next-proof gate 与验证命令表。
    - 当前口径已从“是否还缺第二条 live consumer”收紧为“第二条来源已拿到，剩余只在 family verdict 封版与合法复用登记”。
- 当前边界：
  - 这一步推进的是状态 family 证据强度，不等于状态家族已整体封版。
  - 当前仍未收口的是 `诅咒金币 / 火药桶` 的 family 级合法复用登记、奖励骰 family 分组封版、双面 face-by-face completion audit，以及最终移除 `implementation_in_progress` 的门禁。

## 2026-06-06 completion audit 口径进一步收紧：human 面不是“待重录”，但审计仍未封版

- 收口对象：
  - `human/normal 面`
  - `implementation_in_progress` 保留依据
  - 双面 final gate 的对外说法
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 把双面 final gate 里的 `双面状态 family / 双面奖励骰 family` 从模糊 `audit-only` 收紧为“实现已落地，但仍待 audit 封版”的口径。
    - 把底部汇总结论里的 `官方 human/normal 面完整实现` 从易被误读成“仍有未实现债”的 `scoped-debt` 改成更准确的 `audit-only`，明确剩余是双面重审计与合法复用登记，不是 human 面还没接线。
    - 把 `对象级 L3/L4` 收紧为 `L3 object-complete / L4 pending`，明确当前主要剩余已经上升到 family 级 `L4` 与最终 completion audit。
    - 补一条显式阅读说明：当前不能说“规则都实施完了”，但也不能再说“技能要整套重录”；更准确的是实现层已大幅落地、审计 verdict 仍未封版，因此 `implementation_in_progress` 继续保留。
  - `task_plan.md`
    - 新增一条当前笔记，固定上述完成判定口径，避免后续继续把双面 remaining 写回“human 面尚未实现”。
- 当前边界：
  - 这一步没有新增运行时代码，也没有把审计结论推进到“已全面完成”。
  - 当前更准确的结论是：规则实现层面已经明显超过“待重录”，但双面 face-by-face completion audit、状态 family、奖励骰 family 与最终移除 `implementation_in_progress` 的门禁仍未收口。

## 2026-06-06 intake 尾段真实入口已补齐最新权威结果，火药桶转交 E2E 旧等待口径已修正

- 收口对象：
  - `走跳板`
  - `做好标记`
  - `弯刀突刺`
  - `诅咒金币`
  - `火药桶`
  - `咒缚`
  - `无情诅咒`
  - `地毯式轰炸 II`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 修正 `playPowderKegUpkeepTransfer(...)` 的开场等待口径：删除“先回到空白 discard 态”的旧预期，改为直接等待当前真实合同里的 `upkeep + simple-choice + currentChoiceSourceAbilityId=upkeep-powder-keg`。
    - 根因不是运行时回退，而是此前已经修过 `flowHooks.ts` 的自动推进门禁后，E2E helper 仍保留旧时序假设，误把正确停在 `upkeep` 的转交选择窗当成失败。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts --configLoader native`
    - `8 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在 human-cursed 无诅咒金币时于回合结束翻回咒缚面"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts --grep "真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支|真实入口应通过人类面 chi 槽位触发并结算做好标记的奖励骰与诅咒金币链|真实入口应通过人类面 fist 槽位触发并结算弯刀突刺的四同值火药桶链"`
    - `3 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts --grep "真实入口应展示并结算诅咒金币的维持阶段掉血链|真实入口应展示并结算火药桶的维持阶段爆炸链|真实入口应展示并结算火药桶维持阶段投 6 后的转交链|真实入口应展示并结算火药桶转交给已持有者时的原桶爆炸链|真实入口应展示并结算咒缚的维持阶段自伤链"`
    - 首轮结果：`3 passed / 2 failed`
    - 修 helper 后复跑 `火药桶维持阶段投 6 后的转交链|火药桶转交给已持有者时的原桶爆炸链`：`2 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts --grep "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家|4 人真实入口应展示并结算地毯式轰炸的双敌目标链"`
    - `2 passed`
- 当前边界：
  - 这一步证明此前 30 分钟 full-file intake 长跑未覆盖完的尾段，现在已经被按权威分段补齐；其中唯一打出的真实红灯是两条 `火药桶` 转交 E2E 的旧等待口径，已修复并复绿。
  - 当前仍不能据此宣称整派系完成；剩余继续保持为双面 completion audit、family 级 `L4` 合法复用登记，以及最终是否允许移除 `implementation_in_progress`。

## 2026-06-06 human 面判决指令 / 无情劫掠续结回归已收口，但整派系仍未完成

- 收口对象：
  - `判决指令`
  - `无情劫掠`
- 代码动作：
  - `src/games/dicethrone/domain/customActions/cursed_pirate.ts`
    - 修正 `HUMAN_MERCILESS_PLUNDER_CHOICE_ID` 的 choiceEffect：`自得 2 个诅咒金币` 不再错误依赖 `pendingAttack` 仍然存在；现在即使 direct `postDamage` seam 里攻击链已收口，仍会正确加币。
    - 同时仅在当前 `pendingAttack.sourceAbilityId` 仍匹配 `merciless-plunder` 时，才补 `bonusDiceResolved=true`，避免把“加币”与“攻击链收口标记”绑成一个前置条件。
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 修正 `human 面判决指令在多人局选择诅咒金币后仍应命中原防守方` 的断言口径：4 人 `2v2` 下 `P2` 与 `P4` 共享队伍血量，因此应断言队伍血量同步掉 `7`，而不是错误要求 `P2` HP 不变。
    - 保留真正锁原防守方的状态断言：`P2` 不获得 `休战`，`P4` 获得 `休战`。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面判决指令|human 面无情劫掠" --configLoader native`
    - `7 passed`
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
    - `68 passed`
- 当前边界：
  - 这一步收掉的是 human 面两条续结链的最新机制回归，不等于 `cursed_pirate` 或整派系规则已全部实施完。
  - 当前剩余仍是双面 completion audit、family 级 `L4` 合法复用登记，以及最终是否允许移除 `implementation_in_progress`。

## 2026-06-06 火药桶维持转交链已补齐，但整派系仍未收口

- 收口对象：
  - `火药桶`
  - `人类面板` 运行时接线口径
- 代码动作：
  - `src/games/dicethrone/domain/flowHooks.ts`
    - 给 `upkeep/income` 的自动继续补齐阻塞门禁：当前存在 `interaction.current / responseWindow.current / pendingDamage / 奖励骰结算` 时，不再把火药桶维持阶段的转交交互自动踩过去。
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 新增回归：`火药桶维持投骰 6 生成转交交互时，upkeep 不应自动继续推进`。
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 修正 `setupPowderKegUpkeepScenario(...)` 与转交流程 helper，使真实入口断言对齐当前交互结构与自动推进时序。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "火药桶维持投骰 6 时可选择任意玩家并能转交给其他玩家|火药桶维持投骰 6 生成转交交互时，upkeep 不应自动继续推进|新收到火药桶时若已拥有火药桶，原火药桶立即爆炸并保留新火药桶" --configLoader native`
    - `3 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶维持阶段投 6 后的转交链"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶转交给已持有者时的原桶爆炸链"`
    - `1 passed`
- 当前边界：
  - 这一步收掉的是“火药桶 upkeep 转交真实链未闭合”的旧 blocker，不等于 `cursed_pirate` 或整派系规则已全部实施完。
  - `public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png` 对应的人类面底图仍已接入正式运行时；但这不等于 human 面可跳过逐槽 completion audit。
  - 当前更准确的口径不是“技能要整套从零重录”，而是继续做双面逐槽重核、family 级 `L4` 合法复用登记与最终 completion audit。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 战术家升级次级分支已补齐对象级真实入口

- 收口对象：
  - `战略转移 II（侦察）`
  - `摇鼓运动 II（间接接敌）`
  - `开拓战场 II（全面封锁）`
- 验证：
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移 II 的侦察分支"`
    - `3 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的间接接敌分支"`
    - `3 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场 II 的全面封锁分支"`
    - `3 passed`
- 新增证据：
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算战略转移-II-的侦察分支/207-host-strategic-shift-2-recon-entry.png`
  - `.../208-host-strategic-shift-2-recon-choice.png`
  - `.../209-host-strategic-shift-2-recon-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算摇鼓运动-II-的间接接敌分支/210-host-drum-movement-2-indirect-entry.png`
  - `.../211-host-drum-movement-2-indirect-choice.png`
  - `.../212-host-drum-movement-2-indirect-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算开拓战场-II-的全面封锁分支/213-host-expand-battlefield-2-lockdown-entry.png`
  - `.../214-host-expand-battlefield-2-lockdown-choice.png`
  - `.../215-host-expand-battlefield-2-lockdown-applied.png`
- 当前边界：
  - 这一步收掉的是“`战略转移 II / 摇鼓运动 II / 开拓战场 II` 次级分支只有 L2、是否需要独立 L3 未知”的旧口径。
  - 当前不能据此宣称战术家或整派系完成；剩余项继续回到升级/变体 family 的 `L4` 合法复用登记、双面 completion audit 与最终收口审计。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 海盗的一生已补齐双面对象级真实入口

- 收口对象：
  - `海盗的一生`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setupPiratesLifeScenario(...)`，把 `海盗的一生` 的真实手牌入口固定到两张面各自的正式业务位点，而不是继续只靠机制测试推断。
    - 新增两条定向 direct E2E：
      - `真实入口应展示并结算海盗的一生在咒缚面的治疗分支`
      - `真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链`
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算海盗的一生在咒缚面的治疗分支"`
    - `1 passed`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链"`
    - `1 passed`
- 新增证据：
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算海盗的一生在咒缚面的治疗分支/210-guest-pirates-life-cursed-before-play.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算海盗的一生在咒缚面的治疗分支/211-guest-pirates-life-cursed-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链/212-guest-pirates-life-normal-before-play.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链/213-guest-pirates-life-normal-choice.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算海盗的一生在普通面的诅咒金币选择链/214-guest-pirates-life-normal-applied.png`
- 当前边界：
  - 这一步收掉的是 `海盗的一生` 仍只停在 `L2` 的旧口径；现在它已经拿到双面对象级 `L3` 真实入口。
  - 当前仍不能据此宣称咒缚海盗或整派系完成；剩余项继续回到双面 completion audit、状态/手牌 family 的 `L4` 合法复用登记，以及最终收口审计。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 清理战术家 / 咒缚海盗前台假未完成文案

- 收口对象：
  - `战术优势`
  - `战争贩子`
  - `反制措施`
  - `制胜高地`
  - `灵魂突刺`
  - `咒缚`
  - `深海潜行`
  - `亡灵之爪`
  - `你还嫩了点`
  - `无情诅咒`
- 代码动作：
  - `public/locales/zh-CN/game-dicethrone.json`
    - 移除战术家 `战术优势 / 战争贩子 / 反制措施 / 制胜高地` 描述里的“仍在实施中”尾注。
    - 同步把摘要描述收紧到当前真实合同，补上 `战术优势` 的 `1CP` 主动动作、`战争贩子` 的额外进攻投掷阶段、`反制措施` 的精确防御结算口径。
  - `public/locales/en/game-dicethrone.json`
    - 移除战术家与咒缚海盗对应对象里的 `still in progress` / `still being implemented` 尾注。
    - 同步把英文描述收紧到当前真实合同，覆盖 `high-ground / soul-stab / cursed / deep-sea-dive / undead-claw / still-wet-behind-ears / merciless-curse` 等已落地对象。
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 修正一处残留的旧整跑口径，把 `60 passed / 0 failed` 收紧为 `71 passed / 0 failed`。
- 验证：
  - `rg -n '实施中|still in progress|still being implemented' public/locales/zh-CN/game-dicethrone.json public/locales/en/game-dicethrone.json`
    - 无命中；说明这两个新英雄当前前台 locale 不再残留“已实现对象仍被标成实施中”的假红。
  - `npm run i18n:check`
    - 未通过，但阻塞点与当前派系无关：现有仓库缺一组新游戏 lobby key（`zh-CN`、`en` 都缺），属于独立 i18n 缺口，不是本轮 DiceThrone 文案改动引入。
- 当前边界：
  - 这一步收掉的是“前台仍把已实现对象误报成半成品”的文案层假 blocker，不等于战术家 / 咒缚海盗整批已完成。
  - `implementation_in_progress` 继续保留；真实剩余项仍是双面 completion audit、family 级 `L4` 合法复用登记、逐对象更高层级 `L3/L4` 与最终收口审计。

## 2026-06-06 战术家基础进攻参数链已全部补到对象级真实入口

- 收口对象：
  - `战略转移`
  - `摇鼓运动`
  - `开拓战场`
  - `包夹侧翼`
- 代码/验证动作：
  - 在 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 中补齐 3 条新的基础版真实入口用例：
    - `真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支`
    - `真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支`
    - `真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支`
  - 结合既有基础版 `战略转移`，重新单跑当前仓库现状：
    - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算战略转移的基础主分支"`
    - `1 passed`
    - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支"`
    - `1 passed`
    - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支"`
    - `1 passed`
    - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支"`
    - `1 passed`
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
- 新增证据：
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算战略转移的基础主分支/163-host-strategic-shift-entry.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算战略转移的基础主分支/164-host-strategic-shift-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支/165-host-drum-movement-entry.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算摇鼓运动的基础主分支/167-host-drum-movement-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支/168-host-expand-battlefield-entry.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算开拓战场的基础主分支/170-host-expand-battlefield-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支/171-host-flanking-entry.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应通过玩家板槽位触发并结算包夹侧翼的基础主分支/173-host-flanking-applied.png`
- 当前边界：
  - 这一步收掉的是“战术家基础进攻参数链 4 条对象仍只靠兄弟对象/共享链外推”的旧 blocker。
  - 当前可以把战术家基础进攻参数链从 remaining shared-only bucket 中移出，但这不等于整英雄完成；后续剩余项继续回到双面对象级重审计、remaining representative 条目的逐对象 L3/L4，以及最终 completion audit。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 咒缚海盗双面面板对象已收紧到 18/18 对象级 L3 直证

- 收口范围：
  - human 面 `9 / 9`
  - 咒缚面 `9 / 9`
- 文档动作：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 把 human 面 `弯刀突刺 / 做好标记 / 走跳板 / 点燃炸药 / 判决指令 / 惊魂动魄 / human-cursed / 嘿，老兄 / 无情劫掠` 的结论从 `representative` 收紧为对象级 `L2/L3`
    - 把咒缚面 `你还嫩了点` 也按截图 `22-23` 收紧为对象级 `L2/L3`
    - 新增“双面面板对象级 completion 表（2026-06-06）”，明确 human 面与咒缚面都已达到 `9 / 9` 对象级 L3 直证
- 当前边界：
  - 这一步收掉的是“咒缚海盗双面总审计还缺统一面板对象直证矩阵”的旧 blocker。
  - 当前不能据此宣称咒缚海盗双面已彻底完成；剩余项已收窄为状态家族、手牌家族、通用牌索引与合法复用登记的更高层 L4 / completion audit。
  - `implementation_in_progress` 继续保留。

## 2026-06-06 补齐送你们去喂鱼与无情诅咒的真实入口否定路径

- 收口对象：
  - `送你们去喂鱼`
  - `无情诅咒`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 在既有 `真实入口应展示并结算战略防御与送你们去喂鱼的交互 UI` 用例里补 `送你们去喂鱼` 的 skip 分支：有合法目标 `P1` 时显式点击 `不施加火药桶`，并断言 Host / Guest 都不新增火药桶。
    - 在既有 `4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家` 用例里补 `无情诅咒` 的 skip 分支：attacker 选敌后显式点击 `不施加火药桶`，并断言 `P2 / P4` 都不新增火药桶。
    - 修正 `无情诅咒` 第二段验证夹具，重置 `P2 / P4` 的旧火药桶状态，避免把前半段正向落桶残留误判成 skip 失败。
- 验证：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战略防御与送你们去喂鱼的交互 UI"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`
    - 首次失败定位为测试夹具残留，不是业务 skip 语义失效；清空 `P2 / P4` 旧状态后复跑 `1 passed`
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
- 新增证据：
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算战略防御与送你们去喂鱼的交互-UI/159-guest-go-fish-skip-choice.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/真实入口应展示并结算战略防御与送你们去喂鱼的交互-UI/160-guest-go-fish-skip-applied.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/4-人真实入口应先进入-targetingRoll，并按-5-6-把无情诅咒的目标选择权交给正确玩家/161-four-player-merciless-curse-skip-choice.png`
  - `test-results/evidence-screenshots/dicethrone/zhanshujia-cursed-pirate-intake.e2e/4-人真实入口应先进入-targetingRoll，并按-5-6-把无情诅咒的目标选择权交给正确玩家/162-four-player-merciless-curse-skip-applied.png`
- 当前边界：
  - 这一步收掉的是“可选 / 至多”对象只验了正向、不足以证明能合法跳过的 completion audit 缺口。
  - 当前不能据此宣称整英雄完成；`implementation_in_progress` 继续保留。
  - 下一步重点回到双面对象级重审计、remaining representative 条目的逐对象 L3/L4，以及哪些共享链可以合法复用、哪些必须继续补对象级直证。

## 2026-06-06 Intake 整跑已更新为 71 passed / 0 failed

- 最新权威验证：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - `71 passed / 0 failed`
- 旧口径失效：
  - 先前文档里把整份 intake 记成 `57/3`、`59/1`、`39 passed`、`60 passed / 0 failed`，或“当前仍缺 soak 稳定整跑证据”，现在都已经过时，不能继续作为当前 blocker。
- 本轮收掉的真实根因：
  - `休战` 的旧红灯不是“文案已写但行为未测”，而是真实机制链有 bug：`flowHooks.ts` 之前会在 `offensiveRoll -> defensiveRoll` 过早移除 `PARLEY`，`tokenResponse.ts` 的 `finalizeTokenResponse(...)` 又没把 `damageScope` 继续传下去，导致某些真实攻击伤害不会被 `休战` 正确拦住。现已修正 `flowHooks.ts / tokenResponse.ts / reduceCombat.ts`，并新增机制测试 `休战也会阻止 Token 响应收口后落地的攻击伤害事件`、`休战在攻击已发起时不会于 offensiveRoll -> defensiveRoll 提前移除`，以及真实生命周期 E2E `174-176`。
  - `紧缚` 长跑失败不是领域逻辑本体错，而是额外重掷场景没固定盘面，偶发误掷进攻击链；现已显式喂不会命中能力的盘面，并继续按服务器权威状态断言阶段退出与状态清理。
  - `虚张声势` 的最终稳定解不再是继续猜 page harness，而是改走 `sys.tutorial.randomPolicy` 的状态级 deterministic 随机控制，稳定锁住弯刀 / 战利品 / 骷髅三分支。
  - `军刀突刺` 基础链旧断言 `Guest HP 44` 也已校正回权威值 `46`。
- 当前边界：
  - 这说明 intake E2E 这一层当前全绿。
  - 这不等于“规则都实施完”或“整英雄已完成”；`implementation_in_progress` 继续保留。
  - 剩余项已收窄为双面 completion audit、family 级 L4 合法复用登记、逐对象更高层级 L3/L4，以及是否允许移除实施中徽标的最终收口审计。
- 人类面板现状：
  - `public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png` 已对应到运行时 `human-player-board.png/.webp`，`ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')` 仍指向这张 normal/human 面底图。
  - 但这只说明底图接线不是 blocker 了；只要人类面图面合同有新增或修订，就仍需按 human 面 9 个对象逐槽重录核对并回写 evidence，不能因为底图已接入运行时，就跳过技能重录与双面总审计。

## 2026-06-04 补齐咒缚面死亡吐息的独立真实入口链

- 收口对象：
  - `死亡吐息`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 把 `setupBreathOfDeathScenario(...)` 的测试夹具盘面从误写的 `[1,2,3,5,6]` 修正为真实小顺子 `[1,2,3,4,6]`
- 验证：
  - `BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=900000 BG_HEAVY_WAIT_POLL_MS=5000 node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过咒缚面 combo 槽位触发并结算死亡吐息的小顺子多状态链"`
    - `1 passed`
- 当前边界：
  - 这一步说明 `死亡吐息` 旧红根因不是业务未实现，而是 E2E 场景把“小顺子”错误注成了非顺子盘面
  - `死亡吐息` 现在已从“仅 representative L3 / 待 CPU 回落补证”推进为独立 direct E2E
  - 这不等于“该派系彻底完成”；`implementation_in_progress` 继续保留，剩余项回到双面对象级重审计、remaining representative 条目的逐对象 L3/L4 与整体 soak 稳定性

## 2026-06-04 补齐咒缚海盗 human 面剩余 3 个对象

- 收口对象：
  - `点燃炸药`
  - `判决指令`
  - `无情劫掠`
- 代码动作：
  - `src/games/dicethrone/heroes/cursed_pirate/abilities.ts`
    - `点燃炸药` 的两段伤害显式补 `timing: 'preDefense'`
    - `判决指令 / 无情劫掠` 改为本地 custom action continuation
  - `src/games/dicethrone/domain/customActions/cursed_pirate.ts`
    - 新增 human 面 `判决指令 / 无情劫掠` 的 choice 请求与 `CHOICE_RESOLVED` continuation
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`
    - 把两条对象测试对齐到真实时序：`判决指令` 选择后继续结算，`无情劫掠` 先 `withDamage` 再 `postDamage`
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面点燃炸药|human 面判决指令|human 面无情劫掠" --configLoader native`
    - `1 file / 3 passed`
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/ninja-slash-stand-tall-regression.test.ts --configLoader native`
    - `3 files / 67 passed`
  - `npx tsc -p tsconfig.json --noEmit`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 ultimate 槽位触发并结算无情劫掠的诅咒金币续结链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lightning 槽位触发并结算判决指令的诅咒金币选择链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 combo 槽位触发并结算点燃炸药的小顺子链"`
    - `1 passed`（首次执行命中过 `.tmp/e2e-preflight-cache.json` 的 `EBUSY`，重跑后通过；不是业务红灯）
- 当前边界：
  - 这一步说明 human 面剩余 3 个对象的运行时缺口已补齐，且 `点燃炸药 / 判决指令 / 无情劫掠` 都已补回独立真实入口 direct E2E，不等于“该派系彻底完成”
  - `implementation_in_progress` 继续保留
  - 你新增的人类面板素材已进入 `human-player-board.png/.webp` 运行时链路；下一步优先级回到 human 面图面合同逐槽补记、对象级彻底审计、shared / representative 条目的合法复用登记，以及复杂交互逐项 L3/L4

## 2026-06-04 补齐咒缚面灵魂突刺 / 灵魂指令的独立真实入口链

- 收口对象：
  - `灵魂突刺`
  - `灵魂指令`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setupSoulCommandScenario(...)`
    - 新增用例 `真实入口应通过咒缚面 lightning 槽位触发并结算灵魂指令的多状态不可防御链`
    - 既有 `灵魂突刺` direct E2E 已作为对象级独立证据回写进审计口径
- 验证：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过咒缚面 fist 槽位触发并结算灵魂突刺的三同值火药桶链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过咒缚面 lightning 槽位触发并结算灵魂指令的多状态不可防御链"`
    - `1 passed`
- 当前边界：
  - 这一步把 `灵魂突刺 / 灵魂指令` 从“仍只到 representative L3”的旧口径推进成了独立 direct E2E
  - 这不等于咒缚面已彻底完成；剩余项仍是双面对象级重审计、其余对象逐项 L3/L4 与 soak 稳定性
  - `implementation_in_progress` 继续保留

## 2026-06-05 收紧咒缚海盗规则表与 representative 清单

- 收口对象：
  - `瞭望台`
  - `死亡印记`
  - `咒缚`
  - `深海潜行`
  - `亡灵之爪`
  - `无情诅咒`
- 文档动作：
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
    - 把 `瞭望台` 的 `真实 UI/E2E 展示待补` 改成已由截图 `13-17` 覆盖弯刀查看手牌、战利品自选弃牌与骷髅随机弃牌三分支
  - `src/games/dicethrone/rule/咒缚海盗真相源表.md`
    - 把 `未纳入范围` 中过时的咒缚面对象 representative 示例替换为当前仍主要停在 representative 的条目
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 把 `死亡印记 / 咒缚 / 深海潜行 / 亡灵之爪 / 无情诅咒` 从 `L2/L3 representative` 收紧为已有对象级真实入口证据的 `L2/L3 | passed`
- 当前边界：
  - 这一步收掉的是文档滞后和 representative 清单漂移，不是新增业务机制实现
  - `implementation_in_progress` 继续保留
  - 当前剩余 representative 更准确地收窄为 `你还嫩了点 / 起锚 / 诅咒卡牌 / 封舱 / 虚张声势 / 坏血病 / 劫掠 / 休战` 及其它尚未逐对象 L3/L4 或合法复用登记的条目

## 2026-06-05 补齐起锚的默认抽牌分支真实入口链

- 收口对象：
  - `起锚`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `playWeighAnchorUntilDraw(...)`
    - 新增用例 `真实入口应命中并结算起锚的默认抽牌分支`
    - 通过 `setHarnessRandomQueue(...repeatRandomValue(0.0, 8))` 稳定命中非骷髅默认分支
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算起锚的默认抽牌分支"`
    - `1 passed`
- 当前边界：
  - 这一步把 `起锚` 从“只拿到骷髅代表分支”推进成了“骷髅施加休战 + 非骷髅默认抽牌”双分支真实入口证据
  - 这不等于该派系彻底完成；`implementation_in_progress` 继续保留
  - 当前剩余 representative 可继续收窄到 `你还嫩了点 / 诅咒卡牌 / 封舱 / 虚张声势 / 坏血病 / 劫掠 / 休战` 及其它尚未逐对象 L3/L4 或合法复用登记的条目

## 2026-06-05 补齐诅咒卡牌剩余两条真实入口分支

- 收口对象：
  - `诅咒卡牌`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增用例 `真实入口应展示并结算诅咒卡牌的抽 1 张牌分支`
    - 新增用例 `真实入口应展示并结算诅咒卡牌的受 2 伤害抽 2 分支`
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的抽 1 张牌分支"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的受 2 伤害抽 2 分支"`
    - `1 passed`
- 当前边界：
  - 这一步把 `诅咒卡牌` 从“只有受 4 抽 3 一条代表分支”推进成了“抽 1 / 受 2 抽 2 / 受 4 抽 3”三分支真实入口证据
  - 这不等于该派系彻底完成；`implementation_in_progress` 继续保留
  - 当前剩余 representative 可继续收窄到 `你还嫩了点 / 封舱 / 虚张声势 / 坏血病 / 劫掠 / 休战` 及其它尚未逐对象 L3/L4 或合法复用登记的条目

## 2026-06-05 收紧虚张声势的真实入口奖励骰控制层

- 收口对象：
  - `虚张声势`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setHarnessDiceValues(...)`
    - 把 `playBlusterUntilCutlass / playBlusterUntilLoot / playBlusterUntilSkull` 都从猜测 `setHarnessRandomQueue(...)` 改成显式 `harness.dice.setValues([1/4/6])`
    - 给三条 helper 都补了 `rolledFaces` 失败信息，便于下次直接看到实际命中的骰面序列
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的骷髅施加火药桶分支"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的弯刀分支"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并结算虚张声势的战利品抽 2 分支"`
    - `1 passed`
- 当前边界：
  - 这一步确认旧 blocker 不是业务未实现，而是 `虚张声势` 奖励骰更适合用显式 `dice.setValues` 控制而不是继续猜测随机队列
  - 后续顺跑已确认弯刀 / 战利品两条旧链都未被 helper 改法带坏；配合骷髅新链，`虚张声势` 当前三分支都已有真实入口证据
  - `虚张声势` 已可从 remaining representative 正式移出；继续结合对象审计复核后，`你还嫩了点 / 封舱 / 坏血病 / 劫掠 / 休战` 也都已有合法 representative L3 依据
  - 当前真实剩余项不再是这几条对象链，而是双面对象级重审计、对象级更高层级 L3/L4 深度与整份 intake 的 soak 稳定性；`implementation_in_progress` 继续保留

## 2026-06-05 修正深海潜行真实入口用例的双面口径

- 收口对象：
  - `深海潜行`
  - `走跳板`
  - `human-cursed`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 把 `setupDeepSeaDiveAttackScenario(...)` 改成显式把 Guest 切到咒缚面：写入 `playerBoardFace: 'cursed'`，并同步注入 `getCharacterAbilitiesForFace('cursed_pirate', 'cursed')`
    - 不再让这条用例沿用 human 面默认能力集去断言 `lotus=deep-sea-dive`
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应在 human-cursed 无诅咒金币时于回合结束翻回咒缚面"`
    - `1 passed`
- 当前边界：
  - 这一步证明此前把整份 soak blocker 归因到 `MatchRoom` 白屏已经过时；当前最小进房诊断与首条真实在线入口都能通过，实际打出来的业务红灯是 `深海潜行` 用例场景仍停在 human 面，却去断言咒缚面 `lotus=deep-sea-dive`
  - 修正后，`深海潜行 / 走跳板 / human-cursed` 这组三条双面链路重新对齐当前真相源：human 面 `lotus=走跳板`，咒缚面 `lotus=深海潜行`
  - 整份 intake 长跑仍缺稳定 soak 证据；本轮重新整跑已推进到后半段 human 面对象链，未再在旧 `深海潜行` 位点掉红，但单次长跑超过当前命令窗口，故暂仍记为 soak 风险而非新业务 blocker

## 2026-06-05 补齐咒缚海盗 human 面技能中文正式文案

- 收口对象：
  - `弯刀突刺`
  - `做好标记`
  - `human-cursed`
  - `走跳板`
  - `点燃炸药`
  - `判决指令`
  - `惊魂动魄`
  - `你还嫩了点`
  - `无情劫掠！`
- 代码动作：
  - `public/locales/zh-CN/game-dicethrone.json`
    - 把 9 条 human 面技能描述从“待正式录入：当前仅接入名称与槽位映射”占位，改成与当前运行时/规则真相源一致的正式中文描述
- 当前边界：
  - 这一步收掉的是前台中文展示层与运行时/规则文档之间的口径不一致，不是新增业务机制实现
  - `implementation_in_progress` 继续保留
  - 当前剩余项仍是双面对象级重审计、逐对象更高层级 L3/L4 与整体 soak 稳定性，而不是 human 面技能仍未正式录入

## 2026-06-05 清理咒缚海盗咒缚面与双面分支的假未完成标记

- 收口对象：
  - `灵魂突刺`
  - `咒缚`
  - `深海潜行`
  - `亡灵之爪`
  - `你还嫩了点`
  - `无情诅咒`
  - `海盗的一生`
  - `HeroState.playerBoardFace` 注释
- 代码动作：
  - `public/locales/zh-CN/game-dicethrone.json`
    - 移除上述咒缚面对象描述里的“仍在实施中”尾注，改成与当前真实实现一致的正式中文文案
  - `src/games/dicethrone/heroes/cursed_pirate/abilities.ts`
    - `咒缚` 被动描述不再保留“回合级追踪待机制收口”
  - `src/games/dicethrone/heroes/cursed_pirate/cards.ts`
    - `海盗的一生` 说明改成当前正式双分支：普通面获得 1 个诅咒金币，咒缚面治疗 3
  - `src/games/dicethrone/domain/core-types.ts`
    - `playerBoardFace` 注释改为当前已落地消费点，不再保留“仅部分效果按该字段分支”的旧口径
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "咒缚在对手进攻投掷阶段未发起攻击时对其施加火药桶|海盗的一生在咒缚面治疗 3 而不是获得诅咒金币|海盗的一生在普通面保留获得 1 诅咒金币选择分支" --configLoader native`
    - `1 file / 3 passed`
  - `npm run i18n:check`
    - 通过（仅剩仓库既有 3 条 warning）
- 当前边界：
  - 这一步清掉的是“已实现对象仍被 locale / 注释表述成未完成”的假 blocker，不是新增业务机制实现
  - `implementation_in_progress` 继续保留
  - 当前剩余项仍是双面对象级重审计、逐对象更高层级 L3/L4 与整份 intake 的 soak 稳定性

## 2026-06-05 补齐坏血病 / 强取豪夺 / 停战协议的独立真实入口链

- 收口对象：
  - `坏血病`
  - `强取豪夺`
  - `停战协议`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `SCURVY_CARD_ID / PILLAGE_CARD_ID / PARLEY_CARD_ID`
    - 新增 `setupSimpleCursedPirateMainCardScenario(...)`
    - 新增 3 条真实入口用例：
      - `真实入口应展示并结算坏血病的自伤加凋零链`
      - `真实入口应展示并结算强取豪夺的偷取 CP 链`
      - `真实入口应展示并结算停战协议的单目标休战链`
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算强取豪夺的偷取 CP 链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算停战协议的单目标休战链"`
    - `1 passed`
  - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算坏血病的自伤加凋零链"`
    - `1 passed`
- 当前边界：
  - 这一步把 3 张此前只靠 shared / representative 推断的主阶段手牌，推进成了独立对象级真实入口证据
  - `implementation_in_progress` 继续保留
  - 当前剩余项仍是双面对象级重审计、剩余对象的更高层级 L3/L4，以及整份 intake 的 soak 稳定性

## 2026-06-04 收紧咒缚海盗双面图面合同与审计边界

- 收口对象：
  - `咒缚海盗真相源表`
  - `咒缚海盗录入核对`
  - `对象级审计`
- 文档动作：
  - `src/games/dicethrone/rule/咒缚海盗真相源表.md`
    - 把人类面 9 个对象仍待补证的旧口径改成“9 个对象均已补 L2 + 独立 direct E2E”
    - 新增咒缚面 / 人类面两套逐槽合同表
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
    - 为咒缚面补正式逐槽图面合同
    - 把 `死亡吐息` 从“L2 静态可结算”先收紧为“L2 + representative L3，独立 direct E2E 待补证”
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 把玩家板双面合同口径回写到对象审计
    - 把 `官方 human/normal 面完整实现` 的剩余项改成“双面重审计 + remaining representative 条目逐对象 L3/L4 + soak”，不再保留“自动翻面仍未证明”的过时说法
    - 当时明确 `死亡吐息` 的 direct E2E 测试体已写入，但尚未拿到有效运行结果
- 当前边界：
  - 这一步收掉的是“图面合同与审计口径还停在旧状态”的文档债，不是业务机制新增通过
  - 当时 `死亡吐息` 仍不能记成已拿到独立 direct E2E；该旧 blocker 现已解除，但这不改变这一步本身只是文档收紧
  - `implementation_in_progress` 继续保留

## 2026-06-04 补齐咒缚海盗 human 面最后 2 条 direct E2E

- 收口对象：
  - `做好标记`
  - `嘿，老兄`
- 代码动作：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 为 `做好标记 / 嘿，老兄` 补齐真实入口 direct E2E
    - 把 `做好标记` 的奖励骰断言从“`bonus-die-overlay` 必显”收紧为“以权威 settlement 为准，优先点击真实确认伤害按钮，否则走 `SKIP_BONUS_DICE_REROLL` 收口”
- 验证：
  - `PW_E2E_STANDARD_ENTRY=true PW_E2E_BOOTSTRAP_MODE=legacy-global-setup PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_SERVER_RUNTIME=prebuilt PW_PREBUILT_BUNDLE_ROOT=temp/dev-bundles/e2e-single PW_SERVER_WATCH=false BG_VITE_FORCE_INLINE=1 PW_ISOLATE_PORTS=true PW_WORKERS=1 PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts PW_E2E_TARGET=e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts node node_modules/playwright/cli.js test e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts --grep "真实入口应通过人类面 chi 槽位触发并结算做好标记的奖励骰与诅咒金币链"`
    - `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流触发并结算人类面嘿，老兄的防御链"`
    - `1 passed`
- 当前边界：
  - human 面 9 个对象现在都已拿到独立真实入口 direct E2E
  - 这不等于“该派系彻底完成”或“规则都实施了”
  - `implementation_in_progress` 继续保留
  - 后续优先级回到 human 面逐槽 completion audit、双面对象级重审计、逐对象 L3/L4 与整体 soak 稳定性

## Session: 2026-05-16 TDD 行为 seam 与测试结构重构

- **Status:** in_progress
- 2026-05-17 13:44 +08：继续处理 `expansionBaseAbilities.test.ts` 的混层问题，先抽出 `10th Anniversary bases`。
- 收口动作：
  - 新增 `src/games/smashup/__tests__/bases/anniversary-bases.test.ts`
  - 将 `base_mermaid_pool` / `base_ossuary` / `base_arena` / `base_hall_of_fame` 这 5 条 10th Anniversary 相关用例从 `expansionBaseAbilities.test.ts` 迁出
  - `expansionBaseAbilities.test.ts` 继续只保留 Cthulhu / AL9000 / Pretty Pretty / stale regression 的剩余内容
- 验证：
  - `npx vitest run src/games/smashup/__tests__/bases/anniversary-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `2 files / 50 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/anniversary-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 52, OK`
- 2026-05-17 13:36 +08：继续把 `scoreBases-auto-continue.test.ts` 里的泛 AI 枚举合同抽成独立文件 [ai-interaction-choice-enumeration.test.ts](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts:1>)。
- 收口动作：
  - 新增 `src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts`
  - 从 `scoreBases-auto-continue.test.ts` 中移出 5 条泛 AI 枚举用例：`optional multi`、`optional multi + skip`、`ordered multi`、`required empty live`、`exact multi`
  - 保留 `scoreBases-auto-continue.test.ts` 中真正与自动推进 / 计分阶段恢复 / AI 收尾相关的用例
- 验证：
  - `npx vitest run src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `2 files / 36 tests passed`
  - `npx eslint src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 49, OK`
- 2026-05-17 13:35 +08：继续收口 `afterscoring-window-skip-base-clear.test.ts`。复核后确认这不是单一文件边界，而是把延迟清场、替换后基地落点、链式最终化和 `scoreBases` 收尾门禁混在一个旧壳里。
- 收口动作：
  - 将 `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` 重命名为 `src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts`
  - 删除 `base_greenhouse` / `base_tortuga` 的重复 happy-path 入口
  - 删除 1 条重复的 `base_the_mothership` 用例与 1 条重复的海盗湾用例
  - 保留并集中真正的系统合同：`base_greenhouse` emergency-cancel、替换后基地 `baseDefId` 落点、`base_tortuga` session 收尾、`base_the_mothership` / `base_pirate_cove` 链式最终化、`base_temple_of_goju_tiebreak` finalize 语义，以及 `scoreBases` 收尾门禁
- 验证：
  - `npx vitest run src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts src/games/smashup/__tests__/scoreBases-flowHalted-recovery.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `3 files / 49 tests passed`
  - `npx eslint src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts src/games/smashup/__tests__/scoreBases-flowHalted-recovery.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 47, OK`
- 2026-05-17 13:09 +08：继续处理 `afterScoring-rescoring.test.ts` 的混层问题。复核后确认其中两条 `smashup_immediate_extra_minion` 测试并不属于 afterScoring 响应窗口，而是“立即额外打出”系统合同。
- 收口动作：
  - 从 `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 删除两条 `smashup_immediate_extra_minion` 用例
  - 在 `src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts` 新增同等合同的两条测试：额外随从推进基地选择、setaside 泰坦可作为随从打出
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts` -> `1 file / 6 tests passed`
  - `npx vitest run src/games/smashup/__tests__/afterScoring-rescoring.test.ts` -> `1 file / 6 tests passed`
  - `npx eslint src/games/smashup/__tests__/afterScoring-rescoring.test.ts src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 45, OK`
- 当前判断：
  - 这一步把“立即额外打出”从 afterScoring 响应窗口里抽出来了，减少了继续把时机与合同层混写的风险
- 2026-05-17 13:01 +08：继续处理 `turnTransitionInteractionBug.test.ts`，复核后确认它不是单一系统合同，而是两条不同系统链混在一起：`startTurn/base_rlyeh` 与 `scoreBases/base_tortuga`。
- 收口动作：
  - 删除 `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
  - 新增 `src/games/smashup/__tests__/startTurn-base-rlyeh-recovery.test.ts`
  - 新增 `src/games/smashup/__tests__/scoreBases-base-tortuga-recovery.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/startTurn-base-rlyeh-recovery.test.ts src/games/smashup/__tests__/scoreBases-base-tortuga-recovery.test.ts` -> `2 files / 2 tests passed`
  - `npx eslint src/games/smashup/__tests__/startTurn-base-rlyeh-recovery.test.ts src/games/smashup/__tests__/scoreBases-base-tortuga-recovery.test.ts` -> `0 errors`
  - `Test-Path`：`old_turn=False`，`new_rlyeh=True`，`new_tortuga=True`
  - `npm run test:structure -- --all` -> `checked files: 41, OK`
- 当前判断：
  - 这一步是实拆，不是改标题；原先一份 `bug` 文件里混着两条系统边界，现在已经分到两个正式入口
  - 接下来继续优先找“一个文件里混多个自然边界”的对象，而不是继续扫描单纯历史命名
- 2026-05-17 12:56 +08：继续处理剩余两个根目录 `bug` 命名候选：`multi-base-afterscoring-bug.test.ts` 与 `igor-rlyeh-double-trigger.test.ts`。
- 复核结论：
  - `multi-base-afterscoring-bug.test.ts` 不是重复壳，也不是单派系第二入口；它锁的是 `scoreBases` 在多基地同时计分时，遇到 `afterScoring / Me First!` 链式交互后的恢复语义。
  - `igor-rlyeh-double-trigger.test.ts` 也不是 `destroy-trigger-prompt-coexistence.test.ts` 的重复；它锁的是 `base_rlyeh onTurnStart -> destroy -> frankenstein_igor` 这条真实系统链的幂等性。
- 收口动作：
  - 将 `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` 重命名为 `src/games/smashup/__tests__/scoreBases-multi-base-chain-recovery.test.ts`
  - 将 `src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts` 重命名为 `src/games/smashup/__tests__/base-rlyeh-destroy-trigger-idempotency.test.ts`
  - 同步把两份文件头与 `describe` 改成正式系统合同表述，去掉一次性 bug 语义
- 验证：
  - `npx vitest run src/games/smashup/__tests__/scoreBases-multi-base-chain-recovery.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `2 files / 44 tests passed`
  - `npx vitest run src/games/smashup/__tests__/base-rlyeh-destroy-trigger-idempotency.test.ts src/games/smashup/__tests__/destroy-trigger-prompt-coexistence.test.ts src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` -> `3 files / 9 tests passed`
  - `npx eslint src/games/smashup/__tests__/scoreBases-multi-base-chain-recovery.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts src/games/smashup/__tests__/base-rlyeh-destroy-trigger-idempotency.test.ts src/games/smashup/__tests__/destroy-trigger-prompt-coexistence.test.ts src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` -> `0 errors`
  - `Test-Path`：`old_multi=False`，`new_multi=True`，`old_rlyeh=False`，`new_rlyeh=True`
  - `npm run test:structure -- --all` -> `checked files: 38, OK`
- 当前判断：
  - 这一步不是只改名字；两份文件都已经从“看起来像历史 bug 壳”收口成可继续承接系统回归的正式入口
  - 下一步应继续复核剩余根目录系统文件内部是否还混着不同自然边界，而不是机械追求继续删文件
- 2026-05-17 12:27 +08：继续清理根目录历史测试壳，先处理 `ninja-hidden-ninja-interaction-bug-repro.test.ts` 与 `pirate-cove-repeat-trigger-bug.test.ts`。
- 复核结论：
  - `ninja-hidden-ninja-interaction-bug-repro.test.ts` 不是新的行为入口，只是在另一套 `GameTestRunner` 夹具里重复“Me First! 窗口打出 `ninja_hidden_ninja` 后创建 prompt + 记录 `specialLimitUsed`”这条合同；现行 `ninja-hidden-ninja-interaction-bug.test.ts` 已覆盖。
  - `pirate-cove-repeat-trigger-bug.test.ts` 前两条只是 `base_pirate_cove` 的 afterScoring prompt 合同，已被 `baseAbilitiesPrompt.test.ts` 承接；第三条仍是空 `TODO`，不是有效资产。
- 收口动作：
  - 删除 `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts`
  - 删除 `src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts`
- 验证：
  - 删除前基线：`npx vitest run src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> `2 files / 2 tests passed`
  - 删除前基线：`npx vitest run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts` -> `2 files / 36 tests passed`
  - 删除前 eslint：4 个文件 `0 errors`
  - 删除后：`npx vitest run src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> `2 files / 34 tests passed`
  - 删除后 eslint：`npx eslint src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> `0 errors`
  - `Test-Path`：`ninja_repro=False`，`pirate_cove_bug=False`
  - `npm run test:structure -- --all` -> `checked files: 31, OK`
- 下一步：复核 `mothership-scout-afterscore-bug.test.ts` 是否真在保护“母舰 -> alien_scout_return -> 延迟清场/换基地”的链式顺序合同，避免把系统链测试误删成和前两份一样的壳。
- 2026-05-17 12:30 +08：继续处理 `mothership-scout-afterscore-bug.test.ts`。结论：它不是重复壳，不能按前两份的方式删除。
- 收口动作：
  - 将 `src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts` 重命名为 `src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts`
  - 文件头与 `describe` 同步改为“afterScoring 链式传递与延迟清场合同”，明确它锁的是系统顺序不变量，而不是某一条临时 bug 说明
- 验证：
  - `npx vitest run src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts` -> `1 file / 3 tests passed`
  - `npx eslint src/games/smashup/__tests__/afterScoring-chain-propagation.test.ts` -> `0 errors`
  - `Test-Path`：`old_mothership_bug=False`，`new_chain_file=True`
  - `npm run test:structure -- --all` -> `checked files: 32, OK`
- 当前判断：这一步不是只改标签。真实变化是把它从“根目录 bug 壳候选”收成了一个明确的系统合同入口，后续若再补 afterScoring 链式顺序回归，应优先进这个文件，而不是再造新的 `*-bug.test.ts`。
- 2026-05-17 12:35 +08：继续处理 `ninja-special-limit-fix.test.ts`。结论：这不是系统合同文件，而是忍者专项第二入口，且内容只是 `specialLimitGroup` 元数据合同。
- 收口动作：
  - 在 `src/games/smashup/__tests__/abilities/ninjas.test.ts` 的 `specialLimitGroup: 跨卡牌共享限制` 段补入 2 条元数据合同：
    - `ninja_shinobi / ninja_hidden_ninja / ninja_acolyte` 各自声明独立的 `specialLimitGroup`
    - 三者不再共享旧的 `ninja_special`
  - 删除 `src/games/smashup/__tests__/ninja-special-limit-fix.test.ts`
- 验证：
  - 删除前基线：`npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/ninja-special-limit-fix.test.ts` -> `2 files / 39 tests passed`
  - 删除后：`npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `1 file / 37 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `0 errors`
  - `Test-Path src\\games\\smashup\\__tests__\\ninja-special-limit-fix.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 32, OK`
- 2026-05-17 12:38 +08：继续处理 `alien-probe-bug.test.ts`。结论：它不是系统 bug 壳，而是 `alien_probe` 的公开行为矩阵，归宿应为 `abilities/aliens.test.ts`。
- 收口动作：
  - 在 `src/games/smashup/__tests__/abilities/aliens.test.ts` 新增 `alien_probe: 探究` 专项块，吸收 5 条合同：
    - 单对手展示整手牌并只允许选择随从
    - 只有 1 张可选随从时仍保留交互
    - 选中后对手弃掉对应随从
    - 对手无随从时直接结束并给出反馈
    - 多对手场景先选对手，再进入该对手手牌选择
  - 删除 `src/games/smashup/__tests__/alien-probe-bug.test.ts`
- 验证：
  - 删除前基线：`npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/alien-probe-bug.test.ts` -> `2 files / 16 tests passed`
  - 删除后：`npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts` -> `1 file / 16 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/aliens.test.ts` -> `0 errors`
  - `Test-Path src\\games\\smashup\\__tests__\\alien-probe-bug.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 33, OK`
- 2026-05-17 12:42 +08：继续处理 `afterscoring-timing-verification.test.ts` 与 `pirate-cove-chain-fix.test.ts`。
- 复核结论：
  - `afterscoring-timing-verification.test.ts` 只是占位壳，唯一断言是 `expect(true).toBe(true)`；它没有任何独立覆盖价值。
  - `pirate-cove-chain-fix.test.ts` 不是派系专项第二入口，而是在锁 `scoreBases / Me First! / afterScoring` 的阶段门禁链，所以不应删除，但也不该继续挂着某次 bug/fix 名字。
- 收口动作：
  - 删除 `src/games/smashup/__tests__/afterscoring-timing-verification.test.ts`
  - 将 `src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts` 重命名为 `src/games/smashup/__tests__/scoreBases-mefirst-window.test.ts`
  - 同步把文件头与 `describe` 改成 “scoreBases / Me First! 窗口门禁合同”
- 验证：
  - 覆盖对照：`npx vitest run src/games/smashup/__tests__/afterscoring-timing-verification.test.ts src/games/smashup/__tests__/afterScoring-rescoring.test.ts src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> `3 files / 24 tests passed`
  - 覆盖对照：`npx vitest run src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `2 files / 39 tests passed`
  - 删除/改名后：`npx vitest run src/games/smashup/__tests__/scoreBases-mefirst-window.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `2 files / 39 tests passed`
  - `npx eslint src/games/smashup/__tests__/scoreBases-mefirst-window.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> `0 errors`
  - `Test-Path`：`after_timing_verification=False`，`old_pirate_cove_chain_fix=False`，`new_scorebases_mefirst=True`
  - `npm run test:structure -- --all` -> `checked files: 34, OK`
- 2026-05-17 10:42 +08：继续处理 `src/games/smashup/__tests__/abilities/madness-mechanics.test.ts` 这个旧壳。复核结论：它不是一个自然机制边界，而是把跨派系 `extra timing` 合同、`Cthulhu / Miskatonic / Innsmouth` 业务行为、以及旧 helper/seam 混在一起。
- 收口动作：
  - 新增 `src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts`，承接 `cthulhu_whispers_in_darkness`、`miskatonic_those_meddling_kids_pod`、`innsmouth_recruitment` 的 `playTiming: immediate` 共享合同
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts` 吸收 `cthulhu_whispers_in_darkness`、`cthulhu_seal_is_broken`、`cthulhu_corruption`
  - `src/games/smashup/__tests__/abilities/miskatonic.test.ts` 吸收 `miskatonic_psychological_profiling`、`miskatonic_mandatory_reading`、精简后的 `miskatonic_lost_knowledge`
  - `src/games/smashup/__tests__/abilities/innsmouth.test.ts` 吸收 `innsmouth_recruitment`
  - 删除 `src/games/smashup/__tests__/abilities/madness-mechanics.test.ts`
- seam 收口说明：
  - 新迁移用例继续走真实 `PLAY_ACTION` / `runCommand(...)`
  - 真实 prompt facade：`getSimpleChoicePrompt`、`getPromptOption`、`respondToPromptOption(s)`
  - 真实 `finalState` / 业务事件断言
  - 不再保留旧 `postProcessSystemEvents(...)`、`lastMatchState`、手工后处理这类旧测试壳
- 最后一处红灯：
  - `cthulhu.test.ts` 的 `cthulhu_corruption` 用例第一次失败不是行为回归，而是新测试里调用了 `getPromptOption(...)` 却没 import
  - 补上 import 后单文件立即恢复为 `60 passed`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 60 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `4 files / 110 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `0 errors`
  - `Test-Path src\\games\\smashup\\__tests__\\abilities\\madness-mechanics.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 19, OK`
- 2026-05-17 09:29 +08：继续拆 `src/games/smashup/__tests__/baseFactionOngoing.test.ts`，先选最自然的 `机器人 ongoing` 段并回 [abilities/robots.test.ts]，同时把体量更小的 `wizard_archmage ongoing` 并回 [abilities/wizards.test.ts]。
- 机器人段处理：
  - 吸收 `机器人 ongoing 回归` 的 2 条 Archive 归属/双实例回归
  - 吸收 `robot_warbot` destroy 保护
  - 吸收 `robot_microbot_archive` 的微型机 / Alpha / remote / enemy / self 全套 ongoing 合同
  - 从 `baseFactionOngoing.test.ts` 删除整段机器人 ongoing
  - 迁移中首次红灯暴露真实问题不在实现，而在测试夹具：旧大文件默认给机器人玩家提供了牌库与机器人派系；迁到 `robots.test.ts` 改用通用 helper 后，玩家默认是 `pirates/aliens` 且牌库为空，所以 `Archive` 合法抽不到牌。现已在专项文件里显式补上 `makeRobotPlayer(...)`，把“机器人派系 + 非空牌库”从隐式前提改成显式前提。
- 巫师段处理：
  - 把 `wizard_archmage` 的 4 条 ongoing 时机测试并回 `src/games/smashup/__tests__/abilities/wizards.test.ts`
  - 从 `baseFactionOngoing.test.ts` 删除整段 `巫师 ongoing 能力`
  - 顺手清掉 `registerWizardAbilities` 的未使用 import
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `2 files / 95 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `2 files / 83 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 13, OK`
- 2026-05-17 09:20 +08：继续处理 `src/games/smashup/__tests__/onDestroyAbilities.test.ts`。判断结果：这不是稳定机制文件，而是“共享 onDestroy 基础设施 + 机器人 + 诡术师 + 一个弱熊骑兵回归”的混层旧入口。
- 收口动作：
  - 新增 `src/games/smashup/__tests__/abilities/on-destroy-mechanics.test.ts`，承接 `onDestroy 基础设施`
  - `src/games/smashup/__tests__/abilities/robots.test.ts` 吸收 `robot_nukebot` onDestroy 段
  - `src/games/smashup/__tests__/abilities/tricksters.test.ts` 吸收 `trickster_gremlin` / `trickster_gremlin_pod` onDestroy 段
  - 删除 `src/games/smashup/__tests__/onDestroyAbilities.test.ts`
  - 不迁移 `bear_cavalry_general_ivan destroy 保护` 那两条弱测试：其中一条依赖非法目标 payload，另一条断言的也不是有效的“无 Ivan 时正常 destroy”合同，继续搬只会把噪声复制进新文件
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/abilities/on-destroy-mechanics.test.ts` -> `3 files / 40 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/abilities/on-destroy-mechanics.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\onDestroyAbilities.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 11, OK`
- 2026-05-17 09:15 +08：继续处理 `elder-things` 的双入口，不再停在“根目录旧文件退场”。判断结果：`src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` 不是稳定的共享机制文件，它混着 Dunwich Horror 附着、Price of Power special、Elder Thing 保护/onPlay、Shoggoth 打出限制，实质上都属于远古之物派系自己的行为合同。
- 收口动作：
  - 把上述 5 组 `describe` 直接并入 `src/games/smashup/__tests__/abilities/elder-things.test.ts`
  - 删除 `src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `1 file / 41 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\abilities\\elder-things-ongoing.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 8, OK`
- 2026-05-17 08:45 +08：继续压 `src/games/smashup/__tests__/expansionOngoing.test.ts`，先把 `Steampunks` 整段并回现有专项 [abilities/steampunks.test.ts]，中途暴露一条真问题：`steampunk_difference_engine` 的“回合结束抽牌”用例和刚修完的 `water_lily` 一样，迁移后少了显式牌库前提，导致 `buildStandardDrawEvents(...)` 合法返回空事件。已在专项文件里为该用例补上显式 `deck`。
- 随后判断 `expansionOngoing.test.ts` 剩余内容已经只剩 `Innsmouth` + `Miskatonic`，没有保留旧聚合壳的价值，于是直接：
  - 新增 `src/games/smashup/__tests__/abilities/innsmouth.test.ts`
  - 新增 `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
  - 删除 `src/games/smashup/__tests__/expansionOngoing.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `3 files / 40 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `0 errors`
  - `Test-Path src\\games\\smashup\\__tests__\\expansionOngoing.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `OK`
- 2026-05-17 08:26 +08：继续收 `src/games/smashup/__tests__/expansionOngoing.test.ts` 已迁出的 `Killer Plants` 段，先修 `abilities/killer-plants.test.ts` 的 `killer_plant_water_lily` 3 条红灯。
- 定位结果：不是实现坏了，而是迁移后测试夹具变了。旧 `expansionOngoing.test.ts` 本地 `makeState(...)` 默认给玩家牌库放了牌；新文件改用共享 `helpers.makeState(...)` 后默认牌库为空，`buildStandardDrawEvents(...)` 因无牌可抽而合法返回空事件，所以只有“应该抽牌”的 3 条用例红，`非控制者回合不触发` 和“弃牌堆洗回后抽牌”仍绿。
- 修复动作：
  - 在 `src/games/smashup/__tests__/abilities/killer-plants.test.ts` 的 `killer_plant_water_lily` describe 内新增 `makeWaterLilyState(...)`，显式提供可抽牌牌库。
  - 让“控制者抽牌 / POD 抽牌 / 非控制者不触发 / 多张睡莲只触发一次 / 弃牌堆洗回后抽牌”都走同一行为前提构造，避免继续依赖旧本地 helper 的隐藏默认值。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> `2 files / 73 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 66, OK`
- 2026-05-17 07:53 +08：继续处理 `src/games/smashup/__tests__/expansionAbilities.test.ts` 的扩展包双入口问题，先收 `Ghost`。动作是把 `ghost_ghost / ghost_seance / ghost_shady_deal / ghost_ghostly_arrival` 全部并入现有 `src/games/smashup/__tests__/abilities/ghosts.test.ts`，并从 `expansionAbilities.test.ts` 删除整段幽灵派系业务测试。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `2 files / 40 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 61, OK`
  - `rg -n "幽灵派系能力|ghost_ghostly_arrival|ghost_shady_deal|ghost_seance" src/games/smashup/__tests__/expansionAbilities.test.ts` 只剩文件头注释，随后已同步清理
- 2026-05-17 07:47 +08：继续处理 shayu 第二层混装入口 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`。先复核文件边界：14 条用例同时混有鲨鱼、神话希腊、龙卷风与 3 个基地行为，不是共享机制文件，而是按扩展批次挂着的多派系/多基地混装入口。
- 拆分动作：
  - 鲨鱼 L2 行为并入 `src/games/smashup/__tests__/abilities/sharks.test.ts`
  - 龙卷风 L2 行为并入 `src/games/smashup/__tests__/abilities/tornados.test.ts`
  - 神话希腊 L2 行为并入 `src/games/smashup/__tests__/abilities/mythic-greeks.test.ts`
  - 基地行为拆到 `src/games/smashup/__tests__/bases/the-deep-base.test.ts`、`trailer-park-base.test.ts`、`tornado-alley-base.test.ts`
  - 删除 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/sharks.test.ts src/games/smashup/__tests__/abilities/tornados.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts src/games/smashup/__tests__/bases/the-deep-base.test.ts src/games/smashup/__tests__/bases/trailer-park-base.test.ts src/games/smashup/__tests__/bases/tornado-alley-base.test.ts` -> `6 files / 35 tests passed`
  - `npx eslint ...上述 6 个文件...` -> `0 errors`
  - `npm run test:structure -- --all` -> `checked files: 61, OK`
  - `Test-Path src\\games\\smashup\\__tests__\\shayuComprehensiveBehavior.test.ts` -> `False`
- 2026-05-17 07:40 +08：接手后先验证上一轮刚做的 `shayuFactionAbilities.test.ts` 拆分，再决定是否继续下刀。聚焦验证 `src/games/smashup/__tests__/abilities/sharks.test.ts`、`tornados.test.ts`、`mythic-greeks.test.ts` -> `3 files / 21 tests passed`；eslint 0 errors；`npm run test:structure -- --all` -> `checked files: 57, OK`；`Test-Path src\\games\\smashup\\__tests__\\shayuFactionAbilities.test.ts` -> `False`。
- 2026-05-16 21:41 +08：继续把“业务 prompt + stale 合同”从 direct handler 里拔出来。`src/games/smashup/__tests__/baseAbilityNeutralProtection.test.ts` 改为真实 `triggerBaseAbilityWithMS('base_mushroom_kingdom')` -> `base_mushroom_kingdom` prompt -> `respondToPromptOption(...)`，单文件 `2 passed`、eslint 0 errors，文件内命中归零；全仓统计从 `38` 降到 `36`。
- 同批把 `src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts` 改成真实 `base_rlyeh` prompt 响应链：先触发 `onTurnStart`，再选择 Igor，直接在 `finalState` 上统计 `frankenstein_igor` prompt 只出现一次。验证：单文件 `1 passed`、eslint 0 errors；全仓统计从 `36` 降到 `35`。
- 同批把 `src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` 的 Goju tie-break 响应从 `base_temple_of_goju_tiebreak` 直调改成真实 `triggerBaseAbility('base_temple_of_goju')` -> `respondToPromptOption(...)`。验证：单文件 `10 passed`、eslint 0 errors；全仓统计从 `35` 降到 `34`。
- 继续清理混层断言：`src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` 删除“`pirate_buccaneer_move` handler 已注册”这条冗余断言，注册存在性仍由 `abilityInteractionRegistry.test.ts` 承担。验证：整文件 `18 passed`、eslint 0 errors；全仓统计从 `34` 降到 `33`。
- 继续处理 `src/games/smashup/__tests__/smashup.smoke.test.ts`：删掉 `big_funny_giant` 的两条纯注册断言，保留 `abilityTags` 与真实行为链。验证：整文件 `133 passed`、eslint 0 errors；全仓统计从 `33` 降到 `31`。
- 2026-05-16 21:40 +08：`src/games/smashup/__tests__/buccaneer-pod-limit.test.ts` 两条 `pirate_buccaneer_move` stale/baseDefId 合同已改成真实 replacement prompt 响应：先通过 `fireTriggers(..., { phase: 'replacement' })` 产出 `pirate_buccaneer_move`，再在 stale core 上 `respondToPromptOption(...)`。中途第一次红灯暴露“prompt 前态必须保留随从仍在原基地，且断言应只看业务 `MINION_MOVED` 事件”；修正后单文件 `8 passed`、eslint 0 errors，文件内命中归零；全仓 direct handler / runtime prompt handler 统计从 `31` 降到 `29`。
- 结构门禁复跑：`npm run test:structure` -> `checked files: 17`，OK。当前剩余命中列表已收敛为：注册表合同 `abilityInteractionRegistry.test.ts`、系统合同 `promptSystem.test.ts` / `promptResponseChain.test.ts`、`steampunk_mechanic` runtime prompt 非法值合同、`base_greenhouse` scoring-session/stale 合同、`bear_cavalry_superiority_pod_talent` 低层 talent 合同、`titan_penguins_emperor_penguin_play` resolve-time 二次校验合同，以及 `pirate_first_mate_choose_base` stale/baseDefId 合同。
- 2026-05-16 21:26 +08：先收口 `src/games/smashup/__tests__/madnessAbilities.test.ts` 的半迁移残留。删除 `miskatonic_those_meddling_kids_pod_mode` 里两行遗留的 `getInteractionHandler(...)` 断言后，单文件重新验证 `32 passed`、eslint 0 errors，文件内 direct handler / runtime prompt handler 命中归零；全仓统计从 `42` 降到 `41`。
- 同批继续处理 `src/games/smashup/__tests__/baseProtection.test.ts` 里九命之屋三条业务测试。把 `base_nine_lives_intercept` 从 direct handler 改成真实 `resolveDestroyedMinions(...)` -> `base_nine_lives_intercept` prompt -> `respondToPromptOption(...)` 链，并额外覆盖“响应时目标 stale 不再移动旧目标”的真实二次校验。验证：整文件 `19 passed`、eslint 0 errors、文件内命中归零；全仓 direct handler / runtime prompt handler 统计进一步从 `41` 降到 `38`。
- 结构门禁复跑：`npm run test:structure` -> `checked files: 13`，OK。当前剩余命中更集中在注册表合同、runtime prompt 非法值合同、`pirate_buccaneer_move` / `base_greenhouse` / `base_temple_of_goju_tiebreak` 这类 stale/baseDefId/resolution 合同，而不是普通业务按钮响应。
- 2026-05-16 21:05 +08：继续收口 `baseFactionOngoing.test.ts` 的半成品 seam。先复核发现 `ninja_hidden_ninja consumesNormalLimit` 仍在用 fake prompt current；聚焦跑 `-t "consumesNormalLimit"` 时只有这 1 条红灯。修改为真实 `resolveAbility('ninja_hidden_ninja', 'special')` -> `getFirstPrompt(...)` -> `respondToPrompt(...)` 链后，聚焦验证 `5 passed`。
- 同批复跑整文件时暴露新的真实后效应：`trickster_brownie` 的“被控制权变化时会让对手弃两张牌”红灯。定位后确认不是 Brownie 行为坏了，而是本地 `triggerBrownieFromEvent(...)` helper 没对齐 reducer，漏传 `affectEvent + affectBatchTargets`；同时 `trickster_brownie` 在 `control_change` 语义上需要看 `MINION_CONTROL_CHANGED.payload.fromControllerId`，不能只看变更后的 `triggerMinion.controller`。修复 helper + `tricksters.ts` 后，`baseFactionOngoing.test.ts` 整文件 `81 passed`，`npm run test:structure` OK。
- 2026-05-16 21:04 +08：处理 `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` 的普通业务 direct handler。将 `bear_cavalry_bear_rides_you_pod_choose_base` 从直调 handler 改为真实命令链：`PLAY_ACTION` -> 选己方随从 -> 选目标基地 -> 断言 `choose_suppress` prompt 候选仍包含新基地上的基地/随从/持续行动。验证：整文件 `21 passed`，eslint 0 errors；文件内剩余命中只剩两条 `bear_cavalry_superiority_pod_talent` 低层合同。
- 统计更新：全仓 `getInteractionHandler` / `getAbilityRuntimePromptHandler` 命中从 `44` 降到 `43`。当前剩余主要是 `smashup.smoke.test.ts` 的 3 处（其中 2 处注册表断言）、`baseFactionOngoing.test.ts` 的 `trickster_flame_trap_pod_bp`、`abilities/bear-cavalry.test.ts` 的 2 条 `superiority_pod_talent`、以及 `temple-firstmate-afterscore.test.ts` 的 2 条 stale/baseDefId 合同。
- 2026-05-16 20:49 +08：继续清理全仓剩余 direct handler，处理 `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts`。先扫描全仓当前命中为 `48`，然后挑出 afterScoring 业务链：`smashup_reaction_choose` -> `pirate_first_mate_choose_base`。
- 第一次误判：我把这条场景当成“当前已有 reaction prompt 的普通链”，直接改成 `getSimpleChoicePrompt(matchState, 'smashup_reaction_choose')` + `runCommand(respondCommand(...))`，结果整文件 1 红灯；失败点说明该场景在构造时只有 reaction session + triggerQueue，没有当前 prompt。
- 修正：这条测试的本质是“已取得触发资格后，session 仍可继续结算”，所以改用 `resolveSmashUpReactionChoice(matchState, dummyRandom, 102, { kind: 'trigger', triggerId })` 驱动 reaction session，再对后续 `pirate_first_mate_choose_base` 业务 prompt 使用 `respondToPromptOption(...)`。这样去掉了 `getInteractionHandler('smashup_reaction_choose')` 和 `getInteractionHandler('pirate_first_mate_choose_base')`，但保留了 reaction session 合同本身。
- 验证：
  - `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 19 passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 0 errors。
  - 全仓 direct handler / runtime prompt handler 命中重新统计：`47`。
- 2026-05-16 20:43 +08：继续收 `src/games/smashup/__tests__/smashup.smoke.test.ts` 里剩余普通业务 direct handler，完成 `major_ursa` 三段链迁移。先用一次性脚本确认真实链路：`USE_TALENT` 后 `respondToPromptOption(destination)` 的 `finalState` 已直接带 `smashup_reaction_choose`，响应后自动出现 `titan_bear_cavalry_major_ursa_choose_minion`，再响应后自动出现 `titan_bear_cavalry_major_ursa_choose_base`；说明旧测试里的 handler 直调和 `postProcessSystemEvents(...)` 都是实现耦合，不是业务必需。
- 修改：`src/games/smashup/__tests__/smashup.smoke.test.ts` 把 `destinationHandler/minionHandler/baseHandler` 三段直调改为真实 `SmashUpDomain.execute(...)` + `respondToPromptOption(...)` + `respondCommand(...)` 链；最终状态直接从 `chooseBaseResult.finalState.core` 断言敌方随从已移到目标基地。
- 验证：
  - 定点：`node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "大熊座移动后可继续选择对手 3 或更低随从并移动到其他基地"` -> 1 passed。
  - 全文件：`node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 133 passed。
  - 静态检查：`node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - 结构门禁：`npm run test:structure` -> OK。
- 结果：`rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__/smashup.smoke.test.ts` 现在只剩 3 处：`titan_penguins_emperor_penguin_play` 低层合同 1 处，`big_funny_giant` 注册表断言 2 处。`major_ursa` 已从剩余普通业务 direct handler 清单移除。
- 2026-05-16 20:35 +08：收口 `src/games/smashup/__tests__/smashup.smoke.test.ts` 的 Hill give-minion -> counter 红灯。先用一次性脚本复盘真实命令链，确认不是“还要再 `maybeResolveReactionQueue` 一次”，而是测试手工 `resolveAffectedMinions(...)` 把同一个 `onMinionAffected` trigger 重复入队；同时发现真实链路第一次消费 trigger 时，`MINION_CONTROL_CHANGED` 的 affect 快照仍保留旧 controller，导致 `ignobles_the_hill_that_strolls` 不会弹出 counter prompt。
- 修复：
  - `src/games/smashup/domain/affect.ts`：`MINION_CONTROL_CHANGED` 分支构造 affect record 时，把 `triggerMinion.controller` 修正为 `payload.toControllerId`，让 `onMinionAffected(control_change)` 看到变更后的控制权。
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`：Hill 用例不再手工 `resolveAffectedMinions(...)` / `maybeResolveReactionQueue(...)` 补跑实现，而是直接消费 `respondToPromptOption(...)` 的真实 `finalState`，再通过 reaction prompt -> counter prompt 完整响应。
- 验证：
  - 单点：`node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "漫游山岭巨人交出己方随从控制权抽牌后，会通过 ongoing 交互给该随从放置 1 枚力量标记"` -> 1 passed。
  - 全文件：`node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 133 passed。
  - 静态检查：`node node_modules/eslint/bin/eslint.js src/games/smashup/domain/affect.ts src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - 结构门禁：`npm run test:structure` -> OK。
- 2026-05-16 14:01 +08：恢复 `src/games/smashup/__tests__/interactionChainE2E.test.ts` 中最后一个 `it.skip`。旧用例仍在保护过期的 Alien Probe “牌库顶/底”效果；本轮按当前规则改为“单对手自动确定对手 -> 选择对手手牌随从 -> 对手弃掉该随从”，并验证行动卡选项禁用。
- 中途红灯：首次仅取消 skip 后整文件 54 passed / 1 failed，失败点是没有 prompt。根因不是 sourceId，而是旧测试数据把 Alien Probe 设成旧牌库顶效果且局面没有当前可选手牌随从链路。按当前行为重写后通过。
- 验证：`npm test -- src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 55 tests passed；`npx eslint src/games/smashup/__tests__/interactionChainE2E.test.ts src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 13:58 +08：恢复 `src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` 中的九命之屋 skipped 块。改为当前 `base_house_of_nine_lives` 场景：Igor 在其他基地被消灭时，九命之屋创建 `base_nine_lives_intercept` prompt，消灭事件被 pendingSave 暂缓，并且不创建 `frankenstein_igor` onDestroy prompt。
- 验证：`npm test -- src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` -> 4 tests passed；该文件目标模式 + skip 扫描 0 命中；eslint 0 errors；`npm run test:structure` -> OK。
- 当前 SmashUp skip 声明剩余 3 处，全部是 afterScoring 链式历史文件：`mothership-scout-afterscore-bug.test.ts`、`miskatonic-scout-afterscore.test.ts`、`wizard-academy-scout-afterscore.test.ts`。全目录 broad scan 从 28 降到 24，其中 21 条来自这 3 个 afterScoring skip，3 条是 `promptSystem.test.ts` 底层合同。
- 2026-05-16 13:56 +08：删除两个已被可运行测试覆盖的调试/旧 bug skip 入口：`wizard-archmage-debug.test.ts` 与 `steampunk-aggromotive-bug.test.ts`。前者只是大法师弃牌堆出牌 console 追踪，已由 `wizard-archmage-discard-play.test.ts` 和本轮新恢复的僵尸链测试覆盖；后者是蒸汽机车旧错误行为记录，已由 `steampunk-aggromotive-fix.test.ts` 覆盖。
- 验证：`npm test -- src/games/smashup/__tests__/wizard-archmage-discard-play.test.ts src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts` -> 2 files / 3 tests passed；`npm test -- src/games/smashup/__tests__/steampunk-aggromotive-fix.test.ts` -> 8 tests passed；`npm run test:structure` -> OK。
- 当前 skip 声明剩余 5 处：`igor-ondestroy-idempotency.test.ts`、`interactionChainE2E.test.ts`、`mothership-scout-afterscore-bug.test.ts`、`miskatonic-scout-afterscore.test.ts`、`wizard-academy-scout-afterscore.test.ts`。全目录 broad scan 仍为 28，因为这两个删除项本来不贡献目标内部耦合命中。
- 2026-05-16 13:55 +08：删除 `src/games/smashup/__tests__/vampireBuffetE2E.test.ts` 这个整文件 skipped 的误导入口。判断依据：文件注释明确旧 POD 口径不适用；`vampire_buffet afterScoring` 的当前可运行覆盖在 `newOngoingAbilities.test.ts`，`giant_ant_we_are_the_champions` 的当前可运行覆盖在 `abilities/giant-ants.test.ts`；保留该文件只会继续把历史死测试伪装成测试资产。
- 验证：`npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts ...` 实际跑完整文件 -> 126 tests passed；`npm test -- src/games/smashup/__tests__/abilities/giant-ants.test.ts ...` 实际跑完整文件 -> 22 tests passed；`npm run test:structure` -> OK。说明删除的 skipped 文件没有移除唯一覆盖。
- 结果：全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 29 降到 28；剩余 skip 声明集中在 afterScoring 历史链、Igor 历史块、Steampunk 历史 bug、Wizard Archmage debug 旧追踪，以及 `interactionChainE2E` 一个未恢复链路。
- 2026-05-16 13:52 +08：恢复 `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`。原文件是 `it.skip`、旧 `GameTestRunner`、`autoRespond` 与 console 调试；本轮重写为当前 pipeline 命令链：打出 `zombie_they_keep_coming` -> 通过 prompt facade 选择弃牌堆 `wizard_archmage` 并合并目标基地 -> 验证大法师上场、离开弃牌堆，且 P0 `actionLimit` 从 1 增至 2。
- 验证：`npm test -- src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts` -> 1 test passed；目标模式 + skip 扫描该文件 -> 0 命中；`npx eslint src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅旧泛名文件与 legacy-root E2E 历史 warning。
- 结果：全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 31 降到 29。剩余主要是 afterScoring 链式 skip 历史、`igor` skip 历史块、`vampireBuffetE2E` skip 历史块，以及 `promptSystem.test.ts` 的 3 条系统合同。
- 2026-05-16 13:48 +08：验证 `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts` 的 skip 恢复结果。该文件已从旧 `it.skip` + `GameTestRunner` 形状 + 裸 `sys.interaction.current` 读取，改为真实 `PLAY_ACTION` 命令链；在 Me First! 响应窗口中打出 `ninja_hidden_ninja` 后，通过 prompt facade 断言出现手牌随从选择 prompt，且候选包含 `c23` / `c28`。
- 验证：`npm test -- src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts` -> 1 test passed；目标模式 + skip 扫描该文件 -> 0 命中；`npx eslint src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅旧泛名文件与 legacy-root E2E 历史 warning。
- 结果：全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 33 降到 31。剩余 31 = `skip-history=28` + `system-contract=3`。这批不是只改注释/标线，但仍未完成 skip 历史治理。
- 2026-05-16 11:30 +08：继续处理 `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` -> 8 tests passed。
- 改动：移除 `asSimpleChoice` / `INTERACTION_COMMANDS` 直依赖；`getActiveSimpleChoice` 改为 `getOptionalSimpleChoicePrompt`；多基地计分、海盗王/托尔图加/大副、便衣忍者、四人压力链的 option 查询和玩家响应改为 `getPromptOption` / `getPromptOptions` / `respondCommand` / `expectNoPrompt`。
- 验证：目标扩展扫描 0 命中；`npm test -- src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` -> 8 tests passed；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 全 `src/games/smashup/__tests__` 主禁用模式从 638 降到 626；仍不能宣称整体完成。
- 2026-05-16 11:22 +08：继续处理 `src/games/smashup/__tests__/elderThingsPod.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/elderThingsPod.test.ts` -> 13 tests passed。
- 改动：移除 `INTERACTION_COMMANDS` / `getInteractionsFromMS` import；Elder Thing POD、Mi-Go、Shoggoth、The Price of Power、Spreading Horror、base Elder Thing 的 prompt source/displayCard/options/player、响应命令和无 prompt 断言改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptHandlerData` / `getPromptOption` / `getPromptOptions` / `getPromptPlayerId` / `respondCommand` / `expectNoPrompt`。
- 验证：目标扩展扫描 0 命中；`npm test -- src/games/smashup/__tests__/elderThingsPod.test.ts` -> 13 tests passed；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/elderThingsPod.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 全 `src/games/smashup/__tests__` 主禁用模式从 650 降到 638；仍不能宣称整体完成。
- 2026-05-16 11:17 +08：回应“是不是只改表象”，继续处理 `src/games/smashup/__tests__/zombieInteractionChain.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> 22 tests passed。
- 改动：移除测试体对 `INTERACTION_COMMANDS` / `asSimpleChoice` 的直接依赖；本地 `respond(...)` 改走 `respondCommand`，多选空响应新增 `respondOptionsCommand`；所有僵尸 prompt 读取改为 `getSimpleChoicePrompt`，候选读取改为 `getPromptOption` / `getPromptOptions`，无 prompt 断言改为 `expectNoPrompt`。
- 验证：目标扩展扫描 0 命中；`npm test -- src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> 22 tests passed；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 665 降到 650；仍不能宣称整体完成。
- 2026-05-16 11:12 +08：补写上一批 `src/games/smashup/__tests__/giantAntsPod.test.ts`。巨蚁 POD 的 prompt source/options/响应命令已改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptOption` / `respondToPrompt`。
- 验证：目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/giantAntsPod.test.ts` -> 0 errors；`npm test -- src/games/smashup/__tests__/giantAntsPod.test.ts` -> 6 tests passed；`npm run test:structure` -> OK，仅 Junction 镜像 warning。全主禁用模式从 682 降到 665。
- 2026-05-16 11:09 +08：继续处理 `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` -> 32 tests passed。
- 改动：Miskatonic Those Meddling Kids 多步基地/行动卡选择从 current/queue 手工查询改为 `getFirstPrompt` / `getPromptsBySourceId` / `getPromptHandlerData`；Recruit by Force 与 It Begins Again 的 source/options/multi/skip/no-prompt/handler data 读取改为 prompt facade。
- 验证：目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` -> 0 errors、2 warnings（既有未使用类型 warning）；`npm test -- src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` -> 32 tests passed；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 696 降到 682；仍不能宣称整体完成。
- 2026-05-16 11:04 +08：继续处理 `src/games/smashup/__tests__/zombieWizardAbilities.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 23 tests passed。
- 改动：`zombie_grave_digger`、`zombie_walker`、`zombie_grave_robbing`、`zombie_not_enough_bullets`、`zombie_lend_a_hand`、`zombie_outbreak_choose_base`、`zombie_mall_crawl`、`wizard_sacrifice` 的 prompt source/target/displayCard 断言与 handler data 传递改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptTargetType` / `getPromptHandlerData`。
- 验证：目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 0 errors；`npm test -- src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 23 tests passed；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 708 降到 696；仍不能宣称整体完成。
- 2026-05-16 10:52 +08：继续处理 `src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 2 tests passed；eslint 0 errors。
- 改动：reaction prompt 获取从 `getInteractionsFromMS` 改为 `getFirstPrompt`；reaction option 选择改为 `getReactionPromptOptionBySourceDefId`；后续 POD play prompt 查询改为 `getPromptsBySourceId`；source/player/handler data/displayCard 读取改为 `getPromptSourceId` / `getPromptPlayerId` / `getPromptHandlerData`。
- 中途失败：第一次调用 `getReactionPromptOptionBySourceDefId` 漏传 prompt 参数，导致两个用例报 “Expected reaction option for undefined”；按 helper 签名修正后复跑通过。
- 验证：目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 0 errors；`npm test -- src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 2 tests passed；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 719 降到 708；仍不能宣称整体完成。
- 2026-05-16 10:48 +08：继续处理 `src/games/smashup/__tests__/baseFactionOngoing.test.ts`。改动覆盖 Infiltrate / Infiltrate POD、Hidden Ninja、Acolyte 触发打出 Gunfighter 后接决斗 prompt、Flame Trap POD 双实例 runtime prompt、Mark of Sleep。
- 改动：上述链路的 prompt source、targetType、options、响应命令、current+queue 双 prompt 查询与 handler data 传递，改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptTargetType` / `getPromptOptions` / `getPromptOption` / `respondToPrompt` / `getPromptsBySourceId` / `getPromptHandlerData`。
- 验证：目标扩展扫描 0 命中；`npm test -- src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 81 tests passed；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 0 errors、4 warnings（既有未使用 import/变量 warning，未作为本轮错误处理）；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 729 降到 719；仍不能宣称整体完成。
- 2026-05-16 10:44 +08：继续处理 `src/games/smashup/__tests__/architecture-duplicate-processing.test.ts`。改前基线已确认 `npm test -- src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` -> 7 tests passed。
- 改动：Big Gulp / Igor 重复处理测试里的 `result.finalState.sys.interaction.current`、`interaction.data.options`、手写 `INTERACTION_COMMANDS.RESPOND`、手工 current+queue 统计 `frankenstein_igor` 全部改为 `getFirstPrompt` / `getPromptOption` / `respondToPrompt` / `getPromptsBySourceId`。
- 验证：目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` -> 0 errors；`npm test -- src/games/smashup/__tests__/architecture-duplicate-processing.test.ts` -> 7 tests passed；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 739 降到 729；仍不能宣称整体完成。
- 2026-05-16 10:38 +08：继续处理 `src/games/smashup/__tests__/madnessAbilities.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/madnessAbilities.test.ts` -> 32 tests passed。
- 改动：移除 `SYS_INTERACTION_RESPOND` 字符串响应与 `sys.interaction.current` / `data.sourceId` / `data.options` 裸读；新增本地 `requireLastMatchState` / `getLastPrompt` / `getLastPromptsBySourceId` 作为过渡桥，底层调用共享 prompt facade。
- 改动：`innsmouth_recruitment`、`cthulhu_corruption`、`miskatonic_librarian_pod_play_madness`、`miskatonic_mandatory_reading(_draw)` 的 prompt source、targetType、handler data、候选项与响应改为 `getSimpleChoicePrompt` / `getFirstPrompt` / `getPromptsBySourceId` / `getPromptHandlerData` / `getPromptOption` / `respondToPrompt`。
- 验证：改后 `npm test -- src/games/smashup/__tests__/madnessAbilities.test.ts` -> 32 tests passed；目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 748 降到 739；仍不能宣称整体完成。
- 2026-05-16 10:33 +08：继续处理 `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`。改前基线 `npm test -- src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 26 tests passed。
- 改动：本地最近 prompt 读取改为 `getLastPrompt(...)` / `getLastPromptsBySourceId(...)`，内部实现走 `getSimpleChoicePrompt` / `getPromptsBySourceId`；`cthulhu_madness_unleashed` 的 source/options/multi 断言改为 `getPromptSourceId` / `getPromptOptions` / `getPromptMulti`；多选响应改为 `respondToPromptOptions`，普通响应改为 `respondToPrompt`。
- 改动：`miskatonic_book_of_iter_the_unseen` 的 prompt presence、discard-two option、无 prompt 断言改为 facade；`miskatonic_thing_on_the_doorstep` 的 tie target 读取与 handler data 改为 `getFirstPrompt` / `getPromptOption` / `getPromptHandlerData`。
- 验证：改后 `npm test -- src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 26 tests passed；目标扩展扫描 0 命中；`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 756 降到 748；仍不能宣称整体完成。
- 2026-05-16 10:26 +08：针对“是不是只改表象”继续处理 `src/games/smashup/__tests__/meFirst.test.ts`。该文件旧耦合集中在 `INTERACTION_COMMANDS.RESPOND`、`asSimpleChoice(result.finalState.sys.interaction.current)`、以及直接从 options 里找随从/抽牌选项。
- 改动：`ME_FIRST_PASS_ALL` 和 Me First! 窗口内 play/pass/选随从/选抽牌数响应改为 `respondCommand(...)`；当前 prompt 读取改为 `getSimpleChoicePrompt(...)`；source/player 断言改为 `getPromptSourceId` / `getPromptPlayerId`；选项查找改为 `getPromptOption`；无 prompt 断言改为 `expectNoPrompt`。
- 验证：改前 `npm test -- src/games/smashup/__tests__/meFirst.test.ts` -> 13 tests passed；改后同命令 -> 13 tests passed。
- 扫描：`meFirst.test.ts` 对 `getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|sys.interaction.current|.data.sourceId|interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/meFirst.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 764 降到 756；仍不能宣称整体完成。
- 2026-05-16 10:19 +08：完成 `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` 小批次：完整链路测试中的 `hasInteraction` 改为 `getPromptsBySourceId`，reaction queue 选择改为 `getFirstPrompt` / `getPromptSourceId` / `getPromptOptions` / `respondToPrompt`，Shoggoth -> Asylum 二段 prompt 改为 `getSimpleChoicePrompt` / `getPromptOption` / `getPromptOptions`。
- 验证：`npm test -- src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` -> 1 file / 23 tests passed。
- 扫描：`baseAbilityIntegrationE2E.test.ts` 对 `getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|sys.interaction.current|.data.sourceId|interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 772 降到 764；仍不能宣称整体完成。
- 2026-05-16 10:14 +08：完成 `src/games/smashup/__tests__/talentAbilities.test.ts` 小批次：Cthulhu Star Spawn / Servitor 天赋 prompt 从 `getInteractionsFromMS` + `asSimpleChoice` 改为 `getSimpleChoicePrompt`，候选读取改为 `getPromptOptions`，取消响应命令改为 `respondCommand('__cancel__', '0')`。
- 验证：改前 `npm test -- src/games/smashup/__tests__/talentAbilities.test.ts` -> 20 tests passed；改后同命令 -> 20 tests passed。
- 扫描：`talentAbilities.test.ts` 对 `getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|sys.interaction.current|.data.sourceId|interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/talentAbilities.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 780 降到 772；仍不能宣称整体完成。
- 2026-05-16 10:08 +08：针对“是不是只改表象”继续处理 `src/games/smashup/__tests__/runtimeEvidenceIssues.test.ts`。旧测试只在 Fledgling Vampire POD 用例末尾 `void getInteractionsFromMS(afterDestroy.finalState)`，没有证明 bury prompt；本轮改成完整链路：Big Gulp 目标 prompt -> 玩家响应 -> `smashup_reaction_choose` 中选择 Fledgling POD -> 断言 `vampire_fledgling_vampire_pod_bury_source` prompt 出现。
- 同文件 Mi-go POD 用例也从裸 `getInteractionsFromMS` / `data.options` / `INTERACTION_COMMANDS.RESPOND` 改为 `getSimpleChoicePrompt` / `getPromptOption` / `getPromptOptions` / `respondToPrompt`。
- 中途失败记录：第一次补 Fledgling bury prompt 断言时发现实际还停在 `smashup_reaction_choose`；补 reaction 选择后又因硬写 playerId `0` 失败为“不是你的选择回合”。最终让 `respondToPrompt` 使用 prompt 自身 playerId 后通过。
- 验证：`npm test -- src/games/smashup/__tests__/runtimeEvidenceIssues.test.ts` -> 1 file / 2 tests passed。
- 扫描：`runtimeEvidenceIssues.test.ts` 对 `getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|sys.interaction.current|.data.sourceId|interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/runtimeEvidenceIssues.test.ts` -> 0 errors；`npm run test:structure` -> OK，仅 Junction 镜像与既有旧泛名债务 warning。
- 全 `src/games/smashup/__tests__` 主禁用模式从 788 降到 780；仍不能宣称整体完成。
- 2026-05-16 09:08 +08：完成 `src/games/smashup/__tests__/specialInteractionChain.test.ts` 小批次：本地 `respond()` helper 不再直接 import `INTERACTION_COMMANDS.RESPOND`，改用共享 `respondCommand(optionId, playerId)`；行为断言和 24 条特殊交互代表链保持不变。
- 验证：`npm test -- src/games/smashup/__tests__/specialInteractionChain.test.ts` -> 1 file passed / 24 tests passed。
- 扫描：`specialInteractionChain.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/specialInteractionChain.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 09:06 +08：完成 `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` 小批次：保留“同一个 respond 命令对象重复提交”的回归语义，但命令形状从直接 import `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand(...)`，避免测试体绑定系统响应常量。
- 验证：`npm test -- src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` -> 1 file passed / 2 tests passed。
- 扫描：`duplicateInteractionRespond.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/duplicateInteractionRespond.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 09:02 +08：完成 `src/games/smashup/__tests__/robot-hoverbot-button-disabled.test.ts` 小批次：Hoverbot 按钮交互的 title/source/options/optionsGenerator 读取与无 prompt 断言改为 `getSimpleChoicePrompt`、`getPromptTitle`、`getPromptSourceId`、`getPromptOptions`、`getPromptOptionsGenerator`、`getPromptHandlerData`、`expectNoPrompt`。
- 验证：`npm test -- src/games/smashup/__tests__/robot-hoverbot-button-disabled.test.ts` -> 1 file passed / 3 tests passed。
- 扫描：`robot-hoverbot-button-disabled.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/robot-hoverbot-button-disabled.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 09:00 +08：完成 `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` 小批次：神选者确认 prompt 的 targetType/sourceId/options 断言改为 `getSimpleChoicePrompt`、`getPromptTargetType`、`getPromptSourceId`、`getPromptOptions`；多实例 queued prompt 改用 `getPromptsBySourceId` + `getPromptPlayerId`。
- 验证：`npm test -- src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> 1 file passed / 4 tests passed。
- 扫描：`cthulhu-chosen-display-mode.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 08:58 +08：完成 `src/games/smashup/__tests__/robot-hoverbot-stable.test.ts` 小批次：Hoverbot 稳定性测试保留对 `robot_hoverbot_0` id 的专项断言，但 prompt options、skip/play 响应、无 prompt 与基地选择 options 均改为 `getFirstPrompt`、`getPromptOptions`、`getPromptOption`、`respondToPrompt`、`expectNoPrompt`。
- 中途失败：第一次迁移用 `getPromptOptionById(interaction, 'play')`，该 helper 未覆盖旧 `data.options`，首个用例失败；改用 `getPromptOption` 后复跑通过。
- 验证：`npm test -- src/games/smashup/__tests__/robot-hoverbot-stable.test.ts` -> 1 file passed / 3 tests passed。
- 扫描：`robot-hoverbot-stable.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/robot-hoverbot-stable.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 08:54 +08：完成 `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` 小批次：Big Gulp 目标选择、Drone 防消灭 prompt 的 player/source/options 读取改为 `getSimpleChoicePrompt`、`getPromptPlayerId`、`getPromptSourceId`、`getPromptOption`；三处手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondToPrompt`；最终无 prompt 改为 `expectNoPrompt`。
- 验证：`npm test -- src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` -> 1 file passed / 2 tests passed。
- 扫描：`bigGulpDroneIntercept.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 2026-05-16 08:51 +08：完成 `src/games/smashup/__tests__/baseAbilities.test.ts` 小批次：ability runtime prompt 的 `asSimpleChoice(initial.matchState?.sys.interaction?.current)` 改为 `getFirstPrompt` + `getPromptSourceId`；continuation data 读取改为 `getPromptHandlerData`。同时把两个未使用 `context` 参数改为 `_context` 清掉 eslint warning。
- 验证：`npm test -- src/games/smashup/__tests__/baseAbilities.test.ts` -> 1 file passed / 11 tests passed。
- 扫描：`baseAbilities.test.ts` 对主禁用模式 + `interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 扩展模式当前 0 命中。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/baseAbilities.test.ts` -> 0 errors；`npm run test:structure` -> OK。
- 全 `src/games/smashup/__tests__` 主禁用模式剩余仍为 821；这两批主要清理扩展坏味道，不把计数未降误报成已完成。
- 2026-05-16 08:49 +08：完成 `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 小批次：`getCurrentChoice` 从 `asSimpleChoice(state.sys.interaction?.current)` 改为 `getOptionalSimpleChoicePrompt(state)`；测试 setup 中手写 `sys.interaction.current = createSimpleChoice(...)` 改为 `withCurrentPrompt({ sys, core }, createSimpleChoice(...))`，避免业务测试直接绑定 current 存储位置。
- 扫描：`afterScoring-rescoring.test.ts` 对 `getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|sys.interaction.current|.data.sourceId|interaction.data|INTERACTION_COMMANDS|asSimpleChoice` 当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/afterScoring-rescoring.test.ts` -> 1 file passed / 8 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/afterScoring-rescoring.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 仍只是同一物理文件映射，旧泛名 warning 保持，不是本批新增入口。
- 全 `src/games/smashup/__tests__` 主禁用模式剩余 821 条命中；本批不改变整体未完成结论。
- 2026-05-16 02:48 +08：回应“是不是只改表象”，继续用目标文件 0 命中 + 聚焦测试 + 结构门禁证明真实 seam 收敛。
- `src/games/smashup/__tests__/ui-interaction-manual.test.ts`：已在上一批把 UI 手动验证从 `asSimpleChoice(sys.interaction.current)` 改为 `getSimpleChoicePrompt`；验证 `npm test -- src/games/smashup/__tests__/ui-interaction-manual.test.ts` -> 14 tests passed，`npx eslint ...` -> 0 errors，`npm run test:structure` -> OK。
- `src/games/smashup/__tests__/helpers.ts`：新增 `getPromptPlayerId`，把 prompt 归属玩家读取也收进 facade。
- `src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts`：把 Big Gulp prompt source/options/target option 与 Igor prompt 计数从裸 `sys.interaction.current` / `SYS_INTERACTION_RESPOND` / 手工 current+queue 改为 `getSimpleChoicePrompt`、`getPromptOptions`、`getPromptOption`、`respondToPrompt`、`getPromptsBySourceId`。
- `src/games/smashup/__tests__/igor-double-trigger-bug.test.ts`：把 Crypt + Igor 双 prompt 统计从手工拼 interaction 列表和 `.data.sourceId` 改为 `getPromptsBySourceId`。
- `src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts`：把 Big Gulp 与 Igor onDestroy 两段 prompt 的 source/options/player/响应改为 `getSimpleChoicePrompt`、`getPromptOptions`、`getPromptPlayerId`、`respondToPrompt`，最终无 prompt 改为 `expectNoPrompt`。
- 扫描：上述 3 个 Igor 目标文件对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts src/games/smashup/__tests__/igor-double-trigger-bug.test.ts src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 3 files passed / 4 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts src/games/smashup/__tests__/igor-double-trigger-bug.test.ts src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK，仅 Junction 镜像和旧泛名净删减 warning。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 896 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 02:52 +08：继续处理 `src/games/smashup/__tests__/response-window-skip.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/response-window-skip.test.ts` -> 1 file / 5 tests passed。
- `src/games/smashup/__tests__/helpers.ts`：新增 `getOptionalSimpleChoicePrompt`，让“可有可无的 simple choice prompt”也走 facade，避免测试本地继续 `asSimpleChoice(state.sys.interaction?.current)`。
- `response-window-skip.test.ts`：本地 `getCurrentChoice` 改为 `getOptionalSimpleChoicePrompt`；cancel 路径从手写 `SYS_INTERACTION_CANCEL` 改为 `cancelPrompt`；Hidden Ninja 子交互 source/options 读取改为 `getSimpleChoicePrompt` + `getPromptOption`。
- 扫描：`response-window-skip.test.ts` 对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/response-window-skip.test.ts` -> 1 file / 5 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/response-window-skip.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK，仅 Junction 镜像和旧泛名净删减 warning。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 893 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 02:54 +08：继续处理 `src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts` -> 1 file / 2 tests passed。
- `reactionQueueOnTurnStart.test.ts`：把 onTurnStart/onTurnEnd 的统一反应 prompt 断言从 `state.sys.interaction.current.data.sourceId` 改为 `getReactionPrompt(state)`。
- 扫描：`reactionQueueOnTurnStart.test.ts` 对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts` -> 1 file / 2 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/reactionQueueOnTurnStart.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK，仅 Junction 镜像和旧泛名净删减 warning。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 889 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 02:58 +08：跳过 `miskatonic-scout-afterscore.test.ts`，因为它是 `describe.skip`；按规范不为了降命中迁移 skipped 文件，除非先补真实链路跑绿。
- 继续处理非 skip 文件 `src/games/smashup/__tests__/robot-hoverbot-chain.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/robot-hoverbot-chain.test.ts` -> 1 file / 3 tests passed。
- `src/games/smashup/__tests__/helpers.ts`：新增 `respondCommand(optionId, playerId)`，让需要放入 `GameTestRunner.run({ commands })` 的旧测试不再手写 `SYS_INTERACTION_RESPOND` 字符串和 payload 形状。
- `robot-hoverbot-chain.test.ts`：命令数组中的响应命令改用 `respondCommand('play', '0')`；刷新后的 live prompt 从 `interaction.data.options` 改为 `getOptionalSimpleChoicePrompt`、`getPromptPlayerId`、`getPromptOptions`、`getPromptOption`。
- 扫描：`robot-hoverbot-chain.test.ts` 对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/robot-hoverbot-chain.test.ts` -> 1 file / 3 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/robot-hoverbot-chain.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK，仅 Junction 镜像和旧泛名净删减 warning。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 885 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 03:03 +08：继续处理非 skip 文件 `src/games/smashup/__tests__/robotAbilities.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/robotAbilities.test.ts` -> 1 file / 11 tests passed。
- `src/games/smashup/__tests__/helpers.ts`：新增 `getPromptMultiMin` 与 `getPromptOptionsGenerator`，把 simple-choice 的 multi 最小值和动态候选刷新入口也收进 prompt facade。
- `robotAbilities.test.ts`：Microbot Reclaimer 的 prompt source、multi、optionsGenerator、handler data 与 optionIds 响应从 `sys.interaction.current` / `interaction.data` / 手写 `SYS_INTERACTION_RESPOND` 改为 `getSimpleChoicePrompt`、`getOptionalSimpleChoicePrompt`、`getPromptMultiMin`、`getPromptOptionsGenerator`、`getPromptHandlerData`、`respondToPromptOptions`。
- 扫描：`robotAbilities.test.ts` 对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/robotAbilities.test.ts` -> 1 file / 11 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/robotAbilities.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 仍只说明 `e2e/src` 是同一物理文件映射，不是新增测试入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 881 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 03:07 +08：继续处理非 skip 文件 `src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts` -> 1 file / 9 tests passed。
- `src/games/smashup/__tests__/helpers.ts`：新增 `getPromptTitle`，让测试标题读取也走 prompt facade。
- `trickster-mark-of-sleep-self-target.test.ts`：把 Mark of Sleep / POD 的 current prompt、title、options、source 与 3 处响应命令从 `sys.interaction.current` / `interaction.data` / 手写 `SYS_INTERACTION_RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptTitle`、`getPromptOptions`、`getPromptOption`、`respondToPrompt`。
- 扫描：`trickster-mark-of-sleep-self-target.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts` -> 1 file / 9 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 仍只说明 `e2e/src` 是同一物理文件映射，不是新增测试入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 877 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 03:12 +08：最低命中筛查中跳过 skipped 文件：`test-alien-scout-afterscore.test.ts`、`vampireBuffetE2E.test.ts`、`wizard-academy-scout-afterscore.test.ts`、`ninja-hidden-ninja-interaction-bug.test.ts`；按规范不为了降命中迁移 skipped 测试。
- `src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts` 基线 2 tests passed；该文件命中主要是注释引用旧 `flowHalted && interaction.current` 条件，且测试目标是 flow hook 内部 halt 合同，本批不做改注释式降计数。
- `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` 改前基线 `npm test -- src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> 1 file / 15 tests passed。
- `afterscoring-window-skip-base-clear.test.ts`：把 `asSimpleChoice(...sys.interaction?.current)` 的 reaction prompt / immediate extra minion prompt 读取改为 `getReactionPrompt` / `getSimpleChoicePrompt`，把无 prompt 断言改为 `expectNoPrompt`；保留必要的系统状态构造与手工 `createSimpleChoice` setup。
- 扫描：`afterscoring-window-skip-base-clear.test.ts` 仍有少量 `sys.interaction.current` 命中，当前均属于系统测试 setup / 构造交互，不按业务测试坏味道强行隐藏。
- 验证：`npm test -- src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> 1 file / 15 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 仍只说明 `e2e/src` 是同一物理文件映射，不是新增测试入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 876 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 03:15 +08：继续处理非 skip 文件 `src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 1 file / 4 tests passed。
- `alien-scout-pod-afterscore.test.ts`：把 Scout afterScoring 的 prompt source/current/queue/options 与 handler data 从裸 `matchState.sys.interaction` / `interaction.data` 改为 `getSimpleChoicePrompt`、`getPromptsBySourceId`、`getPromptOption`、`getPromptHandlerData`。
- 扫描：`alien-scout-pod-afterscore.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 1 file / 4 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 0 errors。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 仍只说明 `e2e/src` 是同一物理文件映射，不是新增测试入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 871 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:13 +08：继续处理 `src/games/smashup/__tests__/expansionAbilities.test.ts`；改前基线已确认 32 tests passed。
- `expansionAbilities.test.ts`：把 Bear Hug 的 prompt source/options/目标 option 与响应命令从 `sys.interaction.current` / `.data.options` / `SYS_INTERACTION_RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptOptions`、`getPromptOption`、`respondToPrompt`。
- `expansionAbilities.test.ts`：删除本地 `getLastInteractions()`，把 Ghost、Bear Cavalry Commission、Scrap Diving 的 current+queue 查询改为 `getPromptsBySourceId(lastMatchState!, sourceId)`。
- 扫描：`expansionAbilities.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/expansionAbilities.test.ts` -> 1 file / 32 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 中途错误：清理未使用 `events` warning 时误删仍被断言使用的 `events` 赋值，造成临时失败；已定点恢复并复跑通过。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 866 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:18 +08：继续处理 `src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` -> 1 file / 6 tests passed。
- `reactionQueueBaseAbilities.test.ts`：把统一反应 prompt 的 current/source/options 读取改为 `getReactionPrompt`、`getPromptOptions`、`getPromptOption`。
- `reactionQueueBaseAbilities.test.ts`：把旧 handler 直调需要的 prompt data 改为 `getPromptHandlerData(current)`，把无 prompt 断言改为 `expectNoPrompt`，把真实基地 prompt 断言改为 `getSimpleChoicePrompt(..., 'base_a_prompt')` + `getPromptSourceId`。
- 扫描：`reactionQueueBaseAbilities.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` -> 1 file / 6 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 861 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:21 +08：继续处理 `src/games/smashup/__tests__/frankensteinFaq.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/frankensteinFaq.test.ts` -> 1 file / 3 tests passed。
- `frankensteinFaq.test.ts`：把 Blitzed 两段 prompt 的 source/options 读取与两次响应命令从 `sys.interaction.current.data` / `INTERACTION_COMMANDS.RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptOptionById`、`getPromptOption`、`respondToPrompt`。
- `frankensteinFaq.test.ts`：把 It’s Alive! immediate extra minion prompt 与 skip 响应改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`。
- 扫描：`frankensteinFaq.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data`/`INTERACTION_COMMANDS` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/frankensteinFaq.test.ts` -> 1 file / 3 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/frankensteinFaq.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 855 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:24 +08：继续处理 `src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts` -> 1 file / 2 tests passed。
- `reactionQueueBaseOptionalClockwise.test.ts`：把 optional reaction prompt 的 player/source/options 读取从 `sys.interaction.current.data` 改为 `getReactionPrompt`、`getPromptPlayerId`、`getPromptOptions`、`getPromptOption`。
- `reactionQueueBaseOptionalClockwise.test.ts`：删除本地 `withResolvedInteraction`，改用共享 `withoutCurrentPrompt`；旧 handler 直调 data 改为 `getPromptHandlerData(prompt)`。
- 扫描：`reactionQueueBaseOptionalClockwise.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts` -> 1 file / 2 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 849 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:27 +08：继续处理 `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` -> 1 file / 6 tests passed。
- `pirate-broadside-self-target.test.ts`：把 Broadside 基地 prompt、玩家 prompt、title/options 与三处响应命令从 `sys.interaction.current.data` / `INTERACTION_COMMANDS.RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptTitle`、`getPromptOptions`、`getPromptOption`、`respondToPrompt`。
- `pirate-broadside-self-target.test.ts`：把 Saucy Wench 的 prompt source/options 与两处响应命令改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`。
- 扫描：`pirate-broadside-self-target.test.ts` 对禁用模式与隐式 `sys.interaction`/`interaction.data`/`INTERACTION_COMMANDS` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` -> 1 file / 6 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 842 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:35 +08：继续处理 `src/games/smashup/__tests__/wildlifePreserveProtection.test.ts`；把 Seeing Stars / Unfathomable Goals 的 prompt 出现、候选过滤、响应命令、无 prompt 与错误来源读取从 `sys.interaction.current` / `prompt.data` / 手写响应命令改为 `getSimpleChoicePrompt`、`getPromptOptions`、`getPromptPlayerId`、`getPromptSourceId`、`expectNoPrompt`、`respondToPrompt`。
- 扫描：`wildlifePreserveProtection.test.ts` 对禁用模式与隐式 `interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/wildlifePreserveProtection.test.ts` -> 1 file / 15 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/wildlifePreserveProtection.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 835 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:40 +08：继续处理 `src/games/smashup/__tests__/buryEngine.test.ts`；把埋葬翻开窗口的 prompt source、按 cardUid 找候选、响应命令从 `sys.interaction.current` / `interaction.data.options` / `INTERACTION_COMMANDS.RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`。
- 扫描：`buryEngine.test.ts` 对禁用模式与隐式 `interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/buryEngine.test.ts` -> 1 file / 9 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/buryEngine.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 828 条命中；仍不能宣称整体测试框架重构完成。
- 2026-05-16 08:45 +08：继续处理 `src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts`；把海盗湾 afterScoring prompt 统计从手工 current+queue 与 `(interaction.data as any).sourceId` 改为 `getPromptsBySourceId`，把“冠军不应创建交互”从只看 queue 改为 `expectNoPrompt`。
- 扫描：`pirate-cove-repeat-trigger-bug.test.ts` 对禁用模式与隐式 `interaction.data` 裸读当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts` -> 1 file / 3 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/pirate-cove-repeat-trigger-bug.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 828 条命中；本批清的是扩展坏味道，不冒充主计数下降。
- 2026-05-16 08:52 +08：继续处理 `src/games/smashup/__tests__/pirate-king-afterscoring-window.test.ts`；把海盗王 afterScoring prompt 从 `asSimpleChoice(sys.interaction.current)` 改为 `getSimpleChoicePrompt(..., 'pirate_king_move')`，把响应命令从 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand`，最终无 prompt 改为 `expectNoPrompt`。
- 扫描：`pirate-king-afterscoring-window.test.ts` 对禁用模式与 `INTERACTION_COMMANDS` / `asSimpleChoice` 当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/pirate-king-afterscoring-window.test.ts` -> 1 file / 1 test passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/pirate-king-afterscoring-window.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 828 条命中；本批清的是扩展坏味道，不冒充主计数下降。
- 2026-05-16 08:58 +08：继续处理 `src/games/smashup/__tests__/promptE2E.test.ts`；把 Cannon / Powderkeg / Grave Digger 的 `current.data.sourceId` 断言改为 `getSimpleChoicePrompt`，无 prompt 改为 `expectNoPrompt`，Crop Circles 的手工 current+queue 拼接改为 `getPromptsBySourceId`。
- 扫描：`promptE2E.test.ts` 对禁用模式与隐式 `interaction.data` / `asSimpleChoice` 当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/promptE2E.test.ts` -> 1 file / 12 tests passed。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/promptE2E.test.ts` -> 0 errors / 0 warnings。
- 验证：`npm run test:structure` -> OK；Junction 镜像 warning 与旧泛名净删减 warning 保持，不是本批新增入口。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 821 条命中；仍不能宣称整体测试框架重构完成。
- 继续回应用户“是不是只改表象”：本批没有迁移 skipped 文件，也没有只改注释，选择真实业务复现测试里的 prompt/source/队列耦合。
- `src/games/smashup/__tests__/helpers.ts` 新增 `getPromptsBySourceId`，让“按业务 sourceId 从 current + queue 查询 prompt”集中到 facade。
- `src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts`：把 Big Gulp prompt 读取、handler data 传递、Igor prompt 计数从裸 `sys.interaction.current` / `data.sourceId` 改为 `getFirstPrompt`、`getPromptSourceId`、`getPromptOptions`、`getPromptHandlerData`、`getPromptsBySourceId`。
- `src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts`：把手工拼接 current + queue 改为 `getPromptsBySourceId`，并清理未使用 import。
- `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts`：把 Shoggoth 多步 prompt 的 source/handler data/清 current 逻辑改为 `getFirstPrompt`、`getPromptSourceId`、`getPromptHandlerData`、`withoutCurrentPrompt`。
- 扫描：上述 3 个目标文件对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` -> 3 files passed / 8 tests passed。
- 验证：`npm run test:structure` -> OK，仅 Junction warning 和旧 `pirate-cove-chain-fix.test.ts` 净删减 warning。
- 验证：`npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts src/games/smashup/__tests__/igor-rlyeh-double-trigger.test.ts` -> 0 errors；`npx eslint src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` -> 0 errors。
- 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警，不阻断。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 926 条命中；仍不能宣称整体测试框架重构完成。
- `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts`：把目标 prompt source/options 与最终无 prompt 断言改为 `getFirstPrompt`、`getPromptSourceId`、`getPromptOptions`、`expectNoPrompt`；旧泛名文件保持净新增 0。
- `src/games/smashup/__tests__/madMonsterPartyPreventedDestroy.test.ts`：把 `getInteractionsFromMS` + 手工 `sourceIds` 映射改为 `getPromptsBySourceId`。
- `src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts`：把平局 prompt source/options 读取改为 `getFirstPrompt`、`getPromptSourceId`、`getPromptOptions`，并用 `vitest.config.audit.ts` 验证。
- `src/games/smashup/__tests__/choice-audit-fixes.test.ts`：删除本地 `clearCurrentInteraction`，改用 `withoutCurrentPrompt`；多步旧 handler 测试的 prompt data/source 读取改为 `getPromptHandlerData` / `getPromptSourceId`。
- 扫描：上述 4 个目标文件对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts src/games/smashup/__tests__/madMonsterPartyPreventedDestroy.test.ts` -> 2 files passed / 2 tests passed。
- 验证：`npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts` -> 1 file passed / 8 tests passed。
- 验证：`npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/choice-audit-fixes.test.ts` -> 1 file passed / 10 tests passed。
- 验证：相关 eslint -> 0 errors；`npm run test:structure` -> OK。
- 全 `src/games/smashup/__tests__` 禁用模式剩余 913 条命中；仍不能宣称整体完成。
- 回应用户“是否只改表象”：本轮按行为 seam 继续推进，不把迁移等同完成。
- 已把 `Skeletons abilities` 从遗留巨型 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 迁到 `src/games/smashup/__tests__/abilities/skeletons.test.ts`。
- 迁出时已把交互读取/响应改走 facade：
  - `getSimpleChoicePrompt`
  - `getPromptOption`
  - `getPromptOptions`
  - `respondToPrompt`
  - `respondToPromptOptions`
- 新迁出文件扫描无命中：`it.skip` / `describe.skip` / `test.skip` / `getInteractionsFromMS` / `prompt.data.options` / `SYS_INTERACTION_RESPOND` / `sys.interaction.current`。
- 验证：
  - `npm test -- src/games/smashup/__tests__/abilities/skeletons.test.ts` -> 1 file passed / 19 tests passed。
  - `node scripts/infra/check-file-encoding.mjs src/games/smashup/__tests__/abilities/skeletons.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts` -> passed。
  - `npm test -- src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/abilities/skeletons.test.ts src/games/smashup/__tests__/abilities/fairies.test.ts src/games/smashup/__tests__/abilities/mermaids.test.ts src/games/smashup/__tests__/abilities/princesses.test.ts src/games/smashup/__tests__/abilities/werewolves.test.ts src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/abilities/vampires.test.ts` -> 8 files passed / 118 tests passed。
  - `npm run test:structure` -> OK；仅 Junction 和旧大文件债务 warning。
- 当前剩余：`newFactionAbilities.test.ts` 仍保留 `Samurai abilities` 与 `巨蚁派系能力`，其中旧内部耦合债务仍需后续迁出时消化。

---

## Session: 2026-05-15 反馈真实链路与 AI 自动反馈复核

- **Status:** completed
- 已补真实用户反馈 E2E：`e2e/feedback-real-submission.e2e.ts`。
- E2E 覆盖：大厅反馈弹窗填写匿名反馈 -> `POST /feedback` 成功 -> `/admin/feedback` API 可读 -> 后台反馈列表出现同一条 -> 详情展开显示内容、联系方式与来源。
- 已实际查看截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-real-submission\01-feedback-modal-before-submit.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-real-submission\02-admin-feedback-list-after-submit.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\feedback-real-submission\03-admin-feedback-detail-after-submit.png`
- 生产只读查询结果：
  - 最近 14 天反馈记录数：45。
  - 当前未收口：`splendor|online-ai-watchdog|open = 1`，`smashup|feedback-modal|in_progress = 1`。
  - 最新 open AI 自动反馈为 `6a05e66129cd213e03bfd82f`，内容带出 `RESERVE_OPEN_CARD:gameNotStarted`。
- 已修复 AI 自动反馈指向的真实根因：
  - `src/engine/transport/onlineAiRecovery.ts` 与 `e2e/src/engine/transport/onlineAiRecovery.ts`：未开局且非 `factionSelect` 时不再触发 active-turn legal-action watchdog。
  - `src/engine/transport/server.ts` 与 `e2e/src/engine/transport/server.ts`：`hostStarted=false` 的 public pregame 只允许 `factionSelect`。
  - `src/games/splendor/ai.ts` 与 `e2e/src/games/splendor/ai.ts`：未开局或游戏结束时不生成 Splendor AI legal actions。
- 规范修正：
  - `AGENTS.md`：补充“部署/复发观察不得卡反馈状态”。
  - `.windsurf/skills/feedback-closeout/SKILL.md`：补充 `resolved` 不以生产部署或未来复发观察为前置。
  - `.windsurf/skills/feedback-closeout/references/feedback-open-api.md`：补充状态含义。
- 生产状态回写：
  - `6a05e66129cd213e03bfd82f` 已于 `2026-05-15T15:38:58.914Z` 从 `open` 回写为 `resolved`。
  - 回写后 `open/in_progress` 只剩 `smashup|feedback-modal|in_progress = 1`。
- 已补回归：
  - `online AI watchdog 在 Splendor 未开局时不得代 AI 执行动作或写失败反馈`
  - `Splendor 未开局时不得触发 active-turn legal-action watchdog`
  - `AI 未开局时不生成会被领域层拒绝的行动`
- 验证：
  - `npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/server.ts src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/engine/transport/__tests__/server.test.ts src/games/splendor/ai.ts src/games/splendor/__tests__/smoke.test.ts` -> 0 errors
  - `npx eslint e2e/src/engine/transport/onlineAiRecovery.ts e2e/src/engine/transport/server.ts e2e/src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts e2e/src/engine/transport/__tests__/server.test.ts e2e/src/games/splendor/ai.ts e2e/src/games/splendor/__tests__/smoke.test.ts e2e/feedback-real-submission.e2e.ts` -> 0 errors
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts src/games/splendor/__tests__/smoke.test.ts --configLoader native --maxWorkers 1 --testNamePattern "Splendor 未开局|AI 未开局|Splendor 即使残留"` -> 2 files passed，3 tests passed
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "Splendor 未开局时不得代 AI|强制恢复命令失败时|自动反馈应携带交互选项|自动反馈应携带 AI 决策预览|默认上报链路不应把成功恢复类事件"` -> 1 file passed，5 tests passed
  - `node scripts/infra/run-e2e-single.mjs ci e2e/feedback-real-submission.e2e.ts "匿名用户从反馈弹窗提交后，应能在后台反馈列表看到同一条记录"` -> 1 passed
- 证据：
  - `evidence/feedback-real-submission-e2e-2026-05-15.md`
  - `evidence/engine/online-ai-watchdog-feedback-diagnostics-2026-05-15.md`

---

## Session: 2026-05-13 线上 AI 自动反馈排查与修复

- **Status:** completed
- 已读取：
  - `AGENTS.md`
  - `C:\Users\zhuagenbao\docs\本机环境速查.md`
  - `C:\Users\zhuagenbao\docs\服务器连接与生产部署入口.md`
  - `docs/deploy.md`
  - `C:\Users\zhuagenbao\.codex\skills\planning-with-files\SKILL.md`
- 已确认当前仓库有既有脏改，暂不触碰无关文件。
- 已在顶部建立本轮计划，下一步只读查询生产当前 `open/in_progress` AI 自动反馈。
- 生产只读查询结果：`open/in_progress = 7`，其中系统 AI 自动反馈 6 条，全部为 `smashup` `force-end-turn-failed`。
- 已修改 `src/engine/transport/server.ts` 与镜像路径 `e2e/src/engine/transport/server.ts`：watchdog 失败 reason 带上 command type 与真实 failure reason，并保留 pipeline 抛错后的原始失败原因。
- 已新增 `src/engine/transport/__tests__/server.test.ts` 与镜像路径回归：强制恢复命令失败时自动反馈必须包含 `command_failed:SYS_INTERACTION_RESPOND:<真实原因>`。
- 验证：
  - `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts` -> 0 errors
  - `npx eslint e2e/src/engine/transport/server.ts e2e/src/engine/transport/__tests__/server.test.ts` -> 0 errors
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "watchdog.*命令类型|stale reaction choice|reaction pass 后仍停在同一交互|batch 内命令验证失败"` -> 4 passed
  - `npm run typecheck` -> passed
- 证据：`evidence/engine/online-ai-watchdog-feedback-diagnostics-2026-05-13.md`

---

## Session: 2026-05-12 SmashUp shayu 通用入口矩阵补强与全量重审

- **Status:** in_progress
- 已读取：
  - `AGENTS.md`
  - `openspec/AGENTS.md`
  - `D:/codex-home/skills/task-completion-guard/SKILL.md`
  - `C:/Users/zhuagenbao/.codex/skills/planning-with-files/SKILL.md`
  - `.windsurf/skills/game-audit-workflow/SKILL.md`
  - `.windsurf/skills/add-new-faction/SKILL.md`
  - `docs/ai-rules/testing-audit.md`
  - `docs/ai-rules/engine-systems.md`
  - `docs/testing-best-practices.md`
  - `docs/automated-testing.md`
  - `docs/ai-rules/data-entry.md`
  - `docs/temp-files-management.md`
- 已创建 guard：`temp/smashup-shayu-full-audit-2026-05-12.json`。
- 当前动作：补强通用矩阵，随后生成 39 卡 + 6 基地全量清单并逐项 P0/P1 审计。

---

## Session: 2026-05-11 七大恨新游戏前置 intake

- **Status:** completed
- 已读取：
  - `AGENTS.md`
  - `openspec/AGENTS.md`
  - `C:\Users\zhuagenbao\.codex\skills\planning-with-files\SKILL.md`
  - `.windsurf/skills/create-new-game/SKILL.md`
  - `docs/ai-rules/asset-pipeline.md`
  - `docs/ai-rules/data-entry.md`
  - `docs/temp-files-management.md`
  - `D:\codex-home\skills\.system\skill-creator\SKILL.md`
- 已确认本轮不创建/切换分支，先做规则转档、素材入库、资源闭环、可行性分析与 skill 优化。
- 已发现项目内已有 `qidahen` 前置产物，选择核验并补齐缺口，不覆盖重做：
  - 规则 MD：`src/games/qidahen/rule/七大恨规则.md`
  - 素材清单：`src/games/qidahen/rule/七大恨素材接入清单.md`
  - 可行性分析：`evidence/qidahen/qidahen-feasibility-2026-05-11.md`
- 资源处理：
  - `npm run compress:images -- public/assets/i18n/zh-CN/qidahen` -> 70 张，WebP 输出约 4.65 MB。
  - `npm run compress:images -- public/assets/qidahen` -> 1 张缩略图，WebP 输出约 42.5 KB。
  - `npm run assets:manifest && npm run assets:validate` -> 5 个 manifest 校验通过。
  - `npm run assets:check` -> 发现 71 个 qidahen 新增远端缺失资源。
  - `npm run assets:upload` -> 上传 71，跳过 1875，删除 0，失败 0。
  - 远端 HEAD 抽查 `main-board.webp` / `ming-deck-atlas.webp` / `cover.webp` 均返回 200。
- 已更新：
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `.windsurf/skills/create-new-game/SKILL.md`
  - `src/games/qidahen/rule/七大恨素材接入清单.md`
  - `evidence/qidahen/qidahen-feasibility-2026-05-11.md`
- 错误记录：
  - PowerShell 不支持 Bash heredoc：`python - <<'PY'` 失败；后续改用 PowerShell 原生命令。
  - 一次远端 HEAD 抽查命令因空管道解析失败；修正为先收集 `$rows` 再格式化输出。
- 收口：
  - `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\create-new-game` -> `Skill is valid!`
  - 已复核本轮相关 git status；仓库仍有大量无关历史脏改，本轮未处理。

---

## Session: 2026-05-10 命令执行异常全链路修复
- **Status:** in_progress
- Actions taken:
  - 已按线上反馈源确认本轮命令异常相关反馈：`6a006a1cd5153682969e5f53`、`6a005f68d5153682969e5c7d`、`6a00549bd5153682969e59d3`。
  - 已定位传输层根因：`executeCommandInternal()` 真实错误在 batch 回滚时被 `handleBatch()` / `executeBatchInternal()` 折叠成固定 `command_failed`。
  - 已定位前端展示根因：`MatchRoom.tsx` 将 `command_failed` 归为静默系统错误；`GameProvider` batch rejection 也跳过 `command_failed` 的 `onError`。
  - 已修复 `src/engine/transport/server.ts`、`src/engine/transport/react.tsx`、`src/pages/MatchRoom.tsx`，并补对应聚焦测试。
  - 已补证据文档：`evidence/transport-command-error-full-chain-fix-2026-05-10.md`。
  - 用户确认此前“长舟”应理解为“大杀四方 / SmashUp”，已重新归类到 SmashUp 命令异常链路。
  - 已定位“长舟”为 SmashUp `base_drakkar`（德拉卡尔号 / Drakkar），不是 SummonerWars；旧归类结论已在 evidence 中修正。
  - 已确认回归来源：`a4de3636` 引入运行时 `effectContract` 后，`base_drakkar` 手写契约漏 `playLimits` / `discardState` / `opensInteraction`，导致合法能力被 contract 误拦截；transport 再把真实错误折叠为 `command_failed`。
  - 已新增真实链路回归：`base_drakkar 通过 PLAY_MINION 真实触发链时不会被资源契约误拦截`，同步到 `src` 与 `e2e/src` 镜像。
- Verification:
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_the_asylum|effect contract"`：5 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_ninja_dojo|base_castle_blood"`：7 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "base_drakkar"`：4 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "未知结构不靠 legacy contract|effect contract|base_the_asylum|base_ninja_dojo|base_castle_blood|base_drakkar"`：5 files passed，17 tests passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "batch 内命令验证失败时应透传领域错误码|batch 内 pipeline 异常时应透传异常详情|batch expectedStateID"`：3 passed。
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online command error visibility|shouldSilentlyRetryOnlineAiBatchRejection"`：3 passed。
  - `npm run typecheck`：passed。
  - `git diff --check -- src/engine/transport/server.ts src/engine/transport/react.tsx src/pages/MatchRoom.tsx src/engine/transport/__tests__/server.test.ts src/pages/__tests__/matchSeatValidation.test.ts`：无空白错误，仅 LF→CRLF 提示。
- Remaining:
  - 当前只跑了单测/领域 pipeline 聚焦验证；本轮没有跑浏览器 E2E，因此最终汇报不得把 E2E 截图作为证据。
## Session: 2026-05-09 DiceThrone Treant / Ninja 新英雄

- **Status:** in_progress
- **Worktree:** `D:\gongzuo\webgame\BoardGame\.worktrees\dicethrone-treant-ninja`
- 已读取：
  - `AGENTS.md`
  - `.windsurf/skills/data-entry-workflow/SKILL.md`
  - `docs/games/dicethrone/workflows/dicethrone-hero-intake.md`
  - `docs/ai-rules/data-entry.md`
  - `docs/ai-rules/asset-pipeline.md`
  - `docs/ai-rules/testing-audit.md`
  - `docs/testing-best-practices.md`
- 已创建 detached worktree，没有新建分支。
- 新 worktree 初始不含用户提供的 `treant` / `ninja` 图片，已从主工作树复制到：
  - `public/assets/i18n/zh-CN/dicethrone/images/treant`
  - `public/assets/i18n/zh-CN/dicethrone/images/ninja`
- 错误记录：
  - 第一次复制用了 `Copy-Item -LiteralPath ...\*`，失败；随后改用 `Copy-Item -Path ...\*` 成功。
- 下一步：
  - 盘点现有 DiceThrone 英雄目录、枪手/成熟旧英雄的资源合同、atlas 配置与注册入口。
  - 生成 S0 真相源/核对合同初稿。

---

## Addendum: 2026-05-07 审计流程已升级为“深度审计流程”硬门禁

- 已回写并更新审计规范：
  - `docs/ai-rules/testing-audit.md`
- 本轮不是只补 `D37` / `D40` 两个维度说明，而是把“执行层级不够深”正式改成可执行流程：
  - 审计前必须先建对象清单，并给每个对象标 `L0/L1/L2/L3/L4`
  - 每个对象必须串完整链路：`规则语义 -> 静态定义 -> validator -> command/reducer -> afterEvents/postProcess -> UI 出口 -> 真实入口验证`
  - 命中 reaction / afterScoring / onDestroy / 动态候选 / 恢复态 / 同批事件后处理时，L3 真实入口证据变成强制项
  - 命中共享 reducer / handler / pipeline / transport 根因时，必须自动扩审，不能只修当前反馈
  - 旧 evidence 结论被新 bug 推翻时，必须原地降级并回写，不再允许“旧文档继续挂已审计”
- 本轮新增的流程目标是：
  - 不再把“看过代码”“跑过单测”“prompt 弹出来了”当成“已深入审计”
  - 把 `D37` 的 live options / `zone-location` 前置条件核对，以及 `D40` 的批内副作用串行推进，升级成强制深审位点

## Session: 2026-05-03 线上反馈持续修复
- **Status:** completed
- Actions taken:
  - 已确认本轮依据的来源类别是 **线上反馈源**，不是仓库里的历史导出文档。
  - 已读取生产 SSH / 部署入口与反馈处理规则，确认生产机为 `8.148.71.102:/home/admin/BoardGame`。
  - 已发现阻塞根因：
    - 生产 `GET /admin/feedback` 返回 `500`
    - `boardgame-mongodb` 因 `FTDC diagnostic.data` 写失败持续重启
    - 根盘 `/dev/vda3` 一度 `100%` 打满
  - 已核实磁盘占用并锁定最小释放点：
    - `boardgame-game-server` Docker 日志单文件约 `13G`
  - 已执行最小风险止血：
    - 截断 `boardgame-game-server` 单个日志文件
    - 根盘可用空间恢复到约 `13G`
  - 已确认 `boardgame-mongodb` 恢复正常启动，线上 `/admin/feedback?status=open` 恢复可读。
  - 已将当前线上快照落盘：
    - `temp/feedback-online/current-open-20260503.json`
    - `temp/feedback-online/current-in-progress-20260503.json`
  - 已确认当前线上盘面：
    - `open = 20`
    - `in_progress = 0`
    - `open` 结构：`dicethrone|feedback-modal = 7`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 3`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
  - 已识别当前最高优先级：
    - `splendor` watchdog 死循环仍在持续增长，并直接制造巨量生产日志
    - `dicethrone` watchdog / 用户“枪手防御+转移状态卡死”疑似同链路
    - `smashup` watchdog 仍有 `visible-interaction` 阻塞聚合项
  - 已完成 `splendor` transport 本地止血修复：
    - `src/engine/transport/onlineAiRecovery.ts`：对 `splendor` 禁止生成裸 `ADVANCE_PHASE` watchdog fallback / follow-up
    - `src/engine/transport/server.ts`：watchdog 会按 manifest 过滤 AI 能力，`splendor` 这类 `localAi=false` 的游戏不会再因残留 seat metadata 被当成 AI 房间
  - 已完成本地最小验证：
    - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts`：`15 passed`
    - `src/engine/transport/__tests__/server.test.ts` 聚焦 `splendor + summonerwars`：`2 passed`
    - `npm run typecheck`：通过
  - 已完成 `dicethrone` 聚焦验证：
    - `basic-commands-coverage.test.ts`：通过
    - `response-window-interaction-lock.test.ts`：通过
    - `flow.test.ts` 中 `targetingRoll / defensive / displayOnly / bonus` 相关聚焦用例：通过
    - 说明：`flow.test.ts` 整文件仍有 2 条旧断言失败，现象是仍期待 `main2`，实际已停在 `defensiveRoll`；当前未把它们当成本轮线上反馈阻塞项
  - 已完成 `smashup` 聚焦验证：
    - `server.test.ts` 中 `visible-interaction / recover-interaction / mandatory-order / interaction chain` 相关用例：通过
    - `scoreBases-auto-continue.test.ts`：通过
  - 已补齐 `smashup` transport 闭环：
    - `src/engine/transport/__tests__/server.test.ts` 新增 “`smashup` 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 `blocker_persisted`”
    - 定向复跑：
      - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted|visible-interaction-chain|交互恢复后若同一 AI 只剩自然过阶段"` → `2 passed`
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native --maxWorkers 1 --testNamePattern "失效 special 快照"` → `2 passed`
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/commandsValidation.test.ts --configLoader native --maxWorkers 1 --testNamePattern "legacy Me First"` → `1 passed`
  - 已完成 `splendor` 生产止血复核：
    - 发现 `Nh_5xVWO0km` 不在 `/internal/rooms` 列表中，但 `boardgame-game-server` 单进程仍持续对其执行 watchdog
    - 先尝试 game-server 内部 `DELETE /internal/rooms/Nh_5xVWO0km`，返回 `200 {"deleted":true}`，但未能阻止日志继续增长
    - 进一步确认容器内只有 1 个 Node 进程，判断为单进程幽灵 active match；在 `/internal/rooms` 全量为空的前提下，执行 `docker restart boardgame-game-server`
    - 重启后复核：
      - `curl http://127.0.0.1/health` 返回 `{"status":"ok",...}`
      - `docker logs --since 1m boardgame-game-server | grep -E 'Nh_5xVWO0km|l_nV1EVQkNG|2mAr8CtKjlP'` 无输出
      - `69f6c4bc9ec13b96d710e10d` 停在 `occurrenceCount=417 / lastOccurredAt=2026-05-03T17:40:12.626Z`
  - 已确认 `splendor` 在 2026-05-04 晚间再次复发，不是一次性残留：
    - `2026-05-04 23:29:57` 到 `23:33:09`，生产日志持续出现 `matchId=cWGQSaUXt1B`
    - `failureCount` 从 `1998` 连续增长到 `2022`
    - 现象仍是 `ADVANCE_PHASE -> unknownCommand`
  - 已确认标准镜像链当前还拿不到这次修复：
    - 当前官方 `ghcr.io/zhuanggenhua/boardgame-game:latest` bundle 哈希仍是 `19197f1831000ccc603df12fc1d21ffb353ef2d6a0f0baf4619dd166d7b24b8f`
    - 该官方 bundle 中查不到本轮新增修复特征字符串 `display-only-bonus`
  - 已执行最小风险生产热补：
    - 先把本地已验证的 `src/engine/transport/onlineAiRecovery.ts` 同步到远端源码仓库
    - 为让现有 `server.ts` 在远端旧仓库上可编译，补齐最小依赖同步：`src/engine/transport/storage.ts`、`src/engine/ai/**`、`src/engine/systems/UndoSystem.ts`
    - 远端宿主机 `Node 22` 直接跑 `build-node-bundle.mjs` 仍解析失败；随后改用 `ghcr.io/zhuanggenhua/boardgame-game:latest` 的 `Node 24` 容器挂载远端仓库编译
    - 成功产出热补 bundle：
      - `temp/prod-bundles/game/server.mjs` → `809aebcda8ddbe4d99ab98e3b997e57cce7af2417527a008741cdf229b81230d`
      - `temp/prod-bundles/game/server.mjs.map` → `91dade1ff134f10b3e85a1a8b4882cb90bcca52bdfd7790916f6d16927d4a5de`
    - 已将该 bundle 覆盖到生产容器 `/app/server.mjs` 与 `/app/server.mjs.map` 并重启 `boardgame-game-server`
  - 已完成热补后的生产复核：
    - `docker exec boardgame-game-server sha256sum /app/server.mjs /app/server.mjs.map` 与热补产物哈希完全一致
    - `2026-05-03T23:51:12.821Z` 复核 `curl http://127.0.0.1/health` 返回 `{"status":"ok",...}`
    - 再观察 `70s` 日志窗口，`grep 'cWGQSaUXt1B'` 与 `grep 'online-ai-watchdog failed'` 都为空
  - 已补充回退物料：
    - 热补 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.hotfix.mjs`
    - 官方镜像原始 bundle：`/home/admin/hotfix-backups/20260504-splendor-watchdog/server.registry-latest.mjs`
  - 已完成 `69f5be8c9ec13b96d710baa4` 的最小线上回写：
    - 先通过生产 Mongo 直查确认该条仍为 `open`，来源 `feedback-modal`、`severity=critical`
    - 结合既有 evidence 与 transport 回归后执行 `resolved` 回写，结果 `matched=1 / modified=1`
    - 产物：`temp/feedback-closeout/update-feedback-status-20260504-69f5be8c-to-resolved.raw.txt`
  - 已完成回写后盘面复核：
    - `temp/feedback-online/post-69f5be-resolved-summary-20260504.json` 已确认该条当前为 `resolved`
    - 当前 `openTotal = 20`
    - 聚类更新为：`dicethrone|feedback-modal = 6`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 4`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f7ac9d9ec13b96d710fded` 的本地最小定位与修复：
    - 生产快照显示 `smashup_reaction_choose` 同一 prompt 内重复出现两次 `activate_special:titan:titan_2_wizards_arcane_protector:3`
    - `src/games/smashup/domain/reactionSession.ts` / `e2e/src/games/smashup/domain/reactionSession.ts` 已补 `reaction option` 去重，并在 `resolveSmashUpReactionChoice(...)` 里先按 live session 正规化持久化 special choice
    - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` 定向复跑：
      - `smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass` → `passed`
      - `smashup_reaction_choose 响应持久化后的失效 special 快照时，应按当前 live 语义正规化并直接收口` → `passed`
      - `smashup_reaction_choose 构建反应选项时，应去重重复的泰坦 special 候选` → `passed`
  - 已顺手修平当前最小编译阻塞：
    - `src/games/smashup/abilities/innsmouth.ts` / `e2e/src/games/smashup/abilities/innsmouth.ts` 补上缺失的 `registerInteractionHandler` import
  - 已完成 `smashup` transport/watchdog 聚焦复跑：
    - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted|online AI watchdog 应优先执行 AI 合法动作来解除可见交互阻塞，而不是直接 force-end-turn|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"` → `3 passed`
  - 已按当前任务口径完成 `69f7ac9d...` 回写：
    - 用户已明确：`resolved` 表示“本地已经修好”，不是“已经上传/上线”
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 回写后复核：`status=resolved`，`updatedAt=2026-05-04T01:09:30.102Z`
    - 再拉线上盘面：`openTotal = 19`；`smashup|online-ai-watchdog` 从 `4` 降到 `3`
  - 已完成 `69f4acdf9ec13b96d7109f30` 的最小线上回写：
    - 生产 Mongo 直查确认该条仍为 `open`，来源 `feedback-modal`、`severity=critical`
    - 现场权威态显示 Barbarian 在 `main2` 手里持有 `card-dizzy`；本地已有 `card-dizzy` 真实 E2E 证据，证明攻击后 `afterAttackResolved` 响应窗中该牌可打出并施加 `Concussion`
    - 回写结果：`matched=1 / modified=1`
    - 产物：`temp/feedback-closeout/update-feedback-status-20260504-69f4acdf-to-resolved.raw.txt`
  - 已完成 `69f5c17f9ec13b96d710bb03` 的线上回写：
    - 该条是 `smashup_reaction_choose` 的 `scoreBases` / stale reaction choice 聚合项
    - 依托现有 transport 闭环补测和 runtime 收口证据，按“本地已修即 resolved”回写
    - 回写结果：`matched=1 / modified=1`
    - 产物：`temp/feedback-closeout/update-feedback-status-20260504-69f5c17f-to-resolved.raw.txt`
  - 已完成 `69f423585cacc4e6b5cdbdbf` 的线上回写：
    - 该条是 `69f5c17f...` 的更早同类 `scoreBases` 聚合项，按同一证据链收口
    - 回写结果：`matched=1 / modified=1`
    - 产物：`temp/feedback-closeout/update-feedback-status-20260504-69f42358-to-resolved.raw.txt`
  - 已完成新一轮回写后盘面复核：
    - 当前 `openTotal = 16`
    - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`smashup|online-ai-watchdog = 1`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f479c69ec13b96d71099e3` 的线上回写：
    - 先补本地 transport 修复：`src/engine/transport/server.ts` 允许 SmashUp `endTurn` mandatory 顺序交互在 legal action 耗尽后继续 fallback `ADVANCE_PHASE`
    - 已新增并跑通聚焦回归：
      - `smashup mandatory reaction ordering falls back to first trigger instead of cancel`
      - `watchdog falls back to first trigger respond for smashup mandatory reaction ordering`
      - `watchdog falls back to first trigger respond for smashup onTurnEnd mandatory reaction ordering`
      - `online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：`temp/feedback-closeout/update-feedback-status-20260504-69f479c6-to-resolved.raw.txt`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 15`
    - 聚类更新为：`dicethrone|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f21b05ab54eadcc2bb2b9e` 的线上回写：
    - 生产现场末尾事件显示该条停在 DiceThrone 枪手 `targetingRoll -> Loaded token -> bonus die` 收口链：`CHOICE_REQUESTED(targeting-roll)`、`CHOICE_RESOLVED`、`CHOICE_REQUESTED(offensiveRollEndToken)`、`BONUS_DICE_REROLL_REQUESTED` 后，系统落成 `sys.phase=targetingRoll`、`flowHalted=true`、`interaction.queue=[]`
    - 该条与已收口 `69f5be8c...` 的 `displayOnly / pendingBonusDiceSettlement / hidden response` 链路同簇，也共享 `69f04210...` 的 `targetingRoll` 推进缺口与 Android `AppUpdatePlugin` 噪音
    - 已复跑本地聚焦验证：
      - `src/games/dicethrone/__tests__/flow.test.ts` 中 `targetingRoll` 4 条聚焦用例 -> `4 passed`
      - `src/engine/transport/__tests__/server.test.ts` 中 `displayOnly / hidden interaction / watchdog` 5 条聚焦用例 -> `5 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `evidence/dicethrone/dicethrone-feedback-69f21b05-ai-stall-targetingroll-loaded-local-closeout-2026-05-04.md`
      - `temp/feedback-closeout/update-feedback-status-20260504-69f21b05-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-4-summary.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 14`
    - 聚类更新为：`dicethrone|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f2a81c5cacc4e6b5cdb4e5` 的线上回写：
    - 生产快照显示该条并非仍卡死，而是已完整走完 `token response` 收口链：`TOKEN_RESPONSE_REQUESTED -> TOKEN_USED -> TOKEN_RESPONSE_CLOSED -> ATTACK_RESOLVED -> SYS_PHASE_CHANGED(defensiveRoll -> main2)`
    - 终态为：`sys.phase=main2`、`flowHalted=false`、`interaction.queue=[]`、`pendingAttack=null`
    - 该条与已修的 DiceThrone `pendingInteractionId / hidden response / token response` 问题簇一致，属于“已修未回写”
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `evidence/dicethrone/dicethrone-feedback-69f2a81c-token-modal-target-restore-local-closeout-2026-05-04.md`
      - `temp/feedback-closeout/update-feedback-status-20260504-69f2a81c-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-5-summary.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 13`
    - 聚类更新为：`dicethrone|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f31c695cacc4e6b5cdb992` 的线上回写：
    - 项目现有审计 `evidence/dicethrone-4p-attack-modifier-targeting-roll-audit-2026-04-30.md` 已直接点名同一时间戳、同一反馈原文“再来点这张卡自己整个回合都用不了”
    - 根因是 4 人 `targetingRoll` 自动目标窗口里，攻击修正卡旧逻辑误死绑 `pendingAttack.defenderId`
    - 2026-05-04 已复跑当前代码基线下最关键的 2 条聚焦回归：`攻击修正卡可在 defenderId 写回前直接结算到自动目标`、`Loaded token 的奖励骰特写应命中自动目标` -> `2 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `evidence/dicethrone/dicethrone-feedback-69f31c69-more-please-targetingroll-local-closeout-2026-05-04.md`
      - `temp/feedback-closeout/update-feedback-status-20260504-69f31c69-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-6-summary.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 12`
    - 聚类更新为：`dicethrone|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`smashup|feedback-modal = 7`、`splendor|online-ai-watchdog = 1`
  - 已完成 `69f18ca4ab54eadcc2bb2322` 的线上回写：
    - 生产快照仍在 `defensiveRoll`，但底层骰子数据已存在：`core.dice` 含 `value/symbol/isKept`，`pendingAttack.defenseAbilityId=thick-skin`，无 `errorContext`
    - 该条与已收口 `69cba605...` 的共享骰面可见性修复簇一致
    - 已复跑共享 fallback 单测：`dice sprite 缺失时应渲染可见骰面文本兜底，避免整块空白` -> `1 passed`
    - 额外尝试复跑共享 E2E，但测试 runtime 在启动游戏服务阶段提前退出，未进入业务断言；因此本条沿用既有共享截图证据
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `evidence/dicethrone/dicethrone-feedback-69f18ca4-defensive-dice-visibility-local-closeout-2026-05-04.md`
      - `temp/feedback-closeout/update-feedback-status-20260504-69f18ca4-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-7-summary.json`
  - 已完成 `69f1978dab54eadcc2bb24b0` 的线上回写：
    - 这条只留下 route 级“游戏中途加载失败”，没有 `stateSnapshot` / `errorContext` / 同局系统反馈
    - 按明确推断口径并入同日 DiceThrone 全局 HUD 加载失败簇：`69f1f938...`、`69f1f943...`
    - 已重跑同簇本地验证：`chatSelectionLogic.test.ts` -> `14 passed`，`npm run build` -> 成功
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `evidence/dicethrone/dicethrone-feedback-69f1978d-midmatch-load-failure-local-closeout-2026-05-04.md`
      - `temp/feedback-closeout/update-feedback-status-20260504-69f1978d-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-8-summary.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 10`
    - 聚类更新为：`smashup|feedback-modal = 7`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - `dicethrone|feedback-modal = 0`
  - 已发现并修正本轮状态回写入口偏差：
    - 本地 `.env` 中的 `MONGO_URI` 指向 `localhost:27017/boardgame`，不是生产 Mongo
    - 因此后续线上状态回写继续统一走 `SSH + docker exec boardgame-mongodb mongosh boardgame`，避免把本机库误当成生产真源
  - 已完成 `69f27faaab54eadcc2bb2c77` 的本地 closeout 与线上回写：
    - 反馈原文：`蒸汽朋克卡牌差分机可以无限抽牌`
    - 已补证据：`evidence/smashup/smashup-feedback-69f27faa-difference-engine-local-closeout-2026-05-04.md`
    - 已复跑并通过本地聚焦验证：
      - `src/games/smashup/__tests__/turnCycle.test.ts` 中 `endTurn 反应交互结算后不会把同一组 onTurnEnd trigger 重新入队|回合结束时额外抽牌超过上限不会停在弃牌，直接进入下一回合` -> `2 passed`
      - `src/games/smashup/__tests__/expansionOngoing.test.ts` 中 `steampunk_difference_engine` -> `3 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f27faa-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-9-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch9.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch9.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 9`
    - 聚类更新为：`smashup|feedback-modal = 6`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f01fd49b68d90ee983669d`、`69f27a5dab54eadcc2bb2c75`、`69f385d75cacc4e6b5cdbd4a`、`69f387a35cacc4e6b5cdbd4c`、`69f544f99ec13b96d710ae00`、`69f5469a9ec13b96d710ae26`
  - 已完成 `69f27a5dab54eadcc2bb2c75` 的本地 closeout 与线上回写：
    - 反馈原文：`因为忍者侍从打出的随从无法触发打出效果`
    - 已补证据：`evidence/smashup/smashup-feedback-69f27a5d-ninja-acolyte-onplay-local-closeout-2026-05-04.md`
    - 已复跑并通过本地聚焦验证：
      - `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 中 `忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择` -> `1 passed`
      - `src/games/smashup/__tests__/baseFactionOngoing.test.ts` + `src/games/smashup/__tests__/newFactionAbilities.test.ts` 联跑 `忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择|cowboys_gunfighter 打出后可与同基地敌方随从决斗并消灭失败者` -> `2 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f27a5d-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-10-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch10.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch10.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 8`
    - 聚类更新为：`smashup|feedback-modal = 5`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f01fd49b68d90ee983669d`、`69f385d75cacc4e6b5cdbd4a`、`69f387a35cacc4e6b5cdbd4c`、`69f544f99ec13b96d710ae00`、`69f5469a9ec13b96d710ae26`
  - 已完成 `69f385d75cacc4e6b5cdbd4a` 的本地 closeout 与线上回写：
    - 反馈原文：`大杀四方  小妖精的泰坦效果没有触发  效果是触发有或者的效果时  一回合一次能两个效果全部触发   但我只能选择一个触发`
    - 已补证据：`evidence/smashup/smashup-feedback-69f385d7-spirit-of-the-forest-puck-local-closeout-2026-05-04.md`
    - 已复跑并通过本地聚焦验证：
      - `src/games/smashup/__tests__/newFactionAbilities.test.ts` + `src/games/smashup/__tests__/commandsValidation.test.ts` 联跑 `fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过|fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度` -> `2 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f385d7-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-11-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch11.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch11.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 7`
    - 聚类更新为：`smashup|feedback-modal = 4`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f01fd49b68d90ee983669d`、`69f387a35cacc4e6b5cdbd4c`、`69f544f99ec13b96d710ae00`、`69f5469a9ec13b96d710ae26`
  - 已完成 `69f544f99ec13b96d710ae00` 的本地 closeout 与线上回写：
    - 反馈原文：`为什么出现了选择反应，然后选择轮回者又没效果，然后之前还有选择名人堂和大法师结算顺序，有什么意义`
    - 已补证据：`evidence/smashup/smashup-feedback-69f544f9-returned-one-reaction-order-local-closeout-2026-05-04.md`
    - 线上现场已确认：《轮回者》最终确实已埋进《名人堂》下方，当前权威态没有卡死或残留交互
    - 现有浏览器级证据已明确说明《轮回者》打出后先进入 `smashup_reaction_choose` 再收口是当前真实语义
    - 本轮 fresh 复跑 `archmageE2E` 时，被当前工作区内 unrelated 的 `ancient_egyptians` 初始化错误阻塞，未扩大范围去修无关脏改
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f544f9-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-12-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch12.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch12.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 6`
    - 聚类更新为：`smashup|feedback-modal = 3`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f01fd49b68d90ee983669d`、`69f387a35cacc4e6b5cdbd4c`、`69f5469a9ec13b96d710ae26`
  - 已完成 `69f387a35cacc4e6b5cdbd4c` 的本地 closeout 与线上回写：
    - 反馈原文：`按效果我应该加2战力  而不是减2`
    - 已补证据：`evidence/smashup/smashup-feedback-69f387a3-daisy-chain-sign-local-closeout-2026-05-04.md`
    - 线上现场已确认：`fairies_tinx` 当前控制者是 `0`，其身上的《雏菊花环 / Daisy Chain》拥有者是 `2`
    - 当前仓库中英文 locale 文案与 `src/games/smashup/abilities/ongoing_modifiers.ts` 现有实现一致：`ownerId === controller` 才是 `+2`，否则就是 `-2`
    - 本条不是实现 bug，而是用户误读规则；本轮无需改代码，按“本地已验真相 + 未回写状态”处理
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f387a3-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-13-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch13.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch13.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 5`
    - 聚类更新为：`smashup|feedback-modal = 2`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f01fd49b68d90ee983669d`、`69f5469a9ec13b96d710ae26`
  - 已完成 `69f01fd49b68d90ee983669d` 的本地 closeout 与线上回写：
    - 反馈原文：`没法选择打出斯芬克斯`
    - 已补证据：`evidence/smashup/smashup-feedback-69f01fd4-sphinx-play-selection-local-closeout-2026-05-04.md`
    - 线上现场已确认：当前不是“无目标”，而是已经进入 `titan_sphinx_start_turn` 真实交互；实际选择位点在基地下方埋葬牌区域，不是单独的 `Sphinx` 按钮
    - 已复跑并通过本地聚焦验证：
      - `src/games/smashup/__tests__/smashup.smoke.test.ts` 中 `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互|狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互` -> `2 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f01fd4-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-14-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch14.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch14.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 4`
    - 聚类更新为：`smashup|feedback-modal = 1`、`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - 当前剩余 `smashup|feedback-modal`：`69f5469a9ec13b96d710ae26`
  - 已完成 `69f5469a9ec13b96d710ae26` 的本地 closeout 与线上回写：
    - 反馈原文：`着魔没效果，目标随从没有附加行动卡`
    - 已补证据：`evidence/smashup/smashup-feedback-69f5469a-bewitched-attach-local-closeout-2026-05-04.md`
    - 线上 action log 已直接记录多次《着魔》真实附着：`附加持续战术： 着魔 -> c24 / c6`
    - 当前终态看不到附着卡本体，是因为链路已经继续推进到宿主与《着魔》都离场后的更后拍，不等于前面没有附着成功
    - 已复跑并通过本地聚焦验证：
      - `src/games/smashup/__tests__/newFactionAbilities.test.ts` 中 `world_champs_bewitched 离场转移交互可把持续行动从弃牌堆重新附着` -> `1 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-69f5469a-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-15-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch15.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch15.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 3`
    - 聚类更新为：`dicethrone|online-ai-watchdog = 2`、`splendor|online-ai-watchdog = 1`
    - `smashup|feedback-modal = 0`
  - 已完成 `69f471da9ec13b96d7109902`、`69f73be49ec13b96d710f1c2` 的本地 closeout 与线上回写：
    - 两条都是 DiceThrone watchdog 系统单：`force-end-turn-failed active-turn-legal-only:follow-up-advance:legal_action_unavailable`
    - 已补证据：`evidence/dicethrone/dicethrone-watchdog-69f471da-69f73be4-legal-only-followup-local-closeout-2026-05-04.md`
    - 线上当前只剩 watchdog 聚合摘要；两条分别停在 `occurrenceCount=2563` 与 `occurrenceCount=2`，已无可继续复核的真实残局
    - 本轮 fresh 复跑并通过：
      - `src/engine/transport/__tests__/server.test.ts` 中 `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留|dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口` -> `3 passed`
    - 生产 Mongo 回写结果：`matched=2 / modified=2`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-dicethrone-watchdogs-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-16-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch16.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch16.json`
  - 已完成最新盘面复核：
    - 当前 `openTotal = 1`
    - 聚类更新为：`splendor|online-ai-watchdog = 1`
  - 已完成 `69f6c4bc9ec13b96d710e10d` 的本地 closeout 与线上回写：
    - 反馈原文：`[system][online-ai-watchdog] force-end-turn-failed active-turn:follow-up-advance:command_failed`
    - 已补证据：`evidence/splendor/splendor-watchdog-69f6c4bc-followup-command-failed-local-closeout-2026-05-04.md`
    - 当前本地修复已明确覆盖：Splendor 不再生成裸 `ADVANCE_PHASE` fallback，且 manifest `localAi=false` 时 watchdog 会忽略残留 AI seat metadata
    - 本轮 fresh 复跑并通过：
      - `src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts` 中 `Splendor 即使残留了 AI seat metadata，也不得生成裸 ADVANCE_PHASE fallback` -> `1 passed`
      - `src/engine/transport/__tests__/server.test.ts` 中 `online AI watchdog 对 manifest 明确禁用 AI 的 splendor 应忽略残留 seatControllers` -> `1 passed`
    - 生产 Mongo 回写结果：`matched=1 / modified=1`
    - 产物：
      - `temp/feedback-closeout/update-feedback-status-20260504-splendor-watchdog-to-resolved.raw.txt`
      - `temp/feedback-online/post-20260504-resolved-batch-17-summary.json`
      - `temp/feedback-online/current-open-20260504-after-batch17.json`
      - `temp/feedback-online/current-in-progress-20260504-after-batch17.json`
  - 已完成最终盘面复核：
    - 当前 `openTotal = 0`
    - 当前 `inProgressTotal = 0`
    - 聚类已清空：`{}`
- Next:
  - 当前轮次目标已完成；若后续需要继续推进，可把 `splendor` 热补收敛为正式镜像发布路径，但它不阻塞本轮 `resolved=本地已修好` 的收口。

## Session: 2026-04-30 Smash Up 三派系重审续跑
- **Status:** completed
- Actions taken:
  - 已补 `World Champs / 世界冠军`、`Skeletons / 骷髅` 三条基地层对象级 L3：
    - `竞技场 / base_arena`
    - `名人堂 / base_hall_of_fame`
    - `藏骨堂 / base_ossuary`
  - 已新增证据文档：
    - `evidence/smashup/smashup-world-champs-skeletons-bases-e2e-2026-04-30.md`
  - 已明确收紧剩余范围：
    - `World Champs` 基地层残留已清空，当前只剩《武士 陈》正路径是否继续单独补 L3 的冻结说明
    - `Skeletons` 基地层残留已清空；`埋骨地 / base_boneyard` 作为无能力基地仅保留卡图/索引一致性冻结说明
  - 已完成本轮定向验证：
    - `竞技场` E2E：`1 passed`
    - `名人堂` E2E：`1 passed`
    - `藏骨堂` E2E：`1 passed`
    - `expansionBaseAbilities` 聚焦：`2 passed`
  - 已补 `Mermaids / 美人鱼` 三条剩余对象级 L3：
    - `塞壬`
    - `诱惑者`
    - `无人岛`
  - 补证过程中抓到 1 个真实 UI 缺口：
    - `BaseZone` 玩家列分数徽章没有走 `getPlayerEffectivePowerOnBase(...)`
    - 导致《塞壬 / 无人岛 / 魅惑 / 人鱼暗礁》这类“只影响控制者总力量、不影响基地总力量”的牌在浏览器里显示错误
  - 已修复：
    - `src/games/smashup/ui/BaseZone.tsx`
    - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - 已新增证据文档：
    - `evidence/smashup/smashup-mermaids-siren-temptress-desert-island-e2e-2026-04-30.md`
  - 已回写总审计：
    - `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`
  - 已补 `World Champs / 世界冠军` 最后 1 条对象级正路径 L3：
    - `武士 陈`
  - 已新增证据文档：
    - `evidence/smashup/smashup-world-champs-samurai-chan-e2e-2026-04-30.md`
  - 验证结果：
    - `塞壬` E2E：`1 passed`
    - `诱惑者` E2E：`1 passed`
    - `无人岛` E2E：`1 passed`
    - `ongoingModifiers` 聚焦：`6 passed`
    - `typecheck`：通过
    - `武士 陈` 聚焦 Vitest：`2 passed`
    - `武士 陈` E2E：`1 passed`
  - 已确认最终验收口径：
    - 不是每张卡都机械要求 E2E。
    - 当前批次强制补到 E2E 的对象，只限历史投诉对象、真实入口链路、reaction session、阶段切换、UI 出口与曾出过“领域对 / UI错”问题的对象。
  - Next:
    - 无；本批三派系重审已完成最终收口。

## Session: 2026-04-24 Feedback cleanup audit
- **Status:** completed
- Actions taken:
  - 已实修反馈 `69a440ea1eb921c6091f1231`（DiceThrone 教程把弃牌堆写成左侧）：
    - 修复 `public/locales/en/game-dicethrone.json` 的 `sellCardIntro / undoSellIntro`，统一为 `on the right`。
    - 运行 `npm run i18n:check`，结果 `no missing keys detected`。
    - 证据文档：`evidence/dicethrone/dicethrone-feedback-69a440ea-tutorial-discard-side-fix-2026-04-24.md`。
  - 已对当前线上 `open` / `in_progress` 反馈做首轮清洗，避免把历史脏单直接当作真实待修列表。
  - 汇总清单已写入 `temp/feedback-cleanup-audit-2026-04-24.md`。
  - 已区分两类：`已修未关`、`需复核是否回归`。
  - 当前收敛出的 4 条存疑项：DiceThrone 黑屏、DiceThrone 获得 3cp 后伤害不对、DiceThrone 波纹造成伤害但没有掉血、SummonerWars 撤回特别慢 / 放大镜功能没了。

## Session: 2026-04-07 Android 本地素材包图片加载故障
- **Status:** completed
- Actions taken:
  - 复核 `GamePackagePlugin` / `GamePackageForegroundRuntime` / `packageManagerService` / `AssetLoader` / `OptimizedImage` 链路，确认原生素材包会安装到 `.../current/assets`，问题不在下载落盘本身。
  - 修复 `src/features/mobile-packages/packageManagerService.ts`：`hydrateInstalledNativeGamePackages()` 在没有预注册 `fallbackCache` 时也会构造兜底 state，确保已安装包仍能把 `assetBaseUrl` 注入到 AssetLoader override。
  - 修复 `src/components/common/media/OptimizedImage.tsx`：开发态 `fetch -> blob` workaround 只保留给 public `/assets/...`，Android `/_capacitor_file_/...` 本地包路径改为直接 `<img>` 加载。
  - 修复 `src/features/mobile-packages/nativeGamePackagePlugin.ts`：原生 ack / listener 返回 `running/completed/cancelled` 时先归一化为前端合法状态，避免 `易桌游测试` 把下载按钮直接污染成灰态。
  - 补回归测试：`src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 与 `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`。
  - 将包含修复的 `dist/` 覆盖到真机 `top.easyboardgame.app.debug` 当前 OTA 目录 `/data/user/0/top.easyboardgame.app.debug/files/versions/mhvPgIYOyN`，重启后确认加载新 bundle `index-wN3ZSRu0.js`。
  - 真机打开 `王权骰铸` 详情弹窗后，`安装游戏包` 按钮已恢复为可点击态；截图路径：`D:\\gongzuo\\webgame\\BoardGame\\temp\\mobile-debug\\dicethrone-modal-after-open.png`。
  - 后续补齐了 atlas fallback 误判修复与 Android 模拟器复核：
    - 证据文档：`evidence/android-app-local-package-image-fallback-fix.md`
    - 结果：`smashup` 选派系页 24/24 个派系列表项最终背景图 URL 均返回 `200`；其中 4 个命中本地 `_capacitor_file_`，20 个正确回退远端 CDN。
  - Next:
    - 无；该条 Android 本地素材包图片加载故障已完成收口。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/features/mobile-packages/packageManagerService.ts src/components/common/media/OptimizedImage.tsx src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` | 0 error | 0 error，`OptimizedImage.tsx` 有 1 条 `react-refresh/only-export-components` warning | ✅ |
| 图片链路回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native --maxWorkers 1` | 通过 | `8 passed` | ✅ |
| 启动期 hydration 回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts -t "mobile package bootstrap hydration" --configLoader native --maxWorkers 1` | 通过 | `1 passed, 54 skipped` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-07 | 启动期已安装游戏包在未注册 `fallbackCache` 时被直接跳过，资源 override 未生效 | 1 | `hydrateInstalledNativeGamePackages()` 对缺失 fallback 的游戏构造兜底 state 后继续 emit/apply override |
| 2026-04-07 | `OptimizedImage` 把 Android `/_capacitor_file_/...` 本地包路径误走开发态 fetch/blob workaround，图片停在加载态 | 1 | 将 workaround 收窄为“仅开发态 public `/assets/...`”，本地包路径直接 `<img>` 加载 |
| 2026-04-07 | 原生首次 ack 返回 `running`，旧前端把非法状态直接写进安装状态，导致下载按钮提前灰死 | 1 | `nativeGamePackagePlugin.ts` 归一化原生状态后再写入前端缓存，并已用真机新 bundle 确认按钮恢复可点 |

## Session: 2026-03-28 Dice Throne AI 审计收口
- **Status:** completed
- Actions taken:
  - 复核 `src/games/dicethrone/ai.ts`、`domain/executeTokens.ts`、`domain/commandValidation.ts`、`domain/tokenResponse.ts`，确认 Monk 太极当前规则是“单响应窗口最多 1 次合法使用”。
  - 修复 `src/games/dicethrone/domain/systems.ts` 中 `TOKEN_RESPONSE_CLOSED` 未同步清空 `sys.responseWindow.current` 的状态残留问题。
  - 更新 `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 中的太极回归，使其断言当前真实行为：单次 token 响应后 `skip-token-response`，并在关闭窗口后恢复正常推进。
  - 继续强化太极回归，补断言验证 `skip-token-response` 后 `sys.interaction.current` 也被清空，且操作权仍回到玩家 `0`，下一拍继续返回 `advance-phase`。
  - 同型扫描 `ResponseWindowSystem` 后，补了一条锁定语义回归到 `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`：交互创建并锁定响应窗口期间，`RESPONSE_PASS` 必须失败，且不得提前清掉 `sys.interaction.current` / `pendingInteractionId`。
  - 复跑 Dice Throne AI 关键回归，确认本地 AI 不再在太极响应链路上卡死。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| AI 基础命令覆盖 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` | 全部通过，且太极链路按当前规则关闭窗口并恢复推进 | `26 passed` | ✅ |
| Token 响应窗口回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` | 响应窗口开闭与交接链路稳定 | `8 passed` | ✅ |
| 响应窗口锁定回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native --maxWorkers 1` | 交互锁定期间 `RESPONSE_PASS` 被拒绝，现有锁定/取消链路保持通过 | `7 passed` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-28 | 太极响应结束后 AI 仍看到残留 response window，继续跑出 `response-pass` | 1 | 在 `TOKEN_RESPONSE_CLOSED` 路径同步清空 `sys.responseWindow.current` |
| 2026-03-28 | 旧回归仍期待“双太极再 skip”，与当前 token 规则不符 | 1 | 按当前 `getMaxTokenUseAmount` / `tokenUsageTotals` 真相改写测试，断言单次 token 后直接 `skip-token-response` |

# Progress Log

## Session: 2026-03-28

### Phase: 初始化
**Status**: Complete

- **[10:00] Action**: 检查根工作区、规划文件占用情况与相关规范
  - Result: 确认根工作区存在并行任务，且 `task_plan.md/findings.md/progress.md` 已服务其他主题；已读取资产、录入、审计、测试、OpenSpec 规范
  - Next: 创建独立 worktree 并初始化本任务规划文件

- **[10:05] Action**: 创建独立 worktree 与分支 `feat/smashup-base-faction-assets`
  - Result: 新工作目录 `D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets` 已创建，工作区干净
  - Next: 盘点现有 Smash Up 图片接入链路和目标素材清单

### Phase: 发现与设计
**Status**: Complete

- **[10:08] Action**: 初始化 `task_plan.md`、`findings.md`、`progress.md`
  - Result: 本任务已建立独立的磁盘规划上下文，后续发现与验证可持续追加
  - Next: 扫描 `public/assets`、现有 Smash Up faction 资源与相关代码/脚本

- **[10:22] Action**: 核对原工作区 Smash Up 新原图与现有压缩产物
  - Result: `aiji_base.png` 与目标四派系基地匹配，但 `aiji.png` 实际是 Pretty Pretty 四派系卡图；旧 `cards5.webp` / `base4.webp` 不是本次目标内容
  - Next: 用 TTS / Wiki 源数据锁定四派系的正式卡牌与基地清单，判断中文 cards 原图缺口是否阻塞实现

- **[10:28] Action**: 解析 TTS 源数据 `2833984701.json`
  - Result: 已确认 Ancient Egyptians / Cowboys / Samurai / Vikings 四个 kit 均存在，且能提取对应 bases / deck / titan / CustomDeck 信息
  - Next: 按 Smash Up 专项规范运行 Wiki 爬虫，建立本次录入契约与 spec 范围

- **[10:40] Action**: 起草并校验 OpenSpec change `add-smashup-oops-faction-intake`
  - Result: `proposal.md` / `tasks.md` / `design.md` / spec delta 已创建，`openspec validate add-smashup-oops-faction-intake --strict --no-interactive` 通过
  - Next: 向用户确认 cards 原图来源；确认后再进入 apply 阶段

### Phase: 资产处理与录入
**Status**: Complete

- **[10:48] Action**: 用户修正并确认 `aiji.png` 为正确图片
  - Result: 当前 worktree 中 `public/assets/i18n/zh-CN/smashup/cards/aiji.png` 已变为 Oops, You Did It Again 四派系卡图
  - Next: 重新核定 atlas 网格、切片顺序与卡牌索引

- **[10:54] Action**: 直接查看并核对 `aiji.png` 与 `aiji_base.png`
  - Result: 已确认 `aiji.png` 为 `7x7` row-major（48 卡 + 1 尾格），`aiji_base.png` 为 `2x4` row-major（8 基地）
  - Next: 以该索引顺序生成 faction/base/card 接入清单

- **[10:58] Action**: 压缩 Smash Up 新原图
  - Result: 已生成 `cards/compressed/aiji.webp` 与 `base/compressed/aiji_base.webp`
  - Next: 在 atlasCatalog / ids / static defs 中接入新 atlas

- **[11:05] Action**: 复核 TTS `2833984701.json` 的四个目标 kit
  - Result: 已确认四派系的英文卡名、卡牌数量与基地清单，足以作为 defId / count / canonical base name 的英文来源
  - Next: 补 Wiki 抓取映射并开始正式录入

- **[11:40] Action**: 完成 Oops 四派系静态接入
  - Result: 已补 `ids.ts`、`atlasCatalog.ts`、4 个 faction 文件、8 个 base def、locale、`factionMeta.ts`，并修复 `registerPodBaseSkeletons()` 对非 POD 派系误生成 `_pod` 基地的问题
  - Next: 跑 Vitest / typecheck / E2E 并处理截图异常

### Phase: 审计与验证
**Status**: Complete

- **[12:00] Action**: 运行 Vitest、typecheck 与 OpenSpec 校验
  - Result: `CardPreview.i18n`、`criticalImageResolver`、`factionSelection`、`cardI18nIntegrity`、`typecheck`、`openspec validate` 全部通过
  - Next: 完成 E2E 证据与上传验证

- **[12:10] Action**: 排查 E2E 白板问题
  - Result: 确认根因不是 atlas 索引，而是 `AtlasCard` 用多层 `background-image` 充当 fallback，导致 Playwright 证据截图里 atlas 呈现白板
  - Next: 修复渲染策略并复跑 E2E

- **[12:25] Action**: 上传新 atlas 到 R2 并修复 `AtlasCard` 渲染策略
  - Result: `aiji.webp` 与 `aiji_base.webp` 已上传到 `official/i18n/zh-CN/smashup/...`，`HEAD` 均为 `200`；`AtlasCard` 已改为选择单个已加载成功的 URL 作为最终背景图
  - Next: 复跑 E2E 并留证

- **[12:35] Action**: 复跑 intake E2E 并自审截图
  - Result: `Oops 四派系在派系选择与注入场景中都能显示资源` 已通过，派系选择与棋盘截图均显示真实卡图/基地图
  - Next: 补 workflow / evidence 文档并回填计划文件

- **[12:50] Action**: 沉淀 workflow / contract / E2E evidence 文档
  - Result: 已新增 `docs/games/smashup/workflows/smashup-faction-intake.md`、`evidence/smashup/smashup-oops-faction-intake-contract.md`、`evidence/smashup/smashup-oops-faction-intake-e2e-test.md`
  - Next: 整理最终交付摘要

### Phase: gameplay proposal
**Status**: In Progress

- **[13:42] Action**: 为玩法补完创建 OpenSpec change `add-smashup-oops-faction-gameplay`
  - Result: `proposal.md` / `design.md` / `tasks.md` / spec delta 已落盘，范围明确为四派系正式玩法、新交互类型 UI、统一审计与 E2E
  - Next: 结合用户最新指令确认实施顺序与阶段边界

- **[13:47] Action**: 根据用户要求收敛实施顺序与收尾方式
  - Result: 已明确“一个一个派系实施，全部完成后再统一审计，然后端到端测新交互类型”；Gameplay 波次固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai`
  - Next: 运行 OpenSpec 严格校验并回填 planning 文件

- **[13:49] Action**: 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - Result: 校验通过，proposal 进入可评审状态
  - Next: 更新 `task_plan.md / findings.md / progress.md`，准备向用户汇报 proposal 核心范围与第一波实施入口

### Phase: Ancient Egyptians implementation
**Status**: In Progress

- **[14:10] Action**: 实现 Ancient Egyptians 的埋葬/翻开主链路与专属能力
  - Result: 已新增 `src/games/smashup/abilities/ancient_egyptians.ts`，接入 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / Seal the Tomb / Tomb Trap / Blessing of Anubis / You Can Take It With You / Plague of Locusts / Mummy Strength / Ancient Curse`，并在 `domain/bury.ts` 增加可复用的 `buildBuryCardEvents()` / `uncoverBuriedCard()`，支持 `onUncover`、非法时机翻开 special 直接弃置、`onCardBuried / onBuriedCardUncovered` 触发。
  - Next: 完成 bury UI、同步 locale / OpenSpec，并跑相关验证。

- **[14:22] Action**: 落地 bury UI 与 Ancient Egyptians 正确文本
  - Result: `BaseZone.tsx` 已显示埋葬牌条带；控制者可见真实卡面并可检视，对手仅见隐藏占位与数量/控制者标识。`public/locales/en/game-smashup.json` 与 `public/locales/zh-CN/game-smashup.json` 已修正 Ancient Egyptians 与 `base_star_portal` 文本。
  - Next: 补最小 Vitest、复跑 typecheck / OpenSpec 校验。

- **[14:38] Action**: 补 Ancient Egyptians 最小测试并复核门禁
  - Result: 已在现有测试文件补 `buryEngine.test.ts` 与 `newBaseAbilities.test.ts`，覆盖“翻开后只结算 uncover 文本并弃置”“从场上埋葬确实离场”“Pyramids / Star Portal 基地入口”；`npx vitest run src/games/smashup/__tests__/buryEngine.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning / spec 后进入 Vikings。

### Phase: Vikings implementation
**Status**: In Progress

- **[15:05] Action**: 按官方口径重建 Vikings 文本基线与能力范围
  - Result: 已确认仓库原有 Vikings locale 与 Oops 官方规则书 / Fandom 口径冲突，当前实现不再沿用旧文本；`Huscarl / Shield Maiden / Raider / Valkyrie / Viking Funeral / Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training / Drakkar / Longhouse` 均已切到官方语义。
  - Next: 落能力文件、metadata 和基地触发实现。

- **[15:18] Action**: 接入 Vikings ability 与静态 metadata
  - Result: 已新增 `src/games/smashup/abilities/vikings.ts` 并在 `abilities/index.ts` 注册；`src/games/smashup/data/factions/vikings.ts` 已修正 `Huscarl / Raider` 为 `talent`、`Shield Maiden / Berserk` 为 `onPlay`、`Viking Funeral` 为 `ongoing` 且 `ongoingTarget: 'minion'`。
  - Next: 修正 locale、补最小行为测试并验证基地入口。

- **[15:34] Action**: 补 Vikings 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `vikings_huscarl / vikings_shield_maiden / vikings_pillage`，在 `newBaseAbilities.test.ts` 覆盖 `base_drakkar / base_longhouse`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning 文件后进入 Cowboys。

## 5-Question Reboot Check
| Question | Answer |
| :--- | :--- |
| Current Phase? | Phase 9 收尾阶段：统一审计、gameplay E2E 与 evidence 已完成，剩余是确认门禁与向用户汇报真实残留缺口 |
| Goal? | 在已完成 intake、四派系第一轮实现的基础上，完成统一 gameplay 审计、浏览器层新交互 E2E 和证据收口，并明确真实残留风险 |
| Key Knowledge? | 统一审计已通过；共享官方 duel 内核已落地并完成 Cowboys 浏览器 full-chain 出图验证，`Stagecoach` 仍是最小移动语义；`Ancient Egyptians / Samurai` 仍主要是交互注入型 E2E |
| Last Action? | 已修复 `Deputy` 目标选择后的阶段推进 bug，并复跑 `newFactionAbilities` / `newBaseAbilities` 与 Cowboys 决斗 E2E |
| Next Step? | 向用户汇报官方 duel 收口结果、截图证据绝对路径，以及仍然真实存在的 Samurai 专项 E2E 与 `Stagecoach` 语义缺口 |

### Phase: Cowboys implementation
**Status**: In Progress

- **[16:10] Action**: 按官方口径修正 Cowboys 文本基线与 metadata
  - Result: 已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/cowboys.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 收敛 duel MVP 实现，修复错误事件字段并补最小测试。

- **[16:24] Action**: 落地 Cowboys 第一轮 duel / move / destroy / draw 实现
  - Result: `src/games/smashup/abilities/cowboys.ts` 已接入 `Gunfighter / Quick Draw / High Noon / Run 'Em Off / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / Sheriff / Gold Strike / Saloon / So-So Corral`；同时移除了旧错误的 `Saloon` 决斗内偷触发和 `Dynamite Surprise` 伪 buff 逻辑，并改用现有 `grantExtraMinion / grantExtraAction` 契约。
  - Next: 在现有测试文件补 Cowboys 最小覆盖，并复跑门禁。

- **[16:29] Action**: 补 Cowboys 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `cowboys_gunfighter / cowboys_quick_draw / cowboys_high_noon / cowboys_gold_strike`，在 `newBaseAbilities.test.ts` 覆盖 `base_saloon / base_so_so_corral`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 Cowboy 残留缺口后进入 Samurai。

### Phase: Samurai implementation
**Status**: In Progress

- **[16:54] Action**: 按官方口径修正 Samurai 文本基线与 metadata
  - Result: 已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/samurai.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 落地第一轮 duel / honor / destroy / ongoing draw 实现并接入注册入口。

- **[17:02] Action**: 落地 Samurai 第一轮 duel / destroy / draw / counter 实现并复核门禁
  - Result: 已新增 `src/games/smashup/abilities/samurai.ts` 并在 `abilities/index.ts` 注册，接入 `Ronin / Samurai-Chan / Bushi / Shogun / Yokai Attack! / Honorable Combat / Code of Bushido / Heart of the Battle / Honor the Fallen / base_shoguns_palace / base_sakura_garden`；已在 `newFactionAbilities.test.ts` 覆盖 `samurai_ronin / samurai_yokai_attack / samurai_honorable_combat / samurai_code_of_bushido / samurai_honor_the_fallen`，在 `newBaseAbilities.test.ts` 覆盖 `base_shoguns_palace / base_sakura_garden`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 继续补齐 Samurai 第一轮遗漏能力，再统一回填残留语义。

- **[17:10] Action**: 补完 Samurai 第一轮遗漏能力并复跑门禁
  - Result: `src/games/smashup/abilities/samurai.ts` 已继续接入 `Honor the Ancestors / Way of the Warrior(+3 分支) / Final Haiku / Sakura Garden` 的第一轮能力；`newFactionAbilities.test.ts` 已新增 `samurai_samurai_chan / samurai_honor_the_ancestors / samurai_shogun / samurai_final_haiku` 覆盖，`newBaseAbilities.test.ts` 已补 `base_shoguns_palace / base_sakura_garden` 强化断言；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 转入四派系统一审计与新交互 E2E 收口。

### Phase: 统一审计与收尾
**Status**: Complete

- **[17:18] Action**: 运行四派系统一 gameplay 审计并修复显式硬错误
  - Result: 已确认默认 `vitest` 配置会排除 `*audit*.test.ts`，必须改用 `vitest.config.audit.ts`；`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 最终 `21 passed`。过程中额外发现 `cowboys_stagecoach` 存在 `abilityTags: ['onPlay']` 但未注册执行器的硬错误，现已补 `Stagecoach` 的 MVP 实现与 `newFactionAbilities.test.ts` 最小回归。
  - Next: 跑浏览器层新交互 E2E，并输出证据文档。

- **[17:32] Action**: 跑通三条 Oops gameplay E2E 并留存截图
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 已新增 `Ancient Egyptians bury/uncover`、`Cowboys duel direct click`、`Samurai extra play` 三条用例；三条命令均通过，并生成对应的 before/after 显式证据截图。
  - Next: 写统一 evidence，并把真实覆盖边界回填到 planning 文件。

- **[17:40] Action**: 汇总 gameplay E2E evidence 与残留风险
  - Result: 已新增 `evidence/smashup/smashup-oops-faction-gameplay-e2e-test.md`，明确三条浏览器交互证据、截图绝对路径与限制说明；`task_plan.md`、`findings.md`、`progress.md` 已同步回填统一审计入口、`Stagecoach` MVP 范围，以及 `Ancient Egyptians / Samurai` 两条 E2E 属于“注入当前交互”而非 full-chain 的事实边界。
  - Next: 复跑最终门禁，确认本轮可交付状态。

- **[17:43] Action**: 复跑最终门禁并确认收尾状态
  - Result: `npm run typecheck` 通过，`npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过，`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native` 通过（`76 passed, 1 skipped`），`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 通过（`21 passed`）。
  - Next: 向用户汇报已完成范围、证据落点与仍需后续补完的官方语义缺口。

### Phase: duel official-chain validation
**Status**: Complete

- **[18:34] Action**: 将 Cowboys 决斗浏览器用例升级为官方链路并补关键截图点
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 中的 Cowboys 用例已从“选中敌方随从后直接结算”升级为完整 `Pinkerton -> 决斗牌 -> Deputy -> 结算` 链路，并新增 `pinkerton / duel-card / deputy-card / deputy-target / resolve` 五张显式证据截图。
  - Next: 运行用例并核对画面。

- **[18:37] Action**: 借助 E2E 暴露并修复 Deputy 收尾的真实链路 bug
  - Result: 发现 `smashup_duel_deputy_target` 在推进下一阶段时使用了弃牌前旧状态，导致 `Deputy` 已弃置却又被重新排入同一玩家提示；现已在 `src/games/smashup/domain/duel.ts` 中先模拟 `CARDS_DISCARDED + addTempPower` 再推进阶段，消除重复提示并确保决斗正常收口。
  - Next: 复跑单测与 E2E。

- **[18:39] Action**: 复跑决斗门禁并人工核图
  - Result: `node .\\scripts\\infra\\vitest-cli-safe.mjs run src\\games\\smashup\\__tests__\\newFactionAbilities.test.ts src\\games\\smashup\\__tests__\\newBaseAbilities.test.ts --configLoader native` 通过；`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 通过；已人工核对五张截图，确认决斗横幅、Pinkerton 按钮、决斗牌跳过按钮、Deputy 选牌/选目标与结算后敌方离场全部符合预期。
  - Next: 回填 evidence / planning 文件并向用户汇报。

- **[21:10] Action**: 收口 Cowboys 决斗链 i18n 混用
  - Result: 已确认根因是 `src/games/smashup/domain/duel.ts` 的阶段标题/跳过按钮仍是硬编码中文，而 `Board.tsx` 决斗横幅已走 locale；现已给交互选项补 `labelKey/labelParams` 渲染入口，补齐 `duel.ts` 的 locale key，并让 `PromptOverlay.tsx` 与 `Board.tsx` 的快捷按钮统一解析这些 key。`npm run typecheck` 通过，`newFactionAbilities + newBaseAbilities` 共 `123 passed, 1 skipped`，`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 再次通过。
  - Next: 提交、推送并为这轮 i18n 收尾补开新 PR。

## Session: 2026-04-22 lane-S2R SmashUp 反馈修复

### Phase: 初始化与基线锁定
**Status**: Complete

- **[2026-04-22 00:21:34] Action**: 读取 AGENTS、planning-with-files、数据录入、测试/审计、引擎系统规范，并检查工作区状态。
  - Result: 确认本轮需要 Wiki/实现/测试/evidence 闭环；发现工作区存在非本轮改动，将避开无关文件。
  - Next: 运行 SmashUp Wiki 抓取/对比并审查 7 条反馈的实现入口。

- **[2026-04-30 16:40:00] Action**: 复核 lane-S2R Addendum 与后续 evidence / closeout 的一致性，确认是否只是 planning 未回填。
  - Result: `task_plan.md` 中 Phase A-D 原先未勾选，但实际执行链已完成：`smashup-human-open14-closeout-2026-04-22.md` 已覆盖工厂/疯人院/疯狂山脉/天守阁/先祖/世界冠军/美人鱼等链路；其中 `69e61a97` 旧关闭结论虽在 2026-04-25 被判失效，但同日已通过 `smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md` 与后续《武士 陈》负路径/正路径证据重新补齐。按 2026-04-30 当前证据口径，lane-S2R 范围内 7 条反馈已具备最终收口依据。
  - Next: 无；该 Addendum 已完成，后续只需避免再把“未回填的旧勾选状态”误读为任务未完成。

### Phase: SmashUp 三派系审计复审（Mermaids / Skeletons / World Champs）
**Status**: In Progress

- **[2026-04-22 23:22:32] Action**: 复跑三派系能力回归与审计门禁
  - Result: `newFactionAbilities`（`146 passed / 1 skipped`）、`interactionTargetTypeAudit`（`7 passed`）、`interactionDefIdAudit`（`2 passed`）、`abilityBehaviorAudit`（`22 passed`）、`interactionCompletenessAudit`（`5 passed`）全部通过。
  - Next: 复跑三派系“统一斜向实施中横幅”E2E，并回填证据文档维度。

- **[2026-04-22 23:25:58] Action**: 复跑三派系横幅 E2E + i18n 门禁
  - Result: `npm run i18n:check` 通过；`npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"` 通过（`1 passed`），并生成最新截图。
  - Next: 更新 `smashup-10th-anniversary-factions-audit-20260419.md`，补齐 D1-D49 与最新截图路径。

- **[2026-04-22 23:30:00] Action**: 完成三派系审计文档补全
  - Result: `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 已新增“2026-04-22 复审记录 + D1-D49 维度”；`public/locales/zh-CN/game-smashup.json` 与 `public/locales/en/game-smashup.json` 已删除 `faction_implementation_in_progress_hint`，仅保留“实施中 / Implementation in Progress”文案。
  - Next: 按长期任务继续推进剩余未收口反馈与专项审计。

- **[2026-04-22 23:34:00] Action**: 扫描三派系能力覆盖缺口并回写风险
  - Result: 静态比对 `registerAbility` 与 `newFactionAbilities.test.ts` 后确认仍有 20 条能力未被主回归文件直接点名（Mermaids 7 / Skeletons 6 / World Champs 7），已在三派系审计文档新增“未覆盖风险”与后续补测计划。
  - Next: 按“配置直通 / 新机制 / 新 UI-E2E”三批继续补专项断言与证据。

- **[2026-04-23 00:26:40] Action**: 完成三派系缺口补测并复跑审计链
  - Result: `src/games/smashup/__tests__/newFactionAbilities.test.ts` 已补齐三派系 21 条缺口能力断言，最新结果 `166 passed / 1 skipped`；同时复跑 `interactionTargetTypeAudit(7 passed)`、`interactionDefIdAudit(2 passed)`、`abilityBehaviorAudit(22 passed)`、`interactionCompletenessAudit(5 passed)` 与 `npm run i18n:check` 全部通过。
  - Next: 回填审计文档与计划文件，把“20 条未覆盖风险”收敛为 0 缺口。

- **[2026-04-23 00:27:10] Action**: 回填审计文档与 planning 文件
  - Result: `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 已新增“补测收敛记录（2026-04-23）”；`task_plan.md` 将三派系覆盖缺口任务标记完成；`findings.md` 追加补测结论（缺口 `0/0/0`）。
  - Next: 继续执行长期任务下一批实施/审计项，直至用户最终验收总结。

- **[2026-04-23 00:35:48] Action**: 复现并定位 SmashUp 大厅 3 人房 E2E 失败
  - Result: `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "3 人房间可加入且大厅会显示座位状态"` 首次失败，确认失败点为座位文本断言误写（期望 `空位/空位/空位`），截图实际为“玩家/空位/空位”。
  - Next: 按真实语义最小修正断言并重跑单用例。

- **[2026-04-23 00:37:46] Action**: 最小修正座位断言并复跑单用例
  - Result: 已将 `e2e/smashup/smashup.e2e.ts` 中断言收敛为 `toContainText(/空位\\s*\\/\\s*空位/)`；`npx eslint e2e/smashup/smashup.e2e.ts` 通过；单用例复跑 `1 passed`。
  - Next: 复跑整文件，确认三派系统一横幅用例不受影响。

- **[2026-04-23 00:43:22] Action**: 复跑 SmashUp 大厅整文件并回填证据
  - Result: `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 全量 `3 passed`；已在 `evidence/smashup/smashup-10th-anniversary-factions-selection-e2e-test.md` 与 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 增补 2026-04-23 复测记录与截图路径。
  - Next: 继续三派系审计收口项，直至本轮长期任务最终汇总。

- **[2026-04-23 08:49:58] Action**: 复跑三派系审计门禁并定位新增失败
  - Result: `interactionTargetTypeAudit` 首次复跑出现 `cthulhu_corruption` 未登记 generic 保留理由导致的 1 条失败；其余审计项未见新增失败。
  - Next: 最小补齐审计登记并复跑全套门禁。

- **[2026-04-23 08:53:26] Action**: 补齐 `cthulhu_corruption` 审计登记并完成全套复跑
  - Result: 已在 `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 补齐 `REQUIRED_SOURCE_CONFIGS + APPROVED_GENERIC_SOURCE_REASONS`；`eslint` 通过；`newFactionAbilities(166/1) + 4 个 audit suite + i18n` 全部通过。
  - Next: 回填三派系审计证据文档，继续长期任务直到最终汇总。

- **[2026-04-23 09:03:12] Action**: 回写派系实施 workflow 门禁，沉淀可复用流程
  - Result: `docs/games/smashup/workflows/smashup-faction-implementation.md` 已新增 `targetType: 'generic'` 强制补记规则（`REQUIRED_SOURCE_CONFIGS + APPROVED_GENERIC_SOURCE_REASONS` 双登记），将本次踩坑前置为流程约束。
  - Next: 进入本轮长期任务最终收口准备（等待你要求最终总汇报时一次性给出）。

## Session: 2026-04-22 Dicethrone critical 反馈补强（69c3c83e / 69cba605）

### Phase: 实施与验证
**Status**: Complete

- **[2026-04-22 23:00] Action**: 锁定两个线上 critical 的当前实现入口并确认最小改动面。
  - Result: `69cba605` 命中 `src/games/dicethrone/ui/Dice3D.tsx` 失败路径可见性缺口；`69c3c83e` 当前以历史 board-shell 兼容修复链路复核为主。
  - Next: 修 `Dice3D` 的无 sprite 文本兜底并补单测。

- **[2026-04-22 23:03] Action**: 完成 `Dice3D` 无 sprite 可见性兜底修复并更新断言。
  - Result: 已新增 face symbol -> fallback label 映射；无 sprite 时输出 `data-face-fallback="glyph"` 与可见标签；`StatusEffectsIcons` 用例同步覆盖。
  - Next: 跑 lint + vitest + compat helper 回归。

- **[2026-04-22 23:06] Action**: 运行回归并落证据文档。
  - Result: `eslint` 通过；`StatusEffectsIcons.test.tsx` 15/15 通过；`androidCompatSmoke.test.ts` 5/5 通过；新增证据文档 `evidence/dicethrone/dicethrone-feedback-69c3c83e-69cba605-followup-2026-04-22.md`。
  - Next: 汇总给用户并等待是否继续回写线上状态。

## Session: 2026-04-24 SmashUp 三派系持续审计复核

### Phase: 审计与证据口径同步
**Status**: Complete

- **[2026-04-24 09:02:00] Action**: 复跑三派系主能力回归
  - Result: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1` 通过，结果 `168 passed / 1 skipped`。
  - Next: 继续复跑四项审计套件并确认无回归。

- **[2026-04-24 09:06:00] Action**: 复跑四项审计套件 + i18n 门禁
  - Result: `interactionTargetTypeAudit(7 passed)`、`interactionDefIdAudit(2 passed)`、`abilityBehaviorAudit(22 passed)`、`interactionCompletenessAudit(5 passed)`、`npm run i18n:check` 全部通过。
  - Next: 复跑 SmashUp 大厅整文件 E2E，核对统一“实施中”横幅证据。

- **[2026-04-24 09:08:00] Action**: 复跑 `smashup.e2e.ts` 并核图
  - Result: `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 全量 `3 passed`；三派系统一斜向横幅截图更新为 `2026-04-24 09:08`。
  - Next: 回写 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-factions-selection-e2e-test.md`、`task_plan.md/findings.md`，统一最新计数与时间口径。

- **[2026-04-24 09:20:00] Action**: 完成证据与规划文档口径同步
  - Result: 已把 `168 passed / 1 skipped`、`smashup.e2e.ts = 3 passed`、截图时间 `2026-04-24 09:08` 回写到 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-factions-selection-e2e-test.md`、`task_plan.md`、`findings.md`。
  - Next: 继续三派系后续审计/实施批次，不中途收口，等待你最后统一验收时再做总汇报。

- **[2026-04-24 22:03:00] Action**: 追加三派系静态覆盖复核
  - Result: 已执行 `registerAbility('<id>')` 与 `newFactionAbilities.test.ts` 的静态比对，结果 `Mermaids 10/0、Skeletons 13/0、World Champs 17/0、总计 40/0`；已回写到审计 evidence 与 findings。
  - Next: 继续按“三派系审计 + workflow 完整性”推进，不中断收口。

- **[2026-04-24 22:10:00] Action**: 复跑 OpenSpec 校验与 R2 远端回查
  - Result: `npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过；`wangling.webp / wangling_base.webp` 的 HEAD 均为 `200`。
  - Next: 回写审计文档中的最新门禁与资源状态，保证证据链完整。

- **[2026-04-24 22:16:00] Action**: 强化通用数据录入与 SmashUp 实施 workflow
  - Result: 已更新 `.windsurf/skills/data-entry-workflow/SKILL.md` 与 `docs/games/smashup/workflows/smashup-faction-implementation.md`，新增“长期任务连续执行”强制规则（S0→S4 持续推进，continue 默认推进下一批执行）。
  - Next: 继续执行三派系审计/实施批次，保持“不中途收口”节奏。

- **[2026-04-24 22:24:00] Action**: 回写两条 SmashUp 反馈审计文档的当日复核补记
  - Result: 已在 `smashup-feedback-69db57c-faction-select-stall-2026-04-22.md` 与 `smashup-feedback-69daa51e-auto-skip-turn-2026-04-22.md` 增补 `2026-04-24` 复核段，统一引用当前主线 E2E（`smashup.e2e.ts = 3 passed`）维持结论有效。
  - Next: 继续三派系实施与审计批次，不中途收口。

- **[2026-04-24 23:06:00] Action**: 同步 Android 内置 locale 与资源回查
  - Result: 已在 `android/app/src/main/assets/public/locales/zh-CN/game-smashup.json` 删除 `faction_implementation_in_progress_hint`，避免 App 壳残留旧“分批实施”文案；`npm run assets:upload` 复跑为 `上传 0，跳过 530（未变更），失败 0`；`npm run i18n:check` 通过。
  - Next: 继续推进三派系审计与 workflow 收敛，不中途收口。

- **[2026-04-24 23:12:00] Action**: 尝试补跑两条 watchdog 定向 E2E
  - Result: 被 `heavy-task-guard` 拦截（同机已有并发 `e2e-run` 在执行 `social.e2e.ts`）；未中断主流程，继续采用已通过的主线 `smashup.e2e.ts (3 passed)` 与 `factionSelection.test.ts (40 passed)` 维持当日复核证据链。
  - Next: 待共享重任务释放后再补定向复跑；当前先继续三派系实施与审计推进。

- **[2026-04-25 00:05:00] Action**: 清理陈旧共享 runtime 后补跑 `69db57c` 定向 E2E
  - Result: `npm run test:e2e:ci:file -- e2e/smashup/smashup-phase-transition-simple.e2e.ts "回归：在线 AI 在 factionSelect 阶段 seat state 延迟就绪时，不得被 watchdog 跳过到空牌对局"` 通过（`1 passed`），关键截图更新时间 `2026-04-25 00:06`。
  - Next: 继续补跑 `69daa51e` 两条定向用例。

- **[2026-04-25 00:13:00] Action**: 补跑 `69daa51e` 两条定向 E2E
  - Result: 两条用例均通过（各 `1 passed`）：`在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合` 与 `在线 AI 结束回合切回我方时不应出现整板重挂载或 loading 闪屏`；关键截图更新时间 `2026-04-25 00:13`。
  - Next: 回写两条 feedback evidence 与 planning 文件，继续长期任务推进。

- **[2026-04-25 08:17:00] Action**: 修复 `mermaids_toll_bay` 回归并复跑主能力回归
  - Result: 将触发窗口标记从能力 `matchState.core` 写入改为 reducer 的 `SU_EVENTS.ACTION_PLAYED` 权威写入；`newFactionAbilities.test.ts` 从 `1 failed` 收敛为 `170 passed / 1 skipped`。
  - Next: 复跑四项审计套件 + i18n + SmashUp 大厅 E2E，闭环三派系当日审计链。

- **[2026-04-25 08:23:00] Action**: 复跑四项审计套件 + i18n + SmashUp 大厅 E2E
  - Result: `interactionTargetTypeAudit`、`interactionDefIdAudit`、`abilityBehaviorAudit`、`interactionCompletenessAudit` 全通过（`36 passed`）；`npm run i18n:check` 通过；`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 为 `3 passed`，统一斜向“实施中”横幅截图已更新。
  - Next: 回写 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md` 与 planning 文件，继续长期任务下一批审计推进（不中途收口）。

- **[2026-04-25 08:58:00] Action**: 补跑 SmashUp smoke 回归
  - Result: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1` 通过（`121 passed`），未引入三派系相关新回归。
  - Next: 继续推进三派系审计补强与剩余 workflow 收口事项。

- **[2026-04-25 09:05:00] Action**: 回写三派系审计/evidence/planning 文档口径
  - Result: 已更新 `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-factions-selection-e2e-test.md`、`task_plan.md`、`findings.md`，同步 `170/1 + 4 audit + i18n + e2e(3) + smoke(121)` 最新事实。
  - Next: 继续三派系审计工作流剩余批次，不中途收口。

- **[2026-04-25 09:53:00] Action**: 复跑四项审计套件（audit config）
  - Result: `interactionTargetTypeAudit + interactionDefIdAudit + abilityBehaviorAudit + interactionCompletenessAudit` 全部通过（`36 passed`）。
  - Next: 继续复跑 smoke / E2E 与全量 SmashUp 回归，确认没有隐藏回归。

- **[2026-04-25 10:02:00] Action**: 完成 smoke + E2E + 全量 SmashUp 回归复核
  - Result:
    - `smashup.smoke.test.ts`：`121 passed`
    - `test:e2e:ci -- e2e/smashup/smashup.e2e.ts`：`3 passed`
    - `run src/games/smashup --maxWorkers 1`：`146 files passed / 9 skipped`，`1962 passed / 19 skipped`
  - Next: 回写审计文档并补“旧结论失效回写”，避免文档与当前实现口径漂移。

- **[2026-04-25 10:30:00] Action**: 回写 Toll Bay 旧结论失效与 R2 复核结果
  - Result:
    - 已在 `smashup-10th-anniversary-factions-audit-20260419.md` 新增“修订记录（2026-04-25 10:30）”，明确旧“触发窗口标记”结论失效，现行口径为即时抽牌；
    - 已在 `smashup-10th-anniversary-factions-selection-e2e-test.md` 新增 `2026-04-25 09:56` 复测记录与截图时间；
    - `assets:upload` 本轮结果 `上传 1342 / 跳过 530 / 失败 1(socket hang up)`，关键 URL 二次 HEAD 复核均 `200`（含 `wangling.webp` / `wangling_base.webp`）。
  - Next: 继续按“三派系审计工作”推进下一批实施/核验，不中途收口。

- **[2026-04-25 10:53:00] Action**: 发现并定位 `smashup-gameplay.e2e.ts` 回归失败
  - Result: 首轮 `npm run test:e2e:ci -- e2e/smashup/smashup-gameplay.e2e.ts` 出现 `1 failed / 6 passed`，失败点为“巨石阵应允许己方随从上的附着天赋第2次发动”。
  - Next: 修复 `USE_TALENT` 的 `ongoingCardUid` 校验分支，补巨石阵双才能例外。

- **[2026-04-25 11:12:00] Action**: 完成巨石阵附着天赋二次发动修复 + 单测补强
  - Result:
    - 修改 `src/e2e/src/games/smashup/domain/commands.ts`：`ongoing.talentUsed` 分支新增“附着宿主 + 巨石阵 + 双才能名额空闲”放行；
    - 修改 `src/e2e/src/games/smashup/__tests__/talentAbilities.test.ts`：新增 2 条回归用例；
    - `eslint`（4 文件）0 errors。
  - Next: 先跑单测，再跑失败 E2E 用例与整文件回归确认收敛。

- **[2026-04-25 11:26:00] Action**: 完成回归验证闭环
  - Result:
    - `talentAbilities.test.ts`：`22 passed`
    - `smashup-gameplay.e2e.ts` 定向失败用例：`1 passed`
    - `smashup-gameplay.e2e.ts` 整文件：`7 passed`
    - `smashup.e2e.ts` 整文件：`3 passed`
    - `newFactionAbilities + smoke`：`174 passed / 1 skipped` + `121 passed`
    - 四审计套件：`36 passed`
    - `npm run i18n:check`：通过
  - Next: 回写 evidence / findings / task_plan，继续三派系审计与实施链路推进（不中途收口）。

## Session: 2026-04-24 Online Feedback 69eb3924（SmashUp watchdog recover-interaction）

### Phase: 实施与状态回写
**Status**: Complete

- **[2026-04-24 23:01:00] Action**: 拉取 open 反馈并定位唯一未收口项 `69eb392453c8e640a4475d6b`
  - Result: 远端快照确认报错为 `force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`，交互内出现重复 `activate_special:titan:*` 选项。
  - Next: 修复 scoreBases 锁定基地索引重复导致的交互重复选项。

- **[2026-04-24 23:04:00] Action**: 完成去重修复并补回归测试
  - Result: 已改 `ongoingModifiers.ts` / `reduce.ts` / `index.ts`，统一规范化 `scoringEligibleBaseIndices`；`scoringEligibleLock.test.ts` 新增 2 条回归。
  - Next: 运行单文件回归验证并落证据。

- **[2026-04-24 23:07:00] Action**: 执行验证与状态回写
  - Result: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoringEligibleLock.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism` 通过（`1 file / 12 passed`）；远端 `69eb392453c8e640a4475d6b` 已 `open -> resolved`（`matched=1, modified=1`）；`status-board.json` 校验通过。
  - Next: 继续按线上 `open/in_progress` 清单推进下一批反馈。

## Session: 2026-04-25 SmashUp 三派系持续审计（去重回归复核）

### Phase: 审计与证据同步
**Status**: In Progress

- **[2026-04-25 13:12:00] Action**: 去重 `talentAbilities` 重复新增 case（src/e2e 镜像）
  - Result: `src/games/smashup/__tests__/talentAbilities.test.ts` 与 `e2e/src/games/smashup/__tests__/talentAbilities.test.ts` 已收敛为单组“附着行动卡第2次天赋可用/不可用”断言。
  - Next: 复跑单测、审计、E2E 与 i18n。

- **[2026-04-25 13:30:00] Action**: 完成去重后的全链路复跑
  - Result:
    - `talentAbilities.test.ts`: `20 passed`
    - `newFactionAbilities + smashup.smoke`: `179 passed / 1 skipped` + `122 passed`
    - 四审计套件：`36 passed`
    - `npm run i18n:check`: 通过
    - `smashup-gameplay.e2e.ts`: `7 passed`
    - `smashup.e2e.ts`: `3 passed`
  - Next: 回写 evidence/task_plan/findings 并继续三派系审计批次。

- **[2026-04-25 14:20:00] Action**: 补齐 Wiki 数据录入基操脚本（派系映射 + 名称解析）
  - Result:
    - `scrape-wiki-with-descriptions.mjs` 已补 `skeletons / mermaids / world_champs`；
    - `final-wiki-code-comparison.mjs` 已补单双引号解析、弯直引号归一化、报告“仅校验 name/count”声明；
    - 复核：`scrape skeletons -> 12/20`，`final compare -> 1 正确/0 问题（仅 name/count）`，`eslint` 0 errors。
  - Next: 继续推进 Skeletons 整派系语义重录审计批次（不再只做单卡修补）。

- **[2026-04-25 23:48:00] Action**: 重写 `newFactionAbilities` 的 Skeletons 专项断言为新语义
  - Result: 已替换 `describe('Skeletons abilities')` 全段，覆盖 Returned One / Place ’em Down / Dig ’em Up / Graveyard / Lord of Bones / Grave Goods / Spooky, Scary... / Hearse Fleet / Revenant / Gravestones / Gravetender 的新语义链路；定向运行 `-t "Skeletons abilities"` 通过（`13 passed`）。
  - Next: 同步 generic targetType 审计映射并跑 audit suite。

- **[2026-04-26 00:12:00] Action**: 修复 Skeletons 新 sourceId 的 targetType 审计缺口
  - Result: 更新 `interactionTargetTypeAudit.test.ts` 的 `APPROVED_GENERIC_SOURCE_REASONS`（新增 `skeletons_*` 多个 sourceId，移除失效项）；并将 `skeletons_hearse_fleet_special_mode` 的动态 `sourceId` 改为字面量分支，消除 `unknown` generic；审计复跑 `7 passed`。
  - Next: 继续推进 Skeletons 全量套件复跑与证据文档回写。

- **[2026-04-26 00:15:00] Action**: 质量门禁复核
  - Result: `eslint`（三文件）0 errors（warnings 存量），`npm run i18n:check` 通过。
  - Next: 持续推进三派系审计与 Skeletons 全链路回归，不中途收口。

- **[2026-04-26 08:02:00] Action**: 复跑三派系主能力与四项审计门禁
  - Result:
    - `newFactionAbilities`: `178 passed / 1 skipped`
    - `interactionTargetTypeAudit + interactionDefIdAudit + abilityBehaviorAudit + interactionCompletenessAudit`: `36 passed`
    - `npm run i18n:check`: 通过（仅 dynamic-key warning）
  - Next: 继续复核横幅端到端并回写审计证据。

- **[2026-04-26 08:06:00] Action**: 复跑 SmashUp 大厅 E2E 并核图三派系统一横幅
  - Result: `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 为 `2 passed / 1 failed`；横幅目标用例通过并已核对共享截图，失败项是“3 人房间座位状态”在第三访客 join `page.goto` 超时（30s）。
  - Next: 将本轮结果回写 evidence，并在后续批次单独收敛该 E2E 稳定性问题。

- **[2026-04-26 08:22:00] Action**: 修复 3 人房 E2E 超时并复跑整文件
  - Result: 在 `e2e/smashup/smashup.e2e.ts` 的“3 人房间可加入且大厅会显示座位状态”用例增加 `test.setTimeout(120000)`；`npx eslint e2e/smashup/smashup.e2e.ts` 通过；`npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts` 结果 `3 passed`。
  - Next: 回写审计证据并继续三派系下一批审计推进。

- **[2026-04-26 08:26:00] Action**: 追加 SmashUp smoke 复核
  - Result: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1` 通过（`124 passed`）。
  - Next: 继续维持三派系审计与门禁同步口径。

- **[2026-04-26 08:32:00] Action**: 追加全量 SmashUp 回归探测
  - Result: `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --maxWorkers 1` 失败（`14 failed`）。
    - 失败簇：`afterScoring-rescoring.test.ts`（2）、`commandsValidation.test.ts`（1）、`onDestroyAbilities.test.ts`（11）。
  - Next: 进入失败簇分批排查（先 afterScoring/response-window，再 onDestroy 链路），逐批补证据后继续收敛。

- **[2026-04-26 09:13:00] Action**: 收敛遗留 2 条失败（`newFactionAbilities`）
  - Result:
    - `bear_cavalry_bear_necessities` 回归断言已对齐卡面权威语义（目标应包含“对手随从 + 已打出的行动卡”）。
    - `bear_cavalry_bear_necessities` 交互 handler 增加 stale 目标校验：目标行动卡已离场时不再发 `ONGOING_DETACHED`。
    - 定向验证：`newFactionAbilities.test.ts` 通过（`174 passed / 1 skipped`）。
  - Next: 复跑全量 `src/games/smashup`，确认 14 条失败簇全部清零。

- **[2026-04-26 09:22:00] Action**: 全量 SmashUp 回归复跑（稳定参数）
  - Result:
    - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
    - 结果：`146 files passed / 9 skipped`，`2016 passed / 19 skipped`（失败簇清零）。
    - 本轮相关文件 `eslint` 已跑（0 errors，warnings 存量未扩大）。
  - Next: 持续推进三派系审计批次与证据回写，不中断执行。

- **[2026-04-26 09:26:00] Action**: 追加复跑三派系四审计套件（D1-D49 门禁对应静态审计）
  - Result:
    - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/interactionCompletenessAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
    - 结果：`4 files passed`，`36 passed`。
  - Next: 继续三派系审计证据回写与长期任务收口准备。

- **[2026-04-26 09:44:00] Action**: 横幅 E2E 稳态修复与整文件复跑
  - Result:
    - 修复：`e2e/smashup/smashup.e2e.ts`、`e2e/smashup.e2e.ts` 的 `ensureGameServerAvailable` 改为 `45s` 轮询探活（`/games`），避免服务冷启动瞬间误判 `skip`。
    - `npx eslint e2e/smashup/smashup.e2e.ts e2e/smashup.e2e.ts`：0 errors。
    - `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"`：通过（`1 passed`）。
    - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`：通过（`3 passed`）。
    - `npm run i18n:check`：通过（仅既有 `dynamic-key` warning）。
  - Next: 继续三派系审计文档补全与最终汇总准备。

- **[2026-04-26 10:12:00] Action**: World Champs L3 玩法补证（斗志奖杯 + 鼠、鸟与香肠）
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `鼠、鸟与香肠` 真实入口二段交互 E2E；
      - 修正 `斗志奖杯` 多选提交为 `optionIds[]`，消除多选态抖动导致的假失败。
    - `npx eslint e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：0 errors（warnings 存量）。
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "斗志奖杯打出后应抽两张并给两个己方随从各放一个"`：`1 passed`。
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "鼠、鸟与香肠应先选锚点再给同基地同派系至多两个随从"`：`1 passed`。
    - `npm run i18n:check`：通过（仅既有 `dynamic-key` warning）。
    - 新增证据文档：`evidence/smashup/smashup-world-champs-fighting-spirit-mouse-bird-e2e-2026-04-26.md`。
    - 已回写主审计：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`（L3 补证（三））。
  - Next: 继续推进三派系整包剩余审计与最终收口判定（保持“仍有残余范围”口径，直到整包证据满足发布级门禁）。

- **[2026-04-26 18:55:00] Action**: 骷髅《复仇者》真实入口 E2E 修正与 L3 补证
  - Result:
    - 修正 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：旧用例还在等 `skeletons_revenant_base` prompt，已改成匹配当前真实链路“打开弃牌堆 -> 选中《复仇者》 -> 点击基地埋葬 -> 同回合第二次不再出现”。
    - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "复仇者应可在回合中触发埋葬且同回合不重复触发"`：`1 passed`。
    - `npx eslint e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：0 errors（warnings 为文件既有存量）。
    - 新增证据文档：`evidence/smashup/smashup-skeletons-revenant-e2e-2026-04-26.md`。
    - 已回写：`evidence/smashup/smashup-skeletons-wiki-semantic-audit-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`，移除旧的 `onTurnStart` 近似残余口径。
  - Next: 继续三新派系整包残余范围收拢，保持“仍有残余范围”口径，直到整包 L3/L4 证据满足发布门禁。

- **[2026-04-26 19:40:00] Action**: 世界冠军《武士 陈》负路径 E2E 补证与总文档同步
  - Result:
    - 新增 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts` 用例：`武士 陈打出后不应触发海龟阿凯的交牌抽二交互`。
    - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "武士 陈打出后不应触发海龟阿凯的交牌抽二交互"`：`1 passed`。
    - `npx eslint e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：0 errors（仅既有 `no-explicit-any` warnings）。
    - 新增证据文档：`evidence/smashup/smashup-world-champs-samurai-chan-no-akye-e2e-2026-04-26.md`。
    - 已回写：`evidence/smashup/smashup-feedback-69e61a97-world-champs-card-index-fix-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`。
  - Next: 继续补三新派系整包残余的对象级真实入口证据，不把单张/单负路径补证误报成整包收口。

- **[2026-04-26 22:31:00] Action**: World Champs《金币猫 / 鲨鱼纹身》对象级 L3 补证，并修复《鲨鱼纹身》重复加计数根因
  - Result:
    - 更新 `src/games/smashup/domain/index.ts`：新增 `keepSysUpdatesOnly(...)`，避免 `onPhaseExit/endTurn` 与 `onPhaseEnter/startTurn` 把已预先 reduce 的 core 连同 sys 一起塞回 `updatedState`，导致返回事件被引擎再次 reduce。
    - 更新 `src/games/smashup/__tests__/newFactionAbilities.test.ts`：
      - 新增《鲨鱼纹身》“唯一己方随从时下个自己回合开始只加 1”；
      - 新增《鲨鱼纹身》“同基地仍有你的其他随从时不再加”；
      - 当前定向回归 `world_champs_calicoin|world_champs_shark_tattoo` → `4 passed`。
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增《金币猫》真实入口 E2E；
      - 新增《鲨鱼纹身》真实入口 E2E。
    - 验证：
      - `npx eslint src/games/smashup/domain/index.ts src/games/smashup/__tests__/newFactionAbilities.test.ts e2e/smashup/smashup-robot-hoverbot-new.e2e.ts` → `0 errors`（warnings 为既有存量）
      - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "金币猫打出后应可选择这里的其他随从"` → `1 passed`
      - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "鲨鱼纹身打出后应附着到己方随从并在下个自己回合开始时再放一个"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-calicoin-shark-tattoo-e2e-2026-04-26.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 阶段切换链路抽样”推进三新派系剩余重审，不把当前 World Champs 的补证误报成整包最终收口。

- **[2026-04-26 23:13:00] Action**: World Champs《警长 / 木乃伊》真实入口 E2E 补证
  - Result:
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "警长应在基地计分前发起决斗并摧毁落败随从"` → `1 passed`
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "木乃伊应在基地计分后埋葬到另一个基地"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-sheriff-mummy-e2e-2026-04-26.md`
    - 稳定截图实际落点为 `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-world-champs-*.png`
    - 已回写三份总文档：`smashup-10th-anniversary-factions-audit-20260419.md`、`smashup-10th-anniversary-final-closeout-20260419.md`、`smashup-10th-anniversary-reintake-2026-04-25.md`
  - Next: 继续推进三新派系整包重审；当前仍不能把 World Champs 单派系补证写成三派系最终收口。

- **[2026-04-27 08:40:00] Action**: World Champs《高速追逐 / 现在是闪电时间！ / 聪明Set-Up》真实入口 E2E 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `高速追逐应转移行动到另一基地并移动己方随从且给予 +3 力量`
      - 新增 `现在是闪电时间！应选择己方随从并在本回合给予 +3 力量`
      - 新增 `聪明Set-Up附着后应在该基地本回合首次打出随从时让你抽一张牌`
    - `npx eslint e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：0 errors（warnings 为文件既有存量）
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "高速追逐"`：`1 passed`
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "现在是闪电时间"`：`1 passed`
    - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "聪明Set-Up"`：`1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-high-speed-smart-blitz-e2e-2026-04-27.md`
    - 已回写三份总文档：`smashup-10th-anniversary-factions-audit-20260419.md`、`smashup-10th-anniversary-final-closeout-20260419.md`、`smashup-10th-anniversary-reintake-2026-04-25.md`
  - Next: 继续按“卡图优先 + 对象级真证据”补三新派系剩余残余范围；当前仍不能把 World Champs 对象级补证写成整派系或三派系最终收口。

- **[2026-04-28 00:05:00] Action**: World Champs《着魔 / 嗯？》真实入口 E2E 补证，并修复《嗯？》弃牌区入口缺口
  - Result:
    - 更新 `src/games/smashup/abilities/world_champs.ts`：
      - 为《嗯？》新增 `registerDiscardSpecialProvider(...)`；
      - 在《嗯？》交互结算时新增 `SU_EVENTS.DISCARD_ABILITY_USED`，锁住“本回合一次”。
    - 更新 `src/games/smashup/__tests__/newFactionAbilities.test.ts`：
      - 新增《嗯？》弃牌区可见性与使用后锁定回归；
      - `npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "world_champs_eh"` → `2 passed`。
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增《着魔》真实入口 E2E；
      - 新增《嗯？》真实入口 E2E；
      - 新增 `dismissSpotlightQueueIfPresent(...)`，对齐当前 card spotlight 遮罩行为。
    - 验证：
      - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "嗯？"` → `1 passed`
      - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "着魔"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-bewitched-eh-e2e-2026-04-28.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 特殊入口抽样”推进三新派系剩余残余范围；当前仍不能把 World Champs 对象级补证写成整派系或三派系最终收口。

- **[2026-04-28 00:40:00] Action**: World Champs《彩虹女孩 / 怪兽冲击》真实入口 E2E 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增《彩虹女孩》真实入口 E2E；
      - 新增《怪兽冲击》真实入口 E2E；
      - 修正《怪兽冲击》末尾断言，改为校验《暗杀》正确附着，而不是误判为“立即消灭目标”。
    - 验证：
      - `npx playwright test e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "彩虹女孩"` → `1 passed`
      - `npx playwright test e2e/smashup/smashup-robot-hoverbot-new.e2e.ts -g "怪兽冲击"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-rainbow-kaiju-e2e-2026-04-28.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 特殊入口抽样”推进三新派系剩余残余范围；当前仍不能把 World Champs 对象级补证写成整派系或三派系最终收口。

- **[2026-04-29 00:12:00] Action**: World Champs《快如闪电 / 女主角 / 阿拉密斯》联合反应窗重审、根因修复与口径回写
  - Result:
    - 清理 `src/games/smashup/domain/ongoingEffects.ts` 与 `e2e/src/games/smashup/domain/ongoingEffects.ts` 中误留的重复《阿拉密斯》过滤分支，保留单一有效实现。
    - 定向复跑：
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "world_champs_diva 应以可选反应形式复制标准行动效果|world_champs_fast_as_lightning 打到阿拉密斯后应进入包含女主角与阿拉密斯的反应窗|world_champs_fast_as_lightning 依次选择女主角与阿拉密斯后应正确收口并保留额外行动"` → `3 passed`
      - `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "快如闪电打到阿拉密斯后应可选触发女主角复制并让阿拉密斯提供额外行动"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-world-champs-diva-aramis-fast-as-lightning-e2e-2026-04-28.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`task_plan.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 实现级状态边界抽样”推进三新派系剩余残余范围；当前仍不能把 World Champs 对象级补证写成整派系或三派系最终收口。

- **[2026-04-29 01:04:00] Action**: Mermaids《人鱼女王 / 安静的海岸》对象级 L3 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `人鱼女王应可选择移动其他玩家的一个仆从到这里`
      - 新增 `安静的海岸应可从场上发动天赋并移到另一个基地`
    - 定向复跑：
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "mermaids_mermaid_queen|mermaids_becalmed_shores"` → `3 passed`
      - `npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "人鱼女王应可选择移动其他玩家的一个仆从到这里"` → `1 passed`
      - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "安静的海岸应可从场上发动天赋并移到另一个基地"` → `1 passed`
    - 新增证据文档：`evidence/smashup/smashup-mermaids-mermaid-queen-becalmed-e2e-2026-04-29.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`task_plan.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据”推进 `Skeletons / Mermaids` 剩余链路；当前仍不能把单派系补证写成三新派系整包最终收口。

- **[2026-04-29 09:30:49] Action**: Mermaids《塞壬的歌声》+ Skeletons《他们出来了》对象级 L3 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地`
      - 新增 `他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌`
    - 定向复跑：
      - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "他们出来了应只允许选择有己方埋葬牌的基地，并可一次挖掘多张己方埋葬牌"` → `1 passed`
      - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "塞壬的歌声应只提供有其他己方基地可去的来源基地，并把目标仆从移到该己方基地"` → `1 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-mermaids-siren-song-e2e-2026-04-29.md`
      - `evidence/smashup/smashup-skeletons-dig-em-up-e2e-2026-04-29.md`
    - 过程里额外发现并修正 1 条场景数据低级错误：测试初稿误用了不存在的 `robot_microbot_beta`，已改成真实 card def 后重跑通过。
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`task_plan.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 场景 card def 真值约束”推进 `Mermaids / Skeletons` 剩余链路；当前仍不能把对象级补证写成三新派系整包最终收口。

- **[2026-04-29 09:47:00] Action**: Skeletons《墓园》对象级 L3 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 +1 指示物`
    - 定向复跑：
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "skeletons_graveyard 天赋挖掘后若是随从会进入可选 \+1 指示物交互"` → `1 passed`
      - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓园应可从场上发动天赋挖掘己方埋葬牌，并在挖出随从后可放置 \+1 指示物"` → `1 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-skeletons-graveyard-e2e-2026-04-29.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`task_plan.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + 场景 card def 真值约束”推进 `Skeletons / Mermaids` 剩余链路；当前仍不能把对象级补证写成三新派系整包最终收口。

- **[2026-04-29 09:58:00] Action**: Skeletons《骸骨之王》对象级 L3 补证
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 +1 指示物`
      - 中途发现真实浏览器入口并不是“直接进 +1 提示”，而是先进入 `smashup_reaction_choose`；已按真实链路修正测试。
    - 定向复跑：
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "skeletons_lord_of_bones 天赋可挖掘这里任意埋葬牌而不只限自己"` → `1 passed`
      - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "骸骨之王应可从场上发动天赋挖掘这里任意埋葬牌，并在挖出其他随从后可放置 \+1 指示物"` → `1 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-skeletons-lord-of-bones-e2e-2026-04-29.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`evidence/smashup/smashup-10th-anniversary-reintake-2026-04-25.md`、`evidence/smashup/smashup-10th-anniversary-final-closeout-20260419.md`、`task_plan.md`、`findings.md`
  - Next: 继续按“卡图优先 + 对象级真证据 + finalState / triggerQueue / reaction session / 真实入口 E2E”推进 `Skeletons / Mermaids` 剩余链路；当前仍不能把对象级补证写成三新派系整包最终收口。

- **[2026-04-29 10:08:00] Action**: 回写项目内长期任务 / 派系重审 workflow 门禁
  - Result:
    - 更新 `.windsurf/skills/data-entry-workflow/SKILL.md`：
      - 新增“批量派系重审附加门禁”
      - 强制“当前批次未清空不得停”
      - 强制 `defId` 真值预检
    - 更新 `docs/games/smashup/workflows/smashup-faction-implementation.md`：
      - 新增“批量派系重审 / 重录模式”
      - 新增 `L0-L4` 分层验收
      - 新增 `reaction session` 抽样门禁
    - 更新 `docs/ai-rules/testing-audit.md`：
      - 新增“批量重审对象清单”
      - 新增“E2E 场景真值 defId 预检”
      - 新增“reaction session 不得被单测观察面替代”
    - 已回写：`task_plan.md`、`findings.md`
  - Next: 后续继续三新派系重审时，先按新门禁建立批次清单，再继续补剩余对象，不再按“做 1-2 张就停”的节奏推进。
- **[2026-04-29 13:05:00] Action**: 补《沉船湾 / 轮回者 / 诡异。可怕。 / 墓碑》对象级 L3，并回写本轮测试场景错误
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - `轮回者` 用例改为按真实 `smashup_reaction_choose` 链路收口，不再错误地直接 `waitForNoInteraction()`
      - `沉船湾 / 墓碑` 在线场景改为真实卡面强度组合，确保原基地真正达到 `base_the_jungle` 的 `12` 点计分阈值
    - 定向复跑：
      - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "轮回者打出后应可把自己埋葬到这里"` → `1 passed`
      - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "沉船湾应在基地计分后可移到另一个基地"` → `1 passed`
      - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "诡异。可怕。应从弃牌堆埋葬低力量随从并抽一张牌"` → `1 passed`
      - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓碑应在基地计分后可把自己埋葬到另一个基地"` → `1 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-mermaids-shipwreck-cove-e2e-2026-04-29.md`
      - `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`
    - 已回写：`evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`、`task_plan.md`
  - Next: 继续补 `Skeletons / Mermaids` 剩余未到浏览器级的对象，优先 `skeletons_burst_forth / skeletons_gravetender`。

- **[2026-04-29 14:25:00] Action**: 补《守墓人》L3，并继续探测《墓地爆发》真实入口
  - Result:
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 新增 `守墓人应在你的其他牌被埋葬后抽一张牌`
      - 新增 `墓地爆发应在基地计分前可挖掘你埋葬在那里的牌`
    - 定向复跑：
      - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "守墓人应在你的其他牌被埋葬后抽一张牌"` → `1 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-skeletons-gravetender-e2e-2026-04-29.md`
    - 《墓地爆发》当前状态：
      - 已看到真实 `skeletons_burst_forth` prompt；
      - 已看到目标埋葬牌在棋盘上翻正并变成可点击对象；
      - 但本轮仍被“在线房间误用 harness / runtime 端口冲突 / legacy 房间启动抖动”阻塞，尚未拿到最终 `passed`
  - Next: 下一轮优先继续把 `skeletons_burst_forth` 从“已看到真实入口”推进到“稳定通过 + 证据落盘”。

- **[2026-04-30 00:26:00] Action**: 收口《墓地爆发》L3，并修复 `scoreBases` 交互-计分自动推进时序缺口
  - Result:
    - 更新 `src/games/smashup/domain/systems.ts`、`src/games/smashup/domain/index.ts`：
      - 新增 `scoreBases` 交互 reduce 门禁 `_waitForScoreBasesInteractionReduce`
      - 确保计分阶段交互一旦刚产出领域事件，Flow 要先等该轮事件 reduce 完再继续自动推进
    - 更新 `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`：
      - 把《墓地爆发》场景收紧为“翻不翻出会直接改写计分归属”
      - 正式断言改为：`buriedCards` 移除 + `P0=2 / P1=0`
    - 定向复跑：
      - `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "墓地爆发应在基地计分前可挖掘你埋葬在那里的牌"` → `1 passed`
      - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts -t "skeletons_burst_forth special 可在指定基地挖掘埋葬牌|雄蜂：scoreBases 阶段（真实基地达临界点）交互解决后不应无限循环" --configLoader native --maxWorkers 1` → `2 passed`
    - 新增证据文档：
      - `evidence/smashup/smashup-skeletons-burst-forth-e2e-2026-04-29.md`
    - 已回写：
      - `evidence/smashup/smashup-10th-anniversary-factions-audit-20260419.md`
      - `task_plan.md`
      - `findings.md`
  - Next: 继续补三新派系剩余未到 L3 的对象，当前优先回到 `Mermaids` 的 `诱惑者 / 塞壬 / 无人岛`。

### 复核更新（2026-04-30）
- 已确认 4 条存疑项里有 3 条已具备关闭证据：
  - `69c8f2f432bd47a7b57a66f8`（DiceThrone 黑屏）已在 `temp/feedback-closeout/status-board.json` 记为 `resolved`，并挂载 `dicethrone-webview91-board-shell-fix` / `dicethrone-gunslinger-the-law-multiselect-e2e-test` evidence。
  - `699f098e25c2319ea7b5f281`（波纹造成伤害但没有掉血）已在 `status-board.json` 记为 `resolved`，并有 `evidence/feedback-online-batch11-crossgame-verify-2026-04-24.md` 佐证。
  - `69a277a317d6c588726802fe`（SummonerWars 撤回特别慢 / 放大镜功能没了）已在 `status-board.json` 记为 `resolved`，并挂载 `summonerwars-feedback-69a277...` 与放大镜回归 evidence。
- 当前唯一未闭环残项：
  - `699f0a1625c2319ea7b5f2a9`（获得 3cp 后伤害不对）已有本地业务验证证据 `evidence/dicethrone/dicethrone-feedback-699eb46-699f0a-regression-verification-2026-04-25.md`，但最新 `temp/feedback-closeout/remote-human-unresolved-latest.json` 里该条远端状态仍是 `in_progress`，且 `status-board.json` 尚无对应登记。
- 结论：
  - 本长期项不能宣称“全部完成”。
  - 当前最准确口径是：只剩 `699f0a1625c2319ea7b5f2a9` 的远端状态回写 / 状态板登记尚未闭环。

### 最终闭环更新（2026-04-30）
- 针对最后一条残项 `699f0a1625c2319ea7b5f2a9`，已通过 SSH + Mongo 直接复核远端真实状态。
- 结果：`temp/feedback-closeout/update-feedback-status-20260430-699f0a-to-resolved.raw.txt` 显示本次脚本 `matched=0 / modified=0`，但同次查询返回 `doc.status="resolved"`、`updatedAt="2026-04-25T16:24:42.444Z"`。
- 结论：该反馈此前已被线上回写为 `resolved`，只是本地 `status-board.json` 与 cleanup audit 文档漏登记。
- 已完成补录：
  - `temp/feedback-closeout/status-board.json` 新增 / 回填 `699f0a1625c2319ea7b5f2a9`
  - `temp/feedback-cleanup-audit-2026-04-24.md` 更新最终结论
  - `findings.md` 更新收口复核结论
- 最终结论：`Feedback cleanup audit` 已完成收口。

## Addendum（2026-05-02）：游戏控制流栈化重构收口
- 已完成 `refactor-game-control-flow-stack-system` 变更下 SmashUp / DiceThrone / SummonerWars 的目标收口：
  - SmashUp：`afterScoring`、多基地计分、reaction choose、auto-finish 链路已按新 frame 语义通过 E2E；
  - DiceThrone：blocking modal foreground ownership 已对齐到 resolution owner；
  - SummonerWars：仅在 spec/design 中登记为历史反模式与 deferred migration，不改实现。
- 已补齐并通过的 SmashUp E2E：
  - `e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`
  - `e2e/smashup/smashup-afterscoring-simple-complete.e2e.ts`
  - `e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts`
- 已创建证据文档：
  - `evidence/smashup/smashup-control-flow-stack-e2e-2026-05-02.md`
- 已删除根目录重复旧 E2E 副本，避免 canonical 测试文件继续分叉。
- 2026-05-02 进一步补齐 DiceThrone 复杂链路回归：
  - `e2e/dicethrone/dicethrone-simple-start.e2e.ts` — `Online 4-player The Law variant: upgraded Deadeye offers all target players in 2v2 and resolves on two selected targets` → `passed`
  - `e2e/dicethrone-status-interaction-complete.e2e.ts` — `simple-choice 关闭后，应恢复排队的 token 响应窗口并允许继续收口` → `passed`
  - `e2e/dicethrone/dicethrone-token-response-window.e2e.ts` — `samurai honor pass should close response window without reopen` → `passed`
- 已新增 DiceThrone 栈化回归证据：
  - `evidence/dicethrone/dicethrone-control-flow-stack-e2e-2026-05-02.md`
- 本轮额外探测过根目录旧副本 `e2e/dicethrone-token-response-window.e2e.ts` 中 `samurai honor should open from real attack flow and resolve by two clicks`：
  - 失败现象显示它仍带着旧链路假设（会把不可防御攻击 / 旧 UI 响应入口当成当前契约）；
  - 本轮未保留任何针对该旧副本的实现性修补，避免把未验证的测试试探混入正式收口范围；
  - 当前 DiceThrone 收口仍以 **canonical 子目录 E2E + 已落证据的 3 条复杂链路** 为准。
- 后续清理：
  - 已删除根目录历史重复旧副本 `e2e/dicethrone-token-response-window.e2e.ts`
  - 已把相关证据文档中的命令/路径统一回写到 `e2e/dicethrone/dicethrone-token-response-window.e2e.ts`
  - `e2e/dicethrone-simple-start.e2e.ts` 与 `e2e/dicethrone-status-interaction-complete.e2e.ts` 目前仍承载独立覆盖面，**本轮未误删**

## 2026-05-05 08:05 线上房间加入失败止血进度
- 已用生产脚本执行：ssh admin@8.148.71.102 "cd /home/admin/BoardGame && bash scripts/deploy/deploy-image.sh update"。
- 部署后重新走生产链路验证：tictactoe create -> claim-seat -> guest join 全部成功，join 返回 playerID="1"。
- 已新增证据：evidence/lobby/lobby-online-feedback-room-join-prod-fix-2026-05-05.md。
- 本地同时补了 Android AppUpdate 缺插件时的 listener reject 兜底，并跑通 androidLiveUpdates 聚焦测试。
- 继续追 `AppUpdate` 后已拿到版本级结论：
  - `2b56ac5a`（2026-04-04 08:43 +0800）是 `AppUpdatePlugin` 首次入仓点；
  - 其前一个 Android 壳基线 `7c013bce` 的 `MainActivity.java` 没有 `registerPlugin(AppUpdatePlugin.class)`；
  - 首个确认带插件的正式包是 `0.5.1.apk`，其稳定发布地址 `official/native-app-updates/android/stable/packages/0.5.1.apk` 当前仍可访问，且包内 `classes.dex` 能直接检出 `AppUpdatePlugin`；
  - 因此线上这批 `"AppUpdate" plugin is not implemented on android` 的用户，跑的缺插件正式壳就是 `0.5.0`（或更早），不是某个新 OTA bundle 本身缺插件。

## 2026-05-05 SmashUp 并列计分修复
- 根因确认：`buildBaseRankings()` 把并列玩家继续按当前高位名次发分，和当前产品口径不一致。
- 修复内容：
  - `src/games/smashup/domain/index.ts`：并列组改为按该组占据的最低名次发分。
  - `src/games/smashup/ai.ts`：同步修正 AI 的 VP 估值槽位计算。
  - `src/games/smashup/__tests__/baseScoring.test.ts`：新增并列第一 / 并列第二两条回归。
- 验证结果：
  - `baseScoring.test.ts`：19 passed
  - `npm run typecheck`：passed

## 2026-05-05 23:35 人类反馈优先续跑
- 已把“人类反馈 > 系统自动反馈”回写到 `.windsurf/skills/feedback-closeout/SKILL.md` 和 `task_plan.md`，后续默认先处理 `feedback-modal` 人工单。
- `69f96a734590ce09779a7205`：
  - 复核结论未变：并列计分本地已修。
  - 定向验证通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseScoring.test.ts --configLoader native --maxWorkers 1 --testNamePattern "scoreOneBase 在并列第一时给并列玩家第二位分|scoreOneBase 在并列第二时给并列玩家第三位分"` -> `2 passed`。
- `69f9623c4590ce09779a715f`：
  - 根因确认：`src/games/smashup/domain/extraPlay.ts` 的 `smashup_immediate_extra_minion` 只枚举手牌随从，没有纳入 `getSetAsideTitansPlayableAs(..., 'minion')` 返回的泰坦。
  - 已修复：`src/.../extraPlay.ts` 与 `e2e/src/.../extraPlay.ts` 同步支持 `setaside` 泰坦候选、基地校验走 `ACTIVATE_SPECIAL`、执行也走 `ACTIVATE_SPECIAL`。
  - 已补回归：`src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 与镜像 `e2e/src/games/smashup/__tests__/afterScoring-rescoring.test.ts` 新增“额外随从可打 setaside 泰坦”用例。
  - 已验证：
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --maxWorkers 1 --testNamePattern "smashup_immediate_extra_minion 应允许选择可作为随从打出的 setaside 泰坦"` -> `1 passed`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --maxWorkers 1` -> `8 passed`
- 本地状态板补记暂缓：
  - 这 3 条新人工反馈 ID 当前不在 `temp/feedback-closeout/status-board.json` 的旧 summary 快照里。
  - 在拿到最新 human summary 或明确远端写授权前，先保持规划文档与代码证据一致，不伪造旧板子条目。
- `69f961ca4590ce09779a715a`：
  - 已确认根因不在 server `join` / `playerView`，而在 `SmashUpBoard` 只支持“自己 / 第一个对手”的二元视角。
  - 已把 `src/games/smashup/Board.tsx` 与 `e2e/src/games/smashup/Board.tsx` 改为 `viewTargetPlayerId` 模型，支持点谁看谁。
  - 已补 E2E 收口截图链：
    - `03a-mobile-opponent-view-entry`
    - `03b-mobile-opponent-view-switch-player-2`
    - `03c-mobile-opponent-view-return-self`
  - 已复跑通过：`npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏点击不同对手分数应能切换对应玩家视角并退出"` -> `1 passed`
- 本轮新增本地收口证据：
  - `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
  - `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`
- 下一步：如需正式回写线上反馈状态，先同步最新 human summary，再把这 3 条反馈纳入 `status-board.json` 或直接走远端写回。

## 2026-05-06 07:42 SmashUp 三条人工反馈状态回写
- 用户本轮明确要求“状态回写”。
- 先核对真实写入口：
  - `GET https://api.easyboardgame.top/feedback/open?status=open&page=1&limit=10` 返回 `404`
  - 因此本轮未走 HTTP 开放反馈接口，而是按允许的 fallback 走生产 Mongo 直连。
- 生产 Mongo 回写前核对：
  - `69f961ca4590ce09779a715a` / `69f9623c4590ce09779a715f` / `69f96a734590ce09779a7205` 在 `feedbacks` 集合中均存在，且 `status=open`
  - 结果已落盘：`temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-before-20260506.raw.txt`
- 本地状态板同步：
  - 已将这 3 条补入 `temp/feedback-closeout/status-board.json`
  - 已挂接各自 `evidence` / `verification` / 必要截图
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `ok`
- 生产 Mongo 正式回写：
  - 目标脚本：`temp/feedback-closeout/update-feedback-status-20260506-smashup-human-three-to-resolved.js`
  - 首次真实写入结果：`matched=3, modified=3`
  - 后续为补落盘做过一次幂等重放，因状态已是 `resolved`，返回 `0/0`，不影响首轮真实写入结论
- 回写后复核：
  - 三条目标反馈当前都已是 `resolved`
  - 快照：`temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-after-20260506.raw.txt`
  - 当前线上人类 `open/in_progress` 仍剩 `2` 条：
    - `69fa23e04590ce09779a7c52`
    - `69fa0bd74590ce09779a7bd6`
  - 快照：`temp/feedback-closeout/query-human-open-inprogress-after-writeback-20260506.raw.txt`
- 新增总证据：
  - `evidence/feedback-closeout/smashup-human-three-writeback-2026-05-06.md`

## 2026-05-05 22:53 DiceThrone watchdog stale candidate 再校验
- 已在 `src/engine/transport/server.ts` 为 `runOnlineAiRecoverySequence()` 增加 server 侧 candidate 再校验。
- 新门禁：如果 watchdog 已锁定的 `active-turn-legal-only` 现场，在真正失败上报前已经切成 `human` 的 `afterRollConfirmed` 响应窗，则直接丢弃旧 candidate，不再继续写 `force-end-turn-failed active-turn-legal-only:...legal_action_unavailable`。
- 已补回归：`src/engine/transport/__tests__/server.test.ts`
  - `online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败`
- 已复跑通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "online AI watchdog 在 human 当前响应窗口中不应误判为 AI 卡死|online AI watchdog 在 legal-only 恢复前若现场切到 human afterRollConfirmed，应丢弃旧 candidate 而不是继续上报失败|DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only"`
- 当前状态：
  - 本地 transport 修复与回归已完成；
  - 尚未执行生产热补 / 镜像更新 / 远端状态回写。

## 2026-05-06 08:10 SmashUp 最后两条人工反馈状态回写完成
- 已读取生产前快照：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-before-writeback-20260506.raw.txt`
  - 结果确认两条都仍为 `open`
- 已确认判定口径：
  - `69fa23e04590ce09779a7c52`：已修未回写，目标状态 `resolved`
  - `69fa0bd74590ce09779a7bd6`：非 bug / 规则符合，目标状态 `closed`
- 已核对生产回写回显：
  - `temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
  - 两条都为 `matched=1 / modified=1`
- 已核对回写后快照：
  - `temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
  - 当前状态分别为 `resolved` / `closed`
- 已复核最终人类未收口列表：
  - `temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`
  - 查询结果 `count=0`
- 已确认本地状态板未分叉：
  - `temp/feedback-closeout/status-board.json` 已包含这两条，状态分别为 `resolved` / `closed`
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `feedback-status: ok`
- 已新增总证据：
  - `evidence/feedback-closeout/smashup-human-final-two-writeback-2026-05-06.md`

## 2026-05-07 00:20 SmashUp 宗教圆环点击吞没修复
- 新人工反馈 `69faac614590ce09779a7d8f` 当前原文为：`宗教圆环发不了效果`。
- 已结合线上快照、用户截图和本地新 E2E 收敛出真实根因：
  - 不是 `USE_TALENT` / same-name quota 领域规则坏掉；
  - 而是 `BaseZone` 上基地 ongoing 放大镜的透明包裹层覆盖整张卡面，拦截了对《宗教圆环》本体的点击。
- 已做最小修复：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/src/games/smashup/ui/BaseZone.tsx`
  - 桌面端透明包裹层新增 `pointer-events-none`，避免吞掉 card-body click。
- 已新增最小复现场景：
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`
  - 覆盖真实链路：点击《宗教圆环》→ 出现已用态 + same-name quota → 点击手牌《本地人》→ 点击巫师学院落场成功。
- 已跑通验证：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地"`
- 已补证据：
  - `evidence/smashup/smashup-feedback-69faac614590ce09779a7d8f-sacred-circle-click-fix-e2e-2026-05-07.md`
- 已完成生产状态回写：
  - 回写前快照：`temp/feedback-closeout/query-feedback-69faac61-before-writeback-20260507.raw.txt`，确认目标仍为 `open`
  - 回写结果：`temp/feedback-closeout/update-feedback-status-20260507-69faac61-to-resolved.raw.txt`，`matched=1 / modified=1`
  - 回写后快照：`temp/feedback-closeout/query-feedback-69faac61-after-writeback-20260507.raw.txt`，确认目标已为 `resolved`
  - 最终线上人类未收口复核：`temp/feedback-closeout/query-human-open-inprogress-after-20260507.raw.txt`，`count=0`
- 当前状态：
  - 本地修复、E2E 收口、远端状态回写与线上最终清零复核均已完成。

## 2026-05-07 08:32 全量未收口反馈口径复核
- 为回答“所有反馈是否都修好”，补查了生产真源的**全量** `status in [open, in_progress]`，不再只看人类单。
- 查询快照：
  - `temp/feedback-closeout/query-all-open-inprogress-after-20260507.raw.txt`
- 结果：
  - 全量未收口 `count=32`
  - 全部是 `reporterType=system`、`source=online-ai-watchdog`
  - 当前没有新增人类未收口项；人类口径仍是 `count=0`
- 结论：
  - 现在准确说法是“线上人类反馈已清零，但所有反馈还没有全部修完”
  - 后续如继续收口，主队列将转到剩余 `32` 条 watchdog 系统反馈

## 2026-05-07 21:25 最后 21 条 watchdog 系统反馈正式清零
- 上一版“还剩 32 条”的复核结论已失效。
- 先单独回写了 2 条更早的 SmashUp stale `arcane protector` watchdog 单：
  - `69fb3fde76f10333c15ed8d9`
  - `69fc62984a37805e1526f6d9`
- 随后把最后 21 条 watchdog 系统单批量正式回写完毕：
  - `resolved = 9`
  - `closed = 12`
- 生产回写回显：
  - `temp/feedback-closeout/update-feedback-status-20260507-final-watchdog-batch.raw.txt`
- 最终复核：
  - `temp/feedback-closeout/query-all-open-inprogress-current-20260507.raw.txt`
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 现在的最终口径是：
  - 线上人类反馈已清零
  - 系统 watchdog 反馈已清零
  - 所有反馈已清零

## 2026-05-07 21:52 `69fc6298` 短暂重开后再次清零
- 生产 fresh 复核时，发现 `69fc62984a37805e1526f6d9` 又短暂回到 `open`。
- 当拍生产计数：
  - `totalOpenOrInProgress = 1`
  - `humanOpen = 0`
- 随后继续查同局 `bSJjqanl8rO` 日志，确认 watchdog 已把同一局从 `scoreBases` 继续推进到 `draw` 和 `playCards`，不是新的人工主线问题。
- 因为这条仍属于失败类系统聚合项，所以再次按既定口径回写 `resolved`：
  - `matchedCount = 1`
  - `modifiedCount = 1`
- 最新复核时间 `2026-05-07 21:52 +08`：
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 当前最新口径保持不变：
  - 线上人类反馈已清零
  - 系统 watchdog 反馈已清零
  - 所有反馈已清零

## 2026-05-07 22:00 fresh 生产直查
- 再次直查生产 Mongo：
  - `ts = 2026-05-07T14:00:21.653Z`
  - `totalOpenOrInProgress = 0`
  - `humanOpen = 0`
- 当前最终结论未变化：
  - 线上人类反馈已清零
  - 系统 watchdog 反馈已清零
  - 所有反馈已清零

## 2026-05-07 00:24 反馈回写口径更新
- 已按用户最新要求回写项目内规范：
  - `.windsurf/skills/feedback-closeout/SKILL.md`
- 新强制口径：
  - 只要某条反馈已经满足“修复 + 验证 + 证据”，默认必须立刻执行远端正式状态回写；
  - 不再把“先停在本地 resolved，等后面再统一回写”当成默认流程；
  - 若写入口不可用或用户明确要求暂缓，才允许保留中间态，并且必须显式说明阻塞。

## 2026-05-08 09:40 DiceThrone 奖励骰特写回归复盘
- 新定位结论：
  - “技能骰子特写瞬间跳过”的主回归点仍锁在 `2026-05-05` 的 `80ab89df` 交互真相重构。
  - 具体脱节位点：`src/games/dicethrone/Board.tsx` 把 attacker 视角的 interactive bonus settlement 显示条件绑死到 `sys.interaction.current.kind === 'dt:bonus-dice'`，导致 `pendingBonusDiceSettlement` 仍在、但 interaction frame 短暂丢失时，前台特写直接消失。
- 本轮修复：
  - 新增 `src/games/dicethrone/ui/bonusDiceOverlayVisibility.ts` 的 `resolveInteractivePendingBonusDiceSettlement()`，仅在“没有别的前台交互/响应窗占位”时，对 orphan 的 attacker settlement 做稳定回退显示。
  - 修正 `src/games/dicethrone/Board.tsx`：
    - `displayOnly` settlement 现在也尊重 `dismissedBonusDiceId`，避免本地关闭后立刻重渲染回来；
    - 攻击方关闭自己的 `displayOnly` 奖励骰特写时，改为正式发送 `SKIP_BONUS_DICE_REROLL` 清理权威状态，不再只做本地隐藏。
  - 修正 `src/games/dicethrone/ui/BonusDieOverlay.tsx`：
    - 不可重掷的展示态骰子改为非禁用按钮包装，保证点击内容能正常冒泡到 `SpotlightContainer`。
- 本轮验证：
  - `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx` 通过（新增 orphan fallback / displayOnly 内容点击关闭回归）。
  - `npm run typecheck` 通过。
  - 真实 E2E 仍未形成最终 pass 结论：
    - 通过精确路径与默认入口复跑后，不再立刻报旧的“overlay 永远不隐藏”断言；
    - 但当前 `run-e2e-single` 链路在 `samurai righteousness should resolve a valid branch against monk` 这条用例上仍存在长时间挂起，产物只稳定落到 `09-samurai-righteousness-badge-after-play.png`，尚未拿到最终 `bonus-die-closed / settled` 截图。

## 2026-05-08 23:56 DiceThrone 奖励骰特写真实点击收口
- 修复补充：
  - `displayOnly + manualCloseOnly` 不再自动关闭；
  - `displayOnly` 多骰不再渲染成 disabled button，真实点击骰子内容可以冒泡关闭；
  - DiceThrone 在线“强制去弹窗”改为基于 `core.pendingBonusDiceSettlement` 派发 `SKIP_BONUS_DICE_REROLL`，不再只依赖 `sys.interaction.current.kind === 'dt:bonus-dice'`。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx` -> `39 passed`
  - `npm run typecheck` -> passed
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"` -> `1 passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "online samurai righteousness bonus-die spotlight should close through force-dismiss panel"` -> `1 passed`
- 证据文档：
  - `evidence/dicethrone/dicethrone-bonus-die-real-click-closeout-2026-05-08.md`
- 关键截图：
  - `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-overlay.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/samurai-righteousness-should-resolve-a-valid-branch-against-monk/09-samurai-righteousness-bonus-die-closed.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel/11b-online-samurai-righteousness-force-dismiss-panel-open.png`
  - `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel/12-online-samurai-righteousness-force-dismiss-after.png`

## 2026-05-09 03:06 DiceThrone 奖励骰真实点击复核补充
- 新鲜复核中，正常链首次失败不是实现未触发奖励骰，而是 Righteousness 打出后先出现卡牌特写；测试此前没有按真实用户路径关闭卡牌特写，导致后续奖励骰特写被队列挡住。
- 已修正 E2E：卡牌特写出现时等待关闭保护后真实点击卡牌特写关闭，再进入奖励骰特写；在线链手牌点击也改为普通 `click()`，不再使用不必要的 `force: true`。
- 最新复跑结果：
  - `npx eslint e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` -> `0 errors`（仅保留既有 warnings）
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai righteousness should resolve a valid branch against monk"` -> `1 passed`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "online samurai righteousness bonus-die spotlight should close through force-dismiss panel"` -> `1 passed`
- 新增按钮局部证据：
  - `test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/online-samurai-righteousness-bonus-die-spotlight-should-close-through-force-dismiss-panel/11c-online-samurai-righteousness-force-dismiss-button.png`

## 2026-05-09 23:58 SmashUp 扩展基地 effect contract 三条 critical
- 生产 Mongo 于 `2026-05-09 20:40:30 +08` 拉取到 8 条人工 open/in_progress，已同步到 `temp/feedback-closeout/status-board.json`。
- 已优先处理 3 条 SmashUp critical：`69feca4bf0a61f28ba015d7e`、`69fecbb9f0a61f28ba015d9e`、`69fec94df0a61f28ba015d49`。
- 根因：`base_innsmouth_base@onMinionPlayed` 与 `base_greenhouse@afterScoring` 的 queued reaction 执行器读取 `state.players.*`，但 `effectContract.reads` 缺少 `controllerState`，被运行时合同守卫抛错。
- 修复：`src/games/smashup/domain/baseAbilities_expansion.ts` 补 `controllerState`；`src/games/smashup/__tests__/expansionBaseAbilities.test.ts` 新增两条 queued reaction 回归。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/expansionBaseAbilities.test.ts -t "queued reaction"` -> `2 passed`
  - `npx vitest run src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `48 passed`
  - `npx eslint src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `0 errors`（保留既有 unused warnings）
  - 三条线上 `stateSnapshot` 已本地灌入 `resolveSmashUpReactionChoice` 复测，不再抛合同错误。
- 证据：`evidence/smashup/smashup-feedback-20260509-expansion-base-effect-contract.md`
- 状态：准备本地状态板与生产 Mongo 回写为 `resolved`；同批剩余 5 条仍需继续处理。

## 2026-05-10 02:20 SmashUp 巫师空牌库抽牌反馈 69feac13
- 线上反馈：`69feac13f0a61f28ba015c93`，内容为“牌库空了我打抽牌法师随从不抽牌”。
- 线上快照确认：
  - 玩家 0 牌库为空、弃牌堆 26 张；
  - Action Log 中女巫记录“抽1张牌”，但当前手牌仍只有 `alien_invasion_pod / alien_disintegrator_pod / alien_scout_pod`，说明旧事件链只是记录抽牌，没有让洗回弃牌堆后的牌实际进入手牌。
- 修复：
  - `src/games/smashup/abilities/wizards.ts`
  - `wizard_enchantress`、`wizard_mystic_studies` 与 `wizard_sacrifice` 改为复用 `buildStandardDrawEvents`，空牌库时先发 `DECK_RESHUFFLED` 再发 `CARDS_DRAWN`。
  - 保留/复核 `wizard_neophyte` 空牌库时改走 `peekDeckTop` 的处理，POD 学徒同步生效。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts -t "69feac13"` -> `3 passed`
  - `npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts` -> `46 passed`
  - `npx eslint src/games/smashup/abilities/wizards.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> `0 errors`（保留 11 个既有 warnings）
- 证据：
  - `evidence/smashup/smashup-wizard-neophyte-empty-deck-feedback-2026-05-09.md`
- 本地状态板已更新，下一步回写生产 Mongo 为 `resolved` 并复查剩余 open/in_progress。

## 2026-05-10 02:55 SmashUp 泰坦场下询问反馈 69feede0
- 反馈：`69feede0f0a61f28ba0163df`，用户描述“泰坦在场下也会询问触发，狼人吸血鬼泰坦询问次数非常频繁...”
- 本轮定位并修复狼人 `werewolves_great_wolf_spirit` 路径：
  - 根因：该泰坦 `onTurnStart` 被登记为 `global` trigger；`collectTriggers()` 对 global source 只要 `state.titans` 存在同 defId 就入队，未区分 `setaside/base`。
  - 修复：移除巨狼之灵 `onTurnStart` 的 `global: true`，并删除同一 `sourceDefId + timing` 的重复注册块；同步 `e2e/src` 镜像。
  - 新增回归：`turnCycle.test.ts` 的 `线上反馈 69feede0：场下巨狼之灵不应在回合开始入队询问触发`。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "线上反馈 69feede0"` -> `1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "Great Wolf Spirit creates a start-of-turn move interaction"` -> `1 passed`
  - `npx eslint src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/turnCycle.test.ts e2e/src/games/smashup/abilities/titans.ts e2e/src/games/smashup/__tests__/turnCycle.test.ts` -> `0 errors`，保留 6 个既有 warnings。
- 证据：`evidence/smashup/smashup-great-wolf-spirit-setaside-feedback-2026-05-09.md`
- 本地状态板已更新并校验通过。
- 生产 Mongo 回写：
  - 脚本：`temp/feedback-closeout/update-feedback-status-20260509-69feede0-to-resolved.js`
  - 回显：`matchedCount=1 / modifiedCount=1`
  - 写后状态：`resolved`
- 最新生产剩余人工/反馈弹窗 open/in_progress：
  - `count=5`
  - 新增进入队列：`69ff7291f0a61f28ba0189b9`（实验工坊有bug）、`69ff720cf0a61f28ba01897d`（非常多bug，海盗的bug很多）
  - 这两条已补入本地 `status-board.json`；第一次同步 one-liner 因 PowerShell 反引号破坏失败，已改普通字符串拼接重跑成功。

## 2026-05-10 03:35 SmashUp 实验工坊反馈 69ff7291
- 反馈：`69ff7291f0a61f28ba0189b9`，用户内容“实验工坊有bug”。
- 线上快照显示 AI 把 `wizard_archmage` 打到 `base_laboratorium` 后，`triggerQueue` 同时残留 `base_laboratorium` 与 `wizard_archmage` 两个 `onMinionPlayed` mandatory trigger，且 `sys.interaction=null`。
- 根因：实验工坊读取 `minionsPlayedPerBase` 的判断放在 queued trigger 执行期，旧 effect contract 声明为 `playLimits`；大法师触发写 `playLimits`，导致同一 frame 被误判需要排序，无法按无冲突路径自动收口。
- 修复：
  - `src/games/smashup/domain/baseAbilities.ts` / `e2e/src/...` 增加 `canTrigger` 支持；实验工坊、集会场改为入队前判断“是否本回合该基地首次打出随从”，queued 执行期不再读取出牌计数。
  - `src/games/smashup/domain/baseAbilities_expansion.ts` / `e2e/src/...` 将名人堂也改成同一模式，保持既有大法师自动收口回归。
  - `src/games/smashup/__tests__/archmageE2E.test.ts` / `e2e/src/...` 新增 `69ff7291` 回归。
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1 -t "69ff7291"` -> `1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1` -> `9 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_laboratorium|base_moot_site"` -> `7 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_hall_of_fame"` -> `1 passed`
  - `npx eslint ...baseAbilities.ts ...baseAbilities_expansion.ts ...archmageE2E.test.ts` -> `0 errors`，保留 6 个既有 warnings。
- 证据：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
- 本地状态板已更新并校验通过。
- 生产 Mongo 回写：
  - 脚本：`temp/feedback-closeout/update-feedback-status-20260509-69ff7291-to-resolved.js`
  - 回显：`matchedCount=1 / modifiedCount=1`
  - 写后状态：`resolved`
- 回写后线上剩余人工/反馈弹窗 open/in_progress：`count=4`。

## 2026-05-10 03:47 SmashUp 实验工坊反馈 69ff7291 补充旧队列兼容复核
- 对上一节实验工坊收口做了补充审查：生产快照中 `triggerQueue` 已持久化旧版 `base_laboratorium.effectContract.reads=['playLimits','minionBoardState','baseState']`，只修未来入队声明不能证明旧局可恢复。
- 补充修复：`src/games/smashup/domain/reactionOrdering.ts` / `e2e/src/...` 在排序 contract 物化时兼容旧版 `base_laboratorium` / `base_moot_site` 首随从基地触发，移除旧 `playLimits` 读足迹，仅限 `onMinionPlayed + writes triggerMinionPower` 的旧持久化队列。
- 补充测试：`src/games/smashup/__tests__/newBaseAbilities.test.ts` / `e2e/src/...` 新增旧持久化队列回归。
- 真实生产快照只读灌入验证：
  - 来源：`temp/feedback-closeout/query-feedback-69ff7291-state-json.raw.txt`
  - 结果：`triggerQueueLength=0`、`currentInteractionSourceId=null`、`archmagePowerCounters=1`、`actionLimit=2`、`consumedEvents=2`
- 最新验证：
  - `npx vitest run src/games/smashup/__tests__/newBaseAbilities.test.ts -t "69ff7291"` -> `3 passed`
  - `npx vitest run src/games/smashup/__tests__/newBaseAbilities.test.ts` -> `59 passed`
  - `npx vitest run src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> `18 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1 -t "69ff7291"` -> `1 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_hall_of_fame"` -> `1 passed`
  - `npx eslint src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` -> `0 errors`
- 证据已修订：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
- 本地 `status-board.json` 已补充新 verification。下一步 fresh 查生产，确认 `69ff7291` 仍为 resolved 并继续剩余 open/in_progress。

## 2026-05-10 04:00 SmashUp 海盗泛反馈 69ff720c 同根因收口
- 反馈：`69ff720cf0a61f28ba01897d`，用户内容“非常多bug，海盗的bug很多”。
- 线上快照复核后未看到新的海盗触发/移动/结算错误；真实卡点为 AI 将 `robot_hoverbot` 打到 `base_laboratorium` 后，残留旧版 `base_laboratorium@onMinionPlayed` mandatory trigger。
- 该 trigger 同样带旧 `effectContract.reads=['playLimits','minionBoardState','baseState']`，与上一条 `69ff7291` 属同根因实验工坊旧队列问题。
- 只读灌入生产快照验证：
  - 来源：`temp/feedback-closeout/query-feedback-69ff720c-detail-20260510.raw.txt`
  - 结果：`triggerQueueLength=0`、`currentInteractionSourceId=null`、`hoverbotPowerCounters=1`、`consumedEvents=1`
  - 事件：`su:trigger_consumed`、`su:power_counter_added`
- 证据已追加到：`evidence/smashup/smashup-laboratorium-archmage-feedback-2026-05-09.md`
- 本地状态板已更新并校验通过。
- 生产 Mongo 回写：
  - 脚本：`temp/feedback-closeout/update-feedback-status-20260510-69ff720c-laboratorium-duplicate-to-resolved.js`
  - 回显：`matchedCount=1 / modifiedCount=1`
  - 写后状态：`resolved`
- 最新 fresh 生产查询：
  - 文件：`temp/feedback-closeout/query-after-69ff720c-20260510.raw.txt`
  - 截至 `2026-05-10 04:00 +08`：人工/反馈弹窗 open/in_progress 剩余 `3` 条。

## 2026-05-10 05:36 线上人工反馈本批清零
- 已收口并回写 `69ff0e90f0a61f28ba016a4d` Cardia 教程反馈：
  - 生产 Mongo 回写已完成，状态为 `resolved`。
  - 证据：`evidence/cardia/cardia-tutorial-full-flow-e2e-test.md`
  - 关键 E2E 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\03-ai-opponent-resolved-ability-phase.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-tutorial-debug.e2e\教程完整流程应从欢迎步骤推进到完成\04-finish-visible.png`
- 已收口并回写 `69ff0cd0f0a61f28ba0169e9` SmashUp AI 出牌阶段卡死反馈：
  - 生产 Mongo 回写产物：`temp/feedback-closeout/update-feedback-status-20260510-69ff0cd0-ai-playcards-stalled-to-resolved.raw.txt`
  - 回写结果：`matched=1 / modified=1`
  - 证据：`evidence/smashup/smashup-ai-playcards-stalled-feedback-69ff0cd0-2026-05-10.md`
  - 验证补充：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts --configLoader native --maxWorkers 1 -t "69ff0cd0|base_the_mothership"` -> `6 passed`
- 已收口并回写 `69ff0310f0a61f28ba0167d6` SmashUp 天选之人确认交互卡住反馈：
  - 生产 Mongo 回写产物：`temp/feedback-closeout/update-feedback-status-20260510-69ff0310-cthulhu-chosen-confirm-to-resolved.raw.txt`
  - 回写结果：`matched=1 / modified=1`
  - 证据：`evidence/smashup/smashup-cthulhu-chosen-confirm-feedback-69ff0310-2026-05-10.md`
  - 验证：
    - `npm run test:e2e:ci:file -- e2e/smashup/smashup-cthulhu.e2e.ts "线上反馈 69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭"` -> `1 passed`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts --configLoader native --maxWorkers 1` -> `4 passed`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1 -t "hand targetType"` -> `1 passed`
  - 已实际核对 E2E 截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-button-overlay.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-after-no.png`
- 本地状态板已同步并校验通过：
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `feedback-status: ok`
- 最终 fresh 生产查询：
  - 脚本：`temp/feedback-closeout/_query-open-human-final-20260510.js`
  - 产物：`temp/feedback-closeout/query-open-human-final-20260510.raw.txt`
  - 截至 `2026-05-10 05:35 +08`，生产 Mongo 人工/feedback-modal `open/in_progress`：`count=0`

## 2026-05-10 16:20 +08 Treant / Ninja 收口

- 完成 DiceThrone 新英雄 `treant` / `ninja` 的资源、atlas、英雄注册、能力/卡牌/token、i18n、规则核对文档接入。
- 补齐隔离 worktree 缺失的 DiceThrone Common 压缩资源，修正选角截图黑块问题。
- 已通过：eslint 0 errors、tsc、i18n、3 个 Vitest 文件、assets manifest/validate/upload、build、定向 E2E。
- 已写证据：`evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`。
- 远端抽查：treant/ninja player-board、ability-cards/status-icons、Common background/character-portraits 均 200。


## 2026-05-10 16:35 +08 用户复盘后重新打开

- 用户指出“数据录入、上传素材、审计、端到端全流程都没做好”，确认前一轮确实把 L1/L2 接入 + 选角 E2E 误报成全流程完成。
- 裁定：不改长期任务 skill；已补强项目内 `docs/games/dicethrone/workflows/dicethrone-hero-intake.md`，新增禁止提前收口、批次矩阵、L0-L4、资源/上传/审计/E2E 门禁。
- 下一步继续回到实际任务：按新门禁复核 treant/ninja 数据录入完整性、机制 L2/L3/L4 缺口、资源忽略文件清单和 evidence。

## 2026-05-10 重来启动

- 已按用户要求确认：新增派系/新增角色是项目通用 skill 范畴，不应只改长期任务 skill。
- `.windsurf/skills/add-new-faction/SKILL.md` 已存在并通过 quick_validate（需设置 `PYTHONUTF8=1` 避免 Windows GBK 读取中文失败）。
- 已把 `task_plan.md` 旧完成口径降级为历史误收口，新增 Restart Contract 与 treant/ninja 真实批次矩阵。
- 当前任务继续执行，不允许在机制/E2E/审计全部重新核销前收口。


## 2026-05-10 18:45 +08 Treant/Ninja 重来：机制 L2 复核
- 修复 `src/games/dicethrone/domain/reduceCombat.ts`：`TOKEN_USED` 的 beforeDamageDealt token 加伤现在同时更新 `pendingDamage.currentDamage` 与 `pendingAttack.bonusDamage`。
- 重新验证：
  - `npx eslint src/games/dicethrone/domain/reduceCombat.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts` -> 0 errors
  - `npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts --reporter=dot` -> 2 files / 12 tests passed


## 2026-05-10 18:49 +08 Treant/Ninja 重来：资源链复核
- `npm run assets:manifest` -> 已生成 atlas-configs/common/i18n/splendor manifest。
- `npm run assets:validate` -> 4 个 manifest 校验通过。
- `npm run assets:upload` -> 找到 24 个符合条件本地文件，远端 12918 个文件，上传 0、跳过 24、删除 0、失败 0（远端已同内容）。
- 远端内容回查：Treant/Ninja 的 player-board/tip/ability-cards/dice/status-icons-atlas 以及 Common background/character-portraits 全部 `200 image/webp`，远端 SHA-256 与本地一致。


## 2026-05-10 18:49 +08 Treant/Ninja 重来：数据录入文档复核
- 已复核 6 份 DiceThrone 新英雄录入文档：treant/ninja 真相源表、录入核对、卡牌录入核对。
- 已修正 Treant 文档中过时描述：木苗树灵抽牌分支和树精神圣 +3 分支现在都有 L2 单测证据，不再写“待补测”。
- 当前文档明确分层：L1 静态/资源，L2 机制单测，L3/L4 仍等待真实入口 E2E 截图链，不再保留旧误收口结论。


## 2026-05-10 20:16 +08 Treant/Ninja 重来：真实入口 E2E 与审计收口
- 修复真实 UI 机制接线：`src/games/dicethrone/Board.tsx` 的被动动作点击现在支持 `custom`，树精生命源泉/木苗树灵这类自定义被动不再只是按钮可用但点击无效。
- 修正 E2E 常量引用：新增机制 E2E 改为引用项目 `src/` 的真实 DiceThrone ID 常量，避免误用 `e2e/src` 旧快照导致 token 注入成 `undefined`。
- 新增并跑通真实入口机制 E2E：`npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts` -> 2 passed。
- 关键截图已实际查看：
  - 树精生命源泉入口/奖励骰/收口，收口图中 HP 从 35 到 38 并显示 +3 治疗跳字。
  - 忍者忍术入口/加伤/收口，响应窗中当前伤害从 6 到 8，收口后回到防御掷骰阶段。
- 已重写 `evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`，明确旧完成结论失效，并把 treant/ninja 批次矩阵全部核销为 passed。

## 2026-05-10 20:24 +08 Treant/Ninja 重来：完成门禁核销
- 已更新 `temp/dicethrone-treant-ninja-restart/task-state.json`：C5 审计 evidence、C6 真实入口 E2E 均标记为 pass，overall status 标记为 complete。
- 已执行完成门禁：`python D:\codex-home\skills\task-completion-guard\scripts\check_completion.py --state temp\dicethrone-treant-ninja-restart\task-state.json` -> `COMPLETE`。
- 已复核 6 张关键截图路径存在：Treant 生命源泉入口/奖励骰/收口，Ninja 忍术入口/加伤/收口。
- 未提交、未 push、未清理 worktree。

## 2026-05-10 21:05 +08 Treant/Ninja 按钮排版与 E2E 补强
- 响应用户复盘：树精右侧按钮不应塞长描述，描述留给提示板；已给 `PassiveActionDef` 增加 `labelKey`，Treant 按钮改为短文案 `重掷` / `治疗+CP` / `抽牌` / `治疗`，并给按钮加稳定 `data-testid`。
- 新增 E2E：`树精木苗树灵两个主阶段按钮应短文案展示并真实结算`，覆盖短按钮排版、治疗+CP、抽牌、token/CP/手牌状态变化。
- 新增 E2E：`忍者忍术 6 点应弹出分支选择并能施加慢性中毒`，覆盖 6 点 choice 分支，不再只测 4-5 加伤分支。
- 定向验证：
  - `npx eslint ...` -> 0 errors
  - `npx tsc --noEmit --pretty false` -> passed
  - `npm run i18n:check` -> passed
  - `PW_PORT=6473 PW_GAME_SERVER_PORT=20300 PW_API_SERVER_PORT=21300 PW_WORKERS=1 npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts` -> 4 passed
- 已补强 docs/ai-rules/testing-audit.md：新增通用交互入口语义矩阵。
- 已新增 evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md，覆盖 39 张卡 + 6 基地 P0/P1 对象矩阵。
- 已回写 evidence/smashup/smashup-shayu-faction-audit.md，限定旧结论不能解释为逐对象全量 L3 E2E。

- 验证完成：`shayuFactionAbilities.test.ts` 16 passed；`abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"` 2 passed；`npm run typecheck -- --pretty false` passed；`git diff --check` exit 0。
- completion guard：`python D:/codex-home/skills/task-completion-guard/scripts/check_completion.py --state temp/smashup-shayu-full-audit-2026-05-12.json` -> COMPLETE。
## 2026-05-12 07:56 +08 Shayu 通用入口矩阵接手复核
- 接手后重新核对防早停状态：`python D:/codex-home/skills/task-completion-guard/scripts/check_completion.py --state temp/smashup-shayu-full-audit-2026-05-12.json` -> COMPLETE。
- 重新运行验证：`npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts` -> 16 passed。
- 重新运行审计定向验证：`npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"` -> 2 passed / 24 skipped。
- 重新运行类型检查：`npm run typecheck -- --pretty false` -> passed（npm 输出 unknown cli config --pretty 警告，不影响 tsc 结果）。
- 重新运行 diff 空白检查：相关文件 `git diff --check` exit 0，仅 `progress.md` 保留 LF->CRLF 工作区警告。
- 当前可宣称范围仍限定为：39 卡 + 6 基地 P0/P1 交互入口矩阵全量重审完成；没有新增浏览器 E2E 截图，不能宣称逐对象全量 L3 E2E 收口。
## 2026-05-12 08:15 +08 Shayu 再次抽样调查

- 读取 `AGENTS.md`、`docs/ai-rules/testing-audit.md` 交互入口矩阵、`docs/temp-files-management.md` 与既有 shayu evidence。
- 抽样复审 5 个高风险对象：危险水域、气旋、赫尔墨斯的恩惠、宙斯的恩惠、特洛伊木马。
- 发现 `mythic_greeks_favor_of_zeus` 二次 base prompt：命令 payload 已有 `targetBaseIndex`，旧 handler 又弹 `greekBasePromptProgram`；已改为直接消费 `ctx.targetBaseIndex ?? ctx.baseIndex`。
- 新增/更新：`evidence/smashup/smashup-shayu-strict-sample-audit-2026-05-12.md`、`shayuFactionAbilities.test.ts` 5 条抽样 L2 行为测试、`testing-audit.md` 通用直接入口消费门禁。
- 验证：eslint 0 errors（含 src 与 e2e/src 镜像文件）；抽样 vitest 5 passed；完整 `shayuFactionAbilities.test.ts` 21 passed；定向 `abilityBehaviorAudit` 2 passed / 24 skipped；`npm run typecheck` passed；相关 diff check exit 0（仅 CRLF warning）。

## Addendum（2026-05-12 08:38 +08）：shayu 第一入口直接消费专项重审

- [x] 承认并修正审计缺口：此前全量矩阵偏静态，没有强制检查“payload/UI 已确定第一入口后 handler 是否直接消费”。
- [x] 通用规范补强：`docs/ai-rules/testing-audit.md` 新增“第一入口已确定时不得二次创建同 targetType prompt”的最低门禁。
- [x] 专项全量清单已落地：`evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md` 覆盖 39 卡 + 6 基地的入口来源、第一入口、handler 消费结论与证据等级。
- [x] 已修复 3 个本轮发现项：宙斯的恩惠二次 base prompt、卷走二次 minion prompt、不在堪萨斯替换后误触发新基地 onActionPlayed。
- [x] 已补 L2 验证：新增 `shayuEntryConsumption.test.ts`，并更新 `shayuFactionAbilities.test.ts` 的卷走真实入口用例。
- [ ] 未完成/不得宣称：本轮追加复跑 3 条高风险真实入口 E2E；仍不能宣称 45 对象逐项 L3 E2E；Argonaut 跨派系 action-trigger 泛化仍是后续专项。


## Addendum（2026-05-12 08:46 +08）：shayu 高风险入口 E2E 复跑

- [x] 已修正 `e2e/smashup-shayu-factions.e2e.ts` 中 `tornados_carried_away` 旧流程：不再等待二次 minion prompt，直接等待 `tornados_carried_away_dest` 目标基地 prompt。
- [x] 已复跑 3 条真实入口 E2E：Carried Away 真实手牌入口、Not in Kansas 基地替换、Tornado Alley 首次/二次移入。
- [x] 已实际打开截图核对，并回写 `evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md`。
- [ ] 仍不得宣称：这不是 45 对象逐项 L3 E2E，只是高风险入口链追加 L3。

## Addendum（2026-05-12）：审计默认口径升级为全面审计

- [x] 已更新 `docs/ai-rules/testing-audit.md`：未限定的“审计”默认等于全面审计；抽样/专项/L1 必须显式标注，不得简称“已审计”。
- [x] 已建立 shayu 全面审计 guard：`temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- [x] 已建立 45 对象覆盖矩阵：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- [ ] 当前仍未完成：全量 L2、全交互 L3、全部时序/窗口/队列 L4 还要继续补。

## Addendum（2026-05-12）：全面审计 guard 当前未完成

- 已运行 `task-completion-guard` 检查 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- 结果：`INCOMPLETE`，符合预期；未完成项是全量 L2、全交互 L3、全部适用 L4、以及发现项修复/回写。
- 因此当前不得宣称 shayu 三派系全面审计完成。


## Addendum（2026-05-12 22:50 +08）：shayu 全面审计继续推进

- [x] 新增 5 条 L2 缺口测试，`shayuComprehensiveBehavior.test.ts` 当前 12 passed。
- [x] ESLint 定向通过：`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`。
- [x] 已更新 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md` 和 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json`。
- [ ] completion guard 仍应保持 incomplete，下一步继续逐行核销 45 对象 L2/L3/L4，不允许提前收口。


## Addendum（2026-05-12 23:50 +08）：L3 真实入口补强批次

- 已补强并实际看图核对 2 条高风险 E2E：
  - Sharks：大白鲨结算辅助、飞鲨真实入口、激光束真实入口。
  - Mythic Greeks / Tornados：哈迪斯、宙斯、雅典娜、信风真实入口。
- 本批新截图与肉眼结论已回写总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- 重要限定：`sharks_great_white` 这次仍由 test harness dispatch 触发天赋，只能算结算辅助证据，不算完整真实 UI 天赋入口 L3。
- 当前可升级为 L3 的对象：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_hades`、`mythic_greeks_favor_of_zeus`、`mythic_greeks_favor_of_athena`、`tornados_trade_winds`。
- 当前仍不得宣称全面审计完成：45 对象全量 L2 核销、全部 L3 代表链、全部 L4 时序治理仍未完成。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## Addendum（2026-05-13 00:16 +08）：C3 全量 L2 核销

- 新增 `tornados_twister` 旋风 push/pull L2 行为测试。
- `shayuComprehensiveBehavior.test.ts` 当前 13 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 0 errors。
- 已在全面审计总入口逐对象写清 45/45 的 L2 行为证据来源；C3 可标 pass。
- 仍未完成：C4 全交互 L3/代表链截图归档、C5 全部时序/窗口/队列 L4、C6 最终修复/旧 evidence 全量回写。


## Addendum（2026-05-13 00:55 +08）：全面审计 C4/C5/C6 回写

- 总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- `sharks_great_white` 已重新用真实 UI 点击随从触发天赋，旧“仅 harness 辅助”结论失效。
- C4 已逐对象归档：所有真实 UI 交互入口均为独立 L3 或等价代表链；无用户入口对象显式标记 C4 不适用。
- C5 已逐家族归档：beforeScoring、afterScoring、base replace、once/turn、action-trigger、base trigger、destroy trigger、multi/order/continuationContext 均有 L4 或系统代表链证据。
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## 2026-05-14 23:38 +08 线上反馈 6a055d1429：Twister 可选语义修复

- 已确认反馈成立：旧实现证明了 Twister 能移动，但没有证明“你可以”条件下合法候选存在时也能拒绝移动。
- 已修复 `src/games/smashup/abilities/tornados.ts` 与 `e2e/src/games/smashup/abilities/tornados.ts`：Twister / Monster Tornado push-pull prompt 增加 `skip`，optional 时禁用单候选自动结算，skip 后空事件。
- 已补验证：
  - `npx eslint ...` → 0 errors。
  - `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts -t "旋风"` → 2 passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "可选/至多交互"` → 1 passed。
  - `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornados 旋风真实入口必须允许跳过可选移动"` → 1 passed。
- 已实际核对截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-skip-open.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-after-skip.png`
- `temp/feedback-6a055d1429-twister-task.json` guard 已 `COMPLETE`。
- 未执行提交、push、部署，也未把生产反馈改成 resolved。

## 2026-05-15 08:13 +08 Twister 后 shayu 完整技能流程再审计收口

- 已完成 post-Twister 防早停 guard：`temp/smashup-shayu-post-twister-loop-2026-05-15.json`。
- 已新增并回写证据：`evidence/smashup/smashup-shayu-post-twister-complete-flow-audit-2026-05-15.md`。
- 非浏览器验证沿用本轮已执行结果：
  - `npx eslint src/games/smashup/abilities/tornados.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts e2e/smashup-shayu-factions.e2e.ts` → 0 errors。
  - `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/__tests__/shayuEntryConsumption.test.ts` → 3 files passed / 41 tests passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "可选/至多交互|直接入口字段|控制者约束"` → 1 file passed / 3 passed / 24 skipped。
- 已完成 3 条 E2E 全链路抽查：
  - Twister 可选否定路径 → `1 passed`，截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-skip-open.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-after-skip.png`。
  - Mythic Greeks / Tornados 复杂入口 → `1 passed`，截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-athena-order-open.png`。
  - Gone with the Wind afterScoring → `1 passed`，截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png`。
- 本轮实际看图未发现新的实现错误；未执行提交、push、部署，也未改生产反馈状态。

## 2026-05-15 09:20 +08 shayu 长描述复杂对象抽样全链路审计

- 抽样对象按中文描述长度与动作链复杂度选取：`sharks_megalodon`、`mythic_greeks_argonaut`、`sharks_blood_in_the_water`、`tornados_not_in_kansas`、`mythic_greeks_favor_of_dionysus`。
- 真实发现：`mythic_greeks_argonaut` 旧实现未支持“任何你可以打出行动的时候，改为打出这张牌”，且 Argonaut 触发 action 后能力时漏掉 Jason。
- 已修复：新增 `playAsAction` 数据/命令/事件语义，`PLAY_MINION` 可在行动额度可用时替代行动打出 Argonaut；Argonaut onPlay 串联 Odysseus prompt 后继续进入 Jason base prompt。
- 已补验证：Argonaut L2 聚焦测试、shayu 行为回归、审计门禁、Argonaut 真实入口 E2E 均通过；已实际核对 Argonaut 三张截图链。
- 已新增证据文档：`evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`。

## 2026-05-15 09:40 +08 审计规范加强

- 已确认这次漏审的本质是通用审计规范不够强：对象级矩阵没有强制逐句/子句核销，导致主效果通过后掩盖第二句“替代行动打出”和 Jason 子触发。
- 已更新通用规范：`docs/ai-rules/testing-audit.md` 新增“规则文本逐句/子句覆盖”“漏审默认先归因到审计方法”“一句话多效果不得合并验收”。
- 已更新项目通用新增派系 workflow：`.windsurf/skills/add-new-faction/SKILL.md` 要求每个对象建立 `C1/C2/C3...` 子句表，任一子句缺证据不得填 `passed`。
- 已更新 SmashUp 专项 workflow：`.windsurf/skills/smashup-faction-addition/SKILL.md` 要求逐卡/逐基地列规则子句表，并以子句最低层级决定对象状态。
- 已回写旧 shayu evidence：`smashup-shayu-comprehensive-audit-coverage-2026-05-12.md` 与 `smashup-shayu-post-twister-complete-flow-audit-2026-05-15.md` 标明 Argonaut 旧对象级 pass 不完整。

## 2026-05-16 01:25 +08 TDD 行为 seam 迁移收口

- 不是只拆文件：`newFactionAbilities.test.ts` 中剩余 `Samurai abilities` 已迁到 `src/games/smashup/__tests__/abilities/samurai.test.ts`，并把裸 `getInteractionsFromMS`、`prompt.data.options`、`SYS_INTERACTION_RESPOND`、`sys.interaction.current` 改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`、`expectNoPrompt` 等 facade。
- 旧巨型入口 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 已从实际文件树删除；结构门禁仍会对删除 diff 中的旧内容给债务 warning，但不再有可继续追加的新文件入口。
- 验证：
  - `npm test -- src/games/smashup/__tests__/abilities/samurai.test.ts` -> 1 file passed / 28 tests passed。
  - 迁出集合组合回归 -> 9 files passed / 118 tests passed。
  - `npm run test:structure` -> OK，仅 Junction 与删除 diff 债务 warning。
  - 编码检查 -> 通过；`findings.md` 保留既有 replacement-char 可疑告警，不阻断。

## 2026-05-16 01:28 +08 行为 seam 扩展到旧测试文件

- 对剩余旧测试做禁用模式扫描：`abilities/` 聚焦目录已无命中；`src/games/smashup/__tests__` 其他历史测试仍有大量裸交互结构，不能把整体测试框架重构说成完成。
- 选取小边界文件 `src/games/smashup/__tests__/archmageE2E.test.ts`，改前先跑基线：9 tests passed。
- 将 9 处 `expect(result.finalState.sys.interaction.current).toBeUndefined()` 收敛为 `expectNoPrompt(result.finalState)`；这是同一行为断言，但不再依赖 InteractionSystem 内部字段路径。
- 验证：`npm test -- src/games/smashup/__tests__/archmageE2E.test.ts` -> 1 file passed / 9 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:30 +08 turnCycle no-prompt seam 收敛

- 继续同类低风险收敛：`src/games/smashup/__tests__/turnCycle.test.ts` 改前基线 22 tests passed。
- 将 2 处 `state.sys.interaction.current` / `result.finalState.sys.interaction.current` 的无交互断言改为 `expectNoPrompt(...)`。
- 验证：`npm test -- src/games/smashup/__tests__/turnCycle.test.ts` -> 1 file passed / 22 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:33 +08 specialInteractionChain prompt facade 收敛

- `src/games/smashup/__tests__/specialInteractionChain.test.ts` 改前基线：24 tests passed。
- 将 `asSimpleChoice(r.finalState.sys.interaction.current)` 改为 `getSimpleChoicePrompt(...)`；可选后续 prompt 使用 `getFirstPrompt(...) ? getSimpleChoicePrompt(...) : undefined`；无 prompt 断言改为 `expectNoPrompt(...)`。
- 该文件当前不再命中 `sys.interaction.current` / `asSimpleChoice` / `SYS_INTERACTION_RESPOND` / `prompt.data.options` / `getInteractionsFromMS` 扫描。
- 验证：`npm test -- src/games/smashup/__tests__/specialInteractionChain.test.ts` -> 1 file passed / 24 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:35 +08 Killer Plants POD prompt facade 收敛

- `src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` 改前基线：11 tests passed。
- 将 Sprout 搜索 prompt 的读取与响应从 `sys.interaction.current` / `SYS_INTERACTION_RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptOption`、`respondToPrompt`；无 prompt 断言改为 `expectNoPrompt`。
- 该文件当前不再命中 `sys.interaction.current` / `SYS_INTERACTION_RESPOND` / `prompt.data.options` / `getInteractionsFromMS` 扫描。
- 验证：`npm test -- src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` -> 1 file passed / 11 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:38 +08 shayuEntryConsumption prompt facade 收敛

- `src/games/smashup/__tests__/shayuEntryConsumption.test.ts` 改前基线：6 tests passed。
- 将第一入口专项测试里的 prompt 存在性、targetType、sourceId 与 options 断言从 `sys.interaction.current.data` 改为 `getSimpleChoicePrompt`、`getPromptOptions`；无 prompt 断言改为 `expectNoPrompt`。
- 该文件当前不再命中 `sys.interaction.current` / `SYS_INTERACTION_RESPOND` / `prompt.data.options` / `getInteractionsFromMS` 扫描。
- 验证：`npm test -- src/games/smashup/__tests__/shayuEntryConsumption.test.ts` -> 1 file passed / 6 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:41 +08 promptSystem / promptResponseChain no-prompt 收敛

- `src/games/smashup/__tests__/promptSystem.test.ts` 改前基线：8 tests passed；`promptResponseChain.test.ts` 改前基线：14 tests passed。
- 两个底层 prompt 测试文件的无交互断言改为 `expectNoPrompt`；`promptResponseChain.test.ts` 注释里的旧 `SYS_INTERACTION_RESPOND` 字符串也改为中性“交互响应”，避免扫描误判。
- 这两个文件当前不再命中 `sys.interaction.current` / `SYS_INTERACTION_RESPOND` / `prompt.data.options` / `getInteractionsFromMS` 扫描。
- 验证：`npm test -- src/games/smashup/__tests__/promptSystem.test.ts src/games/smashup/__tests__/promptResponseChain.test.ts` -> 2 files passed / 22 tests passed；`npm run test:structure` -> OK。

## 2026-05-16 01:47 +08 reaction queue prompt facade 收敛

- 回应“是否只改表象”：本批继续改测试行为接口，不是只拆文件或改标题。
- `src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts`：把 no-prompt 断言改为 `expectNoPrompt`。
- `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`：把 reaction choice / real prompt 的 sourceId 与 options 读取从 `sys.interaction.current.data` 改为 `getSimpleChoicePrompt`、`getPromptOptions`、`getPromptOption`。
- `src/games/smashup/__tests__/helpers.ts`：新增 `withoutCurrentPrompt`，让底层 reaction 直调测试不再在业务测试文件里手写清理 `sys.interaction.current` 的结构。
- 扫描：两个 reaction queue 文件对禁用模式 `sys.interaction.current` / `.data.sourceId` / `prompt.data.options` / `SYS_INTERACTION_RESPOND` / `getInteractionsFromMS` 当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/reactionQueueBaseReplaceLki.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> 2 files passed / 27 tests passed；保留既有 `[BASE_REPLACED] newBaseDefId base_new not found in baseDeck` warning。
- 门禁：`npm run test:structure` -> OK，仅 Junction 与旧大文件债务 warning；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 剩余：全 `src/games/smashup/__tests__` 仍有旧内部耦合命中，当前不能宣称整体测试框架重构完成。

## 2026-05-16 01:55 +08 afterScoring / mulligan / base integration 小批次 seam 收敛

- `src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts` 改前基线：4 tests passed；迁移后仍 4 passed。
- `src/games/smashup/__tests__/mulligan.test.ts` 改前基线：7 tests passed；迁移后仍 7 passed。
- `src/games/smashup/__tests__/baseAbilityIntegration.test.ts` 改前基线：25 tests passed；第一次迁移暴露 facade 只找 first prompt 的缺口，修正后 25 passed。
- `src/games/smashup/__tests__/helpers.ts`：增强 `getSimpleChoicePrompt(state, sourceId)`，传 sourceId 时在 current + queue 中查找目标 prompt；新增 `getPromptHandlerData` 支持少数仍直调旧 handler 的测试过渡。
- 组合验证：`reactionQueueBaseReplaceLki.test.ts`、`reactionQueueOrdering.test.ts`、`afterscoring-response-window-execution.test.ts`、`mulligan.test.ts` -> 4 files passed / 38 tests passed。
- `baseAbilityIntegration.test.ts` 单文件 -> 25 tests passed。
- 目标文件禁用内部耦合扫描 0 命中；`npm run test:structure` -> OK；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 961 条命中，说明还在持续治理中，不能收口为完成。

## 2026-05-16 02:05 +08 ninja / first mate / wizard neophyte 小批次 seam 收敛

- 回应“是不是只改了表象”：本批继续消除测试体对内部 prompt 字段与系统响应命令的耦合。
- `src/games/smashup/__tests__/ninja-hidden-ninja-no-minions.test.ts`：把统一反应 prompt 的 `sys.interaction.current.data.sourceId` 断言改为 `getSimpleChoicePrompt(..., 'smashup_reaction_choose')`。
- `src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts`：把 First Mate afterScoring prompt 的 `sys.interaction.current` / `data.sourceId` 断言改为 `getSimpleChoicePrompt(..., 'pirate_first_mate_choose_base')`。
- `src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts`：把 Neophyte prompt source 断言改为 `getSimpleChoicePrompt(..., 'wizard_neophyte')`，并把三处手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondToPrompt`。
- 扫描：上述 3 个文件对禁用模式 `getInteractionsFromMS` / `prompt.data.options` / `SYS_INTERACTION_RESPOND` / `SYS_INTERACTION_CANCEL` / `sys.interaction.current` / `.data.sourceId` 当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/ninja-hidden-ninja-no-minions.test.ts src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts` -> 3 files passed / 11 tests passed。
- 门禁：`npm run test:structure` -> OK，仅 Junction 与旧 `newFactionAbilities` 删除债务 warning；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 955 条命中；还在持续治理中，不能宣称整体完成。

## 2026-05-16 02:10 +08 Broadside / scoring eligible 小批次 seam 收敛

- `src/games/smashup/__tests__/helpers.ts` 新增 `getPromptTargetType`，让 targetType 断言也走 prompt facade。
- `src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts`：把 Broadside 基地选择 prompt 的 sourceId/targetType/options 从 `interaction.data` 读取改为 `getSimpleChoicePrompt`、`getPromptTargetType`、`getPromptOptions`。
- `src/games/smashup/__tests__/scoringEligibleLock.test.ts`：把 Under Pressure source/target option 查找改为 `getSimpleChoicePrompt` + `getPromptOption`，把 Dunwich Horror prompt source 断言改为 `getSimpleChoicePrompt(..., 'elder_thing_dunwich_horror_pod_choice')`。
- 扫描：上述 2 个文件对禁用模式当前 0 命中。
- 验证：
  - `npm test -- src/games/smashup/__tests__/scoringEligibleLock.test.ts` -> 1 file passed / 12 tests passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts` -> 1 file passed / 3 tests passed。
  - 普通 `npm test -- src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts` 会因 audit 文件默认排除而报 `No test files found`，不能作为失败用例处理。
  - `npm run test:structure` -> OK，仅 Junction warning；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 953 条命中；还在持续治理中，不能宣称整体完成。

## 2026-05-16 02:18 +08 Wizard Neophyte ongoing / Hidden Ninja repro seam 收敛

- `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts`：把 Neophyte prompt、ongoing 目标基地 prompt、选项读取和两次响应从 `sys.interaction.current` / `INTERACTION_COMMANDS.RESPOND` 改为 `getSimpleChoicePrompt`、`getPromptOptions`、`respondToPrompt`。
- `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts`：把 Hidden Ninja prompt 断言改为 `getSimpleChoicePrompt(..., 'ninja_hidden_ninja')`，并把注释中的内部字段表述改成“当前 prompt 为空”。
- 扫描：上述 2 个文件对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 2 files passed / 3 tests passed。
- 门禁：`npm run test:structure` -> OK，仅 Junction warning；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 949 条命中；还在持续治理中，不能宣称整体完成。

## 2026-05-16 02:24 +08 reaction queue on* 小批次 seam 收敛

- `src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts`、`reactionQueueOnMinionDiscardedFromBase.test.ts`、`reactionQueueOnMinionPlayed.test.ts`：把统一反应选择 prompt 读取从 `rq.state.sys.interaction.current.data.sourceId` 改为 `getReactionPrompt(...)`。
- 扫描：上述 3 个文件对禁用模式当前 0 命中。
- 验证：`npm test -- src/games/smashup/__tests__/reactionQueueOnBaseRevealed.test.ts src/games/smashup/__tests__/reactionQueueOnMinionDiscardedFromBase.test.ts src/games/smashup/__tests__/reactionQueueOnMinionPlayed.test.ts` -> 3 files passed / 4 tests passed。
- 门禁：`npm run test:structure` -> OK，仅 Junction warning；编码检查通过，`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 943 条命中；还在持续治理中，不能宣称整体完成。

## 2026-05-16 02:21 +08 pirate / turn transition / duplicate respond 小批次 seam 收敛

- 回应用户“这么快，还是只改了表象”：本批继续改测试行为 seam，并用全量命中数证明进展，不按“改了几行”收口。
- `src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts`：把海盗湾计分链的 prompt source 断言从 `sys.interaction.current.data.sourceId` 改为 `getFirstPrompt` + `getPromptSourceId`。结构门禁首次失败，原因是旧泛名文件净新增内容；随后压缩为净删减并复跑通过。
- `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`：把拉莱耶响应从手写 `SYS_INTERACTION_RESPOND` 命令改为 `respondToPrompt`，把 prompt 存在/source 读取改为 `getSimpleChoicePrompt` / `getFirstPrompt` / `getPromptSourceId`，无 prompt 断言改为 `expectNoPrompt`。
- `src/games/smashup/__tests__/duplicateInteractionRespond.test.ts`：把消费后无交互断言改为 `expectNoPrompt`，并去掉用例标题里的裸系统命令术语。
- `src/games/smashup/__tests__/elder-thing-multi-select.test.ts`：把 options/source/target 读取改为 `getPromptOptions`、`getPromptSourceId`、`getPromptTargetType`。
- `src/games/smashup/__tests__/turnCycle.test.ts`：把蘑菇王国 / Invisible Ninja 反应队列段落的 prompt source 与 handler data 读取收进 `getFirstPrompt`、`getPromptSourceId`、`getPromptHandlerData`；相关无 prompt 断言改为 `expectNoPrompt`。
- 扫描：上述本批目标文件对禁用模式均为 0 命中。
- 验证：
  - `npm test -- src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts` -> 2 files passed / 5 tests passed。
  - `npm test -- src/games/smashup/__tests__/duplicateInteractionRespond.test.ts src/games/smashup/__tests__/elder-thing-multi-select.test.ts src/games/smashup/__tests__/turnCycle.test.ts` -> 3 files passed / 27 tests passed。
  - `npm test -- src/games/smashup/__tests__/pirate-cove-chain-fix.test.ts` -> 1 file passed / 3 tests passed after reducing old generic-file net additions。
  - `npm run test:structure` -> OK；仅 Junction warning 和旧泛名净删减 warning。
  - `node scripts/infra/check-file-encoding.mjs ...` -> 通过；`findings.md` 仍有既有 replacement-char 可疑告警。
- 全 `src/games/smashup/__tests__` 当前禁用模式剩余 936 条命中；还在持续治理中，不能宣称整体完成。

## 2026-05-16 09:13 +08 prompt system 命令 seam 复核

- 回应用户“是不是只改表象”：本轮先复核 `promptSystem.test.ts` / `promptResponseChain.test.ts` 的剩余命中，区分可迁移的普通响应命令与必须保留的底层系统合同。
- `promptSystem.test.ts`：把“无 Prompt 时响应”的手写 `{ type: INTERACTION_COMMANDS.RESPOND, payload: { optionId } }` 改为 `respondCommand('test', '0')`；保留 AI fallback 对 `INTERACTION_COMMANDS.RESPOND/CANCEL` 的断言，因为测试目标就是 fallback command type 合同。
- `promptResponseChain.test.ts`：同样把“无 Prompt 时响应”改为 `respondCommand('test', '0')`，并移除不再使用的 `INTERACTION_COMMANDS` import；保留 `INTERACTION_EVENTS.RESOLVED` 常量断言。
- 顺手清掉 `promptSystem.test.ts` 中未使用的 `ME_FIRST_PASS`，避免本批 lint 留 warning。
- 验证：
  - 改前基线：`npm test -- src/games/smashup/__tests__/promptResponseChain.test.ts src/games/smashup/__tests__/promptSystem.test.ts` -> 2 files passed / 22 tests passed。
  - 改后聚焦：同命令 -> 2 files passed / 22 tests passed。
  - 扩展目标扫描：仅剩 `promptSystem.test.ts` 的 AI fallback `INTERACTION_COMMANDS.RESPOND/CANCEL` 合同断言，未再剩普通响应命令手写。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/promptResponseChain.test.ts src/games/smashup/__tests__/promptSystem.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式剩余仍为 821 条；本批处理的是扩展扫描中的手写系统响应命令，不能把它当成全局完成。

## 2026-05-16 09:18 +08 小尾巴文件扩展扫描收敛

- 目标选择：从剩余命中最少的文件里跳过已标记谨慎的 skip 文件，选择 `reactionQueueOrdering.test.ts`、`scoringEligibleLock.test.ts`、`tortuga-pirate-king-flowhalted-fix.test.ts` 三个可安全收敛目标。
- 改前基线：`npm test -- src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/scoringEligibleLock.test.ts src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts` -> 3 files passed / 40 tests passed。
- `helpers.ts` 新增 `withPromptHandlerData(prompt, handlerData)`，让测试需要给 prompt 补 handler data / continuationContext 时不再裸写 `interaction.data`。
- `reactionQueueOrdering.test.ts`：把 footprint 测试里的 `(interaction.data as any).continuationContext = ...` 改为 `withPromptHandlerData(...)`。
- `scoringEligibleLock.test.ts`：删除未使用的 `INTERACTION_COMMANDS` import，消除扩展扫描和 eslint warning。
- `tortuga-pirate-king-flowhalted-fix.test.ts`：注释不再写内部 `sys.interaction.current` 路径；交互已解决用 `expectNoPrompt`，交互仍在进行用 `getFirstPrompt`。
- 改后验证：
  - 聚焦测试 -> 3 files passed / 40 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/scoringEligibleLock.test.ts src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；`tortuga-pirate-king-flowhalted-fix.test.ts` 仍作为旧泛名测试债务 warning，但本次没有净新增。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式剩余从 821 降到 820；另外两个清理点属于扩展扫描，不体现在主计数里。

## 2026-05-16 09:21 +08 feedback / audit 响应命令 seam 收敛

- 目标选择：`ancientEgyptiansMummyStrength.feedback-regression.test.ts` 与 `pirate-broadside-d1-audit.test.ts` 剩余命中均为手写 `INTERACTION_COMMANDS.RESPOND`，属于应迁到 `respondCommand` 的普通玩家响应命令。
- 改前基线：
  - `npm test -- src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts` -> 1 file passed / 1 test passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts` -> 1 file passed / 3 tests passed。
- 改动：
  - `ancientEgyptiansMummyStrength.feedback-regression.test.ts` 本地 `respond(...)` helper 改为返回 `respondCommand(optionId, playerId)`。
  - `pirate-broadside-d1-audit.test.ts` 两个用例的 base / target-player 响应命令改为 `respondCommand(...)`，移除 `INTERACTION_COMMANDS` import。
- 改后验证：
  - ancient 单测 -> 1 passed。
  - pirate broadside audit 专用 vitest -> 3 passed。
  - 两个目标文件扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式仍为 820；本批处理的是扩展扫描中的响应命令 seam。

## 2026-05-16 09:23 +08 Elder Thing multi prompt seam 收敛

- 目标选择：`elder-thing-multi-select.test.ts` 不是已标记 skip 的 integration 文件，剩余 6 个命中集中在 `interaction.data.title/multi` 直接读取。
- 改前基线：`npm test -- src/games/smashup/__tests__/elder-thing-multi-select.test.ts` -> 1 file passed / 3 tests passed；eslint 0 errors。
- `helpers.ts` 新增 `getPromptMulti(prompt)`，补齐 `getPromptMultiMin` 之外的完整 multi 配置读取 facade。
- `elder-thing-multi-select.test.ts`：标题断言改为 `getPromptTitle`，multi 配置断言改为 `getPromptMulti`；仍保留 `createSimpleChoice` 行为合同测试意图。
- 改后验证：
  - 单文件 -> 3 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式仍为 820；本批处理的是扩展扫描中的 `interaction.data` seam。

## 2026-05-16 09:26 +08 Alien Scout duplicate scoring 响应命令 seam 收敛

- 目标选择：`alien-scout-no-duplicate-scoring.test.ts` 剩余命中均为 afterScoring 链路里的手写 `INTERACTION_COMMANDS.RESPOND`，可迁到 `respondCommand`。
- 改前基线：`npm test -- src/games/smashup/__tests__/alien-scout-no-duplicate-scoring.test.ts` -> 1 file passed / 2 tests passed；eslint 0 errors。
- 改动：两个用例中的 Scout trigger / `yes` 响应命令全部改为 `respondCommand(...)`，移除 `INTERACTION_COMMANDS` import。
- 改后验证：
  - 单文件 -> 2 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式仍为 820；本批处理的是扩展扫描中的响应命令 seam。

## 2026-05-16 09:29 +08 Dino Rampage audit prompt seam 收敛

- 目标选择：`audit-d11-d12-d14-dino-rampage.test.ts` 混合了 `state.sys.interaction.current`、`interaction.data.sourceId/options` 与 `runner.dispatch('SYS_INTERACTION_RESPOND')`，适合单独处理。
- 改前基线：`npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts` -> 1 file passed / 6 tests passed；eslint 有既有 `prefer-const` warning。
- 改动：
  - 当前 prompt 读取改为 `getFirstPrompt(state)`。
  - sourceId 断言改为 `getPromptSourceId(interaction)`。
  - option 查找改为 `getPromptOption(interaction, predicate)`。
  - 玩家响应改为 `runner.resolveInteraction('0', { optionId })`，不再手写 `SYS_INTERACTION_RESPOND`。
- 改后验证：
  - audit 专用 vitest -> 6 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式从 820 降到 814。

## 2026-05-16 09:32 +08 Aliens audit fixes prompt seam 收敛

- 目标选择：`alienAuditFixes.test.ts` 不是 skip 文件，剩余命中集中在本地 `respondInteraction` 手写系统响应、prompt source/options 裸读与无 prompt 裸断言。
- 改前基线：`npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/alienAuditFixes.test.ts` -> 1 file passed / 14 tests passed；eslint 0 errors。
- 改动：
  - 本地 `respondInteraction` 改为调用 `respondToPrompt(...)`。
  - no-prompt 断言改为 `expectNoPrompt(...)`。
  - 当前 prompt 读取改为 `getFirstPrompt(...)`。
  - sourceId 断言改为 `getPromptSourceId(...)`。
  - option 查找改为 `getPromptOption(...)`。
  - stale-state 重放 prompt 使用 `withCurrentPrompt(...)`，不再手写 `sys.interaction.current` 状态结构。
- 改后验证：
  - audit 专用 vitest -> 14 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式从 814 降到 807。

## 2026-05-16 09:35 +08 afterScoring deferred clear prompt seam 收敛

- 目标选择：`afterscoring-window-skip-base-clear.test.ts` 剩余命中包含 current 清理/注入、`interaction.data` continuationContext、`interactionData` 裸取与 `INTERACTION_COMMANDS.RESPOND`。
- 改前基线：`npm test -- src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> 1 file passed / 15 tests passed；eslint 0 errors。
- 改动：
  - `wrapState` 用 `withoutCurrentPrompt(...)` 表达无当前 prompt。
  - 托尔图加 session prompt 用 `withPromptHandlerData(...)` 注入 `continuationContext`。
  - 手工挂 current 的 Scout prompt 改为 `withCurrentPrompt(state, createSimpleChoice(...))`。
  - resolved event 的 `interactionData` 改为 `getPromptHandlerData(interaction)`。
  - immediate extra minion 的 skip 响应改为 `runner.resolveInteraction('0', { optionId: 'skip' })`。
- 改后验证：
  - 单文件 -> 15 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - eslint -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式从 807 降到 804。

## 2026-05-16 09:44 +08 scoreBases AI/prompt seam 收敛

- 针对“是不是只改表象”继续处理 `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`，优先清理会在 InteractionSystem/AI command 外壳重构时碎裂的测试耦合。
- 改前基线：`npm test -- src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> 1 file passed / 36 tests passed。
- 改动：
  - `helpers.ts` 的 `respondCommand` 支持无 `playerId` 的 AI action command 期望值，并新增 `getRespondCommandOptionId(command)`。
  - 新增 `withPromptResolutionFrameId(prompt, frameId)`，让特殊 resolution frame setup 不再直接写 `state.sys.interaction.current`。
  - `scoreBases-auto-continue.test.ts` 移除 `asSimpleChoice` 直读，multi-base scoring prompt 改为 `getSimpleChoicePrompt(updatedState, 'multi_base_scoring')`，option 查找改为 `getPromptOption`。
  - AI command 断言不再手写 `SYS_INTERACTION_RESPOND` 字符串，改为 `respondCommand(...)` / `getRespondCommandOptionId(...)`。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 36 tests passed。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式从 804 降到 801；仍不能宣称整体完成。

## 2026-05-16 09:54 +08 Elder Thing ability prompt seam 收敛

- 目标选择：跳过 `mothership-scout-afterscore-bug.test.ts` 这类 `describe.skip` 文件，选择非 skip 的 `src/games/smashup/__tests__/elderThingAbilities.test.ts`。
- 改前基线：`npm test -- src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 1 file passed / 25 tests passed。
- 改动：
  - Mi-Go prompt 查找从 `interaction.data.sourceId` 改为 `getPromptSourceId(...)`，targetType 读取改为 `getPromptTargetType(...)`。
  - 旧 handler 桥接里的 `promptResult.matchState.sys.interaction.current.data` 改为 `getSimpleChoicePrompt(...)` + `getPromptHandlerData(...)`。
  - Begin the Summoning / Madness 的响应命令从 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand(...)`，选项查找改为 `getPromptOption(...)`。
  - Unfathomable Goals 的 prompt source 断言改为 `getPromptSourceId(...)`。
- 中途失误：清理 eslint warning 时一度把仍需读取的 `events` 变量误改为 `_events`，导致单文件短暂失败；已按失败行恢复，只保留真正未使用的两处 `_events`。
- 改后验证：
  - 单文件 -> 25 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有 Junction 镜像与既有旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式从 801 降到 795；仍不能宣称整体完成。

## 2026-05-16 10:00 +08 ongoing E2E prompt seam 收敛

- 目标选择：`ongoingE2E.test.ts` 非 skip，剩余命中集中在 Shanghai prompt 链、Pirate POD prompt source 与手写响应命令。
- 改前基线：`npm test -- src/games/smashup/__tests__/ongoingE2E.test.ts` -> 1 file passed / 14 tests passed；eslint 仅有一个未使用 `events` warning。
- 改动：
  - 上海单步 interaction source 断言改为 `getPromptSourceId(...)`。
  - Shanghai 完整 Prompt 链从 `asSimpleChoice(sys.interaction.current)` 改为 `getSimpleChoicePrompt(...)`，候选读取改为 `getPromptOptions` / `getPromptOption`。
  - 两处手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand(...)`。
  - Buccaneer POD 与 First Mate POD 的 prompt source 断言改为 `getPromptSourceId(...)`。
- 中途失误：清理未使用变量时先命中还需要读取 `events` 的 entangled 用例，导致单文件短暂失败；已恢复该变量，只把 Shanghai 创建交互用例的未使用结果改为 `_events`。
- 改后验证：
  - 单文件 -> 14 tests passed。
  - 目标扩展扫描 -> 0 命中。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/ongoingE2E.test.ts` -> 0 errors。
- 全 `src/games/smashup/__tests__` 主禁用模式从 795 降到 788；仍不能宣称整体完成。

## 2026-05-16 11:38 +08 query6 第 6 批能力 prompt seam 收敛

- 针对用户质疑“是不是只改表象”，继续选择非 skip 普通业务测试 `src/games/smashup/__tests__/query6Abilities.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/query6Abilities.test.ts` -> 30 tests passed。
- 改动：
  - 海盗/忍者/巫师的 prompt source 断言从 `(matchState.sys as any).interaction?.current?.data?.sourceId` 改为 `getSimpleChoicePrompt(state, sourceId)`。
  - `wizard_mass_enchantment` / `wizard_portal_order` / `wizard_scry` refresh 后候选读取改为 `getPromptOptions(prompt)`，`wizard_portal` multi 配置改为 `getPromptMulti(prompt)`。
  - `wizard_scry` 长链响应命令从手写 `INTERACTION_COMMANDS.RESPOND` 改为 `respondCommand('card-0', '0')`。
  - 真正无交互的分支改为 `expectNoPrompt(matchState)`，外星人 scout onPlay 无交互断言也不再裸读 `sys.interaction.current`。
- 中途失误：第一次机械把 `wizard_portal: 顶部5张全是行动卡时不抽牌但创建排序 Prompt` 也加了 `expectNoPrompt`，短暂失败；已按用例语义移除，只保留排序 prompt 正向断言。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 30 tests passed。
  - `npx eslint src/games/smashup/__tests__/query6Abilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式当前为 610；仍不能宣称整体完成。

## 2026-05-16 11:43 +08 baseAbilitiesPrompt 基础基地 prompt seam 收敛

- 目标选择：继续处理非 skip 普通业务测试 `src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts`，该文件的旧耦合集中在基地 prompt source/options/title/player 读取，以及旧 handler 桥接时直接传 `interaction.data`。
- 改前基线：`npm test -- src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> 33 tests passed。
- 改动：
  - Prompt source/player/title/options 断言改为 `getPromptSourceId` / `getPromptPlayerId` / `getPromptTitle` / `getPromptOptions`。
  - 旧 handler 桥接里的 `interaction.data` / `nextInteraction.data` 改为 `getPromptHandlerData(prompt)`，把 handler data 形状集中到 facade。
  - 二段 Pirate Cove base prompt 用 `getSimpleChoicePrompt(step1.state, 'base_pirate_cove_choose_base')` 查语义 prompt，不再裸读 queue[0].data。
  - stale regression 里的 option 查找改为 `getPromptOption(...)`。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 33 tests passed。
  - `npx eslint src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式当前为 594；仍不能宣称整体完成。

## 2026-05-16 11:45 +08 Igor onDestroy 幂等测试 prompt seam 收敛

- 目标选择：`src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` 的实际运行用例只是在证明某 sourceId 的 prompt 数量，旧代码手工拼 `current + queue` 并按 `data.sourceId` 过滤。
- 改前基线：`npm test -- src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` -> 3 passed / 1 skipped。
- 改动：
  - 3 个实际运行用例改用 `getPromptsBySourceId(state, 'frankenstein_igor')`。
  - source/player 断言改用 `getPromptSourceId` / `getPromptPlayerId`。
  - 文件内 `it.skip` 的九命之屋历史块未为了降计数硬改，仍保留旧内部访问，按 skip 历史债务处理。
- 改后验证：
  - 单文件 -> 3 passed / 1 skipped。
  - `npx eslint src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` -> 0 errors。
  - 实际运行用例的旧内部访问已清掉；扩展扫描剩余 4 命中全部位于 `it.skip` 历史块。
  - `npm run test:structure` -> OK。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式当前为 581；仍不能宣称整体完成。

## 2026-05-16 11:49 +08 ongoingTalent runtime prompt seam 收敛

- 目标选择：`src/games/smashup/__tests__/ongoingTalent.test.ts` 是非 skip 普通业务测试，旧命中集中在 `getInteractionsFromMS(ms)[0]`、二段 prompt 的 queue 读取、`data.options/sourceId` 和 handler data 直传。
- 改前基线：`npm test -- src/games/smashup/__tests__/ongoingTalent.test.ts` -> 27 tests passed。
- 改动：
  - Zeppelin ongoing talent 的选择随从、二段选择基地和 stale-state 回归改为 `getSimpleChoicePrompt` / `getPromptOptions` / `getPromptHandlerData`。
  - Trickster Hideout POD 交换链改为通过 sourceId facade 找 swap/destroy prompt，不再裸读 `getInteractionsFromMS` 或 queue。
  - Pixie POD runtime prompt 的 minion/action 两条链改为 facade 查询 prompt 与 options，并用 `getPromptHandlerData` 调旧 handler。
  - `autoResolveIfSingle` 的断言通过 prompt 顶层或 handler data 兼容读取，不再写 `data.autoResolveIfSingle`。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 27 tests passed。
  - `npx eslint src/games/smashup/__tests__/ongoingTalent.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式当前为 561；仍不能宣称整体完成。

## 2026-05-16 11:54 +08 newOngoingAbilities prompt seam 收敛

- 目标选择：`src/games/smashup/__tests__/newOngoingAbilities.test.ts` 是旧泛名大文件，本轮只做净删减式 prompt seam 收敛，不新增场景、不拆文件。
- 改前基线：`npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 126 tests passed。
- 改动：
  - First Mate / Buccaneer / Elder Thing / Shoggoth / Killer Plant / Full Sail / Plague of Locusts / Madness / Haunted House / R'lyeh / Mothership / Ninja Dojo / Igor / Bear Rides You POD 的 prompt source/options/target/display/handler data 读取改为 facade。
  - `current ?? queue[0]` 与 `result.state.sys.interaction...` 改为 `getSimpleChoicePrompt` / `getFirstPrompt`。
  - handler 调用中的 prompt data 改为 `getPromptHandlerData(prompt)`。
  - Giant Ant Drone 否定断言改为 `getPromptsBySourceId(...).length > 0`，不再裸读 current sourceId。
- 中途失误：`base_rlyeh` 无己方随从分支不会返回 `matchState`，第一次误用 `getOptionalSimpleChoicePrompt(result.matchState!, ...)` 导致短暂失败；已按原语义改回 `expect(result.matchState).toBeUndefined()`。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 126 tests passed。
  - `npx eslint src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；该旧泛名文件仍有结构债务 warning，但本轮为净删减，不阻断。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 全 `src/games/smashup/__tests__` 主禁用模式当前为 544；仍不能宣称整体完成。

## 2026-05-16 12:03 +08 expansionOngoing prompt seam 收敛

- 针对用户质疑“这么快，还是只改了表象”，继续处理非 skip 普通业务测试 `src/games/smashup/__tests__/expansionOngoing.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/expansionOngoing.test.ts` -> 67 tests passed。
- 改动：
  - Steampunk Mechanic / Change of Venue / Captain Ahab 的 current prompt、二段 target/base prompt、options 与 handler data 传递改为 `getSimpleChoicePrompt` / `getFirstPrompt` / `getPromptOptions` / `getPromptHandlerData`。
  - Killer Plant Sprout / Venus Man Trap 的 search prompt source/target/options 与 handler data 改为 prompt facade。
  - Innsmouth Return to the Sea 的 prompt source、self-return option 与 live/stale handler data 改为 `getSimpleChoicePrompt` / `getPromptOption` / `getPromptHandlerData`。
  - Miskatonic Researcher / Field Trip / POD / Librarian 多步链从 current+queue 手工查询改为 sourceId prompt facade。
  - 无 prompt 分支改为“有 matchState 则 `expectNoPrompt`，无 matchState 则保留原无交互返回形态”，不把不同无交互合同强行混成一种。
- 中途失败：第一次把无 `matchState` 的无交互分支直接传给 `expectNoPrompt`，导致 3 个用例短暂失败；修正为仅在返回 matchState 时断言无 prompt 后复跑通过。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 67 tests passed。
  - `npx eslint src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有历史 E2E 根入口与 `newOngoingAbilities.test.ts` 旧泛名债务 warning。
  - 全 `src/games/smashup/__tests__` 主禁用模式从 544 降到 523；仍不能宣称整体完成。

## 2026-05-16 12:11 +08 expansionBaseAbilities prompt seam 收敛

- 目标选择：继续处理非 skip 普通业务测试 `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 50 tests passed。
- 改动：
  - Fairy Ring / Arena / Mermaid Pool / Ossuary / Asylum / Miskatonic University / Greenhouse / Inventors Salon / Cat Fanciers Alley / Land of Balance 等 prompt source、target、player 与 options 读取改为 prompt facade。
  - Asylum、Innsmouth Base、Greenhouse 的二段 prompt 与 reaction queue 后续 prompt 改为 `getSimpleChoicePrompt(state, sourceId)`，不再直接读 `queue[0]` 或 `sys.interaction.current`。
  - stale move / stale destroy / stale deck-bottom / stale retrieve 等 handler 调用里的 `interaction.data` 改为 `getPromptHandlerData(prompt)`。
  - Greenhouse replacement follow-up 的 continuationContext 注入改为基于 `getPromptHandlerData(interaction)` 合并，避免测试体绑定 prompt data 存储形状。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 50 tests passed。
  - `npx eslint src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有历史 E2E 根入口与 `newOngoingAbilities.test.ts` 旧泛名债务 warning。
  - 全 `src/games/smashup/__tests__` 主禁用模式从 523 降到 495；仍不能宣称整体完成。

## 2026-05-16 12:26 +08 factionAbilities prompt seam 收敛

- 回应用户质疑“是不是只改表象”：本轮选择仍有 28 处旧耦合命中的非 skip 普通业务文件 `src/games/smashup/__tests__/factionAbilities.test.ts`，先跑基线 `npm test -- src/games/smashup/__tests__/factionAbilities.test.ts` -> 46 tests passed。
- 改动：
  - Trickster Gnome / Gnome POD 的 prompt source、候选查找、响应命令与收口无 prompt 断言改为 `getSimpleChoicePrompt` / `getPromptOption` / `respondCommand` / `expectNoPrompt`。
  - Pirates / Ninjas / Dinosaurs / Robots / Wizards / Aliens 的 prompt 出现与 targetType/options 读取改为 prompt facade，不再裸读 `sys.interaction.current` 或 `data.sourceId/options`。
  - immediate extra action 的 `optionsGenerator` 读取和 chain 回调里的候选选择改为 `getPromptOptionsGenerator` / `getPromptHandlerData` / `getPromptOption`。
  - Alien Collector / Supreme Overlord 的 runtime prompt 响应从手写 `SYS_INTERACTION_RESPOND` 改为 `respondCommand`。
- 中途失败：
  - 清理 unused warning 时误删两个仍需传给 facade 的 `matchState` 绑定，导致 `dino_natural_selection` 两个用例短暂 ReferenceError。
  - 按失败行恢复需要的 `matchState`，只清真正未使用的绑定。
- 改后验证：
  - 目标扩展扫描 -> 0 命中。
  - 单文件 -> 46 tests passed。
  - `npx eslint src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings。
  - `npm run test:structure` -> OK；仍只有历史 legacy-root E2E 与 `newOngoingAbilities.test.ts` 旧泛名债务 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 Git 的 LF/CRLF 工作区提示。
- 当前 broad scan（排除 `helpers.ts` / `helpers/**`）为 516 条，集中在 `interactionChainE2E.test.ts`、`smashup.smoke.test.ts`、`newBaseAbilities.test.ts`、`vampiresPod.test.ts`、shayu 旧文件及少量 audit/skip 债务；该数字包含需分类的系统合同/谨慎文件，后续继续按目标文件 0 命中推进。

## 2026-05-16 12:35 +08 PromptOverlay 与 vampiresPod seam 验证收口

- 针对“这么快，还是只改了表象？”重新核对最新两份改动：`PromptOverlay.interactions.test.tsx` 与 `vampiresPod.test.ts` 都不是只改测试名或表层断言，而是把测试体对系统响应命令、prompt source/options、无 prompt 断言的直接依赖收进 prompt/command facade。
- `PromptOverlay.interactions.test.tsx`：
  - 改动：按钮/触摸提交仍验证 UI 会提交 `discard` 选项，但命令形状改为复用 `respondCommand('discard')`，避免 UI 测试直接绑定 `INTERACTION_COMMANDS.RESPOND`。
  - 验证：`npm test -- src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx` -> 6 tests passed；`npx eslint src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx` -> 0 errors；目标扫描 0 命中。
- `vampiresPod.test.ts`：
  - 改动：Big Gulp / WWTLF / Drone / Fledgling / Nine Lives / The Count / Dinner Date / Wolf Pact 的 prompt 获取、source/options、响应命令、无 prompt 断言改为 `getFirstPrompt` / `getSimpleChoicePrompt` / `getPromptSourceId` / `getPromptOption` / `getPromptOptions` / `respondCommand` / `respondToPrompt` / `expectNoPrompt` 等 facade。
  - 验证：`npm test -- src/games/smashup/__tests__/vampiresPod.test.ts` -> 11 tests passed；`npx eslint src/games/smashup/__tests__/vampiresPod.test.ts` -> 0 errors；目标扫描 0 命中。
  - 说明：测试输出里的 `本回合你还没有消灭过随从` 是 Nightstalker talent 条件不足的预期负路径日志，不是失败。
- 结构/全局验证：
  - `npm run test:structure` -> OK；仍只有 `newOngoingAbilities.test.ts` 旧泛名债务与 legacy-root E2E 迁移 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check -- src/games/smashup/__tests__/vampiresPod.test.ts src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx task_plan.md progress.md findings.md` -> 0 errors，仅 LF/CRLF 工作区提示。
- 当前 broad scan（排除 `helpers.ts` / `helpers/**`）为 465 条，分布前几位：`interactionChainE2E.test.ts` 142、`smashup.smoke.test.ts` 109、`newBaseAbilities.test.ts` 83、`shayuFactionAbilities.test.ts` 40、`shayuComprehensiveBehavior.test.ts` 38。结论：这批不是表层改名，但整体还没完成。

## 2026-05-16 12:45 +08 newBaseAbilities 旧大文件 prompt seam 收敛

- 目标选择：直接处理剩余大头 `src/games/smashup/__tests__/newBaseAbilities.test.ts`，而不是停在小文件。改前基线：`npm test -- src/games/smashup/__tests__/newBaseAbilities.test.ts` -> 60 tests passed；目标模式 83 命中。
- 改动：
  - 本地 `resolveDuelChain` 不再读 `prompt.data.sourceId/options`，改为 `getPromptSourceId` / `getPromptOptions` / `getPromptOption`。
  - Haunted House AL9000、Microbot Guard、Pyramids、Crypt、Castle Blood、Drakkar、Longhouse、Cowboys、Samurai、POD 复用基地的 prompt source/options 与响应命令改为 prompt/command facade。
  - 三段 reaction choose 链新增本地 `resolveReactionPromptBySource` / `maybeResolveReactionPromptBySource`，把 `smashup_reaction_choose` 当前 prompt、trigger option 查找和 respond 命令外壳集中起来，测试体只表达“选择哪个 sourceDefId 的反应”。
  - 无 prompt 断言从裸读 `sys.interaction.current` 改为 `expectNoPrompt`。
- 验证：
  - 目标扫描 -> 0 命中。
  - `npm test -- src/games/smashup/__tests__/newBaseAbilities.test.ts` -> 60 tests passed。
  - `npx eslint src/games/smashup/__tests__/newBaseAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍提示 `newBaseAbilities.test.ts` / `newOngoingAbilities.test.ts` 是旧泛名文件债务，本轮为净删减，不阻断。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check` -> 0 errors，仅 LF/CRLF 工作区提示。
- 全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 465 降到 382；当前主要剩余：`interactionChainE2E.test.ts` 142、`smashup.smoke.test.ts` 109、`shayuFactionAbilities.test.ts` 40、`shayuComprehensiveBehavior.test.ts` 38。结论：这批是行为 seam 的实质收敛，但整体任务仍未完成。

## 2026-05-16 12:52 +08 interactionChainE2E 多步链 facade 收敛

- 目标选择：继续处理剩余最大头 `src/games/smashup/__tests__/interactionChainE2E.test.ts`；改前基线 `npm test -- src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 54 passed / 1 skipped；目标模式 142 命中。
- 改动：
  - 文件头从“手写 `INTERACTION_COMMANDS.RESPOND`”更新为 prompt/command facade 口径。
  - 本地 `respond` 改为 `respondCommand(optionId, playerId)`；`respondWithMergedValue` 仍保留 merged value 语义，但命令外壳复用 facade。
  - 全文件 `asSimpleChoice(state.sys.interaction.current)` 改为 `getSimpleChoicePrompt(state)`；无 prompt 裸断言改为 `expectNoPrompt(state)`。
  - `findOption` 改为调用 `getPromptOption`，不再直接读 `choice.options`。
  - 特殊允许“可能没有后续 prompt”的 Ghost The Dead Rise 分支改为 `getOptionalSimpleChoicePrompt`，保留原语义。
  - `allowedBaseIndices` 读取改为 `getPromptHandlerData(choice)`，不再裸读 current prompt data。
- 中途失败：
  - 第一次机械把 Ghost The Dead Rise 的可选后续 prompt 改成强制 `getSimpleChoicePrompt`，导致 1 个用例失败：`Expected a simple choice prompt, but no prompt was available`。
  - 修正为 `getOptionalSimpleChoicePrompt` 后复跑通过。
- 验证：
  - 目标扫描 -> 0 命中。
  - `npm test -- src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 54 passed / 1 skipped。
  - `npx eslint src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有旧泛名文件和 legacy-root E2E 迁移 warning。
- 全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 382 降到 240；当前主要剩余：`smashup.smoke.test.ts` 109、`shayuFactionAbilities.test.ts` 40、`shayuComprehensiveBehavior.test.ts` 38。结论：这批继续是行为 seam 实质收敛，不是表层改名；整体仍未完成。

## 2026-05-16 13:03 +08 smashup.smoke 泰坦/基地 smoke facade 收敛

- 回应用户质疑“这么快，还是只改了表象”：继续处理最大剩余普通业务文件 `src/games/smashup/__tests__/smashup.smoke.test.ts`，而不是停在小文件或只改注释。接手时目标模式 88 命中。
- 改动：
  - Cream Puff Man / Ancient Curse / Ancient Lord / Cthulhu Titan / Major Ursa / Mergacon / Rainboroc / Gorgodzolla / Invisible Ninja / Walking Castle / Hill That Strolls / Time Box / Moon Zero Three / Megabot / Emperor Penguin / Great Wolf Spirit / The Kraken / First Mate / The Bride / Pecos Bill / Fort Titanosaurus 等 smoke 行为链改为 `getSimpleChoicePrompt` / `getOptionalSimpleChoicePrompt` / `getPromptsBySourceId` / `getPromptOption` / `getPromptOptions` / `getPromptHandlerData` / `getReactionPromptOptionBySourceDefId` / `respondCommand`。
  - reaction choose 不再在测试体手工遍历 `current.data.options` 和 `triggerQueue`；测试表达“选择哪个 sourceDefId 的反应”，实现细节集中到 helper。
  - 旧 handler 桥接保留业务行为断言，但 handler data 统一从 prompt facade 取，不再裸传 `state.sys.interaction.current.data` 或 `queue[0].data`。
  - AI follow-up 响应命令和 Pecos Bill 决斗响应从手写 `SYS_INTERACTION_RESPOND` 改为 `respondCommand`。
- 验证：
  - 目标扫描 -> 0 命中。
  - `npm test -- src/games/smashup/__tests__/smashup.smoke.test.ts` -> 133 tests passed。
  - `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仍只有旧泛名文件与 legacy-root E2E 迁移 warning。
  - 编码检查通过；`findings.md` 仍有既有 replacement-char 可疑告警。
  - `git diff --check -- src/games/smashup/__tests__/smashup.smoke.test.ts task_plan.md progress.md findings.md` -> 0 errors，仅 LF/CRLF 工作区提示。
- 全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 240 降到 131；当前主要剩余：`shayuFactionAbilities.test.ts` 40、`shayuComprehensiveBehavior.test.ts` 38、`audit-d1-alien-crop-circles.test.ts` 13、`mothership-scout-afterscore-bug.test.ts` 12。结论：`smashup.smoke.test.ts` 这批是行为 seam 实质收敛，但整体任务仍未完成。

## 2026-05-16 13:14 +08 shayu 综合行为测试 facade 收敛

- 先补状态口径：上一批 `src/games/smashup/__tests__/shayuFactionAbilities.test.ts` 已把真实入口 shayu 行为测试里的 prompt option 查找、source/target/player 断言与无 prompt 断言迁到 prompt facade；验证为 21 tests passed、eslint 0 errors、`npm run test:structure` OK，目标扫描 0 命中。
- 本批目标选择：继续处理剩余普通业务大头 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`，不是只改测试名或注释。改前基线 `npm test -- src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` -> 14 tests passed；目标模式 38 命中。
- 改动：
  - 本地 `chooseOptionBySource` 从 `prompt.data.sourceId` / `prompt.data.options.find` 改为 `getPromptSourceId` / `getPromptOption`。
  - 巨齿鲨、大白鲨、灰鲭鲨、血腥水域、鲨鱼领地、鲨鱼诱饵、海渊、哈迪斯恩惠、旋风/龙卷风怪物、龙卷风走廊等链路的 prompt source/options/player 读取改为 `getPromptOptions` / `getPromptPlayerId` / `getSimpleChoicePrompt`。
  - 所有“链路收口后没有 prompt”的断言从裸读 `sys.interaction.current` 改为 `expectNoPrompt`。
  - trigger option 查询仍保留“从当前 triggerQueue 找可选反应”的业务语义，但 options 读取走 facade。
- 验证：
  - `shayuComprehensiveBehavior.test.ts` 目标扫描 -> 0 命中。
  - `npm test -- src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` -> 14 tests passed。
  - `npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仅旧泛名文件与 legacy-root E2E 历史 warning。
  - `git diff --check -- src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts task_plan.md progress.md findings.md` -> 0 errors，仅 LF/CRLF 工作区提示。
- 全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 91 降到 53。当前主要剩余：`audit-d1-alien-crop-circles.test.ts` 13、`mothership-scout-afterscore-bug.test.ts` 12、`miskatonic-scout-afterscore.test.ts` 6、`elder-thing-multi-select-integration.test.ts` 4、`igor-ondestroy-idempotency.test.ts` skip 历史块 4、`promptSystem.test.ts` 底层合同 3、`wizard-academy-scout-afterscore.test.ts` 3。

## 2026-05-16 13:19 +08 Crop Circles audit seam 与夹具收敛

- 剩余专项分类：`mothership-scout-afterscore-bug.test.ts`、`miskatonic-scout-afterscore.test.ts`、`wizard-academy-scout-afterscore.test.ts`、`elder-thing-multi-select-integration.test.ts`、`test-alien-scout-afterscore.test.ts`、`ninja-hidden-ninja-interaction-bug.test.ts`、`wizard-archmage-zombie-interaction.test.ts`、`vampireBuffetE2E.test.ts` 当前均为全文件或用例级 `.skip`，只贡献历史债务计数，不为降数字硬改。
- `src/games/smashup/__tests__/audit-d1-alien-crop-circles.test.ts` 改前用 audit 专用配置跑出真实红灯：2/3 failed，根因是测试夹具手写随从缺少领域默认字段 `attachedActions`，在 `MINION_RETURNED` reduce 时抛 `minion.attachedActions is not iterable`。
- 改动：
  - 三个 audit 场景的手写随从改为 `makeMinion(...)`，补齐领域默认字段，避免测试数据形状与生产随从实例不一致。
  - Prompt source/options/target/multi 读取改为 `getSimpleChoicePrompt` / `getPromptOptions` / `getPromptOption` / `getPromptSourceId` / `getPromptTargetType` / `getPromptMulti`。
  - 响应命令改为 `respondCommand(...)`，收口无 prompt 断言改为 `expectNoPrompt`。
- 验证：
  - 目标扫描 -> 0 命中。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/audit-d1-alien-crop-circles.test.ts` -> 3 tests passed。
  - `npx eslint src/games/smashup/__tests__/audit-d1-alien-crop-circles.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK；仅旧泛名文件与 legacy-root E2E 历史 warning。
  - `git diff --check -- src/games/smashup/__tests__/audit-d1-alien-crop-circles.test.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts task_plan.md progress.md findings.md` -> 0 errors，仅 LF/CRLF 工作区提示。
- 全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 53 降到 40。当前主要剩余集中在 skip 历史文件与 `promptSystem.test.ts` 底层合同候选；不能把这个数字直接等同于仍有 40 条可运行业务测试待改。

## 2026-05-16 13:21 +08 剩余 40 条分类复核

- 已复跑底层合同候选：`npm test -- src/games/smashup/__tests__/promptSystem.test.ts` -> 8 tests passed。剩余 3 条命中均来自 AI fallback 对 `INTERACTION_COMMANDS.RESPOND` / `INTERACTION_COMMANDS.CANCEL` 的显式合同断言，暂不迁到业务 facade。
- 已复跑 skip 混合文件：`npm test -- src/games/smashup/__tests__/igor-ondestroy-idempotency.test.ts` -> 3 passed / 1 skipped。剩余 4 条命中均在九命之屋 `it.skip` 历史块，实际运行用例已走 `getPromptsBySourceId`。
- 已逐文件检查 skip 声明：
  - `mothership-scout-afterscore-bug.test.ts` -> `describe.skip`
  - `miskatonic-scout-afterscore.test.ts` -> `describe.skip`
  - `elder-thing-multi-select-integration.test.ts` -> `describe.skip`
  - `ninja-hidden-ninja-interaction-bug.test.ts` -> `it.skip`
  - `test-alien-scout-afterscore.test.ts` -> `describe.skip`
  - `vampireBuffetE2E.test.ts` -> `describe.skip`
  - `wizard-academy-scout-afterscore.test.ts` -> `describe.skip`
  - `wizard-archmage-zombie-interaction.test.ts` -> `it.skip`
- 结论：当前 broad scan 剩余 40 条主要是“历史 skip 待归档/重写”与“底层系统合同例外”，不是 40 条仍在运行的普通业务测试旧耦合。后续要继续推进时，应开一个小批次把这些 skip 复现逐个决定：恢复为可运行行为测试、迁到 evidence 历史债务、或删除前先走用户确认。

## 2026-05-16 13:23 +08 测试规范快速参考补齐

- 发现 `docs/testing-best-practices.md` 底部“测试辅助函数/快速参考”仍把 `getInteractionsFromMS` 写成默认检查交互工具，和本轮 TDD 行为 seam 口径冲突。
- 已改为：业务测试优先使用 `getSimpleChoicePrompt` / `getPromptOption` / `getPromptOptions` / `expectNoPrompt`；`getInteractionsFromMS` 只作为 InteractionSystem/queue 存储契约测试的低层兼容工具。
- 同步修正 “跳过慢速测试” 示例：不再建议提交 `it.skip` 做性能优化，改为只跑相关文件/用例，慢速专项放 property/audit/E2E 专用配置。
- `docs/automated-testing.md` 中保留 E2E fixture 初始化失败时的动态 `test.skip()` 示例，但补充限制：仅用于测试环境/房间初始化前置失败，不得用来跳过业务断言失败。
- 验证：`rg` 仍能在文档中找到一处 `getInteractionsFromMS(matchState)`，但该处已明确标注“只有测试目标就是 InteractionSystem/queue 存储契约时才直接枚举”；`git diff --check -- docs/testing-best-practices.md` 无错误，仅 LF/CRLF 工作区提示。

## 2026-05-16 13:27 +08 剩余 broad scan 精确分桶

- 重新对剩余 40 条目标命中按文件内容分桶，避免把 skip 历史债务误当作活跃业务测试：
  - `skip-history`: 36
  - `system-contract`: 3
  - `helper-compat`: 1
- 文件分布：
  - `mothership-scout-afterscore-bug.test.ts`: 12，`describe.skip`
  - `miskatonic-scout-afterscore.test.ts`: 6，`describe.skip`
  - `elder-thing-multi-select-integration.test.ts`: 4，`describe.skip`
  - `igor-ondestroy-idempotency.test.ts`: 4，`it.skip` 历史块，实际运行用例已迁 facade
  - `promptSystem.test.ts`: 3，AI fallback `RESPOND/CANCEL` 系统合同
  - `wizard-academy-scout-afterscore.test.ts`: 3，`describe.skip`
  - `ninja-hidden-ninja-interaction-bug.test.ts`: 2，`it.skip`
  - `test-alien-scout-afterscore.test.ts`: 2，`describe.skip`，核心意图已有活跃覆盖
  - `wizard-archmage-zombie-interaction.test.ts`: 2，`it.skip`
  - `helpers/auditUtils.ts`: 1，helper 兼容重导出
  - `vampireBuffetE2E.test.ts`: 1，`describe.skip`
- 结论：当前没有剩余的“活跃普通业务测试旧 prompt seam”命中。继续推进应切到 skip 历史治理，而不是继续替换运行不到的字段访问。

## 2026-05-16 13:37 +08 auditUtils 低层兼容出口删除

- 针对用户质疑“是不是只改表象”，继续处理剩余 40 条里的 `helper-compat=1`：`src/games/smashup/__tests__/helpers/auditUtils.ts` 不再重导出 `getInteractionsFromMS`。
- 删除前查询：
  - `rg -n "getInteractionsFromMS" src/games/smashup/__tests__ -g "*.ts" -g "!helpers.ts"` 仅命中 `helpers/auditUtils.ts`，说明没有业务测试或 audit 文件从该兼容出口使用低层枚举。
  - `rg -n auditUtils src/games/smashup/__tests__ -g "*.ts"` 显示多个 audit 文件仍使用 `auditUtils` 的合法查询/工厂出口，但不使用 `getInteractionsFromMS`。
- 验证：
  - 删除后同一 `getInteractionsFromMS` 查询在 `helpers.ts` 外 0 命中。
  - `npm run test:structure` -> OK；仍只有旧泛名文件和 legacy-root E2E 历史 warning。
  - 扩大跑 8 个 audit 入口时，4 个通过、4 个失败。失败不是本次出口删除导致的编译/导入问题，而是既有业务审计红灯：
    - `abilityBehaviorAudit.test.ts`：`zombies.ts` 出现在遗留 `registerAbility` 使用结果中，但白名单未包含。
    - `audit-ability-coverage.property.test.ts`：`sharks_mako::special` 未在 abilityRegistry 注册。
    - `audit-keyword-behavior.property.test.ts`：`ancient_egyptians_you_can_take_it_with_you` 描述含 buried special，但 specialSemantics 未匹配。
    - `audit-ongoing-coverage.property.test.ts`：`werewolf_leader_of_the_pack_pod` ongoing 行动卡未在 ongoing 注册表注册。
- 结论：本轮不是把剩余数字刷掉，而是移除了一个会诱导新测试绕过 facade 的低层出口；剩余 broad scan 从 40 变为 39，分桶为 `skip-history=36`、`system-contract=3`。

## 2026-05-16 13:41 +08 Elder Thing 多选 skip 恢复为可运行集成测试

- 处理 `src/games/smashup/__tests__/elder-thing-multi-select-integration.test.ts`：原文件整段 `describe.skip`，引用未导入/不存在的 `GameTestRunner`、`SmashUpCore`、`PLAYER_IDS` 等对象，实际没有运行价值。
- 没有只做 facade 字段替换；重写为真实命令链测试：
  - `PLAY_MINION` 打出 `elder_thing_elder_thing`。
  - 通过 `getSimpleChoicePrompt(..., 'elder_thing_elder_thing_choice')` 选择 `destroy`。
  - 继续通过 `elder_thing_elder_thing_destroy_first` / `elder_thing_elder_thing_destroy_second` 两步 prompt 选择 `m1` 与 `m3`。
  - 最终断言 `MINION_DESTROYED` 只包含所选两个目标，并检查基地剩余 `m2` 与 `et-card`。
- 验证：
  - `npm test -- src/games/smashup/__tests__/elder-thing-multi-select-integration.test.ts` -> 1 test passed。
  - `npx eslint src/games/smashup/__tests__/elder-thing-multi-select-integration.test.ts` -> 0 errors。
  - 目标模式 + skip 扫描该文件 -> 0 命中。
  - `npm run test:structure` -> OK；仍只有旧泛名文件和 legacy-root E2E 历史 warning。
- 结果：全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 39 降到 35。剩余 35 = `skip-history=32` + `system-contract=3`。

## 2026-05-16 13:43 +08 alien_scout afterScoring skip 恢复为可运行回归

- 处理 `src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts`：原文件 `describe.skip`，使用旧 `GameTestRunner('smashup', ...)` 形状和 `RESOLVE_INTERACTION` 命令，已不符合当前测试入口。
- 按原注释的真实意图重写：验证 `alien_scout` 不依赖 `special` abilityTag，也能通过 afterScoring trigger 创建 `alien_scout_return` prompt，并且选择回手后真正从基地进入控制者手牌。
- 改动方式：
  - 使用 `fireTriggers(core, 'afterScoring', ...)` 建立 trigger 层可运行基线。
  - Prompt 读取改为 `getSimpleChoicePrompt` / `getPromptOptions` / `getPromptOption`。
  - 响应处理通过 `getAbilityRuntimePromptHandler('alien_scout_return')` + `getPromptHandlerData(prompt)`，最终用 `applyEvents` 验证权威状态变化。
- 验证：
  - `npm test -- src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts` -> 2 tests passed。
  - `npx eslint src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts` -> 0 errors。
  - 目标模式 + skip 扫描该文件 -> 0 命中。
  - `npm run test:structure` -> OK；仍只有旧泛名文件和 legacy-root E2E 历史 warning。
- 结果：全目录 broad scan（排除 `helpers.ts` / `helpers/**`）从 35 降到 33。剩余 33 = `skip-history=30` + `system-contract=3`。

## 2026-05-16 14:15 +08 afterScoring skip 历史治理

- 回应用户质疑“是否只改表象”，继续处理剩余 3 个 SmashUp `skip` 历史文件，而不是只做标记删除。
- `mothership-scout-afterscore-bug.test.ts` 已重写为当前规则下的真实行为测试：
  - 母舰先结算后，侦察兵 prompt 仍会出现，清场延迟到最后。
  - 母舰 + 两个侦察兵 + 大副按链式顺序结算，大副最后能移动到其他基地。
  - 巫师学院先结算后，侦察兵 prompt 仍会继续出现。
- 删除 `miskatonic-scout-afterscore.test.ts`：当前实现中 `base_miskatonic_university_base` 注册的是 `onMinionPlayed`，旧文件的 afterScoring 前提已过期。
- 删除 `wizard-academy-scout-afterscore.test.ts`：原文件依赖旧 `wizard_academy` / `wizard_academy_reorder` 口径，当前有效覆盖已合并进可运行链式回归。
- `audit-d1-base-tortuga.test.ts` 已把 `interactions[0].data.options` 与 `interactions[0].playerId` 改为 `getPromptOptions` / `getPromptPlayerId`。
- 验证：
  - `npm test -- src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts` -> 3 passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/audit-d1-base-tortuga.test.ts` -> 7 passed。
  - `npx eslint src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts src/games/smashup/__tests__/audit-d1-base-tortuga.test.ts` -> 0 errors。
  - `npm run test:structure` -> OK。
  - `rg "\\b(it|test|describe)\\.skip|\\.skip\\(" src/games/smashup/__tests__` -> 0 命中。
  - 内部 prompt broad scan 只剩 `helpers.ts` 中的集中 facade/兼容实现。

## 2026-05-16 14:25 +08 old newOngoingAbilities 拆分批次

- 完成度审计后确认：当前 `skip` 与业务测试裸 prompt seam 已清到扫描范围内为 0；剩余 `test:structure` warning 主要是旧泛名文件债务。
- 迁出 `newOngoingAbilities.test.ts` 的 Bear Cavalry 保护/触发簇到 `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`：
  - 覆盖 `general_ivan`、`polar_commando`、`superiority`、`cub_scout`、`high_ground`。
  - 验证：`npm test -- src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> 15 passed。
- 迁出 `newOngoingAbilities.test.ts` 的 Dinosaurs 簇到 `src/games/smashup/__tests__/abilities/dinosaurs.test.ts`：
  - 覆盖 `dino_upgrade` 与 `dino_tooth_and_claw`。
  - 验证：`npm test -- src/games/smashup/__tests__/abilities/dinosaurs.test.ts` -> 3 passed。
- 迁出 `newOngoingAbilities.test.ts` 的 Cthulhu 簇到 `src/games/smashup/__tests__/abilities/cthulhu.test.ts`：
  - 覆盖 `cthulhu_altar`、`cthulhu_furthering_the_cause`、`turnDestroyedMinions` reducer 跟踪。
  - 验证：`npm test -- src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> 7 passed。
- 源文件验证：`npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 101 passed。
- 质量门禁：`npx eslint` 针对迁出文件与源文件 -> 0 errors；`npm run test:structure` -> OK。
- 剩余：`newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 仍作为旧泛名债务被结构门禁警告，后续继续按能力/基地簇拆。

## 2026-05-16 14:46 +08 继续拆 old newOngoingAbilities，避免只做表象

- 迁出完整 Killer Plants 簇到 `src/games/smashup/__tests__/abilities/killer-plants.test.ts`：
  - 覆盖 Overgrowth / Entangled / Venus Man Trap / Budding / Deep Roots / Choking Vines。
  - `killer_plant_budding` 从裸读 `result.matchState.sys.interaction.current` 改为 prompt facade。
  - 验证：`npm test -- src/games/smashup/__tests__/abilities/killer-plants.test.ts` -> 18 passed。
- 迁出 Elder Things ongoing / onPlay 簇到 `src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts`：
  - 覆盖 Dunwich Horror / The Price of Power / Elder Thing / Shoggoth。
  - 验证：`npm test -- src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` -> 16 passed。
- 源文件继续净删减：
  - `newOngoingAbilities.test.ts` 从 101 tests 降到 67 tests。
  - 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 67 passed。
- 质量门禁：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 0 errors。
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK，仍警告 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 旧泛名债务。
- 注意：本机当前存在多个 dev/E2E/Context7 Node 进程；并行跑 Vitest/ESLint 曾触发 OOM。后续这类验证默认串行并带 `NODE_OPTIONS=--max-old-space-size=4096`。

## 2026-05-16 14:58 +08 Cthulhu/Madness 与 Bear Cavalry POD 继续迁出

- 迁出 Cthulhu / Madness 剩余簇到 `src/games/smashup/__tests__/abilities/cthulhu.test.ts`：
  - `cthulhu_chosen beforeScoring`
  - `cthulhu_complete_the_ritual onTurnStart`
  - `special_madness onPlay`
  - 疯狂卡终局 VP 统计
- 强化点：`cthulhu_chosen` 的有 `matchState` 场景不再只断言 `result.matchState` 存在，而是用 `getSimpleChoicePrompt` / `getPromptSourceId` / `getPromptTargetType` 验证 `cthulhu_chosen_confirm` prompt。
- 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> 20 passed。
- 迁出 Bear Cavalry POD 尾部簇到 `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`：
  - `bear_cavalry_bear_necessities_pod`
  - `bear_cavalry_superiority_pod`
  - `bear_cavalry_bear_rides_you_pod`
- 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> 21 passed。
- 源文件继续净删减：
  - `newOngoingAbilities.test.ts` 从 67 -> 54 -> 48 tests。
  - 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 48 passed。
- 质量门禁：
  - `npx eslint` 针对 `abilities/cthulhu.test.ts`、`abilities/bear-cavalry.test.ts` 与 `newOngoingAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK，仍警告 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 旧泛名债务。
  - 业务测试裸 prompt seam 扫描无命中。

## 2026-05-16 15:03 +08 Frankenstein / Vampires 剩余簇迁出

- 迁出 `frankenstein_igor: 基地结算弃置触发` 到 `src/games/smashup/__tests__/abilities/frankenstein.test.ts`：
  - 覆盖非 Igor 不触发、Igor 自身被弃、POD Igor、自身被弃同基地候选、多候选 prompt、giant_ant_drone 不被弃置触发误触发。
  - 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> 11 passed。
- 迁出 `vampire_buffet afterScoring` 到 `src/games/smashup/__tests__/abilities/vampires.test.ts`：
  - 覆盖赢家拥有 buffet 时全场己方随从获得 +1 指示物；非赢家拥有 buffet 时不加指示物。
  - 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/abilities/vampires.test.ts` -> 8 passed。
- 源文件继续净删减：
  - `newOngoingAbilities.test.ts` 从 48 -> 40 tests。
  - 验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 40 passed。
- 质量门禁：
  - `npx eslint` 针对 `abilities/frankenstein.test.ts`、`abilities/vampires.test.ts` 与 `newOngoingAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK，仍警告 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 旧泛名债务。
  - 业务测试裸 prompt seam 扫描无命中。

## 2026-05-16 15:20 +08 清空 `newOngoingAbilities.test.ts`

- 先验证 Pirates 迁出批次：
  - `npx eslint src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 0 errors。
  - `npm test -- src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 19 tests passed。
  - `npm test -- src/games/smashup/__tests__/newOngoingAbilities.test.ts` -> 21 tests passed。
  - `npm run test:structure` -> OK，仍警告 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts`。
- 继续迁出剩余 9 个 describe 并删除旧文件：
  - `alien_jammed_signal` -> `src/games/smashup/__tests__/abilities/aliens.test.ts`。
  - `ancient_egyptians_plague_of_locusts` -> `src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts`。
  - `BASE_REPLACED` -> `src/games/smashup/__tests__/bases/base-replacement.test.ts`。
  - Haunted House / R'lyeh / Mountains of Madness / Homeworld / Mothership / Ninja Dojo -> `src/games/smashup/__tests__/bases/interaction-base-abilities.test.ts`。
- 深化 seam：旧文件里直接调用 `getInteractionHandler()` 的用例，迁出时改成完整 prompt 响应链；首次红灯显示 `respondToPrompt` 会带出系统事件，测试因此改为断言目标业务事件存在/不存在，而不是锁 `events.length` 和数组下标。
- 验证：
  - `npx eslint src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/games/smashup/__tests__/bases/base-replacement.test.ts src/games/smashup/__tests__/bases/interaction-base-abilities.test.ts` -> 0 errors。
  - `npm test -- src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/games/smashup/__tests__/bases/base-replacement.test.ts src/games/smashup/__tests__/bases/interaction-base-abilities.test.ts` -> 4 files / 21 tests passed。
  - `npm run test:structure` -> OK；warning 只剩 `newBaseAbilities.test.ts`。
  - `rg` 扫描 `newOngoingAbilities|sys.interaction.current|getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|interaction.data|.data.options|skip`（排除 `helpers.ts` / `helpers/**`）-> 0 命中。
- 当前状态：`newOngoingAbilities.test.ts` 已删除，旧 ongoing 垃圾桶已退出；`newBaseAbilities.test.ts` 仍是剩余主要结构债务，任务继续。

## 2026-05-16 15:24 +08 旧 `newBaseAbilities` 入口退出

- 改前基线：`npm test -- src/games/smashup/__tests__/newBaseAbilities.test.ts` -> 60 tests passed；目标 prompt seam / skip 扫描 0 命中。
- 处理方式：`newBaseAbilities.test.ts` 已移动到 `src/games/smashup/__tests__/bases/base-ability-contracts.test.ts`，并修正相对 import。该文件仍作为基地能力合同集合承载现有 60 条覆盖，但不再作为 `new*` 泛名入口。
- 验证：
  - `npx eslint src/games/smashup/__tests__/bases/base-ability-contracts.test.ts` -> 0 errors。
  - `npm test -- src/games/smashup/__tests__/bases/base-ability-contracts.test.ts` -> 60 tests passed。
  - `npm run test:structure` -> OK，且不再输出 `newOngoingAbilities.test.ts` / `newBaseAbilities.test.ts` 旧泛名 warning。
  - `rg` 扫描 `newOngoingAbilities|newBaseAbilities|sys.interaction.current|getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|interaction.data|.data.options|skip`（排除 helper 层）-> 0 命中。
  - `git diff --check` 针对本轮测试/计划/进度文件 -> 0 errors，仅提示文档 LF/CRLF 工作区换行警告。
- 当前状态：两个旧 `new*` SmashUp 测试入口均已退出；业务测试裸 prompt seam 与 skip 扫描为 0；结构门禁无 warning。后续若继续深化，应拆 `bases/base-ability-contracts.test.ts` 的大集合，而不是再往里面新增场景。

## 2026-05-16 15:31 +08 继续拆分基地合同集合文件

- 完成度审计发现：虽然 `newBaseAbilities.test.ts` 已退出，但新位置 `bases/base-ability-contracts.test.ts` 仍有 2705 行，存在“换了名字的大集合文件”风险，不能把它当最终完成。
- 拆分结果：
  - `base-core-effects.test.ts`：基础触发/消灭/额度/牌库底等核心基地效果，16 tests。
  - `base-scoring-effects.test.ts`：afterScoring 型基础基地效果，10 tests。
  - `ancient-egyptian-bases.test.ts`：Ancient Egyptians 基地与 POD，4 tests。
  - `first-minion-bases.test.ts`：实验工坊/集会场首随从类基地，9 tests。
  - `optional-trigger-bases.test.ts`：血堡/地窖可选触发，2 tests。
  - `vikings-bases.test.ts`：Vikings 基地，4 tests。
  - `cowboys-bases.test.ts`：Cowboys 基地，2 tests。
  - `samurai-bases.test.ts`：Samurai 基地与相关 POD 复用，13 tests。
  - `base-contract-helpers.ts`：共享工厂、决斗链、reaction prompt 选择、常用 imports。
- 删除旧集合文件：`src/games/smashup/__tests__/bases/base-ability-contracts.test.ts`。
- 中途红灯：第一次拆分生成漏 import `initAllAbilities`，导致 8 个新文件在 `beforeAll` 报 `ReferenceError`。补 import 后复跑通过。
- 验证：
  - `npx eslint` 针对 8 个新文件 + `base-contract-helpers.ts` -> 0 errors。
  - `npm test --` 8 个新文件 -> 8 files / 60 tests passed。
  - `npm test -- src/games/smashup/__tests__/bases` -> 15 files / 101 tests passed。
  - `npm run test:structure` -> OK。
  - `rg` 扫描 `newOngoingAbilities|newBaseAbilities|base-ability-contracts|sys.interaction.current|getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|interaction.data|.data.options|skip`（排除 helper 层）-> 0 命中。
  - `git diff --check` 针对本轮测试/计划/进度文件 -> 0 errors，仅文档 LF/CRLF 工作区提示。
- 文件规模复核：当前 `bases` 下最大测试文件为 `samurai-bases.test.ts` 707 行，其次 `base-core-effects.test.ts` 556 行，不再有 2705 行级别集合文件。

## 2026-05-16 15:35 +08 继续拆 `samurai-bases.test.ts`

- 完成度审计发现：`samurai-bases.test.ts` 仍有 707 行，且一个 `describe('Oops Samurai bases')` 混合了将军宫、樱花园和 POD 跨派系复用合同。
- 拆分结果：
  - `samurai-shoguns-palace-bases.test.ts`：Shogun's Palace / POD 决斗抓牌合同，3 tests。
  - `samurai-sakura-garden-bases.test.ts`：Sakura Garden / POD 与 Samurai-Chan / Honor the Fallen 触发链，6 tests。
  - `pod-base-reuse.test.ts`：Saloon / So-So Corral / Drakkar / Longhouse POD 复用合同，4 tests。
- 删除旧文件：`src/games/smashup/__tests__/bases/samurai-bases.test.ts`。
- 中途红灯：机械拆分时 `Shogun's` 标题单引号未转义、`pod-base-reuse` 多带一个旧 describe 闭合括号；修正后通过。
- 验证：
  - `npx eslint` 针对 3 个新 Samurai/POD 文件 -> 0 errors。
  - `npm test --` 3 个新文件 -> 3 files / 13 tests passed。
  - `npm test -- src/games/smashup/__tests__/bases` -> 17 files / 101 tests passed。
  - `npm run test:structure` -> OK。
  - `rg` 扫描 `newOngoingAbilities|newBaseAbilities|base-ability-contracts|samurai-bases|sys.interaction.current|getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|interaction.data|.data.options|skip`（排除 helper 层）-> 0 命中。
  - bases 目录全文件 `npx eslint` -> 0 errors。
  - `git diff --check` 针对本轮测试/计划/进度文件 -> 0 errors，仅文档 LF/CRLF 工作区提示。
- 文件规模复核：当前 `bases` 最大测试文件为 `base-core-effects.test.ts` 556 行，其次 `first-minion-bases.test.ts` 446 行；`samurai-bases.test.ts` 已退出。

## 2026-05-16 15:42 +08 继续拆 `first-minion-bases.test.ts`

- 完成度审计发现：`first-minion-bases.test.ts` 虽然比旧集合文件小很多，但仍混合 `base_laboratorium` 与 `base_moot_site` 两个具体基地；这属于“相似机制集合”，不是最终的业务对象边界。
- 拆分结果：
  - `laboratorium-base.test.ts`：实验工坊首随从、旧持久化队列恢复、与大法师触发链相关回归，6 tests。
  - `moot-site-base.test.ts`：集会场首随从 +2 临时力量及同回合不重复触发合同，3 tests。
  - 删除旧 `first-minion-bases.test.ts` 文件入口。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/laboratorium-base.test.ts src/games/smashup/__tests__/bases/moot-site-base.test.ts` -> 2 files / 9 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/games/smashup/__tests__/bases/laboratorium-base.test.ts src/games/smashup/__tests__/bases/moot-site-base.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases` -> 22 files / 101 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - `rg` 扫描 `newOngoingAbilities|newBaseAbilities|base-ability-contracts|samurai-bases|base-core-effects|first-minion-bases|sys.interaction.current|getInteractionsFromMS|prompt.data.options|SYS_INTERACTION_RESPOND|SYS_INTERACTION_CANCEL|interaction.data|.data.options|skip`（排除 `helpers.ts` / `helpers/**`）-> 0 命中。
- 文件规模复核：当前 `bases` 最大测试文件为 `interaction-base-abilities.test.ts` 362 行，其次 `base-scoring-effects.test.ts` 359 行、`laboratorium-base.test.ts` 353 行；没有剩余 `new*` / 大集合 / 相似机制集合入口。

## 2026-05-16 15:47 +08 继续拆 `base-scoring-effects.test.ts`

- 完成度审计发现：`base-scoring-effects.test.ts` 混合 4 个互不相同的 afterScoring 基地：`base_haunted_house`、`base_temple_of_goju`、`base_great_library`、`base_ritual_site`。这不是一个自然业务对象边界。
- 拆分结果：
  - `haunted-house-scoring-base.test.ts`：冠军弃手牌并抽 5 张，3 tests。
  - `temple-of-goju-base.test.ts`：每位玩家最高力量随从放牌库底，2 tests。
  - `great-library-base.test.ts`：有随从的玩家抽牌，3 tests。
  - `ritual-site-base.test.ts`：随从洗回牌库，2 tests。
  - 删除旧 `base-scoring-effects.test.ts` 文件入口。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test --` 4 个拆分文件 -> 4 files / 10 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint` 4 个拆分文件 -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases` -> 25 files / 101 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 目标 seam / 旧集合入口扫描 -> 0 命中。

## 2026-05-16 15:52 +08 删除 `interaction-base-abilities.test.ts` 集合入口

- 完成度审计发现：`interaction-base-abilities.test.ts` 混合 6 个基地；其中 `base_haunted_house_al9000` 已有自己的文件，继续留在集合里会形成重复入口。
- 拆分/合并结果：
  - `haunted-house-al9000-base.test.ts`：合并鬼屋 AL9000 多手牌 prompt、单手牌自动弃、响应弃指定手牌、空手牌不触发；同时把旧 `getInteractionsFromResult` 枚举改为 `getSimpleChoicePrompt` / `getPromptOption` / `respondCommand`。
  - `rlyeh-base.test.ts`：拉莱耶 onTurnStart 消灭/跳过交互，4 tests。
  - `mountains-of-madness-base.test.ts`：疯狂之山抽疯狂卡，2 tests。
  - `homeworld-base.test.ts`：母星额外随从次数，1 test。
  - `mothership-base.test.ts`：母舰 afterScoring 回手交互，2 tests。
  - `ninja-dojo-base.test.ts`：忍者道场 afterScoring 消灭/跳过交互，2 tests。
  - 删除旧 `interaction-base-abilities.test.ts` 文件入口。
- 中途红灯：第一次拆分后，`rlyeh-base.test.ts` / `ninja-dojo-base.test.ts` 响应交互用例缺最小玩家状态，事件后处理访问 `vp` / `discard` 失败。修复方式不是改断言，而是补真实玩家夹具，让测试仍走完整响应链。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test --` 鬼屋 AL9000 + 5 个拆分文件 -> 6 files / 15 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint` 同 6 文件 -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases` -> 29 files / 100 tests passed。测试数从 101 变为 100，是因为鬼屋 AL9000 的“多张手牌产生 prompt”重复覆盖被合并为一条，其他单手牌、响应、空手牌分支保留。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 目标 seam / 旧集合入口扫描 -> 0 命中。
- 文件规模复核：当前 `bases` 最大测试文件为 `laboratorium-base.test.ts` 353 行、`samurai-sakura-garden-bases.test.ts` 342 行、`field-of-honor-base.test.ts` 282 行。`laboratorium` 与 `field-of-honor` 是单一业务对象；`samurai-sakura` 是 Sakura Garden / POD / Samurai 触发顺序链，暂不为压行数硬拆。

## 2026-05-16 15:58 +08 拆 `samurai-sakura-garden-bases.test.ts`

- 完成度审计复核后修正判断：`samurai-sakura-garden-bases.test.ts` 虽然整体都围绕 Sakura Garden 触发链，但普通 `base_sakura_garden` 与 POD 版 `base_sakura_garden_pod` 属于不同卡池/复用口径，后续改任一边不应扫另一边。
- 拆分结果：
  - `sakura-garden-base.test.ts`：普通 `base_sakura_garden` 首次己方随从被消灭抽牌、与 `samurai_honor_the_fallen` 顺序、同回合不重复触发，3 tests。
  - `sakura-garden-pod-base.test.ts`：`base_sakura_garden_pod` 与 `samurai_samurai_chan_pod` 顺序/双触发、POD 版首次弃置抽牌复用合同，3 tests。
  - 删除旧 `samurai-sakura-garden-bases.test.ts` 文件入口。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/sakura-garden-base.test.ts src/games/smashup/__tests__/bases/sakura-garden-pod-base.test.ts` -> 2 files / 6 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/games/smashup/__tests__/bases/sakura-garden-base.test.ts src/games/smashup/__tests__/bases/sakura-garden-pod-base.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases` -> 30 files / 100 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 目标 seam / 旧集合入口扫描（含 `samurai-sakura-garden-bases`）-> 0 命中。
- 文件规模复核：当前 `bases` 最大测试文件为 `laboratorium-base.test.ts` 353 行，其次 `field-of-honor-base.test.ts` 282 行、`ancient-egyptian-bases.test.ts` 243 行。后续不能只按行数拆；应先确认是否混有独立业务对象。

## 2026-05-16 16:03 +08 拆 `laboratorium-base.test.ts`

- 完成度审计发现：`laboratorium-base.test.ts` 混合两个自然行为簇：
  - 基础 `base_laboratorium` 首随从 +1 指示物合同。
  - 线上反馈 69ff7291 的大法师自动结算、旧持久化 triggerQueue 恢复与误加力量回归。
- 拆分结果：
  - `laboratorium-base.test.ts`：保留基础首随从合同，3 tests。
  - `laboratorium-archmage-queue.test.ts`：大法师链路与旧队列恢复，3 tests。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/laboratorium-base.test.ts src/games/smashup/__tests__/bases/laboratorium-archmage-queue.test.ts` -> 2 files / 6 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/games/smashup/__tests__/bases/laboratorium-base.test.ts src/games/smashup/__tests__/bases/laboratorium-archmage-queue.test.ts` -> 0 errors。
  - 直接跑 `npm test -- src/games/smashup/__tests__/bases` 两次均因 Vitest worker OOM 失败；这是 worker 资源问题，不是断言失败，不能当绿。
  - 改用分批精确文件验证：`node scripts/infra/vitest-cli-safe.mjs run --configLoader native` 按 6 个文件一批跑完 `src/games/smashup/__tests__/bases/*.ts` -> 26 files / 77 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 目标 seam / 旧集合入口扫描 -> 0 命中。
- 文件规模复核：当前 `bases` 最大测试文件为 `field-of-honor-base.test.ts` 282 行，其次 `laboratorium-archmage-queue.test.ts` 260 行、`ancient-egyptian-bases.test.ts` 243 行；已经没有 300 行以上的基地主题测试文件。

## 2026-05-16 16:12 +08 归并并拆除 POD 复用集合

- 完成度审计发现：`pod-base-reuse.test.ts` 仍是横向集合，混合 Cowboys POD (`base_saloon_pod` / `base_so_so_corral_pod`) 与 Vikings POD (`base_drakkar_pod` / `base_longhouse_pod`)。这会让 POD 复用合同继续脱离对应派系基地上下文。
- 处理结果：
  - Cowboys POD 两条回归并入 `cowboys-bases.test.ts`。
  - Vikings POD 两条先并入 Vikings 文件后，继续按具体基地拆分为 `drakkar-base.test.ts` 与 `longhouse-base.test.ts`，删除旧 `vikings-bases.test.ts` 入口。
  - 删除旧 `pod-base-reuse.test.ts` 入口。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/cowboys-bases.test.ts src/games/smashup/__tests__/bases/vikings-bases.test.ts` -> 2 files / 10 tests passed，eslint 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/drakkar-base.test.ts src/games/smashup/__tests__/bases/longhouse-base.test.ts` -> 2 files / 6 tests passed，eslint 0 errors。
  - 分批精确跑完 `src/games/smashup/__tests__/bases/*.ts` -> 25 files / 77 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 目标 seam / 旧集合入口扫描（含 `pod-base-reuse` / `vikings-bases`）-> 0 命中。
- 文件规模复核：当前 `bases` 最大测试文件为 `field-of-honor-base.test.ts` 282 行，其次 `laboratorium-archmage-queue.test.ts` 260 行、`ancient-egyptian-bases.test.ts` 243 行。

## 2026-05-16 16:25 +08 Field of Honor / Crypt 消灭管线 seam 收敛

- 回应“是不是只改表象”：继续审 `field-of-honor-base.test.ts`，确认它不是单纯行数问题，而是混合了基础基地合同、FAQ batch、真实命令链和管线兜底。
- 处理结果：
  - `field-of-honor-base.test.ts` 只保留 `base_the_field_of_honor` 自身 `onMinionDestroyed` 合同，4 tests。
  - 新增 `field-of-honor-destroy-processing.test.ts`，覆盖同一消灭能力只给 1VP、`robot_microbot_guard` 真实命令链、缺 `destroyerId` 时按当前操作者兜底，3 tests。
  - `base-contract-helpers.ts` 新增 `makeMinionDestroyedEvent` / `resolveDestroyedMinions`，业务测试不再直接调 `processDestroyTriggers`。
  - `crypt-base-effects.test.ts` 的 FAQ batch 用例同步改走 `resolveDestroyedMinions`，避免同类 reducer seam 继续散落。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm test -- src/games/smashup/__tests__/bases/crypt-base-effects.test.ts src/games/smashup/__tests__/bases/field-of-honor-base.test.ts src/games/smashup/__tests__/bases/field-of-honor-destroy-processing.test.ts` -> 3 files / 10 tests passed。
  - `npx eslint` 针对 `base-contract-helpers.ts`、`crypt-base-effects.test.ts`、两个 Field of Honor 文件 -> 0 errors。
  - `rg` 扫描 `bases` 业务测试（排除 `base-contract-helpers.ts`）的旧入口、裸 prompt seam、`processDestroyTriggers(`、skip -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> OK。
  - 分批低并发覆盖 `bases/*.ts`：27 个业务测试文件均已跑过，合计 77 tests passed。第 6 批出现一次 Vite/esbuild 服务退出，单独复跑 `sakura-garden-base.test.ts` / `sakura-garden-pod-base.test.ts` 后 6 tests passed；这是工具服务中断，不是业务断言失败。
- 文件规模复核：当前 `bases` 最大业务测试文件为 `laboratorium-archmage-queue.test.ts` 249 行，其次 `ancient-egyptian-bases.test.ts` 225 行、`cowboys-bases.test.ts` 204 行、`drakkar-base.test.ts` 206 行。

## 2026-05-16 16:40 +08 消灭后处理 reducer seam 全测试树收敛

- 处理结果：
  - `helpers.ts` 新增通用 `makeMinionDestroyedEvent` / `resolveDestroyedMinions`，把 `processDestroyTriggers` 的参数顺序、返回结构和 reducer import 收到共享测试 facade。
  - 目录外剩余裸调用已迁移：`onDestroyAbilities.test.ts` 和 `smashup.smoke.test.ts` 改为 `resolveDestroyedMinions(...)`，同时移除业务测试对 `processDestroyTriggers` 的 import。
  - 顺手清理 `onDestroyAbilities.test.ts` 中本轮 lint 暴露的未使用类型 import。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/onDestroyAbilities.test.ts` -> 1 file / 14 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/onDestroyAbilities.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `rg "processDestroyTriggers\\(" src/games/smashup/__tests__ -g "*.ts" -g "!helpers.ts" -g "!helpers/**"` -> 只剩 `bases/base-contract-helpers.ts` helper 层。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 88，OK。

## 2026-05-16 16:50 +08 move/affect/return 后处理业务 seam 收敛

- 处理结果：
  - `helpers.ts` 新增 `makeMinionMovedEvent` / `resolveMovedMinions` / `resolveAffectedMinions` / `resolveCardsReturnedToHand`。
  - `smashup.smoke.test.ts` 的硕大圆石移动触发、漫游山岭巨人控制变化后的 affect 触发、时间盒子弃牌回手触发，已从 `processMoveTriggers` / `processAffectTriggers` / `processReturnToHandTriggers` 改为语义 helper。
  - `reactionQueueOrdering.test.ts` 的 4 处低层后处理调用保留；这些用例直接断言 `sourceEventId` / `frameId` / `counterChangeKind`，属于后处理系统合同，不作为普通业务测试 seam 处理。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `rg "process(Move|Affect|ReturnToHand)Triggers\\(" src/games/smashup/__tests__ -g "*.ts" -g "!helpers.ts" -g "!helpers/**"` -> 只剩 `reactionQueueOrdering.test.ts` 4 处底层合同例外。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> 1 file / 26 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 88，OK。

## 2026-05-16 16:58 +08 `smashup.smoke` prompt seam 收敛

- 处理结果：
  - 六足死神 special 不再裸读 `stateWithCounters.sys.interaction.current.data.sourceId`，改用 `getSimpleChoicePrompt` + `getPromptSourceId`。
  - 硕大圆石 move / destroy 二段链不再拼 `current ?? queue[0]`，改用 sourceId prompt facade；handler data 改从 `getPromptHandlerData(prompt)` 取。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 89，OK。

## 2026-05-16 17:02 +08 `scoreBases-auto-continue` 局部 sourceId seam

- 处理结果：
  - Hoverbot stale top 用例从裸读 `played.finalState.sys.interaction.current.data.sourceId` 改为 `getSimpleChoicePrompt` / `getPromptSourceId`。
  - 曾尝试把一处 `current === undefined` 升级为 `expectNoPrompt`，但该断言语义更强，可能改变原用例合同；已退回原语义，后续需单独确认 queue 是否也应为空。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/scoreBases-auto-continue.test.ts -t "盘旋机器人揭示的牌已不再位于牌库顶时"` -> 1 passed / 35 skipped。
  - `npx eslint src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> 0 errors。
  - `rg "current\\?\\.data|data\\.sourceId|data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` -> 0 命中。

## 2026-05-16 17:05 +08 `afterscoring-response-window-execution` 交互存在断言

- 处理结果：
  - 两处“应该生成交互”的断言从裸查 `sys.interaction.current/queue` 改为 `getSimpleChoicePrompt(state)`。
- 验证：
  - 全文件直接跑出现 Node `memory allocation failed`，未作为业务结果。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts -t "我们乃最强"` -> 2 passed / 2 skipped。
  - `npx eslint src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 97，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:14 +08 `turnCycle` 无 prompt 断言收敛

- 处理结果：
  - `endTurn 无冲突 trigger 会自动收口` 用例从 `sys.interaction.current === undefined` 改为文件内既有 `expectNoPrompt(...)`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/turnCycle.test.ts -t "endTurn 无冲突 trigger 会自动收口"` -> 1 passed / 21 skipped。
  - `npx eslint src/games/smashup/__tests__/turnCycle.test.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/turnCycle.test.ts` -> 0 命中。

## 2026-05-16 17:18 +08 `baseAbilityIntegrationE2E` 无 prompt 断言收敛

- 处理结果：
  - `base_innsmouth_base` 用例保留 `maybeResolveReactionQueue` 可能无结果的原语义；若返回 state，则用 `expectNoPrompt`。
  - `base_laboratorium` 回归用例从裸查 `resultMs.sys.interaction.current` 改为 `expectNoPrompt(resultMs)`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts -t "base_innsmouth_base|实验工坊"` -> 3 passed / 20 skipped。
  - `npx eslint src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts` -> 0 命中。

## 2026-05-16 17:20 +08 `igor-two-igors-one-destroyed` prompt 数量断言

- 处理结果：
  - “只应该有一个交互”从 `result2.finalState.sys.interaction.queue.length === 0` 改为 `getPromptsBySourceId(result2.finalState, 'frankenstein_igor')` 长度为 1。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 1 test passed。
  - `npx eslint src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 0 命中。

## 2026-05-16 17:30 +08 prompt 内部 seam 阶段性清零

- 处理结果：
  - `multi-base-afterscoring-bug.test.ts` 两处计分链收口断言改为 `expectNoPrompt(finalState)`，保留阶段、VP、基地替换、大副移动等业务断言。
  - `helpers.ts` 新增 `withoutQueuedPrompts` / `withOnlyCurrentPrompt`，`afterscoring-window-skip-base-clear.test.ts` 改用这些 facade 构造“只有当前 prompt、无排队 prompt”的边界状态。
  - `scoreBases-auto-continue.test.ts` stale special 运行态构造改为 `withoutQueuedPrompts(withoutCurrentPrompt(state))`，结果断言改为 `expectNoPrompt(resolved.state)`。
  - `promptSystem.test.ts` / `promptResponseChain.test.ts` 删除 `expectNoPrompt` 后重复的 `sys.interaction.queue === []` 断言。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts` -> 1 file / 8 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts` -> 1 file / 15 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/scoreBases-auto-continue.test.ts -t "响应持久化后的失效 special 快照"` -> 1 passed / 35 skipped。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/promptSystem.test.ts src/games/smashup/__tests__/promptResponseChain.test.ts` -> 2 files / 22 tests passed。
  - `npx eslint` 针对本批 5 个测试文件与 `helpers.ts` -> 0 errors。
  - `rg "sys\\.interaction\\??\\.current|sys\\.interaction\\.queue|\\.data\\.options|asSimpleChoice\\(|process[A-Z][A-Za-z]+Triggers\\(" src/games/smashup/__tests__ -g "*.ts" -g "!helpers.ts" -g "!helpers/**"` -> 只剩 `bases/base-contract-helpers.ts` helper 层与 `reactionQueueOrdering.test.ts` 底层合同测试。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 102，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:35 +08 prompt options 外壳读取收敛

- 处理结果：
  - `afterScoring-rescoring.test.ts` 的本地 option 查找改用 `getPromptOptions(choice)`，不再直读 `choice.options`。
  - `specialInteractionChain.test.ts` 的通用 `findOption`、Laseratops POD 目标列表、Cthulhu Chosen 按钮列表改用 `getPromptOptions`。
  - `interactionChainE2E.test.ts` 两处直接枚举选项的断言改用 `getPromptOptions`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/afterScoring-rescoring.test.ts` -> 1 file / 8 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/specialInteractionChain.test.ts` -> 1 file / 24 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/interactionChainE2E.test.ts -t "受 action 保护|trickster_block_the_path_pod"` -> 2 passed / 53 skipped。
  - `npx eslint src/games/smashup/__tests__/afterScoring-rescoring.test.ts src/games/smashup/__tests__/specialInteractionChain.test.ts src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 0 errors。
  - `rg "choice\\.options|prompt\\.options|\\.data\\.options|asSimpleChoice\\(" src/games/smashup/__tests__ -g "*.ts" -g "!helpers.ts" -g "!helpers/**"` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 104，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:40 +08 `baseAbilitiesPrompt` handler 参数签名收拢

- 处理结果：
  - 新增本地 `resolvePromptAgainstCore(...)`，统一通过 prompt sourceId 找 handler，并统一传入 `getPromptHandlerData(prompt)`、随机数和时间戳。
  - `base_pirate_cove`、`base_tortuga`、`base_mushroom_kingdom`、`base_the_hill`、`base_the_mothership`、`base_ninja_dojo` 的 stale prompt 回归用例不再各自手写 handler 参数签名。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> 1 file / 33 tests passed。
  - `npx eslint src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> 0 errors。
  - `rg "getInteractionHandler\\(" src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts` -> 只剩本地 facade 一处。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 104，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:45 +08 注册 handler 响应 facade 上提到共享 helper

- 处理结果：
  - `helpers.ts` 新增 `resolvePromptViaRegisteredHandler(...)`。
  - `baseAbilitiesPrompt.test.ts` 删除本地 `resolvePromptAgainstCore`，改用共享 helper。
  - `reactionQueueDestroyerId.test.ts` 两处 `smashup_reaction_choose` handler 直调改用共享 helper。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 2 files / 35 tests passed。
  - `npx eslint src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 0 errors。
  - `rg "resolvePromptViaRegisteredHandler|getInteractionHandler\\(" src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` -> 注册表访问只剩共享 helper 一处，两个测试文件均使用 `resolvePromptViaRegisteredHandler`。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 104，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:50 +08 reaction queue prompt handler 响应收敛

- 处理结果：
  - `reactionQueueBaseAbilities.test.ts` 中排序 prompt 响应改用 `resolvePromptViaRegisteredHandler`。
  - `reactionQueueBaseOptionalClockwise.test.ts` 中玩家 pass 与玩家 2 响应改用 `resolvePromptViaRegisteredHandler`。
  - `reactionQueueOrdering.test.ts` 中 mandatory trigger 排序选择改用 `resolvePromptViaRegisteredHandler`，保留后处理 frame/source 合同测试。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/vitest-cli-safe.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> 3 files / 34 tests passed。
  - `npx eslint src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> 0 errors。
  - `rg "resolvePromptViaRegisteredHandler|getInteractionHandler\\(|getPromptHandlerData\\(" src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts` -> 只剩 `resolvePromptViaRegisteredHandler` 调用。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 107，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 17:55 +08 Cthulhu / Elder Thing prompt handler 响应收敛

- 处理结果：
  - `abilities/cthulhu.test.ts` 的 `special_madness` draw/return prompt 响应改为 `resolvePromptViaRegisteredHandler`。
  - `elderThingAbilities.test.ts` 的 `elder_thing_mi_go` draw_madness/decline prompt 响应改为 `resolvePromptViaRegisteredHandler`。
- 验证：
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 2 files / 45 tests passed。
  - `rg "getInteractionHandler\\(|getPromptHandlerData\\(" src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts` -> `getInteractionHandler(` 0 命中；`getPromptHandlerData(` 仅剩 `cthulhu.test.ts` 的 displayCard 合同断言。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 109，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。
  - 备注：首次 `vitest-cli-safe` 因 Node 子进程 spawn 检测失败退出，未作为业务失败；随后直接 Vitest CLI 入口完成验证。

## 2026-05-16 18:00 +08 选择审计旧泛名文件迁出并收敛 prompt handler

- 处理结果：
  - `choice-audit-fixes.test.ts` 迁为 `elder-thing-choice-goju-tiebreak.test.ts`。
  - Elder Thing choice / destroy-first / destroy-second prompt 响应改为 `resolvePromptViaRegisteredHandler`。
  - `base_temple_of_goju_tiebreak` 无 prompt 对象，保留 handler-level 合同测试。
- 验证：
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 1 file / 10 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 111，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。
  - `rg "getInteractionHandler\\(|getPromptHandlerData\\(|resolvePromptViaRegisteredHandler" src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 只剩 Goju tiebreak 的 handler-level 合同和 continuationContext 合同断言，Elder Thing 链已使用共享 helper。

## 2026-05-16 18:08 +08 交互响应从 handler 直调升级到命令链 facade

- 处理结果：
  - `helpers.ts` 新增 `respondToPromptOption(...)`，封装“找到业务选项 -> 发送 `SYS_INTERACTION_RESPOND` -> 跑完整 pipeline”的常用业务测试路径。
  - `shoggoth-destroy-choice.test.ts` 清掉所有 handler 直调、手动 `withoutCurrentPrompt` 和 `getPromptHandlerData` 参数传递；测试仍验证拒绝抽疯狂卡、指定消灭、多对手链式询问等行为。
  - `turnCycle.test.ts` 的 Mushroom Kingdom / Invisible Ninja 用例改为真实命令响应；响应第一个 prompt 后，直接观察真实管线自动续出的 Invisible Ninja prompt。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` -> 1 file / 6 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/turnCycle.test.ts` -> 1 file / 22 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts src/games/smashup/__tests__/turnCycle.test.ts` -> 0 errors。
  - `rg "getInteractionHandler\\(|getPromptHandlerData\\(|withoutCurrentPrompt\\(|advanceSmashUpReactionSession|resolveInteraction\\(" src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts src/games/smashup/__tests__/turnCycle.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 113，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 18:14 +08 runtime prompt 响应继续命令链化

- 处理结果：
  - `test-alien-scout-afterscore.test.ts` 的 Alien Scout 回手响应改为 `respondToPromptOption(...)`，断言使用命令管线产出的 `finalState.core`。
  - `alien-scout-pod-afterscore.test.ts` 的 stale 离场响应改为 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` + `respondToPromptOption(...)`，保留“旧 prompt 指向已离场侦察兵时不重复回手”的边界语义。
  - `robotAbilities.test.ts` 的 Microbot Reclaimer 空多选/选择 `mb1` 两条响应改为 `respondToPromptOptions(...)`，不再直接拿 runtime handler。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 2 files / 6 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/robotAbilities.test.ts` -> 1 file / 11 tests passed。
  - 首次低内存 eslint 对 `robotAbilities.test.ts` 触发 Zone Allocation OOM；随后 `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/robotAbilities.test.ts src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 0 errors。
  - `rg "getAbilityRuntimePromptHandler\\(|getPromptHandlerData\\(|getInteractionHandler\\(" src/games/smashup/__tests__/test-alien-scout-afterscore.test.ts src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts src/games/smashup/__tests__/robotAbilities.test.ts` -> 只剩 `robotAbilities.test.ts` 的 optionsGenerator 刷新合同读取 `getPromptHandlerData(prompt)`。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> checked files: 115，OK；仅既有 `e2e/dicethrone/legacy-root/dicethrone.e2e.ts` 警告。

## 2026-05-16 18:18 +08 Pirates prompt 响应分层试点

- 处理结果：
  - `abilities/pirates-ongoing.test.ts` 的 `pirate_full_sail_choose_minion` 完成响应改为先触发 `pirate_full_sail` special，再通过 `respondToPromptOption(...)` 选择 done。
  - 尝试把 First Mate afterScoring 手工 reaction session 改成命令链时，测试红灯显示当前没有 prompt 可响应；该用例属于 session/handler 低层合同，已恢复 direct handler 路径并保留为有意例外。
  - `pirate_buccaneer_move` 的 `getInteractionHandler` 仍保留，因为测试目标是注册表是否注册该 handler。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 1 file / 19 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> 0 errors。
  - `rg "getInteractionHandler\\(|getPromptHandlerData\\(|respondToPromptOption\\(" src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` -> direct handler 剩余 3 处，均为 session/registry 合同；`respondToPromptOption` 1 处为 Full Sail 普通 prompt 响应。
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run test:structure` -> exit 1 且无门禁错误输出；随后 `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 115，OK，仅既有 legacy-root 警告。

## 2026-05-16 18:22 +08 Zombie/Wizard runtime prompt 响应命令链化

- 处理结果：
  - `zombieWizardAbilities.test.ts` 的 `zombie_outbreak_choose_base` 响应改为 `respondToPromptOption(...)`，断言仍覆盖 `LIMIT_MODIFIED` 和 `restrictToBase`。
  - `zombie_mall_crawl` 响应改为 `respondToPromptOption(...)`，最终状态使用命令管线的 `finalState.core`，删除该用例里的 direct runtime handler 和手动 `applyEvents`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 1 file / 23 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 0 errors。
  - `rg "getAbilityRuntimePromptHandler\\(|getInteractionHandler\\(|handler!\\(|getPromptHandlerData\\(" src/games/smashup/__tests__/zombieWizardAbilities.test.ts` -> 只剩 `displayCard` prompt 合同断言一处 `getPromptHandlerData(current)`。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 115，OK，仅既有 legacy-root 警告。

## 2026-05-16 18:25 +08 Frankenstein stale prompt 回归命令链化

- 处理结果：
  - `abilities/frankenstein.test.ts` 的 `frankenstein_angry_mob` stale 回归改为 `respondToPromptOption(...)` 连续响应选随从、选手牌。
  - stale 分支复用旧二段 `chooseCardPrompt`，通过 `withOnlyCurrentPrompt(makeMatchState(staleStateCore), chooseCardPrompt)` 挂到已变化 core 上，再真实响应 h1 选项。
  - 删除该用例对 `getAbilityRuntimePromptHandler`、`resolveCurrentPromptHandlerWithCore`、手动 `resolveInteraction` 的依赖。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> 1 file / 11 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> 0 errors。
  - `rg "getAbilityRuntimePromptHandler\\(|resolveCurrentPromptHandlerWithCore|resolveInteraction\\(|getInteractionHandler\\(|handler!\\(" src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 115，OK，仅既有 legacy-root 警告。

## 2026-05-16 18:28 +08 Big Gulp / Igor bug 复现命令链化

- 处理结果：
  - `igor-big-gulp-double-trigger.test.ts` 改为 `runCommand(PLAY_ACTION)` 进入 `vampire_big_gulp` prompt，再用 `respondToPromptOption(...)` 选择 Igor。
  - 删除该文件里的 `getAbilityRuntimePromptHandler`、`getPromptHandlerData`、手动 `processDestroyMoveCycle`、`execute` 和调试 `console.log`。
  - 测试名从强调 `processDestroyMoveCycle` 内部步骤改为验证 Big Gulp 消灭 Igor 后 Igor onDestroy 只触发一次。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts` -> 1 file / 1 test passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts` -> 0 errors。
  - `rg "getAbilityRuntimePromptHandler\\(|getPromptHandlerData\\(|processDestroyMoveCycle|execute\\(|console\\.log|handler!\\(" src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 116，OK，仅既有 legacy-root 警告。

## 2026-05-16 18:33 +08 Zeppelin runtime prompt 分步响应命令链化

- 处理结果：
  - `ongoingTalent.test.ts` 的 Zeppelin 选择随从步骤改为 `respondToPromptOption(...)`，覆盖 stale、从外部基地移动、从齐柏林所在基地移动三条用例。
  - stale 第二步复用旧 `steampunk_zeppelin_choose_base` prompt，通过 `withOnlyCurrentPrompt(makeMatchState(staleCore), chooseBaseInteraction)` 挂到目标已离场的 core 上响应。
  - `ongoingTalent.test.ts` 不再导入 `getAbilityRuntimePromptHandler`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ongoingTalent.test.ts` -> Vitest worker OOM，未执行测试。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ongoingTalent.test.ts` -> 1 file / 27 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/ongoingTalent.test.ts` -> 0 errors。
  - `rg "getAbilityRuntimePromptHandler\\(|getPromptHandlerData\\(|respondToPromptOption\\(" src/games/smashup/__tests__/ongoingTalent.test.ts` -> runtime handler 0 命中；`respondToPromptOption` 4 处；剩余 `getPromptHandlerData` 属于其它 prompt/handler 合同点。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 116，OK，仅既有 legacy-root 警告。

## 2026-05-16 18:47 +08 Expansion ongoing stale/live 断言对齐

- 处理结果：
  - `expansionOngoing.test.ts` 中已开始但未验证的 `steampunk_mechanic` / `steampunk_change_of_venue` 命令链改造完成收口。
  - `ornate_dome` 封锁场景不再断言 handler 风格的“响应成功但无事件”，而是改成先验证 live `optionsGenerator` 已移除 `base-0`，再断言真实 `respondToPromptOption(...)` 返回 `无效的选择`。
  - “待附着的 ongoing 已不在手牌”两条 stale 二段响应改为断言不产生 `ACTION_PLAYED` / `ONGOING_ATTACHED` / `LIMIT_MODIFIED` 业务事件，并校验最终状态未附着、手牌仍为空；避免把 `SYS_INTERACTION_RESOLVED` 当成失败噪音。
  - `killer_plant_venus_man_trap_search` 的成功路径也改为 `respondToPromptOption(...)`，业务断言仍聚焦 `MINION_PLAYED` 携带的 `baseIndex/baseDefId`。
- 追加收口：
  - `innsmouth_return_to_the_sea` 多选回手、`miskatonic_researcher_pod` 二段选择、`miskatonic_field_trip_pod` 空选择、`miskatonic_things_best_not_known_pod_draw` button 响应、`miskatonic_librarian_pod` 二段 extra 模式，全部改为 `respondToPromptOption(s)`。
  - `killer_plant_sprout_search` / `killer_plant_venus_man_trap_search` stale deck-search 不再直调 runtime handler；现在断言真实命令链下不会重复打出、deck 保持 live 状态不变，而且旧 prompt 仍停留在当前交互。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts` -> 1 file / 67 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 1，OK。

## 2026-05-16 19:02 +08 Madness prompt 业务响应命令链化

- 处理结果：
  - `madnessAbilities.test.ts` 中 `innsmouth_recruitment` 的 off-phase immediate、抽 3 张、牌库不足 3 张、reduce 验证等用例从 direct handler 改为 `respondToPromptOption(...)`。
  - `miskatonic_librarian_pod` 的 extra 模式及二段 `play_madness` 也改走真实 prompt 响应，并继续验证 `special_madness` follow-up prompt。
  - “疯狂牌库不足 3 张” 不再伪造用户选不到的 `count=3` value；现在显式断言 prompt 不暴露该选项，选 `count=2` 后按 2 张结算。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts` -> 1 file / 32 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 2，OK。

## 2026-05-16 19:06 +08 Mandatory Reading draw 命令链补收口

- 处理结果：
  - `madnessAbilities.test.ts` 中 `miskatonic_mandatory_reading_draw` 的 4 条普通按钮响应，已从 direct handler 改为 `respondToPromptOption(...)`。
  - “抽 2 张疯狂卡后产生抽牌与力量加成事件” 继续断言 `MADNESS_DRAWN(count=2)` 与 `PERMANENT_POWER_ADDED(amount=4)`，但不再直接调用 handler。
  - “选择跳过时不产生业务事件” 现在明确断言没有 `MADNESS_DRAWN` / `PERMANENT_POWER_ADDED`，避免把命令链系统事件误判成业务副作用。
  - “抽 3 张后最终状态”和“UID 唯一” 改为直接看 `finalState.core`，不再手动 `applyEvents` 模拟调用方。
  - 当前文件剩余 `getInteractionHandler(...)` 只剩 `miskatonic_those_meddling_kids_pod_mode` 的 off-phase immediate 合同；`getPromptHandlerData(...)` 只剩 live `responseValidationMode` 合同。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts` -> 1 file / 32 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 2，OK。

## 2026-05-16 19:16 +08 Cthulhu expansion 多步交互链收口

- 处理结果：
  - `cthulhuExpansionAbilities.test.ts` 中 `miskatonic_those_meddling_kids` 的“选基地 -> 连续点行动卡”三条用例，已从 direct handler 改为 `respondToPromptOption(...)`。
  - `cthulhu_recruit_by_force` 与 `cthulhu_it_begins_again` 的多选、跳过、最终状态用例，已改走 `respondToPromptOptions(...)`；不再手动 `applyEvents`，直接看 `finalState.core`。
  - 当前文件内 `getInteractionHandler(...)` / `getPromptHandlerData(...)` 已清零，业务测试只表达 prompt 选择、多选约束、业务事件与最终状态。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` -> 1 file / 32 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 3，OK。

## 2026-05-16 19:17 +08 Mushroom Kingdom POD 链收口

- 处理结果：
  - `baseAbilityIntegration.test.ts` 中 `base_mushroom_kingdom_pod` 的二段 prompt 链，已从 direct handler 改为两次 `respondToPromptOption(...)`。
  - 同文件顺手清掉了只为这条旧写法残留的未使用 import / helper / 草稿常量，恢复 eslint 干净状态。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseAbilityIntegration.test.ts` -> 1 file / 25 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseAbilityIntegration.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 4，OK。

## 2026-05-16 19:21 +08 Ongoing talent 业务链收口

- 处理结果：
  - `ongoingTalent.test.ts` 中 `trickster_hideout_pod_swap` 的 hand / deck 交换链，已从 direct handler 改为 `respondToPromptOption(...)`。
  - `trickster_pixie_pod` 的 minion 选择、战术 destroy、后续 counters 三段链，已改成 `respondToPromptOptions(...)` / `respondToPromptOption(...)`；命令链额外产出的 `SYS_INTERACTION_RESOLVED` 不再被误判为失败。
  - 当前文件里 `getInteractionHandler(...)` 已清零；`getPromptHandlerData(...)` 只剩 `autoResolveIfSingle` 的 prompt contract 断言。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ongoingTalent.test.ts` -> 1 file / 27 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/ongoingTalent.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 5，OK。

## 2026-05-16 19:29 +08 Madness prompt 三段业务链收口

- 处理结果：
  - `madnessPromptAbilities.test.ts` 中 `cthulhu_madness_unleashed` 的“跳过 / 选 2 张 / POD 版”已改走 `respondToPromptOption(s)`；删除 direct handler、手动 `applyEvents` 和 `events.length === 0` 口径。
  - `miskatonic_book_of_iter_the_unseen` 的“手牌返回 1 张 / 跳过”已改成真实 prompt 响应；本地 `resolveInteraction(...)` 完全删除。
  - `miskatonic_thing_on_the_doorstep` 的并列最高力量场景已改用 `getFirstPrompt` / `getPromptOptions` / `respondToPromptOption(...)`，不再裸读 `sys.interaction`。
  - 中途有 1 次红灯：`cthulhu_madness_unleashed` 的“跳过”仍沿用了 `execPlayAction`，导致后续 `finalState` 断言取到的不是权威 matchState。改成 `execPlayActionWithMatch` 后通过，说明“要看响应后的最终状态”时，入口也必须是完整 matchState。
- 验证：
  - `rg -n "getInteractionHandler|getPromptHandlerData|resolveInteraction|sys\\.interaction|\\.data\\.options|INTERACTION_COMMANDS|asSimpleChoice" src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 0 命中。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 1 file / 26 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 6，OK。

## 2026-05-16 19:36 +08 Expansion base abilities 业务 prompt 批量收口

- 处理结果：
  - `expansionBaseAbilities.test.ts` 中 `base_mermaid_pool`、`base_ossuary`、`base_arena`、`base_miskatonic_university_base` 的业务响应，已从 direct handler 改为 `respondToPromptOption(...)`。
  - 同文件 `base_the_asylum` 的“两段手牌 -> 随从”链，已改成两次真实 prompt 响应；不再直调 `base_the_asylum` / `base_the_asylum_choose_minion` handler。
  - 中途有 1 次红灯：`base_arena` 与 `base_miskatonic_university_base` 仍沿用 direct handler 时代的 `events.length` / 固定下标断言。改成按 `CARDS_DRAWN` / `MADNESS_DRAWN` / `CARDS_DISCARDED` / `LIMIT_MODIFIED` 业务事件 `find` 后通过，说明命令链响应的正确口径应是“包含目标业务事件”，不是“总事件数组长度”。
  - 本轮刻意没有动 `base_land_of_balance` / `base_sheep_shrine` / `base_the_pasture` / `base_greenhouse` / `base_inventors_salon` / `smashup_reaction_choose` 这些 stale / reaction / queued 合同点，避免把低层例外和普通业务链混在一起。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 1 file / 50 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 7，OK。
  - `rg -n "base_mermaid_pool|base_ossuary|base_arena|base_the_asylum|base_miskatonic_university_base|getInteractionHandler\\(|respondToPromptOption\\(" src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 上述业务链已改走 `respondToPromptOption(...)`；剩余 direct handler 命中集中在 stale / reaction / queued follow-up 例外。

## 2026-05-16 19:44 +08 Interaction chain E2E 熊骑兵 stale 收口补记

- 处理结果：
  - `interactionChainE2E.test.ts` 中 4 条熊骑兵 stale 回归，已从 direct handler 改为 `withOnlyCurrentPrompt(makeFullMatchState(staleCore), oldPrompt)` + 本地 `respond(...)`。
  - 覆盖 `bear_cavalry_commission_move_dest`、`bear_cavalry_bear_cavalry_choose_base`、`bear_cavalry_youre_screwed_choose_dest`、`bear_cavalry_bear_rides_you_choose_base`。
  - 本地 `respond(...)` 返回 `GameTestRunner` 结果，不是 `success/events` 直返；因此断言统一改看 `steps[0]?.success` 与 `finalState`。
  - 顺手恢复 `getPromptHandlerData` import，删除未使用的 `handlerRandom` 与 `RandomFn`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 1 file / 55 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/interactionChainE2E.test.ts` -> 0 errors。
  - `rg -n "getInteractionHandler\\(|withOnlyCurrentPrompt\\(|getPromptHandlerData\\(" src/games/smashup/__tests__/interactionChainE2E.test.ts` -> `getInteractionHandler(...)` 0 命中；仅剩 4 处 `withOnlyCurrentPrompt(...)` 与 prompt contract 读取。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> OK。

## 2026-05-16 19:49 +08 Expansion base stale 回归继续命令链化

- 处理结果：
  - `expansionBaseAbilities.test.ts` 中 `base_land_of_balance`、`base_sheep_shrine`、`base_the_pasture`、`base_innsmouth_base_choose_card`、`base_cat_fanciers_alley`、`base_inventors_salon` 的 stale 回归，已从 direct handler 改为 `withOnlyCurrentPrompt(makeMatchState(staleCore), oldPrompt)` + `respondToPromptOption(...)`。
  - 每条都不再写 `events.length === 0`，而是改断言“命令链响应成功，但没有目标业务事件”：`MINION_MOVED` / `CARD_TO_DECK_BOTTOM` / `MINION_DESTROYED` / `CARDS_DRAWN` / `CARD_RECOVERED_FROM_DISCARD` 不出现。
  - `base_greenhouse` 仍保留 2 处 `getInteractionHandler(...)`，因为它们在锁 scoring-session / replacement follow-up 合同，不是普通业务 prompt。
- 验证：
  - `rg -n "getInteractionHandler\\(|withOnlyCurrentPrompt\\(|respondToPromptOption\\(" src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 当前只剩 `base_greenhouse` 两处 direct handler，新增 6 处 `withOnlyCurrentPrompt(...)` stale 命令链。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 1 file / 50 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 8，OK。

## 2026-05-16 19:52 +08 Smoke 中 Sphinx 业务 prompt 收口

- 处理结果：
  - `smashup.smoke.test.ts` 中 `titan_sphinx_start_turn`、`titan_sphinx_after_scoring`、`titan_sphinx_talent` 三条，从 `getInteractionHandler(...)` + `getPromptHandlerData(...)` + 手动 `reduce(events)` 改为 `respondToPromptOption(...)`。
  - 断言口径改为直接看 `resolved.finalState.core`，不再把“handler 只吐事件、测试再手动 reduce”写进合同。
  - 顺手清掉了 `titan_sphinx_talent` 中 direct handler 删除后留下的未使用局部变量，恢复 eslint 干净。
- 验证：
  - `rg -n "titan_sphinx_start_turn|titan_sphinx_after_scoring|titan_sphinx_talent|respondToPromptOption\\(" src/games/smashup/__tests__/smashup.smoke.test.ts` -> Sphinx 三条已改走 `respondToPromptOption(...)`。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 当前剩余 76 条命中。

## 2026-05-16 20:06 +08 Smoke 中 Kraken 红灯修复，并继续收 Mergacon / Gorgodzolla

- 处理结果：
  - `smashup.smoke.test.ts` 的 `titan_pirates_the_kraken_talent` 首次迁到 `respondToPromptOption(...)` 后出现红灯：`TURN_STARTED` 后 debuff 不恢复。
  - 根因确认不是实现坏了，而是测试仍沿用 `afterCommand + response.events.reduce(...)` 手搓后态，导致 prompt handler 写进 `finalState.core.timedPowerModifiers` 的回退元状态被丢掉。
  - 修复方式：`Kraken talent` 改为直接以 `resolved.finalState.core` 作为权威后态，再在这个状态上 reduce `TURN_STARTED`，恢复断言通过。
  - 顺手继续把 `titan_changerbots_mergacon_play`、`titan_changerbots_mergacon_talent`、`titan_kaiju_gorgodzolla_draw` 3 条普通 titan prompt 从 direct handler 改成真实 `respondToPromptOption(...)`。
  - `Mergacon play` 不再手动伪造 continuationContext，而是先走真实 `onTurnStart` trigger 创建 prompt，再从 prompt 里选基地。
  - `Gorgodzolla draw` 首次迁移后有 1 次假红：真实 respond 会额外产出 `SYS_INTERACTION_RESOLVED`，旧断言 `toEqual([CARDS_DRAWN])` 失败。已改成“包含 `CARDS_DRAWN` + 最终手牌包含抽到的牌”。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "海怪克拉肯天赋会移动泰坦，并让目标基地敌方随从直到你下回合开始时 -1 战力"` -> 1 passed / 132 skipped。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "合体机器人的进场交互解决后会把泰坦打到所选基地|合体机器人天赋会移动泰坦并写入本回合 ongoing 压制标记"` -> 2 passed / 131 skipped。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "哥佐拉在你于本基地打出战术后会获得指示物，并可通过交互抽 1 张牌"` -> 首次失败，定位为 `SYS_INTERACTION_RESOLVED` 噪音后修正断言；复跑通过。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 9，OK。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 当前剩余 66 条命中。

## 2026-05-16 20:13 +08 Smoke 中 Walking Castle / Time Box / Moon Zero Three / Megabot 收口

- 处理结果：
  - `titan_magical_girls_walking_castle_choose_base` + `choose_minions` 的二段 prompt 链，已从 direct handler 改为 `respondToPromptOption(...)` + `respondToPromptOptions(...)`；最终直接看 `finalState.core` 中泰坦与被选中的两个随从都移动到目标基地。
  - `titan_time_travelers_time_box_play` 已改走真实 `respondToPromptOption(...)`。首次迁移时沿用旧断言 `enteredAt: 113` 假红，确认这是旧 handler 时代手传 timestamp 的细节，不属于业务合同；现已降为断言“进到目标基地 + `timeBoxCounters` 清零”。
  - `titan_super_spies_moon_zero_three_choose_player` + `resolve` 两段链，已改走真实 `respondToPromptOption(...)`，并删除测试里手动 `postProcessSystemEvents(...)` 拼接中间状态的旧写法。
  - `titan_mega_troopers_megabot_move` 已从 direct handler 改为真实 `respondToPromptOption(...)`，断言收口为“包含 `TITAN_MOVED` + 最终位置正确”。
  - 中途有 1 次辅助性失败：`walking_castle` 首次改完时漏加 `respondToPromptOptions` import；补齐后通过。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "移动城堡天赋会先选择目标基地，再选择至多 3 个己方随从一起移动过去|时间盒子在回合开始得到第 5 枚计数后会创建进场交互，并在选择基地后清零计数并进场|三号空间站天赋会查看任一牌库顶并可将其放到牌库底"` -> 首次 2 failed / 1 passed；修正 `respondToPromptOptions` import 与 `enteredAt` 断言后复跑 3 passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "超级佐德会在另一基地计分前创建移动交互，并在选择后移动到计分基地"` -> 1 passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 9，OK。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 当前剩余 60 条命中。

## 2026-05-16 20:18 +08 Smoke 中 Creampuff / Rainboroc 二段链收口

- 处理结果：
  - `titan_ghosts_creampuff_man_discard` + `play` 已从 direct handler 改为两次真实 `respondToPromptOption(...)`。
  - `creampuff_man` 现在直接从第一次响应的 `finalState` 读取第二段 `titan_ghosts_creampuff_man_play` prompt，不再用 `withCurrentPrompt(...)` 手工保活当前 prompt。
  - `titan_itty_critters_rainboroc_choose_discard` + `choose_base` 已从 direct handler 改为两次真实 `respondToPromptOption(...)`；洗回牌库与后续移动均直接看 `finalState.core`。
  - 中途有 1 次小噪音：`creampuff_man` 首次迁移后留下未使用的 `coreAfterDiscard` 局部变量；删除后 eslint 恢复 0 warning / 0 error。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "奶油泡芙美人天赋会弃 1 张牌，额外打出弃牌堆标准战术，并改放牌库底"` -> 1 passed / 132 skipped。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "彩虹鸟天赋会把低战力随从从弃牌堆洗回牌库，并可继续移动到其他基地"` -> 1 passed / 132 skipped。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:structure` -> checked files: 9，OK。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 当前剩余 56 条命中。

## 2026-05-16 22:03 +08 Smoke 中 Emperor Penguin stale recheck 修复

- 处理结果：
  - `smashup.smoke.test.ts` 里“泰坦进场交互在 resolve 时会再次检查己方是否已有泰坦在场”一条，保留真实 `fireTriggers(...)` -> `getSimpleChoicePrompt(...)` -> `respondToPromptOption(...)` 链，没有回退成 direct handler。
  - 红灯根因确认：测试给的 `promptCore` 没有任何基地满足 Emperor Penguin 的真实 special 资格，所以 `fireTriggers(..., 'onTurnStart')` 根本不会产出 `titan_penguins_emperor_penguin_play` prompt。
  - 修复方式：为 `promptCore` 与 `staleCore` 都补上“基地 0 有 3 个己方随从”的真实前置；`staleCore` 额外放入一只己方 live titan，用来触发 resolve-time 的 `canControllerPlayTitan(...)` 二次拦截。
  - 结果恢复为：旧 prompt 可以真实创建，但在 stale core 上响应该 prompt 时不会产生 `TITAN_PLAYED`，且 `finalState.core === staleCore`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts -t "泰坦进场交互在 resolve 时会再次检查己方是否已有泰坦在场"` -> 1 passed / 132 skipped。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/smashup.smoke.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/smashup.smoke.test.ts` -> 1 file / 133 tests passed。
  - `npm run test:structure` -> checked files: 3，OK。
  - `( rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line ).Lines` -> 24。

## 2026-05-16 22:08 +08 结构门禁补上 direct handler seam 规则

- 处理结果：
  - `scripts/infra/testing-structure-guard.mjs` 新增 direct handler 门禁：对 `src/games/**/__tests__` 里的游戏行为测试，新增加的 `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 直调会直接报错。
  - `isInteractionContractTest(...)` 识别范围补到 `promptSystem`、`promptResponseChain`、`abilityInteractionRegistry`，避免把系统合同/注册表合同误判成业务测试。
  - 新增显式 allowlist：`src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` 与 `src/games/smashup/__tests__/expansionOngoing.test.ts`，作为当前已确认的低层能力合同保留面。
  - `docs/testing-best-practices.md` 已同步补充：业务/能力测试默认禁止新增 direct handler / runtime prompt handler，只有注册表、系统合同和明确登记的低层合同例外。
- 验证：
  - `npm run test:structure` -> checked files: 3，OK。
  - `node node_modules/eslint/bin/eslint.js scripts/infra/testing-structure-guard.mjs` -> 0 errors。
  - `node scripts/infra/testing-structure-guard.mjs --all` -> checked files: 861，OK；仅输出历史 `legacy-root` 与旧泛名测试债务 warning，无新增 violation。

- 补充收口：
  - `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` 已把 `bear_cavalry_superiority_pod_talent` 这两条 handler 直调明确标注为“低层合同”，避免后续被误当成普通业务测试入口。
  - `src/games/smashup/__tests__/expansionOngoing.test.ts` 已在 `steampunk_mechanic` 两条 runtime prompt handler 用例旁补注释，明确它们锁的是 illegal value / resolver 二次校验合同。
  - `node node_modules/eslint/bin/eslint.js scripts/infra/testing-structure-guard.mjs src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors。
  - `npm run test:structure` 复跑 -> checked files: 5，OK。

## 2026-05-16 22:21 +08 低层合同 helper 化，移除文件级 allowlist

- 处理结果：
  - `src/games/smashup/__tests__/helpers.ts` 新增 `invokeRegisteredInteractionHandlerContract(...)` 与 `invokeRegisteredRuntimePromptHandlerContract(...)`。
  - `abilities/bear-cavalry.test.ts` 的 `bear_cavalry_superiority_pod_talent` 两条，已从测试体内 raw `getInteractionHandler(...)` 改为走 `invokeRegisteredInteractionHandlerContract(...)`。
  - `expansionOngoing.test.ts` 的 `steampunk_mechanic` 两条 runtime resolver 合同，已从测试体内 raw `getAbilityRuntimePromptHandler(...)` 改为走 `invokeRegisteredRuntimePromptHandlerContract(...)`。
  - 由于这两份文件不再含 raw handler 查询，`scripts/infra/testing-structure-guard.mjs` 已移除这两份文件的 allowlist；guard 现在只对系统合同命名和 helper 出口留口子。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 22；剩余 raw 命中仅在 `abilityInteractionRegistry.test.ts`、`promptSystem.test.ts`、`promptResponseChain.test.ts` 与 `helpers.ts`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> 2 files / 88 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts scripts/infra/testing-structure-guard.mjs` -> 0 errors。
  - `npm run test:structure` -> checked files: 5，OK。

## 2026-05-16 22:26 +08 系统合同存在性样板 helper 化

- 处理结果：
  - `src/games/smashup/__tests__/helpers.ts` 新增 `findRegisteredPromptContinuationContract(...)`、`expectRegisteredInteractionHandlerContract(...)`、`expectRegisteredRuntimePromptHandlerContract(...)`、`expectRegisteredPromptContinuationContract(...)`。
  - `promptResponseChain.test.ts` 中“继续函数注册验证”和各能力 existence 断言，已从 raw `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 改为走上述 helper。
  - `promptSystem.test.ts` 中 `alien_crop_circles runtime prompt 已注册` 与 `nonexistent_ability` negative case，也已改走 helper。
  - `helpers.ts` 内部继续去重：公开 helper 统一复用 `lookupRegisteredInteractionHandler(...)` / `lookupRegisteredRuntimePromptHandler(...)` 两个底层查找函数。
  - `rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 11；剩余只在 `abilityInteractionRegistry.test.ts` 9 处和 `helpers.ts` 2 处。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/promptResponseChain.test.ts src/games/smashup/__tests__/promptSystem.test.ts` -> 2 files / 22 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/promptResponseChain.test.ts src/games/smashup/__tests__/promptSystem.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 7，OK。

## 2026-05-16 22:35 +08 开始治理 resolvePromptViaRegisteredHandler 隐性耦合

- 处理结果：
  - `scripts/infra/testing-structure-guard.mjs` 新增门禁：业务测试新增 `resolvePromptViaRegisteredHandler(...)` 也会失败，避免把 registered handler 直调藏进 helper。
  - `abilities/cthulhu.test.ts` 的 `special_madness` 两条，已从 `resolvePromptViaRegisteredHandler(...)` 改为真实 `respondToPromptOption(...)`；断言口径同步改为按业务事件类型查找，不再假设 `events[0]` 一定是业务事件。
  - `elderThingAbilities.test.ts` 的 `elder_thing_mi_go` 两条，已从 `resolvePromptViaRegisteredHandler(...)` 改为真实 `respondToPromptOption(...)`。
  - `elder-thing-choice-goju-tiebreak.test.ts` 已按语义拆分：
    - 常规 destroy / deckbottom / 二段选择 / stale old-prompt 场景改为 `respondToPromptOption(...)` + `withOnlyCurrentPrompt(...)`
    - “强行提交非法 destroy choice 也应兜底”保留为低层合同，但改走 `invokeRegisteredInteractionHandlerContract(...)`
  - `rg -n "resolvePromptViaRegisteredHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line` -> 15；剩余集中在 `baseAbilitiesPrompt.test.ts`、`reactionQueue*.test.ts` 与 `helpers.ts`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 2 files / 45 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 1 file / 10 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts scripts/infra/testing-structure-guard.mjs` -> 0 errors。
  - `npm run test:structure` -> checked files: 10，OK。

## 2026-05-16 22:50 +08 reaction queue 当前 prompt 改走真实响应

- 处理结果：
  - `src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts` 的 optional cycle 用例，已从 `resolvePromptViaRegisteredHandler(...)` + `withoutCurrentPrompt(...)` 改为真实 `respondToPromptOption(...)`。现在直接通过当前 `smashup_reaction_choose` prompt 点击 `pass`，再由 player 2 点击 `base_b`，最后验证 player 1 仍能看到 2 个 `base_a` option。
  - `src/games/smashup/__tests__/reactionQueueOrdering.test.ts` 的 mandatory ordering 选择，已从 registered handler 直调改为真实 `respondToPromptOption(...)`；断言同步改掉 `events[0] === TRIGGER_CONSUMED`，改为“事件流包含 `TRIGGER_CONSUMED` + `POWER_COUNTER_REMOVED`”。
  - `src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` 的基地排序选择，同样改为真实 `respondToPromptOption(...)`，并把固定下标断言改为包含式断言。
  - `src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts` 的 `smashup_reaction_choose` 分支，已从 `resolvePromptViaRegisteredHandler(...)` 改为真实 `respondToPrompt(...)`；后续仍断言 `vampire_mad_monster_party_pod_play` / `vampire_buffet_pod_play` prompt 上的 `displayCard` 上下文正确保留。
  - 这批迁移后，`rg -n "resolvePromptViaRegisteredHandler\\(" src/games/smashup/__tests__` 已只剩 `helpers.ts:787` 这 1 处 helper 定义本体；测试文件内命中清零。
- 中途红灯：
  - `reactionQueueOrdering.test.ts` 与 `reactionQueueBaseAbilities.test.ts` 首次改完后都只剩 1 条红灯，根因一致：旧断言仍锁 `events[0]` 必须是 `TRIGGER_CONSUMED`，但真实 respond 命令会先发 `SYS_INTERACTION_RESOLVED`。
  - 修正方式不是回退实现，而是把断言改成“`events` 中包含 `TRIGGER_CONSUMED`”，保留系统事件噪音的真实口径。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` -> 4 files / 36 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 15，OK。
  - `( rg -n "resolvePromptViaRegisteredHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line ).Lines` -> `1`。
  - `( rg -n "getInteractionHandler\\(|getAbilityRuntimePromptHandler\\(" src/games/smashup/__tests__ | Measure-Object -Line ).Lines` -> `11`。

## 2026-05-16 22:58 +08 删除已无调用方的旧 handler 桥接 helper

- 处理结果：
  - `src/games/smashup/__tests__/helpers.ts` 中 `resolvePromptViaRegisteredHandler(...)` 已删除。此前它已只剩 helper 定义本体，没有任何测试调用方。
  - 同文件里的 `callHandler(...)` 与 `resolveCurrentPromptHandlerWithCore(...)` 也一并删除；这两条旧桥接当前在代码里同样没有实际调用，只会继续暴露“手工喂 handler / 手工替换 core”的历史 seam。
  - `src/games/smashup/__tests__/helpers/auditUtils.ts` 已同步移除 `callHandler` 的转发导出，避免审计工具继续把它当公共接口暴露出去。
  - `docs/testing-best-practices.md` 的工具表与示例已同步改成 `invokeRegisteredInteractionHandlerContract(...)` / `invokeRegisteredRuntimePromptHandlerContract(...)`，不再教人使用 `callHandler`。
- 验证：
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/helpers/auditUtils.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 15，OK。
  - `rg -n "\\bcallHandler\\b|\\bresolveCurrentPromptHandlerWithCore\\b" src/games/smashup/__tests__` -> 无命中。
  - `rg -n "resolvePromptViaRegisteredHandler\\(" src/games/smashup/__tests__` -> 无命中。

## 2026-05-16 23:05 +08 小样本 `resolveAbility(...)` 回到真实命令入口

- 处理结果：
  - `src/games/smashup/__tests__/ninja-infiltrate-pod-talent.test.ts` 已从 `resolveAbility('ninja_infiltrate_pod', 'talent')` + `applyEvents(...)` 改为真实 `runCommand(... SU_COMMANDS.USE_TALENT ...)`，并通过 `finalState.core` 断言基地能力抑制生效。
  - `src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts` 已从 `resolveAbility('ancient_egyptians_plague_of_locusts', 'onPlay')` 改为真实 `runCommand(... SU_COMMANDS.PLAY_ACTION ...)`，继续断言会创建 `ancient_egyptians_plague_of_locusts` 基地选择 prompt。
- 中途红灯：
  - `ancient-egyptians.test.ts` 首次改完后红灯，根因不是能力逻辑错，而是旧执行器直调一直绕过了真实命令形状；`PLAY_ACTION` 需要的是 `targetBaseIndex`，不是 `baseIndex`。
  - 修正后测试恢复通过。这类红灯正说明回到真实命令入口有价值，它能逼测试对齐真实用户路径，而不是继续活在执行器夹具里。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ninja-infiltrate-pod-talent.test.ts` -> 1 file / 1 test passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/ninja-infiltrate-pod-talent.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts` -> 1 file / 1 test passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 17，OK。
  - `( rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line ).Lines` -> `100`。

## 2026-05-16 23:17 +08 `resolveAbility(...)` 继续回收 4 处普通 onPlay 业务链

- 处理结果：
  - `src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts` 已从 `resolveAbility('ancient_egyptians_mummy_strength', 'onPlay')` + 自建 `GameTestRunner/respond`，改为真实 `runCommand(PLAY_ACTION)` + `respondToPromptOption(...)`。
  - 同文件现在直接走 `mummy-strength` 出牌 -> `ancient_egyptians_mummy_strength_target` prompt -> 选择 `empowered` -> 断言 `tempPowerModifier=4`，不再用 executor 中间态和自建 runner 充当业务入口。
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts` 中 `special_madness` 的 3 条 `onPlay` 场景，已统一改为真实 `runCommand(PLAY_ACTION)` 起链，再用 `respondToPromptOption(...)` 选择 `draw` / `return`。
  - 边界判断：`special_madness` 归类为普通行动卡出牌链，应继续迁；`wizard_time_loop`、`killer_plant_insta_grow` 这种主要断言 `playTiming=immediate` 的 off-phase 用例，当前保留在执行器/时序层。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts` -> 1 file / 1 test passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/cthulhu.test.ts -t "special_madness onPlay 与终局 VP"` -> 1 file / 5 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/ancientEgyptiansMummyStrength.feedback-regression.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> 0 errors / 0 warnings。
  - `npm run test:structure` -> checked files: 19，OK。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `92`。

## 2026-05-16 23:31 +08 `innsmouth_recruitment` reduce 验证回到真实命令入口

- 处理结果：
  - `src/games/smashup/__tests__/madnessAbilities.test.ts` 中 `innsmouth_recruitment（招募）` 的“状态正确（reduce 验证）”，已从 `resolveAbility('innsmouth_recruitment', 'onPlay')` 改为真实 `runCommand(PLAY_ACTION)` 起链。
  - 该用例现在先走真实出牌得到 `innsmouth_recruitment` prompt，再用 `respondToPromptOption(...)` 选择 `count === 3`，最后用 `applyEvents(state, [...playResult.events, ...result.events])` 验证 reducer 后态。
  - 旧的“手工补一条 ACTION_PLAYED 事件”已经删除；这条 reduce 验证现在完全依赖真实命令层吐出的事件流。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts -t "状态正确（reduce 验证）"` -> 1 file / 7 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 20，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts` -> 剩余 7 处，集中在 off-phase immediate 合同、`miskatonic_librarian_pod` talent、`miskatonic_mandatory_reading` special 与 `miskatonic_lost_knowledge` talent。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `91`。

## 2026-05-16 23:37 +08 `ninja_infiltrate` 4 条业务 onPlay 用例回到真实 `PLAY_ACTION`

- 处理结果：
  - `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 中 `ninja_infiltrate / ninja_infiltrate_pod` 的 4 条 onPlay 业务测试，已从 `resolveAbility(...)` 改为真实 `runCommand(PLAY_ACTION)`。
  - 覆盖的 4 条路径分别是：多目标创建选择交互、POD 版只给基地战术目标、单目标自动消灭、无目标不产生额外效果。
  - 旧的自建 `matchState = { core, sys: { interaction... } }` 已从这 4 条测试体移除；出牌校验、`ACTION_PLAYED` 和后处理全部重新交给真实命令层。
- 中途红灯：
  - 首次迁移后，`只有一个基地战术时自动消灭` 与 `没有基地战术时不创建交互也不额外发事件` 两条失败。
  - 根因不是行为差异，而是测试文件顶部漏引入 `expectNoPrompt` helper；补齐 import 后整组恢复通过。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseFactionOngoing.test.ts -t "渗透"` -> 1 file / 7 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 21，OK。
  - `rg -n "resolveAbility\\('ninja_infiltrate|resolveAbility\\('ninja_infiltrate_pod" src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 无命中。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `87`。

## 2026-05-16 23:55:56 +08:00

- 继续处理 `resolveAbility(...)` 的业务 onPlay 债务，这轮收口两个点：
  - `src/games/smashup/__tests__/ongoingTalent.test.ts`
    - `trickster_pixie_pod` 两条测试已从 `resolveAbility('trickster_pixie_pod', 'onPlay')` 改为真实命令链。
    - 随从面：`runCommand(PLAY_MINION)`
    - 战术面：`runCommand(PLAY_ACTION)`
    - 同步把手牌卡实例改成真实 `fusion`，并把候选断言从固定顺序改成业务集合。
  - `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
    - `trickster_mark_of_sleep` 的“单目标时创建 Interaction”已从手工 `matchState` + `resolveAbility(onPlay)` 改为 `runCommand(PLAY_ACTION)`。
    - 中途命中 `player.discard is not iterable`，根因是旧 `extraPlayers` 覆盖把默认玩家壳层打残；已改成先建完整 state 再局部覆盖手牌。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/ongoingTalent.test.ts -t "trickster_pixie_pod"` -> 1 file / 2 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseFactionOngoing.test.ts -t "trickster_mark_of_sleep"` -> 1 file / 2 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/ongoingTalent.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 2，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/ongoingTalent.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `ongoingTalent.test.ts` 已清零；`baseFactionOngoing.test.ts` 仅剩 Ninja special / `trickster_enshrouding_mist` / `trickster_mark_of_sleep` 注册表存在性。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `84`。

## 2026-05-17 00:01:13 +08:00

- 继续处理 `resolveAbility(...)` 的业务 talent 债务，这轮收口 `madnessAbilities.test.ts` 中 `miskatonic_lost_knowledge`：
  - 3 条业务测试已从 `resolveAbility('miskatonic_lost_knowledge', 'talent')` 改为真实 `runCommand(USE_TALENT)`。
  - 测试数据已同步改成真实 ongoing 卡实例：基地上显式挂 `uid = ongoing-card`、`defId = miskatonic_lost_knowledge` 的 ongoing action，再通过 `ongoingCardUid` 走公开命令。
  - `baseIndex: undefined` 那条保留为低层合同，未混进业务链。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts -t "miskatonic_lost_knowledge"` -> 1 file / 4 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 3，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts` -> 剩余 6 处，集中在 off-phase immediate、`miskatonic_librarian_pod` talent、`miskatonic_mandatory_reading` special 与 `baseIndex: undefined` 的低层 talent 合同。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `83`。

## 2026-05-17 00:06:37 +08:00

- 继续处理 `resolveAbility(...)` 的业务 talent 债务，这轮再收 `madnessAbilities.test.ts` 中 `miskatonic_librarian_pod extra mode queues the Madness onPlay interaction`：
  - 已从手牌直喂 `resolveAbility('miskatonic_librarian_pod', 'talent')`，改为真实 `PLAY_MINION -> USE_TALENT -> respond`。
  - 现在测试会先把 `librarian` 打到基地 0，再通过 `minionUid = librarian` 触发 talent，之后选择 `extra` 并指定手里的疯狂卡。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts -t "miskatonic_librarian_pod extra mode queues the Madness onPlay interaction|miskatonic_lost_knowledge"` -> 1 file / 5 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/madnessAbilities.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 3，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts` -> 剩余 5 处，集中在 off-phase immediate、`miskatonic_mandatory_reading` special 与 `baseIndex: undefined` 的低层 talent 合同。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `82`。

## 2026-05-17 00:25:14 +08:00

- 继续处理 `resolveAbility(...)` 的 special 债务，这轮优先收 `baseFactionOngoing.test.ts` 里的 Ninja special：
  - `ninja_acolyte` 的成功链、shared-limit 阻止链、`consumesNormalLimit=false` 链，已从直调 `resolveAbility('ninja_acolyte', 'special')` 改为真实 `runCommand(ACTIVATE_SPECIAL)`。
  - `ninja_hidden_ninja` 试迁到 `ACTIVATE_SPECIAL` 时命中真实命令校验失败：`基地上没有该随从`。确认该卡当前没有可用公开命令入口后，已回退为显式执行器合同，而不是继续硬套命令链。
  - `ninja_acolyte` 的两条“同基地已用过 special”测试，也已同步改成公开接口语义：断言 `success=false`、错误消息包含“已使用过同组特殊能力”、且无业务事件。
- 中途红灯与结论：
  - 第一次迁移后 5 红灯，其中 3 条来自把 `ninja_hidden_ninja` 错分为 `ACTIVATE_SPECIAL`，2 条来自沿用旧执行器语义去断言 special-limit 阻止。
  - 修正后，这组测试对外层接口的分层更清楚：`Acolyte -> 命令入口`，`Hidden Ninja -> 执行器合同`。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseFactionOngoing.test.ts -t "ninja_acolyte|ninja_hidden_ninja|consumesNormalLimit|specialLimitGroup"` -> 1 file / 15 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 8，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> 剩余 7 处。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `76`。

## 2026-05-17 00:36:41 +08:00

- 继续处理 `resolveAbility(...)` 的标准 onPlay 债务，这轮转向 `expansionOngoing.test.ts`：
  - `ghost_make_contact` / `ghost_make_contact_pod` 的 3 条业务 onPlay 测试，已从 `resolveAbility(...)` 改为真实 `runCommand(PLAY_ACTION)`。
  - `miskatonic_researcher`、`miskatonic_field_trip`、`miskatonic_researcher_pod` 的 5 条业务 onPlay 测试，已分别改为真实 `PLAY_MINION` / `PLAY_ACTION`。
- 中途红灯与修正：
  - 第一次改 `ghost_make_contact` 时连着踩到两层旧假设：文件没导入 `makeMatchState`，以及旧测试错误地把事件数量锁成 `1`。修正为真实 `runCommand` + 在事件流中查找 `MINION_CONTROL_CHANGED` 后恢复。
  - `ghost_make_contact_pod` 第一次改完还暴露“牌根本不在手里”的旧夹具假设；补回手牌卡实例后通过。这说明旧执行器测试确实绕过了真实出牌前置。
  - `miskatonic_field_trip` 第一次改完后没有 prompt，根因不是实现坏了，而是打出 `field_trip` 后手里已经空了；补回一张额外手牌后，真实 prompt 才出现。这证明 prompt 出现性必须基于 live hand state，而不是旧执行器假壳。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts -t "ghost_make_contact|miskatonic_researcher|miskatonic_field_trip|researcher pod"` -> 1 file / 11 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 12，OK。
  - `rg -n "resolveAbility\\('ghost_make_contact|resolveAbility\\('ghost_make_contact_pod|resolveAbility\\('miskatonic_researcher'|resolveAbility\\('miskatonic_field_trip'|resolveAbility\\('miskatonic_researcher_pod'" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 只剩注册断言 2 处。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `68`。

## 2026-05-17 01:00:34 +08:00

- 继续处理 `expansionOngoing.test.ts` 里剩余的 `resolveAbility(...)` 债务，这轮收口 5 组：
  - `steampunk_mechanic`
    - 8 条业务/运行时测试已从 `resolveAbility('steampunk_mechanic', 'onPlay')` 改为真实 `runCommand(PLAY_MINION)` 起链。
    - 两条 runtime 非法值断言继续保留 `invokeRegisteredRuntimePromptHandlerContract(...)`，但 prompt 前置已改为真实出牌链。
    - 同步修正 1 条旧测试语义：原“无合法基地”断言依赖“机械师本人尚未上场”的假世界；切回真实 `PLAY_MINION` 后，`requireOwnMinion` 约束会因为机械师已在基地而成立，因此已改写为“真实出牌后该 ongoing 成为合法候选”。
  - `steampunk_change_of_venue`
    - stale-hand 用例已从 `resolveAbility('steampunk_change_of_venue', 'onPlay')` 改为真实 `runCommand(PLAY_ACTION)` 起链。
  - `innsmouth_return_to_the_sea`
    - stale/live 用例已从 `resolveAbility('innsmouth_return_to_the_sea', 'special')` 改为真实 afterScoring 响应窗口中的 `PLAY_ACTION`。
    - 中途首次红灯暴露：`canCardBePlayedInResponseWindow()` 依赖 `scoringEligibleBaseIndices`；补上真实达标基地前置后恢复通过。
  - `miskatonic_things_best_not_known_pod`
    - 已从 `resolveAbility('miskatonic_things_best_not_known_pod', 'special')` 改为真实 beforeScoring 响应窗口中的 `PLAY_ACTION`。
  - `miskatonic_librarian_pod`
    - `extra mode only plays Madness and marks extra action` 已从 `resolveAbility('miskatonic_librarian_pod', 'talent')` 改为真实 `PLAY_MINION -> USE_TALENT -> respond`。
- 验证：
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors
  - `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts -t "steampunk_mechanic|steampunk_change_of_venue|innsmouth_return_to_the_sea|things best not known pod|librarian pod extra mode"` -> 13 passed
  - `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts` -> 67 passed
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 剩余 6 处
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `49`

## 2026-05-17 01:06:52 +08:00

- 继续收口 `expansionOngoing.test.ts` 最后一条明显还在走业务 executor 的用例：
  - `killer_plant_blossom` 已从 `resolveAbility('killer_plant_blossom', 'onPlay')` 改为真实 `runCommand(PLAY_ACTION)`。
  - 断言从“只看 3 条 `LIMIT_MODIFIED`”升级为：
    - `ACTION_PLAYED` 存在
    - 无 prompt
    - `sameNameMinionRemaining === 3`
    - `sameNameMinionDefId === null`
    - `actionsPlayed === 1`
    - 牌已离手并进入弃牌堆
- 这轮后 `expansionOngoing.test.ts` 剩余的 `resolveAbility(` 全部都是注册存在性合同，不再有同类业务行为 seam 债务。
- 验证：
  - `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts -t "killer_plant_blossom"` -> 1 passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors
  - `node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/expansionOngoing.test.ts` -> 67 passed
  - `npm run test:structure` -> OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/expansionOngoing.test.ts` -> 剩余 5 处
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `48`

## 2026-05-17 01:19:34 +08:00

- 继续处理 `src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` 中 `elder_thing_the_price_of_power` 的 3 条 beforeScoring special 业务测试：
  - 已从 `resolveAbility('elder_thing_the_price_of_power', 'special')` 改为真实 `runCommand(PLAY_ACTION)`。
  - 新增 `attachBeforeScoringWindow(...)`，通过 `startSmashUpReactionSession(...)` 构造真实 Me First! beforeScoring response window。
  - 中途第一次红灯不是能力逻辑坏了，而是测试仍在用默认 `test_base`；真实入口结束后 `FlowSystem` 继续推进 `scoreOneBase`，因此直接炸在 `baseDef.vpAwards`。修正为真实基地 `base_the_jungle` 后恢复。
  - 同轮还把对手手牌夹具收紧为真实已注册卡定义，并把“对手在此基地无随从”从旧 executor 语义修正为真实公开行为：允许打出，但不产生额外 reveal / 加指示物效果。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts -t "elder_thing_the_price_of_power special"` -> 1 file / 3 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` -> 1 file / 16 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` -> 0 errors。
  - `npm run test:structure` -> checked files: 14，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/abilities/elder-things-ongoing.test.ts` -> 无命中。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `41`。

## 2026-05-17 01:26:58 +08:00

- 继续收两组 Elder Things 相关的普通 onPlay 业务链：
  - `src/games/smashup/__tests__/elderThingAbilities.test.ts`
    - `elder_thing_mi_go` 的 3 条业务测试已从 `resolveAbility('elder_thing_mi_go', 'onPlay')` 改为真实 `runCommand(PLAY_MINION)`。
    - 现在统一通过 `played.finalState` 上的 live prompt 做后续 `respondToPromptOption(...)`，不再混用“第一条走真实入口、后两条走 executor”。
  - `src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts`
    - 共享 helper `triggerElderThingOnPlay(...)` 已从 fake `matchState + resolveAbility(...)` 改为真实 `runCommand(PLAY_MINION)`。
    - helper 内部会把测试里用于描述“打出后局面”的 `et-1` 预置状态收敛成真实出牌前置：从基地移除该随从、回填到手牌，再走公开命令。
    - 这使同文件 6 条 `elder_thing_elder_thing_choice` 行为测试一起回到真实入口，包括 destroy 两步选择、自动消灭、deckbottom live/stale 场景。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elderThingAbilities.test.ts -t "elder_thing_mi_go（米-格：对手抽疯狂卡或你抽牌）"` -> 1 file / 3 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 1 file / 25 tests passed。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts -t "远古之物：消灭两个随从选择权"` -> 1 file / 6 tests passed。
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 0 errors。
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 1 file / 10 tests passed。
  - `npm run test:structure` -> checked files: 16，OK。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/elderThingAbilities.test.ts` -> 剩余 2 处（仅 off-phase extra-timing 合同）。
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/elder-thing-choice-goju-tiebreak.test.ts` -> 无命中。
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `38`。

## 2026-05-17 01:39:21 +08:00

- 继续处理“剩余 `resolveAbility(...)` 里本来就该保留的低层合同”，这轮不再把它们当成业务链硬迁，而是补统一接口：
  - 在 `src/games/smashup/__tests__/helpers.ts` 新增 `expectRegisteredAbilityContract(...)` / `invokeRegisteredAbilityContract(...)`
  - 统一把“注册表里取 executor 再直接执行”的模式收进 helper
- 已迁到新 helper 的文件：
  - `src/games/smashup/__tests__/madnessAbilities.test.ts`
  - `src/games/smashup/__tests__/elderThingAbilities.test.ts`
  - `src/games/smashup/__tests__/factionAbilities.test.ts`
  - `src/games/smashup/__tests__/zombieWizardAbilities.test.ts`
  - `src/games/smashup/__tests__/abilities/killer-plants.test.ts`
  - `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/madnessAbilities.test.ts` -> 1 file / 32 tests passed
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elderThingAbilities.test.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 5 files / 138 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/helpers.ts src/games/smashup/__tests__/madnessAbilities.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 0 errors
  - `npm run test:structure` -> checked files: 21，OK
- 统计：
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__/madnessAbilities.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts` -> 0 命中
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `25`
  - 剩余分布：
    - `7` `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
    - `5` `src/games/smashup/__tests__/abilityRegistry.test.ts`
    - `5` `src/games/smashup/__tests__/expansionOngoing.test.ts`
    - `4` `src/games/smashup/__tests__/properties/coreProperties.test.ts`
    - `1` `src/games/smashup/__tests__/elderThingsPod.test.ts`
    - `1` `src/games/smashup/__tests__/expansionAbilities.test.ts`
    - `1` `src/games/smashup/__tests__/helpers.ts`
    - `1` `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts`

## 2026-05-17 01:46:52 +08:00

- 继续处理“剩余业务/能力文件里的裸 `resolveAbility(...)`”，这轮分两类收口：
  - 删除局部重复的能力已注册断言
  - 把确实保留的 low-level ability 合同统一改成 `invokeRegisteredAbilityContract(...)`
- 已修改：
  - `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
    - 删除 `ninja_acolyte` / `ninja_hidden_ninja` / `trickster_mark_of_sleep` 的局部存在性断言
    - `ninja_hidden_ninja` 3 条 low-level special 合同改 helper
    - `trickster_enshrouding_mist` off-phase immediate 合同改 helper
  - `src/games/smashup/__tests__/expansionOngoing.test.ts`
    - 删除 `steampunk_captain_ahab` / `killer_plant_venus_man_trap` / `innsmouth_return_to_the_sea` / `miskatonic_researcher` / `miskatonic_field_trip` 的局部存在性断言
  - `src/games/smashup/__tests__/elderThingsPod.test.ts`
  - `src/games/smashup/__tests__/expansionAbilities.test.ts`
  - `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts`
  - `docs/testing-best-practices.md`
  - `docs/automated-testing.md`
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` -> 5 files / 191 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts` -> 0 errors
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/expansionOngoing.test.ts` -> 0 errors
  - `npm run test:structure` -> checked files: 24，OK
- 最新统计：
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `10`
  - 剩余分布：
    - `5` `src/games/smashup/__tests__/abilityRegistry.test.ts`
    - `4` `src/games/smashup/__tests__/properties/coreProperties.test.ts`
    - `1` `src/games/smashup/__tests__/helpers.ts`

## 2026-05-17 01:50:31 +08:00

- 继续审计最后 4 处 `coreProperties.test.ts` 命中，逐条分层后确认：
  - `253/254/263` 属于 `Property 4: 能力注册表往返一致性`，应保留。
  - `1279` 那条“所有已知 onPlay 随从都已注册能力”只是局部重复存在性断言，应删除，不再混在 `Property 5` 里。
- 同轮顺手清掉同文件的 2 条 eslint warning：
  - 删除未使用的 `SmashUpEvent` 类型导入
  - 删除 `非当前响应者不能在 Me First 窗口中打牌` 用例里未使用的 `followupMinion`
- 验证：
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/properties/coreProperties.test.ts` -> 0 errors / 0 warnings
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/properties/coreProperties.test.ts` -> 1 file / 53 tests passed
  - `npm run test:structure` -> checked files: 25，OK
  - `rg -n "resolveAbility\\(" src/games/smashup/__tests__` -> 仅剩 `abilityRegistry.test.ts` 5、`helpers.ts` 1、`properties/coreProperties.test.ts` 3
  - `(rg -n "resolveAbility\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `9`

## 2026-05-17 01:56:42 +08:00

- 继续把“统一测试标准”从文档落到脚本：
  - `scripts/infra/testing-structure-guard.mjs` 新增 `resolveAbility(...)` 门禁。
  - 当前仅允许 `abilityRegistry.test.ts` 与 `properties/coreProperties.test.ts` 新增/保留这类命中；其它业务/能力测试新增裸 `resolveAbility(...)` 将直接失败。
- 文档同步：
  - `docs/testing-best-practices.md`
  - `docs/automated-testing.md`
  - 两处都补上“业务/能力测试默认禁止新增裸 `resolveAbility(...)`，low-level 合同改走 `invokeRegisteredAbilityContract(...)`”。
- 顺手清理两处近期残留调试日志：
  - `src/games/smashup/__tests__/elderThingsPod.test.ts`
  - `src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts`
- 验证：
  - `npm run test:structure` -> checked files: 26，OK
  - `node scripts/infra/testing-structure-guard.mjs src/games/smashup/__tests__/properties/coreProperties.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts` -> checked files: 4，OK
  - `node node_modules/eslint/bin/eslint.js scripts/infra/testing-structure-guard.mjs src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 0 errors
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 2 files / 14 tests passed
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 0 命中

## 2026-05-17 02:02:11 +08:00

- 继续收业务测试里的调试壳层，这轮处理两份窗口回归：
  - `src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts`
    - 删除 setup/收尾 `console.log`
    - 把 `result.steps.reverse()` 改为 `[...result.steps].reverse()`，避免原地变异步骤数组
  - `src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts`
    - 删除 setup/状态打印日志
    - 改为直接断言 `result.finalState.sys.phase === 'scoreBases'`
    - 若窗口存在，再继续断言它停在 `meFirst` 且当前响应者是 `P0`，并证明 `P0` 手牌中确实没有 beforeScoring 可响应内容
- 中途红灯：
  - 第一次把 `beforeScoring-window-stuck` 收得过死，错误假设“窗口一定已存在”；实际当前实现只保证相位停在 `scoreBases`，窗口未必已经挂出。随后把断言改成“相位必须停住；若窗口存在则继续验证其内容”后恢复通过。
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts` -> 2 files / 2 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts` -> 0 errors
  - `npm run test:structure` -> checked files: 28，OK
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__/afterScoring-window-multi-round.test.ts src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/ninja-hidden-ninja-interaction-bug-repro.test.ts` -> 0 命中
  - `(rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `123`

## 2026-05-17 02:07:45 +08:00

- 继续按“业务回归优先、系统/审计文件后置”清测试调试壳层：
  - `src/games/smashup/__tests__/igor-double-trigger-bug.test.ts`
    - 删除 base_crypt + Igor 场景的 `console.log`
  - `src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts`
    - 删除所有步骤日志
    - 删除局部“`resolveOnDestroy('frankenstein_igor')` 已注册”断言，避免继续制造局部注册噪音
  - `src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts`
    - 删除状态/选项日志
    - 把 `console.error + return` 改为直接 `throw`，避免命令失败时假绿
  - `src/games/smashup/__tests__/baseScoreCheck.test.ts`
    - 删除纯调试输出，保留 `BASE_SCORED` 合同断言
  - `src/games/smashup/__tests__/baseScoredOptimistic.test.ts`
    - 删除乐观引擎排障日志
    - 收掉 1 个清日志后遗留的未使用局部变量
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/igor-double-trigger-bug.test.ts src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 3 files / 3 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/igor-double-trigger-bug.test.ts src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts` -> 0 errors
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseScoreCheck.test.ts src/games/smashup/__tests__/baseScoredOptimistic.test.ts` -> 2 files / 2 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseScoreCheck.test.ts src/games/smashup/__tests__/baseScoredOptimistic.test.ts` -> 0 errors
  - `npm run test:structure` -> checked files: 31，OK
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__/igor-double-trigger-bug.test.ts src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts src/games/smashup/__tests__/igor-two-igors-one-destroyed.test.ts src/games/smashup/__tests__/baseScoreCheck.test.ts src/games/smashup/__tests__/baseScoredOptimistic.test.ts` -> 0 命中
  - `(rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `76`

## 2026-05-17 02:11:12 +08:00

- 继续清理同一批计分调试回归：
  - `src/games/smashup/__tests__/baseScoredNormalFlow.test.ts`
    - 删除所有 `console.log`
    - 把“命令被预测了/没被预测”从打印改为真实断言：`processResult.stateToRender` 必须存在，且预测态 `BASE_SCORED` 必须存在
  - `src/games/smashup/__tests__/baseScoredRaceCondition.test.ts`
    - 删除所有 `console.log`
    - 同样把预测态/最终态的关键打印收成断言
    - 清掉日志删除后暴露出的未使用 `RandomFn` 类型导入
- 验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=8192'; node node_modules/vitest/vitest.mjs run --configLoader native --maxWorkers 1 src/games/smashup/__tests__/baseScoredNormalFlow.test.ts src/games/smashup/__tests__/baseScoredRaceCondition.test.ts` -> 2 files / 2 tests passed
  - `node node_modules/eslint/bin/eslint.js src/games/smashup/__tests__/baseScoredNormalFlow.test.ts src/games/smashup/__tests__/baseScoredRaceCondition.test.ts` -> 0 errors
  - `npm run test:structure` -> checked files: 35，OK
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__/baseScoredNormalFlow.test.ts src/games/smashup/__tests__/baseScoredRaceCondition.test.ts` -> 0 命中
  - `(rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `52`

## 2026-05-17 02:25:46 +08:00

- 继续按“业务回归优先”清理剩余调试壳层，并把弱日志位改成真实行为断言：
  - `src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts`
    - 删除全部 `console.log/error`
    - 把 ActionLog 验证从“打印 kind”改成精确序列断言
    - 补充最终手牌 / 牌库结果断言，避免只看日志不看真实状态
  - `src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts`
    - 删除全部 `console.log/error`
    - 拉莱耶链路改为显式断言 `startTurn -> prompt -> respond -> playCards`
    - 托尔图加链路不再停留在“打印 phase”，而是改成真实有合法目标的 afterScoring 场景，断言 `scoreBases` 暂停、亚军 prompt、响应后换基地并移动随从到替换基地
  - `src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`
    - 删除 handler 结果打印
    - 改为精确断言事件序列、计分结果，以及后续 `multi_base_scoring` 剩余候选
  - `src/games/smashup/__tests__/sleep-spores-e2e.test.ts`
    - 删除 Mi-go 力量分析打印
    - 清掉日志删除后暴露出的未使用导入
- 验证：
  - `npx vitest run src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts` -> 3 tests passed
  - `npx vitest run src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts` -> 2 tests passed
  - `npx vitest run src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts -t "multi_base_scoring handler 应该执行计分逻辑"` -> 1 test passed
  - `npx vitest run src/games/smashup/__tests__/sleep-spores-e2e.test.ts` -> 2 tests passed
  - `npx eslint src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts src/games/smashup/__tests__/sleep-spores-e2e.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure` -> checked files: 37，OK
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts src/games/smashup/__tests__/sleep-spores-e2e.test.ts` -> 0 命中
  - `(rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__ | Measure-Object -Line).Lines` -> `22`

## 2026-05-17 02:38:24 +08:00

- 继续处理 `src/games/smashup/__tests__/interactionDefIdAudit.test.ts` 里最后 4 处 `console.log`：
  - 新增本地 helper `expectNoViolations(violations, summary)`
  - 把两条 audit 的“先打印清单再 `expect([])`”改成“失败时直接 `throw new Error(summary + 明细)`”
  - 结果是失败输出仍保留完整违规清单，但 `src/games/smashup/__tests__` 目录里不再残留测试文件级 `console.*`
- 验证：
  - `npx eslint src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 0 errors
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__` -> 0 命中
  - `npm run test:games:audit -- src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 触发整套 audit；确认此脚本不适合作为单文件定点验证，且仓内还存在与本次改动无关的既有 audit 红灯
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 仅跑目标文件，结果为 2 tests / 1 failed / 1 passed
    - passed：`所有 createSimpleChoice 的 value shorthand 字段都必须引用已定义变量`
    - failed：`所有 createSimpleChoice 的卡牌选项必须包含 defId`
    - 当前真实违规明细：
    - `vampires.ts:594 — 选项包含 minionUid 但缺少 minionDefId`
    - `vampires.ts:594 — 选项包含 baseIndex 但缺少 baseDefId`
    - `vampires.ts:1168 — 选项包含 minionUid 但缺少 minionDefId`
    - `vampires.ts:1168 — 选项包含 baseIndex 但缺少 baseDefId`

## 2026-05-17 02:41:38 +08:00

- 沿着 `interactionDefIdAudit.test.ts` 暴露出的真实红灯继续修 `src/games/smashup/abilities/vampires.ts`：
  - `vampire_heavy_drinker` 与 `vampire_heavy_drinker_pod` 的自定义 option value 都补上了
    - `minionDefId`
    - `baseDefId`
  - 同时保留原 `defId/baseIndex` 字段，避免一次性打断现有消费端
  - 两处 `onResolve` 统一改成 `selected.minionDefId ?? selected.defId`
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 1 file / 2 tests passed
  - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts -t "vampire_heavy_drinker|海量酒鬼|Heavy Drinker"` -> 1 passed / 7 skipped
  - `npx eslint src/games/smashup/__tests__/interactionDefIdAudit.test.ts` -> 0 errors
  - `npx eslint src/games/smashup/abilities/vampires.ts` -> 0 errors / 41 warnings（均为文件既有 `no-explicit-any` 基线，不是本轮新增）
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__` -> 0 命中

## 2026-05-17 02:59:26 +08:00

- 继续推进 interaction metadata 审计，而不是停留在 `defId` 一条：
  - `src/games/smashup/abilities/bear_cavalry.ts`
    - `bear_cavalry_superiority_pod_talent`
    - `bear_cavalry_general_ivan_pod_trigger`
    - `bear_cavalry_high_ground_pod_trigger`
    - 三处按钮分支统一改成 `targetType: 'button'`
    - 同时补齐 `cub_scout` / `commission` 等按钮 skip 选项的 `displayMode: 'button'`
  - `src/games/smashup/abilities/tornados.ts`
    - `tornados_ripped_off_target` 拆成 `tornados_ripped_off_target_base` / `tornados_ripped_off_target_minion`
  - `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
    - 删除 3 条已不再需要的 generic 理由登记
    - 新增 `mythic_greeks_favor_of_athena_order/pick`、`tornados_ripped_off`、`vampire_crack_of_dusk_pod` 的 generic 理由
- `interactionTargetTypeAudit` 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` -> 1 file / 7 tests passed
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDefIdAudit.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` -> 2 files / 9 tests passed
- 继续压 `interactionDisplayModeAudit`：
  - `src/games/smashup/abilities/ghosts.ts`：`ghost_spirit_confirm` 按钮显式补 `displayMode`
  - `src/games/smashup/abilities/pirates.ts`：`pirate_first_mate_choose_base` 基地选项显式补 `displayMode: 'card'`
  - `src/games/smashup/domain/abilityHelpers.ts`：`buildMinionTargetOptions(...)` 统一补齐 `minionDefId/baseDefId`
  - `src/games/smashup/abilities/vampires.ts`：补齐 Dinner Date / Cull the Weak / The Count / Fledgling / Wolf Pact 一批 card option 的 `defId/minionDefId/baseDefId`
  - `src/games/smashup/abilities/fairies.ts`、`innsmouth.ts`、`tricksters.ts`、`titans.ts`、`domain/baseAbilities_expansion.ts`：继续补齐直接字面量 value shape
- `interactionDisplayModeAudit` 阶段性结果：
  - 先从 `4 failed` 压到 `3 failed`
  - 再压到 `2 failed`
  - 当前最新：只剩 `1 failed`
  - 最新失败只剩 `显式 card displayMode 的选项必须提供可渲染 defId`
  - 剩余点位从 `23` 压到 `15`，再压到 `9`
- 行为回归：
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts -t "superiority_pod_talent|General Ivan|High Ground|全面优势|伊万将军|制高点"` -> 3 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts -t "first mate|大副"` -> 2 passed
  - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts` -> 8 passed
  - `npx vitest run src/games/smashup/__tests__/expansionOngoing.test.ts -t "innsmouth_return_to_the_sea|回归大海"` -> 1 passed
  - `npx vitest run src/games/smashup/__tests__/expansionBaseAbilities.test.ts -t "base_mermaid_pool|base_the_asylum_choose_minion|人鱼水池|庇护所"` -> 1 passed
- 静态检查：
  - 本轮涉及文件 `eslint` 均为 `0 errors`
  - 仍有大量既有 warnings（主要 `no-explicit-any` / unused），不是本轮新增问题

## 2026-05-17 03:11:45 +08:00

- 继续把 `interactionDisplayModeAudit` 从“AST 表象清零”推进到“真实类型合同收口”：
  - `src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts`
    - 不再重新 `readFileSync + createSourceFile` 每个文件，而是改用共享 `TypeScript Program`
    - 新增 `unwrapExpression(...)`，显式识别 `satisfies` / `as` / `non-null`
    - `extractObjectValueProps(...)` 现在会对 `value` initializer 走 `TypeChecker`，因此 `value: card` / `value: choice` / `value: action` 这类真实已带 `defId` 的 option 不再被误判
  - `src/games/smashup/abilities/aliens.ts`
    - `alien_scout_return` 的 yes 选项从错误的 `displayMode: 'card'` 改回 `button`
  - `src/games/smashup/abilities/bear_cavalry.ts`
    - `bear_cavalry_bear_necessities` 候选补 `displayMode: 'card'`
    - `bear_cavalry_commission_move_minion` 的 POD skip 选项改成 `{ skip: true }` button payload
    - 对应 handler 改为显式识别 `skip`，不再把 skip 伪装成 `minionUid === '__skip__'`
  - `src/games/smashup/abilities/tornados.ts`
    - `tornados_ripped_off` 对挂在随从上的持续行动补齐 `minionDefId`
  - `src/games/smashup/abilities/shayu_common.ts`
    - `asCardOptions` 明确收紧为 `RenderableCardChoiceValue` 合同，避免“card displayMode helper 却不要求 renderable def”
- 验证：
  - `node scripts/infra/vitest-cli-safe.mjs run --config vitest.config.audit.ts --configLoader native src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts` -> 1 file / 5 tests passed
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts -t "bear_necessities|Commission|委任|Bear Necessities"` -> 3 passed
  - `npx vitest run src/games/smashup/__tests__/interactionChainE2E.test.ts -t "commission|委任"` -> 3 passed
  - `npx vitest run src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` -> 4 passed
  - `npx vitest run src/games/smashup/__tests__/promptResponseChain.test.ts -t "alien_scout_return|侦察兵回手"` -> 1 passed
  - `npx eslint src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts src/games/smashup/abilities/aliens.ts src/games/smashup/abilities/bear_cavalry.ts src/games/smashup/abilities/tornados.ts src/games/smashup/abilities/shayu_common.ts` -> 0 errors；仍有文件既有 warnings（主要 `no-explicit-any` / unused），不是本轮新增

## 2026-05-17 03:22:30 +08:00

- 继续把“统一测试标准”固化成门禁，而不是只靠当前仓状态：
  - `scripts/infra/testing-structure-guard.mjs`
    - 新增 `console.log/warn/error/debug` 调试壳层门禁，阻止游戏行为测试再把控制台当事实载体
    - 新增 direct import 门禁：阻止业务测试继续直接导入 `resolveAbility`、`getInteractionHandler`、`getAbilityRuntimePromptHandler`
    - 全量扫描时发现“禁止任何 `abilityRegistry` 导入”会误伤 `clearRegistry` / 类型导入等合法场景，因此已收窄为只拦真正的问题入口，而不是整模块一刀切
  - 文档同步：
    - `docs/testing-best-practices.md`
    - `docs/automated-testing.md`
    - 补充门禁清单，明确写入“禁止新增测试调试日志”和“禁止业务测试直摸原始 registry/handler”
- 验证：
  - `npm run test:structure -- --all` -> checked files: 45，OK
  - `rg -n "console\\.(log|warn|error|debug)\\(" src/games/smashup/__tests__` -> 0 命中

## 2026-05-17 03:31:18 +08:00

- 继续把“以后改代码不用频繁改测试”的目标落到文件结构，而不是只停在 metadata/audit：
  - `src/games/smashup/__tests__/abilities/aliens.test.ts`
    - 在既有 `alien_jammed_signal` 两条基地压制回归上，追加迁入完整 `Aliens` 能力簇：
      - `alien_invader`
      - `alien_collector`（prompt 创建 + runtime prompt 返回）
      - `alien_supreme_overlord`
      - `alien_disintegrator`
      - `alien_crop_circles`
    - 新增本地 `execPlayMinion(...)` / `execPlayAction(...)`，统一走真实出牌命令而不是历史内部入口。
  - `src/games/smashup/__tests__/factionAbilities.test.ts`
    - 删除整段 `describe('外星人派系能力', ...)`
    - 清理迁移后残留的 `respondCommand` 无用 import
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts` -> 1 file / 8 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/aliens.test.ts` -> 0 errors
  - `npx vitest run src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 37 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/aliens.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 48，OK
- 备注：
  - 运行中仍能看到运行时既有 `[DEBUG] PLAY_ACTION validation` 输出，以及 `alien_disintegrator` 缺目标时的预期验证失败日志；它们来自业务管线本身，不是测试文件新增 `console.*`，因此不构成这轮结构门禁回退。

## 2026-05-17 03:37:22 +08:00

- 继续沿“能力簇迁移”这条线推进，这次不新开文件，而是优先并到已有专项文件：
  - `src/games/smashup/__tests__/abilities/dinosaurs.test.ts`
    - 吸收原 `factionAbilities.test.ts` 的恐龙 action 回归：
      - `dino_rampage`
      - `dino_augmentation`
      - `dino_howl`
      - `dino_natural_selection`
      - `dino_survival_of_the_fittest`
    - 新增本地 `execPlayAction(...)`，统一走真实 `PLAY_ACTION`
  - `src/games/smashup/__tests__/factionAbilities.test.ts`
    - 删除整段 `describe('恐龙派系能力', ...)`
    - 清理迁移后残留的 `getPromptOptions` / `expectNoPrompt` 无用 import
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/dinosaurs.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 32 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/dinosaurs.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 49，OK
- 结果：
  - `factionAbilities.test.ts` 从上一轮去掉 Aliens 后的 29 tests，再降到 20 tests
  - `dinosaurs.test.ts` 从 3 个 ongoing/保护回归扩成 12 tests，但主题仍保持单一，没有重新长成泛名垃圾桶

## 2026-05-17 03:49:41 +08:00

- 继续把 `factionAbilities.test.ts` 往“只剩尾项”推进，这一轮连续迁出 4 组：
  - `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts`
    - 吸收 `pirate_broadside`
    - `pirate_cannon`
    - `pirate_swashbuckling`
    - 新增本地 `execPlayAction(...)`
  - 新建 `src/games/smashup/__tests__/abilities/wizards.test.ts`
    - 迁入 `wizard_neophyte`
    - `wizard_neophyte_pod`
    - `wizard_enchantress`
    - `wizard_mystic_studies`
  - 新建 `src/games/smashup/__tests__/abilities/robots.test.ts`
    - 迁入 `robot_zapbot`
    - `robot_tech_center`
    - `robot_microbot_fixer + base_the_homeworld`
  - 新建 `src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts`
    - 迁出共享“立即额外行动”交互组
- 同步瘦身 `src/games/smashup/__tests__/factionAbilities.test.ts`：
  - 删除海盗整段
  - 删除巫师整段
  - 删除机器人整段
  - 删除“立即额外行动”整段
  - 顺手清理残留的 helper/import 壳层
- 分批验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 38 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 16 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 11 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npx vitest run src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 2 files / 6 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/immediate-extra-action.test.ts src/games/smashup/__tests__/factionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` 最新 -> checked files: 52，OK
- 当前状态：
  - `factionAbilities.test.ts` 现在只剩 `ghost extra timing audit` + `ninja_seeing_stars`
  - 泛名文件已经从最初大杂烩收缩成“待归宿尾项文件”

## 2026-05-17 03:54:12 +08:00

- 收掉 `factionAbilities.test.ts` 最后两个尾项：
  - 新建 `src/games/smashup/__tests__/abilities/ninjas.test.ts`
    - 接走 `ninja_seeing_stars`
  - `src/games/smashup/__tests__/expansionAbilities.test.ts`
    - 在 `ghost_ghostly_arrival（悄然而至）` 块内补入 off-phase `playTiming === 'immediate'` 断言
  - 删除 `src/games/smashup/__tests__/factionAbilities.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 2 files / 34 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
- 结果：
  - `factionAbilities.test.ts` 已彻底退场
  - 原来挂在这份历史泛名文件里的派系/共享交互/时机断言，现已分别回归更准确的专项文件

## 2026-05-17 04:04:31 +08:00

- 继续回应“是不是只改了表象”，这轮处理的不是 grep 清零，而是另一份历史混装壳：
  - `src/games/smashup/__tests__/query6Abilities.test.ts`
- 先完成忍者尾项迁移并验证：
  - `src/games/smashup/__tests__/abilities/ninjas.test.ts`
    - 接走 `ninja_way_of_deception`
    - `ninja_disguise`
  - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/query6Abilities.test.ts` -> 2 files / 31 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts src/games/smashup/__tests__/query6Abilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 53，OK
- 然后把 `query6Abilities.test.ts` 剩余三簇一次性归位：
  - `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts`
    - 吸收 `pirate_dinghy`
    - `pirate_shanghai`
    - `pirate_sea_dogs`
    - `pirate_powderkeg`
  - `src/games/smashup/__tests__/abilities/wizards.test.ts`
    - 吸收 `wizard_mass_enchantment`
    - `wizard_portal`
    - `wizard_portal_order`
    - `wizard_scry`
    - `wizard_sacrifice`
    - `wizard_winds_of_change`
  - `src/games/smashup/__tests__/abilities/aliens.test.ts`
    - 吸收 `alien_scout`
  - 删除 `src/games/smashup/__tests__/query6Abilities.test.ts`
- 定点验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts` -> 3 files / 59 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
  - `Test-Path src\\games\\smashup\\__tests__\\query6Abilities.test.ts` -> False
- 结果：
  - `query6Abilities.test.ts` 已彻底退场
  - SmashUp 里“按历史批次混装”的两个明显旧壳 `factionAbilities.test.ts`、`query6Abilities.test.ts` 都已经被拆掉
  - 这轮新增/迁入的测试仍统一走真实出牌命令、prompt facade 和现有专项文件边界，没有再引入新的测试入口分叉

## 2026-05-17 04:09:18 +08:00

- 继续扫描 SmashUp 剩余历史壳时，先挑了一个更低风险但很典型的目标：
  - `src/games/smashup/__tests__/robotAbilities.test.ts`
  - 这个文件不属于“多派系混装”，但已经和 `src/games/smashup/__tests__/abilities/robots.test.ts` 形成同主题双入口
- 基线核对：
  - `npx vitest run src/games/smashup/__tests__/robotAbilities.test.ts src/games/smashup/__tests__/abilities/robots.test.ts` -> 2 files / 16 tests passed
  - `npx eslint src/games/smashup/__tests__/robotAbilities.test.ts src/games/smashup/__tests__/abilities/robots.test.ts` -> 0 errors / 0 warnings
- 收口动作：
  - `src/games/smashup/__tests__/abilities/robots.test.ts`
    - 吸收 `robot_microbot_reclaimer` 多选/空选择/洗回牌库/动态 optionsGenerator 刷新/AI legal actions 过期候选防线
    - 吸收 `robot_microbot_fixer` 第一个随从额外额度合同
    - 吸收 `robot_microbot_reclaimer` onPlay 额外额度与“先解交互再打荣誉之地额外随从”的真实链路
  - 删除 `src/games/smashup/__tests__/robotAbilities.test.ts`
- 定点验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts` -> 1 file / 16 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/robots.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 52，OK
  - `Test-Path src\\games\\smashup\\__tests__\\robotAbilities.test.ts` -> False
- 结果：
  - 机器人普通行为测试只剩一个专项入口 `abilities/robots.test.ts`
  - 这说明“测试去耦”的下一个层次不只是拆多派系壳，也包括消除同一派系的双入口并存

## 2026-05-17 04:19:28 +08:00

- 继续沿“不是只改表象，而是收口长期稳定入口”这条线推进，这一轮处理的是根目录单派系旧入口：
  - `src/games/smashup/__tests__/ghostsAbilities.test.ts`
- 收口动作：
  - 新建 `src/games/smashup/__tests__/abilities/ghosts.test.ts`
    - 接走 `ghost_make_contact`
    - `ghost_make_contact_pod`
    - 统一走真实 `PLAY_ACTION` 命令链与现有 `helpers.ts`
  - 删除 `src/games/smashup/__tests__/ghostsAbilities.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 2 files / 41 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 54，OK
  - `Test-Path src\\games\\smashup\\__tests__\\ghostsAbilities.test.ts` -> False
- 备注：
  - 运行输出里仍有若干 `[DEBUG] PLAY_ACTION validation` 和预期的验证失败日志，但它们来自业务管线既有输出，不是这轮新增测试 `console.*`
  - 当前新的结构性经验已经补齐：除了混装壳、双入口壳，还要继续清掉“根目录单派系旧入口”这类历史入口分裂

## 2026-05-17 07:40:32 +08:00

- 继续沿“测试入口按稳定行为边界收口”推进，这一轮处理的是另一种更隐蔽的混装壳：
  - `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - 它不是按批次命名，但把鲨鱼 / 龙卷风 / 神话希腊三派系代表性玩法混在同一文件
- 收口动作：
  - 新建 `src/games/smashup/__tests__/abilities/sharks.test.ts`
    - 接走鲨鱼代表性行为与相关抽样复审
  - 新建 `src/games/smashup/__tests__/abilities/tornados.test.ts`
    - 接走龙卷风代表性行为
  - 新建 `src/games/smashup/__tests__/abilities/mythic-greeks.test.ts`
    - 接走神话希腊代表性行为与基地相关复审
  - 删除 `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
- 定点验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/sharks.test.ts src/games/smashup/__tests__/abilities/tornados.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts` -> 3 files / 21 tests passed
  - `npx eslint src/games/smashup/__tests__/abilities/sharks.test.ts src/games/smashup/__tests__/abilities/tornados.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts` -> 0 errors / 0 warnings
  - `npm run test:structure -- --all` -> checked files: 57，OK
  - `Test-Path src\\games\\smashup\\__tests__\\shayuFactionAbilities.test.ts` -> False
- 备注：
  - `vitest` 输出里仍可见既有 `[DEBUG] PLAY_ACTION validation` 与预期的命令验证失败日志；这是旧管线输出，不是本轮新增噪音
  - 现在 SmashUp 已经连续清掉四类历史壳：批次混装、同派系双入口、根目录单派系旧入口、跨多派系“代表性玩法”混装文件

## 2026-05-17 08:01:29 +08:00

- 继续处理 `src/games/smashup/__tests__/expansionAbilities.test.ts`，这次优先选已有专项归宿的 `Killer Plants`：
  - `src/games/smashup/__tests__/abilities/killer-plants.test.ts`
    - 吸收 `killer_plant_insta_grow`
    - 吸收 `killer_plant_weed_eater`
    - 新增断言优先直接看真实 `finalState`，不再为了状态结论手工重放 `applyEvents`
  - `src/games/smashup/__tests__/expansionAbilities.test.ts`
    - 删除整段 `食人花派系能力`
    - 顺手把仍残留的两条 `applyEvents` 状态测试改为直接消费 `runCommand(...).finalState`
- 中途一次定点验证红灯不是业务失败，而是旧文件残留的 `applyEvents` 调用：
  - `消灭后状态正确（reduce 验证）`
  - `单张行动卡时 Prompt 待决（reduce 验证）`
  - 这正好说明当前收口不只是挪文件，还在拔掉旧的事件回放 seam。
- 最终验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `2 files / 38 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 61, OK`

## 2026-05-17 08:06:13 +08:00

- 继续压 `src/games/smashup/__tests__/expansionAbilities.test.ts`，这次处理已有专项归宿的 `Bear Cavalry`：
  - `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
    - 吸收 `bear_cavalry_bear_hug`
    - 吸收 `bear_cavalry_commission`
    - 连同 tie-choice 的 interaction regression 一起并回专项文件，不再留在扩展聚合入口
  - `src/games/smashup/__tests__/expansionAbilities.test.ts`
    - 删除 `bear cavalry interaction regressions`
    - 删除整段 `黑熊骑兵派系能力`
    - 清理迁移后残留废 import
- 结果：
  - `expansionAbilities.test.ts` 当前已从之前的多派系聚合，压到只剩 `Steampunk` + `cthulhu_complete_the_ritual`
  - `Bear Cavalry` 普通行为现在只保留一个专项入口 `abilities/bear-cavalry.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `2 files / 36 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 62, OK`

## 2026-05-17 08:14:49 +08:00

- 继续收 `expansionAbilities.test.ts` 的最后尾项：
  - 新建 `src/games/smashup/__tests__/abilities/steampunks.test.ts`
    - 承接 `steampunk_scrap_diving`
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
    - 补入 `cthulhu_complete_the_ritual` 的打出约束
  - 删除 `src/games/smashup/__tests__/expansionAbilities.test.ts`
- 定点验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `2 files / 27 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 64, OK`
  - `Test-Path src\\games\\smashup\\__tests__\\expansionAbilities.test.ts` -> `False`
- 随后继续处理 `expansionOngoing.test.ts` 里已有专项归宿的幽灵段：
  - `src/games/smashup/__tests__/abilities/ghosts.test.ts`
    - 吸收 `ghost_incorporeal`
    - 吸收 `ghost_make_contact` 的显式 `MINION_CONTROL_CHANGED` 合同与 detach affect 记录合同
  - `src/games/smashup/__tests__/expansionOngoing.test.ts`
    - 删除整段 `幽灵 ongoing 能力`
    - 清理迁移后残留的 `buildAffectRecords` / `registerGhostAbilities` / `fireTriggers` 等废 import
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> `2 files / 81 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/ghosts.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 65, OK`

## 2026-05-17 09:00:18 +08:00

- 继续收掉另一个“按扩展包混三派系普通行为”的旧入口：
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
    - 吸收 `cthulhu_recruit_by_force`
    - 吸收 `cthulhu_it_begins_again`
    - 吸收 `cthulhu_fhtagn`
  - `src/games/smashup/__tests__/abilities/innsmouth.test.ts`
    - 吸收 `innsmouth_the_deep_ones`
    - 吸收 `innsmouth_new_acolytes`
    - 吸收 `innsmouth_mysteries_of_the_deep`
  - `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
    - 吸收 `miskatonic_those_meddling_kids`
  - 删除 `src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts`
- 这轮不是只挪 `describe`：
  - `cthulhu` / `innsmouth` / `miskatonic` 三边都补了各自本地公开入口 helper，后续同派系普通行为只需要在单一专项文件里维护
  - `cthulhu_recruit_by_force`、`cthulhu_it_begins_again`、`miskatonic_those_meddling_kids` 都继续走真实 prompt 响应，不回退旧执行器
  - `cthulhu_fhtagn`、`innsmouth_the_deep_ones`、`innsmouth_new_acolytes` 的状态断言也留在对应派系专项里，不再跟另外两派系共用一个“扩展包壳”
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 42 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `1 file / 12 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `1 file / 15 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `3 files / 69 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\cthulhuExpansionAbilities.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 6, OK`

## 2026-05-17 09:45:36 +08:00

- 继续处理 `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 的 `诡术师 ongoing 能力`，这次先不删旧段，先验证并回到 `src/games/smashup/__tests__/abilities/tricksters.test.ts` 的专项块是否真能独立站住。
- 第一轮验证直接失败：`npx vitest run src/games/smashup/__tests__/abilities/tricksters.test.ts` 报 `ReferenceError: makeBase is not defined`。
  - 这说明新专项不是在“沿用旧文件作用域”，而是真正需要把依赖说全；先补 `makeBase` import。
- 第二轮验证后仍有 2 条红灯：
  - `trickster_brownie_pod` 的“对手在其他基地打出随从后抽 1”
  - `trickster_pay_the_piper` 的“对手打出随从后弃 1”
  - 定位结果不是实现坏了，而是旧 `baseFactionOngoing.test.ts` 的本地 `makeState(...)` 默认带了 `deck/hand`，迁到共享 `helpers.makeState(...)` 后这两个前提消失了。
- 修复动作：
  - 在 `abilities/tricksters.test.ts` 的 `trickster_brownie_pod` 用例里显式给玩家 `0` 提供 `deck`
  - 在 `trickster_pay_the_piper` 用例里显式给玩家 `1` 提供 `hand`
  - 这样测试不再吃旧大文件的隐式资源默认值
- 专项文件站稳后，再从 `src/games/smashup/__tests__/baseFactionOngoing.test.ts` 删除整段 `诡术师 ongoing 能力`
  - 随后清理退场后残留的废 import：`registerTricksterAbilities`、`interceptEvent`、`isOperationRestricted`、`buildAffectRecords`、`getPromptsBySourceId`、`respondToPromptOption`、`withOnlyCurrentPrompt`
  - 同步修正文件头说明，避免旧文件继续声称覆盖诡术师
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `1 file / 46 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `2 files / 74 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/tricksters.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 13, OK`
- 结果：
  - `baseFactionOngoing.test.ts` 现在只剩忍者 / 牛仔段，不再承担诡术师第二入口
  - 这次收口证明的不是“describe 挪位置”，而是专项文件已经把 `draw/discard` 所需的资源前提显式化，后续重构共享 helper 时不必再回头同步猜旧默认值

## 2026-05-17 09:54:28 +08:00

- 继续处理 `baseFactionOngoing.test.ts` 的最后残留。这一轮先评估剩余内容边界，结论是：
  - 文件里实际上只剩忍者 ongoing/special 合同
  - 所谓“牛仔”只体现在 `ninja_acolyte` 额外打出 `cowboys_gunfighter` 后是否继续接管决斗交互，本质仍是忍者 special 链的一部分
  - 因此这份文件已经不再是共享技术壳，而是忍者第二入口，应该直接并回 `abilities/ninjas.test.ts`
- 实施动作：
  - `src/games/smashup/__tests__/abilities/ninjas.test.ts`
    - 吸收 `ninja_smoke_bomb`
    - `ninja_assassination`
    - `ninja_infiltrate`
    - `ninja_shinobi`
    - `ninja_acolyte`
    - `ninja_hidden_ninja`
    - `specialLimitGroup`
    - `consumesNormalLimit`
    - `ninja_acolyte -> cowboys_gunfighter` 续链
  - 在专项文件里新增显式 `makeNinjaOngoingState(...)` / `makeNinjaOngoingMinion(...)`
    - 不复用旧文件的局部 `makeState(...)`，而是把默认手牌、牌库、派系、turn meta 收进专项文件自己的显式状态工厂
  - 删除 `src/games/smashup/__tests__/baseFactionOngoing.test.ts`
- 验证：
  - 首先单跑专项文件，确认不是“因为旧文件还在所以才绿”：
    - `npx vitest run src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `1 file / 35 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/ninjas.test.ts` -> `0 errors / 0 warnings`
  - 再确认旧壳已真正退场：
    - `Test-Path src\\games\\smashup\\__tests__\\baseFactionOngoing.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 13, OK`
- 补充判断：
  - 快速复核 `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts` 的开头后，当前看起来更像“命名遗留”而不是新的多派系混装壳，优先级下调
  - 下一步应继续扫描根目录或专项目录里真正仍在混放多个行为边界的旧文件，而不是为了改名而改名

## 2026-05-17 10:05:09 +08:00

- 继续沿“不是只改文件名，而是按稳定行为边界收口”推进，这一轮处理的是：
  - `src/games/smashup/__tests__/talentAbilities.test.ts`
- 先按边界判断文件内容：
  - `miskatonic_professor` 是米斯卡塔尼克派系行为
  - `cthulhu_star_spawn / cthulhu_servitor` 是克苏鲁派系行为
  - `standing stones / execute-vs-validate / suppress` 属于共享 talent 机制合同
  - 因此这不是“一个 talent 文件”，而是“派系行为 + 系统合同”混层旧壳
- 收口动作：
  - `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
    - 接走 `miskatonic_professor` 的两条派系 talent 行为
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
    - 接走 `cthulhu_star_spawn`
    - 接走 `cthulhu_servitor`
  - 新建 `src/games/smashup/__tests__/talent-mechanics.test.ts`
    - 接走共享 talent 合同：`TALENT_USED`、目标缺失、`execute` 不做 `talentUsed` 校验、`standing stones` 双天赋、压制下可手动发动
  - 删除 `src/games/smashup/__tests__/talentAbilities.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> `1 file / 17 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 51 tests passed`
  - `npx vitest run src/games/smashup/__tests__/talent-mechanics.test.ts` -> `1 file / 8 tests passed`
  - `npx vitest run src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/talent-mechanics.test.ts` -> `3 files / 76 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/talent-mechanics.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\talentAbilities.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 16, OK`
- 结果：
  - `talentAbilities.test.ts` 已彻底退场
  - `talent` 相关测试现在按“派系行为 / 共享机制合同”分层，不再让单个技术主题文件同时承担多个派系与系统边界

## 2026-05-17 10:19:37 +08:00

- 继续沿“技术主题文件不是天然边界”推进，这一轮处理的是：
  - `src/games/smashup/__tests__/ongoingTalent.test.ts`
- 边界判断结果：
  - 文件内同时混有 `miskatonic_lost_knowledge`、`steampunk_zeppelin`、`innsmouth_sacred_circle`、`trickster_hideout_pod`、`trickster_pixie_pod`
  - 还混有 `ongoing talent` 的 validate / reset / payload 合同
  - 因此它不是稳定专题，而是“多派系业务 + 共享合同”混层旧壳
- 收口动作：
  - `src/games/smashup/__tests__/talent-mechanics.test.ts`
    - 接走 ongoing talent 的共享 validate / reset / TALENT_USED payload 合同
    - 也接走“minion talent 不受 ongoing talent 机制污染”的回归合同
  - `src/games/smashup/__tests__/abilities/steampunks.test.ts`
    - 接走 `steampunk_zeppelin`
  - `src/games/smashup/__tests__/abilities/innsmouth.test.ts`
    - 接走 `innsmouth_sacred_circle`
  - `src/games/smashup/__tests__/abilities/tricksters.test.ts`
    - 接走 `trickster_hideout_pod`
    - 接走 `trickster_pixie_pod`
  - 删除 `src/games/smashup/__tests__/ongoingTalent.test.ts`
- 这轮还有一个关键收正，不是简单搬测试：
  - `steampunk_zeppelin` 和 `innsmouth_sacred_circle` 的“无有效目标”旧测试，原来锁的是 `execute` 内层反馈
  - 迁到专项后改成真实 `runCommand` / validate 入口，公开合同变成“直接拒绝”
  - 这样后续重构 execute 内层事件时，不会再把这些测试一起打碎
- 验证：
  - 基线：`npx vitest run src/games/smashup/__tests__/ongoingTalent.test.ts` -> `1 file / 27 tests passed`
  - 迁移后：`npx vitest run src/games/smashup/__tests__/talent-mechanics.test.ts src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `4 files / 118 tests passed`
  - `npx eslint src/games/smashup/__tests__/talent-mechanics.test.ts src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts src/games/smashup/__tests__/abilities/tricksters.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\ongoingTalent.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 18, OK`
- 下一步判断：
  - `actionAndTalent.test.ts` 名字虽像技术主题，但内容现在只覆盖 `Property 6/8` 这类共享生命周期合同，未见多派系混装迹象
  - 下一刀应继续优先给真正还在混放多派系业务和共享机制的文件，而不是为了名字旧就硬拆

## 2026-05-17 11:01:42 +08:00

- 继续推进 `src/games/smashup/__tests__/abilities/madness-prompt-mechanics.test.ts` 的真拆层，不接受“删旧文件名但 seam 还在”的假收口。
- 边界复核结论：
  - 这不是自然的“prompt 机制文件”
  - 它混放了 `cthulhu_madness_unleashed`、`miskatonic_it_might_just_work`、`miskatonic_book_of_iter_the_unseen`、`miskatonic_thing_on_the_doorstep`
  - 同时残留旧 seam：`postProcessSystemEvents(...)`、`lastMatchState`、`getLastPrompt(...)`、`getLastPromptsBySourceId(...)`
- 收口动作：
  - `src/games/smashup/__tests__/abilities/cthulhu.test.ts`
    - 吸收 `cthulhu_madness_unleashed` 整组行为合同
  - `src/games/smashup/__tests__/abilities/miskatonic.test.ts`
    - 吸收 `miskatonic_it_might_just_work`
    - 吸收 `miskatonic_book_of_iter_the_unseen`
    - 吸收 `miskatonic_thing_on_the_doorstep`
  - 删除 `src/games/smashup/__tests__/abilities/madness-prompt-mechanics.test.ts`
- 这次真改到 seam，而不是只动表象：
  - 迁移后的用例统一走真实 `PLAY_ACTION / runCommand(...)`
  - 统一通过 prompt facade 读/回交互：`getSimpleChoicePrompt`、`respondToPromptOption(...)`、`respondToPromptOptions(...)`
  - 不再读 `lastMatchState`，不再手工 `postProcessSystemEvents(...)`
  - `miskatonic_thing_on_the_doorstep` 的 special 终态按 `result.events.reduce(reduce, state)` 验证，避免沿用旧壳错误状态出口
- 验证：
  - `Test-Path src\\games\\smashup\\__tests__\\abilities\\madness-prompt-mechanics.test.ts` -> `False`
  - `rg -n "postProcessSystemEvents|lastMatchState|getLastPrompt|getLastPromptsBySourceId" src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts` -> 无命中
  - `npx vitest run src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `4 files / 136 tests passed`
  - 第一次 `eslint` 暴露 1 处迁移后废 import：`miskatonic.test.ts` 的 `getPromptOption` 未使用
  - 删除废 import 后再次验证：`npx eslint src/games/smashup/__tests__/abilities/extra-play-timing-mechanics.test.ts src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/abilities/miskatonic.test.ts src/games/smashup/__tests__/abilities/innsmouth.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 20, OK`
- 当前判断：
  - 这一批已经不是“只改了标线”
  - 旧 `prompt` 主题壳已经退场，业务测试入口也收回到了公开命令链和 prompt facade
  - 下一批要继续优先找还在混放业务与测试壳层 helper 的旧文件，但要先区分共享系统合同与普通业务回归，避免为了降命中机械乱迁

## 2026-05-17 11:03:56 +08:00

- 继续按“先拔业务借壳、后保留系统合同”推进，先处理两份仍残留 `lastMatchState/getLastInteractions` 的文件：
  - `src/games/smashup/__tests__/abilities/elder-things.test.ts`
  - `src/games/smashup/__tests__/ongoingE2E.test.ts`
- `elder-things.test.ts`
  - 删除文件级 `lastMatchState`
  - 删除 `getLastInteractions()`
  - 新增局部 `runPlayAction(...)`，让 `elder_thing_begin_the_summoning` / `elder_thing_unfathomable_goals` 直接从 `finalState` 读取真实 prompt
  - 结果：该派系专项文件已不再依赖 `interaction.current/queue` 的内部存储位置
- `ongoingE2E.test.ts`
  - 删除文件级 `lastMatchState`
  - 删除 `getLastInteractions()`
  - 新增局部 `runPlayAction(...)`，让 `pirate_shanghai` 那条业务链直接消费 `postProcessSystemEvents(...).matchState`
  - 明确保留后半段 `replacement / afterScoring` 的系统合同直测，不机械迁
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `1 file / 41 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `0 errors / 0 warnings`
  - `rg -n "lastMatchState|getLastInteractions|interaction\\.current|interaction\\.queue" src/games/smashup/__tests__/abilities/elder-things.test.ts` -> 无命中
  - `npx vitest run src/games/smashup/__tests__/ongoingE2E.test.ts` -> `1 file / 14 tests passed`
  - `npx eslint src/games/smashup/__tests__/ongoingE2E.test.ts` -> `0 errors / 0 warnings`
  - `rg -n "lastMatchState|getLastInteractions" src/games/smashup/__tests__/ongoingE2E.test.ts` -> 无命中
  - `npm run test:structure -- --all` -> `checked files: 22, OK`
- 当前判断：
  - 剩余 `postProcessSystemEvents` 命中里，大头已经是系统合同测试，不再是那种一眼能拔掉的业务壳
  - 下一步应优先从 `smashup.smoke.test.ts` 这类混有业务回归的大文件里挑具体段落，而不是对所有 `postProcessSystemEvents` 命中一刀切

## 2026-05-17 11:09:31 +08:00

- 继续从 `smashup.smoke.test.ts` 里拔零散测试壳，不扩大到整文件重构。
- 本轮处理：
  - `身体改造在回合开始给己方随从加指示物时应触发 The Bride 抽 1（线上反馈 69ec35a1）`
  - 将 reaction chain fallback 从 `prompt?.data?.options?.[0]?.id` 改为 `getPromptOptions(prompt)[0]?.id`
- 目的：
  - 这不是功能变化，而是把“默认取第一个可选项”的测试意图收回 prompt facade
  - 避免后续 prompt 外壳字段变化时，这类小兜底先碎
- 验证：
  - `npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts -t "身体改造在回合开始给己方随从加指示物时应触发 The Bride 抽 1"` -> `1 passed`
  - `npx eslint src/games/smashup/__tests__/smashup.smoke.test.ts` -> `0 errors / 0 warnings`
  - `rg -n "prompt\\?\\.data\\?\\.options|prompt\\.data\\.options" src/games/smashup/__tests__ --glob '!**/helpers.ts' --glob '!**/helpers/**'` -> 无命中
  - `npm run test:structure -- --all` -> `checked files: 24, OK`
- 当前判断：
  - 现在业务测试层面的裸 `prompt.data.options` 基本已经收净
  - 下一步应继续从少数仍混着业务回归的大文件里挑 `postProcessSystemEvents` 借壳段落，而不是再做纯机械的字段替换

## 2026-05-17 11:17:52 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/giantAntsPod.test.ts`
- 边界判断：
  - 这不是共享机制文件，也不是必须留在根目录的系统合同
  - 它整份都在测巨蚁 POD 业务行为
  - 同时 `src/games/smashup/__tests__/abilities/giant-ants.test.ts` 已经是巨蚁专项入口，并且已承接了一部分 `drone_pod` 相关行为
  - 因此当前问题不是“缺一个新专项文件”，而是“巨蚁派系仍有两个业务入口”
- 实施动作：
  - 在 `abilities/giant-ants.test.ts` 中只补专项文件里缺失的 POD 行为：
    - `giant_ant_drone_pod` talent 抽牌
    - `giant_ant_drone_pod` 防止消灭
    - `giant_ant_soldier_pod`
    - `giant_ant_gimme_the_prize_pod`
    - `giant_ant_we_will_rock_you_pod`
    - `giant_ant_who_wants_to_live_forever_pod`
  - 不机械复制专项里已有的 `drone_pod` 场景
  - 清理专项文件中的废 import / 废变量
  - 删除 `src/games/smashup/__tests__/giantAntsPod.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/giant-ants.test.ts src/games/smashup/__tests__/giantAntsPod.test.ts` -> `2 files / 34 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/giant-ants.test.ts src/games/smashup/__tests__/giantAntsPod.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/giant-ants.test.ts` -> `1 file / 28 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/giant-ants.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\giantAntsPod.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 26, OK`
- 当前判断：
  - 巨蚁派系现在只剩一个长期测试入口 `abilities/giant-ants.test.ts`
  - 下一步可以继续按这个标准扫描其它根目录单派系旧入口，但要先区分“真的只是业务第二入口”还是“仍承载独特系统合同”

## 2026-05-17 11:27:18 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/elderThingsPod.test.ts`
- 边界判断：
  - 它不是共享机制文件，也不是必须留在根目录的系统合同
  - 主体内容都在测远古之物 POD 业务行为
  - `src/games/smashup/__tests__/abilities/elder-things.test.ts` 已经是远古之物专项入口，因此当前问题仍是“同派系双入口”
  - 旧文件里额外夹着一段 `elder_things (base): Elder Thing`，这是基础版 FAQ 重复覆盖，不应机械并回
- 实施动作：
  - 保留前面已并入 `abilities/elder-things.test.ts` 的 POD 行为块：
    - `elder_thing_elder_thing_pod`
    - `elder_thing_unfathomable_goals_pod`
    - `elder_thing_insanity_pod`
    - `elder_thing_mi_go_pod`
    - `elder_thing_shoggoth_pod`
    - `elder_thing_dunwich_horror_pod`
    - `elder_thing_the_price_of_power_pod`
    - `elder_thing_spreading_horror_pod`
    - `elder_thing_touch_of_madness_pod`
  - 直接删除 `src/games/smashup/__tests__/elderThingsPod.test.ts`
  - 不把 `elder_things (base): Elder Thing` 这一段 FAQ 重复覆盖再搬进专项文件
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `1 file / 53 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/elder-things.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\elderThingsPod.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 26, OK`
- 结果：
  - 远古之物派系现在只剩一个长期测试入口 `abilities/elder-things.test.ts`
  - 这次不是只删名字；重复 FAQ 没被复制，专项文件也已经能在删除后单独站住

## 2026-05-17 11:33:14 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/vampiresPod.test.ts`
- 边界判断：
  - `src/games/smashup/__tests__/abilities/vampires.test.ts` 已存在，说明吸血鬼早就有长期专项入口
  - `vampiresPod.test.ts` 主体内容仍是吸血鬼 POD 行为，不是共享机制文件
  - 文件里虽然有一条 `resolveOnPlay('vampire_wolf_pact_pod_action')` 的低层合同，但它仍属于吸血鬼专项，不构成继续保留旧入口的理由
- 实施动作：
  - 在 `abilities/vampires.test.ts` 中并入：
    - `vampire_nightstalker_pod`
    - `vampire_buffet_pod`
    - `vampire_the_count_pod`
    - `vampire_dinner_date_pod`
    - `vampire_wolf_pact_pod`
  - 同步补齐专项文件所需 import：
    - `resolveOnPlay`
    - `applyEvents`
    - `getFirstPrompt`
    - `getPromptOptions`
    - `getPromptPlayerId`
    - `getPromptSourceId`
    - `getPromptsBySourceId`
    - `respondCommand`
    - `getEffectivePower`
  - 先跑删除前组合基线，再删除 `src/games/smashup/__tests__/vampiresPod.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts src/games/smashup/__tests__/vampiresPod.test.ts` -> `2 files / 30 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/vampires.test.ts src/games/smashup/__tests__/vampiresPod.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/vampires.test.ts` -> `1 file / 19 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/vampires.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\vampiresPod.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 27, OK`
- 结果：
  - 吸血鬼派系现在只剩一个长期测试入口 `abilities/vampires.test.ts`
  - 这次不是只做文件名收口；低层 Wolf Pact POD 合同也已经收进专项，而不是继续靠旧根目录文件承载

## 2026-05-17 11:42:36 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- 边界判断：
  - 文件名虽然叫 `interactionChain`，也有自建 `GameTestRunner` / `buildSystems` 壳
  - 但主体内容是在逐条验证僵尸派系业务链，而不是共享 InteractionSystem 合同
  - 真正独特的低层部分只剩 `zombie_overrun` 的 onTurnStart 自收口 queue 合同，而且它本身也属于僵尸专项
- 实施动作：
  - 在 `src/games/smashup/__tests__/abilities/zombies.test.ts` 中补入旧文件独有的结算链行为：
    - `zombie_grave_digger` 取回 / 跳过
    - `zombie_walker` 弃掉 / 保留
    - `zombie_grave_robbing` 取回
    - `zombie_not_enough_bullets` 同名组回收
    - `zombie_lend_a_hand` 空提交 / 洗回
    - `zombie_lord` 继续 / 完成
    - `zombie_tenacious_z`
    - `zombie_theyre_coming_to_get_you`
    - `zombie_overrun`
  - 新增专项所需 import：
    - `collectTriggers`
    - `maybeResolveReactionQueue`
    - `expectNoPrompt`
    - `getPromptMultiMin`
    - `getPromptOptions`
    - `respondToPromptOptions`
  - 先跑删除前组合基线，再删除 `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/zombies.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> `2 files / 46 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/zombies.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/zombies.test.ts` -> `1 file / 24 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/zombies.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\zombieInteractionChain.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 27, OK`
- 结果：
  - 僵尸派系现在只剩一个长期测试入口 `abilities/zombies.test.ts`
  - 这次不是只删历史命名；旧文件里的自建 runner 壳已经退场，僵尸交互链改由专项自己的公开命令入口与 prompt facade 承接

## 2026-05-17 11:47:03 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/frankensteinFaq.test.ts`
- 边界判断：
  - 文件名虽然带 `FAQ`
  - 但三条测试都在锁弗兰肯斯坦派系自己的业务行为：`Blitzed / Überserum / It's Alive!`
  - 并不存在一个需要独立保留的共享 FAQ 机制边界
- 实施动作：
  - 在 `src/games/smashup/__tests__/abilities/frankenstein.test.ts` 中并入：
    - `frankenstein_blitzed`
    - `frankenstein_uberserum`
    - `frankenstein_its_alive`
  - 为专项文件补齐 `getPromptOptionById`
  - 先跑删除前组合基线，再删除 `src/games/smashup/__tests__/frankensteinFaq.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/frankensteinFaq.test.ts` -> `2 files / 17 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/frankenstein.test.ts src/games/smashup/__tests__/frankensteinFaq.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> `1 file / 14 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/frankenstein.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\frankensteinFaq.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 28, OK`
- 结果：
  - 弗兰肯斯坦派系现在只剩一个长期测试入口 `abilities/frankenstein.test.ts`
  - 这次不是只删 FAQ 标签；旧 FAQ 入口里的派系行为合同已经真正收回专项

## 2026-05-17 11:51:22 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/steampunk-pod-verification.test.ts`
- 边界判断：
  - 文件虽然很短，但两条测试都不是共享系统合同
  - 它们本质上仍是 `steampunk_ornate_dome` 与 `steampunk_escape_hatch` 的 POD 低层合同
  - `src/games/smashup/__tests__/abilities/steampunks.test.ts` 已经是蒸汽朋克长期专项入口，因此没有继续保留根目录验证壳的理由
- 实施动作：
  - 在 `abilities/steampunks.test.ts` 中为现有专项块补入：
    - `steampunk_ornate_dome_pod should destroy opponent actions but NOT itself`
    - `steampunk_escape_hatch_pod should trigger for owner minions`
  - 补充专项文件 import：
    - `steampunkOrnateDomeOnPlay`
    - `steampunkEscapeHatchTrigger`
  - 先跑删除前组合基线，再删除 `src/games/smashup/__tests__/steampunk-pod-verification.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/steampunk-pod-verification.test.ts` -> `2 files / 36 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts src/games/smashup/__tests__/steampunk-pod-verification.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/steampunks.test.ts` -> `1 file / 34 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/steampunks.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\steampunk-pod-verification.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 28, OK`
- 结果：
  - 蒸汽朋克派系现在只剩一个长期测试入口 `abilities/steampunks.test.ts`
  - 这次不是只删一个短文件；根目录验证壳里的 POD 低层合同已经真正收回专项

## 2026-05-17 11:54:31 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts`
- 边界判断：
  - 文件名已经是历史口径，但内容实际在测 `bear_cavalry_bearing_down_pod`
  - 3 条测试都属于熊骑兵专项自己的 breakpoint 合同
  - `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` 已存在，因此这是一个“历史命名脱节 + 单派系第二入口”的高优先级小壳
- 实施动作：
  - 在 `abilities/bear-cavalry.test.ts` 中新增 `bear_cavalry_bearing_down_pod 动态爆破点修正` 小节
  - 补充 import：
    - `getEffectiveBreakpoint`
  - 先跑删除前组合基线，再删除 `src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts`
- 验证：
  - 删除前组合基线：
    - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `2 files / 35 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts src/games/smashup/__tests__/bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `0 errors / 0 warnings`
  - 删除后专项验证：
    - `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> `1 file / 32 tests passed`
    - `npx eslint src/games/smashup/__tests__/abilities/bear-cavalry.test.ts` -> `0 errors / 0 warnings`
    - `Test-Path src\\games\\smashup\\__tests__\\bearCavalry-youre-screwed-pod-breakpoint.test.ts` -> `False`
    - `npm run test:structure -- --all` -> `checked files: 29, OK`
- 结果：
  - 熊骑兵派系现在只剩一个长期测试入口 `abilities/bear-cavalry.test.ts`
  - 这次不是只删旧文件；历史命名和当前卡牌名脱节的 breakpoint 小壳已经真正收回专项

## 2026-05-17 12:00:43 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts`
- 边界判断：
  - 文件名虽然带 `ongoing`
  - 场景里虽然借用了 `zombie_overrun` 这个跨派系 ongoing 行动
  - 但两条测试真正锁的是 `wizard_neophyte` 自己“额外打出牌库顶行动卡”的行为分支
  - 因此它不是共享 ongoing 机制文件，而是巫师专项的第二入口债
- 实施动作：
  - 在 `src/games/smashup/__tests__/abilities/wizards.test.ts` 中并入：
    - `wizard_neophyte` 打出 `zombie_overrun` 时先选基地
    - `wizard_neophyte` 打出 standard 行动卡时不需要基地选择
  - 为专项文件补充 `getPromptTitle`
  - 删除 `src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts`
- 删除前组合基线：
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` -> `2 files / 28 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts src/games/smashup/__tests__/wizard-neophyte-ongoing.test.ts` -> `0 errors / 0 warnings`
- 迁移中唯一红灯：
  - 第一次单跑 `abilities/wizards.test.ts` 时，两条新并入用例同时报 `ReferenceError: respondToPrompt is not defined`
  - 这不是行为回归，而是专项文件漏接 `respondToPrompt` import
  - 补齐 import 后重新验证恢复全绿
- 删除后专项验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts` -> `1 file / 28 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-neophyte-ongoing.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 29, OK`
- 结果：
  - 巫师派系现在只剩一个长期测试入口 `abilities/wizards.test.ts`
  - 这次不是只删旧名字；旧文件里的“ongoing vs standard action”分支合同已经真正回到学徒专项行为入口

## 2026-05-17 12:04:10 +08:00

- 继续沿“清掉同派系双入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts`
- 边界判断：
  - 文件名虽然带 `display-mode`
  - 但它不是共享 UI 渲染规则文件，而是在补 `cthulhu_chosen_confirm` 这一条已存在于 `abilities/cthulhu.test.ts` 的交互显示合同
  - 因此它本质上是 `cthulhu_chosen beforeScoring` 专项块的第二入口壳
- 实施动作：
  - 直接在 `src/games/smashup/__tests__/abilities/cthulhu.test.ts` 现有 `cthulhu_chosen beforeScoring` 小节中补强：
    - yes/no 选项的 `displayMode: 'button'`
    - option value 不带 `baseDefId`
    - 多实例链式 prompt 中第二个选项的 displayMode 与 playerId
  - 为专项文件补充 `getPromptPlayerId`
  - 删除 `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts`
- 删除前组合基线：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> `2 files / 74 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` -> `0 errors / 0 warnings`
- 删除后专项验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `1 file / 71 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/cthulhu.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\cthulhu-chosen-display-mode.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 29, OK`
- 结果：
  - `cthulhu_chosen` 的行为合同和显示合同现在都收在 `abilities/cthulhu.test.ts`
  - 这次不是只删 UI bug 文件名；原来分散在根目录的选项显示约束已经真正回到同一个 sourceId 专项块

## 2026-05-17 12:12:00 +08:00

- 继续清理根目录历史壳，这轮处理的是：
  - `src/games/smashup/__tests__/wizard-archmage-discard-play.test.ts`
- 边界判断：
  - 这份文件不适合并回 `abilities/wizards.test.ts`
  - 它的“从弃牌堆打出大法师”场景不是走真实现行业务链，而是测试里临时注册了一个 `test_archmage_discard_play` provider，再配合自建 `GameTestRunner` 壳去喂 `fromDiscard: true`
  - 另一方面，文件里两条业务语义都已被真实链路覆盖：
    - `wizard-archmage-zombie-interaction.test.ts`：真实 `zombie_they_keep_coming` 从弃牌堆打出大法师
    - `archmageE2E.test.ts`：从手牌打出大法师当回合仍获得额外行动
- 实施动作：
  - 直接删除 `src/games/smashup/__tests__/wizard-archmage-discard-play.test.ts`
  - 不把临时 provider 壳机械并回任何专项文件
- 验证与阻塞：
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-archmage-discard-play.test.ts` -> `False`
  - `npx eslint src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts src/games/smashup/__tests__/archmageE2E.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 30, OK`
  - 试图对 `wizard-archmage-discard-play.test.ts + wizard-archmage-zombie-interaction.test.ts + archmageE2E.test.ts` 做组合 `vitest` 基线时，环境因剩余物理内存仅约 `1.23 GB` 发生 Node / PowerShell OOM；已记录为环境验证阻塞，不视为代码红灯
- 结果：
  - 大法师相关的真实业务覆盖继续保留在现行链路文件里
  - 临时 provider 壳已退场，避免后续继续维护一份不走真实入口的测试资产

## 2026-05-17 12:13:10 +08:00

- 继续沿“把真实业务回归收回专项入口”推进，这轮处理的是：
  - `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`
- 边界判断：
  - 这条测试走的不是测试专用 provider 壳，而是真实 `zombie_they_keep_coming -> prompt -> 从弃牌堆打出随从` 链路
  - 但它真正验证的业务不变量是 `wizard_archmage` 在 `MINION_PLAYED` 后授予额外行动
  - 因此更适合并回 `src/games/smashup/__tests__/abilities/wizards.test.ts` 的 `wizard_archmage` 专项块
- 实施动作：
  - 在 `wizards.test.ts` 的 `wizard_archmage ongoing 时机` 小节中新增：
    - “通过 `zombie_they_keep_coming` 从弃牌堆打出时，仍应按 `onMinionPlayed` 授予额外行动”
  - 为专项文件补充：
    - `getPromptOption`
    - `respondToPromptWithMergedValue`
  - 删除 `src/games/smashup/__tests__/wizard-archmage-zombie-interaction.test.ts`
- 验证：
  - `npx eslint src/games/smashup/__tests__/abilities/wizards.test.ts` -> `0 errors / 0 warnings`
  - `npx vitest run src/games/smashup/__tests__/abilities/wizards.test.ts` -> `1 file / 29 tests passed`
  - `Test-Path src\\games\\smashup\\__tests__\\wizard-archmage-zombie-interaction.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 30, OK`
- 结果：
  - `wizard_archmage` 的 ongoing 时机合同和跨派系真实打出链路合同现在都回到 `wizards.test.ts`
  - 根目录大法师交互 bug 壳进一步退场，只保留现行专项入口

## 2026-05-17 12:19:31 +08:00

- 继续沿“同派系 POD 旧入口并回专项”推进，这轮处理的是：
  - `src/games/smashup/__tests__/killer-plant-pod-verification.test.ts`
- 边界判断：
  - 这份不是共享 verification 机制文件
  - 文件里的主体仍是杀人植物 POD 自己的行为和时序合同
  - 但它也不是纯机械小壳，因为其中有一批专项文件当前还没有承接的 POD 回归
- 实施动作：
  - 把专项里已存在等价覆盖的 `killer_plant_overgrowth_pod` 降爆破点等内容留在原位，不重复复制
  - 将下列尚未承接的 POD 合同并入 `src/games/smashup/__tests__/abilities/killer-plants.test.ts`：
    - POD 牌表数量：`sleep_spores_pod` / `budding_pod`
    - `weed_eater_pod` POD 卡面与回合开始增益
    - `sprout_pod` 被 `General Ivan POD` 保护后继续检索
    - `playCards` 阶段不回补 `sprout_pod` 的 `startTurn` 触发
    - `sprout_pod -> water_lily_pod` 同窗口立即抽牌
    - `sprout_pod` 链式触发保持 `startTurn` 直到结束
    - 爆破点 0 时只结算一次 `BASE_SCORED`
  - 删除 `src/games/smashup/__tests__/killer-plant-pod-verification.test.ts`
- 删除前组合基线：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` -> `2 files / 48 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/killer-plant-pod-verification.test.ts` -> `0 errors / 0 warnings`
- 迁移中出现的红灯与处理：
  - 第一次单跑 `killer-plants.test.ts` 出现 3 条红灯
  - 根因不是实现回归，而是本文件已有 `beforeEach` 只重注册 `registerKillerPlantAbilities()`，把新加 POD 段带进了半初始化状态
  - 为 `killer_plants POD 数据与特殊回归` 新增独立 `beforeEach`，完整执行：
    - `clearRegistry`
    - `clearBaseAbilityRegistry`
    - `clearPowerModifierRegistry`
    - `clearOngoingEffectRegistry`
    - `clearInteractionHandlers`
    - `resetAbilityInit`
    - `initAllAbilities`
  - 补完后红灯全部消失
- 删除后专项验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/killer-plants.test.ts` -> `1 file / 47 tests passed`
  - `npx eslint src/games/smashup/__tests__/abilities/killer-plants.test.ts` -> `0 errors / 0 warnings`
  - `Test-Path src\\games\\smashup\\__tests__\\killer-plant-pod-verification.test.ts` -> `False`
  - `npm run test:structure -- --all` -> `checked files: 31, OK`
- 结果：
  - 杀人植物派系现在由 `abilities/killer-plants.test.ts` 统一承接普通版 + POD 版 + startTurn 链式特殊回归
  - 根目录 verification 壳退场，但旧文件里真正有价值的 POD 合同没有丢

## 2026-05-17 14:08 继续拆 `expansionBaseAbilities.test.ts`

- 本轮不是改文件名，而是继续把自然边界从大壳中抽出来：
  - `src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts`
  - `src/games/smashup/__tests__/bases/al9000-bases.test.ts`
- 已完成动作：
  - 把 `base_mountains_of_madness` 从 `expansionBaseAbilities.test.ts` 并回现有 `mountains-of-madness-base.test.ts`，补齐 Trade 场景下“疯狂卡归随从拥有者”的合同
  - 新建 `bases/al9000-bases.test.ts`，承接 `base_greenhouse` / `base_secret_garden` / `base_inventors_salon`
  - 从 `expansionBaseAbilities.test.ts` 删掉整段 AL9000 测试，避免新旧双入口并存
- 本轮验证：
  - `npx vitest run src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/al9000-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `3 files / 46 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/al9000-bases.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 55, OK`

## 2026-05-17 14:45 补充：继续按自然边界收缩基地测试

- 已修复 `src/games/smashup/__tests__/bases/move-minion-bases.test.ts` 的 `makeBase` 调用合同：第二参对象写法改为 `makeBase({ defId, minions })`，6 条用例通过。
- 已新增 `src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts`，承接 `base_plateau_of_leng` 的即时分支与同名随从额度合同，6 条用例通过。
- 已在 `src/games/smashup/__tests__/abilities/fairies.test.ts` 吸收 `base_fairy_ring` 的非首次打出回归；`expansionBaseAbilities.test.ts` 中对应重复段已删除。
- 验证：`npx vitest run src/games/smashup/__tests__/bases/move-minion-bases.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts src/games/smashup/__tests__/abilities/fairies.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts` -> `4 files / 45 tests passed`，`npm run test:structure -- --all` -> `checked files: 60, OK`。

## 2026-05-17 14:53 继续收口：`expansionBaseAbilities.test.ts` 退场

- 已新增 `src/games/smashup/__tests__/bases/the-asylum-base.test.ts`
- 已新增 `src/games/smashup/__tests__/bases/innsmouth-base.test.ts`
- 已新增 `src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts`
- 已删除 `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
- 现阶段基地合同已分散到：
  - `bases/the-asylum-base.test.ts`
  - `bases/innsmouth-base.test.ts`
  - `bases/mountains-of-madness-base.test.ts`
  - `bases/miskatonic-university-base.test.ts`
  - `bases/plateau-of-leng-base.test.ts`
- 验证：
  - `npx vitest run src/games/smashup/__tests__/bases/the-asylum-base.test.ts src/games/smashup/__tests__/bases/innsmouth-base.test.ts src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts` -> `5 files / 19 tests passed`
  - `npx eslint src/games/smashup/__tests__/bases/the-asylum-base.test.ts src/games/smashup/__tests__/bases/innsmouth-base.test.ts src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts src/games/smashup/__tests__/bases/mountains-of-madness-base.test.ts src/games/smashup/__tests__/bases/plateau-of-leng-base.test.ts` -> `0 errors / 0 warnings`
  - `npm run test:structure -- --all` -> `checked files: 62, OK`

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Monkey See, Monkey Do 空选 / 无行动自动分支补 scoped L3

- 本轮目标只收紧 `cyborg_apes_monkey_see_monkey_do.reveal_top_five_and_choose_actions` 的旧 residual，不扩散到别的对象：
  - `0 张选择` 真实浏览器链
  - `顶五没有行动` 的真实自动分支
- 已完成动作：
  - 在 `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\e2e\smashup-yuanhou-factions.e2e.ts` 新增两条 E2E：
    - `电子猿-Monkey See Monkey Do-真实入口空选行动后应直接收口且不把任何展示行动加入手牌`
    - `电子猿-Monkey See Monkey Do-展示顶五没有行动时真实入口不创建选择 prompt并进入展示队列`
  - 将 `dismissSmashUpSpotlightQueueIfVisible()` 从“只点一次”改成最多循环点击 8 次后再断言隐藏，避免 spotlight 队列残留把后续点击挡住
  - 实际打开并核对 4 张关键截图，确认：
    - 空选分支里 `确认` 可在 0 勾选时直接点击
    - 空选收口后没有任何展示行动进入手牌
    - 无行动自动分支不创建 `cyborg_apes_monkey_see_monkey_do_choose` prompt
    - 但真实 UI 会进入公开展示队列/spotlight overlay，不能误写成“完全无浮层自动收口”
- 本轮验证：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 NODE_OPTIONS=--max-old-space-size=8192 PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4284 PW_PORT=4284 PW_E2E_GAME_SERVER_PORT=20310 PW_GAME_SERVER_PORT=20310 GAME_SERVER_PORT=20310 PW_E2E_API_SERVER_PORT=21310 PW_API_SERVER_PORT=21310 API_SERVER_PORT=21310 PW_RUNTIME_SCOPE=smashup-yuanhou-monkey-see-branches BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "电子猿-Monkey See Monkey Do-真实入口空选行动后应直接收口且不把任何展示行动加入手牌|电子猿-Monkey See Monkey Do-展示顶五没有行动时真实入口不创建选择 prompt并进入展示队列"` -> `2 passed`
- 结果：
  - `Monkey See, Monkey Do` 的浏览器 scoped L3 已不再只停在“有行动候选时选 1 张”
  - 当前本地浏览器证据已覆盖：
    - 有行动候选的真实多选分支
    - `0` 张选择直接确认分支
    - 无行动自动分支的“无选择 prompt + 进入展示队列”分支
  - 剩余 residual 只保留重复 uid 与 forged late-deck payload，这两条继续由 L2/shared contract 守门

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Portal Room extra-turn queue shared 边界补 L2

- 本轮目标不再新增 Portal Room 浏览器链，只收紧 `base_portal_room.queue_extra_turn_after_current_turn` 的 shared extra-turn queue 边界：
  - 3 人顺位下 `returnToPlayerIndex` 是否会回到原本下一位玩家
  - 多条 `pendingExtraTurns` 并存时是否按队列顺序消费
- 已完成动作：
  - 在 `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\src\games\smashup\__tests__\yuanhouFactionAbilities.test.ts` 新增两条 Portal Room 定向 L2：
    - `时间旅行者基地：传送门室在三人顺位下应于额外回合结束后回到原本下一位玩家`
    - `时间旅行者基地：传送门室存在多条待执行额外回合时应按队列顺序消费`
  - 同步回写 `evidence/smashup/smashup-in-progress-effect-atom-audit-2026-05-15.md`：
    - atom 行补明 3P `returnToPlayerIndex` 与多队列 FIFO 已锁定
    - 对象行补明这两条不再作为隐性 residual
    - 新增 finding #134，明确这是 shared/L2 收紧，不冒充新的浏览器 scoped L3
- 本轮验证：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "传送门室|Portal Room"` -> `5 passed`
- 结果：
  - `Portal Room` 现在不再只靠 2P 主链证明 extra turn queue 正确
  - 更长 turnOrder 的原顺位返回，以及多 `pendingExtraTurns` 的 FIFO 消费，已经有明确 L2 锚点
  - 浏览器 scoped L3 口径保持不变：仍只认 2P `winner=currentPlayer` 单页接受并走完整个额外回合，以及 `winner!=currentPlayer` 多客户端选择权归属
- 2026-05-18：
  - 为 `Missing Uplink` 追加“额外回合结束仍按拥有者实例数抽牌” L2 回归：`电子猿：丢失中继在额外回合结束时也应按拥有者实例数抽牌`
  - 定向验证 `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "丢失中继|Missing Uplink"` -> `6 passed`
  - 审计口径已回写到 `evidence/smashup/smashup-in-progress-effect-atom-audit-2026-05-15.md`，额外回合结束不再算 Missing Uplink residual

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Monkey on Your Back 敌方宿主附着入口补 scoped L3

- 本轮目标只收紧 `cyborg_apes_monkey_on_your_back.attach_to_any_minion`，不重复天赋 destroy/bottom 链：
  - 旧对象级 scoped L3 只证明了附着后的天赋选择链
  - 但“本行动可附着任意随从”本身还缺真实手牌入口能贴到敌方宿主的浏览器证据
- 已完成动作：
  - 在 `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\e2e\smashup-yuanhou-factions.e2e.ts` 新增 E2E：
    - `电子猿-Monkey on Your Back-真实入口可附着到敌方随从`
  - 复用隔离端口组 `4274 / 20210 / 21210` 定向复跑并通过：
    - `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-yuanhou-monkey-back-attach-enemy BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "电子猿-Monkey on Your Back-真实入口可附着到敌方随从"` -> `1 passed`
  - 已实际打开并核对两张关键截图：
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实入口可附着到敌方随从\yuanhou-monkey-on-your-back-enemy-host-before-attach.png`
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实入口可附着到敌方随从\yuanhou-monkey-on-your-back-attached-to-enemy-host.png`
- 本轮肉眼验收结论：
  - `before` 图同屏可见左侧己方 `Jumper`、右侧敌方宿主和底部手牌里的 `Monkey on Your Back`
  - `after` 图右侧敌方宿主出现紫色附着图标且力量 `2 -> 3`，左侧己方 `Jumper` 仍是 `2` 且无附着图标
  - 配合状态断言 `interaction.current==null`、`P0 hand` 不含 `monkey-attach-hand`、敌方宿主 `attachedActions` 含该 uid、己方宿主不含该 uid，可确认真实入口确实把本行动附着到敌方宿主
- 结果：
  - `cyborg_apes_monkey_on_your_back.attach_to_any_minion` 已从纯 `L2` 提升到 `L2 / scoped L3`
  - `cyborg_apes_monkey_on_your_back` 对象级说明已补明：现在同时具备“敌方宿主附着入口”与“附着后天赋 destroy/bottom 链”的 scoped L3
  - 当前仍不外推宿主离场、多客户端视角或 forged target payload

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Cyberback 负例真实入口补 scoped L3

- 本轮目标是收紧 `cyborg_apes_cyberback` 里之前仍停在纯 `L2` 的两条负例：
  - `reject_non_ongoing_or_non_minion_action`
  - `reject_enemy_or_non_cyberback_target`
- 已完成动作：
  - 在 `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\e2e\smashup-yuanhou-factions.e2e.ts` 新增 E2E：
    - `电子猿 Cyberback 真实入口会隐藏非法弃牌并拒绝非法宿主点击`
  - 使用隔离端口组 `4274 / 20210 / 21210` 定向复跑并通过：
    - `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-yuanhou-cyberback-negative BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "电子猿 Cyberback 真实入口会隐藏非法弃牌并拒绝非法宿主点击"` -> `1 passed`
  - 已实际打开并核对三张关键截图：
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-真实入口会隐藏非法弃牌并拒绝非法宿主点击\yuanhou-cyberback-discard-panel-shows-valid-and-invalid-actions.png`
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-真实入口会隐藏非法弃牌并拒绝非法宿主点击\yuanhou-cyberback-only-own-cyberback-should-be-valid-target.png`
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-真实入口会隐藏非法弃牌并拒绝非法宿主点击\yuanhou-cyberback-invalid-targets-rejected-and-own-cyberback-attached.png`
- 本轮肉眼验收结论：
  - 第一张图证明真实弃牌面板会同时显示 `Going Bananas` 与 `Cyberevolution`，因此旧口径“非法牌不会出现在 UI 中”是错的
  - 第二张图里选中 `Cyberevolution` 后，只有己方 `Cyberback` 所在的 `Monkey Lab` 保持高亮，另外两座基地都被置灰
  - 第三张图里最终只有左侧己方 `Cyberback` 获得 `Cyberevolution` 附着和绿色 `+4`，己方普通随从与敌方 `Cyberback` 都没有被附着
  - 配合状态断言可确认：点击 `Going Bananas` 后服务端权威状态完全不变；选中 `Cyberevolution` 后点击敌方 `Cyberback` / 己方普通随从也不结算，直到点击己方 `Cyberback` 才真正附着
- 结果：
  - `cyborg_apes_cyberback.reject_non_ongoing_or_non_minion_action` 与 `reject_enemy_or_non_cyberback_target` 都已从纯 `L2` 提升到 `L2 / scoped L3`
  - `cyborg_apes_cyberback` 对象级说明已补明：正向附着链与两条本地浏览器负例现在都已有 scoped L3
  - 当前只继续把 forged discard / forged target payload 留在 L2/shared contract

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Baboom 真实分支证据补齐到长期状态

- 本轮目标不是再改 `Baboom` 实现，而是把已经闭合的浏览器分支证据同步到长期状态，避免后续误以为它还只停在最早那条“唯一合法行动自动附着”的 scoped L3。
- 已确认的现状：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\evidence\smashup\smashup-in-progress-effect-atom-audit-2026-05-15.md` 里的 atom/object 行已经写明：
    - 显式 `skip` 会直接收口
    - 多张合法行动时可以真实选择第二张，并且只执行所选项
  - 但根仓库 `progress.md / findings.md` 与 long-term state 先前还只记到最早那条 `电子猿-Baboom-真实天赋给出可跳过的立即额外行动并只能打到自己身上`
- 已复用并同步的已验证证据：
  - `电子猿-Baboom-真实点击跳过额外行动后应直接收口且不强制打出任何行动`
  - `电子猿-Baboom-真实入口有多张合法额外行动时应允许选择第二张并只打出所选行动`
  - 其中多合法行动分支本轮再次用隔离端口 `4274 / 20210 / 21210` 定向复跑并通过：
    - `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-yuanhou-baboom-multi-refresh BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "电子猿-Baboom-真实入口有多张合法额外行动时应允许选择第二张并只打出所选行动"` -> `1 passed`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Baboom-真实入口有多张合法额外行动时应允许选择第二张并只打出所选行动\yuanhou-baboom-multi-action-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Baboom-真实入口有多张合法额外行动时应允许选择第二张并只打出所选行动\yuanhou-baboom-multi-action-second-selected.png`
- 本轮肉眼验收结论：
  - prompt 图里顶部确实是 `立刻打出一张额外战术，或放弃这次机会`，底部 `Cyberevolution / Juiced Up` 两张合法候选同屏可见，且 `Juiced Up` 已被真实选中
  - resolved 图里中央是带“已打出！”标记的 `Juiced Up`，Baboom 旁出现紫色附着图标和绿色 `+3`，底部 `Cyberevolution` 仍留在手牌区
  - 配合状态断言，能确认多合法候选分支不会后台默认第一张，只会执行玩家真实选择的第二张；而 `skip` 分支也已经在既有证据里闭合为“直接收口且不强制打出任何行动”
- 结果：
  - `cyborg_apes_baboom.grant_immediate_extra_action_on_self` 的长期状态口径已补齐到当前真实边界：`skip`、单合法自动附着、以及多合法行动选择第二张三条浏览器分支都已闭合
  - `cyborg_apes_baboom` 当前 residual 只剩审计文档里已经写明的多 `Baboom`、多 target prompt 与多客户端视角，不应再把它误记成“只覆盖最早那条单合法行动分支”

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Baboom twin 身份分支补到 scoped L3

- 本轮继续收紧 `cyborg_apes_baboom.grant_immediate_extra_action_on_self` 的 twin 身份边界：
  - 同基地存在另一只同名 `Baboom` 时，额外行动必须只附着到发动天赋的那一只
- 已完成动作：
  - 复跑既有真实入口 E2E：
    - `电子猿-Baboom-同基地两只 Baboom 时真实入口应只把额外行动附着到发动天赋的那一只`
  - 使用隔离端口组 `4274 / 20210 / 21210` 定向复跑并通过：
    - `PW_WORKERS=1 PW_USE_DEV_SERVERS=false PW_E2E_FRONTEND_PORT=4274 PW_PORT=4274 PW_E2E_GAME_SERVER_PORT=20210 PW_GAME_SERVER_PORT=20210 GAME_SERVER_PORT=20210 PW_E2E_API_SERVER_PORT=21210 PW_API_SERVER_PORT=21210 API_SERVER_PORT=21210 PW_RUNTIME_SCOPE=smashup-yuanhou-baboom-twin BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=300000 npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "电子猿-Baboom-同基地两只 Baboom 时真实入口应只把额外行动附着到发动天赋的那一只"` -> `1 passed`
  - 已实际打开并核对两张关键截图：
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Baboom-同基地两只-Baboom-时真实入口应只把额外行动附着到发动天赋的那一只\yuanhou-baboom-twin-before-attach.png`
    - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Baboom-同基地两只-Baboom-时真实入口应只把额外行动附着到发动天赋的那一只\yuanhou-baboom-twin-attached-to-source-only.png`
- 本轮肉眼验收结论：
  - 第一张图里同一基地两只 `Baboom` 同屏可见，下方这只带高亮和“已用”标记，说明当前 prompt 绑定的是具体 source 宿主，不是模糊地“任意一只 Baboom”
  - 第二张图里只有下方发动天赋的 `Baboom` 旁出现紫色附着图标和绿色 `+4`；上方另一只同名 `Baboom` 没有附着图标
  - 配合状态断言 `baboom-twin-source.attachedActions=['baboom-twin-boost-hand']`、`baboom-twin-other.attachedActions=[]`，可确认 twin 分支不会串到另一只同名 Baboom
- 结果：
  - `cyborg_apes_baboom.grant_immediate_extra_action_on_self` 的“多 Baboom 身份分支”已从 residual 提升到 `L2 / scoped L3`
  - `cyborg_apes_baboom` 当前只继续保留多 target prompt 与多客户端视角，不再把“多 Baboom”继续挂作 residual

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Baboom 多客户端 prompt 归属同步到根状态

- 本轮继续做 completion-audit 式补齐，不改 `Baboom` 实现，只把 evidence 已闭合的“prompt 只在发动者页面出现，skip 后两页一起收口”这条多客户端对象级主链同步到根状态。
- 已重新核对的既有浏览器证据：
  - `电子猿-Baboom-真实多客户端下额外行动 prompt 应只出现在发动者页面`
- 本轮实际同步的关键真相：
  - `cyborg_apes_baboom.grant_immediate_extra_action_on_self` 不应再只停在 `skip`、多合法行动第二张选择、以及 twin 身份不串台这三条单页浏览器分支；多客户端下这条链也已经证明：
    - 只有发动者页面会出现 `立刻打出一张额外战术，或放弃这次机会` prompt、合法候选卡面与 `放弃这次额外战术` 按钮；
    - 非发动者页面不会被错误拉进同一条 `smashup_immediate_extra_action` prompt，也没有 waiting overlay；
    - 发动者点击 skip 后，Host/Guest 两页都会一起收口，权威状态不会偷偷把任何行动附着到 `Baboom` 或同基地其他随从。
- 结果：
  - `cyborg_apes_baboom.grant_immediate_extra_action_on_self` 的根状态现在应显式承认：
    - 单合法自动附着；
    - 显式 skip 收口；
    - 多合法行动选择第二张；
    - twin 身份不串台；
    - 多客户端下 prompt 只归属发动者页面并在 skip 后双页收口。
  - 后续队列不应再把 `Baboom` 误记成“当前 residual 还剩多客户端视角”；当前对象本地 residual 已清空，只继续保留更广多人局 transport/shared 边界作为全局层面的非本对象承诺。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Copycat 复制 Jumper 的 discard trigger 证据同步到长期状态

- 本轮目标不是再改 `Copycat` 实现，而是把审计文档里已经闭合的 `trigger-surface scoped L3` 同步到根状态文件，避免后续还按“只验证过 talent/power surface”理解它。
- 已确认的现状：
  - 审计文档已经写明 `shapeshifters_copycat.proxy_current_supported_surfaces` 现已覆盖：
    - `Baboom` talent surface
    - `Furious George` power surface
    - `Jumper` discard trigger surface
  - 但根 `progress.md / findings.md` 与 long-term state 还没有把 `Copycat -> Jumper optional recover` 这条真实浏览器链补成显式事实
- 已复用并同步的已验证证据：
  - `变形者-Copycat-真实复制 Jumper 后被 Bacta 摧毁时应先给额外随从再给 optional recover 回手`
  - 审计文档里对应的 L2 + E2E 命令、状态断言与三张关键截图都已存在，本轮只做长期状态回写，不重复改实现
- 本轮同步的关键真相：
  - `Copycat` 复制 `Jumper` 后被 `Bacta` 摧毁时，真实顺序是先出现 `Bacta immediate extra minion`，再进入 `Copycat` 代理出来的 `optional recover` 反应窗口
  - 最终 `Copycat` 会回到 owner 手牌，且不会把额外随从机会、原生 `Jumper` 的 owner/controller 语义或其它已闭合 surface 带歪
- 结果：
  - `shapeshifters_copycat.proxy_current_supported_surfaces` 的 `trigger-surface` 已明确同步到根长期状态
  - 后续不应再把 `Copycat` 误记成“只审过 choose/metadata/talent/power，discard trigger 仍待补”

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Do Over / Doctor When skip-extra 与 Time Box discard-recover 边界同步到根状态

- 本轮不新增实现或测试，只把审计文档里已闭合、且本轮重新看图确认过的两组时间旅行者边界回写到根状态，避免后续重复审同一条浏览器链。
- 已重新核对的既有浏览器证据：
  - `时间旅行者-Do-Over-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌`
  - `时间旅行者-Doctor-When-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌`
  - `时间旅行者-Time-Box-真实多客户端下-Jumper-从弃牌堆回-owner-手牌后应由-owner-页面获得第5枚计数进场选择`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-time-travelers-specific-extra.e2e\时间旅行者-Do-Over-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌\yuanhou-do-over-skip-extra-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-time-travelers-specific-extra.e2e\时间旅行者-Doctor-When-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌\yuanhou-doctor-when-skip-extra-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Time-Box-真实多客户端下-Jumper-从弃牌堆回-owner-手牌后应由-owner-页面获得第5枚计数进场选择\yuanhou-time-box-play-prompt-after-jumper-recover-host.png`
- 本轮肉眼验收结论：
  - `Do Over skip-extra` 收口图里 `Portal Room` 仍为空，returned `Jumper` 继续留在手牌，说明点击“放弃这次额外随从”后没有被误自动打回基地。
  - `Doctor When skip-extra` 收口图里场上只剩 `Doctor When`，returned `Time Raider` 继续留在手牌，而且中央已没有残留 extra prompt。
  - `Time Box discard-recover` 多客户端图里 owner 页中央直接出现 `时间盒子：是否移除全部计数器并打出到一个基地？`，左下仍能看到 setaside 的 `Time Box`，说明 `Bacta -> stolen Jumper recover -> owner 页第 5 枚计数 prompt` 真链已闭合到正确页面。
- 结果：
  - `time_travelers_do_over.may_play_returned_minion_again` 与 `time_travelers_doctor_when.may_play_returned_minion_again` 不应再被误记成“只验证过 specific returned card 会回手/会重打”；它们的 `skip extra` 真实收口分支也已在浏览器 scoped L3 闭合。
  - `time_travelers_time_box.counter_from_card_returned_to_hand` 不应再只靠 `Primate Park -> CARD_TRANSFERRED from play` 那条本地链代表全部浏览器证据；`discard -> owner hand` 的 owner/controller split 多客户端链也已补到 scoped L3。
  - 后续队列不应再重复把 `Do Over / Doctor When skip-extra` 与 `Time Box discard-recover owner/controller split` 当成本地 residual 回头再审。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：From Q With Love 短候选与空投影手牌边界同步到根状态

- 本轮继续补“evidence 已闭合、根状态还没跟上”的对象，不改 `From Q With Love` 实现，只把 2026-05-18 新增的两条浏览器端点同步到根状态。
- 已重新核对的既有浏览器证据：
  - `超级间谍-From Q With Love-短牌库时真实入口只要求弃掉唯一剩余投影手牌`
  - `超级间谍-From Q With Love-投影手牌为空时真实入口不应创建弃牌 prompt`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-From-Q-With-Love-短牌库时真实入口只要求弃掉唯一剩余投影手牌\yuanhou-from-q-with-love-short-deck-single-discard-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-From-Q-With-Love-短牌库时真实入口只要求弃掉唯一剩余投影手牌\yuanhou-from-q-with-love-short-deck-single-discard-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-From-Q-With-Love-投影手牌为空时真实入口不应创建弃牌-prompt\yuanhou-from-q-with-love-empty-projected-resolved.png`
- 本轮肉眼验收结论：
  - 短候选 prompt 图里中央只剩 1 张可弃候选卡，右下仍能看到本牌 `From Q With Love` 本体，说明真实入口没有把 discard prompt 错保留成“还要再弃两张”。
  - 短候选 resolved 图里中央 prompt 已完全消失，右下弃牌堆角标变成 `弃牌(2)`，说明唯一剩余投影手牌被真实弃掉后直接收口。
  - 空投影手牌 resolved 图里中央没有任何 discard prompt、按钮或候选卡，右下弃牌堆角标为 `弃牌(1)`，说明没有剩余投影手牌时不会创建空选择窗，而是本行动自己正常进弃牌堆。
- 结果：
  - `super_spies_from_q_with_love.draw_three_then_discard_two_from_projected_hand` 不应再只被根状态描述成“exact-2 的主链已绿”；`projectedHand.length===1` 与 `projectedHand.length===0` 两个浏览器端点也都已闭合。
  - 后续队列不应再把 `From Q With Love` 的短候选或空投影手牌本地浏览器边界挂回 residual；只剩 forged late-hand 或更广多客户端/inspect 共享边界继续由 L2/shared contract 承接。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Flying Monkey skip 与 Portal Room 生命周期边界同步到根状态

- 本轮继续补“审计文档已闭合、根状态还停在旧口径”的两条链：
  - `Flying Monkey` 旧根状态还把 `skip` 继续挂在 residual。
  - `Portal Room` 旧根状态虽然记了“额外回合能启动”，但还没把“额外回合结束后回到原顺位玩家”写进根状态。
- 已重新核对的既有浏览器证据：
  - `电子猿-Flying Monkey-真实计分后跳过移动时应按正常计分清场进入弃牌堆`
  - `时间旅行者-Portal Room-真实计分后赢家接受额外回合并在结束后恢复到原顺位玩家`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Flying-Monkey-真实计分后跳过移动时应按正常计分清场进入弃牌堆\yuanhou-flying-monkey-skip-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Flying-Monkey-真实计分后跳过移动时应按正常计分清场进入弃牌堆\yuanhou-flying-monkey-skipped-and-discarded.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Portal-Room-真实计分后赢家接受额外回合并在结束后恢复到原顺位玩家\yuanhou-portal-room-extra-turn-started-after-current-turn.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Portal-Room-真实计分后赢家接受额外回合并在结束后恢复到原顺位玩家\yuanhou-portal-room-extra-turn-finished-returned-to-next-player.png`
- 本轮肉眼验收结论：
  - `Flying Monkey skip` prompt 图里中央能直接看到 `飞猴：选择要移动到的另一基地`、合法目的地 `秘密火山总部` 和 `跳过（照常进入弃牌堆）` 按钮，说明这条 skip 分支来自真实 afterScoring 入口。
  - `Flying Monkey skip` 收口图里中央已没有残留 prompt，`Portal Room / Secret Volcano Headquarters` 都回到新回合常态布局；虽然右下弃牌堆角标为 `弃牌(0)`，但结合状态断言可确认这是 draw 后 reshuffle 结果，不是宿主或本行动留场。
  - `Portal Room` 启动图左上已经切到 `回合2 / 出牌阶段`，说明当前回合结束后 extra turn 已真实启动。
  - `Portal Room` 最终图里当前玩家高亮已切回原顺位玩家，中央没有残留 prompt，左侧仍是 `Faceless City`，说明这条链不只“起了额外回合”，还真实走完并回到了原本顺位。
- 结果：
  - `cyborg_apes_flying_monkey.after_scoring_move_instead_discard` 与 `destroy_attached_action_after_move` 不应再把 `skip` 继续挂成根状态 residual；move/skip 两条本地浏览器链都已 scoped L3。
  - `base_portal_room.queue_extra_turn_after_current_turn` 不应再只被根状态描述成“接受后会启动额外回合”；`pending -> active -> completed -> returnToPlayerIndex` 的浏览器生命周期也已闭合。
  - 后续队列不应再重复把 `Flying Monkey skip` 或 `Portal Room 2P 生命周期走到底` 当成本地缺口回头再审；更长 turnOrder、多 pending queue 等边界仍按 shared/L2 口径看待。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Portal Room 赢家页独占选择权同步到根状态

- 本轮继续做 completion-audit 式补齐，不改 `base_portal_room` 实现，只把 `optional_choice_owner_is_winner` 这条已经在审计文档与长期 JSON 闭合的多客户端对象级主链，显式同步回根状态。
- 已重新对齐并承认的现成证据：
  - `时间旅行者-Portal Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权`
- 结果：
  - `base_portal_room.optional_choice_owner_is_winner` 的根状态不应再只停在“P0 赢家单页可点传送门”或“shared queue/afterScoring owner 合同已修”；当前对象级真相已经同时承认：
    - `winner != currentPlayer` 时，只有赢家页面会出现 `传送门 / 跳过` 选择与可交互的 `传送门` 按钮；
    - 当前回合玩家页面只会显示等待赢家响应，不会错误拿到同一条 afterScoring 选择权，也不会因为点击同基地而偷消费这条选择；
    - 这条“谁来响应”的真实浏览器归属链，与后续 `pending -> active -> completed -> returnToPlayerIndex` 的额外回合生命周期，是 `Portal Room` 两条独立但都已闭合的对象级事实。
  - 后续队列不应再把 `Portal Room winner!=currentPlayer` 的赢家页归属，误记成只有长期 JSON/evidence 留档、根状态仍未承认的缺口；当前 residual 只继续保留多人房间、更广 transport 恢复态与 shared queue 外层边界。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Into the Time Slip 的 in-play card family 扩展同步到根状态

- 本轮继续补根状态落后于审计文档的对象：`Into the Time Slip` 在 long-term state 里还停在“borrowed minion 回 owner hand”的早期 scoped L3，但审计文档已经补到了 base ongoing 与 attached action 两类场上行动牌。
- 已重新核对的既有浏览器证据：
  - `时间旅行者-Into the Time Slip-真实入口可选择场上的持续行动并回到其拥有者手牌`
  - `时间旅行者-Into the Time Slip-真实入口可选择附着行动并回到其拥有者手牌`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Into-the-Time-Slip-真实入口可选择场上的持续行动并回到其拥有者手牌\yuanhou-into-the-time-slip-ongoing-action-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Into-the-Time-Slip-真实入口可选择场上的持续行动并回到其拥有者手牌\yuanhou-into-the-time-slip-ongoing-action-returned-to-owner-hand.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Into-the-Time-Slip-真实入口可选择附着行动并回到其拥有者手牌\yuanhou-into-the-time-slip-attached-action-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Into-the-Time-Slip-真实入口可选择附着行动并回到其拥有者手牌\yuanhou-into-the-time-slip-attached-action-returned-to-owner-hand.png`
- 本轮肉眼验收结论：
  - ongoing-action prompt 图里 `Portal Room` 上方能直接看到场上的 `Stasis Field` 本体，说明真实入口没有把 base ongoing 行动漏出 `a card in play` 候选。
  - ongoing-action 收口图里 `Stasis Field` 已完全消失，中央也没有残留 prompt，说明这张场上持续行动牌已经真实离场并收口。
  - attached-action prompt 图里宿主 `Jumper` 身上仍明确挂着一张带紫色附着角标的行动牌，说明真实入口同样覆盖到了 attached action family。
  - attached-action 收口图里宿主上的白色行动牌本体与紫色角标都已消失，中央无残留 prompt，说明附着行动已从宿主身上真实摘下并完成收口。
- 结果：
  - `time_travelers_into_the_time_slip.choose_one_in_play_card` 与 `return_to_owner_hand` 不应再只被根状态描述成“borrowed minion 的 owner/controller 分离已绿”；base ongoing 与 attached action 两类 in-play card family 也都已补到浏览器 scoped L3。
  - 后续队列不应再把 `Into the Time Slip` 的 base ongoing / attached action 本地浏览器边界挂回 residual；只剩更多多客户端视角或更广 shared transport 边界继续留在 L2/shared contract。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：1.21 Gigawatts 空弃牌堆 feedback 边界同步到根状态

- 本轮继续补根状态落后于审计文档的时间旅行者对象：`1.21 Gigawatts` 在 long-term state 里已经同步了双按钮主链和单一牌种自动分支，但还没把“空弃牌堆时真实入口 toast + 不建按钮 prompt”的浏览器端点写回根状态。
- 已重新核对的既有浏览器证据：
  - `时间旅行者-1.21-Gigawatts-弃牌堆为空时真实入口应提示无可选牌种且不弹按钮 prompt`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-1.21-Gigawatts-弃牌堆为空时真实入口应提示无可选牌种且不弹按钮-prompt\yuanhou-gigawatts-empty-discard-before-play.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-1.21-Gigawatts-弃牌堆为空时真实入口应提示无可选牌种且不弹按钮-prompt\yuanhou-gigawatts-empty-discard-feedback-toast-locator.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-1.21-Gigawatts-弃牌堆为空时真实入口应提示无可选牌种且不弹按钮-prompt\yuanhou-gigawatts-empty-discard-feedback-without-prompt.png`
- 本轮肉眼验收结论：
  - 起始图里手牌区能直接看到 `1.21 Gigawatts` 本体，说明入口确实来自真实手牌打出，不是伪造 prompt。
  - toast locator 图里能直接看到文案 `弃牌堆中没有符合条件的卡牌`，说明 feedback 没有丢在 reducer 或事件流里，而是真送到了玩家界面。
  - 收口图里顶部 toast 仍在，中央没有任何“行动 / 仆从”按钮 prompt，右下弃牌堆里已经能看到本行动本体，说明空弃牌堆边界是真实 `toast + 不建 prompt + 本行动自己正常进弃牌堆`。
- 结果：
  - `time_travelers_1_21_gigawatts.choose_card_type` 与 `shuffle_selected_type_to_deck` 不应再只被根状态描述成“主链双按钮”和“单一牌种自动分支”；空弃牌堆 feedback 的浏览器端点也已闭合。
  - 后续队列不应再把 `1.21 Gigawatts` 的空弃牌堆本地浏览器边界挂回 residual；只剩更广随机顺序可视性或共享 inspect/feedback 收口边界继续留在 L2/shared contract。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Moon Zero Three vs Time Box rail 切换竞争同步到根状态

- 本轮继续补“evidence 已闭合、根状态仍停在旧口径”的对象，不改 `Moon Zero Three / Time Box` 实现，只把本地 rail 切换竞争链回写到根状态。
- 已重新核对的既有浏览器证据：
  - `超级间谍-Moon Zero Three-与 Time Box 同时可用时切换 rail 选择后应由 Time Box 真实进场`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Moon-Zero-Three-与-Time-Box-同时可用时切换-rail-选择后应由-Time-Box-真实进场\yuanhou-moon-zero-time-box-moon-zero-armed.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Moon-Zero-Three-与-Time-Box-同时可用时切换-rail-选择后应由-Time-Box-真实进场\yuanhou-moon-zero-time-box-switched-to-time-box.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Moon-Zero-Three-与-Time-Box-同时可用时切换-rail-选择后应由-Time-Box-真实进场\yuanhou-moon-zero-time-box-time-box-played-after-switch.png`
- 本轮肉眼验收结论：
  - 第一张图里 `Moon Zero Three` armed 后只有 `Monkey Lab` 高亮、带敌方 `Jumper` 的 `Portal Room` 被置灰，说明当前合法落点仍按 `Moon Zero Three` 自身规则过滤。
  - 第二张图里切到 `Time Box` 后两座基地都恢复成合法落点，且 rail 上两张 Titan 本体都仍可见，说明 UI 已真实刷新为新的 special 选择，而不是沿用旧的高亮集合。
  - 第三张图里 `Time Box` 已真实落到原本对 `Moon Zero Three` 非法的 `Portal Room`，而 `Moon Zero Three` 仍留在牌库旁；结合状态断言 `timeBox.location.baseIndex===1`、`moonZero.location.zone==='setaside'`、`interaction.current==null`，可确认这不是单纯视觉切换，而是整条 rail 切换竞争链已真实收口。
- 结果：
  - `super_spies_moon_zero_three.special_summon_condition` 的根状态不应再只停在“单合法/单非法基地、armed cancel、多合法基地 L2”；本地 `Moon Zero Three vs Time Box` rail 切换竞争也已 scoped L3。
  - 后续队列不应再把这条本地 Titan rail 切换链挂回 residual；`Moon Zero Three` 当前只继续保留更广 shared contract 的跨窗口 / 跨来源 special 排序问题。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Secret Volcano Headquarters 旧 scoped L3 失效与 overlay 修订同步到根状态

- 本轮继续补根状态落后于审计文档的旧结论纠偏，不改 `Secret Volcano Headquarters` 实现，只把“旧 E2E 场景真值失效、现由新截图和 overlay 修订替代”的口径同步到根状态。
- 已重新核对的既有审计事实：
  - 审计文档已明确写明 2026-05-17 的旧 scoped L3 证据失效：当时夹具实际误配成 `base_monkey_lab / breakpoint 20`，不能再作为 `Secret Volcano Headquarters` 的真实入口证明。
  - 当前有效证据已由 finding #125 替代，并同时补上 `RevealOverlay` 在自动计分链中的 `queueMicrotask` 竞态修复与新截图/新断言。
- 本轮同步的关键真相：
  - `base_secret_volcano_headquarters.reveal_one_each_player_then_play_revealed_minions_here` 的当前 scoped L3 不能再引用那条旧的 `before-end-turn / scored-with-revealed-minion-only` 口径。
  - 新口径明确要求同时满足 scene truth、`eventStream` 里两条 `REVEAL_DECK_TOP(viewerPlayerId='all')`、浏览器 `reveal-overlay` 可见与两次 dismiss 后收口。
  - 这条对象当前不再保留 residual；根状态也不应继续留着“旧 scoped L3 已通过”却不标注失效来源的记录。
- 结果：
  - `Secret Volcano Headquarters` 的根状态已从“单纯记过一条旧 scoped L3”收紧为“旧证据失效，当前以 finding #125 的 scene-truth + overlay 修订 + 新截图/断言为准”。
  - 后续队列不应再回头拿那条旧夹具 E2E 充当完成证明；若再引用 `Secret Volcano Headquarters scoped L3`，必须以审计文档当前修订后的证据口径为准。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：变形者 optional search/choice 的 skip 分支同步到根状态

- 本轮继续补“长期状态 JSON 已承认、根 `progress.md / findings.md` 仍落后”的一批对象，不改变形者实现，只把同一类 `may/optional search/choice -> skip 直接收口` 浏览器端点同步到根状态：
  - `Faceless City`
  - `G.E.L.F.`
  - `Really?`
  - `Transmogrify`
  - `Doppelganger`
  - `Mitosis`
- 已重新核对并确认在长期状态 JSON 中已有的既有浏览器证据：
  - `变形者基地-Faceless City-真实入口跳过搜寻后应直接收口并保留原牌库顺序`
  - `变形者-GELF-真实入口跳过搜寻后应直接收口且不额外打出候选随从`
  - `变形者-Really-真实入口跳过弃牌堆搜寻后应直接收口且不额外打出候选随从`
  - `变形者-Transmogrify-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从`
  - `变形者-Doppelganger-真实入口跳过牌库搜寻后应直接收口且不额外打出候选随从`
  - `变形者-Mitosis-真实入口跳过同名手牌选择后应直接收口且不额外打出候选随从`
- 本轮同步的关键真相：
  - `Faceless City` 不再只靠“选择第二张同名牌加入手牌”支撑 `may_choose_or_skip_same_name_card`；真实点击 `跳过搜寻` 后，prompt 会直接消失，手牌不增，牌库顺序保持 `same-skip-a, other-skip-card, same-skip-b`。
  - `G.E.L.F.` 不再只靠“选第二张候选打回原基地”支撑 `extra_play_here`；真实点击 `放弃这次选择` 后，`The Vats` 仍为空，不会偷偷补进候选随从。
  - `Really?` 不再只靠“选第二张弃牌堆候选并选基地”支撑 optional extra-play；真实点击 `放弃这次选择` 后，两座基地都保持空场，不会进入第二层基地选择。
  - `Transmogrify` 不再只靠“选第二张牌库候选打回原基地”支撑 optional extra-play；真实点击 `放弃这次选择` 后，`The Vats` 仍为空，没有牌库候选被偷偷打回原基地。
  - `Doppelganger` 不再只靠“Bacta 摧毁后选第二张牌库候选打回原基地”支撑 discard trigger 的 optional search；真实点击 `放弃这次选择` 后，搜索层直接收口，原基地保持空场。
  - `Mitosis` 不再只靠“从两张同名手牌里选择第二张打回目标基地”支撑 same-name hand choice；真实点击 `放弃这次选择` 后，目标基地仍只保留原目标，两张同名手牌都继续留手。
- 结果：
  - 这批对象的根状态不应再停在“只有选择候选那一半有 scoped L3”；对应的 `skip` 分支也都已有真实浏览器证据。
  - 后续队列不应再把 `Faceless City / G.E.L.F. / Really? / Transmogrify / Doppelganger / Mitosis` 的本地 `skip` 浏览器边界挂回 residual；只继续把更广的随机顺序、forged late-deck/discard、POD alias 或 shared search 合同留在 L2/shared contract。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：自动分支与空选分支同步到根状态

- 本轮继续补“长期状态 JSON 已闭合、根 `progress.md / findings.md` 还没跟上”的另一批对象，不改实现，只把自动分支与空选分支的浏览器端点同步到根状态：
  - `Operative` 的第一层空选玩家与第二层空选展示牌
  - `Repeater Perfect` 的单行动自动顶牌
  - `Time Raider` 的单候选自动沉底
  - `Spy` 的单卡自动查看与空牌库无 prompt
  - `For My Eyes Only` 的单卡自动查看与空牌库无 prompt
- 已重新核对并确认在长期状态 JSON 中已有的既有浏览器证据：
  - `超级间谍-Operative-真实入口空选玩家后应直接收口且不展示任何牌库顶牌`
  - `超级间谍-Operative-真实入口空选展示牌后应保持各牌库顶顺序并直接收口`
  - `时间旅行者-Repeater Perfect-弃牌堆只剩一张行动时真实入口应自动放到牌库顶且不弹 prompt`
  - `时间旅行者-Time Raider-弃牌堆只剩一张牌时真实入口应自动放到牌库底且不弹 prompt`
  - `超级间谍-Spy-牌库只剩一张时真实入口应自动查看且不弹重排 prompt`
  - `超级间谍-For My Eyes Only-牌库只剩一张时真实入口应自动查看且不弹重排 prompt`
  - `超级间谍-Spy-牌库为空时真实入口不应创建重排 prompt`
  - `超级间谍-For My Eyes Only-牌库为空时真实入口不应创建重排 prompt`
- 本轮同步的关键真相：
  - `Operative` 不再只靠“正常选择玩家/展示牌”的主链支撑 optional 多选语义；第一层 0 勾选时会直接收口且不 reveal 任意玩家，第二层 0 勾选时也会直接收口且不改任一牌库顶顺序。
  - `Repeater Perfect` 不再只靠“混合弃牌堆里选择第二张行动”的主链；弃牌堆只剩 1 张行动时，真实入口会自动把它放到牌库顶，不创建 `time_travelers_repeater_perfect_choose` prompt。
  - `Time Raider` 不再只靠“多候选里选择 Time Walk”的主链；弃牌堆只剩 1 张牌时，真实入口会自动把它放到牌库底，不创建 `time_travelers_time_raider_choose` prompt。
  - `Spy` 不再只靠“顶三张重排”的浏览器主链；牌库只剩 1 张时会自动查看且不弹 reorder prompt，牌库为空时也不会创建空的 reorder overlay。
  - `For My Eyes Only` 不再只靠“顶五张重排”的浏览器主链；牌库只剩 1 张时会自动查看且不弹 reorder prompt，牌库为空时也不会创建空的 reorder overlay。
- 结果：
  - 这批对象的根状态不应再停在“只有主链选择分支已绿”；对应的自动分支与空选/空牌库分支也都已有真实浏览器证据。
  - 后续队列不应再把 `Operative` 的两条空选边界、`Repeater Perfect / Time Raider` 的单候选自动边界、以及 `Spy / For My Eyes Only` 的单卡自动与空牌库无 prompt 边界挂回本地 residual；只继续把更广 inspect 来源、多人视角、随机顺序或 shared transport/overlay 合同留在 L2/shared contract。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Spy 多客户端私有重排归属同步到根状态

- 本轮继续做 completion-audit 式补齐，不改 `Spy` 实现，只把 evidence 已闭合的“私有顶三 inspect/reorder prompt 只出现在行动玩家页面”这条多客户端对象级主链同步到根状态。
- 已重新核对的既有浏览器证据：
  - `超级间谍-Spy-真实多客户端下私有顶三重排 prompt 应只出现在行动玩家页面`
- 本轮实际同步的关键真相：
  - `super_spies_spy.inspect_self_top_three` / `super_spies_spy.reorder_top_bottom_inspected_cards` 不应再只停在单页“顶三张重排”主链，或单卡自动/空牌库无 prompt 端点；多客户端下这条链也已经证明：
    - 行动玩家从手牌真实打出 `Spy` 后，只有该页面会出现 `间谍：将这几张牌按任意顺序放回牌库顶/底` prompt，并私有展示 `Spy / Operative / Mole` 顶三信息；
    - 非行动玩家页面不会镜像出同一条 inspect/reorder prompt，也不会泄露这三张私有顶牌信息；
    - 行动玩家选择非默认 top/bottom 后，Host/Guest 两页都会一起收口，且只改写行动玩家自己本次 inspected 的顶三。
- 结果：
  - `Spy` 的根状态现在应显式承认三层对象级浏览器事实：
    - 单页顶三 inspect/reorder 主链；
    - 单卡自动与空牌库无 prompt 端点；
    - 多客户端下私有 inspect/reorder prompt 只归属行动玩家页面，并在重排后双页一起收口。
  - 后续队列不应再把 `Spy` 误记成“当前只补了单页主链和单卡/空牌库端点，多客户端私有归属仍待补”；当前 residual 只继续保留更广多人局、其它 inspect 来源与 shared transport/恢复态边界。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Time Box 第 5 枚计数进场并清零链同步到根状态

- 本轮继续补“审计文档已闭合、根状态还停在旧口径”的对象，不改 `Time Box` 实现，只把 `play_at_five_and_clear` 在 yuanhou 自身 counter source 下的真实进场清零链回写到根状态。
- 已重新核对的既有浏览器证据：
  - `时间旅行者-Time Box-真实第5枚计数进场 prompt 可把 Titan 打到基地并清零计数`
- 本轮实际同步的关键真相：
  - 这条链证明的不只是 `titan_time_travelers_time_box_play` prompt 本身能把 Titan 打出去，而是 `Primate Park -> attached action 回手 -> 第 5 枚计数 -> 反应窗口选择 Time Box -> 选基地 -> Titan 真落场并清零 -> 原计分链收口` 整条 yuanhou 自身 counter source 真实连通。
  - 审计文档已明确记下这次测试层误判修正：`smashup_reaction_choose` 里的 `时间盒子` 选项与 rail 上同名 Titan 卡会重名，直接点 DOM 容易误中 rail 弹详情；现行证据以 `interaction option id` 响应当前 reaction 的链路为准，不能再把旧选择器碰巧命中误当作真链无问题。
  - 当前有效截图结论是：
    - `yuanhou-time-box-counter-hit-five-play-prompt-before-base-choice.png` 里中央明确可见 `时间盒子：是否移除全部计数器并打到一个基地？`，左下 rail 上还能看到 `Time Box` 本体，说明第 5 枚计数后的进场 prompt 已真实接到 yuanhou 回手链。
    - `yuanhou-time-box-played-from-counter-prompt-and-cleared.png` 里 prompt 已完全消失，`Time Box` 本体真实落在 `The Nexus` 上方；配合状态断言 `titan.location.baseIndex===1`、`timeBoxCounters===0`、`timeBoxPlayArmed===false`、原回手行动已在 P0 手牌、原计分基地已替换为 `Portal Room`，可确认这是“进场并清零”的真实收口，而不是只在 alien/shared 图集旁证里出现过。
- 结果：
  - `time_travelers_time_box.play_at_five_and_clear` 的根状态不应再只停在更早那条 alien 侧 special 进场浏览器链，或只停在 `turn-start skip` / `discard-recover owner-controller split` 的兄弟 atom。
  - 后续队列不应再把 `Time Box` 的 yuanhou 自身 counter source 进场清零链挂回 residual；当前只继续把更广 counter 来源、多人局与 Titan special 竞争窗口留在 shared/L2 口径。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Time Box 回合开始 owner-only 反应链同步到根状态

- 本轮继续补“审计文档已闭合、根状态还停在旧口径”的对象，不改 `Time Box` 实现，只把 `counter_from_turn_start` 的多客户端 owner-only 真实链回写到根状态。
- 已重新核对的既有浏览器证据：
  - `时间旅行者-Time Box-真实多客户端下回合开始应只给 owner 页面第5枚计数反应与进场选择`
- 本轮实际同步的关键真相：
  - `time_travelers_time_box.counter_from_turn_start` 不应再只停在旧单页 `P1 end turn -> P0 startTurn -> Moon Zero Three 已在场 -> Time Box 4->5 -> rail 入口 -> skip` 那条 scoped L3；多客户端下这条链也已经证明：
    - 只有 owner 页面会在回合开始拿到 `smashup_reaction_choose` 对应的 Time Box 反应链，左下 rail 上出现带 `可触发` badge 的 `Time Box` 本体；
    - 非 owner 页面不会镜像出同一条 startTurn 选择权，也没有 waiting overlay 或假 prompt；
    - owner 页响应后，中央会真实进入 `时间盒子：是否移除全部计数器并打出到一个基地？` 的第 5 枚计数进场 prompt，点击 skip 后 Host/Guest 两页都会一起收口回 `playCards`。
  - 审计文档还已明确纠偏旧测试误判：这条真实入口不是点一个文本叫“时间盒子”的普通按钮，而是 rail/Titan 可触发语义；测试层必须按 live `interaction option id` 响应当前 `smashup_reaction_choose`，不能再把旧 DOM 文本定位当成真链。
- 结果：
  - `time_travelers_time_box.counter_from_turn_start` 的根状态现在应显式承认两条对象级浏览器事实：
    - 单页 `Moon Zero Three 已在场 / 4->5 / rail 入口 / skip` 主链；
    - 多客户端 owner-only `startTurn -> reaction choose -> 第 5 枚计数进场 prompt -> skip` 主链。
  - 后续队列不应再把 `Time Box counter_from_turn_start` 的“谁来响应 startTurn 第 5 枚计数 prompt”继续挂成根状态缺口；当前 residual 只继续保留更广 onTurnStart 兄弟 trigger、多人局排序与 transport/恢复态边界。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Live and Let Chum 受保护宿主计分分支同步到根状态

- 本轮继续补“审计文档与长期状态 JSON 已闭合、根 `progress.md / findings.md` 还没承认”的对象，不改 `Live and Let Chum / Shell Game` 实现，只把受保护宿主上的 protected-no-op 计分链同步到根状态。
- 已重新核对并确认在长期状态 JSON 中已有的既有浏览器证据：
  - `超级间谍-Live and Let Chum-真实计分前选择受Shell Game保护的低力量宿主时不应被摧毁且本次计分继续按原力量结算`
- 本轮同步的关键真相：
  - 这条链证明的不只是 `Shell Game` 会挡掉 destroy，而是 beforeScoring 真实入口里：
    - 玩家确实可以在合法候选里点到受保护的低力量宿主；
    - destroy 会被保护过滤，不发 `MINION_DESTROYED(shell-host)`；
    - 基地不会因为这次 protected-no-op 被错误降力，而是继续按原 `4 vs 11` 计分；
    - 计分后仍会正常翻新到 `The Nexus` 并收口。
  - 这使得 `super_spies_live_and_let_chum.destroy_selected_minion` 与 `shapeshifters_shell_game.protect_attached_host_from_destroy` 的根状态，都不应再只停在 `Bacta` 保护分支或未受保护 destroy 主链。
- 结果：
  - `Live and Let Chum` 的根状态不应再只承认“选择低力量随从并真实摧毁到 owner discard”的分支；受 `Shell Game` 保护时的 destroy-no-op 且按原力量继续计分，也已 scoped L3。
  - `Shell Game` 的根状态不应再只承认 `Bacta` 来源的 protected-continue；`Live and Let Chum` 来源的 protected-no-op scoring 也已是当前真相。
  - 后续队列不应再把 `Live and Let Chum` 的受保护宿主分支或 `Shell Game` 的这条 source-family 浏览器边界挂回 residual；只继续把更广 destroy family 的死亡触发连锁与 shared L4 时序留在 L2/shared contract。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：The Base Is Not Enough / Time Is Fleeting / Wormhole / Mindraker 根状态同步

- 本轮继续做 completion-audit 式对齐，不改 `super_spies / time_travelers` 实现，只把审计文档和长期 JSON 里已经闭合、但根状态还没显式承认的 4 组对象同步回来。
- 本轮重新对齐并承认的现成证据：
  - `超级间谍-The Base Is Not Enough-真实计分前可选择低力量随从并写入临时控制`
  - `时间旅行者-Time Is Fleeting-真实计分后可选择弃牌堆基地代替抽新基地`
  - `时间旅行者-Time Is Fleeting-真实多客户端下赢家不是当前回合玩家时应只给赢家页面弃牌堆基地选择权`
  - `时间旅行者-Wormhole-真实计分后可选择任意数量己方随从洗入牌库`
  - `超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-The-Base-Is-Not-Enough-真实计分前可选择低力量随从并写入临时控制\yuanhou-the-base-is-not-enough-low-power-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-The-Base-Is-Not-Enough-真实计分前可选择低力量随从并写入临时控制\yuanhou-the-base-is-not-enough-scoring-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Is-Fleeting-真实计分后可选择弃牌堆基地代替抽新基地\yuanhou-time-is-fleeting-base-discard-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Time-Is-Fleeting-真实多客户端下赢家不是当前回合玩家时应只给赢家页面弃牌堆基地选择权\yuanhou-time-is-fleeting-winner-prompt-guest.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Wormhole-真实计分后可选择任意数量己方随从洗入牌库\yuanhou-wormhole-minion-multi-select-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Wormhole-真实计分后可选择任意数量己方随从洗入牌库\yuanhou-wormhole-selected-minion-shuffled-and-others-discarded.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里\yuanhou-mindraker-scoring-ready-before-end-turn.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里\yuanhou-mindraker-scoring-resolved-without-mole-action.png`
- 本轮肉眼验收结论：
  - `The Base Is Not Enough` 的低力量选择 prompt 里只出现 `Jumper / Time Raider`，不出现 5 力 `Silverback`；收口图里记分板已到 `3:2` 且基地翻新为 `The Nexus`，说明 beforeScoring 临时控制确实写进了本次计分。
  - `Time Is Fleeting` 的单页图里能看到弃牌堆基地选择 prompt，说明主链不只是 L2 handler；多客户端图里只有赢家页出现弃牌堆基地选择权，当前回合玩家页没有错误响应入口。
  - `Wormhole` 的真实入口已经覆盖“任意数量己方随从”多选链；收口图与状态断言一起证明被选 `Time Raider` 洗回 owner 牌库，未选 `Jumper` 与敌方 `Cyberback` 继续按原计分链清场。
  - `Mindraker` 的 before 图明确同时出现 `Mindraker`、同基地 `Mole` 与手牌 `Going Bananas`；收口图已直接进入下一玩家出牌阶段、`Primate Park` 替换成 `The Nexus` 且没有多余交互，说明 restriction 把唯一候选行动封死后，真实入口直接计分收口。
- 结果：
  - `super_spies_the_base_is_not_enough` 的根状态不应再停在 L2 或“只知道会给临时控制”；`choose_low_power_here` 已 scoped L3，且 `control_until_turn_end` 至少已覆盖“控制影响本次计分”的浏览器边界。
  - `time_travelers_time_is_fleeting` 的根状态不应再漏掉主链、赢家非当前玩家的多客户端响应权，以及“单候选自动 / 多 special 排序已由 L2 收紧、不再是对象级 residual”这三层口径。
  - `time_travelers_wormhole` 的根状态不应再停在“多选主链已过、空选仍像 bug”；空选口径已经在审计文档和长期 JSON 中纠偏，不应再把 `optionIds: []` 误挂回 residual。
  - `super_spies_mindraker.block_other_players_actions_here` 与 `super_spies_mole.respect_mindraker` 的根状态不应再缺席；真实计分窗口 restriction 已 scoped L3。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：It's Astounding / Time Box talent / Mimic 根状态同步

- 本轮继续补“evidence 与长期 JSON 已闭合、根状态仍落后”的另一批对象，不改实现，只把浏览器 scoped L3 事实同步回根状态：
  - `时间旅行者-It's Astounding-真实入口可选择弃牌堆行动并继续该行动目标链`
  - `时间旅行者-Time Box-真实天赋可在正常额度用尽后额外打低战力随从与额外行动`
  - `变形者-Mimic-真实入口只跟随场上最高印刷力量并在真正5力随从进场后动态跳到+5`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Its-Astounding-真实入口可选择弃牌堆行动并继续该行动目标链\yuanhou-its-astounding-discard-action-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Its-Astounding-真实入口可选择弃牌堆行动并继续该行动目标链\yuanhou-its-astounding-going-bananas-target-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Its-Astounding-真实入口可选择弃牌堆行动并继续该行动目标链\yuanhou-its-astounding-going-bananas-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Box-真实天赋可在正常额度用尽后额外打低战力随从与额外行动\yuanhou-time-box-talent-ready.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Box-真实天赋可在正常额度用尽后额外打低战力随从与额外行动\yuanhou-time-box-talent-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者-Mimic-真实入口只跟随场上最高印刷力量并在真正-5-力随从进场后动态跳到-+5\yuanhou-mimic-printed-power-before-real-five-enters.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者-Mimic-真实入口只跟随场上最高印刷力量并在真正-5-力随从进场后动态跳到-+5\yuanhou-mimic-printed-power-after-real-five-enters.png`
- 本轮肉眼验收结论：
  - `It's Astounding` 的第一张图先看到弃牌堆行动选择，第二张图继续进入 `Going Bananas` 的基地目标 prompt，第三张图在目标按钮隐藏后才真正收口；说明这条链不是“弃牌堆行动已打出”就算完，而是已把被选行动的后续目标链真实走完。
  - `Time Box talent` 的 ready / resolved 图已经来自 yuanhou 自身图集，而不是旧 `alien-terraform` 白卡图；额外低战力随从和额外行动额度都在真实 `Portal Room` 天赋链里完成过一次闭合。
  - `Mimic` 的 before 图里旁边对照体虽然有效力量已到 5，但 `Mimic` 只显示 `+2`；after 图在真正印刷 5 力随从进场后才跳到 `+5`，说明它跟随的是最高印刷力量，不是有效力量。
- 结果：
  - `time_travelers_its_astounding` 的根状态不应再缺席；`Time Walk / Going Bananas` 这类从弃牌堆继续接目标链的真实入口，以及“旧收口截图有残留按钮、后来已按 finding #44 修正等待条件”的证据门禁，都已是当前真相。
  - `time_travelers_time_box.talent_extra_low_power_minion_and_action` 的根状态不应再只停在旧套件主链或其它兄弟 atom；yuanhou 自身图集下的真实 talent 分支已经 scoped L3。
  - `shapeshifters_mimic.equal_highest_printed_power_in_play` 的根状态不应再只停在对象级 `clean L2`；真实页面上的 printed-power 动态重算已经 scoped L3。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Permit to Kill / Discards Are Forever / Clyde 2.0 / The Nexus 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `super_spies / cyborg_apes / time_travelers` 实现，只把长期 JSON 已记住、但根状态还没显式承认的 4 组对象同步回来。
- 本轮重新对齐并承认的现成证据：
  - `超级间谍-Permit to Kill-真实入口会展示其他玩家顶二、弃随从并让施放者重排非随从`
  - `超级间谍-Permit to Kill-四人局真实入口会依次处理每位其他玩家的非随从排序 prompt`
  - `超级间谍-Discards Are Forever-真实入口会对每位玩家展示到首个随从为止并弃掉所有展示牌`
  - `电子猿-Clyde 2.0-真实多客户端下离场行动选择权在Clyde控制者页面并可收入手牌或正常弃牌`
  - `时间旅行者-The Nexus-真实计分后赢家可选择基地弃牌堆基地代替抽新基地`
  - `时间旅行者-The Nexus-真实计分后让过响应应继续按正常牌库顶替换基地`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Permit-to-Kill-真实入口会展示其他玩家顶二、弃随从并让施放者重排非随从\yuanhou-permit-to-kill-before-play.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Permit-to-Kill-真实入口会展示其他玩家顶二、弃随从并让施放者重排非随从\yuanhou-permit-to-kill-order-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Permit-to-Kill-四人局真实入口会依次处理每位其他玩家的非随从排序-prompt\yuanhou-permit-to-kill-four-player-p1-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Permit-to-Kill-四人局真实入口会依次处理每位其他玩家的非随从排序-prompt\yuanhou-permit-to-kill-four-player-p3-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Discards-Are-Forever-真实入口会对每位玩家展示到首个随从为止并弃掉所有展示牌\yuanhou-discards-are-forever-before-play.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Discards-Are-Forever-真实入口会对每位玩家展示到首个随从为止并弃掉所有展示牌\yuanhou-discards-are-forever-resolved.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\电子猿-Clyde-2.0-真实多客户端下离场行动选择权在Clyde控制者页面并可收入手牌或正常弃牌\yuanhou-clyde-detach-choice-prompt-return-branch-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\电子猿-Clyde-2.0-真实多客户端下离场行动选择权在Clyde控制者页面并可收入手牌或正常弃牌\yuanhou-clyde-detach-choice-waiting-guest.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-The-Nexus-真实计分后赢家可选择基地弃牌堆基地代替抽新基地\yuanhou-the-nexus-base-discard-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-The-Nexus-真实计分后让过响应应继续按正常牌库顶替换基地\yuanhou-the-nexus-skipped-and-replaced-by-base-deck-top.png`
- 本轮肉眼验收结论：
  - `Permit to Kill` 的三人局图先看到真实手牌入口，再看到 `Going Bananas / Time is Fleeting` 两张非随从行动进入回顶顺序选择；四人局图里 `P1 -> P3` 的排序 prompt 会依次出现，说明它不是“只处理第一个其他玩家”的半链。
  - `Discards Are Forever` 的起始图来自真实手牌打出，收口图没有残留 prompt；结合长期 JSON 里的状态断言，可以确认每位玩家都只展示到首个随从为止，并把所有展示牌一起弃掉。
  - `Clyde 2.0` 的 Host 图里只有控制者页拿到 `收入手牌 / 进入弃牌堆` 选择，Guest 图只显示等待；这条多客户端链已经覆盖“选择权归 Clyde 控制者”而不是行动拥有者或当前回合玩家。
  - `The Nexus` 的主链图明确给出基地弃牌堆候选，skip 图则证明点击 `跳过（照常抽新基地）` 后会按 `baseDeck[0]` 正常翻新，不会残留在响应窗口。
- 结果：
  - `super_spies_permit_to_kill` 的根状态不应再缺席；三人局主链和四人局 `P1 -> P2 -> P3` 串行排序 prompt 都已由真实浏览器链承认。
  - `super_spies_discards_are_forever.reveal_until_first_minion_then_mill_seen_cards` 的根状态不应再只停在长期 JSON；双人真实入口 scoped L3 与空牌库/首张即随从/三人 turnOrder 的 L2 收紧都应视为当前真相。
  - `cyborg_apes_clyde_2_0` 的根状态不应再只在长期 JSON 里存在；多客户端下选择权归 Clyde 控制者、可收入手牌或正常弃牌的对象级边界已经闭合。
  - `base_the_nexus` 的根状态不应再只在审计文档和长期 JSON 中保留；选择基地弃牌堆基地与显式 skip 后按牌库顶翻新这两条浏览器分支都已闭合。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Juiced Up / Monkey Lab / The Vats / Time Raider / Repeater Perfect / Monkey on Your Back 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `cyborg_apes / shapeshifters / time_travelers` 实现，只把长期 JSON 已承认、但根状态还没显式承认的对象级主链 scoped L3 同步回来。
- 本轮重新对齐并承认的现成证据：
  - `电子猿-Juiced Up-真实入口会按宿主全部附着行动数量给予持续+2倍增`
  - `电子猿基地-猴子实验室-真实入口会按每个随从自己的附着行动数量持续加力量`
  - `变形者基地-The Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地`
  - `时间旅行者-Time Raider-真实天赋可选择弃牌堆任意牌放到牌库底`
  - `时间旅行者-Repeater Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶`
  - `电子猿-Monkey on Your Back-真实附着行动天赋选择另一玩家低力量随从并把本行动放到底`
  - `电子猿-Monkey on Your Back-真实入口可附着到敌方随从`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Juiced-Up-真实入口会按宿主全部附着行动数量给予持续-+2-倍增\yuanhou-juiced-up-host-before-attach.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Juiced-Up-真实入口会按宿主全部附着行动数量给予持续-+2-倍增\yuanhou-juiced-up-host-after-attach-plus-four.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿基地-猴子实验室-真实入口会按每个随从自己的附着行动数量持续加力量\yuanhou-monkey-lab-host-before-second-attach.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿基地-猴子实验室-真实入口会按每个随从自己的附着行动数量持续加力量\yuanhou-monkey-lab-host-after-second-attach-plus-two.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者基地-The-Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地\yuanhou-the-vats-same-name-base-blocked-other-base-still-legal.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者基地-The-Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地\yuanhou-the-vats-same-name-minion-played-to-other-base.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-真实天赋可选择弃牌堆任意牌放到牌库底\yuanhou-time-raider-discard-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-真实天赋可选择弃牌堆任意牌放到牌库底\yuanhou-time-raider-selected-card-bottomed.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶\yuanhou-repeater-perfect-discard-action-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶\yuanhou-repeater-perfect-selected-action-topped.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实附着行动天赋选择另一玩家低力量随从并把本行动放到底\yuanhou-monkey-on-your-back-target-choice-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实附着行动天赋选择另一玩家低力量随从并把本行动放到底\yuanhou-monkey-on-your-back-target-destroyed-action-bottomed.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实入口可附着到敌方随从\yuanhou-monkey-on-your-back-enemy-host-before-attach.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Monkey-on-Your-Back-真实入口可附着到敌方随从\yuanhou-monkey-on-your-back-attached-to-enemy-host.png`
- 本轮肉眼验收结论：
  - `Juiced Up` 的 before/after 图明确看到宿主先有 1 张附着行动，真实贴上 `Juiced Up` 后直接出现绿色 `+4`，说明它把本卡也计入宿主上的行动总数。
  - `Monkey Lab` 的 before/after 图明确看到同一宿主的基地加成从绿色 `+1` 动态跳到 `+2`，说明它按“该随从自己身上的 attached action 数量”实时重算，而不是静态写死。
  - `The Vats` 的两张图一起证明：同名随从所在基地会在真实普通出牌入口中被阻断，但同一张手牌仍可改打到别的基地并正常收口。
  - `Time Raider` 的 prompt 图能看到弃牌堆里同时存在 minion 与 action 候选，收口图说明所选 `Time Walk` 真实进了牌库底，未选 `Doctor When` 继续留在弃牌堆。
  - `Repeater Perfect` 的主链图能看到混合弃牌堆里只列行动候选，并且可以真实选择第二张 `Time Walk` 放到牌库顶，不会把弃牌随从混进来。
  - `Monkey on Your Back` 的天赋链图证明“另一玩家低力量随从”选择 prompt 与“本行动沉底”收口都已闭合；敌方宿主附着图则补齐了 `attach_to_any_minion` 的真实手牌入口，不再只靠附着后天赋链旁证。
- 结果：
  - `cyborg_apes_juiced_up.count_all_actions_on_host_plus_two_each` 的根状态不应再只停在长期 JSON；单宿主先有 1 张附着行动、再贴 1 张 Juiced Up 后出现 `+4` 的对象级主链已闭合。
  - `base_monkey_lab.each_minion_here_plus_one_per_own_attached_action_count` 的根状态不应再只停在长期 JSON；宿主 attached action 从 1 到 2 时基地加成从 `+1` 动态跳到 `+2` 的真实入口已经 scoped L3。
  - `base_the_vats.block_same_name_minion_here` 的根状态不应再只靠共享 restriction 合同或长期 JSON；真实普通出牌入口中的“置灰/拒绝 + 改打另一基地”已经闭合。
  - `time_travelers_time_raider` 与 `time_travelers_repeater_perfect` 的根状态不应再只记录后补的自动/空弃牌边界；多候选主链 scoped L3 也已显式闭合。
  - `cyborg_apes_monkey_on_your_back` 的根状态不应再只停在“敌方宿主附着入口”或只停在长期 JSON；对象级主链现在同时承认 `attach_to_any_minion` 与附着后天赋选择/沉底两条 scoped L3。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Cellular Bonding 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `shapeshifters` 实现，只把 `Cellular Bonding` 已经写在审计文档和长期 JSON 里的对象级事实，同步回根状态。
- 已确认的现状：
  - 审计文档已明确把 `shapeshifters_cellular_bonding` 拆成三层：
    - `choose_other_action_on_same_minion`
    - `write_metadata_only_when_bonding_attached_to_host`
    - `proxy_current_supported_surfaces`
  - 长期 JSON 已明确记住它当前不是“只做过一个 trigger-surface”：
    - 2026-05-16 已有复制 `Missing Uplink` 的 trigger-surface scoped L3
    - 2026-05-17 已有复制 `Monkey on Your Back` 的 talent-surface scoped L3
    - 同日还已把复制 `Flying Monkey` 的 afterScoring、复制 `Shielding` 的 protection、复制 `Splice as Nice` 的 power 收紧到对象级真相
- 本轮重新对齐并承认的现成证据：
  - `变形者-Cellular Bonding-真实入口可选择同宿主附着行动并触发复制的回合结束抽牌`
  - `变形者-Cellular Bonding-真实代理 Monkey on Your Back 天赋可选择另一玩家低力量随从并把本卡放到底`
  - `变形者-Cellular Bonding-真实计分后可代理 Flying Monkey 移动宿主并摧毁本行动`
  - `变形者-Cellular Bonding-真实复制 Shielding 后在原护盾离场时仍保护宿主其他行动且自己不会错误自保`
  - `变形者-Cellular Bonding-真实复制 Splice as Nice 后在原行动离场时仍提供持续 +2 力量`
- 结果：
  - `shapeshifters_cellular_bonding.choose_other_action_on_same_minion` 与 `write_metadata_only_when_bonding_attached_to_host` 的根状态不应再缺席；对象级前置链已经至少覆盖“真实附着到宿主后，只能从同宿主旧附着行动里选另一张，且 metadata 只写回真实宿主”。
  - `shapeshifters_cellular_bonding.proxy_current_supported_surfaces` 的根状态不应再只停在某一条旧 surface 或零散 finding；当前对象级真相已经同时承认：
    - trigger-surface：复制 `Missing Uplink` 后真实结束回合抽牌
    - talent-surface：复制 `Monkey on Your Back` 后真实选另一玩家低力量随从并把本卡放到底
    - afterScoring-surface：复制 `Flying Monkey` 后真实移动宿主并摧毁本行动
    - protection-surface：复制 `Shielding` 后能继续保护宿主其他行动且自己不会错误自保
    - power-surface：复制 `Splice as Nice` 后在原行动离场时仍由 copied metadata 保留 `+2`
  - 当前 residual 只该继续保留审计文档已经写明的完整动态复制 runtime 与更广跨派系 surface，不应再把 `Cellular Bonding` 误记成“根状态只承认了一条 talent 或 trigger 边界”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Genetic Shift 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `shapeshifters` 实现，只把 `Genetic Shift` 已经写进审计文档和长期 JSON 的对象级 scoped L3 同步回根状态。
- 已确认的现状：
  - 审计文档已把 `shapeshifters_genetic_shift` 拆成三个 atom：
    - `choose_mode`
    - `all_own_minions_plus_one`
    - `single_own_minion_plus_three`
  - 长期 JSON 已明确记住：
    - 真实无目标入口需要“先选中手牌、再二次点击确认”才会进入 `基因转变：选择强化模式`
    - all 分支只给己方随从 +1
    - single 分支只允许选己方单体，敌方 `Baboom` 不进候选也不获加成
- 本轮重新对齐并承认的现成证据：
  - `变形者-Genetic Shift-真实入口可在全体加一与单体加三之间二选一`
- 结果：
  - `shapeshifters_genetic_shift.choose_mode` 的根状态不应再缺席；当前对象级真相已明确承认“无目标行动真实入口不是点一次就结算，而是二次点击后进入模式选择 prompt”，不应再把第一次失败的旧 E2E 真值误挂回 residual。
  - `shapeshifters_genetic_shift.all_own_minions_plus_one` 的根状态不应再只停在 L2；当前对象级真相已经承认 all 分支下只有己方 `Mimic / G.E.L.F.` 获得 `tempPowerModifier=1`，敌方 `Baboom` 不会被误加成。
  - `shapeshifters_genetic_shift.single_own_minion_plus_three` 的根状态也不应再缺席；当前对象级真相已经承认 single 分支只会把 `+3` 写到玩家真实所选的己方单体目标，敌方 `Baboom` 不进入 prompt、也不会获得任何临时加成。
  - 当前 residual 只该继续保留审计文档已写明的 direct target 快捷入口与 forged/late target 负例，这两条仍由 L2 守门；不应再把 `Genetic Shift` 整体误记成“根状态没有对象级浏览器主链”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Shielding / Furious George / Splice as Nice / Missing Uplink 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `cyborg_apes / shapeshifters` 实现，只把这四个对象已写在审计文档和长期 JSON 里的对象级主链 scoped L3，同步回根状态。
- 已重新对齐并承认的现成证据：
  - `电子猿-Shielding-真实入口会清理对手行动并持续保护宿主上的其他行动`
  - `电子猿-Furious George-真实入口会按自己身上的行动数量给予持续 +1 叠加`
  - `变形者-Splice as Nice-真实入口会附着到目标随从并给予持续 +2 力量`
  - `电子猿-Missing Uplink-真实回合结束每张实例各抽一张额外牌`
- 结果：
  - `cyborg_apes_shielding` 的根状态不应再只停在 atom 行或和 `Going Bananas` 的组合细节里；当前对象级真相已经同时承认：
    - onPlay 真实打出后会清掉宿主上的对手旧行动；
    - 后续对手 `Going Bananas` 真实结算时，宿主本体不会被错误 affect；
    - `Shielding` 自身可以离场，但宿主上的其他己方行动会继续被保护留下。
  - `cyborg_apes_furious_george.attached_actions_plus_one_each` 的根状态不应再缺席；当前对象级真相已经承认“宿主先有 1 张不直接加力行动时显示绿色 `+1`，再真实贴第 2 张后动态跳到 `+2`”，说明加成来自自身 `attachedActions` 数量实时重算，而不是别的直接加力来源。
  - `shapeshifters_splice_as_nice.attached_host_plus_two` 的根状态也不应再缺席；当前对象级真相已经承认“真实手牌入口附着到宿主后，宿主左上立即出现绿色 `+2` 徽章，且本卡真实进入 `attachedActions`”，不应再把它压成纯 `ongoing-power-modifier` 共享合同。
  - `cyborg_apes_missing_uplink.owner_turn_end_draw_one_per_instance` 的根状态不应再只停在 2026-05-18 那条 extra-turn L2 补强；当前对象级真相已经承认“真实结束回合双实例额外抽牌并叠加正常回合结束抽牌”的 scoped L3，而牌库不足洗弃牌、多 owner 混挂、额外回合结束继续按 owner 聚合，则继续由后补 L2 锁定。
  - 当前 residual 只该继续保留审计文档已写明的更广多人视角、更多来源或更复杂组合边界；不应再把这四个对象误记成“根状态只有共享合同、没有对象级浏览器主链”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Bacta / Going Bananas / Primate Park / Copycat choose+metadata 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `shapeshifters / cyborg_apes / base` 实现，只把这四组对象已写在审计文档和长期 JSON 里的对象级主链 scoped L3，同步回根状态。
- 已重新对齐并承认的现成证据：
  - `变形者-Bacta the Future-真实入口目标受Shell Game保护时仍给其拥有者立即额外随从机会`
  - `变形者-Bacta the Future-真实入口摧毁敌方随从后由目标拥有者决定额外随从机会`
  - `电子猿-Going Bananas-真实入口只清理所选基地其他玩家行动`
  - `时间旅行者基地-灵长类公园` 的真实 afterScoring 响应入口
  - `Copycat` 从手牌真实打出后选择 `Furious George` 并只给本体写 copied metadata
- 结果：
  - `shapeshifters_bacta_the_future` 的根状态不应再只停在受保护分支或 owner prompt 修补点；当前对象级真相已经同时承认：
    - 目标受 `Shell Game` 保护时，destroy 会被过滤，但被摧毁目标的拥有者仍拿到 immediate extra minion 机会；
    - 未保护己方目标时，随从真实离场进 owner discard，额外随从链也真实收口；
    - 未保护敌方目标时，额外随从机会真实归目标 owner，而不是当前回合玩家或施放者。
  - `cyborg_apes_going_bananas` 的根状态不应再只散落在 `Shielding` 组合链或 `It's Astounding` 的后续目标链里；当前对象级真相已经承认：
    - 真实手牌入口需要先选基地；
    - 所选基地上的其他玩家 `base ongoing` 与 `attached action` 会被清理；
    - 己方行动与另一基地的对手行动不会被误清，且 `Shielding` 保护分支已由同对象证据闭合。
  - `base_primate_park` 的根状态不应再只在长期 JSON 里保留；当前对象级真相已经承认赢家真实点击 `灵长类公园` 响应入口后，prompt 只列“这里”的 attached action，多选后会把所选行动分别送回各自 owner 手牌，而跨基地 `other-base-action` 不会进入候选。
  - `shapeshifters_copycat.choose_other_player_minion` 与 `write_metadata_only_to_copycat_self` 的根状态也不应继续只被 `Copycat -> Jumper trigger` 间接代表；当前对象级真相已经承认：
    - 真实入口选择链是从手牌打出后进入 PromptOverlay，只允许选择另一玩家随从；
    - 最终 copied metadata 只写到 `Copycat` 本体，不会写到候选敌方随从或其他 live minion。
  - 当前 residual 只该继续保留审计文档已写明的 forged/late payload、更广 destroy family、更多 afterScoring 排序与完整复制 runtime 边界；不应再把这四组对象误记成“根状态只有零散事实，没有对象级浏览器主链”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Faceless City / G.E.L.F. / Really? / Transmogrify / Doppelganger 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `shapeshifters` 实现，只把这五组对象已写在审计文档和长期 JSON 里的主链 scoped L3，同步回根状态，避免根状态只承认它们的 `skip` 端点。
- 已重新对齐并承认的现成证据：
  - `变形者基地-Faceless City-真实入口会列出同名随从候选并将所选牌加入手牌`
  - `变形者-GELF` 天赋主链
  - `变形者-Really-真实入口摧毁己方随从后可从弃牌堆选择非第一张合格随从打到别的基地`
  - `变形者-Transmogrify-真实入口摧毁己方随从后可从牌库选择非第一张合格随从打到同基地`
  - `变形者-Doppelganger-真实摧毁进弃牌后触发牌库搜随从并打回原基地`
- 结果：
  - `base_faceless_city` 的根状态不应再只停在 `skip`；当前对象级真相已经同时承认：
    - 刚打出的随从会真实触发同名牌库搜索链；
    - 多候选时玩家可真实选择第二张同名随从收入手牌；
    - 收牌后剩余牌库会按搜索链真实收口。
  - `shapeshifters_gelf` 的根状态不应再只停在 `放弃这次选择`；当前对象级真相已经承认：
    - 天赋会先把 `G.E.L.F.` 自身真实洗回牌库；
    - 搜索层只列力量 4 或以下且非 `G.E.L.F.` 的候选；
    - 选择候选后会直接额外打回原基地，而不会残留第二个 immediate extra prompt。
  - `shapeshifters_really` 的根状态不应再只停在 `skip`；当前对象级真相已经承认：
    - 真实手牌入口先摧毁己方随从；
    - 弃牌堆搜索层可真实选择第二张候选；
    - 随后还能在合法基地里选择非原基地并把该随从额外打出。
  - `shapeshifters_transmogrify` 的根状态不应再只停在 `skip`；当前对象级真相已经承认：
    - 真实手牌入口先摧毁己方随从；
    - 牌库搜索层只列等/低于被摧毁随从力量的候选并隐藏过大候选；
    - 选择候选后会直接额外打回原基地并完成洗牌收口。
  - `shapeshifters_doppelganger` 的根状态不应再只停在 `skip`；当前对象级真相已经承认：
    - `Bacta immediate extra skip` 之后，会真实进入 `Doppelganger` 自己的 search 链；
    - 搜索层可真实选择第二张牌库候选；
    - 该候选会直接额外打回 `Doppelganger` 原来的基地，而不会残留第二个 immediate extra prompt。
  - 当前 residual 只该继续保留审计文档已写明的随机顺序、forged late-deck/discard、destroy source family 与 shared search 合同；不应再把这五组对象误记成“根状态只承认 skip，没有对象级主链”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Mitosis / Operative / Spy / For My Eyes Only / 1.21 Gigawatts 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `shapeshifters / super_spies / time_travelers` 实现，只把这五组对象已写在审计文档和长期 JSON 里的主链 scoped L3，同步回根状态，避免根状态只承认 `skip / 空选 / 单卡自动 / 空牌库` 端点。
- 已重新对齐并承认的现成证据：
  - `变形者-Mitosis-真实入口从同名手牌中选择候选并直接额外打回目标基地`
  - `超级间谍-Operative-真实入口先选择玩家再选择展示牌并把所选顶牌放到底`
  - `超级间谍-Spy-真实入口可查看自己牌库顶三张并按非默认顶底顺序放回`
  - `超级间谍-For My Eyes Only-真实入口可查看自己牌库顶五张并按非默认顶底顺序放回`
  - `时间旅行者-1.21-Gigawatts-真实入口可选择行动或仆从并将该类弃牌洗入牌库`
- 结果：
  - `shapeshifters_mitosis` 的根状态不应再只停在 `skip`；当前对象级真相已经承认：
    - 真实手牌入口先选择己方目标随从；
    - same-name prompt 会真实列出两张同名手牌并隐藏非同名候选；
    - 选择候选后会直接额外打回目标所在基地，而不会残留第二个 immediate extra prompt。
  - `super_spies_operative` 的根状态不应再只停在第一层/第二层空选端点；当前对象级真相已经承认：
    - 第一层会真实多选要查看牌库顶牌的玩家；
    - 第二层只显示这些玩家刚展示出来的顶牌；
    - 选择其中一张后，只会把该玩家的该张顶牌放到底，其余玩家牌库顶保持不变并正常收口。
  - `super_spies_spy` 的根状态不应再只停在单卡自动与空牌库无 prompt；当前对象级真相已经承认：
    - 真实手牌入口把 `Spy` 打进场后会进入顶三张 inspect/reorder prompt；
    - prompt 会直接展示三张牌库顶卡面本体；
    - 选择非默认 top/bottom 顺序后，牌库会按真实顺序收口。
  - `super_spies_for_my_eyes_only` 的根状态也不应再只停在单卡自动与空牌库无 prompt；当前对象级真相已经承认：
    - 无目标行动二次点击打出后会进入顶五张 inspect/reorder prompt；
    - prompt 直接展示五张牌库顶卡面本体，不夹带第六张；
    - 选择非默认 top/bottom 顺序后，本行动自己进入弃牌堆并完成真实收口。
  - `time_travelers_1_21_gigawatts` 的根状态不应再只停在单一牌种自动与空弃牌堆 feedback；当前对象级真相已经承认：
    - 当弃牌堆同时有行动与随从时，真实入口会出现“行动 / 仆从”按钮 prompt；
    - 选择其一后，只会把该牌种的弃牌与现有 deck 一起真实洗回牌库；
    - 未选择的另一牌种与本行动本体会继续留在 discard。
  - 当前 residual 只该继续保留审计文档已写明的更广随机顺序、多客户端、inspect 来源与 shared search/feedback 合同；不应再把这五组对象误记成“根状态只有边界端点，没有对象级主链”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：ISI / Secret Agent / The Spy Who Ditched Me 根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `super_spies / base_isis_swingin_pad` 实现，只把这三组对象在审计文档和长期 JSON 已经闭合的对象级 scoped L3 / shared 纠偏口径同步回根状态。
- 已重新对齐并承认的现成证据：
  - `超级间谍-ISI摇摆据点-真实计分后赢家可重排自己牌库顶三张`
  - `超级间谍-ISI摇摆据点-真实计分后跳过响应仍应完成收口并保留赢家牌库顺序`
  - `超级间谍-ISI摇摆据点-真实多客户端下赢家不是当前回合玩家时应只给赢家页面重排牌库`
  - `超级间谍-Secret Agent-真实入口会让行动玩家自己选择弃掉剩余手牌`
  - `超级间谍-Secret Agent-真实多客户端下应只在行动玩家页面给出弃手牌选择权`
  - `超级间谍-Secret Agent-真实多客户端下若只剩一张手牌应自动弃掉且不弹 prompt`
  - `超级间谍-Secret Agent-真实多客户端下若打完后已无剩余手牌则不应创建弃牌 prompt`
  - `超级间谍-The Spy Who Ditched Me-真实多客户端下应只在目标玩家页面给出弃随从选择权`
  - `超级间谍-The Spy Who Ditched Me-真实入口会私有展示没有随从的其他玩家手牌且不吞掉弃随从 prompt`
- 结果：
  - `base_isis_swingin_pad` 的根状态不应再只停在最早那条“P0 赢家顶三张非默认 top/bottom”浏览器链；当前对象级真相已经同时承认：
    - 真实入口来自计分后的 `smashup_reaction_choose` 响应窗口，而不是直调 reorder handler；
    - `winner != currentPlayer` 时，重排选择权只落在赢家页面，非赢家页面不拿 prompt；
    - `让过` 分支点击后会真实清掉 `smashup_reaction_choose`，并回到下一位玩家正常 `playCards`；
    - 短牌库只剩 2 张时仍可重排这条边界已由同对象 L2 锁定，不应再被误记成对象级主链缺口。
  - `super_spies_secret_agent.other_player_action_discards_one` 的根状态不应再只停在 shared queue 真链修复、单页二选一，或“短手牌自动分支只是 L2”；当前对象级真相已经同时承认：
    - 行动玩家真实打出 `Stasis Field` 后，弃手牌选择权会回到行动玩家本人，且候选只来自剩余手牌；
    - 多客户端下只有行动玩家页面出现 prompt，非目标页没有错误 waiting overlay；
    - 多客户端 `2/1/0` 剩余手牌三条真实浏览器分支都已闭合，且 `Stasis Field` 会继续留在 `Portal Room` 附着区，不会被误移走。
  - `super_spies_the_spy_who_ditched_me` 的根状态不应再只停在 shared overlay residual 或单条 reveal finding；当前对象级真相已经同时承认：
    - `each_other_player_discards_minion` 的多客户端主链里，目标玩家只会在自己页面得到弃随从选择权，Host 非目标页不再残留 stale waiting overlay；
    - `reveal_no_minion_hand` 的真实入口里，没有随从的其他玩家只会向施放者页私有 reveal 手牌，且 reveal 关闭后另一位有随从玩家的 discard prompt 仍能继续收口；
    - 旧 Host/非目标页 overlay 事故现已明确归类为 shared optimistic transport/playerView 根因，不应再被当成这张卡自己的未闭合 residual。
  - 后续队列不应再把 `ISI / Secret Agent / The Spy Who Ditched Me` 误记成“只有长期 JSON 有承认、根状态还没补对象级主链”，也不应把 `The Spy Who Ditched Me` 那条已闭合的 shared overlay 继续挂回单卡待办。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：From Q With Love / Secret Volcano Headquarters 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `super_spies / base_secret_volcano_headquarters` 实现，只把这两组对象在审计文档和长期 JSON 已经闭合的当前有效主链，同步回根状态，避免根状态只剩边界补丁或旧证据纠偏。
- 已重新对齐并承认的现成证据：
  - `超级间谍-From Q With Love-真实入口会抽三张并从投影手牌中准确弃两张`
  - `超级间谍-秘密火山总部-真实计分前会让每位玩家展示牌库顶一张，并只把展示出的随从打到这里`
- 结果：
  - `super_spies_from_q_with_love.draw_three_then_discard_two_from_projected_hand` 的根状态不应再只停在“短候选 / 空投影手牌边界已同步”；当前对象级真相已经显式承认：
    - 真实入口会先抽 3 张，再基于“旧手牌 + 新抽牌 - 本牌”形成投影手牌；
    - discard prompt 会同时列出旧手牌与新抽三张中的合法候选，但不会把本牌自身重新混回候选；
    - 选择两张后，真实收口结果是只把所选两张送入 discard，其余未选新抽牌继续留在手牌。
  - `base_secret_volcano_headquarters.reveal_one_each_player_then_play_revealed_minions_here` 的根状态也不应再只停在“旧 scoped L3 失效、现以新 scene-truth 为准”的纠偏口径；当前对象级真相已经显式承认：
    - 真实结束回合后会按 turnOrder 发出 `REVEAL_DECK_TOP(viewerPlayerId='all')`，而不是只在服务端状态里静默 reveal；
    - 中央 `reveal-overlay` 会真实出现，并与计分后的 VP / 换基地状态并存；
    - 两次 dismiss 后 overlay 会完全消失，桌面真实收口到替换后的 `Portal Room`，只把展示出的随从带进这次计分链，展示出的行动仍留在原牌库链路中。
  - 后续队列不应再把 `From Q With Love` 误记成“根状态只补了短候选/空投影手牌，主链还没显式承认”，也不应再把 `Secret Volcano Headquarters` 误记成“只有旧证据失效修订，没有当前有效主链承认”。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Time Walk / Stasis Field 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `time_travelers` 实现，只把这两组对象在审计文档和长期 JSON 已经闭合的对象级 scoped L3，同步回根状态，避免它们继续只以别的链路里的卡名形式出现。
- 已重新对齐并承认的现成证据：
  - `时间旅行者-Time Walk-真实入口会抽两张、把本牌沉到底并授予本回合额外随从与额外行动额度`
  - `时间旅行者-Stasis Field-真实入口可贴到基地、阻止本该发生的计分，并在拥有者回合开始自动离场`
- 结果：
  - `time_travelers_time_walk` 的根状态不应再只停在别的对象里的辅助卡名、shared `banked-extra-play` 合同，或“额外额度数字对了”的抽象口径；当前对象级真相已经显式承认：
    - 真实入口会先抽 2 张牌；
    - 本牌会沉到底牌库，而不是正常进弃牌堆；
    - 授予的是本回合 banked extra minion / extra action 额度，不会额外弹出 `immediate` prompt；
    - 这些额度会在同一回合里被真实消费到 `Jumper + Juiced Up` 链上，并完整收口。
  - `time_travelers_stasis_field` 的根状态也不应再只作为 `Into the Time Slip`、`Secret Agent` 或 `Portal Room` 相关链里的旁证存在；当前对象级真相已经显式承认：
    - 真实手牌入口可以把 `Stasis Field` 贴到基地，进入该基地 `ongoingActions`；
    - 在基地已达断点的情况下，它会真实阻止这次本该发生的计分与换基地；
    - 到拥有者自己下一个回合开始时，它会自动从该基地离场并进入 owner discard。
  - 后续队列不应再把 `Time Walk / Stasis Field` 误记成“长期 JSON 有 scoped L3、根状态却还没对象级承认”；当前根状态已明确承认 `Time Walk` 的 draw-two / banked-extra / bottom-self 主链，以及 `Stasis Field` 的 attach / suppress-scoring / owner-turn-start-detach 主链。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Do Over / Doctor When returned-card 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `time_travelers` 实现，只把 `Do Over / Doctor When` 已在审计文档和长期 JSON 闭合的 returned-card 主链同步回根状态，避免根状态只承认 `skip extra` 这条后补边界。
- 已重新对齐并承认的现成证据：
  - `时间旅行者-Do Over-真实入口只能重新打出刚返回手牌的那张随从`
  - `时间旅行者-Doctor When-真实入口可选择另一个己方随从回手并可额外打回`
  - `时间旅行者-Doctor When-真实入口只允许额外打回刚返回的另一随从`
- 结果：
  - `time_travelers_do_over` 的根状态不应再只停在“放弃这次额外随从后会收口”；当前对象级真相已经显式承认：
    - `return_own_minion` 这半段真实入口会先把 `Jumper` 从基地回到手牌；
    - 随后进入 specific-card extra minion prompt，而且候选只允许刚返回的那张 `jumper-a`，不会把同名手牌诱饵混进来；
    - 选择该候选后，会把它真实打回原基地并完整收口。
  - `time_travelers_doctor_when` 的根状态也不应再只停在 `skip extra`；当前对象级真相已经显式承认：
    - 第一层 prompt 会真实列出“另一个己方随从”候选，且 `Doctor When` 自身不会混进候选；
    - 选择 `Time Raider` 回手后，会进入 returned-card extra prompt；
    - extra prompt 只允许刚返回的 `raider-a`，不允许同名手牌诱饵，选择后会把 `Time Raider` 真实打回 `Portal Room` 并收口。
  - 后续队列不应再把 `Do Over / Doctor When` 误记成“只有 returned-card specific 合同或 skip-extra 边界已进根状态”；当前根状态已明确承认 `Do Over` 的 return + replay 主链，以及 `Doctor When` 的 another/your/may return + returned-card replay 主链。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Mole 正向 special 主链根状态同步

- 本轮继续做 completion-audit 式补齐，不改 `super_spies` 实现，只把 evidence finding #131 已经纠偏并重新跑通的 `Mole` 正向 special 主链同步回根状态，避免根状态继续只承认 `Mindraker` 封死这条负链。
- 已重新对齐并承认的现成证据：
  - `超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出`
  - `超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出\yuanhou-mole-reaction-choice-before-special.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出\yuanhou-mole-extra-action-prompt-with-going-bananas.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出\yuanhou-mole-auto-resolved-without-extra-base-prompt.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mole-真实计分窗口可通过特技把同基地行动作为特殊行动打出\yuanhou-mole-special-action-resolved-on-scoring-base.png`
- 本轮肉眼验收结论：
  - 第一张图中央明确给出 `选择一个反应动作`，并同时出现 `内鬼特殊能力` 与 `让过`，说明这条链确实从真实计分响应窗口起步，而不是直接伪造 extra-action prompt。
  - 第二张图中央 prompt 是 `立刻打出一张额外战术，或放弃这次机会`，底部只剩 `Going Bananas` 一张真实候选，说明 `Mole` 的 special 已把同基地 / 计分窗口限制真实传递到了 extra action 候选层。
  - 第三张图在点击 `Going Bananas` 后没有再出现第二层基地选择 prompt，说明这条链已按“唯一合法基地自动收口”的合同真实前进，不是半路卡在多余交互上。
  - 收口图里 `The Vats` 已被 `The Nexus` 替换、记分板为 `3:1`，配合状态断言 `P0 discard` 含 `mole-bananas-hand/mole-p0-anchor/mole-special-a`、`P1 discard` 含 `mole-target-action/mole-p1-target`，可以确认这次 special 打出的 `Going Bananas` 真实改写了计分结果，而不是只弹了 prompt。
- 结果：
  - `super_spies_mole.grant_special_action` 的根状态不应再只停在“对象行写过 scoped L3，但正文只有 skip / restriction 负链”。当前对象级真相已经显式承认：
    - 真实计分窗口会先给出 `Mole` 的 response choice；
    - 选择 `内鬼特殊能力` 后会进入受同基地限制的 extra-action prompt；
    - 当唯一合法行动是 `Going Bananas` 时，点击后会自动走完唯一合法基地，不再额外弹第二层基地选择；
    - 最终该行动会真实结算、改变本次计分结果并完整收口。
  - `super_spies_mole.respect_mindraker` 仍保留同组对象里的负向 scoped L3：当 `Mindraker` 把唯一候选行动全部封死时，真实入口不会错误弹出 Mole special/extra-action prompt，而是直接计分收口。
  - 后续队列不应再把 `Mole` 误记成“当前只有 restriction 负链已回根状态，正向 special 主链仍只在 evidence 里”；当前根状态已明确承认 `grant_special_action` 的正向主链，以及 `respect_mindraker` 的负向 restriction 主链。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：For My Eyes Only 多客户端私有顶五重排归属同步到根状态

- 本轮继续做 completion-audit 式补齐，不改 `super_spies` 实现，只把 evidence finding #149 已经闭合的 `For My Eyes Only` 多客户端私有 inspect/reorder 主链同步回根状态，避免根状态继续只承认单页顶五主链和单卡/空牌库端点。
- 已重新对齐并承认的现成证据：
  - `超级间谍-For My Eyes Only-真实入口可查看自己牌库顶五张并按非默认顶底顺序放回`
  - `超级间谍-For My Eyes Only-真实多客户端下私有顶五重排 prompt 应只出现在行动玩家页面`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-For-My-Eyes-Only-真实多客户端下私有顶五重排-prompt-应只出现在行动玩家页面\yuanhou-for-my-eyes-only-multiplayer-reorder-prompt-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-For-My-Eyes-Only-真实多客户端下私有顶五重排-prompt-应只出现在行动玩家页面\yuanhou-for-my-eyes-only-multiplayer-no-reorder-prompt-guest.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-For-My-Eyes-Only-真实多客户端下私有顶五重排-prompt-应只出现在行动玩家页面\yuanhou-for-my-eyes-only-multiplayer-reordered-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-For-My-Eyes-Only-真实多客户端下私有顶五重排-prompt-应只出现在行动玩家页面\yuanhou-for-my-eyes-only-multiplayer-reordered-guest.png`
- 本轮肉眼验收结论：
  - Host 图中央明确出现 `只为我的眼睛：选择牌库顶/牌库底顺序`，并直接展示 `Spy / Operative / Mole / Secret Agent / Jumper` 五张 inspected 顶牌卡面，以及非默认的顶/底顺序按钮，说明这条链是从真实双击打出 `For My Eyes Only` 进入的私有顶五重排 prompt。
  - Guest 图只保留公共 `For My Eyes Only 已打出!` spotlight，看不到 `只为我的眼睛` 私有 prompt、五张 inspected 顶牌卡面或任何顶/底顺序按钮，说明公共出牌展示没有把私有 inspect 信息泄露给另一页。
  - Host 收口图里在点击非默认顶/底顺序后已回到普通 `你自己 / 出牌阶段`，中央没有残留私有 prompt；Guest 收口图也没有 waiting overlay 或私有按钮残影。
  - 配合状态断言 `serverState.sys.interaction.current==null`、`hostState.sys.interaction.current==null`、`guestState.sys.interaction.current==null`，以及 `P0 deck=[eyes-mp-deck-c,eyes-mp-deck-a,eyes-mp-deck-f,eyes-mp-deck-e,eyes-mp-deck-b,eyes-mp-deck-d]`、`P0 discard` 含 `eyes-mp-hand`，可以确认这条链已真实走完 `Host 双击打出 -> Host 独占私有顶五 inspect/reorder prompt -> 选择非默认 top/bottom -> Host/Guest 双页收口`。
- 结果：
  - `super_spies_for_my_eyes_only.inspect_self_top_five` / `reorder_top_bottom_inspected_cards` 的根状态不应再只停在：
    - 单页顶五重排主链；
    - 单卡自动查看；
    - 空牌库无 prompt。
  - 当前对象级真相已经显式承认：多客户端下只有行动玩家页面拿到私有顶五 inspect/reorder prompt，另一页只看到公共已打出 spotlight，不会镜像出私有卡面、顺序按钮或 waiting overlay；重排收口后双页都回到正常继续出牌态。
  - 后续队列不应再把 `For My Eyes Only` 误记成“当前只有单页主链与短牌库/空牌库端点已回根状态，多客户端私有归属仍只在 evidence 里”；当前根状态已明确承认这条 owner-only 顶五重排主链。

## 2026-05-18 继续推进 SmashUp yuanhou 长期审计：Operative 多客户端两层 prompt 归属同步到根状态

- 本轮继续做 completion-audit 式补齐，不改 `super_spies` 实现，只把 evidence finding #144 已经闭合的 `Operative` 双人联机页归属主链同步回根状态，避免根状态继续只承认单页主链与两层空选端点。
- 已重新对齐并承认的现成证据：
  - `超级间谍-Operative-真实入口可多选玩家并只把选中展示牌放到对应牌库底`
  - `超级间谍-Operative-真实入口空选玩家后应直接收口且不展示任何牌库顶牌`
  - `超级间谍-Operative-真实入口空选展示牌后应保持各牌库顶顺序并直接收口`
  - `超级间谍-Operative-真实多客户端下两层 prompt 都应只出现在行动玩家页面`
- 本轮实际重新打开并核对的关键截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-Operative-真实多客户端下两层-prompt-都应只出现在行动玩家页面\yuanhou-operative-multiplayer-player-choice-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-Operative-真实多客户端下两层-prompt-都应只出现在行动玩家页面\yuanhou-operative-multiplayer-no-player-choice-guest.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-Operative-真实多客户端下两层-prompt-都应只出现在行动玩家页面\yuanhou-operative-multiplayer-top-bottom-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-Operative-真实多客户端下两层-prompt-都应只出现在行动玩家页面\yuanhou-operative-multiplayer-resolved-host.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\超级间谍-Operative-真实多客户端下两层-prompt-都应只出现在行动玩家页面\yuanhou-operative-multiplayer-resolved-guest.png`
- 本轮肉眼验收结论：
  - 第一张图里 Host 页中央明确出现第一层 `密探：选择要查看牌库顶牌的玩家` prompt，说明联机场景里玩家多选入口真实落在行动玩家页。
  - 第二张图里 Guest 页中央没有任何 prompt 或 waiting overlay，说明第一层玩家选择权没有错误镜像到非行动玩家页。
  - 第三张图里 Host 在只勾选 `玩家1` 后，第二层只出现 Guest 的 `Jumper` 顶牌本体，不夹带 Host 顶牌，说明第二层 `top/bottom` prompt 仍只归行动玩家页，且展示集合没有串台。
  - 两张收口图里 Host/Guest 都已回到普通出牌态，没有残留 prompt。配合状态断言 `serverState.sys.interaction.current==null`、`guestState.sys.interaction.current==null`、`P0 deck='operative-mp-p0-top,operative-mp-p0-second'`、`P1 deck='operative-mp-p1-second,operative-mp-p1-top'`，可以确认这条链真实完成了“只改 Guest 顶牌到底，不误改 Host 顶牌”的双页收口。
- 结果：
  - `super_spies_operative.choose_players_to_reveal` / `bottom_any_revealed_cards` 的根状态不应再只停在：
    - 单页正常多选两位玩家并选择 1 张展示牌放底；
    - 第一层 0 勾选玩家；
    - 第二层 0 勾选展示牌。
  - 当前对象级真相已经显式承认：双人联机下两层 prompt 都只归行动玩家页面，Guest 页既不会拿到第一层玩家选择 prompt，也不会拿到第二层 `top/bottom` prompt；Host 在第二层只选 Guest 顶牌后，只会改 Guest 牌库而不会误改 Host 牌库。
  - 后续队列不应再把 `Operative` 误记成“当前只有单页主链与空选端点已回根状态，多客户端页归属仍只在 evidence 里”；当前根状态已明确承认这条 2P owner-only 双层 prompt 主链。
# Progress: DiceThrone 战术家与咒缚海盗新增英雄接入（2026-05-30）

## 2026-05-30 16:48:43

- 接管 active goal：新增 DiceThrone 战术家与咒缚海盗，遇到需人工裁定项立即停止 goal。
- 已读取根 `AGENTS.md`、项目 `add-new-faction` skill、DiceThrone hero intake workflow、数据录入与资源链关键规则。
- 已核对 `git status --short`：工作区存在大量非本轮改动，后续只做定向改动，不回滚不整理。
- 已检查现有计划文件：未找到本批次关键词；已在 `task_plan.md` 顶部建立本轮正式计划入口，并保留旧计划为历史。
- 已读取 DiceThrone 现有英雄模板与注册点：`treant`/`ninja` 新规格、`domain/characters.ts`、`domain/ids.ts`、`domain/index.ts`、`ui/cardAtlas.ts`、`criticalImageResolver.ts`、`ui/assets.ts`。

## 2026-05-30 17:20

- 为战术家与咒缚海盗生成英文运行时源文件与压缩资源：`player-board`、`tip`、`ability-cards`、`dice`、`status-icons-atlas`。
- 新增 `ability-cards-zhanshujia.atlas.json`、`ability-cards-cursed_pirate.atlas.json`，复用树精/忍者 1910x4348 -> 900x2048 的 5x8 物理卡网格合同。
- 新增英雄目录 `src/games/dicethrone/heroes/zhanshujia/` 与 `src/games/dicethrone/heroes/cursed_pirate/`，接入骰面、Token/状态、面板能力、通用牌、注册表、关键图片 resolver、卡图 atlas。
- 新增规则核对文档 6 份，明确英雄专属手牌、复杂状态机制、防御精确结算、E2E、上传仍未收口。
- 新增静态 intake 测试 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`，5 tests passed。
- 验证结果：JSON parse OK；定向 ESLint 0 errors（`characters.ts` 既有 2 warnings）；`i18n:check` 无 missing key，仅 3 条既有 warning；`npx tsc --noEmit --pretty false` OK；DiceThrone manifest validate OK。
- 误触记录：`npm run assets:validate -- --root ...` 走到全量/错误参数入口，命中无关 SmashUp `pretty_pretty.webp` hash/bytes 不一致；随后用 `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id dicethrone` 定向验证通过。

## 2026-05-30 17:48

- 机制实现继续推进到 L2：
  - 战术优势 6 个主动动作已接入：1 个得 1CP、1 个重掷 1 骰、3 个抽 1、3 个施加锁定、4 个获得守护、4 个打开转移状态交互。
  - 紧缚已接入进攻掷骰阶段额外投掷每次消耗 1CP；CP 不足时验证失败且不投骰；进攻掷骰阶段退出时移除。
  - 诅咒金币已接入咒缚海盗本人上限 5 / 其他角色上限 3、不可移除/不可转移、维持阶段每层 1 伤害。
  - 凋零已接入伤害来源侧 `onDamageDealt` 修正，只减少持有者对对手造成的攻击伤害，不影响直接伤害。
  - 休战已接入攻击伤害阻止与进攻掷骰阶段退出清理；直接伤害不受休战阻止。
- 新增机制测试 `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`，覆盖上述机制和战术优势复用锁定/守护/转移入口。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 12 tests passed。
  - `node -e "JSON.parse(...zh-CN...); JSON.parse(...en...)"`：OK。
  - `npx eslint <本轮 DiceThrone TS 文件>`：0 errors，38 warnings（既有 `any` / unused warning）。
  - `npm run i18n:check`：通过，仍有 3 条既有 warning（`GameDetails.tsx`、`titans.ts`、`HomeV2.tsx`）。
- 未收口范围不变：火药桶投骰/爆炸/转交/重叠爆炸、两个英雄防御精确 resolver、英雄专属手牌逐卡录入、审计 evidence、真实入口 E2E、资源上传与远端 HEAD 回查。

## 2026-05-30 18:00

- 继续推进无需人工裁定的面板机制：
  - 战术家制胜高地已接入“战术优势上限提升 1，并获得至新上限”，通过 `zhanshujia-high-ground-cap-up-and-fill` 生成 `TOKEN_LIMIT_CHANGED` 与 `TOKEN_GRANTED`。
  - 咒缚海盗死亡印记已接入结算前获得 2CP；弯刀不可防御伤害分支仍未收口。
  - 咒缚海盗亡灵之爪已接入所有对手按诅咒金币层数受到直接伤害。
- 火药桶继续保持未实现：当前文档只证明维持阶段投骰、1-2 爆炸、6 转交、重叠立即爆炸，但缺少爆炸伤害数值和转交选择细节，不能猜。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 9 tests passed。

## 2026-05-30 18:05

- 继续补咒缚海盗 L2 机制：
  - 灵魂突刺的三个分支已在 postDamage 检查当前进攻骰最大重复值，若存在 3 个相同骰值则施加火药桶。
  - 深海潜行已接入偷取 1CP：对手 CP > 0 时扣 1，自己获得 1（自己 CP 仍受上限约束），并保留既有凋零/8 伤害。
- 仍未收口：
  - 火药桶重叠立即爆炸仍未实现，因为爆炸伤害数值和转交选择细节仍无足够证据。
  - 深海潜行的“对手弃 1”仍未实现，需要补交互链。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 10 tests passed。

## 2026-05-30 18:15

- 继续推进无需猜图面数值的 L2 机制：
  - 死亡印记弯刀奖励骰分支已从普通 `bonusDamage` 改为独立 `unblockableDamage`，每个弯刀面造成 2 点不可防御攻击伤害。
  - 战争贩子已在攻击收口后通过 `EXTRA_ATTACK_TRIGGERED` 进入额外进攻投掷阶段，复用既有额外攻击阶段流转。
  - `flowHooks` 已能识别非晕眩来源产生的额外进攻事件并把下一阶段改回 `offensiveRoll`。
- 仍未收口：
  - 深海潜行“对手弃 1”需要新增或复用手牌选择交互；现有 DiceThrone `dt:card-interaction` 仅支持骰子/玩家/状态选择，不直接支持从手牌选牌弃置，本轮未硬猜成随机弃牌。
  - 火药桶完整机制、防御 resolver、专属手牌、审计、E2E、上传仍未完成。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 11 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 16 tests passed。
  - `npx eslint src/games/dicethrone/domain/tokenTypes.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors，`flowHooks.ts` 保留既有 warnings。
  - `npx tsc --noEmit --pretty false`：通过。

## 2026-05-30 18:28

- 继续补深海潜行“对手弃 1”机制，未采用随机弃牌：
  - 新增 DiceThrone `selectHandCard` 交互类型与 `RESOLVE_INTERACTION.selectedCardIds`，只允许交互所有者从自己手牌里选择卡牌弃置。
  - 咒缚海盗 `deep-sea-dive` 现在会为目标对手创建 `selectHandCard` 交互；目标无手牌时不创建交互。
  - UI Overlay 增加手牌选项渲染，Board 对 `selectHandCard` 做 owner gate，避免非所有者看到/操作手牌选择；AI 兜底选择自己的首张手牌。
- 仍未收口：
  - 火药桶完整机制、防御 resolver、咒缚被动、专属手牌逐卡录入、审计、E2E、上传仍未完成。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 11 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 16 tests passed。
  - `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx src/games/dicethrone/__tests__/useInteractionState.test.tsx`：2 files / 31 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint <本轮 selectHandCard 相关文件>`：0 errors，保留既有 warnings。

## 2026-05-30 18:35

- 基于咒缚海盗玩家板图面补咒缚被动确定子句：
  - 咒缚海盗自己的 `phaseStart/upkeep` 被动现在通过 `cursed-pirate-cursed-upkeep-self-damage` 造成 4 点 direct + unblockable 自伤。
  - 未实现“对手在其进攻投掷阶段未造成一次攻击则施加火药桶”，因为这需要新增每名对手 offensiveRoll 是否造成攻击的回合级追踪合同，不能用当前 `lastResolvedAttackDamage` 猜。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 12 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 17 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。

## 2026-05-30 18:47

- 继续补两个防御 resolver：
  - 战术家反制措施现在按当前防御骰面计数：每组 2 军刀造成 1 反击伤害；每个旗帜生成 1 点防伤；每个勋章获得 1 战术优势。
  - 咒缚海盗你还嫩了点现在按当前防御骰面计数：每个弯刀造成 1 反击伤害；每个战利品获得 1CP；每个骷髅生成 2 点防伤；若弯刀和骷髅同时存在，对攻击者施加 1 诅咒金币。
- 同步更新战术家 / 咒缚海盗录入核对、当前 evidence、`task_plan.md` 和 `findings.md`，移除“防御 resolver 未实现”的旧口径。
- 仍未收口：
  - 火药桶完整投骰、爆炸、转交、重叠爆炸。
  - 无情诅咒“至多两名对手施加火药桶”。
  - 英雄专属手牌逐卡录入、审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 19 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。

## 2026-05-30 18:55

- 补诅咒金币“海盗可选择不获得金币”的共享入口：
  - 新增 `domain/statusEvents.ts` 统一构建状态施加事件。
  - 目标为咒缚海盗本人且状态为诅咒金币时，生成“获得 / 不获得”选择；接受后按动态上限施加，拒绝后层数不变。
  - 普通 `grantStatus`、条件/default `grantStatus`、奖励骰状态施加、咒缚海盗 custom resolver 与 `selectPlayer` 交互授予状态均走该 helper，避免只修单入口。
- 仍未收口：
  - 火药桶完整投骰、爆炸、转交、重叠爆炸。
  - 无情诅咒“至多两名对手施加火药桶”。
  - 英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/domain/execute.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 14 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 19 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。

## 2026-05-30 19:13

- 补咒缚“对手在其进攻投掷阶段未发起攻击则施加火药桶”的 L2 机制：
  - `ATTACK_INITIATED` 在 core 记录 `offensiveRollAttackMadeThisTurn[playerId] = true`，并在回合切换时清理。
  - `offensiveRoll` 阶段末如果活跃玩家是咒缚海盗的对手，且本回合未发起攻击，则对该玩家施加火药桶。
  - 新增正向测试：对手未发起攻击离开进攻投掷阶段时获得火药桶。
  - 新增否定测试：对手已发起攻击时不重复施加火药桶。
- 仍未收口：
  - 火药桶完整投骰、爆炸、转交、重叠爆炸。
  - 无情诅咒“至多两名对手施加火药桶”。
  - 英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 16 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 21 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/reduceCombat.ts src/games/dicethrone/domain/reducer.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors，`flowHooks.ts` 保留既有 warnings。

## 2026-05-30 19:36

- 补无情诅咒“对至多两名对手施加火药桶”的 L2 机制：
  - `merciless-curse` 不再直接自动施加火药桶，而是通过 `cursed-pirate-merciless-curse-powder-keg-targets` 创建可跳过的选择。
  - 4 人 2v2 下只列咒缚海盗敌队两名对手，不列队友；选择两名对手后分别施加火药桶，选择跳过则不施加。
  - 新增正向测试：4 人 2v2 选择两名对手后，两名对手获得火药桶，队友不获得。
  - 新增否定测试：选择跳过后不会施加火药桶。
- 仍未收口：
  - 火药桶完整投骰、爆炸、转交、重叠爆炸。
  - 英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 18 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 23 tests passed。
  - `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/abilities.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。

## 2026-05-30 19:45

- 基于咒缚海盗提示板补火药桶（图面“炸药桶”）完整 L2 机制：
  - 持有者进入维持阶段时投 1 骰，并产生 `BONUS_DIE_ROLLED` 特写事件。
  - 1-2 时爆炸：移除火药桶，造成 3 点 direct + unblockable 独立伤害。
  - 3-5 时无事发生：不移除、不伤害。
  - 6 时创建 `choices.powderKegTransfer` 选择，持有者可按图面“任意玩家”选择目标；选择自己时保持原状态，选择其他玩家时移除原桶并转交给目标。
  - 新收到火药桶的玩家若已有火药桶，先让原桶爆炸，再施加新桶，最终仍保留 1 层。
- 同步更新：
  - `src/games/dicethrone/rule/咒缚海盗真相源表.md`
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `task_plan.md`
  - `findings.md`
- 仍未收口：
  - 英雄专属手牌逐卡录入、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 22 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 27 tests passed。
  - `npx eslint src/games/dicethrone/domain/statusEvents.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors，`flowHooks.ts` 保留既有 warnings。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。

## 2026-05-30 22:46

- 按完整单卡裁图完成两名新英雄专属手牌 L1 录入：
  - 临时裁图已落在 `temp/dicethrone-intake/zhanshujia/hand-cards/` 与 `temp/dicethrone-intake/cursed_pirate/hand-cards/`，并生成 contact sheet。
  - 战术家录入 slot 17-31 共 15 张专属牌，咒缚海盗录入 slot 17-32 共 16 张专属牌。
  - 同步 `src/games/dicethrone/heroes/zhanshujia/cards.ts`、`src/games/dicethrone/heroes/cursed_pirate/cards.ts` 与中英文 i18n。
  - 修正新英雄通用牌索引：战术家 `card-unexpected` 为 slot 32，咒缚海盗 `card-unexpected` 为 slot 33，不再沿用树精/忍者 slot 37。
- 同步文档：
  - `src/games/dicethrone/rule/战术家真相源表.md`
  - `src/games/dicethrone/rule/战术家卡牌录入核对.md`
  - `src/games/dicethrone/rule/咒缚海盗真相源表.md`
  - `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `task_plan.md`
- 仍未收口：
  - 战术家复合升级替换、被攻击后响应牌、目标选择牌等专属手牌 L2。
  - 咒缚海盗选择类、对手支付、手牌查看/弃牌、翻面条件、至多三名目标等专属手牌 L2。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`：1 file / 6 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 28 tests passed。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - `npx eslint src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`：0 errors。

## 2026-05-31 09:23

- 继续推进战术家专属手牌 L2，先收口升级牌替换链：
  - 9 张战术家升级牌均已从 L1 描述改为真实 `replaceAbility`，目标均指向基础技能 ID，保留“一张物理升级牌替换一个基础技能，内部 variants 取最高”的共享合同。
  - 新增升级能力定义：反制措施 II/III、战略转移 II、开拓战场 II、包夹侧翼 II、摇鼓运动 II、地毯式轰炸 II、战争贩子 II、军刀突刺 II。
  - 扩展战术家 custom action：反制措施按升级参数调整军刀组伤害；军刀突刺 II 三同值施加紧缚；战争贩子 II 勋章分支抽 1 并触发额外进攻投掷阶段。
- 新增机制测试覆盖：
  - 9 张升级牌逐张产生 `ABILITY_REPLACED`、写入 `abilityLevels` 与 `upgradeCardByAbilityId`。
  - 反制措施 III 防御掷 5 骰且每组 2 军刀造成 2 反击伤害。
  - 军刀突刺 II 造成升级后伤害并在三同值时施加紧缚。
  - 战争贩子 II 勋章分支抽牌并触发额外进攻投掷阶段。
- 仍未收口：
  - 战术家被攻击后响应牌、战略防御目标选择、地毯式轰炸 II 2v2 精确“两名不同对手”交互。
  - 咒缚海盗复杂专属手牌、对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 26 tests passed。
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 32 tests passed。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - `npx eslint src/games/dicethrone/heroes/zhanshujia/abilities.ts src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。
  - 额外尝试 `npx vitest run --config vitest.config.audit.ts src/games/dicethrone/__tests__/ability-customaction-audit.test.ts`：29 passed / 1 failed；失败为既有 customAction 孤立列表审计，包含大量既有 `treant`/`ninja`/`cursed_pirate`/战术家注册项，不作为本轮收口绿灯。

## 2026-05-31 09:38

- 继续推进战术家专属行动牌 L2：
  - `card-zhanshujia-disengage` 加入被攻击后出牌条件，投 1 骰后军刀造成 2、旗帜防止 3、勋章获得守护。
  - `card-zhanshujia-tactical-retreat` 加入被攻击后出牌条件，对攻击者施加紧缚并给自己 3 点伤害护盾。
  - `card-zhanshujia-war-room` 新增 `zhanshujia-war-room-roll`，按实际骰值 `ceil(value / 2)` 授予战术优势。
  - `card-zhanshujia-strategic-defense` 新增任意玩家目标选择，选择后授予守护。
- 同步文档与文案：
  - `src/games/dicethrone/rule/战术家卡牌录入核对.md`
  - `src/games/dicethrone/rule/战术家录入核对.md`
  - `public/locales/{zh-CN,en}/game-dicethrone.json`
- 仍未收口：
  - 地毯式轰炸 II 在 2v2 中精确“两名不同对手”交互。
  - 咒缚海盗复杂专属手牌 L2。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 30 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 36 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/dicethrone/heroes/zhanshujia/cards.ts src/games/dicethrone/domain/customActions/zhanshujia.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。

## 2026-05-31 09:49

- 继续推进战术家地毯式轰炸 / 地毯式轰炸 II 的多人目标语义：
  - 新增 `minSelectCount` 交互门禁，支持“必须选满两名不同对手”而不破坏既有“至多 N 名 / 默认至少 1 名”的多选交互。
  - 地毯式轰炸不再用 `allOpponents` 近似多人目标，改为 `zhanshujia-carpet-bombing-targets` 交互选择两名不同对手。
  - 2v2 候选只包含敌队两名对手，不包含队友；每名目标各受到 2 点 direct 附属伤害，队伍共享 HP 由既有伤害管线扣减。
  - 1v1 或合法对手不足 2 名时直接按现有对手结算，不强行创建无法满足的必选交互。
- 同步文档与文案：
  - `src/games/dicethrone/rule/战术家录入核对.md`
  - `src/games/dicethrone/rule/战术家卡牌录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `public/locales/{zh-CN,en}/game-dicethrone.json`
  - `task_plan.md`
- 仍未收口：
  - 咒缚海盗复杂专属手牌 L2。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 验证结果：
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 31 tests passed。
  - `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx`：1 file / 29 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 37 tests passed。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - 定向 ESLint 覆盖本轮改动 TS/TSX 文件：0 errors。

## 2026-05-31 10:03

- 继续推进咒缚海盗专属手牌 L2，收口 6 张规则文本明确且无需新增复杂 UI 组件的牌：
  - 诅咒卡牌：三选一 simple-choice，覆盖抽 1、自伤 2 抽 2、自伤 4 抽 3。
  - 封舱：打出后弃掉剩余手牌，然后抽 4。
  - 抽筋剥皮：投 5 骰，每个弯刀增加 1 攻击伤害；增加至少 3 点时对当前目标施加火药桶。
  - 干票大的：投 2 骰，只要投出战利品即抽 2 并在扣费后获得 2CP。
  - 送你们去喂鱼：创建可跳过的至多 3 名不同对手火药桶选择；2v2 只列敌队对手，不列队友。
  - 啜呼：目标玩家可选择直接获得火药桶，或改为投 1 骰；3-6 获得火药桶和凋零，1-2 无事发生。
- 同步文档：
  - `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `task_plan.md`
- 仍未收口：
  - 赎金：对手支付 2CP 或重掷所选骰。
  - 瞭望台：看手牌、对手自选弃牌、随机弃牌分支。
  - 海盗的一生：面板咒缚面/普通面翻面状态。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 已跑验证：
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 37 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 43 tests passed。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。

## 2026-05-31 10:11

- 继续推进咒缚海盗专属手牌 L2，补赎金：
  - 出牌者先通过 simple-choice 选择一颗对手骰子。
  - 目标对手随后选择支付 2CP 给出牌者，或不支付并重掷所选骰子。
  - 目标 CP 不足 2 时支付选项禁用；重掷分支会对同一颗已选骰子发 `DIE_REROLLED`。
- 同步文档：
  - `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `task_plan.md`
- 仍未收口：
  - 瞭望台：查看手牌、目标自选弃牌、随机弃牌分支。
  - 海盗的一生：面板咒缚面/普通面翻面状态。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 已跑验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 38 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。

## 2026-05-31 10:34

- 继续推进咒缚海盗专属手牌 L2，补瞭望台与海盗的一生普通面：
  - 瞭望台：选择对手并投 1 骰；弯刀为出牌者创建“查看目标手牌”确认选择；战利品创建目标玩家自选弃 1 张手牌交互；骷髅按受控随机索引随机弃目标 1 张手牌。
  - 海盗的一生：当前未找到“普通面 / 咒缚面”翻面状态字段，因此只实现普通面获得 1 诅咒金币路径，并继续走咒缚海盗本人可选择不获得金币的统一 helper。
- 同步文档：
  - `src/games/dicethrone/rule/咒缚海盗卡牌录入核对.md`
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`
  - `task_plan.md`
- 仍未收口：
  - 海盗的一生：咒缚面治疗 3 当时需要先建立或找到面板翻面状态合同；已在 13:08 按当前咒缚面素材合同补齐。
  - 对象级审计、真实入口 E2E、资源上传与远端 HEAD 回查。
- 已跑验证：
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 40 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。

## 2026-05-31 10:40

- 补跑并落档当前最窄组合门禁：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 46 tests passed。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/heroes/cursed_pirate/cards.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors。
  - JSON parse `public/locales/{zh-CN,en}/game-dicethrone.json`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
- 当前剩余门禁未变：
  - 海盗的一生咒缚面治疗 3 当时仍缺面板翻面状态合同；已在 13:08 按当前咒缚面素材合同补齐。
  - 对象级审计 evidence 仍待补真实入口证据；真实入口双玩家 E2E、资源上传与远端 HEAD 回查当时仍未完成，已在 12:44 收口。

## 2026-05-31 10:52

- 新增对象级审计首版：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
- 审计覆盖：
  - 战术家与咒缚海盗的英雄注册、资源链、状态/Token、玩家板能力、专属手牌、通用牌索引和共享消费合同。
  - 按 D 维度记录 D1/D2/D3/D5/D8/D11/D12/D14/D15/D22/D23/D24/D52 的当前证据层级。
- 当前结论：
  - 两名英雄均为 L1/L2 部分通过，不能写完成。
  - 海盗的一生咒缚面治疗 3 当时保持 `blocked`；已在 13:08 按当前咒缚面素材合同补齐。
  - 真实入口双玩家 E2E、资源上传与远端 HEAD 回查当时仍为 `pending`，已在 12:44 收口。

## 2026-05-31 12:44

- 收口真实入口双玩家 E2E 与资源链：
  - 新增/补强 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`，截图前等待玩家板/提示板图片真实加载完成，避免把空白图片误当成 UI 通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：2 passed。
  - 截图已人工核对：选角页、战术家玩家板/提示板/HUD、咒缚海盗玩家板/提示板/HUD、战术家“作战室”手牌图、咒缚海盗“海盗的一生”手牌图均可见。
- 收口资源上传与远端回查：
  - `npm run assets:check`：上传前发现 24 个 DiceThrone 新资源缺远端。
  - `npm run assets:upload`：上传 25，跳过 2025，失败 0；其中 24 个为本轮 DiceThrone 新资源，另 1 个为既有 SmashUp `pretty_pretty.webp` 远端差异。
  - 代表 URL HEAD 回查：战术家/咒缚海盗 `player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp`、`status-icons-atlas.webp` 均为 200；Common `background.webp`、`character-portraits.webp` 均为 200。
- 已同步：
  - `task_plan.md`：S6 与批次矩阵更新为 E2E/资源链 `passed`。
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`：补 E2E、上传、HEAD、截图证据。
  - `evidence/dicethrone/zhanshujia-cursed-pirate-intake-progress-2026-05-30.md`：补最新验证记录和未覆盖风险。
- 当前剩余门禁：
  - 海盗的一生咒缚面治疗 3 已在 13:08 按当前咒缚面玩家板素材合同补齐 L2；这条是当时阶段性结论。现已补到普通面分支测试，且本轮图面对照已确认 human/normal 面确实存在独立技能语义，后续需按新结论重录与重审计。
  - 复杂交互 UI 仍非逐项 L3/L4：隐藏信息、多人目标、奖励骰、手牌查看等仅有 L2 或代表性入口截图。
  - `implementation_in_progress` 必须保留，不能宣称战术家与咒缚海盗完整完成。

## 2026-05-31 13:08

- 补咒缚海盗玩家板面最小合同：
  - `HeroState.playerBoardFace?: 'normal' | 'cursed'`。
  - `cursed_pirate` 因当前唯一正式玩家板素材是咒缚面，初始化为 `cursed`。
  - 海盗的一生在 `playerBoardFace='cursed'` 时产生 `HEAL_APPLIED(3)`；在 `normal` 时保留获得 1 诅咒金币选择分支。
- 更新文档与 evidence：
  - `src/games/dicethrone/rule/咒缚海盗真相源表.md` 新增玩家板面合同。
  - `src/games/dicethrone/rule/咒缚海盗录入核对.md`、`咒缚海盗卡牌录入核对.md`、对象审计与批次进度改为海盗的一生 C1/C2 L2 passed。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "海盗的一生|咒缚海盗当前接入素材"`：3 passed / 39 skipped。
  - `npx eslint src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/characters.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors / 2 warnings（`characters.ts` 既有 `any`）。
- 剩余门禁：
  - 官方 human/normal 面素材与技能不在当前素材内，不能补成当前默认运行时。
  - 复杂交互 UI 仍非逐项 L3/L4，`implementation_in_progress` 继续保留。

## 2026-05-31 13:15

- 补跑海盗的一生咒缚面合同后的组合门禁：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 48 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npm run i18n:check`：通过，仅保留既有 3 条 warning。
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/characters.ts src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：0 errors / 2 warnings（`characters.ts` 既有 `any`）。
- 复核旧口径：
  - 未发现当前文档仍把海盗的一生咒缚面治疗 3 作为未解决 blocker；历史段落均已标注“当时 blocked，13:08 已补齐”。
- 当前结论不变：
  - 资源链、真实入口 E2E、海盗的一生咒缚面 L2 已收口。
  - 复杂交互 UI 仍未逐项 L3/L4，`implementation_in_progress` 继续保留。

## 2026-05-31 13:38

- 补复杂交互真实入口代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算战略防御与送你们去喂鱼的交互 UI”。
  - 战略防御：Host 真实入口触发玩家选择覆盖层，截图保存 `07-host-strategic-defense-target-choice.png`；选择 P2 后服务器状态断言 P2 获得守护，截图保存 `08-host-strategic-defense-protect-applied.png`。
  - 送你们去喂鱼：Guest 真实入口触发“至多三名对手获得火药桶”选择弹窗，截图保存 `09-guest-go-fish-powder-keg-choice.png`；选择施加给 P1 后服务器状态断言 P1 获得火药桶，截图保存 `10-guest-go-fish-powder-keg-applied.png`。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：3 passed。
- 当前剩余门禁：
  - 战略防御与送你们去喂鱼已有 L3 真实入口证据。
  - 隐藏信息查看、奖励骰选择、手牌选择、防御响应等其余复杂交互仍未逐项 L3/L4，`implementation_in_progress` 继续保留。

## 2026-05-31 14:12

- 补手牌选择真实入口代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 在同一真实入口用例内注入 `selectHandCard` 交互，验证 Host 只能从自己手牌选择。
  - 修复 `src/games/dicethrone/ui/InteractionOverlay.tsx` 的手牌候选名称渲染：`cards.*` i18n key 现在会通过 `t()` 翻译，不再在 UI 里显示 raw key。
  - 截图 `11-host-select-hand-card-choice.png` 显示“选择 1 张手牌弃置”与“作战室！”；截图 `12-host-select-hand-card-discarded.png` 显示确认后弃牌堆数量增加。
- 验证：
  - `npx eslint src/games/dicethrone/ui/InteractionOverlay.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx`：1 file / 29 tests passed（保留既有 missing_sfx stderr）。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：3 passed。
- 当前剩余门禁：
  - 战略防御、送你们去喂鱼与手牌选择已有 L3 真实入口代表证据。
  - 当时隐藏信息查看、奖励骰选择、防御响应等复杂交互仍未逐项 L3/L4；后续瞭望台三分支与作战室奖励骰代表链已补。

## 2026-05-31 14:37

- 补瞭望台弯刀查看手牌真实入口代表链：
  - `resolveCrowsNest` 不再把目标手牌拼成 raw `card-*` ID，而是传递卡牌 `cards.*.name` key。
  - `ChoiceModal` 对选项插值参数中的卡牌 key 做本地化，避免 simple-choice 文案里露出内部卡牌 ID。
  - E2E 真实打出瞭望台并用随机队列固定弯刀分支；截图 `13-guest-crows-nest-view-hand.png` 显示“瞭望台：查看手牌”和中文卡名“作战室！、战略防御！”。
  - 点击确认后服务器状态断言 P1 手牌仍为作战室与战略防御两张，截图 `14-guest-crows-nest-confirmed-hand-unchanged.png` 保留收口状态。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 42 tests passed。
  - `npx eslint src/games/dicethrone/domain/customActions/cursed_pirate.ts src/games/dicethrone/ui/ChoiceModal.tsx e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：3 passed。
- 当前剩余门禁：
  - 瞭望台弯刀查看手牌已有代表性 L3 证据；战利品/骷髅真实入口已在 15:32 补齐。
  - 当时奖励骰选择、防御响应等复杂交互仍未逐项 L3/L4；后续作战室奖励骰代表链已补。

## 2026-05-31 15:32

- 补瞭望台战利品/骷髅真实入口代表链：
  - E2E 不再依赖浏览器随机队列控制在线服务端骰面，改为真实打出瞭望台后检测实际分支；未命中目标分支则重置场景重试。
  - 战利品分支截图 `15-host-crows-nest-loot-discard-choice.png` 显示目标玩家“选择 1 张手牌弃置”，候选为“作战室！”与“战略防御！”。
  - 战利品确认后截图 `16-host-crows-nest-loot-discarded.png` 保留弃牌后手牌/弃牌落点。
  - 骷髅分支截图 `17-host-crows-nest-skull-random-discarded.png` 保留随机弃牌后手牌剩 1、弃牌 1 的状态证据。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：3 passed。
- 当前剩余门禁：
  - 瞭望台三分支真实入口 L3 已收口。
  - 奖励骰展示链真实入口代表证据已在 15:55 补作战室；逐对象奖励骰分支仍未全量 L3。
  - 防御响应链真实入口 L3/L4 仍未完成：战术家反制措施、咒缚海盗你还嫩了点。
  - 深海潜行完整真实攻击入口 L3 仍未完成；当前只覆盖 `selectHandCard` 代表链。
  - `implementation_in_progress` 继续保留，不能宣称两个英雄完整完成。

## 2026-05-31 15:55

- 补战术家作战室奖励骰展示真实入口代表链：
  - 在现有真实入口 E2E 内注入作战室手牌并通过 `PLAY_CARD` 真实打出，不直接伪造 `pendingBonusDiceSettlement`。
  - 截图 `18-host-war-room-bonus-die-spotlight.png` 显示奖励骰特写，文案为“作战室：获得 3 战术优势”。
  - 点击关闭奖励骰特写后截图 `19-host-war-room-tactical-advantage-applied.png` 保留回到棋盘状态；服务器状态断言战术优势至少 1。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：3 passed。
- 当前剩余门禁：
  - 作战室已提供奖励骰展示代表性 L3，但战争贩子、死亡印记、干票大的、抽筋剥皮等逐对象奖励骰分支仍未全量 L3。
  - 防御响应链真实入口 L3/L4 仍未完成：战术家反制措施、咒缚海盗你还嫩了点。
  - 深海潜行完整真实攻击入口 L3 仍未完成；当前只覆盖 `selectHandCard` 代表链。
  - `implementation_in_progress` 继续保留。

## 2026-05-31 16:41

- 补防御响应链真实防御阶段入口代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实防御阶段入口应展示并结算反制措施与你还嫩了点”。
  - 战术家反制措施：在线对局进入 `defensiveRoll`，防御骰为军刀/军刀/旗帜/勋章；截图 `20-host-countermeasures-defense-before-resolve.png` 保留防御阶段入口，`21-host-countermeasures-defense-resolved.png` 保留结算后棋盘。服务器断言攻击者 HP 49，战术家获得 1 战术优势。
  - 咒缚海盗你还嫩了点：在线对局进入 `defensiveRoll`，防御骰为弯刀/战利品/骷髅/骷髅/骷髅；截图 `22-guest-still-wet-behind-ears-defense-before-resolve.png` 保留防御阶段入口，`23-guest-still-wet-behind-ears-defense-resolved.png` 保留结算后棋盘。服务器断言攻击者 HP 49、防御者 HP 50、防御者 CP 6、攻击者获得 1 诅咒金币。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应展示并结算反制措施与你还嫩了点"`：1 passed。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：4 passed（约 8.8m）。
- 当前剩余门禁：
  - 防御响应链代表 L3 已补，不再作为“完全无真实入口证据”的缺口。
  - 深海潜行完整真实攻击入口 L3 仍未完成；当前只覆盖 `selectHandCard` 代表链。
  - 战争贩子、死亡印记、干票大的、抽筋剥皮等逐对象奖励骰分支仍未全量 L3。
  - `implementation_in_progress` 继续保留。

## 2026-06-01 07:57

- 修复深海潜行真实攻击链里的共享交互 bug：
  - `src/games/dicethrone/domain/systems.ts` 的 `selectHandCard` 不再被同批 `STATUS_APPLIED` / `TOKEN_GRANTED` 事件提前清掉，现仅在真实 `CARD_DISCARDED` 后自动完成。
  - 新增深海潜行真实进攻 pipeline 回归，锁定“偷取 1CP -> 施加凋零 -> 对手自选弃 1”整条链不会在前置事件后丢失弃牌交互。
- 新增/补强验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "深海潜行"`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 43 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts`：1 file / 7 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 50 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/dicethrone/domain/systems.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors / 5 warnings（均为 `systems.ts` 既有 `any` warning）。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"`：1 passed。
- 人工截图复核：
  - `24-guest-deep-sea-dive-offensive-entry.png`：Guest 真实通过玩家板技能槽进入深海潜行进攻链，前置偷 CP/施加凋零后仍进入弃牌前状态。
  - `25-host-deep-sea-dive-discard-choice.png`：Host 真实看到“选择 1 张手牌弃置”弹窗，证明交互未被前置事件提前收口。
  - `26-host-deep-sea-dive-discarded.png`：Host 选牌确认后弃牌堆落点正确，整条攻击链可继续收口。
- 当前剩余门禁更新：
  - 深海潜行完整真实攻击入口已有代表性 L3，不再作为当前主 blocker。
  - 主要剩余缺口收敛为逐对象奖励骰分支等复杂交互仍未逐项 L3/L4。
  - `implementation_in_progress` 继续保留，不能宣称两个英雄完整完成。

## 2026-06-01 08:37

- 补咒缚海盗“干票大的！”真实入口奖励骰代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算干票大的奖励骰分支”。
  - Guest 真实打出 `card-cursed-pirate-hefty` 后进入双骰覆盖层，截图 `27-guest-hefty-bonus-die-loot.png` 保留奖励骰展示。
  - 关闭覆盖层后，服务器状态断言咒缚海盗 CP 回到 5、手牌补到 2、`card-cursed-pirate-hefty` 进入弃牌堆；截图 `28-guest-hefty-loot-applied.png` 保留结算后棋盘。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算干票大的奖励骰分支"`：1 passed。
- 当前剩余门禁更新：
  - `干票大的！` 奖励骰分支已有代表性 L3，不再列为当前主要缺口。
  - 主要剩余缺口进一步收敛为战争贩子、死亡印记、抽筋剥皮等逐对象奖励骰分支仍未逐项 L3/L4。
  - `implementation_in_progress` 继续保留。

## 2026-06-01 09:49

- 补战术家“战争贩子 II”真实入口奖励骰代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算战争贩子 II 的奖励骰分支”。
  - Host 真实通过玩家板 `sky` 槽位触发升级后的战争贩子 II，截图 `29-host-war-monger-2-bonus-die-branch.png` 保留奖励骰覆盖层。
  - 关闭覆盖层后，不再强锁单一勋章分支，而是按服务端实际 `pendingAttack.extraRoll.value` 做代表性断言：
  - `1/2/3`：P2 HP 应变为 `44`。
  - `4/5`：P1 战术优势应变为 `5`。
  - `6`：`extraAttackInProgress.attackerId === '0'`，且手牌包含 `card-zhanshujia-strategic-defense`。
  - 截图 `30-host-war-monger-2-branch-applied.png` 保留奖励骰分支结算后的棋盘状态。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子 II 的奖励骰分支"`：1 passed。
- 结论边界：
  - 战争贩子 II 奖励骰分支已有代表性 L3，不再属于“完全没有真实入口证据”的缺口。
  - 当前在线 E2E 场景下奖励骰会真实随机，本次实际常命中旗帜分支；勋章抽牌 + 额外进攻专门链仍未被单独稳定锁定。
  - 主要剩余缺口进一步收敛为战争贩子 II 勋章专门链、死亡印记、抽筋剥皮等逐对象奖励骰分支仍未逐项 L3/L4。
  - `implementation_in_progress` 继续保留。

## 2026-06-01 10:17

- 补咒缚海盗“抽筋剥皮”真实入口奖励骰代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算抽筋剥皮的奖励骰分支”。
  - Guest 真实打出 `card-cursed-pirate-flay` 后进入 5 骰奖励骰覆盖层，截图 `31-guest-flay-bonus-dice.png` 保留奖励骰展示。
  - 关闭覆盖层前读取服务端 `pendingBonusDiceSettlement.dice`，按实际弯刀数 `N` 做分支无关断言：
  - `pendingAttack.bonusDamage === N`。
  - 咒缚海盗 CP 扣费后为 `3`。
  - 当 `N >= 3` 时目标获得 1 层火药桶；否则不获得火药桶。
  - 截图 `32-guest-flay-branch-applied.png` 保留奖励骰分支结算后的棋盘状态。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算抽筋剥皮的奖励骰分支"`：1 passed。
- 结论边界：
  - 抽筋剥皮奖励骰分支已有代表性 L3，不再属于“完全没有真实入口证据”的缺口。
  - 这次覆盖的是按实际弯刀数收口的代表链，不是所有可能 UI 组合的穷尽式证明。
  - 主要剩余缺口进一步收敛为战争贩子 II 勋章专门链与死亡印记等逐对象奖励骰分支仍未逐项 L3/L4。
  - `implementation_in_progress` 继续保留。

## 2026-06-01 10:56

- 补咒缚海盗“死亡印记”真实入口奖励骰代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算死亡印记的奖励骰分支”。
  - Guest 真实通过玩家板 `marked-for-death` 槽位触发技能，点击推进后进入 4 骰奖励骰覆盖层，截图 `33-guest-marked-for-death-bonus-dice.png` 保留真实入口奖励骰展示。
  - 关闭覆盖层前读取服务端 `pendingBonusDiceSettlement.dice`，按实际分支做代表性断言：
  - Guest CP 变为 `7`。
  - Guest 手牌数等于实际战利品数。
  - Host 诅咒金币层数等于实际骷髅数。
  - Host HP 变为 `50 - 2 * 实际弯刀数`。
  - 截图 `34-guest-marked-for-death-branch-applied.png` 保留奖励骰分支结算后的棋盘状态。
- 顺手修复 `rollDie` 多骰同批累计 bug：
  - 根因是 `effects.ts` 在同一轮奖励骰里重复使用旧状态，导致第二颗同类骰看不到第一颗骰子的抽牌/状态落点。
  - 现在 `rollDie` 会在每颗奖励骰的事件生成后顺序轻量 reduce `ctx.state`，多颗战利品/骷髅会逐颗累计。
  - 新增机制断言锁住死亡印记 `4,5,6,6` 时应抽 2 且给对手叠 2 层诅咒金币。
- 验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "死亡印记"`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 50 tests passed。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：1 file / 43 tests passed。
  - `npx eslint src/games/dicethrone/domain/effects.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算死亡印记的奖励骰分支"`：1 passed。
- 结论边界：
  - 死亡印记奖励骰分支已有代表性 L3，不再属于“完全没有真实入口证据”的缺口。
  - 当前主要剩余高风险项进一步收敛为复杂交互 UI 仍未逐项 L3/L4；`implementation_in_progress` 继续保留。

## 2026-06-01 11:35

- 补战争贩子 II 勋章专门链正式收口：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 的 `setupWarMonger2Scenario` 不再只改 `abilityLevels`，而是把 Host 的 `war-monger` 真实替换成升级后的 `WAR_MONGER_2` 定义，避免在线场景误跑基础版战争贩子。
  - `playWarMonger2UntilMedalBranch(...)` 现在不再在勋章分支命中后立即收口，而是继续驱动 Guest 完成本次防御阶段，并等待 Host 真实进入额外进攻 `offensiveRoll`；截图 `35-host-war-monger-2-medal-extra-attack.png` 已落地。
  - 正式领域链补了 `extraAttackInProgress.phaseEntered` 最小状态位：触发额外攻击时为 `false`，进入额外进攻 `offensiveRoll` 时改为 `true`；防御阶段收口时若仍未进入额外进攻，则强制回到 `offensiveRoll`，但额外进攻自己收口后不会无限回跳。
- 新增/补强验证：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts -t "战争贩子"`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：2 files / 52 tests passed。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段"`：1 passed。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算战争贩子 II 的奖励骰分支"`：1 passed。
- 当前剩余门禁更新：
  - 战争贩子 II 勋章专门链已有真实入口专门证据，不再作为当前主 blocker。
  - `implementation_in_progress` 继续保留，主要剩余缺口回到复杂交互 UI 仍未逐项 L3/L4。
- 2026-06-01 12:00：补咒缚海盗“赎金”真实入口跨玩家双步选择链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算赎金的跨玩家双步选择链”。
  - Guest 真实在进攻投掷阶段打出 `card-cursed-pirate-ransom` 后，先看到“赎金：选择一颗对手骰子”弹窗；截图 `36-guest-ransom-die-choice.png` 保留 Guest 选第 1 颗骰子的入口。
  - 选骰后选择权真实切到 Host；截图 `37-host-ransom-pay-or-reroll.png` 保留 Host 的“赎金：是否支付 2CP？”弹窗。
  - Host 选择支付后，截图 `38-guest-ransom-paid-applied.png` 保留结算后棋盘；服务器状态断言 Guest CP 为 `6`、Host CP 为 `3`，且 `card-cursed-pirate-ransom` 已进入 Guest 弃牌堆。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算赎金的跨玩家双步选择链"`：1 passed。
- 当前剩余门禁更新：
  - `赎金` 已有代表性真实入口 L3，不再列为“完全没有 UI 证据”的缺口。
  - `implementation_in_progress` 继续保留，主要剩余缺口仍是复杂交互 UI 未逐项 L3/L4。
- 2026-06-01 12:10：补咒缚海盗“啜呼”真实入口目标选择与奖励骰分支：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“真实入口应展示并结算啜呼的目标选择与奖励骰分支”。
  - Guest 真实打出 `card-cursed-pirate-sip` 后，Host 看到“啜呼：选择是否改为投骰”弹窗；截图 `39-host-sip-choice.png` 保留目标页选择入口。
  - Host 选择“不获得火药桶，改为投 1 骰”后进入奖励骰覆盖层；截图 `40-host-sip-bonus-die.png` 保留目标页奖励骰展示。
  - 关闭覆盖层后，按服务端实际点数分支收口：若点数 `>= 3`，Host 获得 1 层火药桶与 1 层凋零；若点数 `< 3`，两种状态保持 0。截图 `41-host-sip-branch-applied.png` 保留结算后棋盘。
- 验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：0 errors。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算啜呼的目标选择与奖励骰分支"`：1 passed。
- 当前剩余门禁更新：
  - `啜呼` 已有代表性真实入口 L3，不再列为“完全没有 UI 证据”的缺口。
  - `implementation_in_progress` 继续保留，主要剩余缺口仍是复杂交互 UI 未逐项 L3/L4。
- 2026-06-01 13:41：尝试补 4 人 / 2v2 的“无情诅咒”真实入口链，但不保留未稳定的新 E2E：
  - 已确认真实流程不是“点终极后直接弹火药桶选择”，而是 `offensiveRoll -> targetingRoll -> 目标骰/确认目标 -> defender 解析 -> preDefense 火药桶选择`。
  - 为了支撑后续继续试 4 人房间，`setupDTOnlineMatchWithPlayers(...)` 已补 `characterSelectionTimeout`、`skipCharacterSelectionWait` 和 `skipImageGate` 选项，允许用例自行控制选角等待与图片门禁。
  - 本轮新增的 4 人在线探针两次都在角色选择页前卡在“正在准备对局 / 加载游戏模块”，业务断言没有真正跑到 `merciless-curse`；因此已把探针代码从 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 撤回，避免仓库留下红灯用例。
- 验证：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口探针：无情诅咒先进入 targetingRoll，并在 6 点时由进攻方选择敌方目标"`：两次均失败在 `waitForCharacterSelection(...)`，最后页面文本为“正在准备对局... / 加载游戏模块...”。
  - 撤回探针后，`npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - 撤回探针后，`npx tsc --noEmit --pretty false`：通过。
- 当前剩余门禁更新：
  - 4 人 `merciless-curse` 真实入口仍未收口，当前 blocker 仍是多人房间冷启动与选角页 readiness，不是已确认的领域合同本身。
  - `implementation_in_progress` 继续保留，主要剩余缺口仍是复杂交互 UI 未逐项 L3/L4。

## 2026-06-01 15:37

- 补 4 人 `无情诅咒` targetingRoll 真实入口代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增用例“4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家”。
  - 新增 `setupNewHeroFourPlayerMatch(...)`，基于 `setupDTOnlineMatchWithPlayers(..., { skipCharacterSelectionWait: true, skipImageGate: true, characterSelectionTimeout })` 先让 4 个页面并发进入选角页，再通过 `waitForCharacterSelectionPages(...)` 并行等待 readiness，避免旧的串行等待把冷启动时间放大。
  - 新增 `buildMercilessCurseTargetingRollState(...)`，只注入到 `targetingRoll` 并复用真实 `ADVANCE_PHASE` 进入目标选择，不再把 `preDefense` 火药桶选择链混进同一探针。
  - 目标骰 `5`：真实选择权落到防守队队长页面，截图 `42-four-player-merciless-curse-defender-team-choice.png` 保留 `dt-defender-choice-panel` 与仅敌队候选。
  - 目标骰 `6`：真实选择权落到进攻方页面，截图 `43-four-player-merciless-curse-attacker-choice.png` 保留 Host 的敌方目标选择面板。
- 顺手补双人选角页首页救援：
  - `e2e/helpers/dicethrone.ts` 的 `waitForCharacterSelection(...)` 现在遇到首页底部“重连进入”浮条时，会先点击回房再继续等待角色选择页。
  - 这是为了解决长跑时偶发落回首页、但房间其实仍在的 setup 波动；不改变业务断言。
- 验证：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`：1 passed。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算干票大的奖励骰分支"`：1 passed（验证首页“重连进入”救援后该条恢复稳定）。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实进攻阶段入口应通过面板槽位选择并结算深海潜行前置链"`：1 passed。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应命中并保留战争贩子 II 勋章专门链的额外进攻阶段"`：1 passed。
  - 整份 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 串跑仍出现 soak 波动：一次为 `test API` 端口 `ECONNREFUSED 127.0.0.1:20100`，一次为 `playWarMonger2UntilMedalBranch(...)` 在 18 次随机内未命中勋章分支；两条随后单跑均通过，因此当前只记为长跑稳定性风险，不记为本轮业务回归。
- 当前剩余门禁更新：
  - 4 人 `merciless-curse` 已补到 `targetingRoll` 的代表性真实入口 L3，不再是“完全没有 4 人真实 UI 证据”。
  - 这条链仍未扩到 `preDefense` 火药桶选择与最终结算，不能宣称 `无情诅咒` 4 人真实入口完全收口。
  - `implementation_in_progress` 继续保留；当前额外风险除复杂交互未逐项 L3/L4 外，还包括整份 intake E2E 长跑 soak 稳定性。

## 2026-06-01 16:45

- 继续推进 4 人 `无情诅咒` 的 `preDefense` 火药桶选择链，但本轮仍未形成可宣称通过的新业务证据：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 火药桶选择段改为先保留 `44-four-player-merciless-curse-powder-keg-choice` UI 证据，再把后置等待收窄为：
      - 通过页内 DOM click 触发 `施加给 P2, P4`；
      - 轮询服务端状态快照，要求 `P2/P4` 实际获得火药桶，且当前交互已清空；
      - 只在真实 phase 已经推进到 `defensiveRoll` 时，额外校验 `countermeasures`，不再强锁“必须立刻进入防御阶段”。
    - 新增 4 人选角页本地回房救援：
      - 若某个玩家页掉回站点首页，则重进 `/play/dicethrone/match/<matchId>?playerID=<id>` 后继续等待角色选择页。
- 本轮验证结果：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - 两次单跑
    - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`
    - 都失败在 `setupNewHeroFourPlayerMatch(...) -> waitForCharacterSelectionPages(...)`，最后页面文本为 `正在准备对局... / 加载游戏模块...`。
    - 其中一次还观察到玩家页掉回站点首页；新增回房救援后，该掉首页分支被吸收，但主阻塞仍是“长时间停在加载游戏模块”。
- 当前边界：
  - 这次还不能证明火药桶 modal 点击后的状态链已经跑通，因为两次都没重新走到业务断言位点。
  - 当前最可信 blocker 仍是 4 人 online readiness / 选角页冷启动，而不是 `merciless-curse` 领域实现本身。

## 2026-06-01 17:55

- 继续把 4 人冷启动问题上提到通用 helper，而不是只在 intake 用例里局部救火：
  - `e2e/helpers/dicethrone.ts`
    - 新增 `waitForCharacterSelectionInRoom(...)`，进入房间后统一走“等选角页 + 超时诊断”的封装。
    - 超时信息现在会带：`playerId`、`matchId`、最后 URL、最后页面文本、最近 `pageerror/console.error`、最近 `MatchLoadTrace`。
    - `setupDTOnlineMatch(...)` / `setupDTOnlineMatchWithPlayers(...)` 的 host/guest 进房等待都切到这个新 helper。
    - 每个新页面在正式进房前增加浏览器侧 `import('/src/pages/MatchRoomWithAudio.tsx')` 预热，尝试把 `/play/:gameId/match/:matchId` 的 lazy route 冷编译提前。
- 对照基线后，已确认这不是当前 intake 专有问题：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"`
    - 命中与当前 intake 相同的 host 冷启动现象：`player 0` 停在正确房间 URL，页面文本为 `正在准备对局... / 加载游戏模块...`。
    - 诊断里没有 `pageerror/console.error`，`MatchLoadTrace` 也为空。
    - 这说明当前 blocker 更接近 `/play/...` route-level lazy fallback 或更早的 client boot，而不是 `merciless-curse` 用例自己改坏。
- route 预热至少在一次长跑里把链路重新推进到了真实 `preDefense` modal：
  - 最新一次 420s 超时的 `error-context.md` 显示 Host 已进棋盘，且 modal 标题为 `技能结算选择`，文案为 `选择至多两名对手获得火药桶`，按钮含 `施加给 P2` / `施加给 P4` / `施加给 P2, P4`。
  - 这说明 4 人 setup 在某些运行里已不再完全挡住 `44` 业务位点；`merciless-curse` 的真实链确实能再次走到火药桶选择 UI。
- 同步把 `44 -> 45` 的业务断言草稿继续收窄：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 补上 `defenderFrontPage = players[1].page`。
    - `施加给 P2, P4` 改为 `click({ force: true })`。
    - modal 之后不再轮询 `readServerRoot(...)`；改为等待 Host 页本地 harness 满足：
      - 当前交互清空；
      - `P2/P4` 各有 1 层火药桶；
      - modal 隐藏。
    - phase 容忍值放宽为 `targetingRoll | preDefense | defensiveRoll`；只有自然进入 `defensiveRoll` 才额外要求 `countermeasures`。
- 本轮验证：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"`：失败，但失败形态与 intake 对齐，证明是通用 4 人 readiness blocker。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`：
    - 一次长跑超时时，error context 已显示真实 `44` modal；
    - 另一次又回到 `player 0` 卡 `加载游戏模块...`。
- 当前边界：
  - 还不能宣称 `45-four-player-merciless-curse-powder-keg-applied` 已验证通过。
  - 当前最可信 blocker 仍是 4 人 online route/module 冷启动与房间 readiness 波动；`44 -> 45` 的新断言更合理，但仍缺稳定绿灯证据。

## 2026-06-01 18:42

- 4 人 `merciless-curse` 真实入口链本轮已真正推进到 `preDefense` 火药桶状态链通过，不再停留在“偶发打到 modal”：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "4 人真实入口应先进入 targetingRoll，并按 5/6 把无情诅咒的目标选择权交给正确玩家"`：`1 passed (3.7m)`。
  - 本次同一条真实链已经连续覆盖：
    - `42-four-player-merciless-curse-defender-team-choice.png`
    - `44-four-player-merciless-curse-powder-keg-choice.png`
    - `45-four-player-merciless-curse-powder-keg-applied.png`
    - `43-four-player-merciless-curse-attacker-choice.png`
- 这次通过前，实际上收掉了三个不同层级的问题：
  - `e2e/helpers/dicethrone.ts`
    - 发现 `setupDTOnlineMatchWithPlayers(...)` 的 4 人路径存在结构性错误：Host 进房后先等选角页，再去 join 其余玩家，会把 4 人房天然卡死在 loading。现已改为：当 `joinPlayerIds.length > 1` 时，先把所有玩家 join 完，再并发等待选角页。
    - `cleanupDTMatch(...)` 现在会吞掉“context/page/browser 已关闭”的收尾错误，避免整条用例超时后被 cleanup 二次报错盖掉真实挂点。
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 防守队长点完 `dt-defender-choice-option-1` 后，不再错误等待 `interaction.data.sourceAbilityId === 'merciless-curse'`。真实截图已证明 Host 的 `技能结算选择` modal 会出现，但旧内部字段门禁过窄，曾把真实 UI 误判成未到达。
    - `施加给 P2 / P4 / P2, P4` 按钮现在改用精确正则匹配，避免 Playwright strict mode 把 `施加给 P2` 与 `施加给 P2, P4` 混成双命中。
    - `44 -> 45` 继续保持浏览器内 harness 断言：等交互清空、`P2/P4` 落桶、modal 隐藏，只在自然进入 `defensiveRoll` 时额外看 `countermeasures`。
- 当前边界更新：
  - `无情诅咒` 4 人真实入口不再只是 `targetingRoll` 代表链，`preDefense` 火药桶选择与落桶状态链现在也已有真实通过证据。
  - 仍需保持 `implementation_in_progress`：这次收口的是 `merciless-curse` 4 人链，不等于两个新英雄所有复杂交互都已逐项 L3/L4 完成。

## 2026-06-01 18:55

- 对象级审计 evidence 已与最新真实入口证据重新对齐：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - 已把 `无情诅咒` 从 `L3 pending` 改为 `L2/L3 representative passed`。
    - D5 / D15 / 多目标交互矩阵已补 4 人 `42-45` 链。
    - E2E 截图目录与人工核对表已加入 `42-47`。
    - 未完成门禁已明确补上“4 人 online readiness 通用稳定性仍是 risk-watch”，避免把单链通过误写成多人基线全收口。
- 继续补了一个低风险、高价值的对象级 L3 缺口：`诅咒卡牌`。
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增用例“真实入口应展示并结算诅咒卡牌的自伤抽牌分支”。
    - 真实入口先展示 `诅咒卡牌：选择结算效果` modal，截图 `46-guest-curse-card-choice.png` 保留三个分支按钮。
    - 选择“受到 4 点伤害并抽 3 张牌”后，截图 `47-guest-curse-card-damage4draw3-applied.png` 保留回到棋盘与手牌区的状态；服务器断言 Guest HP 变为 `46`、手牌变为 `送你们去喂鱼 / 瞭望台 / 干票大的`，且 `诅咒卡牌` 已进弃牌堆。
- 本轮验证：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒卡牌的自伤抽牌分支"`：`1 passed (2.8m)`。
- 当前边界更新：
  - `诅咒卡牌` 不再属于“完全没有真实入口证据”的对象级缺口。
  - `implementation_in_progress` 继续保留；下一批高优先缺口仍主要是战术家主动 token 交互、地毯式轰炸、咒缚海盗状态类对象与其余未补的专属手牌真实入口。

## 2026-06-01 19:04

- 继续补咒缚海盗 `封舱` 的对象级 L3 代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增用例“真实入口应展示并结算封舱的弃手重抽链”。
    - 新增 `setupBattenDownScenario(...)`，把 Guest 主阶段手牌固定为 `封舱 / 送你们去喂鱼 / 瞭望台`，牌库固定为 `干票大的 / 抽筋剥皮 / 赎金 / 啜呼`，避免把结果建立在运行时随机抽牌上。
    - 截图 `48-guest-batten-down-before-play.png` 保留打牌前手牌状态。
    - 打出封舱后，截图 `49-guest-batten-down-applied.png` 保留弃手重抽后的真实棋盘与手牌区。
- 真实入口收口断言：
  - Guest CP 从 `5` 扣到 `1`。
  - `封舱 / 送你们去喂鱼 / 瞭望台` 都进入弃牌堆。
  - 手牌重抽为 `干票大的 / 抽筋剥皮 / 赎金 / 啜呼`。
- 本轮验证：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算封舱的弃手重抽链"`：`1 passed (3.6m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md` 已把 `封舱` 从 `L3 pending` 改为 `L2/L3 representative passed`，并补上 `48-49` 截图目录、人工核对表和验证记录。
- 当前边界更新：
  - `封舱` 不再属于“只做了 L2、没有真实入口”的对象级缺口。
  - 下一批优先对象继续收敛为：战术家的 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`，以及咒缚海盗的 `分点给我 / 火药桶 / 诅咒金币 / 亡灵之爪`。

## 2026-06-01 19:12

- 继续补咒缚海盗 `分点给我` 的对象级 L3 代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增用例“真实入口应展示并结算分点给我的单目标火药桶链”。
    - 新增 `setupGiveMeSomeScenario(...)`，把 Guest 主阶段手牌固定为 `分点给我`，并清空双方已有状态，避免把落桶结果和历史状态混在一起。
    - 截图 `50-guest-give-me-some-before-play.png` 保留打牌前手牌状态。
    - 截图 `51-guest-give-me-some-applied.png` 保留打牌后棋盘与目标状态区变化。
- 真实入口收口断言：
  - Host 获得 `1` 层火药桶。
  - `分点给我` 进入 Guest 弃牌堆。
- 本轮验证：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算分点给我的单目标火药桶链"`：`1 passed (3.1m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md` 已把 `分点给我` 从 `L3 pending` 改为 `L2/L3 representative passed`，并补上 `50-51` 截图目录、人工核对表和验证记录。
- 当前边界更新：
  - `分点给我` 不再属于“只做了共享 L2、没有对象级真实入口”的缺口。
  - 下一批优先对象继续收敛为：战术家的 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`，以及咒缚海盗的 `火药桶 / 诅咒金币 / 亡灵之爪`。

## 2026-06-01 19:34

- 继续补咒缚海盗 `亡灵之爪` 的对象级 L3 代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setupUndeadClawScenario(...)`，把 Guest 进攻掷骰固定到 `1 弯刀 + 3 骷髅` 的亡灵之爪面板组合，并把 Host 的诅咒金币固定为 `3` 层，避免把追加直伤和其他历史状态混在一起。
    - 新增用例“真实入口应展示并结算亡灵之爪的诅咒金币追加直伤链”。
    - 截图 `52-guest-undead-claw-before-attack.png` 保留玩家板 `calm` 槽位已解析为亡灵之爪且可点击的入口状态。
    - 截图 `53-host-undead-claw-applied.png` 保留结算后防守方棋盘与状态区变化。
- 真实入口收口断言：
  - Guest 点击 `calm` 槽位后，真实进入 `undead-claw` 攻击链。
  - Host 在保留 `3` 层诅咒金币的同时，HP 从 `50` 降到 `39`。
  - Guest HP 保持 `50`，没有把追加直伤误打回进攻方。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算亡灵之爪的诅咒金币追加直伤链"`：`1 passed (3.1m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md` 已把 `亡灵之爪` 从 `L3 pending` 改为 `L2/L3 representative passed`，并补上 `52-53` 截图目录、人工核对表和验证记录。
- 当前边界更新：
  - `亡灵之爪` 不再属于“已做 L2 机制、但没有对象级真实入口”的缺口。
  - 下一批优先对象继续收敛为：战术家的 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`，以及咒缚海盗的 `火药桶 / 诅咒金币`。

## 2026-06-01 20:06

- 继续补咒缚海盗 `诅咒金币` 的对象级 L3 代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setupCursedCoinUpkeepScenario(...)`，把场景固定到 Guest 的 `discard` 末尾，并让 Host 持有 `3` 层诅咒金币，避免把“当前回合结束者”和“进入 upkeep 的受伤者”搞反。
    - 新增用例“真实入口应展示并结算诅咒金币的维持阶段掉血链”。
    - 截图 `54-host-cursed-coin-upkeep-before-advance.png` 保留掉血前 Host 的诅咒金币状态。
    - 截图 `55-host-cursed-coin-upkeep-applied.png` 保留 Guest 推进后 Host upkeep 结算完成的棋盘与状态区。
- 真实入口收口断言：
  - 由 Guest 在 `discard` 阶段推进回合，真实进入 Host 的 `upkeep`。
  - Host HP 从 `50` 降到 `47`。
  - Host 的 `3` 层诅咒金币保留不移除，Guest HP 仍为 `50`。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算诅咒金币的维持阶段掉血链"`：`1 passed (3.0m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md` 已把 `诅咒金币` 从 `L3 pending` 改为 `L2/L3 representative passed`，并补上 `54-55` 截图目录、人工核对表和验证记录。
- 当前边界更新：
  - `诅咒金币` 不再属于“已做 L2 机制、但没有对象级真实入口”的缺口。
  - 下一批优先对象继续收敛为：战术家的 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`，以及咒缚海盗的 `火药桶`。

## 2026-06-01 20:26

- 继续补咒缚海盗 `火药桶` 的对象级 L3 代表链：
  - `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
    - 新增 `setupPowderKegUpkeepScenario(...)`，把场景固定到 Guest 的 `discard` 末尾，并让 Host 持有 `1` 层火药桶，避免把 upkeep 爆炸和其他历史状态混在一起。
    - 新增用例“真实入口应展示并结算火药桶的维持阶段爆炸链”。
    - 在 Host / Guest 两端 harness 预置随机队列 `0.0`，锁定下一次 `d6` 命中 `1`，只验证 `1-2` 爆炸分支，不把 `6` 转交或 `3-5` 保留链混进同一条代表用例。
    - 截图 `56-host-powder-keg-upkeep-before-advance.png` 保留维持阶段前 Host 持桶状态。
    - 截图 `57-host-powder-keg-upkeep-exploded.png` 保留 Guest 推进后 Host upkeep 爆炸结算后的棋盘与状态区。
- 真实入口收口断言：
  - 由 Guest 在 `discard` 阶段推进回合，真实进入 Host 的 `upkeep`。
  - Host HP 从 `50` 降到 `47`。
  - Host 的火药桶从 `1` 层移除到 `0`，Guest HP 仍为 `50`。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示并结算火药桶的维持阶段爆炸链"`：`1 passed (3.5m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md` 已把 `火药桶` 从 `L3 pending` 改为 `L2/L3 representative passed`，并补上 `56-57` 截图目录、人工核对表和验证记录。
- 当前边界更新：
  - `火药桶` 不再属于“已做 L2 机制、但没有对象级真实入口”的缺口。
  - 上一批收敛出的咒缚海盗对象级高优先缺口已清空；下一批优先回到战术家的 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`。
  - `implementation_in_progress` 继续保留，不能把这次代表链补齐误报成两个新英雄完整完成。

## 2026-06-01 21:40

- 清理战术家 `脱战 / 伴装撤退` 未验证草稿，避免把不稳定证据路径留在主 intake E2E：
  - 复跑 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应展示并结算脱战与伴装撤退"` 后，确认 blocker 已不再只是早先记录的在线房预热超时。
  - 当场景通过直接注入把真实在线房间硬切到 `defensiveRoll` 并塞入响应手牌时，这条路径会出现前端手牌展示不同步/隐藏态风险，导致无法稳定证明“从真实手牌入口打出防御响应牌”。
  - 因此已从 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 撤回：
    - `真实防御阶段入口应展示并结算脱战与伴装撤退`
    - 仅服务该草稿的 `DISENGAGE_CARD_ID` / `TACTICAL_RETREAT_CARD_ID`
    - 仅服务该草稿的 `waitForDamageShieldAtLeast(...)`
    - `setupDefenseEvidenceScenario(...)` 上的临时 `defenderHand` 注入分支
- 当前结论：
  - 这不是“脱战 / 伴装撤退业务已失败”，而是“直接注入 defensiveRoll 的证据路径不可靠”，所以不能回写 evidence，也不能把这条草稿继续留在主 intake 文件里。
  - 后续若继续补这两个对象，应改走“真实攻击流打开防御响应窗口”的正式入口，而不是继续沿用 direct state injection 的防御阶段捷径。
  - `implementation_in_progress` 继续保留；战术家剩余高优先对象仍为 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地`。

## 2026-06-01 22:22

- 继续补战术家对象级 L3，优先挑不依赖防御手牌注入的两条真实入口：
  - `制胜高地`：走玩家板 `ultimate` 槽位。
  - `战术优势`：走被动按钮 `passive-action-zhanshujia-tactical-advantage-5`，并保留 `selectStatus -> selectTargetStatus` 双阶段 UI。
- 为此在 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 新增：
  - `setupHighGroundScenario(...)`
  - `setupTacticalAdvantageTransferScenario(...)`
  - `waitForTokenLimit(...)`
  - 两条新用例与截图 `58-63`
- 真实入口收口结果：
  - `制胜高地`
    - Host 真实看到 `ultimate` 槽位已解析为 `high-ground` 且可点击。
    - 点击并推进后，服务器状态断言 Guest 获得 `锁定 1 / 紧缚 1`，Host 战术优势上限 `5 -> 6` 且战术优势 `2 -> 6`。
  - `战术优势`
    - Host 真实看到“转移状态”被动按钮。
    - 点击后，真实进入 `selectStatus` 选来源，再自动转到 `selectTargetStatus` 选目标。
    - 收口后服务器状态断言：战术优势 `4 -> 0`，P1 的 `bind` 清空，P2 获得 `bind 1`。
- 中途 blocker 已处理，但不外推成仓库级结论：
  - 第一次单跑 `制胜高地` 被当前工作树残留的旧 E2E/Vite 进程压到全局内存预算线下。
  - 已只停止明确属于 `D:\\gongzuo\\webgame\\BoardGame` 当前工作树的残留进程，没有动 `.worktrees\\qidahen` 那组。
  - 之后两条单跑都在托管 isolated runtime 下通过。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过 ultimate 槽位触发并结算制胜高地的前置链"`：`1 passed (4.1m)`。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过战术优势被动按钮完成转移状态双阶段交互"`：`1 passed (4.0m)`。
- 同步回写：
  - `evidence/dicethrone/zhanshujia-cursed-pirate-object-audit-2026-05-31.md`
    - `战术优势` 已改为 `L2/L3 representative passed`
    - `制胜高地` 已改为 `L2/L3 representative passed`
    - 截图目录、人工核对表、验证记录已补 `58-63`
- 当前边界更新：
  - 战术家高优先对象已从 `战术优势 / 紧缚 / 脱战 / 伴装撤退 / 制胜高地` 收窄为 `紧缚 / 脱战 / 伴装撤退`
  - `implementation_in_progress` 继续保留

## 2026-06-01 23:45

- 继续推进战术家 `紧缚` 的真实入口链，但当前没有新增对象级 L3 证据，先把测试噪音收窄：
  - `setupBindOffensiveRollScenario(...)` 现在会清空双方默认手牌/弃牌，避免 `afterRollConfirmed` 响应牌把链路污染成“对手思考中”。
  - `真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理` 现在会在点击 `结算攻击` 后显式处理 `confirmSkip`，并改读 Guest 页本地 harness 状态收口，不再把“一次点击”误当成已离开 `offensiveRoll`。
  - 同一条用例总超时已提升到 `360000`，避免当前 2 人 online 冷启动把整条链直接耗死在 240 秒预算里。
- 通用 helper 也做了最小降噪：
  - `e2e/helpers/dicethrone.ts`
    - `preloadDTMatchRouteModule(...)` 由硬门禁改为 best-effort；预热失败只记 warning，继续正式进房。
- 本轮静态验证已通过：
  - `npx eslint e2e/helpers/dicethrone.ts e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
  - `npx tsc --noEmit --pretty false`
- 当前 blocker 已明确不是 `紧缚` 领域逻辑本身，而是通用 2 人 online 加载：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` 多次失败于 `正在准备对局... / 加载游戏模块...`。
  - 最新浏览器错误已落到 `Failed to fetch dynamically imported module: /src/games/dicethrone/game.ts`。
  - 对照基线 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online match: Can start a game successfully"` 也失败，说明这不是 intake 用例私有问题。
- 当前边界：
  - 不能把 `紧缚` 写成业务未实现。
  - 也不能把 `64-66` 当成已通过截图链回写 evidence。
  - 战术家剩余高优先对象仍是 `紧缚 / 脱战 / 伴装撤退`，`implementation_in_progress` 继续保留。

## 2026-06-01（紧缚收口补记）

- `紧缚` 真实入口链已正式通过，不再停留在“通用 2 人 online 完全阻断”的旧结论：
  - 先修掉测试交互噪音：`applyDiceValues(...)` 后，Guest 页调试面板会遮挡 `dice-confirm-button`；现已在该用例里点确认前显式 `closeDebugPanelIfOpen(match.guestPage)`。
  - 随后修掉测试桥接错误：原收口轮询在 `page.evaluate(...)` 浏览器上下文里直接引用 Node 侧 `STATUS_IDS`，现已改为把 `STATUS_IDS.BIND` 作为参数显式传入。
- 本轮验证：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"`：`1 passed (2.4m)`。
  - 运行中仍会看到 `import-prefetch-play-route` 的 best-effort 预热 warning，但它没有再阻断房间创建、选角、进房和对象级断言。
- 当前结论更新：
  - `64-66` 现在可以作为战术家 `紧缚` 的对象级 L3 代表链回写 evidence。
  - 战术家剩余高优先对象进一步收窄为 `脱战 / 伴装撤退`。
  - `implementation_in_progress` 继续保留，不能把 `紧缚` 收口误报成整批 intake 完成。

## 2026-06-02 02:20

- 继续推进战术家防御响应手牌，先只收 `伴装撤退`，不扩到 `脱战`：
  - 失败根因已明确不是业务未实现，也不是通用 2 人 online 冷启动。
  - 真正命中的问题在测试入口：此前草稿直接派发 `SELECT_ABILITY('soul-stab')`，绕开了当前骰面真实解析出的攻击变体 `soul-stab-3`，所以 `pendingAttack` 根本没被建立。
- 已把 `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 的 `伴装撤退` 用例改成真实攻击槽位入口：
  - 不再手派发基础 ID `soul-stab`。
  - 改为点击 Guest 玩家板上 `data-resolved-ability-id="soul-stab-3"` 的真实可点击槽位。
  - 攻击建立后的断言同步收紧为 `sourceAbilityId: 'soul-stab-3'`。
- 真实链现已通过：
  - Guest 先通过真实 `soul-stab-3` 攻击链建立 `pendingAttack`。
  - Host 自然进入 `defensiveRoll` 后，从真实手牌拖拽打出 `伴装撤退`。
  - 收口断言证明：
    - `card-zhanshujia-tactical-retreat` 进入 Host 弃牌堆；
    - Guest 获得 `bind 1`；
    - Host 获得 `3` 点 `damageShield`。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算伴装撤退"`：`1 passed (2.3m)`。
- 当前边界更新：
  - `伴装撤退` 可以回写为对象级 `L2/L3 representative passed`。
  - 战术家剩余高优先对象进一步收窄为 `脱战`。
  - `implementation_in_progress` 继续保留。

## 2026-06-02 03:00

- 继续沿“真实攻击流打开防御响应窗口”的正式路线收口战术家 `脱战`：
  - 不再尝试 `direct state injection -> defensiveRoll` 捷径。
  - 直接复用已打通的 `soul-stab-3 -> defensiveRoll` 链，让 Host 在自然打开的防御窗口里从真实手牌打出 `脱战`。
- `e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`
  - 新增 `DISENGAGE_CARD_ID = 'card-zhanshujia-disengage'`
  - 新增用例“真实防御阶段入口应通过真实攻击流打出并结算脱战”
  - 用例不再硬锁某个分支，而是先读取真实奖励骰结果，再按军刀 / 旗帜 / 勋章分别断言对应权威状态，避免把随机队列猜测写成业务前提。
- 当前通过 run 的真实证据：
  - Guest 先通过真实 `soul-stab-3` 建立攻击；
  - Host 自然进入 `defensiveRoll`，从真实手牌拖拽打出 `脱战`；
  - 奖励骰覆盖层真实出现；
  - 本次通过 run 命中军刀分支，收口到 Guest HP `50 -> 48`，且 `card-zhanshujia-disengage` 进入 Host 弃牌堆。
- 本轮验证：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：通过。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实防御阶段入口应通过真实攻击流打出并结算脱战"`：`1 passed (2.0m)`。
- 当前边界更新：
  - `脱战` 可以回写为对象级 `L2/L3 representative passed`。
  - 战术家对象级高优先缺口已清空。
  - 但整批 intake 仍未证明“复杂交互逐项 L3/L4 全覆盖”，所以 `implementation_in_progress` 继续保留。

## 2026-06-02 03:20

- 继续做整批 intake 的 completion audit，先验证当前是否还存在新的实现红灯：
  - `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts e2e/helpers/dicethrone.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：通过。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts`：`2 files / 52 tests passed`。
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`：`24 passed (10.0m)`。
- 整文件 E2E 的新结论：
  - 双人选角、对象级代表链、两条防御响应手牌链、4 人 `无情诅咒` 链都在同一轮整文件运行中通过，当前没有新的业务红灯。
  - 运行中仍出现 `import-prefetch-play-route` / `MatchRoomWithAudio.tsx` 预热 warning，但它只是 best-effort 噪音，没有阻断正式进房和 24 条用例通过。
- 当前边界更新：
  - `implementation_in_progress` 继续保留，但剩余原因已从“战术家高优先对象未补齐”切换为“对象级彻底审计仍未为一批 `L1/L2 shared` / `representative` 对象登记合法复用依据或补逐对象 L3/L4”。
  - 下一步不应再把 `紧缚 / 伴装撤退 / 脱战` 当作未完成对象；应改做 requirement-by-requirement completion audit，明确哪些对象可合法复用代表链，哪些必须继续补独立证据或冻结为 `scoped-debt`。

## 2026-06-02 03:32

- 继续做对象级彻底审计，不再新增实现代码，先登记第一批证据足够硬的合法复用对象：
  - `反制措施 II`：已在审计矩阵中改为可复用基础 `反制措施` 的真实入口链。依据是两者共用同一 defensive slot 与 `customActionId=zhanshujia-countermeasures-defense`，差异仅剩 `diceCount=5` 与 `sabrePairDamage=1/2` 参数；5 骰 trigger 与参数化差异已被升级映射和 III 分支机制测试锁定。
  - `凋零`：已登记为 `L2 / representative L3 passed`。依据是深海潜行真实入口截图 `24-26` 已证明前置施加凋零且不打断后续弃牌交互，`啜呼` 的 `39-41` 又补了一条奖励骰分支命中后施加凋零的共享状态链。
  - `劫掠`：已登记为 `L2 / representative L3 passed`。依据是它与深海潜行前置偷 CP 共用同一个 `customActionId=cursed-pirate-steal-one-cp`，截图 `24-26` 和对应服务器断言已经证明该 custom action 的真实 UI/状态闭环。
- 当前边界更新：
  - 剩余审计缺口已进一步从“泛化的复杂交互未逐项 L3/L4”缩小为“还有多少对象能像这三条一样被合法复用登记，以及哪些对象必须保留为独立缺口或 `scoped-debt`”。
  - `implementation_in_progress` 继续保留。

## 2026-06-02 04:05

- 继续做对象级彻底审计，本轮不再碰实现代码，只筛第二批“纯共享消费者组合”对象：
  - 战术家 `摇鼓运动`
    - 重新核对后确认它没有私有 `customAction`、没有奖励骰/目标选择/额外阶段。
    - 真实需要的只剩两段共享消费者：`grantStatus(BIND)` 与 `damage(7)`。
    - 已回写为可合法复用：`67-68` 证明 `bind` 写入落点，`58-59` 证明战术家玩家板攻击入口与伤害收口。
  - 战术家 `战略转移`
    - 重新核对后确认它只由 `grantToken(TACTICAL_ADVANTAGE)` 与 `damage(unblockable)` 组成。
    - 已回写为可合法复用：`18-19` / `60-63` 证明战术优势写入与 UI 落点，`52-53` 证明不可防御伤害收口。
  - 咒缚海盗 `死亡吐息`
    - 重新核对后确认小顺/大顺两变体没有私有 resolver，差异仅剩 `damage=7/10`。
    - 已回写为可合法复用：`24-26` / `39-41` 证明凋零写入，`50-51` / `42-45` 证明火药桶写入，真实攻击入口收口可复用 `深海潜行 / 亡灵之爪`。
- 同时明确不外推的对象：
  - `军刀突刺 / 战争贩子 / 地毯式轰炸 / 起锚 / 虚张声势 / 9 张升级牌`
  - 原因不是它们一定有 bug，而是还带独立 `rollDie`、`customAction`、额外阶段、升级替换或玩家选择入口，本轮证据强度不足以判等。
- 当前边界更新：
  - 审计口径已从“凡 shared 都待补”继续收窄为“纯通用 effect 组合可登记复用，其余仍按独立缺口处理”。
  - `implementation_in_progress` 继续保留。

## 2026-06-02 04:26

- 继续做对象级彻底审计，本轮仍不碰实现代码，只补第三批可保守复用对象：
  - 战术家
    - `包夹侧翼`
      - 重新核对后确认只由 `grantToken(TACTICAL_ADVANTAGE) + damage(6)` 组成。
      - 已回写为可合法复用：`18-19` / `60-63` 证明战术优势写入与读取，`58-59` 证明战术家玩家板攻击入口与伤害收口。
    - `开拓战场`
      - 重新核对后确认只由 `grantToken + grantStatus(BIND) + damage` 组成。
      - 已回写为可合法复用：`18-19` / `60-63` 证明 token，`67-68` 证明 `bind`，`58-59` 证明玩家板攻击收口。
    - `伏击`
      - 重新核对后确认是纯共享手牌 immediate `grantToken`，没有私有 resolver。
      - 已回写为可合法复用：`18-19` 证明真实手牌打牌与战术优势写入，`60-63` 证明 token UI/消耗读写。
  - 咒缚海盗
    - `灵魂指令`
      - 重新核对后确认只由 `grantStatus(PARLEY/POWDER_KEG/WITHER) + damage(unblockable)` 组成。
      - 已回写为可合法复用：`42-45` 证明 `PARLEY/WITHER/POWDER_KEG` 共享状态链，`52-53` 证明不可防御伤害收口。
    - `坏血病`
      - 重新核对后确认是纯共享手牌 immediate `direct self-damage + grantStatus(WITHER)`。
      - 已回写为可合法复用：`46-47` 证明真实手牌打牌后的自伤/弃牌收口，`24-26` / `39-41` 证明凋零写入。
    - `休战`（手牌）
      - 重新核对后确认是纯共享手牌 immediate `grantStatus(PARLEY)`。
      - 已回写为可合法复用：`50-51` 证明真实手牌 main 卡牌写入/弃牌收口，`42-45` 证明 `PARLEY` 状态应用。
- 本轮明确继续保留的独立缺口：
  - 任何带 `rollDie`、私有 `customAction`、状态时序本体、attack modifier、升级替换的对象仍不提级。
  - 例如：`占得上风 / 起锚 / 虚张声势 / 诱饵 / 军刀突刺 II / 咒缚 / 9 张升级牌`。
- 当前边界更新：
  - 合法复用口径已进一步收窄到两类：
    - 纯共享 effect 组合
    - 纯共享手牌 immediate 写入链
  - 其余对象继续按独立缺口保留，`implementation_in_progress` 不变。

## 2026-06-02 04:44

- 继续做对象级彻底审计，本轮新增一条更窄的收口标准：如果某对象已经在别的已通过真实链里被显式当成前置入口消费，而且它本身剩余差异只在 L2 已锁住的参数/附带条件，就允许按 representative L3 收口。
- 依此回写三条对象：
  - `包夹侧翼 II`
    - 与基础 `包夹侧翼` 相比只差战术优势数值 `1 -> 2`。
    - `replaceAbility('flanking', FLANKING_2, 2)` 已由升级映射测试锁定，真实入口与消费者直接复用基础链。
  - `休战` 状态本体
    - L2 已锁定阻断攻击、不阻断直接伤害、phase exit 清理。
    - `无情诅咒` 与手牌 `休战` 已证明 `grantStatus(PARLEY)` 可在真实入口写入目标；开局截图也覆盖状态图标展示合同。
  - `灵魂突刺`
    - `soul-stab-3` 已不是“只有测试里存在”的能力。
    - `67-71` 两条真实防御响应链都显式依赖 Guest 先通过玩家板上的 `soul-stab-3` 打开防御窗口。
    - 三同值附火药桶的差异仍由 L2 机制测试锁定。
- 当前剩余范围继续缩小，但仍未到完成口径：
  - 还留着一批独立 `rollDie / customAction / upgrade branch / common atlas runtime` 对象。
  - `implementation_in_progress` 继续保留。

## 2026-06-03 04:51

- 先把本轮新增的 `通用牌索引` 真实 UI 证据补回正式文档，避免代码/E2E 与审计口径继续脱节：
  - 已回写 `findings.md`：新增“`card-unexpected` 已获真实双玩家手牌 atlas 证据”事实，并把独立缺口列表里的 `通用牌索引` 移除。
  - 已回写 `task_plan.md`：新增 addendum，记录 Host/Guest 手牌各自注入 `card-unexpected`、等待真实加载、以及定点单跑 `1 passed`。
  - 已回写对象审计文档：`卡牌 atlas` 合同、战术家/咒缚海盗两条 `通用牌索引` 行、以及截图 `05/06` 的人工核对说明都已更新为 representative L3 passed。
- 当前对象级高价值剩余缺口继续收窄到：
  - `军刀突刺 / 摇鼓运动 II / 开拓战场 II / 战略转移 II / 诱饵 / 虚张声势`
- 下一步优先候选仍是 `军刀突刺`：
  - 理由是它仍带独立攻击档位语义，不能保守外推，但真实入口链预计比 `诱饵 / 虚张声势` 和多分支升级对象更短。

## 2026-06-03 05:36

- `军刀突刺` 已从“下一步候选”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并进入军刀突刺的攻击链`。
  - 真实链路不是“点槽位后立刻进对手防御”，而是：
    - `fist` 槽位在 3 军刀盘面下解析为 `sabre-thrust-3`
    - 点击后先留在 `offensiveRoll`
    - 再由 Host 推进，才会打开 Guest 的 `still-wet-behind-ears` 防御阶段
  - 把 Guest 防御骰固定成全战利品面后，服务器断言 `Host HP=50 / Guest HP=46`，证明基础 `3 军刀 -> 4 伤害` 主链已在真实 UI 闭环。
- 本轮已同步回写正式文档：
  - `findings.md` 新增 `军刀突刺` 的对象级 L3 代表链事实，并把剩余独立缺口列表继续收窄。
  - `task_plan.md` 新增 addendum，记录 `82-84` 截图、定点单跑结果与真实链路次序。
  - 对象审计文档已把 `军刀突刺` 从 `对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前对象级高价值剩余缺口继续收窄到：
  - `摇鼓运动 II / 开拓战场 II / 战略转移 II / 诱饵 / 虚张声势`

## 2026-06-03 06:18

- `战略转移 II` 已从“候选升级对象”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并结算战略转移 II 的主分支`。
  - 这条链新增确认了一个之前还没有落档的真实 UI 事实：
    - `calm` 槽位在 `4 勋章 + 3 勋章` 同时满足时，不会自动发主分支
    - 会先弹 `选择发动变体` modal
    - 需要玩家显式点 `战略转移 II（4个勋章）`
    - 然后才进入 `strategic-shift-2-main` 的真实收口
  - 收口状态已由服务器断言锁定为：`Host 战术优势=5 / Guest bind=1 / Guest HP=45`
- 本轮已同步回写正式文档：
  - `findings.md` 新增 `战略转移 II` 的对象级 L3 代表链事实，并把剩余独立缺口列表继续收窄。
  - `task_plan.md` 新增 addendum，记录 `85-87` 截图、变体选择 modal 与定点单跑结果。
  - 对象审计文档已把 `战略转移 II` 从 `L2 partial / 分支对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前对象级高价值剩余缺口继续收窄到：
  - `摇鼓运动 II / 开拓战场 II / 诱饵 / 虚张声势`

## 2026-06-03 06:45

- `摇鼓运动 II` 已从“剩余升级对象”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并结算摇鼓运动 II 的主分支`。
  - 真实链路确认点是：
    - `lotus` 槽位在 `3 军刀 + 2 勋章` 盘面下直接解析为 `drum-movement-2-main`
    - 点击后需由 Host 再推进一次
    - 然后才会自然打开 Guest 的 `still-wet-behind-ears` 防御阶段
  - 把 Guest 防御骰固定成全战利品面后，服务器断言 `Host 战术优势=1 / Guest bind=1 / Guest HP=43`，说明主分支的 `grantToken + bind + 7 damage` 已在真实 UI 闭环。
- 本轮已同步回写正式文档：
  - `findings.md` 新增 `摇鼓运动 II` 的对象级 L3 代表链事实，并把剩余独立缺口列表继续收窄。
  - `task_plan.md` 新增 addendum，记录 `88-90` 截图与定点单跑结果。
  - 对象审计文档已把 `摇鼓运动 II` 从 `L1/L2 shared / 对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前对象级高价值剩余缺口继续收窄到：
  - `开拓战场 II / 诱饵 / 虚张声势`

## 2026-06-03 07:03

- `开拓战场 II` 已从“剩余升级对象”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并结算开拓战场 II 的大顺主分支`。
  - 真实链路确认点是：
    - `lightning` 槽位在 `[2,3,4,5,6]` 盘面下会先解析成 `expand-battlefield-2-large-straight`
    - 因为同盘面同时满足 `largeStraight` 与 `lockdown`，真实 UI 不会静默直发，而是先弹 `选择发动变体` modal
    - Host 需要显式选择 `开拓战场 II（大顺子）`，随后再推进到 Guest 的 `still-wet-behind-ears` 防御阶段
  - 把 Guest 防御骰固定成全战利品面后，服务器断言 `Host 战术优势=3 / Guest bind=1 / Guest HP=41`，说明主分支的 `grantToken + bind + 9 damage` 已在真实 UI 闭环。
- 本轮已同步回写正式文档：
  - `findings.md` 已把对象级独立缺口继续收窄到 `诱饵 / 虚张声势`。
  - `task_plan.md` 已新增 addendum，记录 `91-94` 截图与定点单跑结果。
  - 对象审计文档已把 `开拓战场 II` 从 `L2 partial / 分支对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前对象级高价值剩余缺口继续收窄到：
  - `诱饵 / 虚张声势`

## 2026-06-03 07:32

- `虚张声势！` 已从“剩余独立奖励骰对象”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应命中并结算虚张声势的弯刀分支`。
  - 真实链路确认点是：
    - Guest 从真实手牌打出 `虚张声势！`
    - 会真实打开 `bonus-die-overlay`
    - 命中弯刀面时，不是抽牌或施加火药桶，而是对 Host 直接收口 `2` 点伤害
  - 收口断言是 `Host HP 50 -> 48`，同时源卡进入 Guest 弃牌堆，说明 `rollDie -> bonusDamage` 分支已在真实 UI 闭环。
- 本轮已同步回写正式文档：
  - `findings.md` 已把对象级独立缺口继续收窄到只剩 `诱饵`。
  - `task_plan.md` 已新增 addendum，记录 `95-96` 截图与定点单跑结果。
  - 对象审计文档已把 `虚张声势` 从 `L1/L2 shared / 对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前对象级高价值剩余缺口继续收窄到：
  - `诱饵`

## 2026-06-03 08:45

- `诱饵` 已从“最后一个对象级独立缺口”变成“对象级真实入口已打绿”：
  - 已新增并通过用例 `真实入口应展示并结算诱饵的 2 点攻击伤害`。
  - 真实链路确认点是：
    - Guest 先通过真实玩家板 `soul-stab-3` 槽位建立攻击链
    - 再从真实手牌打出 `诱饵`
    - 攻击修正徽标会出现，但该卡不会写 `pendingAttack.bonusDamage / attackModifierBonusDamage`
    - 在仍处于 `offensiveRoll` 时，就会把 Host 直接收口为 `HP 50 -> 48`
  - 收口断言同时覆盖 `Guest CP 5 -> 4`、`card-cursed-pirate-shark-bait` 进入弃牌堆，说明这条攻击修正对象链已经在真实 UI 中闭环。
- 本轮已同步回写正式文档：
  - `findings.md` 已把“剩余独立缺口只剩诱饵”改成“对象级独立高价值缺口已清空”，并补上 `诱饵` 的真实落点不是 `bonusDamage` 的结论。
  - `task_plan.md` 已新增 addendum，记录 `97-99` 截图、定点单跑结果和真实 `soul-stab-3 -> 诱饵` 攻击链结论。
  - 对象审计文档已把 `诱饵` 从 `L1/L2 shared / 对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 对象级高价值独立缺口已清空，但当前仍不能宣称整批完成：
  - `implementation_in_progress` 继续保留。
  - 剩余风险已回到 shared / representative 条目的逐对象合法复用登记、复杂交互 L3/L4 覆盖，以及 DiceThrone runtime 稳定性，不再是新的单对象首条 direct E2E 缺失。

## 2026-06-03 09:24

- `军刀突刺 II` 已从“仍待对象专测”的升级对象变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并结算军刀突刺 II 的三同值紧缚链`。
  - 新增 `setupSabreThrust2Scenario(...)`：
    - 在线场景显式把 Host 的 `sabre-thrust` 替换成 `SABRE_THRUST_2`
    - 同步写入 `abilityLevels['sabre-thrust']=2`
    - 盘面固定为 `3 军刀 + 2 旗帜` 且三个军刀骰值同为 `1`
  - 真实链路确认点是：
    - `fist` 槽位在升级场景下会解析为 `sabre-thrust-2-3`
    - 点击后不会直接跳过当前阶段，而是先留在 `offensiveRoll`
    - 仍需由 Host 再推进一次，才会自然打开 Guest 的 `still-wet-behind-ears` 防御阶段
  - 把 Guest 防御骰固定成全战利品面后，服务器断言 `Host HP=50 / Guest HP=45 / Guest bind=1`，说明升级后的 `5` 点伤害与“三同值施加紧缚”已在真实 UI 闭环。
- 本轮已同步回写正式文档：
  - `task_plan.md` 已新增 addendum，记录 `100-102` 截图与定点单跑结果。
  - `findings.md` 已新增 `军刀突刺 II` 的对象级 L3 代表链事实，并明确它不再属于只能靠 shared 外推的对象。
  - 对象审计文档已把 `军刀突刺 II` 从 `L3 pending` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前边界保持不变：
  - `implementation_in_progress` 继续保留。
  - 这次收口的是单对象升级攻击链，不等于整批 intake 完成；下一步仍应回到 `地毯式轰炸 II` 旗帜 4 分支或 shared / representative 条目的逐对象合法复用登记。

## 2026-06-03 09:41

- `地毯式轰炸 II` 已从“旗帜分支对象专测待补”变成“对象级真实入口已打绿”：
  - 新增并通过用例 `真实入口应通过玩家板槽位触发并结算地毯式轰炸 II 的旗帜分支`。
  - 新增 `setupCarpetBombing2StrategyScenario(...)`：
    - 在线场景显式把 Host 的 `carpet-bombing` 替换成 `CARPET_BOMBING_2`
    - 同步写入 `abilityLevels['carpet-bombing']=2`
    - 牌库固定为 `战略防御！` 与 `占得上风！`
    - 盘面固定为 `4 旗帜 + 1 军刀`
  - 真实链路确认点是：
    - `chi` 槽位在升级场景下会解析为 `carpet-bombing-2-strategy`
    - 点击后不会创建 `pendingAttack`
    - 会直接在真实 UI 中完成 `Host 战术优势=3` 与 `抽 2 张牌`
  - 抽牌落点已由服务器状态与手牌可视化共同锁定：Host 手里真实出现 `战略防御！ / 占得上风！` 两张牌。
- 本轮已同步回写正式文档：
  - `task_plan.md` 已新增 addendum，记录 `103-104` 截图与定点单跑结果。
  - `findings.md` 已新增 `地毯式轰炸 II` 旗帜分支的对象级 L3 代表链事实。
  - 对象审计文档已把 `地毯式轰炸 II` 从 `L2 partial / 旗帜分支对象专测待补` 改成 `L2 / representative L3 | passed`，并补验证命令与截图说明。
- 当前边界保持不变：
  - `implementation_in_progress` 继续保留。
  - 这次收口的是升级复合能力里的旗帜即时分支，不等于整批 intake 完成；后续仍应回到 shared / representative 条目的逐对象合法复用登记、复杂交互 L3/L4 覆盖与 runtime 稳定性。

## 2026-06-03 10:08

- 本轮没有再补新对象 E2E，而是转入 completion audit，核对当前总门禁是否仍准确：
  - 重新核对后确认，`grantStatus` 特例合同的 `L2 partial` 已经过时。
  - 重新核对后确认，`奖励骰/随机` 合同的 `L2 partial` 也已经过时。
- 已回写对象审计文档：
  - `grantStatus` 特例改成 `L2 passed；诅咒金币/火药桶/凋零/休战/紧缚/锁定 为 representative L3`。
  - `奖励骰/随机` 改成 `L2 passed；作战室/占得上风/起锚/战争贩子/战争贩子 II/干票大的/抽筋剥皮/死亡印记/啜呼/瞭望台/虚张声势 为 representative L3`。
  - `对象级 L3/L4 | partial` 的说明已改写为更接近现状：
    - 不再把原因写成“shared / representative 尚未逐对象登记”；
    - 改为“仍有一批对象只达到 representative L3、尚未逐对象独立补满 L3/L4，且 intake runtime 仍缺少稳定重复通过/soak 证据”。
- 当前最重要的新结论：
  - 单对象首条 direct E2E 缺口已经不是主要阻塞。
  - 主要阻塞已进一步收窄为 representative/L4 深度与 runtime 稳定性。
  - `implementation_in_progress` 继续保留。

## 2026-06-03 10:20

- 本轮补了一轮 runtime 基线现状证据：
  - `Online match: Can start a game successfully` 通过。
  - `Online 4-player room: create claim-seat join and start successfully` 也通过。
- 这说明当前 runtime 风险已经不是“简单进房/开局都不稳”，而是更长链路的 soak 问题。
- 对应地，`4 人 online readiness 通用稳定性` 和 `isolated single-worker DiceThrone runtime 启动稳定性` 都应收窄成长跑风险，而不是最小开局必败。
- 当前最重要的新结论：
  - completion audit 继续推进，但 runtime 的最小门槛已经被重新打绿。
  - `implementation_in_progress` 继续保留。

## 2026-06-03 10:34

- 战术家 `战术优势` 的 `C5` 守护已从直接给自己修正为真实 `selectPlayer` 交互，和 `战略防御` 保持同型。
- `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts` 已同步改成先出交互、再选目标、再验收 `TOKEN_IDS.PROTECT`，定点机制测试 45 passed。
- `src/games/dicethrone/rule/战术家录入核对.md` 已把 `tactical_advantage / C5` 从 `L2 partial` 收到 `L2 passed`。
- 同一条测试又补了自选目标边界：`selectPlayer` 既可给自己，也可给其他玩家，不再默认锁死到单一目标。

## 2026-06-03 11:29

- 继续复核战术家 `紧缚` 的旧红链，但这轮没有再改业务代码；现状是旧失败结论已过时：
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应展示紧缚在额外投掷中的 CP 门禁与阶段清理"` 现已 `1 passed`。
  - 同一套文件整跑 `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts` 现已 `39 passed`。
- 这说明前面遗留的“`紧缚` 仍被 2 人 online 加载阻断”不再是当前事实；至少在本轮托管 isolated runtime 下，`64-66` 截图链与整份 intake 已能一起打绿。
- 本轮同步复核 `npx eslint e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts`，通过。
- 当前剩余门禁不变但口径更收窄：
  - `implementation_in_progress` 继续保留。
  - 主要剩余项继续是对象级彻底审计、representative L3 与逐对象 L3/L4 的边界、以及长跑 soak 稳定性，而不是 `紧缚` 或整份 intake E2E 仍旧红。

## 2026-06-03 21:05

- 继续收口咒缚海盗人类面玩家板资源链：
  - 已把 `public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png` 接成运行时别名 `human-player-board.png`，并生成 `compressed/human-player-board.webp`。
  - `npm run assets:manifest` 后，`public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 都已出现 `images/cursed/human-player-board` 与 `images/cursed/compressed/human-player-board`。
  - `src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts` 已补断言：`ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')` 指向 `dicethrone/images/cursed/human-player-board`，且 `human-player-board.png/.webp` 都存在。
- 文档口径同步：
  - `咒缚海盗真相源表.md`、`咒缚海盗录入核对.md`、`咒缚海盗卡牌录入核对.md`、对象审计、`findings.md`、`task_plan.md` 均已改成“咒缚面与人类面两张底图都已接入运行时”。
  - 同时保留真实边界：目前只证明了底图选图链，不证明 normal 面会在真实流程里自动切换，也不证明双面完整机制已经完成。

## 2026-06-03 本轮图面对照

- 已直接比对 `public/assets/i18n/zh-CN/dicethrone/images/cursed/player-board.png` 与 `public/assets/i18n/zh-CN/dicethrone/images/cursed/人类面板.png`。
- 新结论不是“normal 面仍待证明”，而是“normal 面已证实与咒缚面不同”：
  - 人类面技能标题与效果文本明显不同于当前运行时 9 个咒缚面技能。
  - 人类面被动 `咒缚` 也改成“回合结束移除 1 个诅咒金币；无可移除时翻面”的另一套语义。
- 因此当前状态应改读为：
  - 已完成：人类面底图接入、选图链、`海盗的一生` 咒缚/普通面分支。
  - 未完成：normal 面自动翻面流程、9 个玩家板技能的逐槽重录/实现/测试、以及据此重开的对象级审计。

## 2026-06-04 继续纠偏咒缚海盗双面合同

- 旧“初始化为 `cursed`”口径已失效：
  - `src/games/dicethrone/domain/characters.ts` 现已把咒缚海盗开局改为 `playerBoardFace='normal'`。
  - 同时通过 `initialStatusEffects` 写入 `3` 个诅咒金币。
- 旧“诅咒金币持有者维持阶段都掉血”口径也已失效：
  - `src/games/dicethrone/domain/flowHooks.ts` 现已只对非咒缚海盗持有者结算诅咒金币 upkeep 掉血。
- 旧“normal 面 9 个技能对象没有完成逐槽重录、实现、测试和重审计”需要降级：
  - 当前代码里 9 个 human 对象已经全部接入运行时能力集。
  - 其中 `human-cursed / cutlass-stab / make-your-mark / walk-the-plank / astonishing / human-still-wet-behind-ears` 已有 L2 机制测试。
  - `cutlass-stab / make-your-mark / light-the-fuse / verdict-command / astonishing / human-cursed / walk-the-plank / human-still-wet-behind-ears / merciless-plunder` 现已都补到独立真实入口 direct E2E。
  - 当前真正剩余的已经不是 `make-your-mark / human-still-wet-behind-ears` 的独立对象级补证，而是 human 面对象级重审计、双面 completion audit，以及更高层的 L3/L4 收口。
- 本轮复核命令：
  - `npx vitest run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-intake.test.ts src/games/dicethrone/__tests__/ninja-slash-stand-tall-regression.test.ts --configLoader native` -> `3 files / 64 tests passed`
  - `npx tsc -p tsconfig.json --noEmit` -> 通过
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 lotus 槽位触发并结算走跳板的弃牌分支"` -> `1 passed`
  - `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/zhanshujia-cursed-pirate-intake.e2e.ts "真实入口应通过人类面 fist 槽位触发并结算弯刀突刺的四同值火药桶链"` -> `1 passed`
