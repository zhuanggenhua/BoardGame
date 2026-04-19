# Feedback Export Plan

## Goal
把服务器上的全部 feedback 导出到本地“不烂”目录，保留状态等元信息；若有图片则一并下载到本地，便于本地集中处理。

## Plan
1. 从远端 Mongo 导出全部 feedback 原始数据（包含 `_id / status / gameName / severity / type / userId / createdAt / updatedAt / content`）。
2. 清洗导出流，去掉 shell / mongosh 提示符污染，落地为本地 `temp/all-feedbacks.json`。
3. 生成“不烂”导出目录：
   - `feedbacks.json`
   - `feedbacks.csv`
   - `items/<game>/<feedbackId>.md`
   - `images/<game>/<feedbackId>/...`
4. 校验总数、图片数、样例记录，确认可直接本地使用。
5. 如发现乱码，再补一份修复版总表与剩余异常报告。
6. 将本次导出脚本与修复辅助脚本提交到仓库，便于复用。

## Result
- 导出目录：`C:\Users\zhuagenbao\GameNotes\不烂\BoardGame反馈导出-2026-04-04T04-52-08-844Z`
- feedback 总数：136
- 图片总数：38
- 修复版总表：`feedbacks.repaired.json`
- 剩余乱码报告：`feedbacks.repaired.remaining-garbles.json`（当前为空数组）

## Commits
- `fedef46d` chore: stabilize feedback export
- `f3c4ebac` chore: add feedback garble repair helper

## Notes
- 主仓还存在与本任务无关的脏文件，未并入本次提交。
- 之前终端里看到的 `�?` 更像输出显示问题；导出文件本体核验未发现残留 `�`。
