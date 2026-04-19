# Summoner Wars Phase B 回归复跑（2026-04-18）

## 本轮目的
- 在继续推进 `refactor-summonerwars-local-ui-interactions` 后，重新跑一轮与本次重构最相关的 Summoner Wars E2E。
- 重点覆盖：
  - 事件卡 presenter 系统态优先是否仍可正常打出
  - `before_attack_*`
  - `on_phase_start_*`
  - `after_move_*`

## 成功用例

### 1. 编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截\chant-weaving-before-play.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\编织颂歌：召唤阶段可正常打出且不会被交互忙碌提示误拦截\chant-weaving-after-play.png`
- 肉眼观察：
  - `before` 图里手牌中的“编织颂歌”本体可见，当前仍处于可操作的召唤阶段，没有被未知 interactionBusy 门闩挡住。
  - `after` 图里左侧已经出现“编织颂歌 / 持续效果”标记，说明事件卡已成功打出并进入持续效果区。
  - 两张图之间没有出现“交互忙碌”“无法操作”之类的错误覆盖层，符合本轮“系统态优先 presenter 不误拦”验收口径。

### 2. 结构变换：移动后推拉友方建筑（owner 可见 / guest 隐藏）
- 命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-structure-shift.e2e.ts "建筑转移：移动后推拉友方建筑"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-structure-shift.e2e\建筑转移：移动后推拉友方建筑\建筑转移：移动后推拉友方建筑-structure-shift-owner-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-structure-shift.e2e\建筑转移：移动后推拉友方建筑\建筑转移：移动后推拉友方建筑-structure-shift-guest-hidden.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-structure-shift.e2e\建筑转移：移动后推拉友方建筑\建筑转移：移动后推拉友方建筑-structure-shift-after-move.png`
- 肉眼观察：
  - owner 图顶部出现“结构变换：选择3格内友方建筑”及“跳过”按钮，证明交互对 owner 可见。
  - guest 图未出现对应交互按钮，仍为“等待对手行动”，符合 hidden interaction 预期。
  - after 图中友方建筑从 `(6,4)` 变为 `(5,4)`，证明“选建筑 -> 选落点”流程真实完成。

### 3. 力量颂歌：攻击阶段可打出并完成目标选择
- 命令：
  - `BG_HEAVY_MEMORY_MIN_FREE_GB=0.2 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 BG_HEAVY_CPU_HARD_LIMIT=95 npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "力量颂歌：攻击阶段可打出并完成目标选择"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\力量颂歌：攻击阶段可打出并完成目标选择\chant-power-before-play.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\力量颂歌：攻击阶段可打出并完成目标选择\chant-power-after-play.png`
- 状态断言（E2E 内已验证）：
  - 手牌中的 `barbaric-chant-of-power-0-99` 被正确打出并离开手牌；
  - 目标单位获得 `tempAbilities: ['power_up', ...]`，证明目标结算成功而非仅弃牌。

### 4. 祖灵羁绊：移动后可点击友方单位并完成充能转移
- 命令：
  - `BG_HEAVY_MEMORY_MIN_FREE_GB=0.2 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 BG_HEAVY_CPU_HARD_LIMIT=95 npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-barbaric-abilities.e2e.ts "祖灵羁绊：移动后可点击友方单位并完成充能转移"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\祖灵羁绊：移动后可点击友方单位并完成充能转移\ancestral-bond-before-target.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-barbaric-abilities.e2e\祖灵羁绊：移动后可点击友方单位并完成充能转移\ancestral-bond-after-target.png`
- 状态断言（E2E 内已验证）：
  - 触发移动后交互后，点击友方目标可正常提交；
  - 结算后 `source.boosts=0`、`target.boosts=3`，符合“先充能 1 点 + 转移自身充能”。

### 5. 圣光箭：可以跳过弃牌直接攻击（owner 可见 / guest 隐藏 / skip 收口）
- 命令：
  - `BG_HEAVY_MEMORY_MIN_FREE_GB=0.2 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 BG_HEAVY_CPU_HARD_LIMIT=95 npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-paladin-discard.e2e.ts "圣光箭：可以跳过弃牌直接攻击"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\圣光箭：可以跳过弃牌直接攻击\圣光箭：可以跳过弃牌直接攻击-holy-arrow-skip-owner-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\圣光箭：可以跳过弃牌直接攻击\圣光箭：可以跳过弃牌直接攻击-holy-arrow-skip-guest-hidden.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-paladin-discard.e2e\圣光箭：可以跳过弃牌直接攻击\圣光箭：可以跳过弃牌直接攻击-holy-arrow-skip-after-closeout.png`
- 结论：
  - host 可见弃牌确认/跳过交互，guest 同步视角不可见，符合 hidden interaction；
  - 点击 `Skip` 后交互收口，且玩家魔力保持不变。

### 6. 鲜血符文：选择自伤获得充能（owner 可见 / guest 隐藏）
- 命令：
  - `BG_HEAVY_MEMORY_MIN_FREE_GB=0.2 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 BG_HEAVY_CPU_HARD_LIMIT=95 npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-goblin-abilities.e2e.ts "鲜血符文：选择自伤获得充能"`
- 结果：通过
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-goblin-abilities.e2e\鲜血符文：选择自伤获得充能\鲜血符文：选择自伤获得充能-blood-rune-owner-visible.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-goblin-abilities.e2e\鲜血符文：选择自伤获得充能\鲜血符文：选择自伤获得充能-blood-rune-guest-hidden.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-goblin-abilities.e2e\鲜血符文：选择自伤获得充能\鲜血符文：选择自伤获得充能-blood-rune-after-damage.png`
- 结论：
  - `on_phase_start_blood_rune` 交互可正常出现并处理；
  - 选择自伤后目标单位伤害按预期增加，且 guest 不可见 owner 专属按钮。

## 当前结论
- 本轮 **已重新证明 6 条真实业务链**：`编织颂歌`、`结构变换`、`力量颂歌（攻击阶段）`、`祖灵羁绊（移动后目标点击）`、`圣光箭（攻击前 skip）`、`鲜血符文（阶段开始交互）`。
- `hidden interaction`、`owner/guest 可见性`、`cancel/skip 收口` 在 Summoner Wars 代表链路已有动态证据。
- `ice_ram_target / ice_ram_push` 与 `fire_sacrifice_summon` 的系统态点击路由已修复并由单测覆盖，避免再次落回旧 `ACTIVATE_ABILITY` 本地分支。
- 剩余收口项仅为 Phase B 长尾：`blood_summon` / `annihilate` / `sneak` / `glacial_shift` / `revive_undead` 的真正 `multistep-choice` 通用抽象，不影响本轮“同类点击失效”问题闭环。
