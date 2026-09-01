import type { PlayerId, TutorialAiAction, TutorialCollection, TutorialManifest } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { MAGE_WARS_COMMANDS, MAGE_WARS_EVENTS } from './domain';
import type { MageWarsArenaObjectState, MageWarsCore } from './domain';
import {
    ARENA_ZONE_IDS,
    MAGE_IDS,
    MAGE_WARS_OBJECT_ABILITY_IDS,
    STATUS_TOKEN_IDS,
    type ArenaZoneId,
} from './domain/ids';

const JUNGLE_WOLF_CARD_ID = 2819;
const ROUSE_THE_BEAST_CARD_ID = 3403;
const ASYRAN_CLERIC_CARD_ID = 2811;
const WILD_BOBCAT_CARD_ID = 2906;
const PILLAR_OF_LIGHT_CARD_ID = 1706;
const THORNS_WALL_CARD_ID = 25700;
const PLAYER_ONE_CLERIC_OBJECT_ID = 'mwobj-1-2811-1';
const WALL_EDGE_A3_B3 = 'a3-b3';

export const MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID = 'mw-tutorial-guard-cleric';
export const MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID = 'mw-tutorial-healing-cleric';
export const MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID = 'mw-tutorial-wounded-bobcat';
export const MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID = 'mw-tutorial-burning-cleric';

const FORMAL_ARENA_LAYOUT: Array<{ id: ArenaZoneId; row: number; col: number }> = [
    { id: ARENA_ZONE_IDS.A1, row: 0, col: 0 },
    { id: ARENA_ZONE_IDS.B1, row: 0, col: 1 },
    { id: ARENA_ZONE_IDS.C1, row: 0, col: 2 },
    { id: ARENA_ZONE_IDS.D1, row: 0, col: 3 },
    { id: ARENA_ZONE_IDS.A2, row: 1, col: 0 },
    { id: ARENA_ZONE_IDS.B2, row: 1, col: 1 },
    { id: ARENA_ZONE_IDS.C2, row: 1, col: 2 },
    { id: ARENA_ZONE_IDS.D2, row: 1, col: 3 },
    { id: ARENA_ZONE_IDS.A3, row: 2, col: 0 },
    { id: ARENA_ZONE_IDS.B3, row: 2, col: 1 },
    { id: ARENA_ZONE_IDS.C3, row: 2, col: 2 },
    { id: ARENA_ZONE_IDS.D3, row: 2, col: 3 },
];

const advancePhase = (playerId: string): TutorialAiAction => ({
    commandType: FLOW_COMMANDS.ADVANCE_PHASE,
    playerId,
    payload: {},
});

const mergeState = (fields: Partial<MageWarsCore>): TutorialAiAction => ({
    commandType: CHEAT_COMMANDS.MERGE_STATE,
    payload: { fields },
});

// 机制练习从明确的预设局面开始；阶段推进仅用于把夹具放到练习入口，
// 不计入基础教程的自然流程。setup 步骤通过 skipAutomaticFlow 禁止正式自动推进。
const SETUP_TO_DEPLOYMENT_ACTIONS: TutorialAiAction[] = [
    advancePhase('1'), advancePhase('0'), advancePhase('1'), advancePhase('0'),
    advancePhase('1'), advancePhase('0'), advancePhase('1'), advancePhase('0'),
];
const SETUP_TO_CREATURE_ACTION_ACTIONS: TutorialAiAction[] = [
    ...SETUP_TO_DEPLOYMENT_ACTIONS,
    advancePhase('0'), advancePhase('1'), advancePhase('0'), advancePhase('1'),
];

function createTutorialCreatureObject(args: {
    id: string;
    ownerId: PlayerId;
    sourceSpellCardId: number;
    name: string;
    zoneId: ArenaZoneId;
    life?: number;
    damage?: number;
    armor?: number;
    actionReady?: boolean;
    guarding?: boolean;
    statusTokens?: MageWarsArenaObjectState['statusTokens'];
    schoolLine?: string;
    attackOrTraitLine?: string;
}): MageWarsArenaObjectState {
    return {
        id: args.id,
        kind: 'creature',
        ownerId: args.ownerId,
        sourceSpellCardId: args.sourceSpellCardId,
        sourceObjectId: `spell-${args.sourceSpellCardId}`,
        combatProfilesSource: 'config',
        combatTraitsSource: 'config',
        name: args.name,
        zoneId: args.zoneId,
        life: args.life ?? 5,
        damage: args.damage ?? 0,
        armor: args.armor ?? 0,
        actionReady: args.actionReady ?? true,
        guarding: args.guarding ?? false,
        summonedTurnNumber: 1,
        statusTokens: args.statusTokens ?? {},
        typeLine: '生物',
        schoolLine: args.schoolLine ?? '神圣',
        attackOrTraitLine: args.attackOrTraitLine ?? '',
        rulesText: '',
    };
}

function createTutorialArena(
    playerZones: Record<PlayerId, ArenaZoneId>,
    objects: readonly MageWarsArenaObjectState[],
): MageWarsCore['arena'] {
    return FORMAL_ARENA_LAYOUT.map((zone) => ({
        id: zone.id,
        row: zone.row,
        col: zone.col,
        occupantIds: Object.entries(playerZones)
            .filter(([, zoneId]) => zoneId === zone.id)
            .map(([playerId]) => playerId),
        objectIds: objects
            .filter((object) => object.zoneId === zone.id)
            .map((object) => object.id),
        conjurationIds: objects
            .filter((object) => object.zoneId === zone.id && object.kind === 'conjuration')
            .map((object) => object.id),
    }));
}

function createPriestessMechanicsPatch(): Partial<MageWarsCore> {
    const playerZones: Record<PlayerId, ArenaZoneId> = {
        '0': ARENA_ZONE_IDS.A2,
        '1': ARENA_ZONE_IDS.D3,
    };
    const guardCleric = createTutorialCreatureObject({
        id: MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID,
        ownerId: '0',
        sourceSpellCardId: ASYRAN_CLERIC_CARD_ID,
        name: '阿希拉牧师',
        zoneId: ARENA_ZONE_IDS.D2,
        life: 12,
        schoolLine: '神圣',
    });
    const healingCleric = createTutorialCreatureObject({
        id: MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID,
        ownerId: '0',
        sourceSpellCardId: ASYRAN_CLERIC_CARD_ID,
        name: '阿希拉牧师',
        zoneId: ARENA_ZONE_IDS.A2,
        life: 12,
        schoolLine: '神圣',
    });
    const woundedBobcat = createTutorialCreatureObject({
        id: MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
        ownerId: '0',
        sourceSpellCardId: WILD_BOBCAT_CARD_ID,
        name: '野性山猫',
        zoneId: ARENA_ZONE_IDS.A2,
        life: 5,
        damage: 4,
        schoolLine: '自然',
        attackOrTraitLine: '动物',
    });
    const burningCleric = createTutorialCreatureObject({
        id: MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID,
        ownerId: '0',
        sourceSpellCardId: ASYRAN_CLERIC_CARD_ID,
        name: '燃烧的阿希拉牧师',
        zoneId: ARENA_ZONE_IDS.A2,
        life: 12,
        statusTokens: { [STATUS_TOKEN_IDS.BURN]: 1 },
        schoolLine: '神圣',
    });
    const objects = [guardCleric, healingCleric, woundedBobcat, burningCleric];

    return {
        currentPlayerId: '0',
        phaseActorId: '0',
        phaseReadyPlayerIds: [],
        players: {
            '0': {
                mageId: MAGE_IDS.PRIESTESS_APPRENTICE,
                mageZoneId: playerZones['0'],
                mana: 20,
                actionReady: true,
                quickcastReady: true,
                guarding: false,
                statusTokens: {},
                preparedSpellSlots: 0,
                preparedSpellCardIds: [],
            },
            '1': {
                mageZoneId: playerZones['1'],
                actionReady: true,
                quickcastReady: true,
                guarding: false,
                statusTokens: {},
            },
        },
        objects: Object.fromEntries(objects.map((object) => [object.id, object])),
        arena: createTutorialArena(playerZones, objects),
    };
}

const createWallSetupPatch = (): Partial<MageWarsCore> => ({
    currentPlayerId: '0',
    phaseActorId: '0',
    phaseReadyPlayerIds: [],
    players: {
        '0': {
            mageId: MAGE_IDS.BEASTMASTER_APPRENTICE,
            mana: 20,
            preparedSpellSlots: 1,
            preparedSpellCardIds: [THORNS_WALL_CARD_ID],
            actionReady: true,
            quickcastReady: true,
            guarding: false,
        },
        '1': {
            actionReady: true,
            quickcastReady: true,
            guarding: false,
        },
    },
    walls: {},
});

export const MageWarsTutorial: TutorialManifest = {
    id: 'mage-wars-basic',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'intro',
            content: 'game-mage-wars:tutorial.steps.intro',
            highlightTarget: 'mw-board',
            position: 'center',
            showMask: true,
            infoStep: true,
        },
        {
            id: 'self-hud',
            content: 'game-mage-wars:tutorial.steps.selfHud',
            highlightTarget: 'mw-self-hud',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'opponent-hud',
            content: 'game-mage-wars:tutorial.steps.opponentHud',
            highlightTarget: 'mw-opponent-hud',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'stage',
            content: 'game-mage-wars:tutorial.steps.stage',
            highlightTarget: 'mw-stage',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'channel-result',
            content: 'game-mage-wars:tutorial.steps.channelResult',
            highlightTarget: 'mw-self-hud',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'plan-wolf',
            content: 'game-mage-wars:tutorial.steps.planWolf',
            highlightTarget: 'mw-spellbook',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.PLAN_SPELLS],
            allowedTargets: [
                'mw-spellbook-category-creature',
                'mw-spellbook-next-page',
                `mw-spellbook-card-${JUNGLE_WOLF_CARD_ID}`,
                'mw-spellbook-category-incantation',
                'mw-spellbook-next-page',
                `mw-spellbook-card-${ROUSE_THE_BEAST_CARD_ID}`,
                'mw-plan-spells',
            ],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.SPELLS_PLANNED, match: { playerId: '0' } }],
        },
        {
            id: 'prepare-opponent-spells',
            content: 'game-mage-wars:tutorial.steps.prepareOpponentSpells',
            allowedCommands: [MAGE_WARS_COMMANDS.PLAN_SPELLS],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.PLAN_SPELLS,
                playerId: '1',
                payload: { spellCardIds: [ASYRAN_CLERIC_CARD_ID, PILLAR_OF_LIGHT_CARD_ID] },
            }],
        },
        {
            id: 'prepared-and-hidden',
            content: 'game-mage-wars:tutorial.steps.preparedAndHidden',
            highlightTarget: 'mw-opponent-prepared',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'deploy-wolf',
            content: 'game-mage-wars:tutorial.steps.deployWolf',
            highlightTarget: `mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [`mw-prepared-card-${JUNGLE_WOLF_CARD_ID}`, 'mw-zone-a3'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED }],
        },
        {
            id: 'rouse-wolf',
            content: 'game-mage-wars:tutorial.steps.rouseWolf',
            highlightTarget: `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [
                `mw-prepared-card-${ROUSE_THE_BEAST_CARD_ID}`,
                `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_ROUSED,
                match: { ownerId: '0' },
            }],
        },
        {
            id: 'pass-your-deployment',
            content: 'game-mage-wars:tutorial.steps.passYourDeployment',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            // 对手尚未完成部署时，这一步代表玩家结束自己的部署决策；
            // 该点击仍是正式流程的一部分，不是系统结算。
            aiActions: [advancePhase('0')],
        },
        {
            id: 'opponent-deploy',
            content: 'game-mage-wars:tutorial.steps.opponentDeploy',
            highlightTarget: 'mw-zone-d1',
            position: 'left',
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '1',
                payload: {
                    spellCardId: ASYRAN_CLERIC_CARD_ID,
                    manaCost: 5,
                    targetZoneId: 'd1',
                },
            }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'opponent-attack-spell',
            content: 'game-mage-wars:tutorial.steps.opponentAttackSpell',
            highlightTarget: `mw-field-object-${ASYRAN_CLERIC_CARD_ID}`,
            position: 'left',
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            aiActions: [{
                commandType: MAGE_WARS_COMMANDS.CAST_SPELL,
                playerId: '1',
                payload: {
                    spellCardId: PILLAR_OF_LIGHT_CARD_ID,
                    manaCost: 5,
                    targetObjectId: PLAYER_ONE_CLERIC_OBJECT_ID,
                },
            }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'discard-reading',
            content: 'game-mage-wars:tutorial.steps.discardReading',
            highlightTarget: 'mw-discard',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'skip-to-creature-action',
            content: 'game-mage-wars:tutorial.steps.skipToCreatureAction',
            position: 'center',
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            // 这里是对手完成部署/先手窗口后的真实对手行为；玩家自己的
            // deployment 已在上一段完成，不把系统结算伪装成玩家点击。
            aiActions: [
                advancePhase('1'),
                advancePhase('0'),
                advancePhase('1'),
            ],
        },
        {
            id: 'move-wolf',
            content: 'game-mage-wars:tutorial.steps.moveWolf',
            highlightTarget: `mw-field-object-${JUNGLE_WOLF_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT],
            allowedTargets: [`mw-field-object-${JUNGLE_WOLF_CARD_ID}`, 'mw-zone-a2', 'mw-zone-b3'],
            advanceOnEvents: [{ type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED, match: { ownerId: '0' } }],
        },
        {
            id: 'finish',
            content: 'game-mage-wars:tutorial.steps.finish',
            highlightTarget: 'mw-board',
            position: 'center',
            infoStep: true,
        },
    ],
};

export const MageWarsWallAndLineOfSightTutorial: TutorialManifest = {
    id: 'mage-wars-wall-and-line-of-sight',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'setup-wall-position',
            content: 'game-mage-wars:tutorial.wallAndLineOfSight.steps.setup',
            position: 'center',
            showMask: true,
            skipAutomaticFlow: true,
            aiActions: [
                ...SETUP_TO_DEPLOYMENT_ACTIONS,
                mergeState(createWallSetupPatch()),
            ],
        },
        {
            id: 'wall-purpose',
            content: 'game-mage-wars:tutorial.wallAndLineOfSight.steps.wallPurpose',
            highlightTarget: `mw-prepared-card-${THORNS_WALL_CARD_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'cast-thorns-wall',
            content: 'game-mage-wars:tutorial.wallAndLineOfSight.steps.castThornsWall',
            highlightTarget: `mw-prepared-card-${THORNS_WALL_CARD_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.CAST_SPELL],
            allowedTargets: [
                `mw-prepared-card-${THORNS_WALL_CARD_ID}`,
                `mw-wall-edge-${WALL_EDGE_A3_B3}`,
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.WALL_SUMMONED,
            }],
        },
        {
            id: 'wall-card-on-edge',
            content: 'game-mage-wars:tutorial.wallAndLineOfSight.steps.wallCardOnEdge',
            highlightTarget: `mw-wall-card-${THORNS_WALL_CARD_ID}`,
            position: 'left',
            infoStep: true,
        },
        {
            id: 'line-of-sight-and-passage',
            content: 'game-mage-wars:tutorial.wallAndLineOfSight.steps.lineOfSightAndPassage',
            highlightTarget: `mw-wall-edge-${WALL_EDGE_A3_B3}`,
            position: 'left',
            infoStep: true,
        },
    ],
};

export const MageWarsGuardTutorial: TutorialManifest = {
    id: 'mage-wars-guard',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'setup-guard-board',
            content: 'game-mage-wars:tutorial.guard.steps.setup',
            position: 'center',
            showMask: true,
            skipAutomaticFlow: true,
            aiActions: [
                ...SETUP_TO_CREATURE_ACTION_ACTIONS,
                mergeState(createPriestessMechanicsPatch()),
            ],
        },
        {
            id: 'guard-rule',
            content: 'game-mage-wars:tutorial.guard.steps.guardRule',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'guard-cleric',
            content: 'game-mage-wars:tutorial.guard.steps.guardCleric',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.GUARD],
            allowedTargets: [
                `mw-arena-object-${MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID}`,
                'mw-selected-unit-guard',
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.GUARD_GAINED,
                match: { targetObjectId: MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID },
            }],
        },
        {
            id: 'guard-token-result',
            content: 'game-mage-wars:tutorial.guard.steps.guardTokenResult',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_GUARD_CLERIC_OBJECT_ID}`,
            position: 'top',
            infoStep: true,
        },
    ],
};

export const MageWarsHealingTutorial: TutorialManifest = {
    id: 'mage-wars-healing',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'setup-healing-board',
            content: 'game-mage-wars:tutorial.healing.steps.setup',
            position: 'center',
            showMask: true,
            skipAutomaticFlow: true,
            aiActions: [
                ...SETUP_TO_CREATURE_ACTION_ACTIONS,
                mergeState(createPriestessMechanicsPatch()),
            ],
        },
        {
            id: 'healing-rule',
            content: 'game-mage-wars:tutorial.healing.steps.healingRule',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'heal-wounded-bobcat',
            content: 'game-mage-wars:tutorial.healing.steps.healWoundedBobcat',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID}`,
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY],
            allowedTargets: [
                `mw-arena-object-${MAGE_WARS_TUTORIAL_HEALING_CLERIC_OBJECT_ID}`,
                'mw-ability-healing-light',
                `mw-arena-object-${MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID}`,
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
                match: {
                    sourceAbilityId: MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT,
                    targetObjectId: MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID,
                },
            }],
        },
        {
            id: 'healing-result-and-life-readout',
            content: 'game-mage-wars:tutorial.healing.steps.healingResultAndLifeReadout',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_WOUNDED_BOBCAT_OBJECT_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'life-toggle',
            content: 'game-mage-wars:tutorial.healing.steps.lifeToggle',
            highlightTarget: 'mw-life-toggle',
            position: 'left',
            infoStep: true,
        },
    ],
};

export const MageWarsRestoreAndBurnTutorial: TutorialManifest = {
    id: 'mage-wars-restore-and-burn',
    numPlayers: 2,
    allowManualSkip: true,
    randomPolicy: {
        mode: 'fixed',
        values: [3],
    },
    steps: [
        {
            id: 'setup-restore-board',
            content: 'game-mage-wars:tutorial.restoreAndBurn.steps.setup',
            position: 'center',
            showMask: true,
            skipAutomaticFlow: true,
            aiActions: [
                ...SETUP_TO_CREATURE_ACTION_ACTIONS,
                mergeState(createPriestessMechanicsPatch()),
            ],
        },
        {
            id: 'burn-rule',
            content: 'game-mage-wars:tutorial.restoreAndBurn.steps.burnRule',
            highlightTarget: `mw-arena-object-${MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID}`,
            position: 'top',
            infoStep: true,
        },
        {
            id: 'restore-burning-cleric',
            content: 'game-mage-wars:tutorial.restoreAndBurn.steps.restoreBurningCleric',
            highlightTarget: 'mw-mage-entity-0',
            position: 'top',
            requireAction: true,
            allowedCommands: [MAGE_WARS_COMMANDS.USE_MAGE_ABILITY],
            allowedTargets: [
                'mw-mage-entity-0',
                'mw-ability-restore',
                `mw-arena-object-${MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID}`,
            ],
            advanceOnEvents: [{
                type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED,
                match: {
                    targetObjectId: MAGE_WARS_TUTORIAL_BURNING_CLERIC_OBJECT_ID,
                    statusTokenId: STATUS_TOKEN_IDS.BURN,
                },
            }],
        },
        {
            id: 'restore-result',
            content: 'game-mage-wars:tutorial.restoreAndBurn.steps.restoreResult',
            highlightTarget: 'mw-board',
            position: 'center',
            infoStep: true,
        },
    ],
};

export const MageWarsTutorialCatalog: TutorialCollection = {
    defaultTutorialId: MageWarsTutorial.id,
    tutorials: {
        [MageWarsTutorial.id]: {
            titleKey: 'tutorial.chapters.basic.title',
            descriptionKey: 'tutorial.chapters.basic.description',
            nextTutorialId: MageWarsWallAndLineOfSightTutorial.id,
            manifest: MageWarsTutorial,
        },
        [MageWarsWallAndLineOfSightTutorial.id]: {
            titleKey: 'tutorial.chapters.wallAndLineOfSight.title',
            descriptionKey: 'tutorial.chapters.wallAndLineOfSight.description',
            nextTutorialId: MageWarsGuardTutorial.id,
            manifest: MageWarsWallAndLineOfSightTutorial,
        },
        [MageWarsGuardTutorial.id]: {
            titleKey: 'tutorial.chapters.guard.title',
            descriptionKey: 'tutorial.chapters.guard.description',
            nextTutorialId: MageWarsHealingTutorial.id,
            manifest: MageWarsGuardTutorial,
        },
        [MageWarsHealingTutorial.id]: {
            titleKey: 'tutorial.chapters.healing.title',
            descriptionKey: 'tutorial.chapters.healing.description',
            nextTutorialId: MageWarsRestoreAndBurnTutorial.id,
            manifest: MageWarsHealingTutorial,
        },
        [MageWarsRestoreAndBurnTutorial.id]: {
            titleKey: 'tutorial.chapters.restoreAndBurn.title',
            descriptionKey: 'tutorial.chapters.restoreAndBurn.description',
            manifest: MageWarsRestoreAndBurnTutorial,
        },
    },
};

export default MageWarsTutorialCatalog;
