import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import { reduce } from '../domain/reducer';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { resolveAttack } from '../domain/attack';
import { checkPlayCard } from '../domain/rules';
import { getAbilitySlotIdForCharacter } from '../ui/abilitySlotMapping';
import { NINJA_CARDS } from '../heroes/ninja/cards';
import { createHeroMatchup, createQueuedRandom } from './test-utils';

const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore =>
    events.reduce((current, event) => reduce(current, event), core);

describe('DiceThrone Ninja 能力与卡牌合同', () => {
    it('Ninja v2 面板槽位应按角色实图映射毒刃与死亡盛放', () => {
        expect(getAbilitySlotIdForCharacter('ninja', 'poison-blade')).toBe('combo');
        expect(getAbilitySlotIdForCharacter('ninja', 'death-blossom')).toBe('sky');

        expect(getAbilitySlotIdForCharacter('moon_elf', 'entangling-shot')).toBe('sky');
        expect(getAbilitySlotIdForCharacter('monk', 'taiji-combo')).toBe('combo');
    });

    it('Blink 防御应在攻击结算中掷 3 骰并按骰面产生反击与烟雾弹', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'blink',
            isDefendable: true,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.filter(event => event.type === 'BONUS_DIE_ROLLED')).toHaveLength(3);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(true);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(27);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
    });

    it('攻击被 Ninja 忍术改成不可防御后，不应再执行已挂载的防御技能', () => {
        const state = createHeroMatchup('treant', 'ninja')(['0', '1'], createQueuedRandom([1]));
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: undefined,
            defenseAbilityId: 'blink',
            isDefendable: false,
            damage: 0,
        };

        const events = resolveAttack(state.core, createQueuedRandom([1, 4, 6]), undefined, 100);
        const next = applyEvents(state.core, events);

        expect(events.some(event => event.type === 'BONUS_DIE_ROLLED')).toBe(false);
        expect(events.some(event => event.type === 'ATTACK_DEFENSE_RESOLVED')).toBe(false);
        expect(next.players['0'].resources[RESOURCE_IDS.HP]).toBe(30);
        expect(next.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);
    });

    it('刀扇应为主要阶段行动牌，不得作为投掷阶段攻击修正打出', () => {
        const state = createHeroMatchup('ninja', 'treant')(['0', '1'], createQueuedRandom([1]));
        const card = NINJA_CARDS.find(item => item.id === 'ninja-card-knife-fan');

        expect(card).toBeDefined();
        expect(card?.timing).toBe('main');
        expect(card?.isAttackModifier).not.toBe(true);

        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        expect(checkPlayCard(state.core, '0', card!, 'main1')).toEqual({ ok: true });
        expect(checkPlayCard(state.core, '0', card!, 'offensiveRoll')).toEqual({
            ok: false,
            reason: 'wrongPhaseForMain',
        });
    });
});
