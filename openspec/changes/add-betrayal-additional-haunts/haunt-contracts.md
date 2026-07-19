# Haunt Contracts: 作祟剧本 3 / 12 / 33

> 用途：把官方剧本书条目先拆成可实现、可测试、可审计的结构化合同。本文不是正式实现完成证据；只有对应代码、领域测试、页面/E2E 和审计回写都完成后，才能把对应事件放回正式运行事件牌堆。

## Source Map

| 剧本 | 中文口径 | 触发事件 | 官方源 |
| --- | --- | --- | --- |
| 3 | 灰尘 | 一瓶微尘 / `A VIAL OF DUST` | `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:241` |
| 12 | 大宅饿了 | 大宅饿了 / `The House is Hungry` | `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md:395`；英雄书说明 9-12 是自由混战：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:786` |
| 33 | 魔法相机 | 说“茄子”！ / `Say Cheese` | 英雄侧：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:1968`；叛徒侧：`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md:1563` |

## Haunt 3：灰尘

### Trigger and Team Contract

- 场景卡：无。
- 触发事件：一瓶微尘成功作祟检定后进入剧本 3。
- 阵营：隐藏叛徒。
- 叛徒判定：任何当前或曾经拥有 `1` 号 Sickness token 的玩家永久成为叛徒；即使后来失去该 token，身份也不回退。
- 信息边界：玩家可以看自己的 Sickness token；不能向其他玩家展示 token，只能口头声称。

### Setup Contract

- 每名玩家获得 3 个 Sickness number token。
- 3-5 人局有一个 `1` token；6 人局有两个 `1` token。
- Sickness token 洗混后面朝下发给玩家。
- 怪物卡放在作祟揭露者左侧；怪物回合在作祟揭露者之后。
- 作祟 setup 后由作祟揭露者左侧玩家先行动。

### Runtime Rules

- 所有探险者都可以攻击其他探险者。
- 离开有其他探险者的板块需要 2 点移动。
- Search for a Cure：
  - 条件：玩家在有恶兆符号的板块，且该板块没有 Research token。
  - 掷骰：Knowledge 或 Sanity。
  - 5+：在该板块放置 Rune token，代表 Research。
  - 0-4：随机把自己的一个 Sickness token 与左侧玩家交换。
- Cure the Dust：
  - 条件：玩家在可研究板块。
  - 掷骰：任意属性。
  - 修正：屋内每个 Research token 给本次掷骰 +2。
  - 13+：英雄胜利。
  - 0-12：随机把自己的一个 Sickness token 与左侧玩家交换。
- Control Impulses：
  - 条件：与另一名探险者同板块。
  - 效果：若对方同意，随机交换双方各一个 Sickness token。
- 回合结束：
  - 若与其他探险者同板块，按每名同板块探险者逐个随机交换一个 Sickness token。
  - 若本回合没有通过 Control Impulses 或回合末同板块触发交换，则受到 2 骰 General damage。
- 死亡：
  - Sickness token 数字仍不公开。
  - 若死亡者是叛徒，埋掉物品和预兆，把探险者替换成 Small Monster token，成为 Feverish。
  - 死亡叛徒在怪物回合以 Feverish 行动。
- Feverish 属性：Might 6 / Speed 5 / Sanity 3 / Knowledge 3。

### Win Conditions

- 英雄胜利：Cure the Dust 成功达到 13+。
- 叛徒胜利：所有探险者都成为叛徒或死亡。

### Implementation Requirements

- 新增玩家私有状态：Sickness tokens、是否曾经持有 `1` token、可公开/不可公开视图。
- 新增公共状态：Research token 所在房间、Feverish 怪物、剧本 3 回合末交换/伤害记录。
- 新增命令：Search for a Cure、Cure the Dust、Control Impulses、同意/拒绝 Sickness 交换。
- 新增玩家视图测试：非本人不得看到他人 Sickness token 数字。
- 新增 AI 约束：AI 不得基于隐藏 token 作弊，只能基于自己可见 token 和公共状态行动。

## Haunt 12：大宅饿了

### Trigger and Team Contract

- 场景卡：无。
- 触发事件：大宅饿了成功作祟检定后进入剧本 12。
- 阵营：自由混战。英雄书说明剧本 9-12 只出现在叛徒书里，探险者既不是英雄也不是叛徒。
- 实现前需要明确的产品语义：当前引擎主要按英雄/叛徒两边建模；剧本 12 应新增自由混战角色模型，不能硬塞进首剧本英雄/叛徒二分。

### Setup Contract

- 每名探险者仍在游戏中，并各自按自由混战规则竞争。
- 怪物回合在当前玩家之后。
- Number Track 初始为 3，代表 Ritual Progress。
- 若 Ritual Room 与 Chasm 尚未发现，从房间堆找出并放进 Basement，按正常放置规则连接。
- 在 Ritual Room 放置 Small Monster tokens，作为 Cultists；数量按玩家数为 3/4/5/6。
- 当前行动者治疗全部属性，并获得 Might +1、Speed +1。

### Runtime Rules

- Heavy Burden：
  - 玩家可以拾取并携带 Cultist 或探险者尸体。
  - 同一时间只能携带一具尸体。
- Feed Her：
  - 条件：在 Chasm，且携带尸体。
  - 效果：移除该尸体并进行 Sanity roll。
  - 7+：Number Track -1；若降到 0，当前玩家胜利。
  - 0-6：当前玩家 Sanity +2。
- 回合结束：
  - 每名非当前胜利方探险者承受 1 General damage。
  - 当前玩家回合后进入 Cultists 回合。
- Cultists：
  - Might 5 / Speed 3 / Sanity 3 / Knowledge 3。
  - Cultist 被击败时不是眩晕，而是变成可献祭尸体。

### Win Conditions

- 玩家完成唤醒仪式：Number Track 降到 0。
- 或者其它探险者全部死亡。

### Implementation Requirements

- 新增自由混战胜负模型：每名探险者都可能成为单独胜利方。
- 新增公共状态：Number Track、Cultist token、Cultist corpse、explorer corpse、携带尸体者。
- 新增命令：拾取尸体、Feed Her、Cultist 移动/攻击或怪物回合行动。
- 新增页面状态：自由混战目标、当前携带尸体、Number Track、Chasm/Ritual Room 提示。
- 实现前阻塞点：若当前 `endgame` 结构只支持二元阵营，必须先扩展胜负结果结构。

## Haunt 33：魔法相机

### Trigger and Team Contract

- 场景卡：无。
- 触发事件：说“茄子”！成功作祟检定后进入剧本 33。
- 叛徒来源：按事件牌决定；若有英雄持有魔法相机，该英雄成为叛徒，否则触发事件的探险者成为叛徒。

### Setup Contract

- 叛徒仍在游戏中。
- 在非 Landing 板块放置 Phantom Photographers，按区域尽量均匀分布；数量按玩家数为 2/3/4/5。
- 若 Magic Camera 尚未发现，从物品牌堆找出并正面放到叛徒面前。
- 每名英雄获得自己的 Hero token，代表 Essence。
- 英雄侧无额外 setup。
- setup 后由叛徒左侧玩家先行动。

### Runtime Rules

- Take a Photo：
  - 条件：叛徒与目标英雄同板块；若叛徒持有 Magic Camera，可改为视线内任意英雄。
  - 限制：不能拍摄已经失去 Essence 的英雄。
  - 掷骰：Speed。
  - 6+：拿走目标英雄 Essence，并任选一个自身属性 +1。
  - 0-5：无事发生。
- The Ghost inside the Camera：
  - 叛徒持有 Magic Camera 时，自身属性不能降到 critical 以下。
  - 攻击某英雄时，若叛徒拥有该英雄 Essence，攻击额外 +2 骰。
- Smash the Magic Camera：
  - 条件：英雄与叛徒同板块。
  - 掷骰：Sanity。
  - 6+ 且叛徒持有 Magic Camera：Magic Camera 返回游戏盒，视为被摧毁。
  - 0-5：无事发生。
- Phantom Photographers：
  - Might 4 / Speed 1 / Sanity 6 / Knowledge 2。
  - 以 Sanity 攻击，且可以攻击视线内任意英雄；胜利时目标承受 Mental damage。
  - 受到 Might 攻击造成的伤害时被杀死；其它成功攻击只会使其眩晕。
  - 若英雄在回合结束时处于 Phantom Photographer 视线内且仍有 Essence，则该 Essence 被拿走并放到叛徒角色板。

### Win Conditions

- 英雄胜利：所有 Phantom Photographers 被杀死，且 Magic Camera 被摧毁；在英雄回合末检查。
- 叛徒胜利：所有英雄死亡。

### Implementation Requirements

- 新增公共状态：Phantom Photographer token、Magic Camera 是否被发现/持有/摧毁、每名英雄 Essence 状态。
- 新增命令：Take a Photo、Smash the Magic Camera、摄影师视线攻击。
- 新增规则复用：魔法相机持有物归属、视线判定、怪物眩晕/死亡差异、精神伤害。
- 新增页面状态：可拍摄目标、可摧毁相机动作、摄影师与 Essence 状态。
- 新增 AI 约束：叛徒 AI 会优先拍摄有 Essence 的英雄；英雄 AI 会在可行时优先摧毁相机或击杀摄影师。
- 实现前阻塞点：若当前空间系统没有足够的正式视线判定，必须先补视线规则或在实现前记录阻塞并确认降级口径。

## Cross-Haunt Release Gate

每个剧本从“门禁保护”提升为“正式实现”前，必须同时满足：

1. 结构化合同已覆盖官方源、setup、运行时动作、怪物/标记、胜负条件和玩家视图。
2. 领域测试覆盖触发、核心动作、至少一种英雄胜利和至少一种叛徒/对立胜利或失败条件。
3. 页面或 E2E 代表链覆盖从事件牌成功作祟分支进入剧本，并执行一个关键动作产生可见状态变化。
4. AI 合法动作测试证明 AI 不走未实现动作，也不读取隐藏信息。
5. 半实现审计、事件牌审计和主 spec 视角同步更新。
6. 对应事件牌才允许进入正式运行事件牌堆；未满足前继续保持门禁。

