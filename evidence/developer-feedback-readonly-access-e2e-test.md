# 开发者角色查看反馈 E2E 证据

## 变更目标

- `developer` 角色可以进入后台反馈页并查看反馈内容。
- 反馈状态修改、单条删除、批量删除仍只允许 `admin`。

## 验证结果

### 1. 后端权限

- 文件：`apps/api/test/feedback.e2e-spec.ts`
- 结果：通过
- 关键断言：
  - `developer` 请求 `GET /admin/feedback` 返回 `200`
  - `developer` 请求 `PATCH /admin/feedback/:id/status` 返回 `403`

### 2. 前端界面

- 文件：`e2e/admin-feedback.e2e.ts`
- 已验证的界面要点：
  - 开发者侧边栏出现“反馈管理”入口
  - 反馈页标题旁显示“只读”标记
  - 页面提示“开发者可查看和复制反馈内容，改状态与删除仍仅管理员可用。”
  - 开发者视角下无复选框、无状态切换、无删除操作区
  - 展开反馈后仍可复制 AI payload

## 证据截图

### 管理员视角

截图路径：`D:\gongzuo\webgame\BoardGame\test-results\admin-feedback-ai-payload.png`

![管理员反馈页](../test-results/admin-feedback-ai-payload.png)

截图分析：

- 左侧为管理员后台导航，包含完整后台菜单。
- 反馈列表保留复选框、状态下拉和操作区，说明管理员管理能力未被削弱。
- 顶部 AI Payload 预览区已刷新，说明复制反馈载荷流程正常。

### 开发者视角

截图路径：`D:\gongzuo\webgame\BoardGame\test-results\admin-feedback-developer-readonly.png`

![开发者反馈页只读视角](../test-results/admin-feedback-developer-readonly.png)

截图分析：

- 左侧开发者导航已新增“反馈管理”。
- 标题右侧可见“只读”徽标。
- 顶部说明文案明确只读范围。
- 列表中没有选择框和右侧操作按钮，只保留查看所需信息与展开入口。

## 执行命令

```bash
npm run typecheck
npm run test -- apps/api/test/feedback.e2e-spec.ts src/components/__tests__/ConfirmModal.test.tsx
npm run test:e2e:ci:file -- admin-feedback.e2e.ts
npm run test:e2e:ci:file -- admin-feedback.e2e.ts
```

## 复跑稳定性

- 2026-03-17 22:03 左右，`npm run test:e2e:ci:file -- admin-feedback.e2e.ts` 连续复跑 2 次，均通过。
- 两次复跑总计 4 个用例全部通过，没有再出现 `ERR_CONNECTION_RESET` 或 `ERR_CONNECTION_REFUSED`。

## 抖动原因判断

- 这次连续复跑稳定通过，说明“开发者可查看反馈”的权限改动本身没有引入持续性回归。
- 之前的抖动更像是测试运行期间工作区存在并发文件改写，触发了 Vite 热更新瞬时失配。
- 直接证据见 `D:\gongzuo\webgame\BoardGame\logs\vite-2026-03-17T13-33-22-869Z.log`：
  - 2026-03-17 21:39:16 与 21:39:34，Vite 报 `Failed to resolve import "./pages/admin/components/AdminLayout" from "src/App.tsx"`
  - 2026-03-17 21:39:39，Vite 又记录 `page reload src/pages/admin/components/AdminLayout.tsx`
- 这说明当时 `AdminLayout.tsx` 在热更新窗口内短暂不可解析，属于并发编辑/HMR 抖动，更接近环境瞬时不稳定，而不是反馈权限逻辑错误。
