# Change: 山屋惊魂运行时拓扑补真与教程前置完备

## Why

当前 `betrayal` 已经能跑到首剧本基本链路，但仍有几处明显不是规则真相：
- 起始三联板把 `Hallway` 折叠掉了，导致 ground 起始拓扑不真实；
- 探索入口仍按“单一下一槽位”处理，没有按真实开放门位建模；
- 首剧本 haunt 规则里仍有若干简化逻辑，尚不足以作为教程的正式前提。

用户当前目标已经从“先跑起来”升级到“录完必要数据并按规则正式实装，不留临时实现；之后再做教程”。因此需要先把 runtime 拓扑与关键规则缺口补成正式实现，再进入教程。

## What Changes

- 把 `betrayal` 起始房间拓扑改成显式房间节点与显式门位，不再折叠 `Hallway`。
- 让恶兆前移动/探索基于真实开放门位与楼层连接工作，而不是只认单一预设探索槽。
- 补齐首剧本 runtime 的关键规则缺口，保证教程建立在正式玩法之上。
- 为后续教程建立前置要求：只有当 runtime 拓扑、剧本动作与真实收口链路成立后，教程才允许接入。

## Impact

- Affected specs: `betrayal-first-scenario-runtime`, `tutorial-engine`
- Affected code: `src/games/betrayal/**`, `e2e/betrayal/**`, `docs/games/betrayal/**`
- Verification: OpenSpec strict validation, targeted ESLint, targeted Vitest, 分段 Playwright E2E
