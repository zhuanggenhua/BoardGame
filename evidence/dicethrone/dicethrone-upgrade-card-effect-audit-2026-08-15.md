# DiceThrone 升级牌打出行为全量专项审查

## 基本信息

- 对象：Dice Throne 当前 `HEROES_DATA` 注册表内全部 `type: 'upgrade'` 卡牌。
- 日期：2026-08-15。
- 文档类型：`audit`。
- 关联反馈：用户反馈“炽天使升级技能之后会自动用一次技能”；用户随后明确要求“没有任何升级牌会这样，全面审查”。

## 审计范围

- 本轮覆盖文件：
  - `src/games/dicethrone/heroes/index.ts`：角色注册表，作为对象全集来源。
  - `src/games/dicethrone/heroes/*/cards.ts`：升级牌静态定义。
  - `src/games/dicethrone/domain/rules.ts`：`PLAY_UPGRADE_CARD` 合法性检查。
  - `src/games/dicethrone/domain/executeCards.ts`：升级牌打出事件生产。
  - `src/games/dicethrone/domain/effects.ts`：`replaceAbility` 转成 `ABILITY_REPLACED`。
  - `src/games/dicethrone/domain/reduceCards.ts`：升级槽、技能等级和卡牌离手写入。
  - `src/games/dicethrone/__tests__/card-cross-audit.test.ts`：本轮新增全量结构与行为门禁。
- 本轮覆盖对象：
  - 14 个已注册角色。
  - 119 张升级牌。
  - 118 张普通技能升级牌：`type: 'upgrade'` 且含 `replaceAbility`。
  - 1 张特殊响应升级牌：工匠 `upgrade-artificer-shock-bot-2`，只在待结算伤害窗口响应，不走普通 `PLAY_UPGRADE_CARD`。
- 本轮覆盖共享链路：
  - 普通升级壳：主阶段打出升级牌 -> 扣 CP -> 卡牌离手 -> `replaceAbility` -> `ABILITY_REPLACED` -> `abilityLevels` / `upgradeCardByAbilityId` 写入。
  - 负向事件：普通升级牌打出时不应产生 Token、状态、伤害、治疗、选择窗、目标选择、奖励骰重投或奖励骰结果事件。
- 明确不在本轮范围内：
  - 不重做所有升级后技能本体效果的完整规则审查；升级后技能本体属于“被替换后的能力 seam”。
  - 不跑真实 UI E2E 或截图链；本轮是代码注册表全集 + 领域行为验证。
  - 不复核卡图、图集槽位或玩家板覆盖槽位；这些仍归已有卡图/槽位证据。

### 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞本轮专项结论 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 真实 UI E2E / 截图链未跑 | `非阻塞扩展` | 否 | 否，本轮锁的是领域命令行为 | 当前范围外 | 如需线上玩家入口证据，另跑 Dice Throne 升级牌真实入口 E2E |
| 升级后技能本体效果未逐项重审 | `非阻塞扩展` | 否 | 否，本轮只审打出升级牌不自动结算技能效果 | 当前范围外 | 各英雄技能本体 / replacement ability 专项审查 |
| 工匠 `upgrade-artificer-shock-bot-2` 非普通升级壳 | `非阻塞扩展` | 否 | 否，已作为响应专用例外单列 | 当前范围内例外 | 工匠响应窗口专项证据 |

## 结论等级

结论等级：`结构审计通过`。

判定理由：当前注册表内 118 张普通技能升级牌都通过同一条 `PLAY_UPGRADE_CARD` 领域行为测试，打出后只产生升级壳相关结果，未发现其它普通技能升级牌会在升级时自动结算技能效果。工匠 `upgrade-artificer-shock-bot-2` 是唯一非 `replaceAbility` 升级牌，已被单独限制为响应窗口牌，主阶段普通升级入口会拒绝它。

## 权威来源

- 主真相源：`HEROES_DATA` 当前注册表，路径 `src/games/dicethrone/heroes/index.ts`。
- 结构定义源：各英雄 `cards.ts` 里的 `type: 'upgrade'`、`effects`、`replaceAbility(targetAbilityId, newAbilityDef, newAbilityLevel)`。
- 领域执行源：
  - `checkPlayUpgradeCard(...)` 要求普通升级牌必须含 `replaceAbility`，且只能在 `main1/main2` 打出。
  - `executeCardCommand(..., PLAY_UPGRADE_CARD)` 只扣 CP、产生 `CARD_PLAYED`，再把升级牌 effects 交给效果系统。
  - `resolveEffectToEvents(..., replaceAbility)` 只生成 `ABILITY_REPLACED`。
  - `handleAbilityReplaced(...)` 写入新技能定义、技能等级和 `upgradeCardByAbilityId`。
- 对照源：
  - `src/games/dicethrone/rule/炽天使卡牌录入核对.md`：明确炽天使复合升级牌下半区是升级后技能分支，不是打出升级牌时即时效果。
  - `src/games/dicethrone/rule/工匠卡牌录入核对.md`：明确 `upgrade-artificer-shock-bot-2` 是响应型升级牌。

## 对象全集

| 角色 | 升级牌总数 | 普通技能升级牌 | 特殊响应升级牌 |
| --- | ---: | ---: | --- |
| monk | 10 | 10 | 无 |
| barbarian | 10 | 10 | 无 |
| pyromancer | 10 | 10 | 无 |
| moon_elf | 10 | 10 | 无 |
| shadow_thief | 8 | 8 | 无 |
| paladin | 10 | 10 | 无 |
| gunslinger | 9 | 9 | 无 |
| samurai | 9 | 9 | 无 |
| treant | 7 | 7 | 无 |
| ninja | 8 | 8 | 无 |
| zhanshujia | 9 | 9 | 无 |
| cursed_pirate | 0 | 0 | 无 |
| artificer | 9 | 8 | `upgrade-artificer-shock-bot-2` |
| tianshi | 10 | 10 | 无 |
| 合计 | 119 | 118 | 1 |

补充对账：`COMMON_CARDS` 当前共有 18 张通用牌，其中 `type: 'upgrade'` 数量为 0。

## 规则子句表

| 子句 | 规则含义 | 实现入口 | 命中 D 维度 | 证据 |
| --- | --- | --- | --- | --- |
| C1 | 普通技能升级牌必须通过 `replaceAbility` 替换基础技能 | `cards.ts` -> `replaceAbility` -> `checkPlayUpgradeCard` | D1 / D3 | 全量结构测试检查 118 张普通升级牌 |
| C2 | 普通升级牌目标必须是基础技能 ID，不能指向变体或下半区子技能 | `getBaseAbilityId(targetAbilityId)` | D1 / D3 / D8 | `card-cross-audit.test.ts` 全量断言 |
| C3 | 打出升级牌只执行升级壳：扣 CP、离手、替换技能、写入升级槽 | `executeCards.ts` / `effects.ts` / `reduceCards.ts` | D3 / D7 / D12 | 领域行为测试断言 `ABILITY_REPLACED` 和 `upgradeCardByAbilityId` |
| C4 | 打出普通升级牌时不应自动结算下半区技能效果 | `PLAY_UPGRADE_CARD` 行为测试的禁止事件集合 | D1 / D8 / D18 | 禁止 `TOKEN_GRANTED`、`STATUS_APPLIED`、`DAMAGE_DEALT`、`HEAL_APPLIED`、`INTERACTION_REQUESTED`、`CHOICE_REQUESTED`、`BONUS_DICE_REROLL_REQUESTED`、`BONUS_DIE_ROLLED` |
| C5 | 非 `replaceAbility` 升级牌只能是明确响应窗口例外 | `checkPlayUpgradeCard` / `playCondition.pendingDamage` | D2 / D5 / D8 | 工匠 `upgrade-artificer-shock-bot-2` 主阶段普通升级入口返回 `upgradeCardCannotPlay` |

## 完整技能流程矩阵

| 对象类型 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 118 张普通技能升级牌 | `HEROES_DATA` + 各英雄 `cards.ts` | `type='upgrade'` + `replaceAbility` | 主阶段 `PLAY_UPGRADE_CARD` | `executeCardCommand` 产生 CP / CARD / ABILITY 事件 | CP 足够，等级未满，目标技能匹配 | `ABILITY_REPLACED` 写入能力等级和升级槽 | 不产生 Token/状态/伤害/治疗/选择窗/奖励骰事件 | `sys.interaction.current` 无残留 | L1/L2 | 通过 |
| 工匠响应专用升级牌 | 工匠卡牌录入核对 + `cards.ts` | `type='upgrade'`，无 `replaceAbility`，有 `pendingDamage` | 响应窗口，不是普通主阶段升级入口 | `PLAY_UPGRADE_CARD` 被拒绝 | 需要待结算伤害窗口 | 防止即将受到的伤害 | 主阶段不应被当作升级壳 | N/A | L1/L2 | 例外成立 |

## 逐项结论

| 角色 | 卡牌 | 目标基础技能 | 新等级 | 证据层级 | 结论 |
| --- | --- | --- | ---: | --- | --- |
| monk | card-meditation-3 | meditation | 3 | L1/L2 | passed |
| monk | card-meditation-2 | meditation | 2 | L1/L2 | passed |
| monk | card-zen-fist-2 | calm-water | 2 | L1/L2 | passed |
| monk | card-storm-assault-2 | thunder-strike | 2 | L1/L2 | passed |
| monk | card-combo-punch-2 | taiji-combo | 2 | L1/L2 | passed |
| monk | card-lotus-bloom-2 | lotus-palm | 2 | L1/L2 | passed |
| monk | card-mahayana-2 | harmony | 2 | L1/L2 | passed |
| monk | card-thrust-punch-2 | fist-technique | 2 | L1/L2 | passed |
| monk | card-thrust-punch-3 | fist-technique | 3 | L1/L2 | passed |
| monk | card-contemplation-2 | zen-forget | 2 | L1/L2 | passed |
| barbarian | card-thick-skin-2 | thick-skin | 2 | L1/L2 | passed |
| barbarian | card-slap-2 | slap | 2 | L1/L2 | passed |
| barbarian | card-slap-3 | slap | 3 | L1/L2 | passed |
| barbarian | card-all-out-strike-2 | all-out-strike | 2 | L1/L2 | passed |
| barbarian | card-all-out-strike-3 | all-out-strike | 3 | L1/L2 | passed |
| barbarian | card-powerful-strike-2 | powerful-strike | 2 | L1/L2 | passed |
| barbarian | card-reckless-strike-2 | reckless-strike | 2 | L1/L2 | passed |
| barbarian | card-suppress-2 | suppress | 2 | L1/L2 | passed |
| barbarian | card-steadfast-2 | steadfast | 2 | L1/L2 | passed |
| barbarian | card-violent-assault-2 | violent-assault | 2 | L1/L2 | passed |
| pyromancer | card-magma-armor-2 | magma-armor | 2 | L1/L2 | passed |
| pyromancer | card-magma-armor-3 | magma-armor | 3 | L1/L2 | passed |
| pyromancer | card-fireball-2 | fireball | 2 | L1/L2 | passed |
| pyromancer | card-burning-soul-2 | soul-burn | 2 | L1/L2 | passed |
| pyromancer | card-hot-streak-2 | fiery-combo | 2 | L1/L2 | passed |
| pyromancer | card-meteor-2 | meteor | 2 | L1/L2 | passed |
| pyromancer | card-pyro-blast-2 | pyro-blast | 2 | L1/L2 | passed |
| pyromancer | card-pyro-blast-3 | pyro-blast | 3 | L1/L2 | passed |
| pyromancer | card-burn-down-2 | burn-down | 2 | L1/L2 | passed |
| pyromancer | card-ignite-2 | ignite | 2 | L1/L2 | passed |
| moon_elf | upgrade-elusive-step-2 | elusive-step | 2 | L1/L2 | passed |
| moon_elf | upgrade-eclipse-2 | eclipse | 2 | L1/L2 | passed |
| moon_elf | upgrade-blinding-shot-2 | blinding-shot | 2 | L1/L2 | passed |
| moon_elf | upgrade-entangling-shot-2 | entangling-shot | 2 | L1/L2 | passed |
| moon_elf | upgrade-exploding-arrow-3 | exploding-arrow | 3 | L1/L2 | passed |
| moon_elf | upgrade-exploding-arrow-2 | exploding-arrow | 2 | L1/L2 | passed |
| moon_elf | upgrade-covering-fire-2 | covering-fire | 2 | L1/L2 | passed |
| moon_elf | upgrade-deadeye-shot-2 | covert-fire | 2 | L1/L2 | passed |
| moon_elf | upgrade-longbow-3 | longbow | 3 | L1/L2 | passed |
| moon_elf | upgrade-longbow-2 | longbow | 2 | L1/L2 | passed |
| shadow_thief | upgrade-pickpocket-2 | pickpocket | 2 | L1/L2 | passed |
| shadow_thief | upgrade-kidney-shot-2 | kidney-shot | 2 | L1/L2 | passed |
| shadow_thief | upgrade-shadow-defense-2 | shadow-defense | 2 | L1/L2 | passed |
| shadow_thief | upgrade-dagger-strike-2 | dagger-strike | 2 | L1/L2 | passed |
| shadow_thief | upgrade-shadow-dance-2 | shadow-dance | 2 | L1/L2 | passed |
| shadow_thief | upgrade-steal-2 | steal | 2 | L1/L2 | passed |
| shadow_thief | upgrade-cornucopia-2 | cornucopia | 2 | L1/L2 | passed |
| shadow_thief | upgrade-fearless-riposte-2 | fearless-riposte | 2 | L1/L2 | passed |
| paladin | card-holy-defense-3 | holy-defense | 3 | L1/L2 | passed |
| paladin | card-holy-defense-2 | holy-defense | 2 | L1/L2 | passed |
| paladin | card-holy-light-2 | holy-light | 2 | L1/L2 | passed |
| paladin | card-righteous-combat-3 | righteous-combat | 3 | L1/L2 | passed |
| paladin | card-righteous-combat-2 | righteous-combat | 2 | L1/L2 | passed |
| paladin | card-blessing-of-might-2 | blessing-of-might | 2 | L1/L2 | passed |
| paladin | card-holy-strike-2 | holy-strike | 2 | L1/L2 | passed |
| paladin | card-vengeance-2 | vengeance | 2 | L1/L2 | passed |
| paladin | card-righteous-prayer-2 | righteous-prayer | 2 | L1/L2 | passed |
| paladin | card-tithes-2 | tithes | 2 | L1/L2 | passed |
| gunslinger | upgrade-revolver-2 | revolver | 2 | L1/L2 | passed |
| gunslinger | upgrade-bounty-hunter-2 | bounty-hunter | 2 | L1/L2 | passed |
| gunslinger | upgrade-showdown-2 | showdown | 2 | L1/L2 | passed |
| gunslinger | upgrade-showdown-3 | showdown | 3 | L1/L2 | passed |
| gunslinger | upgrade-fan-the-hammer-2 | fan-the-hammer | 2 | L1/L2 | passed |
| gunslinger | upgrade-take-cover-2 | take-cover | 2 | L1/L2 | passed |
| gunslinger | upgrade-deadeye-2 | deadeye | 2 | L1/L2 | passed |
| gunslinger | upgrade-duel-2 | duel | 2 | L1/L2 | passed |
| gunslinger | upgrade-quick-draw | quick-draw | 2 | L1/L2 | passed |
| samurai | upgrade-katana-slice-2 | katana-slice | 2 | L1/L2 | passed |
| samurai | upgrade-katana-slice-3 | katana-slice | 3 | L1/L2 | passed |
| samurai | upgrade-wakizashi-2 | wakizashi | 2 | L1/L2 | passed |
| samurai | upgrade-wakizashi-3 | wakizashi | 3 | L1/L2 | passed |
| samurai | upgrade-solemnity-2 | solemnity | 2 | L1/L2 | passed |
| samurai | upgrade-budo-2 | budo | 2 | L1/L2 | passed |
| samurai | upgrade-masamune-2 | masamune | 2 | L1/L2 | passed |
| samurai | upgrade-slot-06-2 | samurai-slot-06 | 2 | L1/L2 | passed |
| samurai | upgrade-stand-tall-2 | stand-tall | 2 | L1/L2 | passed |
| treant | upgrade-tend-care-2 | tend-care | 2 | L1/L2 | passed |
| treant | upgrade-rooted-2 | rooted | 2 | L1/L2 | passed |
| treant | upgrade-shattering-fist-3 | shattering-fist | 3 | L1/L2 | passed |
| treant | upgrade-nature-touch-2 | nature-touch | 2 | L1/L2 | passed |
| treant | upgrade-vengeful-vines-2 | vengeful-vines | 2 | L1/L2 | passed |
| treant | upgrade-wild-growth-2 | wild-roar | 2 | L1/L2 | passed |
| treant | upgrade-shattering-fist-2 | shattering-fist | 2 | L1/L2 | passed |
| ninja | upgrade-blink-2 | blink | 2 | L1/L2 | passed |
| ninja | upgrade-going-forward-2 | going-forward | 2 | L1/L2 | passed |
| ninja | upgrade-slash-2 | slash | 2 | L1/L2 | passed |
| ninja | upgrade-shadow-step-2 | shadow-step | 2 | L1/L2 | passed |
| ninja | upgrade-smoke-screen-2 | smoke-screen | 2 | L1/L2 | passed |
| ninja | upgrade-shadow-fang-2 | shadow-fang | 2 | L1/L2 | passed |
| ninja | upgrade-poison-blade-2 | poison-blade | 2 | L1/L2 | passed |
| ninja | upgrade-death-blossom-2 | death-blossom | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-countermeasures-3 | countermeasures | 3 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-countermeasures-2 | countermeasures | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-strategic-shift-2 | strategic-shift | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-expand-battlefield-2 | expand-battlefield | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-flanking-2 | flanking | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-drum-movement-2 | drum-movement | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-carpet-bombing-2 | carpet-bombing | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-war-monger-2 | war-monger | 2 | L1/L2 | passed |
| zhanshujia | upgrade-zhanshujia-sabre-thrust-2 | sabre-thrust | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-tinker-2 | tinker | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-overclock-2 | overclock | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-shock-bot-3 | shock-bot | 3 | L1/L2 | passed |
| artificer | upgrade-artificer-activate-bots-2 | activate-bots | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-eureka-2 | eureka | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-schematics-2 | schematics | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-wrench-strike-2 | wrench-strike | 2 | L1/L2 | passed |
| artificer | upgrade-artificer-collect-parts-2 | collect-parts | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-supreme-power-2-gospel-arrival | supreme-power | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-divine-punishment-2-divine-command | divine-punishment | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-divine-purification-2 | divine-purification | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-archangel-resolve-2-divine-protection | archangel-resolve | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-angelic-cloak-3 | angelic-cloak | 3 | L1/L2 | passed |
| tianshi | upgrade-tianshi-angelic-cloak-2 | angelic-cloak | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-triumphant-return-2 | triumphant-return | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-holy-radiance-2-takeoff | holy-radiance | 2 | L1/L2 | passed |
| tianshi | upgrade-tianshi-holy-blade-3-cherub-2 | holy-blade | 3 | L1/L2 | passed |
| tianshi | upgrade-tianshi-holy-blade-2-cherub | holy-blade | 2 | L1/L2 | passed |

### 特殊响应升级牌例外

| 角色 | 卡牌 | 使用窗口 | 普通升级入口结果 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| artificer | upgrade-artificer-shock-bot-2 | 待结算伤害响应窗口 | `checkPlayUpgradeCard` 返回 `upgradeCardCannotPlay` | L1/L2 | 例外通过 |

## 测试语义对账

| 测试 | 断言的现实结果 | 不证明什么 |
| --- | --- | --- |
| 所有普通技能升级牌必须命中基础技能，而不是技能变体或技能子集 | 每张普通升级牌都有 `replaceAbility`，且目标是基础技能 ID | 不证明升级后技能本体每个骰型分支都正确 |
| 非 `replaceAbility` 的特殊升级牌必须显式限制为响应窗口卡牌，不能走 `PLAY_UPGRADE_CARD` | 工匠 `电弧盾` 是响应专用升级牌，普通升级入口拒绝 | 不证明工匠响应窗口完整 UI 链 |
| 所有英雄都必须区分升级卡=替换技能与行动卡=直接结算效果 | 普通升级牌不能混入直接效果；行动牌不能误写成 `replaceAbility` | 不证明行动牌所有直接效果都完整 |
| 所有普通技能升级牌通过 `PLAY_UPGRADE_CARD` 打出时只执行升级壳，不自动结算技能效果 | 118 张普通升级牌真实走领域命令后，有 `ABILITY_REPLACED`，无 Token/状态/伤害/治疗/选择窗/奖励骰副作用，无残留交互，升级槽写入正确 | 不证明真实 UI 手牌点击链，也不证明升级后技能本体分支 |

## 验证证据

### L1 结构证据

- 命令：动态枚举 `HEROES_DATA` 内所有 `type: 'upgrade'` 卡牌。
- 结果：14 个角色，119 张升级牌；118 张普通技能升级牌；1 张特殊响应升级牌；通用牌升级数量为 0。
- 结论：对象全集不再依赖手写老英雄列表。

### L2 领域行为证据

- 命令：

```text
npx vitest run src/games/dicethrone/__tests__/card-cross-audit.test.ts --config vitest.config.audit.ts --configLoader native
```

- 结果：`1 file passed`，`21 tests passed`。
- 关键用例：`所有普通技能升级牌通过 PLAY_UPGRADE_CARD 打出时只执行升级壳，不自动结算技能效果`。
- 测试断言：
  - 必须产生 `ABILITY_REPLACED`。
  - 不得产生 `TOKEN_GRANTED`、`STATUS_APPLIED`、`DAMAGE_DEALT`、`HEAL_APPLIED`、`INTERACTION_REQUESTED`、`CHOICE_REQUESTED`、`BONUS_DICE_REROLL_REQUESTED`、`BONUS_DIE_ROLLED`。
  - `sys.interaction.current` 不残留。
  - `upgradeCardByAbilityId[targetAbilityId].cardId` 写入当前升级牌。

### 炽天使回归证据

- 命令：

```text
npx vitest run src/games/dicethrone/__tests__/tianshi-behavior.test.ts src/games/dicethrone/__tests__/tianshi-rule-matrix.test.ts --configLoader native
```

- 结果：`2 files passed`，`69 tests passed`。
- 结论：炽天使复合升级牌不自动结算下半区技能效果的专属回归仍通过。

### 类型检查

- 命令：

```text
npm run typecheck
```

- 结果：`tsc --noEmit` 通过。

### Evidence 自检

- 命令：

```text
npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-upgrade-card-effect-audit-2026-08-15.md
```

- 结果：`[audit-evidence-completeness] OK`。

## 共享根因与残余范围

- 漏审归因：
  - 旧 `card-cross-audit.test.ts` 里的升级牌检查使用手写老英雄卡牌名单，只覆盖旧角色。
  - 后续角色接入后，`treant`、`ninja`、`zhanshujia`、`cursed_pirate`、`artificer`、`tianshi` 没进入同一条普通升级壳结构门禁。
  - 这属于“审计对象没建全集”和“测试断言过窄”，不是普通升级壳实现本身仍存在同类失败。
- 本轮修正：
  - 测试对象来源改为 `HEROES_DATA` 动态枚举。
  - 普通升级牌按 `replaceAbility` 自动收集，不再维护手写英雄列表。
  - 非 `replaceAbility` 的响应型升级牌单独建例外门禁。
  - 新增全量领域行为测试，从真实 `PLAY_UPGRADE_CARD` 命令验证升级壳与负向事件。
- 同类扩审：
  - 搜索范围：全部 `HEROES_DATA` 角色卡牌、通用牌、`PLAY_UPGRADE_CARD` 执行链、旧 evidence 和 DiceThrone 规则文档。
  - 根因关键词：`type: 'upgrade'`、`replaceAbility`、`PLAY_UPGRADE_CARD`、`ABILITY_REPLACED`、`upgradeCardByAbilityId`。
  - 命中项：118 张普通技能升级牌全部进入同一行为测试；工匠 `upgrade-artificer-shock-bot-2` 单列响应例外。
  - 未命中项：通用牌没有升级牌；咒缚海盗当前没有升级牌。
- 残余范围：
  - 真实 UI E2E / 截图链属于后续扩展，不影响本轮领域行为结论。
  - 升级后技能本体效果仍以各英雄技能专项证据为准，不能由本轮升级壳测试外推。

## 修订记录

- 旧测试：`src/games/dicethrone/__tests__/card-cross-audit.test.ts` 旧版手写 8 个老角色卡牌来源。
- 修订原因：用户要求“没有任何升级牌会这样”，手写老角色列表不能证明当前全注册角色。
- 新证据路径：
  - `src/games/dicethrone/__tests__/card-cross-audit.test.ts`
  - `evidence/dicethrone/dicethrone-upgrade-card-effect-audit-2026-08-15.md`
- 新结论：当前注册表内普通技能升级牌的“打出时不自动结算技能效果”专项结构与领域行为通过；不外推到真实 UI E2E 或升级后技能本体全量效果。

## 对外汇报口径

- 允许说：
  - 已按 `HEROES_DATA` 全量扫到当前 14 个角色、119 张升级牌。
  - 118 张普通技能升级牌走 `PLAY_UPGRADE_CARD` 时只执行升级壳，没有自动产生 Token、状态、伤害、治疗、选择窗或奖励骰事件。
  - 当前唯一非普通升级壳是工匠 `upgrade-artificer-shock-bot-2`，它是响应窗口专用升级牌，普通升级入口会拒绝。
  - 旧漏审原因是测试对象来源手写老角色列表，没有自动覆盖后续角色。
- 禁止说：
  - 不得说所有升级后技能本体效果已经完整无死角。
  - 不得说本轮跑了真实 UI E2E 或截图链。
  - 不得把旧槽位/卡图证据当成本轮自动结算行为证据。
