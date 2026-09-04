import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCrimsonJackHauntCore,
    createFirstScenarioHauntCore,
    createDustFeverishAttackReadyCore,
    createDustFeverishNaturalMonsterTurnBeforeRollCore,
    createJackSpiritNaturalMonsterTurnBeforeRollCore,
    createJackSpiritMovementRollReadyCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveBetrayalDeathStateSummary,
    resolveCorpseLootTargets,
    findTestExplorer,
    activateTestExplorer,
    setTestTraitTrack,
    collectRuntimePossessionCards,
    collectRuntimePossessionCardNames,
    lethalTraitsForPendingDamage,
    createFeverishControlReadyCore,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveBetrayalMonsterActionPanel,
    resolveBetrayalMonsterTurnRuntimeState,
} from '../monsterActionReadModel';

describe('Betrayal first scenario runtime - jack spirit and feverish monsters', () => {
it('Stalk the Prey 只能在未攻击且本回合未用过时发动一次，并且不消耗普通移动', () => {
        let core = createCrimsonJackHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.roomId).toBe('basement-east');

        const movesBeforeStalk = core.movesRemaining;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' });
        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(movesBeforeStalk);
        expect(core.usedCardIdsThisTurn).toContain('stalk-the-prey');

        const secondStalkValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(secondStalkValidation.valid).toBe(false);

        let afterAttackCore = createFirstScenarioHauntCore();
        afterAttackCore.currentPlayer = '2';
        const traitor = afterAttackCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const hero = afterAttackCore.currentExplorer;
        afterAttackCore.currentExplorer = { ...traitor, roomId: 'hallway' };
        afterAttackCore.otherExplorers = [
            { ...hero, roomId: 'hallway' },
            ...afterAttackCore.otherExplorers.filter((explorer) => explorer.playerId !== '2'),
        ];
        afterAttackCore.activeRoomId = 'hallway';
        afterAttackCore.currentExplorerTraits = { ...afterAttackCore.currentExplorer.traits };
        afterAttackCore.currentExplorerInventory = [...afterAttackCore.currentExplorer.inventory];
        afterAttackCore = applyBetrayalCommand(
            afterAttackCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const afterAttackValidation = BetrayalDomain.validate(
            { core: afterAttackCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' }),
        );
        expect(afterAttackValidation.valid).toBe(false);
    });

it('叛徒死亡后轮到其回合时，应改为操控杰克之灵按相邻房间移动', () => {
        let core = createFirstScenarioHauntCore();

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
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '2',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.currentPlayer).toBe('0');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.movesRemaining).toBe(2);

        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('upper-north');
        const moveTargets = ['upper-landing', 'hallway', 'basement-landing'].map((roomId) => (
            BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId }),
            ).valid
        ));
        expect(moveTargets).toEqual([true, false, false]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-landing' });

        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('upper-landing');
    });

it('上一名英雄结束回合时，会自然进入死叛徒的杰克之灵速度移动骰', () => {
        let core = createJackSpiritNaturalMonsterTurnBeforeRollCore();

        expect(core.currentPlayer).toBe('1');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        const jackSpiritRoomId = core.scenarioRuntime.jackSpiritRoomId;
        expect(jackSpiritRoomId).toBeTruthy();
        expect(core.recentRoll).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe(jackSpiritRoomId);
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.movesRemaining).toBe(2);
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            trait: 'speed',
            dice: [1, 1, 0],
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById).toEqual({});

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-landing' }),
        ).valid).toBe(true);
    });

it('杰克之灵控制回合不能使用持有物、兔脚、交易或搜刮尸体', () => {
        const core = createJackSpiritMovementRollReadyCore();
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);

        core.currentExplorer.inventory = [
            { id: 'medical-kit', name: '急救包', kind: 'item' },
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-landing' }),
        ).valid).toBe(true);

        const blockedCommands = [
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '2', { cardId: 'medical-kit' }),
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '2', { cardId: 'rope', dieIndex: 0 }),
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '2', {
                cardIds: ['medical-kit'],
                targetPlayerId: '0',
            }),
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '2', { accept: true }),
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
                sourcePlayerId: '2',
                cardId: 'medical-kit',
            }),
        ];

        blockedCommands.forEach((command) => {
            expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toMatchObject({
                valid: false,
                error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。',
            });
        });
    });

it('上一名探索者结束回合时，会自然进入死叛徒的狂热病患速度移动骰并能交接回合', () => {
        let core = createDustFeverishNaturalMonsterTurnBeforeRollCore();

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(3);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('0');
        expect(core.monsters.find((monster) => monster.id === 'feverish-0')?.roomId).toBe('hallway');
        expect(core.recentRoll).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1, 1),
        );

        expect(core.currentPlayer).toBe('0');
        expect(core.currentExplorer.playerId).toBe('0');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.movesRemaining).toBe(2);
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            trait: 'speed',
            dice: [1, 1, 0, 0, 0],
        });

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' });
        expect(core.monsters.find((monster) => monster.id === 'feverish-0')?.roomId).toBe('entrance-hall');
        expect(core.activeRoomId).toBe('entrance-hall');
        expect(core.movesRemaining).toBe(1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

it('狂热病患动作槽可从怪物攻击入口攻击同房英雄', () => {
        let core = createDustFeverishAttackReadyCore();
        const actionPanel = resolveBetrayalMonsterActionPanel(core);
        const attackSlot = actionPanel.slots.find((slot) => (
            slot.kind === 'attack'
            && slot.monsterId === 'feverish-0'
        ));

        expect(core.currentPlayer).toBe('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(attackSlot).toMatchObject({
            enabled: true,
            command: BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, '0', {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            sourceTitle: '狂热病患攻击',
        });
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain('feverish-0');
        expect(core.pendingDamageAllocation?.playerId).toBe('1');
    });

it('狂热病患怪物攻击击倒最后一名非叛徒后触发灰尘叛徒胜利', () => {
        let core = createDustFeverishAttackReadyCore();
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '2'];
        setTestTraitTrack(core, '1', 'might', [1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1], 1, 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            damageKind: 'physical',
            playerId: '1',
            allowSkull: true,
        });
        expect(core.endgameResult).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'the-dust',
            outcome: 'traitor',
            winners: ['2'],
        });
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.permanentTraitorPlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain('feverish-0');
    });

it('当前运行持有牌全集在狂热病患怪物攻击击倒非叛徒后都会保留并可搜尸', () => {
        const verifiedCardNames: string[] = [];

        for (const card of collectRuntimePossessionCards()) {
            let core = createDustFeverishAttackReadyCore();
            const targetExplorer = findTestExplorer(core, '1');
            targetExplorer.inventory = [{ ...card }];
            setTestTraitTrack(core, '1', 'might', [1, 1], 1, 1);
            setTestTraitTrack(core, '1', 'speed', [1, 1], 1, 1);

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
                '0',
                {
                    monsterId: 'feverish-0',
                    targetPlayerId: '1',
                },
                100,
                createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
            );
            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '1',
                { traits: lethalTraitsForPendingDamage(core, 'might') },
                101,
                createBetrayalScriptedRandom(1, 1, 1),
            );

            const deadNonTraitor = findTestExplorer(core, '1');
            expect(core.phase, card.name).toBe('haunt');
            expect(core.endgameResult, card.name).toBeNull();
            expect(core.scenarioRuntime.deadExplorerPlayerIds, card.name).toContain('1');
            expect(core.scenarioRuntime.dust?.feverishPlayerIds, card.name).not.toContain('1');
            expect(core.monsters.find((monster) => monster.id === 'feverish-1'), card.name).toBeUndefined();
            expect(deadNonTraitor.inventory.map((inventoryCard) => inventoryCard.id), card.name).toEqual([card.id]);

            activateTestExplorer(core, '2');
            core.currentExplorer.roomId = 'hallway';
            core.activeRoomId = 'hallway';

            const corpseBeforeLoot = resolveBetrayalDeathStateSummary(core).corpses.find((item) => item.playerId === '1');
            expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId), card.name).toContain('1');
            expect(corpseBeforeLoot, card.name).toMatchObject({
                itemCount: card.kind === 'item' ? 1 : 0,
                omenCount: card.kind === 'omen' ? 1 : 0,
                canBeLootedByCurrentExplorer: true,
                lootableCardIds: [card.id],
            });

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '2', {
                sourcePlayerId: '1',
                cardId: card.id,
            });

            expect(findTestExplorer(core, '2').inventory.map((inventoryCard) => inventoryCard.id), card.name).toContain(card.id);
            expect(findTestExplorer(core, '1').inventory, card.name).toEqual([]);
            verifiedCardNames.push(card.name);
        }

        expect(verifiedCardNames).toEqual(collectRuntimePossessionCardNames());
    });

it('狂热病患怪物攻击本会触发灰尘叛徒胜利时，兔脚成功会先回滚死亡并保持作祟继续', () => {
        let core = createDustFeverishAttackReadyCore();
        const targetExplorer = findTestExplorer(core, '1');
        targetExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '2'];
        setTestTraitTrack(core, '1', 'might', [1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1], 1, 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');

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
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'map']);
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(resolveCorpseLootTargets(core).map((corpse) => corpse.playerId)).not.toContain('1');
    });

it('狂热病患怪物攻击本会触发灰尘叛徒胜利时，兔脚仍失败才进入叛徒终局', () => {
        let core = createDustFeverishAttackReadyCore();
        const targetExplorer = findTestExplorer(core, '1');
        targetExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.scenarioRuntime.dust!.permanentTraitorPlayerIds = ['0', '2'];
        setTestTraitTrack(core, '1', 'might', [1, 1], 1, 1);
        setTestTraitTrack(core, '1', 'speed', [1, 1], 1, 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            '0',
            {
                monsterId: 'feverish-0',
                targetPlayerId: '1',
            },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: lethalTraitsForPendingDamage(core, 'might') },
            101,
            createBetrayalScriptedRandom(1, 2, 2),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('1');

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
        expect(core.recentRoll?.latestLabel).toBe('正常死亡');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).not.toContain('1');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

it('狂热病患控制回合同样不能使用持有物、兔脚、交易或搜刮尸体', () => {
        const core = createFeverishControlReadyCore();
        expect(core.currentPlayer).toBe('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain('0');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        const blockedCommands = [
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'medical-kit' }),
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardIds: ['medical-kit'],
                targetPlayerId: '1',
            }),
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '0', { accept: true }),
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '0', {
                sourcePlayerId: '0',
                cardId: 'medical-kit',
            }),
        ];

        blockedCommands.forEach((command) => {
            expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toMatchObject({
                valid: false,
                error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。',
            });
        });
    });
});
