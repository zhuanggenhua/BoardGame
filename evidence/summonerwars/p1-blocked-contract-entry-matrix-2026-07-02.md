# 召唤师战争 P1 blocked 对象合同入口矩阵（2026-07-02）

> 当前状态说明（2026-07-03）：本文件是 P1 从 blocked 阶段补入口合同时的历史快照，不代表当前状态。P1 对象后续已进入 `b1-p1-rule-text-lock-matrix-2026-07-02.md`、`b2-p1-rule-text-lock-matrix-2026-07-02.md` 和对应 implementation diff matrix；普通续跑不得以本文件里的 `blocked-入口已补` 作为当前录入状态，也不得因此重读图片/OCR/重新录入。

## 目的

- 承接“所有漏审都全面补审”：P1 7 个高优先级 blocked 能力对象不能只停在第二批名单，需要补到对象级合同入口。
- 本文件只补入口合同：承载卡、图源、裁图、风险族、实现入口和下一步缺口。
- 历史入口阶段结论：所有对象当时仍为 `blocked`；逐字规则原文未锁定前，不写规则断言测试，不改机制代码。

## 汇总

- P1 唯一能力对象：7。
- P1 对象-卡牌图源行：9。
- 已匹配裁图对象：7 / 7。
- 已直接定位能力定义：7 / 7。
- 历史入口阶段状态：全部保持 `blocked-入口已补`；当前状态以 rule-text-lock / implementation diff / residual proof queue 为准。

## 对象级入口矩阵

| 对象 | 风险族 | 承载卡牌 | 主图源/帧 | 完整单卡/文字区裁图 | 触发/风险 | 实现入口摘要 | 下一步缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `high_telekinesis` | 攻击后触发、每回合次数、目标/交互选择 | 卡拉(trickster-kara) | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp / CARDS_ATLAS / 2 / r1c0 x=0 y=729 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2__text.jpg`` | afterAttack；攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | `src\games\summonerwars\domain\abilities-trickster.ts:97`；afterAttack；每回合 1；effects=pushPull,unit,isInRange | 逐字卡图原文、原子子句、可选性、次数限制、目标限制、最终状态、负向断言；未锁前保持 blocked |
| `inspire` | 充能/boost | 凯鲁尊者(barbaric-kalu) | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 9 / r4c1 x=1044 y=2916 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9__text.jpg`` | activated；充能/boost | `src\games\summonerwars\domain\abilities-barbaric.ts:166`；activated；每回合 1；effects=addCharge,custom；actionId=withdraw_push_pull | 优先锁充能/boost 子句、每回合次数、是否可选、充能上限和取消/无目标负向断言 |
| `mind_transmission` | 攻击后触发、每回合次数、目标/交互选择 | 古尔壮(trickster-gulzhuang) | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp / CARDS_ATLAS / 3 / r1c1 x=1044 y=729 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-gulzhuang__mind_transmission__CARDS_ATLAS__3.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-gulzhuang__mind_transmission__CARDS_ATLAS__3__text.jpg`` | afterAttack；攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | `src\games\summonerwars\domain\abilities-trickster.ts:235`；afterAttack；每回合 1；effects=grantExtraAttack,unit,and,isOwner | 逐字卡图原文、原子子句、可选性、次数限制、目标限制、最终状态、负向断言；未锁前保持 blocked |
| `prepare` | 每回合次数、充能/boost | 边境弓箭手(barbaric-frontier-archer)<br>梅肯达·露(barbaric-makinda-ru) | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 5 / r2c1 x=1044 y=1458 w=1044 h=729<br>public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 6 / r3c0 x=0 y=2187 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5__text.jpg``<br>``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6__text.jpg`` | activated；每回合次数；充能/boost | `src\games\summonerwars\domain\abilities-barbaric.ts:110`；activated；每回合 1；effects=addCharge | 优先锁充能/boost 子句、每回合次数、是否可选、充能上限和取消/无目标负向断言 |
| `rapid_fire` | 攻击后触发、每回合次数、额外攻击/custom 后续 | 边境弓箭手(barbaric-frontier-archer)<br>梅肯达·露(barbaric-makinda-ru) | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 5 / r2c1 x=1044 y=1458 w=1044 h=729<br>public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 6 / r3c0 x=0 y=2187 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5__text.jpg``<br>``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6__text.jpg`` | afterAttack；攻击后触发；每回合次数；custom结算 | `src\games\summonerwars\domain\abilities-barbaric.ts:141`；afterAttack；每回合 1；effects=custom,addCharge；actionId=rapid_fire_extra_attack | 优先锁额外攻击触发条件、是否未移动、每回合限制、第二次攻击入口和重复触发负向断言 |
| `telekinesis` | 攻击后触发、每回合次数、目标/交互选择 | 清风法师(trickster-wind-mage) | public/assets/i18n/zh-CN/summonerwars/hero/Trickster/compressed/cards.webp / CARDS_ATLAS / 5 / r2c1 x=1044 y=1458 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2__text.jpg``<br>``temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-wind-mage__telekinesis,telekinesis_instead__CARDS_ATLAS__5.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-wind-mage__telekinesis,telekinesis_instead__CARDS_ATLAS__5__text.jpg`` | afterAttack；攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | `src\games\summonerwars\domain\abilities-trickster.ts:336`；afterAttack；每回合 1；effects=pushPull,unit,isInRange | 逐字卡图原文、原子子句、可选性、次数限制、目标限制、最终状态、负向断言；未锁前保持 blocked |
| `withdraw` | 攻击后触发、每回合次数、目标/交互选择、额外攻击/custom 后续 | 凯鲁尊者(barbaric-kalu) | public/assets/i18n/zh-CN/summonerwars/hero/Barbaric/compressed/cards.webp / CARDS_ATLAS / 9 / r4c1 x=1044 y=2916 w=1044 h=729 | ``temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9.jpg`` / ``temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9__text.jpg`` | afterAttack；攻击后触发；每回合次数；custom结算；交互/目标选择 | `src\games\summonerwars\domain\abilities-barbaric.ts:187`；afterAttack；每回合 1；effects=custom；actionId=withdraw_push_pull | 逐字卡图原文、原子子句、可选性、次数限制、目标限制、最终状态、负向断言；未锁前保持 blocked |

## 分流结论

- P1 7 个对象已经从“第二批 blocked 名单”推进到对象级合同入口，但没有任何对象因本文件转为 `locked`。
- P1 后续优先级高于普通 P2：这些对象集中在攻击后触发、每回合次数、额外攻击、目标选择和充能链。
- 后续每个对象只有在完整单卡 + 文字区裁图能逐字锁定规则后，才允许从 `blocked-入口已补` 转为 `locked` 或 `disputed`，并回写主 evidence。
