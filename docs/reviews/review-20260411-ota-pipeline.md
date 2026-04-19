# 代码审查报告：Android OTA 发布链路

日期：2026-04-11  
审查人：AI（code-reviewer 汇总）

## 审查范围
- 发布脚本：`scripts/mobile/publish-android-ota.mjs`、`scripts/mobile/android.mjs`（行为核对）
- Workflow：`.github/workflows/android-ota-publish.yml`
- 运行时：`src/lib/mobile/androidLiveUpdates.ts`、`src/components/system/AndroidLiveUpdateManager.tsx`
- 文档：`docs/android-app-build.md`、`docs/mobile-release.md`、`docs/deploy.md`

## 结论
发现 1 个高风险问题、2 个中风险问题；均已在本次改动中修复/对齐。建议合入。

## 发现的问题

### [HIGH] 运行时仍执行原生版本门禁
- **证据**：`androidLiveUpdates.ts` 仍按 `target/min/max` 判断兼容并阻断 OTA  
  - `src/lib/mobile/androidLiveUpdates.ts:387-421`
- **影响**：违背“OTA 面向所有已安装版本”规则；一旦 manifest 误带旧字段，客户端仍会跳过 OTA 或提示原生升级。
- **修复**：运行时忽略原生版本门禁字段，仅记录警告日志，继续 OTA 流程。

### [MEDIUM] OTA 生效策略文档自相矛盾
- **证据**：
  - 文档前半段表述“默认后台 OTA”（`docs/android-app-build.md:136-159`）
  - 后半段却写“启动即检查并优先即时 OTA”（`docs/android-app-build.md:423-425`）
- **影响**：发版/验收口径不一致，易误判线上行为。
- **修复**：统一描述为“后台检查与排队生效；即时切换需显式触发”。

### [MEDIUM] 手动 OTA workflow 默认强更，和脚本/文档口径不一致
- **证据**：`.github/workflows/android-ota-publish.yml` 的 `force_update` 默认 `true`
- **影响**：手动发版易误触“强更”语义，与本地脚本默认 `--no-force-update` 不一致。
- **修复**：将默认值改为 `false`，需显式开启。

## 验证
- 本次修改以配置/逻辑对齐为主，无自动化测试新增。

## 建议
- **APPROVE**：关键门禁问题已修复，文档与 workflow 口径已对齐。
