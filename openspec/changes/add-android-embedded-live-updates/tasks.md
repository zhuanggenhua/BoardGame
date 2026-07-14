## 1. Spec & Architecture

- [ ] 1.1 明确 Android OTA 只覆盖 H5 bundle，不覆盖原生二进制
- [ ] 1.2 确定 OTA provider / 发布源方案，并确定客户端 bundle manifest 结构
- [ ] 1.3 定义 bundle 兼容性、签名/hash 校验和回滚策略

## 2. Client Runtime

- [ ] 2.1 实现 Android 本地 bundle registry 与激活状态机
- [x] 2.2 实现启动时更新检查、下载、校验、待激活标记
- [ ] 2.3 实现 bundle 启动健康检查与失败自动回滚
- [ ] 2.4 提供调试页或日志，用于查看当前 binary version / active bundle / pending bundle
- [x] 2.5 为强制 OTA 提供阻塞式更新页、下载进度和立即切换能力

## 3. Publish Pipeline

- [x] 3.1 增加 Android OTA bundle 构建产物与 manifest 生成
- [x] 3.2 增加 bundle 上传、发布、回滚脚本
- [x] 3.3 增加渠道/灰度/紧急停用开关
- [x] 3.4 增加 GitHub Actions 自动发布链路：`push main` 直接发布 stable OTA + native，并在成功后自动 bump 下一 patch 版本
- [x] 3.5 所有发布入口固定写入 `forceUpdate: true`，并拒绝关闭参数
- [x] 3.6 OTA 打包器排除嵌套游戏资源，只保留 Web 本体和资源清单

## 4. Product Rules & Cleanup

- [x] 4.1 把 `embedded + OTA` 写入 Android 主线发布文档
- [x] 4.2 把 `remote WebView` 明确降级为兼容/调试模式
- [x] 4.3 盘点现有“发 APK 才能更新前端”的流程文档并修正
- [x] 4.4 记录“所有 OTA 强制更新与轻量包”项目用户故事和部署规范

## 5. Verification

- [ ] 5.1 验证首次安装走 APK 内置 bundle
- [ ] 5.2 验证 OTA bundle 下载后成功激活
- [ ] 5.3 验证不兼容 bundle 被拒绝激活
- [ ] 5.4 验证启动失败自动回滚
- [ ] 5.5 验证游戏对局中不会被强制热切换打断
- [x] 5.6 验证自动启动检查会立即应用强制 OTA，且 ZIP 不包含嵌套游戏资源
