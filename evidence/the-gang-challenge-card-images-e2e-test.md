# 纸牌帮挑战牌、两副手牌与调换流程 E2E 证据

## 验证目标

- 证明纸牌帮局内“房主规则设置”弹窗里的挑战牌不是空白、不是文字壳，也不是只存在资源地址。
- 证明 PC 与移动横屏规则设置面板同源对齐，移动端能肉眼看到挑战牌牌面，关闭叉号真实热区不小于 44×44。
- 证明两副手牌时，上手和下手分别显示各自牌型提示。
- 证明手牌调换不是强制执行：可以不调换，也可以选择上下各一张牌调换；两条路径都必须先等待其他玩家，全员确认后才进入下一阶段。
- 证明公网服务器素材链路不是只停在“本地有文件”：两张新增挑战牌 WebP 与纸牌帮 manifest 均已从 `assets.easyboardgame.top` 服务器直连回查。

## 执行命令

```powershell
npx eslint src/games/the-gang/Board.tsx src/games/the-gang/__tests__/Board.runtime.test.tsx e2e/the-gang/the-gang-runtime.e2e.ts
npx vitest run src/games/the-gang/__tests__/Board.runtime.test.tsx
node scripts/infra/run-e2e-single.mjs default e2e/the-gang/the-gang-runtime.e2e.ts "PC 与移动横屏规则设置面板同源布局且关闭按钮满足触控尺寸"
node scripts/infra/run-e2e-single.mjs default e2e/the-gang/the-gang-runtime.e2e.ts "桌面端两副手牌投票后进入手牌调换阶段并可交换上下手牌"
node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/the-gang
```

## 结果

- ESLint：通过。
- Vitest：`src/games/the-gang/__tests__/Board.runtime.test.tsx` 14 条测试通过。
- Playwright：2 条目标 E2E 均通过。
- 入口：当前工作区真实 E2E game route，`/play/the-gang`。
- 素材服务器：纸牌帮运行时素材发布 132 个对象，纸牌帮两份 manifest 发布成功并通过服务器 SHA 回查。

## 截图证据

- PC 规则面板：`test-results/evidence-screenshots/the-gang/rules-modal-layout-current/01-PC规则设置面板挑战牌区与关闭按钮.jpg`
- 移动横屏规则面板：`test-results/evidence-screenshots/the-gang/rules-modal-layout-current/02-移动横屏规则设置面板挑战牌区与关闭按钮.jpg`
- 规则面板 DOM 几何：`test-results/evidence-screenshots/the-gang/rules-modal-layout-current/rules-modal-layout.metrics.json`
- 不调换后等待其他玩家确认：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/01-不调换后等待其他玩家确认.jpg`
- 不调换全员确认后进入黄筹码：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/02-不调换全员确认后进入黄筹码.jpg`
- 选择上下各一张牌准备调换：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/the-gang-hand-swap-stage.png`
- 已选择调换后等待其他玩家确认：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/04-已选择调换后等待其他玩家确认.jpg`
- 调换全员确认后进入橙筹码：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/05-调换全员确认后进入橙筹码.jpg`
- 手牌调换 DOM 几何：`test-results/evidence-screenshots/the-gang/twohand-hand-swap-current/the-gang-hand-swap-stage.metrics.json`

## 图面观察

- 移动横屏规则面板截图里能直接看到“快速通道”“声音传感器”“运动探测器”三张挑战牌，牌面包含图案、编号和中文规则文本，不是黑块、空白框或加载占位。
- PC 规则面板截图里挑战牌区域为 4 列，移动横屏为 3 列；二者同源布局，移动端没有横向溢出。
- 关闭叉号视觉保持小图标，但真实按钮热区 PC 与移动横屏均为 44×44。
- 手牌调换选择图里能看到上手两张、下手两张，并分别显示“上手：高牌”“下手：两对”；上下两副手牌的牌型提示不是共用一个。
- 不调换路径截图显示本地已确认调换并处于“等待调换”，全员确认后进入黄筹码。
- 选择调换路径截图显示上下各选一张后确认调换，随后等待其他玩家；全员确认后进入橙筹码。

## 断言覆盖

- 规则面板 E2E 等待挑战牌图片 `<img>` 加载完成，要求移动横屏当前视口内至少 3 张已加载挑战牌图。
- DOM 几何记录：移动横屏挑战牌区可见图片数为 3，列数为 3，内容横向溢出为 false。
- DOM 几何记录：PC 关闭按钮 44×44，移动横屏关闭按钮 44×44。
- 手牌调换 E2E 断言：上手图片数 2，下手图片数 2，对手手牌图片数 0，公共牌 3 张，玩家当前筹码 5 个。
- 手牌调换 E2E 断言：筹码堆、公共牌、手牌区和行动按钮互不遮挡。
- 手牌调换状态断言：本地确认后 `pendingKind` 仍为手牌调换，批准列表只有本地玩家；全员确认后才进入下一轮筹码选择。

## 公开资源回查

- `快速通道`：公网 WebP 返回 `200`，来源头 `X-Asset-Source: server`，长度 `105542`。
- `声音传感器`：公网 WebP 返回 `200`，来源头 `X-Asset-Source: server`，长度 `95942`。
- 纸牌帮主 manifest：公网返回 `200`，来源头 `X-Asset-Source: server`，并收录 `rule-assets/challenges/compressed/quick-access` 与 `rule-assets/challenges/compressed/noise-sensor`。
- 纸牌帮 rule-assets manifest：公网返回 `200`，来源头 `X-Asset-Source: server`，并收录 `challenges/compressed/quick-access` 与 `challenges/compressed/noise-sensor`。
- `quick-access` manifest SHA-256：`530c5f2c58281ab234b72e7a7e6cd13a48217f5e080c8ae0c46492d1bdde3f28`。
- `noise-sensor` manifest SHA-256：`bc7704a3b5ef3ee8952f4e77aba4d46d6b2adbd3da72faac3b7a6c9d7e3c8690`。
- 纸牌帮当前不是 Android `package-managed` 游戏；`upload-to-server --android-package-publish-plan` 对这两张牌返回“刷新命令：无”。因此这次手机端缺图的正式收口点是公网服务器素材与纸牌帮 manifest，不是 Android 离线游戏包。

## 结论

- 当前真实浏览器 E2E 已证明：PC 与移动横屏规则设置面板都能显示挑战牌真实牌图，移动端不是空白。
- 当前真实浏览器 E2E 已证明：两副手牌时上下手各自显示牌型提示，并且手牌调换支持“不调换”和“选择调换”两条路径。
- 当前公网服务器回查已证明：新增两张挑战牌图片和纸牌帮 manifest 已进入服务器主源。
- 这不是用户操作问题；之前的问题是发布链路没有闭合到“公网图片 + 纸牌帮 manifest + 真实截图”三者同时成立。
