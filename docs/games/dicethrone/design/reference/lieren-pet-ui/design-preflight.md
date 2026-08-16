# Dice Throne 女猎手妮拉宠物 UI 设计前置包

> 目标状态：candidate-not-approved / runtime-user-waiver-recorded
>
> 当前工作目录：`E:\agametest\BoardGame-new-game`
>
> 当前对象：女猎手（`lieren`）的宠物妮拉 UI。v7 候选稿未通过；用户已明确豁免本轮人工设计验收并要求直接实施。该豁免只适用于本次运行时实现，不把候选稿标为通过，也不修改全局设计门禁。
>
> 更新时间：2026-08-09（v7 保持未通过；本轮运行时实现不要求人工验收）

## 本轮规则读取回执

- 已读 `src/games/dicethrone/rule/女猎手真相源表.md`：锁定妮拉之系、妮拉最大生命 7、可承伤/治疗/激活的宠物规则边界。
- 已读 `src/games/dicethrone/rule/女猎手录入核对.md`：记录妮拉运行时已按本轮用户授权实现；v7 仍未通过，真实状态 E2E 已完成。
- 已读 `docs/infra/open-design.md` 与 `.codex/skill/boardgame-ui-imagegen/SKILL.md`：Open Design 是设计工具入口；候选图必须导出 PNG/JPG/WebP 并通过 AI 图面核验后才能交用户人工验收。
- 已读 `docs/ai-rules/ui-change-gates.md`：新增用户可见 UI 不能靠静态代码或单元测试收口，人工批准前不得实施。

## 规则到画面映射回执

| 规则结论 | 影响画面主体 | 设计决策 / 禁止项 |
|---|---|---|
| 妮拉是宠物伙伴，有独立最大生命 7 | 宠物生命模块 | 必须显示为“宠物伙伴”而不是普通状态 chip；生命用 0-7 轨道或等价可读表达 |
| 妮拉之系可被消耗，用于防御替代、伤害分配或治疗妮拉 2 | 妮拉之系 token 与行动槽 | 必须把消耗型状态与宠物生命放在同一决策模块；禁止只做一个圆形徽章 |
| 妮拉可代替女猎手承受本次伤害，但终极攻击除外 | 伤害分配/防御选择区域 | 必须预留“女猎手/妮拉分配”或“妮拉承伤”决策位；禁止自动代选 |
| 妮拉激活时，女猎手进攻投掷阶段一次攻击 +2 伤害 | 激活态指示 | 必须有清晰激活/休眠状态，不得只靠颜色暗示 |
| 提示卡只作规则真相源，不上传 | 输入包与图面 | 设计稿不得把提示卡当运行时 UI 背景或正式可见面板 |

## 可见主体素材账本

| 画面主体 | 正式资源 | 复查证据 | 输入包文件 | 允许出现 |
|---|---|---|---|---|
| 妮拉头像 | 女猎手玩家板裁切：`x=1120,y=80,w=1120,h=1120` | 从正式 `player-board.webp` 生成，512x512 | `input-assets/nyra-avatar.webp` | yes，作为宠物本体头像 |
| 妮拉之系圆牌 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/compressed/nyras-bond.webp` | path-exists，400x400 | `input-assets/nyras-bond.webp` | yes，只作为消耗型资源图标 |
| 状态图集 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/compressed/status-icons-atlas.webp` | path-exists，802x400；`nyras_bond` frame 为 `0,0,400,400` | `input-assets/status-icons-atlas.webp` | no，v7 不把图集裁成宠物或资源图标 |
| 骰面图集 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/compressed/dice.webp` | path-exists，1024x1024 | `input-assets/dice.webp` | no，宠物面板没有独立骰子语义；后续骰子 UI 必须按 `DICE_ATLAS` 逐帧渲染 |
| 女猎手玩家板 | `public/assets/i18n/zh-CN/dicethrone/images/lieren/compressed/player-board.webp` | path-exists，3632x2234 | `input-assets/player-board.webp` | yes，作为背景和妮拉头像裁切来源 |
| 输入 reference sheet | `docs/games/dicethrone/design/reference/lieren-pet-ui/lieren-pet-ui-reference-sheet.png` | path-exists，1600x1000 | same | yes，作为 Open Design artifact 的素材证据页 |

## 素材进入生成链回执

- 正式素材已复制到 `docs/games/dicethrone/design/reference/lieren-pet-ui/input-assets/`，供 Open Design 项目导入。
- `lieren-pet-ui-reference-sheet.png` 由正式素材像素合成，作为本轮 artifact 的 reference sheet。
- Open Design 候选稿必须引用上述输入包相对路径，不得只在 prompt 中点名素材。

## 框体职责回执

| 框体 / 底板 | 保护对象 | 允许原因 |
|---|---|---|
| 宠物生命轨轻底板 | 妮拉 0-7 生命读数 | 保证玩家能区分宠物生命与女猎手生命 |
| 行动槽轻底板 | 消耗妮拉之系 / 妮拉承伤 / 治疗妮拉 | 表示这些是玩家必须确认的决策入口 |
| 激活态短标签 | 妮拉激活/休眠 | 表示攻击 +2 是否生效 |

禁止新增厚外框、后台式大面板、纯文字说明壳或与真实素材无关的装饰容器。

## 人工验收状态

- 当前状态：`not-approved-user-feedback`
- 允许人工验收条件：Open Design 导出 PNG/JPG/WebP 候选稿完成，并且 AI 图面核验对规则、素材、少边框、可复刻四项给出 `PASS`。
- 历史门禁：人工验收前禁止实施宠物运行时 UI。
- 本轮例外：用户明确要求“不人工验收，按照用户友好的方式实施”。运行时实现以规则真相源和用户已给出的简化反馈为准，候选稿仍保持未通过。

## AI 图面核验回执

- 旧稿降级：`exports/lieren-nyra-pet-ui-open-design-candidate.png` 不是完整验收图；导出图带浏览器滚动条且右侧内容未完整进入画布，已降级为 `REVISE`。
- v2 降级：`exports/lieren-nyra-pet-ui-open-design-candidate-v2.png` 去掉滚动条和截断后仍留下大块非画布空白，不能作为人工验收稿。
- v3-v6 降级：这些版本分别保留了独立骰子装饰、割裂的伤害分配大面板、错误的妮拉之系主头像或多余规则说明，均不进入人工验收。
- 当前候选：`exports/lieren-nyra-pet-ui-open-design-candidate-v7.png`，由 Open Design project `dicethrone-lieren-pet-ui` 的 `lieren-nyra-pet-ui-v7.html` 导出。完整 Studio runtime 为 daemon `http://127.0.0.1:19078`、web/desktop `http://127.0.0.1:19079`；导出 JSON 返回 `ok: true`，文件大小 `3785711` bytes。
- 完整性核验：`PASS`；画布无滚动条、无截断和无空白导出区。
- 规则核验：`PASS`；左侧模块表达妮拉最大生命 7、妮拉之系数量、激活时进攻 +2、女猎手/妮拉伤害承接，以及终极攻击不能分配给妮拉。
- 素材核验：`PASS`；妮拉本体头像来自正式玩家板裁切，妮拉之系使用正式圆牌；`status-icons-atlas.webp` 和 `dice.webp` 未被误裁或整图渲染；提示卡未出现在设计稿中。
- 少边框核验：`PASS`；只保留左侧宠物模块与其内部的伤害承接，删除右侧骰子、独立规则说明和底部分离式伤害大面板。
- 可复刻核验：`PASS`；生命轨、妮拉之系、激活态和仅在伤害结算时出现的内联承伤控件均有明确承接位。
- 结论（历史 AI 核验）：v7 曾被标为可进入人工验收；用户随后明确指出该设计稿“不算通过”。因此 v7 的最终状态为 `not-approved-user-feedback`，不得作为运行时 UI 的批准依据。

## 用户反馈回执（v4 打回）

- Open Design 推荐协作方式：用户在网页 Studio 中直接修改候选稿；AI 负责锁定规则、素材、图集契约、审计结论和实施门禁，不应继续把手写 HTML 当作主工作流。
- v4 降级原因：仍然偏“说明 UI”；有过多非必要描述，伤害承受选择被做成割裂的底部大界面，不符合应随伤害结算轻量承接的方向。
- 骰子处理错误：右侧独立骰子卡没有当前交互意义；即使要展示骰面，也不能整张渲染 `dice.webp`。DiceThrone 正式骰子渲染由 `src/games/dicethrone/ui/Dice3D.tsx` / `DiceTray.tsx` 承接，图集契约来自 `src/games/dicethrone/ui/assets.ts` 的 `DICE_ATLAS`、`DICE_BG_SIZE`、`getDiceSpritePosition(value)`，应按具体骰值裁帧而不是显示整张图集。
- 妮拉图标处理错误：不能把 `status-icons-atlas.webp` 随手裁成角标；状态图集 JSON 锁定 `nyras_bond` frame 为 `x=0,y=0,w=400,h=400`，`bleed` 为 `x=402,y=0,w=400,h=400`。妮拉本体应使用正式玩家板裁切，`nyras-bond.webp` 只作为妮拉之系资源图标。
- 网页 Studio 修改方向：保留左侧宠物生命 / 妮拉之系紧凑承接；去掉右侧骰子装饰；去掉大段规则说明；伤害承受不要做成割裂界面，应贴合现有伤害结算 / 防御替代流程，只在需要分配时出现轻量选择或内联控制。
- 当前门禁：v4/v7 均不得进入人工验收；本轮运行时 UI、宠物交互和 E2E 已按用户明确授权实施，但该例外不把候选稿标为通过，也不改变其它任务的门禁。

## v7 人工验收入口（历史候选）

- 当前网页 Studio：`http://127.0.0.1:19079`。
- 当前项目：`dicethrone-lieren-pet-ui`；当前 artifact：`lieren-nyra-pet-ui-v7.html`。
- 人工验收对象：`exports/lieren-nyra-pet-ui-open-design-candidate-v7.png`。
- 当前状态：`not-approved-user-feedback`。本轮运行时实现由用户直接授权，仍不等同于 v7 通过人工验收。
