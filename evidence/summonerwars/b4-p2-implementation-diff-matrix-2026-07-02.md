# 召唤师战争 B4 P2 实现对照首轮矩阵（2026-07-02）

## 目的

- 承接 `b4-p2-rule-text-lock-matrix-2026-07-02.md` 的 5 个 `locked-规则原文已锁` 对象。
- 本文件只做“官方合同子句 → 当前实现入口 → 现有证据/缺口”的首轮分流。
- 本轮不回图片/OCR、不重新录入规则；若发现合同缺字段、对象归属冲突或官方原文不够支撑实现判断，再把对应对象降级为 `blocked` 或 `disputed`。

## 续接门禁

- `locked` 后继续默认进入实现对照、测试补证、真实入口证据或 L3/L4 补证。
- 数据录入质量由合同字段完整性守门；已锁合同不得无故重新读图。
- 只有“官方合同子句”和“当前实现链路”直接冲突时，才写最小失败测试和最小修复。

## 首轮分流矩阵

| 对象 | 中文承载卡 | 官方合同要点 | 当前实现入口 | 现有测试/证据 | 首轮分流 | 后续动作 |
| --- | --- | --- | --- | --- | --- | --- |
| `infection` | 亡灵疫病体 | 本单位摧毁一个单位后；可选；用你弃牌堆中的一个疫病体单位替换被摧毁单位位置 | `abilities.ts` 定义 `onKill` + `hasCardInDiscard(plagueZombie)`；`abilityResolver.ts` 生成 `SUMMON_FROM_DISCARD_REQUESTED`；`systems.ts` 转为感染选牌交互；`executors/necromancer.ts` 已补执行器防御，只允许疫病体且目标格必须为空 | 已有直接激活与执行器防御；本轮新增真实击杀后生成感染选牌交互、选择弃牌堆疫病体后召唤落位、重复响应不再次召唤断言；目标测试通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"`，6 passed / 110 skipped | `fixed-with-L4-proof` | 已补真实击杀后交互闭环；后续只在发现 UI eventStream 重放重复打开交互时追加 UI 专项 |
| `life_drain` | 德拉戈斯 | 攻击前；可选摧毁 2 格内友方单位；若摧毁成功，本次攻击特殊符号等同普通近战命中；不支付成本则不生效 | `abilities.ts` 定义 `beforeAttack`；`execute.ts` 通过 `beforeAttackSpecialCountsAsMelee` 只影响本次攻击；`executors/necromancer.ts` 结算摧毁成本 | 已有 special-only 正负断言；本轮新增攻击前真实选择交互，验证牺牲路径收口并只摧毁一次、重复响应不再次牺牲；目标测试通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"`，6 passed / 110 skipped | `match-with-L4-proof` | 暂不改机制；真实攻击前选择与重复响应防御已补 |
| `soul_transfer` | 亡灵弓箭手 | 你的回合中，距离本单位 3 格内的一个单位被摧毁后；可选；用本单位替换被摧毁单位位置；不限定被摧毁单位归属或击杀者 | 旧实现把 `soul_transfer` 放在 `onKill`，只会在亡灵弓箭手自己击杀时触发；已改为 `onUnitDestroyed`，由当前玩家单位死亡扫描入口触发；`isInRange(victim)` 优先按 `victimPosition` 判断并排除本单位自毁 | 已有触发入口最小修复；本轮新增确认移动真实交互收口、源位置清空、被摧毁位置落位、重复响应不再次移动断言；目标测试通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"`，6 passed / 110 skipped | `fixed-with-L4-proof` | 已补交互层确认收口与重复响应防御；跳过路径后续可并入同类可选交互代表链 |
| `high_telekinesis_instead` | 卡拉 | 代替攻击；可选；3 格内士兵或英雄；不能是召唤师或建筑；Force 目标 1 格 | 与 B1 `high_telekinesis` 共用官方原文和目标类型验证；`abilities-trickster.ts` 声明 `costsAttackAction`；`execute/abilities.ts` 通用主动技能执行链发出攻击行动消耗事件；`reduce.ts` 将源单位标记为已攻击并增加攻击次数 | 已补行动经济断言：高阶念力代替攻击成功推拉时必须产生 `ATTACK_ACTION_CONSUMED`；本轮目标测试同时覆盖既有高阶念力代替攻击直接入口和清风法师二段 UI 代表链；目标测试通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"`，6 passed / 110 skipped | `match-with-L4-proof` | L4 代表链已补：与 `telekinesis_instead` 共用二段选择系统；高阶目标范围/行动经济已有直接断言，UI 二段链由共享代表链覆盖 |
| `telekinesis_instead` | 清风法师 | 代替攻击；可选；2 格内士兵或英雄；不能是召唤师或建筑；Force 目标 1 格 | 与 B1 `telekinesis` 共用官方原文和目标类型验证；`abilities-trickster.ts` 声明 `costsAttackAction`；`execute/abilities.ts` 通用主动技能执行链发出攻击行动消耗事件；`reduce.ts` 将源单位标记为已攻击并增加攻击次数 | 已有行动经济断言；本轮新增真实 UI 二段选择：先选目标、再选方向，成功后目标推拉落位、交互收口、只产生一次 `ATTACK_ACTION_CONSUMED`，重复响应不再次消耗攻击行动；目标测试通过：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "infection|soul_transfer|life_drain|telekinesis_instead|感染|灵魂转移|吸取生命|念力"`，6 passed / 110 skipped | `match-with-L4-proof` | 暂不改机制；真实 UI 二段选择和重复响应防御已补 |

## 当前结论

- B4 已按 `locked` 合同进入实现对照，没有回到图片/OCR。
- `infection` 已完成真实击杀后交互闭环：选弃牌堆疫病体、召唤落位、重复响应不二次召唤。
- `soul_transfer` 已完成确认移动闭环：确认后源位置清空、目标位置落位、重复响应不二次移动。
- `life_drain` 已完成攻击前选择闭环：牺牲路径只摧毁一次，重复响应不二次牺牲。
- `telekinesis_instead` 已完成真实 UI 二段选择闭环：选目标、选方向、推拉落位、只消耗一次攻击行动；`high_telekinesis_instead` 以共享二段系统代表链 + 既有高阶范围/行动经济断言覆盖。
- B4 五个对象 L4 补证已完成；`infection`、`soul_transfer` 为 `fixed-with-L4-proof`；`life_drain`、`telekinesis_instead` 为 `match-with-L4-proof`；`high_telekinesis_instead` 以代表链补证方式归入 `match-with-L4-proof`，不得再按非 L4 缺口续跑。
- 后续继续消费已锁合同，不重新做数据录入；若实现对照暴露合同缺字段或对象归属冲突，再回写合同状态并退回录入层补合同。
