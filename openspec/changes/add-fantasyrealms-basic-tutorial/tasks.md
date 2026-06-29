## 1. 教程接线
- [x] 1.1 为 `fantasyrealms` 引擎接入 `createTutorialSystem()`，确认教程模式下命令拦截与事件推进可用。
- [x] 1.2 新增 `src/games/fantasyrealms/tutorial.ts`，提供单一基础教程 manifest。
- [x] 1.3 运行游戏 manifest 生成脚本，确认 `fantasyrealms` 自动获得 `loadTutorial` 懒加载入口。

## 2. 牌桌锚点与教程步骤
- [x] 2.1 在 `Board.tsx` 为基础教程补齐稳定锚点，至少覆盖牌库、中央公开弃牌区、手牌区与关键动作承接位。
- [x] 2.2 实现基础教程步骤，覆盖抓牌来源、弃牌义务、回合切换与终局说明。
- [x] 2.3 为教程步骤补齐对应 i18n 文案，保持与当前正式牌桌术语一致。

## 3. 验证
- [x] 3.1 补齐教程 manifest 结构测试与棋盘锚点存在性测试。
- [x] 3.2 运行与本次改动直接相关的 Vitest。
- [x] 3.3 记录教程能力的真实验证结果，明确哪些属于本轮完成，哪些留待后续子教程补充。

## 4. 前置规范
- [x] 4.1 创建 `add-fantasyrealms-basic-tutorial` proposal / tasks / spec deltas / design。
- [x] 4.2 运行 `openspec validate add-fantasyrealms-basic-tutorial --strict --no-interactive` 并通过。
- [x] 4.3 等待用户批准 proposal 后进入正式实现。
