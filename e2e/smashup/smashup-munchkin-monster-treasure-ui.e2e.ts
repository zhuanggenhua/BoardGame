import { test, expect } from '../framework';
import type { GameTestContext } from '../framework';
import type { Page } from '@playwright/test';
import { readCoreState } from '../helpers/smashup';
import {
    MUNCHKIN_MONSTER_DECK_DEF_IDS,
    MUNCHKIN_TREASURE_DECK_DEF_IDS,
} from '../../src/games/smashup/data/factions/munchkin';

type SmashUpSceneConfig = Parameters<GameTestContext['setupScene']>[0];

type RocketBootsCoreState = {
    bases: Array<{
        defId: string;
        minions: Array<{
            uid: string;
            basePower?: number;
            powerCounters?: number;
            powerModifier?: number;
            tempPowerModifier?: number;
            talentUsed?: boolean;
            attachedActions?: Array<{ uid: string; defId: string; ownerId?: string; talentUsed?: boolean }>;
        }>;
        ongoingActions?: Array<{ uid: string; defId: string; ownerId: string }>;
    }>;
    players?: Record<string, {
        hand?: Array<{ uid: string; defId: string; type: string }>;
        deck?: Array<{ uid: string; defId: string; type: string }>;
        discard?: Array<{ uid: string; defId: string; type: string }>;
        actionsPlayed?: number;
        actionLimit?: number;
        minionLimit?: number;
        minionsPlayed?: number;
        minionsPlayedPerBase?: Record<number, number>;
        baseLimitedMinionQuota?: Record<number, number>;
        vp?: number;
    }>;
    treasureDeck?: string[];
    treasureDiscard?: string[];
    nextUid?: number;
    triggerQueue?: unknown[];
};

type SmashUpPlayerCoreSlice = NonNullable<RocketBootsCoreState['players']>[string] & {
    treasures?: unknown;
};

type StraightLineRunningAwayCoreState = RocketBootsCoreState & {
    pendingMunchkinTreasureReward?: {
        treasureCards: Array<{ uid: string; defId: string; type: string }>;
        eligiblePlayerIds: string[];
        nextRecipientIndex: number;
    };
    treasureDeck?: string[];
};

type ParalysisCoreState = RocketBootsCoreState & {
    suppressedCardUidsUntilTurnEnd?: string[];
};

type TemporalJetpackCoreState = RocketBootsCoreState & {
    turnNumber?: number;
};

type InteractionOption = {
    id?: string;
    label?: string;
        value?: {
            baseIndex?: number;
            cardUid?: string;
            defId?: string;
            factionId?: string;
            handCardUid?: string;
            kind?: string;
            minionUid?: string;
            mode?: string;
            playerId?: string;
            skip?: boolean;
        targetBaseIndex?: number;
        targetMinionUid?: string;
        treasureDefId?: string;
        treasureUid?: string;
        triggerId?: string;
    };
};

type BrowserHarnessState = {
    core?: {
        currentPlayerIndex?: number;
        pendingMunchkinTreasureReward?: {
            treasureCards?: unknown[];
        };
        players?: Record<string, { hand?: Array<{ uid?: string }> }>;
        turnOrder?: string[];
    };
    sys?: {
        interaction?: { current?: { data?: { sourceId?: string } } };
        responseWindow?: { current?: { windowType?: string } };
    };
};

type BrowserHarnessWindow = Window & {
    __BG_TEST_HARNESS__?: { state?: { get?: () => BrowserHarnessState } };
};

type TriggerQueueEvidenceEvent = {
    type?: string;
    payload?: {
        baseDefId?: string;
        cardUid?: string;
        cards?: Array<{ uid?: string; defId?: string }>;
        defId?: string;
        reason?: string;
        minionUid?: string;
        rankings?: Array<{
            playerId?: string;
            power?: number;
            vp?: number;
        }>;
        targetBaseIndex?: number;
        targetMinionUid?: string;
        targetType?: string;
        triggers?: Array<{
            sourceDefId?: string;
            timing?: string;
            triggerMinionUid?: string;
        }>;
    };
};

type TriggerQueueEntry = {
    id?: string;
    sourceDefId?: string;
    source?: { defId?: string };
};

type EventStreamEntry = {
    event?: TriggerQueueEvidenceEvent;
};

const deckCards = (playerId: string, defId: string, count: number) =>
    Array.from({ length: count }, (_, index) => ({
        uid: `${playerId}-deck-${index}`,
        defId,
        type: 'minion',
        owner: playerId,
    }));

const minion = (uid: string, defId: string, owner: string, basePower: number) => ({
    uid,
    defId,
    owner,
    controller: owner,
    basePower,
    powerCounters: 0,
    powerModifier: 0,
    tempPowerModifier: 0,
    talentUsed: false,
    attachedActions: [],
});

async function getReactionWindowStatus(page: Page): Promise<{ sourceId: string | null; windowType: string | null }> {
    return page.evaluate(() => {
        const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
        return {
            sourceId: state?.sys?.interaction?.current?.data?.sourceId ?? null,
            windowType: state?.sys?.responseWindow?.current?.windowType ?? null,
        };
    });
}

async function passOpenReactionOrResponseWindow(
    page: Page,
    game: GameTestContext,
    description: string,
): Promise<boolean> {
    const status = await getReactionWindowStatus(page);
    if (status.sourceId === 'smashup_reaction_choose') {
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.kind === 'pass',
            description,
        );
        return true;
    }
    if (status.windowType) {
        await game.passResponseWindow();
        return true;
    }
    return false;
}

async function chooseReactionBySourceDefId(
    game: GameTestContext,
    sourceDefId: string,
    description: string,
): Promise<void> {
    const state = await game.getState();
    const triggers = (state.core?.triggerQueue ?? []) as TriggerQueueEntry[];
    await game.selectInteractionOptionBy((option: InteractionOption) => {
        const triggerId = option.value?.triggerId;
        const trigger = triggers.find((entry) => entry?.id === triggerId);
        return trigger?.sourceDefId === sourceDefId
            || trigger?.source?.defId === sourceDefId
            || option.value?.defId === sourceDefId
            || option.label?.includes(sourceDefId);
    }, description);
}

async function waitForSmashUpFxToSettle(page: Page): Promise<void> {
    const spotlightQueue = page.getByTestId('card-spotlight-queue');
    if (await spotlightQueue.isVisible({ timeout: 200 }).catch(() => false)) {
        await spotlightQueue.getByRole('button', { name: /^(关闭特写|Close spotlight)$/i }).click({ force: true });
    }
    await expect(spotlightQueue).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByTestId('smashup-action-fx-card')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('[data-testid^="smashup-triggered-fx-"]')).toHaveCount(0, { timeout: 8000 });
}

const buildMunchkinMonsterTreasureScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'p0-hand-1', defId: 'munchkin_dwarves_loot_lover', type: 'minion', owner: '0' },
            { uid: 'p0-hand-2', defId: 'munchkin_dwarves_mine', type: 'action', owner: '0' },
            { uid: 'p0-hand-3', defId: 'munchkin_warriors_big_hero', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [
            { uid: 'p1-hand-1', defId: 'munchkin_orcs_sword_lord', type: 'minion', owner: '1' },
            { uid: 'p1-hand-2', defId: 'ninja_infiltrate', type: 'action', owner: '1' },
        ],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 5,
            nextUid: 500,
            deckQueryEnabled: false,
            enabledExpansions: ['titans', 'munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath', 'base_the_homeworld'],
            baseDiscard: [],
            titans: [
                {
                    uid: 'titan-on-base-0',
                    defId: 'dinosaurs_fort_titanosaurus',
                    faction: 'dinosaurs',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
                },
                {
                    uid: 'titan-setaside-0',
                    defId: 'ninjas_invisible_ninja',
                    faction: 'ninjas',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' },
                },
            ],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('p0-base0-loot-lover', 'munchkin_dwarves_loot_lover', '0', 4),
                        minion('p0-base0-big-hero', 'munchkin_warriors_big_hero', '0', 5),
                        minion('p1-base0-sword-lord', 'munchkin_orcs_sword_lord', '1', 5),
                    ],
                    ongoingActions: [
                        { uid: 'ongoing-full-sail-0', defId: 'pirate_full_sail', ownerId: '0' },
                        { uid: 'ongoing-power-up-1', defId: 'robot_power_up', ownerId: '1' },
                    ],
                    monsters: [
                        { uid: 'monster-dragon-0', defId: 'munchkin_monster_treasure_dragon' },
                        { uid: 'monster-bigfoot-0', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'monster-ghoul-0', defId: 'munchkin_monster_ghoul', controllerId: '1' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        minion('p0-base1-gem', 'munchkin_dwarves_gem_grabber', '0', 2),
                        minion('p1-base1-dork-orc', 'munchkin_orcs_dork_orc', '1', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinTreasureMinionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'halfling-hireling-1', defId: 'munchkin_treasure_halfling_hireling', type: 'minion', owner: '0' },
            { uid: 'tiger-steed-1', defId: 'munchkin_treasure_tiger_steed', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 6,
            nextUid: 760,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'monster-bigfoot-0', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinQuarterlingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'quarterling-1', defId: 'munchkin_halflings_quarterling', type: 'minion', owner: '0' },
            { uid: 'quarterling-away-blocked-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'quarterling-extra-here-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1800,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinBirthdayPartyRestrictionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'birthday-blocked-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'birthday-guest-1', defId: 'munchkin_halflings_pestling', type: 'minion', owner: '0' },
            { uid: 'birthday-free-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 2,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1810,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinSubterraneanLairScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '1',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'lair-normal-away-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'lair-extra-here-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 18,
            nextUid: 1820,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_subterranean_lair', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinShireMarshalScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'shire-extra-here-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'pirates'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1830,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('shire-marshal-1', 'munchkin_halflings_shire_marshal', '0', 4),
                        minion('shire-opponent-1', 'munchkin_warriors_big_hero', '1', 5),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_birthday_party',
                    minions: [minion('shire-opponent-2', 'munchkin_warriors_big_hero', '1', 4)],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinPestlingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'pestling-1', defId: 'munchkin_halflings_pestling', type: 'minion', owner: '0' },
            { uid: 'pestling-away-blocked-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'pestling-extra-here-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1840,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinBardlingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'bardling-1', defId: 'munchkin_halflings_bardling', type: 'minion', owner: '0' },
            { uid: 'bardling-away-blocked-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'bardling-extra-here-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_pestling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1850,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('bardling-ally-1', 'alien_invader', '0', 1),
                        minion('bardling-opponent-1', 'munchkin_warriors_big_hero', '1', 5),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinLunchRunScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'lunch-run-1', defId: 'munchkin_halflings_lunch_run', type: 'action', owner: '0' },
            { uid: 'lunch-minion-1', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        deck: [
            { uid: 'lunch-draw-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
            ...deckCards('0', 'munchkin_halflings_bardling', 12),
        ],
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1860,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinSneaksyScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'sneaksy-1', defId: 'munchkin_halflings_sneaksy', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [
            { uid: 'sneaksy-broadside-1', defId: 'pirate_broadside', type: 'action', owner: '1' },
        ],
        deck: deckCards('1', 'pirate_first_mate', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1870,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('sneaksy-protected-1', 'alien_invader', '0', 2),
                        minion('sneaksy-opponent-1', 'pirate_first_mate', '1', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinSneaksyProtectionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '1',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [
            { uid: 'sneaksy-broadside-1', defId: 'pirate_broadside', type: 'action', owner: '1' },
        ],
        deck: deckCards('1', 'pirate_first_mate', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 20,
            nextUid: 1875,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('sneaksy-protected-1', 'alien_invader', '0', 2),
                        minion('sneaksy-opponent-1', 'pirate_first_mate', '1', 2),
                    ],
                    ongoingActions: [
                        { uid: 'sneaksy-1', defId: 'munchkin_halflings_sneaksy', ownerId: '0' },
                    ],
                    monsters: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinOutOfNowhereScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'out-of-nowhere-1', defId: 'munchkin_halflings_out_of_nowhere', type: 'action', owner: '0' },
        ],
        deck: [
            { uid: 'out-reveal-action-1', defId: 'pirate_broadside', type: 'action', owner: '0' },
            { uid: 'out-reveal-minion-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'out-reveal-action-2', defId: 'munchkin_halflings_lunch_run', type: 'action', owner: '0' },
            { uid: 'out-reveal-minion-2', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
            { uid: 'out-unrevealed-1', defId: 'munchkin_halflings_sneaksy', type: 'action', owner: '0' },
        ],
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1880,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinLastCallScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'last-call-1', defId: 'munchkin_halflings_last_call', type: 'action', owner: '0' },
            { uid: 'last-call-minion-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'pirates'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1890,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [minion('last-call-scorer', 'munchkin_warriors_big_hero', '0', 30)],
                    ongoingActions: [],
                    monsters: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinRudeAwakeningScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'awakening-1', defId: 'munchkin_halflings_rude_awakening', type: 'action', owner: '0' },
            { uid: 'awakening-minion-a', defId: 'munchkin_treasure_halfling_hireling', type: 'minion', owner: '0' },
            { uid: 'awakening-minion-b', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'awakening-left-action', defId: 'munchkin_halflings_lunch_run', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1900,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinSmallButToughScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'small-but-tough-1', defId: 'munchkin_halflings_small_but_tough', type: 'action', owner: '0' },
            { uid: 'small-destroyer-1', defId: 'pirate_saucy_wench', type: 'minion', owner: '0' },
        ],
        deck: [
            { uid: 'small-deck-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['munchkin_halflings', 'pirates'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1910,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [minion('small-host-1', 'alien_invader', '0', 2)],
                    ongoingActions: [],
                    monsters: [],
                },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinSpoiledBratsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'spoiled-1', defId: 'munchkin_halflings_spoiled_brats', type: 'action', owner: '0' },
        ],
        deck: [
            { uid: 'spoiled-deck-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        discard: [
            { uid: 'spoiled-minion-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'spoiled-action-1', defId: 'pirate_broadside', type: 'action', owner: '0' },
            { uid: 'spoiled-minion-2', defId: 'munchkin_halflings_quarterling', type: 'minion', owner: '0' },
        ],
        factions: ['munchkin_halflings', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1920,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                { defId: 'base_the_mines', minions: [], ongoingActions: [], monsters: [] },
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [], monsters: [] },
            ],
        },
    },
});

const buildMunchkinUnexpectedPartyScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'party-1', defId: 'munchkin_halflings_unexpected_party', type: 'action', owner: '0' },
            { uid: 'party-minion-1', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_halflings_bardling', 16),
        discard: [],
        factions: ['munchkin_halflings', 'pirates'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 1930,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [minion('party-own-1', 'munchkin_halflings_quarterling', '0', 2)],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [minion('party-enemy-1', 'alien_invader', '1', 2)],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesMasterThiefScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'master-pressure-action', defId: 'alien_probe', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1900,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_coffers',
                    minions: [
                        minion('master-thief-1', 'munchkin_thieves_master_thief', '0', 5),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'master-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'master-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesSwipeScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'swipe-1', defId: 'munchkin_thieves_swipe', type: 'action', owner: '0' },
            { uid: 'swipe-pressure-minion', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1910,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_coffers',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'swipe-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'swipe-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesPickpocketScene = (withAnotherPickpocket: boolean): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: withAnotherPickpocket ? 'pickpocket-1' : 'solo-pickpocket-1', defId: 'munchkin_thieves_pickpocket', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_master_thief', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: withAnotherPickpocket ? 1920 : 1930,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: withAnotherPickpocket
                        ? [minion('other-pickpocket', 'munchkin_thieves_pickpocket', '1', 2)]
                        : [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'pickpocket-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesCatBurglarScene = (nextUid = 1940): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'cat-burglar-1', defId: 'munchkin_thieves_cat_burglar', type: 'minion', owner: '0' },
            { uid: 'cat-treasure-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
            { uid: 'cat-treasure-hireling', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
            { uid: 'cat-normal-minion', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'cat-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesFenceScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'fence-treasure-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
            { uid: 'fence-treasure-hireling', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
            { uid: 'fence-normal-card', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 3,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1960,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [minion('fence-1', 'munchkin_thieves_fence', '0', 3)],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'fence-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesBackstabScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'backstab-1', defId: 'munchkin_thieves_backstab', type: 'action', owner: '0' },
            { uid: 'backstab-treasure-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
            { uid: 'backstab-normal-card', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1970,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [
                        minion('backstab-low-target', 'alien_invader', '1', 2),
                        minion('backstab-high-target', 'munchkin_warriors_big_hero', '1', 5),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'backstab-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesPotionBandolierScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'bandolier-1', defId: 'munchkin_thieves_potion_bandolier', type: 'action', owner: '0' },
            { uid: 'bandolier-treasure-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
            { uid: 'bandolier-normal-card', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1980,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [
                        minion('bandolier-target', 'alien_invader', '1', 2),
                        minion('bandolier-bystander', 'munchkin_warriors_big_hero', '0', 5),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'bandolier-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesSmugglingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'smuggling-1', defId: 'munchkin_thieves_smuggling', type: 'action', owner: '0' },
            { uid: 'smuggling-treasure-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
            { uid: 'smuggling-treasure-hireling', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
        ],
        deck: [
            { uid: 'smuggling-deck-a', defId: 'alien_invader', type: 'minion', owner: '0' },
            { uid: 'smuggling-deck-b', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        discard: [
            { uid: 'smuggling-discard-a', defId: 'munchkin_thieves_pickpocket', type: 'minion', owner: '0' },
            { uid: 'smuggling-discard-b', defId: 'munchkin_thieves_swipe', type: 'action', owner: '0' },
        ],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 1990,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'smuggling-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesMuggingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'mugging-1', defId: 'munchkin_thieves_mugging', type: 'action', owner: '0' },
            { uid: 'mugging-pressure-minion', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 2000,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [
                        {
                            ...minion('mugging-enemy-host', 'alien_invader', '1', 2),
                            attachedActions: [
                                { uid: 'mugging-spiky-boots', defId: 'munchkin_treasure_spiky_boots', ownerId: '1' },
                            ],
                        },
                        minion('mugging-own-target', 'munchkin_thieves_pickpocket', '0', 2),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'mugging-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesStripBareScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'strip-bare-1', defId: 'munchkin_thieves_strip_bare', type: 'action', owner: '0' },
            { uid: 'strip-pressure-minion', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 2010,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [
                        minion('strip-treasure-minion', 'munchkin_treasure_dwarf_hireling', '1', 2),
                        minion('strip-normal-minion', 'alien_invader', '1', 2),
                    ],
                    ongoingActions: [
                        { uid: 'strip-treasure-action', defId: 'munchkin_treasure_bag_of_caltrops', ownerId: '1' },
                    ],
                    monsters: [
                        { uid: 'strip-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesGuildScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'guild-caltrops-1', defId: 'munchkin_treasure_bag_of_caltrops', type: 'action', owner: '0' },
            { uid: 'guild-pressure-minion', defId: 'alien_scout', type: 'minion', owner: '0' },
        ],
        deck: [
            { uid: 'guild-draw-1', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 2020,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_thieves_guild',
                    minions: [
                        minion('guild-own-minion', 'munchkin_thieves_pickpocket', '0', 2),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'guild-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinThievesScoringScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'clever-distraction-1', defId: 'munchkin_thieves_clever_distraction', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_thieves_pickpocket', 18),
        discard: [],
        factions: ['munchkin_thieves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 5,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 22,
            nextUid: 2030,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_buckler_of_swashing',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_coffers',
                    minions: [
                        minion('coffers-thief-minion', 'munchkin_thieves_pickpocket', '0', 2),
                        minion('coffers-winner-minion', 'munchkin_warriors_big_hero', '1', 20),
                    ],
                    ongoingActions: [
                        { uid: 'secret-stash-1', defId: 'munchkin_thieves_secret_stash', ownerId: '0' },
                    ],
                    monsters: [
                        { uid: 'coffers-monster-1', defId: 'munchkin_monster_gross_troll' },
                        { uid: 'coffers-monster-2', defId: 'munchkin_monster_gross_troll' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinDwarfHirelingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'dwarf-hireling-1', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 765,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'dwarf-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinTreasureBathDrawScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'treasure-bath-invader-1', defId: 'alien_invader', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['aliens', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1210,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'treasure-bath-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinGoldDiggerTreasureRecoveryScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1230,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('dwarf-gold-digger', 'munchkin_dwarves_gold_digger', '0', 3),
                        minion('dwarf-gold-digger-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'gold-digger-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'gold-digger-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinHiddenAssetsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'hidden-assets-1', defId: 'munchkin_dwarves_hidden_assets', type: 'action', owner: '0' },
        ],
        deck: [
            { uid: 'hidden-assets-drawn-1', defId: 'alien_invader', type: 'minion', owner: '0' },
            ...deckCards('0', 'munchkin_dwarves_gem_grabber', 17),
        ],
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1240,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
                'munchkin_treasure_bag_of_caltrops',
            ],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('hidden-assets-bystander', 'munchkin_dwarves_loot_lover', '0', 4),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'hidden-assets-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'hidden-assets-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinAnythingForMoneyScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'money-1', defId: 'munchkin_dwarves_anything_for_money', type: 'action', owner: '0' },
            { uid: 'money-discard-a', defId: 'munchkin_dwarves_cash_out', type: 'action', owner: '0' },
            { uid: 'money-discard-b', defId: 'munchkin_dwarves_gem_grabber', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'alien_invader', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1250,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            treasureDiscard: [],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('money-bystander', 'munchkin_dwarves_loot_lover', '0', 4),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'money-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'money-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinCashOutExtraTreasureMinionsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'cash-out-1', defId: 'munchkin_dwarves_cash_out', type: 'action', owner: '0' },
            { uid: 'cash-out-treasure-a', defId: 'munchkin_treasure_dwarf_hireling', type: 'minion', owner: '0' },
            { uid: 'cash-out-treasure-b', defId: 'munchkin_treasure_tiger_steed', type: 'minion', owner: '0' },
            { uid: 'cash-out-non-treasure', defId: 'munchkin_dwarves_gem_grabber', type: 'minion', owner: '0' },
        ],
        deck: deckCards('0', 'alien_invader', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1270,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            treasureDiscard: [],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('cash-out-existing-minion', 'munchkin_dwarves_loot_lover', '0', 4),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'cash-out-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'cash-out-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinCunningPlanBeforeScoringScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'cunning-plan-1', defId: 'munchkin_dwarves_cunning_plan', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'alien_invader', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 17,
            nextUid: 1280,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
            ],
            treasureDiscard: [],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('cunning-plan-scorer', 'munchkin_dwarves_loot_lover', '0', 30),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinMineSearchTreasureScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'mine-1', defId: 'munchkin_dwarves_mine', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'pirate_buccaneer', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 17,
            nextUid: 1290,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_potion_of_idiotic_bravery',
                'munchkin_treasure_magic_missile',
            ],
            treasureDiscard: [],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('mine-host-1', 'munchkin_dwarves_loot_lover', '0', 4),
                        minion('mine-opponent-1', 'pirate_buccaneer', '1', 4),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'mine-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'mine-monster-2', defId: 'munchkin_monster_ghoul' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        minion('mine-host-2', 'alien_invader', '0', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinNoMyPreciousExtraActionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'precious-1', defId: 'munchkin_dwarves_no_my_precious', type: 'action', owner: '0' },
            { uid: 'precious-extra-ring', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'pirate_buccaneer', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 17,
            nextUid: 1300,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [],
            treasureDiscard: [],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        {
                            ...minion('precious-host', 'munchkin_warriors_big_hero', '1', 5),
                            attachedActions: [
                                {
                                    uid: 'precious-treasure-attached',
                                    defId: 'munchkin_treasure_spiky_boots',
                                    ownerId: '1',
                                },
                                {
                                    uid: 'precious-normal-attached',
                                    defId: 'alien_jammed_signal',
                                    ownerId: '1',
                                },
                            ],
                        },
                        minion('precious-bystander', 'munchkin_dwarves_loot_lover', '0', 4),
                    ],
                    ongoingActions: [
                        { uid: 'precious-base-action', defId: 'zombie_overrun', ownerId: '1' },
                    ],
                    monsters: [
                        { uid: 'precious-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'precious-monster-2', defId: 'munchkin_monster_fowl_fiend' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinSalvageBeforeScoringScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'salvage-1', defId: 'munchkin_dwarves_salvage', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'pirate_buccaneer', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 17,
            nextUid: 1310,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_potion_of_idiotic_bravery',
                'munchkin_treasure_magic_missile',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('salvage-host-1', 'munchkin_dwarves_loot_lover', '0', 30),
                        minion('salvage-opponent-1', 'pirate_buccaneer', '1', 4),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('salvage-away-host', 'alien_invader', '0', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinGreedIsGoodScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'greed-1', defId: 'munchkin_dwarves_greed_is_good', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'alien_invader', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1260,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_spiky_boots',
            ],
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_buckler_of_swashing',
            ],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('greed-bystander', 'munchkin_dwarves_loot_lover', '0', 4),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'greed-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'greed-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinDwarfTreasurePowerScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'loot-lover-buckler-1', defId: 'munchkin_treasure_buckler_of_swashing', type: 'action', owner: '0' },
            { uid: 'loot-lover-rocket-1', defId: 'munchkin_treasure_rocket_boots', type: 'action', owner: '0' },
            { uid: 'gem-grabber-jetpack-1', defId: 'munchkin_treasure_temporal_displacement_jetpack', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 3,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1220,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        minion('dwarf-loot-lover', 'munchkin_dwarves_loot_lover', '0', 4),
                        minion('dwarf-power-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('dwarf-gem-grabber', 'munchkin_dwarves_gem_grabber', '0', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinSpikyBootsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'spiky-boots-hand-1', defId: 'munchkin_treasure_spiky_boots', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 7,
            nextUid: 780,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('spiky-host', 'munchkin_warriors_big_hero', '0', 5),
                        minion('spiky-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'spiky-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinTheMinesTreasureAttachmentScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'mines-spiky-boots-1', defId: 'munchkin_treasure_spiky_boots', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1270,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('mines-host', 'munchkin_warriors_big_hero', '0', 5),
                        minion('mines-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'mines-monster-1', defId: 'munchkin_monster_bigfoot' },
                        { uid: 'mines-monster-2', defId: 'munchkin_monster_floating_nose' },
                    ],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinBloodyDismembermentChainsawScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'chainsaw-hand-1', defId: 'munchkin_treasure_bloody_dismemberment_chainsaw', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 8,
            nextUid: 790,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('chainsaw-host', 'munchkin_warriors_big_hero', '0', 5),
                        minion('chainsaw-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'chainsaw-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinLoadsOfTreasureScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'loads-hand-1', defId: 'munchkin_treasure_loads_of_treasure', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 9,
            nextUid: 800,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('loads-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'loads-spiky-1',
                                    defId: 'munchkin_treasure_spiky_boots',
                                    ownerId: '0',
                                },
                            ],
                        },
                        minion('loads-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'loads-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinKneepadsOfAllureScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'kneepads-hand-1', defId: 'munchkin_treasure_kneepads_of_allure', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 10,
            nextUid: 810,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('kneepads-host', 'munchkin_warriors_big_hero', '0', 5),
                        minion('kneepads-ally', 'munchkin_treasure_dwarf_hireling', '0', 2),
                        minion('kneepads-enemy', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'kneepads-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinPotionOfCowardiceScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'cowardice-hand-1', defId: 'munchkin_treasure_potion_of_cowardice', type: 'action', owner: '0' },
            { uid: 'cowardice-talent-cost-1', defId: 'alien_probe', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'aladdin'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 11,
            nextUid: 820,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('cowardice-host', 'aladdin_rajah', '0', 3),
                        minion('cowardice-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'cowardice-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinRocketBootsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_dwarves', 'munchkin_warriors'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'munchkin_orcs_dork_orc', 20),
        discard: [],
        factions: ['munchkin_orcs', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 6,
            nextUid: 800,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('rocket-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'rocket-boots-1',
                                    defId: 'munchkin_treasure_rocket_boots',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinDuplicationPotionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'action-cost-1', defId: 'alien_probe', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_warriors_big_hero', 18),
        discard: [],
        factions: ['munchkin_warriors', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aladdin', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 7,
            nextUid: 900,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('duplication-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'duplication-potion-1',
                                    defId: 'munchkin_treasure_potion_of_duplication',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                        minion('rajah-1', 'aladdin_rajah', '1', 2),
                        minion('no-talent-1', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinMagicMissileScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'munchkin_orcs'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 14,
            nextUid: 1500,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('magic-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'magic-missile-1',
                                    defId: 'munchkin_treasure_magic_missile',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                        minion('magic-low-target', 'alien_invader', '1', 3),
                        minion('magic-high-target', 'munchkin_orcs_sword_lord', '1', 5),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinBucklerOfSwashingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'buckler-hand-1', defId: 'munchkin_treasure_buckler_of_swashing', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 15,
            nextUid: 1580,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        {
                            ...minion('buckler-magic-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'buckler-magic-missile',
                                    defId: 'munchkin_treasure_magic_missile',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                        minion('buckler-unprotected-target', 'alien_invader', '1', 3),
                        minion('buckler-protected-target', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'buckler-monster-1', defId: 'munchkin_monster_bigfoot' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinWishingRingScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'wishing-ring-1', defId: 'munchkin_treasure_wishing_ring', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 15,
            nextUid: 1600,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: ['munchkin_treasure_dwarf_hireling'],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinTreasureFinderScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'treasure-finder-1', defId: 'munchkin_treasure_treasure_finder', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 16,
            nextUid: 1700,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
            ],
            treasureDiscard: [
                'munchkin_treasure_magic_missile',
                'munchkin_treasure_wishing_ring',
            ],
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinCrossbowScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'crossbow-1', defId: 'munchkin_treasure_crossbow', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'pirate_buccaneer', 18),
        discard: [],
        factions: ['pirates', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 2,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['robots', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 17,
            nextUid: 1800,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('crossbow-pirate-a', 'pirate_buccaneer', '0', 4),
                        minion('crossbow-pirate-b', 'pirate_first_mate', '1', 4),
                        minion('crossbow-alien-a', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('crossbow-pirate-away', 'pirate_buccaneer', '0', 4),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinBagOfCaltropsScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '1',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [
            { uid: 'caltrops-target-1', defId: 'pirate_first_mate', type: 'minion', owner: '1' },
        ],
        deck: deckCards('1', 'pirate_first_mate', 20),
        discard: [],
        factions: ['pirates', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 18,
            nextUid: 1900,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [],
                    ongoingActions: [
                        { uid: 'caltrops-1', defId: 'munchkin_treasure_bag_of_caltrops', ownerId: '0' },
                    ],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinPotionOfIdioticBraveryScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'idiotic-bravery-1', defId: 'munchkin_treasure_potion_of_idiotic_bravery', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 19,
            nextUid: 2000,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('bravery-target', 'munchkin_warriors_big_hero', '0', 5),
                        minion('bravery-bystander', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'bravery-monster-1', defId: 'munchkin_monster_ghoul' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinDungeonRulebookScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'dungeon-rulebook-1', defId: 'munchkin_treasure_dungeon_rulebook', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_warriors_big_hero', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['zombies', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 8,
            nextUid: 1000,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('rulebook-host', 'munchkin_warriors_big_hero', '0', 5),
                    ],
                    ongoingActions: [
                        { uid: 'dungeon-target-action-1', defId: 'zombie_overrun', ownerId: '1' },
                    ],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinDwarfKingRecoveryScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'dwarf-king-rulebook-1', defId: 'munchkin_treasure_dungeon_rulebook', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['zombies', 'aliens'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 8,
            nextUid: 1010,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('dwarf-king-e2e', 'munchkin_dwarves_dwarf_king', '0', 5),
                        {
                            ...minion('dwarf-king-host', 'munchkin_warriors_big_hero', '0', 5),
                            attachedActions: [
                                {
                                    uid: 'dwarf-king-spiky-boots',
                                    defId: 'munchkin_treasure_spiky_boots',
                                    ownerId: '1',
                                },
                            ],
                        },
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinHalitosisPotionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'halitosis-1', defId: 'munchkin_treasure_potion_of_halitosis', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_warriors_big_hero', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 9,
            nextUid: 1100,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_the_homeworld'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('halitosis-runner', 'munchkin_warriors_big_hero', '0', 5),
                        minion('halitosis-enemy', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('halitosis-destination-ally', 'munchkin_dwarves_gem_grabber', '0', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinStraightLineRunningAwayScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'straight-line-1', defId: 'munchkin_treasure_potion_of_straight_line_running_away', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_warriors_big_hero', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'ninjas'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 10,
            nextUid: 1200,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_bag_of_caltrops',
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_tiger_steed',
            ],
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        minion('straight-line-winner', 'munchkin_warriors_big_hero', '0', 30),
                    ],
                    ongoingActions: [],
                    monsters: [
                        { uid: 'straight-line-treasure-dragon', defId: 'munchkin_monster_treasure_dragon' },
                    ],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinParalysisPotionScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [
            { uid: 'paralysis-1', defId: 'munchkin_treasure_potion_of_paralysis', type: 'action', owner: '0' },
        ],
        deck: deckCards('0', 'munchkin_warriors_big_hero', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'zombies'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 11,
            nextUid: 1300,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        {
                            ...minion('paralysis-hero', 'munchkin_warriors_big_hero', '0', 30),
                            attachedActions: [
                                {
                                    uid: 'paralysis-rocket-boots',
                                    defId: 'munchkin_treasure_rocket_boots',
                                    ownerId: '0',
                                    talentUsed: false,
                                },
                            ],
                        },
                        minion('paralysis-ally', 'munchkin_treasure_dwarf_hireling', '1', 2),
                    ],
                    ongoingActions: [
                        { uid: 'paralysis-base-action', defId: 'zombie_overrun', ownerId: '1' },
                    ],
                    monsters: [],
                },
                {
                    defId: 'base_treasure_bath',
                    minions: [
                        minion('paralysis-away-minion', 'munchkin_treasure_halfling_hireling', '0', 2),
                    ],
                    ongoingActions: [
                        { uid: 'paralysis-away-action', defId: 'alien_jammed_signal', ownerId: '1' },
                    ],
                    monsters: [],
                },
            ],
        },
    },
});

const buildMunchkinTemporalDisplacementJetpackScene = (): SmashUpSceneConfig => ({
    gameId: 'smashup',
    currentPlayer: '0',
    phase: 'playCards',
    player0: {
        hand: [],
        deck: deckCards('0', 'munchkin_dwarves_gem_grabber', 18),
        discard: [],
        factions: ['munchkin_warriors', 'munchkin_dwarves'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 6,
    },
    player1: {
        hand: [],
        deck: deckCards('1', 'alien_invader', 20),
        discard: [],
        factions: ['aliens', 'zombies'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        vp: 4,
    },
    extra: {
        core: {
            turnOrder: ['0', '1'],
            seatOrder: ['0', '1'],
            turnNumber: 13,
            nextUid: 1400,
            deckQueryEnabled: false,
            enabledExpansions: ['munchkin'],
            monsterDeck: MUNCHKIN_MONSTER_DECK_DEF_IDS,
            treasureDeck: MUNCHKIN_TREASURE_DECK_DEF_IDS,
            baseDeck: ['base_treasure_bath'],
            baseDiscard: [],
            bases: [
                {
                    defId: 'base_the_mines',
                    minions: [
                        {
                            ...minion('jetpack-host', 'munchkin_warriors_big_hero', '0', 30),
                            attachedActions: [
                                {
                                    uid: 'temporal-jetpack-1',
                                    defId: 'munchkin_treasure_temporal_displacement_jetpack',
                                    ownerId: '0',
                                },
                            ],
                        },
                        minion('jetpack-witness', 'alien_invader', '1', 2),
                    ],
                    ongoingActions: [],
                    monsters: [],
                },
                {
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [],
                    monsters: [],
                },
            ],
        },
    },
});

test.describe('大杀四方 Munchkin 怪物与宝藏 UI', () => {
    test('怪物行和公共小牌堆不抢原版布局', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinMonsterTreasureScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-special-supply-row')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-monster-uid]')).toHaveCount(3);
        await expect(page.getByTestId('su-base-titan-titan-on-base-0')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="ongoing-full-sail-0"]')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="su-munchkin-monster-discard"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);

        const layoutEvidence = await page.evaluate(() => {
            const rectOf = (selector: string) => {
                const element = document.querySelector<HTMLElement>(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height,
                };
            };
            const monsterRow = rectOf('[data-testid="su-base-monster-row-0"]');
            const baseCard = rectOf('[data-base-index="0"]');
            const playerColumn = rectOf('[data-testid="su-base-player-column-0-0"]');
            const titanOnBase = rectOf('[data-testid="su-base-titan-titan-on-base-0"]');
            const ongoing = rectOf('[data-ongoing-uid="ongoing-full-sail-0"]');
            const supplyRow = rectOf('[data-testid="su-special-supply-row"]');
            const deckStack = rectOf('[data-testid="su-deck-stack"]');

            return {
                monsterBelowBase: !!monsterRow && !!baseCard && monsterRow.top >= baseCard.bottom - 8,
                monsterAbovePlayerColumn: !!monsterRow && !!playerColumn && monsterRow.bottom <= playerColumn.top + 12,
                titanAboveBase: !!titanOnBase && !!baseCard && titanOnBase.bottom <= baseCard.top + 90,
                ongoingAboveBase: !!ongoing && !!baseCard && ongoing.bottom <= baseCard.top + 90,
                supplyAttachedToDeck: !!supplyRow && !!deckStack && supplyRow.bottom <= deckStack.top + 60,
            };
        });

        expect(layoutEvidence, '怪物行应位于基地卡下方、玩家随从列上方；泰坦/持续行动仍在基地上方；公共小牌堆挂在抽牌堆旁').toEqual({
            monsterBelowBase: true,
            monsterAbovePlayerColumn: true,
            titanAboveBase: true,
            ongoingAboveBase: true,
            supplyAttachedToDeck: true,
        });

        await page.waitForTimeout(800);
        await game.screenshot('01-当前实现-怪物行和公共牌堆', testInfo);

        const treasureDragon = page.locator('[data-monster-uid="monster-dragon-0"][data-defeatable-monster="true"]');
        await expect(treasureDragon).toBeVisible({ timeout: 15000 });
        const treasureDragonBox = await treasureDragon.boundingBox();
        expect(treasureDragonBox, '宝藏龙怪物卡应有可点击的露出切片').not.toBeNull();
        await page.mouse.click(
            treasureDragonBox!.x + Math.max(8, treasureDragonBox!.width * 0.16),
            treasureDragonBox!.y + treasureDragonBox!.height * 0.5,
        );

        await expect(page.locator('[data-monster-uid="monster-dragon-0"]')).toHaveCount(0);
        await expect(page.locator('[data-monster-uid]')).toHaveCount(2);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 19');
        await expect(page.locator('[data-card-uid^="munchkin_treasure_"]')).toHaveCount(3);

        await page.waitForTimeout(800);
        await game.screenshot('02-点击怪物后宝藏进入手牌', testInfo);

        const core = await readCoreState(page) as {
            bases: Array<{ monsters?: Array<{ uid: string; defId: string }> }>;
            players: Record<string, { hand: Array<{ uid: string; defId: string; type: string }> }>;
            monsterDiscard?: string[];
            treasureDeck?: string[];
        };
        expect(core.bases[0].monsters?.map(monster => monster.uid)).toEqual(['monster-bigfoot-0', 'monster-ghoul-0']);
        expect(core.monsterDiscard).toContain('munchkin_monster_treasure_dragon');
        expect(core.players['0'].hand.filter(card => card.uid.startsWith('munchkin_treasure_')).map(card => card.defId)).toEqual([
            'munchkin_treasure_dwarf_hireling',
            'munchkin_treasure_halfling_hireling',
            'munchkin_treasure_tiger_steed',
        ]);
        expect(core.players['0'].hand.filter(card => card.uid.startsWith('munchkin_treasure_')).map(card => card.type)).toEqual([
            'minion',
            'minion',
            'minion',
        ]);
        expect(core.treasureDeck).toHaveLength(19);
    });

    test('半身人雇佣兵可按宝藏随从打出并开放第二个随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinTreasureMinionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="halfling-hireling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="tiger-steed-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('39-半身人雇佣兵手牌与目标基地', testInfo);

        await game.playCard('munchkin_treasure_halfling_hireling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await expect(page.locator('[data-minion-uid="halfling-hireling-1"]').first()).toBeVisible({ timeout: 15000 });

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0MinionsPlayed: player0?.minionsPlayed ?? 0,
                player0MinionLimit: player0?.minionLimit ?? 0,
                hasLongTermTreasureZone: player0 ? Object.prototype.hasOwnProperty.call(player0, 'treasures') : false,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['halfling-hireling-1'],
            player0HandDefIds: ['munchkin_treasure_tiger_steed'],
            player0DiscardDefIds: [],
            player0MinionsPlayed: 1,
            player0MinionLimit: 2,
            hasLongTermTreasureZone: false,
            triggerQueueLength: 0,
        });

        await game.playCard('munchkin_treasure_tiger_steed', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0MinionsPlayed: player0?.minionsPlayed ?? 0,
                player0MinionLimit: player0?.minionLimit ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['halfling-hireling-1', 'tiger-steed-1'],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0MinionsPlayed: 2,
            player0MinionLimit: 2,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await page.waitForTimeout(1000);
        await game.screenshot('40-半身人雇佣兵开放第二个随从后状态', testInfo);
    });

    test('半身人可打出后只开放同基地额外随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinQuarterlingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="quarterling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="quarterling-away-blocked-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="quarterling-extra-here-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('98-半身人手牌与两个候选基地', testInfo);

        await game.playCard('munchkin_halflings_quarterling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await page.waitForTimeout(600);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['quarterling-1'],
            base1Uids: [],
            handUids: ['quarterling-away-blocked-1', 'quarterling-extra-here-1'],
            quota0: 1,
            minionsPlayed: 1,
        });
        await game.screenshot('99-半身人额外随从不能打到其他基地', testInfo);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['quarterling-1', 'quarterling-extra-here-1'],
            base1Uids: [],
            handUids: ['quarterling-away-blocked-1'],
            quota0: 0,
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('100-半身人额外随从打到同基地后收口', testInfo);
    });

    test('生日派对无人时阻止去别处打随从，补上后恢复其他基地打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinBirthdayPartyRestrictionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="birthday-blocked-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="birthday-guest-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="birthday-free-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('101-生日派对无人时手牌与基地', testInfo);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await page.waitForTimeout(600);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                birthdayUids: core.bases[0].minions.map(entry => entry.uid),
                otherUids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            birthdayUids: [],
            otherUids: [],
            handUids: ['birthday-blocked-1', 'birthday-guest-1', 'birthday-free-1'],
            minionsPlayed: 0,
        });

        await game.playCard('munchkin_halflings_pestling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await game.screenshot('102-生日派对补上己方仆从', testInfo);

        await game.selectBase(1);
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                birthdayUids: core.bases[0].minions.map(entry => entry.uid),
                otherUids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            birthdayUids: ['birthday-guest-1'],
            otherUids: ['birthday-free-1'],
            handUids: ['birthday-blocked-1'],
            minionsPlayed: 2,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('103-生日派对有己方仆从后允许去别处', testInfo);
    });

    test('地下矮屋回合开始给没有仆从的玩家一个本基地额外随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSubterraneanLairScene());

        await game.advancePhase();
        await game.waitForCurrentPlayer('0', 10000);
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                currentPlayerIndex: core.currentPlayerIndex,
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
            };
        }, { timeout: 10000 }).toEqual({
            currentPlayerIndex: 0,
            quota0: 1,
            handUids: ['lair-normal-away-1', 'lair-extra-here-1'],
        });
        await game.screenshot('104-地下矮屋回合开始授予本基地额度', testInfo);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                lairUids: core.bases[0].minions.map(entry => entry.uid),
                otherUids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            lairUids: ['lair-extra-here-1'],
            otherUids: ['lair-normal-away-1'],
            handUids: [],
            quota0: 0,
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('105-地下矮屋额外随从打到本基地后收口', testInfo);
    });

    test('夏尔首领天赋选择基地后只开放所选基地额外随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinShireMarshalScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const marshal = page.locator('[data-minion-uid="shire-marshal-1"]').first();
        await expect(marshal).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="shire-extra-here-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('106-夏尔首领天赋前多基地候选', testInfo);

        await marshal.click({ force: true });
        await game.waitForInteraction('munchkin_halflings_shire_marshal_choose_base', 10000);
        await game.screenshot('107-夏尔首领选择额外随从基地', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.baseIndex === 1,
            '夏尔首领目标基地',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                quota1: core.players?.['0']?.baseLimitedMinionQuota?.[1] ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['shire-marshal-1', 'shire-opponent-1'],
            base1Uids: ['shire-opponent-2'],
            handUids: ['shire-extra-here-1'],
            quota0: 0,
            quota1: 1,
        });

        await game.playCard('pirate_first_mate', { targetBaseIndex: 1 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const shireMarshalState = core.bases[0].minions.find(entry => entry.uid === 'shire-marshal-1');
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota1: core.players?.['0']?.baseLimitedMinionQuota?.[1] ?? 0,
                marshalTalentUsed: shireMarshalState?.talentUsed === true,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['shire-marshal-1', 'shire-opponent-1'],
            base1Uids: ['shire-opponent-2', 'shire-extra-here-1'],
            handUids: [],
            quota1: 0,
            marshalTalentUsed: true,
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('108-夏尔首领额外随从打到所选基地后收口', testInfo);
    });

    test('调皮鬼打出后只开放本基地额外随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinPestlingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="pestling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="pestling-away-blocked-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="pestling-extra-here-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('109-调皮鬼手牌与两个候选基地', testInfo);

        await game.playCard('munchkin_halflings_pestling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await page.waitForTimeout(600);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['pestling-1'],
            base1Uids: [],
            handUids: ['pestling-away-blocked-1', 'pestling-extra-here-1'],
            quota0: 1,
            minionsPlayed: 1,
        });
        await game.screenshot('110-调皮鬼额外随从不能打到其他基地', testInfo);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['pestling-1', 'pestling-extra-here-1'],
            base1Uids: [],
            handUids: ['pestling-away-blocked-1'],
            quota0: 0,
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('111-调皮鬼额外随从打到同基地后收口', testInfo);
    });

    test('吟游诗人对手力量更大时只开放本基地额外随从额度', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinBardlingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="bardling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="bardling-away-blocked-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="bardling-extra-here-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('112-吟游诗人手牌与对手高力量基地', testInfo);

        await game.playCard('munchkin_halflings_bardling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await game.playCard('alien_invader', { targetBaseIndex: 1 });
        await page.waitForTimeout(600);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['bardling-ally-1', 'bardling-opponent-1', 'bardling-1'],
            base1Uids: [],
            handUids: ['bardling-away-blocked-1', 'bardling-extra-here-1'],
            quota0: 1,
            minionsPlayed: 1,
        });
        await game.screenshot('113-吟游诗人额外随从不能打到其他基地', testInfo);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Uids: core.bases[0].minions.map(entry => entry.uid),
                base1Uids: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                quota0: core.players?.['0']?.baseLimitedMinionQuota?.[0] ?? 0,
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['bardling-ally-1', 'bardling-opponent-1', 'bardling-1', 'bardling-extra-here-1'],
            base1Uids: [],
            handUids: ['bardling-away-blocked-1'],
            quota0: 0,
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('114-吟游诗人额外随从打到同基地后收口', testInfo);
    });

    test('午餐散步在本基地打出仆从后真实抽牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinLunchRunScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="lunch-run-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="lunch-minion-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('115-午餐散步手牌与目标基地', testInfo);

        await game.playCard('munchkin_halflings_lunch_run', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await expect(page.locator('[data-ongoing-uid="lunch-run-1"]').first()).toBeVisible({ timeout: 15000 });

        await game.playCard('alien_invader', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Minions: core.bases[0].minions.map(entry => entry.uid),
                base0Ongoing: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DeckTopUid: player0?.deck?.[0]?.uid ?? null,
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['lunch-minion-1'],
            base0Ongoing: ['lunch-run-1'],
            player0HandUids: ['lunch-draw-1'],
            player0DeckTopUid: '0-deck-0',
            player0DiscardUids: [],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('116-午餐散步触发后抽到一张牌', testInfo);
    });

    test('偷偷摸摸保护本基地己方仆从不受对手行动影响', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSneaksyScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="sneaksy-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="sneaksy-protected-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('117-偷偷摸摸打出前本基地己方仆从', testInfo);

        await game.playCard('munchkin_halflings_sneaksy', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await expect(page.locator('[data-ongoing-uid="sneaksy-1"]').first()).toBeVisible({ timeout: 15000 });

        await game.setupScene(buildMunchkinSneaksyProtectionScene());
        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await game.waitForCurrentPlayer('1', 15000);
        await expect(page.locator('[data-card-uid="sneaksy-broadside-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('118-偷偷摸摸在场后轮到对手行动', testInfo);

        await game.playCard('pirate_broadside');
        await page.waitForTimeout(600);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                base0Minions: core.bases[0].minions.map(entry => entry.uid),
                base0Ongoing: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                player1DiscardDefIds: core.players?.['1']?.discard?.map(card => card.defId) ?? [],
                player1ActionsPlayed: core.players?.['1']?.actionsPlayed ?? 0,
                broadsideDestroyedProtected: events.some(event =>
                    event?.type === 'su:minion_destroyed'
                    && event.payload?.reason === 'pirate_broadside'
                    && event.payload?.minionUid === 'sneaksy-protected-1'
                ),
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['sneaksy-protected-1', 'sneaksy-opponent-1'],
            base0Ongoing: ['sneaksy-1'],
            player1DiscardDefIds: ['pirate_broadside'],
            player1ActionsPlayed: 1,
            broadsideDestroyedProtected: false,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('119-偷偷摸摸保护后侧舷炮击无合法目标', testInfo);
    });

    test('偷袭展示牌库直到两个仆从并把它们加入手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinOutOfNowhereScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="out-of-nowhere-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('120-偷袭打出前手牌与牌库', testInfo);

        await game.playCard('munchkin_halflings_out_of_nowhere');
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            const reveal = events.find(event => event?.type === 'su:reveal_deck_top');
            const draw = events.find(event => event?.type === 'su:cards_drawn');
            return {
                handUids: player0?.hand?.map(card => card.uid) ?? [],
                deckUids: player0?.deck?.map(card => card.uid) ?? [],
                discardUids: player0?.discard?.map(card => card.uid) ?? [],
                revealCount: reveal?.payload?.cards?.length ?? 0,
                drawnUids: draw?.payload?.cardUids ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            handUids: ['out-reveal-minion-1', 'out-reveal-minion-2'],
            deckUids: ['out-unrevealed-1', 'out-reveal-action-1', 'out-reveal-action-2'],
            discardUids: ['out-of-nowhere-1'],
            revealCount: 4,
            drawnUids: ['out-reveal-minion-1', 'out-reveal-minion-2'],
            triggerQueueLength: 0,
            interactionSourceId: null,
        });
        await game.screenshot('121-偷袭结算后两个仆从进手牌', testInfo);
    });

    test('最后通牒在计分前打出手牌随从并取消其能力', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinLastCallScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="last-call-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="last-call-minion-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="last-call-scorer"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('122-最后通牒计分前手牌与当前基地', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'scoreBases'
                    && state?.sys?.responseWindow?.current?.windowType === 'meFirst'
                    && state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose';
            },
            { timeout: 15000, polling: 200 },
        );
        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return {
                hasLastCallOption: options.some(option =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'last-call-1'
                    && option.value?.targetBaseIndex === 0
                ),
            };
        }, { timeout: 10000 }).toEqual({ hasLastCallOption: true });
        await game.screenshot('123-最后通牒beforeScoring响应入口', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.kind === 'play_action'
                && option.value?.cardUid === 'last-call-1'
                && option.value?.targetBaseIndex === 0,
            'beforeScoring 选择最后通牒',
        );
        await game.waitForInteraction('munchkin_halflings_last_call_choose_minion', 10000);
        await game.screenshot('124-最后通牒选择要打出的手牌随从', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'last-call-minion-1',
            '最后通牒选择海盗大副',
        );
        await game.waitForNoInteraction(15000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState & { suppressedCardUidsUntilTurnEnd?: string[] };
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                playedByLastCall: events.some(event =>
                    event?.type === 'su:minion_played'
                    && event.payload?.cardUid === 'last-call-minion-1'
                    && event.payload?.skipOnPlayAbility === true
                ),
                suppressedByLastCall: events.some(event =>
                    event?.type === 'su:cards_suppressed_until_turn_end'
                    && event.payload?.reason === 'munchkin_halflings_last_call'
                    && event.payload?.cardUids?.includes('last-call-minion-1')
                ),
                player0DiscardUids: core.players?.['0']?.discard?.map(card => card.uid) ?? [],
                suppressionStillActiveAfterScoring: core.suppressedCardUidsUntilTurnEnd ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            playedByLastCall: true,
            suppressedByLastCall: true,
            player0DiscardUids: ['last-call-1', 'last-call-scorer', 'last-call-minion-1'],
            suppressionStillActiveAfterScoring: [],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('125-最后通牒计分收口后随从已进弃牌', testInfo);
    });

    test('惊醒把手牌所有随从额外打到所选基地并取消能力', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinRudeAwakeningScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="awakening-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="awakening-minion-a"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="awakening-minion-b"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('126-惊醒打出前手牌随从与目标基地', testInfo);

        await game.playCard('munchkin_halflings_rude_awakening', { targetBaseIndex: 1 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState & { suppressedCardUidsUntilTurnEnd?: string[] };
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                base0Minions: core.bases[0].minions.map(entry => entry.uid),
                base1Minions: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                discardUids: core.players?.['0']?.discard?.map(card => card.uid) ?? [],
                suppressed: core.suppressedCardUidsUntilTurnEnd ?? [],
                revealedUids: events.find(event => event?.type === 'su:reveal_hand')?.payload?.cards?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: [],
            base1Minions: ['awakening-minion-a', 'awakening-minion-b'],
            handUids: ['awakening-left-action'],
            discardUids: ['awakening-1'],
            suppressed: ['awakening-minion-a', 'awakening-minion-b'],
            revealedUids: ['awakening-minion-a', 'awakening-minion-b', 'awakening-left-action'],
            triggerQueueLength: 0,
            interactionSourceId: null,
        });
        await game.screenshot('127-惊醒结算后所有手牌随从入所选基地', testInfo);
    });

    test('小而坚韧让宿主被摧毁时回到牌库顶', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSmallButToughScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="small-host-1"]').first();
        await expect(page.locator('[data-card-uid="small-but-tough-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="small-destroyer-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(host).toBeVisible({ timeout: 15000 });
        await game.screenshot('128-小而坚韧附着前宿主与摧毁者', testInfo);

        await game.playCard('munchkin_halflings_small_but_tough', { targetMinionUid: 'small-host-1' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await host.hover();
        await expect(page.locator('[data-attached-action-uid="small-but-tough-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('129-小而坚韧已附着到宿主', testInfo);

        await game.playCard('pirate_saucy_wench', { targetBaseIndex: 0 });
        await game.waitForInteraction('pirate_saucy_wench', 10000);
        await game.screenshot('130-粗鲁少妇选择摧毁小而坚韧宿主', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'small-host-1',
            '粗鲁少妇选择小而坚韧宿主',
        );
        await page.waitForTimeout(600);
        if ((await getReactionWindowStatus(page)).sourceId === 'smashup_reaction_choose') {
            await chooseReactionBySourceDefId(game, 'munchkin_halflings_small_but_tough', '小而坚韧触发');
        }
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Minions: core.bases[0].minions.map(entry => entry.uid),
                deckUids: core.players?.['0']?.deck?.map(card => card.uid) ?? [],
                discardUids: core.players?.['0']?.discard?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['small-destroyer-1'],
            deckUids: ['small-host-1', 'small-deck-1'],
            discardUids: ['small-but-tough-1'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('131-小而坚韧宿主回到牌库顶', testInfo);
    });

    test('被宠坏的小家伙从弃牌堆多选随从洗回牌库顶', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSpoiledBratsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="spoiled-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('132-被宠坏的小家伙打出前手牌与弃牌堆', testInfo);

        await game.playCard('munchkin_halflings_spoiled_brats');
        await game.waitForInteraction('munchkin_halflings_spoiled_brats_choose_minions', 10000);
        const options = await game.getInteractionOptions() as InteractionOption[];
        const minionA = options.find(option => option.value?.cardUid === 'spoiled-minion-1');
        const minionB = options.find(option => option.value?.cardUid === 'spoiled-minion-2');
        const actionOption = options.find(option => option.value?.cardUid === 'spoiled-action-1');
        expect(minionA?.id, '弃牌堆第一个随从必须可选').toBeTruthy();
        expect(minionB?.id, '弃牌堆第二个随从必须可选').toBeTruthy();
        expect(actionOption?.id, '弃牌堆非随从不应可选').toBeFalsy();
        await game.screenshot('133-被宠坏的小家伙多选弃牌堆随从', testInfo);

        await expect(page.locator('[data-discard-view-panel] [data-card-uid="spoiled-minion-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-discard-view-panel] [data-card-uid="spoiled-minion-2"]').first()).toBeVisible({ timeout: 15000 });
        await page.locator('[data-discard-view-panel] [data-card-uid="spoiled-minion-1"]').first().click({ force: true });
        await page.locator('[data-discard-view-panel] [data-card-uid="spoiled-minion-2"]').first().click({ force: true });
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                deckUids: player0?.deck?.map(card => card.uid) ?? [],
                discardUids: player0?.discard?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            deckUids: ['spoiled-minion-1', 'spoiled-minion-2', 'spoiled-deck-1'],
            discardUids: ['spoiled-action-1', 'spoiled-1'],
            triggerQueueLength: 0,
            interactionSourceId: null,
        });
        await game.screenshot('134-被宠坏的小家伙把所选随从放到牌库顶', testInfo);
    });

    test('意外的派对选择无己方随从基地并立即打出额外随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinUnexpectedPartyScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="party-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="party-minion-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('135-意外的派对打出前无己方随从目标基地', testInfo);

        await game.playCard('munchkin_halflings_unexpected_party');
        await game.waitForInteraction('munchkin_halflings_unexpected_party_choose_base', 10000);
        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return {
                hasSkip: options.some(option => option.value?.skip === true),
                hasOwnBase: options.some(option => option.value?.baseIndex === 0),
                hasEnemyOnlyBase: options.some(option => option.value?.baseIndex === 1),
            };
        }, { timeout: 10000 }).toEqual({
            hasSkip: true,
            hasOwnBase: false,
            hasEnemyOnlyBase: true,
        });
        await game.screenshot('136-意外的派对只能选择没有己方随从的基地', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.baseIndex === 1,
            '意外的派对选择无己方随从基地',
        );
        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
        await game.screenshot('137-意外的派对进入立即额外随从选择', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'party-minion-1',
            '意外的派对选择额外打出海盗大副',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0Minions: core.bases[0].minions.map(entry => entry.uid),
                base1Minions: core.bases[1].minions.map(entry => entry.uid),
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                discardUids: core.players?.['0']?.discard?.map(card => card.uid) ?? [],
                minionsPlayed: core.players?.['0']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Minions: ['party-own-1'],
            base1Minions: ['party-enemy-1', 'party-minion-1'],
            handUids: [],
            discardUids: ['party-1'],
            minionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('138-意外的派对额外随从打到所选基地后收口', testInfo);
    });

    test('盗贼大师可从真实天赋入口抽一张公共宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesMasterThiefScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const master = page.locator('[data-minion-uid="master-thief-1"]').first();
        await expect(master).toBeVisible({ timeout: 15000 });
        await expect(master).toHaveAttribute('data-activation-armed', 'false');
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('139-盗贼大师天赋前宝藏堆与怪物槽', testInfo);

        await master.click({ force: true });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const masterState = core.bases[0].minions.find(minion => minion.uid === 'master-thief-1');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                masterTalentUsed: masterState?.talentUsed === true,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            masterTalentUsed: true,
            player0HandUids: ['master-pressure-action', 'munchkin_treasure_1900'],
            player0HandDefIds: ['alien_probe', 'munchkin_treasure_wishing_ring'],
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="munchkin_treasure_1900"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-used-badge-master-thief-1')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('140-盗贼大师天赋后宝藏进入手牌', testInfo);
    });

    test('顺手拿走作为普通行动从真实手牌入口抽一张公共宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesSwipeScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="swipe-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="swipe-pressure-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('141-顺手拿走打出前手牌与宝藏堆', testInfo);

        await game.playCard('munchkin_thieves_swipe');
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0HandUids: ['swipe-pressure-minion', 'munchkin_treasure_1910'],
            player0HandDefIds: ['alien_invader', 'munchkin_treasure_wishing_ring'],
            player0DiscardDefIds: ['munchkin_thieves_swipe'],
            player0ActionsPlayed: 1,
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="munchkin_treasure_1910"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('142-顺手拿走结算后宝藏进入手牌', testInfo);
    });

    test('扒手只有同基地已有另一个扒手时才从真实打出入口抽宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesPickpocketScene(true));

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="pickpocket-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="other-pickpocket"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('143-扒手同基地已有另一个扒手前', testInfo);

        await game.playCard('munchkin_thieves_pickpocket', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['other-pickpocket', 'pickpocket-1'],
            player0HandUids: ['munchkin_treasure_1920'],
            player0HandDefIds: ['munchkin_treasure_wishing_ring'],
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="munchkin_treasure_1920"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('144-扒手同基地有另一个扒手后抽宝藏', testInfo);

        await game.setupScene(buildMunchkinThievesPickpocketScene(false));
        await expect(page.locator('[data-card-uid="solo-pickpocket-1"]').first()).toBeVisible({ timeout: 15000 });
        await game.playCard('munchkin_thieves_pickpocket', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['solo-pickpocket-1'],
            player0HandUids: [],
            treasureDeck: ['munchkin_treasure_wishing_ring', 'munchkin_treasure_spiky_boots'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('145-扒手无另一个扒手时不抽宝藏', testInfo);
    });

    test('猫咪窃贼可展示任意数量手牌宝藏并按数量加力量指示物', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesCatBurglarScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cat-burglar-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cat-treasure-ring"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cat-treasure-hireling"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cat-normal-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await game.screenshot('146-猫咪窃贼打出前手牌宝藏与普通牌', testInfo);

        await game.playCard('munchkin_thieves_cat_burglar', { targetBaseIndex: 0 });
        await game.waitForInteraction('munchkin_thieves_cat_burglar_choose_treasures', 10000);
        const catOptions = await game.getInteractionOptions();
        const ringOption = catOptions.find((option: InteractionOption) => option.value?.cardUid === 'cat-treasure-ring');
        const hirelingOption = catOptions.find((option: InteractionOption) => option.value?.cardUid === 'cat-treasure-hireling');
        expect(ringOption?.id, '猫咪窃贼应列出许愿戒指').toBeTruthy();
        expect(hirelingOption?.id, '猫咪窃贼应列出矮人雇佣兵').toBeTruthy();
        expect(catOptions.some((option: InteractionOption) => option.value?.cardUid === 'cat-normal-minion')).toBe(false);
        await game.screenshot('147-猫咪窃贼选择任意数量手牌宝藏', testInfo);

        await page.locator(`[data-option-id="${ringOption!.id}"]`).first().click({ force: true });
        await page.locator(`[data-option-id="${hirelingOption!.id}"]`).first().click({ force: true });
        await game.screenshot('148-猫咪窃贼已选两张宝藏待确认', testInfo);
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await expect(page.getByTestId('reveal-overlay')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('reveal-card')).toHaveCount(2);
        await game.screenshot('149-猫咪窃贼展示两张宝藏', testInfo);
        await page.getByTestId('reveal-dismiss-btn').click({ force: true });
        await expect(page.getByTestId('reveal-overlay')).toHaveCount(0, { timeout: 5000 });
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const cat = core.bases[0].minions.find(minion => minion.uid === 'cat-burglar-1');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                catPowerCounters: cat?.powerCounters ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                revealByCat: events.some((event: TriggerQueueEvidenceEvent | undefined) =>
                    event?.type === 'su:reveal_hand'
                    && event.payload?.reason === 'munchkin_thieves_cat_burglar'
                ),
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['cat-burglar-1'],
            catPowerCounters: 2,
            player0HandUids: ['cat-treasure-ring', 'cat-treasure-hireling', 'cat-normal-minion'],
            player0HandDefIds: ['munchkin_treasure_wishing_ring', 'munchkin_treasure_dwarf_hireling', 'alien_invader'],
            treasureDeck: ['munchkin_treasure_wishing_ring', 'munchkin_treasure_spiky_boots'],
            revealByCat: true,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-minion-power-badge-cat-burglar-1')).toContainText('+2');
        await expect(page.getByTestId('su-minion-power-badge-cat-burglar-1')).toHaveAttribute('title', /力量指示物: \+2[\s\S]*= 5/);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('150-猫咪窃贼展示宝藏后获得两个力量指示物', testInfo);

        await game.setupScene(buildMunchkinThievesCatBurglarScene(1950));
        await game.playCard('munchkin_thieves_cat_burglar', { targetBaseIndex: 0 });
        await game.waitForInteraction('munchkin_thieves_cat_burglar_choose_treasures', 10000);
        await game.screenshot('151-猫咪窃贼有宝藏时也允许空选', testInfo);
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await expect(page.getByTestId('reveal-overlay')).toHaveCount(0, { timeout: 5000 });
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const cat = core.bases[0].minions.find(minion => minion.uid === 'cat-burglar-1');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                catPowerCounters: cat?.powerCounters ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['cat-burglar-1'],
            catPowerCounters: 0,
            player0HandUids: ['cat-treasure-ring', 'cat-treasure-hireling', 'cat-normal-minion'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-minion-power-badge-cat-burglar-1')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('152-猫咪窃贼空选后不展示也不加指示物', testInfo);
    });

    test('销赃犯可从真实天赋入口弃两张手牌宝藏获得 1VP', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesFenceScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="fence-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="fence-treasure-ring"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="fence-treasure-hireling"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="fence-normal-card"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('153-销赃犯天赋前手牌宝藏与怪物槽', testInfo);

        await page.locator('[data-minion-uid="fence-1"]').first().click({ force: true });
        await game.waitForInteraction('munchkin_thieves_fence_choose_treasures', 10000);
        const fenceOptions = await game.getInteractionOptions();
        const ringOption = fenceOptions.find((option: InteractionOption) => option.value?.cardUid === 'fence-treasure-ring');
        const hirelingOption = fenceOptions.find((option: InteractionOption) => option.value?.cardUid === 'fence-treasure-hireling');
        expect(ringOption?.id, '销赃犯应列出手牌许愿指环').toBeTruthy();
        expect(hirelingOption?.id, '销赃犯应列出手牌矮人雇佣兵').toBeTruthy();
        expect(fenceOptions.some((option: InteractionOption) => option.value?.cardUid === 'fence-normal-card')).toBe(false);
        await game.screenshot('154-销赃犯选择两张手牌宝藏', testInfo);

        await page.locator(`[data-option-id="${ringOption!.id}"]`).first().click({ force: true });
        await page.locator(`[data-option-id="${hirelingOption!.id}"]`).first().click({ force: true });
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const fence = core.bases[0].minions.find(minion => minion.uid === 'fence-1');
            return {
                player0Vp: player0?.vp ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                fenceTalentUsed: fence?.talentUsed === true,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0Vp: 4,
            player0HandUids: ['fence-normal-card'],
            player0DiscardUids: ['fence-treasure-ring', 'fence-treasure-hireling'],
            fenceTalentUsed: true,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="fence-normal-card"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('155-销赃犯弃宝藏后VP增加', testInfo);
    });

    test('背刺可从真实手牌入口弃一张宝藏并摧毁低力量随从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesBackstabScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="backstab-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="backstab-treasure-ring"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="backstab-low-target"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="backstab-high-target"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('156-背刺打出前手牌宝藏与高低力量目标', testInfo);

        await game.playCard('munchkin_thieves_backstab');
        await game.waitForInteraction('munchkin_thieves_backstab_choose_treasure', 10000);
        const treasureOptions = await game.getInteractionOptions();
        const treasureOption = treasureOptions.find((option: InteractionOption) => option.value?.cardUid === 'backstab-treasure-ring');
        expect(treasureOption?.id, '背刺应列出手牌宝藏作为成本').toBeTruthy();
        expect(treasureOptions.some((option: InteractionOption) => option.value?.cardUid === 'backstab-normal-card')).toBe(false);
        await game.screenshot('157-背刺选择一张手牌宝藏作为成本', testInfo);
        await page.locator(`[data-option-id="${treasureOption!.id}"]`).first().click({ force: true });
        await game.confirm();

        await game.waitForInteraction('munchkin_thieves_backstab_choose_minion', 10000);
        const targetOptions = await game.getInteractionOptions();
        expect(targetOptions.some((option: InteractionOption) => option.value?.minionUid === 'backstab-low-target')).toBe(true);
        expect(targetOptions.some((option: InteractionOption) => option.value?.minionUid === 'backstab-high-target')).toBe(false);
        await game.screenshot('158-背刺只允许选择力量3或更少的随从', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.minionUid === 'backstab-low-target',
            '背刺选择低力量随从',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player1DiscardDefIds: player1?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['backstab-high-target'],
            player0HandUids: ['backstab-normal-card'],
            player0DiscardUids: ['backstab-1', 'backstab-treasure-ring'],
            player1DiscardDefIds: ['alien_invader'],
            player0ActionsPlayed: 1,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-minion-uid="backstab-high-target"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="backstab-low-target"]')).toHaveCount(0);
        await game.screenshot('159-背刺摧毁低力量随从后收口', testInfo);
    });

    test('药水腰带可从真实手牌入口弃宝藏并给任意随从本回合加力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesPotionBandolierScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="bandolier-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="bandolier-treasure-ring"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="bandolier-target"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="bandolier-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('160-药水腰带打出前手牌宝藏与目标随从', testInfo);

        await game.playCard('munchkin_thieves_potion_bandolier', {
            targetMinionUid: 'bandolier-target',
        });
        await game.waitForInteraction('munchkin_thieves_potion_bandolier_choose_treasure', 10000);
        const treasureOptions = await game.getInteractionOptions();
        const treasureOption = treasureOptions.find((option: InteractionOption) => option.value?.cardUid === 'bandolier-treasure-ring');
        expect(treasureOption?.id, '药水腰带应列出手牌宝藏作为成本').toBeTruthy();
        expect(treasureOptions.some((option: InteractionOption) => option.value?.cardUid === 'bandolier-normal-card')).toBe(false);
        await game.screenshot('161-药水腰带选择一张手牌宝藏作为成本', testInfo);
        await page.locator(`[data-option-id="${treasureOption!.id}"]`).first().click({ force: true });
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const target = core.bases[0].minions.find(minion => minion.uid === 'bandolier-target');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'bandolier-bystander');
            return {
                targetTempPower: target?.tempPowerModifier ?? 0,
                bystanderTempPower: bystander?.tempPowerModifier ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            targetTempPower: 3,
            bystanderTempPower: 0,
            player0HandUids: ['bandolier-normal-card'],
            player0DiscardUids: ['bandolier-1', 'bandolier-treasure-ring'],
            player0ActionsPlayed: 1,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-minion-power-badge-bandolier-target')).toContainText('+3');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('162-药水腰带结算后目标获得临时力量', testInfo);
    });

    test('走私可从真实手牌入口弃两张宝藏得VP并把弃牌洗回牌库', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesSmugglingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="smuggling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="smuggling-treasure-ring"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="smuggling-treasure-hireling"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await game.screenshot('163-走私打出前手牌宝藏与个人弃牌', testInfo);

        await game.playCard('munchkin_thieves_smuggling');
        await game.waitForInteraction('munchkin_thieves_smuggling_choose_treasures', 10000);
        const smugglingOptions = await game.getInteractionOptions();
        const ringOption = smugglingOptions.find((option: InteractionOption) => option.value?.cardUid === 'smuggling-treasure-ring');
        const hirelingOption = smugglingOptions.find((option: InteractionOption) => option.value?.cardUid === 'smuggling-treasure-hireling');
        expect(ringOption?.id, '走私应列出手牌许愿指环').toBeTruthy();
        expect(hirelingOption?.id, '走私应列出手牌矮人雇佣兵').toBeTruthy();
        await game.screenshot('164-走私选择两张手牌宝藏作为成本', testInfo);

        await page.locator(`[data-option-id="${ringOption!.id}"]`).first().click({ force: true });
        await page.locator(`[data-option-id="${hirelingOption!.id}"]`).first().click({ force: true });
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0Vp: player0?.vp ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0DeckSize: player0?.deck?.length ?? 0,
                player0DeckBottomUid: player0?.deck?.at(-1)?.uid ?? null,
                player0DeckUidSet: [...new Set(player0?.deck?.map(card => card.uid) ?? [])].sort(),
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0Vp: 5,
            player0HandUids: [],
            player0DiscardUids: [],
            player0DeckSize: 7,
            player0DeckBottomUid: 'smuggling-1',
            player0DeckUidSet: [
                'smuggling-1',
                'smuggling-deck-a',
                'smuggling-deck-b',
                'smuggling-discard-a',
                'smuggling-discard-b',
                'smuggling-treasure-hireling',
                'smuggling-treasure-ring',
            ],
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="smuggling-1"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('165-走私结算后VP增加且个人弃牌洗回牌库', testInfo);
    });

    test('打劫可从真实手牌入口转移仆从身上的行动到己方另一个仆从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesMuggingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="mugging-1"]').first()).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="mugging-enemy-host"]').first();
        const target = page.locator('[data-minion-uid="mugging-own-target"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await expect(target).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(page.locator('[data-attached-action-uid="mugging-spiky-boots"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('166-打劫打出前附着行动与己方目标', testInfo);

        await game.playCard('munchkin_thieves_mugging');
        await game.waitForInteraction('munchkin_thieves_mugging_choose_action', 10000);
        const actionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(actionOptions.some((option) => option.value?.cardUid === 'mugging-spiky-boots')).toBe(true);
        await host.hover();
        await game.screenshot('167-打劫选择仆从身上的行动', testInfo);
        await page.locator('[data-attached-action-uid="mugging-spiky-boots"]').first().click({ force: true });

        await game.waitForInteraction('munchkin_thieves_mugging_choose_minion', 10000);
        const minionOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(minionOptions.some((option) => option.value?.minionUid === 'mugging-own-target')).toBe(true);
        expect(minionOptions.some((option) => option.value?.minionUid === 'mugging-enemy-host')).toBe(false);
        await game.screenshot('168-打劫选择己方另一个仆从', testInfo);
        await target.click({ force: true });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const sourceHost = core.bases[0].minions.find(minion => minion.uid === 'mugging-enemy-host');
            const ownTarget = core.bases[0].minions.find(minion => minion.uid === 'mugging-own-target');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                sourceAttachedUids: sourceHost?.attachedActions?.map(action => action.uid) ?? [],
                targetAttachedUids: ownTarget?.attachedActions?.map(action => action.uid) ?? [],
                targetAttachedDefIds: ownTarget?.attachedActions?.map(action => action.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            sourceAttachedUids: [],
            targetAttachedUids: ['mugging-spiky-boots'],
            targetAttachedDefIds: ['munchkin_treasure_spiky_boots'],
            player0DiscardDefIds: ['munchkin_thieves_mugging'],
            player0ActionsPlayed: 1,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await target.hover();
        await expect(page.locator('[data-minion-uid="mugging-own-target"]').locator('[data-attached-action-uid="mugging-spiky-boots"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mugging-enemy-host"]').locator('[data-attached-action-uid="mugging-spiky-boots"]')).toHaveCount(0);
        await game.screenshot('169-打劫结算后行动附着到己方目标', testInfo);
    });

    test('剥光可从真实手牌入口拿走场上的宝藏牌进当前玩家手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesStripBareScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="strip-bare-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="strip-treasure-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="strip-normal-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="strip-treasure-action"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('170-剥光打出前场上宝藏牌', testInfo);

        await game.playCard('munchkin_thieves_strip_bare');
        await game.waitForInteraction('munchkin_thieves_strip_bare_choose_treasure', 10000);
        const stripOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(stripOptions.some((option) => option.value?.cardUid === 'strip-treasure-action')).toBe(true);
        expect(stripOptions.some((option) => option.value?.cardUid === 'strip-treasure-minion')).toBe(true);
        expect(stripOptions.some((option) => option.value?.cardUid === 'strip-normal-minion')).toBe(false);
        await game.screenshot('171-剥光选择场上的宝藏牌', testInfo);
        await page.locator('[data-ongoing-uid="strip-treasure-action"]').first().click({ force: true });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            return {
                baseOngoingUids: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                baseMinionUids: core.bases[0].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player1DiscardUids: player1?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            baseOngoingUids: [],
            baseMinionUids: ['strip-treasure-minion', 'strip-normal-minion'],
            player0HandUids: ['strip-pressure-minion', 'strip-treasure-action'],
            player0HandDefIds: ['alien_scout', 'munchkin_treasure_bag_of_caltrops'],
            player0DiscardDefIds: ['munchkin_thieves_strip_bare'],
            player1DiscardUids: [],
            player0ActionsPlayed: 1,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-ongoing-uid="strip-treasure-action"]')).toHaveCount(0);
        await expect(page.locator('[data-card-uid="strip-treasure-action"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('172-剥光结算后宝藏牌进入手牌', testInfo);
    });

    test('盗贼公会在宝藏行动打到本基地后从真实入口抽一张普通牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesGuildScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="guild-caltrops-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="guild-own-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('173-盗贼公会打出宝藏行动前', testInfo);

        await game.playCard('munchkin_treasure_bag_of_caltrops', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                baseOngoingUids: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DeckUids: player0?.deck?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                drewByGuild: events.some(event =>
                    event?.type === 'su:cards_drawn'
                    && event.payload?.playerId === '0'
                    && event.payload?.cardUids?.includes('guild-draw-1')
                ),
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            baseOngoingUids: ['guild-caltrops-1'],
            player0HandUids: ['guild-pressure-minion', 'guild-draw-1'],
            player0HandDefIds: ['alien_scout', 'alien_invader'],
            player0DeckUids: [],
            player0ActionsPlayed: 1,
            drewByGuild: true,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-ongoing-uid="guild-caltrops-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="guild-draw-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('174-盗贼公会触发后普通牌进手牌', testInfo);
    });

    test('金库计分链同时处理秘密藏匿处、转移注意力和计分后抽宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinThievesScoringScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="clever-distraction-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="coffers-thief-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="coffers-winner-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="secret-stash-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 4');
        await game.screenshot('175-金库计分前转移注意力与秘密藏匿处', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.pendingMunchkinTreasureReward?.treasureCards?.length === 2
                    && (
                        state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose'
                        || Boolean(state?.sys?.responseWindow?.current?.windowType)
                    );
            },
            { timeout: 15000, polling: 200 },
        );
        await game.screenshot('176-秘密藏匿处让计分奖励展示两张宝藏', testInfo);

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const status = await getReactionWindowStatus(page);
            const options = status.sourceId === 'smashup_reaction_choose'
                ? await game.getInteractionOptions() as InteractionOption[]
                : [];
            const hasCleverOption = status.windowType === 'afterScoring'
                && options.some((option) =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'clever-distraction-1'
                );
            if (hasCleverOption) break;

            const didPass = await passOpenReactionOrResponseWindow(page, game, `转移注意力前置响应让过 ${attempt + 1}`);
            expect(didPass, '等待 afterScoring 转移注意力入口期间必须存在可让过的响应').toBe(true);
            await page.waitForTimeout(300);
        }

        await expect.poll(async () => {
            const status = await getReactionWindowStatus(page);
            const options = status.sourceId === 'smashup_reaction_choose'
                ? await game.getInteractionOptions() as InteractionOption[]
                : [];
            return {
                windowType: status.windowType,
                hasCleverOption: options.some((option) =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'clever-distraction-1'
                ),
            };
        }, { timeout: 10000 }).toEqual({
            windowType: 'afterScoring',
            hasCleverOption: true,
        });
        await game.screenshot('177-转移注意力afterScoring响应入口', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.kind === 'play_action'
                && option.value?.cardUid === 'clever-distraction-1',
            'afterScoring 选择转移注意力',
        );
        await waitForSmashUpFxToSettle(page);

        for (let attempt = 0; attempt < 12; attempt += 1) {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            const done = state.sys?.phase === 'playCards'
                && !state.sys?.interaction?.current
                && !state.sys?.responseWindow?.current
                && (core.triggerQueue?.length ?? 0) === 0
                && !core.pendingMunchkinTreasureReward
                && (player0?.hand?.filter(card => card.defId.startsWith('munchkin_treasure_')).length ?? 0) === 2
                && (player1?.hand?.filter(card => card.defId.startsWith('munchkin_treasure_')).length ?? 0) === 2;
            if (done) break;

            const status = await getReactionWindowStatus(page);
            if (status.sourceId === 'smashup_reaction_choose') {
                const options = await game.getInteractionOptions() as InteractionOption[];
                const triggers = (state.core?.triggerQueue ?? []) as TriggerQueueEntry[];
                const hasCoffersTrigger = options.some((option) => {
                    const triggerId = option.value?.triggerId;
                    const trigger = triggers.find((entry) => entry?.id === triggerId);
                    return trigger?.sourceDefId === 'base_the_coffers'
                        || trigger?.source?.defId === 'base_the_coffers'
                        || option.value?.defId === 'base_the_coffers';
                });
                if (hasCoffersTrigger) {
                    await chooseReactionBySourceDefId(game, 'base_the_coffers', '金库 afterScoring 抽宝藏');
                } else if (options.some((option) => option.value?.kind === 'pass')) {
                    await game.selectInteractionOptionBy(
                        (option: InteractionOption) => option.value?.kind === 'pass',
                        `金库计分链让过 ${attempt + 1}`,
                    );
                } else {
                    await page.waitForTimeout(500);
                }
            } else if (status.windowType) {
                await game.passResponseWindow();
            } else {
                await page.waitForTimeout(500);
            }
        }

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            return {
                phase: state.sys?.phase,
                base0DefId: core.bases[0]?.defId,
                player0Vp: player0?.vp ?? 0,
                player1Vp: player1?.vp ?? 0,
                player0TreasureHandCount: player0?.hand?.filter(card => card.defId.startsWith('munchkin_treasure_')).length ?? 0,
                player1TreasureHandCount: player1?.hand?.filter(card => card.defId.startsWith('munchkin_treasure_')).length ?? 0,
                player0DiscardHasClever: player0?.discard?.some(card => card.defId === 'munchkin_thieves_clever_distraction') ?? false,
                player0DiscardHasSecretStash: player0?.discard?.some(card => card.defId === 'munchkin_thieves_secret_stash') ?? false,
                rewardRevealCount: events.find(event =>
                    event?.type === 'su:munchkin_treasure_reward_revealed'
                    && event.payload?.reason === 'munchkin_scoring_treasure_reward'
                )?.payload?.count ?? 0,
                cofferDrawEvents: events.filter(event =>
                    event?.type === 'su:munchkin_treasures_drawn'
                    && event.payload?.reason === 'base_the_coffers'
                ).length,
                cleverVpEvents: events.filter(event =>
                    event?.type === 'su:vp_awarded'
                    && event.payload?.reason === 'munchkin_thieves_clever_distraction'
                ).length,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                pendingTreasureReward: core.pendingMunchkinTreasureReward ?? null,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            phase: 'playCards',
            base0DefId: 'base_the_homeworld',
            player0Vp: 5,
            player1Vp: 8,
            player0TreasureHandCount: 2,
            player1TreasureHandCount: 2,
            player0DiscardHasClever: true,
            player0DiscardHasSecretStash: true,
            rewardRevealCount: 2,
            cofferDrawEvents: 2,
            cleverVpEvents: 2,
            treasureDeckSize: 0,
            pendingTreasureReward: null,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 0');
        await game.screenshot('178-金库计分后宝藏奖励与转移注意力收口', testInfo);
    });

    test('矮人雇佣兵可按宝藏随从从手牌打到基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinDwarfHirelingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="dwarf-hireling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await expect(page.locator('[data-testid="su-munchkin-treasure-discard"]')).toHaveCount(0);
        await game.screenshot('55-矮人雇佣兵手牌与目标基地', testInfo);

        await game.playCard('munchkin_treasure_dwarf_hireling', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                base0DefIds: core.bases[0].minions.map(minion => minion.defId),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0MinionsPlayed: player0?.minionsPlayed ?? 0,
                player0MinionLimit: player0?.minionLimit ?? 0,
                hasLongTermTreasureZone: player0 ? Object.prototype.hasOwnProperty.call(player0, 'treasures') : false,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['dwarf-hireling-1'],
            base0DefIds: ['munchkin_treasure_dwarf_hireling'],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0MinionsPlayed: 1,
            player0MinionLimit: 1,
            hasLongTermTreasureZone: false,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-minion-uid="dwarf-hireling-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('56-矮人雇佣兵打出后进入基地', testInfo);
    });

    test('宝藏池可在本回合第一次打出仆从后抽一张宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinTreasureBathDrawScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="treasure-bath-invader-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('60-宝藏池手牌与首个仆从目标基地', testInfo);

        await game.playCard('alien_invader', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0Uids: core.bases[0].minions.map(minion => minion.uid),
                base0DefIds: core.bases[0].minions.map(minion => minion.defId),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0MinionsPlayed: player0?.minionsPlayed ?? 0,
                player0MinionsPlayedPerBase: player0?.minionsPlayedPerBase ?? {},
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Uids: ['treasure-bath-invader-1'],
            base0DefIds: ['alien_invader'],
            player0HandUids: ['munchkin_treasure_1210'],
            player0HandDefIds: ['munchkin_treasure_wishing_ring'],
            player0DiscardDefIds: [],
            player0MinionsPlayed: 1,
            player0MinionsPlayedPerBase: { 0: 1 },
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-minion-uid="treasure-bath-invader-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="munchkin_treasure_1210"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('61-宝藏池首个仆从后抽到宝藏', testInfo);
    });

    test('黄金挖掘者可用天赋从公共宝藏弃牌堆回收宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinGoldDiggerTreasureRecoveryScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const goldDigger = page.locator('[data-minion-uid="dwarf-gold-digger"]').first();
        await expect(goldDigger).toBeVisible({ timeout: 15000 });
        await expect(goldDigger).toHaveAttribute('data-activation-armed', 'false');
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('64-黄金挖掘者天赋前公共宝藏弃牌', testInfo);

        await goldDigger.click({ force: true });
        await game.waitForInteraction('munchkin_dwarves_gold_digger_choose_treasure', 10000);
        await game.screenshot('65-黄金挖掘者选择宝藏弃牌', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.treasureDefId === 'munchkin_treasure_spiky_boots',
            '黄金挖掘者目标宝藏弃牌',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const goldDiggerState = core.bases[0].minions.find(minion => minion.uid === 'dwarf-gold-digger');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                goldDiggerTalentUsed: goldDiggerState?.talentUsed === true,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                treasureDiscard: core.treasureDiscard ?? [],
                nextUid: core.nextUid ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            goldDiggerTalentUsed: true,
            player0HandUids: ['munchkin_treasure_1230'],
            player0HandDefIds: ['munchkin_treasure_spiky_boots'],
            player0DiscardDefIds: [],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
            nextUid: 1231,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="munchkin_treasure_1230"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-used-badge-dwarf-gold-digger')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('66-黄金挖掘者回收宝藏后进入手牌', testInfo);
    });

    test('隐藏资产可从手牌打出并把宝藏牌库顶三张放入公共弃牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinHiddenAssetsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="hidden-assets-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="hidden-assets-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 4');
        await game.screenshot('67-隐藏资产手牌与公共宝藏牌库', testInfo);

        await game.playCard('munchkin_dwarves_hidden_assets');
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DeckTopDefId: player0?.deck?.[0]?.defId ?? null,
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscard: core.treasureDiscard ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0HandUids: ['hidden-assets-drawn-1'],
            player0HandDefIds: ['alien_invader'],
            player0DeckTopDefId: 'munchkin_dwarves_gem_grabber',
            player0DiscardDefIds: ['munchkin_dwarves_hidden_assets'],
            player0ActionsPlayed: 1,
            player0ActionLimit: 2,
            treasureDeck: ['munchkin_treasure_bag_of_caltrops'],
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
                'munchkin_treasure_tiger_steed',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="hidden-assets-drawn-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="hidden-assets-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('68-隐藏资产结算后抽牌并磨宝藏', testInfo);
    });

    test('为了钱什么都可以可真实多选手牌弃掉并按数量抽宝藏', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinAnythingForMoneyScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="money-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="money-discard-a"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="money-discard-b"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 3');
        await game.screenshot('69-为了钱什么都可以手牌与宝藏牌库', testInfo);

        await game.playCard('munchkin_dwarves_anything_for_money');
        await game.waitForInteraction('munchkin_dwarves_anything_for_money_discard', 10000);

        const discardOptions = await game.getInteractionOptions();
        const discardA = discardOptions.find((option: InteractionOption) => option.value?.cardUid === 'money-discard-a');
        const discardB = discardOptions.find((option: InteractionOption) => option.value?.cardUid === 'money-discard-b');
        expect(discardA?.id, '为了钱什么都可以应列出套现作为可弃手牌').toBeTruthy();
        expect(discardB?.id, '为了钱什么都可以应列出宝石抓取者作为可弃手牌').toBeTruthy();
        await expect(page.locator(`[data-option-id="${discardA!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator(`[data-option-id="${discardB!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('70-为了钱什么都可以选择弃牌', testInfo);

        await page.locator(`[data-option-id="${discardA!.id}"]`).first().click({ force: true });
        await page.locator(`[data-option-id="${discardB!.id}"]`).first().click({ force: true });
        await game.confirm();
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                nextUid: core.nextUid ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0HandUids: ['munchkin_treasure_1250', 'munchkin_treasure_1251'],
            player0HandDefIds: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_wishing_ring',
            ],
            player0DiscardUids: ['money-1', 'money-discard-a', 'money-discard-b'],
            player0ActionsPlayed: 1,
            player0ActionLimit: 1,
            treasureDeck: ['munchkin_treasure_spiky_boots'],
            treasureDiscardSize: 0,
            nextUid: 1252,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="munchkin_treasure_1250"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="munchkin_treasure_1251"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="money-discard-a"]')).toHaveCount(0);
        await expect(page.locator('[data-card-uid="money-discard-b"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('71-为了钱什么都可以抽到两张宝藏', testInfo);
    });

    test('套现可真实多选手牌宝藏并连续作为额外随从打出', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinCashOutExtraTreasureMinionsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cash-out-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cash-out-treasure-a"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cash-out-treasure-b"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cash-out-non-treasure"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="cash-out-existing-minion"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('77-套现手牌宝藏与已用随从额度', testInfo);

        await game.playCard('munchkin_dwarves_cash_out');
        await game.waitForInteraction('munchkin_dwarves_cash_out_choose_treasures', 10000);

        const treasureOptions = await game.getInteractionOptions();
        const treasureA = treasureOptions.find((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-a');
        const treasureB = treasureOptions.find((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-b');
        const nonTreasure = treasureOptions.find((option: InteractionOption) => option.value?.cardUid === 'cash-out-non-treasure');
        expect(treasureA?.id, '套现应列出矮人雇佣兵作为可选宝藏').toBeTruthy();
        expect(treasureB?.id, '套现应列出虎骑士作为可选宝藏').toBeTruthy();
        expect(nonTreasure, '套现不应列出非宝藏手牌').toBeUndefined();
        await expect(page.locator(`[data-option-id="${treasureA!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator(`[data-option-id="${treasureB!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('78-套现多选手牌宝藏', testInfo);

        await page.locator(`[data-option-id="${treasureA!.id}"]`).first().click({ force: true });
        await page.locator(`[data-option-id="${treasureB!.id}"]`).first().click({ force: true });
        await game.confirm();
        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);

        const firstExtraOptions = await game.getInteractionOptions();
        expect(firstExtraOptions.some((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-a')).toBe(true);
        expect(firstExtraOptions.some((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-b')).toBe(false);
        expect(firstExtraOptions.some((option: InteractionOption) => option.value?.cardUid === 'cash-out-non-treasure')).toBe(false);
        await game.screenshot('79-套现进入第一张额外宝藏随从选择', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-a',
            '套现第一张宝藏随从',
        );
        await game.waitForInteraction('smashup_immediate_extra_minion_base', 10000);
        await game.screenshot('80-套现选择额外宝藏随从目标基地', testInfo);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.baseIndex === 0,
            '套现第一张宝藏随从目标基地',
        );

        await game.waitForInteraction('smashup_immediate_extra_minion', 10000);
        const secondExtraOptions = await game.getInteractionOptions();
        expect(secondExtraOptions.some((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-b')).toBe(true);
        expect(secondExtraOptions.some((option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-a')).toBe(false);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'cash-out-treasure-b',
            '套现第二张宝藏随从',
        );
        await game.waitForInteraction('smashup_immediate_extra_minion_base', 10000);
        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.baseIndex === 0,
            '套现第二张宝藏随从目标基地',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                base0MinionUids: core.bases[0].minions.map(minion => minion.uid),
                base0MinionDefIds: core.bases[0].minions.map(minion => minion.defId),
                base1MinionUids: core.bases[1].minions.map(minion => minion.uid),
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                player0MinionsPlayed: player0?.minionsPlayed ?? 0,
                player0MinionLimit: player0?.minionLimit ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0MinionUids: [
                'cash-out-existing-minion',
                'cash-out-treasure-a',
                'cash-out-treasure-b',
            ],
            base0MinionDefIds: [
                'munchkin_dwarves_loot_lover',
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_tiger_steed',
            ],
            base1MinionUids: [],
            player0HandUids: ['cash-out-non-treasure'],
            player0DiscardUids: ['cash-out-1'],
            player0ActionsPlayed: 1,
            player0ActionLimit: 1,
            player0MinionsPlayed: 3,
            player0MinionLimit: 3,
            treasureDeckSize: MUNCHKIN_TREASURE_DECK_DEF_IDS.length,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-minion-uid="cash-out-treasure-a"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="cash-out-treasure-b"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cash-out-non-treasure"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('81-套现两张宝藏随从已打出', testInfo);
    });

    test('狡猾计划可从计分前响应窗口抽宝藏并立即打出', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinCunningPlanBeforeScoringScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cunning-plan-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="cunning-plan-scorer"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('82-狡猾计划计分前手牌与目标基地', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'scoreBases'
                    && state?.sys?.responseWindow?.current?.windowType === 'meFirst'
                    && state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose';
            },
            { timeout: 15000, polling: 200 },
        );

        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return {
                hasCunningPlanOption: options.some((option) =>
                    option.value?.cardUid === 'cunning-plan-1'
                    || option.label === '狡猾计划'
                ),
            };
        }, { timeout: 10000 }).toEqual({ hasCunningPlanOption: true });
        await game.screenshot('83-狡猾计划beforeScoring响应入口', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.cardUid === 'cunning-plan-1'
                || option.label === '狡猾计划',
            'beforeScoring 选择狡猾计划',
        );
        await game.waitForInteraction('smashup_immediate_extra_action', 10000);

        const immediateOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(immediateOptions.some((option) => option.value?.cardUid === 'munchkin_treasure_1280')).toBe(true);
        await game.screenshot('84-狡猾计划抽到许愿指环并可立即打出', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'munchkin_treasure_1280',
            '狡猾计划打出刚抽到的许愿指环',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player0Discard = player0?.discard ?? [];
            const player0TreasureHandDefIds = (player0?.hand ?? [])
                .filter(card => card.defId.startsWith('munchkin_treasure_'))
                .map(card => card.defId);
            return {
                player0Vp: player0?.vp ?? 0,
                player0TreasureHandDefIds,
                player0DiscardHasCunningPlan: player0Discard.some(card => card.uid === 'cunning-plan-1'),
                player0DiscardHasScoringMinion: player0Discard.some(card => card.uid === 'cunning-plan-scorer'),
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            player0Vp: 7,
            player0TreasureHandDefIds: [],
            player0DiscardHasCunningPlan: true,
            player0DiscardHasScoringMinion: true,
            treasureDeck: [
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_wishing_ring',
            ],
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 19');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('85-狡猾计划许愿指环收口后状态', testInfo);
    });

    test('我的！可真实检索可附着宝藏并立即打到己方宿主身上', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinMineSearchTreasureScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="mine-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mine-host-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mine-host-2"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mine-opponent-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-base-monster-row-0')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 4');
        await game.screenshot('86-我的！手牌与可选宿主', testInfo);

        await game.playCard('munchkin_dwarves_mine');
        await game.waitForInteraction('munchkin_dwarves_mine_choose_treasure', 10000);
        await waitForSmashUpFxToSettle(page);

        const mineOptions = await game.getInteractionOptions() as InteractionOption[];
        const spikyToHost = mineOptions.find((option) =>
            option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
            && option.value?.targetMinionUid === 'mine-host-1'
        );
        const magicToSecondHost = mineOptions.find((option) =>
            option.value?.treasureDefId === 'munchkin_treasure_magic_missile'
            && option.value?.targetMinionUid === 'mine-host-2'
        );
        expect(spikyToHost?.id, '我的！应列出尖刺靴到己方宝藏爱好者的组合').toBeTruthy();
        expect(magicToSecondHost?.id, '我的！应列出魔法导弹到另一名己方随从的组合').toBeTruthy();
        expect(
            mineOptions.some((option) => option.value?.treasureDefId === 'munchkin_treasure_wishing_ring'),
            '我的！不应列出不可附着的许愿指环',
        ).toBe(false);
        expect(
            mineOptions.some((option) => option.value?.treasureDefId === 'munchkin_treasure_potion_of_idiotic_bravery'),
            '我的！不应列出非附着宝藏的愚蠢勇气药水',
        ).toBe(false);
        expect(
            mineOptions.some((option) => option.value?.targetMinionUid === 'mine-opponent-1'),
            '我的！不应列出对手随从作为宿主',
        ).toBe(false);
        await expect(page.locator(`[data-option-id="${spikyToHost!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('87-我的！选择宝藏和己方宿主', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
                && option.value?.targetMinionUid === 'mine-host-1',
            '我的！选择尖刺靴给己方宝藏爱好者',
        );
        await game.waitForInteraction('smashup_immediate_extra_action', 10000);

        const immediateOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(
            immediateOptions.some((option) => option.value?.cardUid === 'munchkin_treasure_1290'),
            '我的！应只把检索到的尖刺靴作为立即额外行动',
        ).toBe(true);
        expect(
            immediateOptions.some((option) => option.value?.cardUid === 'mine-1'),
            '我的！源牌不应留在立即额外行动候选里',
        ).toBe(false);
        await expect(page.locator('[data-card-uid="munchkin_treasure_1290"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 3');
        await game.screenshot('88-我的！检索到尖刺靴并进入立即打出', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.cardUid === 'munchkin_treasure_1290',
            '我的！立即打出检索到的尖刺靴',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'mine-host-1');
            const opponent = core.bases[0].minions.find(minion => minion.uid === 'mine-opponent-1');
            const otherHost = core.bases[1].minions.find(minion => minion.uid === 'mine-host-2');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                hostAttachedUids: host?.attachedActions?.map(action => action.uid) ?? [],
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                opponentAttachedDefIds: opponent?.attachedActions?.map(action => action.defId) ?? [],
                otherHostAttachedDefIds: otherHost?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDeckHasSpikyBoots: core.treasureDeck?.includes('munchkin_treasure_spiky_boots') ?? false,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedUids: ['munchkin_treasure_1290'],
            hostAttachedDefIds: ['munchkin_treasure_spiky_boots'],
            opponentAttachedDefIds: [],
            otherHostAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardUids: ['mine-1'],
            player0ActionsPlayed: 2,
            player0ActionLimit: 2,
            treasureDeckSize: 3,
            treasureDeckHasSpikyBoots: false,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-attached-action-uid="munchkin_treasure_1290"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-mine-host-1')).toHaveAttribute('title', /尖刺靴: \+1/);
        await expect(page.locator('[data-minion-uid="mine-opponent-1"]').locator('[data-attached-action-uid="munchkin_treasure_1290"]')).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="mine-host-2"]').locator('[data-attached-action-uid="munchkin_treasure_1290"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 3');
        await game.screenshot('89-我的！尖刺靴附着到指定己方宿主', testInfo);
    });

    test('不！我的宝贝！可摧毁仆从身上的宝藏行动并继续打出额外行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinNoMyPreciousExtraActionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="precious-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="precious-extra-ring"]').first()).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="precious-host"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(page.locator('[data-attached-action-uid="precious-treasure-attached"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-attached-action-uid="precious-normal-attached"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="precious-base-action"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 0');
        await game.screenshot('90-不！我的宝贝！手牌与可摧毁附着行动', testInfo);

        await game.playCard('munchkin_dwarves_no_my_precious');
        await game.waitForInteraction('munchkin_dwarves_no_my_precious_destroy', 10000);

        const preciousOptions = await game.getInteractionOptions() as InteractionOption[];
        const treasureAttached = preciousOptions.find((option) => option.value?.cardUid === 'precious-treasure-attached');
        const normalAttached = preciousOptions.find((option) => option.value?.cardUid === 'precious-normal-attached');
        expect(treasureAttached?.id, '不！我的宝贝！应列出仆从身上的宝藏行动').toBeTruthy();
        expect(normalAttached?.id, '不！我的宝贝！应列出仆从身上的非宝藏行动').toBeTruthy();
        expect(
            preciousOptions.some((option) => option.value?.cardUid === 'precious-base-action'),
            '不！我的宝贝！不应列出基地上的行动',
        ).toBe(false);
        const attachedTreasureTarget = page.locator('[data-attached-action-uid="precious-treasure-attached"]').first();
        await host.hover();
        await expect(attachedTreasureTarget).toBeVisible({ timeout: 15000 });
        await game.screenshot('91-不！我的宝贝！选择仆从身上的宝藏行动', testInfo);

        await attachedTreasureTarget.click({ force: true });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const targetHost = core.bases[0].minions.find(minion => minion.uid === 'precious-host');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            return {
                hostAttachedUids: targetHost?.attachedActions?.map(action => action.uid) ?? [],
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                player1DiscardUids: player1?.discard?.map(card => card.uid) ?? [],
                baseActionStillPresent: core.bases[0].ongoingActions?.some(action => action.uid === 'precious-base-action') ?? false,
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedUids: ['precious-normal-attached'],
            player0HandUids: ['precious-extra-ring'],
            player0DiscardUids: ['precious-1'],
            player0ActionsPlayed: 1,
            player0ActionLimit: 2,
            player1DiscardUids: ['precious-treasure-attached'],
            baseActionStillPresent: true,
            treasureDeck: [],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-attached-action-uid="precious-treasure-attached"]')).toHaveCount(0);
        await host.hover();
        await expect(page.locator('[data-attached-action-uid="precious-normal-attached"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="precious-extra-ring"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('92-不！我的宝贝！摧毁宝藏后获得额外行动', testInfo);

        await game.playCard('munchkin_treasure_wishing_ring');
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0Vp: player0?.vp ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0Vp: 7,
            player0HandUids: [],
            player0DiscardUids: ['precious-1'],
            player0ActionsPlayed: 2,
            player0ActionLimit: 2,
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('93-不！我的宝贝！额外打出许愿指环后收口', testInfo);
    });

    test('打捞可从计分前响应窗口回收公共宝藏弃牌并附着到当前基地己方宿主', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSalvageBeforeScoringScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="salvage-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="salvage-host-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="salvage-opponent-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="salvage-away-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('94-打捞计分前手牌与当前基地宿主', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);
        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'scoreBases'
                    && state?.sys?.responseWindow?.current?.windowType === 'meFirst'
                    && state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose';
            },
            { timeout: 15000, polling: 200 },
        );

        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return {
                hasSalvageOption: options.some((option) =>
                    option.value?.cardUid === 'salvage-1'
                    || option.value?.handCardUid === 'salvage-1'
                    || option.label === '打捞'
                ),
            };
        }, { timeout: 10000 }).toEqual({ hasSalvageOption: true });

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.cardUid === 'salvage-1'
                || option.value?.handCardUid === 'salvage-1'
                || option.label === '打捞',
            'beforeScoring 选择打捞',
        );
        await game.waitForInteraction('munchkin_dwarves_salvage_choose_treasure', 10000);

        const salvageOptions = await game.getInteractionOptions() as InteractionOption[];
        const spikyToCurrentHost = salvageOptions.find((option) =>
            option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
            && option.value?.targetMinionUid === 'salvage-host-1'
        );
        const magicToCurrentHost = salvageOptions.find((option) =>
            option.value?.treasureDefId === 'munchkin_treasure_magic_missile'
            && option.value?.targetMinionUid === 'salvage-host-1'
        );
        expect(spikyToCurrentHost?.id, '打捞应列出尖刺靴到当前基地己方宿主的组合').toBeTruthy();
        expect(magicToCurrentHost?.id, '打捞应列出魔法导弹到当前基地己方宿主的组合').toBeTruthy();
        expect(
            salvageOptions.some((option) => option.value?.treasureDefId === 'munchkin_treasure_wishing_ring'),
            '打捞不应列出不可附着的许愿指环',
        ).toBe(false);
        expect(
            salvageOptions.some((option) => option.value?.treasureDefId === 'munchkin_treasure_potion_of_idiotic_bravery'),
            '打捞不应列出非附着宝藏的愚蠢勇气药水',
        ).toBe(false);
        expect(
            salvageOptions.some((option) => option.value?.targetMinionUid === 'salvage-opponent-1'),
            '打捞不应列出对手随从作为宿主',
        ).toBe(false);
        expect(
            salvageOptions.some((option) => option.value?.targetMinionUid === 'salvage-away-host'),
            '打捞不应列出非当前计分基地的己方随从作为宿主',
        ).toBe(false);
        await expect(page.locator(`[data-option-id="${spikyToCurrentHost!.id}"]`).first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('95-打捞选择公共宝藏弃牌和当前基地宿主', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.treasureDefId === 'munchkin_treasure_spiky_boots'
                && option.value?.targetMinionUid === 'salvage-host-1',
            '打捞选择尖刺靴给当前基地己方宿主',
        );
        await game.waitForInteraction('smashup_immediate_extra_action', 10000);

        const immediateState = await game.getState();
        const immediateCore = immediateState.core as RocketBootsCoreState;
        const recoveredTreasureUid = immediateCore.players?.['0']?.hand?.find(card =>
            card.defId === 'munchkin_treasure_spiky_boots'
        )?.uid;
        if (!recoveredTreasureUid) {
            throw new Error('打捞应把回收的尖刺靴放入手牌作为立即额外行动候选');
        }
        const recoveredTreasureCard = page.locator(`[data-card-uid="${recoveredTreasureUid}"]`).first();
        await expect(recoveredTreasureCard).toBeVisible({ timeout: 15000 });
        const immediateOptions = await game.getInteractionOptions() as InteractionOption[];
        expect(
            immediateOptions.some((option) =>
                option.value?.cardUid === recoveredTreasureUid
                || option.value?.defId === 'munchkin_treasure_spiky_boots'
            ),
            '打捞应只把回收出的尖刺靴作为立即额外行动候选',
        ).toBe(true);
        expect(
            immediateOptions.some((option) =>
                option.value?.cardUid === 'salvage-1'
                || option.value?.defId === 'munchkin_dwarves_salvage'
            ),
            '打捞源牌不应留在立即额外行动候选里',
        ).toBe(false);
        await game.screenshot('96-打捞回收到尖刺靴并进入立即打出', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.cardUid === recoveredTreasureUid
                || option.value?.defId === 'munchkin_treasure_spiky_boots',
            '打捞立即打出刚回收的尖刺靴',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            const player1 = core.players?.['1'] as SmashUpPlayerCoreSlice | undefined;
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            const attachEvent = events.find(event =>
                event?.type === 'su:ongoing_attached'
                && event.payload?.cardUid === recoveredTreasureUid
                && event.payload?.defId === 'munchkin_treasure_spiky_boots'
                && event.payload?.targetType === 'minion'
                && event.payload?.targetBaseIndex === 0
                && event.payload?.targetMinionUid === 'salvage-host-1'
            );
            const baseScoredEvent = events.find(event =>
                event?.type === 'su:base_scored'
                && event.payload?.baseDefId === 'base_the_mines'
            );
            const baseClearedEvent = events.find(event =>
                event?.type === 'su:base_cleared'
                && event.payload?.baseDefId === 'base_the_mines'
            );
            return {
                attachedToCurrentHostBeforeClear: Boolean(attachEvent),
                baseScoredByMine: Boolean(baseScoredEvent),
                baseClearedByMine: Boolean(baseClearedEvent),
                baseScoredRankingSummary: baseScoredEvent?.payload?.rankings?.map((ranking) => ({
                    playerId: ranking.playerId,
                    power: ranking.power,
                    vp: ranking.vp,
                })) ?? [],
                remainingBaseDefIds: core.bases.map(base => base.defId),
                awayHostStillOnTreasureBath: core.bases.some(base =>
                    base.defId === 'base_treasure_bath'
                    && base.minions.some(minion => minion.uid === 'salvage-away-host')
                ),
                player0Vp: player0?.vp ?? 0,
                player1Vp: player1?.vp ?? 0,
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardUids: player0?.discard?.map(card => card.uid) ?? [],
                player1DiscardUids: player1?.discard?.map(card => card.uid) ?? [],
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscard: core.treasureDiscard ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            attachedToCurrentHostBeforeClear: true,
            baseScoredByMine: true,
            baseClearedByMine: true,
            baseScoredRankingSummary: [
                { playerId: '0', power: 34, vp: 4 },
                { playerId: '1', power: 4, vp: 2 },
            ],
            remainingBaseDefIds: ['base_the_homeworld', 'base_treasure_bath'],
            awayHostStillOnTreasureBath: true,
            player0Vp: 10,
            player1Vp: 6,
            player0HandUids: ['0-deck-0', '0-deck-1'],
            player0DiscardUids: ['salvage-1', recoveredTreasureUid, 'salvage-host-1'],
            player1DiscardUids: ['salvage-opponent-1'],
            treasureDeckSize: MUNCHKIN_TREASURE_DECK_DEF_IDS.length,
            treasureDiscard: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_potion_of_idiotic_bravery',
                'munchkin_treasure_magic_missile',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator(`[data-attached-action-uid="${recoveredTreasureUid}"]`)).toHaveCount(0);
        await expect(page.getByTestId('su-score-vp-0')).toHaveText('10');
        await expect(page.getByTestId('su-score-vp-1')).toHaveText('6');
        await expect(page.locator('[data-minion-uid="salvage-opponent-1"]').locator(`[data-attached-action-uid="${recoveredTreasureUid}"]`)).toHaveCount(0);
        await expect(page.locator('[data-minion-uid="salvage-away-host"]').locator(`[data-attached-action-uid="${recoveredTreasureUid}"]`)).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('97-打捞尖刺靴附着后完成计分清场', testInfo);
    });

    test('贪婪是好的可真实选择回收公共宝藏弃牌并获得额外行动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinGreedIsGoodScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="greed-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="greed-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('72-贪婪是好的手牌与公共宝藏弃牌', testInfo);

        await game.playCard('munchkin_dwarves_greed_is_good');
        await game.waitForInteraction('munchkin_dwarves_greed_is_good_choose_treasure', 10000);

        const greedOptions = await game.getInteractionOptions();
        const drawOption = greedOptions.find((option: InteractionOption) => option.value?.mode === 'draw');
        const recoverOption = greedOptions.find((option: InteractionOption) =>
            option.value?.mode === 'recover'
            && option.value?.treasureDefId === 'munchkin_treasure_buckler_of_swashing'
        );
        expect(drawOption?.id, '贪婪是好的应提供抽宝藏选项').toBeTruthy();
        expect(recoverOption?.id, '贪婪是好的应提供回收公共宝藏弃牌选项').toBeTruthy();
        await expect(page.getByRole('button', { name: '抽一张宝藏牌' }).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('摆动的盾牌').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('73-贪婪是好的选择抽宝藏或回收弃牌', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.mode === 'recover'
                && option.value?.treasureDefId === 'munchkin_treasure_buckler_of_swashing',
            '贪婪是好的回收摆动的盾牌',
        );
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0HandDefIds: player0?.hand?.map(card => card.defId) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                treasureDiscard: core.treasureDiscard ?? [],
                nextUid: core.nextUid ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0HandUids: ['munchkin_treasure_1260'],
            player0HandDefIds: ['munchkin_treasure_buckler_of_swashing'],
            player0DiscardDefIds: ['munchkin_dwarves_greed_is_good'],
            player0ActionsPlayed: 1,
            player0ActionLimit: 2,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_spiky_boots',
            ],
            treasureDiscard: ['munchkin_treasure_wishing_ring'],
            nextUid: 1261,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="munchkin_treasure_1260"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="greed-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('74-贪婪是好的回收宝藏弃牌后进入手牌', testInfo);
    });

    test('宝藏爱好者和宝石抓取者可通过真实附着宝藏获得持续力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinDwarfTreasurePowerScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="loot-lover-buckler-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="loot-lover-rocket-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="gem-grabber-jetpack-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="dwarf-loot-lover"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="dwarf-gem-grabber"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('62-宝藏爱好者与宝石抓取者待附着宝藏', testInfo);

        const playTreasureToVisibleMinion = async (cardUid: string, targetMinionUid: string, xRatio: number) => {
            await page.locator(`[data-card-uid="${cardUid}"]`).first().click();
            await page.waitForTimeout(300);
            const target = page.locator(`[data-minion-uid="${targetMinionUid}"]`).first();
            const box = await target.boundingBox();
            expect(box, `${targetMinionUid} 应有可点击的露出卡面`).not.toBeNull();
            await page.mouse.click(
                box!.x + Math.max(8, Math.min(box!.width - 8, box!.width * xRatio)),
                box!.y + box!.height * 0.55,
            );
            await game.waitForNoInteraction(10000);
        };

        await playTreasureToVisibleMinion('loot-lover-buckler-1', 'dwarf-loot-lover', 0.18);
        await playTreasureToVisibleMinion('loot-lover-rocket-1', 'dwarf-loot-lover', 0.18);
        await playTreasureToVisibleMinion('gem-grabber-jetpack-1', 'dwarf-gem-grabber', 0.82);
        await waitForSmashUpFxToSettle(page);

        await expect(page.getByTestId('su-minion-power-badge-dwarf-loot-lover')).toHaveAttribute('title', /宝藏爱好者: \+4/);
        await expect(page.getByTestId('su-minion-power-badge-dwarf-loot-lover')).toContainText('+4');
        await expect(page.getByTestId('su-minion-power-badge-dwarf-gem-grabber')).toHaveAttribute('title', /宝石抓取者: \+2/);
        await expect(page.getByTestId('su-minion-power-badge-dwarf-gem-grabber')).toContainText('+2');

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const lootLover = core.bases[0].minions.find(minion => minion.uid === 'dwarf-loot-lover');
            const gemGrabber = core.bases[1].minions.find(minion => minion.uid === 'dwarf-gem-grabber');
            const player0 = core.players?.['0'] as SmashUpPlayerCoreSlice | undefined;
            return {
                lootLoverAttachedDefIds: lootLover?.attachedActions?.map(action => action.defId) ?? [],
                gemGrabberAttachedDefIds: gemGrabber?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: player0?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: player0?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: player0?.actionsPlayed ?? 0,
                player0ActionLimit: player0?.actionLimit ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            lootLoverAttachedDefIds: [
                'munchkin_treasure_buckler_of_swashing',
                'munchkin_treasure_rocket_boots',
            ],
            gemGrabberAttachedDefIds: ['munchkin_treasure_temporal_displacement_jetpack'],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 3,
            player0ActionLimit: 3,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('63-宝藏爱好者与宝石抓取者获得持续力量', testInfo);
    });

    test('尖刺靴可从手牌附着到随从并提供持续力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinSpikyBootsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="spiky-boots-hand-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="spiky-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="spiky-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('41-尖刺靴手牌与目标随从', testInfo);

        await game.playCard('munchkin_treasure_spiky_boots', { targetMinionUid: 'spiky-host' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedBoots = page.locator('[data-attached-action-uid="spiky-boots-hand-1"]').first();
        await expect(attachedBoots).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-spiky-host')).toHaveAttribute('title', /尖刺靴: \+1/);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'spiky-host');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'spiky-bystander');
            return {
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                bystanderAttachedDefIds: bystander?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedDefIds: ['munchkin_treasure_spiky_boots'],
            bystanderAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('42-尖刺靴附着后持续力量', testInfo);
    });

    test('矿洞可在真实宝藏附着后按随从身上宝藏提供持续力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinTheMinesTreasureAttachmentScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="mines-spiky-boots-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mines-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="mines-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('75-矿洞手牌宝藏与目标随从', testInfo);

        await game.playCard('munchkin_treasure_spiky_boots', { targetMinionUid: 'mines-host' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedBoots = page.locator('[data-attached-action-uid="mines-spiky-boots-1"]').first();
        const minesHostPower = page.getByTestId('su-minion-power-badge-mines-host');
        await expect(attachedBoots).toBeVisible({ timeout: 15000 });
        await expect(minesHostPower).toHaveText('+2', { timeout: 15000 });
        await expect(minesHostPower).toHaveAttribute('title', /尖刺靴: \+1/);
        await expect(minesHostPower).toHaveAttribute('title', /矿洞: \+1/);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'mines-host');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'mines-bystander');
            return {
                base0DefId: core.bases[0].defId,
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                bystanderAttachedDefIds: bystander?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0DefId: 'base_the_mines',
            hostAttachedDefIds: ['munchkin_treasure_spiky_boots'],
            bystanderAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('76-矿洞按附着宝藏提供持续力量', testInfo);
    });

    test('血腥肢解电锯可从手牌附着到随从并提供持续力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinBloodyDismembermentChainsawScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="chainsaw-hand-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="chainsaw-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="chainsaw-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('43-血腥肢解电锯手牌与目标随从', testInfo);

        await game.playCard('munchkin_treasure_bloody_dismemberment_chainsaw', { targetMinionUid: 'chainsaw-host' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedChainsaw = page.locator('[data-attached-action-uid="chainsaw-hand-1"]').first();
        await expect(attachedChainsaw).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-chainsaw-host')).toHaveAttribute('title', /血腥肢解电锯: \+2/);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'chainsaw-host');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'chainsaw-bystander');
            return {
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                bystanderAttachedDefIds: bystander?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedDefIds: ['munchkin_treasure_bloody_dismemberment_chainsaw'],
            bystanderAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('44-血腥肢解电锯附着后持续力量', testInfo);
    });

    test('大量宝藏可从手牌附着并按宿主宝藏数量持续加力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinLoadsOfTreasureScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="loads-hand-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="loads-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="loads-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-loads-host')).toHaveAttribute('title', /尖刺靴: \+1/);
        await expect(page.getByTestId('su-minion-power-badge-loads-host')).toContainText('+1');
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('45-大量宝藏手牌与已有宝藏附着', testInfo);

        await game.playCard('munchkin_treasure_loads_of_treasure', { targetMinionUid: 'loads-host' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedLoads = page.locator('[data-attached-action-uid="loads-hand-1"]').first();
        await expect(attachedLoads).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-loads-host')).toHaveAttribute('title', /大量宝藏: \+2/);
        await expect(page.getByTestId('su-minion-power-badge-loads-host')).toContainText('+3');

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'loads-host');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'loads-bystander');
            return {
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                bystanderAttachedDefIds: bystander?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedDefIds: [
                'munchkin_treasure_spiky_boots',
                'munchkin_treasure_loads_of_treasure',
            ],
            bystanderAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('46-大量宝藏附着后按宝藏数量加力量', testInfo);
    });

    test('诱惑护膝可从手牌附着并给同基地每个随从持续加力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinKneepadsOfAllureScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="kneepads-hand-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="kneepads-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="kneepads-ally"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="kneepads-enemy"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('47-诱惑护膝手牌与同基地随从', testInfo);

        await game.playCard('munchkin_treasure_kneepads_of_allure', { targetMinionUid: 'kneepads-ally' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedKneepads = page.locator('[data-attached-action-uid="kneepads-hand-1"]').first();
        await expect(attachedKneepads).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-kneepads-host')).toHaveAttribute('title', /诱惑护膝: \+1/);
        await expect(page.getByTestId('su-minion-power-badge-kneepads-ally')).toHaveAttribute('title', /诱惑护膝: \+1/);
        await expect(page.getByTestId('su-minion-power-badge-kneepads-enemy')).toHaveAttribute('title', /诱惑护膝: \+1/);
        await expect(page.getByTestId('su-minion-power-badge-kneepads-host')).toContainText('+1');
        await expect(page.getByTestId('su-minion-power-badge-kneepads-ally')).toContainText('+1');
        await expect(page.getByTestId('su-minion-power-badge-kneepads-enemy')).toContainText('+1');

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'kneepads-host');
            const ally = core.bases[0].minions.find(minion => minion.uid === 'kneepads-ally');
            const enemy = core.bases[0].minions.find(minion => minion.uid === 'kneepads-enemy');
            return {
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                allyAttachedDefIds: ally?.attachedActions?.map(action => action.defId) ?? [],
                enemyAttachedDefIds: enemy?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedDefIds: [],
            allyAttachedDefIds: ['munchkin_treasure_kneepads_of_allure'],
            enemyAttachedDefIds: [],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('48-诱惑护膝附着后同基地全体加力量', testInfo);
    });

    test('怯懦药水可从手牌附着并让宿主失去能力', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinPotionOfCowardiceScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cowardice-hand-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="cowardice-talent-cost-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="cowardice-host"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="cowardice-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('49-怯懦药水手牌与拉贾宿主', testInfo);

        await game.playCard('munchkin_treasure_potion_of_cowardice', { targetMinionUid: 'cowardice-host' });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedCowardice = page.locator('[data-attached-action-uid="cowardice-hand-1"]').first();
        await expect(attachedCowardice).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-minion-power-badge-cowardice-host')).toHaveAttribute('title', /怯懦药水: -2/);
        await expect(page.getByTestId('su-minion-power-badge-cowardice-host')).toContainText('-2');

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'cowardice-host');
            const bystander = core.bases[0].minions.find(minion => minion.uid === 'cowardice-bystander');
            return {
                hostAttachedDefIds: host?.attachedActions?.map(action => action.defId) ?? [],
                bystanderAttachedDefIds: bystander?.attachedActions?.map(action => action.defId) ?? [],
                hostTempPower: host?.tempPowerModifier ?? 0,
                hostTalentUsed: host?.talentUsed === true,
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeckSize: core.treasureDeck?.length ?? 0,
                treasureDiscardSize: core.treasureDiscard?.length ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedDefIds: ['munchkin_treasure_potion_of_cowardice'],
            bystanderAttachedDefIds: [],
            hostTempPower: 0,
            hostTalentUsed: false,
            player0HandUids: ['cowardice-talent-cost-1'],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeckSize: 22,
            treasureDiscardSize: 0,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await page.evaluate(async () => {
            const harness = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__;
            await harness?.command?.dispatch?.({
                type: 'su:use_talent',
                playerId: '0',
                payload: { minionUid: 'cowardice-host', baseIndex: 0 },
            });
        });
        await page.waitForTimeout(500);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const host = core.bases[0].minions.find(minion => minion.uid === 'cowardice-host');
            return {
                hostTempPower: host?.tempPowerModifier ?? 0,
                hostTalentUsed: host?.talentUsed === true,
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 3000 }).toEqual({
            hostTempPower: 0,
            hostTalentUsed: false,
            player0HandUids: ['cowardice-talent-cost-1'],
            player0DiscardDefIds: [],
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('50-怯懦药水附着后宿主失去能力', testInfo);
    });

    test('摆动的盾牌可从手牌附着并保护宿主不被摧毁', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinBucklerOfSwashingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const buckler = page.locator('[data-card-uid="buckler-hand-1"]').first();
        const magicHost = page.locator('[data-minion-uid="buckler-magic-host"]').first();
        const protectedTarget = page.locator('[data-minion-uid="buckler-protected-target"]').first();
        const unprotectedTarget = page.locator('[data-minion-uid="buckler-unprotected-target"]').first();
        await expect(buckler).toBeVisible({ timeout: 15000 });
        await expect(magicHost).toBeVisible({ timeout: 15000 });
        await expect(protectedTarget).toBeVisible({ timeout: 15000 });
        await expect(unprotectedTarget).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('51-摆动的盾牌手牌与魔法导弹压力态', testInfo);

        await game.playCard('munchkin_treasure_buckler_of_swashing', {
            targetMinionUid: 'buckler-protected-target',
        });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        const attachedBuckler = page.locator('[data-attached-action-uid="buckler-hand-1"]').first();
        await protectedTarget.hover();
        await expect(attachedBuckler).toBeVisible({ timeout: 15000 });
        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const protectedState = core.bases[0].minions.find(minion => minion.uid === 'buckler-protected-target');
            const magicHostState = core.bases[0].minions.find(minion => minion.uid === 'buckler-magic-host');
            return {
                protectedAttachedDefIds: protectedState?.attachedActions?.map(action => action.defId) ?? [],
                magicHostAttachedDefIds: magicHostState?.attachedActions?.map(action => action.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            protectedAttachedDefIds: ['munchkin_treasure_buckler_of_swashing'],
            magicHostAttachedDefIds: ['munchkin_treasure_magic_missile'],
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeck: ['munchkin_treasure_wishing_ring'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('52-摆动的盾牌附着后保护目标', testInfo);

        const magicMissile = page.locator('[data-attached-action-uid="buckler-magic-missile"]').first();
        await magicHost.hover();
        await expect(magicMissile).toBeVisible({ timeout: 15000 });
        await magicMissile.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_magic_missile_destroy', 10000);
        const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');
        if (await magnifyOverlay.isVisible().catch(() => false)) {
            await magnifyOverlay.click({ position: { x: 10, y: 10 }, force: true });
            await expect(magnifyOverlay).toBeHidden({ timeout: 1000 });
        }

        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return options.map(option => option.value?.minionUid).filter(Boolean);
        }, { timeout: 10000 }).toEqual(['buckler-unprotected-target']);
        await game.screenshot('53-摆动的盾牌过滤受保护摧毁目标', testInfo);

        const unprotectedTargetBox = await unprotectedTarget.boundingBox();
        expect(unprotectedTargetBox, '魔法导弹应只能点到未被摆动的盾牌保护的目标').not.toBeNull();
        await page.mouse.click(
            unprotectedTargetBox!.x + Math.max(8, unprotectedTargetBox!.width * 0.18),
            unprotectedTargetBox!.y + unprotectedTargetBox!.height * 0.55,
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const protectedState = core.bases[0].minions.find(minion => minion.uid === 'buckler-protected-target');
            const magicHostState = core.bases[0].minions.find(minion => minion.uid === 'buckler-magic-host');
            return {
                base0MinionUids: core.bases[0].minions.map(minion => minion.uid),
                protectedAttachedDefIds: protectedState?.attachedActions?.map(action => action.defId) ?? [],
                magicHostAttachedDefIds: magicHostState?.attachedActions?.map(action => action.defId) ?? [],
                player1DiscardUids: core.players?.['1']?.discard?.map(card => card.uid) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0MinionUids: ['buckler-magic-host', 'buckler-protected-target'],
            protectedAttachedDefIds: ['munchkin_treasure_buckler_of_swashing'],
            magicHostAttachedDefIds: [],
            player1DiscardUids: ['buckler-unprotected-target'],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_magic_missile',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-minion-uid="buckler-protected-target"]')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-minion-uid="buckler-unprotected-target"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('54-摆动的盾牌保护宿主摧毁未保护目标后状态', testInfo);
    });

    test('火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinRocketBootsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="rocket-host"]').first();
        const rocketBoots = page.locator('[data-attached-action-uid="rocket-boots-1"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(rocketBoots).toBeVisible({ timeout: 15000 });
        await game.screenshot('03-火箭靴附着行动可点击', testInfo);

        await rocketBoots.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_rocket_boots_move', 10000);
        await game.screenshot('04-火箭靴选择目标基地', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.baseIndex === 1,
            '火箭靴目标基地',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const core = await readCoreState(page) as RocketBootsCoreState;
            const sourceUids = core.bases[0].minions.map(minion => minion.uid);
            const targetHost = core.bases[1].minions.find(minion => minion.uid === 'rocket-host');
            const rocket = targetHost?.attachedActions?.find(action => action.uid === 'rocket-boots-1');
            return {
                sourceUids,
                targetHasHost: Boolean(targetHost),
                targetHasRocketBoots: rocket?.defId === 'munchkin_treasure_rocket_boots',
                rocketTalentUsed: rocket?.talentUsed === true,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceUids: [],
            targetHasHost: true,
            targetHasRocketBoots: true,
            rocketTalentUsed: true,
            triggerQueueLength: 0,
        });

        await game.screenshot('05-火箭靴移动宿主后状态', testInfo);
    });

    test('复制药水附着行动天赋可从卡本体点击并复制另一个仆从天赋', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinDuplicationPotionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="duplication-host"]').first();
        const duplicationPotion = page.locator('[data-attached-action-uid="duplication-potion-1"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(duplicationPotion).toBeVisible({ timeout: 15000 });
        await game.screenshot('06-复制药水附着行动可点击', testInfo);

        await duplicationPotion.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_potion_of_duplication_choose_talent', 10000);
        await game.screenshot('07-复制药水选择另一个仆从天赋', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option?.value?.minionUid === 'rajah-1',
            '复制药水目标天赋',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const core = await readCoreState(page) as RocketBootsCoreState;
            const hostState = core.bases[0].minions.find(minion => minion.uid === 'duplication-host');
            const potion = hostState?.attachedActions?.find(action => action.uid === 'duplication-potion-1');
            return {
                hostTempPower: hostState?.tempPowerModifier ?? 0,
                potionTalentUsed: potion?.talentUsed === true,
                handUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                discardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            hostTempPower: 2,
            potionTalentUsed: true,
            handUids: [],
            discardDefIds: ['alien_probe'],
            triggerQueueLength: 0,
        });

        await game.screenshot('08-复制药水复制天赋后状态', testInfo);
    });

    test('魔法导弹附着行动天赋可从卡本体点击并摧毁同基地低力仆从', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinMagicMissileScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="magic-host"]').first();
        const magicMissile = page.locator('[data-attached-action-uid="magic-missile-1"]').first();
        const lowTarget = page.locator('[data-minion-uid="magic-low-target"]').first();
        const highTarget = page.locator('[data-minion-uid="magic-high-target"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await expect(lowTarget).toBeVisible({ timeout: 15000 });
        await expect(highTarget).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(magicMissile).toBeVisible({ timeout: 15000 });
        await game.screenshot('25-魔法导弹附着行动可点击', testInfo);

        await magicMissile.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_magic_missile_destroy', 10000);
        const magnifyOverlay = page.getByTestId('su-card-magnify-overlay');
        if (await magnifyOverlay.isVisible().catch(() => false)) {
            await magnifyOverlay.click({ position: { x: 10, y: 10 }, force: true });
            await expect(magnifyOverlay).toBeHidden({ timeout: 1000 });
        }
        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return options.map(option => option.value?.minionUid).filter(Boolean);
        }, { timeout: 10000 }).toEqual(['magic-low-target']);
        await game.screenshot('26-魔法导弹选择低力仆从', testInfo);

        const lowTargetBox = await lowTarget.boundingBox();
        expect(lowTargetBox, '魔法导弹低力目标仆从应有可点击的露出卡面').not.toBeNull();
        await page.mouse.click(
            lowTargetBox!.x + Math.max(8, lowTargetBox!.width * 0.18),
            lowTargetBox!.y + lowTargetBox!.height * 0.55,
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const hostState = core.bases[0].minions.find(minion => minion.uid === 'magic-host');
            return {
                base0MinionUids: core.bases[0].minions.map(minion => minion.uid),
                hostAttachedActionUids: hostState?.attachedActions?.map(action => action.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player1DiscardDefIds: core.players?.['1']?.discard?.map(card => card.defId) ?? [],
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0MinionUids: ['magic-host', 'magic-high-target'],
            hostAttachedActionUids: [],
            player0DiscardDefIds: [],
            player1DiscardDefIds: ['alien_invader'],
            treasureDeck: [
                'munchkin_treasure_wishing_ring',
                'munchkin_treasure_magic_missile',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-minion-uid="magic-low-target"]')).toHaveCount(0);
        await expect(highTarget).toBeVisible({ timeout: 10000 });
        await game.screenshot('27-魔法导弹摧毁后状态', testInfo);
    });

    test('许愿指环可从手牌打出并获得 1VP 后回公共宝藏牌库底', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinWishingRingScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="wishing-ring-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-score-vp-0')).toHaveText('2');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 1');
        await game.screenshot('28-许愿指环手牌与当前VP', testInfo);

        await game.playCard('munchkin_treasure_wishing_ring');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                player0Vp: core.players?.['0']?.vp ?? 0,
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0Vp: 3,
            player0HandUids: [],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDeck: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_wishing_ring',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.getByTestId('su-score-vp-0')).toHaveText('3');
        await expect(page.locator('[data-card-uid="wishing-ring-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 2');
        await game.screenshot('29-许愿指环结算后VP与公共宝藏牌堆', testInfo);
    });

    test('探宝棒可从手牌打出并抽两张宝藏后重洗公共宝藏弃牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinTreasureFinderScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="treasure-finder-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 3');
        await game.screenshot('30-探宝棒手牌与公共宝藏牌堆', testInfo);

        await game.playCard('munchkin_treasure_treasure_finder');
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                player0HandDefIds: core.players?.['0']?.hand?.map(card => card.defId) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                treasureDiscard: core.treasureDiscard ?? [],
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            player0HandDefIds: [
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_halfling_hireling',
            ],
            player0HandUids: [
                'munchkin_treasure_1700',
                'munchkin_treasure_1701',
            ],
            player0DiscardDefIds: [],
            player0ActionsPlayed: 1,
            treasureDiscard: [],
            treasureDeck: [
                'munchkin_treasure_tiger_steed',
                'munchkin_treasure_treasure_finder',
                'munchkin_treasure_magic_missile',
                'munchkin_treasure_wishing_ring',
            ],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="treasure-finder-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 4');
        await game.screenshot('31-探宝棒结算后手牌与公共宝藏牌堆', testInfo);
    });

    test('十字弓可从手牌打出并选择基地和派系批量加力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinCrossbowScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="crossbow-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="crossbow-pirate-a"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="crossbow-pirate-b"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="crossbow-alien-a"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('32-十字弓手牌与目标基地', testInfo);

        await game.playCard('munchkin_treasure_crossbow', { targetBaseIndex: 0 });
        await game.waitForInteraction('munchkin_treasure_crossbow_choose_faction', 10000);
        await game.screenshot('33-十字弓选择目标派系', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) => option.value?.factionId === 'pirates',
            '十字弓目标派系',
        );
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const base0Temps = Object.fromEntries(core.bases[0].minions.map(minion => [
                minion.uid,
                minion.tempPowerModifier ?? 0,
            ]));
            const base1Temps = Object.fromEntries(core.bases[1].minions.map(minion => [
                minion.uid,
                minion.tempPowerModifier ?? 0,
            ]));
            return {
                base0Temps,
                base1Temps,
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Temps: {
                'crossbow-pirate-a': 2,
                'crossbow-pirate-b': 2,
                'crossbow-alien-a': 0,
            },
            base1Temps: {
                'crossbow-pirate-away': 0,
            },
            player0DiscardDefIds: ['munchkin_treasure_crossbow'],
            player0ActionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('34-十字弓结算后目标派系加力量', testInfo);
    });

    test('一袋铁蒺藜可在对手打出低力随从到本基地时摧毁双方', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinBagOfCaltropsScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="caltrops-target-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-ongoing-uid="caltrops-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('35-一袋铁蒺藜触发前基地与对手手牌', testInfo);

        await game.playCard('pirate_first_mate', { targetBaseIndex: 0 });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            return {
                base0MinionUids: core.bases[0].minions.map(minion => minion.uid),
                base0OngoingUids: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player1DiscardDefIds: core.players?.['1']?.discard?.map(card => card.defId) ?? [],
                player1MinionsPlayed: core.players?.['1']?.minionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0MinionUids: [],
            base0OngoingUids: [],
            player0DiscardDefIds: ['munchkin_treasure_bag_of_caltrops'],
            player1DiscardDefIds: ['pirate_first_mate'],
            player1MinionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="caltrops-target-1"]')).toHaveCount(0);
        await expect(page.locator('[data-ongoing-uid="caltrops-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await waitForSmashUpFxToSettle(page);
        await game.screenshot('36-一袋铁蒺藜触发后双方进弃牌', testInfo);
    });

    test('愚蠢勇气药水可从手牌打出并给目标随从本回合加力量', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinPotionOfIdioticBraveryScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="idiotic-bravery-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="bravery-target"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="bravery-bystander"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('37-愚蠢勇气药水手牌与目标随从', testInfo);

        await game.playCard('munchkin_treasure_potion_of_idiotic_bravery', {
            targetMinionUid: 'bravery-target',
        });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);
        await expect(page.getByText('请选择一个随从来附着此卡')).toHaveCount(0);
        await expect(page.getByText('请选择一个目标随从')).toHaveCount(0);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const base0Temps = Object.fromEntries(core.bases[0].minions.map(minion => [
                minion.uid,
                minion.tempPowerModifier ?? 0,
            ]));
            return {
                base0Temps,
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            base0Temps: {
                'bravery-target': 3,
                'bravery-bystander': 0,
            },
            player0HandUids: [],
            player0DiscardDefIds: ['munchkin_treasure_potion_of_idiotic_bravery'],
            player0ActionsPlayed: 1,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await expect(page.locator('[data-card-uid="idiotic-bravery-1"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('38-愚蠢勇气药水结算后力量加成', testInfo);
    });

    test('地牢规则书可从手牌打出并点击基地行动作为摧毁目标', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinDungeonRulebookScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const rulebook = page.locator('[data-card-uid="dungeon-rulebook-1"]').first();
        const targetAction = page.locator('[data-ongoing-uid="dungeon-target-action-1"]').first();
        await expect(rulebook).toBeVisible({ timeout: 15000 });
        await expect(targetAction).toBeVisible({ timeout: 15000 });
        await game.screenshot('09-地牢规则书手牌与目标行动', testInfo);

        await rulebook.click({ force: true });
        await rulebook.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_dungeon_rulebook_destroy', 10000);
        await game.screenshot('10-地牢规则书选择要摧毁的行动', testInfo);

        await targetAction.click({ force: true });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const core = await readCoreState(page) as RocketBootsCoreState;
            return {
                remainingOngoingUids: core.bases[0].ongoingActions?.map(action => action.uid) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player1DiscardDefIds: core.players?.['1']?.discard?.map(card => card.defId) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            remainingOngoingUids: [],
            player0HandUids: [],
            player0DiscardDefIds: ['munchkin_treasure_dungeon_rulebook'],
            player1DiscardDefIds: ['zombie_overrun'],
            triggerQueueLength: 0,
        });

        await game.screenshot('11-地牢规则书摧毁行动后状态', testInfo);
    });

    test('矮人王可把己方宿主身上被摧毁的宝藏回收到手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinDwarfKingRecoveryScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const rulebook = page.locator('[data-card-uid="dwarf-king-rulebook-1"]').first();
        const king = page.locator('[data-minion-uid="dwarf-king-e2e"]').first();
        const host = page.locator('[data-minion-uid="dwarf-king-host"]').first();
        const attachedTreasure = page.locator('[data-attached-action-uid="dwarf-king-spiky-boots"]').first();
        await expect(rulebook).toBeVisible({ timeout: 15000 });
        await expect(king).toBeVisible({ timeout: 15000 });
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(attachedTreasure).toBeVisible({ timeout: 15000 });
        await game.screenshot('57-矮人王回收前宿主宝藏与地牢规则书', testInfo);

        await rulebook.click({ force: true });
        await rulebook.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_dungeon_rulebook_destroy', 10000);
        await host.hover();
        await expect(attachedTreasure).toBeVisible({ timeout: 15000 });
        await game.screenshot('58-矮人王选择要摧毁的宿主宝藏', testInfo);

        await attachedTreasure.click({ force: true });
        await game.waitForNoInteraction(10000);
        await waitForSmashUpFxToSettle(page);

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as RocketBootsCoreState;
            const hostState = core.bases[0].minions.find(minion => minion.uid === 'dwarf-king-host');
            return {
                hostAttachedUids: hostState?.attachedActions?.map(action => action.uid) ?? [],
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player1DiscardUids: core.players?.['1']?.discard?.map(card => card.uid) ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            hostAttachedUids: [],
            player0HandUids: ['dwarf-king-spiky-boots'],
            player0DiscardDefIds: ['munchkin_treasure_dungeon_rulebook'],
            player1DiscardUids: [],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await expect(page.locator('[data-card-uid="dwarf-king-spiky-boots"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-attached-action-uid="dwarf-king-spiky-boots"]')).toHaveCount(0);
        await expect(page.getByTestId('su-munchkin-monster-supply-count')).toHaveText('x 20');
        await expect(page.getByTestId('su-munchkin-treasure-supply-count')).toHaveText('x 22');
        await game.screenshot('59-矮人王回收宝藏后进入手牌', testInfo);
    });

    test('口臭药水可从手牌打出并点击被选玩家的仆从移动', async ({ page, game }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinHalitosisPotionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const potion = page.locator('[data-card-uid="halitosis-1"]').first();
        const sourceBase = page.locator('[data-base-index="0"]').first();
        const movingMinion = page.locator('[data-minion-uid="halitosis-runner"]').first();
        await expect(potion).toBeVisible({ timeout: 15000 });
        await expect(sourceBase).toBeVisible({ timeout: 15000 });
        await expect(movingMinion).toBeVisible({ timeout: 15000 });
        await game.screenshot('12-口臭药水手牌与目标基地', testInfo);

        await potion.click({ force: true });
        await sourceBase.click({ force: true });
        await game.waitForInteraction('munchkin_treasure_potion_of_halitosis_choose_player', 10000);
        await game.screenshot('13-口臭药水选择玩家', testInfo);

        await game.selectInteractionOptionBy(
            (option: { value?: { playerId?: string } }) => option?.value?.playerId === '0',
            '口臭药水选择自己',
        );
        await game.waitForInteraction('munchkin_treasure_potion_of_halitosis_move', 10000);
        await game.screenshot('14-口臭药水点击己方仆从移动', testInfo);

        await movingMinion.click({ force: true });
        await game.waitForNoInteraction(10000);

        await expect.poll(async () => {
            const core = await readCoreState(page) as RocketBootsCoreState;
            return {
                sourceMinionUids: core.bases[0].minions.map(minion => minion.uid),
                targetMinionUids: core.bases[1].minions.map(minion => minion.uid),
                player0HandUids: core.players?.['0']?.hand?.map(card => card.uid) ?? [],
                player0DiscardDefIds: core.players?.['0']?.discard?.map(card => card.defId) ?? [],
                player0ActionsPlayed: core.players?.['0']?.actionsPlayed ?? 0,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
            };
        }, { timeout: 10000 }).toEqual({
            sourceMinionUids: ['halitosis-enemy'],
            targetMinionUids: ['halitosis-destination-ally', 'halitosis-runner'],
            player0HandUids: [],
            player0DiscardDefIds: ['munchkin_treasure_potion_of_halitosis'],
            player0ActionsPlayed: 1,
            triggerQueueLength: 0,
        });

        await game.screenshot('15-口臭药水移动后状态', testInfo);
    });

    test('直线跑路药水可从计分后响应窗口选择已展示宝藏进手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinStraightLineRunningAwayScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="straight-line-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-monster-uid="straight-line-treasure-dragon"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('16-直线跑路药水计分前手牌与宝藏龙', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);

        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.core?.pendingMunchkinTreasureReward?.treasureCards?.length === 3
                    && (
                        state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose'
                        || Boolean(state?.sys?.responseWindow?.current?.windowType)
                    );
            },
            { timeout: 15000, polling: 200 },
        );

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const status = await getReactionWindowStatus(page);
            const options = status.sourceId === 'smashup_reaction_choose'
                ? await game.getInteractionOptions() as InteractionOption[]
                : [];
            const hasStraightLineOption = status.windowType === 'afterScoring'
                && options.some((option) =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'straight-line-1'
                );
            if (hasStraightLineOption) break;

            const didPass = await passOpenReactionOrResponseWindow(page, game, `直线跑路药水前置响应让过 ${attempt + 1}`);
            expect(didPass, '等待 afterScoring 直线跑路药水入口期间必须存在可让过的响应').toBe(true);
            await page.waitForTimeout(300);
        }

        await expect.poll(async () => {
            const status = await getReactionWindowStatus(page);
            const options = status.sourceId === 'smashup_reaction_choose'
                ? await game.getInteractionOptions() as InteractionOption[]
                : [];
            return {
                windowType: status.windowType,
                hasStraightLineOption: options.some((option) =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'straight-line-1'
                ),
            };
        }, { timeout: 10000 }).toEqual({
            windowType: 'afterScoring',
            hasStraightLineOption: true,
        });
        await game.screenshot('17-直线跑路药水afterScoring响应入口', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.kind === 'play_action'
                && option.value?.cardUid === 'straight-line-1',
            'afterScoring 选择直线跑路药水',
        );
        await game.waitForInteraction('munchkin_treasure_potion_of_straight_line_running_away_choose_treasure', 10000);
        await game.screenshot('18-直线跑路药水选择已展示宝藏', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.treasureDefId === 'munchkin_treasure_bag_of_caltrops',
            '直线跑路药水选择一袋铁蒺藜',
        );

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as StraightLineRunningAwayCoreState;
            const player0HandDefIds = core.players?.['0']?.hand?.map(card => card.defId) ?? [];
            const player0DiscardDefIds = core.players?.['0']?.discard?.map(card => card.defId) ?? [];
            return {
                pendingTreasureReward: core.pendingMunchkinTreasureReward ?? null,
                player0TreasureHandDefIds: player0HandDefIds.filter(defId => defId.startsWith('munchkin_treasure_')),
                player0DiscardHasPotion: player0DiscardDefIds.includes('munchkin_treasure_potion_of_straight_line_running_away'),
                treasureDeck: core.treasureDeck ?? [],
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            pendingTreasureReward: null,
            player0TreasureHandDefIds: [
                'munchkin_treasure_bag_of_caltrops',
                'munchkin_treasure_dwarf_hireling',
                'munchkin_treasure_wishing_ring',
            ],
            player0DiscardHasPotion: true,
            treasureDeck: ['munchkin_treasure_tiger_steed'],
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });
        await game.screenshot('19-直线跑路药水计分收口后状态', testInfo);
    });

    test('麻痹药水可从计分前响应窗口取消正在计分基地上的牌能力', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinParalysisPotionScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-card-uid="paralysis-1"]').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-minion-uid="paralysis-hero"]').first()).toBeVisible({ timeout: 15000 });
        await game.screenshot('20-麻痹药水计分前手牌与目标基地', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);

        await page.waitForFunction(
            () => {
                const state = (window as BrowserHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.();
                return state?.sys?.phase === 'scoreBases'
                    && state?.sys?.responseWindow?.current?.windowType === 'meFirst'
                    && state?.sys?.interaction?.current?.data?.sourceId === 'smashup_reaction_choose';
            },
            { timeout: 15000, polling: 200 },
        );

        await expect.poll(async () => {
            const options = await game.getInteractionOptions() as InteractionOption[];
            return {
                hasParalysisOption: options.some((option) =>
                    option.value?.kind === 'play_action'
                    && option.value?.cardUid === 'paralysis-1'
                    && option.value?.targetBaseIndex === 0
                ),
            };
        }, { timeout: 10000 }).toEqual({ hasParalysisOption: true });
        await game.screenshot('21-麻痹药水beforeScoring响应入口', testInfo);

        await game.selectInteractionOptionBy(
            (option: InteractionOption) =>
                option.value?.kind === 'play_action'
                && option.value?.cardUid === 'paralysis-1'
                && option.value?.targetBaseIndex === 0,
            'beforeScoring 选择麻痹药水',
        );

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as ParalysisCoreState;
            const suppressionEvent = [...(state.sys?.eventStream?.entries ?? [])]
                .map(entry => entry.event)
                .find(event => event?.type === 'su:cards_suppressed_until_turn_end'
                    && event?.payload?.reason === 'munchkin_treasure_potion_of_paralysis');
            const suppressedCardUids = suppressionEvent?.payload?.cardUids ?? [];
            const player0DiscardDefIds = core.players?.['0']?.discard?.map(card => card.defId) ?? [];
            return {
                suppressionBaseIndex: suppressionEvent?.payload?.baseIndex ?? null,
                suppressedCardUids,
                suppressedAwayAction: suppressedCardUids.includes('paralysis-away-action'),
                suppressedAwayMinion: suppressedCardUids.includes('paralysis-away-minion'),
                player0DiscardHasPotion: player0DiscardDefIds.includes('munchkin_treasure_potion_of_paralysis'),
                suppressionStillActiveAfterTurnAdvance: (core.suppressedCardUidsUntilTurnEnd ?? []).length > 0,
                turnNumber: core.turnNumber,
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
            };
        }, { timeout: 10000 }).toEqual({
            suppressionBaseIndex: 0,
            suppressedCardUids: [
                'paralysis-base-action',
                'paralysis-hero',
                'paralysis-rocket-boots',
                'paralysis-ally',
            ],
            suppressedAwayAction: false,
            suppressedAwayMinion: false,
            player0DiscardHasPotion: true,
            suppressionStillActiveAfterTurnAdvance: false,
            turnNumber: 12,
            triggerQueueLength: 0,
            responseWindowType: null,
            interactionSourceId: null,
        });
        await game.screenshot('22-麻痹药水计分收口后状态', testInfo);
    });

    test('时间错乱的喷气背包可在真实计分清场队列中让宿主回手牌', async ({ page, game }, testInfo) => {
        test.setTimeout(90000);

        await page.setViewportSize({ width: 1440, height: 900 });
        await game.openTestGame('smashup', { skipInitialization: true }, 20000);
        await game.setupScene(buildMunchkinTemporalDisplacementJetpackScene());

        await expect(page.getByTestId('su-hand-area')).toBeVisible({ timeout: 15000 });
        const host = page.locator('[data-minion-uid="jetpack-host"]').first();
        const jetpack = page.locator('[data-attached-action-uid="temporal-jetpack-1"]').first();
        await expect(host).toBeVisible({ timeout: 15000 });
        await host.hover();
        await expect(jetpack).toBeVisible({ timeout: 15000 });
        await game.screenshot('23-时间错乱的喷气背包计分前宿主', testInfo);

        await game.advancePhase();
        await game.waitForPhase('scoreBases', 10000);

        for (let attempt = 0; attempt < 12; attempt += 1) {
            const state = await game.getState();
            const core = state.core as TemporalJetpackCoreState;
            const player0HandUids = core.players?.['0']?.hand?.map(card => card.uid) ?? [];
            const player0DiscardUids = core.players?.['0']?.discard?.map(card => card.uid) ?? [];
            const hostReturned = player0HandUids.includes('jetpack-host')
                && player0DiscardUids.includes('temporal-jetpack-1');
            if (hostReturned && state.sys?.phase === 'playCards') break;

            const didPass = await passOpenReactionOrResponseWindow(page, game, `时间错乱的喷气背包计分响应让过 ${attempt + 1}`);
            if (!didPass) await page.waitForTimeout(500);
        }

        await expect.poll(async () => {
            const state = await game.getState();
            const core = state.core as TemporalJetpackCoreState;
            const player0Hand = core.players?.['0']?.hand ?? [];
            const player0Discard = core.players?.['0']?.discard ?? [];
            const player1Discard = core.players?.['1']?.discard ?? [];
            const events = (state.sys?.eventStream?.entries ?? []).map((entry: EventStreamEntry) => entry.event);
            const queued = events.find((event) =>
                event?.type === 'su:trigger_queued'
                && event?.payload?.triggers?.some((trigger) =>
                    trigger.sourceDefId === 'munchkin_treasure_temporal_displacement_jetpack'
                    && trigger.timing === 'onMinionDiscardedFromBase'
                    && trigger.triggerMinionUid === 'jetpack-host'
                )
            );
            const returned = events.find((event) =>
                event?.type === 'su:minion_returned'
                && event?.payload?.reason === 'munchkin_treasure_temporal_displacement_jetpack'
                && event?.payload?.minionUid === 'jetpack-host'
            );

            return {
                phase: state.sys?.phase,
                player0HandHasReturnedHost: player0Hand.some(card =>
                    card.uid === 'jetpack-host'
                    && card.defId === 'munchkin_warriors_big_hero'
                ),
                player0HandHostCount: player0Hand.filter(card => card.uid === 'jetpack-host').length,
                player0DiscardHasHost: player0Discard.some(card => card.uid === 'jetpack-host'),
                player0DiscardHasJetpack: player0Discard.some(card =>
                    card.uid === 'temporal-jetpack-1'
                    && card.defId === 'munchkin_treasure_temporal_displacement_jetpack'
                ),
                player1DiscardDefIds: player1Discard.map(card => card.defId),
                hostStillOnBase: core.bases.some(base => base.minions.some(minion => minion.uid === 'jetpack-host')),
                triggerQueuedForJetpack: Boolean(queued),
                returnedByJetpack: Boolean(returned),
                triggerQueueLength: core.triggerQueue?.length ?? 0,
                interactionSourceId: state.sys?.interaction?.current?.data?.sourceId ?? null,
                responseWindowType: state.sys?.responseWindow?.current?.windowType ?? null,
            };
        }, { timeout: 15000 }).toEqual({
            phase: 'playCards',
            player0HandHasReturnedHost: true,
            player0HandHostCount: 1,
            player0DiscardHasHost: false,
            player0DiscardHasJetpack: true,
            player1DiscardDefIds: ['alien_invader'],
            hostStillOnBase: false,
            triggerQueuedForJetpack: true,
            returnedByJetpack: true,
            triggerQueueLength: 0,
            interactionSourceId: null,
            responseWindowType: null,
        });

        await game.screenshot('24-时间错乱的喷气背包回手牌后状态', testInfo);
    });
});
