# Fantasy Realms 首页建房入口首轮链路证据（2026-06-13）

## 目标

确认当前不是只靠 API 建房或直接注入凭据，而是能从首页真实完成：

`首页 -> 游戏详情 -> 创建房间 -> 加入 AI -> 确认创建 -> 自动进房 -> 首轮摸弃 -> AI 自动推进 -> 回到 host`

## 截图

1. 创建房间前图
   - `test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合/首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合-ui-create-room-modal-before-confirm.png`
   - 结论：真实产品入口里能看到 `加入 AI` 与 `确认创建`，不是直接跳过建房。

2. 进房开局前图
   - `.../首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合-ui-opening-after-create-room.png`
   - 结论：已自动进入 `/play/fantasyrealms/match/...`，并明确显示 `点此摸 2 张` / `点左上牌库，先摸 2 张`。

3. 摸牌后、弃牌前图
   - `.../首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合-ui-after-draw-before-discard.png`
   - 结论：真实摸牌后已出现可弃手牌，说明首轮没有卡在“只会建房不会打”。

4. 等待 AI 图
   - `.../首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合-ui-waiting-ai-turn.png`
   - 结论：等待态明确显示 `AI 2 号位 / R2 / 1/12`，不是假死页面。

5. AI 结束后回到 host 图
   - `.../首页创建房间并开启-AI-后，host-能真实进入开局并完成首轮摸弃，随后等-AI-回回合-ui-returned-to-host-after-ai.png`
   - 结论：AI 自动推进后已回到 `你的回合 / R3`，说明首页真实建房入口至少能完成到下一回合。

## 当前结论

- 现在已证明：Fantasy Realms 的**首页真实建房入口**不是只会建房，能够自动进房并走完开局首轮。
- 仍未用这同一条首页真实建房链路打到终局排名；若要宣称“整条产品流程从首页到终局都跑通”，还需继续补终局证据。
