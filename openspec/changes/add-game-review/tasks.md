# 游戏评论系统实现任务

> **开发流程**：后端先行 → 接口文档 → 前端实现

---

# Phase 1: 后端实现

## 1. Review 模块基础

- [x] 1.1 创建 Review Schema（`user`, `gameId`, `isPositive`, `content`, `rating?`, `tags?`, `helpfulCount?`）
- [x] 1.2 创建索引 `{ user: 1, gameId: 1 }` 唯一复合索引
- [x] 1.3 创建索引 `{ gameId: 1, createdAt: -1 }` 列表查询索引
- [x] 1.4 创建索引 `{ gameId: 1, isPositive: 1 }` 统计查询索引
- [x] 1.5 创建 ReviewModule、ReviewService、ReviewController

## 2. Review API 实现

- [x] 2.1 实现 `GET /auth/reviews/:gameId` 获取游戏评论列表（分页）
- [x] 2.2 实现 `GET /auth/reviews/:gameId/stats` 获取好评率统计（Redis 缓存）
- [x] 2.3 实现 `GET /auth/reviews/:gameId/mine` 获取当前用户的评论
- [x] 2.4 实现 `POST /auth/reviews/:gameId` 创建/更新评论
- [x] 2.5 实现 `DELETE /auth/reviews/:gameId` 删除评论
- [x] 2.6 实现关键词过滤服务（黑名单检查）

## 3. 缓存与统计

- [x] 3.1 实现好评率统计 Redis 缓存（Key: `review:stats:{gameId}`，TTL: 300s）
- [x] 3.2 评论创建/更新/删除时清除对应游戏的统计缓存

## 4. 后端测试与文档

- [x] 4.1 编写 Review 模块单元测试
- [x] 4.2 编写 Review API 集成测试
- [x] 4.3 编写接口文档 `docs/api/review.md`

---

# Phase 2: 前端实现

## 5. 前端基础组件

- [ ] 5.1 创建 `src/components/review/` 目录结构
- [ ] 5.2 实现 `ApprovalBar.tsx` 好评率进度条组件
- [ ] 5.3 实现 `ReviewItem.tsx` 单条评论组件
- [ ] 5.4 实现 `ReviewList.tsx` 评论列表组件（含分页）

## 6. 评论表单

- [ ] 6.1 实现 `ReviewForm.tsx` 评论表单组件
- [ ] 6.2 实现好评/差评按钮组切换
- [ ] 6.3 实现评论内容输入框（可选，限 500 字）
- [ ] 6.4 实现提交逻辑（创建/更新）
- [ ] 6.5 实现删除评论功能

## 7. 游戏评价区域

- [ ] 7.1 实现 `GameReviewSection.tsx` 主组件
- [ ] 7.2 实现游戏切换选择器（Tab 或下拉）
- [ ] 7.3 集成 ApprovalBar、ReviewForm、ReviewList
- [ ] 7.4 使用 React Query 管理数据获取与缓存

## 8. 主页集成

- [ ] 8.1 在 `Home.tsx` 房间列表与排行榜之间添加 GameReviewSection
- [ ] 8.2 调整布局确保视觉协调
- [ ] 8.3 未登录状态下隐藏评论表单，显示登录提示

---

# Phase 3: 联调验证

## 9. 功能联调

- [ ] 9.1 联调好评/差评提交流程
- [ ] 9.2 联调评论列表分页加载
- [ ] 9.3 联调好评率统计与进度条显示
- [ ] 9.4 联调评论修改与删除
- [ ] 9.5 验证关键词过滤拦截

## 10. 边界测试

- [ ] 10.1 测试未登录用户访问评论区
- [ ] 10.2 测试重复提交评论（应更新而非创建）
- [ ] 10.3 测试评价数 < 10 时的显示逻辑
- [ ] 10.4 测试评论内容超长（500 字限制）
- [ ] 10.5 测试关键词过滤触发

---

## 依赖关系

```
Phase 1 (后端):
1.x (Schema/索引) → 2.x (API) → 3.x (缓存) → 4.x (测试文档)

Phase 2 (前端):
5.x (基础组件) → 6.x (表单) → 7.x (主组件) → 8.x (主页集成)

Phase 3 (联调):
9.x + 10.x ← Phase 1 + Phase 2 全部完成
```

## 接口文档产出

| 完成阶段 | 文档文件 |
|----------|----------|
| 4.3 | `docs/api/review.md` |

## 可并行任务

- Phase 2: 5.2 (ApprovalBar) 和 5.3 (ReviewItem) 可并行开发
- Phase 2: 6.x (表单) 和 5.x (列表组件) 可并行开发
