# 冲突解决汇报：task/e2e-smashup-rewrite

## 1. 背景
- base: `origin/main@69a304e9eaa4deb8c5f875f0364d0da23f68cf33`
- head: `task/e2e-smashup-rewrite@55d131decb57dfa6c3600385afafa3b3e1b2a0cb`
- 触发命令: `git merge task/e2e-smashup-rewrite --no-commit --no-ff`
- 合并工作分支: `merge-temp-task-e2e-smashup-rewrite`

## 2. 冲突文件
- `.windsurf/skills/adapt-game-mobile/SKILL.md`
- `e2e/dicethrone-paladin-vengeance-select-player.e2e.ts`
- `e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- `e2e/dicethrone-status-interaction-cancel.e2e.ts`
- `e2e/dicethrone/dicethrone-status-interaction-complete.e2e.ts`
- `e2e/dicethrone-status-removal.e2e.ts`
- `e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts`
- `e2e/smashup/smashup-4p-layout-test.e2e.ts`
- `e2e/summonerwars/summonerwars-custom-deck.e2e.ts`
- `scripts/infra/e2e-port-config.js`
- `scripts/infra/vite-with-logging.js`
- `src/games/smashup/ui/FactionSelection.tsx`

## 3. 解决策略
### `.windsurf/skills/adapt-game-mobile/SKILL.md`
- 策略：合并两侧规则。
- 合并要点：保留主分支新增的“必须看图、必须对照 PC、截图有效性判定”规则，同时保留本分支新增的 `board-shell` 全屏面板与 PC 同构、主操作首屏可见要求。
- 原因：两侧规则都有效，属于同一规范体系，二选一会丢掉约束。

### `e2e/dicethrone-paladin-vengeance-select-player.e2e.ts`
- 策略：保持主分支删除。
- 合并要点：不恢复被主分支删除的旧用例。
- 原因：主分支已把相关覆盖收口到新的 `dicethrone-simple-start.e2e.ts` 中，旧文件恢复会造成重复和维护分叉。

### `e2e/dicethrone/dicethrone-simple-start.e2e.ts`
- 策略：保留主分支版本。
- 合并要点：采用主分支更完整的在线对局/四人模式/状态交互收口版本，不退回本分支较早基线上的精简 smoke 版本。
- 原因：主分支覆盖面更大，且已吸收部分本分支原先独立文件承担的职责。

### `e2e/dicethrone-status-interaction-cancel.e2e.ts`
- 策略：保持主分支删除。
- 合并要点：不恢复被主分支删除的旧取消按钮专项。
- 原因：主分支已把该交互契约并入 `dicethrone-status-interaction-complete.e2e.ts`。

### `e2e/dicethrone/dicethrone-status-interaction-complete.e2e.ts`
- 策略：保留主分支版本。
- 合并要点：采用主分支当前的共享 UI 契约测试集合，不回退到本分支旧基线上的另一版实现。
- 原因：主分支版语义更清晰，也已覆盖取消、不选状态、转移状态等主路径。

### `e2e/dicethrone-status-removal.e2e.ts`
- 策略：保持主分支删除。
- 合并要点：不恢复旧的状态移除专项文件。
- 原因：对应覆盖已并入主分支现有收口文件，恢复旧文件会重复。

### `e2e/dicethrone/dicethrone-tutorial-simple.e2e.ts`
- 策略：保留主分支版本。
- 合并要点：采用主分支当前更完整的教程推进流程，不回退到本分支的较简化版本。
- 原因：主分支版覆盖了更多真实教程阶段。

### `e2e/smashup/smashup-4p-layout-test.e2e.ts`
- 策略：合并两侧。
- 合并要点：保留主分支已有的四人布局与怪物天赋移动端测试，同时加入本分支新增的“横屏移动端派系详情应完整显示并可滚动查看全部卡牌”用例及其场景构造函数。
- 原因：两侧覆盖点不同，互补而非替代。

### `e2e/summonerwars/summonerwars-custom-deck.e2e.ts`
- 策略：保留主分支版本。
- 合并要点：采用主分支更完整的构牌器入口、开关、长按放大、卡池浏览等覆盖，不退回本分支的精简入口版。
- 原因：主分支版覆盖更完整，且更接近当前产品风险面。

### `scripts/infra/e2e-port-config.js`
- 策略：合并两侧。
- 合并要点：单 worker 端口配置同时兼容 `PW_E2E_*` 与既有 `PW_PORT/PW_GAME_SERVER_PORT/PW_API_SERVER_PORT` 命名。
- 原因：主分支和本分支使用了两套环境变量名，直接选一侧会导致另一侧脚本/命令失效。

### `scripts/infra/vite-with-logging.js`
- 策略：合并两侧。
- 合并要点：保留主分支的 inline fallback / spawn EPERM 兜底逻辑，同时加入本分支的 `CI=1` 环境变量补丁。
- 原因：两侧都在修 E2E 基建稳定性，缺一都会丢能力。

### `src/games/smashup/ui/FactionSelection.tsx`
- 策略：合并两侧。
- 合并要点：保留主分支的阵营可见性过滤与现有整体布局，同时加入本分支的横屏移动端详情弹层等比缩放方案，并将弹层背景纹理统一到主分支固定节距写法。
- 原因：主分支已有 UI 细化，本分支修的是移动端弹层适配，两者必须同时保留。

## 4. 风险与验证
- 风险点：
  - DiceThrone 若主分支收口文件并未完全覆盖旧专项，可能存在回归盲点。
  - `smashup-4p-layout-test.e2e.ts` 新增派系详情用例后，截图序号和既有证据路径要保持可读。
  - E2E 端口脚本同时兼容两套 env 名称，后续若继续统一命名需再清理。
- 验证命令：
  - `git diff --check`
  - `npm run typecheck`
- 验证结果：
  - `git diff --check`：通过
  - `npm run typecheck`：通过

## 5. 结果
- 合并提交：待提交
- 推送目标：`origin/main`
