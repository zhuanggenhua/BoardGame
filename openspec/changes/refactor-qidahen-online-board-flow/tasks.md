## 1. Implementation
- [x] 1.1 为《七大恨》补齐 `playerView` 与正式棋盘视角归属，联机手牌只显示当前座位私有信息。
- [x] 1.2 把《七大恨》局内“剧本介绍 + 投票”壳层接入 online runtime，并在投票结算后再进入待决人物/军备前置。
- [x] 1.3 重构《七大恨》行动壳，改成“一级行动先选中，二级步骤再显示”，并限制非当前步骤的地图点击。
- [x] 1.4 从建房表单移除《七大恨》剧本本体与剧本细项预选入口，只保留局内投票模式标记与 match 内 setup 承接。

## 2. Verification
- [x] 2.1 补/改《七大恨》相关单测与 compatSource，覆盖局内剧本投票、setup 壳、playerView 与行动壳。
- [x] 2.2 跑《七大恨》在线房间局内剧本投票到首回合前置完成的 E2E，并输出关键截图与 evidence 文档。
- [x] 2.3 更新 `.codex/skill/create-new-game/SKILL.md` 与 `docs/ai-rules/ui-ux.md`，把“局内剧本介绍与投票、联机 seat/viewer 视角、一级/二级行动壳、同类交互复用 E2E”写成硬门禁。
