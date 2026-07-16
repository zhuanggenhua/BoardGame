# PR #98 合并冲突审计：origin/main -> codex/smashup-what-were-we-thinking-pr

- 时间：2026-07-15
- 执行目录：`temp/pr-98-merge-fix`
- PR head：`201a7510d7f81eef776c99f3f6ddc34aa7485da3`
- 合入 main：`2e5e02b86a01667ce88526d206a4f8aed880e6d6`

## 冲突范围

- `.gitignore`
- `public/assets/i18n/assets-manifest.json`
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- `public/locales/en/game-smashup.json`
- `public/locales/zh-CN/game-smashup.json`
- `src/games/smashup/__tests__/FactionSelection.variantLock.test.tsx`
- `src/games/smashup/__tests__/criticalImageResolver.test.ts`
- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/data/cards.ts`

## 裁决结论

- `.gitignore`：同时保留《我们到底在想什么？》卡图/基地图例外，以及 main 已合入的 Promo 与文化冲击资源目录例外。
- 资源 manifest 与本地化 JSON：以 main 为底深合并 PR #98 新增 key，保留 Promo、文化冲击与《我们到底在想什么？》三组内容。
- `FactionSelection.variantLock.test.tsx`：继续使用 `arrayContaining`，保留既有实施中派系和文化冲击四派系断言，避免新增实施中派系导致排序测试误失败。
- `criticalImageResolver.test.ts`：拆成三个独立用例，分别覆盖《我们到底在想什么？》、Promo 绵羊/全明星、文化冲击四派系的关键图预热。
- `abilities/index.ts`：同时注册《我们到底在想什么？》与文化冲击四派系能力/交互处理器。
- `data/cards.ts`：同时注册《我们到底在想什么？》基地和文化冲击四派系基地。

## 验证

- JSON parse：`public/assets/i18n/assets-manifest.json`、`public/assets/i18n/zh-CN/smashup/assets-manifest.json`、`public/locales/en/game-smashup.json`、`public/locales/zh-CN/game-smashup.json` 解析通过。
- 定向 Vitest：`FactionSelection.variantLock.test.tsx` 与 `criticalImageResolver.test.ts` 共 26 个用例通过。
- `npm run i18n:check`：通过，无缺失本地化 key。
- `npm run assets:validate`：通过，`public/assets/i18n/assets-manifest.json` 增量校验通过。
