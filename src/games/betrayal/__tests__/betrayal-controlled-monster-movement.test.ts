import { describe, expect, it } from 'vitest';
import { createDustFeverishControlReadyCore, createDustFeverishMovementRollReadyCore, createDustFeverishNaturalMonsterTurnBeforeRollCore } from '../testing/firstScenarioTestUtils';
import { rotateToNextLivingPlayer } from '../turnOrderReadModel';
import { resolveBetrayalMapMovementReadModel, resolveMoveTargetRooms } from '../movementReadModel';
import { resolveBetrayalMonsterMoveCost, resolveBetrayalMonsterMoveTargetRooms } from '../monsterActionReadModel';
import {
    acknowledgeRecentRollForAllPlayers,
    activateTestExplorer,
    applyBetrayalCommand,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
} from './helpers/firstScenarioRuntimeHarness';

function createTwoFeverishBeforeMonsterTurn() {
    const core = createDustFeverishNaturalMonsterTurnBeforeRollCore(['0', '1', '2', '3', '4', '5']);
    core.scenarioRuntime.hauntRevealerPlayerId = '2';
    core.scenarioRuntime.deadExplorerPlayerIds.push('3');
    core.scenarioRuntime.dust!.permanentTraitorPlayerIds.push('3');
    core.scenarioRuntime.dust!.feverishPlayerIds.push('3');
    const monster = core.monsters.find((entry) => entry.id === 'feverish-0')!;
    core.monsters.push({ ...monster, id: 'feverish-3' });
    return core;
}

describe('受控怪物移动骰', () => {
    it('狂热病患在作祟揭示者之后行动，而不是沿用其生前座位顺序', () => {
        const core = createDustFeverishControlReadyCore('0');
        core.scenarioRuntime.hauntRevealerPlayerId = '1';
        expect(rotateToNextLivingPlayer(core, '1')).toBe('0');
        expect(rotateToNextLivingPlayer(core, '0')).toBe('2');
        expect(rotateToNextLivingPlayer(core, '2')).toBe('1');
    });

    it('两名死亡叛徒的狂热病患都在揭示者之后连续行动', () => {
        const core = createDustFeverishControlReadyCore('0');
        core.scenarioRuntime.hauntRevealerPlayerId = '1';
        core.scenarioRuntime.deadExplorerPlayerIds.push('2');
        core.scenarioRuntime.dust!.feverishPlayerIds.push('2');
        const existing = core.monsters.find((monster) => monster.id === 'feverish-0')!;
        core.monsters.push({ ...existing, id: 'feverish-2' });
        expect(rotateToNextLivingPlayer(core, '1')).toBe('0');
        expect(rotateToNextLivingPlayer(core, '0')).toBe('2');
        expect(rotateToNextLivingPlayer(core, '2')).toBe('1');
    });

    it('揭示者结束回合后通过正式命令交给狂热病患', () => {
        let core = createDustFeverishControlReadyCore('0');
        core.scenarioRuntime.hauntRevealerPlayerId = '1';
        core.scenarioRuntime.dust!.exchangedSicknessThisTurnPlayerIds.push('1');
        activateTestExplorer(core, '1');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toMatchObject({ kind: 'monsterMoveRoll', playerId: '0' });
    });

    it('回合交接已经掷过狂热病患移动骰后，不得再为同类怪物掷骰', () => {
        let core = createDustFeverishMovementRollReadyCore();
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toMatchObject({ kind: 'monsterMoveRoll', playerId: '0' });
        const allowance = core.movesRemaining;
        core = acknowledgeRecentRollForAllPlayers(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '0', {
            monsterId: 'feverish-0',
        });
        const result = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP, '0', {
                groupId: '狂热病患:5',
            }),
        );
        expect(result.valid).toBe(false);
        expect(core.movesRemaining).toBe(allowance);
    });

    it('两名控制者各自移动时共用一次骰，保留独立移动额度', () => {
        let core = createTwoFeverishBeforeMonsterTurn();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {}, 100,
            createBetrayalScriptedRandom(3, 3, 1, 1, 1));
        expect(core.currentPlayer).toBe('0');
        const firstRoll = core.recentRoll!.dice;
        const allowance = core.movesRemaining;
        core = acknowledgeRecentRollForAllPlayers(core);
        const target = resolveMoveTargetRooms(core)[0]!;
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', { monsterId: 'feverish-3', roomId: target.id },
        )).valid).toBe(false);
        const firstMoveCost = resolveBetrayalMonsterMoveCost(core, 'feverish-0');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: target.id });
        expect(core.movesRemaining).toBe(allowance - firstMoveCost);
        const nextTarget = resolveBetrayalMonsterMoveTargetRooms(core, 'feverish-0')[0]!;
        const moveCost = resolveBetrayalMonsterMoveCost(core, 'feverish-0');
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '0', {
            monsterId: 'feverish-0', roomId: nextTarget.id,
        });
        expect(core.movesRemaining).toBe(allowance - firstMoveCost - moveCost);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {}, 200,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3));
        expect(core.currentPlayer).toBe('3');
        expect(core.movesRemaining).toBe(allowance);
        expect(core.scenarioRuntime.monsterTurn.movementRollsByGroupId['狂热病患:5'].dice).toEqual(firstRoll);
        expect(core.recentRoll).toBeNull();
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.END_TURN, '0', {},
        )).valid).toBe(false);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '3', { monsterId: 'feverish-0', roomId: target.id },
        )).valid).toBe(false);
    });

    it('第一只被击晕时跳过，第二只才为同类掷骰', () => {
        let core = createTwoFeverishBeforeMonsterTurn();
        core.scenarioRuntime.monsterStatusesById = { 'feverish-0': 'stunned' };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toBeNull();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '0', { monsterId: 'feverish-0' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {}, 200,
            createBetrayalScriptedRandom(2, 2, 1, 1, 1));
        expect(core.currentPlayer).toBe('3');
        expect(core.recentRoll).toMatchObject({ kind: 'monsterMoveRoll', playerId: '3', dice: [1, 1, 0, 0, 0] });
        expect(core.movesRemaining).toBe(2);
    });

    it('第二只被击晕时保留已掷结果并要求翻正后结束', () => {
        let core = createTwoFeverishBeforeMonsterTurn();
        core.scenarioRuntime.monsterStatusesById = { 'feverish-3': 'stunned' };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {}, 100,
            createBetrayalScriptedRandom(2, 2, 1, 1, 1));
        const dice = core.recentRoll!.dice;
        core = acknowledgeRecentRollForAllPlayers(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.currentPlayer).toBe('3');
        expect(core.recentRoll).toBeNull();
        expect(core.movesRemaining).toBe(0);
        expect(core.scenarioRuntime.monsterTurn.movementRollsByGroupId['狂热病患:5'].dice).toEqual(dice);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.END_TURN, '3', {},
        )).valid).toBe(false);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '3', { monsterId: 'feverish-3' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '3', {});
        expect(core.currentPlayer).toBe('4');
    });

    it('已击晕的狂热病患在怪物回合翻正并跳过，不得掷骰或移动', () => {
        let core = createDustFeverishNaturalMonsterTurnBeforeRollCore();
        core.scenarioRuntime.hauntRevealerPlayerId = '2';
        core.scenarioRuntime.monsterStatusesById = { ...core.scenarioRuntime.monsterStatusesById, 'feverish-0': 'stunned' };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('0');
        expect(core.recentRoll).toBeNull();
        expect(core.movesRemaining).toBe(0);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.END_TURN, '0', {},
        )).valid).toBe(false);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '0', { monsterId: 'feverish-0' });
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.END_TURN, '0', {},
        )).valid).toBe(true);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'entrance-hall' },
        )).valid).toBe(false);
    });

    it('受控怪物的地图移动与通用怪物移动使用相同离开代价', () => {
        let core = createDustFeverishMovementRollReadyCore();
        core = acknowledgeRecentRollForAllPlayers(core);
        const cost = resolveBetrayalMonsterMoveCost(core, 'feverish-0');
        expect(cost).toBe(2);
        const destination = resolveMoveTargetRooms(core)[0]!;
        core.movesRemaining = 1;
        expect(resolveBetrayalMapMovementReadModel(core).moveTargetRooms.length).toBeGreaterThan(0);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: destination.id },
        )).valid).toBe(true);
        core.scenarioRuntime.monsterTurn.movedMonsterIdsThisTurn.push('feverish-0');
        expect(resolveBetrayalMapMovementReadModel(core).moveTargetRooms).toHaveLength(0);
        expect(BetrayalDomain.validate({ core, sys: {} as never }, createBetrayalCommand(
            BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: destination.id },
        )).valid).toBe(false);
        core.scenarioRuntime.monsterTurn.movedMonsterIdsThisTurn = [];
        core.movesRemaining = 3;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: destination.id });
        expect(core.movesRemaining).toBe(1);
    });
});
