# Smash Up 卡牌选项展示回归 E2E 证据

## 范围

- 目标 1：企鹅帝皇天赋交互中的低战力随从选项，应按卡牌展示，而不是退化成纯文字按钮。
- 目标 2：悬浮机器人检索到牌库顶随从后，当前 E2E 应对齐现行 UI 与流程语义，不再绑死旧的文案和二段基地选择假设。
- 目标 3：Smash Up 测试页在 E2E runtime 下不应因启动期空值读取提前崩到“游戏加载失败”。

## 代码落点

- `src/games/smashup/abilities/titans.ts`
  - 企鹅帝皇天赋选项使用卡牌 uid 作为 option id，维持卡牌展示路径。
- `src/games/smashup/abilities/ancient_egyptians.ts`
  - 埋葬牌选项继续使用埋葬牌 uid 派生 id，和场景内直选展示保持一致。
- `src/games/smashup/Board.tsx`
  - 为测试页启动早期的 `core.players` / `core.bases` / `core.turnOrder` / `core.titans` 访问补空值兜底，避免 harness 注册前整页崩溃。
- `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts`
  - 悬浮机器人：对齐当前中文按钮语义“放回牌库顶”，并兼容“唯一基地直接自动落位”。
  - 企鹅帝皇：定位器改为当前稳定节点 `data-option-id`，不再依赖旧的 `prompt-card-*` 假设。

## 验证命令

```bash
npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts
npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "悬浮机器人应显示可选卡牌并允许打出"
BG_HEAVY_MEMORY_MIN_FREE_GB=1.0 npm run test:e2e:ci:file -- e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "企鹅帝皇天赋交互应显示卡牌选项而不是文字按钮"
```

## 结果

- `src/games/smashup/__tests__/smashup.smoke.test.ts`：`95 passed`
- `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts` `悬浮机器人应显示可选卡牌并允许打出`：`1 passed`
- `e2e/smashup/smashup-robot-hoverbot-new.e2e.ts` `企鹅帝皇天赋交互应显示卡牌选项而不是文字按钮`：`1 passed`

## 截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\企鹅帝皇天赋交互应显示卡牌选项而不是文字按钮\emperor-penguin-talent-card-prompt.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\悬浮机器人应显示可选卡牌并允许打出\hoverbot-interaction-visible.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\悬浮机器人应显示可选卡牌并允许打出\hoverbot-played-pirate.png`

## 肉眼观察

- `emperor-penguin-talent-card-prompt.png`
  - 覆盖层里展示的是一张可点击卡牌，不是单行文字按钮。
  - 选项区域能直接看到卡面缩略图与卡牌外框，说明 `displayMode: card` 已走到真实渲染层。
  - 画面中没有与“大副（手牌）”并列的普通矩形按钮，符合“按钮改卡牌显示”的目标。

- `hoverbot-interaction-visible.png`
  - 覆盖层里有一张可打出的牌面卡片，同时保留一个“放回牌库顶”按钮，说明当前 UI 语义已经不是旧测试假设的“跳过”单词。
  - 卡牌与按钮同屏，但主操作视觉重点明显落在卡牌上。
  - 页面本体正常渲染，没有再落到“游戏加载失败”错误页。

- `hoverbot-played-pirate.png`
  - 打出完成后，基地上能看到新增的海盗随从，说明额外打出链路已真正落到场面，不只是交互关闭。
  - 原始悬浮机器人仍在同一基地，说明 E2E 最终断言对应的双随从同场结果成立。
  - 页面布局与牌面层级正常，没有出现启动期白屏或错误兜底页。

## 结论

- 这轮代码修复已经把“企鹅帝皇天赋退化成文字按钮”的问题收住。
- 这轮 E2E 更新同时清理了两类过时假设：旧按钮文案假设、旧二段基地选择假设。
- 当前剩余风险主要不在这两个目标点本身，而在仓库里仍存在大量其他未收口脏改；本证据仅覆盖本次实际复跑的 1 条 smoke 和 2 条定向 E2E。
