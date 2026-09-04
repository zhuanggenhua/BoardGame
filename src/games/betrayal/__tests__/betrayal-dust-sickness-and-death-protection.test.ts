import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveBetrayalPossessionSpecialActionStatus,
    resolveBetrayalTradeCardStatus,
    resolveBetrayalDeathStateSummary,
    resolveCorpseLootTargets,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerTraits,
    setTestTraitTrack,
    setHighCapacityGeneralDamageTracks,
    collectRuntimePossessionCards,
    collectRuntimePossessionCardNames,
    createDustHauntCore,
    placeCurrentExplorerInDustResearchRoom,
    seedDustFailedActionExchangeTokens,
    seedDustControlImpulsesTokens,
    type BetrayalCore,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveBetrayalEndgameReadModel } from '../endgameReadModel';
import { resolveBetrayalHauntTokenInstances } from '../hauntTokenModel';

describe('Betrayal first scenario runtime - dust sickness and death protection', () => {
it('灰尘剧本治愈灰尘失败会按研究加值计算并与左侧存活玩家交换疾病标记', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 4 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈失败',
            dice: [0, 0, 0, 0],
            passiveBonus: 4,
        });
        expect(core.activityLog[0]?.text).toContain('尝试治愈灰尘失败');
        expect(core.activityLog[0]?.text).toContain('与左侧玩家随机交换了疾病标记');
        expect(core.usedCardIdsThisTurn).toContain('cure-the-dust');
        expect(core.scenarioRuntime.dust?.researchRoomIds).toEqual(['ground-north', 'hallway']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([7, 8, 9]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([12, 13, 14]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([4, 10, 11]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('3');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

it('灰尘剧本治愈灰尘失败后若所有存活者都永久感染则叛徒胜利', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 4 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
        });
        expect(core.endgameResult?.winners.sort()).toEqual(['1', '3']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['1', '3']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈失败',
            dice: [0, 0, 0, 0],
            passiveBonus: 4,
        });
    });

it('灰尘终局读模型会标记 If You Win 文本可用和场景专属同时政策', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(), 'omen');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            hauntId: 'the-dust',
            hauntTitle: '灰尘',
            outcome: 'survivors',
            winningSideLabel: '英雄',
            winnerPlayerIds: ['1', '2'],
            ifYouWinTextId: 'the-dust.survivors.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'scenario-specific',
            tiePolicyStatus: 'scenario-specific',
            representativeOnly: true,
        });
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '灰尘 If You Win 胜利文本已接入。',
            '灰尘按当前完成的结算事件收口：治愈成功立即英雄胜利；全员感染或死亡只在交换、伤害或死亡事件结算后触发叛徒胜利。',
        ]));
        expect(endgame.ruleNotes).not.toEqual(expect.arrayContaining([
            'If You Win 原文尚未接入；当前只暴露可追踪的胜利文本合同 id。',
        ]));
    });

it('灰尘叛徒终局读模型同样标记 If You Win 文本可用', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        seedDustFailedActionExchangeTokens(core);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0', '2'];
        setTestExplorerTraits(core, '1', { knowledge: 3 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        const endgame = resolveBetrayalEndgameReadModel(core);

        expect(endgame).toMatchObject({
            active: true,
            hauntId: 'the-dust',
            outcome: 'traitor',
            winningSideLabel: '叛徒',
            ifYouWinTextId: 'the-dust.traitor.if-you-win',
            ifYouWinTextStatus: 'available',
            ifYouWinTextAvailable: true,
            needsIfYouWinTextSource: false,
            simultaneousCompletionPolicyStatus: 'scenario-specific',
            tiePolicyStatus: 'scenario-specific',
            representativeOnly: true,
        });
        expect([...endgame.winnerPlayerIds].sort()).toEqual(['1', '3']);
        expect(endgame.ruleNotes).toEqual(expect.arrayContaining([
            '灰尘 If You Win 胜利文本已接入。',
        ]));
    });

it('灰尘治愈成功会按当前行动收口，不被临界叛徒胜利状态覆盖', () => {
        let core = placeCurrentExplorerInDustResearchRoom(createDustHauntCore(['0', '1', '2', '3']), 'omen');
        activateTestExplorer(core, '1');
        core.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'hallway'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '3'];
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];
        setTestExplorerTraits(core, '1', { knowledge: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.CURE_THE_DUST,
            '1',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['1']);
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '治愈灰尘',
            latestLabel: '治愈成功',
        });
    });

it('灰尘剧本同意交换后若所有存活者都成为叛徒则叛徒胜利', () => {
        let core = createDustHauntCore();
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.scenarioRuntime.deadExplorerPlayerIds = ['2'];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: true },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('the-dust');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners.sort()).toEqual(['0', '1']);
    });

it('灰尘剧本控制冲动同意后会随机交换疾病标记并记录本回合已交换', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        seedDustControlImpulsesTokens(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        expect(core.activePlayerId).toBe('0');
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toMatchObject({
            requesterPlayerId: '1',
            targetPlayerId: '0',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(0, 0),
        );

        expect(core.phase).toBe('haunt');
        expect(core.activePlayerId).toBeNull();
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toBeUndefined();
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([4, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([1, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([9, 10, 11]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds.sort()).toEqual(['0', '1']);
        expect(core.activityLog[0]?.text).toContain('同意了');
    });

it('灰尘剧本控制冲动被拒绝后不会交换疾病标记或记录本回合已交换', () => {
        let core = createDustHauntCore(['0', '1', '2']);
        seedDustControlImpulsesTokens(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            '1',
            { targetPlayerId: '0' },
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(0, 0),
        );

        expect(core.phase).toBe('haunt');
        expect(core.activePlayerId).toBeNull();
        expect(core.scenarioRuntime.dust?.pendingSicknessExchange).toBeUndefined();
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([1, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([4, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([9, 10, 11]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('拒绝了');
    });

it('灰尘剧本回合结束会逐个与同房探索者强制交换疾病标记且不会触发冲动伤害', () => {
        let core = createDustHauntCore(['0', '1', '2', '3']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId === '0' || explorer.playerId === '2') {
                return { ...explorer, roomId: 'hallway' };
            }
            return { ...explorer, roomId: 'entrance-hall' };
        });
        core.scenarioRuntime.dust!.sicknessTokensByPlayerId = {
            '0': [
                { id: 'sickness-0-a', value: 1 },
                { id: 'sickness-0-b', value: 7 },
                { id: 'sickness-0-c', value: 8 },
            ],
            '1': [
                { id: 'sickness-1-a', value: 4 },
                { id: 'sickness-1-b', value: 5 },
                { id: 'sickness-1-c', value: 6 },
            ],
            '2': [
                { id: 'sickness-2-a', value: 9 },
                { id: 'sickness-2-b', value: 10 },
                { id: 'sickness-2-c', value: 11 },
            ],
            '3': [
                { id: 'sickness-3-a', value: 12 },
                { id: 'sickness-3-b', value: 13 },
                { id: 'sickness-3-c', value: 14 },
            ],
        };
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.phase).toBe('haunt');
        expect(core.activityLog[0]?.text).toContain('交换了 2 次疾病标记');
        expect(core.activityLog[0]?.text).not.toContain('没有交换疾病标记');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1', '2']);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['0']?.map((token) => token.value)).toEqual([4, 7, 8]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['1']?.map((token) => token.value)).toEqual([9, 5, 6]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['2']?.map((token) => token.value)).toEqual([1, 10, 11]);
        expect(core.scenarioRuntime.dust?.sicknessTokensByPlayerId['3']?.map((token) => token.value)).toEqual([12, 13, 14]);
    });

it('灰尘剧本同房强制交换后若所有存活者都永久感染则叛徒胜利', () => {
        let core = createDustHauntCore(['0', '1', '2', '3']);
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId === '0' || explorer.playerId === '2') {
                return { ...explorer, roomId: 'hallway' };
            }
            return { ...explorer, roomId: 'entrance-hall' };
        });
        core.scenarioRuntime.deadExplorerPlayerIds = ['3'];
        core.scenarioRuntime.dust!.sicknessTokensByPlayerId = {
            '0': [
                { id: 'sickness-0-a', value: 1 },
                { id: 'sickness-0-b', value: 7 },
                { id: 'sickness-0-c', value: 8 },
            ],
            '1': [
                { id: 'sickness-1-a', value: 4 },
                { id: 'sickness-1-b', value: 5 },
                { id: 'sickness-1-c', value: 6 },
            ],
            '2': [
                { id: 'sickness-2-a', value: 9 },
                { id: 'sickness-2-b', value: 10 },
                { id: 'sickness-2-c', value: 11 },
            ],
            '3': [
                { id: 'sickness-3-a', value: 12 },
                { id: 'sickness-3-b', value: 13 },
                { id: 'sickness-3-c', value: 14 },
            ],
        };
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['0', '1', '2'],
        });
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '1', '2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['3']);
    });

it('灰尘剧本回合内没有交换疾病时，回合结束进入一般伤害分配并在确认后交接', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        setHighCapacityGeneralDamageTracks(core, '1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            playerId: '1',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            nextPlayerId: '2',
        });
        expect(core.activityLog[0]?.text).toContain('本回合没有交换疾病标记');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.dust?.exchangedSicknessThisTurnPlayerIds).toEqual([]);
    });

it('灰尘隐藏叛徒因未交换疾病伤害死亡时，分配确认后才变成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            playerId: '1',
            damageKind: 'general',
            amount: 2,
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

it('灰尘冲动一般伤害分到骷髅时，头骨成功会阻止死亡且不生成狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-success',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.endgameResult).toBeNull();
    });

it('灰尘冲动回合末触发头骨时，先展示死亡保护投掷，确认后才交给下一名玩家', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-turn-handoff',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
            nextPlayerId: '2',
            turnLogText: '轮到杰登·琼斯',
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(core.currentPlayer).toBe('1');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
    });

it('灰尘冲动一般伤害分到骷髅时，头骨失败后才变狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-general-skull-failed',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind: 'general',
            damageAmount: 2,
            damageTraits: ['might', 'speed'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

it.each([
        {
            label: '物理攻击伤害',
            sourceTitle: '攻击',
            damageKind: 'physical',
            allowedTraits: ['might', 'speed'] as BetrayalTraitKey[],
            assignedTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
        {
            label: '精神攻击伤害',
            sourceTitle: '精神攻击',
            damageKind: 'mental',
            allowedTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
            assignedTraits: ['knowledge', 'sanity'] as BetrayalTraitKey[],
        },
        {
            label: '一般伤害',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[],
            assignedTraits: ['might', 'speed'] as BetrayalTraitKey[],
        },
    ] as const)('灰尘永久叛徒受到$label时，头骨成功阻止狂热病患化，失败才生成狂热病患', ({
        sourceTitle,
        damageKind,
        allowedTraits,
        assignedTraits,
    }) => {
        const createCoreWithPendingDamage = () => {
            const core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [{ id: 'skull', name: '头骨', kind: 'omen' }];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: `dust-skull-${damageKind}`,
                playerId: '1',
                sourceTitle,
                damageKind,
                amount: 2,
                originalAmount: 2,
                allowedTraits: [...allowedTraits],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };
            return core;
        };

        let protectedCore = createCoreWithPendingDamage();
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: [...assignedTraits] },
            100,
            createBetrayalScriptedRandom(3, 3, 1),
        );

        expect(protectedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(protectedCore.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind,
            damageAmount: 2,
            damageTraits: assignedTraits,
        });
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(protectedCore.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();

        let failedCore = createCoreWithPendingDamage();
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: [...assignedTraits] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(failedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(failedCore.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            damageKind,
            damageAmount: 2,
            damageTraits: assignedTraits,
        });
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(failedCore.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(failedCore.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
    });

it('灰尘永久叛徒头骨失败生成狂热病患后，兔脚重掷成功会回滚死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-skull-rabbit-foot-reroll-success',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
    });

it('灰尘永久叛徒头骨失败生成狂热病患后，兔脚重掷仍失败会保持死亡和狂热病患化', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'first-aid-kit', name: '急救包', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-skull-rabbit-foot-reroll-failure',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it('当前运行持有牌全集在未交换回合末伤害头骨失败且兔脚成功后都不掩埋', () => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '0'
                    ? { ...explorer, roomId: 'ground-north' }
                    : { ...explorer, roomId: 'entrance-hall' }
            ));
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.END_TURN,
                '1',
                {},
                100,
                createBetrayalScriptedRandom(2, 2),
            );

            expect(core.pendingDamageAllocation, card.name).toMatchObject({
                sourceTitle: '灰尘冲动',
                playerId: '1',
                damageKind: 'general',
                amount: 2,
                allowSkull: true,
                nextPlayerId: '2',
            });

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.recentRoll?.deathPrevention, card.name).toMatchObject({
                cardId: 'skull',
                damageKind: 'general',
                damageAmount: 2,
                damageTraits: ['might', 'speed'],
                nextPlayerId: '2',
            });
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(3),
            );

            const expectedInventoryIds = [
                'skull',
                'rope',
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [card.id]),
            ];
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('阻止死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).not.toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeUndefined();
            expect(findTestExplorer(core, '1').inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual(expectedInventoryIds);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId), card.name).not.toContain('1');
            expect(core.usedCardIdsThisTurn, card.name).toContain('rope');
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('当前运行持有牌全集在未交换回合末伤害头骨失败且兔脚仍失败后都会掩埋并不可搜尸', () => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...(card.id === 'skull' || card.id === 'rope' ? [] : [{ ...card }]),
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((inventoryCard) => ({ ...inventoryCard }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((inventoryCard) => inventoryCard.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
            core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '0'
                    ? { ...explorer, roomId: 'ground-north' }
                    : { ...explorer, roomId: 'entrance-hall' }
            ));
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.END_TURN,
                '1',
                {},
                100,
                createBetrayalScriptedRandom(2, 2),
            );

            expect(core.pendingDamageAllocation, card.name).toMatchObject({
                sourceTitle: '灰尘冲动',
                playerId: '1',
                damageKind: 'general',
                amount: 2,
                allowSkull: true,
                nextPlayerId: '2',
            });

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                101,
                createBetrayalScriptedRandom(1, 2, 2),
            );

            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.recentRoll?.deathPrevention, card.name).toMatchObject({
                cardId: 'skull',
                damageKind: 'general',
                damageAmount: 2,
                damageTraits: ['might', 'speed'],
                nextPlayerId: '2',
            });
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
            ).valid, card.name).toBe(true);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
                '1',
                { cardId: 'rope', dieIndex: 0 },
                102,
                createBetrayalScriptedRandom(1),
            );

            const corpse = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(core.recentRoll?.kind, card.name).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel, card.name).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toMatchObject({
                name: '狂热病患',
                roomId: 'hallway',
            });
            expect(findTestExplorer(core, '1').inventory, card.name).toEqual([]);
            expect(core.currentExplorerInventory, card.name).toEqual([]);
            expect(resolveCorpseLootTargets(core).map((target) => target.playerId), card.name).not.toContain('1');
            expect(corpse, card.name).toMatchObject({
                itemCount: 0,
                omenCount: 0,
                canBeLootedByCurrentExplorer: false,
                lootableCardIds: [],
            });
            expect(core.usedCardIdsThisTurn, card.name).toContain('rope');
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('灰尘未交换回合末伤害本会触发叛徒终局时，兔脚成功会先回滚死亡并交接回合', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            playerId: '1',
            amount: 2,
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
    });

it('灰尘未交换回合末伤害本会触发叛徒终局时，兔脚仍失败才进入叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds = [];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : { ...explorer, roomId: 'entrance-hall' }
        ));
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            playerId: '1',
            amount: 2,
            allowSkull: true,
            nextPlayerId: '2',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            102,
            createBetrayalScriptedRandom(1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('灰尘永久叛徒回合末兔脚成功回滚死亡后，确认死亡保护会正常交接且不留下尸体或狂热病患', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-rabbit-foot-turn-handoff',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
            nextPlayerId: '2',
            turnLogText: '轮到杰登·琼斯',
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.recentRoll?.deathPrevention).toMatchObject({
            cardId: 'skull',
            nextPlayerId: '2',
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(core).map((token) => token.id)).not.toContain('corpse-1');
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.recentRoll).toBeNull();
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(resolveBetrayalDeathStateSummary(core).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(core).map((token) => token.id)).not.toContain('corpse-1');
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it('灰尘永久叛徒回合末兔脚仍失败后，确认死亡保护会掩埋遗物并进入狂热病患回合', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-rabbit-foot-failed-feverish-turn',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
            nextPlayerId: '1',
            monsterMovementRoll: {
                monsterId: 'feverish-1',
                monsterName: '狂热病患',
                playerId: '1',
                speed: 5,
                dice: [1, 1, 0, 0, 0],
                total: 2,
                moveAllowance: 2,
            },
            turnLogText: '轮到狂热病患',
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        const corpseBeforeConfirm = resolveBetrayalDeathStateSummary(core).corpses.find((corpse) => corpse.playerId === '1');
        expect(corpseBeforeConfirm).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '1', {});

        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            playerId: '1',
            sourceTitle: '狂热病患移动',
            dice: [1, 1, 0, 0, 0],
            latestLabel: '可移动 2 间',
        });
        expect(core.movesRemaining).toBe(2);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(findTestExplorer(core, '1').inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
        const corpseAfterConfirm = resolveBetrayalDeathStateSummary(core).corpses.find((corpse) => corpse.playerId === '1');
        expect(corpseAfterConfirm).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
        expect(resolveBetrayalHauntTokenInstances(core).find((token) => token.id === 'corpse-1')).toMatchObject({
            kind: 'corpse',
            value: 0,
        });
    });

it('灰尘主动持有牌已用后，兔脚回滚会保留已用交易限制，仍失败才掩埋', () => {
        const createUsedBookDeathWindow = (deathRollDice: number[]) => {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.otherExplorers = core.otherExplorers.map((explorer) => (
                explorer.playerId === '0'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
            ));
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'omen-book',
            });

            expect(core.usedCardIdsThisTurn).toContain('omen-book');
            expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'omen-book']);

            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: 'dust-used-active-possession-rabbit-window',
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                100,
                createBetrayalScriptedRandom(...deathRollDice),
            );

            expect(core.recentRoll?.kind).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
            expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'omen-book']);
            return core;
        };

        let protectedCore = createUsedBookDeathWindow([1, 2, 2]);
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(protectedCore.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(resolveBetrayalDeathStateSummary(protectedCore).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(protectedCore).map((token) => token.id)).not.toContain('corpse-1');
        expect(findTestExplorer(protectedCore, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'omen-book']);
        expect(protectedCore.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['omen-book', 'rope']));
        expect(resolveBetrayalTradeCardStatus(protectedCore, 'omen-book')).toMatchObject({
            exists: true,
            usedThisTurn: true,
            canTrade: false,
            reason: '本回合已经使用过的持有物不能交易。',
        });

        const tradeUsedBookAfterRollback = BetrayalDomain.validate(
            { core: protectedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                targetPlayerId: '0',
                cardId: 'omen-book',
            }),
        );
        expect(tradeUsedBookAfterRollback.valid).toBe(false);
        if (!tradeUsedBookAfterRollback.valid) {
            expect(tradeUsedBookAfterRollback.error).toContain('本回合已经使用过的持有物不能交易');
        }
        const reuseBookAfterRollback = BetrayalDomain.validate(
            { core: protectedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'omen-book',
            }),
        );
        expect(reuseBookAfterRollback.valid).toBe(false);
        if (!reuseBookAfterRollback.valid) {
            expect(reuseBookAfterRollback.error).toContain('该持有物本回合已经使用');
        }

        let failedCore = createUsedBookDeathWindow([1, 1, 1]);
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(failedCore.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(failedCore.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });
        expect(failedCore.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['omen-book', 'rope']));
        expect(findTestExplorer(failedCore, '1').inventory).toEqual([]);
        expect(failedCore.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(failedCore).map((corpse) => corpse.playerId)).not.toContain('1');
        const failedBookCorpse = resolveBetrayalDeathStateSummary(failedCore).corpses.find((corpse) => corpse.playerId === '1');
        expect(failedBookCorpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

it('灰尘埋葬型主动牌已用后，兔脚回滚死亡不会恢复已埋葬牌', () => {
        const createUsedMapDeathWindow = (deathRollDice: number[]) => {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'entrance-hall';
            core.activeRoomId = 'entrance-hall';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                { id: 'map', name: '地图', kind: 'item' },
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'map',
                targetRoomId: 'upper-landing',
            });

            expect(core.currentExplorer.roomId).toBe('upper-landing');
            expect(core.usedCardIdsThisTurn).toContain('map');
            expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope']);

            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: 'dust-consumed-active-possession-rabbit-window',
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                100,
                createBetrayalScriptedRandom(...deathRollDice),
            );

            expect(core.recentRoll?.kind).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
            expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope']);
            return core;
        };

        let protectedCore = createUsedMapDeathWindow([1, 2, 2]);
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(protectedCore.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(resolveBetrayalDeathStateSummary(protectedCore).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(protectedCore).map((token) => token.id)).not.toContain('corpse-1');
        expect(findTestExplorer(protectedCore, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope']);
        expect(protectedCore.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['map', 'rope']));
        expect(resolveBetrayalTradeCardStatus(protectedCore, 'map')).toMatchObject({
            exists: false,
            canTrade: false,
            reason: '当前探索者没有这件持有物。',
        });
        const reuseMapAfterRollback = BetrayalDomain.validate(
            { core: protectedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', {
                cardId: 'map',
                targetRoomId: 'hallway',
            }),
        );
        expect(reuseMapAfterRollback.valid).toBe(false);
        if (!reuseMapAfterRollback.valid) {
            expect(reuseMapAfterRollback.error).toContain('当前没有可使用持有物');
        }

        let failedCore = createUsedMapDeathWindow([1, 1, 1]);
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(failedCore.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(failedCore.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'upper-landing',
        });
        expect(failedCore.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['map', 'rope']));
        expect(findTestExplorer(failedCore, '1').inventory).toEqual([]);
        expect(failedCore.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(failedCore).map((corpse) => corpse.playerId)).not.toContain('1');
        const failedMapCorpse = resolveBetrayalDeathStateSummary(failedCore).corpses.find((corpse) => corpse.playerId === '1');
        expect(failedMapCorpse).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

it.each([
        {
            cardId: 'medical-kit',
            cardName: '急救包',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (core: BetrayalCore) => {
                for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                    setTestTraitTrack(core, '1', trait, [1, 2, 3, 4], 0, 2);
                }
            },
            payload: { cardId: 'medical-kit', targetPlayerId: '1' },
        },
        {
            cardId: 'holy-water',
            cardName: '奇怪的药品',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (core: BetrayalCore) => {
                setTestTraitTrack(core, '1', 'might', [1, 2, 3, 4], 0, 2);
                setTestTraitTrack(core, '1', 'speed', [1, 2, 3, 4], 0, 2);
            },
            payload: { cardId: 'holy-water' },
        },
        {
            cardId: 'map',
            cardName: '地图',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (_core: BetrayalCore) => {},
            payload: { cardId: 'map', targetRoomId: 'upper-landing' },
        },
        {
            cardId: 'notebook',
            cardName: '笔记本',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (_core: BetrayalCore) => {},
            payload: { cardId: 'notebook', targetRoomId: 'upper-landing' },
        },
        {
            cardId: 'journal',
            cardName: '日记',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (_core: BetrayalCore) => {},
            payload: { cardId: 'journal', targetRoomId: 'upper-landing' },
        },
        {
            cardId: 'manuscript',
            cardName: '手稿',
            kind: 'item' as const,
            retainedAfterUse: false,
            prepare: (_core: BetrayalCore) => {},
            payload: { cardId: 'manuscript', targetRoomId: 'upper-landing' },
        },
        {
            cardId: 'omen-book',
            cardName: '书本',
            kind: 'omen' as const,
            retainedAfterUse: true,
            prepare: (_core: BetrayalCore) => {},
            payload: { cardId: 'omen-book' },
        },
        {
            cardId: 'mask',
            cardName: '面具',
            kind: 'omen' as const,
            retainedAfterUse: true,
            prepare: (core: BetrayalCore) => {
                core.otherExplorers = core.otherExplorers.map((explorer) => (
                    explorer.playerId === '0'
                        ? { ...explorer, roomId: 'hallway' }
                        : { ...explorer, roomId: 'upper-landing' }
                ));
            },
            payload: { cardId: 'mask', targetRoomId: 'entrance-hall' },
        },
    ])('灰尘当前主动持有牌「$cardName」已用后，兔脚回滚按消耗类型保留边界', (cardCase) => {
        const createUsedActiveCardDeathWindow = (deathRollDice: number[]) => {
            let core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            cardCase.prepare(core);
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
                { id: cardCase.cardId, name: cardCase.cardName, kind: cardCase.kind },
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '1', cardCase.payload);

            expect(core.usedCardIdsThisTurn).toContain(cardCase.cardId);
            const inventoryIdsAfterUse = findTestExplorer(core, '1').inventory.map((card) => card.id);
            if (cardCase.retainedAfterUse) {
                expect(inventoryIdsAfterUse, cardCase.cardName).toContain(cardCase.cardId);
                expect(resolveBetrayalTradeCardStatus(core, cardCase.cardId)).toMatchObject({
                    exists: true,
                    usedThisTurn: true,
                    canTrade: false,
                    reason: '本回合已经使用过的持有物不能交易。',
                });
            } else {
                expect(inventoryIdsAfterUse, cardCase.cardName).not.toContain(cardCase.cardId);
                expect(resolveBetrayalTradeCardStatus(core, cardCase.cardId)).toMatchObject({
                    exists: false,
                    usedThisTurn: true,
                    canTrade: false,
                });
            }

            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: `dust-active-possession-${cardCase.cardId}-rabbit-window`,
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: ['might', 'speed'] },
                100,
                createBetrayalScriptedRandom(...deathRollDice),
            );

            expect(core.recentRoll?.kind).toBe('deathPrevention');
            expect(core.recentRoll?.latestLabel).toBe('正常死亡');
            expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
            return core;
        };

        let protectedCore = createUsedActiveCardDeathWindow([1, 2, 2]);
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(protectedCore.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(resolveBetrayalDeathStateSummary(protectedCore).corpses.map((corpse) => corpse.playerId)).not.toContain('1');
        expect(resolveBetrayalHauntTokenInstances(protectedCore).map((token) => token.id)).not.toContain('corpse-1');
        const protectedInventoryIds = findTestExplorer(protectedCore, '1').inventory.map((card) => card.id);
        expect(protectedInventoryIds).toEqual(expect.arrayContaining(['skull', 'rope']));
        if (cardCase.retainedAfterUse) {
            expect(protectedInventoryIds, cardCase.cardName).toContain(cardCase.cardId);
            expect(resolveBetrayalTradeCardStatus(protectedCore, cardCase.cardId)).toMatchObject({
                exists: true,
                usedThisTurn: true,
                canTrade: false,
                reason: '本回合已经使用过的持有物不能交易。',
            });
            expect(resolveBetrayalPossessionSpecialActionStatus(protectedCore, cardCase.cardId)).toMatchObject({
                usedThisTurn: true,
                canUse: false,
                reason: '该持有物本回合已经使用。',
            });
            const reuseAfterRollback = BetrayalDomain.validate(
                { core: protectedCore, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', cardCase.payload),
            );
            expect(reuseAfterRollback.valid).toBe(false);
        } else {
            expect(protectedInventoryIds, cardCase.cardName).not.toContain(cardCase.cardId);
            expect(resolveBetrayalTradeCardStatus(protectedCore, cardCase.cardId)).toMatchObject({
                exists: false,
                usedThisTurn: true,
                canTrade: false,
            });
            const reuseAfterRollback = BetrayalDomain.validate(
                { core: protectedCore, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', cardCase.payload),
            );
            expect(reuseAfterRollback.valid).toBe(false);
            if (!reuseAfterRollback.valid) {
                expect(reuseAfterRollback.error).toContain('当前没有可使用持有物');
            }
        }

        let failedCore = createUsedActiveCardDeathWindow([1, 1, 1]);
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(failedCore.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(failedCore.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
        });
        expect(findTestExplorer(failedCore, '1').inventory).toEqual([]);
        expect(failedCore.currentExplorerInventory).toEqual([]);
        expect(resolveCorpseLootTargets(failedCore).map((corpse) => corpse.playerId)).not.toContain('1');
        const failedCorpse = resolveBetrayalDeathStateSummary(failedCore).corpses.find((corpse) => corpse.playerId === '1');
        expect(failedCorpse, cardCase.cardName).toMatchObject({
            itemCount: 0,
            omenCount: 0,
            canBeLootedByCurrentExplorer: false,
            lootableCardIds: [],
        });
    });

it('灰尘死亡本会满足叛徒终局时，兔脚窗口先于终局结算', () => {
        const createCoreWithTerminalDeathPrevention = () => {
            const core = createDustHauntCore();
            activateTestExplorer(core, '1');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';
            core.currentExplorer.inventory = [
                { id: 'skull', name: '头骨', kind: 'omen' },
                { id: 'rope', name: '兔脚', kind: 'item' },
            ];
            core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
            core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
            core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
            for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
                setTestTraitTrack(core, '1', trait, [1], 0, 0);
            }
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.pendingDamageAllocation = {
                id: 'dust-terminal-skull-rabbit-foot-window',
                playerId: '1',
                sourceTitle: '灰尘冲动',
                damageKind: 'general',
                amount: 2,
                originalAmount: 2,
                allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
                allowSkull: true,
                traitsBeforeDamage: { ...core.currentExplorer.traits },
            };
            return core;
        };

        let protectedCore = createCoreWithTerminalDeathPrevention();
        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(protectedCore.phase).toBe('haunt');
        expect(protectedCore.endgameResult).toBeNull();
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(protectedCore.recentRoll?.kind).toBe('deathPrevention');
        expect(protectedCore.recentRoll?.latestLabel).toBe('正常死亡');
        expect(BetrayalDomain.validate(
            { core: protectedCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        protectedCore = applyBetrayalCommand(
            protectedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(protectedCore.phase).toBe('haunt');
        expect(protectedCore.endgameResult).toBeNull();
        expect(protectedCore.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(protectedCore.recentRoll?.latestLabel).toBe('阻止死亡');

        let failedCore = createCoreWithTerminalDeathPrevention();
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );
        failedCore = applyBetrayalCommand(
            failedCore,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(1),
        );

        expect(failedCore.phase).toBe('endgame');
        expect(failedCore.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(failedCore.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(failedCore.recentRoll?.latestLabel).toBe('正常死亡');
    });

it('灰尘兔脚成功回滚终局死亡后，后续再次死亡才触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['2'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-terminal-rabbit-foot-success-first-death',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '1', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);

        core.pendingDamageAllocation = {
            id: 'dust-terminal-rabbit-foot-second-death',
            playerId: '1',
            sourceTitle: '灰尘后续伤害',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            102,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
    });

it('灰尘兔脚成功回滚永久叛徒狂热病患后，最后非叛徒死亡才触发叛徒胜利', () => {
        let core = createDustHauntCore();
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['1'];
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '1', trait, [1], 0, 0);
        }
        setTestTraitTrack(core, '2', 'might', [1], 0, 0);
        setTestTraitTrack(core, '2', 'speed', [1], 0, 0);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.pendingDamageAllocation = {
            id: 'dust-traitor-rabbit-foot-success-first-death',
            playerId: '1',
            sourceTitle: '灰尘冲动',
            damageKind: 'general',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: true,
            traitsBeforeDamage: { ...core.currentExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'speed'] },
            100,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toMatchObject({
            name: '狂热病患',
            roomId: 'hallway',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '1',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
        expect(core.recentRoll?.latestLabel).toBe('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id).sort()).toEqual(['rope', 'skull']);

        const lastExplorer = findTestExplorer(core, '2');
        core.pendingDamageAllocation = {
            id: 'dust-traitor-rabbit-foot-last-hero-death',
            playerId: '2',
            sourceTitle: '灰尘后续伤害',
            damageKind: 'physical',
            amount: 2,
            originalAmount: 2,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
            traitsBeforeDamage: { ...lastExplorer.traits },
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: ['might', 'speed'] },
            102,
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['1'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '2']));
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.monsters.find((monster) => monster.id === 'feverish-1')).toBeUndefined();
    });
});
