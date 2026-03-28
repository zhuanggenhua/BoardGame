# Change: 收口 UGC 客户端运行时适配

## Why
`add-ugc-client-runtime-adapter` 的核心实现已经存在，但 change 文档仍按未落地方案描述，容易把真实能力和未实现设想混在一起。需要把口径收缩到当前已经上线的客户端加载、远端宿主板和 MatchRoom 接入链路，然后归档。

## What Changes
- 将 change 口径改为真实实现：客户端已能基于 manifest 解析 UGC 运行时配置，并解析 `rules/view` 入口地址。
- 明确 `UGC_ASSET_BASE_URL` 已作为客户端入口资源拼接基座，默认值为 `/assets`。
- 明确 `createUgcClientGame()` 与 `createUgcDraftGame()` 已提供 UGC 规则加载和运行时构建能力，供在线接入与 Builder 沙箱复用。
- 明确 `createUgcRemoteHostBoard()` 已通过 HostBridge 把运行时视图与在线对局状态/命令连接起来，并在缺省时回退到内置 runtime view。
- 明确 `MatchRoom` 已存在 UGC 在线分支：对 registry 中标记为 `isUgc` 的已发布包，异步加载 UGC 运行时并展示 loading / error / board 状态。
- 将测试口径改为现有真实覆盖：loader、client game、runtime bridge/sdk 基础测试，以及 preview/runtime consistency。

## Impact
- Affected specs:
  - `ugc-runtime`
- Affected code:
  - `src/config/server.ts`
  - `src/config/games.config.tsx`
  - `src/pages/MatchRoom.tsx`
  - `src/ugc/client/loader.ts`
  - `src/ugc/client/game.ts`
  - `src/ugc/client/board.tsx`
  - `src/ugc/runtime/UGCRuntimeView.tsx`
  - `src/ugc/runtime/UGCRuntimeHost.tsx`
  - `src/ugc/runtime/hostBridge.ts`
  - `src/ugc/runtime/viewSdk.ts`
  - `src/ugc/__tests__/clientLoader.test.ts`
  - `src/ugc/__tests__/runtime.test.ts`
  - `src/ugc/__tests__/previewRuntimeConsistency.test.ts`
