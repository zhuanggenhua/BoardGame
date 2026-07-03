# 召唤师战争 B7 P3 移动穿越与相邻离开实现对照（2026-07-02）

## 目的

- 承接 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md` 中 7 个已 `locked` 对象。
- 本文件只消费已锁官方合同，不重新读图、不重新 OCR、不重新录入。
- `entangle` 仍为对象归属争议，本轮只登记 `disputed-skip`，不写规则断言测试、不改机制代码。
- 若后续发现合同缺字段、来源冲突或对象归属不清，先回写为 `blocked` / `disputed`，再回录入层补合同。

## 实现对照矩阵

| 对象 | 中文对象 | 已锁合同摘要 | 实现入口 | 证明/测试入口 | 对照结论 | 后续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `climb` | 部落攀爬手「攀爬」 | 本单位移动时可额外移动 1 格，并可穿越建筑；不包含穿越单位 | `abilities-goblin.ts` 定义 `onMove` + `extraMove value=1 canPassThrough='structures'`；`helpers.ts` 的 `getUnitMoveEnhancements` 折算 `extraDistance` 与 `canPassStructures`；`canMoveToEnhanced` 在路径检查中允许建筑通过但仍拒绝单位阻挡 | `abilities-goblin.test.ts` 覆盖 3 格移动、穿越建筑、不能穿越单位；本轮新增 `entity-chain-integrity.test.ts` 真实移动入口边界，确认攀爬可穿建筑但不能穿单位 | `match-with-L4-proof` | 已完成移动穿越代表链边界补证；未改机制实现 |
| `evasion` | 掷术师「迷魂」 | 相邻敌方攻击任意卡牌时，若本次攻击掷出 1 个或更多 special 面，该次攻击减少 1 点伤害 | `abilities-trickster.ts` 定义 `onAdjacentEnemyAttack` + `reduceDamage value=1 condition='onSpecialDice'`；`execute.ts` 在攻击命中计算中检查攻击者相邻敌方 `evasion` 单位，special 面存在时减少 hits，并发 `DAMAGE_REDUCED sourceAbilityId='evasion'` | `entity-chain-integrity.test.ts` 覆盖 special 面正向减伤、无 special 不减伤、迷魂单位不相邻不触发；B7 目标测试命中 `evasion/迷魂` | `match-with-proof` | 不改机制；合同写“any card”，当前攻击链允许单位/建筑目标，已由攻击计算统一消费 |
| `flying` | 葛拉克「飞行」 | 本单位移动时可额外移动 1 格，并可穿越 cards | `abilities-trickster.ts` 定义 `onMove` + `extraMove value=1 canPassThrough='all'`；`helpers.ts` 折算为额外移动、可穿越单位和建筑；`canMoveToEnhanced` 在 `canPassThrough` 为真时允许路径穿越 | `abilities-trickster.test.ts` 覆盖 3 格移动、穿越其他卡牌、非飞行单位不能穿越；本轮新增真实移动入口边界，确认飞行可穿过单位和建筑 | `match-with-L4-proof` | 已完成移动穿越代表链边界补证；未改机制实现 |
| `rebound` | 掷术师「缠斗」 | 每当相邻敌方单位移动或被强制离开本单位时，对该敌方单位加 1 伤害 | `abilities-trickster.ts` 定义 `onAdjacentEnemyLeave` + `damage value=1`；`helpers.ts` 的 `getEntangleUnits` 找到离开前相邻敌方缠斗单位；`execute.ts` 在 `MOVE_UNIT` 和 `UNIT_PUSHED` / `UNIT_PULLED` 路径中比较新旧距离，只在远离时造成 1 伤害 | `entity-chain-integrity.test.ts` 覆盖普通移动离开触发、靠近不触发、多个缠斗单位多次触发；`abilities-trickster-execute.test.ts` 覆盖推拉导致远离时伤害落在推拉后位置；本轮新增真实移动入口负向断言，确认敌方靠近或移动后仍相邻时不误触发缠斗伤害 | `match-with-L4-proof` | 已完成相邻离开代表链负向边界补证；`entangle` 仍 disputed，不拿本行证明城塞骑士归属 |
| `slow` | 寒冰魔像「缓慢」 | 本单位移动距离减少 1 格；不改变单位是否可移动本身 | `abilities-frost.ts` 定义 `onMove` + `extraMove value=-1`；`helpers.ts` 统一把负移动修正计入 `extraDistance`，由 `canMoveToEnhanced` 计算最大移动距离 | `abilities-frost.test.ts` 覆盖只能移动 1 格、相邻空格仍可移动、冲锋与缓慢的正常移动边界；本轮新增真实移动入口断言，确认相邻 1 格可移动、2 格移动被拒绝 | `match-with-L4-proof` | 已完成移动穿越代表链边界补证；未改机制实现 |
| `swift` | 清风弓箭手「迅捷」 | 本单位移动时可额外移动 1 格；不包含穿越能力 | `abilities-trickster.ts` 定义 `onMove` + `extraMove value=1`，未设置 `canPassThrough`；`helpers.ts` 只增加 `extraDistance`，路径阻挡仍按普通单位检查 | `abilities-trickster.test.ts` 覆盖 3 格移动、不能穿越其他卡牌；本轮新增真实移动入口断言，确认 3 格空路径可移动，但路径被单位阻挡时不可移动 | `match-with-L4-proof` | 已完成移动穿越代表链边界补证；未改机制实现 |
| `trample` | 蒙威尊者 / 犀牛 / 熊骑兵「践踏」 | 本单位移动时可穿越 commons；移动后对每个被穿越的 common 加 1 伤害 | `abilities-frost.ts` 定义 `onMove` + `extraMove canPassThrough='units' damageOnPassThrough=1`；`helpers.ts` 读取 `damageOnPassThrough`；`execute.ts` 在 `MOVE_UNIT` 后取 `getPassedThroughUnitPositions` 并对穿越位置发 `UNIT_DAMAGED reason='trample'` | `entity-chain-integrity.test.ts` 覆盖 `damageOnPassThrough` 数据驱动、直线穿越检测、1 格移动不触发、穿越多个单位多次伤害、MOVE_UNIT 穿越伤害；本轮新增真实移动入口断言，确认只伤害路径中间被穿越单位，不伤害移动终点外的单位 | `match-with-L4-proof` | 已完成移动穿越代表链边界补证；当前实现按单位穿越位置结算，若后续发现非 common 也被允许穿越需单列更高层修复 |
| `entangle` | 城塞骑士「缠绕/缠斗」归属争议 | B7 规则合同未能证明城塞骑士承载 Engage/Entangle；本地能力与 `rebound` 共享机制相似，但对象归属未锁 | `abilities-paladin.ts` / `helpers.ts` / `execute.ts` 存在本地 `entangle` 共享链；但这不能替代官方归属合同 | 不引用 `abilities-paladin.test.ts` 或 broad entangle 用例作为规则通过证据 | `disputed-skip` | 未裁定前不得写规则断言测试或改机制代码 |

## 验证

- 首轮命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-frost.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-trickster.test.ts src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts --configLoader native -t "climb|evasion|flying|rebound|slow|swift|trample|攀爬|迷魂|飞行|缠斗|缓慢|迅捷|践踏"`
- 首轮结果：5 个测试文件通过；41 passed / 217 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "movement|trample|rebound|climb|flying|swift|slow|移动|践踏|缠斗|攀爬|飞行|迅捷|缓慢"`
- L4 追加结果：1 个测试文件通过；13 passed / 89 skipped。

## 分流结论

- B7 7 个已锁对象均已完成首轮实现对照；其中 `climb`、`flying`、`rebound`、`slow`、`swift`、`trample` 已追加移动穿越/相邻代表链 L4 边界补证并升级为 `match-with-L4-proof`，`evasion` 保留 `match-with-proof`，后续只在攻击展示或 UI 回放分叉时追加专项。
- `entangle` 继续保持 `disputed-skip`，原因是城塞骑士对象归属未由官方合同锁定。
- 本轮没有发现“已锁官方合同 vs 当前实现链路”的明确冲突，因此没有修改机制实现。
- B7 首轮实现对照不代表全量补审完成；下一步继续后续 `locked` 批次实现对照，不回录入层。
