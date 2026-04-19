# DiceThrone 枪手 `Loaded / 装填弹药` 时机裁定

## 目标

裁定枪手 `Loaded / 装填弹药` 的最终使用时机，解决“汉化提示板 vs Wiki Clarification”之间的口径冲突。

## 证据源

### 本地真相源

- 汉化提示板裁图：
  - `public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/tip/reload.webp`
- 汉化角色板裁图：
  - `public/assets/i18n/zh-CN/dicethrone/images/gunslinger/crops/player-board/fill-em-with-lead.webp`
- 本地规则文档：
  - `src/games/dicethrone/rule/枪手录入核对.md`
  - `src/games/dicethrone/rule/枪手真相源表.md`

### 对照源

- Gunslinger Wiki 页面：
  - `https://dice-throne.fandom.com/wiki/Gunslinger`
- 该页的 `Reload` clarification：
  - “Can be spent any time after an Attack activates, before or after the defense roll, but before the damage is dealt.”
- 页面中的英文 Leaflet / Board 图片：
  - `https://static.wikia.nocookie.net/dice-throne/images/c/c7/Gunslinger_leaflet.png/revision/latest/scale-to-width-down/360?cb=20260130023927`
  - `https://static.wikia.nocookie.net/dice-throne/images/5/55/Gunslinger_board.png/revision/latest/scale-to-width-down/720?cb=20260130024023`

## 本地实现核对

### 通用 `Loaded`

- `src/games/dicethrone/heroes/gunslinger/tokens.ts`
  - `activeUse.timing = ['onOffensiveRollEnd']`
  - 描述也写成“攻击掷骰阶段结束时可消耗 1 个装填并掷 1 颗骰子”

### 显式例外

- `src/games/dicethrone/heroes/gunslinger/abilities.ts`
  - `fill-em-with-lead` 明写“若花费 1 个装填来增加伤害，可以重掷该骰一次”
- `src/games/dicethrone/heroes/gunslinger/cards.ts`
  - `card-wild-west` 明写“当你花费 1 个填充弹药指示物，你可以重掷此骰子一次，然后总攻击值再增加 1”
  - `upgrade-quick-draw` 明写“当你花费填充弹药指示物，可以重擲一顆骰子一次”
- `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - 通用 `gunslinger-loaded-use` 默认走“掷 1 骰，按一半向上取整加伤”
  - `fill-em-with-lead` 或升级 `quick-draw` 时，进入带重掷的一骰结算
  - `wild west` 自己额外建立“+1 固定伤害 + loaded 重掷该骰”的攻击修正结算

## 裁定逻辑

1. 汉化提示板和英文 leaflet 都把 `Loaded` 主干语义写成“攻击结束后花费，掷 1 骰并把一半向上取整加到本次攻击伤害”。
2. 英文角色板和专属攻击修正牌又单独写了若干“花费 Reload 后可重掷该骰”的特例文本。
3. 因此，Wiki clarification 更像是把“若干显式例外”外推成了统一时机说明；但角色自身组件文字没有这样统一写。
4. 在真相源优先级上，角色 leaflet / 角色板 / 具体卡文应高于社区 Wiki clarification。

## 最终裁定

1. 通用 `Loaded / 装填弹药` 以角色提示板 / 英文 leaflet 为准：
   - 攻击掷骰阶段结束后使用
   - 掷 1 颗骰子
   - 将结果的一半向上取整加入本次攻击伤害
2. 若具体技能、升级或攻击修正牌显式写了“花费 Loaded 后重掷该骰”，则该文本构成特例：
   - `Fill'Em With Lead`
   - 升级 `Quick Draw`
   - `Wild West`
3. 当前代码与上述裁定一致，因此这条冲突不需要再改实现，只需把规则文档与审计口径收口。
