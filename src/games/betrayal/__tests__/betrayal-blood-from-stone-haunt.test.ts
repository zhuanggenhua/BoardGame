import { describe, expect, it } from 'vitest';
import { resolveBloodFromStonePeekabooOptions } from '../hauntSpecialActionReadModel';
import {
    resolveBetrayalMonsterDamageOutcome,
    resolveBetrayalMonsterStatuses,
} from '../monsterReadModel';
import { resolveMoveTargetRooms } from '../movementReadModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioHauntCore,
    setScenarioTestTurnMovement,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    isBetrayalRoomInLineOfSight,
    createBetrayalMonsterFromDefinition,
    getBetrayalMonsterDefinition,
    findTestExplorer,
    activateTestExplorer,
    activateBloodFromStoneMonsterTurn,
    setTestTraitTrack,
    setHighCapacityGeneralDamageTracks,
    repeatTraitsForPendingDamage,
    createFeverishControlReadyCore,
    createMagicCameraHauntCore,
    createHelpingHandsHauntCore,
    type BetrayalTraitKey,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveBetrayalMonsterActionPanel,
    resolveBetrayalMonsterActionSet,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    resolveBetrayalMonsterTurnRuntimeState,
    resolveBetrayalMonsterTurnStartStatus,
    resolveBloodFromStoneMonsterTurnEndPreview,
} from '../monsterActionReadModel';

describe('Betrayal first scenario runtime - blood from stone haunt', () => {
it('官方怪物定义会驱动石像小天使的固定属性、不可攻击、不会攻击和视线内不移动口径', () => {
        const definition = getBetrayalMonsterDefinition('blood-from-stone-stone-cherub');
        expect(definition).toMatchObject({
            name: '石像小天使',
            hauntNumber: 5,
            traits: {
                might: 8,
                speed: 4,
                sanity: 8,
                knowledge: 8,
            },
            canAttack: false,
            canBeAttacked: false,
            canBeStunned: false,
        });

        const core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        core.currentExplorer.roomId = 'entrance-hall';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition(
                'blood-from-stone-stone-cherub',
                'stone-cherub-1',
                'entrance-hall',
            ),
        ];
        activateBloodFromStoneMonsterTurn(core, '0');

        const status = resolveBetrayalMonsterStatuses(core)
            .find((item) => item.monsterId === 'stone-cherub-1');
        expect(status).toMatchObject({
            name: '石像小天使',
            canAttack: false,
            canBeAttacked: false,
            canBeStunned: false,
            defaultAttackTrait: 'might',
            traits: {
                might: 8,
                speed: 4,
                sanity: 8,
                knowledge: 8,
                usesTraitTrack: false,
            },
        });
        expect(status?.ruleNotes).toContain('该怪物不能被普通攻击。');
        expect(status?.ruleNotes).toContain('该怪物规则明确不会发动攻击。');

        expect(resolveBetrayalMonsterDamageOutcome(core, 'stone-cherub-1', {
            damageAmount: 2,
            damageTrait: 'might',
        })).toMatchObject({
            kind: 'resisted',
            previousStatus: 'active',
            nextStatus: 'active',
            canBeStunned: false,
            logLabel: '石像小天使不能被攻击',
        });

        const actionSet = resolveBetrayalMonsterActionSet(core, 'stone-cherub-1');
        expect(actionSet).toMatchObject({
            name: '石像小天使',
            canMove: false,
            canAttack: false,
            usesNormalAttackRules: false,
            reason: '石像小天使在英雄视线内开始怪物回合，本回合不移动。',
        });
        const panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.movementGroupIds).not.toContain('石像小天使:4');
        expect(panel.slots.find((slot) => slot.id === 'attack:stone-cherub-1')).toMatchObject({
            enabled: false,
            defaultAttackTrait: 'might',
        });
    });

it('石像小天使从非视线房间移动到任一英雄视线后会立即停止', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateBloodFromStoneMonsterTurn(core, '0');
        core.currentExplorer.roomId = 'entrance-hall';
        core.otherExplorers = core.otherExplorers.map((explorer) => ({
            ...explorer,
            roomId: 'entrance-hall',
        }));
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition(
                'blood-from-stone-stone-cherub',
                'stone-cherub-1',
                'ground-north',
            ),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1'],
            skippedMonsterIdsThisTurn: [],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {
                'stone-cherub-1': 3,
            },
        };

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'hallway', 'entrance-hall')).toBe(true);
        expect(resolveBetrayalMonsterMovementGroups(core).map((group) => group.groupId))
            .toContain('石像小天使:4');
        expect(resolveBetrayalMonsterMoveTargetRooms(core, 'stone-cherub-1').map((room) => room.id))
            .toEqual(['hallway']);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', {
                monsterId: 'stone-cherub-1',
                roomId: 'hallway',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', {
            monsterId: 'stone-cherub-1',
            roomId: 'hallway',
        });

        expect(core.monsters.find((monster) => monster.id === 'stone-cherub-1')?.roomId)
            .toBe('hallway');
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById['stone-cherub-1'])
            .toBe(0);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, 'stone-cherub-1')).toEqual([]);
        expect(resolveBetrayalMonsterActionSet(core, 'stone-cherub-1')).toMatchObject({
            canMove: false,
            canAttack: false,
            reason: '石像小天使在英雄视线内开始怪物回合，本回合不移动。',
        });
    });

it('英雄进入本回合开始时未在自己视线内的石像小天使视线时受 2 骰一般伤害且每回合最多一次', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        findTestExplorer(core, '0').roomId = 'ground-north';
        core.activeRoomId = 'ground-north';
        core.currentExplorerRoomId = 'ground-north';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setScenarioTestTurnMovement(core, 6);
        setHighCapacityGeneralDamageTracks(core, '0');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
        ];
        core.scenarioRuntime.bloodFromStoneTurnStartVisibleStoneCherubIdsByPlayerId = { '0': [] };
        core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn = [];

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(isBetrayalRoomInLineOfSight(core, 'hallway', 'entrance-hall')).toBe(true);
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('hallway');

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'hallway' },
            100,
            createBetrayalScriptedRandom(2, 3),
        );

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '石像小天使新视线伤害',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn).toContain('0');
        expect(core.activityLog[0]?.text).toContain('进入石像小天使新视线');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'entrance-hall' },
            101,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.scenarioRuntime.bloodFromStoneNewLineOfSightDamagePlayerIdsThisTurn)
            .toEqual(['0']);
    });

it('石像小天使怪物回合结束时按每名英雄视线内石像数量排队分配一般伤害', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateBloodFromStoneMonsterTurn(core, '0');
        findTestExplorer(core, '0').roomId = 'entrance-hall';
        findTestExplorer(core, '1').roomId = 'entrance-hall';
        findTestExplorer(core, '2').roomId = 'basement-landing';
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setHighCapacityGeneralDamageTracks(core, '0');
        setHighCapacityGeneralDamageTracks(core, '1');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-2', 'hallway'),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1', 'stone-cherub-2'],
            skippedMonsterIdsThisTurn: ['stone-cherub-1', 'stone-cherub-2'],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            active: true,
            canEnd: true,
            controllerPlayerId: '0',
            nextPlayerId: '1',
            visibleStoneCherubCountsByPlayerId: {
                '0': 2,
                '1': 2,
            },
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN, '0', {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 2, 2, 1),
        );

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '石像小天使凝视',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.pendingDamageAllocation?.nextDamageAllocations).toHaveLength(1);
        expect(core.pendingDamageAllocation?.nextDamageAllocations?.[0]).toMatchObject({
            playerId: '1',
            amount: 1,
            nextPlayerId: '1',
            turnLogText: expect.stringContaining('轮到'),
        });
        expect(core.activityLog[0]?.text).toContain('视线内有 2 个石像小天使');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            amount: 1,
            sourceTitle: '石像小天使凝视',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('1');
    });

it('石像小天使凝视伤害会排除死亡英雄和不在视线内的英雄', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = ['1'];
        activateBloodFromStoneMonsterTurn(core, '0');
        findTestExplorer(core, '0').roomId = 'entrance-hall';
        findTestExplorer(core, '1').roomId = 'entrance-hall';
        findTestExplorer(core, '2').roomId = 'ground-north';
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        setHighCapacityGeneralDamageTracks(core, '0');
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-1', 'entrance-hall'),
        ];
        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            resolvedStartMonsterIds: ['stone-cherub-1'],
            skippedMonsterIdsThisTurn: ['stone-cherub-1'],
            attackedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        };

        expect(isBetrayalRoomInLineOfSight(core, 'ground-north', 'entrance-hall')).toBe(false);
        expect(resolveBloodFromStoneMonsterTurnEndPreview(core)).toMatchObject({
            canEnd: true,
            nextPlayerId: '2',
            visibleStoneCherubCountsByPlayerId: { '0': 1 },
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_BLOOD_FROM_STONE_MONSTER_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '0',
            amount: 2,
        });
        expect(core.pendingDamageAllocation?.nextDamageAllocations ?? []).toEqual([]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('2');
    });

it('英雄持有镜子玩躲猫猫时知识检定获得 +2，成功后移除同房和视线内两只石像小天使', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        setTestTraitTrack(core, '0', 'knowledge', [1, 1, 1], 1, 1);
        hero.inventory = [{ id: 'mirror', name: 'Mirror', kind: 'item' }];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-spared', 'basement-landing'),
        ];

        expect(isBetrayalRoomInLineOfSight(core, 'entrance-hall', 'hallway')).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            }),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.monsters.map((monster) => monster.id)).toEqual(['stone-cherub-spared']);
        expect(core.usedCardIdsThisTurn).toContain('play-peekaboo');
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '玩躲猫猫',
            trait: 'knowledge',
            passiveBonus: 2,
            latestLabel: '移除石像小天使',
        });
        expect(core.activityLog[0]?.text).toContain('玩躲猫猫成功');
    });

it('玩躲猫猫移除最后两只石像小天使后英雄立即胜利', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        setTestTraitTrack(core, '0', 'knowledge', [1, 1, 1], 1, 1);
        hero.inventory = [{ id: 'mirror', name: 'Mirror', kind: 'item' }];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.monsters).toEqual([]);
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'blood-from-a-stone',
            hauntTitle: '顽石之血',
            outcome: 'survivors',
            winners: ['0', '1', '2'],
            traitorPlayerId: '',
            survivorsEscaped: ['0', '1', '2'],
        });
    });

it('英雄玩躲猫猫失败时进入 2 骰一般伤害分配，且本回合不能再次使用', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = [];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        hero.inventory = [];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        setHighCapacityGeneralDamageTracks(core, '0');
        setTestTraitTrack(core, '0', 'knowledge', Array.from({ length: 16 }, () => 1), 14, 14);
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        expect(resolveBloodFromStonePeekabooOptions(core, '0')).toMatchObject([{
            sameRoomMonsterId: 'stone-cherub-same-room',
            lineOfSightMonsterId: 'stone-cherub-in-sight',
        }]);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
            }),
        )).toMatchObject({
            valid: false,
            error: expect.stringContaining('必须选择同房间石像小天使和视线内另一只石像小天使'),
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(1, 3, 2),
        );

        expect(core.monsters.map((monster) => monster.id))
            .toEqual(['stone-cherub-same-room', 'stone-cherub-in-sight']);
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '玩躲猫猫',
            playerId: '0',
            damageKind: 'general',
            amount: 3,
            originalAmount: 3,
            allowSkull: true,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
        });
        expect(core.recentRoll).toMatchObject({
            sourceTitle: '玩躲猫猫',
            trait: 'knowledge',
            passiveBonus: 0,
            latestLabel: '一般伤害',
        });
        expect(core.activityLog[0]?.text).toContain('玩躲猫猫失败');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PLAY_PEEKABOO, '0', {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            }),
        )).toMatchObject({
            valid: false,
            error: expect.stringContaining('本回合已经使用'),
        });
    });

it('顽石之血中全部英雄死亡时作祟失败并进入终局', () => {
        let core = createFirstScenarioHauntCore();
        core.scenarioRuntime.hauntCardNumber = 5;
        core.scenarioRuntime.traitorPlayerId = null;
        core.scenarioRuntime.deadExplorerPlayerIds = ['1', '2'];
        activateTestExplorer(core, '0');
        const hero = findTestExplorer(core, '0');
        hero.roomId = 'entrance-hall';
        hero.inventory = [];
        core.activeRoomId = 'entrance-hall';
        core.currentExplorerRoomId = 'entrance-hall';
        for (const trait of ['might', 'speed', 'knowledge', 'sanity'] as BetrayalTraitKey[]) {
            setTestTraitTrack(core, '0', trait, [1], 0, 0);
        }
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-same-room', 'entrance-hall'),
            createBetrayalMonsterFromDefinition('blood-from-stone-stone-cherub', 'stone-cherub-in-sight', 'hallway'),
        ];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PLAY_PEEKABOO,
            '0',
            {
                sameRoomMonsterId: 'stone-cherub-same-room',
                lineOfSightMonsterId: 'stone-cherub-in-sight',
            },
            100,
            createBetrayalScriptedRandom(1, 3, 3),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '玩躲猫猫',
            playerId: '0',
            amount: 4,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed', 'knowledge', 'sanity']) },
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'blood-from-a-stone',
            hauntTitle: '顽石之血',
            outcome: 'haunt',
            winners: [],
            traitorPlayerId: '',
            survivorsEscaped: [],
        });
    });

it('怪物受伤正式命令复用通用结果并写入可持久化怪物状态', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '2');
        const [killMonsterId, stunMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(killMonsterId).toBeDefined();
        expect(stunMonsterId).toBeDefined();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
                monsterId: stunMonsterId,
                damageAmount: 1,
                damageTrait: 'sanity',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
            monsterId: stunMonsterId,
            damageAmount: 1,
            damageTrait: 'sanity',
        });

        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).toContain(stunMonsterId);
        expect(core.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).not.toContain(stunMonsterId);
        expect(core.monsters.some((monster) => monster.id === stunMonsterId)).toBe(true);
        expect(core.activityLog.some((entry) => entry.text.includes('击晕幻影摄影师'))).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '2', {
            monsterId: killMonsterId,
            damageAmount: 1,
            damageTrait: 'might',
        });

        expect(core.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).toContain(killMonsterId);
        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).not.toContain(killMonsterId);
        expect(core.monsters.some((monster) => monster.id === killMonsterId)).toBe(false);
    });

it('怪物受伤正式命令会用通用状态后端击晕狂热病患并在回合开始翻正跳过', () => {
        let core = createFeverishControlReadyCore();

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
                monsterId: 'feverish-0',
                damageAmount: 1,
                damageTrait: 'might',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
            monsterId: 'feverish-0',
            damageAmount: 1,
            damageTrait: 'might',
        });

        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'feverish-0')).toMatchObject({
            name: '狂热病患',
            status: 'stunned',
            stunned: true,
            slowsHeroMovement: false,
        });
        expect(resolveBetrayalMonsterActionSet(core, 'feverish-0')).toMatchObject({
            canMove: false,
            canAttack: false,
        });
        expect(core.activityLog.some((entry) => entry.text.includes('击晕狂热病患'))).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            '0',
            { monsterId: 'feverish-0' },
        );

        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'feverish-0')).toMatchObject({
            status: 'active',
            stunned: false,
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: ['feverish-0'],
            skippedMonsterIdsThisTurn: ['feverish-0'],
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, 'feverish-0')).toMatchObject({
            status: 'active',
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物本回合已跳过，不能再次移动或攻击。',
        });
    });

it('怪物状态读模型把固定属性和不可击晕怪物从探索者属性轨分离', () => {
        const core = createHelpingHandsHauntCore();
        const trollHandStatus = resolveBetrayalMonsterStatuses(core)
            .find((status) => status.monsterId === 'troll-hand-1');

        expect(trollHandStatus).toMatchObject({
            monsterId: 'troll-hand-1',
            name: '巨魔手',
            status: 'active',
            canBeStunned: false,
            stunned: false,
            killed: false,
            slowsHeroMovement: true,
            canHoldPossessions: false,
            canExploreNewRooms: false,
            defaultAttackTrait: 'might',
            traits: {
                might: 5,
                speed: 3,
                sanity: 4,
                knowledge: 4,
                usesTraitTrack: false,
            },
        });

        const jackCore = createFirstScenarioHauntCore();
        jackCore.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/jacks-spirit',
            roomId: 'entrance-hall',
            might: 5,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        const jackStatus = resolveBetrayalMonsterStatuses(jackCore)
            .find((status) => status.monsterId === 'jack-spirit');

        expect(jackStatus).toMatchObject({
            name: '杰克之灵',
            canBeStunned: false,
            status: 'active',
            traits: {
                might: 5,
                speed: 3,
                sanity: 4,
                knowledge: 4,
                usesTraitTrack: false,
            },
        });
    });
});
