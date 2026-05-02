## 1. Analysis
- [ ] 1.1 盘点当前 Smash Up 中 `special` 的所有运行时消费点（命令、UI、AI、响应窗口、审计）
- [ ] 1.2 按入口语义为现有卡牌分型：场上 manual、非场上 manual、响应窗口打出、trigger 驱动、contextual provider、脏数据

## 2. Entry Model
- [ ] 2.1 在 Smash Up 卡牌定义层新增显式入口模型类型与字段
- [ ] 2.2 新增 helper，统一解析 manual activation / response-window play / reactive traits
- [ ] 2.3 为 titan / minion / action / fusion 对齐新 helper 的消费接口

## 3. Runtime Migration
- [ ] 3.1 迁移 `commands.ts` 的 `ACTIVATE_SPECIAL` / `USE_TALENT` 判定到新入口模型
- [ ] 3.2 迁移 `Board.tsx` / `BaseZone.tsx` 高亮逻辑，移除对 `abilityTags.special` 的直接依赖
- [ ] 3.3 迁移 `game.ts` / `utils.ts` / 响应窗口相关 UI 到新 response-window 模型
- [ ] 3.4 迁移 `ai.ts` / `aiProfiles.ts` 的 reactive 评估

## 4. Data Migration
- [ ] 4.1 修正所有 trigger 驱动 `Special:` 文案卡，确保不再被声明为场上 manual special
- [ ] 4.2 修正所有响应窗口从手牌打出的卡，改用显式 response-window 入口
- [ ] 4.3 修正所有 discard / setaside / contextual provider 入口卡，改用显式 manual/provider 语义
- [ ] 4.4 清理本轮已知脏数据与兼容注释

## 5. Verification
- [ ] 5.1 在现有测试文件中补分类回归：manual board / discard / response-window / trigger-driven
- [ ] 5.2 运行 Smash Up 相关 Vitest 聚焦套件
- [ ] 5.3 补关键浏览器级 E2E，验证“该亮的亮、不该亮的不亮、真实入口仍可用”
- [ ] 5.4 更新 evidence / 审计文档，明确旧 special 口径何时失效
