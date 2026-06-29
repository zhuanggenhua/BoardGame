## 1. 规格与覆盖矩阵

- [x] 1.1 确认 `betrayal` 教程覆盖矩阵中“本轮承诺章节”的最终范围。
- [x] 1.2 为 `tutorial-engine` 与 `betrayal-tutorials` 写入 spec delta。
- [x] 1.3 运行 `openspec validate add-betrayal-basic-tutorial --strict --no-interactive` 并通过。

## 2. 教程接线

- [x] 2.1 为 `betrayal` 新增 `src/games/betrayal/tutorial.ts`，导出 `TutorialCollection`。
- [x] 2.2 在 `betrayal` 运行时接入教程系统，确认教程状态仍以 `G.sys.tutorial` 为唯一真相源。
- [x] 2.3 运行 manifest 生成链，确认 `betrayal` 获得 `loadTutorial` / `tutorialCatalog` 解析入口。

## 3. 教程章节与真实锚点

- [x] 3.1 在 `Board.tsx` 与必要页面里补最小真实教程锚点，至少覆盖角色选择、恶兆前动作区、持有区、房间区、帮助入口和 haunt 关键动作。
- [x] 3.2 实现首批基础教程章节，至少覆盖基础目标、恶兆前主循环、第一剧本英雄目标与英雄线收尾。
- [x] 3.3 补齐对应 i18n 文案，并保持与当前正式运行时术语一致。

## 4. 验证与证据

- [x] 4.1 新增教程结构测试与锚点测试。
- [x] 4.2 回归 `basic-flow` 与 `first-scenario`，确认教程接线不破坏现有真实链路。
- [x] 4.3 若本轮新增教程级 E2E，记录真实截图证据到 `evidence/betrayal-tutorial/`。
- [x] 4.4 更新 `docs/games/betrayal/README.md`，明确首轮教程已覆盖什么、哪些仍留待后续子教程。
