import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine/pipeline';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import { makeBase, makeCard, makeMinion, makePlayer, makeState } from './helpers';

it.each(['wraithrustlers_demon_dogs', 'wraithrustlers_ellen'])('恶魔犬与艾伦同时触发，先结算 %s 时仍能打出暂存牌', (firstTrigger) => {
    resetAbilityInit();
    initAllAbilities();
    const core = makeState({
        players: {
            '0': makePlayer('0', { storedCards: [{
                ...makeCard('stored', 'teens_prep', 'minion', '0'),
                storedByPlayerId: '0',
                storedUnderUid: 'dogs',
                storedUnderDefId: 'wraithrustlers_demon_dogs',
                reason: 'wraithrustlers_demon_dogs',
            }] }),
            '1': makePlayer('1'),
        },
        bases: [makeBase({
            defId: 'base_sfit_robotics_lab',
            minions: [makeMinion('host', 'wraithrustlers_roy', '0', 3, {
                attachedActions: [{ uid: 'accelerator', defId: 'wraithrustlers_unlicensed_nuclear_accelerator', ownerId: '0' }],
            }), makeMinion('ellen', 'wraithrustlers_ellen', '0', 4)],
            ongoingActions: [{ uid: 'dogs', defId: 'wraithrustlers_demon_dogs', ownerId: '0' }],
        })],
    });
    const sys = createInitialSystemState(['0', '1'], smashUpSystemsForTest, undefined);
    sys.phase = 'playCards';
    (sys.undo as any).aiSeatIds = ['1'];
    let state: any = { core, sys };
    const random = createSeededRandom('demon-dogs-undo');
    let timestamp = 100;
    const send = (type: string, payload: unknown = {}) => {
        const result = executePipeline(
            { domain: SmashUpDomain, systems: smashUpSystemsForTest }, state,
            { type, playerId: '0', payload, timestamp: timestamp++ } as any, random, ['0', '1'],
        );
        expect(result.success, `${type}: ${result.error}`).toBe(true);
        state = result.state;
    };
    const choose = (predicate: (option: any) => boolean) => {
        const prompt = state.sys.interaction.current;
        expect(prompt).toBeTruthy();
        const option = prompt.data.options.find(predicate);
        expect(option).toBeTruthy();
        send('SYS_INTERACTION_RESPOND', { optionId: option.id });
    };
    const destroy = () => {
        send('su:use_talent', { ongoingCardUid: 'accelerator', baseIndex: 0 });
        choose(option => option.value?.cardUid === 'dogs');
        expect(state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');
    };

    destroy();
    choose(option => String(option.value?.triggerId).includes(firstTrigger));
    expect(state.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
    choose(option => option.value?.cardUid === 'stored');
    choose(option => option.value?.baseIndex === 0);
    expect(state.core.bases[0].minions.some((minion: any) => minion.uid === 'stored')).toBe(true);
    expect(state.sys.interaction?.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
});
