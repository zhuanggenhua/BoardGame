## Context

- 用户已经提供了 `葫芦娃` 派系的完整中文效果文本，以及以下本地资源真相源：
  - `D:/新建文件夹/huluwawa-minions-actions-atlas.json`
  - `D:/新建文件夹/huluwawa-bases-atlas.json`
  - `D:/新建文件夹/葫芦小金刚.png`
- 当前 Smash Up 官方卡面渲染与关键图片预加载都基于 `previewRef.type = 'atlas'` 和 `atlasCatalog` 自动发现。
- `FactionId` 仍是 `string`，因此新增派系主要是数据、资源与玩法接线问题，不需要扩展底层公共类型。

## Goals / Non-Goals

- Goals:
  - 让 `葫芦娃` 在中文界面成为正式可选、正式可玩的 Smash Up 派系
  - 为葫芦娃增加独立 atlas id，避免复用现有图集槽位时污染其他官方资源
  - 让泰坦复制能力严格限制在“主动发动能力”的首版边界内
- Non-Goals:
  - 不设计“任意 DIY 派系运行时导入”
  - 不补完整英文卡牌文案
  - 不顺手扩充 Smash Up 全局 setup 选项或 manifest 结构

## Decisions

- Decision: 为 `葫芦娃` 新增独立 atlas id，而不是复用 `pretty_pretty` 或 `tts_atlas_*`。
  - Why: 这是独立 DIY 派系，资源来源、几何和维护节奏都与既有官方扩展不同，单独 atlas 更稳。

- Decision: 卡牌 / 基地 / 泰坦都继续使用 `previewRef.type = 'atlas'`。
  - Why: `SmashUpCardRenderer` 与 `runtimeCriticalImageResolver` 都是按 atlas 自动推导资源；直接用 `image` 会回退成无图文本卡。

- Decision: `葫芦小金刚` 的复制能力首版只复制玩家主动发动的仆从能力。
  - Why: 中文“发动能力”更接近主动入口，且当前运行时已有 `talent / ongoingActivation` 的可点击语义，便于实现和验证。

- Decision: `huluwawa` 只在 `zh-CN` faction metadata 中暴露。
  - Why: 用户提供的是中文真相源，本轮目标是中文正式可玩；英文界面先隐藏比塞入不完整占位文案更稳。

## Risks / Trade-offs

- Risk: `二娃` 需要“顶三张 + 打出一张 + 其余任意顺序回顶/回底”的多段交互。
  - Mitigation: 复用现有 prompt runtime，分成 inspect / select play / reorder 三步，并补单测与 E2E。

- Risk: `三娃`、`六娃`、`蝴蝶妹妹的帮助` 都牵涉替代式离场 / 摧毁保护。
  - Mitigation: 优先沿用现有 `registerTrigger(..., phase: 'replacement')`、`registerProtection` 与 interceptor 模式，不另起一套事件语义。

- Risk: `葫芦小金刚` 的复制可能与“每回合一次”及不同能力入口的上下文耦合。
  - Mitigation: 首版只支持当前运行时已有的主动入口，并在状态中记录每玩家每回合使用次数。

## Migration Plan

1. 先补 OpenSpec、atlas id、静态数据、locale 与资源接线。
2. 再分批完成普通能力、替代/保护能力和高交互能力。
3. 最后补测试、E2E、evidence、压缩和 manifest。

## Open Questions

- `一个一个来` 中“他可以立即打出一个不同名字的仆从到这里”是否完全沿用现有 extra minion play quota 语义，还是需要单独的 same-base / different-name play token。
- `紫金宝葫芦` 的“七娃在场上时可从弃牌堆额外打出到它身上”是否需要作为 discard special provider 暴露，还是只在常规出牌合法性里放宽。
