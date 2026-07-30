# 山屋惊魂木乃伊强制关键预兆真实探索 E2E

## 结论

- `e2e/betrayal/mummy-rampage-forced-omen-draw.e2e.ts` 已通过，2 passed。
- 英雄作祟后探索预兆房时，真实页面强制从预兆堆找出「书本」，并显示木乃伊横行的强制找牌提示。
- 叛徒作祟后探索预兆房时，真实页面强制从预兆堆找出「圣符」，并显示圣符或指环的强制找牌提示。
- 本证据只证明强制关键预兆的真实探索翻牌入口和截图链，不证明牌堆顺序更深组合、作祟确认队列更多组合、女孩版本冲突或整局自然链完成。

## 执行命令

```powershell
npx eslint e2e\betrayal\mummy-rampage-forced-omen-draw.e2e.ts
npx eslint e2e\betrayal\mummy-rampage-forced-omen-draw.e2e.ts src\games\betrayal\game.ts
npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "强制找出关键预兆" --configLoader native
npx cross-env CODEX_MANAGED_BY_NPM=1 NODE_OPTIONS=--max-old-space-size=8192 PW_USE_DEV_SERVERS=false PW_ALLOW_DEV_SERVER_TESTS=false npm run test:e2e:file -- e2e/betrayal/mummy-rampage-forced-omen-draw.e2e.ts
```

## 截图

| 截图 | 含义 |
| --- | --- |
| `01-英雄探索预兆前.jpg` | 英雄位于可探索门口，预兆堆中仍有「书本」。 |
| `02-英雄强制找到书本.jpg` | 探索翻出预兆后，发现面板显示「书本」和“英雄首次需要预兆时，从预兆堆找出书本并洗牌”。 |
| `03-叛徒探索预兆前.jpg` | 叛徒位于可探索门口，预兆堆中仍有「圣符 / 指环」。 |
| `04-叛徒强制找到婚礼预兆.jpg` | 探索翻出预兆后，发现面板显示「圣符」和“叛徒首次需要预兆时，从预兆堆找出圣符或指环并洗牌”。 |

## 图面核验

- `02-英雄强制找到书本.jpg`：画面为真实牌桌，翻到一层预兆房「标本室」，发现面板标题为「书本」，结算步骤显示已加入持有区：书本。
- `04-叛徒强制找到婚礼预兆.jpg`：画面为真实牌桌，翻到一层预兆房「标本室」，发现面板标题为「圣符」，结算步骤显示已加入持有区：圣符。
