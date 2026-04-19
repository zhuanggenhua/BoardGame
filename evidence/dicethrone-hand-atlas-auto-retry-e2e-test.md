# DiceThrone 手牌 Atlas 稳定性 E2E 验证

## 背景

用户反馈：Dice Throne 偶尔出现“部分卡牌不显示”，而且用户已明确补充——**是同一个图集里的部分卡偶发不显示，图集图片本身已经加载成功**。  
因此本轮要同时覆盖两类风险：

1. atlas 首轮请求失败后，不能永久卡在 shimmer / 空白态
2. atlas 已经加载成功时，手牌 3D 翻面层也不能把同图集里的部分卡牌“吃掉”

## 本轮修复点

- 修复 `src/components/common/media/CardPreview.tsx` 中 `AtlasCard` 的 atlas 候选加载链路：
  - 首轮候选全部失败/超时后，自动按指数退避重试，而不是永久停留在 `.atlas-shimmer`
  - 某个候选即使在超时后才晚到，也仍然允许收敛为成功态，不再被直接丢弃
- 修复 `src/games/dicethrone/ui/HandArea.tsx` 的手牌翻面层：
  - 前后卡面显式拆成独立 face wrapper
  - 为 3D 翻面链路补上 `WebkitTransformStyle / WebkitBackfaceVisibility`
  - 前后面增加轻微 `translateZ(0.1px)`，避免同平面合成时部分卡面被 WebView/浏览器偶发吞掉
- 补充单测：`src/components/common/media/__tests__/CardPreview.i18n.test.tsx`
- 补充真实浏览器 E2E：`e2e/dicethrone-watch-out-spotlight.e2e.ts`

## 执行命令

### ESLint
```powershell
npx eslint src/components/common/media/CardPreview.tsx src/components/common/media/__tests__/CardPreview.i18n.test.tsx e2e/dicethrone-watch-out-spotlight.e2e.ts
```

### 单测
```powershell
node scripts/infra/vitest-cli-safe.mjs run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native --maxWorkers 1
```

### E2E
```powershell
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai and gunslinger hand area should show corrected hand card images"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "gunslinger hand area should recover after first atlas load failure without manual refresh"
```

## 结果

- ESLint：通过（0 error，文件内历史 warning 未新增）
- Vitest：通过（`10 passed`）
- Playwright：
  - `samurai and gunslinger hand area should show corrected hand card images` → `1 passed`
  - `gunslinger hand area should recover after first atlas load failure without manual refresh` → `1 passed`

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\samurai-and-gunslinger-hand-area-should-show-corrected-hand-card-images\10-samurai-hand-area.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\samurai-and-gunslinger-hand-area-should-show-corrected-hand-card-images\11-gunslinger-hand-area.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\samurai-and-gunslinger-hand-area-should-show-corrected-hand-card-images\12-monk-hand-area-reference.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\gunslinger-hand-area-should-recover-after-first-atlas-load-failure-without-manual-refresh\13-gunslinger-hand-area-auto-retry-after-fail.png`

## 肉眼观察结论

### 1. 同图集部分卡实例稳定性
- `10-samurai-hand-area.png`：武士手牌区 3 张牌都已翻到正面，没有残留卡背，也没有局部空白卡面。
- `11-gunslinger-hand-area.png`：枪手手牌区 6 张牌全部显示完成，没有“同一图集只丢几张”的局部缺失。
- `12-monk-hand-area-reference.png`：僧侣同样能稳定显示完整手牌，可作为非枪手/非武士的对照参考。
- 对应 E2E 还额外校验了每张手牌 `front face` 内都能找到包含 `ability-cards.webp` 的真实背景图，而不是只靠“没有 shimmer”来收口。

### 2. atlas 首轮失败后的自动恢复
- `13-gunslinger-hand-area-auto-retry-after-fail.png`：在首个枪手 atlas 请求被故意打断一次后，枪手 6 张手牌最终仍全部恢复显示。
- 画面最终没有残留 `.atlas-shimmer` 占位，说明 atlas 自动重试后已经收敛完成。

### 3. 是否达到验收标准
- 达到本轮验收标准：
  - atlas 已加载时，不会再出现“同一图集里只有部分手牌空掉”的表现
  - atlas 首轮失败时，不需要手动刷新也能自行恢复
- 这两条合在一起，才真正对应用户说的 App 痛点：既不能把问题简单归因为“图没下到”，也不能让用户靠刷新网页碰运气。

## 结论

本轮已经把 Dice Throne 这条手牌显示链路补成“两层兜底”：

- **资源层**：首轮 atlas 请求失败后自动重试，不再永久空白
- **显示层**：即使 atlas 已成功加载，手牌 3D 翻面层也不会再把同图集里的部分卡面偶发吞掉

对用户体验的直接改善是：

- PC：不再主要依赖“刷新一下也许会好”
- App：没有可靠刷新入口时，仍能更稳定地把整手卡完整显示出来
