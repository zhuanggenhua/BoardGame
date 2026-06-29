# 七大恨教程完成证据

## 目标

- 把七大恨教程从“静态导览”补成“真实可操作、可跑完、每步有截图并能指出点击区域”的完整基础教学链。

## 最终教程链

- 第 1 步：进入教程，点击 `下一步` 开始基础回合。
- 第 2 步：点击地图上的 `皮岛`，锁定起始地区。
- 第 3 步：点击右侧 `赐印招安`，进入弃牌支付。
- 第 4 步：点击底部 3 张手牌，再点 `确认执行`。
- 第 5 步：点击轮盘热区里高亮的 `免费走 1`，推进到下一势力。
- 第 6 步：点击 `完成并返回`，关闭教程。

## 实现落点

- 教程脚本：
  - [src/games/qidahen/tutorial.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/tutorial.ts)
- 教程可见文案：
  - [public/locales/zh-CN/game-qidahen.json](/D:/gongzuo/webgame/BoardGame/public/locales/zh-CN/game-qidahen.json)
  - [public/locales/en/game-qidahen.json](/D:/gongzuo/webgame/BoardGame/public/locales/en/game-qidahen.json)
- 棋盘教程门控与锚点：
  - [src/games/qidahen/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/Board.tsx)
- 教程真实 E2E：
  - [e2e/qidahen/qidahen-closeout.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/qidahen/qidahen-closeout.e2e.ts)

## 最终验证

- `npm run typecheck`
  - 通过
- `npx vitest run src/games/qidahen/__tests__/Board.test.ts`
  - `182 passed`
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen/qidahen-closeout.e2e.ts`
  - `2 passed`
  - 教程逐步操作链通过
  - 终局遮罩注入链通过

## 截图证据

- [01-教程第1步-点下一步开始基础回合.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/01-教程第1步-点下一步开始基础回合.png)
- [02-教程第2步-点击地图上的皮岛.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/02-教程第2步-点击地图上的皮岛.png)
- [03-教程第3步-点击右侧赐印招安.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/03-教程第3步-点击右侧赐印招安.png)
- [04-教程第4步-点击底部手牌支付3张.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/04-教程第4步-点击底部手牌支付3张.png)
- [05-教程第5步-点击轮盘免费走1.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/05-教程第5步-点击轮盘免费走1.png)
- [06-教程第6步-点击完成关闭教程.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-教程完成/06-教程第6步-点击完成关闭教程.png)

## 核图与开图

- 6 张教程截图都已人工核图，能直接看出每一步该点击的位置：
  - 第 1 步：教程卡片底部 `下一步`
  - 第 2 步：地图上的 `皮岛`
  - 第 3 步：右侧行动列里的 `赐印招安`
  - 第 4 步：底部手牌区与 `确认执行`
  - 第 5 步：轮盘热区里高亮的 `免费走 1`
  - 第 6 步：教程完成卡片里的 `完成并返回`
- 6 张图都已通过以下命令真实打开：
  - `npm run verify:open-image -- "<绝对路径>"`

## 备注

- 教程第 5 步当前采用“点轮盘热区里高亮的 `免费走 1`”作为真实教学操作对象；上方横幅只负责提示，不承接实际点击。
- 这样和当前 UI 的实际可操作入口一致，也和棋盘门禁测试口径保持一致。
