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
- 根目录临时写入/探针脚本（`temp-*.mjs`）
- Python 临时探针脚本（`scripts/temp_*.py`）

### 5. 测试结果 → `test-results/`
- 测试失败日志（`*-failures.txt`）
- 测试输出（`*-output.txt`）
- Vitest 日志（`_vitest_*.log`）
- 对外要引用的最终截图 / 最终录屏产物：每个任务每类只保留一个稳定文件名，不保留 `v1/v2/v3...` 迭代链

### 6. 临时数据 → `temp/`
- Wiki 数据（`wiki-*.json`、`wiki-*.txt`、`wiki-*.html`）
- 测试报告（`*-report.json`、`*-results.json`）
- 差异文件（`*-diff.txt`）
- HTML 测试页面（`test-*.html`）
- HTTP 下载、页面探针、接口直连保存、curl/Invoke-WebRequest 输出等一次性文件必须直接写入 `temp/`，例如 `temp/http-probes/<purpose>.html` 或 `temp/http-probes/<purpose>.bin`；禁止写成仓库根目录的 `temp-*.bin`、`temp-*.html`、`direct-http.*`
- AI 读图、OCR、截图裁切、图集切片等中间图片必须放在 `temp/` 或 `tmp/` 子目录下，例如 `temp/safe-image-reading/<batch>/`
- 禁止在仓库根目录创建 `.tmp_*`、`tmp_*`、`safe_image_*` 这类临时图片目录；如果工具产生了这类目录，提交前必须移动到 `temp/` 或 `tmp/`
- 数据录入中间产物：
  - OCR 中间图、裁图合同图、标注图
  - 临时拆分 sheet、临时 hand preview、临时 atlas
  - 仅用于核对的 slot 单图、拼图、人工审查导出

### 7. 应删除的文件
- Git 临时文件（`temp_*.txt`、`tmp_*.txt`、`tmp-*.txt`）
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
temp-*.mjs
scripts/temp_*.py

# 临时数据文件
wiki-*.json
wiki-*.txt
wiki-*.html
*-report.json
*-results.json
*-diff.txt
temp-*.bin
temp-*.html
temp_*.txt
tmp-*.txt
tmp_*.txt
.tmp_*/
tmp_*/

# 临时日志文件
_vitest_*.log
*-failures.txt
*-output.txt
test-out.txt
```

## 开发规范

### 数据录入 / 资源录入专用规则

1. 录入中间产物默认放 `temp/`、`test-results/` 或已忽略目录，不放 `public/assets/` 正式资源树
2. 中间产物目录命名要明确体现“临时/核对”用途，不能伪装成正式运行时素材目录
3. 只要某张图是为了录入、核对、OCR、看清局部版式、人工复查而生成，就一律视为中间产物，必须放 `temp/`
   - 这条不要求先做过“后处理”；即使只是从正式图集切了一个 `slot-24.webp`、`deadeye-2.webp`、整卡单图，也仍然属于录入中间产物
   - 典型例子：单格裁片、整卡裁片、上下拆分图、放大图、锐化图、拼接图、normalized hand preview、临时 atlas、人工标注图
   - 这些文件不能放进 `public/assets/**`、`public/assets/.../crops/**`，也不能进入 manifest 或服务器资源主源发布链
4. 如果最终运行时需要新的派生图，必须另外生成正式资源：
   - 正式图片放 `public/assets/i18n/<locale>/<gameId>/<分类>/compressed/`
   - atlas 配置放 `public/assets/atlas-configs/<gameId>/`
5. 生成正式资源过程中产生的裁图、拼图、临时 atlas，不得顺手提交到正式资源目录
6. `public/assets/.../crops/**` 不能再作为“录入核对图”或“后处理核对图”的默认落点；该目录若历史遗留存在，只能视为待清理技术债，不自动升级成正式合同
7. 交付前必须说明哪些文件是正式资源，哪些只是录入中间产物；不能把“以后也许有用”的临时文件留在资源树里

### UI / E2E 截图清理规则

1. 迭代中的截图、局部裁图、debug 图、版本链截图默认放 `temp/`，不是长期 `test-results/` 资产
2. `test-results/` 只允许保留当前仍被证据文档引用的最终交付物
3. 同一任务同一视角默认只保留一个稳定文件名，例如 `*-desktop-current.png`；禁止长期保留 `*-v1.png` 到 `*-v33.png`
4. 如果为定位问题临时导出了局部图，收口前必须删除或移回 `temp/`；只有用户明确要求保留多张对照图时才可例外
5. 证据文档默认描述“当前结论”和“当前唯一证据”，而不是堆完整失败版本史；失败版本只有在用户明确要求保留审计链时才写入文档
6. 关闭本轮任务前，必须主动核对 `test-results/` 与 `temp/` 中是否残留本轮迭代垃圾；不能把清理责任留给用户

### 创建临时文件时
1. **Bug 分析**：直接在 `docs/bugs/` 创建，命名格式 `BUG-<issue-name>.md`
2. **代码审查**：直接在 `docs/reviews/` 创建，命名格式 `review-<date>-<topic>.md`
3. **临时脚本**：直接在 `scripts/temp/` 创建，命名格式 `test-<purpose>.mjs`
4. **临时数据 / 诊断日志**：直接在 `temp/` 创建，任意命名；真机日志、下载日志、排障日志不得写在仓库根目录
5. **临时图片 / 裁图 / OCR 中间产物**：直接在 `temp/<purpose>/` 或 `tmp/<purpose>/` 下创建；不得在仓库根目录创建 `.tmp_*`、`tmp_*` 目录
6. **临时下载 / HTTP 探针输出**：`curl`、`Invoke-WebRequest`、浏览器保存、接口直连保存等命令必须显式指定 `temp/` 下路径；如果命令默认会落到当前目录，先建 `temp/http-probes/` 再运行，不得事后留下根目录 `temp-*` 文件给提交审查兜底。

### 清理临时文件
- **定期清理**：每个 Sprint 结束时清理 `temp/` 和 `test-results/`
- **归档重要文档**：将有价值的分析文档移到 `evidence/` 或对应的 `docs/` 子目录
- **删除过期文件**：超过 30 天的临时文件应删除或归档

### 提交前检查
运行以下命令检查是否有临时文件未被忽略：
```bash
git status | grep -E "(BUG-|DEBUG-|fix-|test-|wiki-|temp_|tmp_|tmp-|\\.tmp_|_vitest)"
```

如果有输出，说明有临时文件需要处理。

## 已完成的清理

### 2026-03-02
- ✅ 移动 16 个 Bug 分析文档到 `docs/bugs/`
- ✅ 移动 12 个代码审查报告到 `docs/reviews/`
- ✅ 移动 25 个 SmashUp/PR5 文档到 `evidence/`
- ✅ 移动 8 个临时脚本到 `scripts/temp/`
- ✅ 移动 12 个测试结果文件到 `test-results/`
- ✅ 移动 17 个 Wiki/数据文件到 `temp/`
- ✅ 删除 13 个 Git 临时文件和其他临时文件

### 2026-03-03
- ✅ 删除 87 个临时脚本（fix-*/debug-*/analyze-*/check-*/rewrite-*/等）
- ✅ 删除 2 个临时文件（test-mobile.html, server-performance-check.sh）
- ✅ 删除 2 个重复/空脚本（compare-wiki-code.mjs, write-e2e-framework-doc.mjs）
- ✅ 移动 check-audio-registry.js 到 scripts/audio/
- ✅ scripts/ 根目录现在只保留 6 个正式工具：
  - kiro-auto-resume.mjs（Kiro 监控工具）
  - download-fonts.mjs（字体下载）
  - scrape-wiki-*.mjs（Wiki 数据抓取，3 个）
  - final-wiki-code-comparison.mjs（Wiki 对比工具）
- ✅ 更新 `.gitignore` 添加临时文件忽略规则
