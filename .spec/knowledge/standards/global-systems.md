---
name: global-systems
description: 全局系统标准：跨游戏公共能力和入口边界——改全局能力时查
metadata:
  type: doc
  status: 已交付
---

# 全局系统与服务规范

## 目标

本文只规定跨游戏公共能力的入口边界。具体业务规则、单游戏适配和任务步骤不写在这里。

## Context 系统

所有全局能力通过 `src/contexts/` 暴露 API，业务组件不得直接操作底层全局变量。

| 系统 | 职责 | 关键边界 |
| --- | --- | --- |
| Toast | 展示短结果、警告和错误 | 用 dedupe 防重复；复杂原因放日志或详情 |
| Modal Stack | 管理业务弹窗栈 | 有确认权、选择权或阻塞推进的前台必须入栈 |
| Audio | 管理 BGM / SFX | 切换游戏时重置 BGM；后台、锁屏、页面隐藏时停止 |
| Tutorial | Manifest 驱动分步引导 | 引导动作不成为规则真相源 |
| Auth | 管理登录态和本地同步 | UI 只消费认证状态，不绕过服务端授权 |
| Debug | 运行时调试开关和视角模拟 | 不能进入生产默认路径或玩家合同 |

### Modal 边界

- 新阻塞前台默认围绕 modal stack 建单一 truth source。
- `useSyncedModalStackEntry` 只用于遗留前台桥接；使用前必须写清原 truth source、为什么不能直接迁入 modal stack、桥是否单向、等价更新如何 no-op。
- 纯展示、无确认权、不会阻塞业务推进的 spotlight / magnify / 特写可留在 overlay；一旦承担确认、选择、继续或关闭后推进，就必须回到 modal stack。
- 已入栈的阻塞前台，其真实可点击内容必须留在同一 entry DOM 子树内，禁止二次 portal 到其它根节点。

## 实时服务

- LobbySocket 服务大厅房间列表、房间成员状态和关键连接错误；组件销毁时必须取消订阅或交给 Context 统一维护。
- SocialSocket 登录态默认延迟热启动；打开通知、好友或聊天入口时显式唤醒。静态列表读取不得无条件首屏常驻建连。
- 游戏传输层边界见 [`engine-transport.md`](engine-transport.md)，不要把大厅 / 社交 socket 规则复制进游戏传输。

## 通用 UI

新游戏必须接入 `GameHUD` 或等价变体，至少承载退出房间、撤销、设置、多人在线状态和音效控制入口。HUD 可以按游戏视觉适配，但不能删除公共能力入口。

## 光标主题

- 新增游戏光标主题时，游戏层注册主题，manifest 声明默认主题，统一 registry 负责触发注册。
- manifest 声明的主题必须与注册主题 id 一致；多变体时，manifest 默认主题必须能被主页和游戏内默认逻辑找到。
- 共享视觉风格放在公共 cursor style 模板；游戏层引用，不复制 SVG 规则。
- 光标形态必须符合常识：default 是标准箭头，pointer 是手形，grabbing 是握拳，zoomIn 是放大镜加号，notAllowed 是禁止符。
- 光标设置中，临时选择、本游戏默认变体、全局覆盖范围和高对比偏好必须分别保存；不得把本地 pending 当成已持久化设置。

## 禁止项

- 禁止业务组件绕过 Context 自己维护全局可见状态。
- 禁止新游戏复制历史桥接层作为默认架构。
- 禁止把调试视角、教程模拟或 UI 展示状态写成规则授权。
- 禁止把全局系统文档写成单游戏接入 SOP。
