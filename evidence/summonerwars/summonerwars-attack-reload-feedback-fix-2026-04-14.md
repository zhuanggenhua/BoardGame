# Summoner Wars attack-reload 反馈修复证据（2026-04-14）

## 反馈信息
- feedbackId: 69db182809efdb7249bd536d
- conflictKey: summonerwars::attack-reload
- 现象: 反复攻击后出现“游戏加载失败”，页面被 BoardErrorBoundary 拦截。

## 根因与修复摘要
- 根因倾向：ActionLog 渲染链路对 diceResult 片段数据缺少防御性处理，异常数据会触发渲染崩溃。
- 修复：
  1) ActionLogSegments 的 DiceResultSegment 增加 guard，缺失/异常骰子数据时不渲染；spriteCols/spriteRows 非法时回退为 1。
  2) ctionLogFormat 对 diceResult 做文本 fallback（无 dice 返回空，value 缺失使用 index+1）。
  3) 补充单测覆盖 diceResult 缺失与正常数据。

## 变更文件
- src/components/game/framework/widgets/ActionLogSegments.tsx
- src/components/game/utils/actionLogFormat.ts
- src/components/__tests__/actionLogFormat.test.ts

## 验证记录
- 
px eslint src/components/game/framework/widgets/ActionLogSegments.tsx src/components/game/utils/actionLogFormat.ts src/components/__tests__/actionLogFormat.test.ts
- 
px vitest run src/components/__tests__/actionLogFormat.test.ts

## 结论
- 本地静态检查与单测通过；本修复不涉及 UI 布局改动与 E2E 交互验证。
