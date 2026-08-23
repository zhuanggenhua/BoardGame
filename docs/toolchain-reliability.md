# 工具链可靠性事实

本文记录本项目关键后端开发入口的当前做法。新增或修改启动链路时，执行规范回到 [`documentation-style`](../.spec/knowledge/standards/documentation-style.md) 和相关源码，不在本文扩写第二套流程。

## 当前结论

核心后端开发入口默认使用“预先 bundle + 运行产物 + watch 重建”，不把 `tsx` 运行时冷编译放在每次启动关键路径。

| 场景 | 当前入口 |
| --- | --- |
| API 开发 | `npm run dev:api` |
| game-server 开发 | `npm run dev:game` |
| 全本地开发 | `npm run dev` |
| nodemon 调试 | `npm run dev:game:nodemon`，仅备用 |
| E2E 服务启动 | `scripts/infra/start-single-worker-servers.js`、`scripts/infra/start-worker-servers.js` |
| 启动冒烟 | `npm run smoke:startup` |

`dev:api`、`dev:game` 和 E2E 服务启动都复用 `scripts/infra/dev-bundle-runner.mjs`。

## 版本基线

- Node 开发基线：`24.1.0`。
- 同步维护：`.nvmrc`、`.node-version`、`package.json > engines.node`。
- bundle 产物写入 `temp/dev-bundles/**`，不进入源码目录。

## 变更检查

修改关键启动链路前先确认：

- 是否又把核心入口改回 `tsx` 冷启动。
- 是否只依赖项目本地依赖，而不是全局安装。
- watch 重建失败时是否保留上一版可运行进程。
- 端口 ready 是否基于真实探测，而不是只看日志。
- 是否保留独立端口 smoke，避免误伤正在运行的本地进程。

## 相关入口

- `scripts/infra/dev-bundle-runner.mjs`
- `scripts/infra/dev-orchestrator.js`
- `scripts/infra/startup-smoke-test.mjs`
- `package.json`
- [`deploy`](deploy.md)
- [`temp-files-management`](temp-files-management.md)
