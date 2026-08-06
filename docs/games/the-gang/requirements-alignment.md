# 纸牌帮 The Gang 需求对齐表

## 执行现场
| 项 | 当前锁定 |
| --- | --- |
| gameId | `the-gang` |
| 当前执行现场 | `D:\gongzuo\webgame\BoardGame` |
| 当前分支 | `main`，当前相对 `origin/main` 为 `ahead 1` |
| 历史实施现场 | `.worktrees/the-gang` / `feat/the-gang` 只作为历史记录；当前核对与收口以本工作区为准 |
| OpenSpec 主 spec | `openspec/specs/the-gang/spec.md` |
| 当前 change 状态 | `add-the-gang-data-and-runtime-closeout` 保持 `in_progress`；BGG 电子版桌面中局满元素截图、桌面教程端到端截图链、The Gang 压缩资源远端发布与回查已通过，手机验收、用户桌面验收和最终完成口径继续实施；当前远端资源完成态以服务器素材主源为准 |

## 用户原始目标映射
| 用户目标 | 本轮落点 | 验证方式 | 状态 |
| --- | --- | --- | --- |
| 开新工作树实施新游戏 | `.worktrees/the-gang` + `feat/the-gang` | `git worktree list`、`git status --short --branch` | locked |
| 参考 The Gang DOM/BGG 布局 | `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\dom.html`、`运行时.txt`、`css\03-thegang.css`、`settlement\*` | 当前可用参考源已锁定，`Board.tsx` 已改用 `data-layout-contract="bgg-electronic"`，桌面中局满元素截图已通过 | in_progress |
| 使用 The Gang TTS/Workshop 素材 | `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\Mods\Workshop\纸牌帮 The Gang.json` | 只作为素材、对象和局部参考来源；不再作为 UI 风格目标 | material-only |
| 使用 PDF 规则 | `temp/the-gang-intake/the-gang-rules.md` | `node scripts/infra/pdf_to_md.js ... -o ...` | locked |
| 使用 Images 素材 | `D:\gongzuo\webgame\gameasset\纸牌帮 The Gang\Mods\Images` | 已建立素材候选清单；筹码、隐藏牌背、52 张普通牌面、警报、金条、桌面/牌槽和规则参考已完成运行时接入 | pass |
| 根据规则选择需要的图片处理流程 | `docs/ai-rules/asset-pipeline.md` + 素材候选清单 | 已逐项处理基础版规则对象素材矩阵；不再沿用“只接入缩略图”旧口径 | pass |
| 实施新游戏 | `src/games/the-gang/**` | 核心流程、素材接入、附加能力 baseline、桌面过程态、桌面教程端到端和 The Gang 压缩资源远端发布已有证据；手机验收、用户桌面验收和最终完成口径未关闭；当前资源主源为服务器素材主源 | in_progress |
| 两副牌与上手/下手 UI 裁定 | `docs/games/the-gang/user-stories/two-hand-pre-start-swap-and-touch-ui-2026-07-28.md` | 用户已明确：交换牌发生在开始游戏前；上手/下手按钮不能贴底；两副牌模式必须按该用户故事重修文案、测试、UI 和验收 | locked |

## 首期范围裁定
| 范围 | 裁定 | 证据 |
| --- | --- | --- |
| 基础版 3-6 人 | 纳入本轮 | 规则文本写明基础版为 3-6 players |
| 每局 3-5 次抢劫 | 纳入本轮 | 规则文本写明 3 成功获胜、3 失败失败 |
| 每次抢劫 4 轮 | 纳入本轮 | Round 1-4 分别对应 pre-flop/flop/turn/river |
| 德州扑克基础牌型 | 纳入本轮 | 规则文本列出 High Card 到 Royal Flush |
| 7-10 人扩展 | 跳过 | 属于 Expansion: More Players |
| 挑战卡/专家卡 | 跳过 | 属于 Advanced/Professional/Master Thief mode |
| Joker/工具牌/Dealer/其它扑克变体 | 跳过 | 属于 mini expansions |

## 规则真相源摘录
| 规则点 | 当前解释 | 来源 |
| --- | --- | --- |
| 基础材料 | 基础版使用 52 张普通扑克、4 色 1-6 星筹码、警报、金条等 | `temp/the-gang-intake/the-gang-rules.md` |
| 胜负目标 | 3 次抢劫成功则赢，3 次失败则输 | `temp/the-gang-intake/the-gang-rules.md` |
| Round 1 | 洗 52 张牌，每名玩家发 2 张底牌 | `temp/the-gang-intake/the-gang-rules.md` |
| Round 2 | 翻开 3 张公共牌 | `temp/the-gang-intake/the-gang-rules.md` |
| Round 3/4 | 各翻开 1 张公共牌 | `temp/the-gang-intake/the-gang-rules.md` |
| 筹码含义 | 星数表示玩家认为自己相对其它玩家的牌力强弱 | `temp/the-gang-intake/the-gang-rules.md` |
| 摊牌依据 | 只有第 4 轮红色筹码用于最终判定 | `temp/the-gang-intake/the-gang-rules.md` |
| 平手 | 真实相同牌力时，不同红筹码也可算正确 | `temp/the-gang-intake/the-gang-rules.md` |

## 附加能力矩阵
| 能力 | 本轮状态 | 后续口径 |
| --- | --- | --- |
| action-log | 已完成 | 已接入玩家可见日志，记录选筹码、推进轮次、摊牌和下一次抢劫 |
| undo-system | 已完成共享撤回 UI 桥 | The Gang Board 已接入 `UndoProvider`，通用 HUD 可读取撤回状态；撤回快照白名单已独立 |
| game-ai-system | 已完成玩家可见本地 AI | 已通过共享 AI legalActions、baseline policy 和 `manifest.ai.localAi` 开放本地 AI 座位 |
| tutorial-engine | 已完成基础教程 | 已接入真实教程步骤、Board 高亮锚点和教程测试 |
| debug-config | 本轮明确跳过调试 UI | 领域测试先覆盖核心流程 |

## 后续 OpenSpec 拆分
| change | 目标 | 当前状态 |
| --- | --- | --- |
| `add-the-gang-foundation` | 基础版骨架、核心领域逻辑、首期 Board、缩略图、注册清单 | 已完成 |
| `add-the-gang-data-and-runtime-closeout` | 数据录入合同、图片用途裁定、真实页面截图验收、资源链闭环、附加能力裁定 | in_progress；桌面中局满元素截图、桌面教程端到端截图链、The Gang 压缩资源远端发布与回查已通过，手机验收、用户桌面验收和最终完成口径继续实施；当前资源主源为服务器素材主源 |
| `add-the-gang-ai-test-path` | 玩家可见本地 AI 与可重复人机测试路径 | 已完成 |
| `add-the-gang-tutorial` | 基础教程、规则帮助、Board 高亮锚点 | 已完成 |
| `add-the-gang-action-log` | 抢劫、选筹码、推进轮次、摊牌、下一次抢劫日志 | 已完成 |
| `add-the-gang-expansions` | 7-10 人、Joker、工具、Dealer、扑克变体等扩展 | 后续可选范围；不能用“扩展不阻塞”替代基础版素材准入 |

## 当前完成口径
- 当前不得标记为完成：本轮只是可合入主线的实施中检查点，旧 TTS 桌面式完成证据已失效。
- 素材链已有基础：24 个基础版筹码、隐藏牌背、52 张普通牌面、警报、金条、桌面/牌槽和规则参考已完成接入。
- 已通过：按 BGG 电子版结构和 The Gang 专属 UI 合同重跑 1920×1080 桌面真实页面 E2E、PureRef 打开最新中局满元素截图和 AI 复看。
- 已通过：桌面教程 E2E 已按 1920×1080 基线从目标说明、读底牌、四轮筹码、公共牌推进跑到摊牌结果反馈；`教程满元素待摊牌.jpg` 和 `教程摊牌结果反馈.jpg` 已用 PureRef 打开。
- 仍需完成：手机验收、用户桌面验收和最终完成口径。桌面未被用户验收前，不启动手机适配；The Gang 本轮新增压缩资源的远端发布状态已完成定向上传与回查。当前和后续资源验收统一以服务器素材主源为准。
- 新增待修正：两副牌模式必须按 2026-07-28 用户故事重新对齐。当前若仍存在“开始抢劫后每轮调换牌”的文案、测试或 UI，只能视为旧合同残留，不得再作为验收通过依据。
- 7-10 人、Joker、工具、Dealer、挑战/专家卡和其它扑克变体属于后续可选扩展；这不解除当前 BGG UI 重做验收门槛。
