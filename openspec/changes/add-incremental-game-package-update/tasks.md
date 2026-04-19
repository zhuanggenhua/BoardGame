## 1. 构建侧：文件级索引生成
- [ ] 1.1 新增 `scripts/assets/generate-file-index.mjs`：遍历 asset pack 目录，计算每个文件 sha256，输出 `file-index.json`
- [ ] 1.2 将 file-index.json 生成集成到现有 asset pack 构建发布流程
- [ ] 1.3 确认 CDN 部署结构支持按文件路径访问 asset pack 内容（或调整部署方式）

## 2. 发布清单扩展
- [ ] 2.1 `ResolvedGamePackageManifest` 新增 `fileIndexUrl` / `fileIndexChecksum` 字段
- [ ] 2.2 发布清单生成/读取逻辑适配新字段
- [ ] 2.3 向后兼容：`fileIndexUrl` 缺失时走全量安装

## 3. 原生插件：增量安装能力
- [ ] 3.1 `GamePackage` 原生插件新增 `installGamePackageIncremental` 方法
- [ ] 3.2 原生层实现已安装文件索引管理（读取/写入/更新 `installed-files-index.json`）
- [ ] 3.3 原生层实现增量合并：逐文件下载 → 合并到临时目录 → 校验 → 原子切换
- [ ] 3.4 原生层实现增量失败自动回退全量安装
- [ ] 3.5 全量安装完成后自动生成已安装文件索引

## 4. JS 层：增量/全量决策逻辑
- [ ] 4.1 `packageManagerService` 新增增量安装决策：判断是否有 fileIndexUrl + 本地已有安装
- [ ] 4.2 `nativeGamePackagePlugin.ts` 新增 JS 侧增量安装调用接口
- [ ] 4.3 增量安装状态回调与进度汇报（变更文件数 / 总变更大小）

## 5. 测试与验证
- [ ] 5.1 单元测试：file-index 生成脚本的正确性与稳定性
- [ ] 5.2 单元测试：增量/全量决策逻辑（有索引/无索引/索引损坏/跨版本跳转）
- [ ] 5.3 集成测试：单个游戏端到端增量安装验证（tictactoe 或最小资源游戏）
- [ ] 5.4 回归测试：全量安装路径不受影响
- [ ] 5.5 边界测试：增量失败回退全量、网络中断恢复、索引损坏恢复
