# DiceThrone 实施中斜横幅 UI 收口证据（历史归档，2026-05-12）

## 当前状态

- 本文档保留为历史收口记录。
- 自当前主线起，树精与忍者已关闭角色选择页里的 `implementation_in_progress` 状态，不再显示“实施中”斜横幅。
- 下文描述的是 2026-05-12 当时仍保留实施中横幅时的 UI 收口结论，不再代表当前线上状态。

## 范围

- 角色选择页的“实施中”状态 UI。
- 树精、忍者两个仍处于实施中的角色卡。
- 本轮目标：删除角色选择里的第二套小胶囊/pill 分支，只保留斜向覆盖横幅。

## 实现结论

- `CharacterBadgeDef.variant` 已收敛为 `disabled-overlay`。
- `CharacterSelectionBadge` 不再接受 `mode="pill"` / `mode="overlay"` 分支参数；组件只输出斜向覆盖横幅。
- `CharacterSelectionSkeleton` 与 `DiceThroneHeroSelection` 已删除 `getPillBadges` 和 pill 渲染块。
- 树精、忍者的 `implementation_in_progress` 均使用 `variant: 'disabled-overlay'`。

## 验证

- `npx eslint src/components/game/framework/CharacterSelectionBadge.tsx e2e/dicethrone/character-selection.e2e.ts`
- `npm run typecheck`
- `npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`

E2E 结果：1 passed。

## 截图与肉眼检查

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-implementation-card.png`
   - 树精角色卡上看到一条黑黄斜向覆盖横幅。
   - 横幅文字为“实施中”。
   - 未看到左上角小胶囊/pill 形态。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\ninja-implementation-card.png`
   - 忍者角色卡上看到同一套黑黄斜向覆盖横幅。
   - 横幅文字为“实施中”。
   - 未看到第二套实施中 UI。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`
   - 真实选角页里树精和忍者同时显示为斜横幅实施中状态。
   - 左侧列表仍可滚动展示角色，未改角色选择页布局。
   - P1/P2 选角标记仍正常显示。
