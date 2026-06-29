# client 自动反馈 `6a2bf962717d92971c9e3848` 收口证据

## 反馈对象

- 反馈 ID：`6a2bf962717d92971c9e3848`
- 来源：前端自动报错 `client-unhandled-rejection`
- 线上文案：`[auto][unhandledrejection] 好友请求不存在`
- 页面入口：经典主页 `/?homeStyle=classic`

## 真实现场

只读生产记录显示：

- 最后用户动作是点击好友请求里的“接受”按钮
- 当前页面有 modal 打开：`hasModalOpen=true`
- 报错栈来自前端主页 bundle：
  - `https://easyboardgame.top/assets/index-DLUPCSCX.js`

现实含义是：

- 用户点击的那条好友请求已经失效
- 前端当时把这次失败冒成了全局 `unhandledrejection`

## 当前树复核

当前前端真实按钮入口 [src/components/social/FriendList.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/components/social/FriendList.tsx:212) 已经把“接受 / 拒绝好友请求”的 Promise 拒绝显式接住，只记录局部控制台错误，不再向全局未处理拒绝冒泡。

对应定向回归：

```bash
pnpm vitest run src/components/social/__tests__/FriendList.test.tsx --configLoader native
```

结果：

- `2 passed`

关键断言：

- 接受已失效好友请求时，不会触发全局 `unhandledrejection`
- 拒绝已失效好友请求时，同样不会触发全局 `unhandledrejection`

## 生产侧补证据

以当前线上镜像创建时间 `2026-06-17T17:47:35.734Z` 为分界，继续统计同文案：

- `client-unhandled-rejection / [auto][unhandledrejection] 好友请求不存在`
- 部署后新增条数：`0`

## 结论

- 这条反馈对应的是“已失效好友请求在旧前端里被冒成全局未处理拒绝”。
- 当前树按钮入口已经改成局部 catch，定向回归通过。
- 当前线上镜像时间之后没有再出现同文案。

因此本条应按 **当前树已恢复 / 历史残留噪音** 收口，不再继续作为现存 bug 挂在未关闭队列。

## 收口口径

- 建议状态：`closed`
- 建议说明：`当前树已恢复；已失效好友请求在当前前端入口会被局部 catch，不再冒成全局 unhandledrejection，且当前线上镜像后没有新的同文案反馈。`
