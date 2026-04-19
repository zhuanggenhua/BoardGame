# Smash Up 泰坦放大 E2E 证据

## 验证命令

```bash
npm run typecheck
npm run build
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "alien_terraform 第三步可通过牌库右侧泰坦栏选择可视作随从打出的 set-aside 泰坦"
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "克苏鲁泰坦天赋可在分支选择后抽 1 张疯狂卡"
```

## 截图 1: 牌库旁泰坦栏放大

![牌库旁泰坦栏放大](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/alien_terraform-%E7%AC%AC%E4%B8%89%E6%AD%A5%E5%8F%AF%E9%80%9A%E8%BF%87%E7%89%8C%E5%BA%93%E5%8F%B3%E4%BE%A7%E6%B3%B0%E5%9D%A6%E6%A0%8F%E9%80%89%E6%8B%A9%E5%8F%AF%E8%A7%86%E4%BD%9C%E9%9A%8F%E4%BB%8E%E6%89%93%E5%87%BA%E7%9A%84-set-aside-%E6%B3%B0%E5%9D%A6/terraform-titan-rail-magnify.png)

- 放大层中央显示的是 `Big Funny Giant / 滑稽巨人` 的竖版泰坦卡，不是底下任一基地的横版底图。
- 左下角原泰坦栏里的小卡仍停留在牌库旁位置，说明这次点击走的是“查看”入口，不是直接把泰坦打进基地。
- 放大层出现时，左右两张基地仍留在背景两侧，没有被替换成基地放大图。

## 截图 2: 牌库旁泰坦进场后状态

![牌库旁泰坦进场后状态](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/alien_terraform-%E7%AC%AC%E4%B8%89%E6%AD%A5%E5%8F%AF%E9%80%9A%E8%BF%87%E7%89%8C%E5%BA%93%E5%8F%B3%E4%BE%A7%E6%B3%B0%E5%9D%A6%E6%A0%8F%E9%80%89%E6%8B%A9%E5%8F%AF%E8%A7%86%E4%BD%9C%E9%9A%8F%E4%BB%8E%E6%89%93%E5%87%BA%E7%9A%84-set-aside-%E6%B3%B0%E5%9D%A6/terraform-after-titan-from-rail.png)

- `Big Funny Giant` 已经落到最左基地上方，位置是泰坦轨道，不是手牌区或基地大图层。
- 中央手牌里仍保留 `Invader`，说明放大查看没有误消耗手牌流程。
- 基地区没有出现额外的基地放大遮罩，放大关闭后交互回到了正常进场路径。

## 截图 3: 场上泰坦放大

![场上泰坦放大](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/%E5%85%8B%E8%8B%8F%E9%B2%81%E6%B3%B0%E5%9D%A6%E5%A4%A9%E8%B5%8B%E5%8F%AF%E5%9C%A8%E5%88%86%E6%94%AF%E9%80%89%E6%8B%A9%E5%90%8E%E6%8A%BD-1-%E5%BC%A0%E7%96%AF%E7%8B%82%E5%8D%A1/cthulhu-titan-magnify.png)

- 放大层中央显示的是 `Cthulhu / 克苏鲁` 竖版泰坦卡，宽高比明显是纵向卡面，不是基地横版比例。
- 左右背景里仍能看到 `The Homeworld` 和 `The Central Brain` 两张基地卡，说明点击泰坦放大时没有把基地错当成查看目标。
- 右侧行动栏和底部疯狂卡区域仍保持原位，没有被基地放大层整体遮住。

## 截图 4: 场上泰坦天赋交互

![场上泰坦天赋交互](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/%E5%85%8B%E8%8B%8F%E9%B2%81%E6%B3%B0%E5%9D%A6%E5%A4%A9%E8%B5%8B%E5%8F%AF%E5%9C%A8%E5%88%86%E6%94%AF%E9%80%89%E6%8B%A9%E5%90%8E%E6%8A%BD-1-%E5%BC%A0%E7%96%AF%E7%8B%82%E5%8D%A1/cthulhu-titan-talent-draw-choice.png)

- 放大关闭后，界面正常进入“克苏鲁：选择要执行的天赋效果”交互，没有卡在查看层。
- 场上的克苏鲁泰坦仍留在左侧基地上方，说明查看动作没有把泰坦位置或选中态搞乱。
- 中央出现两个天赋分支按钮，证明主点击仍然是发动能力，不会因为新增放大入口而吞掉原交互。

## 截图 5: 场上泰坦天赋结算后状态

![场上泰坦天赋结算后状态](../test-results/evidence-screenshots/smashup-alien-terraform.e2e/%E5%85%8B%E8%8B%8F%E9%B2%81%E6%B3%B0%E5%9D%A6%E5%A4%A9%E8%B5%8B%E5%8F%AF%E5%9C%A8%E5%88%86%E6%94%AF%E9%80%89%E6%8B%A9%E5%90%8E%E6%8A%BD-1-%E5%BC%A0%E7%96%AF%E7%8B%82%E5%8D%A1/cthulhu-titan-talent-draw-resolved.png)

- 左侧牌库旁的疯狂牌余量从 `x2` 变成 `x1`，底部手牌区新增两张疯狂卡，符合“抽 1 张疯狂卡”路径的最终结果。
- 克苏鲁泰坦右上角出现 `+1` 指示物，说明天赋执行后的泰坦状态写回正常。
- 结算后没有残留泰坦放大层，也没有误弹出基地放大层。
