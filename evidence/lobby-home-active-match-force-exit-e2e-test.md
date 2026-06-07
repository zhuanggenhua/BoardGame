# 首页活跃房间销毁失败后的强制清理 E2E 证据

## 范围

- 首页活跃房间条的房主销毁链路。
- 目标：当销毁请求返回网络/服务异常时，首页必须提供强制清理入口，并且清理后本地活跃房间记录要被移除。

## 用例

- `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "首页活跃房间房主销毁遇到 500 时提供强制清理并清空本地记录"`

## 截图与结论

### 销毁失败后弹出强制清理

- 截图：
  [lobby-home-active-match-destroy-network-force-exit-modal.png](<D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/lobby.e2e/首页活跃房间房主销毁遇到-500-时提供强制清理并清空本地记录/lobby-home-active-match-destroy-network-force-exit-modal.png>)
- 肉眼观察：
  - 页面右上角已经出现“销毁房间失败：网络或服务异常，请稍后重试。”，说明销毁请求确实失败了，不是摆拍。
  - 中央弹窗标题是“无法销毁房间”，正文说明可以“强制清理本地记录并返回大厅”，和目标一致。
  - 弹窗按钮包含“强制清理”，证明首页已经补上了和对局内一致的兜底入口。
- 验收结论：
  - 达标。销毁失败后，首页给出了明确的强制清理动作。

### 强制清理后本地记录被清空

- 截图：
  [lobby-home-active-match-destroy-network-force-exit-cleared.png](<D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/lobby.e2e/首页活跃房间房主销毁遇到-500-时提供强制清理并清空本地记录/lobby-home-active-match-destroy-network-force-exit-cleared.png>)
- 肉眼观察：
  - 强制清理后，首页底部的“当前进行中”活跃房间条已经消失。
  - 右上角仍保留“销毁房间失败”toast，但下方又出现“已清理本地记录，可重新创建或加入房间。”，说明清理动作确实落到了本地状态。
  - 页面回到普通首页状态，没有残留的活跃房间操作条。
- 验收结论：
  - 达标。强制清理后，本地活跃房间记录已经清掉。

## 备注

- 这次强制清理只处理本地记录，不会假装服务端房间已销毁。
