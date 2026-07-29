import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    __getDiscardActionPlayProviderIdsForTest,
    canPlayActionFromDiscard,
    getDiscardActionPlayOptions,
} from '../domain/discardActionPlayability';
import {
    __getDiscardPlayProviderIdsForTest,
    canPlayFromDiscard,
    getDiscardPlayOptions,
} from '../domain/discardPlayability';
import {
    __getDiscardSpecialProviderIdsForTest,
    canActivateSpecialFromDiscard,
    getDiscardSpecialOptions,
} from '../domain/discardSpecialAbilities';
import { makeBase, makeCard, makeMinion, makePlayer, makeState } from './helpers';

describe('SmashUp 弃牌堆入口目标族合同', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('当前所有弃牌堆 provider 都必须显式登记在合同里', () => {
        expect(__getDiscardPlayProviderIdsForTest().sort()).toEqual([
            'ghost_spectre',
            'zombie_tenacious_z',
            'zombie_theyre_coming_to_get_you',
        ]);
        expect(__getDiscardActionPlayProviderIdsForTest().sort()).toEqual([
            'cyborg_apes_cyberback',
            'diy_clowns_silent_clown',
            'diy_clowns_slapstick_clown',
            'huluwawa_purple_gold_gourd',
        ]);
        expect(__getDiscardSpecialProviderIdsForTest().sort()).toEqual([
            'mounties_eh',
            'skeletons_revenant',
            'world_champs_eh',
        ]);
    });

    it('弃牌堆 -> 基地 族必须只暴露基地目标，不得要求或接受随从目标', () => {
        const ghostCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    discard: [makeCard('ghost-a', 'ghost_spectre', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_monkey_lab')],
        });
        expect(getDiscardPlayOptions(ghostCore, '0').map(option => option.sourceId)).toEqual(['ghost_spectre']);
        expect(canPlayFromDiscard(ghostCore, '0', 'ghost-a', 0)?.allowed).toBe(true);

        const tenaciousCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('tenacious-a', 'zombie_tenacious_z', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_monkey_lab')],
        });
        expect(getDiscardPlayOptions(tenaciousCore, '0').map(option => option.sourceId)).toEqual(['zombie_tenacious_z']);
        expect(canPlayFromDiscard(tenaciousCore, '0', 'tenacious-a', 0)?.allowed).toBe(true);

        const comingCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('walker-a', 'zombie_walker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_monkey_lab',
                ongoingActions: [{
                    uid: 'coming-ongoing',
                    defId: 'zombie_theyre_coming_to_get_you',
                    ownerId: '0',
                    talentUsed: false,
                    metadata: { sourceControllerId: '0' },
                } as any],
            })],
        });
        const comingOptions = getDiscardPlayOptions(comingCore, '0');
        expect(comingOptions).toHaveLength(1);
        expect(comingOptions[0]?.sourceId).toBe('zombie_theyre_coming_to_get_you');
        expect(canPlayFromDiscard(comingCore, '0', 'walker-a', 0)?.allowed).toBe(true);

        const revenantCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('revenant-a', 'skeletons_revenant', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab')],
        });
        const revenantOptions = getDiscardSpecialOptions(revenantCore, '0');
        expect(revenantOptions).toHaveLength(1);
        expect(revenantOptions[0]?.sourceId).toBe('skeletons_revenant');
        expect(revenantOptions[0]?.allowedMinionUids).toBeUndefined();
        expect(canActivateSpecialFromDiscard(revenantCore, '0', 'revenant-a', 0)).toEqual({
            allowed: true,
            sourceId: 'skeletons_revenant',
        });
        expect(canActivateSpecialFromDiscard(revenantCore, '0', 'revenant-a', 0, 'host-a')).toBeNull();
    });

    it('弃牌堆 -> 随从 族必须显式要求随从目标，缺目标时直接校验失败', () => {
        const cyberbackCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('shield-a', 'cyborg_apes_shielding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_monkey_lab', [
                makeMinion('own-cyberback', 'cyborg_apes_cyberback', '0', 5),
                makeMinion('enemy-cyberback', 'cyborg_apes_cyberback', '1', 5),
            ])],
        });
        const cyberbackOptions = getDiscardActionPlayOptions(cyberbackCore, '0');
        expect(cyberbackOptions).toHaveLength(1);
        expect(cyberbackOptions[0]?.sourceId).toBe('cyborg_apes_cyberback');
        expect(cyberbackOptions[0]?.allowedMinionUids).toEqual(['own-cyberback']);
        expect(canPlayActionFromDiscard(cyberbackCore, '0', 'shield-a', 0)).toBeNull();
        expect(canPlayActionFromDiscard(cyberbackCore, '0', 'shield-a', 0, 'own-cyberback')).toEqual({
            allowed: true,
            sourceId: 'cyborg_apes_cyberback',
        });

        const gourdCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('gourd-a', 'huluwawa_purple_gold_gourd', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('qiwa', 'huluwawa_qi_wa', '0', 5),
                makeMinion('other', 'robot_microbot_alpha', '0', 2),
            ])],
        });
        const gourdOptions = getDiscardActionPlayOptions(gourdCore, '0');
        expect(gourdOptions).toHaveLength(1);
        expect(gourdOptions[0]?.sourceId).toBe('huluwawa_purple_gold_gourd');
        expect(gourdOptions[0]?.allowedMinionUids).toEqual(['qiwa']);
        expect(canPlayActionFromDiscard(gourdCore, '0', 'gourd-a', 0)).toBeNull();
        expect(canPlayActionFromDiscard(gourdCore, '0', 'gourd-a', 0, 'qiwa')).toEqual({
            allowed: true,
            sourceId: 'huluwawa_purple_gold_gourd',
        });

        const ehCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-a', 'world_champs_eh', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('ally-a', 'robot_microbot_alpha', '0', 2),
                makeMinion('ally-b', 'robot_microbot_guard', '0', 3),
            ])],
        });
        const ehOptions = getDiscardSpecialOptions(ehCore, '0');
        expect(ehOptions).toHaveLength(1);
        expect(ehOptions[0]?.sourceId).toBe('world_champs_eh');
        expect(ehOptions[0]?.allowedMinionUids).toEqual(['ally-a', 'ally-b']);
        expect(canActivateSpecialFromDiscard(ehCore, '0', 'eh-a', 0)).toBeNull();
        expect(canActivateSpecialFromDiscard(ehCore, '0', 'eh-a', 0, 'ally-b')).toEqual({
            allowed: true,
            sourceId: 'world_champs_eh',
        });

        const mountiesCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('mounties-eh-a', 'mounties_eh', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('mountie-ally', 'mounties_dudlee', '0', 3),
                makeMinion('enemy-minion', 'robot_microbot_alpha', '1', 2),
            ])],
        });
        const mountiesOptions = getDiscardSpecialOptions(mountiesCore, '0');
        expect(mountiesOptions).toHaveLength(1);
        expect(mountiesOptions[0]?.sourceId).toBe('mounties_eh');
        expect(mountiesOptions[0]?.allowedMinionUids).toEqual(['mountie-ally']);
        expect(canActivateSpecialFromDiscard(mountiesCore, '0', 'mounties-eh-a', 0)).toBeNull();
        expect(canActivateSpecialFromDiscard(mountiesCore, '0', 'mounties-eh-a', 0, 'mountie-ally')).toEqual({
            allowed: true,
            sourceId: 'mounties_eh',
        });
    });
});
