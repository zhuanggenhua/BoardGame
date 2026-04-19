## 1. Implementation
- [x] 1.1 在 `run-changed-quality-gate.mjs` 中新增 merge commit 审计流程（范围内逐个 merge commit 运行 `merge:audit:strict`）
- [x] 1.2 对“存在双方都改动文件”的 merge commit 强制要求 `evidence/merge-conflict-*.md` 在该提交中出现
- [x] 1.3 补充门禁输出与失败提示文案（指向冲突汇报要求）
- [ ] 1.4 记录最小验证：构造包含 merge commit 的范围，确认门禁能触发审计与证据校验
