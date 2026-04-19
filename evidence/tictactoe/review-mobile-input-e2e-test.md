# 移动端评价输入可见性 E2E 验收

## 范围
- 评价入口链路：`e2e/tictactoe/review.e2e.ts`
- 详情弹窗入口稳定性：`e2e/tictactoe/review.e2e.ts`
- 相关实现：`src/components/review/GameReviewSection.tsx`、`src/components/review/ReviewForm.tsx`

## 本轮验证
- `npx eslint e2e/tictactoe/review.e2e.ts`
- `node scripts/infra/cleanup_test_connections.js --e2e --shared`
- `PW_SERVER_RUNTIME=tsx node scripts/infra/run-e2e-single.mjs ci --file e2e/tictactoe/review.e2e.ts --case "移动端评价输入聚焦后仍应保持可见"`
  - 结果：`1 passed`

> 说明：当前默认 bundle 版 E2E runtime 存在独立启动故障（游戏服务 bundle 会报 `setup is not defined`），本轮为验证评价链路，使用仓库已支持的 `PW_SERVER_RUNTIME=tsx` 运行隔离环境，不影响本条 UI 回归结论。

## 截图核对

### 1. 移动端评价弹窗输入区
- 截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\tictactoe\review-form-mobile-input-visible.png`
- 我实际看到的现象：
  - 弹窗头部“撰写评价”完整可见，关闭按钮仍在右上角，没有被短高度挤掉。
  - “推荐 / 不推荐”切换、正文输入框和底部“发布评论”主按钮同时留在弹窗内，没有被键盘态顶出可视区。
  - 输入框里能清楚看到“移动端评价输入可见性校验”，说明不是“输入框还在，但文本已经看不见”。
- 是否达到验收标准：达到。
  - 已证明这条真实链路下，移动端评价表单能够稳定拉起，输入区与提交按钮都仍可见、可编辑。

## 结论
- 这条反馈本轮已收口。
- 修复重点不是 `textarea` 自身样式，而是先把“大厅 -> 井字棋详情弹窗 -> 评价 tab -> 写评价”入口链路改成稳定路径，再验证移动端键盘态下的输入区可见性。
