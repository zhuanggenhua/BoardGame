# DiceThrone Common 角色头像图集替换证据（2026-05-13）

> 2026-05-16 修订：本证据记录的方案已判定为错误方案，不再作为有效验收依据。
> 错误点是把 `characterhead2.png` 裁入老角色共享 `character-portraits` 合同，导致老角色头像合同被新图集尺寸污染。
> 后续有效口径以 `evidence/dicethrone/dicethrone-treant-ninja-portrait-atlas-fix-2026-05-13.md` 的 2026-05-16 修订段为准：老角色恢复旧 `character-portraits`，Treant / Ninja 单独使用 `characterhead2`。
> 2026-06-05 当前阅读门禁：本文只能证明“2026-05-13 当时为何会尝试那套错误头像替换方案，以及当时截图里看到了什么”，不能再被当作当前头像合同、当前选角状态或 Treant / Ninja 当前补审完成态的证据。

## 范围

- 来源：`public/assets/i18n/zh-CN/dicethrone/images/Common/characterhead2.png`
- 运行时图集：`public/assets/i18n/zh-CN/dicethrone/images/Common/character-portraits.png`
- 压缩产物：`public/assets/i18n/zh-CN/dicethrone/images/Common/compressed/character-portraits.webp`
- 重点校准：忍者为新素材第 3 个头像，树精为新素材第 14 个头像。

## 处理

- 从 `characterhead2.png` 裁出顶部有效 6×3 头像区域，生成 `character-portraits.png`。
- 生成运行时 WebP：2048×1485，655846 bytes。
- 更新头像图集合同：3570×2589，6 列 × 3 行。
- 更新索引：`ninja: 2`，`treant: 13`（代码 0-based，对应用户描述的第 3 / 第 14 个）。
- 已重建 `public/assets/i18n/assets-manifest.json`。
- 已上传 R2/CDN，远端 SHA-256 与本地一致：`3316b86a1ca53be69725ad9a61e31efc2ad9391147fda0aa2999f520a97a86c2`。

## 验证

- `npx eslint src/games/dicethrone/ui/assets.ts e2e/src/games/dicethrone/ui/assets.ts`
- `npm run typecheck`
- `npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`

E2E 结果：1 passed。

## 截图与肉眼检查

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`
   - 选角页左侧列表中，树精显示为新图集第 14 个树人头像。
   - 忍者显示为新图集第 3 个黑绿忍者头像。
   - 该截图拍摄于旧方案仍在时点，因此当时还能看到 `implementation_in_progress` 横幅；这只是历史截图事实，不代表当前主线仍保留该状态。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-implementation-card.png`
   - 树精卡片本体能看到新树人头像。
   - 同图若看到实施中横幅，也只属于 2026-05-13 旧方案阶段的历史状态。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\ninja-implementation-card.png`
   - 忍者卡片本体能看到新忍者头像。
   - 同图若看到实施中横幅，也只属于 2026-05-13 旧方案阶段的历史状态。
