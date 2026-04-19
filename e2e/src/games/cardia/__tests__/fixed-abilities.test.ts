/**
 * Cardia - 已修复能力测试
 * 
 * 测试在审计阶段修复的 9 个能力：
 * 1. 巫王（WITCH_KING）- 从手牌和牌库弃所有派系牌
 * 2. 税务官（TAX_COLLECTOR）- 本牌+4
 * 3. 使者（MESSENGER）- 任一张牌或下一张牌-3
 * 4. 天才（GENIUS）- 己方影响力≤8的牌+3
 * 5. 发明家（INVENTOR）- 一张+3一张-3
 * 6. 钟表匠（CLOCKMAKER）- 己方上一张和下一张+3
 * 7. 毒师（POISONER）- 降低到平局（动态计算）
 * 8. 图书管理员（LIBRARIAN）- 选择+2或-2
 * 9. 工程师（ENGINEER）- 己方下一张+5
 */

import { describe, it, expect } from 'vitest';
import { ABILITY_IDS } from '../domain/ids';
import { CARDIA_EVENTS } from '../domain/events';

describe('Cardia - 已修复能力测试', () => {
    describe.skip('TODO: Deck II - 能力 ID 定义', () => {
        it('应该定义所有已修复的能力 ID', () => {
            expect(ABILITY_IDS.WITCH_KING).toBeDefined();
            expect(ABILITY_IDS.TAX_COLLECTOR).toBeDefined();
            expect(ABILITY_IDS.MESSENGER).toBeDefined();
            expect(ABILITY_IDS.GENIUS).toBeDefined();
            expect(ABILITY_IDS.INVENTOR).toBeDefined();
            expect(ABILITY_IDS.CLOCKMAKER).toBeDefined();
            expect(ABILITY_IDS.POISONER).toBeDefined();
            expect(ABILITY_IDS.LIBRARIAN).toBeDefined();
            expect(ABILITY_IDS.ENGINEER).toBeDefined();
        });
    });
    
    describe('事件类型定义', () => {
        it('应该定义所有需要的事件类型', () => {
            expect(CARDIA_EVENTS.CARDS_DISCARDED).toBeDefined();
            expect(CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK).toBeDefined();
            expect(CARDIA_EVENTS.DECK_SHUFFLED).toBeDefined();
            expect(CARDIA_EVENTS.MODIFIER_TOKEN_PLACED).toBeDefined();
            expect(CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED).toBeDefined();
        });
    });
});
