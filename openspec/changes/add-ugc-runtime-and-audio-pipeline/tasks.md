## 1. 联机入口与包加载
- [ ] 1.1 设计并实现 UGC 包文件存储结构（视图/规则/教程入口、版本、manifest 引用）
- [ ] 1.2 实现 UGC 包 API（列表、详情、发布、拉取 manifest/包入口）
- [x] 1.3 服务端启动/刷新时动态注册已发布 UGC 包（packageId 作为 gameId）
- [x] 1.4 通用 UGC Game Wrapper：沙箱执行 domain.js 并映射 setup/validate/execute/reduce/playerView/isGameOver
- [ ] 1.5 前端通用 UGC Board/Client：iframe 挂载视图包并接入 UGCHostBridge/UGCViewSdk
- [ ] 1.6 教程入口：从包内脚本/manifest 读取并接入现有 /tutorial 流程
- [ ] 1.7 运行时接入音频播放（SFX/BGM）与资源路径归一化

## 2. 资产上传与压缩管线
- [ ] 2.1 实现 UGC 资产上传 API（图片/音频）与权限校验
- [ ] 2.2 接入压缩流程（图像/音频），仅保留压缩后变体
- [ ] 2.3 产出 UGC 资产记录与 manifest 变体（ugc/<userId>/<packageId>/...）
- [ ] 2.4 Builder 上传对接（上传 → 返回 assetKey / manifest 更新）

## 3. 主页与分类入口
- [ ] 3.1 “全部分类”中合并 UGC 包展示与跳转

## 4. 测试与文档
- [ ] 4.1 新增 API 与压缩流程测试（含跳过已压缩格式）
- [ ] 4.2 新增运行时入口与桥接通信测试
- [ ] 4.3 更新 UGC 相关文档与使用说明
- [x] 4.4 新增 UGC 动态注册集成测试
