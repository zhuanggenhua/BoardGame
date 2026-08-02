# PR #118 主线合并冲突证据

## 背景

- PR：#118《实装大杀四方企鹅派系与图集资源》
- GitHub update-branch 生成的 merge commit：717e30a21f93c672761c7474721c71d0e363c97e
- PR 侧父提交：48c979f887c9935a9c8b59539a91b6d49faf3645
- main 侧父提交：175aa5f59d2f4d74ef831ce2fb9cdaa406ab2541

## 重叠文件

- public/locales/zh-CN/game-smashup.json
- public/locales/en/game-smashup.json

## 裁决

这两个 locale 文件是双侧有效内容合并：

- PR 侧新增并保留企鹅派系、卡牌、基地和提示文案。
- main 侧新增并保留 Munchkin 宝藏牌名称、随从 abilityText 和行动牌 effectText。
- 合并结果不是单边覆盖；两侧内容均应保留。

## 本地验证

在当前 PR head（FETCH_HEAD = 717e30a21f93c672761c7474721c71d0e363c97e）上核对：

- zh-CN 包含企鹅卡牌文案：`penguins_emperor_penguin`
- zh-CN 包含 Munchkin 宝藏文案：`munchkin_treasure_bag_of_caltrops`、`munchkin_treasure_wishing_ring`
- en 包含企鹅卡牌文案：`penguins_emperor_penguin`
- en 包含 Munchkin 宝藏文案：`munchkin_treasure_halfling_hireling`、`munchkin_treasure_bag_of_caltrops`、`munchkin_treasure_wishing_ring`

命令摘录：

```powershell
git show FETCH_HEAD:public/locales/zh-CN/game-smashup.json | rg -n "munchkin_treasure_bag_of_caltrops|munchkin_treasure_wishing_ring|penguins_emperor_penguin"
git show FETCH_HEAD:public/locales/en/game-smashup.json | rg -n "penguins|munchkin_treasure_bag_of_caltrops|munchkin_treasure_halfling_hireling|munchkin_treasure_wishing_ring"
```
