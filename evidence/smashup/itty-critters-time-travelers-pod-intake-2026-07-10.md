# 迷你萌宠与时间旅行者 POD 接入证据（2026-07-10）

## 1. 基本信息

- 游戏：大杀四方（Smash Up）
- 批次：
  - 迷你萌宠（`itty_critters_pod`）
  - 时间旅行者（`time_travelers_pod`）
- OpenSpec：`openspec/changes/add-smashup-itty-critters-time-travelers-pod/`
- 实装现场：`D:\GA\BoardGame-upstream-main-dev-20260601`
- 本文结论日期：`2026-07-10`
- 结论口径：本地代码、数据、manifest、对象级共享链判等和真实入口 E2E 已收口；运行时真正请求的两张 `compressed/*.webp` 仍为 `404`。官方上传器已补齐安全的 `--only` 精确上传能力并实际只尝试这两个对象，但 `.env.example` 中的 R2 配置返回 `Unauthorized`，因此整批发布状态为 `blocked:R2 authorization / remote runtime objects missing`，不得表述为“已完整发布”。

## 2. 批次状态矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 批次状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `itty_critters_pod` | `passed` | `blocked:R2 运行时 WebP 未上传` | `passed` | `passed` | `passed` | `blocked:R2` |
| `time_travelers_pod` | `passed` | `blocked:R2 运行时 WebP 未上传` | `passed` | `passed` | `passed` | `blocked:R2` |

本批次没有发现 POD 规则相对经典版的玩法差异。POD 版仅拥有独立派系 ID、卡牌 ID、基地 ID、卡图 atlas 和多语言可见性；能力、交互、持续效果、力量修正和基地能力通过显式 variant profile 共享，基地池保持独立。

## 3. 权威来源与资源合同

### 3.1 用户源图

| 派系 | 用户源路径 | 文件时间 | 尺寸 | bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| 迷你萌宠 POD | `D:\共享\game\Smash Up! by Mervil (2833984701)\Mods\Images\httpssteamusercontentaakamaihdnetugc1587471759034604409022E3B40EC5D2F2E68709C548E467CF40A69F80C9.png` | `2026-02-25 14:41:56` | `1876 x 2100` | `5,208,504` | `B6650817DAD672723AADCC792D6D8AF5EC07F4891760715B5300F9A1FE17DE19` |
| 时间旅行者 POD | `D:\共享\game\Smash Up! by Mervil (2833984701)\Mods\Images\httpssteamusercontentaakamaihdnetugc1029163221107618800862560B0150B183EBCFC653E87B4B545A0DE26D05.png` | `2026-02-25 14:40:32` | `1876 x 2100` | `4,723,065` | `1793E25B548566F6A8973BA8D09D9C824DC94E593FDF5A7E8963CCA979DDA200` |

两张源图均为 `4 x 5` 等分网格，索引为 row-major：`index = row * 5 + col`。本批次接收日期为 `2026-07-10`；文件时间只用于来源审计，不作为规则版本日期。

### 3.2 正式运行时资源

| 派系 | PNG | WebP | WebP bytes | WebP SHA-256 |
| --- | --- | --- | ---: | --- |
| 迷你萌宠 POD | `public/assets/i18n/zh-CN/smashup/cards/itty_critters_pod.png` | `public/assets/i18n/zh-CN/smashup/cards/compressed/itty_critters_pod.webp` | `621,570` | `5E3E09CBA33325864461A162CE118F5894FE690DF506F3E63A979BDAE61C9E76` |
| 时间旅行者 POD | `public/assets/i18n/zh-CN/smashup/cards/time_travelers_pod.png` | `public/assets/i18n/zh-CN/smashup/cards/compressed/time_travelers_pod.webp` | `740,164` | `BFE451C3B838C03A31B73BF650A93B911882D89ECEC3BE458DC9D3DE3985CA1B` |

运行时 atlas：

| atlasId | 资源键 | grid |
| --- | --- | --- |
| `smashup:itty-critters-pod-cards` | `smashup/cards/itty_critters_pod` | `4 x 5` |
| `smashup:time-travelers-pod-cards` | `smashup/cards/time_travelers_pod` | `4 x 5` |

### 3.3 迷你萌宠 POD 物理槽位合同

| index | 网格 | 图上对象 | 运行时对象 | 物理副本 |
| ---: | --- | --- | --- | ---: |
| 0 | `r1c1` | 我选择你！ | `itty_critters_i_select_you_pod` | 1 |
| 1 | `r1c2` | 进化论 | `itty_critters_evolution_pod` | 1/2 |
| 2 | `r1c3` | 进化论 | `itty_critters_evolution_pod` | 2/2 |
| 3 | `r1c4` | 生物立方 | `itty_critters_critter_cube_pod` | 1 |
| 4 | `r1c5` | 小小百科 | `itty_critters_ittypedia_pod` | 1/2 |
| 5 | `r2c1` | 小小百科 | `itty_critters_ittypedia_pod` | 2/2 |
| 6 | `r2c2` | 召回萌宠 | `itty_critters_recall_critter_pod` | 1 |
| 7 | `r2c3` | 我要得到一切 | `itty_critters_gotta_get_em_all_pod` | 1 |
| 8 | `r2c4` | 战斗训练 | `itty_critters_coach_combat_pod` | 1 |
| 9 | `r2c5` | 超级有效！ | `itty_critters_super_effective_pod` | 1 |
| 10 | `r3c1` | 叶袋兽 | `itty_critters_leafaroo_pod` | 1 |
| 11 | `r3c2` | 金币猫 | `itty_critters_calicoin_pod` | 1 |
| 12 | `r3c3` | 克拉卡蟾 | `itty_critters_krakatoad_pod` | 1 |
| 13 | `r3c4` | 壳震 | `itty_critters_shellshock_pod` | 1 |
| 14 | `r3c5` | 芙露仙灵 | `itty_critters_flooffairy_pod` | 1 |
| 15 | `r4c1` | 塔德波尔 | `itty_critters_tadpour_pod` | 1 |
| 16 | `r4c2` | 导师 | `itty_critters_critter_coach_pod` | 1/3 |
| 17 | `r4c3` | 导师 | `itty_critters_critter_coach_pod` | 2/3 |
| 18 | `r4c4` | 导师 | `itty_critters_critter_coach_pod` | 3/3 |
| 19 | `r4c5` | 宠物冠军 | `itty_critters_critter_champion_pod` | 1 |

### 3.4 时间旅行者 POD 物理槽位合同

| index | 网格 | 图上对象 | 运行时对象 | 物理副本 |
| ---: | --- | --- | --- | ---: |
| 0 | `r1c1` | 时间旅行 | `time_travelers_time_walk_pod` | 1 |
| 1 | `r1c2` | 从头来过 | `time_travelers_do_over_pod` | 1/2 |
| 2 | `r1c3` | 从头来过 | `time_travelers_do_over_pod` | 2/2 |
| 3 | `r1c4` | 时间流逝 | `time_travelers_time_is_fleeting_pod` | 1 |
| 4 | `r1c5` | 令人震惊 | `time_travelers_its_astounding_pod` | 1 |
| 5 | `r2c1` | 静滞立场 | `time_travelers_stasis_field_pod` | 1 |
| 6 | `r2c2` | 时间流动 | `time_travelers_into_the_time_slip_pod` | 1/2 |
| 7 | `r2c3` | 时间流动 | `time_travelers_into_the_time_slip_pod` | 2/2 |
| 8 | `r2c4` | 虫洞 | `time_travelers_wormhole_pod` | 1 |
| 9 | `r2c5` | 千兆瓦 | `time_travelers_1_21_gigawatts_pod` | 1 |
| 10 | `r3c1` | 跳跃者 | `time_travelers_jumper_pod` | 1/4 |
| 11 | `r3c2` | 跳跃者 | `time_travelers_jumper_pod` | 2/4 |
| 12 | `r3c3` | 跳跃者 | `time_travelers_jumper_pod` | 3/4 |
| 13 | `r3c4` | 跳跃者 | `time_travelers_jumper_pod` | 4/4 |
| 14 | `r3c5` | 时间掠夺者 | `time_travelers_time_raider_pod` | 1/3 |
| 15 | `r4c1` | 时间掠夺者 | `time_travelers_time_raider_pod` | 2/3 |
| 16 | `r4c2` | 时间掠夺者 | `time_travelers_time_raider_pod` | 3/3 |
| 17 | `r4c3` | 重复时间者 | `time_travelers_repeater_perfect_pod` | 1/2 |
| 18 | `r4c4` | 重复时间者 | `time_travelers_repeater_perfect_pod` | 2/2 |
| 19 | `r4c5` | 时间博士 | `time_travelers_doctor_when_pod` | 1 |

## 4. 经典版 / POD 判等合同

`src/games/smashup/__tests__/ittyCrittersTimeTravelersPodIntegration.test.ts` 对每个 POD 对象去掉 `_pod` 后定位经典对象，并逐字段比较 `type/name/nameEn/power/count/subtype/ongoingTarget/beforeScoringPlayable/abilityTags/specialLimitGroup`。POD 与经典版允许的差异仅为：

- `id`：POD 使用独立 `_pod` ID。
- `faction`：POD 使用独立派系 ID。
- `previewRef`：POD 使用本批次两张新 atlas。
- 基地：POD 使用独立 `_pod` 基地 ID，但复用既有基地卡图。
- 可见性：经典版仅 `zh-CN`，POD 版不限制 locale。

### 4.1 迷你萌宠逐卡规则子句与完整流程

| POD 对象（经典对象） | 规则子句 | 候选/入口 → 主效果 → 分支/清理 | 证据等级 |
| --- | --- | --- | --- |
| 我选择你！（`itty_critters_i_select_you_pod` ⇄ `itty_critters_i_select_you`） | C1 牌库力量≤3；C2 作为额外随从打出；C3 回合结束仍控制则回牌库底 | 行动入口 → 选随从/基地 → 额外打出 → 可选随从能力 → 临时随从回底合同 | `L0-L4 passed`，本批次 direct E2E |
| 召回萌宠（`itty_critters_recall_critter_pod` ⇄ `itty_critters_recall_critter`） | C1 弃牌堆力量≤2；C2 额外打出；C3 回合结束仍控制则回底 | 弃牌候选 → 基地 → 额外打出 → 回合结束清理 | `L0-L4 shared` |
| 进化论（`itty_critters_evolution_pod` ⇄ `itty_critters_evolution`） | C1 选择己方随从；C2 消灭；C3 彩虹鸟或牌库中力量最多高1；C4 打到原基地 | 随从目标 → 消灭 → 二选一 → 额外打出；非法/过时目标拒绝 | `L0-L4 shared` |
| 我要得到一切（`itty_critters_gotta_get_em_all_pod` ⇄ `itty_critters_gotta_get_em_all`） | C1 弃牌堆按不同名字各选1张随从；C2 洗回牌库 | 多选弃牌 → 按名字去重 → 洗牌；空候选收口 | `L0-L4 shared` |
| 生物立方（`itty_critters_critter_cube_pod` ⇄ `itty_critters_critter_cube`） | C1 场上任意玩家拥有且力量≤3；C2 洗入当前玩家牌库 | 场上目标 → 验证动态力量/owner → 从场上移除并洗牌 | `L0-L4 shared` |
| 超级有效！（`itty_critters_super_effective_pod` ⇄ `itty_critters_super_effective`） | C1 选择打在随从或基地上的行动；C2 摧毁 | 附着行动候选 → 摧毁 → 宿主状态同步 | `L0-L4 shared` |
| 小小百科（`itty_critters_ittypedia_pod` ⇄ `itty_critters_ittypedia`） | C1 对基地打出；C2 你在这里打出随从后该随从本回合+1 | 基地附着 → `onMinionPlayed` → 临时力量 → 回合结束清理 | `L0-L4 shared` |
| 战斗训练（`itty_critters_coach_combat_pod` ⇄ `itty_critters_coach_combat`） | C1 选择己方随从；C2 摧毁同基地力量更低随从 | 己方宿主 → 低力量目标 → 摧毁；无合法目标拒绝 | `L0-L4 shared` |
| 叶袋兽（`itty_critters_leafaroo_pod` ⇄ `itty_critters_leafaroo`） | C1 可选弃牌堆1张牌；C2 洗回牌库 | 打出触发 → 选牌或跳过 → 洗牌/无状态变化 | `L0-L4 shared` |
| 芙露仙灵（`itty_critters_flooffairy_pod` ⇄ `itty_critters_flooffairy`） | C1 可选抓1张牌 | 打出触发 → 抓牌或跳过 → prompt 清理 | `L0-L4 shared`；本批次 E2E 走跳过 |
| 金币猫（`itty_critters_calicoin_pod` ⇄ `itty_critters_calicoin`） | C1 可选；C2 这里另一个随从；C3 放1枚+1指示物 | 目标筛选 → 加标记或跳过；有目标时仍允许跳过 | `L0-L4 shared` |
| 塔德波尔（`itty_critters_tadpour_pod` ⇄ `itty_critters_tadpour`） | C1 可选；C2 这里另一个随从；C3 移到另一个基地 | 随从 → 目标基地 → 移动；跳过与 stale target 收口 | `L0-L4 shared` |
| 克拉卡蟾（`itty_critters_krakatoad_pod` ⇄ `itty_critters_krakatoad`） | C1 可选这里另一个随从；C2 本回合+2 | 目标 → 临时力量 → 回合结束清理；可跳过 | `L0-L4 shared` |
| 导师（`itty_critters_critter_coach_pod` ⇄ `itty_critters_critter_coach`） | C1 可选搜牌库力量≤2；C2 打到这里；C3 回合结束仍控制则回底 | 搜索或跳过 → 额外打出 → 临时随从回底合同 | `L0-L4 shared` |
| 壳震（`itty_critters_shellshock_pod` ⇄ `itty_critters_shellshock`） | C1 可选；C2 本基地另一个力量≤2随从；C3 摧毁 | 合法目标 → 摧毁或跳过；自身与高力量目标排除 | `L0-L4 shared` |
| 宠物冠军（`itty_critters_critter_champion_pod` ⇄ `itty_critters_critter_champion`） | C1 天赋；C2 搜牌库力量≤2；C3 额外打到这里；C4 回合结束仍控制则回底 | 天赋入口 → 搜索/基地固定 → 额外打出 → 临时随从清理 | `L0-L4 shared` |

### 4.2 时间旅行者逐卡规则子句与完整流程

| POD 对象（经典对象） | 规则子句 | 候选/入口 → 主效果 → 分支/清理 | 证据等级 |
| --- | --- | --- | --- |
| 令人震惊（`time_travelers_its_astounding_pod` ⇄ `time_travelers_its_astounding`） | C1 弃牌堆行动；C2 作为额外行动打出 | 弃牌行动 → 目标链透传 → 额外行动结算；动态候选与 owner 保真 | `L0-L4 shared` |
| 时间流逝（`time_travelers_time_is_fleeting_pod` ⇄ `time_travelers_time_is_fleeting`） | C1 基地计分后 special；C2 基地弃牌堆有候选；C3 选择替换基地 | reaction → 候选基地 → 写入 scoring replacement → finalize 替换；单候选自动化 | `L0-L4 shared` |
| 时间流动（`time_travelers_into_the_time_slip_pod` ⇄ `time_travelers_into_the_time_slip`） | C1 场上一张牌；C2 返回拥有者手牌 | 场上随从/行动候选 → owner 手牌 → 后续 returned-to-hand trigger | `L0-L4 shared` |
| 千兆瓦（`time_travelers_1_21_gigawatts_pod` ⇄ `time_travelers_1_21_gigawatts`） | C1 选择行动或随从类型；C2 弃牌堆该类型全部洗回 | 类型选择/单类型自动 → 按真实 owner 洗回各牌库；伪造类型拒绝 | `L0-L4 shared` |
| 从头来过（`time_travelers_do_over_pod` ⇄ `time_travelers_do_over`） | C1 自己在基地的随从回手；C2 可作为额外随从重打；C3 只能重打刚返回对象 | 行动目标 → 回 owner 手牌 → extra-minion prompt → 重打或跳过 → prompt 清理 | `L0-L4 passed`，本批次 direct E2E |
| 跳跃者（`time_travelers_jumper_pod` ⇄ `time_travelers_jumper`） | C1 从场上进入弃牌堆；C2 可返回手牌；C3 owner/controller 分离 | 移区事件 → optional reaction → owner 手牌或让过；非弃牌目的地不触发 | `L0-L4 shared` |
| 静滞立场（`time_travelers_stasis_field_pod` ⇄ `time_travelers_stasis_field`） | C1 对基地打出；C2 禁止计分；C3 拥有者回合开始摧毁 | 附着 → scoring gate → turn-start 清理 | `L0-L4 shared` |
| 时间掠夺者（`time_travelers_time_raider_pod` ⇄ `time_travelers_time_raider`） | C1 天赋；C2 弃牌堆任意1张；C3 放牌库底 | 天赋 → 选择/单候选自动 → 按真实 owner 放底；空候选反馈 | `L0-L4 shared` |
| 时间旅行（`time_travelers_time_walk_pod` ⇄ `time_travelers_time_walk`） | C1 本回合额外随从+行动；C2 抓2；C3 本牌放牌库底而非弃牌 | 行动入口 → 写入两类额度 → 抓牌 → source 回底 → 回合末额度清理 | `L0-L4 shared` |
| 重复时间者（`time_travelers_repeater_perfect_pod` ⇄ `time_travelers_repeater_perfect`） | C1 弃牌堆行动1张；C2 放牌库顶 | 打出触发 → 选择/单候选自动 → 按真实 owner 放顶；空候选反馈 | `L0-L4 shared` |
| 虫洞（`time_travelers_wormhole_pod` ⇄ `time_travelers_wormhole`） | C1 基地计分后 special；C2 选择任意数量己方随从；C3 洗回牌库而非弃牌 | reaction → 多选/空选 → 选中对象按 owner 洗牌 → scoring 清场 finalize | `L0-L4 shared` |
| 时间博士（`time_travelers_doctor_when_pod` ⇄ `time_travelers_doctor_when`） | C1 可选场上另一个己方随从回手；C2 可作为额外随从重打；C3 不能选自身 | 打出触发 → 选择或跳过 → 回 owner 手牌 → 重打或跳过 → 清理 | `L0-L4 shared` |

### 4.3 POD 基地与复用泰坦

| 对象 | 规则子句 | 身份/资源合同 | 证据等级 |
| --- | --- | --- | --- |
| 宠物战斗俱乐部（`base_critter_combat_club_pod`） | C1 每回合额外打出一个力量≤2随从到这里；C2 回合结束仍控制则回底 | 独立 POD 基地 ID；复用 `smashup:base8#4`；共享经典基地能力 | `L0-L4 shared`，经典 direct E2E |
| 小城市（`base_itty_city_pod`） | C1 每回合第一次在这里打出随从后；C2 可将弃牌堆随机随从洗回牌库 | 独立 POD 基地 ID；复用 `smashup:base8#5`；共享经典基地能力 | `L0-L4 shared`，经典 direct E2E |
| 联结点（`base_the_nexus_pod`） | C1 基地计分后由赢家选择；C2 若可，从基地弃牌堆选基地替换 | 独立 POD 基地 ID；复用 `smashup:base9#0`；共享经典基地能力 | `L0-L4 shared` |
| 传送门（`base_portal_room_pod`） | C1 赢家可选；C2 当前回合后插入额外回合；C3 恢复原顺位 | 独立 POD 基地 ID；复用 `smashup:base9#1`；共享经典基地能力 | `L0-L4 shared` |
| 彩虹鸟（`itty_critters_rainboroc`） | C1 赢得基地后可打到替换基地；C2 每回合首次在这里打出力量≤2随从后加力量指示物；C3 天赋洗回弃牌堆低力量随从，若如此可移动 | 不创建 `_pod` 泰坦；`getFactionTitans(itty_critters_pod)` fallback 到经典泰坦 | `L0-L4 shared` |
| 时间盒子（`time_travelers_time_box`） | C1 不在场时回合开始或牌从场上/弃牌堆回手加计数；C2 第5枚及以后可清空并打出；C3 天赋额外低力量随从和/或额外行动 | 不创建 `_pod` 泰坦；`getFactionTitans(time_travelers_pod)` fallback 到经典泰坦 | `L0-L4 passed`，本批次 E2E 验证 reaction 让过 |

## 5. L4 共享链判等矩阵

POD profile 对 `ability / interaction / ongoing / baseAbility / powerModifier` 的默认关系均为 `shared`，`basePool` 为 `separate`。所有 POD 卡牌 ID 去掉 `_pod` 后命中经典 family，且静态玩法字段逐卡相等，因此下面的深层证据复用只存在“身份与卡图配置不同”，不存在规则或 handler 分歧。

| 对象组 | 代表链 | 是否仅配置不同 | 判等依据 | POD 剩余差异 |
| --- | --- | --- | --- | --- |
| 迷你萌宠 16 个唯一卡牌对象 | `src/games/smashup/__tests__/abilities/itty-critters.test.ts`；`e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` | 是 | `_pod` 归一化、逐字段相等、注册键存在、POD direct “我选择你！”链 | 独立 ID、atlas、faction |
| 时间旅行者 12 个唯一卡牌对象 | `src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`；本批次 direct “从头来过”链 | 是 | `_pod` 归一化、逐字段相等、注册键存在、最终状态和 skip 路径命中 | 独立 ID、atlas、faction |
| 迷你萌宠 2 个基地 | 经典基地能力与 `smashup-baokemeng-big-in-japan.e2e.ts` | 是 | `baseAbility=shared`、POD 基地规则文本相同、独立 base pool | 独立 base defId |
| 时间旅行者 2 个基地 | `yuanhouFactionAbilities.test.ts` 的联结点/传送门 scoring-finalize 链 | 是 | `baseAbility=shared`、POD 基地规则文本相同、独立 base pool | 独立 base defId |
| 彩虹鸟 | `itty-critters.test.ts`、`smashup.smoke.test.ts`、reaction queue tests | 是 | 派系 fallback 返回同一 `itty_critters_rainboroc` 定义 | 无 POD 泰坦副本 |
| 时间盒子 | `yuanhouFactionAbilities.test.ts`、`smashup.smoke.test.ts`、commands/reaction tests；本批次 reaction 截图 | 是 | 派系 fallback 返回同一 `time_travelers_time_box` 定义 | 无 POD 泰坦副本 |

## 6. 共享消费合同

| 消费面 | POD 写入/标识 | 实际消费点 | 自动证据 | 结论 |
| --- | --- | --- | --- | --- |
| Variant family | `*_pod` | `normalizeSmashUpVariantFamilyId` 去掉 `_pod` | integration test 逐对象判等 | `passed` |
| Ability registry | POD 卡牌注册键 | 能力初始化按归一化 family 绑定 handler | 断言 `i_select_you_pod::onPlay`、`critter_champion_pod::talent`、`time_walk_pod::onPlay`、`time_raider_pod::talent` | `passed` |
| Interaction | POD source card / POD faction | 共享 simple-choice、reaction、extra-play handler | POD direct E2E；经典对象深层测试 | `passed` |
| Ongoing / modifier | POD ongoing card ID | shared ongoing/power modifier surface | variant profile + 经典 L2/L4 | `passed` |
| Base ability | `_pod` base IDs | 归一化后进入经典 base ability | integration base-pool + 经典基地测试 | `passed` |
| Base pool | `_pod` faction | 只返回 `_pod` 基地 ID | integration test | `passed` |
| Titan fallback | POD faction | `getFactionTitans` 返回经典泰坦 | integration test + E2E 时间盒子 reaction | `passed` |
| Atlas | POD atlas ID | `atlasCatalog` 解析 `4 x 5` 图集 | atlas/index test + 派系预览 E2E | `passed` |
| Critical preload | POD faction | `smashUpCriticalImageResolver` | integration test + `.atlas-shimmer = 0` | `passed` |
| Manifest | PNG/WebP key | AssetLoader locale-aware variant | 两级 manifest 校验 | `passed(local)` |
| R2/CDN | 两个 `official/i18n/zh-CN/.../compressed/*.webp` 运行时对象 | Cloudflare CDN | 精确上传返回 `Unauthorized`；2026-07-11 复核仍无 `HEAD 200` | `blocked` |

命中审计维度：`D1` 语义保真、`D2` 边界完整、`D3` 数据流闭环、`D5` 交互完整、`D6` 副作用传播、`D8` 时序正确、`D9` 重入/去重、`D10` 元数据一致、`D12` 写入-消耗对称、`D14` 回合清理、`D15` UI 状态同步、`D18` 否定路径、`D19` 组合场景、`D35` 交互上下文、`D36` deferred/finalize、`D37` 动态候选、`D38` owner/controller、`D43` 变体共享合同。

## 7. Manifest 与远端发布

### 7.1 本地 manifest

两级 manifest 均已有以下键：

- `cards/itty_critters_pod`
- `cards/compressed/itty_critters_pod`
- `cards/time_travelers_pod`
- `cards/compressed/time_travelers_pod`

根 i18n manifest 对应键：

- `zh-CN/smashup/cards/itty_critters_pod`
- `zh-CN/smashup/cards/compressed/itty_critters_pod`
- `zh-CN/smashup/cards/time_travelers_pod`
- `zh-CN/smashup/cards/compressed/time_travelers_pod`

### 7.2 计划远端对象与 2026-07-10 回查

| 运行时对象 | 正式 URL | HEAD |
| --- | --- | --- |
| 迷你萌宠 WebP | `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/itty_critters_pod.webp` | `404` |
| 时间旅行者 WebP | `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/time_travelers_pod.webp` | `404` |

阻塞证据：

- 仓库根目录没有 `.env`，仅有 `.env.example`。
- 当前进程没有 R2/AWS/Cloudflare/S3 凭据环境变量；同仓库其他 worktree 也没有 `.env` / `.env.local`。
- `.env.example` 含 R2 配置值，但实际请求返回 `Unauthorized`，不能作为有效授权。
- `scripts/assets/upload-to-r2.js` 已新增 `--only <official/path...>` 精确对象模式、`--selection-plan` 无网络预演、目录穿越/源 PNG/`--sync` 拒绝和失败非零退出码。
- 精确预演只列出两张运行时 WebP；合同测试 `2 passed`。
- 已实际执行：

```text
node scripts/assets/upload-to-r2.js --only \
  official/i18n/zh-CN/smashup/cards/compressed/itty_critters_pod.webp \
  official/i18n/zh-CN/smashup/cards/compressed/time_travelers_pod.webp \
  --force-upload --skip-android-package-publish
```

- 实际结果：`上传 0，失败 2`，两个对象均为 `Unauthorized`，修正后的进程退出码为 `1`。
- 当前工作区包含其他并行 POD 资源；精确模式已保证没有扫描或上传它们。
- 最小补救动作是：在当前 worktree 根目录提供有效 R2 `.env`（或等价环境变量），原样复跑上面的两对象命令，再对两条运行时 URL 执行 `HEAD 200`。

2026-07-11 复核：

- 当前 worktree 仍为 `D:\GA\BoardGame-upstream-main-dev-20260601`，仓库根目录没有 `.env`。
- 当前进程仍没有 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME` 环境变量。
- 两张本地运行时 WebP 仍存在：`itty_critters_pod.webp` 为 `621570` bytes，`time_travelers_pod.webp` 为 `740164` bytes。
- 对两条正式 URL 执行 `curl -I -L --max-time 20` 均返回 `Recv failure: Connection was reset`，没有取得 `HEAD 200` 或可核对的 `Content-Length`。
- 因此本批次仍只差 R2/CDN 两张运行时 WebP 发布，不得勾选 OpenSpec `2.4`。

## 8. 真实入口 E2E 与截图核验

E2E：

```text
npm run test:e2e:ci:file -- smashup-itty-critters-time-travelers-pod.e2e.ts "真实选秀后渲染两张 POD 图集并完成代表玩法链"
1 passed
用例耗时 20.7s
总耗时 27.0s
```

正式截图目录：

`D:\GA\BoardGame-upstream-main-dev-20260601\test-results\evidence-screenshots\smashup\smashup-itty-critters-time-travelers-pod.e2e\真实选秀后渲染两张-POD-图集并完成代表玩法链\`

| 截图 | 肉眼观察 |
| --- | --- |
| `01-迷你萌宠POD-派系预览.jpg` | 迷你萌宠 POD 16 个唯一对象完整显示，卡图无白板。 |
| `02-时间旅行者POD-派系预览.jpg` | 时间旅行者 POD 12 个唯一对象完整显示，卡图无白板。 |
| `03-双POD派系-开局完成.jpg` | 两个 POD 派系完成真实选秀；手牌、基地、彩虹鸟和时间盒子资源可见。 |
| `04-我选择你-触发前.jpg` | 行动位于真实手牌，两个 POD 基地均已渲染。 |
| `05-我选择你-随从选择中.jpg` | 牌库只暴露合法的低力量候选，导师被排除。 |
| `06-我选择你-结算后.jpg` | 芙露仙灵已落到宠物战斗俱乐部，牌库中不再保留该实例。 |
| `07-从头来过-触发前.jpg` | 跳跃者位于传送门，行动位于真实手牌。 |
| `08-从头来过-额外随从选择.jpg` | 返回手牌后出现只针对刚返回跳跃者的额外随从交互，并允许跳过。 |
| `09-时间盒子-反应让过.jpg` | 跳跃者回手触发共享 reaction 选择层；时间盒子显示“可触发”并可合法让过。顶部同时残留三条通用“请选择一个随从来附着此卡”提示；它没有对应本轮 POD 规则或失败状态证据，记录为独立 UI 噪音观察项，不在本轮擅自修改共享 toast 逻辑。 |
| `10-从头来过-让过后收口.jpg` | 跳跃者留在手牌，基地上已移除，`sys.interaction.current` 清空。 |

E2E 在派系预览、两次 `setupScene` 后和最终收口处均断言 `.atlas-shimmer = 0`。等待上限为 90 秒，用于覆盖远端/本地 atlas 冷加载重试；失败信息会报告具体 `atlasId/index/title`。

## 9. 验证矩阵

| 验证 | 结果 |
| --- | --- |
| POD focused Vitest | `passed`：`1` file，`9` tests，`4.95s` |
| `npm run i18n:check` | `passed`：no missing keys |
| `npm run typecheck` | `passed` |
| Smash Up manifest validate | `passed`：incremental validate |
| root i18n manifest validate | `passed`：incremental validate |
| OpenSpec strict validate | `passed`：change is valid |
| POD 真实入口 E2E | `passed`：`1` test，测试 `20.7s`，总计 `27.0s` |
| R2 精确对象选择合同 | `passed`：`2` tests；只选两张 WebP，拒绝源 PNG 与越界路径 |
| R2 实际精确上传 | `blocked`：两个对象均 `Unauthorized`，退出码 `1`；2026-07-11 复核仍缺少有效 R2 凭据与 `HEAD 200` 远端证据 |

## 10. 禁止假阳性与残余范围

- 没有用“派系能选”代替能力验证：POD direct E2E 覆盖了派系选秀、atlas、开局、我选择你、从头来过、可选跳过、时间盒子 reaction 和最终权威状态。
- 没有用经典 ID 冒充 POD ID：数据定义、手牌、场上对象和 ability registry 均使用 `_pod` 卡牌身份。
- 没有复制泰坦造成双重触发：彩虹鸟和时间盒子只复用经典定义。
- 没有把基地池共享：经典派系只取经典基地，POD 派系只取 `_pod` 基地。
- 没有以截图白板为完成证据：截图前显式等待所有 atlas shimmer 清零。
- 没有把本地 manifest 当成远端发布：截至 2026-07-11，两条运行时 WebP URL 仍没有 `HEAD 200` 证据。
- 当前唯一未收口项为 R2/CDN 两张运行时 WebP 发布；没有发现新的玩法 `scoped-debt`。
- 第 09 张截图顶部的重复附着提示仅记录为独立 UI 噪音观察项；当前没有证据证明它由两个 POD 派系、POD atlas、variant binding、从头来过或时间盒子触发，因此不把范围扩展到共享 toast 逻辑。

## 11. 对外汇报口径

可以表述：

> 迷你萌宠 POD 与时间旅行者 POD 的本地代码、卡图、独立卡牌/基地身份、共享玩法绑定、复用泰坦、两级 manifest、对象级审计和真实入口 E2E 已完成。官方上传器已支持安全的两对象精确上传，但现有 R2 配置返回 Unauthorized，两张运行时 WebP 仍为 404，因此发布链仍阻塞，尚不能称为完全上线。

禁止表述：

> 两个 POD 派系已完整发布 / CDN 已完成 / 全部任务已无阻塞。
