# 大杀四方已用态 E2E 证据

## 用例

- 移动端：`e2e/smashup-4p-layout-test.e2e.ts`
  - 用例名：`移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会`
- PC：`e2e/smashup-alien-terraform.e2e.ts`
  - 用例名：`合体机器人天赋可移动泰坦并写入本回合持续能力压制标记`

## 运行结果

- `BG_HEAVY_MEMORY_MIN_FREE_GB=1 BG_HEAVY_CPU_HARD_LIMIT=101 BG_HEAVY_CPU_SOFT_LIMIT=100 npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "怪物发动天赋后会移除指示物并提示额外随从机会"`：通过
- `BG_HEAVY_MEMORY_MIN_FREE_GB=1 BG_HEAVY_CPU_HARD_LIMIT=101 BG_HEAVY_CPU_SOFT_LIMIT=100 npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "合体机器人天赋可移动泰坦并写入本回合持续能力压制标记"`：通过
- `npx eslint src/games/smashup/ui/BaseZone.tsx e2e/smashup-4p-layout-test.e2e.ts e2e/smashup-alien-terraform.e2e.ts`：仅现有 warning，无新增 error

## 截图与观察

### 移动端已用态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端有+1力量指示物的怪物发动天赋后会移除指示物并提示额外随从机会\13-monster-with-counter-grants-extra-minion-and-shows-used-state.png`

人工观察：
- 怪物卡底部中间能直接看到深色圆角 badge，里面清楚写着“已用”，不是隐藏在卡外或只存在于 DOM。
- “已用” badge 没有再向下飘出卡框，和卡面底边保持稳定间距。
- 顶部“获得1次额外随从机会”提示仍在，说明发动结果与已用态能同屏确认。

### PC 已用态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-alien-terraform.e2e\合体机器人天赋可移动泰坦并写入本回合持续能力压制标记\mergacon-talent-resolved-with-used-state.png`

人工观察：
- 中间上方的泰坦卡底部中间能直接看到“已用” badge，桌面端不需要先进入额外 armed 态。
- “已用”文字完整落在泰坦卡内部，没有再偏到卡外或被底边裁掉。
- 泰坦仍停留在基地上方区域，主棋盘布局和各基地相对位置正常，没有被这次样式修复挤坏。
