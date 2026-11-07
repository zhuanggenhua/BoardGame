import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../src/engine/pipeline';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import { engineConfig, type BetrayalCore } from '../src/games/betrayal/game';
import { BETRAYAL_DISCOVERY_POOLS } from '../src/games/betrayal/scenarioConfig';
import {
    createStartedFirstScenarioCore,
    createBetrayalScriptedRandom,
} from '../src/games/betrayal/testing/firstScenarioTestUtils';
import {
    captureFreshBroadcast,
    createSyntheticMatch,
    SYNTHETIC_PLAYER_IDS,
} from './transportCapture';

function broadcastAfterRealDustChoice() {
    const match = createSyntheticMatch();
    const core = createStartedFirstScenarioCore(SYNTHETIC_PLAYER_IDS);
    const card = BETRAYAL_DISCOVERY_POOLS.events.find((entry) => entry.name === '一瓶微尘');
    if (!card?.effect) throw new Error('Expected the established optional-haunt event fixture.');
    core.currentExplorer.inventory = ['a', 'b', 'c'].map((suffix) => ({
        id: `synthetic-omen-${suffix}`,
        name: `Synthetic omen ${suffix}`,
        kind: 'omen' as const,
    }));
    core.currentExplorerInventory = core.currentExplorer.inventory;
    // Inject only the legal pending decision. The official command generates
    // the actual hidden setup, reducer state, action log and event stream.
    core.pendingEventChoice = {
        id: 'synthetic-optional-haunt-choice',
        playerId: '0',
        sourceTitle: card.name,
        eventDescription: card.text,
        effect: card.effect,
    };
    const result = executePipeline(
        engineConfig,
        { core, sys: createInitialSystemState(SYNTHETIC_PLAYER_IDS, engineConfig.systems, match.matchID) },
        { type: BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, playerId: '0', payload: { accept: true }, timestamp: 100 },
        createBetrayalScriptedRandom(3, 3, 3),
        SYNTHETIC_PLAYER_IDS,
    );
    expect(result.success, 'The official decision must execute successfully.').toBe(true);
    const authority = result.state.core as BetrayalCore;
    const setup = authority.pendingEventRollResolution?.dustSetup;
    expect(Boolean(setup), 'The fixture must reach the real pending secret setup.').toBe(true);
    expect(setup?.sicknessTokensByPlayerId['0']?.length).toBe(3);
    expect(result.state.sys.eventStream.entries.some((entry) => entry.event.type === 'EVENT_CHOICE_RESOLVED')).toBe(true);
    match.state = result.state;
    const before = JSON.stringify(match.state);
    const captured = captureFreshBroadcast(match);
    expect(JSON.stringify(match.state) === before, 'Projection must not mutate authority.').toBe(true);
    expect(captured.state.core.deckCounts).toEqual(authority.deckCounts);
    expect(JSON.stringify(captured.state.sys.actionLog).includes('dustSetup')).toBe(false);
    return captured;
}

describe('Betrayal ordinary-player broadcast: official hidden-haunt setup', () => {
    it('does not disclose another player\'s sickness values through pending setup', () => {
        const captured = broadcastAfterRealDustChoice();
        const tokens = captured.state.core.pendingEventRollResolution?.dustSetup?.sicknessTokensByPlayerId['0'] ?? [];
        const privateValueCount = tokens.filter((token) => typeof token.value === 'number').length;
        expect(privateValueCount, 'Pending setup disclosed another player\'s values.').toBe(0);
    });

    it('does not disclose another player\'s sickness values through retained event payloads', () => {
        const captured = broadcastAfterRealDustChoice();
        const privateValueCount = captured.state.sys.eventStream.entries.reduce((count, entry) => {
            const payload = entry.event.payload as { dustSetup?: { sicknessTokensByPlayerId?: Record<string, Array<{ value?: unknown }>> } };
            const tokens = payload.dustSetup?.sicknessTokensByPlayerId?.['0'] ?? [];
            return count + tokens.filter((token) => typeof token.value === 'number').length;
        }, 0);
        expect(privateValueCount, 'Event stream disclosed another player\'s values.').toBe(0);
    });
});
