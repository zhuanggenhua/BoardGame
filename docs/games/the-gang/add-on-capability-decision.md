# The Gang 附加能力裁定

## 口径

- 当前 change 的目标是把 foundation 之后的真实缺口继续推进到可验证状态；foundation 旧范围外条目只代表当时未纳入该 change，不能冒充后续能力已完成。
- “最低 AI/人机测试路径”已升级为玩家可见本地 AI：The Gang 声明 `manifest.ai.localAi = true`，并通过共享 AI 决策上下文生成合法动作。
- action-log、tutorial、玩家可见本地 AI 与共享撤回 UI 桥已在后续 change 中完成；debug-config 仍记录为明确跳过项。

## 裁定表

| 能力 | 本轮裁定 | 现实含义 | 证据/落点 | 后续 |
| --- | --- | --- | --- | --- |
| 玩家可见本地 AI | 已完成 | 玩家可在本地 AI 座位中自动选择筹码、推进公共轮次、揭示摊牌并开始下一次抢劫；AI 决策只从合法动作集合里选 | `src/games/the-gang/ai.ts`、`src/games/the-gang/__tests__/ai.test.ts`、`openspec/changes/add-the-gang-ai-test-path` | 后续如需更强策略，再单独做难度/搜索增强 |
| action-log | 已完成 | 玩家可见日志记录选筹码、推进轮次、摊牌结果和下一次抢劫；不暴露隐藏手牌 | `src/games/the-gang/actionLog.ts`、`src/games/the-gang/__tests__/actionLog.test.ts`、`openspec/changes/add-the-gang-action-log` | 已通过 OpenSpec、定向测试和 ESLint |
| undo UI | 已完成共享撤回 UI 桥 | The Gang 不新增专属撤销面板，而是把 Board 状态接入通用 HUD 撤回入口；撤回快照白名单独立于日志白名单 | `src/games/the-gang/Board.tsx`、`src/games/the-gang/game.ts`、`openspec/changes/add-the-gang-undo-ui` | 后续如需专属撤回样式，再单独建 change |
| tutorial | 已完成基础教程 | 教程文件包含目标、手牌、选筹码、轮次、玩家区、摊牌和结束说明；Board 提供稳定高亮锚点 | `src/games/the-gang/tutorial.ts`、`src/games/the-gang/__tests__/tutorial.test.tsx`、`openspec/changes/add-the-gang-tutorial` | 已通过 OpenSpec、定向测试和 ESLint |
| debug-config | 明确跳过 | 不新增调试 UI；领域测试覆盖核心流程即可 | 本文档 + 定向测试 | 后续如需调牌、固定牌局或素材调试，再单独建 change |

## 能力判断

- 本轮能证明：规则核心可以通过自动座位重复完成三次抢劫并进入胜利结算，且玩家可见本地 AI 已接入共享 AI 决策链。
- 本轮不能证明：专属撤回样式已完成；当前完成的是共享 HUD 撤回入口。
- The Gang 附加能力矩阵代码侧已经闭合；专属撤回样式、强 AI 策略和 debug-config 属于后续可选增强。
- 该结论只覆盖附加能力；素材 intake 已在运行时资源收口中补到基础版对象级接入，但服务器素材主源发布、手机验收和最终完成口径仍归 `add-the-gang-data-and-runtime-closeout`，整体保持 `in_progress`。历史 R2/CDN 上传记录只作为当时证据，不再作为当前完成态流程。
