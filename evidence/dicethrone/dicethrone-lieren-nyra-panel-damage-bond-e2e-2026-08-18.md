# DiceThrone 女猎手妮拉状态与伤害响应 E2E 证据

日期：2026-08-18

## 本轮要求

- 妮拉状态放在左侧自己的玩家 HUD 内部左上空白，不放到中间女猎手角色板上。
- 妮拉状态不得挤压或遮挡 buff / 状态图标、生命 / CP、牌堆和回合顺序。
- 妮拉承伤与羁绊分配必须能看清、能真实点击。
- 重新产出全流程截图，并用 PureRef 打开最终有序图组。

## 实现与断言

- 妮拉状态小面板挂到 `LeftSidebar` 的左侧玩家 HUD 内部空白位；`CenterBoard` 不再承载妮拉面板。
- 左侧小面板只承载妮拉头像、生命、妮拉之系和当前伤害提示；承伤 / 羁绊分配操作改由页面顶层的顶部响应坞承接，避免把完整操作区塞进左侧 HUD 后继续挤压 buff。
- 响应坞通过 portal 挂到页面顶层，避免被左侧 HUD 的生命 / CP 条盖住；生命 / CP 条的文字覆盖层不再接收鼠标事件。
- E2E 布局断言覆盖：妮拉在左侧 HUD 内、原中间角色板无妮拉残留、状态图标区无妮拉残留、妮拉不与状态图标、生命 / CP、牌堆、回合顺序重叠。
- E2E 可用性断言覆盖：转移伤害按钮、确认分配按钮、羁绊滑杆均有可点击 / 可拖动矩形，按钮尺寸和字号达到可读可点下限。

## 关键截图观察

- `02-牌桌-妮拉在左侧玩家面板左上空白.jpg`：妮拉状态在左侧自己的玩家 HUD 左上空白位，中间女猎手角色板上没有妮拉残留；流血、妮拉之系、生命 / CP、牌堆和回合顺序都保持独立可读。
- `03-伤害响应-妮拉留在左侧且顶部响应坞可操作.jpg`：4 点伤害响应打开后，妮拉状态仍留在左侧 HUD；顶部响应坞显示“转移伤害”、羁绊分配滑杆和“确认分配”，按钮可读且可点击。
- `04-转移伤害后-妮拉直接承伤收口.jpg`：点击“转移伤害”后响应坞退场，妮拉生命显示 `1/7`，证明直接承伤链路完成。
- `05-确认羁绊分配后-妮拉承伤收口.jpg`：重新进入伤害响应并点击“确认分配”后响应坞退场，妮拉生命显示 `1/7`，妮拉之系显示 `0/1`，证明羁绊分配链路完成。

## 验证命令

- `npx tsc --noEmit --pretty false --incremental false 2>&1 | Select-String -Pattern "NyraCompanionPanel|LeftSidebar|PlayerStats|lieren-intake|Board.tsx|CenterBoard"`
  - 结果：无相关 TypeScript 错误输出。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/viewMode.test.ts src/games/dicethrone/ui/__tests__/compatSource.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --reporter=dot`
  - 结果：2 个测试文件通过，18 个用例通过。
- `npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`
  - 结果：1 个真实在线双玩家 E2E 通过。

## 图面裁决

verdict: PASS

- 妮拉位置：PASS，状态面板在左侧自己的玩家 HUD 内部左上空白，不在中间角色板。
- 保护槽位：PASS，buff / 状态图标、生命 / CP、牌堆和回合顺序未被遮挡或挤压。
- 直接承伤：PASS，响应坞可读可点，点击后妮拉生命扣到 `1/7` 并收口。
- 羁绊分配：PASS，滑杆与确认入口可用，确认后妮拉生命扣到 `1/7` 且妮拉之系归零。
