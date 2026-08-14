# 冲突解决汇报：feat/dicethrone-gunslinger-samurai 文档收口

> 2026-06-05 当前有效口径：本文是历史 merge/cherry-pick 冲突处理记录，只说明当时如何合并文档变更，不构成当前枪手/武士审计完成证明。当前若要判断对象级残余或整批发布口径，应以现行单英雄主审计与新英雄总汇总文档为准。

## 1. 背景
- base: `main`
- head: `feat/dicethrone-gunslinger-samurai`
- 触发命令: `git cherry-pick 2f34142a`

## 2. 冲突文件
- `.spec/knowledge/standards/asset-pipeline.md`

## 3. 解决策略
### `.spec/knowledge/standards/asset-pipeline.md`
- 策略：合并双方内容，不丢任一侧规则。
- 合并要点：
  - 保留主线已有的 `R2 / CDN 上传收口规则`。
  - 合入该脏改新增的 `R2 / CDN 资源排查规则`。
  - 最终合并为统一章节 `R2 / CDN 上传与排查规则（强制）`。
- 原因：两侧规则关注点不同，主线强调交付闭环，本地脏改强调排障流程，合并后信息更完整。

## 4. 风险与验证
- 风险点：仅文档改动，无运行时行为变更。
- 验证命令：
  - 未执行自动化；无需代码级测试。
- 结论：已无损吸收该 worktree 中最后一个未提交文档改动。
