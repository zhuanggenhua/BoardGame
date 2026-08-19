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
  - 2026-05-25：17 tests passed
  - 覆盖静态接入、中文可见/英文隐藏、大娃、二娃、三娃、四娃、五娃、六娃、七娃、一根藤、紫金宝葫芦、人多力量大、妖精哪里逃、碰、快放了我爷爷、毫无存在感、一个一个来、蝴蝶妹妹的帮助。
  - 2026-05-28 修订：19 tests passed；补充覆盖 `葫芦小金刚` 在己方仆从发动天赋后弹出复制提示、选择另一个仆从结算、目标仆从 `talentUsed` 写回、泰坦本回合复制标记写回，以及本回合已复制后不再弹窗。
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
- `npm run typecheck`：通过；2026-05-28 葫芦小金刚触发式复制修订后复跑通过
- `npx vitest run src/games/smashup/__tests__/abilities/huluwawa.test.ts src/games/smashup/__tests__/bases/huluwawa-bases.test.ts`：通过，20 tests passed
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/huluwawa.test.ts --configLoader native --maxWorkers 1`：2026-05-28 通过，19 tests passed
- `npx vitest run src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/factionVariantGroups.test.ts`：通过，80 tests passed
- `npm run test:e2e:ci:file -- e2e/smashup/smashup-huluwawa-pr.e2e.ts`：通过，3 tests passed
- `npm run assets:check`：葫芦娃远端一致；仅报告 unrelated `pretty_pretty.webp` 本地差异

## 2026-05-28 旧结论修订

- 旧结论失效：原文“葫芦小金刚首版复制范围限定为当前引擎已有的 minion talent 主动入口”容易被误读为复制链路已完整落地；玩家反馈后复核发现旧实现只有 `huluwawa_little_king_kong_copy_talent` handler，缺少“仆从发动能力后触发询问”的真实入口。
- 修复口径：`葫芦小金刚` 不再暴露为可手动点的泰坦天赋；系统新增 `onTalentUsed` 触发时机，在己方仆从发动天赋后、且小金刚本玩家回合尚未复制过时，弹出复制提示。
- 当前覆盖：已覆盖当前引擎存在的场上随从 `talent` 主动入口；尚未存在独立“随从持续主动能力”命令形态，因此该类未来入口仍属残余范围。
- 新证据：`src/games/smashup/__tests__/abilities/huluwawa.test.ts` 新增 2 条回归，覆盖正路径与每回合一次不再弹窗。

## 2026-08-19 自检补记：同类扩审

- 扩审范围：围绕 `huluwawa_little_king_kong`、`onTalentUsed`、`talentUsed`、泰坦复制标记和葫芦娃派系内其它 talent 入口，复核葫芦娃能力测试、基地测试、E2E 证据与任务表。
- 命中项：当前仓库已有的“场上随从 talent 主动入口”均走同一 `onTalentUsed` 触发链；本轮没有发现第二条现存的“随从持续主动能力”命令入口。
- 残余扩审范围：如果以后新增不属于 `talent` 的随从手动能力命令形态，需要按同一复制合同追加 C1/C2/C3 和真实入口验证；这属于未来入口，不推翻当前葫芦娃 PR 级交付结论。

## 残余边界

- 葫芦小金刚首版复制范围限定为当前引擎已有的 minion talent 主动入口；尚不存在的其他仆从手动入口（例如未来若引入的随从持续主动能力）不在本 PR 承诺范围内。
- 穿山甲当前复用同一套移动 prompt 程序，单元层覆盖同类移动成功路径；若后续 UI 入口独立变化，应补穿山甲专项 E2E。
- 未把 ignored PNG/WebP 源图纳入 git；交付依赖 manifest hash 与 R2/CDN 回查。
