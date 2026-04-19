# 冲突解决汇报：sync-pr62

## 1. 背景
- base: `main` / `a1b0b587`
- head: `sync/pr62` / `738679a4`
- 触发命令: `git merge sync/pr62 --no-commit --no-ff`

## 2. 冲突文件
- `.github/workflows/android-ota-publish.yml`
- `AGENTS.md`
- `docs/deploy.md`
- `docs/mobile-release.md`
- `e2e/smashup/smashup-gameplay.e2e.ts`
- `scripts/mobile/publish-android-ota.mjs`
- `scripts/mobile/release-android.mjs`
- `src/games/dicethrone/__tests__/paladin-abilities.test.ts`
- `src/games/smashup/abilities/cthulhu.ts`

## 3. 解决策略
### 保留 main 侧实现
- `.github/workflows/android-ota-publish.yml`
- `AGENTS.md`
- `docs/deploy.md`
- `docs/mobile-release.md`
- `scripts/mobile/publish-android-ota.mjs`
- `scripts/mobile/release-android.mjs`
- `src/games/dicethrone/__tests__/paladin-abilities.test.ts`
- `src/games/smashup/abilities/cthulhu.ts`
- 原因：`main` 侧在 OTA 门禁、发布口径、圣骑士断言、Cthulhu 选项构造上都更接近当前主线规则，`sync/pr62` 的冲突片段多为旧逻辑或等价写法。

### 保留 sync/pr62 侧实现
- `e2e/smashup/smashup-gameplay.e2e.ts`
- 原因：分支侧把“适者生存”补成了更完整的平局选择链路断言，属于真实测试增强，且 `main..sync/pr62` 仅在该段存在差异。

## 4. 风险与验证
- 风险点：`sync/pr62` 相对 `main` 领先 6 个提交且落后 31 个提交，涉及 OTA、Smash Up、在线 AI、API 等多处改动；本次仅对冲突点做了人工裁决。
- 已跑校验：
  - `npm run i18n:check`
  - `npx vitest run src/games/dicethrone/__tests__/paladin-abilities.test.ts -t "正义祈祷 - 4 Pray 触发"`
- 未跑校验：本次未对 `sync/pr62` 全量独有改动做完整回归；若后续需要可补跑对应模块测试。

## 5. 结果
- merge commit: 待提交
- push 目标：未执行
