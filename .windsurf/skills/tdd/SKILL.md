---
name: tdd
description: "BoardGame 的 TDD overlay。先使用全局 tdd，再叠加本项目测试入口、Prompt facade、E2E 截图证据和最窄验证口径。这里不重复维护通用 TDD 理论正文。"
---

# BoardGame TDD Overlay

## 作用

这不是全局 `tdd` 的副本，而是 **BoardGame 对全局 TDD 的项目补充**。

使用顺序：

1. 先用全局 `tdd`
2. 再按本文件收紧到 BoardGame 规则

## 先读

- `docs/testing-best-practices.md`
- `docs/automated-testing.md`
- 根 `AGENTS.md` 里的验证分层口径

## 本项目补充规则

- 游戏规则测试优先走 `GameTestRunner`、游戏级 `runCommand` 或完整 command/pipeline helper
- 交互测试优先走游戏自己的 prompt helper / facade，不要在测试里到处直接断言 `sys.interaction.current`、`queue`、`data.options`
- Smash Up prompt 测试优先复用：
  - `getSimpleChoicePrompt`
  - `getPromptOption`
  - `respondToPrompt`
  - `respondToPromptOptions`
  - `expectNoPrompt`
  - `getReactionPrompt`
  - `getReactionPromptOptionBySourceDefId`
- 如果一次重构会让很多测试一起碎，但行为没变，先判断是不是测试接口耦合过深，而不是立刻批量改 expected
- UI 交互修复不能拿单测冒充完成；必须遵守本项目 Playwright E2E + 截图证据规则
- 默认只 mock 系统边界：网络、时间、随机数、存储、浏览器 API、外部服务；不要 mock BoardGame 自己的模块来证明内部调用发生过

## 不该放在这里的内容

- 通用 red-green-refactor 理论正文
- 通用 mocking 教程全文
- 与本仓库无关的测试框架百科

这些内容应回到全局 `tdd` 查看，不在项目目录重复维护。
