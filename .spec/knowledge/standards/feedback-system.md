---
name: feedback-system
description: 反馈系统标准：提交、状态、去重、恢复和回写边界——改用户反馈链路时查
metadata:
  type: doc
  status: 已交付
---

# 反馈系统规范

## 反馈提交入口

- `POST /feedback` 是玩家反馈提交通道，必须对未登录用户可用。
- 可选登录态只用于绑定提交者与发放反馈积分；登录凭证缺失、过期、无效或格式异常时，提交必须按匿名反馈继续处理。
- 前端反馈弹窗不得把登录、反馈积分、个人反馈列表或后台管理权限作为提交前置条件；如果带登录态提交返回未授权，必须允许匿名重试。
- 后台反馈管理、个人反馈列表、状态回写、删除等管理动作可以继续要求登录和权限校验。
- 修改 `FeedbackModal`、`FeedbackController`、`OptionalJwtAuthGuard`、`POST /feedback` 或相关认证链路时，必须保留或补充两类回归：未登录可提交、失效 token 仍可提交。

## 反馈处理入口

- 处理线上反馈、回写状态、关闭理由、解决方式等流程仍以 `.spec/skills/feedback-closeout/SKILL.md` 为唯一规范真相源。
- 本文只约束玩家提交反馈的公共入口，不替代反馈收口 workflow。
