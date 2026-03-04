# 临时文件管理规范

## 目录结构

项目中的临时文件应按以下规则组织：

### 1. Bug 分析文档 → `docs/bugs/`
- Bug 分析报告（`BUG-*.md`）
- Debug 记录（`DEBUG-*.md`）
- 修复总结（`fix-*.md`）
- 测试问题记录（`test-*-bug.md`）

### 2. 代码审查报告 → `docs/reviews/`
- 代码审查报告（`CODE_REVIEW_*.md`）
- 重构总结（`refactor-*.md`、`SUMMARY-*.md`）
- 测试修复总结（`*-test-fix-*.md`）
- 审计失败分析（`*-audit-failure-*.md`）

### 3. 证据文档 → `evidence/`
- SmashUp 相关审计（`SMASHUP-*.md`）
- Wiki 对比报告（`WIKI-*.md`）
- PR 修复记录（`pr5-*.md`、`pr5-*.txt`）
- 功能开发记录（`*-feature.md`）

### 4. 临时脚本 → `scripts/temp/`
- 一次性测试脚本（`test-*.mjs`）
- 数据检查脚本（`check-*.mjs`）
- 临时提取脚本（`_*.cjs`、`_*.mjs`）

### 5. 测试结果 → `test-results/`
- 测试失败日志（`*-failures.txt`）
- 测试输出（`*-output.txt`）
- Vitest 日志（`_vitest_*.log`）

### 6. 临时数据 → `temp/`
- Wiki 数据（`wiki-*.json`、`wiki-*.txt`、`wiki-*.html`）
- 测试报告（`*-report.json`、`*-results.json`）
- 差异文件（`*-diff.txt`）
- HTML 测试页面（`test-*.html`）

### 7. 应删除的文件
- Git 临时文件（`temp_*.txt`、`tmp_*.txt`）
- 临时状态文件（`threshold`、`edge_check.txt`、`scan_results.txt`）
- 临时计划文档（`findings.md`、`progress.md`、`task_plan.md`）

## .gitignore 规则

已在 `.gitignore` 中添加以下规则，防止临时文件被提交：

```gitignore
# 临时分析文档
BUG-*.md
DEBUG-*.md
fix-*.md
test-*.md
*-summary.md
*-analysis.md
*-report.md
*-status.md

# 临时脚本
_*.cjs
_*.mjs
check-*.mjs
test-*.mjs

# 临时数据文件
wiki-*.json
wiki-*.txt
wiki-*.html
*-report.json
*-results.json
*-diff.txt
temp_*.txt
tmp_*.txt

# 临时日志文件
_vitest_*.log
*-failures.txt
*-output.txt
```

## 开发规范

### 创建临时文件时
1. **Bug 分析**：直接在 `docs/bugs/` 创建，命名格式 `BUG-<issue-name>.md`
2. **代码审查**：直接在 `docs/reviews/` 创建，命名格式 `review-<date>-<topic>.md`
3. **临时脚本**：直接在 `scripts/temp/` 创建，命名格式 `test-<purpose>.mjs`
4. **临时数据**：直接在 `temp/` 创建，任意命名

### 清理临时文件
- **定期清理**：每个 Sprint 结束时清理 `temp/` 和 `test-results/`
- **归档重要文档**：将有价值的分析文档移到 `evidence/` 或对应的 `docs/` 子目录
- **删除过期文件**：超过 30 天的临时文件应删除或归档

### 提交前检查
运行以下命令检查是否有临时文件未被忽略：
```bash
git status | grep -E "(BUG-|DEBUG-|fix-|test-|wiki-|temp_|tmp_|_vitest)"
```

如果有输出，说明有临时文件需要处理。

## 已完成的清理（2026-03-02）

- ✅ 移动 16 个 Bug 分析文档到 `docs/bugs/`
- ✅ 移动 12 个代码审查报告到 `docs/reviews/`
- ✅ 移动 25 个 SmashUp/PR5 文档到 `evidence/`
- ✅ 移动 8 个临时脚本到 `scripts/temp/`
- ✅ 移动 12 个测试结果文件到 `test-results/`
- ✅ 移动 17 个 Wiki/数据文件到 `temp/`
- ✅ 删除 13 个 Git 临时文件和其他临时文件
- ✅ 更新 `.gitignore` 添加临时文件忽略规则
