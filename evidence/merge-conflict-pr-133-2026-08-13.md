# 冲突解决汇报：PR #133 Smash Up Disney English Atlas

## 1. 背景

- base: 本批次已合入 PR #127-#132，PR #133 合并前父提交为 `48100e645`。
- head: `deathcats4/codex/smashup-disney-english-pod`，提交 `3c9f41a`。
- 触发命令: `git merge deathcats4/codex/smashup-disney-english-pod --no-commit --no-ff`。
- fork 写权限: 当前账号对 `deathcats4/BoardGame` 没有 push 权限，因此冲突修复直接在主仓隔离合并工作树完成，不写回原 PR head。

## 2. 冲突文件

- `public/assets/i18n/assets-manifest.json`

## 3. 解决策略

### `public/assets/i18n/assets-manifest.json`

- 策略：双方内容合并。
- 冲突块裁决：保留前序 PR 已加入的 Smash Up POD 资源条目，同时加入 PR #133 的 Disney 英文卡牌与基地图集条目。
- 合并要点：冲突发生在根级 i18n manifest 的相邻追加区域；两边资源 key 互不重名，使用 JSON 解析合并父1和父2的 `files` 对象，并确认没有同名不同内容。
- 文件级原因说明：
  - 采用哪一侧作为基线，为什么：没有采用整份单边基线；父1保留已合入资源，父2提供 Disney 英文资源条目，两者合并。
  - 另一侧仍然有效但最终未保留/已迁移的内容：没有放弃任一侧条目；前序 Kaiju/Geckos/Anansi/Fairy Tales 条目与 Disney 英文条目均保留。
  - 若这次判断错了，最可能丢失的用户行为/测试断言：英文 Disney POD 卡图或前序 POD 派系图集无法从根级 manifest 解析到运行时资源。
  - 支撑证据：JSON 解析通过；`disneyEnglishAtlasContract.test.ts` 通过；合并审计显示根 manifest 为混合结果。

## 4. 风险与验证

- 风险点：根级 manifest 条目遗漏、资源哈希/大小错配、后续服务器发布未闭合。
- 验证命令：
  - `node -e "const m=JSON.parse(require('fs').readFileSync('public/assets/i18n/assets-manifest.json','utf8')); console.log(m.files['en/smashup/cards/disney'].variants.png.sha256); console.log(m.files['zh-CN/smashup/cards/kaiju_pod'].variants.png.sha256);"`
  - `npx vitest run src/games/smashup/__tests__/disneyEnglishAtlasContract.test.ts`
  - `npm run merge:audit -- 40115977e`
  - `npm run merge:audit:strict -- 40115977e`
- 验证结果：
  - JSON/root manifest spot check: 通过。
  - Vitest: 1 个测试文件、2 个用例通过。
  - 单边覆盖审计: 根 manifest 为混合结果，完全等于父1/父2均为 0。

## 5. 回归与行为变化登记

- 原 PR 目标问题：补齐 Smash Up Disney 英文 POD 图集根级 manifest 合同。
- 本次额外发现的真实回归：未发现额外真实回归。
- 仅业务口径/规则变化：未发现新的业务口径变化。

## 6. 结果

- 合并提交: `40115977e Merge PR #133 Smash Up Disney English atlas`。
- 推送目标: `origin/main`，将在本批 PR 全部验证通过后统一推送。
