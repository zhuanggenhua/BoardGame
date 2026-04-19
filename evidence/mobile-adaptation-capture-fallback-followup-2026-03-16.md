# 移动端补图旁路跟进 2026-03-16

## 本轮目的

在当前终端不允许 `child_process` 的前提下，继续推进移动端适配收口，确认仓库内新增的“浏览器补图旁路”是否至少能完成以下链路：

1. 入口命令可用
2. Vite 开发服务器可在受限环境启动
3. 浏览器能够进入目标页面
4. 页面内 `MobileEvidenceCaptureAgent` 能把 PNG 写回工作区

## 本轮改动

- 新增并接回脚本入口：
  - [capture-mobile-evidence.ps1](/D:/gongzuo/webgame/BoardGame/scripts/infra/capture-mobile-evidence.ps1)
- 调整 npm 入口：
  - [package.json](/D:/gongzuo/webgame/BoardGame/package.json)
- 修复受限环境下的 Vite 依赖优化配置：
  - [vite.config.ts](/D:/gongzuo/webgame/BoardGame/vite.config.ts)
- 增加 capture 期前端诊断标题：
  - [main.tsx](/D:/gongzuo/webgame/BoardGame/src/main.tsx)
  - [MobileEvidenceCaptureAgent.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/MobileEvidenceCaptureAgent.tsx)
- 增加浏览器侧诊断观测：
  - [capture-mobile-evidence-browser.ps1](/D:/gongzuo/webgame/BoardGame/scripts/infra/capture-mobile-evidence-browser.ps1)
- 同步文档调用方式：
  - [mobile-adaptation.md](/D:/gongzuo/webgame/BoardGame/docs/mobile-adaptation.md)

## 关键验证

### 1. 静态校验

已通过：

- `npm run typecheck`
- `node node_modules/eslint/bin/eslint.js vite.config.ts src/main.tsx src/components/system/MobileEvidenceCaptureAgent.tsx vite-plugins/ready-check.ts --max-warnings 999`

### 2. 补图入口恢复

命令：

```bash
npm run capture:mobile:evidence -- smashup-tutorial-mobile-landscape
```

结果：

- 入口脚本能正常解析参数并打印目标输出路径
- `capture:mobile:evidence` 已不再依赖 `node:child_process` 拉起下层脚本

### 3. Vite 受限启动恢复

此前失败点：

- `vite.config.ts` 中用于禁用依赖预构建的 `noDiscovery: true` 被损坏注释吞掉，导致 Vite 冷启动仍进入 `esbuild -> spawn EPERM`

修复后结果：

- Vite 能在 `BG_VITE_FORCE_INLINE=1` 下正常启动
- `/__ready` 能返回就绪状态

本轮日志证据：

- `D:\gongzuo\webgame\BoardGame\logs\vite-2026-03-16T10-50-32-202Z.log`
- `D:\gongzuo\webgame\BoardGame\logs\mobile-evidence-browser-vite-6173.log`

### 4. 当前剩余阻塞

命令：

```bash
powershell -ExecutionPolicy Bypass -File scripts/infra/capture-mobile-evidence.ps1 smashup-4p-mobile-attached-actions -TimeoutSeconds 70
```

结果：

- Edge 能被拉起
- Vite 已 ready
- 目标输出文件仍未生成：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\05-mobile-single-tap-expands-attached-actions.png`
- 当前能观察到的窗口标题始终停留在：
  - `127.0.0.1_/play/smashup`

这说明本轮已经把问题从“脚本不可用 / Vite 起不来”推进到了：

- 浏览器页面虽然被打开，但页内 capture 流程仍未完成
- 现阶段还不能确认是页面脚本未执行、执行过早失败、还是浏览器环境对 app 窗口/调试元数据的暴露不足

## 当前判断

本轮最重要的结论是：

1. `capture:mobile:evidence` 入口现在可运行
2. 受限环境下的 Vite 冷启动已经被打通
3. 当前新的真实阻塞点不再是 `esbuild spawn EPERM`
4. 当前新的真实阻塞点是“浏览器页内截图没有回写到工作区”

## 建议的下一步

最正确方案：

在允许 `child_process` 的本地终端或 CI runner 中，直接重跑正式 E2E，补齐缺失截图。

原因：

- 代码层和启动层的受限环境问题已经基本收敛
- 当前剩余问题落在 GUI 浏览器页内执行链路，继续在这个受限终端上深挖的收益明显下降
- 正式 E2E 仍然是项目要求的最终验收路径

如果仍要继续在当前受限终端深挖，可优先做这两件事：

1. 给浏览器补图页增加更早期、可外部观察的状态上报（例如本地 `fetch` 心跳或单独的状态文件写入）
2. 确认当前 Edge app 窗口是否允许通过调试端点稳定读取 page target 元数据，而不只是窗口标题
