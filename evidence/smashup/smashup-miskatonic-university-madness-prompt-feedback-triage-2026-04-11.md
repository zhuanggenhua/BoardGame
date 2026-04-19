# 大杀四方反馈核查：米斯卡塔尼克大学“抓两张疯狂卡”提示（2026-04-11）

- 反馈 ID：`69d8afdf70d52ddbd0c190e8`
- 用户原话：`经常会触发是否摸两张疯狂牌的选项`
- 结论：**按当前快照与规则实现复核，这是米斯卡塔尼克大学基地的正常触发，不是独立 bug，本条应关闭为 `closed`。**

## 线上事实

### 1. 生产快照里的触发基地就是米斯卡塔尼克大学
通过生产 Mongo 读取 `stateSnapshot` 后，得到：

- `base2DefId = base_miskatonic_university_base`
- 当前玩家 `currentPlayerId = 0`
- `player0.minionsPlayedPerBase = { "2": 1 }`
- `player0MadnessInHand = 0`
- `madnessDeckLength = 28`
- `base2` 上本回合新打出的己方随从是 `frankenstein_igor`（日志展示名“科学小怪蛋”）

这说明：用户当时正好**本回合第一次把随从打到米斯卡塔尼克大学**，且场上仍有疯狂牌库，因此满足基地能力触发条件。

### 2. 生产动作日志与上面状态一致
生产 `actionLog` 最近记录包含：

- `[16:07:15] 游客3729: 随从登场： 科学小怪蛋  → 米斯卡塔尼克大学`
- 更早一条同基地记录：`[16:06:31] AI 2 号位: AI 2 号位 抽取2张疯狂卡 （原因： 米斯卡塔尼克大学 ）`

说明这个“抓两张疯狂卡”并不是无来源乱弹，而是明确由**米斯卡塔尼克大学基地能力**触发。

## 代码核对

核对实现：`src/games/smashup/domain/baseAbilities_expansion.ts`

`base_miskatonic_university_base` 的 `onMinionPlayed` 明确写的是：

- 每回合一次
- 在你打出一个随从到这里后
- 若疯狂牌库还有牌，可选“抓两张疯狂卡”
- 若手里有疯狂牌，可选“弃一张疯狂卡并额外打出行动”

而当前线上快照满足：

- 首次打到该基地：`minionsPlayedPerBase[2] === 1`
- 仍有疯狂牌库：`madnessDeckLength = 28`
- 手牌没有疯狂牌，所以这次主要会出现“抓两张疯狂卡”选项

## 本地验证

已复跑现有定向测试，证明当前实现本来就要求在该条件下弹出该 Prompt：

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native -t "第一次打出随从到这里时生成分支选择 Prompt"`

结果：通过。

## 收口判断

本条更像是**规则提示被误认为异常**，不是当前代码的误触发：

- 触发基地匹配
- 触发时机匹配
- 动作日志匹配
- 现有实现与测试匹配

因此本条应按**非 bug / 正常规则触发**关闭，状态建议：`closed`。
