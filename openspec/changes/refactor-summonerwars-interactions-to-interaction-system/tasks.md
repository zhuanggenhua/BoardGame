# Tasks

## 1. Spec & Design
- [x] 明确迁移范围与交互映射（见 design.md）
- [x] 补齐 summonerwars-core 规范差异（spec delta）
- [x] Phase B（其余本地 UI mode 全量迁移）本轮暂缓，按用户要求不做

## 2. Domain/Interaction
- [x] 为 SUMMON_FROM_DISCARD_REQUESTED / GRAB_FOLLOW_REQUESTED / SOUL_TRANSFER_REQUESTED / MIND_CAPTURE_REQUESTED / ice_shards_damage / feed_beast_check 建立 InteractionSystem 交互
- [x] 交互数据仅对 owner 可见，且提供 cancel/skip/默认收口
- [x] 确保无选项时不创建交互（改为自动跳过/安全收口）

## 3. UI Migration
- [x] useGameEvents 不再直接 set 本地 mode；改为从 InteractionSystem 派生 UI
- [x] useCellInteraction / StatusBanners 适配新的交互描述（本轮交互不涉及 useEventCardModes）
- [x] 统一 busy 判定：以 sys.interaction 为真相

## 4. AI & Watchdog
- [x] AI legal actions 覆盖新增交互描述（含 cancel/skip/confirm 分支）
- [x] 验证 human responder 不被 watchdog 误伤

## 5. Tests & Evidence
- [x] 在现有 SummonerWars 测试文件中更新/补充用例（不新增测试文件）
- [x] 更新 evidence：SummonerWars AI 交互审计与全链路审计
