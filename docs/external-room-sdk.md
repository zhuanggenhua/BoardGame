# 易桌游网页游戏房间 SDK

易桌游负责建房、玩家、座位、就绪和开局。网页游戏负责创建和同步对局。托管 ZIP 的入口 HTML 声明所用主版本。

```html
<meta name="boardgame-room-sdk" content="1">
```

从易桌游房间载入时，平台提供 `window.BoardGameRoomSDK` 和 `meta[name="boardgame-platform-origin"]`。游戏直接消费这个对象，无需把 SDK 文件打进 ZIP，也无需从 CDN 再下载脚本。

```js
const sdk = window.BoardGameRoomSDK;
if (sdk?.version === 1) {
    const client = sdk.createClient({
        platformOrigin: document.querySelector('meta[name="boardgame-platform-origin"]').content,
        onRoom: updateConnection,
        onSignal: receiveConnectionSignal,
        onStart: enterMatch,
        onClose: showConnectionClosed,
    });
    client.ready.then(updateConnection).catch(showConnectionError);
}
```

`updateConnection` 接收 `roomId`、本机 `seatId`、`hostSeatId` 和 `players`。每名玩家有 `seatId`、`displayName` 和 `ready`。首次收到房间由 `ready` Promise 通知，后续变化走 `onRoom`。游戏应使用房间 ID 作为同局标识，并用这些座位和昵称建立自己的对局。准备好以后调用 `client.setReady(true)`。收到 `onStart(room)` 后进入对局。如果游戏用 WebRTC，在双方之间使用 `client.sendSignal(toSeatId, kind, value)` 转发 `offer` 和 `answer`。外部服务器型游戏可用自己的联机传输。

《永恒之谷》的接法是房主按名单初始化本机游戏房间，按座位向访客发送 offer，访客返回 answer，两边连接后分别报告就绪。房主在易桌游开局，游戏端收到 `onStart` 后进入同一局。独立打开页面时，作者可以保留游戏原有入口。

已有《永恒之谷》接入包迁移时，在 `index.html` 加上版本声明，把 `js/platform-room.js` 中的本地 SDK 导入改成 `const createBoardGameRoomClient = window.BoardGameRoomSDK?.createClient;`。在初始化函数开头检查该方法是否存在。房间事件、座位和 WebRTC 回调沿用原有代码。`e2e/external-room-sdk.e2e.ts` 用作者提供的 ZIP 验证了原有和托管两种方式。

玩家下次加载新版易桌游网页后，从房间打开游戏就会拿到新版 v1 SDK。正在运行的页面会继续使用载入时的实现。托管 ZIP 中原先自带的 v1 SDK 仍可和平台通信。游戏改用上述托管入口一次后，后续 v1 修订由平台更新。协议有破坏性变更时，通过新的主版本显式迁移。
