# 王权骰铸详情页更新日志修复验证

## 结论

- 本地代码已修复：当前仓库中的详情页会渲染“更新”页签，并能请求公开接口显示更新日志内容
- 线上站点 `https://easyboardgame.top` 当前仍未生效：我实际查看截图后确认，线上王权骰铸详情弹窗里没有“更新”页签，仍是旧前端
- 因此，你现在看到“还是没日志”是事实，但根因已经不是当前工作区代码，而是线上前端尚未更新到这次修复后的版本

## 代码变更

- `src/components/lobby/GameDetailsModal.tsx`
  - 详情页更新日志页签改为直接渲染 `GameDetailsChangelogSection`
  - 页签内容容器增加 `min-h-0`，保证滚动区域可正常收缩和显示
- `src/components/lobby/GameDetailsChangelogSection.tsx`
  - 新增真实更新日志面板
  - 请求 `GET /game-changelogs/:gameId`
  - 支持 loading / error / empty / content 四种状态
  - 渲染标题、版本号、置顶标记、正文、日期
- `src/components/lobby/GameChangelogPanel.tsx`
  - 保留兼容层，避免旧引用影响本次详情页修复
- `src/components/lobby/__tests__/gameDetailsContent.test.ts`
  - 补充更新日志内容渲染测试
  - 补充接口失败错误态测试
- `public/locales/zh-CN/lobby.json`
- `public/locales/en/lobby.json`
  - 补充更新日志 loading / error / pinned 文案
- `e2e/lobby.e2e.ts`
  - 调整“结束 loading”用例，允许接口成功后进入内容态

## 验证记录

### 1. 单元测试

命令：

```powershell
npx vitest run src/components/lobby/__tests__/gameDetailsContent.test.ts --pool threads --reporter=verbose
```

结果：

- `1` 个测试文件通过
- `4` 个用例通过

覆盖点：

- 接口成功时会渲染更新日志标题、版本号、置顶标签、正文
- 接口失败时会显示错误态并记录日志

### 2. E2E 截图验证

命令：

```powershell
$env:PW_USE_DEV_SERVERS='true'; $env:PW_HAS_EXPLICIT_TARGET='true'; npx playwright test e2e/lobby.e2e.ts -g "Dice Throne 更新日志 tab 会渲染接口返回的已发布内容"
$env:PW_USE_DEV_SERVERS='true'; $env:PW_HAS_EXPLICIT_TARGET='true'; npx playwright test e2e/lobby.e2e.ts -g "Dice Throne 更新日志 tab 会请求公开接口并结束 loading"
```

结果：

- `Dice Throne 更新日志 tab 会渲染接口返回的已发布内容` 通过
- `Dice Throne 更新日志 tab 会请求公开接口并结束 loading` 通过

通过截图：

- `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\Dice-Throne-更新日志-tab-会渲染接口返回的已发布内容\lobby-dicethrone-changelog-renders-published-entry.png`

截图人工核对结果：

- 已打开 Dice Throne 详情弹窗
- 右侧 `UPDATES` 页签已激活
- 页面显示 `Balance Update`
- 页面显示版本号 `v0.1.3`
- 页面显示 `Pinned`
- 页面显示正文 `Pyromancer burn tooltip now matches the published rules.`
- 页面显示日期 `MAR 12, 2026`

这说明前台详情页已经能正确显示公开接口返回的更新日志内容。

### 3. 线上现状截图

获取方式：

- 使用 Playwright 打开 `https://easyboardgame.top`
- 点击“王权骰铸”卡片，等待详情弹窗稳定后截图

截图：

- `F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\manual\production-dicethrone-modal.png`

人工核对结果：

- 已打开线上 `easyboardgame.top` 的王权骰铸详情弹窗
- 顶部只有 `在线大厅 / 评价 / 排行榜`
- 没有出现“更新”页签
- 因此线上当前展示的仍是旧版详情弹窗，不是这次修复后的前端

### 4. 额外排查

- 本地开发接口 `http://127.0.0.1:5173/game-changelogs/dicethrone` 当前返回 `{"changelogs":[]}`
- 本地 Mongo `boardgame.gamechangelogs` 集合里没有 `gameId = dicethrone` 的记录
- 当前仓库代码按单体入口复刻后，请求 `/game-changelogs/dicethrone` 返回的是 JSON，不是 HTML
- 线上 `https://api.easyboardgame.top/health` 正常，但 `https://api.easyboardgame.top/game-changelogs/dicethrone` 返回了前端 HTML，而不是 JSON

这进一步说明：

1. 当前仓库代码里的公开更新日志接口链路是通的
2. 线上“没有日志”主要是部署/入口环境仍在跑旧前端，且 API 域上的该路径也没有按预期返回 JSON
