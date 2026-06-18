# 幻想国度直接点击交互重构验证

## 验证入口

- 工作区：`D:\gongzuo\webgame\BoardGame`
- 前端入口：`http://127.0.0.1:4274/play/fantasyrealms?players=2&playerID=0&seat1=local-ai&seat1Delay=0`
- 验证方式：真实页面加载后，通过测试注入把页面切到代表态，再在真实 DOM 上执行点击与放大操作

## 本轮确认结果

- 摸牌入口已经改成直接点左上牌库，不再需要额外确认按钮。
- 拿公开弃牌入口已经改成直接点公开牌，不再需要额外确认按钮。
- 进入弃牌阶段后，页面只保留短横幅提示，真正执行弃牌的是直接点击手牌。
- 移动横屏下存在显式放大镜入口，可直接打开放大预览层。
- 四张验收图都已在当前仓库真实页面上重拍为可读彩色正式卡图。

## 截图证据

- `evidence/fantasyrealms/direct-click-2026-06-18/01-桌面摸牌与拿公开牌-横幅提示.png`
  - 证明桌面态同时存在“摸牌”和“拿公开牌”两个直接入口，横幅文案为短提示。
- `evidence/fantasyrealms/direct-click-2026-06-18/02-桌面摸牌后-直接进入弃牌.png`
  - 证明真实点击牌库后，页面直接进入弃牌阶段，横幅提示为“直接点一张手牌弃置”。
- `evidence/fantasyrealms/direct-click-2026-06-18/03-桌面拿公开牌后-直接进入弃牌.png`
  - 证明真实点击公开弃牌后，页面直接进入弃牌阶段，手牌区与中央公开牌都保持可读彩色卡面。
- `evidence/fantasyrealms/direct-click-2026-06-18/04-移动横屏-放大镜查看手牌.png`
  - 证明移动横屏下可通过显式放大镜入口打开放大预览层，放大卡面可读。

## 截图链路说明

- 这四张图都来自当前仓库 `4274` 真实页面，不是替代页、静态稿或伪造图。
- 这次黑块问题的真实原因不是素材缺失，也不是交互链错误，而是截图过早，浏览器还没把现有卡图解码并画到页面上。
- 稳定截图条件已经锁定为：
  - 页面打开后先等待真实页面与测试注入注册完成。
  - 进入目标状态后，再等待当前页面里的卡图完成浏览器解码（`img.decode()`）再截图。
- 其中 `img.complete` 不能作为是否可截图的可靠条件；更可靠的证据是卡图 URL 已存在、图片尺寸正常，并且浏览器解码已经完成。

## 同轮自动化

- 组件测试已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
