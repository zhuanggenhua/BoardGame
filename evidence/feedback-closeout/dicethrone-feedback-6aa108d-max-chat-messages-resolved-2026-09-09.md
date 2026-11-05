# Dice Throne 线上自动反馈修复证据（2026-09-09）

## 本轮口径

- 反馈 ID：`6aa108d761ba00ac3b647da7`
- 处理口径：线上真实反馈
- 诊断包：`temp/feedback-closeout/2026-09-09T-final-recheck-6aa0f39d/6aa108d761ba00ac3b647da7.md`
- 真实写回入口：无管理 token，使用生产 Mongo SSH 写入口

## 反馈原文

```text
[auto][react.error_boundary] MAX_CHAT_MESSAGES is not defined
```

## 当前现场

- 线上错误边界报告 `ReferenceError: MAX_CHAT_MESSAGES is not defined`。
- 发生入口是 Dice Throne 联机房间：`/play/dicethrone/match/HEzhvSLPnJV?playerID=0`。
- 诊断包状态仍在 `setup` 阶段，角色尚未选择；这是房间 HUD 初始化阶段的前端崩溃，不是某张卡牌或规则结算问题。

## 对照结论

- `GameHUD.tsx` 中聊天消息裁剪逻辑使用了 `MAX_CHAT_MESSAGES`，但文件只导入了 `MAX_CHAT_LENGTH`。
- 共享聊天配置 `src/shared/chat.ts` 已定义 `MAX_CHAT_MESSAGES = 200`。
- 根本机制是前端组件引用未导入的常量，打包后运行到聊天状态初始化 / 裁剪逻辑时触发 `ReferenceError`，导致房间页面进入错误边界。

## 修复范围

- `src/components/game/framework/widgets/GameHUD.tsx` 从共享聊天配置同时导入 `MAX_CHAT_LENGTH` 和 `MAX_CHAT_MESSAGES`。
- 未改聊天上限数值、消息结构、房间状态或 Dice Throne 规则逻辑。

## 验证

```text
npx vitest run src/components/game/framework/widgets/__tests__/GameHUD.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
结果：1 passed，9 passed

npm run typecheck
结果：通过
```

## 状态回写

- 北京时间 2026-09-09 19:07 左右，通过生产 Mongo SSH 写回 `resolved`，`matchedCount=1`，`modifiedCount=1`。
- 线上回读字段显示 `status=resolved`、`closedReason=null`，`resolvedMethod` 已写入面向提交者的说明。
- 本地状态镜像显示 `status=resolved`、`lastFetchedStatus=resolved`。

## 漏审复盘 / 规范回代判断

- 这是前端运行时引用缺失，不是规则录入、卡图或 Dice Throne 规则 bug。
- 现有前端组件测试能覆盖 `GameHUD` 渲染，补回导入后该测试通过；本轮不需要新增项目规范。
