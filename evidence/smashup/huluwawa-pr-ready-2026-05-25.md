# Smash Up 葫芦娃 PR 级交付证据

日期：2026-05-25

## 范围

- 分支：`codex/huluwawa-pr-ready-20260525`
- 基线：`sync/upstream-main` / `626ed9a1`
- 交付对象：`huluwawa` 派系 18 张仆从/行动、2 张基地、1 张泰坦。
- 语言策略：`zh-CN` 可见并完整展示；英文界面隐藏派系，仅保留英文卡名以满足现有 i18n 完整性合同。

## 资源证据

- 本地源图已确认并生成压缩图：
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/huluwawa_cards.webp`
  - `public/assets/i18n/zh-CN/smashup/base/compressed/huluwawa_bases.webp`
  - `public/assets/i18n/zh-CN/smashup/taitan/compressed/huluwawa_titan.webp`
- 已更新 `public/assets/i18n/assets-manifest.json` 中的葫芦娃条目。
- 已精确上传 3 个葫芦娃 WebP 到 R2，未执行全量 `assets:upload`，避免上传非本轮 `pretty_pretty.webp` 差异。
- R2 / CDN 回查：
  - cards: md5 / ETag `ae9e76a3b8e209daa7858c1081f7af3e`，CDN HEAD 200
  - bases: md5 / ETag `54c0e690ca4874d794ac39d10a4df7f8`，CDN HEAD 200
  - titan: md5 / ETag `0053d95ec057a81da54bd6b2963e0a62`，CDN HEAD 200
- `npm run assets:check` 复查结果：葫芦娃新增资源已远端一致；仅剩 unrelated `official/i18n/zh-CN/smashup/cards/compressed/pretty_pretty.webp` 本地/远端差异，本轮未上传。

## 行为证据

- `src/games/smashup/__tests__/abilities/huluwawa.test.ts`
  - 17 tests passed
  - 覆盖静态接入、中文可见/英文隐藏、大娃、二娃、三娃、四娃、五娃、六娃、七娃、一根藤、紫金宝葫芦、人多力量大、妖精哪里逃、碰、快放了我爷爷、毫无存在感、一个一个来、蝴蝶妹妹的帮助。
- `src/games/smashup/__tests__/bases/huluwawa-bases.test.ts`
  - 3 tests passed
  - 覆盖葫芦山保护、七彩莲蓬 prompt -> 选择 -> 状态改变 -> interaction 清空。
- `e2e/smashup/smashup-huluwawa-pr.e2e.ts`
  - 3 tests passed
  - 覆盖中文选派详情预览、进局卡牌/基地/泰坦渲染、二娃真实天赋入口、七彩莲蓬真实基地入口与每回合一次限制。

## E2E 截图

- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\01-zh-faction-visible.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\02-zh-faction-detail-preview.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\02b-zh-faction-base-preview.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\03-in-game-huluwawa-resources.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\04-erwa-top-three-prompt.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\05-erwa-reorder-prompt.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\06-erwa-resolved.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\07-lotus-extra-minion-prompt.png`
- `D:\GA\BoardGame-sync-main\test-results\evidence-screenshots\smashup-huluwawa-pr\08-lotus-resolved-once.png`

## 验收命令

- `openspec validate add-smashup-huluwawa-faction --strict --no-interactive`：通过
- `npm run typecheck`：通过
- `npx vitest run src/games/smashup/__tests__/abilities/huluwawa.test.ts src/games/smashup/__tests__/bases/huluwawa-bases.test.ts`：通过，20 tests passed
- `npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/factionVariantGroups.test.ts`：通过，80 tests passed
- `npm run test:e2e:ci:file -- e2e/smashup/smashup-huluwawa-pr.e2e.ts`：通过，3 tests passed
- `npm run assets:check`：葫芦娃远端一致；仅报告 unrelated `pretty_pretty.webp` 本地差异

## 残余边界

- 葫芦小金刚首版复制范围限定为当前引擎已有的 minion talent 主动入口；尚不存在的其他仆从手动入口不在本 PR 承诺范围内。
- 穿山甲当前复用同一套移动 prompt 程序，单元层覆盖同类移动成功路径；若后续 UI 入口独立变化，应补穿山甲专项 E2E。
- 未把 ignored PNG/WebP 源图纳入 git；交付依赖 manifest hash 与 R2/CDN 回查。
