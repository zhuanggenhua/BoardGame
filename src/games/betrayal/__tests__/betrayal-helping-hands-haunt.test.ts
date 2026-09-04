import { describe, expect, it } from 'vitest';
import { resolveBetrayalMonsterDamageOutcome } from '../monsterReadModel';
import {
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerTraits,
    setNextDiscoverySymbolRoomsForAllFloors,
    setNextEventSymbolRoomForTarget,
    createMagicCameraHauntCore,
    createHelpingHandsHauntCore,
    startHelpingHandsMonsterTurn,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveHelpingHandsTrollHandMoveOptions } from '../hauntAttackRewardReadModel';
import { resolveHelpingHandsControllerPlayerId } from '../hauntScenarioReadModel';
import {
    createBetrayalMonsterMovementRollGroupResult,
    resolveBetrayalMonsterActionSet,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    resolveBetrayalMonsterMovementRollGroupPreview,
    resolveHelpingHandsMonsterTurnStatus,
} from '../monsterActionReadModel';

describe('Betrayal first scenario runtime - helping hands haunt', () => {
it('大宅饿了作祟检定成功会按官方援手 setup 建立奇异护符和巨魔手', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        setNextEventSymbolRoomForTarget(core, 'ground-north');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const helpingHands = core.scenarioRuntime.helpingHands;
        const trollHands = core.monsters.filter((monster) => helpingHands?.trollHandIds.includes(monster.id));
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntCardNumber).toBe(12);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: true,
            monsterTurnAfterPlayerId: '0',
        });
        expect(core.scenarioRuntime.hauntSetupQueue.map((entry) => [entry.id, entry.status])).toEqual([
            ['recover-strange-amulet', 'resolved'],
            ['monster-card-left-of-revealer', 'manual-check'],
            ['place-troll-hands', 'resolved'],
            ['first-player-left-of-revealer', 'resolved'],
        ]);
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.possessionOrderByKind.item.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);
        expect(trollHands).toHaveLength(2);
        expect(trollHands.map((monster) => monster.roomId).sort()).toEqual(['basement-landing', 'entrance-hall']);
        expect(trollHands.every((monster) => (
            monster.name === '巨魔手'
            && monster.might === 5
            && monster.speed === 3
            && monster.sanity === 4
            && monster.knowledge === 4
            && monster.damage === 1
        ))).toBe(true);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');
        expect(monsterTurnStatus).toEqual({
            active: false,
            controllerPlayerId: '0',
            monsterTurnAfterPlayerId: '0',
            trollHandIds: helpingHands?.trollHandIds,
            moveAllowance: 0,
            moveDice: [],
            moveRemainingById: {},
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });

        findTestExplorer(core, '0').inventory = findTestExplorer(core, '0').inventory.filter((card) => card.id !== 'strange-amulet');
        expect(resolveHelpingHandsMonsterTurnStatus(core)).toEqual({
            active: false,
            controllerPlayerId: null,
            monsterTurnAfterPlayerId: '0',
            trollHandIds: helpingHands?.trollHandIds,
            moveAllowance: 0,
            moveDice: [],
            moveRemainingById: {},
            reason: '无人持有奇异护符，巨魔手怪物回合跳过。',
        });
    });

it('大宅饿了 setup 若已有奇异护符持有人，不会从物品牌堆重复找牌', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, inventory: [...explorer.inventory, { id: 'strange-amulet', name: '奇异护符', kind: 'item' }] }
                : explorer
        ));
        core.possessionOrderByKind.item = core.possessionOrderByKind.item.filter((card) => card.id !== 'strange-amulet');
        core.deckCounts.item = core.possessionOrderByKind.item.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.scenarioRuntime.helpingHands).toMatchObject({
            strangeAmuletCardId: 'strange-amulet',
            strangeAmuletFoundDuringSetup: false,
        });
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(core.deckCounts.item).toBe(itemDeckBefore);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('1');
        expect(resolveHelpingHandsMonsterTurnStatus(core).controllerPlayerId).toBe('1');
    });

it('大宅饿了的巨魔手控制权会随普通交易后的奇异护符换手实时变化', () => {
        let core = createHelpingHandsHauntCore();
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('0');

        activateTestExplorer(core, '0');
        const holderRoomId = core.currentExplorer.roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: holderRoomId }
                : explorer
        ));
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'strange-amulet',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'strange-amulet')).toBe(false);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'strange-amulet')).toBe(true);
        expect(resolveHelpingHandsControllerPlayerId(core)).toBe('1');
        expect(resolveHelpingHandsMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: '1',
            monsterTurnAfterPlayerId: '0',
            reason: '等待揭秘者结束回合后开始巨魔手怪物回合。',
        });
    });

it('大宅饿了会在揭秘者结束回合后开始巨魔手回合，并让两只手共享一次速度骰', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core, createBetrayalScriptedRandom(1, 2, 3));

        const helpingHands = core.scenarioRuntime.helpingHands;
        const monsterTurnStatus = resolveHelpingHandsMonsterTurnStatus(core);

        expect(monsterTurnStatus.active).toBe(true);
        expect(monsterTurnStatus.controllerPlayerId).toBe('0');
        expect(monsterTurnStatus.moveDice).toHaveLength(3);
        expect(monsterTurnStatus.moveAllowance).toBe(
            Math.max(1, monsterTurnStatus.moveDice.reduce((sum, pip) => sum + pip, 0)),
        );
        expect(monsterTurnStatus.moveRemainingById).toEqual(
            Object.fromEntries(
                (helpingHands?.trollHandIds ?? []).map((monsterId) => [
                    monsterId,
                    monsterTurnStatus.moveAllowance,
                ]),
            ),
        );
        expect(core.currentExplorer.playerId).toBe('0');
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            playerId: '0',
            dice: monsterTurnStatus.moveDice,
        });
    });

it('怪物移动分组读模型会让同类型巨魔手只建立一个速度骰组', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const movementGroups = resolveBetrayalMonsterMovementGroups(core);

        expect(movementGroups).toHaveLength(1);
        expect(movementGroups[0]).toMatchObject({
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            speed: 3,
            diceCount: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });
    });

it('怪物移动骰组预览和结果会按同类型怪物只掷一次并至少移动 1', () => {
        const core = createHelpingHandsHauntCore();
        const helpingHands = core.scenarioRuntime.helpingHands;
        const groupId = '巨魔手:3';
        const preview = resolveBetrayalMonsterMovementRollGroupPreview(core, groupId);

        expect(preview).toMatchObject({
            active: true,
            canRoll: true,
            groupId,
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            speed: 3,
            diceCount: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
            willWriteMoveAllowanceForMonsterIds: helpingHands?.trollHandIds,
            contractGaps: ['path-preview-ui'],
            previewOnly: true,
            reason: null,
        });

        const result = createBetrayalMonsterMovementRollGroupResult(
            core,
            groupId,
            '0',
            createBetrayalScriptedRandom(1, 2, 3),
        );
        expect(result).toMatchObject({
            groupId,
            monsterName: '巨魔手',
            monsterIds: helpingHands?.trollHandIds,
            playerId: '0',
            speed: 3,
            diceCount: 3,
            dice: [0, 1, 2],
            total: 3,
            moveAllowance: 3,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });

        expect(createBetrayalMonsterMovementRollGroupResult(
            core,
            groupId,
            '0',
            createBetrayalScriptedRandom(1, 1, 1),
        )).toMatchObject({
            dice: [0, 0, 0],
            total: 0,
            moveAllowance: 1,
        });
        expect(resolveBetrayalMonsterMovementRollGroupPreview(core, 'missing-group')).toMatchObject({
            active: false,
            canRoll: false,
            reason: '当前没有可行动的同类型怪物移动骰组。',
        });
        expect(createBetrayalMonsterMovementRollGroupResult(
            core,
            'missing-group',
            '0',
            BETRAYAL_FIXED_RANDOM,
        )).toBeNull();
    });

it('大宅饿了无人持有奇异护符时会跳过巨魔手回合并推进到下一名探索者', () => {
        let core = createHelpingHandsHauntCore();
        findTestExplorer(core, '0').inventory = findTestExplorer(core, '0').inventory.filter(
            (card) => card.id !== 'strange-amulet',
        );

        core = startHelpingHandsMonsterTurn(core);

        expect(resolveHelpingHandsMonsterTurnStatus(core)).toMatchObject({
            active: false,
            controllerPlayerId: null,
            reason: '无人持有奇异护符，巨魔手怪物回合跳过。',
        });
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activityLog.some((entry) => entry.text.includes('巨魔手怪物回合跳过'))).toBe(true);
    });

it('大宅饿了只有当前奇异护符持有人能移动、攻击或结束巨魔手回合', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const trollHandId = core.scenarioRuntime.helpingHands?.trollHandIds[0];

        const moveValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND, '1', {
                monsterId: trollHandId,
                roomId: 'hallway',
            }),
        );
        const attackValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK, '1', {
                monsterId: trollHandId,
                targetPlayerId: '2',
            }),
        );
        const endValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN, '1', {}),
        );

        expect(moveValidation).toMatchObject({ valid: false });
        expect(moveValidation.error).toContain('当前奇异护符持有人');
        expect(attackValidation).toMatchObject({ valid: false });
        expect(attackValidation.error).toContain('奇异护符持有人');
        expect(endValidation).toMatchObject({ valid: false });
        expect(endValidation.error).toContain('当前奇异护符持有人');
    });

it('大宅饿了巨魔手只能走已发现真实连接，地下室登陆点能走到大阶梯', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const basementTrollHandId = core.scenarioRuntime.helpingHands?.trollHandIds.find((monsterId) => (
            core.monsters.find((monster) => monster.id === monsterId)?.roomId === 'basement-landing'
        ));
        expect(basementTrollHandId).toBeDefined();

        const moveOptions = resolveHelpingHandsTrollHandMoveOptions(core, basementTrollHandId!);
        expect(moveOptions.map((room) => room.id)).toContain('grand-staircase');
        const monsterMoveTargets = resolveBetrayalMonsterMoveTargetRooms(core, basementTrollHandId!);
        expect(monsterMoveTargets.map((room) => room.id)).toContain('grand-staircase');
        expect(monsterMoveTargets.every((room) => room.state === 'discovered')).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
            '0',
            { monsterId: basementTrollHandId, roomId: 'grand-staircase' },
        );

        expect(core.monsters.find((monster) => monster.id === basementTrollHandId)?.roomId).toBe('grand-staircase');
    });

it('怪物行动集合读模型会表达默认力量攻击和不能持有或探索', () => {
        const core = createHelpingHandsHauntCore();
        const basementTrollHandId = core.scenarioRuntime.helpingHands?.trollHandIds.find((monsterId) => (
            core.monsters.find((monster) => monster.id === monsterId)?.roomId === 'basement-landing'
        ));
        expect(basementTrollHandId).toBeDefined();

        const actionSet = resolveBetrayalMonsterActionSet(core, basementTrollHandId!);

        expect(actionSet).toMatchObject({
            monsterId: basementTrollHandId,
            name: '巨魔手',
            status: 'active',
            canMove: true,
            canAttack: true,
            defaultAttackTrait: 'might',
            usesNormalAttackRules: true,
            canHoldPossessions: false,
            canHoldOmens: false,
            canUsePossessionActions: false,
            canExploreNewRooms: false,
            canDiscoverRoomTiles: false,
            canIgnoreDamagingRoomEffects: true,
            scenarioSpecificOverridesMayApply: true,
        });
        expect(actionSet?.moveTargetRoomIds).toContain('grand-staircase');
    });

it('大宅饿了巨魔手离开有探索者的房间会消耗两点移动', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const trollHandId = core.scenarioRuntime.helpingHands?.trollHandIds[0];
        const trollHand = core.monsters.find((monster) => monster.id === trollHandId);
        expect(trollHand).toBeDefined();
        findTestExplorer(core, '1').roomId = trollHand!.roomId;

        const targetRoom = resolveHelpingHandsTrollHandMoveOptions(core, trollHandId!)[0];
        const moveRemainingBefore = resolveHelpingHandsMonsterTurnStatus(core)
            .moveRemainingById[trollHandId!];
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
            '0',
            { monsterId: trollHandId, roomId: targetRoom!.id },
        );

        expect(resolveHelpingHandsMonsterTurnStatus(core).moveRemainingById[trollHandId!])
            .toBe(moveRemainingBefore - 2);
    });

it('大宅饿了结束巨魔手回合后才推进到揭秘者之后的下一名探索者', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN,
            '0',
            {},
        );

        expect(resolveHelpingHandsMonsterTurnStatus(core).active).toBe(false);
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.recentRoll).toBeNull();
    });

it('大宅饿了探索者击败巨魔手后，巨魔手仍在场且不能被击晕', () => {
        let core = createHelpingHandsHauntCore();
        activateTestExplorer(core, '1');
        const trollHand = core.monsters.find((monster) => monster.id === 'troll-hand-1');
        expect(trollHand).toBeDefined();
        core.currentExplorer.roomId = trollHand!.roomId;
        core.activeRoomId = trollHand!.roomId;
        setTestExplorerTraits(core, '1', { might: 5 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '1',
            { target: 'troll-hand', targetMonsterId: trollHand!.id },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 0, 0, 0, 0, 0),
        );

        expect(core.monsters.find((monster) => monster.id === trollHand!.id)).toMatchObject({
            id: trollHand!.id,
            roomId: trollHand!.roomId,
        });
        expect(core.recentRoll?.latestLabel).toBe('巨魔手不能被击晕');
        expect(core.activityLog.some((entry) => entry.text.includes('巨魔手不能被击晕'))).toBe(true);
    });

it('怪物受伤结果原语区分不可击晕、击晕和杀死', () => {
        const helpingHandsCore = createHelpingHandsHauntCore();
        const trollHandOutcome = resolveBetrayalMonsterDamageOutcome(helpingHandsCore, 'troll-hand-1', {
            damageAmount: 2,
            damageTrait: 'might',
        });

        expect(trollHandOutcome).toMatchObject({
            monsterId: 'troll-hand-1',
            name: '巨魔手',
            kind: 'resisted',
            previousStatus: 'active',
            nextStatus: 'active',
            canBeStunned: false,
            stunned: false,
            killed: false,
            removedFromHouse: false,
            logLabel: '巨魔手不能被击晕',
        });

        const magicCameraCore = createMagicCameraHauntCore('1');
        const [killMonsterId, stunMonsterId] = magicCameraCore.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(killMonsterId).toBeDefined();
        expect(stunMonsterId).toBeDefined();

        expect(resolveBetrayalMonsterDamageOutcome(magicCameraCore, killMonsterId!, {
            damageAmount: 2,
            damageTrait: 'might',
        })).toMatchObject({
            monsterId: killMonsterId,
            name: '幻影摄影师',
            kind: 'killed',
            previousStatus: 'active',
            nextStatus: 'killed',
            canBeStunned: true,
            stunned: false,
            killed: true,
            removedFromHouse: true,
            logLabel: '击杀幻影摄影师',
        });

        expect(resolveBetrayalMonsterDamageOutcome(magicCameraCore, stunMonsterId!, {
            damageAmount: 2,
            damageTrait: 'sanity',
        })).toMatchObject({
            monsterId: stunMonsterId,
            name: '幻影摄影师',
            kind: 'stunned',
            previousStatus: 'active',
            nextStatus: 'stunned',
            canBeStunned: true,
            stunned: true,
            killed: false,
            removedFromHouse: false,
            logLabel: '击晕幻影摄影师',
        });
    });
});
