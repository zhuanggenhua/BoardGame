# Dice Throne 前端旧资源反馈关闭证据（2026-09-11）

## 本轮口径

- 反馈 ID：`6aa15b1461ba00ac3b648159`
- 同组重复 ID：`6aa15b1361ba00ac3b648157`
- 处理口径：线上真实反馈
- 诊断包：`temp/feedback-closeout/2026-09-11T00-34-recheck-before-close/6aa15b1461ba00ac3b648159.md`
- 真实写回入口：无管理 token，使用生产 Mongo SSH 写入口
- 检查时间：北京时间 2026-09-11 00:34

## 反馈原文

```text
[auto][react.error_boundary] Can't find variable: MAX_CHAT_MESSAGES
```

## 当前现场

- 现实含义：玩家浏览器在 Dice Throne 房间 HUD 初始化时触发 React 错误边界，报错内容是聊天消息上限常量 `MAX_CHAT_MESSAGES` 在运行时未定义。
- 反馈堆栈里的旧资源是 `http://8.148.71.102/assets/GameHUD-BfFp73tq.js`。
- 当前生产入口 HTML 引用的是 `/assets/index-2HKUwlwe.js`、`/assets/vendor-runtime-Cpj98o6Y.js`、`/assets/vendor-react-Dy9NzIkc.js`、`/assets/vendor-i18n-lDyozFiN.js`。
- 当前直接请求旧资源 `http://8.148.71.102/assets/GameHUD-BfFp73tq.js` 返回 `404 Not Found`，说明该旧 chunk 已不再是现存线上入口。
- 当前源码 `src/components/game/framework/widgets/GameHUD.tsx` 已从共享聊天配置同时导入 `MAX_CHAT_LENGTH` 和 `MAX_CHAT_MESSAGES`。

## 验证

```text
node --input-type=module -e "<Playwright current production pageerror check>"
```

- 当前生产 Dice Throne 原反馈房间入口 `http://8.148.71.102/play/dicethrone/match/5LkMXZ8LMjw?playerID=0` 返回 200。
- Playwright 加载 10 秒未捕获 `pageerror`。
- 捕获到的浏览器错误中没有 `MAX_CHAT_MESSAGES`、`ReferenceError` 或同名报错。

## 结论

- 该反馈命中的是已经下线的旧前端资源。
- 本轮没有改聊天上限、聊天消息结构或 Dice Throne 规则逻辑。
- 按“当前线上入口已不再复现旧资源报错”关闭同组反馈；不把它表述为本轮新增代码修复。
