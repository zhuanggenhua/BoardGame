# SmashUp 手牌图集白卡修复 E2E 证据

## 范围

- 大杀四方手牌区通过 `CardPreview -> SmashUpCardRenderer -> AtlasCard` 渲染的卡牌图集。
- 覆盖用户反馈的“手牌纯白/灰白，放大预览正常，但必须刷新才恢复”风险点。
- 本轮重点不是验证资源文件存在，而是验证首次进入真实对局场景后，手牌节点能恢复 atlas `background-image` 并显示正确裁切。

## 执行命令

```powershell
node scripts/infra/run-e2e-command.mjs ci e2e/smashup-alien-card-images.e2e.ts --grep "renders the expected atlas slices for key alien actions" --timeout=90000
```

## 结果

- 执行时间：2026-05-08 21:28 +08
- 结果：`1 passed`
- 运行模式：托管 isolated runtime，端口 `6273/20100/21100`

## 截图证据

- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-alien-card-images.e2e\renders-the-expected-atlas-slices-for-key-alien-actions\alien-card-images-hand.png`
- 肉眼观察：
  - 手牌区三张 Alien 行动牌 `Probe / Terraforming / Crop Circles` 均显示真实卡面，不是纯白/灰白占位。
  - 三张卡位于底部手牌区域，卡图主体、标题和底部文本区域可见，说明问题位点不是只在放大预览里正常。
  - 场上基地卡也显示真实图集裁切，未看到整屏白卡、空卡槽或只剩边框的异常。
- 验收结论：
  - 本截图能直接看到用户反馈的问题位点“手牌卡面本体”。
  - 本轮 E2E 同时断言了 `background-image` 包含 `cards1`，并核对 `background-position/background-size` 与 Alien 卡定义一致。
  - 达到本轮“首次进入手牌场景不应卡死为白卡”的验收标准。

## 仍需注意

- 这次验证覆盖的是本地 E2E 真实页面链路；线上 R2/CDN 是否命中还取决于部署后的资源基址、R2 对应对象和响应缓存头。
- 如果线上仍出现必须刷新才恢复，应优先抓运行时实际请求 URL、HTTP 状态、`background-image` 是否为空，以及 `AssetLoader` 内存缓存是否在重启后由真实加载重新填充。
