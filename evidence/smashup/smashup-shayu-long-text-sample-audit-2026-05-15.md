# SmashUp shayu 长描述复杂对象抽样全链路审计（2026-05-15）

## 范围与口径

本轮按用户要求“再抽查几个复杂的描述长的”，只做抽样全链路审计，不替代 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md` 的 45 对象全面矩阵，也不处理当前工作区的 DiceThrone 改动。

抽样依据：

- 中文 `abilityText/effectText` 长度较长。
- 文案包含多句效果、跨阶段、替代出牌、持续触发、基地替换、可选分支、额外出牌或排序/放回牌库。
- 优先避开上一轮 Twister 单点反馈，只复用其新增门禁作为审计维度。

本轮重点抽查对象：

| 对象 | 中文描述长度 | 复杂点 | 本轮结论 |
| --- | ---: | --- | --- |
| `sharks_megalodon` | 52 | 入场可选消灭 + 计分前 special 消灭，两个阈值不同 | 未发现新 blocker；沿用 L2/L3/L4 代表链证据 |
| `mythic_greeks_argonaut` | 49 | 触发所有 action 后能力 + 可替代行动打出 | 发现并修复 2 个真实缺口 |
| `sharks_blood_in_the_water` | 51 | 基地持续行动、destroy 后额外 3- 随从入口 | 未发现新 blocker；需维持可跳过与 power filter 证据 |
| `tornados_not_in_kansas` | 58 | 替换基地、清理行动卡、保留随从、不得误触发新基地 | 未发现新 blocker；此前入口消费专项已覆盖 |
| `mythic_greeks_favor_of_dionysus` | 48 | +1、额外行动、可放回牌库顶而非弃牌 | 未发现新 blocker；可选 topdeck 分支已有行为覆盖 |

补充参照对象：

- `tornados_gone_with_the_wind`：afterScoring 特殊行动与延迟清场。
- `mythic_greeks_favor_of_athena`：展示、可选拿行动、其余任意顺序回顶。
- `base_oracle_at_delphi`：基地触发、顶牌展示、action 入手 / non-action 回顶分支。

## 发现与修复

### `mythic_greeks_argonaut`

真相源文案：

> 触发所有会因你打出一个行动而触发的能力。特殊能力：任何你可以打出行动的时候，你可以改为打出这张牌。

本轮发现两个缺口：

1. 缺少“替代行动额度打出”的入口。
   - 旧实现只能把 Argonaut 当普通随从打出。
   - 当随从额度已用完但行动额度仍可用时，UI/command 不能按卡面“改为打出这张牌”。
2. Argonaut 的 onPlay 只手写触发了 Odysseus / Heracles / Spartan，漏掉 Jason。
   - Jason 文案是“在你打出一个行动后，你可以选择一个基地”，属于 Argonaut 第一段必须触发的 action 后能力。
   - 旧链条没有串到 Jason 的基地 prompt。

修复内容：

| 文件 | 修复点 |
| --- | --- |
| `src/games/smashup/domain/types.ts` | `MinionCardDef`、`PlayMinionCommand`、`MinionPlayedEvent` 增加 `playAsAction` 语义。 |
| `src/games/smashup/data/factions/mythic_greeks.ts` | `mythic_greeks_argonaut` 标记 `playAsAction: true`。 |
| `src/games/smashup/domain/commands.ts` | `PLAY_MINION` 支持 `playAsAction` 校验，要求行动额度可用且卡牌允许替代行动。 |
| `src/games/smashup/domain/reducer.ts` / `reduce.ts` | `playAsAction` 的 MINION_PLAYED 不消耗随从额度，改为消耗行动额度。 |
| `src/games/smashup/Board.tsx` | 当普通随从入口被额度挡住、但替代行动入口合法时，真实 UI 自动用 `playAsAction` 打出。 |
| `src/games/smashup/abilities/mythic_greeks.ts` | Argonaut onPlay 补 Jason 触发；Odysseus minion prompt 后可继续串 Jason base prompt。 |
| `src/games/smashup/__tests__/shayuFactionAbilities.test.ts` | 行为测试覆盖 Argonaut 用行动额度打出，并触发 Odysseus / Heracles / Spartan / Jason。 |
| `e2e/smashup-shayu-factions.e2e.ts` | 真实入口 E2E 改为随从额度已满、行动额度可用，补 Jason prompt 与最终状态断言。 |

## 抽查矩阵

| 对象 | 入口 | 命令/状态 | 分支/否定 | 清理/后续 | 证据等级 |
| --- | --- | --- | --- | --- | --- |
| `sharks_megalodon` | 入场 onPlay；beforeScoring special 窗口 | `PLAY_MINION` 与 scoring response | 两个 destroy 阈值不同；均为可选 | destroy trigger 后交互清空 | L2 + L3/L4 代表链，未发现新缺口 |
| `mythic_greeks_argonaut` | `PLAY_MINION`；本轮补 `playAsAction` | `MINION_PLAYED.playAsAction` 不加 `minionsPlayed`，加 `actionsPlayed` | action 后能力链触发 Odysseus/Heracles/Spartan/Jason | Odysseus prompt 可继续串 Jason prompt，Jason once/turn 标记写入 | 本轮 L2 + L3 修复通过 |
| `sharks_blood_in_the_water` | 持续行动附着基地；destroy 后触发额外随从窗口 | `PLAY_ACTION` 后 ongoing in play；destroy trigger 创建 restricted extra minion | 3- power filter；合法候选存在时仍可跳过 | extra prompt 清空，额外随从打到同基地 | L2 + L3/L4 代表链，未发现新缺口 |
| `tornados_not_in_kansas` | 手牌行动选基地 | `PLAY_ACTION.targetBaseIndex` 是第一入口 | 不应二次选择同 targetType；替换后新基地不得误触发本 action | 旧基地行动清理、随从保留、base replace 队列收口 | L2 + L3 + L4，未发现新缺口 |
| `mythic_greeks_favor_of_dionysus` | 手牌行动；己方随从目标 | +1 temp、`actionLimit +1`、可选回顶 | topdeck / skip 两分支 | 临时修正回合清理；回顶替代弃牌 | L2 + L3 代表链，未发现新缺口 |

## 验证记录

已执行并通过：

```bash
npx eslint src/games/smashup/domain/types.ts src/games/smashup/domain/commands.ts src/games/smashup/domain/reducer.ts src/games/smashup/domain/reduce.ts src/games/smashup/Board.tsx src/games/smashup/abilities/mythic_greeks.ts src/games/smashup/data/factions/mythic_greeks.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts e2e/smashup-shayu-factions.e2e.ts
npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts -t "阿尔戈英雄"
npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/__tests__/shayuEntryConsumption.test.ts
npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "可选/至多交互|直接入口字段|控制者约束"
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Mythic Greeks 阿尔戈英雄真实入场会触发奥德修斯/赫拉克勒斯/斯巴达人的行动后能力"
```

E2E 结果：`1 passed`。

## 截图核对

已实际打开并核对：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-odysseus-prompt.png`
  - 看到 Argonaut 已进入 Oracle at Delphi 基地。
  - 奥德修斯 prompt 真实打开，要求选择己方随从放置 +1。
  - Heracles / Spartan 已可见 +1 反馈，说明 Argonaut 的 action 后能力链已经开始结算。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-jason-prompt.png`
  - 看到 Jason prompt 真实打开，标题为“伊阿宋：选择一个基地，你在那里的随从 +1”。
  - 两个有己方随从的基地均高亮，证明 Argonaut 链已经从 Odysseus 继续串到 Jason。
  - 背景可见 Argonaut、Jason、Heracles、Spartan、Odysseus 同场，符合本轮构造的复杂 action-trigger 场景。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-after-action-triggers.png`
  - 看到 The Deep 基地上 Mako 出现 +1，证明 Jason 选择第二基地后作用到该基地己方随从。
  - 左侧基地仍保留 Argonaut 与希腊随从，已有 +1 标记没有丢失。
  - 交互链进入触发反馈/收口状态，没有停留在缺失 Jason 的旧链路。

## 结论边界

本轮抽查发现并修复了 `mythic_greeks_argonaut` 的替代行动入口与 Jason action-trigger 漏触发问题。其余抽样对象未发现新的实现 blocker。

这次结论只能表述为“长描述复杂对象抽样全链路审计完成”，不能表述为“shayu 45 对象全面审计重新完成”。45 对象逐项证据等级仍以全面矩阵与 post-Twister 全流程矩阵为准。
