# 冲突解决汇报：PR #135 Smash Up Marvel POD Atlas

## 1. 背景

- base: 本批次已合入 PR #127-#134，PR #135 合并前父提交为 `14974df46`。
- head: `deathcats4/codex/smashup-marvel-pod-independent-20260811`，提交 `a5e23ec`。
- 触发命令: `git merge deathcats4/codex/smashup-marvel-pod-independent-20260811 --no-commit --no-ff`。
- fork 写权限: 当前账号对 `deathcats4/BoardGame` 没有 push 权限，因此冲突修复直接在主仓隔离合并工作树完成，不写回原 PR head。

## 2. 冲突文件

- `docs/user-stories/README.md`
- `public/assets/i18n/en/smashup/assets-manifest.json`

## 3. 解决策略

### `docs/user-stories/README.md`

- 策略：双方内容合并。
- 冲突块裁决：保留 PR #130 的 Geckos 用户故事入口，并加入 PR #135 的 Marvel POD 独立英文图集用户故事入口。
- 合并要点：两个条目描述不同用户故事，互不替代。
- 文件级原因说明：
  - 采用哪一侧作为基线，为什么：没有采用整份单边基线；两个新增索引均为有效追溯入口。
  - 另一侧仍然有效但最终未保留/已迁移的内容：没有放弃任一侧入口。
  - 若这次判断错了，最可能丢失的用户行为/测试断言：后续无法从用户故事总入口追溯 Geckos 或 Marvel POD 图集需求。
  - 支撑证据：合并审计显示该文件为混合结果。

### `public/assets/i18n/en/smashup/assets-manifest.json`

- 策略：双方内容合并。
- 冲突块裁决：保留 Geckos、Anansi Tales、Russian Fairy Tales 英文条目，并加入 Marvel Wave One / Villains POD 英文 PNG 与 WebP 条目。
- 合并要点：该文件是多 PR 新建同一路径 manifest 的 add/add 冲突；资源 key 互不重名，使用 JSON 解析合并父1和父2的 `files` 对象，并确认没有同名不同内容。
- 文件级原因说明：
  - 采用哪一侧作为基线，为什么：没有采用整份单边基线；父1保留前序英文 POD 资源，父2提供 Marvel 英文资源条目，两者合并。
  - 另一侧仍然有效但最终未保留/已迁移的内容：没有放弃任一侧条目。
  - 若这次判断错了，最可能丢失的用户行为/测试断言：英文环境下 Marvel POD 或前序 POD 派系卡图无法从游戏级 manifest 解析到运行时资源。
  - 支撑证据：JSON 解析通过；`marvelPodResourceContract.test.ts` 通过；合并审计显示该 manifest 为混合结果。

## 4. 风险与验证

- 风险点：用户故事入口丢失、英文游戏级 manifest 条目遗漏、资源哈希/大小错配、后续服务器发布未闭合。
- 验证命令：
  - `node -e "JSON.parse(require('fs').readFileSync('public/assets/i18n/en/smashup/assets-manifest.json','utf8')); console.log('json ok')"`
  - `npx vitest run src/games/smashup/__tests__/marvelPodResourceContract.test.ts`
  - `npm run merge:audit -- d2819c603`
  - `npm run merge:audit:strict -- d2819c603`
- 验证结果:
  - JSON: 通过。
  - Vitest: 1 个测试文件、7 个用例通过。
  - 单边覆盖审计: 3 个共享文件均为混合结果，完全等于父1/父2均为 0。

## 5. 回归与行为变化登记

- 原 PR 目标问题：补齐 Marvel Wave One / Villains POD 独立英文图集资源合同。
- 本次额外发现的真实回归：未发现额外真实回归。
- 仅业务口径/规则变化：未发现新的业务口径变化。

## 6. 结果

- 合并提交: `d2819c603 Merge PR #135 Smash Up Marvel POD atlas`。
- 推送目标: `origin/main`，将在本批 PR 全部验证通过后统一推送。
