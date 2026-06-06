# DiceThrone CenterBoard 图片回退链修复证据

> 2026-06-05 当前有效口径：本文只保留 Treant / Ninja 玩家面板底图与提示板底图走统一回退链的专项修复证据，不代表 Treant 整英雄、Ninja 整英雄或四位新英雄整批当前完成态。若要判断新英雄补审实时残余，应回到总汇总、单英雄主审计与升级重审主文档。

## 范围

- 修复位置：`src/games/dicethrone/ui/CenterBoard.tsx`
- 同步位置：`e2e/src/games/dicethrone/ui/CenterBoard.tsx`
- 问题对象：玩家面板底图、提示板底图
- 根因：这两个运行时关键图使用 `buildLocalizedImageSet` 写成 CSS background 单路径，绕过了 `OptimizedImage` 的本地包 / public / R2 候选回退链。

## 修复

- 玩家面板底图改为 `<OptimizedImage src={playerBoardPath} locale={locale} />`。
- 提示板底图改为 `<OptimizedImage src={tipBoardPath} locale={locale} />`。
- 保留原容器宽高、比例、点击放大、技能覆盖层与按钮层级。

## 验证

- `npx eslint src/games/dicethrone/ui/CenterBoard.tsx`
- `npm run typecheck`
- `npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`

## 截图核对

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-gameplay.png`
  - 实际看到树精玩家面板完整底图，技能覆盖按钮叠在面板对应位置。
  - 实际看到右侧提示板底图完整显示，不是空白容器。
  - 达到本轮专项验收标准：关键底图不再依赖裸 CSS background 单路径；这只能证明图片回退链修复生效，不能外推成树精当前整英雄已审完。

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-guest-gameplay.png`
  - 实际看到忍者玩家面板完整底图，技能覆盖按钮仍可见。
  - 实际看到忍者提示板底图完整显示，容器比例与原布局一致。
  - 达到本轮专项验收标准：新角色两端对局画面中的玩家面板和提示板都走统一图片回退链；这不是 Treant / Ninja 当前整英雄完成态证明。
