# DiceThrone 手牌点击放大 E2E 证据

## 范围

- 目标：验证 DiceThrone 手牌从“点击直接打出”改为“点击放大，拖拽才打出”。
- 代码范围：
  - `src/games/dicethrone/ui/HandArea.tsx`
  - `e2e/dicethrone/dicethrone-play-card-validation.e2e.ts`

## 实际观察

### 截图 1

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\playwright-artifacts\dicethrone-dicethrone-play-ddd65--打牌验证-点击手牌应只打开放大层，拖拽上抛才真正打出-chromium\test-failed-1.png`
- 我实际看到：
  - 点击 `card-buddha-light` 后，中央出现了该卡的大图预览。
  - 预览层上方可见“关闭预览”按钮，说明点击路径进入的是放大层，而不是直接打牌结算。
  - 背后手牌区域仍能看到原卡位置，说明点击本身没有把手牌立即从手牌区移除。
- 结论：
  - “点击打开卡牌放大”这一步有直接视觉证据。
  - 这张图还**不能**证明“拖拽上抛成功打出”，因为失败时停在放大层阶段。

## 阻塞

- 官方 `test:e2e:ci:file` 路径被其他 worktree 占用的 single-worker 端口阻塞，未能进入正式用例执行。
- 改为附着本地开发环境后，能看到“点击放大”的真实画面，但整条“关闭放大层 -> 拖拽上抛 -> 手牌移除”的自动化链路仍受当前本机环境不稳定影响，未拿到完整通过证据。

## 当前判定

- 部分达标：
  - 已看到“点击后是放大，不是直接打出”。
- 未完全达标：
  - 还缺“拖拽上抛成功打出”的最终 E2E 通过截图与完整通过记录。
