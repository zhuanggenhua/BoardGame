# 山屋惊魂需求对齐表

> 用途：证明 `betrayal` 当前每一项用户目标，都能回查到对应设计、实现落点和验证方式。
> 当前模式：默认模式（不动总框架）。
> 当前 active scope：`add-betrayal-foundation`
> 当前 UI 状态：三步产物已补齐，当前推荐方向为 `style-b`；现有“资源壳层/录入界面”方向已判定为误解，不得再作为设计完成证据。

## 1. 对齐矩阵

| 用户目标 / 明确拒绝项 | 当前 change | 设计落点 | 实现落点 | 验证落点 | 当前状态 |
|---|---|---|---|---|---|
| 检查 `skill` 是否要更新 | shared baseline | `.codex/skill/create-new-game/SKILL.md`、`.codex/skill/boardgame-ui-imagegen/SKILL.md` | 主工作区 shared skill | 文档 diff + 当前 skill 门禁自审 | 已完成 |
| UI 设计稿不能再误做成“资源壳层 / 录入界面” | `add-betrayal-foundation` | `design-system/games/betrayal.md`、`docs/games/betrayal/design/README.md` | 暂不进入正式实现 | 文档审计 + 设计索引核对 | 已完成 |
| 参考卡应提炼成交互按钮，而不是在运行时整张展示 | shared baseline + `add-betrayal-foundation` | shared skill 新门禁 + `design-system/games/betrayal.md` | 暂不进入正式实现 | skill 条款 + 设计索引核对 | 已完成 |
| 当前探索者持有的 `Item / Omen` 不能在运行态被忽略 | `add-betrayal-foundation` | `design-system/games/betrayal.md` | 暂不进入正式实现 | 设计规范核对 | 已完成 |
| 默认先从规则提炼 UI，确认必要元素和布局 | shared baseline + `add-betrayal-foundation` | shared skill 三步门禁 + `generated/betrayal-runtime-prehaunt-board-v4.png` | 暂不进入正式实现 | 设计索引 + 任务门禁核对 | 已完成产物 |
| 第二步应在同布局上给出不同风格 UI | shared baseline | `.codex/skill/create-new-game/SKILL.md`、`.codex/skill/boardgame-ui-imagegen/SKILL.md` | 暂不进入正式实现 | skill 条款审计 | 已完成 |
| 第三步应在已选风格下生成不同界面，例如角色选择、运行时、结算 | shared baseline + `add-betrayal-foundation` | `design/README.md` + `style-b-screen-contract.md` | 暂不进入正式实现 | 设计索引 + 页面合同核对 | 已完成产物 |
| 不要把素材目录里“看起来像图”的文件误当正式资源 | `add-betrayal-foundation` | `resource-gap-audit.md`、`resource-structure-reference.md` | `public/assets/betrayal/` 暂存层合同 | 文档审计 + 目录结构核对 | 已完成 |
| 先理解现有游戏例如大杀四方的资源结构 | `add-betrayal-foundation` 输入证据 | `resource-gap-audit.md`、`foundation-implementation-map.md` | 对照 `smashup/qidahen` 的正式资源树 | 文档引用与路径对照 | 已完成 |
| 重新录入，让正式资源结构对齐项目合同 | `add-betrayal-foundation` | `resource-migration-plan.md` | `public/assets/i18n/zh-CN/betrayal/` | `assets:manifest` + `assets:check` | 已完成首轮本地收口，待远端上传 |
| 直接按 skill 开始实施游戏 | `add-betrayal-foundation` | `foundation-implementation-map.md`、`design-system/games/betrayal.md`、`docs/games/betrayal/design/generated/`、`style-b-screen-contract.md` | `src/games/betrayal/manifest.ts` 等 skeleton | `generate:manifests` + 最小加载验证 | 已实现 |
| foundation 阶段不要假装已完成完整玩法 | `add-betrayal-foundation` | `proposal.md`、`design.md`、`design-system/games/betrayal.md` | `Board.tsx` 只做运行时主界面的最小 skeleton，不提前实现 haunt/traitor/剧本逻辑 | UI 截图 + 文档边界核对 | 已实现边界 |
| 后续应该能继续承接剧本/鬼屋/房间逻辑 | 后续 change | `design-system/games/betrayal.md` 候选共享抽取项 + 架构审查 | 未来 `card-catalog / gameplay / runtime-entry` | change 拆分判断 | 已完成前置判断 |
| 默认不要乱改总框架 | shared baseline | `create-new-game` skill 新增“默认模式 / 百游戏模式” | 默认只在游戏层实现 | skill 条款审计 | 已完成 |
| 若用户明确要求百游戏复用，才允许上升共享层 | shared baseline | 同上 + 架构审查模板 `当前模式/候选共享抽取项` | 未来共享抽象 change | skill/模板审计 | 已完成 |

## 2. 当前 scope 内明确不做

以下事项已被明确排除在当前 `foundation` 外：

- 完整玩法
- 房间板块正式裁图
- 楼层板正式裁图
- 扫描 PDF OCR
- 剧本 / 叛徒 / 鬼屋逻辑
- AI / 教程 / debug panel 正式交付

## 3. 当前剩余门禁

当前不再有“是否开始 skeleton”的门禁；剩余门禁变成：

- 房间 / 楼层正式裁图资产是否完成
- 运行时是否从只读 skeleton 升级为真实规则交互
- 角色选择与终局页是否进入正式代码实现
