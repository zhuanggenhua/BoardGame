# 小黑屋界面与骰子反馈：需求拆解与收口记录

> 本文件是本轮反馈的 evidence / 任务记录，不是第二套规范正文。可执行规则以 `.spec/knowledge/standards/` 为 canonical source；代码与测试路径只记录本轮结论和直接证据。

## 需求矩阵

| # | 用户要求 / 中途补充 | 结论 | 直接落点 | 验收证据 |
|---|---|---|---|---|
| 1 | 角色选中后肖像可变灰，但 P1/P2 标记不能跟着变灰 | 已修复：灰度只作用于肖像；玩家标记保持可读 | `src/games/betrayal/characterSelectSurface.tsx` | `Board.foundation.test.tsx` 断言 P1 标记位于右上角且使用可读色 |
| 2 | 所有玩家标记统一放右上角，不因“自己的 / 别人的”选择产生位置差别 | 已修复：标记统一使用右上角槽位 | `src/games/betrayal/characterSelectSurface.tsx` | 角色选择组件回归断言 |
| 3 | 从房间开始拖拽不能被房间按钮拦截；普通房间点击应打开浏览 / 放大，而不是禁用 | 已修复：移除房间本体的 pointerdown / pointerup 吞事件；移除会被浏览器视为不可点击的 `aria-disabled`；非操作态保留 preview 路由 | `src/games/betrayal/roomMapSurface.tsx`、`src/components/game/framework/ZoomPanViewport.tsx` | 真实 E2E 从房间中心实体起点拖拽后 canvas transform 改变且未打开预览；清空 tile 点击打开预览；截图 `外星几何-完整链路-08-房间本体拖拽.jpg`、`外星几何-完整链路-09-房间点击放大.jpg` |
| 4 | 有正式卡面时删除外部重复“效果文案”；不能额外保留“无事发生” | 已修复：正式卡面承载固定说明；无卡面兜底不再制造重复主文案 | `src/games/betrayal/latestDiscoverySurface.tsx`、`latestDiscoveryPresentation.ts` | `event-choice-coverage.e2e.ts` 断言无顶部“无事发生”且正式卡面存在 |
| 5 | 去重不能删除投骰后的最终结果，例如“知识 +1” | 已修复：检定要求 / 骰数 / 总点数去重，但最终结果保留 | `src/games/betrayal/latestDiscoverySurface.tsx`、`latestDiscoveryPresentation.ts` | Board 与真实 E2E 均断言“知识 +1”仍可见 |
| 6 | 单独获得物品：显示 3 秒自动隐藏，也可提前点击隐藏 | 已实现：仅识别为 standalone item gain 时启用 3000ms 自动确认；按钮可立即提交 | `src/games/betrayal/Board.tsx`、`src/games/betrayal/visualTiming.ts` | `Board.foundation.test.tsx` 覆盖 2999ms / 3000ms 与提前点击 |
| 7 | 带事件 / 需要确认的结果：必须人工确认，不能被物品卡计时器自动确认 | 已修复并回归：事件牌不满足 standalone item 条件；确认窗口保留到真人逐个确认 | `src/games/betrayal/latestDiscoveryPresentation.ts`、`src/games/betrayal/Board.tsx` | Board 测试断言事件卡经过 3000ms 仍未自动提交；多人确认即时更新进度 |
| 8 | 确认点击不能因为等待服务端回写而“卡”很久 | 已实现：卡牌确认对当前 viewer 做乐观展示；权威状态回写后自动对账清理 | `src/games/betrayal/Board.tsx`、`latestDiscoveryPresentation.ts` | 多 viewer Board 测试点击后立即显示 `已确认 1/3` |
| 9 | 禁止背景关闭时，卡牌 / 事件特写仍不能让地图可交互 | 已修复；本轮补真实命中回归 | `src/games/betrayal/latestDiscoverySurface.tsx` | E2E 在特写可见时点击地图，特写、activeRoom、缩放目标均不变 |
| 10 | 投掷骰子不能永久停在“运动中” | 已修复：动画帧异常进入恢复路径，应用权威骰面并释放 pending / busy 状态 | `src/lib/dice-box-threejs/engine.ts`、`src/lib/dice-physics/DiceBoxPhysicsSource.tsx` | DiceBox 定向测试、Three engine 测试、真实外星几何 E2E |

## 规范回写结论

- 保留并强化 `.spec/knowledge/standards/ui-change-gates.md`：阻塞特写必须占命中层；地图拖拽与房间点击分离。
- 保留并强化 `.spec/knowledge/standards/animation-effects.md`：正式卡面只去重固定说明；自动收口只适用于无决策物品展示；异步动画异常必须终态收口。
- 不新增 Betrayal 专属第二套规范；3000ms 仍是实现常量与本轮任务合同，不复制成另一份可执行正文。
- 本轮反馈矩阵已闭合；房间“拖拽起点在实体本体”的真实浏览器截图证据已补齐，未新增 Betrayal 专属规范正文。

## 验证命令

- `npm run typecheck`
- 改动文件 ESLint
- Betrayal discovery / Board 定向 Vitest
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/event-choice-coverage.e2e.ts "外星几何真实链路从探索翻牌到投掷事件结算关闭"`
- `npm run spec:lint`
- `git diff --check`
