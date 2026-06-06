# Smash Up shayu 三派系 intake 验证记录（2026-05-10）

## 范围

- 批次：`shayu`
- 派系：`sharks`（鲨鱼）、`tornados`（龙卷风）、`mythic_greeks`（希腊神话）
- 验证目标：素材网格、静态卡牌/基地注册、i18n、关键图预加载、资源 manifest、R2/CDN 可访问性。
- 非目标：本轮只完成 intake / 静态接入，不声明完整玩法 handler 已实现。

## 图集肉眼核对

### Cards atlas

- 证据图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\temp\smashup-shayu-intake\cards-grid-8x5.jpg`
- 我实际看到：
  - 网格为 5 行 × 8 列；Sharks 占 index `0-11`，Tornados 占 index `12-23`，Mythic Greeks 占 index `24-39`。
  - index `39` 是 `Mythic Greeks` 标题/封面格，不是牌组卡；代码与测试均未把它注册为 `CardDef`。
  - 三派系牌面顺序与 `shayuFactionIntake.test.ts` 的 atlas index 合同一致。

### Base atlas

- 证据图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\temp\smashup-shayu-intake\base-grid-3x4.jpg`
- 我实际看到：
  - 网格为 4 行 × 3 列，row-major 下目标基地为：`Shark Reef` index 2、`Oracle at Delphi` index 5、`Trailer Park` index 6、`Wooden Horse` index 8、`The Deep` index 9、`Tornado Alley` index 11。
  - 六个目标基地的 breakpoint 与 VP 在图面上分别为：20/4-2-1、18/4-2-1、20/4-2-1、21/3-2-1、16/3-2-2、25/4-3-2。
  - 其余 6 格属于本轮三派系以外的基地，本轮只记录为非 scope，没有接入 `BaseCardDef`。

## 资源与 CDN

已执行：

```text
npm run compress:images -- public/assets/i18n/zh-CN/smashup
node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id smashup
node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup
npm run assets:check
Invoke-WebRequest -Method Head https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/shayu.webp
Invoke-WebRequest -Method Head https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/shayu.webp
```

结果：

- `cards/compressed/shayu.webp`：已生成，本地大小 `899018` bytes；CDN HEAD `200`，`Content-Type=image/webp`。
- `base/compressed/shayu.webp`：已生成，本地大小 `416934` bytes；CDN HEAD `200`，`Content-Type=image/webp`。
- `public/assets/i18n/zh-CN/smashup/assets-manifest.json`：已生成并通过定向校验。
- `npm run assets:check`：本地符合上传条件文件 13 个，远端 12908 个；检查结果 `新增 0，变更 0，未变更 13`，说明本轮 `shayu` 压缩资源在远端已存在且 MD5 一致。
- 备注：全量 `npm run assets:validate` 当前因既有 `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json.json` hash/bytes 不一致失败；本轮已用 `--root public/assets/i18n/zh-CN --id smashup` 完成 SmashUp 定向 manifest 校验。

## 静态与测试验证

已执行：

```text
npx eslint src/games/smashup/data/factions/sharks.ts src/games/smashup/data/factions/tornados.ts src/games/smashup/data/factions/mythic_greeks.ts src/games/smashup/data/cards.ts src/games/smashup/domain/ids.ts src/games/smashup/domain/atlasCatalog.ts src/games/smashup/ui/factionMeta.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts scripts/scrape-wiki-with-descriptions.mjs
npm run i18n:check
..\..\node_modules\.bin\vitest.cmd run src/games/smashup/__tests__/shayuFactionIntake.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/factionVariantGroups.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native --maxWorkers 1
git diff --check
```

结果：

- ESLint：0 errors；`src/games/smashup/data/cards.ts` 仍有 4 个既有 warning（unused helper / `@ts-ignore`），本轮未新增 error。
- i18n：`i18n-check: no missing keys detected`。
- Vitest：5 files passed / 86 tests passed。
- `git diff --check`：通过；仅提示 Windows 换行警告。

## 当前未覆盖 / 风险

- 本轮没有实现三派系的完整玩法 handler；UI 已标记 `implementationStatus: 'in_progress'`，避免把静态入口误宣称为完整可玩。
- 本轮没有新增 E2E，因为改动范围是素材、静态注册、i18n 与关键预加载；真实卡牌能力交互需要在后续 implementation 阶段逐卡补 handler、单测/行为测试与必要 E2E。
- `shayu.png` 与 `shayu.webp` 受 `.gitignore` 命中；提交资产时需要显式 `git add -f public/assets/i18n/zh-CN/smashup/{cards,base}/shayu.png public/assets/i18n/zh-CN/smashup/{cards,base}/compressed/shayu.webp`，否则 `git status` 默认不会显示它们。
- 这份 2026-05-10 验证记录只证明了 atlas、静态注册、关键预加载、manifest、`i18n:check` 与既有测试通过，**不能证明每张卡/基地的 locale 文本语义正确**。
- `赫拉的恩惠（mythic_greeks_favor_of_hera）` 在 2026-06-04 被证实存在“把任意仆兵误录成你的仆兵”的 `i18n + 实现` 联动错误，说明当时验证缺少“逐张卡回单卡主裁图核对正文限定词”的门禁。
- 因此旧结论“i18n 已验证”自 2026-06-04 起必须限缩解释为：`key` 完整、结构接线正确、不会因缺 key 报错；**不得再把它当作文案语义已逐项核对的证明**。
