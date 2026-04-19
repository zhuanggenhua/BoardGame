import { getCardDef } from './data/cards';

type TestHarness = Window['__BG_TEST_HARNESS__'];

const FOUR_PLAYER_TURN_ORDER = ['0', '1', '2', '3'] as const;
const REPLACEMENT_BASE_DECK = [
    'base_central_brain',
    'base_cave_of_shinies',
    'base_rhodes_plaza',
    'base_the_factory',
] as const;

function createPlayerState(
    playerId: string,
    vp: number,
    factions: [string, string],
) {
    return {
        id: playerId,
        vp,
        hand: [] as Array<Record<string, unknown>>,
        deck: [] as Array<Record<string, unknown>>,
        discard: [] as Array<Record<string, unknown>>,
        factions,
        minionsPlayed: 1,
        minionLimit: 1,
        actionsPlayed: 1,
        actionLimit: 1,
    };
}

function getMinionBasePower(defId: string) {
    const def = getCardDef(defId);
    if (def && 'power' in def && typeof def.power === 'number') {
        return def.power;
    }
    return 1;
}

function buildFourPlayerMobileScene() {
    return {
        currentPlayer: '0',
        phase: 'playCards',
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [
                    {
                        uid: 'p0-b0-armor-stego',
                        defId: 'dino_armor_stego_pod',
                        owner: '0',
                        controller: '0',
                        talentUsed: false,
                        attachedActions: [
                            { uid: 'p0-b0-armor-stego-upgrade', defId: 'dino_tooth_and_claw_pod', ownerId: '0' },
                        ],
                    },
                    { uid: 'p2-b0-spectre', defId: 'ghost_spectre', owner: '2', controller: '2' },
                    { uid: 'p1-b0-invader', defId: 'alien_invader', owner: '1', controller: '1' },
                    { uid: 'p3-b0-ghost', defId: 'ghost_ghost', owner: '3', controller: '3' },
                ],
                ongoingActions: [
                    { uid: 'p0-b0-base-ongoing', defId: 'zombie_overrun', ownerId: '0', talentUsed: false },
                ],
            },
            {
                defId: 'base_dread_lookout',
                breakpoint: 20,
                minions: [
                    { uid: 'p3-b1-king-rex', defId: 'dino_king_rex', owner: '3', controller: '3' },
                    { uid: 'p1-b1-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                    { uid: 'p1-b1-collector', defId: 'alien_collector', owner: '1', controller: '1' },
                    { uid: 'p0-b1-grave-digger', defId: 'zombie_grave_digger', owner: '0', controller: '0' },
                    { uid: 'p2-b1-chronomage', defId: 'wizard_chronomage', owner: '2', controller: '2' },
                ],
            },
            {
                defId: 'base_tsars_palace',
                breakpoint: 22,
                minions: [
                    { uid: 'p0-b2-king-rex', defId: 'dino_king_rex', owner: '0', controller: '0' },
                    { uid: 'p2-b2-spirit-a', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p2-b2-spirit-b', defId: 'ghost_spirit', owner: '2', controller: '2' },
                    { uid: 'p3-b2-spectre', defId: 'ghost_spectre', owner: '3', controller: '3' },
                    { uid: 'p1-b2-tiger-assassin', defId: 'ninja_tiger_assassin', owner: '1', controller: '1' },
                ],
            },
        ],
        extra: {
            core: {
                turnOrder: [...FOUR_PLAYER_TURN_ORDER],
                turnNumber: 5,
                nextUid: 9000,
                baseDeck: [...REPLACEMENT_BASE_DECK],
                players: {
                    '0': {
                        ...createPlayerState('0', 1, ['dinosaurs', 'zombies']),
                        hand: [
                            { uid: 'p0-mobile-hand-terraform', defId: 'alien_terraform', type: 'action', owner: '0' },
                            { uid: 'p0-mobile-hand-invader', defId: 'alien_invader', type: 'minion', owner: '0' },
                        ],
                    },
                    '1': createPlayerState('1', 2, ['aliens', 'ninjas']),
                    '2': createPlayerState('2', 3, ['ghosts', 'wizards']),
                    '3': createPlayerState('3', 4, ['dinosaurs', 'ghosts']),
                },
            },
        },
    };
}

function inferCardType(defId: string) {
    if (defId.includes('base_')) return 'base';
    const actionKeywords = [
        'portal',
        'time_loop',
        'full_steam',
        'cannon',
        'broadside',
        'disintegrate',
        'augmentation',
        'upgrade',
        'power_up',
        'terraform',
        'crop_circles',
        'abduction',
        'probe',
        'shamble',
        'not_dead_yet',
        'grave_digger',
        'swashbuckling',
        'ninjutsu',
        'disguise',
        'smoke_bomb',
        'overrun',
        'tooth_and_claw',
    ];

    return actionKeywords.some(keyword => defId.includes(keyword)) ? 'action' : 'minion';
}

function buildCard(entry: { uid?: string; defId: string; type?: string; owner?: string }, owner: string, fallbackUid: string) {
    return {
        uid: entry.uid ?? fallbackUid,
        defId: entry.defId,
        type: entry.type ?? inferCardType(entry.defId),
        owner: entry.owner ?? owner,
    };
}

function buildAttachedAction(entry: { uid?: string; defId: string; ownerId?: string; talentUsed?: boolean }, fallbackUid: string) {
    return {
        uid: entry.uid ?? fallbackUid,
        defId: entry.defId,
        ownerId: entry.ownerId ?? '0',
        talentUsed: entry.talentUsed ?? false,
    };
}

function buildMinion(entry: {
    uid?: string;
    defId: string;
    owner: string;
    controller?: string;
    talentUsed?: boolean;
    attachedActions?: Array<{ uid?: string; defId: string; ownerId?: string; talentUsed?: boolean }>;
}, fallbackUid: string) {
    return {
        uid: entry.uid ?? fallbackUid,
        defId: entry.defId,
        owner: entry.owner,
        controller: entry.controller ?? entry.owner,
        basePower: getMinionBasePower(entry.defId),
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: entry.talentUsed ?? false,
        attachedActions: (entry.attachedActions ?? []).map((action, index) =>
            buildAttachedAction(action, `${fallbackUid}-attached-${index}`),
        ),
    };
}

export function injectSmashUpFourPlayerMobileEvidenceScene(harness: TestHarness) {
    if (!harness?.state?.isRegistered?.()) {
        throw new Error('TestHarness 状态注入器未就绪');
    }

    const scene = buildFourPlayerMobileScene();
    const state = harness.state.get();
    if (!state?.core?.players) {
        throw new Error('当前 Smash Up 状态未就绪');
    }

    const patch = {
        core: {
            ...state.core,
            ...scene.extra.core,
            currentPlayerIndex: Number(scene.currentPlayer),
            factionSelection: undefined,
            players: {
                ...state.core.players,
                ...scene.extra.core.players,
                '0': {
                    ...state.core.players['0'],
                    ...scene.extra.core.players['0'],
                    hand: scene.extra.core.players['0'].hand.map((card, index) =>
                        buildCard(card, '0', `p0-mobile-hand-${index}`),
                    ),
                },
                '1': {
                    ...state.core.players['1'],
                    ...scene.extra.core.players['1'],
                },
                '2': {
                    ...state.core.players['2'],
                    ...scene.extra.core.players['2'],
                },
                '3': {
                    ...state.core.players['3'],
                    ...scene.extra.core.players['3'],
                },
            },
            bases: scene.bases.map((base, baseIndex) => ({
                ...(state.core.bases?.[baseIndex] ?? {}),
                defId: base.defId,
                breakpoint: base.breakpoint,
                minions: base.minions.map((minion, minionIndex) =>
                    buildMinion(minion, `base-${baseIndex}-minion-${minionIndex}`),
                ),
                ongoingActions: (base.ongoingActions ?? []).map((action, actionIndex) =>
                    buildAttachedAction(action, `base-${baseIndex}-ongoing-${actionIndex}`),
                ),
            })),
        },
        sys: {
            ...(state.sys ?? {}),
            phase: scene.phase,
            interaction: {
                ...(state.sys?.interaction ?? {}),
                current: undefined,
                queue: [],
            },
            responseWindow: {
                current: undefined,
            },
        },
    };

    harness.state.patch(patch);
}
