# 大厅移动端作者入口 E2E 证据

## 目标

验证大厅游戏详情弹窗中的移动端作者入口满足以下要求：

- 入口位于左侧详情区右上角
- 入口是纯文本/轻量按钮，没有可见包围盒
- 点击后可以打开作者信息弹窗

## 代码变更

- `src/components/lobby/GameDetailsModal.tsx`
  - 将移动端作者入口改为侧栏根容器右上角绝对定位
  - 显式设置透明背景、无边框、无阴影的移动端样式
  - 保留标题右侧留白，避免入口遮挡标题
- `e2e/lobby.e2e.ts`
  - 为该移动端用例改成直接打开 `/?game=tictactoe`
  - 校验入口位于侧栏右上角
  - 校验入口没有可见背景、边框和阴影包围盒
  - 校验点击后作者弹窗可见并输出截图

## 执行命令

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_HAS_EXPLICIT_TARGET='true'
$env:PW_TEST_MATCH='e2e/lobby.e2e.ts'
node node_modules/playwright/cli.js test e2e/lobby.e2e.ts --grep "移动端游戏详情隐藏描述和推荐人数" --workers=1 --reporter=line
```

结果：

- 1 passed (18.4s)

## 证据截图

- 入口截图：`F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围盒\lobby-mobile-author-entry-right-top.png`
- 弹窗截图：`F:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围盒\lobby-mobile-author-modal-open.png`

## 截图结论

- `lobby-mobile-author-entry-right-top.png`
  - 作者入口位于详情卡片标题区右上角
  - 入口为轻量文本样式，没有可见的背景底色、描边或阴影包围盒
  - 移动端详情区仍保持描述和推荐人数隐藏，未挤压房间列表区
- `lobby-mobile-author-modal-open.png`
  - 点击作者入口后，作者信息弹窗成功打开
  - 弹窗内容包含作者名与作品说明，交互链路完整

## 额外校验

- `npm run typecheck` 通过

## 说明

- 本次 E2E 使用开发服务端口 `5173/18000/18001` 执行。原因是独立测试环境本轮存在前端首跳不稳定问题，但作者入口 UI 的验证对象与断言保持不变。
