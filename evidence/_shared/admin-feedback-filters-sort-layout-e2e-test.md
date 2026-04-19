# 后台反馈筛选、排序与固定控制区 E2E 证据

## 验证目标

验证后台反馈页重构后满足以下要求：

- 支持按类型、严重度筛选
- 支持按时间排序（最新优先 / 最早优先）
- 每页仍为 20 条，分页切换正常
- 分页和筛选控制区固定，只有反馈内容区滚动

## 执行命令

```bash
npm run test:e2e:ci:file -- admin-feedback.e2e.ts "反馈列表固定控制区支持分类筛选和时间排序，只有内容区滚动"
npm run test:e2e:ci:file -- admin-feedback.e2e.ts "反馈列表按页请求并可切换分页"
```

```bash
npm run test:api -- apps/api/test/feedback.e2e-spec.ts -t "admin 列表支持按时间正序排序"
```

## 结果

- 前端 E2E：
  - 分类筛选、严重度筛选、时间排序通过
  - 滚动时仅 `feedback-list-scroll` 内容区滚动
  - `feedback-list-controls` 与分页指示器保持可见
  - 分页切换仍正常
- 后端 API：
  - `/admin/feedback?sort=oldest` 已按创建时间正序返回

## 截图证据

- 固定控制区截图绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\admin-feedback-controls-sticky.png`
- 分页截图绝对路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\admin-feedback-pagination.png`

![后台反馈固定控制区截图](../test-results/evidence-screenshots/_shared/admin-feedback-controls-sticky.png)

![后台反馈分页截图](../test-results/evidence-screenshots/_shared/admin-feedback-pagination.png)

## 结论

当前反馈页已恢复并强化筛选能力，新增时间排序；顶部控制区和分页区不再参与内容滚动，反馈列表内容区单独滚动，交互上更稳定也更易点击。
