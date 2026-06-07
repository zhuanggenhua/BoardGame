# DiceThrone 反馈 69c3c83e / 69cba605 历史跟进修复证据（2026-04-22）

> 2026-06-06 当前有效口径：本文只保留反馈 `69c3c83e` 黑屏兼容链与 `69cba605` 骰面不可见链这两条历史反馈的专项修复证据，不代表 DiceThrone 全体 UI / 兼容层、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时这两条反馈链被专项排查和回归过，不能外推成 DiceThrone 当前总体收口。

## 反馈范围

- `69c3c83e1cf16183c29891b7`（critical）：黑屏
- `69cba605d5dec909a0b74c9f`（critical）：无法显示出骰面

## 1) 69cba605（骰面不可见）本轮修复

### 根因

`src/games/dicethrone/ui/Dice3D.tsx` 在 sprite 未就绪时只显示 shimmer 占位。
当华为浏览器/弱网/资源失败导致骰图长期不可用时，用户会看到“没有可识别骰面”的空白感知。

### 代码修复

- 文件：`src/games/dicethrone/ui/Dice3D.tsx`
- 改动：
  - 新增骰面符号到短标签的 fallback 映射（如 `moon -> MN`、`bullet -> BL`）
  - 使用 `getDieFaceByValue` 从骰子定义解析当前面符号
  - 无 sprite 时渲染可见文本兜底，而不是仅 shimmer
  - 补充 `data-face-symbol` 与 `data-face-fallback="glyph"` 标记，便于测试与排查

### 回归测试

- 文件：`src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx`
- 用例更新：`dice sprite 缺失时应渲染可见骰面文本兜底，避免整块空白`
- 新断言：
  - `data-face-fallback="glyph"`
  - `data-face-symbol="moon"`
  - 页面中出现 `MN` 文本

### 验证命令与结果

1. `npx eslint src/games/dicethrone/ui/Dice3D.tsx src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx --configLoader native --maxWorkers 1`
   - 结果：`15 passed`

## 2) 69c3c83e（黑屏）本轮复核结论

该链路当前没有新增回归代码迹象，本轮按“兼容修复仍生效”做了复核：

- 历史根因修复：`useRuntimeViewport` 已将 board-shell 缩放改为 JS 预计算变量（规避旧 WebView CSS 除法失效导致容器高度塌为 0）
- 历史证据截图（已复核可见主画布，不是 HUD 悬空黑底）：
  - `D:\gongzuo\webgame\BoardGame\test-results\android-compat-smoke\dicethrone-local-after-shell-fix\screen.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\android-compat-smoke\dicethrone-tutorial-after-shell-fix\screen.png`
- 本轮补充验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/androidCompatSmoke.test.ts --configLoader native --maxWorkers 1`
  - 结果：`5 passed`

## 本轮结论

- `69cba605`：本文覆盖的代码级修复与单测回归在当轮成立，确保 sprite 缺失时骰面仍可见。
- `69c3c83e`：本文覆盖的黑屏兼容修复链在当轮未发现同类回归证据。

## 当前阅读说明

- 本文只覆盖两条历史反馈链，不覆盖更广范围 DiceThrone UI / 兼容层或新英雄整批完成态。
- 即使本文中的修复、回归和截图在当轮成立，也不能把它当成当前 DiceThrone 或新英雄整批“全面收口”的证明。
