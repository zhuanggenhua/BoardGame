# 山屋惊魂首剧本运行时任务

## 1. Specification

- [x] 1.1 新增首剧本运行时 capability delta。
- [x] 1.2 运行 `openspec validate add-betrayal-first-scenario-runtime --strict --no-interactive`。

## 2. Domain

- [x] 2.1 为 `betrayal` 增加角色选择、恶兆前运行时、终局三阶段 core 状态。
- [x] 2.2 增加选择角色、确认角色、开始首剧本、移动、探索、使用、交易、结束回合、完成首剧本命令。
- [x] 2.3 增加事件、reducer、validate、execute、isGameOver 与 commandTypes。

## 3. UI

- [x] 3.1 角色选择屏按 `betrayal-character-select-style-b.png` 建立主结构。
- [x] 3.2 运行时按 `betrayal-runtime-prehaunt-board-v4.png` 收敛，不采用后续过程稿。
- [x] 3.3 终局屏按 `betrayal-endgame-style-b.png` 建立胜负与统计结构。
- [x] 3.4 去除常驻描述性正文；按钮功能解释只放 hover/title、帮助入口或临时提示。

## 4. Verification

- [x] 4.1 增加或更新领域层 Vitest，证明首剧本命令链路可从选角跑到终局。
- [x] 4.2 更新 Board 组件测试，覆盖三阶段关键入口。
- [x] 4.3 增加 Playwright E2E，使用 online match 或状态注入覆盖角色选择、运行时和终局截图。
- [x] 4.4 实际打开关键截图核对，并记录证据路径。

## 5. Documentation

- [x] 5.1 更新 betrayal 设计文档状态：v4 已批准为实现基线，v5-v12 仅为失败/过程参考。
- [x] 5.2 完成后回写 tasks 勾选状态。

## 当前状态

- `npm run test:e2e:ci:file -- e2e/betrayal-first-scenario.e2e.ts` 已通过，结果为 `1 passed`。
- 真实页面截图已生成并核对：
  - `evidence/betrayal-first-scenario/01-山屋惊魂-角色选择-确认前.png`
  - `evidence/betrayal-first-scenario/02-山屋惊魂-运行时-v4牌桌.png`
  - `evidence/betrayal-first-scenario/03-山屋惊魂-终局-幸存者胜利.png`
  - `evidence/betrayal-first-scenario/betrayal-first-scenario-e2e-test.md`
