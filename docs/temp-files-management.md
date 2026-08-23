# 临时文件归位

本文记录临时产物、诊断输出和历史记录的当前归位。AI 文档写法和落点判断见 [`documentation-style`](../.spec/knowledge/standards/documentation-style.md)。

## 目录职责

| 内容 | 位置 |
| --- | --- |
| 问题分析和修复记录 | `docs/bugs/` |
| 代码审查报告 | `docs/reviews/` |
| 审计材料 | `docs/audit/` |
| 可复查证据、截图账本 | `evidence/` |
| 临时脚本 | `scripts/temp/` |
| 测试结果 | `test-results/` |
| 临时数据、HTTP 探针、下载样本 | `temp/` |
| 临时图片、OCR、裁图、中间截图 | `temp/<purpose>/` 或 `tmp/<purpose>/` |
| 历史会话、旧报告、退役工具 | `docs/archive/` |

仓库根目录不放 `temp-*.html`、`temp-*.bin`、`direct-http.*`、`.tmp_*`、`tmp_*`、`safe_image_*` 这类临时产物。

## 录入与资源

- 为 OCR、核对、裁切、看清局部版式生成的图片都算中间产物，放 `temp/`。
- 正式运行时资源必须另走资源链，不能把临时裁图顺手提交到正式资源目录。
- 正式资源与中间产物在交付说明里要分开说清。
- 压缩、图集、manifest 和上传规则见 [`asset-pipeline`](../.spec/knowledge/standards/asset-pipeline.md)。

## UI / E2E 截图

- 正式证据图放 `evidence/` 或 `test-results/` 的稳定路径。
- 中间诊断图放 `temp/`。
- 同一任务同一视角默认只保留一个稳定文件名，例如 `*-desktop-current.png`。
- 临时局部图、失败候选图和多版本截图在收口前删除或移回 `temp/`，除非用户明确要求保留对照。

## 提交前检查

```bash
Get-ChildItem -Force | Where-Object { $_.Name -match '^(temp-|direct-http|\\.tmp_|tmp_|safe_image_)' }
Get-ChildItem temp,tmp,test-results -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 50
```

确认本轮新增产物是否仍有保存价值：可复查证据进 `evidence/`，历史记录进 `docs/archive/`，临时垃圾删除。
