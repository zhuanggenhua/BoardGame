# SmashUp 泰坦 Hover 验证

## 范围
- 目标：修正 `smashup` 基地区域里泰坦卡的 hover 放大效果。
- 关注点：
  - 泰坦 hover 不应再像之前那样放大过头。
  - 泰坦 hover 不应在视觉上把基地下方的计分条一起“带着变大”。
  - 行为应尽量贴近现有随从卡的 hover 方案。

## 代码结论
- 已将泰坦卡 hover 从根节点的 `hover:scale-125 hover:-translate-y-[0.3vw]` 改成更接近随从卡的轻量方案：
  - 使用 `origin-bottom`，让放大尽量朝上展开，减少压向基地与计分条。
  - 使用 `hover:scale-110 hover:-translate-y-[0.12vw]`，缩小放大量级。
  - 外层只负责 `z-index` 抬升，不再把整组 hover 行为写成过重的根节点放大。

## 已执行验证
- 单测尝试：
  - 命令：`npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts`
  - 结果：未能完成本文件测试执行。
  - 阻塞：仓库现有问题 [`frankenstein.ts`](D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/frankenstein.ts):121 引用了未定义的 `frankensteinLabAssistantProgram`，导致该测试套件在初始化能力注册时直接失败。
- E2E 尝试：
  - 命令：`npm run test:e2e:ci:file -- e2e/smashup/smashup-state-injection-test.e2e.ts "泰坦 hover 只应轻微放大卡面，不应把基地计分条一起放大"`
  - 结果：未进入用例执行。
  - 阻塞：Playwright 独立 runtime 的游戏服务启动阶段提前退出，主报错记录在 `.tmp/playwright-runtime-isolated-single-pw-1777866560001-m0oib7.log`；当前没有产出可用于本轮收口的有效截图。

## 当前验收状态
- 代码修改：已完成。
- 自动化验证：未完成，存在环境级阻塞，不能宣称已通过 E2E 视觉验收。
- 截图证据：无。本轮没有可作为最终验收依据的有效截图。
