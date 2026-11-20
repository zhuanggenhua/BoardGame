# 易桌游网页游戏房间 SDK

[开发者接入与版本更新指南](../public/developers/external-room-sdk.md) 通过网站上传页的「SDK 接入文档」公开提供。

## 平台维护与发布

1. 在 [托管 SDK 源码](../src/components/external/roomSdkV1.js) 中更新实现和 `release`。同一协议主版本保留已有接口和行为。新增能力采用可选接口，开发者可以逐步接入。
2. 在 [开发者指南的版本记录](../public/developers/external-room-sdk.md#版本记录) 首行增加对应的发布版本，写明变化、使用条件和开发者是否需要修改游戏。新能力的接入说明与实现放在同一次变更中。
3. 运行 SDK 版本一致性测试以及受影响的房间浏览器测试。SDK 与公开文档随同一份易桌游 Web 构建发布。发布后从上传页打开指南，并在新打开的托管房间里核对 `window.BoardGameRoomSDK.release`。

SDK 由 [外部网页游戏容器](../src/components/external/SandboxedWebGameFrame.tsx) 在房间打开时加载。开发者入口固定为 `/developers/external-room-sdk`，[阅读页](../src/pages/ExternalRoomSdkGuidePage.tsx) 直接渲染这份指南的 Markdown 源文件。
