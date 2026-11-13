import { describe, expect, it } from 'vitest';
import type { InteractionDescriptor } from '../../../engine/systems/InteractionSystem';
import { DiceThroneDomain } from '../domain';
import { rebuildClientDiceMultistepInteraction } from '../ui/clientDiceMultistepInteraction';
import { createHeroMatchup, fixedRandom } from './test-utils';

describe('骰铸旧房间选骰交互迁移', () => {
    it('恢复历史抬一手快照时补齐重投语义，使客户端可重建交互', () => {
        const state = createHeroMatchup('thor', 'monk')(['0', '1'], fixedRandom);
        const oldInteraction = {
            id: 'dt-dice-select-card-give-hand-1782363441041', kind: 'multistep-choice', playerId: '0',
            data: {
                title: 'interaction.selectOpponentDieToReroll', sourceId: 'card-give-hand', maxSteps: 1, minSteps: 1,
                allowedDieIds: [0, 1, 2, 3, 4], completedDieIds: [],
                meta: { dtType: 'selectDie', selectCount: 1, diceOwnerId: '1', targetOpponentDice: true, skipAbilityReselection: false },
            },
        } as InteractionDescriptor;
        state.sys.interaction = { ...state.sys.interaction, current: oldInteraction, queue: [oldInteraction] };

        const restored = DiceThroneDomain.normalizeRuntimeState!(state);
        expect(restored.sys.interaction.current?.data).toMatchObject({ meta: { selectionMode: 'reroll' } });
        expect(restored.sys.interaction.queue[0].data).toMatchObject({ meta: { selectionMode: 'reroll' } });
        expect(() => rebuildClientDiceMultistepInteraction(restored.sys.interaction.current)).not.toThrow();
        expect((oldInteraction.data as { meta: { selectionMode?: string } }).meta.selectionMode).toBeUndefined();
    });

    it('旧能力选骰可无来源卡，非历史格式仍保持严格拒绝', () => {
        const state = createHeroMatchup('thor', 'monk')(['0', '1'], fixedRandom);
        const legacy = {
            id: 'dt-dice-select-ability-42', kind: 'multistep-choice', playerId: '0',
            data: { meta: { dtType: 'selectDie', selectCount: 2, targetOpponentDice: false, skipAbilityReselection: false, allowRepeatedDieSelection: true } },
        } as InteractionDescriptor;
        const malformed = { ...legacy, id: 'new-unknown-interaction' };
        state.sys.interaction = { ...state.sys.interaction, current: legacy, queue: [malformed] };
        const restored = DiceThroneDomain.normalizeRuntimeState!(state);
        expect(restored.sys.interaction.current?.data).toMatchObject({ meta: { selectionMode: 'reroll', allowRepeatedDieSelection: true } });
        expect(() => rebuildClientDiceMultistepInteraction(restored.sys.interaction.current)).not.toThrow();
        expect(restored.sys.interaction.queue[0]).toBe(malformed);
        expect(() => rebuildClientDiceMultistepInteraction(malformed)).toThrow();
    });
});
