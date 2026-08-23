# 音频迁移摘要

本文只保留历史音频素材迁移的事实摘要。当前运行时资源、registry 和检索入口以 [audio-usage](audio-usage.md)、[common-audio-assets](common-audio-assets.md) 和 [音频资源标准](../../.spec/knowledge/standards/audio-assets.md) 为准。

## 来源

- 原始清单：`BordGameAsset/SoundEffect/音效列表_完整.md`
- 主要来源目录：`_source_zips` 与 `Mini Games Sound Effects and Music Pack`
- 迁移策略：先剔除明显无关内容和系统垃圾，再按桌游可复用语义分类。

## 保留 / 排除

| 类型 | 处理 |
| --- | --- |
| 卡牌、骰子、棋子、UI、战斗、魔法、怪物、状态、环境、BGM | 保留为候选公共素材 |
| 明显现代交通、体育、预览文件、`__MACOSX/._*` | 排除 |
| 同路径同文件名重复项 | 去重 |
| `Coins` 与 `Token` | 按声音语义区分：硬币/奖励归 coins，棋子/代币触感归 token |
| 状态反馈 | 按声音语义归 status、magic 或其它实际类别，不按具体游戏机制名硬分 |

## 目标分类

```text
public/assets/common/audio/
├── bgm/
└── sfx/
    ├── cards/
    ├── dice/
    ├── coins/
    ├── token/
    ├── combat/
    ├── gun/
    ├── magic/
    ├── monster/
    ├── ui/
    ├── status/
    ├── system/
    ├── puzzle/
    ├── ambient/
    ├── fantasy/
    ├── steampunk/
    ├── cyberpunk/
    ├── foley/
    ├── voice/
    └── stinger/
```

## 当前结果

- 删除 foley / voice 后的压缩结果曾记录为 **6965 files / 387.78MB**，来源见 `docs/audio/compressed-stats.txt`。
- 原始素材估算曾为 **13937 files / 34.43GB**，该数字只反映迁移时素材池，不代表当前运行时包体。
- UGC 上传只保留压缩变体；源素材不作为运行时发布物。

## 继续筛选口径

- 核心桌游声音优先保留：卡牌处理、洗牌、骰子、棋子、硬币、UI、状态、魔法、怪物、战斗短反馈。
- BGM 不默认全量保留；按主题和重复审计选择。
- 枪械、环境、voice、stinger、puzzle、steampunk、cyberpunk 等按游戏题材再接入。
- 新增或替换音频时，不回到本迁移清单定案；按 [audio-integration](../../.spec/skills/audio-integration/SKILL.md) 重新查候选、试听和记录选择理由。
