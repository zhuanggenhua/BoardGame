# 大杀四方泰坦居中修复 E2E 证据

## 结论

已修复泰坦在基地上方看起来未居中的问题。根因不是泰坦卡本身的宽度计算，而是泰坦 rail 以更外层的 `BaseZone` 容器为定位参考；该容器同时包住了下方整排玩家列，导致其水平中心不等于基地卡中心。修复后，泰坦 rail 改为在仅按基地卡宽度计算的相对容器内定位，并显式使用内联 `transform: translateX(-50%)` 保证运行态平移生效。

## 验证命令

```bash
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "泰坦与持续行动布局在二人局和四人局下都应稳定"
```

## 截图证据

### 1. 二人局：5 张持续行动 + 1 张泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\01-2p-five-ongoings-with-titan.png`

人工观察：
- 泰坦卡位于左侧基地正上方，左右边距接近对称，没有再向整行布局中心偏移。
- 左右持续行动仍然围绕泰坦分布，没有因为居中修复而挤到一侧。
- 泰坦与基地之间的垂直关系保持稳定，视觉上仍是“基地上方一条独立 rail”。

### 2. 四人局：5 个基地 + 1 张泰坦

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-alien-terraform.e2e\泰坦与持续行动布局在二人局和四人局下都应稳定\03-4p-five-bases-with-titan.png`

人工观察：
- 左一基地上方的泰坦仍然对准该基地本体，没有被四人局整排槽位的总宽度拖向右侧。
- 其余基地的水平排布没有被这次修复破坏，基地间距与分数标记位置保持正常。
- 四人局下泰坦与左侧基地的视觉主从关系清晰，第一眼不会再误判成“泰坦悬在两张基地之间”。

## 自动断言

在 `e2e/smashup-alien-terraform.e2e.ts` 中新增 `expectTitanCenteredOnBase`，直接比较基地容器与泰坦实际卡面容器的水平中心点，当前容差为 `6px`。该断言已覆盖二人局与四人局各一组真实场景。
