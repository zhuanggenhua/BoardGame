# Tasks: 收口 UGC 客户端运行时适配

## 1. 客户端 loader 与配置
- [x] 1.1 提供 `UGC_ASSET_BASE_URL` 配置，默认使用 `/assets`
- [x] 1.2 实现 manifest -> rules/view URL 的客户端解析
- [x] 1.3 支持从 manifest 读取 `commandTypes` 与玩家人数范围

## 2. UGC Client Game / Board 适配
- [x] 2.1 实现 `createUgcClientGame()` 与 `createUgcDraftGame()`
- [x] 2.2 实现 `createUgcRemoteHostBoard()`，通过 HostBridge 连接在线状态与 runtime view
- [x] 2.3 在缺省场景下回退到内置 runtime view 页面

## 3. MatchRoom 接入
- [x] 3.1 对 registry 中标记为 `isUgc` 的游戏走 UGC 在线分支
- [x] 3.2 提供 UGC loading / error / board 三态渲染
- [x] 3.3 保持草稿包继续走 Builder 预览/沙箱链路

## 4. 现有验证覆盖
- [x] 4.1 loader / client game 测试已覆盖 manifest 解析与运行时构建
- [x] 4.2 runtime bridge / sdk 测试已覆盖基础工厂与类型导出
- [x] 4.3 preview/runtime consistency 测试已覆盖 builder preview config 附着链路
