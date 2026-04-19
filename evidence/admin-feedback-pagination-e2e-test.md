# 后台反馈分页 E2E 证据

## 目标

验证后台“用户反馈”页满足以下行为：

- 默认筛选状态为“待处理”而不是“全部”
- 列表按 `page` + `limit=20` 请求后台接口
- 可通过分页按钮切换页码
- 页面显示的是接口返回的总数，而不是当前页条数

## 本次验证时间

- 2026-03-21

## 执行命令

```bash
npx eslint src/pages/admin/Feedback.tsx
```

```bash
npm run test:e2e:ci:file -- admin-feedback.e2e.ts "反馈列表按页请求并可切换分页"
```

## 截图

截图路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\admin-feedback-pagination.png`

![后台反馈分页截图](../test-results/evidence-screenshots/admin-feedback-pagination.png)

## 截图分析

- 顶部计数显示为总条数，不再只显示当前页渲染数量。
- 顶部分页控件显示 `2 / 2`，说明页码状态已接入真实分页。
- 列表中只出现第二页那一条反馈，符合测试桩里“第 2 页仅 1 条数据”的设定。
- E2E 断言同时验证了首屏请求带 `limit=20`，翻页后确实再次发出了 `page=2&limit=20` 请求。

## 结论

后台反馈页已接入真实分页：

- 默认打开时先看“待处理”
- 每页固定 20 条
- 支持上一页 / 下一页切换
- 翻页是重新请求后台，不是前端假分页

## 备注

- 本次 E2E 运行前，为测试环境临时启动了内存 MongoDB，以满足 API 服务启动依赖；分页断言本身已通过。
