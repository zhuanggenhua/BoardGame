# 后台测试延迟 E2E 证据

## 范围

- 后台系统健康页新增“后台测试延迟”控制面板
- 管理员可设置延迟毫秒数并启用/关闭
- UI 正确回显当前生效值与作用范围

## 运行命令

```bash
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- admin-ugc.e2e.ts "系统健康页可配置后台测试延迟"
```

说明：
- 本次 E2E 运行时机器可用内存低于项目默认门槛，使用了脚本自带的 `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1` 绕过全局预算门禁。
- 这只影响测试启动门禁，不影响页面逻辑、接口逻辑与断言结果。

## 截图

![后台测试延迟已启用](../test-results/evidence-screenshots/admin-ugc.e2e/%E7%B3%BB%E7%BB%9F%E5%81%A5%E5%BA%B7%E9%A1%B5%E5%8F%AF%E9%85%8D%E7%BD%AE%E5%90%8E%E5%8F%B0%E6%B5%8B%E8%AF%95%E5%BB%B6%E8%BF%9F/%E7%B3%BB%E7%BB%9F%E5%81%A5%E5%BA%B7%E9%A1%B5%E5%8F%AF%E9%85%8D%E7%BD%AE%E5%90%8E%E5%8F%B0%E6%B5%8B%E8%AF%95%E5%BB%B6%E8%BF%9F-admin-health-latency-enabled.png)

截图路径：
- `test-results/evidence-screenshots/admin-ugc.e2e/系统健康页可配置后台测试延迟/系统健康页可配置后台测试延迟-admin-health-latency-enabled.png`

## 人工观察结论

1. 右侧概览区出现了单独的“后台测试延迟”卡片，且没有把上方“持久化房间”“封禁用户”等现有概览卡挤乱或遮挡。
2. 卡片右上角状态胶囊显示“已启用”，输入框内为 `750`，底部“当前生效延迟”明确回显为 `750 ms`，说明启用动作后的配置已回写到 UI。
3. 卡片正文明确写着“仅影响 `/admin/*` 管理接口，不影响游戏服、Socket 与大厅实时链路”，底部作用范围也显示为 `admin-api`，页面语义与本轮需求一致，没有误导成全站限速。

## 补充验证

- API 集成测试：`npm run test:api -- apps/api/test/admin.e2e-spec.ts`
- 新增断言覆盖：
  - `PATCH /admin/test-latency` 可保存启用状态与毫秒数
  - 启用后其他 `/admin/*` 接口会实际被延迟
  - 再次关闭后状态回到 `enabled=false / delayMs=0`
