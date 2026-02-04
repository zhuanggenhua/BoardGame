# Change: UGC 运行时入口与音频资产管线落地

## Why
- 目前 UGC 仅有 Builder 与运行时 SDK/桥接模块，没有与大厅/房间联动的联机入口，用户发布后无法通过现有联机流程进入对局与教程。
- UGC 资产上传/压缩/存储只有类型与占位实现，缺少与 R2 资产管线的实际接入，且需要明确“不保留原始文件”的空间策略。
- 主页与分类缺少 UGC 游戏展示入口，无法形成“上传 → 浏览 → 游玩”的闭环。

## What Changes
- UGC 联机/教程入口复用现有大厅/房间与教程路由，服务端按已发布 packageId 动态注册 boardgame.io 游戏。
- 规则/教程入口来自 UGC 包内文件（如 domain.js 与教程脚本），并可由 UGC 配置自动生成 manifest。
- 新增 UGC 包服务：发布、拉取、列表（仅已发布），本地预览仍允许使用本地数据。
- 落地 UGC 资源上传/压缩/存储流程，接入 add-r2-asset-pipeline 规范，**不保留原始文件**。
- 在主页“全部分类”中合并展示 UGC 包入口，保持现有分类结构。

## Impact
- Affected specs:
  - ugc-runtime
  - ugc-asset-processing
  - ugc-catalog
  - game-registry
  - tutorial-engine
- Related specs/changes:
  - add-r2-asset-pipeline（资产路由与对象存储前缀约定）
  - add-ugc-prototype-builder（运行时隔离与资产压缩方向）
- Affected code:
  - server.ts（动态注册与大厅/房间联机入口）
  - src/ugc/runtime
  - src/ugc/server
  - apps/api（UGC 包/资产接口）
  - src/pages / src/components（主页与分类入口）
  - src/ugc/builder（上传对接与 manifest 生成）
