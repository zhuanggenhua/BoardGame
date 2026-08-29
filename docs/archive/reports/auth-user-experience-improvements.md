# 认证流程用户体验改进归档

本文是旧登录 / 注册体验改进记录，不作为当前认证规范。当前认证行为必须以现有 API、前端实现、i18n 文案和安全策略为准；本文只保留当时的产品意图、实现点和风险权衡，避免旧改动背景在文档清理中丢失。

## 当时目标

当时要解决的是登录注册流程不够友好：用户输入邮箱后，如果系统只统一提示“邮箱或密码错误”，用户不知道是邮箱输错、账号未注册，还是密码输错。

## 当时改动

### 登录未注册邮箱

- 改进前：邮箱不存在和密码错误统一返回“邮箱或密码错误”。
- 改进后：邮箱未注册时提示“该邮箱未注册，请先注册”，约 1.5 秒后切到注册页并预填邮箱。
- 后端曾通过邮箱存在性检查返回 `AUTH_EMAIL_NOT_REGISTERED` 和 `suggestRegister: true`。

### 登录密码错误

- 改进前：仍与邮箱不存在共用错误文案。
- 改进后：邮箱存在但密码不正确时提示“密码错误”。

### 注册已存在邮箱

- 改进前：注册或发送验证码时只提示“该邮箱已被注册”。
- 改进后：提示“该邮箱已注册，是否直接登录？”，约 1.5 秒后切到登录页并预填邮箱。
- 后端曾返回 `suggestLogin: true`，前端据此执行自动跳转。

### 错误提示动画

- 错误提示加入淡入动画，目标是让错误反馈更明显而不打断用户流程。
- 当时实现依赖前端错误状态与动画组件；当前是否仍存在要看现有 UI。

## 当时文案

旧文档记录过的中文文案：

```json
{
  "invalidPassword": "密码错误",
  "emailNotRegisteredLogin": "该邮箱未注册，请先注册",
  "emailAlreadyRegistered": "该邮箱已注册，是否直接登录？"
}
```

旧文档记录过的英文文案：

```json
{
  "invalidPassword": "Invalid password",
  "emailNotRegisteredLogin": "This email is not registered. Please sign up first",
  "emailAlreadyRegistered": "This email is already registered. Would you like to log in?"
}
```

这些 key 和文案只代表当时实现；当前语言文件可能已经迁移或改名。

## 安全权衡

当时接受“登录时暴露邮箱是否存在”的理由是：

- 注册验证码流程已经会暴露邮箱存在性。
- 登录继续隐藏账号状态会降低正常用户体验，安全收益有限。
- 当时仍保留登录失败次数限制、IP + 邮箱双重限流和密码重置限制。

以后若重新调整该行为，不能只按体验判断；需要同时确认当前限流、验证码、审计日志和安全策略是否仍闭合。

## 当时影响范围

- 后端：`apps/api/src/modules/auth/auth.controller.ts` 的 `login()`、`register()`、`sendRegisterCode()`。
- 前端：`src/contexts/AuthContext.tsx` 的登录、注册、验证码方法。
- UI：`src/components/auth/AuthModal.tsx` 的提交、发验证码和自动跳转逻辑。
- i18n：当时涉及 `public/locales/zh-CN/server.json` 与 `public/locales/en/server.json`。

## 当时测试

旧文档记录的 E2E 文件是 `e2e/_shared/auth-user-friendly-flow.e2e.ts`，覆盖：

- 未注册邮箱登录后提示并引导注册。
- 已注册邮箱注册或发验证码后提示并引导登录。
- 密码错误时明确提示密码错误。
- 错误提示动画可见。

当前是否仍有这些测试或等价覆盖，需要重新查当前测试树。

## 当前使用口径

- 本文不是当前认证规范，也不能直接证明当前线上行为。
- 排查当前认证问题时，先看现有后端、前端、i18n 和测试。
- 如果要恢复或调整这些体验，必须重新确认当前安全策略是否允许暴露邮箱存在性。
