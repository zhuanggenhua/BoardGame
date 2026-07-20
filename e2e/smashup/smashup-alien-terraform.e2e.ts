/**
 * Smash Up - Alien Terraform E2E 测试
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test, expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

const SMASHUP_TERRAFORM_QUERY = {
    p0: 'aliens,pirates',
    p1: 'ninjas,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const SMASHUP_ROUTE_OPEN_TIMEOUT_MS = 150_000;

async function resetSmashUpTestPage(game: any): Promise<void> {
    const rawPage = (game as { page?: { goto?: (...args: any[]) => Promise<unknown> } }).page;
    if (!rawPage?.goto) return;
    await rawPage.goto('about:blank', { waitUntil: 'commit', timeout: 15_000 }).catch(() => undefined);
}

async function saveEvidenceLocatorScreenshot(page: any, locator: any, testInfo: any, subdir: string, filename: string) {
    const path = getEvidenceScreenshotPath(testInfo, filename, { subdir, filename });
    mkdirSync(dirname(path), { recursive: true });
    await expect(locator).toBeVisible({ timeout: 15000 });
    const box = await locator.boundingBox();
    expect(box, `未获取到截图目标 ${filename} 的边界`).not.toBeNull();
    const padding = 10;
    await page.screenshot({
        path,
        animations: 'disabled',
        scale: 'device',
        clip: {
            x: Math.max((box?.x ?? 0) - padding, 0),
            y: Math.max((box?.y ?? 0) - padding, 0),
            width: (box?.width ?? 0) + padding * 2,
            height: (box?.height ?? 0) + padding * 2,
        },
    });
}

async function openTerraformScene(
    game: any,
    config: {
        hand?: string[];
        baseDeck: string[];
        bases?: Array<string | { defId: string; minions?: any[]; ongoingActions?: any[] }>;
        extraCore?: Record<string, unknown>;
    },
): Promise<void> {
    await resetSmashUpTestPage(game);
    await game.openTestGame('smashup', SMASHUP_TERRAFORM_QUERY, SMASHUP_ROUTE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: config.hand ?? ['alien_terraform'],
            deck: [],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
        },
        bases: (config.bases ?? ['base_the_homeworld', 'base_the_mothership']).map((entry) =>
            typeof entry === 'string'
                ? { defId: entry, minions: [], ongoingActions: [] }
                : {
                    defId: entry.defId,
                    minions: entry.minions ?? [],
                    ongoingActions: entry.ongoingActions ?? [],
                }),
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: {
                baseDeck: config.baseDeck,
                ...(config.extraCore ?? {}),
            },
        },
    });
}

const SMASHUP_TITAN_RAIL_QUERY = {
    p0: 'cthulhu,pirates',
    p1: 'ninjas,robots',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const SMASHUP_MAJOR_URSA_QUERY = {
    p0: 'bear_cavalry,pirates',
    p1: 'ghosts,ninjas',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

const SMASHUP_GREAT_WOLF_QUERY = {
    p0: 'werewolves,pirates',
    p1: 'ghosts,ninjas',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
};

function buildScoreBasesSessionExtraSys(
    baseIndex: number,
    baseDefId: string,
    deferredEvents: Array<{ type: string; payload: Record<string, unknown>; timestamp: number }>,
) {
    return {
        phase: 'scoreBases',
        resolution: {
            activeFrameId: 'smashup:score-bases',
            frames: [
                {
                    id: 'smashup:score-bases',
                    kind: 'smashup:score-bases',
                    ownerGame: 'smashup',
                    ownerSystem: 'smashup-scoring',
                    ownerToken: 'smashup:score-bases',
                    ordering: 'explicit-order',
                    status: 'running',
                    step: 'awaiting-interactions',
                    phase: 'scoreBases',
                    phaseGate: 'block-advance-when-blocked',
                    metadata: {
                        lockedBaseRefs: [{ slotIndex: baseIndex, baseDefId }],
                        completedBaseRefs: [],
                        currentBaseRef: { slotIndex: baseIndex, baseDefId },
                    },
                    deferredEvents,
                    deferredActions: [],
                },
            ],
        },
    };
}

async function openTitanRailScene(
    game: any,
    config: {
        hand?: string[];
        bases?: Array<string | { defId: string; minions?: any[]; ongoingActions?: any[] }>;
        player0Extra?: Record<string, unknown>;
        player1Extra?: Record<string, unknown>;
        extraCore?: Record<string, unknown>;
        extraSys?: Record<string, unknown>;
    },
): Promise<void> {
    await resetSmashUpTestPage(game);
    await game.openTestGame('smashup', SMASHUP_TITAN_RAIL_QUERY, SMASHUP_ROUTE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: config.hand ?? [],
            deck: [],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
            ...(config.player0Extra ?? {}),
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
            ...(config.player1Extra ?? {}),
        },
        bases: (config.bases ?? ['base_the_homeworld', 'base_the_mothership']).map((entry) =>
            typeof entry === 'string'
                ? { defId: entry, minions: [], ongoingActions: [] }
                : {
                    defId: entry.defId,
                    minions: entry.minions ?? [],
                    ongoingActions: entry.ongoingActions ?? [],
                }),
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: {
                enabledExpansions: ['titans'],
                ...(config.extraCore ?? {}),
            },
            ...(config.extraSys ? { sys: config.extraSys } : {}),
        },
    });
}

async function openMajorUrsaScene(game: any): Promise<void> {
    await resetSmashUpTestPage(game);
    await game.openTestGame('smashup', SMASHUP_MAJOR_URSA_QUERY, SMASHUP_ROUTE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'enemy-minion',
                        defId: 'ghosts_spectre',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_central_brain', minions: [], ongoingActions: [] },
        ],
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: {
                enabledExpansions: ['titans'],
                titans: [
                    {
                        uid: 'titan-major-ursa',
                        defId: 'bear_cavalry_major_ursa',
                        faction: 'bear_cavalry',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 1,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        },
    });
}

async function openGreatWolfSpiritTalentScene(game: any): Promise<void> {
    await resetSmashUpTestPage(game);
    await game.openTestGame('smashup', SMASHUP_GREAT_WOLF_QUERY, SMASHUP_ROUTE_OPEN_TIMEOUT_MS);
    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: {
            hand: [],
            deck: [],
            discard: [],
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'great-wolf-target',
                        defId: 'werewolf_teenage_wolf',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        currentPlayer: '0',
        phase: 'playCards',
        extra: {
            core: {
                enabledExpansions: ['titans'],
                titans: [
                    {
                        uid: 'titan-great-wolf-spirit',
                        defId: 'werewolves_great_wolf_spirit',
                        faction: 'werewolves',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                    },
                ],
            },
        },
    });
}

async function openBigFunnyGiantDiscardScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        hand: [
            { uid: 'big-funny-hand-1', defId: 'ghosts_spectre', type: 'minion', owner: '0' },
            { uid: 'big-funny-hand-2', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-big-funny-discard',
                    defId: 'tricksters_big_funny_giant',
                    faction: 'tricksters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
        extraSys: {
            interaction: {
                current: {
                    id: 'titan_tricksters_big_funny_giant_discard_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '滑稽巨人：选择 1 张手牌弃置，才能把随从打到这里',
                        sourceId: 'titan_tricksters_big_funny_giant_discard_to_play',
                        targetType: 'hand',
                        options: [
                            {
                                id: 'discard-big-funny-hand-1',
                                label: '幽灵',
                                value: { cardUid: 'big-funny-hand-1', defId: 'ghosts_spectre' },
                                displayMode: 'card',
                                _source: 'hand',
                            },
                            {
                                id: 'discard-big-funny-hand-2',
                                label: '大副',
                                value: { cardUid: 'big-funny-hand-2', defId: 'pirate_first_mate' },
                                displayMode: 'card',
                                _source: 'hand',
                            },
                        ],
                    },
                },
                queue: [],
            },
        },
    });
}

async function openCreampuffTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            hand: [
                { uid: 'creampuff-cost', defId: 'ghost_ghost', type: 'minion', owner: '0' },
                { uid: 'creampuff-keep', defId: 'ghost_haunting', type: 'minion', owner: '0' },
            ],
            deck: [
                { uid: 'creampuff-draw-1', defId: 'ghosts_spectre', type: 'minion', owner: '0' },
                { uid: 'creampuff-draw-2', defId: 'wizard_zap', type: 'action', owner: '0' },
                { uid: 'creampuff-draw-3', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                { uid: 'creampuff-draw-4', defId: 'ghosts_spectre', type: 'minion', owner: '0' },
            ],
            discard: [
                { uid: 'creampuff-seance-discard', defId: 'ghost_seance', type: 'action', owner: '0' },
            ],
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-creampuff-live',
                    defId: 'ghosts_creampuff_man',
                    faction: 'ghosts',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openMergaconPlayScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'mergacon-minion-a',
                        defId: 'robot_microbot_alpha',
                        owner: '0',
                        controller: '0',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'mergacon-minion-b',
                        defId: 'robot_microbot_beta',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-mergacon-setaside',
                    defId: 'changerbots_mergacon',
                    faction: 'changerbots',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
        extraSys: {
            phase: 'startTurn',
            interaction: {
                current: {
                    id: 'titan_changerbots_mergacon_play_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '合体机器人：选择要进场的基地',
                        sourceId: 'titan_changerbots_mergacon_play',
                        targetType: 'base',
                        options: [
                            {
                                id: 'base-0',
                                label: '家园',
                                value: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                                _source: 'base',
                            },
                            {
                                id: 'skip',
                                label: '跳过',
                                value: { skip: true },
                                displayMode: 'button',
                            },
                        ],
                        continuationContext: {
                            titanUid: 'titan-mergacon-setaside',
                            titanDefId: 'changerbots_mergacon',
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openMergaconTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'mergacon-anchor-minion',
                        defId: 'robot_microbot_alpha',
                        owner: '0',
                        controller: '0',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-mergacon-talent',
                    defId: 'changerbots_mergacon',
                    faction: 'changerbots',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openWalkingCastleSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'walking-castle-special-a',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'walking-castle-special-b',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-walking-castle-setaside',
                    defId: 'magical_girls_walking_castle',
                    faction: 'magical_girls',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openWalkingCastleTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'walking-castle-move-a',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'walking-castle-move-b',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'walking-castle-stay',
                        defId: 'robot_microbot_alpha',
                        owner: '0',
                        controller: '0',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-walking-castle-live',
                    defId: 'magical_girls_walking_castle',
                    faction: 'magical_girls',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openHillThatStrollsSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'hill-special-a',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '1',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'hill-special-b',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '1',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-hill-setaside',
                    defId: 'ignobles_the_hill_that_strolls',
                    faction: 'ignobles',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openHillThatStrollsGiveScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            deck: ['ghosts_spectre'],
        },
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'hill-give-target',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-hill-live',
                    defId: 'ignobles_the_hill_that_strolls',
                    faction: 'ignobles',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 1, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openVeryLargeBoulderSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'boulder-blocker',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-boulder-setaside',
                    defId: 'explorers_very_large_boulder',
                    faction: 'explorers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openVeryLargeBoulderMoveScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [],
                ongoingActions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'boulder-target',
                        defId: 'robot_microbot_guard',
                        owner: '1',
                        controller: '1',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'boulder-safe',
                        defId: 'trickster_gnome',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-boulder-live',
                    defId: 'explorers_very_large_boulder',
                    faction: 'explorers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 2,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
        extraSys: {
            phase: 'playCards',
            interaction: {
                current: {
                    id: 'titan_explorers_very_large_boulder_move_scene',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '硕大圆石：是否移动到「飞船」？',
                        sourceId: 'titan_explorers_very_large_boulder_move',
                        targetType: 'button',
                        options: [
                            { id: 'move', label: '移动并结算', value: { move: true }, displayMode: 'button' },
                            { id: 'skip', label: '跳过', value: { move: false }, displayMode: 'button' },
                        ],
                        continuationContext: {
                            titanUid: 'titan-boulder-live',
                            titanDefId: 'explorers_very_large_boulder',
                            fromBaseIndex: 0,
                            toBaseIndex: 1,
                            toBaseDefId: 'base_the_mothership',
                            destroyThreshold: 2,
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openRainborocPlayReplacementScene(game: any): Promise<void> {
    const deferredPostScoringEvents = [
        {
            type: 'su:base_cleared',
            payload: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
            timestamp: 91,
        },
        {
            type: 'su:base_replaced',
            payload: {
                baseIndex: 0,
                oldBaseDefId: 'base_the_homeworld',
                newBaseDefId: 'base_the_factory',
            },
            timestamp: 91,
        },
    ];
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'rainboroc-score-minion',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            baseDeck: ['base_the_factory'],
            titans: [
                {
                    uid: 'titan-rainboroc-setaside',
                    defId: 'itty_critters_rainboroc',
                    faction: 'itty_critters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
        extraSys: {
            ...buildScoreBasesSessionExtraSys(0, 'base_the_homeworld', deferredPostScoringEvents),
            interaction: {
                current: {
                    id: 'titan_itty_critters_rainboroc_play_replacement_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '彩虹鸟：是否将其打出到替换的基地？',
                        sourceId: 'titan_itty_critters_rainboroc_play_replacement',
                        targetType: 'button',
                        options: [
                            { id: 'play', label: '打出彩虹鸟', value: { play: true }, displayMode: 'button' },
                            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' },
                        ],
                        continuationContext: {
                            titanUid: 'titan-rainboroc-setaside',
                            titanDefId: 'itty_critters_rainboroc',
                            _deferredPostScoringEvents: deferredPostScoringEvents,
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openRainborocTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            deck: [],
            discard: [{ uid: 'rainboroc-discard-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-rainboroc-talent',
                    defId: 'itty_critters_rainboroc',
                    faction: 'itty_critters',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

function buildGorgodzollaActionSetup(ownerId = '0') {
    return [
        { uid: `${ownerId}-gorg-action-a`, defId: 'trickster_hideout', ownerId, talentUsed: false },
        { uid: `${ownerId}-gorg-action-b`, defId: 'wizard_portal', ownerId, talentUsed: false },
    ];
}

async function openGorgodzollaSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_mothership',
                minions: [],
                ongoingActions: buildGorgodzollaActionSetup('0'),
            },
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-gorgodzolla-setaside',
                    defId: 'kaiju_gorgodzolla',
                    faction: 'kaiju',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openGorgodzollaActionTriggerScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        hand: ['trickster_hideout'],
        player0Extra: {
            deck: ['ghosts_spectre'],
        },
        bases: [
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-gorgodzolla-action',
                    defId: 'kaiju_gorgodzolla',
                    faction: 'kaiju',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openMegabotSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'megabot-minion-a',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'megabot-minion-b',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'megabot-minion-c',
                        defId: 'trickster_gnome',
                        owner: '0',
                        controller: '0',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-megabot-setaside',
                    defId: 'mega_troopers_megabot',
                    faction: 'mega_troopers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openMegabotBeforeScoringScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'megabot-anchor-minion',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'megabot-scoring-minion',
                        defId: 'robot_microbot_alpha',
                        owner: '1',
                        controller: '1',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-megabot-live',
                    defId: 'mega_troopers_megabot',
                    faction: 'mega_troopers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
        extraSys: {
            phase: 'scoreBases',
            interaction: {
                current: {
                    id: 'titan_mega_troopers_megabot_move_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '超级佐德：是否移动到即将计分的基地？',
                        sourceId: 'titan_mega_troopers_megabot_move',
                        targetType: 'button',
                        options: [
                            {
                                id: 'move',
                                label: '移动到该基地',
                                value: { move: true },
                                displayMode: 'button',
                            },
                            {
                                id: 'stay',
                                label: '留在原地',
                                value: { move: false },
                                displayMode: 'button',
                            },
                        ],
                        continuationContext: {
                            titanUid: 'titan-megabot-live',
                            titanDefId: 'mega_troopers_megabot',
                            fromBaseIndex: 0,
                            scoringBaseIndex: 1,
                            scoringBaseDefId: 'base_the_mothership',
                            remaining: [],
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openEmperorPenguinSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'emperor-special-a',
                        defId: 'ghosts_spectre',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'emperor-special-b',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'emperor-special-c',
                        defId: 'robot_microbot_alpha',
                        owner: '0',
                        controller: '0',
                        basePower: 1,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-emperor-setaside',
                    defId: 'penguins_emperor_penguin',
                    faction: 'penguins',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
        extraSys: {
            phase: 'startTurn',
            interaction: {
                current: {
                    id: 'titan_penguins_emperor_penguin_play_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '企鹅帝皇：选择要进场的基地',
                        sourceId: 'titan_penguins_emperor_penguin_play',
                        targetType: 'base',
                        options: [
                            {
                                id: 'base-0',
                                label: '家园',
                                value: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                                _source: 'base',
                            },
                            {
                                id: 'skip',
                                label: '跳过',
                                value: { skip: true },
                                displayMode: 'button',
                            },
                        ],
                        continuationContext: {
                            titanUid: 'titan-emperor-setaside',
                            titanDefId: 'penguins_emperor_penguin',
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openEmperorPenguinOngoingScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            deck: [{ uid: 'emperor-top-minion', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }],
            discard: [{ uid: 'emperor-discard-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
            minionsPlayed: 0,
            minionLimit: 1,
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-emperor-live',
                    defId: 'penguins_emperor_penguin',
                    faction: 'penguins',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openEmperorPenguinTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            hand: [{ uid: 'emperor-hand-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' }],
            deck: [{ uid: 'emperor-existing-deck', defId: 'robot_microbot_guard', type: 'minion', owner: '0' }],
            minionsPlayed: 0,
            minionLimit: 1,
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-emperor-talent',
                    defId: 'penguins_emperor_penguin',
                    faction: 'penguins',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openTimeBoxSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-time-box-setaside',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
                    location: { zone: 'setaside' },
                },
            ],
        },
        extraSys: {
            phase: 'startTurn',
            interaction: {
                current: {
                    id: 'titan_time_travelers_time_box_play_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '时间盒子：是否移除全部计数器并打出到一个基地？',
                        sourceId: 'titan_time_travelers_time_box_play',
                        targetType: 'base',
                        options: [
                            {
                                id: 'base-0',
                                label: '家园',
                                value: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
                                _source: 'base',
                            },
                            {
                                id: 'base-1',
                                label: '母舰',
                                value: { baseIndex: 1, baseDefId: 'base_the_mothership' },
                                _source: 'base',
                            },
                            {
                                id: 'skip',
                                label: '跳过',
                                value: { skip: true },
                                displayMode: 'button',
                            },
                        ],
                        continuationContext: {
                            titanUid: 'titan-time-box-setaside',
                            titanDefId: 'time_travelers_time_box',
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openTimeBoxTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player0Extra: {
            hand: [
                { uid: 'time-box-low-minion', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
                { uid: 'time-box-extra-action', defId: 'trickster_hideout', type: 'action', owner: '0' },
            ],
            minionsPlayed: 1,
            minionLimit: 1,
            actionsPlayed: 1,
            actionLimit: 1,
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-time-box-live',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    metadata: { timeBoxCounters: 3 },
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openMoonZeroThreeSpecialScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [{ uid: 'moon-own-minion', defId: 'pirate_first_mate', owner: '0', controller: '0', basePower: 2 }],
                ongoingActions: [],
            },
            {
                defId: 'base_the_mothership',
                minions: [{ uid: 'moon-enemy-minion', defId: 'robot_microbot_guard', owner: '1', controller: '1', basePower: 1 }],
                ongoingActions: [],
            },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-moon-zero-setaside',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
    });
}

async function openMoonZeroThreeTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        player1Extra: {
            deck: [
                { uid: 'moon-target-top', defId: 'robot_microbot_guard', type: 'minion', owner: '1' },
                { uid: 'moon-target-next', defId: 'ghosts_spectre', type: 'minion', owner: '1' },
            ],
        },
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            titans: [
                {
                    uid: 'titan-moon-zero-live',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openKrakenTalentScene(game: any): Promise<void> {
    await openTitanRailScene(game, {
        bases: [
            { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            {
                defId: 'base_the_mothership',
                minions: [
                    {
                        uid: 'kraken-enemy-minion',
                        defId: 'ghosts_spectre',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                    {
                        uid: 'kraken-ally-minion',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_central_brain', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            turnNumber: 3,
            titans: [
                {
                    uid: 'titan-kraken-talent',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
    });
}

async function openKrakenPlayReplacementScene(game: any): Promise<void> {
    const deferredPostScoringEvents = [
        {
            type: 'su:base_cleared',
            payload: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
            timestamp: 41,
        },
        {
            type: 'su:base_replaced',
            payload: {
                baseIndex: 0,
                oldBaseDefId: 'base_the_homeworld',
                newBaseDefId: 'base_the_factory',
            },
            timestamp: 41,
        },
    ];
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'kraken-score-pirate',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            baseDeck: ['base_the_factory'],
            titans: [
                {
                    uid: 'titan-kraken-setaside',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
        },
        extraSys: {
            ...buildScoreBasesSessionExtraSys(0, 'base_the_homeworld', deferredPostScoringEvents),
            interaction: {
                current: {
                    id: 'titan_pirates_the_kraken_play_replacement_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '海怪克拉肯：是否将其打出到替换的基地？',
                        sourceId: 'titan_pirates_the_kraken_play_replacement',
                        targetType: 'button',
                        options: [
                            { id: 'play', label: '打出海怪克拉肯', value: { play: true }, displayMode: 'button' },
                            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' },
                        ],
                        continuationContext: {
                            titanUid: 'titan-kraken-setaside',
                            titanDefId: 'pirates_the_kraken',
                            ownerId: '0',
                            controllerId: '0',
                            scoringBaseIndex: 0,
                            _deferredPostScoringEvents: deferredPostScoringEvents,
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

async function openKrakenRescueScene(game: any): Promise<void> {
    const deferredPostScoringEvents = [
        {
            type: 'su:base_cleared',
            payload: { baseIndex: 0, baseDefId: 'base_the_homeworld' },
            timestamp: 51,
        },
        {
            type: 'su:base_replaced',
            payload: {
                baseIndex: 0,
                oldBaseDefId: 'base_the_homeworld',
                newBaseDefId: 'base_the_factory',
            },
            timestamp: 51,
        },
    ];
    await openTitanRailScene(game, {
        bases: [
            {
                defId: 'base_the_homeworld',
                minions: [
                    {
                        uid: 'kraken-save-pirate',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerCounters: 0,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    },
                ],
                ongoingActions: [],
            },
            { defId: 'base_the_mothership', minions: [], ongoingActions: [] },
        ],
        extraCore: {
            baseDeck: ['base_the_factory'],
            titans: [
                {
                    uid: 'titan-kraken-on-score-base',
                    defId: 'pirates_the_kraken',
                    faction: 'pirates',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
            ],
        },
        extraSys: {
            ...buildScoreBasesSessionExtraSys(0, 'base_the_homeworld', deferredPostScoringEvents),
            interaction: {
                current: {
                    id: 'titan_pirates_the_kraken_choose_minion_1',
                    kind: 'simple-choice',
                    playerId: '0',
                    data: {
                        title: '海怪克拉肯：你可以将此处你的一个随从移动到其他基地而不进入弃牌堆',
                        sourceId: 'titan_pirates_the_kraken_choose_minion',
                        targetType: 'minion',
                        options: [
                            {
                                id: 'kraken-save-pirate',
                                label: '大副',
                                value: { minionUid: 'kraken-save-pirate', defId: 'pirate_first_mate', baseIndex: 0 },
                                displayMode: 'card',
                            },
                            { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' },
                        ],
                        continuationContext: {
                            titanUid: 'titan-kraken-on-score-base',
                            titanDefId: 'pirates_the_kraken',
                            controllerId: '0',
                            scoringBaseIndex: 0,
                            _deferredPostScoringEvents: deferredPostScoringEvents,
                        },
                    },
                },
                queue: [],
            },
        },
    });
}

const LAYOUT_SETTLE_MS = 900;

async function waitForLayoutSettle(page: { waitForTimeout: (timeout: number) => Promise<void> }): Promise<void> {
    await page.waitForTimeout(LAYOUT_SETTLE_MS);
}

async function expectTitanCenteredOnBase(
    page: any,
    baseIndex: number,
    titanUid: string,
    tolerancePx = 6,
): Promise<void> {
    const base = page.locator(`[data-base-index="${baseIndex}"]`).first();
    const titan = page.locator(`[data-titan-uid="${titanUid}"] > div`).first();
    await expect(base).toBeVisible();
    await expect(titan).toBeVisible();

    const [baseBox, titanBox] = await Promise.all([base.boundingBox(), titan.boundingBox()]);
    expect(baseBox, `未获取到基地 ${baseIndex} 的边界`).toBeTruthy();
    expect(titanBox, `未获取到泰坦 ${titanUid} 的边界`).toBeTruthy();

    const baseCenterX = (baseBox?.x ?? 0) + (baseBox?.width ?? 0) / 2;
    const titanCenterX = (titanBox?.x ?? 0) + (titanBox?.width ?? 0) / 2;
    const delta = Math.abs(baseCenterX - titanCenterX);

    expect(
        delta,
        `泰坦 ${titanUid} 未与基地 ${baseIndex} 居中对齐，水平偏差 ${delta.toFixed(2)}px；base[x=${(baseBox?.x ?? 0).toFixed(2)},w=${(baseBox?.width ?? 0).toFixed(2)},cx=${baseCenterX.toFixed(2)}] titan[x=${(titanBox?.x ?? 0).toFixed(2)},w=${(titanBox?.width ?? 0).toFixed(2)},cx=${titanCenterX.toFixed(2)}]`,
    ).toBeLessThanOrEqual(tolerancePx);
}

async function expectOngoingsWrapTitan(
    page: any,
    titanUid: string,
    ongoingUids: string[],
): Promise<void> {
    const titan = page.locator(`[data-titan-uid="${titanUid}"] > div`).first();
    await expect(titan).toBeVisible();
    const titanBox = await titan.boundingBox();
    expect(titanBox, `未获取到泰坦 ${titanUid} 的边界`).toBeTruthy();
    const titanCenterX = (titanBox?.x ?? 0) + (titanBox?.width ?? 0) / 2;

    const ongoingBoxes = await Promise.all(ongoingUids.map(async (uid) => {
        const card = page.locator(`[data-ongoing-uid="${uid}"]`).first();
        await expect(card).toBeVisible();
        const box = await card.boundingBox();
        expect(box, `未获取到持续行动 ${uid} 的边界`).toBeTruthy();
        return {
            uid,
            left: box?.x ?? 0,
            centerX: (box?.x ?? 0) + (box?.width ?? 0) / 2,
        };
    }));

    expect(
        ongoingBoxes.some((card) => card.centerX < titanCenterX),
        `持续行动没有分布到泰坦 ${titanUid} 左侧`,
    ).toBe(true);
    expect(
        ongoingBoxes.some((card) => card.centerX > titanCenterX),
        `持续行动没有分布到泰坦 ${titanUid} 右侧`,
    ).toBe(true);

    const leftMostCard = [...ongoingBoxes].sort((a, b) => a.left - b.left)[0];
    expect(
        leftMostCard?.uid,
        `最左侧持续行动应保持第一张卡，当前最左侧为 ${leftMostCard?.uid ?? 'unknown'}`,
    ).toBe(ongoingUids[0]);
}

async function selectInteractionOptionBy(
    game: any,
    matcher: (option: any) => boolean,
    description: string,
): Promise<void> {
    const options = await game.getInteractionOptions();
    const option = options.find(matcher);
    expect(option, `交互中未找到 ${description} 对应的选项`).toBeTruthy();
    await game.selectOption(option.id);
}

async function toggleMultiInteractionOptionBy(
    page: any,
    game: any,
    matcher: (option: any) => boolean,
    description: string,
    expectedSelectedCount?: number,
): Promise<void> {
    const options = await game.getInteractionOptions();
    const option = options.find(matcher);
    expect(option, `多选交互中未找到 ${description} 对应的选项`).toBeTruthy();
    const minionUid = option?.value?.minionUid;
    if (typeof minionUid === 'string') {
        const minion = page.locator(`[data-minion-uid="${minionUid}"]`).first();
        await expect(minion).toBeVisible();
        await minion.click({ force: true });
        await page.waitForTimeout(200);
        return;
    }

    const optionCardUid = option?.value?.cardUid;
    if (typeof optionCardUid === 'string') {
        const card = page.locator(`[data-card-uid="${optionCardUid}"]`).first();
        await expect(card).toBeVisible();
        await card.click({ force: true });
        await page.waitForTimeout(200);
        return;
    }

    const optionCard = page.locator(`[data-option-id="${option.id}"]`).first();
    await expect(optionCard).toBeVisible();
    await optionCard.click({ force: true });
    await page.waitForTimeout(200);

    if (typeof expectedSelectedCount === 'number') {
        await expect(page.getByText(`已选 ${expectedSelectedCount} / 3`)).toBeVisible();
    }
}

async function waitForNoInteraction(game: any): Promise<void> {
    await expect.poll(async () => {
        const state = await game.getState();
        return state.sys.interaction?.current?.data?.sourceId ?? null;
    }).toBe(null);
}

async function expectSmashUpMagnifyTarget(page: any, targetType: 'minion' | 'base' | 'action' | 'titan', defId?: string): Promise<void> {
    const overlay = page.getByTestId('su-card-magnify-overlay');
    const content = page.getByTestId('su-card-magnify-content');
    await expect(overlay).toBeVisible();
    await expect(content).toHaveAttribute('data-card-type', targetType);
    if (defId) {
        await expect(content).toHaveAttribute('data-card-def-id', defId);
    }
}

async function closeSmashUpMagnifyOverlay(page: any): Promise<void> {
    const overlay = page.getByTestId('su-card-magnify-overlay');
    await expect(overlay).toBeVisible();
    await overlay.getByRole('button').click();
    await expect(overlay).toBeHidden();
}

async function dismissSmashUpSpotlightQueueIfVisible(page: any): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    const hasSpotlightQueue = await spotlightQueue.isVisible().catch(() => false);
    if (!hasSpotlightQueue) return;
    await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    await expect(spotlightQueue).toBeHidden();
    await page.waitForTimeout(150);
}

function getCurrentPlayer(state: any): any {
    const currentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    return state.core.players[currentPlayerId];
}

function buildFiveOngoingActions(ownerId = '0') {
    return [
        { uid: `${ownerId}-ongoing-trap`, defId: 'trickster_flame_trap', ownerId, talentUsed: false },
        { uid: `${ownerId}-ongoing-hideout`, defId: 'trickster_hideout', ownerId, talentUsed: false },
        { uid: `${ownerId}-ongoing-sacrifice`, defId: 'wizard_sacrifice', ownerId, talentUsed: false },
        { uid: `${ownerId}-ongoing-enchantress`, defId: 'wizard_enchantress', ownerId, talentUsed: false },
        { uid: `${ownerId}-ongoing-portal`, defId: 'wizard_portal', ownerId, talentUsed: false },
    ];
}

function buildOneOngoingAction(ownerId = '0') {
    return buildFiveOngoingActions(ownerId).slice(0, 1);
}

async function openFourPlayerTitanLayoutScene(game: any): Promise<void> {
    await resetSmashUpTestPage(game);
    await game.openTestGame('smashup', {
        numPlayers: 4,
        skipInitialization: true,
        seed: 12345,
    }, SMASHUP_ROUTE_OPEN_TIMEOUT_MS);

    await game.setupScene({
        gameId: 'smashup',
        player0: {
            hand: [],
            deck: [],
            discard: [],
            actionsPlayed: 0,
            actionLimit: 1,
            minionsPlayed: 0,
            minionLimit: 1,
        },
        player1: { hand: [], deck: [], discard: [] },
        player2: { hand: [], deck: [], discard: [] },
        player3: { hand: [], deck: [], discard: [] },
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            { defId: 'base_the_homeworld', ongoingActions: buildFiveOngoingActions('0'), minions: [] },
            { defId: 'base_the_mothership', ongoingActions: [], minions: [] },
            { defId: 'base_central_brain', ongoingActions: [], minions: [] },
            { defId: 'base_pirate_cove', ongoingActions: [], minions: [] },
            { defId: 'base_the_factory', ongoingActions: [], minions: [] },
        ],
        extra: {
            core: {
                enabledExpansions: ['titans'],
                turnOrder: ['0', '1', '2', '3'],
                titans: [
                    {
                        uid: 'titan-four-player-layout',
                        defId: 'tricksters_big_funny_giant',
                        faction: 'tricksters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 1,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        },
    });
}

test.describe('Smash Up - Alien Terraform', () => {
    test.describe.configure({ timeout: 180_000 });

    test('应完成三步交互：选旧基地 → 选新基地 → 额外打出随从', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform', 'alien_invader'],
            baseDeck: ['base_central_brain', 'base_pirate_cove'],
        });

        await game.playCard('alien_terraform', { targetBaseIndex: 0 });
        await game.waitForInteraction('alien_terraform_choose_replacement');
        await game.screenshot('terraform-replacement-prompt', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseDefId === 'base_central_brain',
            '替换基地 base_central_brain',
        );

        await game.waitForInteraction('alien_terraform_play_minion');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.defId === 'alien_invader',
            '额外打出的随从 alien_invader',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_central_brain');
        expect(finalState.core.bases[0].minions).toHaveLength(1);
        expect(finalState.core.bases[0].minions[0].defId).toBe('alien_invader');
        expect(player0.hand.some((card: any) => card.defId === 'alien_invader')).toBe(false);
        expect(player0.discard.some((card: any) => card.defId === 'alien_terraform')).toBe(true);

        await game.screenshot('terraform-after-extra-minion', testInfo);
    });

    test('可跳过额外随从打出', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform', 'alien_invader'],
            baseDeck: ['base_central_brain'],
            bases: ['base_the_homeworld'],
        });

        await game.playCard('alien_terraform', { targetBaseIndex: 0 });
        await game.waitForInteraction('alien_terraform_choose_replacement');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseDefId === 'base_central_brain',
            '替换基地 base_central_brain',
        );

        await game.waitForInteraction('alien_terraform_play_minion');
        await game.selectOption('skip');
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_central_brain');
        expect(finalState.core.bases[0].minions).toHaveLength(0);
        expect(player0.hand.some((card: any) => card.defId === 'alien_invader')).toBe(true);
        expect(player0.discard.some((card: any) => card.defId === 'alien_terraform')).toBe(true);

        await game.screenshot('terraform-after-skip-minion', testInfo);
    });

    test('基地牌堆为空时应优雅失败', async ({ game }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform'],
            baseDeck: [],
            bases: ['base_the_homeworld'],
        });

        await game.playCard('alien_terraform', { targetBaseIndex: 0 });
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.bases[0].defId).toBe('base_the_homeworld');
        expect(finalState.sys.interaction?.current).toBeUndefined();

        await game.screenshot('terraform-empty-base-deck', testInfo);
    });

    test('alien_terraform 第三步可通过牌库右侧泰坦栏选择可视作随从打出的 set-aside 泰坦', async ({ game, page }, testInfo) => {
        await openTerraformScene(game, {
            hand: ['alien_terraform', 'alien_invader'],
            baseDeck: ['base_central_brain'],
            bases: ['base_the_homeworld'],
            extraCore: {
                titans: [
                    {
                        uid: 'titan-trickster',
                        defId: 'tricksters_big_funny_giant',
                        faction: 'tricksters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ],
            },
        });

        await game.playCard('alien_terraform', { targetBaseIndex: 0 });
        await game.waitForInteraction('alien_terraform_choose_replacement');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseDefId === 'base_central_brain',
            '替换基地 base_central_brain',
        );

        await game.waitForInteraction('alien_terraform_play_minion');
        const promptOptions = await game.getInteractionOptions();
        expect(promptOptions.some((option: any) => option?.value?.titanUid === 'titan-trickster')).toBe(true);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        const railTitan = page.getByTestId('su-rail-titan-titan-trickster');
        const railTitanMagnify = page.getByTestId('su-rail-titan-magnify-titan-trickster');
        await railTitan.hover();
        await expect(railTitanMagnify).toBeVisible();
        await railTitanMagnify.click();
        await expectSmashUpMagnifyTarget(page, 'titan', 'tricksters_big_funny_giant');
        await game.screenshot('terraform-titan-rail-magnify', testInfo);
        await closeSmashUpMagnifyOverlay(page);
        await game.screenshot('terraform-titan-rail-prompt', testInfo);
        await railTitan.click();
        await page.waitForTimeout(300);
        await dismissSmashUpSpotlightQueueIfVisible(page);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const player0 = getCurrentPlayer(finalState);
        expect(finalState.core.bases[0].defId).toBe('base_central_brain');
        expect(finalState.core.bases[0].minions).toHaveLength(0);
        expect(player0.hand.some((card: any) => card.defId === 'alien_invader')).toBe(true);
        const playedTitan = finalState.core.titans.find((titan: any) => titan.uid === 'titan-trickster');
        expect(playedTitan?.location).toMatchObject({ zone: 'base', baseIndex: 0 });

        await game.screenshot('terraform-after-titan-from-rail', testInfo);
    });

    test('可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场', async ({ game, page }, testInfo) => {
        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        {
                            uid: 'cthulhu-base-minion',
                            defId: 'cthulhu_star_spawn',
                            owner: '0',
                            controller: '0',
                            basePower: 5,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                },
            ],
            extraCore: {
                madnessDeck: ['special_madness', 'special_madness', 'special_madness'],
                titans: [
                    {
                        uid: 'titan-cthulhu',
                        defId: 'cthulhu_cthulhu_titan',
                        faction: 'minions_of_cthulhu',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ],
            },
        });

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('cthulhu-titan-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const playedTitan = finalState.core.titans.find((titan: any) => titan.uid === 'titan-cthulhu');
        expect(playedTitan?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(finalState.core.players['0'].hand.filter((card: any) => card.defId === 'special_madness')).toHaveLength(2);

        await game.screenshot('cthulhu-titan-after-rail-play', testInfo);
    });

    test('触发式 special 不应在泰坦栏或基地上被错误高亮为可手动激活', async ({ game, page }, testInfo) => {
        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_saloon_pod',
                    minions: [
                        {
                            uid: 'deputy-ui-1',
                            defId: 'cowboys_deputy_pod',
                            owner: '0',
                            controller: '0',
                            basePower: 2,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [
                        {
                            uid: 'gravestones-live',
                            defId: 'skeletons_gravestones',
                            ownerId: '0',
                        },
                    ],
                },
            ],
            extraCore: {
                titans: [
                    {
                        uid: 'titan-pecos-ui',
                        defId: 'pecos_bill',
                        faction: 'cowboys',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'setaside' },
                    },
                ],
            },
        });

        const titanRail = page.getByTestId('su-titan-rail');
        const gravestonesCard = page.locator('[data-ongoing-uid="gravestones-live"]').first();
        await expect(titanRail).toBeVisible();
        await expect(gravestonesCard).toBeVisible();
        await expect(page.getByTestId('su-rail-titan-badge-titan-pecos-ui')).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="deputy-ui-1"] .ring-green-400')).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="deputy-ui-1"] .border-green-400')).toHaveCount(0);
        await expect(page.locator('[data-ongoing-uid="gravestones-live"] .ring-green-400')).toHaveCount(0);
        await expect(page.locator('[data-ongoing-uid="gravestones-live"] .border-green-400')).toHaveCount(0);
        await expect(page.locator('[data-ongoing-uid="gravestones-live"] .ring-amber-400')).toHaveCount(0);
        await expect(page.locator('[data-ongoing-uid="gravestones-live"] .border-amber-400')).toHaveCount(0);

        await saveEvidenceLocatorScreenshot(page, titanRail, testInfo, 'smashup-titan-rail', 'pecos-titan-rail-not-activatable');
        await saveEvidenceLocatorScreenshot(
            page,
            page.locator('[data-minion-uid="deputy-ui-1"]'),
            testInfo,
            'smashup-titan-rail',
            'cowboys-deputy-no-false-activation-glow',
        );
        await saveEvidenceLocatorScreenshot(
            page,
            gravestonesCard,
            testInfo,
            'smashup-titan-rail',
            'skeletons-gravestones-no-false-activation-glow',
        );

        await gravestonesCard.click({ force: true });
        await page.waitForTimeout(300);
        const postClickState = await game.getState();
        expect(postClickState.sys.interaction?.current).toBeUndefined();

        await game.screenshot('pecos-and-deputy-no-false-special-highlight', testInfo);
    });

    test('克苏鲁泰坦天赋可在分支选择后抽 1 张疯狂卡', async ({ game, page }, testInfo) => {
        await openTitanRailScene(game, {
            hand: ['special_madness'],
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            ],
            extraCore: {
                madnessDeck: ['special_madness', 'special_madness'],
                titans: [
                    {
                        uid: 'titan-cthulhu-talent-draw',
                        defId: 'cthulhu_cthulhu_titan',
                        faction: 'minions_of_cthulhu',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        });

        const titan = page.locator('[data-titan-uid="titan-cthulhu-talent-draw"]');
        await expect(titan).toBeVisible();
        const titanMagnify = page.getByTestId('su-base-titan-magnify-titan-cthulhu-talent-draw');
        await titan.hover();
        await expect(titanMagnify).toBeVisible();
        await titanMagnify.click({ force: true });
        await expectSmashUpMagnifyTarget(page, 'titan', 'cthulhu_cthulhu_titan');
        await game.screenshot('cthulhu-titan-magnify', testInfo);
        await closeSmashUpMagnifyOverlay(page);
        await titan.click({ force: true });

        await game.waitForInteraction('titan_cthulhu_cthulhu_titan_talent_choice');
        await game.screenshot('cthulhu-titan-talent-draw-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.choice === 'draw',
            '克苏鲁天赋：抽一张疯狂卡',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const playedTitan = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-cthulhu-talent-draw');
        expect(finalState.core.players['0'].hand.filter((card: any) => card.defId === 'special_madness')).toHaveLength(2);
        expect(playedTitan?.powerCounters).toBe(1);
        expect(playedTitan?.talentUsed).toBe(true);

        await game.screenshot('cthulhu-titan-talent-draw-resolved', testInfo);
    });

    test('克苏鲁泰坦天赋可把手中的疯狂卡交给另一位玩家', async ({ game, page }, testInfo) => {
        await openTitanRailScene(game, {
            hand: ['special_madness'],
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            ],
            extraCore: {
                madnessDeck: ['special_madness'],
                titans: [
                    {
                        uid: 'titan-cthulhu-talent-give',
                        defId: 'cthulhu_cthulhu_titan',
                        faction: 'minions_of_cthulhu',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 0,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        });

        const titan = page.locator('[data-titan-uid="titan-cthulhu-talent-give"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_cthulhu_cthulhu_titan_talent_choice');
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.choice === 'give',
            '克苏鲁天赋：给另一位玩家一张疯狂卡',
        );

        await game.waitForInteraction('titan_cthulhu_cthulhu_titan_talent_target');
        await game.screenshot('cthulhu-titan-talent-give-target', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.targetPlayerId === '1',
            '克苏鲁天赋：目标玩家 1',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const playedTitan = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-cthulhu-talent-give');
        expect(finalState.core.players['0'].hand.filter((card: any) => card.defId === 'special_madness')).toHaveLength(0);
        expect(finalState.core.players['1'].hand.filter((card: any) => card.defId === 'special_madness')).toHaveLength(1);
        expect(playedTitan?.powerCounters).toBe(0);
        expect(playedTitan?.talentUsed).toBe(true);

        await game.screenshot('cthulhu-titan-talent-give-resolved', testInfo);
    });

    test('海怪克拉肯天赋可移动并让目标基地敌方随从 -1 战力直到你的下回合开始', async ({ game, page }, testInfo) => {
        await openKrakenTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-kraken-talent"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_pirates_the_kraken_talent');
        await game.screenshot('kraken-talent-choose-base', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseIndex === 1,
            '海怪克拉肯：移动到基地 1',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const kraken = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-kraken-talent');
        const enemyMinion = finalState.core.bases[1].minions.find((candidate: any) => candidate.uid === 'kraken-enemy-minion');
        const allyMinion = finalState.core.bases[1].minions.find((candidate: any) => candidate.uid === 'kraken-ally-minion');

        expect(kraken?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(kraken?.talentUsed).toBe(true);
        expect(enemyMinion?.powerModifier).toBe(-1);
        expect(allyMinion?.powerModifier).toBe(0);

        await waitForLayoutSettle(page);
        await game.screenshot('kraken-talent-resolved', testInfo);
    });

    test('海怪克拉肯计分后可通过交互打到替换基地', async ({ game, page }, testInfo) => {
        await openKrakenPlayReplacementScene(game);

        await game.waitForInteraction('titan_pirates_the_kraken_play_replacement');
        await game.screenshot('kraken-play-replacement-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.play === true,
            '海怪克拉肯：打出到替换基地',
        );
        await waitForNoInteraction(game);
        await game.advancePhase();
        await game.waitForPhase('playCards', 10000);

        const finalState = await game.getState();
        const kraken = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-kraken-setaside');
        expect(finalState.core.bases[0].defId).toBe('base_the_factory');
        expect(kraken?.location).toMatchObject({ zone: 'base', baseIndex: 0 });

        await waitForLayoutSettle(page);
        await game.screenshot('kraken-play-replacement-resolved', testInfo);
    });

    test('海怪克拉肯计分后可把此处己方随从移到其他基地而不进入弃牌堆', async ({ game, page }, testInfo) => {
        await openKrakenRescueScene(game);

        await game.waitForInteraction('titan_pirates_the_kraken_choose_minion');
        await game.screenshot('kraken-rescue-choose-minion', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.minionUid === 'kraken-save-pirate',
            '海怪克拉肯：选择要救下的己方随从',
        );

        await game.waitForInteraction('titan_pirates_the_kraken_choose_base');
        await game.screenshot('kraken-rescue-choose-base', testInfo);
        await game.selectBase(1);
        await waitForNoInteraction(game);
        await game.advancePhase();
        await game.waitForPhase('playCards', 10000);

        const finalState = await game.getState();
        const rescuedMinion = finalState.core.bases[1].minions.find((candidate: any) => candidate.uid === 'kraken-save-pirate');
        const oldBaseMinion = finalState.core.bases[0].minions.find((candidate: any) => candidate.uid === 'kraken-save-pirate');

        expect(finalState.core.bases[0].defId).toBe('base_the_factory');
        expect(oldBaseMinion).toBeUndefined();
        expect(rescuedMinion?.defId).toBe('pirate_first_mate');

        await waitForLayoutSettle(page);
        await game.screenshot('kraken-rescue-resolved', testInfo);
    });

    test('Great Wolf Spirit 天赋可通过真实交互让己方随从直到回合结束获得 +1 战力', async ({ game, page }, testInfo) => {
        await openGreatWolfSpiritTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-great-wolf-spirit"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_werewolves_great_wolf_spirit_talent');
        await game.screenshot('great-wolf-spirit-choose-minion', testInfo);
        await page.locator('[data-minion-uid="great-wolf-target"]').click({ force: true });
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const targetMinion = finalState.core.bases[0].minions.find((candidate: any) => candidate.uid === 'great-wolf-target');
        const titanState = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-great-wolf-spirit');

        expect(targetMinion?.tempPowerModifier).toBe(1);
        expect(titanState?.talentUsed).toBe(true);

        await waitForLayoutSettle(page);
        await game.screenshot('great-wolf-spirit-resolved', testInfo);
    });

    test('合体机器人可通过回合开始交互进场到满足条件的基地', async ({ game, page }, testInfo) => {
        await openMergaconPlayScene(game);

        await game.waitForInteraction('titan_changerbots_mergacon_play');
        await game.screenshot('mergacon-play-choice', testInfo);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const mergacon = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-mergacon-setaside');
        expect(mergacon?.location).toMatchObject({ zone: 'base', baseIndex: 0 });

        await waitForLayoutSettle(page);
        await game.screenshot('mergacon-play-resolved', testInfo);
    });

    test('合体机器人天赋可移动泰坦并写入本回合持续能力压制标记', async ({ game, page }, testInfo) => {
        await openMergaconTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-mergacon-talent"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_changerbots_mergacon_talent');
        await game.screenshot('mergacon-talent-choose-base', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseIndex === 1,
            '合体机器人：移动到基地 1',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const mergacon = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-mergacon-talent');
        expect(mergacon?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(mergacon?.talentUsed).toBe(true);
        expect(finalState.core.titanOngoingSuppressedUntilTurnEnd).toContain('titan-mergacon-talent');

        await waitForLayoutSettle(page);
        await expect(titan.getByText('已用', { exact: true })).toBeVisible();
        await page.waitForTimeout(250);
        await game.screenshot('mergacon-talent-resolved-with-used-state', testInfo);
    });

    test('移动城堡可通过牌库右侧泰坦栏按通常随从额打到有你至少两个随从的基地', async ({ game, page }, testInfo) => {
        await openWalkingCastleSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('walking-castle-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const walkingCastle = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-walking-castle-setaside');
        expect(walkingCastle?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);

        await waitForLayoutSettle(page);
        await game.screenshot('walking-castle-rail-resolved', testInfo);
    });

    test('移动城堡天赋会先选目标基地，再通过多选交互把至多三个己方随从与泰坦一起移动过去', async ({ game, page }, testInfo) => {
        await openWalkingCastleTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-walking-castle-live"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_magical_girls_walking_castle_choose_base');
        await game.screenshot('walking-castle-talent-choose-base', testInfo);
        await game.selectBase(1);
        await page.waitForTimeout(300);

        await game.waitForInteraction('titan_magical_girls_walking_castle_choose_minions');
        const chooseMinionsState = await game.getState();
        const latestResolved = [...(chooseMinionsState.sys.eventStream?.entries ?? [])]
            .map((entry: any) => entry.event)
            .filter((event: any) => event?.type === 'SYS_INTERACTION_RESOLVED')
            .at(-1);
        expect(latestResolved?.payload?.sourceId).toBe('titan_magical_girls_walking_castle_choose_base');
        expect(latestResolved?.payload?.value).toEqual(expect.objectContaining({ baseIndex: 1 }));
        expect(
            chooseMinionsState.sys.interaction?.current?.data?.continuationContext,
        ).toEqual(expect.objectContaining({ targetBaseIndex: 1 }));
        await game.screenshot('walking-castle-talent-choose-minions', testInfo);
        await toggleMultiInteractionOptionBy(
            page,
            game,
            (option: any) => option?.value?.minionUid === 'walking-castle-move-a',
            '移动城堡：选择随从 walking-castle-move-a',
            1,
        );
        await toggleMultiInteractionOptionBy(
            page,
            game,
            (option: any) => option?.value?.minionUid === 'walking-castle-move-b',
            '移动城堡：选择随从 walking-castle-move-b',
            2,
        );
        await game.waitForInteraction('titan_magical_girls_walking_castle_choose_minions');
        const selectedOptionIds = (await game.getInteractionOptions())
            .filter((option: any) => ['walking-castle-move-a', 'walking-castle-move-b'].includes(option?.value?.minionUid))
            .map((option: any) => option.id);
        await page.evaluate((optionIds) => {
            const harness = (window as any).__BG_TEST_HARNESS__;
            harness.command.dispatch({
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: { optionIds },
            });
        }, selectedOptionIds);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const walkingCastle = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-walking-castle-live');
        expect(walkingCastle?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(walkingCastle?.talentUsed).toBe(true);
        expect(finalState.core.bases[1].minions.map((candidate: any) => candidate.uid)).toEqual(
            expect.arrayContaining(['walking-castle-move-a', 'walking-castle-move-b']),
        );
        expect(finalState.core.bases[0].minions.map((candidate: any) => candidate.uid)).toContain('walking-castle-stay');

        await waitForLayoutSettle(page);
        await game.screenshot('walking-castle-talent-resolved', testInfo);
    });

    test('漫游山岭巨人可在至少两个你拥有的随从正被其他玩家控制时通过牌库右侧泰坦栏进场', async ({ game, page }, testInfo) => {
        await openHillThatStrollsSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('hill-that-strolls-rail-ready', testInfo);
        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(1);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const hill = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-hill-setaside');
        expect(hill?.location).toMatchObject({ zone: 'base', baseIndex: 1 });

        await waitForLayoutSettle(page);
        await game.screenshot('hill-that-strolls-rail-resolved', testInfo);
    });

    test('漫游山岭巨人交出己方随从控制权并抽牌后，会通过真实交互给该随从放置 1 枚力量标记', async ({ game, page }, testInfo) => {
        await openHillThatStrollsGiveScene(game);

        const titan = page.locator('[data-titan-uid="titan-hill-live"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_ignobles_the_hill_that_strolls_give_minion');
        await game.screenshot('hill-that-strolls-give-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.minionUid === 'hill-give-target',
            '漫游山岭巨人：选择交出控制权的己方随从',
        );

        await game.waitForInteraction('smashup_reaction_choose');
        await game.screenshot('hill-that-strolls-reaction-choice', testInfo);
        await titan.click({ force: true });
        await game.waitForInteraction('titan_ignobles_the_hill_that_strolls_counter');
        await game.screenshot('hill-that-strolls-counter-choice', testInfo);
        await game.selectOption('place');
        await game.waitForInteraction('smashup_reaction_choose');
        await page.getByRole('button', { name: /让过|Pass|Skip/i }).first().click({ force: true });
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const targetMinion = finalState.core.bases[0].minions.find((candidate: any) => candidate.uid === 'hill-give-target');
        expect(targetMinion?.controller).toBe('1');
        expect(targetMinion?.powerCounters).toBe(1);
        expect(finalState.core.players['0'].hand).toHaveLength(1);
        expect(finalState.core.players['0'].deck).toHaveLength(0);

        await waitForLayoutSettle(page);
        await game.screenshot('hill-that-strolls-give-resolved', testInfo);
    });

    test('硕大圆石可通过牌库右侧泰坦栏按通常随从额打到没有玩家随从的基地', async ({ game, page }, testInfo) => {
        await openVeryLargeBoulderSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('very-large-boulder-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const boulder = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-boulder-setaside');
        expect(boulder?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);

        await waitForLayoutSettle(page);
        await game.screenshot('very-large-boulder-rail-resolved', testInfo);
    });

    test('硕大圆石可在随从移离后移动到目标基地并消灭低于其标记数的随从', async ({ game, page }, testInfo) => {
        await openVeryLargeBoulderMoveScene(game);
        await game.waitForInteraction('titan_explorers_very_large_boulder_move');
        await game.screenshot('very-large-boulder-move-choice', testInfo);

        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.move === true,
            '硕大圆石：移动并结算',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const boulder = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-boulder-live');
        expect(boulder?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(finalState.core.bases[1].minions.map((candidate: any) => candidate.uid)).not.toContain('boulder-target');
        expect(finalState.core.bases[1].minions.map((candidate: any) => candidate.uid)).toContain('boulder-safe');

        await waitForLayoutSettle(page);
        await game.screenshot('very-large-boulder-move-resolved', testInfo);
    });

    test('彩虹鸟可在基地计分后的替换基地交互中进场', async ({ game, page }, testInfo) => {
        await openRainborocPlayReplacementScene(game);

        await game.waitForInteraction('titan_itty_critters_rainboroc_play_replacement');
        await game.screenshot('rainboroc-play-replacement-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.play === true,
            '彩虹鸟：打出到替换基地',
        );
        await waitForNoInteraction(game);
        await game.advancePhase();
        await game.waitForPhase('playCards', 10000);

        const finalState = await game.getState();
        const rainboroc = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-rainboroc-setaside');
        expect(finalState.core.bases[0].defId).toBe('base_the_factory');
        expect(rainboroc?.location).toMatchObject({ zone: 'base', baseIndex: 0 });

        await waitForLayoutSettle(page);
        await game.screenshot('rainboroc-play-replacement-resolved', testInfo);
    });

    test('彩虹鸟天赋可通过真实交互把低战力随从洗回牌库并移动到其他基地', async ({ game, page }, testInfo) => {
        await openRainborocTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-rainboroc-talent"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_itty_critters_rainboroc_choose_discard');
        await game.screenshot('rainboroc-talent-choose-discard', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.cardUid === 'rainboroc-discard-minion',
            '彩虹鸟：选择弃牌堆中的大副',
        );

        await game.waitForInteraction('titan_itty_critters_rainboroc_choose_base');
        await game.screenshot('rainboroc-talent-choose-base', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.baseIndex === 1,
            '彩虹鸟：移动到基地 1',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const rainboroc = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-rainboroc-talent');
        expect(rainboroc?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(rainboroc?.talentUsed).toBe(true);
        expect(finalState.core.players['0'].discard.map((card: any) => card.uid)).not.toContain('rainboroc-discard-minion');
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toContain('rainboroc-discard-minion');

        await waitForLayoutSettle(page);
        await game.screenshot('rainboroc-talent-resolved', testInfo);
    });

    test('哥佐拉可通过牌库右侧泰坦栏按通常随从额打到有你至少两个战术的基地', async ({ game, page }, testInfo) => {
        await openGorgodzollaSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('gorgodzolla-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const gorgodzolla = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-gorgodzolla-setaside');
        expect(gorgodzolla?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);

        await waitForLayoutSettle(page);
        await game.screenshot('gorgodzolla-rail-resolved', testInfo);
    });

    test('哥佐拉在本基地打出战术后会加 1 标记并可通过交互抽 1 张牌', async ({ game, page }, testInfo) => {
        await openGorgodzollaActionTriggerScene(game);

        await game.playCard('trickster_hideout', { targetBaseIndex: 0 });

        await game.waitForInteraction('titan_kaiju_gorgodzolla_draw');
        await game.screenshot('gorgodzolla-draw-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.draw === true,
            '哥佐拉：抽 1 张牌',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const gorgodzolla = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-gorgodzolla-action');
        expect(gorgodzolla?.powerCounters).toBe(1);
        expect(finalState.core.players['0'].hand.filter((card: any) => card.defId === 'ghosts_spectre')).toHaveLength(1);

        await waitForLayoutSettle(page);
        await game.screenshot('gorgodzolla-draw-resolved', testInfo);
    });

    test('超级佐德可通过牌库右侧泰坦栏按通常随从额打到有你至少三个随从的基地', async ({ game, page }, testInfo) => {
        await openMegabotSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('megabot-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const megabot = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-megabot-setaside');
        expect(megabot?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);

        await waitForLayoutSettle(page);
        await game.screenshot('megabot-rail-resolved', testInfo);
    });

    test('超级佐德可在另一基地计分前通过交互移动到该基地', async ({ game, page }, testInfo) => {
        await openMegabotBeforeScoringScene(game);

        await game.waitForInteraction('titan_mega_troopers_megabot_move');
        await game.screenshot('megabot-before-scoring-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.move === true,
            '超级佐德：移动到计分基地',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const megabot = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-megabot-live');
        expect(megabot?.location).toMatchObject({ zone: 'base', baseIndex: 1 });

        await waitForLayoutSettle(page);
        await game.screenshot('megabot-before-scoring-resolved', testInfo);
    });

    test('企鹅帝皇可在回合开始交互中打到满足条件的基地', async ({ game, page }, testInfo) => {
        await openEmperorPenguinSpecialScene(game);

        await game.waitForInteraction('titan_penguins_emperor_penguin_play');
        await game.screenshot('emperor-penguin-play-choice', testInfo);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const emperorPenguin = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-emperor-setaside');
        expect(emperorPenguin?.location).toMatchObject({ zone: 'base', baseIndex: 0 });

        await waitForLayoutSettle(page);
        await game.screenshot('emperor-penguin-play-resolved', testInfo);
    });

    test('企鹅帝皇在同回合同时具备持续与天赋入口时可通过持续按钮打出牌库顶随从', async ({ game, page }, testInfo) => {
        await openEmperorPenguinOngoingScene(game);

        const titan = page.locator('[data-titan-uid="titan-emperor-live"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });
        await expect(page.getByRole('button', { name: '持续' })).toBeVisible();
        await expect(page.getByRole('button', { name: '天赋' })).toBeVisible();
        await game.screenshot('emperor-penguin-activation-menu', testInfo);

        await page.getByRole('button', { name: '持续' }).click({ force: true });
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const playedMinion = finalState.core.bases[0].minions.find((candidate: any) => candidate.uid === 'emperor-top-minion');
        expect(playedMinion?.defId).toBe('robot_microbot_guard');
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);
        expect(finalState.core.players['0'].deck).toHaveLength(0);

        await waitForLayoutSettle(page);
        await game.screenshot('emperor-penguin-ongoing-resolved', testInfo);
    });

    test('企鹅帝皇在同回合同时具备持续与天赋入口时可通过天赋按钮洗回低战力随从并获得标记', async ({ game, page }, testInfo) => {
        await openEmperorPenguinTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-emperor-talent"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });
        await expect(page.getByRole('button', { name: '持续' })).toBeVisible();
        await expect(page.getByRole('button', { name: '天赋' })).toBeVisible();
        await page.getByRole('button', { name: '天赋' }).click({ force: true });

        await game.waitForInteraction('titan_penguins_emperor_penguin_talent');
        await expect(page.locator('[data-testid^="prompt-card-"]')).toHaveCount(1);
        await expect(page.locator('[data-testid^="prompt-card-"]').first()).toBeVisible();
        await game.screenshot('emperor-penguin-talent-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.cardUid === 'emperor-hand-minion',
            '企鹅帝皇：选择手牌中的大副',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const emperorPenguin = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-emperor-talent');
        expect(emperorPenguin?.powerCounters).toBe(1);
        expect(emperorPenguin?.talentUsed).toBe(true);
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).not.toContain('emperor-hand-minion');
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toEqual(
            expect.arrayContaining(['emperor-existing-deck', 'emperor-hand-minion']),
        );

        await waitForLayoutSettle(page);
        await game.screenshot('emperor-penguin-talent-resolved', testInfo);
    });

    test('时间盒子可在达到第 5 枚计数后进场，并通过天赋提供此基地额外低战力随从与额外战术额度', async ({ game, page }, testInfo) => {
        await openTimeBoxSpecialScene(game);

        await game.waitForInteraction('titan_time_travelers_time_box_play');
        await expect(page.getByTestId('su-rail-titan-timebox-counter-titan-time-box-setaside')).toHaveText('5');
        await game.screenshot('time-box-play-choice', testInfo);
        await game.selectBase(1);
        await waitForNoInteraction(game);

        const afterSpecialState = await game.getState();
        const playedTimeBox = afterSpecialState.core.titans.find((candidate: any) => candidate.uid === 'titan-time-box-setaside');
        expect(playedTimeBox?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(playedTimeBox?.metadata?.timeBoxCounters).toBe(0);
        await expect(page.getByTestId('su-base-titan-timebox-counter-titan-time-box-setaside')).toHaveCount(0);

        await waitForLayoutSettle(page);
        await game.screenshot('time-box-play-resolved', testInfo);

        await openTimeBoxTalentScene(game);

        const talentTitan = page.locator('[data-titan-uid="titan-time-box-live"]');
        await expect(talentTitan).toBeVisible();
        await expect(page.getByTestId('su-base-titan-timebox-counter-titan-time-box-live')).toHaveText('3');
        await game.screenshot('time-box-talent-ready', testInfo);
        await talentTitan.click({ force: true });
        await expect.poll(async () => {
            const state = await game.getState();
            return state.core.titans.find((candidate: any) => candidate.uid === 'titan-time-box-live')?.talentUsed ?? false;
        }).toBe(true);

        await page.locator('[data-card-uid="time-box-low-minion"]').first().click({ force: true });
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        await page.locator('[data-card-uid="time-box-extra-action"]').first().click({ force: true });
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const timeBox = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-time-box-live');
        expect(timeBox?.talentUsed).toBe(true);
        expect(finalState.core.bases[0].minions.map((candidate: any) => candidate.uid)).toContain('time-box-low-minion');
        expect(finalState.core.bases[0].ongoingActions.map((candidate: any) => candidate.uid)).toContain('time-box-extra-action');
        expect(finalState.core.players['0'].actionsPlayed).toBe(2);

        await waitForLayoutSettle(page);
        await game.screenshot('time-box-talent-resolved', testInfo);
    });

    test('三号空间站可通过牌库右侧泰坦栏按通常随从额打到没有其他玩家随从的基地', async ({ game, page }, testInfo) => {
        await openMoonZeroThreeSpecialScene(game);

        const titanRail = page.getByTestId('su-titan-rail');
        await expect(titanRail).toBeVisible();
        await game.screenshot('moon-zero-rail-ready', testInfo);

        await titanRail.locator('button').first().click();
        await page.waitForTimeout(300);
        await game.selectBase(0);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const moonZero = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-moon-zero-setaside');
        expect(moonZero?.location).toMatchObject({ zone: 'base', baseIndex: 0 });
        expect(finalState.core.players['0'].minionsPlayed).toBe(1);

        await waitForLayoutSettle(page);
        await game.screenshot('moon-zero-rail-resolved', testInfo);
    });

    test('三号空间站天赋可查看任一牌库顶并将其放到牌库底', async ({ game, page }, testInfo) => {
        await openMoonZeroThreeTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-moon-zero-live"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_super_spies_moon_zero_three_choose_player');
        await game.screenshot('moon-zero-talent-choose-player', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.targetPlayerId === '1',
            '三号空间站：选择玩家 1 的牌库',
        );

        await game.waitForInteraction('titan_super_spies_moon_zero_three_resolve');
        await game.screenshot('moon-zero-talent-resolve-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.placement === 'bottom',
            '三号空间站：放到牌库底',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const moonZero = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-moon-zero-live');
        expect(moonZero?.powerCounters).toBe(1);
        expect(finalState.core.players['1'].deck.map((card: any) => card.uid)).toEqual(['moon-target-next', 'moon-target-top']);

        await waitForLayoutSettle(page);
        await game.screenshot('moon-zero-talent-resolved', testInfo);
    });

    test('滑稽巨人的弃牌交互可在 UI 中选择手牌并完成弃置', async ({ game, page }, testInfo) => {
        await openBigFunnyGiantDiscardScene(game);

        await game.waitForInteraction('titan_tricksters_big_funny_giant_discard_to_play');
        await game.screenshot('big-funny-giant-discard-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.cardUid === 'big-funny-hand-2',
            '滑稽巨人：弃置大副',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].discard.map((card: any) => card.uid)).toContain('big-funny-hand-2');
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).toContain('big-funny-hand-1');

        await waitForLayoutSettle(page);
        await game.screenshot('big-funny-giant-discard-resolved', testInfo);
    });

    test('奶油泡芙美人天赋可在 UI 中先弃手牌，再额外打出弃牌堆标准战术并将其放到牌库底', async ({ game, page }, testInfo) => {
        await openCreampuffTalentScene(game);

        const titan = page.locator('[data-titan-uid="titan-creampuff-live"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_ghosts_creampuff_man_discard');
        await game.screenshot('creampuff-talent-discard-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.cardUid === 'creampuff-cost',
            '奶油泡芙美人：弃置 ghost_ghost',
        );

        await game.waitForInteraction('titan_ghosts_creampuff_man_play');
        await game.screenshot('creampuff-talent-play-choice', testInfo);
        await selectInteractionOptionBy(
            game,
            (option: any) => option?.value?.cardUid === 'creampuff-seance-discard',
            '奶油泡芙美人：额外打出灵界降神',
        );
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        expect(finalState.core.players['0'].discard.map((card: any) => card.uid)).toContain('creampuff-cost');
        expect(finalState.core.players['0'].discard.map((card: any) => card.uid)).not.toContain('creampuff-seance-discard');
        expect(finalState.core.players['0'].deck.map((card: any) => card.uid)).toEqual(['creampuff-seance-discard']);
        expect(finalState.core.players['0'].hand.map((card: any) => card.uid)).toEqual([
            'creampuff-keep',
            'creampuff-draw-1',
            'creampuff-draw-2',
            'creampuff-draw-3',
            'creampuff-draw-4',
        ]);

        await waitForLayoutSettle(page);
        await game.screenshot('creampuff-talent-resolved', testInfo);
    });

    test('泰坦与持续行动布局在二人局和四人局下都应稳定', async ({ game, page }, testInfo) => {
        test.setTimeout(180_000);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildFiveOngoingActions('0'),
                },
            ],
            extraCore: {
                titans: [
                    {
                        uid: 'titan-right-row',
                        defId: 'tricksters_big_funny_giant',
                        faction: 'tricksters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 1,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        });

        let finalState = await game.getState();
        expect(finalState.core.bases[0].ongoingActions).toHaveLength(5);
        expect(finalState.core.titans.find((titan: any) => titan.uid === 'titan-right-row')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        await waitForLayoutSettle(page);
        await expectTitanCenteredOnBase(page, 0, 'titan-right-row');
        await expectOngoingsWrapTitan(page, 'titan-right-row', buildFiveOngoingActions('0').map((card) => card.uid));
        await game.screenshot('01-2p-five-ongoings-with-titan', testInfo);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildFiveOngoingActions('0'),
                },
            ],
        });

        finalState = await game.getState();
        expect(finalState.core.bases[0].ongoingActions).toHaveLength(5);
        expect(
            (finalState.core.titans ?? []).filter((titan: any) => titan.location?.zone === 'base'),
        ).toHaveLength(0);
        await waitForLayoutSettle(page);
        await game.screenshot('02-2p-five-ongoings-no-titan', testInfo);

        await openFourPlayerTitanLayoutScene(game);

        finalState = await game.getState();
        expect(finalState.core.bases).toHaveLength(5);
        expect(finalState.core.turnOrder).toEqual(['0', '1', '2', '3']);
        expect(finalState.core.bases[0].ongoingActions).toHaveLength(5);
        expect(finalState.core.titans.find((titan: any) => titan.uid === 'titan-four-player-layout')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        await waitForLayoutSettle(page);
        await expectTitanCenteredOnBase(page, 0, 'titan-four-player-layout');
        await expectOngoingsWrapTitan(page, 'titan-four-player-layout', buildFiveOngoingActions('0').map((card) => card.uid));
        await game.screenshot('03-4p-five-bases-with-titan', testInfo);
    });

    test('二人局下 1 张与 5 张持续行动在有无泰坦时的布局截图', async ({ game, page }, testInfo) => {
        test.setTimeout(180_000);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildOneOngoingAction('0'),
                },
            ],
        });
        await waitForLayoutSettle(page);
        await game.screenshot('01-2p-one-ongoing-no-titan', testInfo);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildFiveOngoingActions('0'),
                },
            ],
        });
        await waitForLayoutSettle(page);
        await game.screenshot('02-2p-five-ongoings-no-titan', testInfo);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildOneOngoingAction('0'),
                },
            ],
            extraCore: {
                titans: [
                    {
                        uid: 'titan-one-ongoing',
                        defId: 'tricksters_big_funny_giant',
                        faction: 'tricksters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 1,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        });
        await waitForLayoutSettle(page);
        await expectTitanCenteredOnBase(page, 0, 'titan-one-ongoing');
        await game.screenshot('03-2p-one-ongoing-with-titan', testInfo);

        await openTitanRailScene(game, {
            bases: [
                {
                    defId: 'base_the_homeworld',
                    ongoingActions: buildFiveOngoingActions('0'),
                },
            ],
            extraCore: {
                titans: [
                    {
                        uid: 'titan-five-ongoings',
                        defId: 'tricksters_big_funny_giant',
                        faction: 'tricksters',
                        ownerId: '0',
                        controllerId: '0',
                        powerCounters: 1,
                        talentUsed: false,
                        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                    },
                ],
            },
        });
        await waitForLayoutSettle(page);
        await expectTitanCenteredOnBase(page, 0, 'titan-five-ongoings');
        await expectOngoingsWrapTitan(page, 'titan-five-ongoings', buildFiveOngoingActions('0').map((card) => card.uid));
        await game.screenshot('04-2p-five-ongoings-with-titan', testInfo);
    });

    test('Major Ursa 天赋应在移动泰坦后把 3 战力敌方随从挪到新基地', async ({ game, page }, testInfo) => {
        await openMajorUrsaScene(game);

        const titan = page.locator('[data-titan-uid="titan-major-ursa"]');
        await expect(titan).toBeVisible();
        await titan.click({ force: true });

        await game.waitForInteraction('titan_bear_cavalry_major_ursa_choose_destination');
        await game.screenshot('major-ursa-01-choose-destination', testInfo);
        await game.selectBase(1);

        await game.waitForInteraction('smashup_reaction_choose');
        await game.screenshot('major-ursa-01b-reaction-choice', testInfo);
        await titan.click({ force: true });
        await game.waitForInteraction('titan_bear_cavalry_major_ursa_choose_minion');
        await game.screenshot('major-ursa-02-choose-minion', testInfo);
        await page.locator('[data-minion-uid="enemy-minion"]').click({ force: true });

        await game.waitForInteraction('titan_bear_cavalry_major_ursa_choose_base');
        await game.screenshot('major-ursa-03-choose-base', testInfo);
        await game.selectBase(2);
        await waitForNoInteraction(game);

        const finalState = await game.getState();
        const majorUrsa = finalState.core.titans.find((candidate: any) => candidate.uid === 'titan-major-ursa');
        const movedMinionBase1 = finalState.core.bases[1].minions.find((candidate: any) => candidate.uid === 'enemy-minion');
        const movedMinionBase2 = finalState.core.bases[2].minions.find((candidate: any) => candidate.uid === 'enemy-minion');

        expect(majorUrsa?.location).toMatchObject({ zone: 'base', baseIndex: 1 });
        expect(majorUrsa?.powerCounters).toBe(2);
        expect(majorUrsa?.talentUsed).toBe(true);
        expect(movedMinionBase1).toBeUndefined();
        expect(movedMinionBase2?.defId).toBe('ghosts_spectre');

        await waitForLayoutSettle(page);
        await game.screenshot('major-ursa-04-after-resolution', testInfo);
    });
});
