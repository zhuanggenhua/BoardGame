# 召唤师战争 B8 P3/P4 静态、召唤与死亡实现对照（2026-07-02）

## 目的

- 承接 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md` 中 6 个已 `locked` 对象。
- 本文件只消费已锁官方合同，不重新读图、不重新 OCR、不重新录入。
- 若后续发现合同缺字段、来源冲突或对象归属不清，先回写为 `blocked` / `disputed`，再回录入层补合同。

## 实现对照矩阵

| 对象 | 中文对象 | 已锁合同摘要 | 实现入口 | 证明/测试入口 | 对照结论 | 后续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `sacrifice` | 地狱火教徒「献祭」 | 本单位被摧毁后，对每个死亡前相邻敌方单位加 1 伤害；不影响友方或非相邻单位 | `abilities.ts` 定义 `onDeath`；`execute/helpers.ts` 的 `emitDestroyWithTriggers` 把死亡前位置传入触发上下文；`abilityTargets.ts` 解析死亡前相邻敌方；`execute.ts` / 后处理链注入死亡触发；`postProcessDeathChecks` 用已摧毁单位集合阻止同一单位重复注入死亡链 | `entity-chain-integrity.test.ts` 覆盖死亡前相邻敌方受伤、相邻友方和非相邻敌方不受伤；`abilities-frost.test.ts` 覆盖践踏致死后触发献祭后续；新增 `[sacrifice/L4]` 覆盖重复致死伤害后处理只注入一次献祭连锁、旁观者只被伤害/摧毁一次、血腥狂怒只充能一次；B8 目标测试命中 `sacrifice/献祭` | `match-with-L4-proof` | 已补连锁死亡重复消费断言；不改机制 |
| `cold_snap` | 奥莱格「寒流」 | 友方建筑 +1 生命；官方原文没有范围限制 | `abilities-frost.ts` 定义 `passive auraStructureLife value=1`；`abilityResolver.ts` / 结构有效生命计算按当前棋盘动态消费友方建筑生命光环；先前实现对照已移除旧 3 格范围限制 | `implementation-audit-first-pass-findings-2026-07-02.md` 记录 cold_snap 先红后绿最小修复；`entity-chain-integrity.test.ts` 覆盖友方建筑有效生命 +1、移除奥莱格后回到基础生命；新增 `[cold_snap/L4]` 覆盖新建筑进场、建筑离场、建筑归属变化、奥莱格离场后的动态重算；B8 目标测试命中 `cold_snap/寒流` | `fixed-with-L4-proof` | 已修复范围冲突并补动态重算断言；不改机制 |
| `fire_sacrifice_summon` | 伊路特-巴尔「火祀召唤」 | 支付召唤费用时必须额外摧毁一个友方单位，并用本单位替换被摧毁单位位置 | `abilities.ts` 定义 `onSummon`；`validate.ts` / `execute.ts` 在 `SUMMON_UNIT` 中识别 `fire_sacrifice_summon`、要求 `sacrificeUnitId`、拒绝敌方/召唤师等非法牺牲品，并把召唤位置替换为牺牲品位置 | `abilities-advanced.test.ts` 覆盖召唤时消灭友方单位并放置到牺牲品位置；`implementation-audit-first-pass-findings-2026-07-02.md` 记录缺少牺牲品、牺牲敌方单位等负向补证；新增 `[fire_sacrifice_summon/L4]` 覆盖系统交互只列己方非召唤师、确认后只扣费/牺牲/召唤一次、重复响应不二次结算；B8 目标测试命中 `fire_sacrifice_summon/火祀召唤` | `match-with-L4-proof` | 已补真实交互候选过滤、最终状态和重复响应边界；不改机制 |
| `living_gate` | 寒冰魔像「活体传送门」 | 本卡是传送门；应作为召唤入口/传送门语义被消费者识别 | `abilities-frost.ts` 定义 `living_gate`；`helpers.ts:getValidSummonPositions` 把己方活体传送门单位加入召唤位置来源，敌方活体传送门不为己方提供位置 | `abilities-frost.test.ts` 覆盖己方活体传送门相邻空格可作为召唤位置、敌方活体传送门不提供己方召唤位置；新增 `[gather_power/living_gate/L4]` 覆盖己方活体传送门召唤位、敌方活体传送门不提供己方召唤位，以及该入口召唤祖灵法师后只给被召唤单位充能；B8 目标测试命中 `living_gate/活体传送门` | `match-with-L4-proof` | 已补活体传送门作为特殊召唤入口时的归属边界；不改机制 |
| `mobile_structure` | 寒冰魔像「活体结构」 | 本卡可以移动；不能按普通建筑禁止移动 | `abilities-frost.ts` 定义 `mobile_structure`；`helpers.ts:canMoveToEnhanced` 按单位移动校验处理寒冰魔像；`execute.ts` 后处理把 `mobile_structure` 的移动纳入结构移动后续链；`abilityResolver.ts` 的寒冰箭/高阶寒冰箭/寒流等结构消费者按当前棋盘把活体结构单位视作友方建筑 | `abilities-frost.test.ts` 覆盖活体结构仍可移动；`implementation-audit-first-pass-findings-2026-07-02.md` 记录结构移动消费者链已找到；新增 `[mobile_structure/L4]` 覆盖寒冰魔像移动后按新位置作为友方建筑被寒冰箭消费，旧位置不残留结构加成；B8 目标测试命中 `mobile_structure/活体结构` | `match-with-L4-proof` | 已补真实移动后结构消费者读取新位置、旧位置不残留；不改机制 |
| `soulless` | 亡灵疫病体「无魂」 | 本单位摧毁敌方单位时，不获得魔法 | `execute.ts` 在攻击结算时读取攻击者 `soulless`，致死伤害携带 `skipMagicReward`；`execute/helpers.ts` 将该标记传递到 `UNIT_DESTROYED`；`reduce.ts` 在 `UNIT_DESTROYED` 里用 `skipMagicReward` 阻止击杀者获得魔法 | `abilities-advanced.test.ts` 覆盖疫病体攻击消灭敌方时不增加魔法、普通单位攻击消灭敌方时正常不带跳过标记；`reduce.test.ts` 覆盖 `skipMagicReward` 时 `UNIT_DESTROYED` 不给击杀者魔法；新增 `[soulless/L4]` 覆盖真实击杀后最终魔力状态：无魂击杀不加魔力，普通单位同场景击杀加 1 魔力；B8 目标测试命中 `soulless/无魂` | `match-with-L4-proof` | 已补最终状态魔力奖励边界；不改机制 |

## 验证

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-advanced.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/reduce.test.ts --configLoader native -t "cold_snap|fire_sacrifice_summon|living_gate|mobile_structure|sacrifice|soulless|寒流|火祀召唤|火祭召唤|活体传送门|活体结构|献祭|无魂"`
- 结果：3 个测试文件通过、1 个测试文件被目标过滤跳过；23 passed / 168 skipped。
- L4 追加验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "sacrifice|献祭|连锁"` 通过，1 个测试文件通过，5 passed / 88 skipped。
- L4 追加验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "cold_snap|寒流"` 通过，1 个测试文件通过，6 passed / 88 skipped。
- L4 追加验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "gather_power|living_gate|聚能|活体传送门"` 通过，1 个测试文件通过，3 passed / 100 skipped。
- L4 追加验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "soulless|无魂"` 通过，1 个测试文件通过，3 passed / 101 skipped。
- L4 追加验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "fire_sacrifice_summon|火祀|伊路特"` 通过，1 个测试文件通过，1 passed / 133 skipped。
- L4 追加验证：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-frost.test.ts --configLoader native -t "mobile_structure|活体结构|寒冰魔像"` 通过，1 个测试文件通过，11 passed / 28 skipped。

## 分流结论

- B8 六个已锁对象完成首轮实现对照。
- `cold_snap` 为 `fixed-with-L4-proof`：先前已根据已锁合同移除旧 3 格范围限制，本轮补建筑进出场/归属变化/奥莱格离场动态重算断言并通过目标测试。
- `sacrifice`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`soulless` 已升级为 `match-with-L4-proof`。
- 本轮没有重新读图/OCR，没有新增机制修复；只消费 B8 locked 合同并汇总既有补证与目标测试结果。
- B8 首轮实现对照不代表全量补审完成；下一步继续后续 locked 对象或更高层 L3/L4 补证，不回录入层。
