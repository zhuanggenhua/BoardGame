import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    playFirstScenarioToSurvivorVictory,
    playFirstScenarioToTraitorVictory,
} from '../testing/firstScenarioTestUtils';
import { BETRAYAL_COMMANDS, BetrayalDomain } from '../game';

describe('Betrayal first scenario runtime', () => {
    it('能在第三次恶兆且 haunt roll 达标后进入真实 haunt', () => {
        const core = createFirstScenarioHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('2');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.currentPlayer).toBe('0');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('首剧本起跑位就是真实运行时，不再保留手工结算口', () => {
        const core = createStartedFirstScenarioCore();

        expect(core.phase).toBe('preHaunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.name === '图书馆')).toBe(true);
    });

    it('英雄线可击倒叛徒、释放杰克之灵并完成驱魔结算', () => {
        const core = playFirstScenarioToSurvivorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(2);
        expect(core.endgameResult?.hauntTitle).toBe('Crimson Jack Returns');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['0', '1']);
    });

    it('叛徒线可以通过击倒全部英雄进入终局', () => {
        const core = playFirstScenarioToTraitorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.traitorPlayerId).toBe('2');
        expect(core.endgameResult?.winners).toEqual(['2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
    });

    it('恶兆不会在掷骰不足 5 时提前触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        const lowHauntRoll = createBetrayalScriptedRandom(1, 1, 1, 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, lowHauntRoll);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, lowHauntRoll);

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.scenarioRuntime.omensDiscovered).toBe(0);
        expect(core.latestDiscovery?.kind).toBe('item');
    });

    it('图书馆、驱魔法阵和驱魔失败都按真实投骰与伤害结算', () => {
        let core = createFirstScenarioHauntCore();
        const hauntActionRandom = createBetrayalScriptedRandom(
            1, 1, 1, 1, // 图书馆失败
            1, 1, 1, 1, // 驱魔法阵失败
            1, 1, 1, 1, 1, 1, // 驱魔失败
        );

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const sanityBeforeStudy = core.currentExplorer.traits.sanity;
        const knowledgeBeforeStudy = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(core.currentExplorer.traits.sanity + core.currentExplorer.traits.knowledge).toBe(
            sanityBeforeStudy + knowledgeBeforeStudy - 2,
        );

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'upper-north';
        const teammateBefore = core.otherExplorers.find((explorer) => explorer.playerId === '1');
        const actorBefore = { ...core.currentExplorer.traits };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntActionRandom);
        const teammateAfter = core.otherExplorers.find((explorer) => explorer.playerId === '1');

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBeLessThan(
            actorBefore.might + actorBefore.speed,
        );
        expect((teammateAfter?.traits.might ?? 0) + (teammateAfter?.traits.speed ?? 0)).toBeLessThan(
            (teammateBefore?.traits.might ?? 0) + (teammateBefore?.traits.speed ?? 0),
        );
    });

    it('最后一张恶兆会自动触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        core.exploreIndex = 2;
        core.deckCounts.omen = 1;
        core.currentExplorer.roomId = 'hallway';
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        const events = BetrayalDomain.execute({ core, sys: {} as never }, command, createBetrayalScriptedRandom(1));
        const roomExplored = events.find((event) => event.type === 'ROOM_EXPLORED');

        expect(roomExplored?.type).toBe('ROOM_EXPLORED');
        if (roomExplored?.type === 'ROOM_EXPLORED') {
            expect(roomExplored.payload.hauntTriggered).toBe(true);
        }
    });
});
