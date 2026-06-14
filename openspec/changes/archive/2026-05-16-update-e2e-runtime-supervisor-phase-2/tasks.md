## 1. Implementation
- [x] 1.1 抽出单 worker runtime 启动模块，统一前端/游戏/API 三服务启动逻辑
- [x] 1.2 修改 `e2e-runtime-manager`，让标准 supervisor 直接持有服务而非 `detached bootstrap`
- [x] 1.3 保留 `start-single-worker-servers.js` 兼容壳，但移除其作为标准路径 owner 的职责
- [x] 1.4 修改 `run-e2e-command` 退出路径，优先 graceful stop held manager
- [x] 1.5 更新端口隔离 E2E 测试，兼容 isolated runtime 端口
- [x] 1.6 完成验证：`--list` 不起 runtime、单文件实跑通过、registry 收空
