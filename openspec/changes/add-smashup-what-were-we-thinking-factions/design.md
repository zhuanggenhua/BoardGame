## Context

《我们到底在想什么？》是一个四派系 Smash Up 批次。用户给出的主图是 48 个唯一卡面的共享卡牌 atlas；TTS 模组元数据确认该 atlas 被摇滚明星、泰迪熊、外婆和探险家四个牌组共享。基地使用另一个 `4 x 2` atlas。

当前工作区已有大量 Smash Up 未提交改动，且共享注册文件处于活跃编辑状态。本 change 在批准前只落 OpenSpec 文档；批准后必须用最小补丁吸收，不得覆盖其他批次。

## Goals / Non-Goals

- Goals:
  - 完成四派系从 intake 到正式玩法实现、正式资源随 PR/仓库交付、对象级审计和真实入口 E2E。
  - 使用用户图片和 TTS 元数据建立可追溯 source contract。
  - 把既有探险家泰坦实现纳入探险家派系审计，而不是当作派系完成的替代证据。
- Non-Goals:
  - 不在提案批准前修改运行时代码、正式资源树或 manifest。
  - 不重排、清理或回滚当前工作区中其他 Smash Up 批次的未提交改动。
  - 不把 Wiki 文本提升为主真相源；Wiki 只作为英文正文与勘误对照源。

## Decisions

- Decision: 采用独立 change id `add-smashup-what-were-we-thinking-factions`。
  - Reason: 现有 `add-smashup-oops-faction-intake` 面向古埃及人、牛仔、武士、维京人，和本图不是同一批次。
- Decision: 卡牌 atlas 以 TTS `NumWidth=8 / NumHeight=6` 和 CardID `24000-24047` 为槽位合同。
  - Reason: 用户图片尺寸为 `3886 x 4096`，大图必须通过 TTS 元数据和裁图复核锁定 row-major 索引。
- Decision: 基地 atlas 以 TTS key `61`、`NumWidth=4 / NumHeight=2` 和 CardID `6100-6107` 为槽位合同。
  - Reason: 八张基地全部来自同一 atlas，且 TTS 已给出断点与 VP。
- Decision: 探险家最后实施。
  - Reason: 探险家已有泰坦能力和测试痕迹，需要在正式探险家派系接入时做双边吸收与兼容审计。

## Risks / Trade-Offs

- 风险：共享文件已被多个 active change 修改，直接大块改写容易覆盖他人工作。
  - Mitigation: 批准后按文件做最小增量补丁，先读当前版本，再插入本批次所需行。
- 风险：卡牌图面是中文汉化图，英文正文若直接抄 Wiki 可能与图面或勘误冲突。
  - Mitigation: intake 合同必须逐卡记录图片、TTS、英文资料三方状态；冲突项标 `disputed` 后先裁定。
- 风险：探险家泰坦已存在，容易误判为探险家派系已经完成。
  - Mitigation: tasks 明确把泰坦作为探险家派系的一项兼容审计，不替代 12 张手牌和 2 张基地实现。

## Migration Plan

1. 完成 intake 合同和裁图表，锁定 48 张卡、8 张基地和探险家泰坦归属。
2. 接入正式资源、atlas 元数据、manifest，并将本批 PNG/WebP 图片解除忽略后随 PR/仓库交付。
3. 增量注册四派系静态数据、locale 和 metadata。
4. 按摇滚明星、泰迪熊、外婆、探险家逐个实现玩法并补测试/evidence。
5. 运行批量审计、真实入口 E2E、资源本地/仓库可见性校验和 OpenSpec strict validation。

## Open Questions

- 中文显示名最终采用“外婆”还是“老奶奶”需要在 intake 中裁定；当前 proposal 暂用仓库审计表里的“外婆”。
- 探险家泰坦在本项目中是否默认随正式探险家派系启用，还是仍受 Titans 扩展开关控制，需要在 implementation 阶段按现有泰坦系统合同裁定。
