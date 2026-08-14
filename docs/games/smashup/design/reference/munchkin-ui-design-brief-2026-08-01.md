# Smash Up Munchkin 新机制 UI 位图设计稿前置回执

- 创建时间：2026-08-01
- 当前阶段：出图前硬回执 + 素材输入包已准备；按更新后的项目流程自动转入 Open Design artifact 候选稿路线
- 目标交付：Munchkin 怪物 / 宝藏机制在大杀四方主牌桌上的 PC 运行时 UI 设计稿候选
- 人工验收状态：`human-review-not-allowed`
- 当前执行路线：imagegen 入口不可用时不再最终卡死；本轮继续使用同一份规则 / 素材前置包转 Open Design artifact 候选稿，并导出图片后再做 AI 图面核验

## 2026-08-01 设计裁定更新

- 用户裁定：怪物进入基地后，默认显示在**基地下方的一排公共怪物行**，多张怪物允许横向重叠 / 扇形排布。
- 用户裁定：怪物 / 宝藏公共抽牌堆按疯狂牌的轻量供应角处理，只在玩家抽牌堆旁显示小卡 + 剩余数量；怪物弃牌堆、宝藏弃牌堆本轮不做常驻入口。
- 槽位边界：怪物行贴近基地下缘，位于基地卡与玩家随从列之间；它只能在怪物行内部互相重叠，不能盖住基地文字、玩家随从、附着行动、泰坦、基地持续行动、力量 token 或当前 prompt。
- 信息边界：怪物和宝藏卡的名称、类别、战力、奖励值默认由卡面承担；常驻 UI 不再复写 `中立 / 力量 / 宝藏` 这类卡面已有字段，只补运行时状态、选择反馈、控制者、动态门槛修正或聚合结果。
- 旧方向作废：基地上缘 / 基地中部贴怪物、给怪物常驻短徽章、把宝藏身份再贴 chip、给怪物 / 宝藏另开弃牌堆常驻入口的旧稿和旧 prompt 均不得继续用于 v3。

## 本轮规则读取回执

本轮实际读取并用于设计裁定的来源：

- `D:\gongzuo\webgame\BoardGame\evidence\smashup\munchkin-intake-atlas-contract-2026-08-01.md`
- `D:\gongzuo\webgame\BoardGame\.spec/knowledge/README.md`
- `D:\gongzuo\webgame\BoardGame\.spec/knowledge/standards/ui-ux.md`
- `D:\gongzuo\webgame\BoardGame\.spec/knowledge/standards/ui-change-gates.md`
- `D:\gongzuo\webgame\BoardGame\.spec/knowledge/standards/asset-pipeline.md`
- `D:\gongzuo\webgame\BoardGame\design-system\game-ui\MASTER.md`
- `D:\gongzuo\webgame\BoardGame\design-system\styles\tactical-clean.md`
- `D:\codex-home\skills\.system\imagegen\SKILL.md`
- `D:\codex-home\skills\show-image-to-user\SKILL.md`
- `D:\codex-home\skills\ui-design-pipeline\SKILL.md`
- `D:\codex-home\skills\ui-ux-pro-max\SKILL.md`
- `D:\gongzuo\webgame\BoardGame\.spec\skills\boardgame-ui-imagegen\SKILL.md`

## 规则对象结论与画面映射

| 规则结论 | 影响的画面主体 | 设计决策 / 禁止项 |
| --- | --- | --- |
| 宝藏牌 / 怪物牌不是普通派系卡池，当前静态合同只把它们注册为特殊图集 | 抽牌堆旁公共牌堆数量入口 | 复用疯狂牌供应角：只显示怪物 / 宝藏抽牌堆小卡 + 剩余数量；本轮不显示怪物 / 宝藏弃牌堆；禁止把它们混进玩家普通手牌或派系牌库 |
| 怪物进入基地后是公共对象，有力量和宝藏奖励 | 基地下方公共怪物行 | 怪物卡排在基地下方一排，允许横向重叠 / 扇形排布；禁止占用基地上缘、基地中部、玩家随从列或独立边栏 |
| 宝藏是奖励资源，可进入玩家持有区，也可能作为随从、行动或附着行动被打出 | 玩家持有区、手牌区、附着卡槽 | 宝藏用真实卡面承载身份；若卡面已可读，不再贴 `宝藏` chip；禁止用纯文字列表替代宝藏卡本体 |
| 破基地结算时，怪物力量影响基地压力但不归属任何玩家；怪物和宝藏奖励要在结算前可见 | 当前焦点基地、破基地预览浮层 | 当前焦点基地旁只显示聚合预览：玩家力量排序 + 怪物门槛合计 + 宝藏奖励合计；禁止逐张复写怪物卡面字段或写长规则说明句 |
| 怪物可被摧毁并产生宝藏奖励，部分怪物有不死等特殊能力 | 基地下方怪物行、奖励揭示托盘 | 怪物个体状态只补卡面没有表达的运行时状态，例如 `可选`、`已控制`、`可击败`、`已选`；奖励揭示区只在结算层出现，不常驻展开完整规则 |

## UI 设计声明

### 玩家此刻任务

- 先看当前焦点基地是否接近破坏。
- 分辨基地下方公共怪物行和玩家随从列，不把怪物误认为某个玩家随从。
- 通过卡面和聚合预览看懂怪物带来的门槛压力与宝藏奖励。
- 在获得宝藏后，能在自己的持有区看到宝藏牌，并在后续行动中作为宝藏使用或附着。

### 主交互槽位五联单

- 主交互对象：基地本体、基地下方公共怪物行、基地下方玩家随从列、玩家手牌 / 持有宝藏、当前破基地结算浮层。
- 固定槽位：三张基地在中央主舞台；每个基地的怪物行固定在基地卡下缘与玩家随从列之间，允许怪物卡横向重叠；玩家手牌 / 持有物在底部；公共宝藏 / 怪物抽牌堆数量贴在玩家抽牌堆旁；破基地预览贴近当前焦点基地。
- 让位顺序：完整日志、帮助说明、完整弃牌清单、完整宝藏清单、非焦点基地的展开详情先退场；基地、怪物行、玩家随从列、玩家手牌和当前结算预览不得被挤出主视线。
- 禁止侵入对象：规则长文、教程正文、大日志面板、厚后台栏、第二套主操作面板不得侵入基地、怪物行、玩家随从列和手牌槽位。
- 来源家族：大杀四方 `HandArea` 底部手牌槽位、`PromptOverlay` 卡牌本体选择面、`BaseZone` 基地公共对象附属槽位、公共牌堆入口家族。

### 可见对象准入

| 画面对象 | 准入状态 | 默认显示 |
| --- | --- | --- |
| 三张基地卡 | `design-asset-ready` | 中央主舞台，使用正式基地裁片 |
| 玩家随从 / 行动牌 | `design-asset-ready` | 基地下方玩家随从列和底部手牌区，使用正式普通牌裁片 |
| 公共怪物卡 | `design-asset-ready` | 基地下方公共怪物行，横向重叠 / 扇形排布；不贴 `中立 / 力量 / 宝藏` 复写徽章 |
| 宝藏牌 | `design-asset-ready` | 抽牌堆旁公共数量小卡、奖励托盘、玩家持有区和附着区 |
| 怪物 / 宝藏抽牌堆数量 | `approved-programmatic-runtime-ui` | 贴在玩家抽牌堆旁的小卡 + 剩余数量；不显示怪物 / 宝藏弃牌堆 |
| 破基地预览 | `approved-programmatic-runtime-ui` | 当前焦点基地旁轻量浮层，短标签和数值 |
| 完整规则说明 | `forbidden-main-ui` | 不进入常驻主 UI，只允许后续帮助层 |

## 素材输入包回执

输入包目录：

- `D:\gongzuo\webgame\BoardGame\temp\smashup-munchkin-ui-imagegen\input-pack`

输入包清单：

- `input-pack-manifest.json`
- `munchkin-ui-reference-sheet.png`
- `base-tournament.png`
- `base-mine.png`
- `base-portal.png`
- `monster-treasure-dragon.png`
- `monster-bigfoot.png`
- `monster-ghoul.png`
- `treasure-hoard.png`
- `treasure-magic-missile.png`
- `treasure-wishing-ring.png`
- `faction-warrior-hero.png`
- `faction-dwarf-treasure-lover.png`

| 主体 | 正式资源 | 输入包文件 | 图面职责 |
| --- | --- | --- | --- |
| 基地：锦标赛 | `public\assets\i18n\zh-CN\smashup\base\munchkin_warriors_bases.png` frame 1 | `base-tournament.png` | 当前焦点基地示例 |
| 基地：矿洞 | `public\assets\i18n\zh-CN\smashup\base\munchkin_dwarves_bases.png` frame 0 | `base-mine.png` | 非焦点基地示例 |
| 基地：次元之门 | `public\assets\i18n\zh-CN\smashup\base\munchkin_mages_bases.png` frame 0 | `base-portal.png` | 非焦点基地示例 |
| 怪物：宝藏龙 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_monsters.png` frame 0 | `monster-treasure-dragon.png` | 高奖励中立怪物示例 |
| 怪物：大脚怪 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_monsters.png` frame 1 | `monster-bigfoot.png` | 基地怪物叠放示例 |
| 怪物：食尸鬼 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_monsters.png` frame 13 | `monster-ghoul.png` | 不死怪物状态示例 |
| 宝藏：大量宝藏 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_treasures.png` frame 8 | `treasure-hoard.png` | 宝藏奖励托盘示例 |
| 宝藏：魔法导弹 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_treasures.png` frame 13 | `treasure-magic-missile.png` | 宝藏行动牌示例 |
| 宝藏：许愿指环 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_treasures.png` frame 21 | `treasure-wishing-ring.png` | 附着 / 持有宝藏示例 |
| 勇士：大英雄 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_warriors.png` frame 0 | `faction-warrior-hero.png` | 玩家随从 / 手牌示例 |
| 矮人：宝藏爱好者 | `public\assets\i18n\zh-CN\smashup\cards\munchkin_dwarves.png` frame 1 | `faction-dwarf-treasure-lover.png` | 普通派系牌与宝藏对比 |

## 框体职责回执

允许的常驻边界：

- 基地、怪物、宝藏、普通牌自身的印刷边。
- 当前焦点基地的轻量描边 / 光晕，用于提示破基地预览关联对象。
- 基地下方公共怪物行自身的轻量承托 / 阴影，用于表达这些怪物属于该基地；多张怪物允许在该行内互相重叠。
- 抽牌堆旁公共数量角标的极轻托盘，用于保护怪物 / 宝藏小卡和剩余数量。
- 底部手牌 / 宝藏持有区的轻量桌面托盘，用于承载真实卡牌，不做厚面板。

禁止项：

- 禁止大块深色后台面板。
- 禁止整列日志。
- 禁止把规则说明句常驻在主 UI。
- 禁止用抽象图标或文字壳替代正式卡牌、基地、怪物、宝藏。
- 禁止把怪物做成玩家随从。
- 禁止把怪物放到基地上缘 / 基地中部，或用常驻徽章复写怪物卡面上的名称、类别、战力、奖励值。
- 禁止把宝藏做成疯狂牌式惩罚牌堆。

## 位图设计稿 Prompt 草案

```text
Use case: ui-mockup
Asset type: bitmap UI design draft for Smash Up Munchkin runtime board
Current step: Step 1 structure draft for the PC runtime main board.
Primary request: Design a 16:9 2D printed-board-game UI mockup showing how Munchkin Monsters and Treasures should appear in Smash Up.
Input images: Use the Munchkin reference sheet and individual formal crops as visual inputs. The base cards, monster cards, treasure cards, and player cards must remain recognizable as real card objects and must be the main visual subjects.
Scene/backdrop: Open tabletop game board, not a dashboard. Three base cards are the central stage.
Subject: Current focus base with a public monster row directly below the base card, player minions below the monster row, compact public Monster deck and Treasure deck count badges beside the player draw deck, treasure reward reveal tray, player hand and treasure attachment examples.
Style/medium: 2D printed tabletop UI concept, tactical clean + light fantasy accent, clear and implementable.
Composition/framing: 16:9 desktop viewport. Center: three base cards. Under the focus base card: 2 public monster cards arranged in one horizontal row with slight overlap/fan spacing, placed between the base card and the player minion rows. The monster cards must not be on the top edge of the base and must not cover ongoing actions, titans, player minions, base text, power tokens, or prompt controls. Beside the player draw deck: compact public deck count badges showing one Monster card thumbnail with "x 20" and one Treasure card thumbnail with "x 22". Do not show Monster discard or Treasure discard entries. Bottom: player hand with normal cards and treasure cards as real card objects; one treasure card attached to a minion as a small overlapped card. Near focus base: small break-base preview with player power ranking, monster threshold total, and treasure reward total.
Text (verbatim, short labels only): "x 20", "x 22", "破基地预览", "手牌", "附着". Do not add labels that repeat monster or treasure card face data.
Constraints: Use real card/base assets as the visual subjects. Keep UI labels short. No long rule text. No tutorial text. No giant logs. No thick container frames. No dashboard panels. Monsters must read as public base-attached objects in the row below the base, distinct from player minions. Treasures must look like rewards, not Madness-style penalty cards.
Avoid: HTML wireframe look, placeholder cards, purely textual UI, heavy borders, dark admin dashboard, 3D render, stock-photo table, rules explanation paragraphs, duplicate control panels.
```

## AI 图面核验门槛

生成后必须先自检，未通过不得人工验收：

- 图中必须能看出基地、怪物、宝藏、公共牌堆、玩家手牌和宝藏附着。
- 怪物必须在基地下方公共怪物行中，允许横向重叠 / 扇形排布；不得放在基地上缘 / 基地中部，不得混成某个玩家的随从。
- 怪物和宝藏不得常驻复写卡面已有信息，例如 `中立`、`力量 N`、`宝藏 xN`、`宝藏`。
- 宝藏必须是奖励资源，不得像疯狂牌那样表现为惩罚负担。
- 公共怪物 / 宝藏抽牌堆数量必须紧凑可见，贴近玩家抽牌堆；怪物 / 宝藏弃牌堆不常驻显示，且公共牌堆不能压过基地主舞台。
- 破基地预览必须是短标签 / 数值层，不得写长规则说明。
- 画面第一眼必须是开放式牌桌和真实卡牌，不是后台面板、表格或线框。

## 当前执行状态

- 素材输入包：`ready`
- 出图前硬回执：`ready`
- 位图生图工具：`blocked-imagegen-entry`
- Open Design 自动接力：`pending`
- 当前证据：本轮没有可调用的内置 `image_gen`；`D:\codex-home\skills\.system\imagegen\scripts\image_gen.py` 存在，但当前 shell 中 `OPENAI_API_KEY` 未设置。
- 新流程裁定：这不再是最终阻塞；如果 Open Design 工具链可用，应自动创建 / 使用 Open Design 项目，把输入包素材导入项目或相对资源目录，生成可渲染 artifact 候选稿，再导出 PNG/JPG/WebP 作为用户可看的设计稿候选。
- 仍然禁止：不能直接把 HTML、线框、素材拼贴参考板、运行页截图或未审计 Open Design artifact 当作完成态设计稿。
- 下一步：启动 Open Design 候选稿路线；导出图片后按本文件的 AI 图面核验门槛判定是否允许人工验收。
