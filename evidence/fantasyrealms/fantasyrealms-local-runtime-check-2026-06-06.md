# FantasyRealms 本地运行时验证（2026-06-06）

- 执行现场：
  - worktree: `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
  - branch: `feat/game-fantasyrealms`
- dev server:
  - frontend: `http://127.0.0.1:4276/`
  - local route: `http://127.0.0.1:4276/play/fantasyrealms/local`
- 启动方式：
  - `VITE_DEV_PORT=4276 npm run dev:lite`
  - 本次运行解析到 `gameServer=18003`

## 验证结果

- `GET /` 返回 `200`
- Playwright 实际打开 `/play/fantasyrealms/local`
- 页面中可见：
  - `牌库`
  - `公开弃牌堆`
  - `手牌`
  - `当前焦点`
- 页面非空白、非 404，FantasyRealms 本地路由已进入真实运行时页面

## 截图

- `evidence/fantasyrealms/fantasyrealms-local-runtime-check-2026-06-06.png`

## 备注

- 页面正文未显示 `幻想国度` 标题文本，这符合当前牌桌式实现方向：首屏以桌面对象为主，不额外堆游戏标题大栏。
