import { describe, expect, it } from 'vitest';
import { resolveBetrayalMonsterStatuses } from '../monsterReadModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCrimsonJackHauntCore,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    isBetrayalRoomInLineOfSight,
    resolveBetrayalPossessionSpecialActionStatus,
    resolveAttackWeaponCardStatuses,
    createBetrayalMonsterFromDefinition,
    resolveInventoryEffectId,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerInventory,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    traitTrackPosition,
    traitTrackPositionTotal,
    physicalTraitTotal,
    mentalTraitTotal,
    repeatTraitsForPendingDamage,
    lethalTraitsForPendingDamage,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - combat weapons and items', () => {
it('英雄攻击叛徒时应按对攻差值造成 physical damage，平手无伤害，Knowledge of Jack 只在此时加成', () => {
        let tieCore = createFirstScenarioHauntCore();
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        const traitorBeforeTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const heroBeforeTie = { ...tieCore.currentExplorer.traits };
        tieCore = applyBetrayalCommand(
            tieCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfterTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(tieCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(tieCore.currentExplorer.traits).toEqual(heroBeforeTie);
        expect(traitorAfterTie.traits).toEqual(traitorBeforeTie.traits);
        expect(tieCore.usedCardIdsThisTurn).toContain('haunt-attack');
        const secondAttackSameTurn = BetrayalDomain.validate(
            { core: tieCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }),
        );
        expect(secondAttackSameTurn).toMatchObject({ valid: false, error: '本回合已经攻击过。' });

        let bonusCore = createFirstScenarioHauntCore();
        bonusCore.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(bonusCore.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            playerId: '2',
        });
        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(bonusCore, 'might') },
        );

        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(bonusCore.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
    });

it('致死普通攻击先等待受伤方分配伤害，确认后才释放杰克之灵', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeTruthy();
    });

it('兔脚可以重掷刚刚攻击投骰的一颗骰子，并按新结果回算非致死攻击伤害', () => {
        let core = createCrimsonJackHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];

        const heroBeforeAttack = { ...core.currentExplorer.traits };
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalPositionBeforeAttack = traitTrackPositionTotal(core, '2', ['might', 'speed']);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2, 2, 2, 2, 1),
        );

        const heroAfterFailedAttack = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        const traitorAfterFailedAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(heroAfterFailedAttack.traits.might + heroAfterFailedAttack.traits.speed).toBeLessThan(
            heroBeforeAttack.might + heroBeforeAttack.speed,
        );
        expect(traitorAfterFailedAttack.traits).toEqual(traitorBeforeAttack.traits);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const heroAfterReroll = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        const traitorAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(heroAfterReroll.traits).toEqual(heroBeforeAttack);
        expect(traitorAfterReroll.traits).toEqual(traitorBeforeAttack.traits);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.activePlayerId).toBe('2');
        expect(core.recentRoll?.latestLabel).toContain('造成');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        expect(traitTrackPositionTotal(core, '2', ['might', 'speed'])).toBeLessThan(traitorPhysicalPositionBeforeAttack);
        expect(core.pendingDamageAllocation).toBeNull();

        const useAgain = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        );
        expect(useAgain.valid).toBe(false);
    });

it('兔脚重掷未确认的攻击伤害时，会替换待分配伤害而不是强制先分配', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'hunting-knife', 'rope'];

        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
        });
        const firstPendingDamageId = core.pendingDamageAllocation?.id;
        const firstPendingDamageAmount = core.pendingDamageAllocation?.originalAmount ?? 0;
        expect(core.activePlayerId).toBe('2');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(2),
        );

        const traitorAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
        });
        expect(core.pendingDamageAllocation?.id).not.toBe(firstPendingDamageId);
        expect(core.pendingDamageAllocation?.originalAmount).toBeGreaterThan(firstPendingDamageAmount);
        expect(core.activePlayerId).toBe('2');
        expect(traitorAfterReroll.traits).toEqual(traitorBeforeAttack.traits);
        expect(core.recentRoll?.latestLabel).toContain('造成');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('砍刀只能作为攻击武器显式使用，攻击结果 +1 且本回合不能交易', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'hunting-knife'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'hunting-knife' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('hunting-knife');
        expect(core.activityLog[0]?.text).toContain('使用砍刀');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.traits).toEqual(traitorBeforeAttack.traits);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const traitorAfterAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfterAttack.traits.might + traitorAfterAttack.traits.speed).toBeLessThan(
            traitorBeforeAttack.traits.might + traitorBeforeAttack.traits.speed,
        );
        expect(core.pendingDamageAllocation).toBeNull();

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1' ? { ...explorer, roomId: core.activeRoomId } : explorer
        ));
        const tradeUsedWeapon = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardId: 'hunting-knife',
                targetPlayerId: '1',
            }),
        );
        expect(tradeUsedWeapon.valid).toBe(false);
        expect(tradeUsedWeapon.error).toContain('本回合已经使用过的持有物不能交易');
    });

it('攻击武器读模型保留刚获得和已使用武器并给出不可用原因', () => {
        const core = createFirstScenarioHauntCore();
        core.currentExplorer.inventory = [
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
            { id: 'dagger', name: '匕首', kind: 'omen' },
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = ['hunting-knife', 'ring'];
        core.usedCardIdsThisTurn = ['ring'];

        const statusesByCardId = Object.fromEntries(
            resolveAttackWeaponCardStatuses(core).map((status) => [status.card.id, status]),
        );

        expect(statusesByCardId['hunting-knife']).toMatchObject({
            canUse: true,
            reason: null,
            availableAtTurnStart: true,
            usedThisTurn: false,
        });
        expect(statusesByCardId.dagger).toMatchObject({
            canUse: false,
            reason: '本回合新获得的武器不能立刻使用。',
            availableAtTurnStart: false,
            usedThisTurn: false,
        });
        expect(statusesByCardId.ring).toMatchObject({
            canUse: false,
            reason: '这把武器本回合已经使用。',
            availableAtTurnStart: true,
            usedThisTurn: true,
        });
    });

it('未声明使用砍刀时，不会只因持有武器自动获得攻击 +1', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('hunting-knife');
    });

it('匕首只能作为攻击武器显式使用，会失去 1 点速度并额外投 2 颗骰', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'dagger'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'dagger' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const heroSpeedBefore = core.currentExplorer.traits.speed;
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'dagger' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 3, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('dagger');
        expect(core.activityLog[0]?.text).toContain('使用匕首');
        const attackerAfterDagger = core.currentExplorer.playerId === '0'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(attackerAfterDagger.traits.speed).toBe(heroSpeedBefore - 1);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '2',
            allowedTraits: ['might', 'speed'],
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfter.traits.might + traitorAfter.traits.speed).toBeLessThan(traitorPhysicalBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

it('未声明使用匕首时，不会只因持有武器自动额外投骰或失去速度', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('dagger');
    });

it('指环只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'ring'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'ring' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        const traitorMentalBefore = traitorBefore.traits.knowledge + traitorBefore.traits.sanity;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(2, 1, 1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('ring');
        expect(core.activityLog[0]?.text).toContain('使用指环');
        expect(core.activityLog[0]?.text).toContain('mental damage');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'mental',
            playerId: '2',
            allowedTraits: ['knowledge', 'sanity'],
            allowSkull: true,
        });
        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(mentalTraitTotal(core, '2')).toBe(traitorMentalBefore);

        const attackerCannotEndBeforeDamage = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(attackerCannotEndBeforeDamage).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayer = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', {
                traits: repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']),
            }),
        );
        expect(wrongPlayer).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: repeatTraitsForPendingDamage(core, ['knowledge', 'sanity']) },
        );

        expect(physicalTraitTotal(core, '2')).toBe(traitorPhysicalBefore);
        expect(mentalTraitTotal(core, '2')).toBeLessThan(traitorMentalBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

it('未声明使用指环时，不会只因持有武器自动改用神志或造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('ring');
    });

it('枪可攻击视线内目标，十字弓只能攻击同板块或相邻板块目标', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        const traitor = findTestExplorer(core, '2');
        actor.roomId = 'grand-staircase';
        traitor.roomId = 'entrance-hall';
        actor.inventory = [
            { id: 'gun', name: '枪', kind: 'item' },
            { id: 'crossbow', name: '十字弓', kind: 'item' },
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        core.activeRoomId = actor.roomId;
        core.currentExplorerInventory = actor.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = actor.inventory.map((card) => card.id);

        expect(isBetrayalRoomInLineOfSight(core, 'grand-staircase', 'entrance-hall')).toBe(true);

        const unarmedAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }),
        );
        expect(unarmedAttack.valid).toBe(false);

        const meleeAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'hunting-knife',
            }),
        );
        expect(meleeAttack.valid).toBe(false);

        const rangedAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'gun',
            }),
        );
        expect(rangedAttack.valid).toBe(true);

        const crossbowLineOfSightOnlyAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'crossbow',
            }),
        );
        expect(crossbowLineOfSightOnlyAttack.valid).toBe(false);
        if (!crossbowLineOfSightOnlyAttack.valid) {
            expect(crossbowLineOfSightOnlyAttack.error).toContain('相邻板块');
        }

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'gun' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.attack?.defenderPlayerId).toBe('2');
        expect(core.recentRoll?.attack?.weaponAttackTrait).toBe('speed');
        expect(core.usedCardIdsThisTurn).toContain('gun');
        expect(core.activityLog[0]?.text).toContain('使用枪');

        const adjacentCore = createCrimsonJackHauntCore();
        activateTestExplorer(adjacentCore, '0');
        const adjacentActor = findTestExplorer(adjacentCore, '0');
        const adjacentTraitor = findTestExplorer(adjacentCore, '2');
        adjacentActor.roomId = 'grand-staircase';
        adjacentTraitor.roomId = 'hallway';
        adjacentActor.inventory = [{ id: 'crossbow', name: '十字弓', kind: 'item' }];
        adjacentCore.activeRoomId = adjacentActor.roomId;
        adjacentCore.currentExplorerInventory = adjacentActor.inventory.map((card) => ({ ...card }));
        adjacentCore.turnStartInventoryCardIds = adjacentActor.inventory.map((card) => card.id);

        const adjacentCrossbowAttack = BetrayalDomain.validate(
            { core: adjacentCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'traitor',
                weaponCardId: 'crossbow',
            }),
        );
        expect(adjacentCrossbowAttack.valid).toBe(true);

        core = applyBetrayalCommand(
            adjacentCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'crossbow' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.attack?.weaponAttackTrait).toBe('speed');
        expect(core.usedCardIdsThisTurn).toContain('crossbow');
        expect(core.activityLog[0]?.text).toContain('使用十字弓');
    });

it('枪和十字弓攻击失败不会反伤攻击者', () => {
        const cases = [
            { cardId: 'gun', cardName: '枪', actorRoomId: 'grand-staircase', targetRoomId: 'entrance-hall' },
            { cardId: 'crossbow', cardName: '十字弓', actorRoomId: 'grand-staircase', targetRoomId: 'hallway' },
        ];

        for (const { cardId, cardName, actorRoomId, targetRoomId } of cases) {
            let core = createCrimsonJackHauntCore();
            activateTestExplorer(core, '0');
            const actor = findTestExplorer(core, '0');
            const traitor = findTestExplorer(core, '2');
            actor.roomId = actorRoomId;
            traitor.roomId = targetRoomId;
            actor.inventory = [{ id: cardId, name: cardName, kind: 'item' }];
            core.activeRoomId = actorRoomId;
            core.currentExplorerInventory = actor.inventory.map((card) => ({ ...card }));
            core.turnStartInventoryCardIds = [cardId];
            setTestTraitTrack(core, '0', 'speed', [1], 0, 0);
            setTestTraitTrack(core, '2', 'speed', [3], 0, 0);
            const actorTraitsBefore = { ...actor.traits };

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.HAUNT_ATTACK,
                '0',
                { target: 'traitor', weaponCardId: cardId },
                100,
                createBetrayalScriptedRandom(1, 3, 3, 3),
            );

            expect(core.currentExplorer.traits, cardName).toEqual(actorTraitsBefore);
            expect(core.pendingDamageAllocation, cardName).toBeNull();
            expect(core.recentRoll?.attack?.previousDamageToAttacker, cardName).toBe(0);
            expect(core.usedCardIdsThisTurn, cardName).toContain(cardId);
        }
    });

it('皮夹克防御攻击时额外投 1 骰，电锯攻击时额外投 1 骰', () => {
        let jacketCore = createCrimsonJackHauntCore();
        activateTestExplorer(jacketCore, '0');
        let actor = findTestExplorer(jacketCore, '0');
        let traitor = findTestExplorer(jacketCore, '2');
        actor.roomId = 'hallway';
        traitor.roomId = 'hallway';
        traitor.inventory = [{ id: 'leather-jacket', name: '皮夹克', kind: 'item' }];
        jacketCore.activeRoomId = 'hallway';
        setTestTraitTrack(jacketCore, '0', 'might', [1], 0, 0);
        setTestTraitTrack(jacketCore, '2', 'might', [1], 0, 0);

        jacketCore = applyBetrayalCommand(
            jacketCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 2, 2),
        );

        expect(jacketCore.recentRoll?.attack?.defenderRoll).toBe(2);
        expect(jacketCore.recentRoll?.attack?.previousDamageToDefender).toBe(0);
        expect(jacketCore.pendingDamageAllocation).toBeNull();

        let chainsawCore = createCrimsonJackHauntCore();
        activateTestExplorer(chainsawCore, '0');
        actor = findTestExplorer(chainsawCore, '0');
        traitor = findTestExplorer(chainsawCore, '2');
        actor.roomId = 'hallway';
        traitor.roomId = 'hallway';
        actor.inventory = [{ id: 'chainsaw', name: '电锯', kind: 'item' }];
        chainsawCore.activeRoomId = 'hallway';
        chainsawCore.currentExplorerInventory = actor.inventory.map((card) => ({ ...card }));
        chainsawCore.turnStartInventoryCardIds = ['chainsaw'];
        setTestTraitTrack(chainsawCore, '0', 'might', [1], 0, 0);
        setTestTraitTrack(chainsawCore, '2', 'might', [1], 0, 0);

        chainsawCore = applyBetrayalCommand(
            chainsawCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'chainsaw' },
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(chainsawCore.recentRoll?.dice).toHaveLength(2);
        expect(chainsawCore.recentRoll?.attack?.weaponExtraDice).toBe(1);
        expect(chainsawCore.usedCardIdsThisTurn).toContain('chainsaw');
    });

it('炸药只能选择当前或相邻的已发现板块', () => {
        const core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        actor.roomId = 'grand-staircase';
        core.activeRoomId = 'grand-staircase';
        setTestExplorerInventory(core, '0', [{ id: 'dynamite', name: '炸药', kind: 'item' }]);

        const sameRoomAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'dynamite-room',
                weaponCardId: 'dynamite',
                targetRoomId: 'grand-staircase',
            }),
        );
        expect(sameRoomAttack.valid).toBe(true);

        const adjacentRoomAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'dynamite-room',
                weaponCardId: 'dynamite',
                targetRoomId: 'hallway',
            }),
        );
        expect(adjacentRoomAttack.valid).toBe(true);

        const lineOfSightOnlyAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'dynamite-room',
                weaponCardId: 'dynamite',
                targetRoomId: 'entrance-hall',
            }),
        );
        expect(lineOfSightOnlyAttack.valid).toBe(false);
        if (!lineOfSightOnlyAttack.valid) {
            expect(lineOfSightOnlyAttack.error).toContain('相邻板块');
        }

        core.rooms = core.rooms.map((room) => (
            room.id === 'hallway'
                ? { ...room, state: 'unexplored' as const }
                : room
        ));
        const undiscoveredRoomAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', {
                target: 'dynamite-room',
                weaponCardId: 'dynamite',
                targetRoomId: 'hallway',
            }),
        );
        expect(undiscoveredRoomAttack.valid).toBe(false);
        if (!undiscoveredRoomAttack.valid) {
            expect(undiscoveredRoomAttack.error).toContain('已发现板块');
        }
    });

it('炸药使用后会从持有区移除、埋葬并记为本回合已攻击', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        actor.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        setTestExplorerInventory(core, '0', [{ id: 'dynamite', name: '炸药', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [2], 0, 0);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'dynamite-room', weaponCardId: 'dynamite', targetRoomId: 'hallway' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'dynamite')).toBe(false);
        expect(core.currentExplorerInventory.some((card) => card.id === 'dynamite')).toBe(false);
        expect(core.usedCardIdsThisTurn).toEqual(expect.arrayContaining(['haunt-attack', 'dynamite']));
        expect(resolveInventoryEffectId(core.possessionOrderByKind.item.at(-1)?.id ?? '')).toBe('dynamite');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('使用炸药');
    });

it('炸药让目标板块每名探索者分别速度检定，失败者进入 4 点物理伤害分配', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        const otherHero = findTestExplorer(core, '1');
        const traitor = findTestExplorer(core, '2');
        actor.roomId = 'hallway';
        otherHero.roomId = 'hallway';
        traitor.roomId = 'entrance-hall';
        core.activeRoomId = 'hallway';
        setTestExplorerInventory(core, '0', [{ id: 'dynamite', name: '炸药', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [2], 0, 0);
        setTestTraitTrack(core, '1', 'speed', [2], 0, 0);
        const failingHeroSpeedPositionBefore = otherHero.traitTracks.speed.position;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'dynamite-room', weaponCardId: 'dynamite', targetRoomId: 'hallway' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            sourceTitle: '炸药',
            damageKind: 'physical',
            amount: 4,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(findTestExplorer(core, '1').traitTracks.speed.position).toBe(failingHeroSpeedPositionBefore);
        expect(core.activePlayerId).toBe('1');
        expect(core.activityLog[0]?.text).toContain('速度检定失败');
    });

it('炸药命中目标板块怪物时会按怪物速度检定失败走受伤结算', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        const actor = findTestExplorer(core, '0');
        actor.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        setTestExplorerInventory(core, '0', [{ id: 'dynamite', name: '炸药', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [2], 0, 0);
        core.monsters = [
            createBetrayalMonsterFromDefinition(
                'dust-feverish-patient',
                'feverish-dynamite',
                'hallway',
                { speed: 2 },
            ),
        ];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'dynamite-room', weaponCardId: 'dynamite', targetRoomId: 'hallway' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'feverish-dynamite')).toMatchObject({
            name: '狂热病患',
            status: 'stunned',
            stunned: true,
        });
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('狂热病患速度检定失败');
    });

it('神秘秒表在作祟开始前不能使用', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'mysterious-stopwatch', name: '神秘秒表', kind: 'item' }]);

        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'mysterious-stopwatch')).toMatchObject({
            canUse: false,
            reason: '神秘秒表只能在作祟开始后使用。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'mysterious-stopwatch' }),
        )).toMatchObject({
            valid: false,
            error: '神秘秒表只能在作祟开始后使用。',
        });
    });

it('神秘秒表在作祟后埋葬并让当前玩家结束回合后再行动一轮', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        setTestExplorerInventory(core, '0', [{ id: 'mysterious-stopwatch', name: '神秘秒表', kind: 'item' }]);

        expect(resolveBetrayalPossessionSpecialActionStatus(core, 'mysterious-stopwatch')).toMatchObject({
            canUse: true,
            reason: null,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'mysterious-stopwatch' });

        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'mysterious-stopwatch')).toBe(false);
        expect(core.pendingExtraTurnAfterCurrentTurn).toMatchObject({
            playerId: '0',
            sourceCardId: 'mysterious-stopwatch',
            sourceCardName: '神秘秒表',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.currentPlayer).toBe('0');
        expect(core.pendingExtraTurnAfterCurrentTurn).toBeNull();
        expect(core.usedCardIdsThisTurn).toEqual([]);
        expect(core.turnStartInventoryCardIds).not.toContain('mysterious-stopwatch');
        expect(core.activityLog.some((entry) => entry.text.includes('神秘秒表生效'))).toBe(true);
    });

it('神秘秒表未使用时作祟回合结束仍正常交接', () => {
        let core = createCrimsonJackHauntCore();
        activateTestExplorer(core, '0');
        setTestExplorerInventory(core, '0', [{ id: 'mysterious-stopwatch', name: '神秘秒表', kind: 'item' }]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.currentPlayer).not.toBe('0');
        expect(core.pendingExtraTurnAfterCurrentTurn).toBeNull();
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'mysterious-stopwatch')).toBe(true);
    });

it('天使之羽埋葬后下一次事件属性检定使用选择结果并叠加属性加值', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '天使之羽测试事件',
            roll: {
                trait: 'sanity',
                branches: [
                    { min: 5, label: '通过', effect: { mode: 'none', recommendedAction: 'endTurn' } },
                    { min: 0, label: '失败', effect: { mode: 'none', recommendedAction: 'endTurn' } },
                ],
            },
        }];
        setTestExplorerInventory(core, '0', [
            { id: 'angel-feather', name: '天使之羽', kind: 'item' },
            { id: 'ring', name: '戒指', kind: 'omen' },
        ]);
        core.currentExplorer.traits.sanity = 1;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_POSSESSION,
            '0',
            { cardId: 'angel-feather', replacementRollTotal: 4 },
        );

        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'angel-feather')).toBe(false);
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'ring')).toBe(true);
        expect(core.nextNonCombatTraitRollTotalReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'angel-feather',
            sourceCardName: '天使之羽',
            selectedTotal: 4,
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.trait).toBe('sanity');
        expect(core.recentRoll?.dice).toEqual([4]);
        expect(core.recentRoll?.passiveBonus).toBe(1);
        expect(core.recentRoll?.latestLabel).toBe('通过');
        expect(core.nextNonCombatTraitRollTotalReplacement).toBeNull();
        expect(core.usedCardIdsThisTurn).toContain('angel-feather');
    });

it('天使之羽必须选择 0-8 的整数结果', () => {
        const core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'angel-feather', name: '天使之羽', kind: 'item' }]);

        const invalidPayloads = [
            { cardId: 'angel-feather' },
            { cardId: 'angel-feather', replacementRollTotal: -1 },
            { cardId: 'angel-feather', replacementRollTotal: 9 },
            { cardId: 'angel-feather', replacementRollTotal: 2.5 },
        ];

        for (const payload of invalidPayloads) {
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', payload),
            )).toMatchObject({
                valid: false,
                error: '天使之羽必须选择 0-8 之间的整数作为投骰结果。',
            });
        }

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'angel-feather',
                replacementRollTotal: 8,
            }),
        )).toMatchObject({ valid: true });
    });

it('天使之羽不会被固定骰事件消费', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '天使之羽固定骰测试事件',
            roll: {
                kind: 'dice',
                dice: 2,
                label: '固定 2 骰',
                branches: [
                    { min: 0, label: '记录固定骰', effect: { mode: 'none', recommendedAction: 'endTurn' } },
                ],
            },
        }];
        setTestExplorerInventory(core, '0', [{ id: 'angel-feather', name: '天使之羽', kind: 'item' }]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_POSSESSION,
            '0',
            { cardId: 'angel-feather', replacementRollTotal: 8 },
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 3),
        );

        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([1, 2]);
        expect(core.nextNonCombatTraitRollTotalReplacement).toMatchObject({
            playerId: '0',
            selectedTotal: 8,
        });
    });

it('牙齿项链在回合结束且存在濒死属性时启动属性选择', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'tooth-necklace', name: '牙齿项链', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.currentPlayer).toBe('0');
        expect(core.pendingEventChoice).toMatchObject({
            playerId: '0',
            sourceTitle: '牙齿项链',
            acceptLabel: '获得属性',
            declineLabel: '跳过',
            sourceKind: 'item',
            itemResolution: 'tooth-necklace-end-turn',
            itemCardId: 'tooth-necklace',
            effect: {
                mode: 'chosenTrait',
                amount: 1,
                allowedTraits: ['might'],
                recommendedAction: 'endTurn',
            },
        });
    });

it('牙齿项链选择濒死属性后提升 1 步并继续结束回合', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'tooth-necklace', name: '牙齿项链', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        const mightPositionBefore = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'might' });

        expect(traitTrackPosition(core, '0', 'might')).toBe(mightPositionBefore + 1);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.activityLog.some((entry) => entry.text.includes('使用牙齿项链'))).toBe(true);
    });

it('牙齿项链没有濒死属性时不拦截正常回合结束', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'tooth-necklace', name: '牙齿项链', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'knowledge', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentPlayer).toBe('1');
    });

it('牙齿项链只能选择当前濒死属性，也可以跳过', () => {
        let core = createStartedFirstScenarioCore(['0', '1', '2']);
        setTestExplorerInventory(core, '0', [{ id: 'tooth-necklace', name: '牙齿项链', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        const mightPositionBefore = traitTrackPosition(core, '0', 'might');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' }),
        )).toMatchObject({
            valid: false,
            error: '牙齿项链必须选择一项当前濒死属性。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });

        expect(traitTrackPosition(core, '0', 'might')).toBe(mightPositionBefore);
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentPlayer).toBe('1');
    });
});
