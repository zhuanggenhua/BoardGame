# 冲突解决汇报：dicethrone-treant-ninja 合并 main

## 1. 背景

- 日期：2026-05-11
- base：`726927fd3630103aeb07f04c5f853d45c858ac99`
- main/HEAD：`a77979fe65e9188f4cf0277abdc076f8a71d494e`
- head/MERGE_HEAD：`d9e504879d5fdce6cadb552e8d71b6c7cb94e730`
- 触发命令：`git merge -X patience d9e504879d5fdce6cadb552e8d71b6c7cb94e730 --no-commit --no-ff`
- 合并目标：把 DiceThrone Treant / Ninja 新英雄、资源、审计、E2E 与新增通用派系 skill 合并入 `main`。

## 2. 冲突文件

- `progress.md`
- `public/assets/atlas-configs/assets-manifest.json`
- `public/assets/common/assets-manifest.json`
- `public/assets/i18n/assets-manifest.json`

## 3. 解决策略

### `progress.md`

- 策略：手工合并双方记录，保留 main 侧 2026-05-10 线上反馈/SmashUp/命令异常处理进度，也保留 Treant / Ninja 新英雄从初始误收口、重来、资源链、审计、E2E 到按钮排版补强的完整进度。
- 冲突块裁决：
  - 文件开头 Session 冲突：双方合并。main 侧是当前线上反馈修复事实；Treant/Ninja 侧是本轮新英雄 worktree 起点和已读规范记录，二者互不替代。
  - 文件后段 2026-05-10 进度冲突：双方合并。main 侧是 SmashUp / Cardia 反馈清零记录；Treant/Ninja 侧是本轮新英雄的重来审计、机制 E2E、按钮排版补强记录，均需保留以便跨轮追溯。
- 原因：`progress.md` 是事实/进度记录，不允许整份单边覆盖；双方内容都代表不同任务线的有效历史。

### `public/assets/atlas-configs/assets-manifest.json`

- 策略：不手工拼 JSON；用项目资源生成脚本重新生成。
- 冲突块裁决：重新生成后的清单同时包含 main 已有 atlas 资源与 Treant/Ninja 新增 `dicethrone/ability-cards-ninja.atlas.json`、`dicethrone/ability-cards-treant.atlas.json`。
- 原因：manifest 是派生产物，脚本生成比块级人工拼接更可靠，避免 hash/size/mtime 不一致。

### `public/assets/common/assets-manifest.json`

- 策略：不手工拼 JSON；用项目资源生成脚本重新生成。
- 冲突块裁决：保留当前工作树 common 资源真实扫描结果。
- 原因：该文件是派生产物，应由 `npm run assets:manifest` 统一裁决。

### `public/assets/i18n/assets-manifest.json`

- 策略：不手工拼 JSON；用项目资源生成脚本重新生成。
- 冲突块裁决：重新生成后的清单保留 main 已有 i18n 资源，同时包含 Treant/Ninja 的 player-board、ability-cards、dice、status-icons-atlas 与 token/icon 资源条目。
- 原因：该文件是派生产物，且本轮新增资源较多，脚本生成可避免遗漏压缩资源与 hash。

## 4. 高风险 UI/交互文件专项审查

- 命中文件：
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/AbilityOverlays.tsx`
  - `src/games/dicethrone/ui/PassiveAbilityPanel.tsx`
  - `src/games/dicethrone/ui/abilitySlotLayout.ts`
  - `src/games/dicethrone/ui/abilitySlotMapping.ts`
- 三方/近期提交检查：
  - `Board.tsx` 近期 main 提交：`b73daa2a`、`9a9468ad`、`563c9dd3`；本次合并只把被动动作入口从 `drawCard` 扩展到 `drawCard | custom`，用于树精自定义被动，不覆盖近期主分支其他交互链路。
  - `PassiveAbilityPanel.tsx` 近期 main 提交：`656515ef`、`cd9cdd5f`、`28caab9a`；本次合并仅新增 custom 图标、短按钮文案、token/CP 成本展示和 `data-testid`，未回退主分支壳层/布局能力。
  - `AbilityOverlays.tsx` / slot mapping / layout 仅补 Treant/Ninja 卡牌映射、槽位映射和 v2 面板尺寸声明，属于新英雄接线。
- 风险判断：主要风险是被动按钮入口、Prompt/Overlay 和技能槽位映射误接。该风险由 Treant/Ninja 机制 E2E 与选角 E2E 覆盖。

## 5. 回归与行为变化登记

- 原 PR/任务目标问题：
  - 新增 DiceThrone `treant` / `ninja` 英雄及资源、卡牌、token、规则文档、i18n、审计与 E2E。
  - 补齐树精生命源泉、木苗/幼种树灵、神圣、刺藤，以及忍者忍术、烟雾弹、慢性中毒、不可防御分支。
- 本次额外发现的真实回归：
  - 合并阶段未发现新的业务回归；冲突集中在进度文档与派生 manifest。
- 仅业务口径 / 规则变化：
  - 新增 `.windsurf/skills/add-new-faction/`，把“新增派系/角色”沉淀为项目通用 workflow；同时补强 DiceThrone hero intake 文档的完成门禁。

## 6. 风险与验证

### 已执行

- `npm run assets:manifest`：通过，重新生成 atlas-configs/common/i18n/splendor manifest。
- `npm run assets:validate`：通过，4 个 manifest 校验通过。
- 冲突标记聚焦扫描：`progress.md` 与 3 个冲突 manifest 未发现 `<<<<<<<` / `=======` / `>>>>>>>`。

### 已执行（合并后）

- `git diff --cached --check`：通过。
- 冲突标记扫描：`rg -n "^(<{7} |={7}$|>{7} )" AGENTS.md docs .agent src e2e evidence progress.md ...`：无命中。
- `npx eslint src/games/dicethrone/Board.tsx src/games/dicethrone/ui/PassiveAbilityPanel.tsx src/games/dicethrone/ui/AbilityOverlays.tsx src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/reduceCombat.ts e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts e2e/dicethrone/character-selection.e2e.ts`：0 errors，3 个既有 Fast Refresh warnings。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run i18n:check`：通过。
- `PW_PORT=6482 PW_GAME_SERVER_PORT=20309 PW_API_SERVER_PORT=21309 PW_WORKERS=1 npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts`：10 passed。
- `PW_PORT=6483 PW_GAME_SERVER_PORT=20310 PW_API_SERVER_PORT=21310 PW_WORKERS=1 npm run test:e2e:ci:file -- e2e/dicethrone/character-selection.e2e.ts "树精和忍者应该能够选角并进入游戏"`：1 passed。

### 实际看图记录

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精木苗树灵两个主阶段按钮应短文案展示并真实结算\01-sapling-short-buttons-before-use.png`：右侧树精按钮显示短文案“治疗+CP / 抽牌”，描述未再塞进按钮；成本标签仍可见。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\02-life-sap-bonus-die-overlay.png`：奖励骰本体与投掷结果可见，提示“掷出 5，将治疗 3”。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精生命源泉应在主阶段触发奖励骰治疗并收口\03-life-sap-after-close.png`：特写收口后回到主阶段，HP 从 35 到 38，并显示 +3 治疗跳字。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者忍术6点应弹出分支选择并能施加慢性中毒\02-ninjutsu-6-choice-modal.png`：忍术 6 点真实出现分支选择弹层，两个分支按钮可见。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者6点不可防御分支和慢性中毒回合结束应真实收口\05-delayed-poison-after-turn-end.png`：回合结束后慢性中毒结算，HP 已扣减并处于可继续流程状态。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\树精和忍者应该能够选角并进入游戏\treant-ninja-selection.png`：选角列表中 Treant/Ninja 均可选择，并显示“实施中”状态标签。

### 待执行

- merge commit 后 `npm run merge:audit -- HEAD`。

## 7. 结果

- 提交：待 merge commit 后回填。
- 推送：未执行。
