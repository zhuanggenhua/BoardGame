# Fate/Domination Wiki 抓取记录（2026-09-25）

## 目标

本轮按用户指定的 Fate/Domination Wiki 继续抓取规则正文，重点核对：

- 游戏人数、回合阶段、setup、淘汰和胜负；
- 隐藏信息的实际可见性边界；
- Sitonai / Pohjola Fimbul / Alter 的来源关系；
- 旧 intake 是否把规则写错或把缺失效果猜成正式规则。

## 已获取正文

主入口：

- https://fatedomination.fandom.com/wiki/Fate/Domination_Wiki
- https://fatedomination.fandom.com/wiki/How_to_Play
- https://fatedomination.fandom.com/wiki/Sitonai
- https://fatedomination.fandom.com/wiki/Keywords
- https://fatedomination.fandom.com/wiki/Power
- https://fatedomination.fandom.com/wiki/Instant_Effect
- https://fatedomination.fandom.com/wiki/Alter_Ego_Class

## 已锁定事实

1. 游戏为 2–7 人；规则正文主要覆盖 3–7 人，另有 2 人变体。
2. 普通游戏为 11 轮；每轮为 Prep、Outpost、Action、Combat，随后清理。
3. 第 8、9、10 轮结束进行淘汰；第 11 轮按 VP 决胜。
4. 每位玩家选择一个 Master，并秘密召唤一个 Servant；Servant 的真名和 Class
   不是默认公开信息。
5. 每轮 Prep 从攻击牌库补到 3 张手牌，抽事件，在 Miyama 公开目标、在 Shinto
   面朝下目标；Action 阶段翻开 Shinto 目标并同时打出两张攻击。
6. Wiki 的 Sitonai ruling 明确，`cannot draw cards` 只指 attack deck 和 discard，
   不影响其它专用牌堆。
7. `Alter` 是关键词，需要 Alter Ego 类能力启用；这解释了“Alter”不是普通的
   自动效果，但仍不能从缺失正文推导魔力数量。
8. 每位玩家是一组 `1 Master + 1 Servant`；Servant 通常按 Class 唯一，
   每个 Servant 有 3 张技能牌和 12 张攻击牌。
9. Master 组件包括棋子、VP 标记、Master cards、Command Seals、mana；
   mana 初始 4、上限 12，Command Seals 通常为 3 枚。
10. Fuyuki 棋盘包含 Workshop、Miyama、Shinto、Recon；Workshop 最多 4 人，
    Recon 最多 1 人，战场空间不限。
11. `Objectives` 页面给出 20 张目标的名称、VP、效果和 aspect；重复名称是实体牌
    的重复条目，不能在录入时去重。
12. `Events` 正文确认事件提供 mana 并持续到回合结束；setup 随机移除 2 张非高潮事件，
    其余与 3 张高潮事件组成事件牌序列。

## 纠正的旧 intake

以下旧摘要已从核心合同中撤销：

- “2–4 人”；
- “每位玩家 3 个 Servants”；
- “先到 3 个目标点立即胜利”；
- “每回合抽 1 张牌并做 2 次行动”；
- “13 张事件牌全集已锁定”。

这些内容来自早期搜索摘要 / 原型约定，不能继续作为正式规则。
`required-data-v0.1.md` 已同步改为当前正文候选和 `partial` 状态。

## Sitonai 未决

卡面原文和本地 TTS `Description` 都显示：

```text
Freeze, Forces of Heaven - Action: Until the end of the next round players cannot draw cards, Alter: or gain mana.
```

当前仍没有主源明确给出：

- Alter 状态下哪个玩家获得魔力；
- 获得多少魔力；
- 是否替换整段行动效果还是只替换其中一个子句；
- 卡面正文是否存在被图像裁切或页面抓取遗漏的内容。

因此 `sc_sitonai_2` 继续保持 `disputed`，不写“获得 2 点魔力”。

## 网络失败记录

- `https://fatedomination.fandom.com/wiki/*?action=raw`：403。
- Fandom API：曾返回 200，但 `extracts` 参数不受支持；随后多次连接 443 超时。
- 本次失败只证明本机抓取链不稳定，不证明 Wiki 没有正文。

## 阶段结论

- Fate/Domination 仍为 `S0 in_progress`。
- OpenDesign v5 仍为 candidate，手牌按用户截图改为横向平铺，不扇形、不旋转、不重叠。
- 暂不进入正式 Board/runtime UI；先继续补对象全集、素材合同和规则缺口。
