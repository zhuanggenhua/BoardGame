/**
 * 大杀四方 - 基地和随从选择交互 E2E 测试
 * 
 * 验证目标：
 * 1. 基地选择交互不弹出 PromptOverlay 窗口
 * 2. 随从选择交互不弹出 PromptOverlay 窗口
 * 3. 可选目标高亮显示
 * 4. 直接点击目标完成选择
 * 5. 顶部显示交互标题横幅
 */

import type { Page } from '@playwright/test';
import { queueInteraction } from '../../src/engine/systems/InteractionSystem.ts';
import { initAllAbilities } from '../../src/games/smashup/abilities/index.ts';
import { createAbilityRuntimeSimpleChoice } from '../../src/games/smashup/domain/abilityRuntime.ts';
import { collectTriggers } from '../../src/games/smashup/domain/ongoingEffects.ts';
import {
    advanceSmashUpReactionSession,
    startSmashUpReactionSession,
} from '../../src/games/smashup/domain/reactionSession.ts';
import {
    createScoringBaseRef,
    createScoringSession,
    setScoringSession,
} from '../../src/games/smashup/domain/scoringSession.ts';
import { test, expect } from '../framework';
import { waitForTestHarness } from '../helpers/common';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import type { GameTestContext as __ThreeAxeFrameworkMarker } from '../framework';

type __ThreeAxeGameMarker = {
  openTestGame: (gameId: string) => Promise<void>;
  setupScene: (config: { gameId: string }) => Promise<void>;
};

const __ensureThreeAxesMarker = async (game: __ThreeAxeGameMarker) => {
  await game.openTestGame('smashup');
  await game.setupScene({ gameId: 'smashup' });
};
void __ensureThreeAxesMarker;

import {
    setupTwoPlayerMatch as setupOnlineMatch,
    cleanupTwoPlayerMatch,
    completeFactionSelectionCustom,
    waitForHandArea,
    FACTION,
} from './smashup-helpers';

const HOST_PLAYER_ID = '0';
const FIXED_SMASHUP_RANDOM = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};
const MISKATONIC_BASE_LEGACY_TEXT = '在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。';
const MISKATONIC_BASE_POD_TEXT = '每回合一次，在你于此打出一个随从后，你可以抽两张疯狂卡，或从你的手牌弃置一张疯狂卡来额外打出一张战术。';
const STEAMPUNK_TRICKSTER_PACKET_CORE = {
    players: {
        '0': {
            id: '0',
            vp: 0,
            hand: [
                { uid: 'c22', defId: 'trickster_brownie_pod', type: 'minion', owner: '0' },
                { uid: 'c35', defId: 'trickster_hideout_pod', type: 'action', owner: '0' },
                { uid: 'c4', defId: 'steampunk_steam_man_pod', type: 'minion', owner: '0' },
                { uid: 'c12', defId: 'steampunk_aggromotive_pod', type: 'action', owner: '0' },
                { uid: 'c16', defId: 'steampunk_change_of_venue_pod', type: 'action', owner: '0' },
            ],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['steampunks_pod', 'tricksters_pod'],
            sameNameMinionDefId: null,
        },
        '1': {
            id: '1',
            vp: 0,
            hand: [],
            deck: [],
            discard: [],
            minionsPlayed: 0,
            minionLimit: 1,
            actionsPlayed: 0,
            actionLimit: 1,
            factions: ['robots', 'wizards'],
        },
    },
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [
        { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
        { defId: 'base_the_factory', minions: [], ongoingActions: [] },
        { defId: 'base_great_library', minions: [], ongoingActions: [] },
    ],
    titans: [
        {
            uid: 'titan_0_tricksters_big_funny_giant',
            defId: 'tricksters_big_funny_giant',
            faction: 'tricksters',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        },
    ],
    enabledExpansions: ['titans'],
    baseDeck: [],
    baseDiscard: [],
    turnNumber: 1,
    nextUid: 81,
    cardsPlayedThisTurn: 0,
    powerCountersPlacedOnMinionsThisTurn: 0,
    turnDestroyedMinions: [],
};

async function applySmashUpStatePatch(
    matchId: string,
    page: Page,
    updater: (state: any) => any,
): Promise<void> {
    const currentState = await getMatchState(matchId, page);
    const nextState = normalizeInjectedMatchState(matchId, updater(currentState));
    await injectMatchState(matchId, nextState, page);
    await page.waitForTimeout(500);
}

function normalizeInjectedMatchState(matchId: string, state: any): any {
    const stripFunctionsDeep = (value: any): any => {
        if (typeof value === 'function') return undefined;
        if (Array.isArray(value)) {
            return value.map(item => stripFunctionsDeep(item));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }

        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            if (typeof entry === 'function') continue;
            result[key] = stripFunctionsDeep(entry);
        }
        return result;
    };

    const next = stripFunctionsDeep(state);
    const fallbackTurnOrder = Array.isArray(next.core?.turnOrder)
        ? [...next.core.turnOrder]
        : Object.keys(next.core?.players ?? {});
    const currentPlayerIndex = typeof next.sys?.currentPlayerIndex === 'number'
        ? next.sys.currentPlayerIndex
        : typeof next.core?.currentPlayerIndex === 'number'
            ? next.core.currentPlayerIndex
            : Math.max(0, fallbackTurnOrder.indexOf(next.core?.activePlayerId ?? HOST_PLAYER_ID));

    next.sys = {
        ...next.sys,
        matchId,
        turnOrder: Array.isArray(next.sys?.turnOrder) ? next.sys.turnOrder : fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.sys?.phase === 'string' ? next.sys.phase : next.core?.phase,
    };
    next.core = {
        ...next.core,
        turnOrder: fallbackTurnOrder,
        currentPlayerIndex,
        phase: typeof next.core?.phase === 'string' ? next.core.phase : next.sys.phase,
    };
    return next;
}

async function getClientInteractionSnapshot(page: Page) {
    return page.evaluate(() => {
        const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        const options = Array.isArray(current?.data?.options) ? current.data.options : [];
        return {
            interactionId: current?.id ?? null,
            sourceId: current?.data?.sourceId ?? null,
            phase: state?.sys?.phase ?? null,
            optionIds: options.map((option: any) => option?.id).filter((id: unknown) => typeof id === 'string'),
        };
    });
}

async function dispatchCurrentInteractionOption(page: Page, optionId: string) {
    await page.evaluate((targetOptionId) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const state = harness?.state?.get?.();
        const current = state?.sys?.interaction?.current;
        if (!harness?.command?.dispatch || !current?.id) {
            throw new Error('TestHarness command.dispatch or current interaction is unavailable');
        }
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: current.id,
                optionId: targetOptionId,
            },
        });
    }, optionId);
}

async function injectSteampunkTricksterPacketState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            ...structuredClone(STEAMPUNK_TRICKSTER_PACKET_CORE),
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-card-uid="c4"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]', { timeout: 5000 });
}

async function injectMiskatonicPodBaseState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['miskatonic_university_pod', 'ghosts_pod'],
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'robots'],
                },
            },
            bases: [
                { defId: 'base_miskatonic_university_base', minions: [], ongoingActions: [] },
                { defId: 'base_the_factory', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectMushroomInvisibleTurnStartState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [
                        makeInjectedCard('host-card-1', 'alien_scout', 'minion', HOST_PLAYER_ID),
                        makeInjectedCard('host-card-2', 'pirate_first_mate', 'minion', HOST_PLAYER_ID),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['robots', 'pirates'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            phase: 'endTurn',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_the_factory',
                    minions: [makeInjectedMinion('enemy-minion-1', 'robot_microbot_alpha', '1', '1', 1)],
                    ongoingActions: [],
                },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [
                {
                    uid: 'titan-invisible-ninja-1',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 2, enteredAt: 1 },
                },
            ],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 3,
            nextUid: 900,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            currentPlayerIndex: 1,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            resolution: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            _smashupStartTurnWindowActive: undefined,
            _waitForStartTurnInteractionReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            _waitForPostScoringReduce: undefined,
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectMushroomOpponentSproutTurnStartState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [
                        makeInjectedCard('sprout-deck-target', 'killer_plant_weed_eater', 'minion', '1'),
                    ],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['killer_plants', 'wizards'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            phase: 'endTurn',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_the_factory',
                    minions: [makeInjectedMinion('enemy-sprout', 'killer_plant_sprout', '1', '1', 2)],
                    ongoingActions: [],
                },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            enabledExpansions: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 8,
            nextUid: 901,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            currentPlayerIndex: 1,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            resolution: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            _smashupStartTurnWindowActive: undefined,
            _waitForStartTurnInteractionReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            _waitForPostScoringReduce: undefined,
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectMushroomOpponentBrideTurnStartState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [makeInjectedCard('bride-hand-minion', 'frankenstein_igor', 'minion', '1')],
                    deck: [],
                    discard: [makeInjectedCard('bride-discard-minion', 'frankenstein_lab_assistant', 'minion', '1')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['frankenstein', 'wizards'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            phase: 'endTurn',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_the_factory',
                    minions: [{
                        ...makeInjectedMinion('enemy-bride-target', 'frankenstein_igor', '1', '1', 2),
                        powerCounters: 1,
                    }],
                    ongoingActions: [],
                },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [{
                uid: 'opponent-bride-titan',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 9,
            nextUid: 902,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            currentPlayerIndex: 1,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            resolution: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            _smashupStartTurnWindowActive: undefined,
            _waitForStartTurnInteractionReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            _waitForPostScoringReduce: undefined,
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectMushroomOwnBrideTurnStartState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [makeInjectedCard('own-bride-hand-minion', 'frankenstein_igor', 'minion', '0')],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['frankenstein', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'wizards'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            phase: 'endTurn',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_the_factory',
                    minions: [makeInjectedMinion('enemy-own-bride-target', 'pirate_buccaneer', '1', '1', 4)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [{
                        ...makeInjectedMinion('own-bride-counter-target', 'frankenstein_lab_assistant', '0', '0', 2),
                        powerCounters: 1,
                    }],
                    ongoingActions: [],
                },
            ],
            titans: [{
                uid: 'own-bride-titan',
                defId: 'frankenstein_the_bride',
                faction: 'frankenstein',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 10,
            nextUid: 903,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            currentPlayerIndex: 1,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            resolution: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            _smashupStartTurnWindowActive: undefined,
            _waitForStartTurnInteractionReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            _waitForPostScoringReduce: undefined,
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectSacredCircleSameNameState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [
                        makeInjectedCard('hand-local', 'innsmouth_the_locals_pod', 'minion', HOST_PLAYER_ID),
                        makeInjectedCard('hand-zapbot', 'robot_zapbot_pod', 'minion', HOST_PLAYER_ID),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['innsmouth_pod', 'robots_pod'],
                    sameNameMinionDefId: null,
                    sameNameMinionRemaining: undefined,
                    baseLimitedMinionQuota: undefined,
                    baseLimitedSameNameRequired: undefined,
                    baseLimitedSameNameDefId: undefined,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['wizards', 'samurai'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                { defId: 'base_mushroom_kingdom', minions: [], ongoingActions: [] },
                {
                    defId: 'base_wizard_academy',
                    minions: [
                        makeInjectedMinion('locals-a', 'innsmouth_the_locals_pod', '0', '0', 2),
                        makeInjectedMinion('locals-b', 'innsmouth_the_locals_pod', '0', '0', 2),
                        makeInjectedMinion('locals-c', 'innsmouth_the_locals_pod', '0', '0', 2),
                    ],
                    ongoingActions: [
                        {
                            uid: 'oa-sacred-circle',
                            defId: 'innsmouth_sacred_circle_pod',
                            ownerId: '0',
                            talentUsed: false,
                        },
                    ],
                },
                {
                    defId: 'base_sakura_garden',
                    minions: [makeInjectedMinion('enemy-minion-1', 'samurai_bushi_pod', '1', '1', 4)],
                    ongoingActions: [],
                },
            ],
            titans: [
                {
                    uid: 'titan-dagon',
                    defId: 'innsmouth_dagon',
                    faction: 'innsmouth',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: true,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                },
            ],
            enabledExpansions: ['titans'],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 7,
            nextUid: 900,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-1"]', { timeout: 5000 });
}

async function injectTortugaRunnerUpSelectionState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_tortuga',
                    minions: [
                        makeInjectedMinion('tortuga-winner-rex', 'dino_king_rex', '0', '0', 7),
                        makeInjectedMinion('tortuga-winner-laser', 'dino_laser_triceratops', '0', '0', 4),
                        makeInjectedMinion('tortuga-winner-assassin', 'ninja_tiger_assassin', '0', '0', 4),
                        makeInjectedMinion('tortuga-winner-shinobi', 'ninja_shinobi', '0', '0', 3),
                        makeInjectedMinion('tortuga-runnerup-archmage', 'wizard_archmage', '1', '1', 4),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_secret_garden',
                    minions: [
                        makeInjectedMinion('runner-up-traveler', 'robot_hoverbot', '1', '1', 3),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_the_jungle', 'base_mushroom_kingdom'],
            baseDiscard: [],
            titans: [],
            enabledExpansions: [],
            turnNumber: 1,
            nextUid: 1200,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            triggerQueue: [],
            beforeScoringTriggeredBases: [],
            whenScoringTriggeredBases: [],
            afterScoringTriggeredBases: [],
            pendingAfterScoringSpecials: [],
            activeDuel: null,
            titanOngoingSuppressedUntilTurnEnd: [],
            rainborocTriggeredTurnByTitan: {},
            veryLargeBoulderTriggeredTurnByTitan: {},
            moonZeroThreeTriggeredTurnByTitan: {},
            titanMovedTurnByTitanUid: {},
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    }));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

function makeInjectedCard(uid: string, defId: string, type: 'minion' | 'action', owner: string) {
    return { uid, defId, type, owner };
}

function makeInjectedMinion(
    uid: string,
    defId: string,
    controller: string,
    owner: string,
    basePower: number,
    overrides?: Record<string, unknown>,
) {
    return {
        uid,
        defId,
        controller,
        owner,
        basePower,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        playedThisTurn: false,
        attachedActions: [],
        ...(overrides ?? {}),
    };
}

function createKrakenReactionChooseState(baseState: any) {
    initAllAbilities();

    const core = {
        ...(baseState?.core ?? {}),
        players: {
            ...(baseState?.core?.players ?? {}),
            '0': {
                ...(baseState?.core?.players?.['0'] ?? {}),
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'aliens'],
                sameNameMinionDefId: null,
            },
            '1': {
                ...(baseState?.core?.players?.['1'] ?? {}),
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['ninjas', 'robots'],
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [makeInjectedMinion('pirate-on-score', 'pirate_first_mate', '0', '0', 2)],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        titans: [{
            uid: 't-kraken-setaside',
            defId: 'pirates_the_kraken',
            faction: 'pirates',
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'setaside' },
        }],
        enabledExpansions: ['titans'],
        baseDeck: [],
        baseDiscard: [],
        turnNumber: 7,
        nextUid: 700,
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
        triggerQueue: [],
    };

    const frameId = 'kraken-after-scoring-frame';
    let state = {
        ...baseState,
        core,
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    };

    const queued = collectTriggers(core, 'afterScoring', {
        state: core,
        matchState: state,
        playerId: '0',
        baseIndex: 0,
        rankings: [{ playerId: '0', power: 10, vp: 3 }],
        frameId,
        sourceEventId: frameId,
        random: FIXED_SMASHUP_RANDOM,
        now: 75,
    });
    if (!queued) {
        throw new Error('无法构造海怪克拉肯 afterScoring trigger');
    }

    const krakenTrigger = queued.payload.triggers.find((entry) => entry?.sourceDefId === 'pirates_the_kraken');
    if (!krakenTrigger) {
        throw new Error('无法找到海怪克拉肯 trigger');
    }

    state = {
        ...state,
        core: {
            ...core,
            triggerQueue: queued.payload.triggers,
        },
        sys: {
            ...state.sys,
            interaction: { current: undefined, queue: [] },
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造海怪克拉肯计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-after',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });

    const interaction = createAbilityRuntimeSimpleChoice(
        'kraken-reaction-pass-window',
        '0',
        'ui.reaction_choose_optional_title',
        [
            {
                id: `trigger:${krakenTrigger.id}`,
                label: '海怪克拉肯',
                value: { kind: 'trigger', triggerId: krakenTrigger.id },
                displayMode: 'button',
            },
            {
                id: 'pass',
                label: '让过',
                value: { kind: 'pass' },
                displayMode: 'button',
            },
        ],
        {
            sourceId: 'smashup_reaction_choose',
            targetType: 'button',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );

    return queueInteraction(state, interaction);
}

function createChampionsReactionDirectState(baseState: any) {
    initAllAbilities();

    const core = {
        ...(baseState?.core ?? {}),
        players: {
            ...(baseState?.core?.players ?? {}),
            '0': {
                ...(baseState?.core?.players?.['0'] ?? {}),
                id: '0',
                vp: 0,
                hand: [
                    makeInjectedCard('champ-card', 'giant_ant_we_are_the_champions', 'action', HOST_PLAYER_ID),
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['giant_ants', 'vampires'],
                sameNameMinionDefId: null,
            },
            '1': {
                ...(baseState?.core?.players?.['1'] ?? {}),
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'ninjas'],
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    makeInjectedMinion('scoring-source', 'giant_ant_worker', '0', '0', 25, { powerCounters: 2 }),
                    makeInjectedMinion('scoring-rival', 'ninja_shinobi', '1', '1', 5),
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_central_brain',
                minions: [
                    makeInjectedMinion('support-minion', 'giant_ant_soldier', '0', '0', 3),
                ],
                ongoingActions: [],
            },
            { defId: 'base_pirate_cove', minions: [], ongoingActions: [] },
        ],
        titans: [],
        enabledExpansions: [],
        baseDeck: [],
        baseDiscard: [],
        turnNumber: 7,
        nextUid: 900,
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
        triggerQueue: [],
    };

    const frameId = 'champions-after-scoring-frame';
    let state = {
        ...baseState,
        core,
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造我们乃最强计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-after',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });
    const advanced = advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM, 75);
    if (!advanced?.state.sys.interaction?.current) {
        throw new Error('无法构造我们乃最强 afterScoring 响应窗口');
    }
    return advanced.state;
}

function createChampionsReactionNoTargetState(baseState: any) {
    initAllAbilities();

    const core = {
        ...(baseState?.core ?? {}),
        players: {
            ...(baseState?.core?.players ?? {}),
            '0': {
                ...(baseState?.core?.players?.['0'] ?? {}),
                id: '0',
                vp: 0,
                hand: [
                    makeInjectedCard('champ-card', 'giant_ant_we_are_the_champions', 'action', HOST_PLAYER_ID),
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['giant_ants', 'vampires'],
                sameNameMinionDefId: null,
            },
            '1': {
                ...(baseState?.core?.players?.['1'] ?? {}),
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'ninjas'],
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    makeInjectedMinion('scoring-source', 'giant_ant_worker', '0', '0', 25, { powerCounters: 2 }),
                    makeInjectedMinion('scoring-rival', 'ninja_shinobi', '1', '1', 5),
                ],
                ongoingActions: [],
            },
            { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] },
            { defId: 'base_pirate_cove', minions: [], ongoingActions: [] },
        ],
        titans: [],
        enabledExpansions: [],
        baseDeck: [],
        baseDiscard: [],
        turnNumber: 7,
        nextUid: 910,
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
        triggerQueue: [],
    };

    const frameId = 'champions-no-target-after-scoring-frame';
    let state = {
        ...baseState,
        core,
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造我们乃最强无目标计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-after',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });
    const advanced = advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM, 75);
    if (!advanced?.state.sys.interaction?.current) {
        throw new Error('无法构造我们乃最强无目标 afterScoring 响应窗口');
    }
    return advanced.state;
}

function createChampionsPassStickyState(baseState: any) {
    initAllAbilities();

    const core = {
        ...(baseState?.core ?? {}),
        players: {
            ...(baseState?.core?.players ?? {}),
            '0': {
                ...(baseState?.core?.players?.['0'] ?? {}),
                id: '0',
                vp: 0,
                hand: [
                    makeInjectedCard('p0-champs', 'giant_ant_we_are_the_champions', 'action', '0'),
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['giant_ants', 'vampires'],
                sameNameMinionDefId: null,
            },
            '1': {
                ...(baseState?.core?.players?.['1'] ?? {}),
                id: '1',
                vp: 0,
                hand: [
                    makeInjectedCard('p1-champs', 'giant_ant_we_are_the_champions', 'action', '1'),
                ],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['giant_ants', 'pirates'],
                sameNameMinionDefId: null,
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_jungle',
                minions: [
                    makeInjectedMinion('p0-source', 'giant_ant_worker', '0', '0', 3, { powerCounters: 4 }),
                    makeInjectedMinion('p1-source', 'giant_ant_soldier', '1', '1', 2, { powerCounters: 3 }),
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_great_library',
                minions: [
                    makeInjectedMinion('p0-target', 'alien_invader', '0', '0', 3),
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_the_hill',
                minions: [
                    makeInjectedMinion('p1-target', 'robot_microbot_alpha', '1', '1', 2),
                ],
                ongoingActions: [],
            },
        ],
        titans: [],
        enabledExpansions: [],
        baseDeck: [],
        baseDiscard: [],
        turnNumber: 8,
        nextUid: 920,
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
        turnDestroyedMinions: [],
        triggerQueue: [],
    };

    const frameId = 'champions-pass-sticky-after-scoring-frame';
    let state = {
        ...baseState,
        core,
        sys: {
            ...baseState.sys,
            phase: 'scoreBases',
            currentPlayerIndex: 0,
            flowHalted: false,
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
            scoredBaseIndices: undefined,
            smashupScoring: undefined,
            smashupReactionSession: undefined,
            smashupReactionStack: undefined,
            _waitForPostScoringReduce: undefined,
            _waitForScoreBasesInteractionReduce: undefined,
            resolution: undefined,
        },
    };

    const baseRef = createScoringBaseRef(state.core, 0);
    if (!baseRef) {
        throw new Error('无法构造让过粘性计分基地引用');
    }

    state = setScoringSession(state, {
        ...createScoringSession(state.core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    state = startSmashUpReactionSession(state, {
        frameId,
        frameKind: 'score-after',
        phase: 'optional',
        currentPlayerId: '0',
        activePlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'afterScoring',
    });
    const advanced = advanceSmashUpReactionSession(state, FIXED_SMASHUP_RANDOM, 75);
    if (!advanced?.state.sys.interaction?.current) {
        throw new Error('无法构造让过粘性 afterScoring 响应窗口');
    }
    return advanced.state;
}

async function injectAlienInteractionState(
    matchId: string,
    page: Page,
    config: {
        hostHand: Array<{ uid: string; defId: string; type: 'minion' | 'action'; owner: string }>;
        bases: Array<{ defId: string; minions: any[]; ongoingActions: any[] }>;
        baseDeck?: string[];
    },
): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: config.hostHand,
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: config.bases,
            titans: [],
            enabledExpansions: [],
            baseDeck: config.baseDeck ?? [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 500,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
}

async function injectKrakenReactionChooseState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => createKrakenReactionChooseState(state));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="su-rail-titan-t-kraken-setaside"]', { timeout: 5000 });
}

async function injectChampionsReactionDirectState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => createChampionsReactionDirectState(state));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
    await page.waitForSelector('[data-card-uid="champ-card"]', { timeout: 5000 });
}

async function injectChampionsReactionNoTargetState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => createChampionsReactionNoTargetState(state));
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
    await page.waitForSelector('[data-card-uid="champ-card"]', { timeout: 5000 });
}

async function injectChampionsReactionDeadlockState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => {
        const seeded = createChampionsReactionDirectState(state);
        return {
            ...seeded,
            core: {
                ...seeded.core,
                players: {
                    ...seeded.core.players,
                    '0': {
                        ...seeded.core.players['0'],
                        hand: [],
                    },
                },
            },
            sys: {
                ...seeded.sys,
                interaction: { current: undefined, queue: [] },
                responseWindow: {
                    current: {
                        ...(seeded.sys?.responseWindow?.current ?? {}),
                        id: 'forced-end-turn-deadlock-window',
                        responderQueue: ['0'],
                        currentResponderIndex: 0,
                        pendingInteractionId: undefined,
                    },
                },
            },
        };
    });
    await page.waitForSelector('[data-testid="base-zone-0"]', { timeout: 5000 });
}

async function injectCthulhuCorruptionState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [
                        makeInjectedCard('corruption-1', 'cthulhu_corruption', 'action', HOST_PLAYER_ID),
                        makeInjectedCard('fallback-minion-1', 'alien_scout', 'minion', HOST_PLAYER_ID),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 2,
                    factions: ['cthulhu', 'aliens'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        makeInjectedMinion('target-1', 'ninja_shinobi', '1', '1', 2),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            enabledExpansions: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 500,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
            madnessDeck: ['madness', 'madness', 'madness'],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
}

async function injectMinionHalfExpandedSelectionState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        makeInjectedMinion('half-expand-target-1', 'ninja_shinobi', '1', '1', 2),
                        makeInjectedMinion('half-expand-target-2', 'pirate_first_mate', '1', '1', 2),
                        makeInjectedMinion('half-expand-target-3', 'robot_microbot_alpha', '1', '1', 1),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            enabledExpansions: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 900,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: {
                current: {
                    id: 'half-expanded-minion-select',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '半展开验收：选择随从',
                        sourceId: 'half_expanded_minion_selection',
                        targetType: 'minion',
                        options: [
                            {
                                id: 'half-expand-target-1',
                                label: '目标 1',
                                value: { minionUid: 'half-expand-target-1', baseIndex: 0 },
                            },
                            {
                                id: 'half-expand-target-2',
                                label: '目标 2',
                                value: { minionUid: 'half-expand-target-2', baseIndex: 0 },
                            },
                            {
                                id: 'half-expand-target-3',
                                label: '目标 3',
                                value: { minionUid: 'half-expand-target-3', baseIndex: 0 },
                            },
                        ],
                    },
                },
                queue: [],
            },
        },
    }));
}

async function injectMinionStackComparisonBaseState(matchId: string, page: Page): Promise<void> {
    await applySmashUpStatePatch(matchId, page, (state) => ({
        ...state,
        core: {
            ...state.core,
            players: {
                ...(state.core?.players ?? {}),
                '0': {
                    ...(state.core?.players?.['0'] ?? {}),
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'pirates'],
                    sameNameMinionDefId: null,
                },
                '1': {
                    ...(state.core?.players?.['1'] ?? {}),
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['ninjas', 'robots'],
                    sameNameMinionDefId: null,
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            phase: 'playCards',
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        makeInjectedMinion('half-expand-target-1', 'ninja_shinobi', '1', '1', 2),
                        makeInjectedMinion('half-expand-target-2', 'pirate_first_mate', '1', '1', 2),
                        makeInjectedMinion('half-expand-target-3', 'robot_microbot_alpha', '1', '1', 1),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
            titans: [],
            enabledExpansions: [],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 900,
            cardsPlayedThisTurn: 0,
            powerCountersPlacedOnMinionsThisTurn: 0,
            turnDestroyedMinions: [],
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            interaction: { current: undefined, queue: [] },
        },
    }));
}

function getInteractionSourceId(state: any): string | null {
    return state?.sys?.interaction?.current?.data?.sourceId ?? null;
}

async function waitForInteractionSourceId(
    matchId: string,
    page: Page,
    sourceId: string,
    timeout = 5000,
): Promise<void> {
    await expect.poll(async () => {
        const state = await getMatchState(matchId, page);
        return getInteractionSourceId(state);
    }, { timeout }).toBe(sourceId);
}

async function waitForSelectableBase(page: Page, baseIndex: number, timeout = 5000): Promise<void> {
    await page.waitForFunction(
        (targetIndex) => {
            const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetIndex}"]`);
            if (!zone) return false;
            const nodes = [zone, ...Array.from(zone.querySelectorAll<HTMLElement>('*'))];
            return nodes.some((node) => {
                const className = node.getAttribute('class') ?? '';
                return className.includes('ring-green-300')
                    || className.includes('ring-green-400')
                    || className.includes('ring-emerald-400');
            });
        },
        baseIndex,
        { timeout },
    );
}

async function isBaseSelectable(page: Page, baseIndex: number): Promise<boolean> {
    return page.evaluate((targetIndex) => {
        const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetIndex}"]`);
        if (!zone) return false;
        const nodes = [zone, ...Array.from(zone.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-300')
                || className.includes('ring-green-400')
                || className.includes('ring-emerald-400');
        });
    }, baseIndex);
}

async function waitForSelectableMinion(page: Page, minionUid: string, timeout = 5000): Promise<void> {
    await page.waitForFunction((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        if (!minion) return false;
        const nodes = [minion, ...Array.from(minion.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, minionUid, { timeout });
}

async function isMinionSelectable(page: Page, minionUid: string): Promise<boolean> {
    return await page.evaluate((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        if (!minion) return false;
        const nodes = [minion, ...Array.from(minion.querySelectorAll<HTMLElement>('*'))];
        return nodes.some((node) => {
            const className = node.getAttribute('class') ?? '';
            return className.includes('ring-green-400') || className.includes('ring-green-300');
        });
    }, minionUid);
}

async function clickBaseZone(page: Page, baseIndex: number): Promise<void> {
    await page.evaluate((targetIndex) => {
        const zone = document.querySelector<HTMLElement>(`[data-testid="base-zone-${targetIndex}"]`);
        if (!zone) return;
        zone.click();
    }, baseIndex);
    await page.waitForTimeout(300);
}

async function clickMinion(page: Page, minionUid: string): Promise<void> {
    await page.evaluate((targetUid) => {
        const minion = document.querySelector<HTMLElement>(`[data-minion-uid="${targetUid}"]`);
        minion?.click();
    }, minionUid);
    await page.waitForTimeout(300);
}

async function respondCurrentInteraction(
    page: Page,
    payload: { optionId?: string; optionIds?: string[]; mergedValue?: unknown },
): Promise<void> {
    await page.evaluate((responsePayload) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        const interaction = harness?.state?.get?.()?.sys?.interaction?.current;
        if (!interaction) {
            throw new Error('当前没有可响应的交互');
        }
        harness.command.dispatch({
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: responsePayload,
        });
    }, payload);
    await page.waitForTimeout(300);
}

async function closeCardSpotlightIfOpen(
    page: Page,
    options?: { waitForAppearanceMs?: number },
): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    const closeButton = page.getByRole('button', { name: '关闭特写' }).first();
    const waitForAppearanceMs = options?.waitForAppearanceMs ?? 2000;

    const visible = await expect(spotlightQueue)
        .toBeVisible({ timeout: waitForAppearanceMs })
        .then(() => true)
        .catch(async () => spotlightQueue.isVisible().catch(() => false));
    if (!visible) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await closeButton.isVisible({ timeout: 300 }).catch(() => false)) {
            await closeButton.click({ force: true });
        }

        const hidden = await spotlightQueue.isHidden({ timeout: 800 }).catch(() => false);
        if (hidden) {
            return;
        }
    }

    await expect(spotlightQueue).toBeHidden({ timeout: 5000 });
}

async function triggerHandCardClickForReaction(
    page: Page,
    cardUid: string,
    options?: { expectBaseIndex?: number },
): Promise<void> {
    const card = page.locator(`[data-card-uid="${cardUid}"]`).first();
    await expect(card).toBeVisible({ timeout: 5000 });
    await card.click({ force: true });
    await page.waitForTimeout(300);

    const expectBaseIndex = options?.expectBaseIndex;
    if (typeof expectBaseIndex !== 'number') return;

    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    const enteredExpectedUi = await expect.poll(async () => {
        const baseSelectable = await isBaseSelectable(page, expectBaseIndex);
        const spotlightVisible = await spotlightQueue.isVisible().catch(() => false);
        return baseSelectable || spotlightVisible;
    }, { timeout: 1200 }).toBeTruthy().then(() => true).catch(() => false);

    if (enteredExpectedUi) return;

    await card.dispatchEvent('click');
    await page.waitForTimeout(300);
}

async function dispatchHarnessCommand(
    page: Page,
    playerId: '0' | '1',
    type: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await page.evaluate(async ({ commandType, commandPayload, commandPlayerId }) => {
        const harness = (window as any).__BG_TEST_HARNESS__;
        await harness.command.dispatch({
            type: commandType,
            playerId: commandPlayerId,
            payload: commandPayload,
        });
    }, {
        commandType: type,
        commandPayload: payload,
        commandPlayerId: playerId,
    });
    await page.waitForTimeout(300);
}

async function openForceActionsPanel(page: Page): Promise<void> {
    const mainFabButton = page.locator('[data-fab-id="chat"]');
    await expect(mainFabButton).toBeVisible({ timeout: 10000 });
    await mainFabButton.click();

    const forceActionsButton = page.locator('[data-fab-id="force-actions"]');
    await expect(forceActionsButton).toBeVisible({ timeout: 5000 });
    await forceActionsButton.click();

    await expect(page.getByTestId('fab-panel-force-actions')).toBeVisible({ timeout: 5000 });
}

async function drainPostResolutionFlow(
    matchId: string,
    hostPage: Page,
    guestPage: Page,
    timeout = 8000,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const state = await getMatchState(matchId, hostPage);
        const current = state?.sys?.interaction?.current ?? null;
        const currentSourceId = current?.data?.sourceId ?? null;

        if (currentSourceId === 'smashup_reaction_choose') {
            const currentPlayerId = current?.playerId as '0' | '1' | undefined;
            const options = Array.isArray(current?.data?.options) ? current.data.options as any[] : [];
            const option = options.find(entry => entry?.id === 'pass' || entry?.value?.kind === 'pass') ?? options[0];
            if (!currentPlayerId || !option?.id) break;
            await respondCurrentInteraction(currentPlayerId === '0' ? hostPage : guestPage, { optionId: option.id });
            continue;
        }

        const responseWindow = state?.sys?.responseWindow?.current ?? null;
        const responderQueue = Array.isArray(responseWindow?.responderQueue) ? responseWindow.responderQueue : [];
        const responderIndex = typeof responseWindow?.currentResponderIndex === 'number' ? responseWindow.currentResponderIndex : -1;
        const currentResponder = responderIndex >= 0 ? responderQueue[responderIndex] as '0' | '1' | undefined : undefined;
        if (!current && currentResponder && (currentResponder === '0' || currentResponder === '1')) {
            await dispatchHarnessCommand(currentResponder === '0' ? hostPage : guestPage, currentResponder, 'RESPONSE_PASS', {});
            continue;
        }

        if (!current && !responseWindow) {
            return;
        }
        await hostPage.waitForTimeout(150);
    }
    throw new Error('未能在限定时间内收口后续反应链');
}

const ONLINE_SELECTION_MATCHES: any[] = [];

async function createOnlineSelectionMatch(browser: any, testInfo: any) {
    const setup = await setupOnlineMatch(
        browser,
        testInfo.project.use.baseURL as string | undefined,
        { skipImageGate: true },
    );
    if (!setup) return null;

    await completeFactionSelectionCustom(
        setup.hostPage,
        setup.guestPage,
        [FACTION.ALIENS, FACTION.PIRATES],
        [FACTION.NINJAS, FACTION.ROBOTS],
    );
    await waitForHandArea(setup.hostPage);
    ONLINE_SELECTION_MATCHES.push(setup);
    return setup;
}

async function drainOnlineSelectionMatches(): Promise<void> {
    while (ONLINE_SELECTION_MATCHES.length > 0) {
        const setup = ONLINE_SELECTION_MATCHES.pop();
        if (setup) {
            await cleanupTwoPlayerMatch(setup);
        }
    }
}

test.describe('SmashUp Base/Minion Selection', () => {
    test.describe.configure({ timeout: 90000 });

    test.afterEach(async () => {
        await drainOnlineSelectionMatches();
    });

    test('基地选择：外星人地形改造 - 不弹窗，直接点击基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        // 等待测试工具就绪
        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('terraform-1', 'alien_terraform', 'action', HOST_PLAYER_ID)],
            baseDeck: ['base_central_brain', 'base_pirate_cove'],
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        });

        // 等待手牌渲染
        await page.waitForSelector('[data-card-uid="terraform-1"]', { timeout: 5000 });

        // 点击地形改造卡
        await page.click('[data-card-uid="terraform-1"]');
        const selectedCardShot = getEvidenceScreenshotPath(testInfo, 'terraform-card-selected', {
            filename: 'smashup-terraform-card-selected.png',
        });
        await page.locator('[data-card-uid="terraform-1"]').screenshot({ path: selectedCardShot });

        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableBase(page, 0);
        const baseHighlightShot = getEvidenceScreenshotPath(testInfo, 'terraform-base-highlight', {
            filename: 'smashup-terraform-base-highlight.png',
        });
        await page.screenshot({ path: baseHighlightShot, fullPage: false });
        await clickBaseZone(page, 0);

        await waitForInteractionSourceId(matchId, page, 'alien_terraform');
        await expect(promptOverlay).not.toBeVisible();

        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);

        await waitForInteractionSourceId(matchId, page, 'alien_terraform_choose_replacement');
        await expect(page.getByText('地形改造：从基地牌库中选择一张基地进行替换', { exact: true })).toBeVisible();
        const terraformReplacementShot = getEvidenceScreenshotPath(testInfo, 'terraform-replacement-prompt', {
            filename: 'smashup-terraform-replacement-prompt.png',
        });
        await page.screenshot({ path: terraformReplacementShot, fullPage: false });
    });

    test('随从选择：外星人至高霸主 - 不弹窗，直接点击随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('overlord-1', 'alien_supreme_overlord', 'minion', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2)],
                    ongoingActions: [],
                },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
                { defId: 'base_great_library', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="overlord-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="overlord-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'overlord-1');
        }, { timeout: 5000 }).toBe(true);
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'alien_supreme_overlord');
        await waitForSelectableMinion(page, 'minion-1');
        const minionHighlightShot = getEvidenceScreenshotPath(testInfo, 'overlord-minion-highlight', {
            filename: 'smashup-overlord-minion-highlight.png',
        });
        await page.screenshot({ path: minionHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(false);
        const state = await getMatchState(matchId, page);
        const base0Minions = state.core.bases[0].minions;
        expect(base0Minions).toHaveLength(1);
        expect(base0Minions[0].uid).toBe('overlord-1');
        const overlordResolvedShot = getEvidenceScreenshotPath(testInfo, 'overlord-resolved', {
            filename: 'smashup-overlord-resolved.png',
        });
        await page.screenshot({ path: overlordResolvedShot, fullPage: false });
    });

    test('随从选择：外星人收集者 - 不弹窗，直接点击随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('collector-1', 'alien_collector', 'minion', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_pirate_cove',
                    minions: [
                        makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2),
                        makeInjectedMinion('minion-2', 'dino_king_rex', '1', '1', 7),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
                { defId: 'base_tar_pits', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="collector-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="collector-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await waitForSelectableBase(page, 0);
        await clickBaseZone(page, 0);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'collector-1');
        }, { timeout: 5000 }).toBe(true);
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'alien_collector');
        await waitForSelectableMinion(page, 'minion-1');
        await expect.poll(async () => await isMinionSelectable(page, 'minion-2')).toBe(false);
        const collectorHighlightShot = getEvidenceScreenshotPath(testInfo, 'collector-minion-highlight', {
            filename: 'smashup-collector-minion-highlight.png',
        });
        await page.screenshot({ path: collectorHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(false);
        const state = await getMatchState(matchId, page);
        const base0Minions = state.core.bases[0].minions;
        expect(base0Minions.some((m: any) => m.uid === 'minion-1')).toBe(false);
        expect(base0Minions.some((m: any) => m.uid === 'collector-1')).toBe(true);
        expect(base0Minions.some((m: any) => m.uid === 'minion-2')).toBe(true);
        const collectorResolvedShot = getEvidenceScreenshotPath(testInfo, 'collector-resolved', {
            filename: 'smashup-collector-resolved.png',
        });
        await page.screenshot({ path: collectorResolvedShot, fullPage: false });
    });

    test('随从选择：腐化 - 不弹窗，直接点击场上随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);
        await injectCthulhuCorruptionState(matchId, page);

        await page.waitForSelector('[data-card-uid="corruption-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="corruption-1"]');
        await page.click('[data-card-uid="corruption-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForInteractionSourceId(matchId, page, 'cthulhu_corruption');
        await waitForSelectableMinion(page, 'target-1');

        const corruptionHighlightShot = getEvidenceScreenshotPath(testInfo, 'cthulhu-corruption-minion-highlight', {
            filename: 'smashup-cthulhu-corruption-minion-highlight.png',
        });
        await page.screenshot({ path: corruptionHighlightShot, fullPage: false });

        await clickMinion(page, 'target-1');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].minions.some((minion: any) => minion.uid === 'target-1');
        }, { timeout: 5000 }).toBe(false);

        await drainPostResolutionFlow(matchId, page, guestPage);

        const resolvedState = await getMatchState(matchId, page);
        expect(getInteractionSourceId(resolvedState)).toBeNull();
        expect(resolvedState.core.bases[0].minions.some((minion: any) => minion.uid === 'target-1')).toBe(false);
        expect(resolvedState.core.bases[0].minions).toHaveLength(0);
        expect(resolvedState.core.players['0'].hand.some((card: any) => card.defId === 'special_madness')).toBe(true);
        expect(resolvedState.core.players['0'].hand.some((card: any) => card.uid === 'fallback-minion-1')).toBe(true);

        const corruptionResolvedShot = getEvidenceScreenshotPath(testInfo, 'cthulhu-corruption-resolved', {
            filename: 'smashup-cthulhu-corruption-resolved.png',
        });
        await page.screenshot({ path: corruptionResolvedShot, fullPage: false });
    });

    test('随从选择展示：同列多个候选应半展开且仍可点击底部随从', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);
        await injectMinionStackComparisonBaseState(matchId, page);

        const normalStackShot = getEvidenceScreenshotPath(testInfo, 'normal-minion-selection-stack', {
            filename: 'smashup-normal-minion-selection-stack.png',
        });
        await page.screenshot({ path: normalStackShot, fullPage: false });

        await injectMinionHalfExpandedSelectionState(matchId, page);

        await expect(page.getByText('半展开验收：选择随从')).toBeVisible({ timeout: 5000 });
        await waitForSelectableMinion(page, 'half-expand-target-1');
        await waitForSelectableMinion(page, 'half-expand-target-2');
        await waitForSelectableMinion(page, 'half-expand-target-3');

        const minionOffsets = await page.evaluate(() => {
            const readOffset = (uid: string) => {
                const node = document.querySelector<HTMLElement>(`[data-minion-uid="${uid}"]`);
                return node?.style.marginTop ?? null;
            };
            return {
                second: readOffset('half-expand-target-2'),
                third: readOffset('half-expand-target-3'),
            };
        });
        expect(minionOffsets.second).toBe('-3.8515vw');
        expect(minionOffsets.third).toBe('-3.8515vw');

        const halfExpandedShot = getEvidenceScreenshotPath(testInfo, 'half-expanded-minion-selection', {
            filename: 'smashup-half-expanded-minion-selection.png',
        });
        await page.screenshot({ path: halfExpandedShot, fullPage: false });

        await clickMinion(page, 'half-expand-target-3');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.sys?.interaction?.current ?? null;
        }, { timeout: 5000 }).toBeNull();

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'half-expanded-minion-selection-resolved', {
            filename: 'smashup-half-expanded-minion-selection-resolved.png',
        });
        await page.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('基地选择：外星人入侵（第二步）- 不弹窗，直接点击基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);

        await injectAlienInteractionState(matchId, page, {
            hostHand: [makeInjectedCard('invasion-1', 'alien_invasion', 'action', HOST_PLAYER_ID)],
            bases: [
                {
                    defId: 'base_ninja_dojo',
                    minions: [makeInjectedMinion('minion-1', 'ninja_shinobi', '1', '1', 2)],
                    ongoingActions: [],
                },
                { defId: 'base_temple_of_goju', minions: [], ongoingActions: [] },
                { defId: 'base_tortuga', minions: [], ongoingActions: [] },
            ],
        });

        await page.waitForSelector('[data-card-uid="invasion-1"]', { timeout: 5000 });
        await page.click('[data-card-uid="invasion-1"]');
        const promptOverlay = page.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableMinion(page, 'minion-1');
        const invasionMinionHighlightShot = getEvidenceScreenshotPath(testInfo, 'invasion-minion-highlight', {
            filename: 'smashup-invasion-minion-highlight.png',
        });
        await page.screenshot({ path: invasionMinionHighlightShot, fullPage: false });
        await clickMinion(page, 'minion-1');
        await waitForInteractionSourceId(matchId, page, 'alien_invasion_choose_base');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableBase(page, 1);
        const invasionBaseHighlightShot = getEvidenceScreenshotPath(testInfo, 'invasion-base-highlight', {
            filename: 'smashup-invasion-base-highlight.png',
        });
        await page.screenshot({ path: invasionBaseHighlightShot, fullPage: false });
        await clickBaseZone(page, 1);
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[1].minions.some((minion: any) => minion.uid === 'minion-1');
        }, { timeout: 5000 }).toBe(true);
        const state = await getMatchState(matchId, page);
        expect(state.core.bases[1].minions.some((m: any) => m.uid === 'minion-1')).toBe(true);
        const invasionResolvedShot = getEvidenceScreenshotPath(testInfo, 'invasion-resolved', {
            filename: 'smashup-invasion-resolved.png',
        });
        await page.screenshot({ path: invasionResolvedShot, fullPage: false });
    });

    test('反馈复现：蒸汽朋克 + 魔法妖精在空基地局面下，随从/持续行动/泰坦都应能进入并完成打出链路', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;

        await waitForTestHarness(page);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-card-uid="c4"]');
        await page.click('[data-testid="base-zone-1"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[1].minions.some((m: any) => m.uid === 'c4');
        }, { timeout: 5000 }).toBe(true);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-card-uid="c12"]');
        await page.click('[data-testid="base-zone-0"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            return state.core.bases[0].ongoingActions.some((card: any) => card.defId === 'steampunk_aggromotive_pod');
        }, { timeout: 5000 }).toBe(true);

        await injectSteampunkTricksterPacketState(matchId, page);

        await page.click('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]');
        await page.click('[data-testid="base-zone-2"]');
        await expect.poll(async () => {
            const state = await getMatchState(matchId, page);
            const titan = state.core.titans.find((candidate: any) => candidate.uid === 'titan_0_tricksters_big_funny_giant');
            return titan?.location?.zone === 'base' && titan?.location?.baseIndex === 2;
        }, { timeout: 5000 }).toBe(true);
    });

    test('反馈复现（移动端横屏）："点击无反应"场景下，随从/持续行动/泰坦都应能完成点击打出', async ({ browser }, testInfo) => {
        test.setTimeout(120000);
        const baseURL = testInfo.project.use.baseURL as string | undefined;
        await clearEvidenceScreenshotsForTest(testInfo);
        const setup = await setupOnlineMatch(browser, baseURL, {
            contextOptions: {
                viewport: { width: 1280, height: 720 },
                isMobile: true,
                hasTouch: true,
            },
        });

        if (!setup) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage: page, guestPage, hostContext, guestContext, matchId } = setup;

        try {
            await completeFactionSelectionCustom(
                page,
                guestPage,
                [FACTION.PIRATES, FACTION.NINJAS],
                [FACTION.ALIENS, FACTION.ZOMBIES],
            );
            await waitForHandArea(page);
            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-card-uid="c4"]').tap();
            await page.locator('[data-testid="base-zone-1"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                return state.core.bases[1].minions.some((m: any) => m.uid === 'c4');
            }, { timeout: 5000 }).toBe(true);
            const minionShot = getEvidenceScreenshotPath(testInfo, 'mobile-minion-played', {
                filename: 'smashup-steampunks-tricksters-mobile-minion-played.png',
            });
            await page.screenshot({ path: minionShot, fullPage: false });

            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-card-uid="c12"]').tap();
            await page.locator('[data-testid="base-zone-0"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                return state.core.bases[0].ongoingActions.some((card: any) => card.defId === 'steampunk_aggromotive_pod');
            }, { timeout: 5000 }).toBe(true);
            const actionShot = getEvidenceScreenshotPath(testInfo, 'mobile-ongoing-played', {
                filename: 'smashup-steampunks-tricksters-mobile-ongoing-played.png',
            });
            await page.screenshot({ path: actionShot, fullPage: false });

            await injectSteampunkTricksterPacketState(matchId, page);

            await page.locator('[data-testid="su-rail-titan-titan_0_tricksters_big_funny_giant"]').tap();
            await page.locator('[data-testid="base-zone-2"]').tap();
            await expect.poll(async () => {
                const state = await getMatchState(matchId, page);
                const titan = state.core.titans.find((candidate: any) => candidate.uid === 'titan_0_tricksters_big_funny_giant');
                return titan?.location?.zone === 'base' && titan?.location?.baseIndex === 2;
            }, { timeout: 5000 }).toBe(true);
            const titanShot = getEvidenceScreenshotPath(testInfo, 'mobile-titan-played', {
                filename: 'smashup-steampunks-tricksters-mobile-titan-played.png',
            });
            await page.screenshot({ path: titanShot, fullPage: false });
        } finally {
            await cleanupTwoPlayerMatch({ hostPage: page, guestPage, hostContext, guestContext, matchId });
        }
    });

    test('POD 版米斯卡塔尼克大学：基地悬浮文案和放大预览都应跟随 POD 版本文本', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }
        const { hostPage: page, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);

        await waitForTestHarness(page);
        await injectMiskatonicPodBaseState(matchId, page);

        const baseZone = page.getByTestId('base-zone-0');
        await expect(baseZone).toBeVisible();
        await baseZone.hover();

        const podTextOnBoard = page.getByText(MISKATONIC_BASE_POD_TEXT, { exact: true });
        await expect(podTextOnBoard).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(MISKATONIC_BASE_LEGACY_TEXT, { exact: true })).toHaveCount(0);

        const boardShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-hover', {
            filename: 'smashup-miskatonic-pod-base-hover.png',
        });
        await page.screenshot({ path: boardShot, fullPage: false });
        const boardTextShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-hover-text', {
            filename: 'smashup-miskatonic-pod-base-hover-text.png',
        });
        await podTextOnBoard.screenshot({ path: boardTextShot });

        const inspectButton = baseZone.locator('button.cursor-zoom-in').first();
        await expect(inspectButton).toBeVisible({ timeout: 5000 });
        await inspectButton.click({ force: true });

        const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');
        const magnifyContent = page.getByTestId('su-card-magnify-content');
        await expect(magnifyOverlay).toBeVisible({ timeout: 5000 });
        await expect(magnifyContent).toHaveAttribute('data-card-type', 'base');
        await magnifyContent.hover();

        const podTextInMagnify = magnifyContent.getByText(MISKATONIC_BASE_POD_TEXT, { exact: true });
        await expect(podTextInMagnify).toBeVisible({ timeout: 5000 });
        await expect(magnifyContent.getByText(MISKATONIC_BASE_LEGACY_TEXT, { exact: true })).toHaveCount(0);

        const magnifyShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-magnify', {
            filename: 'smashup-miskatonic-pod-base-magnify.png',
        });
        await page.screenshot({ path: magnifyShot, fullPage: false });
        const magnifyTextShot = getEvidenceScreenshotPath(testInfo, 'miskatonic-pod-base-magnify-text', {
            filename: 'smashup-miskatonic-pod-base-magnify-text.png',
        });
        await podTextInMagnify.screenshot({ path: magnifyTextShot });
    });

    test('反馈复现：蘑菇王国 + Invisible Ninja 同回合开始时，应直接进入真实交互，不先弹结算顺序', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectMushroomInvisibleTurnStartState(matchId, hostPage);

        const injectedState = await getMatchState(matchId, hostPage);
        expect(injectedState?.core?.turnOrder?.[injectedState?.core?.currentPlayerIndex]).toBe('1');
        expect(injectedState?.sys?.phase).toBe('playCards');
        await expect.poll(async () => guestPage.evaluate(() => {
            const state = (window as any).__BG_TEST_HARNESS__?.state?.get?.();
            return {
                phase: state?.sys?.phase ?? null,
                currentPlayerId: state?.core?.turnOrder?.[state?.core?.currentPlayerIndex] ?? null,
            };
        }), { timeout: 8000 }).toEqual({
            phase: 'playCards',
            currentPlayerId: '1',
        });

        await guestPage.bringToFront();
        const finishButton = guestPage.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible({ timeout: 8000 });
        await finishButton.click({ force: true });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 12000 }).not.toBeNull();

        const firstState = await getMatchState(matchId, hostPage);
        const firstSourceId = firstState?.sys?.interaction?.current?.data?.sourceId ?? null;
        expect(firstSourceId).not.toBe('smashup_reaction_choose');
        expect(['base_mushroom_kingdom', 'titan_ninjas_invisible_ninja_start_turn']).toContain(firstSourceId);

        const firstPromptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-invisible-first-prompt', {
            filename: 'smashup-mushroom-invisible-first-prompt.png',
        });
        await hostPage.screenshot({ path: firstPromptShot, fullPage: false });

        for (let i = 0; i < 3; i += 1) {
            const liveState = await getMatchState(matchId, hostPage);
            const current = liveState?.sys?.interaction?.current ?? null;
            if (!current) break;

            const liveSourceId = current?.data?.sourceId ?? null;
            if (liveSourceId === 'smashup_reaction_choose') {
                const guestState = await getMatchState(matchId, guestPage);
                throw new Error(JSON.stringify({
                    loopIndex: i,
                    host: {
                        currentPlayerIndex: liveState?.core?.currentPlayerIndex ?? null,
                        phase: liveState?.sys?.phase ?? null,
                        interaction: liveState?.sys?.interaction?.current
                            ? {
                                playerId: liveState.sys.interaction.current.playerId,
                                sourceId: liveState.sys.interaction.current.data?.sourceId ?? null,
                                optionIds: Array.isArray(liveState.sys.interaction.current.data?.options)
                                    ? liveState.sys.interaction.current.data.options.map((option: { id?: string }) => option?.id ?? null)
                                    : [],
                            }
                            : null,
                        triggerQueue: Array.isArray(liveState?.core?.triggerQueue)
                            ? liveState.core.triggerQueue.map((trigger: { sourceDefId?: string; frameId?: string; resolutionClass?: string; mandatory?: boolean }) => ({
                                sourceDefId: trigger?.sourceDefId ?? null,
                                frameId: trigger?.frameId ?? null,
                                resolutionClass: trigger?.resolutionClass ?? null,
                                mandatory: trigger?.mandatory ?? null,
                            }))
                            : [],
                        frames: Array.isArray(liveState?.sys?.resolution?.frames)
                            ? liveState.sys.resolution.frames.map((frame: { id?: string; step?: string; metadata?: { smashupReactionSession?: unknown } }) => ({
                                id: frame?.id ?? null,
                                step: frame?.step ?? null,
                                hasReactionSession: Boolean(frame?.metadata?.smashupReactionSession),
                            }))
                            : [],
                    },
                    guest: {
                        currentPlayerIndex: guestState?.core?.currentPlayerIndex ?? null,
                        phase: guestState?.sys?.phase ?? null,
                        interaction: guestState?.sys?.interaction?.current
                            ? {
                                playerId: guestState.sys.interaction.current.playerId,
                                sourceId: guestState.sys.interaction.current.data?.sourceId ?? null,
                                optionIds: Array.isArray(guestState.sys.interaction.current.data?.options)
                                    ? guestState.sys.interaction.current.data.options.map((option: { id?: string }) => option?.id ?? null)
                                    : [],
                            }
                            : null,
                    },
                }, null, 2));
            }

            const options = Array.isArray(current?.data?.options)
                ? current.data.options as Array<{ id?: string }>
                : [];
            const skipId = options.find(option => option?.id === 'skip')?.id;
            expect(skipId).toBeTruthy();
            await respondCurrentInteraction(hostPage, { optionId: skipId });
        }

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            phase: 'playCards',
            sourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-invisible-resolved', {
            filename: 'smashup-mushroom-invisible-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectMushroomOpponentSproutTurnStartState(matchId, hostPage);

        await guestPage.bringToFront();
        const finishButton = guestPage.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible({ timeout: 8000 });
        await finishButton.click({ force: true });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 12000 }).toBe('base_mushroom_kingdom');

        const promptState = await getMatchState(matchId, hostPage);
        const triggerQueue = Array.isArray(promptState?.core?.triggerQueue)
            ? promptState.core.triggerQueue
            : [];
        expect(triggerQueue.some((trigger: { sourceDefId?: string }) => trigger?.sourceDefId === 'killer_plant_sprout')).toBe(false);
        expect(promptState?.sys?.interaction?.current?.data?.sourceId).not.toBe('smashup_reaction_choose');
        await expect(hostPage.getByText(/选择结算顺序/)).toHaveCount(0);
        await waitForSelectableMinion(hostPage, 'enemy-sprout', 8000);

        const promptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-opponent-sprout-field-selection', {
            filename: 'smashup-mushroom-opponent-sprout-field-selection.png',
        });
        await hostPage.screenshot({ path: promptShot, fullPage: false });

        await clickMinion(hostPage, 'enemy-sprout');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                sproutBaseIndex: state?.core?.bases?.findIndex((base: any) =>
                    Array.isArray(base?.minions)
                    && base.minions.some((minion: any) => minion?.uid === 'enemy-sprout'),
                ) ?? -1,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            sproutBaseIndex: 0,
            phase: 'playCards',
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-opponent-sprout-resolved', {
            filename: 'smashup-mushroom-opponent-sprout-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectMushroomOpponentBrideTurnStartState(matchId, hostPage);

        await guestPage.bringToFront();
        const finishButton = guestPage.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible({ timeout: 8000 });
        await finishButton.click({ force: true });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 12000 }).toBe('base_mushroom_kingdom');

        const promptState = await getMatchState(matchId, hostPage);
        const triggerQueue = Array.isArray(promptState?.core?.triggerQueue)
            ? promptState.core.triggerQueue
            : [];
        expect(triggerQueue.some((trigger: { sourceDefId?: string }) => trigger?.sourceDefId === 'frankenstein_the_bride')).toBe(false);
        expect(promptState?.sys?.interaction?.current?.data?.sourceId).not.toBe('smashup_reaction_choose');
        await expect(hostPage.getByText(/选择结算顺序/)).toHaveCount(0);
        await waitForSelectableMinion(hostPage, 'enemy-bride-target', 8000);

        const promptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-opponent-bride-field-selection', {
            filename: 'smashup-mushroom-opponent-bride-field-selection.png',
        });
        await hostPage.screenshot({ path: promptShot, fullPage: false });

        await clickMinion(hostPage, 'enemy-bride-target');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                minionBaseIndex: state?.core?.bases?.findIndex((base: any) =>
                    Array.isArray(base?.minions)
                    && base.minions.some((minion: any) => minion?.uid === 'enemy-bride-target'),
                ) ?? -1,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            minionBaseIndex: 0,
            phase: 'playCards',
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-opponent-bride-resolved', {
            filename: 'smashup-mushroom-opponent-bride-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectMushroomOwnBrideTurnStartState(matchId, hostPage);

        await guestPage.bringToFront();
        const finishButton = guestPage.getByTestId('su-end-turn-action-button');
        await expect(finishButton).toBeVisible({ timeout: 8000 });
        await finishButton.click({ force: true });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 12000 }).toBe('base_mushroom_kingdom');

        const promptState = await getMatchState(matchId, hostPage);
        const brideTrigger = Array.isArray(promptState?.core?.triggerQueue)
            ? promptState.core.triggerQueue.find((trigger: { sourceDefId?: string }) => trigger?.sourceDefId === 'frankenstein_the_bride')
            : undefined;
        expect(brideTrigger?.resolutionClass).toBe('optional');
        expect(promptState?.sys?.interaction?.current?.data?.sourceId).not.toBe('smashup_reaction_choose');
        await expect(hostPage.getByText(/选择结算顺序/)).toHaveCount(0);
        await waitForSelectableMinion(hostPage, 'enemy-own-bride-target', 8000);

        const promptShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-field-selection', {
            filename: 'smashup-mushroom-own-bride-field-selection.png',
        });
        await hostPage.screenshot({ path: promptShot, fullPage: false });

        await clickMinion(hostPage, 'enemy-own-bride-target');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                minionBaseIndex: state?.core?.bases?.findIndex((base: any) =>
                    Array.isArray(base?.minions)
                    && base.minions.some((minion: any) => minion?.uid === 'enemy-own-bride-target'),
                ) ?? -1,
                brideStillQueuedAsOptional: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) =>
                        trigger?.sourceDefId === 'frankenstein_the_bride'
                        && trigger?.resolutionClass === 'optional',
                    )
                    : false,
            };
        }, { timeout: 8000 }).toEqual({
            minionBaseIndex: 0,
            brideStillQueuedAsOptional: true,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-mushroom-resolved', {
            filename: 'smashup-mushroom-own-bride-mushroom-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return state?.sys?.interaction?.current?.data?.sourceId ?? null;
        }, { timeout: 8000 }).toBe('smashup_reaction_choose');

        const brideTitan = hostPage.getByTestId('su-rail-titan-own-bride-titan');
        await expect(brideTitan).toBeVisible({ timeout: 8000 });
        await expect(hostPage.getByTestId('su-rail-titan-badge-own-bride-titan')).toContainText(/可触发|React/);
        await expect(hostPage.getByText(/选择一个反应动作|Choose a reaction/)).toHaveCount(0);
        const passButton = hostPage.getByTestId('su-titan-reaction-pass-button');
        await expect(passButton).toBeVisible();
        const clientBeforeClick = await getClientInteractionSnapshot(hostPage);
        const serverBeforeClick = await getMatchState(matchId, hostPage);
        const serverBeforeClickSnapshot = {
            interactionId: serverBeforeClick?.sys?.interaction?.current?.id ?? null,
            sourceId: serverBeforeClick?.sys?.interaction?.current?.data?.sourceId ?? null,
            phase: serverBeforeClick?.sys?.phase ?? null,
            optionIds: Array.isArray(serverBeforeClick?.sys?.interaction?.current?.data?.options)
                ? serverBeforeClick.sys.interaction.current.data.options
                    .map((option: any) => option?.id)
                    .filter((id: unknown) => typeof id === 'string')
                : [],
        };
        expect(clientBeforeClick).toEqual(serverBeforeClickSnapshot);

        const titanWindowShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-pass-window', {
            filename: 'smashup-mushroom-own-bride-pass-window.png',
        });
        await hostPage.screenshot({ path: titanWindowShot, fullPage: false });

        await passButton.click({ force: true });
        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                brideStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'frankenstein_the_bride')
                    : false,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            brideStillQueued: false,
            phase: 'playCards',
        });

        const brideBranchShot = getEvidenceScreenshotPath(testInfo, 'mushroom-own-bride-after-pass', {
            filename: 'smashup-mushroom-own-bride-after-pass.png',
        });
        await hostPage.screenshot({ path: brideBranchShot, fullPage: false });
    });

    test('反馈复现：海怪克拉肯高亮反应面板点击让过后，应立即收口且不重开', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectKrakenReactionChooseState(matchId, hostPage);

        await waitForInteractionSourceId(matchId, hostPage, 'smashup_reaction_choose', 8000);
        await expect(hostPage.getByTestId('su-rail-titan-t-kraken-setaside')).toBeVisible({ timeout: 8000 });
        const passButton = hostPage.getByTestId('su-titan-reaction-pass-button');
        await expect(passButton).toBeVisible({ timeout: 8000 });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const options = Array.isArray(state?.sys?.interaction?.current?.data?.options)
                ? state.sys.interaction.current.data.options
                : [];
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                optionIds: options.map((option: { id?: string }) => option?.id ?? null),
                krakenStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
                    : false,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: 'smashup_reaction_choose',
            optionIds: expect.arrayContaining([
                'pass',
                expect.stringMatching(/^trigger:afterScoring:pirates_the_kraken:/),
            ]),
            krakenStillQueued: true,
        });

        const promptShot = getEvidenceScreenshotPath(testInfo, 'kraken-reaction-pass-window', {
            filename: 'smashup-kraken-reaction-pass-window.png',
        });
        await hostPage.screenshot({ path: promptShot, fullPage: false });

        await passButton.click();

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                krakenStillQueued: Array.isArray(state?.core?.triggerQueue)
                    ? state.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
                    : false,
                phase: state?.sys?.phase ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: null,
            responseWindowOpen: false,
            krakenStillQueued: false,
            phase: 'scoreBases',
        });

        await hostPage.waitForTimeout(1200);
        const settledState = await getMatchState(matchId, hostPage);
        expect(settledState?.sys?.interaction?.current?.data?.sourceId ?? null).toBeNull();
        expect(Boolean(settledState?.sys?.responseWindow?.current)).toBe(false);
        expect(Array.isArray(settledState?.core?.triggerQueue)
            ? settledState.core.triggerQueue.some((trigger: any) => trigger?.sourceDefId === 'pirates_the_kraken')
            : false).toBe(false);

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'kraken-reaction-pass-resolved', {
            filename: 'smashup-kraken-reaction-pass-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈回归：计分后响应应保持手牌承接，并显示 MeFirst 提示弹窗', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectChampionsReactionDirectState(matchId, hostPage);

        await waitForInteractionSourceId(matchId, hostPage, 'smashup_reaction_choose', 8000);
        await expect(hostPage.locator('[data-testid="prompt-overlay"]')).toHaveCount(0);
        await expect(hostPage.locator('[data-testid="me-first-overlay"]')).toBeVisible();
        await expect(hostPage.getByText('计分后响应')).toBeVisible();
        await expect(hostPage.locator('[data-testid="me-first-pass-button"]')).toBeVisible();
        await expect(hostPage.locator('[data-card-uid="champ-card"]')).toBeVisible();
        const beforeClickShot = getEvidenceScreenshotPath(testInfo, 'champions-mefirst-before-click', {
            filename: 'smashup-champions-mefirst-before-click.png',
        });
        await hostPage.screenshot({ path: beforeClickShot, fullPage: false });

        await triggerHandCardClickForReaction(hostPage, 'champ-card', { expectBaseIndex: 0 });
        await waitForSelectableBase(hostPage, 0, 8000);
        const baseSelectShot = getEvidenceScreenshotPath(testInfo, 'champions-mefirst-base-highlight', {
            filename: 'smashup-champions-mefirst-base-highlight.png',
        });
        await hostPage.screenshot({ path: baseSelectShot, fullPage: false });
        await clickBaseZone(hostPage, 0);
        await waitForInteractionSourceId(matchId, hostPage, 'giant_ant_we_are_the_champions_choose_source', 8000);

        const chooseSourceShot = getEvidenceScreenshotPath(testInfo, 'champions-mefirst-choose-source', {
            filename: 'smashup-champions-mefirst-choose-source.png',
        });
        await hostPage.screenshot({ path: chooseSourceShot, fullPage: false });

        await clickMinion(hostPage, 'scoring-source');
        await waitForInteractionSourceId(matchId, hostPage, 'giant_ant_we_are_the_champions_choose_target', 8000);
        await clickMinion(hostPage, 'support-minion');
        await waitForInteractionSourceId(matchId, hostPage, 'giant_ant_we_are_the_champions_choose_amount', 8000);

        const slider = hostPage.getByLabel(/slider-choice|滑杆选择/i);
        await expect(slider).toBeVisible();
        await slider.evaluate((element) => {
            const input = element as HTMLInputElement;
            input.value = '2';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const chooseAmountShot = getEvidenceScreenshotPath(testInfo, 'champions-mefirst-choose-amount', {
            filename: 'smashup-champions-mefirst-choose-amount.png',
        });
        await hostPage.screenshot({ path: chooseAmountShot, fullPage: false });

        await respondCurrentInteraction(hostPage, {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 2, value: 2 },
        });
        await drainPostResolutionFlow(matchId, hostPage, guestPage, 12000);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const supportMinion = state?.core?.bases?.[1]?.minions?.find((minion: any) => minion.uid === 'support-minion');
            return {
                interactionSourceId: getInteractionSourceId(state),
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                supportCounters: supportMinion?.powerCounters ?? 0,
                stillInHand: state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'champ-card') ?? false,
                inDiscard: state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'champ-card') ?? false,
            };
        }, { timeout: 12000 }).toEqual({
            interactionSourceId: null,
            responseWindowOpen: false,
            supportCounters: 2,
            stillInHand: false,
            inDiscard: true,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'champions-mefirst-resolved', {
            filename: 'smashup-champions-mefirst-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈回归：计分后响应卡死且无可让过时，强制结束回合应直接收口到下一玩家', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectChampionsReactionDeadlockState(matchId, hostPage);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowId: state?.sys?.responseWindow?.current?.id ?? null,
                currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            phase: 'scoreBases',
            interactionSourceId: null,
            responseWindowId: 'forced-end-turn-deadlock-window',
            currentPlayerIndex: 0,
        });

        await openForceActionsPanel(hostPage);
        const forceEndTurnButton = hostPage.getByTestId('hud-force-dismiss-popup');
        await expect(forceEndTurnButton).toContainText('强制结束回合');
        const stuckShot = getEvidenceScreenshotPath(testInfo, 'scorebases-force-end-turn-stuck', {
            filename: 'smashup-scorebases-force-end-turn-stuck.png',
        });
        await hostPage.screenshot({ path: stuckShot, fullPage: false });

        await forceEndTurnButton.click();

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                phase: state?.sys?.phase ?? null,
                currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                interactionSourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 12000 }).toEqual({
            phase: 'playCards',
            currentPlayerIndex: 1,
            responseWindowOpen: false,
            interactionSourceId: null,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'scorebases-force-end-turn-resolved', {
            filename: 'smashup-scorebases-force-end-turn-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈回归：我们乃最强在没有合法接收目标时，应直接给出反馈并自动收口', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await injectChampionsReactionNoTargetState(matchId, hostPage);

        await waitForInteractionSourceId(matchId, hostPage, 'smashup_reaction_choose', 8000);
        await expect(hostPage.locator('[data-testid="me-first-overlay"]')).toBeVisible();
        await expect(hostPage.locator('[data-card-uid="champ-card"]')).toBeVisible();

        const beforeClickShot = getEvidenceScreenshotPath(testInfo, 'champions-no-target-before-click', {
            filename: 'smashup-champions-no-target-before-click.png',
        });
        await hostPage.screenshot({ path: beforeClickShot, fullPage: false });

        await triggerHandCardClickForReaction(hostPage, 'champ-card', { expectBaseIndex: 0 });
        await waitForSelectableBase(hostPage, 0, 8000);
        const baseSelectShot = getEvidenceScreenshotPath(testInfo, 'champions-no-target-base-highlight', {
            filename: 'smashup-champions-no-target-base-highlight.png',
        });
        await hostPage.screenshot({ path: baseSelectShot, fullPage: false });
        await clickBaseZone(hostPage, 0);
        await hostPage.waitForTimeout(500);
        await expect(hostPage.getByText(/没有可用目标|场上没有符合条件的目标/)).toBeVisible({ timeout: 8000 });
        await expect(hostPage.getByText(/选择一个反应动作|Choose a reaction/)).toHaveCount(0);
        const immediateShot = getEvidenceScreenshotPath(testInfo, 'champions-no-target-after-base-click', {
            filename: 'smashup-champions-no-target-after-base-click.png',
        });
        await hostPage.screenshot({ path: immediateShot, fullPage: false });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                interactionSourceId: getInteractionSourceId(state),
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                stillInHand: state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'champ-card') ?? false,
                inDiscard: state?.core?.players?.['0']?.discard?.some((card: any) => card.uid === 'champ-card') ?? false,
            };
        }, { timeout: 12000 }).toEqual({
            interactionSourceId: null,
            responseWindowOpen: false,
            stillInHand: false,
            inDiscard: true,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'champions-no-target-resolved', {
            filename: 'smashup-champions-no-target-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈回归：同一基地计分响应里 0 号位让过后，1 号位出牌不应再把 0 号位拉回二次让过', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, guestPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await waitForTestHarness(guestPage);
        await applySmashUpStatePatch(matchId, hostPage, (state) => createChampionsPassStickyState(state));

        await waitForInteractionSourceId(matchId, hostPage, 'smashup_reaction_choose', 8000);
        await expect(hostPage.locator('[data-testid="me-first-pass-button"]')).toBeVisible();
        await expect(hostPage.locator('[data-card-uid="p0-champs"]')).toBeVisible();
        const beforePassShot = getEvidenceScreenshotPath(testInfo, 'champions-pass-sticky-before-pass', {
            filename: 'smashup-champions-pass-sticky-before-pass.png',
        });
        await hostPage.screenshot({ path: beforePassShot, fullPage: false });

        await hostPage.locator('[data-testid="me-first-pass-button"]').click();

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                sourceId: getInteractionSourceId(state),
                playerId: state?.sys?.interaction?.current?.playerId ?? null,
            };
        }, { timeout: 8000 }).toEqual({
            sourceId: 'smashup_reaction_choose',
            playerId: '1',
        });

        await expect(guestPage.locator('[data-card-uid="p1-champs"]')).toBeVisible({ timeout: 8000 });
        const playerOneTurnShot = getEvidenceScreenshotPath(testInfo, 'champions-pass-sticky-player-one-turn', {
            filename: 'smashup-champions-pass-sticky-player-one-turn.png',
        });
        await guestPage.screenshot({ path: playerOneTurnShot, fullPage: false });

        await triggerHandCardClickForReaction(guestPage, 'p1-champs', { expectBaseIndex: 0 });
        await waitForSelectableBase(guestPage, 0, 8000);
        await clickBaseZone(guestPage, 0);
        await waitForInteractionSourceId(matchId, guestPage, 'giant_ant_we_are_the_champions_choose_source', 8000);
        await clickMinion(guestPage, 'p1-source');
        await waitForInteractionSourceId(matchId, guestPage, 'giant_ant_we_are_the_champions_choose_target', 8000);
        await clickMinion(guestPage, 'p1-target');
        await waitForInteractionSourceId(matchId, guestPage, 'giant_ant_we_are_the_champions_choose_amount', 8000);

        const slider = guestPage.getByLabel(/slider-choice|滑杆选择/i);
        await expect(slider).toBeVisible();
        await slider.evaluate((element) => {
            const input = element as HTMLInputElement;
            input.value = '3';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await respondCurrentInteraction(guestPage, {
            optionId: 'confirm-transfer',
            mergedValue: { amount: 3, value: 3 },
        });

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                interactionSourceId: getInteractionSourceId(state),
                interactionPlayerId: state?.sys?.interaction?.current?.playerId ?? null,
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                p0StillInHand: state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'p0-champs') ?? false,
                p1InDiscard: state?.core?.players?.['1']?.discard?.some((card: any) => card.uid === 'p1-champs') ?? false,
            };
        }, { timeout: 12000 }).toEqual({
            interactionSourceId: null,
            interactionPlayerId: null,
            responseWindowOpen: false,
            p0StillInHand: true,
            p1InDiscard: true,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'champions-pass-sticky-resolved', {
            filename: 'smashup-champions-pass-sticky-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

        const { hostPage, matchId } = smashupMatch;
        await clearEvidenceScreenshotsForTest(testInfo);
        await waitForTestHarness(hostPage);
        await injectSacredCircleSameNameState(matchId, hostPage);

        await hostPage.locator('[data-ongoing-uid="oa-sacred-circle"]').click();

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                talentUsed: state?.core?.bases?.[1]?.ongoingActions?.find((card: any) => card.uid === 'oa-sacred-circle')?.talentUsed ?? null,
                quota: state?.core?.players?.['0']?.baseLimitedMinionQuota?.[1] ?? 0,
                sameNameRequired: state?.core?.players?.['0']?.baseLimitedSameNameRequired?.[1] ?? false,
            };
        }, { timeout: 8000 }).toEqual({
            talentUsed: true,
            quota: 1,
            sameNameRequired: true,
        });

        const usedShot = getEvidenceScreenshotPath(testInfo, 'sacred-circle-used', {
            filename: 'smashup-sacred-circle-used.png',
        });
        await hostPage.screenshot({ path: usedShot, fullPage: false });

        await hostPage.locator('[data-card-uid="hand-local"]').click();
        await waitForSelectableBase(hostPage, 1, 5000);

        const highlightShot = getEvidenceScreenshotPath(testInfo, 'sacred-circle-highlight', {
            filename: 'smashup-sacred-circle-highlight.png',
        });
        await hostPage.screenshot({ path: highlightShot, fullPage: false });

        await clickBaseZone(hostPage, 1);

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            return {
                minionOnBase: state?.core?.bases?.[1]?.minions?.some((minion: any) => minion.uid === 'hand-local') ?? false,
                stillInHand: state?.core?.players?.['0']?.hand?.some((card: any) => card.uid === 'hand-local') ?? false,
                quota: state?.core?.players?.['0']?.baseLimitedMinionQuota?.[1] ?? 0,
            };
        }, { timeout: 8000 }).toEqual({
            minionOnBase: true,
            stillInHand: false,
            quota: 0,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'sacred-circle-resolved', {
            filename: 'smashup-sacred-circle-resolved.png',
        });
        await hostPage.screenshot({ path: resolvedShot, fullPage: false });
    });

    test('反馈复现：托尔图加计分后，响应方应能在自己页面直接点随从并移动到新基地', async ({ browser }, testInfo) => {
        const smashupMatch = await createOnlineSelectionMatch(browser, testInfo);
        if (!smashupMatch) {
            test.skip(true, '游戏服务器不可用或创建房间失败');
            return;
        }

    const { hostPage, guestPage, matchId } = smashupMatch;
    await clearEvidenceScreenshotsForTest(testInfo);
    await waitForTestHarness(hostPage);
    await waitForTestHarness(guestPage);
    await injectTortugaRunnerUpSelectionState(matchId, hostPage);

        await dispatchHarnessCommand(hostPage, '0', 'ADVANCE_PHASE', {});
        await waitForInteractionSourceId(matchId, guestPage, 'base_tortuga', 20000);

        const promptOverlay = guestPage.locator('[data-testid="prompt-overlay"]');
        await expect(promptOverlay).not.toBeVisible();
        await waitForSelectableMinion(guestPage, 'runner-up-traveler', 8000);
        await expect.poll(async () => isMinionSelectable(guestPage, 'tortuga-winner-rex')).toBe(false);

        const interactionShot = getEvidenceScreenshotPath(testInfo, 'tortuga-runner-up-interaction', {
            filename: 'smashup-tortuga-runner-up-interaction.png',
        });
        await guestPage.screenshot({ path: interactionShot, fullPage: false });
        await clickMinion(guestPage, 'runner-up-traveler');

        await expect.poll(async () => {
            const state = await getMatchState(matchId, hostPage);
            const replacementBase = state?.core?.bases?.[0];
            const sourceBase = state?.core?.bases?.[1];
            return {
                interactionSourceId: getInteractionSourceId(state),
                responseWindowOpen: Boolean(state?.sys?.responseWindow?.current),
                phase: state?.sys?.phase ?? null,
                currentPlayerIndex: state?.core?.currentPlayerIndex ?? null,
                replacementBaseDefId: replacementBase?.defId ?? null,
                movedToReplacement: replacementBase?.minions?.some((minion: any) => minion.uid === 'runner-up-traveler') ?? false,
                stillAtSource: sourceBase?.minions?.some((minion: any) => minion.uid === 'runner-up-traveler') ?? false,
            };
        }, { timeout: 12000 }).toEqual({
            interactionSourceId: null,
            responseWindowOpen: false,
            phase: 'playCards',
            currentPlayerIndex: 1,
            replacementBaseDefId: 'base_the_jungle',
            movedToReplacement: true,
            stillAtSource: false,
        });

        const resolvedShot = getEvidenceScreenshotPath(testInfo, 'tortuga-runner-up-resolved', {
            filename: 'smashup-tortuga-runner-up-resolved.png',
        });
        await guestPage.screenshot({ path: resolvedShot, fullPage: false });
    });
});
