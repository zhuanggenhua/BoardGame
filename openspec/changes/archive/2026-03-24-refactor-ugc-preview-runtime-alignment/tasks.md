# Tasks: refactor-ugc-preview-runtime-alignment

## 1. 需求持久化
- [x] 在 BuilderState 中新增 requirements 结构
- [x] 保存/导入/导出流程同步 requirements
- [x] UI 中提供需求输入与结构化显示（包含测试流程记录）

## 2. 预览与运行对齐
- [x] 抽象 RuntimeHost 组件（iframe/内联统一入口）
- [x] 预览切换为 RuntimeHost
- [x] 明确不兼容旧 RenderPreview（无过渡层）

## 3. 区域通用能力扩展
- [x] 区域组件新增 renderFaceMode 配置
- [x] hand-zone 支持 actions（按钮+钩子），含 current-player gating
- [x] play-zone 支持 allowActionHooks 开关（默认禁用）
- [x] 玩家数量推导注入上下文

## 4. 需求驱动数据生成
- [x] AI 数据生成支持引入 requirements 作为上下文
- [x] 提示词约束保持通用（不含游戏特化）

## 5. 测试与文档
- [x] 新增端到端测试：需求输入 → 生成配置 → 预览/运行
- [x] 更新 UGC Builder 文档与需求保存说明
