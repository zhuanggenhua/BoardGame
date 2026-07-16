# DiceThrone 枪手状态 token 图集 E2E 记录

## 当前对话范围

- 原始症状：手机端老派系 token 加载不出来，网页端也有问题，枪手状态 token 不显示。
- 本轮对象：枪手的装填、赏金，以及复用僧侣图集的闪避、击倒。
- 真相源：当前工作树 `D:\gongzuo\webgame\BoardGame`、真实 DiceThrone 在线房间、当前 E2E 重新生成的网页端与手机横屏截图。
- 资源口径：状态图集不通过 `dist` 补图；正式图片继续走服务器素材主源、移动游戏包或自定义素材包候选链。

## 根因结论

- 这次复现到的直接失败不是服务器没图：枪手与僧侣状态图集 WebP 在服务器素材主源返回 `200 image/webp`。
- 真实失败点在前端状态图集候选链：普通 `/assets/.../status-icons-atlas.webp` 在当前场景可能返回首页 HTML，组件仍会继续落到这个错源，最终把状态位推进成没有 `<img>` 的空态。
- 因为旧状态图集使用图集裁片，状态区表面还会留下 `1/3`、`1/2` 这类数字角标，导致图标主体消失但角标还在。

## 修复口径

- 状态图集图片候选按来源区分：移动包 / 自定义包优先，服务器素材主源其次。
- 当服务器素材主源存在时，普通 `/assets` 不再参与状态图集图片回退，避免 HTML 错源覆盖真实图集。
- 状态图集 JSON 仍允许从本地配置读取；图片运行时来源则保持服务器主源 / 移动包链路，不把压缩 WebP 塞回 `dist`。
- 状态图集裁片继续使用真实 `<img>` 加 `overflow:hidden` 裁剪，保持装填、赏金、闪避、击倒由图集素材本体承载。

## 实际运行

- `npx vitest run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx --reporter=dot`
  - 结果：`28 passed`。
- `npm run test:e2e:file -- e2e/dicethrone/dicethrone-gunslinger-status-icons.e2e.ts`
  - 结果：`2 passed`。
  - 覆盖：网页端真实在线房间、手机横屏真实在线房间。
  - 测试故意把本地 `/assets/.../status-icons-atlas.(json|webp)` 拦成 `200 text/html`，验证状态图标必须回退服务器素材主源并显示。

## 肉眼核图

### 网页端整屏

- 原始整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\DiceThrone-枪手状态token图集\01-网页端-枪手状态token图集回退后.png`
- 尺寸：`1280x720`。
- 左侧玩家状态区能看到击倒、闪避、装填、赏金四个图标，状态主体不再空白。
- 装填与闪避旁的 `1/2`、`1/3` 是数量角标，角标没有遮掉图标主体。
- 右侧状态说明面板也显示闪避、装填弹药、击倒、赏金对应图标，证明不是只修了左侧局部区域。

### 手机横屏整屏

- 原始整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\DiceThrone-枪手状态token图集\03-手机端-枪手状态token玩家状态区.png`
- 尺寸：`2402x1082`。
- 左侧玩家状态区四个图标均可见：击倒、闪避、装填、赏金没有退化成空圆或只剩数字。
- 手机横屏下图标与血量、CP、手牌区没有互相遮挡；状态区仍在玩家面板附近，能直接辨认。
- 右侧状态说明面板同步显示闪避、装填弹药、击倒、赏金的图标，移动视口下没有丢图。

### 局部辅助图

- 网页端局部：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\DiceThrone-枪手状态token图集\02-网页端-枪手状态token局部.png`
- 手机端局部：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\DiceThrone-枪手状态token图集\04-手机端-枪手状态token局部.png`
- 两张局部图只作为放大辅助，不替代整屏主证据。

## 结论

- 当前网页端与手机横屏 E2E 都已经回到原始问题位点验证：枪手状态 token 图标在本地图集错源时仍能显示。
- 当前结论只证明本地真实在线房间链路和移动视口链路；没有执行 Android 真机安装包覆盖或线上部署。
- 资源修复方向不是“把压缩 WebP 加回 dist”，而是修正状态图集运行时候选链，避免普通 `/assets` HTML 错源盖掉服务器素材主源。
