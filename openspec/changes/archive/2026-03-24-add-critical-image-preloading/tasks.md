## 1. 实现
- [x] 1.1 扩展 `GameManifestEntry`，新增 `criticalImages` / `warmImages` 字段并更新生成流程
- [x] 1.2 新增关键图片解析器注册表与类型，支持基于对局状态动态解析
- [x] 1.3 AssetLoader 增加 `preloadCriticalImages` / `preloadWarmImages` API，支持失败容忍与后台预取
- [x] 1.4 实现 SmashUp 动态解析器并补充清单
- [x] 1.5 接入 MatchRoom / LocalMatchRoom 门禁，仅对内置游戏启用，并触发 warm 预加载
- [x] 1.6 补充 AssetLoader 单测与门禁相关测试

## 2. 验证
- [x] 2.1 运行相关 Vitest 用例
- [x] 2.2 手动验证进入对局无首屏白屏/闪烁
