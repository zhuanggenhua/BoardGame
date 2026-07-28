# PR #104 合并冲突处理记录

- 时间：2026-07-26
- PR：#104 [codex] 接入 SmashUp 迪士尼四派系与素材
- 处理对象：超能陆战队、冰雪奇缘、狮子王、花木兰。
- 冲突来源：main 已合入 #106 的阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王，并占用通用 DISNEY_BASES / smashup/base/disney_bases 路径；#104 也使用了同名基地图集文件。
- 裁决：保留 #106 的通用 Disney 图集路径，同时将 #104 的基地图集改为 DISNEY_FOUR_FACTION_BASES / smashup/base/disney_four_faction_bases；卡图继续使用 DISNEY_FOUR_FACTION_CARDS / smashup/cards/disney_four_factions。
- 文件归并：#104 的 E2E 从 smashup-disney-four-factions.e2e.ts 改名为 smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts，避免覆盖 #106 已合入的 Disney E2E。
- 素材归并：#104 的 base/compressed/disney_bases.webp 与 base/disney_bases.webp 改名为 disney_four_faction_bases.webp；manifest、测试和 faction 数据同步更新。
- 未完成边界：PR 原正文已说明服务器素材主源上传与公开 URL 回查未闭合；本次只解决 PR 合并冲突与本地路径冲突，不冒充远端素材已发布。
