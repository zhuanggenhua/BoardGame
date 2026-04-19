## ADDED Requirements
### Requirement: Merge commit 审计门禁
系统 SHALL 在质量门禁中检测 push 范围内的 merge commit，并对每个 merge commit 执行 `merge:audit:strict`。若检测到任一文件结果完全等于某一父提交，门禁 MUST 失败。

#### Scenario: merge commit 单边覆盖
- **WHEN** merge commit 产物中存在文件与父1或父2完全一致
- **THEN** 质量门禁失败并提示需要人工解释或重新合并

### Requirement: 冲突汇报证据强制
系统 SHALL 对存在“双方都改动同一文件”的 merge commit，要求该 merge commit 包含至少一个 `evidence/merge-conflict-*.md` 文件。

#### Scenario: 有冲突但未提交冲突汇报
- **WHEN** merge commit 存在双方都改动同一文件
- **AND** 该 merge commit 未包含 `evidence/merge-conflict-*.md`
- **THEN** 质量门禁失败并提示补充冲突汇报

#### Scenario: 无潜在冲突
- **WHEN** merge commit 没有双方都改动同一文件
- **THEN** 质量门禁不强制要求冲突汇报文件
