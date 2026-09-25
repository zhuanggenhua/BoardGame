## Context
主真相源是 `G:\FD image\规则书\Fate_Domination 基础规则【墨水修订1版】 (2).docx`，读取日期为 2026-08-29；用户指定的本地图包是第二主输入。外部 Wiki `https://fatedomination.fandom.com/wiki/Fate/Domination_Wiki` 已可通过内置浏览器读取公开页面，可用于交叉核对；命令行经本机代理 `127.0.0.1:7897` 仍返回 HTTP 403，因此 Wiki 不能覆盖本地规则书。`G:\FD image\网站wiki\httpsfatedomination.fandom.comwikiFateDomination_Wiki.txt` 为 0 字节，仅记录为不可用本地缓存。

本提案范围是第一版牌桌原型与最小可演示规则链，不是完整卡牌编目、完整从者池、完整 AI、教程或线上资源发布。

## Goals / Non-Goals
- Goals: 接入真实游戏 ID；建立可扩展的领域数据结构；让开发者通过开发验证入口浏览并操作一条基础回合；以真实卡图和中文文案组织桌面信息层级；保留明确缺口。
- Non-Goals: 本轮不猜测尚未逐张核验的局势牌效果；不把单个 Saber 素材外推成完整从者全集；不实现全部攻击牌能力、所有御主/从者、所有事件效果、完整终局淘汰、远程 AI、教程和音频。

## Source And Intake Contract

### Rules extracted from the local rulebook

| Rule area | Locked conclusion | Source location | Status |
| --- | --- | --- | --- |
| Player count and duration | 3-7 players, 11 rounds/days | Rulebook paragraphs 1-2 | locked |
| Round structure | Round start, round end, preparation, outpost, action, battle | Rulebook paragraphs 110-114, 180-186 | locked |
| Board topology | Magic Workshop -> Miyama -> Shinto -> Recon; Workshop limit 4, Recon limit 1; battlefields have unlimited space | Rulebook paragraphs 20-22, 138-141 | locked |
| Preparation | Refill hand to normally 3; reveal a situation; gain its printed mana; reveal one Miyama event and one hidden Shinto event | Rulebook paragraphs 118-126 | situation image set supplied; effect transcription partial |
| Outpost | Deploy master, gain Workshop mana or battlefield terrain advantage when deployed on the printed terrain slot | Rulebook paragraphs 127-130 | locked for prototype model |
| Action | Reveal hidden Shinto event; move by cumulative costs; play exactly two attack cards; battlefield play requires one revealed card; non-battlefield cards may be hidden | Rulebook paragraphs 132-147 | partial implementation |
| Battle | Recon players gain 2 VP; each battlefield resolves highest total power, event VP and competition VP | Rulebook paragraphs 168-179 | representative settlement only |
| End of round | Resolve post-battle effects, remove masters, discard active situation/events, close attacks, resolve end-of-round effects | Rulebook paragraphs 180-186 | deferred |
| End game | Elimination pressure at rounds 8-10; highest VP wins at round 11, with Miyama tiebreaker and shared-loss tie | Rulebook paragraphs 11-18 | deferred |

### Rules object x asset matrix

| Rule object | Base V1 role | Source / measured count | Runtime decision | Status |
| --- | --- | --- | --- | --- |
| Winter city board | Required visible board | `G:\FD image\地图板块\地图板块.png`, 1 image, 1920x1080 | Use as real board subject; add structured zone anchors | locked |
| Attack/skill cards | Required hand and attack area | `G:\FD image\cards`, 15 images; rulebook says 12 attack + 3 skill | Use all 15 as named/slot-mapped card definitions only where image text is readable; unresolved identity stays slot-based | partial |
| Event cards | Required event area | `G:\FD image\events`, 18 fronts + 1 back; dimensions vary from 517x753 to 1496x2096 | Use readable named fronts and the provided back; exact full deck semantics remain partial | partial |
| Situation cards | Required preparation/reveal area | `G:\FD image\局势`, 13 fronts + 1 back, all 750x1050; rulebook table implies 10 non-climax + 3 climax | Use supplied real images and stable slot IDs; only directly verified text/effects become runtime rules; defer ambiguous effects | partial |
| Master cards | Required player identity surface | `G:\FD image\masters`, 2 images | Use only the two supplied images with source-backed names/roles; no extrapolation | partial |
| Servant overview/skill cards | Required private identity surface | `G:\FD image\Servant‌`, 1 servant image, 3 skill images, 1 unavailable image | Use supplied Saber set as representative private state; full servant pool is out of scope | partial |
| Player area reference | Layout reference only | `G:\FD image\网站wiki\Player_Area.webp`, 1000x682 | Use for information hierarchy only; do not copy its full visual shell | reference |
| Wiki reference text | Cross-check only | Empty local txt; in-app browser can read public Wiki pages, CLI proxy request returned 403 | Use only for cross-checking; local rulebook remains authoritative | partial |

### Asset and naming contract

- Source files remain in `G:\FD image` as intake evidence; runtime files will be copied into `public/assets/i18n/zh-CN/fate-domination/...` only after approval.
- Runtime references use semantic paths such as `fate-domination/board/fuyuki-city`, `fate-domination/cards/attack-magic-low`, `fate-domination/events/fate-battle`, without `compressed/`, extension, or server URL in code.
- `局势` now has 13 fronts and 1 back. Runtime may include the real supplied images, but card effects stay partial until each front is manually transcribed and checked against the rulebook/Wiki.

## Domain Model And First Demonstration Flow

### Durable state

- `round`: 1-11.
- `phase`: `preparation | outpost | action | battle`.
- `currentPlayerId` and ordered `playerIds`.
- `players[playerId]`: master/servant references, location, mana, VP, command marks, hand card instances, active attacks, discard, and visible/private flags.
- `situation`: current card instance or `null`, with explicit `sourceStatus` (`verified`, `partial`, or `unverified`) for each supplied card.
- `events`: per-location event card instances and discard.
- `battlefields`: structured location data with movement cost, terrain value, competition VP, capacity, and player occupancy.
- `pendingChoice`: explicit choice request descriptor for deployment, card selection, location selection, or battle continuation; UI never reconstructs rule state from selected DOM elements.

Card instances and durable effects use stable deterministic IDs, not array position or wall-clock UUIDs. Coordinates may resolve an immediate location, but delayed state stores entity identity.

### Demonstration commands

| Command | First entry | Permission | Result |
| --- | --- | --- | --- |
| `SELECT_MASTER` | master card/identity object | owning player during setup | assigns supplied representative master |
| `SELECT_SERVANT` | servant overview object | owning player during setup | assigns supplied representative servant and private skills |
| `DEPLOY_MASTER` | map location本体 | current player in outpost | moves master and resolves Workshop/terrain immediate value |
| `SELECT_ATTACK_CARD` | hand card本体 | current player in action, up to two cards | builds explicit two-card selection request |
| `CONFIRM_ATTACK` | attack area confirmation | current player after two-card selection | activates selected cards and enters battle-ready state |
| `INSPECT_CARD` | any visible card/zone top card | viewer permitted by visibility | opens real card detail overlay without changing rules |
| `ADVANCE_PHASE` | current phase action dock | current player after required choice closes | moves the phase forward through the demonstration flow |

The two-card selection retains player confirmation even when only one valid card remains. Card inspection is available in browsing state and is separate from action legality.

## Permission Matrix

| Window / phase | Actor | Visible entry | Submit command | Forbidden entry | Close condition | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | owning player | supplied master/servant card | `SELECT_MASTER`, `SELECT_SERVANT` | other player's private cards | representative identity assigned | domain + Board |
| Preparation | system/current player | situation/event zone | `ADVANCE_PHASE` after reveal state | play attack cards before phase | preparation effects acknowledged | domain |
| Outpost | current player | map location | `DEPLOY_MASTER` | non-current player deployment | location selected and effects resolved | domain + Board |
| Action card selection | current player | own hand card | `SELECT_ATTACK_CARD`, `CONFIRM_ATTACK` | third card, opponent hand, phase advance before confirm | exactly two selected or explicit legal no-play branch | domain + Board |
| Battle | all players for public read; current resolver for continuation | battlefield/result | `ADVANCE_PHASE` | moving after engagement; altering opponent private state | battle settlement recorded | domain + Board |
| Card inspection | viewer with visibility | card body / discard top | `INSPECT_CARD` / close UI | viewing hidden opponent card | overlay closed | Board/E2E |

## UI / Layout Contract

The board uses a single open tabletop composition: real city board as the scene, player/phase HUD as independent overlay, and card entities as the primary interaction surfaces. Required regions are:

1. Top rail: round/day, active situation slot, face-up Miyama event and face-down Shinto event slot, pile counts.
2. Center scene: the supplied Fuyuki board with four structured location anchors and visible master markers.
3. Side rail: current player, mana/VP/command marks, servant/master private identity entry, and action log entry point.
4. Bottom dock: current hand, selected attack cards, discard/deck controls, and phase action.
5. Modal/overlay: card inspection only; it must close back to the same table and preserve current selection.

The table must be readable at 1920x1080 without page-level scrolling. At 375x812, the same Board adapts by reducing side rail density, keeping the map and active hand reachable through internal scroll/dock, preserving 44px minimum touch targets, and never placing controls inside the scene crop.

Visual style is Fate/Domination-specific: blue-gold card chrome, dark wood/ink tabletop, high-contrast cyan/amber state accents, and sparse framing so the provided board/card art remains the subject. No unrelated game's shell, emoji, CSS-drawn card, or fake situation art is allowed.

## Attachment Capability Matrix

| Capability | This change | Reason / follow-up |
| --- | --- | --- |
| `action-log` | 实施本轮 | The demonstration commands need visible history through shared action-log systems. |
| `undo-system` | 实施本轮 | Local card selection/deployment is reversible and should use the shared snapshot contract. |
| `audio-feedback` | 本轮明确跳过 | No Fate/Domination audio source was supplied; follow-up `add-fate-domination-audio` may add registry-backed feedback. |
| `game-ai-system` | 仅保留底层接口，UI 暂不交付 | Keep a deterministic local adapter/test path for repeatability; full strategy, hidden-information belief sampling and AI UI are a later change. |
| `tutorial-engine` | 本轮明确跳过 | The user asked for a first playable UI prototype; tutorial copy and screenshots need a separate approved flow. |
| `debug-config` | 仅保留底层接口，UI 暂不交付 | Do not expose debug controls in the player table; keep the game compatible with shared debug plumbing for later work. |

## Risks / Trade-offs

- Situation card images are now available. V1 may show the real situation zone and verified cards, but must label the catalog/effects as partial until every supplied front is transcribed and validated.
- The event image set has readable named fronts but no rulebook card index in the supplied files. Use stable slot IDs and only lock text that is directly readable from the image/rulebook; defer ambiguous effects.
- The first runtime keeps the development verification entry separate from the formal online-match entry while preserving player-scoped state shapes. For face-down Shinto events, this foundation's acceptance scope is that other players' Board does not render the card face or effect text; transport-layer anti-cheat and stronger server-side secrecy are outside this change.
- Asset upload and remote URL verification are intentionally outside this unapproved change. Local Web/runtime verification is the only allowed evidence until release authorization.

## Approval Gate

Implementation starts only after the user explicitly approves `add-fate-domination-foundation` and its current scope. Approval does not automatically include future card-catalog, complete-gameplay, audio, tutorial, AI, or remote asset publishing changes.
