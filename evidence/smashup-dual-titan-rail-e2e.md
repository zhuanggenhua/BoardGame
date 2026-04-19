# 大杀四方局内双泰坦栏 E2E 验证

## 结论

本轮只处理并验证局内牌库旁的 `set-aside` 泰坦栏，不涉及派系详情弹层：

- 当同一玩家有两张 `set-aside` 泰坦时，局内泰坦栏改为纵向单列显示
- 双泰坦显示位置仍在牌库旁，不侵入详情区
- 横屏移动端下双泰坦仍保持可见，没有把牌库或弃牌堆挤坏
- 既有单泰坦 rail 交互仍可正常通过泰坦栏进场

## 验证命令

```powershell
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "同一玩家有两张 set-aside 泰坦时，牌库右侧泰坦栏应纵向单列显示并兼容横屏移动端"
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "alien_terraform 第三步可通过牌库右侧泰坦栏选择可视作随从打出的 set-aside 泰坦"
```

结果：两条用例均 `1 passed`

## 截图证据

双泰坦横屏移动端局内截图：

![双泰坦局内纵向单列](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/同一玩家有两张-set-aside-泰坦时，牌库右侧泰坦栏应纵向单列显示并兼容横屏移动端/dual-setaside-titans-mobile-rail.png)

单泰坦 rail 交互中间态：

![单泰坦 rail 提示态](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/alien_terraform-第三步可通过牌库右侧泰坦栏选择可视作随从打出的-set-aside-泰坦/terraform-titan-rail-prompt.png)

单泰坦 rail 进场后状态：

![单泰坦 rail 进场后](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/alien_terraform-第三步可通过牌库右侧泰坦栏选择可视作随从打出的-set-aside-泰坦/terraform-after-titan-from-rail.png)

## 实看结论

- `dual-setaside-titans-mobile-rail.png`：牌库左侧旁边能直接看到两张泰坦上下堆叠，`cthulhu_cthulhu_titan` 在上，`pirates_the_kraken` 在下，已经不是横向并排。
- `dual-setaside-titans-mobile-rail.png`：双泰坦栏仍贴着左下角牌库区域，右侧弃牌堆保持在原位，没有因为改成双泰坦而被顶开或覆盖。
- `dual-setaside-titans-mobile-rail.png`：横屏移动端视口下两张泰坦都完整露出，底部 `TITAN` 标签仍可见，说明这次改动不是只在桌面宽度下成立。
- `terraform-titan-rail-prompt.png`：单泰坦场景下，牌库旁仍只有一张泰坦卡，交互提示和基地选择链路都还在，说明这次没有把原有 rail 入口改坏。
- `terraform-after-titan-from-rail.png`：通过 rail 选择后，泰坦已经落到左侧基地上方，底部泰坦栏从局内消失，符合原有“从 set-aside 进场后不再留在牌库旁”的行为。
- 本文档只覆盖“局内两个已选派系都带泰坦时，牌库旁 set-aside 泰坦栏如何显示”；不包含派系详情里的泰坦展示，也不讨论多个在场泰坦的规则问题。
