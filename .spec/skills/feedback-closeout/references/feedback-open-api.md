# 反馈开放接口与状态约定

> 这份文档只描述 **HTTP 接口形状**。
> 反馈收口的正式流程、状态推进时机、`closedReason / resolvedMethod` 是否必须回写、是否需要写本地分诊板，一律以 `.spec/skills/feedback-closeout/SKILL.md` 为唯一规范真相源。

## 使用边界

- 本文档描述的是“真实反馈接口”的约定，不代表任意返回相同路径的环境都可以直接当成正式收口目标。
- 在 BoardGame 项目里，必须先确认当前 `baseUrl` 指向的是真实线上反馈源，而不是：
  - 本地开发 API
  - 本地测试库
  - 导出快照
  - 返回 SPA HTML 的网页壳路由
- 如果请求返回的不是反馈 JSON，而是 HTML 页面，说明你打到的不是这里定义的真实接口，不能继续按“已连接线上反馈”处理。

## 接口

- 列表：`GET /admin-api/feedback?status=<status>&page=<n>&limit=<n>`
- 改状态：`PATCH /admin-api/feedback/:id/status`

### 认证要求

- `GET /admin-api/feedback`
  - 当前线上允许无凭证读取列表，但这只证明“能看见线上真实反馈”，**不等于**有正式回写权限。
- `PATCH /admin-api/feedback/:id/status`
  - 必须携带 `Authorization: Bearer <token>`。
  - 当前项目脚本统一使用 `BOARDGAME_FEEDBACK_TOKEN` 或 `--token` 传入。
  - 如果线上返回 `401 缺少登录凭证`，说明问题是“没有正式写凭证”，不是接口不存在。
  - `closed` 时应同时提交 `closedReason`（关闭理由）。
  - `resolved` 时应同时提交 `resolvedMethod`（解决方式）。
  - `closedReason/resolvedMethod` 是正式收口记录的一部分，默认应直接写到线上真实反馈记录，不要只停在本地分诊板。

## 备注

- 本文不再重复写反馈收口策略、状态语义解释、分诊顺序、双写口径或交付要求。
- 若旧的 `/feedback/open` 路由返回 `404`，说明你没有命中当前真实接口；具体如何切换、是否改走 Mongo、何时允许这样做，以 `.spec/skills/feedback-closeout/SKILL.md` 为准。
