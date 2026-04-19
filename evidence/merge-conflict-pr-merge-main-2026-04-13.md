# 冲突解决汇报：pr-merge-main

## 1. 背景
- base: pr-merge-main
- head: origin/main
- 触发命令: `git merge origin/main --no-commit --no-ff`

## 2. 冲突文件
- .windsurf/skills/merge-pr-workflow/SKILL.md
- e2e/src/games/mobileSupport.ts
- src/assets/audio/registry-slim.json
- src/games/mobileSupport.ts
- src/games/smashup/__tests__/factionAbilities.test.ts
- src/games/smashup/abilities/tricksters.ts

## 3. 解决策略
### .windsurf/skills/merge-pr-workflow/SKILL.md
- 策略：保留 `origin/main` 内容
- 原因：冲突仅为文件尾空行差异，不涉及语义变化。

### src/games/mobileSupport.ts / e2e/src/games/mobileSupport.ts
- 策略：保留 `ResolvedGameMobileSupport.mobileBattlefieldZoom` 为必填，同时维持 manifest entry 输入侧可选。
- 原因：`resolveGameMobileSupport()` 已统一补默认值 `'none'`，resolved 契约必须稳定输出该字段。

### src/assets/audio/registry-slim.json / e2e/src/assets/audio/registry-slim.json
- 策略：以当前分支重新生成的 `src` slim registry 为单次真源，并同步覆盖 `e2e/src` 镜像文件。
- 原因：冲突来自生成产物差异，正确做法是回到生成链路验证；同时 `src` 与 `e2e/src` 都有运行时导入点，必须保持镜像一致。

### src/games/smashup/abilities/tricksters.ts
- 策略：保留单次 `emitSpecialLimitUsed` + `limitEvents` 聚合返回。
- 原因：避免重复记录 special limit，同时保留交互返回 `matchState` 的安全拼接逻辑。

### src/games/smashup/__tests__/factionAbilities.test.ts
- 策略：保留 `specialLimitUsed` 断言，移除依赖后续 `player_mismatch` 的二次激活断言。
- 原因：该测试应验证侏儒 special limit 是否已记录，而不是依赖响应链推进后的玩家切换副作用。

## 4. 风险与验证
- 风险点：移动端 resolved 契约收紧后是否影响现有测试；Smash Up 侏儒 special limit 逻辑与测试口径是否一致。
- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/__tests__/mobileSupport.test.ts src/games/smashup/__tests__/factionAbilities.test.ts --configLoader native`
  - `npx eslint e2e/src/games/mobileSupport.ts src/games/mobileSupport.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/abilities/tricksters.ts`（仅 warning）
  - `node scripts/audio/generate-slim-registry.mjs --force`
  - `Copy-Item src\assets\audio\registry-slim.json e2e\src\assets\audio\registry-slim.json -Force`
  - `npm run quality:changed:pre-commit`
- 验证结果：
  - mobileSupport / factionAbilities 目标测试通过（55 tests passed）
  - ESLint：0 errors，仅既有 warning
  - slim registry 重新生成成功，并已同步 `e2e/src` 镜像（两侧均 303 条）
  - `quality:changed:pre-commit` 全量通过

## 5. 回归与行为变化登记
- 原 PR 目标问题：同步 origin/main 以继续合并主线 PR
- 本次额外发现的真实回归：
  - mobileSupport resolved 类型与默认值约束不一致，导致 merge 后类型口径分叉
  - Smash Up 侏儒 special limit 测试口径偏向 `player_mismatch`，无法准确证明 limit 记录
- 仅业务口径 / 规则变化：无

## 6. 结果
- 提交：待本轮 merge commit
- 推送：待补
