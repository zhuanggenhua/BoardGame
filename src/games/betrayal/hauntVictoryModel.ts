import { countDrawnCards } from './eventDeckModel';
import {
    findExplorerByPlayerId,
    getAllExplorers,
} from './explorerReadModel';
import {
    isBloodFromStoneHaunt,
    isDustHaunt,
    isHelpingHandsHaunt,
    isMagicCameraHaunt,
    resolveHelpingHandsControllerPlayerId,
    resolveLivingHeroExplorers,
} from './hauntScenarioReadModel';
import { canCompleteMummyTraitorVictory, createMummyEndgameResult } from './mummyHauntRules';
import { hasActiveBloodFromStoneStoneCherubs } from './monsterReadModel';
import { BETRAYAL_SCENARIO_CONFIGS, getBetrayalScenarioCardCandidate, type BetrayalScenarioOutcome } from './scenarioConfig';
import { shouldDeferDustTraitorVictoryForRabbitFoot } from './deathStateReadModel';
import type {
    BetrayalCore,
    BetrayalEndgameResult,
} from './game';

export function resolveCrimsonJackHauntTitle(): string {
    return getBetrayalScenarioCardCandidate('crimson-jack-returns').titleEn;
}

export function createBetrayalCrimsonJackTraitorVictoryResult(core: BetrayalCore): BetrayalEndgameResult {
    const traitorPlayerId = findExplorerByPlayerId(
        core,
        core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer,
    )?.playerId ?? core.currentExplorer.playerId;
    return {
        hauntId: 'crimson-jack-returns',
        hauntTitle: resolveCrimsonJackHauntTitle(),
        outcome: 'traitor',
        winners: [traitorPlayerId],
        traitorPlayerId,
        survivorsEscaped: [],
        reward: { stars: 0, omens: countDrawnCards(core, 'omen'), logs: 0 },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

export function createBetrayalCrimsonJackHeroVictoryResult(core: BetrayalCore): BetrayalEndgameResult {
    const livingHeroPlayerIds = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
        .map((explorer) => explorer.playerId);
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'crimson-jack-returns',
        hauntTitle: resolveCrimsonJackHauntTitle(),
        outcome: 'survivors',
        winners: livingHeroPlayerIds,
        traitorPlayerId: core.scenarioRuntime.traitorPlayerId ?? core.currentPlayer,
        survivorsEscaped: [...livingHeroPlayerIds],
        reward: {
            stars: scenario.completion.reward.stars,
            omens: Math.max(scenario.completion.reward.minimumOmens, countDrawnCards(core, 'omen')),
            logs: scenario.completion.reward.logs,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

export function resolveMummyTraitorVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    return canCompleteMummyTraitorVictory(core)
        ? createMummyEndgameResult(core, 'traitor')
        : null;
}

function createDustEndgameResult(core: BetrayalCore, outcome: BetrayalScenarioOutcome): BetrayalEndgameResult {
    const dust = core.scenarioRuntime.dust;
    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const traitorPlayerIds = dust?.permanentTraitorPlayerIds ?? [];
    const winners = outcome === 'traitor'
        ? traitorPlayerIds.filter((playerId) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId))
        : livingExplorers
            .filter((explorer) => !traitorPlayerIds.includes(explorer.playerId))
            .map((explorer) => explorer.playerId);
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'the-dust',
        hauntTitle: '灰尘',
        outcome,
        winners,
        traitorPlayerId: traitorPlayerIds[0] ?? '',
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenario.completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenario.completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

export function createDustSurvivorVictoryResult(core: BetrayalCore): BetrayalEndgameResult {
    return createDustEndgameResult(core, 'survivors');
}

function areAllLivingExplorersDustTraitorsOrDead(core: BetrayalCore): boolean {
    const dust = core.scenarioRuntime.dust;
    if (!dust) {
        return false;
    }
    return getAllExplorers(core).every((explorer) => (
        core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        || dust.permanentTraitorPlayerIds.includes(explorer.playerId)
    ));
}

export function resolveDustTraitorVictoryResult(
    core: BetrayalCore,
    options: { deferForRabbitFoot?: boolean } = {},
): BetrayalEndgameResult | null {
    if (!isDustHaunt(core) || !areAllLivingExplorersDustTraitorsOrDead(core)) {
        return null;
    }
    if (
        options.deferForRabbitFoot !== false
        && core.recentRoll?.kind === 'deathPrevention'
        && shouldDeferDustTraitorVictoryForRabbitFoot(core, core.recentRoll.playerId)
    ) {
        return null;
    }
    return createDustEndgameResult(core, 'traitor');
}

function createHelpingHandsEndgameResult(core: BetrayalCore, winnerPlayerId: string): BetrayalEndgameResult {
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'helping-hands',
        hauntTitle: '援手',
        outcome: 'solo',
        winners: [winnerPlayerId],
        traitorPlayerId: winnerPlayerId,
        survivorsEscaped: [winnerPlayerId],
        reward: {
            stars: scenario.completion.reward.stars,
            omens: countDrawnCards(core, 'omen'),
            logs: scenario.completion.reward.logs,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

export function resolveHelpingHandsSoloVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    if (!isHelpingHandsHaunt(core)) {
        return null;
    }
    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    if (livingExplorers.length !== 1) {
        return null;
    }
    const winner = livingExplorers[0]!;
    if (resolveHelpingHandsControllerPlayerId(core) !== winner.playerId) {
        return null;
    }
    return createHelpingHandsEndgameResult(core, winner.playerId);
}

export function createUponReflectionEndgameResult(
    core: BetrayalCore,
    outcome: 'survivors',
): BetrayalEndgameResult {
    const winners = getAllExplorers(core)
        .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
        .map((explorer) => explorer.playerId);
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'upon-reflection',
        hauntTitle: 'Upon Reflection',
        outcome,
        winners,
        traitorPlayerId: '',
        survivorsEscaped: [...winners],
        reward: {
            stars: scenario.completion.reward.stars,
            omens: countDrawnCards(core, 'omen'),
            logs: scenario.completion.reward.logs,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function createBloodFromStoneEndgameResult(
    core: BetrayalCore,
    outcome: 'survivors' | 'haunt',
): BetrayalEndgameResult {
    const livingHeroes = resolveLivingHeroExplorers(core);
    const livingHeroPlayerIds = new Set(livingHeroes.map((explorer) => explorer.playerId));
    const winners = outcome === 'survivors'
        ? core.playerIds.filter((playerId) => livingHeroPlayerIds.has(playerId))
        : [];
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'blood-from-a-stone',
        hauntTitle: '顽石之血',
        outcome,
        winners,
        traitorPlayerId: '',
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenario.completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenario.completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

function areAllBloodFromStoneHeroesDead(core: BetrayalCore): boolean {
    const heroes = getAllExplorers(core)
        .filter((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId);
    return heroes.length > 0
        && heroes.every((explorer) => core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId));
}

export function resolveBloodFromStoneHeroVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    if (!isBloodFromStoneHaunt(core) || hasActiveBloodFromStoneStoneCherubs(core)) {
        return null;
    }
    return createBloodFromStoneEndgameResult(core, 'survivors');
}

export function resolveBloodFromStoneHauntVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    if (!isBloodFromStoneHaunt(core) || !areAllBloodFromStoneHeroesDead(core)) {
        return null;
    }
    return createBloodFromStoneEndgameResult(core, 'haunt');
}

function createMagicCameraEndgameResult(core: BetrayalCore, outcome: BetrayalScenarioOutcome): BetrayalEndgameResult {
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId ?? '';
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const winners = outcome === 'traitor'
        ? [traitorPlayerId].filter(Boolean)
        : livingHeroes.map((explorer) => explorer.playerId);
    const scenario = BETRAYAL_SCENARIO_CONFIGS[core.scenarioId];
    return {
        hauntId: 'magic-camera',
        hauntTitle: '魔法相机',
        outcome,
        winners,
        traitorPlayerId,
        survivorsEscaped: outcome === 'survivors' ? winners : [],
        reward: {
            stars: outcome === 'survivors' ? scenario.completion.reward.stars : 0,
            omens: countDrawnCards(core, 'omen'),
            logs: outcome === 'survivors' ? scenario.completion.reward.logs : 0,
        },
        stats: {
            roomsExplored: core.rooms.filter((room) => room.state === 'discovered').length,
            omensDrawn: countDrawnCards(core, 'omen'),
            itemsDrawn: countDrawnCards(core, 'item'),
            eventsDrawn: countDrawnCards(core, 'event'),
        },
    };
}

export function resolveMagicCameraHeroVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    const magicCamera = core.scenarioRuntime.magicCamera;
    if (!isMagicCameraHaunt(core) || !magicCamera || !magicCamera.cameraDestroyed) {
        return null;
    }
    const allPhotographersKilled = magicCamera.phantomPhotographerIds.every((id) => (
        magicCamera.killedPhantomPhotographerIds.includes(id)
        || !core.monsters.some((monster) => monster.id === id)
    ));
    return allPhotographersKilled
        ? createMagicCameraEndgameResult(core, 'survivors')
        : null;
}

export function resolveMagicCameraTraitorVictoryResult(core: BetrayalCore): BetrayalEndgameResult | null {
    if (!isMagicCameraHaunt(core)) {
        return null;
    }
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    return livingHeroes.length === 0
        ? createMagicCameraEndgameResult(core, 'traitor')
        : null;
}
