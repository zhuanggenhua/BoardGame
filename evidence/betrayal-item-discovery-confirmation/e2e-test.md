# 山屋惊魂：器械库物品发现两步确认真实页面证据

## 目标

- 验证探索到器械库时，玩家先确认新房间朝向，再进入发现结果确认。
- 验证器械库房间文字结算会按真实待确认步骤展示 2 张牌面：房间获得砍刀、展示后埋葬急救包。
- 验证确认完毕后回到牌桌，砍刀和急救包均保留在当前探索者持有区。

## 命令

- `npx eslint e2e\betrayal\high-risk-possession-representative.e2e.ts`
- `node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\high-risk-possession-representative.e2e.ts "器械库代表房间发现抽牌"`

## 结果

- ESLint：0 errors。
- E2E：1 passed。

## 截图

- `01-器械库-确认房间朝向.jpg`
- `02-器械库-发现确认1-房间获得武器.jpg`
- `03-器械库-发现确认2-展示后掩埋.jpg`
- `04-器械库-确认完毕回牌桌持有区.jpg`

## 边界

- 该证据只证明当前器械库房间文字结算的真实页面两步确认。
- 该证据不代表全部房间 / 符号组合、全部物品牌、全部预兆牌、未来新增卡牌或完整通用发现结算队列已经完成。
