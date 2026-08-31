import {
    createAiLegalActionId,
    type AiDecisionContext,
    type AiLegalAction,
    type GameAiRuntime,
    type LocalAiPolicy,
} from '../../engine/ai';
import type { Command, MatchState, PlayerId } from '../../engine/types';
import { BETRAYAL_COMMANDS } from './commands';
import {
    BETRAYAL_EXPLORER_CATALOG,
    isBetrayalOptionalHauntRollRuntimeSupported,
    type BetrayalScenarioCardId,
    type BetrayalScenarioId,
    type BetrayalTraitKey,
    type BetrayalUseEffectSeed as UseEffectProfile,
} from './scenarioConfig';
import {
    resolveInventoryEffectId,
    resolveUseEffect,
} from './possessionEffects';
import { BETRAYAL_AI_MINIMUM_VISIBLE_STEP_DELAY_MS } from './visualTiming';

interface BetrayalAiInventoryCard {
    id: string;
    name: string;
    kind: 'item' | 'omen';
}

interface BetrayalAiExplorer {
    playerId: string;
    explorerId: string;
    displayName: string;
    roomId: string;
    traits: Record<BetrayalTraitKey, number>;
    inventory: BetrayalAiInventoryCard[];
}

interface BetrayalAiMonster {
    id: string;
    name: string;
    roomId: string;
    speed?: number;
}

interface BetrayalAiMagicCameraRuntime {
    cameraDestroyed: boolean;
    cameraHolderPlayerId: string | null;
    heroEssencePlayerIds: string[];
    capturedEssencePlayerIds: string[];
    phantomPhotographerIds: string[];
    killedPhantomPhotographerIds: string[];
    stunnedPhantomPhotographerIds: string[];
}

interface BetrayalAiDustRuntime {
    permanentTraitorPlayerIds: string[];
    researchRoomIds: string[];
    exchangedSicknessThisTurnPlayerIds: string[];
    feverishPlayerIds: string[];
    pendingSicknessExchange?: {
        requesterPlayerId: string;
        targetPlayerId: string;
    };
}

interface BetrayalAiHelpingHandsRuntime {
    trollHandIds: string[];
    activeMonsterTurn: boolean;
    monsterTurnControllerPlayerId: string | null;
    trollHandMoveRemainingById: Record<string, number>;
    trollHandAttackUsedIdsThisTurn: string[];
}

interface BetrayalAiMummyRuntime {
    mummyMonsterId: string;
    sarcophagusRoomId: string;
    girlRoomId: string | null;
    girlHolderPlayerId: string | null;
    girlHeldByMummy: boolean;
    mummyCarriedOmenIds: string[];
    mummyCarriedCards: BetrayalAiInventoryCard[];
    pendingAttackReward?: {
        controllerPlayerId: string;
        defenderPlayerId: string;
        stealableCardIds: string[];
    };
    knowledgeTokenCount: number;
    trueNameFound: boolean;
    banishmentSpellLearned: boolean;
    requiredOmenIds: string[];
}

interface BetrayalAiRecentRoll {
    kind: 'eventTraitCheck' | 'eventDiceRoll' | 'eventRolledDamage' | 'hauntRoll' | 'mysticElevator' | 'attackRoll' | 'roomEndTurnTraitCheck' | 'deathPrevention' | 'hauntActionTraitCheck' | 'monsterMoveRoll';
    playerId: string;
    dice: number[];
    passiveBonus: number;
    branchThresholds?: { min: number; label: string }[];
    latestLabel: string;
    attack?: {
        target: 'traitor' | 'hero' | 'jack-spirit';
        defenderRoll: number;
    };
    deathPrevention?: {
        minTotal: number;
    };
    roomEndTurn?: {
        nextPlayerId?: string;
    };
    consumedRabbitFootCardIds: string[];
}

interface BetrayalAiPendingDamageAllocation {
    playerId: string;
    damageKind: 'physical' | 'mental' | 'general';
    amount: number;
    allowedTraits: BetrayalTraitKey[];
    damageReplacement?: unknown;
    forcedTraitSequence?: BetrayalTraitKey[];
}

interface BetrayalAiRoom {
    id: string;
    name: string;
    floor: 'ground' | 'upper' | 'basement';
    x: number;
    y: number;
    connectedRoomIds: string[];
    state: 'discovered' | 'unexplored';
    discoveryReward: 'event' | 'item' | 'omen' | null;
}

interface BetrayalAiCore {
    phase: 'characterSelect' | 'preHaunt' | 'haunt' | 'endgame';
    scenarioId: BetrayalScenarioId;
    proposedScenarioCardId: BetrayalScenarioCardId;
    scenarioCardConfirmations: Record<string, BetrayalScenarioCardId>;
    playerIds: string[];
    selectedExplorerByPlayerId: Record<string, string>;
    readyPlayerIds: string[];
    currentPlayer: string;
    currentExplorer: BetrayalAiExplorer;
    otherExplorers: BetrayalAiExplorer[];
    monsters: BetrayalAiMonster[];
    rooms: BetrayalAiRoom[];
    usedCardIdsThisTurn: string[];
    turnStartInventoryCardIds: string[];
    receivedCardIdsThisTurnByPlayerId: Record<string, string[]>;
    nextNonCombatTraitReplacement: {
        playerId: string;
        sourceCardId: string;
        replacementTrait: BetrayalTraitKey;
    } | null;
    recentRoll: BetrayalAiRecentRoll | null;
    pendingEventRollStart?: {
        playerId: string;
        sourceTitle: string;
    } | null;
    pendingEventChoice: {
        playerId: string;
        sourceTitle: string;
        effect: UseEffectProfile;
    } | null;
    pendingTradeAgreement: {
        playerId: string;
        targetPlayerId: string;
        cardIds: string[];
    } | null;
    pendingDamageAllocation: BetrayalAiPendingDamageAllocation | null;
    pendingCardResolutionQueue?: Array<{
        id: string;
        playerId: string;
        requiredPlayerIds?: string[];
        acknowledgedPlayerIds?: string[];
        cardName: string;
        text: string;
    }>;
    scenarioRuntime: {
        traitorPlayerId: string | null;
        hauntCardNumber?: number;
        deadExplorerPlayerIds: string[];
        jackSpiritReleased: boolean;
        jackSpiritRoomId: string | null;
        exorcismCircleRoomIds: string[];
        knowledgeOfJackPlayerIds: string[];
        dust?: BetrayalAiDustRuntime;
        magicCamera?: BetrayalAiMagicCameraRuntime;
        helpingHands?: BetrayalAiHelpingHandsRuntime;
        mummy?: BetrayalAiMummyRuntime;
    };
    endgameResult: unknown | null;
}

type BetrayalState = MatchState<BetrayalAiCore>;
interface EventChoicePayload {
    accept?: boolean;
    trait?: BetrayalTraitKey;
    traits?: BetrayalTraitKey[];
    targetRoomId?: string;
}

type BetrayalAiValidator = (
    state: MatchState<unknown>,
    command: Command,
) => { valid: boolean };

const ACTION_KINDS = {
    SELECT_EXPLORER: 'select-explorer',
    CONFIRM_EXPLORER: 'confirm-explorer',
    CONFIRM_SCENARIO_CARD: 'confirm-scenario-card',
    START_SCENARIO: 'start-scenario',
    RESOLVE_EVENT_CHOICE: 'resolve-event-choice',
    MOVE_TO_ROOM: 'move-to-room',
    EXPLORE_ROOM: 'explore-room',
    HERO_ATTACK_TRAITOR: 'hero-attack-traitor',
    TRAITOR_ATTACK_HERO: 'traitor-attack-hero',
    ATTACK_PHANTOM_PHOTOGRAPHER: 'attack-phantom-photographer',
    TAKE_PHOTO: 'take-photo',
    SMASH_MAGIC_CAMERA: 'smash-magic-camera',
    PHANTOM_PHOTOGRAPHER_ATTACK: 'phantom-photographer-attack',
    SEARCH_FOR_CURE: 'search-for-cure',
    CURE_THE_DUST: 'cure-the-dust',
    REQUEST_SICKNESS_EXCHANGE: 'request-sickness-exchange',
    RESOLVE_SICKNESS_EXCHANGE: 'resolve-sickness-exchange',
    LEARN_ABOUT_JACK: 'learn-about-jack',
    STUDY_EXORCISM: 'study-exorcism',
    EXORCISE_JACK: 'exorcise-jack',
    USE_POSSESSION: 'use-possession',
    TRADE_POSSESSION: 'trade-possession',
    RESOLVE_TRADE_AGREEMENT: 'resolve-trade-agreement',
    LOOT_CORPSE: 'loot-corpse',
    USE_RABBIT_FOOT: 'use-rabbit-foot',
    USE_ROOM_EFFECT: 'use-room-effect',
    ROLL_EVENT: 'roll-event',
    FINALIZE_EVENT_ROLL: 'finalize-event-roll',
    ACKNOWLEDGE_EVENT_ROLL: 'acknowledge-event-roll',
    ACKNOWLEDGE_CARD_RESOLUTION: 'acknowledge-card-resolution',
    END_TURN: 'end-turn',
    ACKNOWLEDGE_TURN_END_ROLL: 'acknowledge-turn-end-roll',
    RESOLVE_DAMAGE_ALLOCATION: 'resolve-damage-allocation',
    MOVE_TROLL_HAND: 'move-troll-hand',
    TROLL_HAND_ATTACK: 'troll-hand-attack',
    END_TROLL_HAND_MONSTER_TURN: 'end-troll-hand-monster-turn',
    STUDY_MUMMY_NAME: 'study-mummy-name',
    LEARN_MUMMY_BANISHMENT: 'learn-mummy-banishment',
    BANISH_MUMMY: 'banish-mummy',
    PICK_UP_MUMMY_GIRL: 'pick-up-mummy-girl',
    GIVE_GIRL_TO_MUMMY: 'give-girl-to-mummy',
    GIVE_OMEN_TO_MUMMY: 'give-omen-to-mummy',
    RESOLVE_MUMMY_ATTACK_REWARD: 'resolve-mummy-attack-reward',
    RESOLVE_MONSTER_TURN_START: 'resolve-monster-turn-start',
    ROLL_MONSTER_MOVEMENT_GROUP: 'roll-monster-movement-group',
    MOVE_MONSTER_TO_ROOM: 'move-monster-to-room',
    MONSTER_ATTACK_HERO: 'monster-attack-hero',
    ACKNOWLEDGE_RECENT_ROLL: 'acknowledge-recent-roll',
} as const;

const MUMMY_WEDDING_OMEN_EFFECT_IDS = new Set(['holy-symbol', 'ring']);

const BETRAYAL_AI_TRAITS: BetrayalTraitKey[] = ['might', 'speed', 'knowledge', 'sanity'];

function createValidatedAction(args: {
    validate: BetrayalAiValidator;
    state: BetrayalState;
    playerId: PlayerId;
    type: string;
    payload: unknown;
    kind: string;
    label: string;
    idParts?: Array<string | number | undefined | null>;
    metadata?: Record<string, unknown>;
}): AiLegalAction | null {
    const command = {
        type: args.type,
        playerId: args.playerId,
        payload: args.payload,
        timestamp: 0,
    };
    if (!args.validate(args.state as MatchState<unknown>, command).valid) {
        return null;
    }
    return {
        actionId: createAiLegalActionId(args.kind, ...(args.idParts ?? [])),
        kind: args.kind,
        label: args.label,
        commands: [{
            type: args.type,
            payload: args.payload,
        }],
        metadata: args.metadata,
    };
}

function uniquePayloads(payloads: EventChoicePayload[]): EventChoicePayload[] {
    const seen = new Set<string>();
    return payloads.filter((payload) => {
        const key = JSON.stringify(payload);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildTraitSelections(
    allowedTraits: BetrayalTraitKey[],
    count: number,
): BetrayalTraitKey[][] {
    if (count <= 0) return [[]];
    const selections: BetrayalTraitKey[][] = [];
    const visit = (current: BetrayalTraitKey[]) => {
        if (current.length === count) {
            selections.push(current);
            return;
        }
        for (const trait of allowedTraits) {
            visit([...current, trait]);
        }
    };
    visit([]);
    return selections;
}

function expandEffectPayloads(
    core: BetrayalCore,
    effect: UseEffectProfile,
    seeds: EventChoicePayload[],
): EventChoicePayload[] {
    switch (effect.mode) {
        case 'chosenTrait':
        case 'healChosenTrait':
            if (effect.chosenTrait) return seeds;
            return seeds.flatMap((payload) => (
                effect.allowedTraits.map((trait) => ({ ...payload, trait }))
            ));
        case 'generalDamageChoice':
            if (effect.selectedTraits) return seeds;
            return seeds.flatMap((payload) => (
                buildTraitSelections(effect.allowedTraits, effect.amount)
                    .map((traits) => ({ ...payload, traits }))
            ));
        case 'placeExplorerInDiscoveredRoomByFloor':
        case 'placeExplorerInAdjacentRoom':
        case 'placeSecretPassageToken': {
            const discoveredRoomIds = core.rooms
                .filter((room) => room.state === 'discovered')
                .map((room) => room.id);
            return seeds.flatMap((payload) => (
                discoveredRoomIds.map((targetRoomId) => ({ ...payload, targetRoomId }))
            ));
        }
        case 'compound':
            return effect.effects.reduce(
                (payloads, nestedEffect) => expandEffectPayloads(core, nestedEffect, payloads),
                seeds,
            );
        case 'chooseTraitRoll':
            return seeds.flatMap((payload) => effect.allowedTraits.flatMap((trait) => {
                const traitPayload = { ...payload, trait };
                return uniquePayloads([
                    traitPayload,
                    ...effect.branches.flatMap((branch) => (
                        expandEffectPayloads(core, branch.effect, [traitPayload])
                    )),
                ]);
            }));
        case 'allTraitChecks':
            return expandEffectPayloads(core, effect.allPassEffect, seeds);
        case 'optionalEventRoll': {
            const accepted = seeds.flatMap((payload) => {
                const acceptedPayload = { ...payload, accept: true };
                return uniquePayloads([
                    acceptedPayload,
                    ...effect.roll.branches.flatMap((branch) => (
                        expandEffectPayloads(core, branch.effect, [acceptedPayload])
                    )),
                ]);
            });
            const declined = seeds.map((payload) => ({ ...payload, accept: false }));
            return [...accepted, ...declined];
        }
        case 'optionalHauntRoll': {
            const accepted = isBetrayalOptionalHauntRollRuntimeSupported(effect.successHauntId)
                ? seeds.map((payload) => ({ ...payload, accept: true }))
                : [];
            const declined = seeds.flatMap((payload) => (
                expandEffectPayloads(core, effect.skippedOrStartedEffect, [{
                    ...payload,
                    accept: false,
                }])
            ));
            return [...accepted, ...declined];
        }
        default:
            return seeds;
    }
}

function buildEventChoiceActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingEventChoice;
    if (!pending || pending.playerId !== playerId) return [];

    return uniquePayloads(expandEffectPayloads(state.core, pending.effect, [{}]))
        .map((payload, index) => createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            payload,
            kind: ACTION_KINDS.RESOLVE_EVENT_CHOICE,
            label: payload.accept === false
                ? `放弃：${pending.sourceTitle}`
                : `处理：${pending.sourceTitle}`,
            idParts: [index, payload.accept === false ? 'decline' : 'accept', payload.trait, payload.targetRoomId],
            metadata: {
                eventMode: pending.effect.mode,
                accept: payload.accept,
                trait: payload.trait,
                traits: payload.traits,
                targetRoomId: payload.targetRoomId,
                visibleStepDelayPolicy: 'hidden',
            },
        }))
        .filter((action): action is AiLegalAction => Boolean(action));
}

function buildCharacterSelectActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const selectedExplorerId = core.selectedExplorerByPlayerId[playerId];
    const isReady = core.readyPlayerIds.includes(playerId);

    if (!selectedExplorerId) {
        const taken = new Set(Object.values(core.selectedExplorerByPlayerId));
        return BETRAYAL_EXPLORER_CATALOG
            .filter((explorer) => !taken.has(explorer.explorerId))
            .map((explorer) => createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.SELECT_EXPLORER,
                payload: { explorerId: explorer.explorerId },
                kind: ACTION_KINDS.SELECT_EXPLORER,
                label: `选择${explorer.displayName}`,
                idParts: [explorer.explorerId],
                metadata: {
                    explorerId: explorer.explorerId,
                    visibleStepDelayPolicy: 'visible',
                },
            }))
            .filter((action): action is AiLegalAction => Boolean(action));
    }

    if (!isReady) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.CONFIRM_EXPLORER,
            payload: {},
            kind: ACTION_KINDS.CONFIRM_EXPLORER,
            label: '确认探索者',
            metadata: { visibleStepDelayPolicy: 'hidden' },
        });
        return action ? [action] : [];
    }

    if (core.scenarioCardConfirmations[playerId] !== core.proposedScenarioCardId) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.CONFIRM_SCENARIO_CARD,
            payload: {},
            kind: ACTION_KINDS.CONFIRM_SCENARIO_CARD,
            label: '确认剧本卡',
            metadata: { visibleStepDelayPolicy: 'hidden' },
        });
        return action ? [action] : [];
    }

    if (core.readyPlayerIds.length === core.playerIds.length) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.START_SCENARIO,
            payload: {},
            kind: ACTION_KINDS.START_SCENARIO,
            label: '开始剧本',
            metadata: { visibleStepDelayPolicy: 'hidden' },
        });
        return action ? [action] : [];
    }

    return [];
}

function getAllExplorers(core: BetrayalAiCore): BetrayalAiExplorer[] {
    return [core.currentExplorer, ...core.otherExplorers];
}

function findExplorer(core: BetrayalAiCore, playerId: PlayerId): BetrayalAiExplorer | null {
    return getAllExplorers(core).find((explorer) => explorer.playerId === playerId) ?? null;
}

function isMagicCameraHaunt(core: BetrayalAiCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 33
        && Boolean(core.scenarioRuntime.magicCamera);
}

function isDustHaunt(core: BetrayalAiCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 3
        && Boolean(core.scenarioRuntime.dust);
}

function isMummyHaunt(core: BetrayalAiCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 1
        && Boolean(core.scenarioRuntime.mummy);
}

function isHelpingHandsMonsterTurn(core: BetrayalAiCore, playerId: PlayerId): boolean {
    const helpingHands = core.scenarioRuntime.helpingHands;
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 12
        && Boolean(helpingHands?.activeMonsterTurn)
        && helpingHands?.monsterTurnControllerPlayerId === playerId;
}

function resolveLowestTrait(explorer: BetrayalAiExplorer): BetrayalTraitKey {
    return BETRAYAL_AI_TRAITS.reduce((lowest, trait) => (
        explorer.traits[trait] < explorer.traits[lowest] ? trait : lowest
    ), 'might');
}

function hasOmenBook(explorer: BetrayalAiExplorer | null | undefined): boolean {
    return Boolean(explorer?.inventory.some((card) => (
        card.kind === 'omen'
        && (
            resolveInventoryEffectId(card.id) === 'omen-book'
            || card.name === '书本'
            || card.name.toLowerCase() === 'book'
        )
    )));
}

function isMummyWeddingOmen(card: BetrayalAiInventoryCard | null | undefined): boolean {
    return Boolean(card && card.kind === 'omen' && MUMMY_WEDDING_OMEN_EFFECT_IDS.has(resolveInventoryEffectId(card.id)));
}

function findMummyMonster(core: BetrayalAiCore): BetrayalAiMonster | null {
    const mummyId = core.scenarioRuntime.mummy?.mummyMonsterId ?? 'mummy';
    return core.monsters.find((monster) => monster.id === mummyId || monster.id === 'mummy' || monster.name === '木乃伊') ?? null;
}

function getLivingHeroes(core: BetrayalAiCore): BetrayalAiExplorer[] {
    return getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
}

function resolveMummyMovementGroupId(monster: BetrayalAiMonster): string {
    return `${monster.name}:${monster.speed ?? 3}`;
}

function isMummyNameStudyCandidateRoom(core: BetrayalAiCore, room: BetrayalAiRoom): boolean {
    const mummy = core.scenarioRuntime.mummy;
    return room.id === mummy?.sarcophagusRoomId
        || room.name === '书房'
        || room.name === '图书馆'
        || room.id === 'upper-west';
}

function buildDustSicknessExchangeActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.scenarioRuntime.dust?.pendingSicknessExchange;
    if (!pending || pending.targetPlayerId !== playerId) return [];

    const requester = findExplorer(state.core, pending.requesterPlayerId);
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE,
        payload: { accept: true },
        kind: ACTION_KINDS.RESOLVE_SICKNESS_EXCHANGE,
        label: `同意${requester?.displayName ?? '请求者'}交换疾病标记`,
        idParts: [pending.requesterPlayerId, pending.targetPlayerId],
        metadata: {
            requesterPlayerId: pending.requesterPlayerId,
            targetPlayerId: pending.targetPlayerId,
            accept: true,
            strategicScore: 1280,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildDustHauntActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isDead: boolean,
): AiLegalAction[] {
    const core = state.core;
    const dust = core.scenarioRuntime.dust;
    const actor = findExplorer(core, playerId);
    if (!isDustHaunt(core) || !dust || !actor || isDead) return [];

    const actions: AiLegalAction[] = [];
    for (const trait of ['knowledge', 'sanity'] as const) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.SEARCH_FOR_CURE,
            payload: { trait },
            kind: ACTION_KINDS.SEARCH_FOR_CURE,
            label: `寻找解药（${trait === 'knowledge' ? '知识' : '神志'}）`,
            idParts: [trait],
            metadata: {
                trait,
                strategicScore: 1240 + actor.traits[trait] * 8,
                visibleStepDelayPolicy: 'visible',
            },
        });
        if (action) actions.push(action);
    }

    for (const trait of BETRAYAL_AI_TRAITS) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.CURE_THE_DUST,
            payload: { trait },
            kind: ACTION_KINDS.CURE_THE_DUST,
            label: `尝试治愈灰尘（${trait}）`,
            idParts: [trait],
            metadata: {
                trait,
                strategicScore: 1360 + actor.traits[trait] * 8 + dust.researchRoomIds.length * 20,
                visibleStepDelayPolicy: 'visible',
            },
        });
        if (action) actions.push(action);
    }

    for (const target of getAllExplorers(core)) {
        if (
            target.playerId === playerId
            || target.roomId !== actor.roomId
            || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)
        ) {
            continue;
        }
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE,
            payload: { targetPlayerId: target.playerId },
            kind: ACTION_KINDS.REQUEST_SICKNESS_EXCHANGE,
            label: `请求与${target.displayName}交换疾病标记`,
            idParts: [target.playerId],
            metadata: {
                targetPlayerId: target.playerId,
                strategicScore: 1160,
                visibleStepDelayPolicy: 'visible',
            },
        });
        if (action) actions.push(action);
    }

    return actions;
}

function buildMagicCameraHauntActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isTraitor: boolean,
    isDead: boolean,
): AiLegalAction[] {
    const core = state.core;
    const magicCamera = core.scenarioRuntime.magicCamera;
    const actor = findExplorer(core, playerId);
    if (!isMagicCameraHaunt(core) || !magicCamera || !actor || isDead) return [];

    const livingHeroes = getAllExplorers(core).filter((explorer) => (
        explorer.playerId !== playerId
        && explorer.playerId !== core.scenarioRuntime.traitorPlayerId
        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const actions: AiLegalAction[] = [];

    if (isTraitor) {
        const preferredTrait = resolveLowestTrait(actor);
        for (const hero of livingHeroes) {
            if (!magicCamera.heroEssencePlayerIds.includes(hero.playerId)) continue;
            for (const trait of BETRAYAL_AI_TRAITS) {
                const traitDeficitScore = Math.max(0, 8 - actor.traits[trait]) * 8;
                const action = createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.TAKE_PHOTO,
                    payload: { targetPlayerId: hero.playerId, trait },
                    kind: ACTION_KINDS.TAKE_PHOTO,
                    label: `拍摄${hero.displayName}`,
                    idParts: [hero.playerId, trait],
                    metadata: {
                        targetPlayerId: hero.playerId,
                        trait,
                        strategicScore: 1320 + traitDeficitScore + (trait === preferredTrait ? 20 : 0),
                        visibleStepDelayPolicy: 'visible',
                    },
                });
                if (action) actions.push(action);
            }
        }

        const photographers = core.monsters.filter((monster) => (
            magicCamera.phantomPhotographerIds.includes(monster.id)
            && !magicCamera.killedPhantomPhotographerIds.includes(monster.id)
            && !magicCamera.stunnedPhantomPhotographerIds.includes(monster.id)
        ));
        for (const monster of photographers) {
            for (const hero of livingHeroes) {
                const action = createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
                    payload: { monsterId: monster.id, targetPlayerId: hero.playerId },
                    kind: ACTION_KINDS.PHANTOM_PHOTOGRAPHER_ATTACK,
                    label: `让幻影摄影师攻击${hero.displayName}`,
                    idParts: [monster.id, hero.playerId],
                    metadata: {
                        monsterId: monster.id,
                        targetPlayerId: hero.playerId,
                        strategicScore: 1180 + Math.max(0, 7 - hero.traits.sanity) * 10,
                        visibleStepDelayPolicy: 'visible',
                    },
                });
                if (action) actions.push(action);
            }
        }
        return actions;
    }

    const smashCamera = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
        payload: {},
        kind: ACTION_KINDS.SMASH_MAGIC_CAMERA,
        label: '砸毁魔法相机',
        metadata: {
            strategicScore: 1340,
            visibleStepDelayPolicy: 'visible',
        },
    });
    if (smashCamera) actions.push(smashCamera);

    for (const monster of core.monsters) {
        if (
            !magicCamera.phantomPhotographerIds.includes(monster.id)
            || magicCamera.killedPhantomPhotographerIds.includes(monster.id)
        ) {
            continue;
        }
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
            payload: { target: 'phantom-photographer', targetMonsterId: monster.id },
            kind: ACTION_KINDS.ATTACK_PHANTOM_PHOTOGRAPHER,
            label: `攻击幻影摄影师`,
            idParts: [monster.id],
            metadata: {
                monsterId: monster.id,
                strategicScore: 1260,
                visibleStepDelayPolicy: 'visible',
            },
        });
        if (action) actions.push(action);
    }

    return actions;
}

function buildMummyAttackRewardActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.scenarioRuntime.mummy?.pendingAttackReward;
    if (!pending || pending.controllerPlayerId !== playerId) return [];

    const actions: AiLegalAction[] = [];
    const defender = findExplorer(state.core, pending.defenderPlayerId);
    const defenderCards = new Map(defender?.inventory.map((card) => [card.id, card]) ?? []);
    const preferredStealCardIds = pending.stealableCardIds
        .filter((cardId) => (
            cardId === 'mummy-girl-token'
            || MUMMY_WEDDING_OMEN_EFFECT_IDS.has(resolveInventoryEffectId(cardId))
            || defenderCards.get(cardId)?.kind === 'omen'
        ));
    for (const cardId of Array.from(new Set([...preferredStealCardIds, ...pending.stealableCardIds]))) {
        const card = cardId === 'mummy-girl-token'
            ? { id: cardId, name: '女孩', kind: 'omen' as const }
            : defenderCards.get(cardId);
        if (!card) continue;
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD,
            payload: { choice: 'steal', cardId },
            kind: ACTION_KINDS.RESOLVE_MUMMY_ATTACK_REWARD,
            label: `木乃伊夺取${card.name}`,
            idParts: ['steal', cardId],
            metadata: {
                cardId,
                choice: 'steal',
                strategicScore: cardId === 'mummy-girl-token' || isMummyWeddingOmen(card) ? 1500 : 1320,
                visibleStepDelayPolicy: 'visible',
            },
        });
        if (action) actions.push(action);
    }

    const damage = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD,
        payload: { choice: 'damage' },
        kind: ACTION_KINDS.RESOLVE_MUMMY_ATTACK_REWARD,
        label: '木乃伊造成伤害',
        idParts: ['damage'],
        metadata: {
            choice: 'damage',
            strategicScore: 1260,
            visibleStepDelayPolicy: 'visible',
        },
    });
    if (damage) actions.push(damage);
    return actions;
}

function buildMummyHeroActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isDead: boolean,
): AiLegalAction[] {
    const core = state.core;
    const mummy = core.scenarioRuntime.mummy;
    const actor = findExplorer(core, playerId);
    if (!isMummyHaunt(core) || !mummy || !actor || isDead) return [];

    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.BANISH_MUMMY,
        payload: {},
        kind: ACTION_KINDS.BANISH_MUMMY,
        label: '驱逐木乃伊',
        metadata: {
            strategicScore: 1480 + actor.traits.sanity * 10,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT,
        payload: {},
        kind: ACTION_KINDS.LEARN_MUMMY_BANISHMENT,
        label: '学习驱逐法术',
        metadata: {
            strategicScore: 1410 + actor.traits.knowledge * 10 + (hasOmenBook(actor) ? 60 : 0),
            visibleStepDelayPolicy: 'visible',
        },
    }));

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.STUDY_MUMMY_NAME,
        payload: {},
        kind: ACTION_KINDS.STUDY_MUMMY_NAME,
        label: '寻找木乃伊真名',
        metadata: {
            strategicScore: 1360 + actor.traits.knowledge * 10,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL,
        payload: {},
        kind: ACTION_KINDS.PICK_UP_MUMMY_GIRL,
        label: '拾起女孩',
        metadata: {
            strategicScore: 760,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    return actions;
}

function buildMummyTraitorActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isDead: boolean,
): AiLegalAction[] {
    const core = state.core;
    const actor = findExplorer(core, playerId);
    if (!isMummyHaunt(core) || !actor || isDead) return [];

    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY,
        payload: {},
        kind: ACTION_KINDS.GIVE_GIRL_TO_MUMMY,
        label: '把女孩交给木乃伊',
        metadata: {
            strategicScore: 1460,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    for (const card of actor.inventory.filter(isMummyWeddingOmen)) {
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY,
            payload: { cardId: card.id },
            kind: ACTION_KINDS.GIVE_OMEN_TO_MUMMY,
            label: `把${card.name}交给木乃伊`,
            idParts: [card.id],
            metadata: {
                cardId: card.id,
                strategicScore: 1440,
                visibleStepDelayPolicy: 'visible',
            },
        }));
    }

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL,
        payload: {},
        kind: ACTION_KINDS.PICK_UP_MUMMY_GIRL,
        label: '拾起女孩',
        metadata: {
            strategicScore: 1380,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    return actions;
}

function scoreMummyMonsterMove(core: BetrayalAiCore, monster: BetrayalAiMonster, roomId: string): number {
    const mummy = core.scenarioRuntime.mummy;
    if (!mummy) return 0;
    if (mummy.girlHeldByMummy && mummy.mummyCarriedOmenIds.some((cardId) => MUMMY_WEDDING_OMEN_EFFECT_IDS.has(resolveInventoryEffectId(cardId)))) {
        return roomId === mummy.sarcophagusRoomId ? 1560 : 1180 - roomDistance(core, roomId, mummy.sarcophagusRoomId) * 18;
    }
    if (mummy.girlRoomId) {
        return roomId === mummy.girlRoomId ? 1460 : 1120 - roomDistance(core, roomId, mummy.girlRoomId) * 18;
    }
    if (mummy.girlHolderPlayerId) {
        const holder = findExplorer(core, mummy.girlHolderPlayerId);
        if (holder) {
            return roomId === holder.roomId ? 1440 : 1100 - roomDistance(core, roomId, holder.roomId) * 18;
        }
    }
    const heroRoomDistances = getLivingHeroes(core).map((hero) => roomDistance(core, roomId, hero.roomId));
    if (heroRoomDistances.length > 0) {
        return 980 - Math.min(...heroRoomDistances) * 15;
    }
    return monster.roomId === roomId ? 0 : 400;
}

function buildMummyMonsterActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const mummy = core.scenarioRuntime.mummy;
    const monster = findMummyMonster(core);
    if (!isMummyHaunt(core) || !mummy || !monster || core.scenarioRuntime.traitorPlayerId !== playerId) {
        return [];
    }

    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
        payload: { monsterId: monster.id },
        kind: ACTION_KINDS.RESOLVE_MONSTER_TURN_START,
        label: `${monster.name}开回合`,
        idParts: [monster.id],
        metadata: {
            monsterId: monster.id,
            strategicScore: 1520,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
        payload: { groupId: resolveMummyMovementGroupId(monster) },
        kind: ACTION_KINDS.ROLL_MONSTER_MOVEMENT_GROUP,
        label: `${monster.name}移动骰`,
        idParts: [resolveMummyMovementGroupId(monster)],
        metadata: {
            groupId: resolveMummyMovementGroupId(monster),
            strategicScore: 1510,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    for (const hero of getLivingHeroes(core).filter((candidate) => candidate.roomId === monster.roomId)) {
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            payload: { monsterId: monster.id, targetPlayerId: hero.playerId },
            kind: ACTION_KINDS.MONSTER_ATTACK_HERO,
            label: `${monster.name}攻击${hero.displayName}`,
            idParts: [monster.id, hero.playerId],
            metadata: {
                monsterId: monster.id,
                targetPlayerId: hero.playerId,
                strategicScore: 1490 + Math.max(0, 8 - hero.traits.might) * 8,
                visibleStepDelayPolicy: 'visible',
            },
        }));
    }

    for (const room of core.rooms.filter((candidate) => candidate.state === 'discovered' && candidate.id !== monster.roomId)) {
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            payload: { monsterId: monster.id, roomId: room.id },
            kind: ACTION_KINDS.MOVE_MONSTER_TO_ROOM,
            label: `${monster.name}移动到${room.name}`,
            idParts: [monster.id, room.id],
            metadata: {
                monsterId: monster.id,
                roomId: room.id,
                strategicScore: scoreMummyMonsterMove(core, monster, room.id),
                visibleStepDelayPolicy: 'visible',
            },
        }));
    }

    return actions;
}

function buildMummyHauntActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isTraitor: boolean,
    isDead: boolean,
): AiLegalAction[] {
    if (!isMummyHaunt(state.core)) return [];
    return [
        ...buildMummyAttackRewardActions(validate, state, playerId),
        ...buildMummyMonsterActions(validate, state, playerId),
        ...(isTraitor
            ? buildMummyTraitorActions(validate, state, playerId, isDead)
            : buildMummyHeroActions(validate, state, playerId, isDead)),
    ];
}

function buildTradeAgreementActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingTradeAgreement;
    if (!pending || pending.targetPlayerId !== playerId) return [];

    const requester = findExplorer(state.core, pending.playerId);
    const cards = pending.cardIds
        .map((cardId) => requester?.inventory.find((card) => card.id === cardId))
        .filter((card): card is BetrayalAiInventoryCard => Boolean(card));
    const cardLabel = cards.length > 0
        ? cards.map((card) => card.name).join('、')
        : '交易请求';
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT,
        payload: { accept: true },
        kind: ACTION_KINDS.RESOLVE_TRADE_AGREEMENT,
        label: `同意接收${cardLabel}`,
        idParts: [pending.playerId, ...pending.cardIds],
        metadata: {
            requesterPlayerId: pending.playerId,
            cardIds: pending.cardIds,
            accept: true,
            strategicScore: 1250,
            visibleStepDelayPolicy: 'visible',
        },
    });

    return action ? [action] : [];
}

function resolveExplorerTraitDeficit(
    explorer: BetrayalAiExplorer,
    traits: BetrayalTraitKey[],
): number {
    const template = BETRAYAL_EXPLORER_CATALOG.find((entry) => entry.explorerId === explorer.explorerId);
    if (!template) return 0;
    return traits.reduce((total, trait) => (
        total + Math.max(0, template.traits[trait] - explorer.traits[trait])
    ), 0);
}

function resolveRelocationScore(
    core: BetrayalAiCore,
    playerId: PlayerId,
    targetRoomId: string,
): number {
    const actor = findExplorer(core, playerId);
    if (!actor) return 0;
    const objectiveRoomIds = resolveObjectiveRoomIds(core, playerId);
    if (objectiveRoomIds.length === 0) return 0;
    const currentDistance = Math.min(...objectiveRoomIds.map((roomId) => (
        roomDistance(core, actor.roomId, roomId)
    )));
    const targetDistance = Math.min(...objectiveRoomIds.map((roomId) => (
        roomDistance(core, targetRoomId, roomId)
    )));
    const improvement = currentDistance - targetDistance;
    return improvement > 0 ? 650 + improvement * 40 : 0;
}

function buildPossessionActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const actor = findExplorer(core, playerId);
    if (!actor) return [];

    const actions: AiLegalAction[] = [];
    const add = (args: {
        card: BetrayalAiInventoryCard;
        payload: Record<string, unknown>;
        label: string;
        score: number;
        idParts?: Array<string | number>;
        metadata?: Record<string, unknown>;
    }) => {
        if (args.score <= 0) return;
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.USE_POSSESSION,
            payload: { cardId: args.card.id, ...args.payload },
            kind: ACTION_KINDS.USE_POSSESSION,
            label: args.label,
            idParts: [args.card.id, ...(args.idParts ?? [])],
            metadata: {
                cardId: args.card.id,
                possessionEffectId: resolveInventoryEffectId(args.card.id),
                strategicScore: args.score,
                visibleStepDelayPolicy: 'visible',
                ...args.metadata,
            },
        });
        if (action) actions.push(action);
    };

    for (const card of actor.inventory) {
        const effect = resolveUseEffect(card);
        if (!effect) continue;

        if (effect.mode === 'nextNonCombatTraitReplacement') {
            const canAfford = actor.traits.sanity > effect.sanityCost;
            const alreadyPrepared = core.nextNonCombatTraitReplacement?.playerId === playerId;
            add({
                card,
                payload: {},
                label: `使用${card.name}`,
                score: canAfford && !alreadyPrepared ? 520 : 0,
            });
            continue;
        }

        if (effect.mode === 'nextNonCombatTraitRollTotalReplacement') {
            const alreadyPrepared = core.nextNonCombatTraitRollTotalReplacement?.playerId === playerId;
            add({
                card,
                payload: { replacementRollTotal: effect.maxTotal },
                label: `使用${card.name}`,
                score: alreadyPrepared ? 0 : 540,
                metadata: {
                    replacementRollTotal: effect.maxTotal,
                },
            });
            continue;
        }

        if (effect.mode === 'healTraits') {
            const targets = effect.target === 'self'
                ? [actor]
                : getAllExplorers(core).filter((explorer) => (
                    explorer.playerId === playerId
                    || (
                        explorer.roomId === actor.roomId
                        && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                    )
                ));
            for (const target of targets) {
                const deficit = resolveExplorerTraitDeficit(target, effect.traits);
                add({
                    card,
                    payload: { targetPlayerId: target.playerId },
                    label: `用${card.name}治疗${target.displayName}`,
                    score: deficit > 0 ? 700 + deficit * 35 : 0,
                    idParts: [target.playerId],
                    metadata: {
                        targetPlayerId: target.playerId,
                        healedTraitDeficit: deficit,
                    },
                });
            }
            continue;
        }

        if (effect.mode === 'placeExplorer') {
            for (const room of core.rooms) {
                if (room.state !== 'discovered' || room.id === actor.roomId) continue;
                const relocationScore = resolveRelocationScore(core, playerId, room.id);
                add({
                    card,
                    payload: { targetRoomId: room.id },
                    label: `用${card.name}前往${room.name}`,
                    score: relocationScore,
                    idParts: [room.id],
                    metadata: { targetRoomId: room.id },
                });
            }
            continue;
        }

        const sameRoomTargetCount = getAllExplorers(core)
            .filter((explorer) => (
                explorer.playerId !== playerId
                && explorer.roomId === actor.roomId
                && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            )).length
            + core.monsters.filter((monster) => monster.roomId === actor.roomId).length;
        if (sameRoomTargetCount === 0) continue;
        for (const room of core.rooms) {
            if (room.state !== 'discovered' || room.id === actor.roomId) continue;
            add({
                card,
                payload: { targetRoomId: room.id },
                label: `使用${card.name}移动同房目标到${room.name}`,
                score: 280 + sameRoomTargetCount * 20,
                idParts: [room.id],
                metadata: {
                    targetRoomId: room.id,
                    movedTargetCount: sameRoomTargetCount,
                },
            });
        }
    }

    return actions;
}

function isSameFaction(core: BetrayalAiCore, leftPlayerId: string, rightPlayerId: string): boolean {
    if (core.phase === 'preHaunt') return true;
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
    return (leftPlayerId === traitorPlayerId) === (rightPlayerId === traitorPlayerId);
}

function resolveCardHolderScore(
    card: BetrayalAiInventoryCard,
    explorer: BetrayalAiExplorer,
): number {
    const effectId = resolveInventoryEffectId(card.id);
    const totalTraits = Object.values(explorer.traits).reduce((total, value) => total + value, 0);
    switch (effectId) {
        case 'omen-book':
            return explorer.traits.knowledge * 5 + explorer.traits.sanity * 2;
        case 'medical-kit':
            return resolveExplorerTraitDeficit(
                explorer,
                ['might', 'speed', 'knowledge', 'sanity'],
            ) * 10 + explorer.traits.speed;
        case 'holy-water':
            return resolveExplorerTraitDeficit(explorer, ['might', 'speed']) * 12;
        case 'map':
        case 'notebook':
        case 'journal':
        case 'manuscript':
            return explorer.traits.speed * 5 + explorer.traits.knowledge;
        case 'rope':
            return 40 - explorer.traits.might - explorer.traits.speed;
        case 'mask':
        case 'dog':
            return explorer.traits.speed * 5 + explorer.traits.sanity;
        default:
            return card.kind === 'item'
                ? explorer.traits.might * 4 + explorer.traits.speed * 2
                : totalTraits;
    }
}

function buildTradeActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const actor = findExplorer(core, playerId);
    if (!actor) return [];

    const actions: AiLegalAction[] = [];
    for (const target of getAllExplorers(core)) {
        if (
            target.playerId === playerId
            || core.scenarioRuntime.deadExplorerPlayerIds.includes(target.playerId)
            || !isSameFaction(core, playerId, target.playerId)
        ) {
            continue;
        }
        for (const card of actor.inventory) {
            if (core.usedCardIdsThisTurn.includes(card.id)) continue;
            const tradeGain = resolveCardHolderScore(card, target) - resolveCardHolderScore(card, actor);
            if (tradeGain < 6) continue;

            const modes = target.roomId === actor.roomId ? [false] : [true];
            for (const useDog of modes) {
                if (useDog && resolveInventoryEffectId(card.id) === 'dog') continue;
                const action = createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.TRADE_POSSESSION,
                    payload: {
                        cardId: card.id,
                        targetPlayerId: target.playerId,
                        useDog,
                    },
                    kind: ACTION_KINDS.TRADE_POSSESSION,
                    label: useDog
                        ? `让狗把${card.name}送给${target.displayName}`
                        : `把${card.name}交给${target.displayName}`,
                    idParts: [useDog ? 'dog' : 'normal', card.id, target.playerId],
                    metadata: {
                        cardId: card.id,
                        targetPlayerId: target.playerId,
                        useDog,
                        tradeGain,
                        strategicScore: 390 + tradeGain * 4,
                        visibleStepDelayPolicy: 'visible',
                    },
                });
                if (action) actions.push(action);
            }
        }
    }
    return actions;
}

function buildLootActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const actor = findExplorer(core, playerId);
    if (!actor) return [];

    return getAllExplorers(core)
        .filter((explorer) => (
            explorer.playerId !== playerId
            && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && explorer.roomId === actor.roomId
        ))
        .flatMap((source) => source.inventory.map((card) => createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.LOOT_CORPSE,
            payload: {
                sourcePlayerId: source.playerId,
                cardId: card.id,
            },
            kind: ACTION_KINDS.LOOT_CORPSE,
            label: `从${source.displayName}的尸体取得${card.name}`,
            idParts: [source.playerId, card.id],
            metadata: {
                sourcePlayerId: source.playerId,
                cardId: card.id,
                strategicScore: 820 + resolveCardHolderScore(card, actor),
                visibleStepDelayPolicy: 'visible',
            },
        })))
        .filter((action): action is AiLegalAction => Boolean(action));
}

function shouldRerollRecentResult(recentRoll: BetrayalAiRecentRoll): boolean {
    const total = recentRoll.dice.reduce((sum, pip) => sum + pip, 0) + recentRoll.passiveBonus;
    if (recentRoll.kind === 'hauntRoll') {
        return false;
    }
    if (recentRoll.branchThresholds?.length) {
        const bestThreshold = Math.max(...recentRoll.branchThresholds.map((branch) => branch.min));
        return total < bestThreshold;
    }
    if (recentRoll.kind === 'attackRoll' && recentRoll.attack) {
        return total <= recentRoll.attack.defenderRoll;
    }
    if (recentRoll.kind === 'roomEndTurnTraitCheck') {
        return total < 5;
    }
    if (recentRoll.kind === 'deathPrevention' && recentRoll.deathPrevention) {
        return total < recentRoll.deathPrevention.minTotal;
    }
    if (recentRoll.kind === 'hauntActionTraitCheck') {
        return /失败|未成功|未完成/.test(recentRoll.latestLabel);
    }
    if (recentRoll.kind === 'mysticElevator') {
        return total < 4;
    }
    return false;
}

function buildRabbitFootActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const recentRoll = core.recentRoll;
    const owner = findExplorer(core, playerId);
    if (!recentRoll || recentRoll.playerId !== playerId || !owner || !shouldRerollRecentResult(recentRoll)) {
        return [];
    }

    const cards = owner.inventory.filter((card) => resolveInventoryEffectId(card.id) === 'rope');
    return cards.flatMap((card) => recentRoll.dice.map((pip, dieIndex) => createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
        payload: { cardId: card.id, dieIndex },
        kind: ACTION_KINDS.USE_RABBIT_FOOT,
        label: `用${card.name}重掷第${dieIndex + 1}颗骰子`,
        idParts: [card.id, dieIndex],
        metadata: {
            cardId: card.id,
            dieIndex,
            previousPip: pip,
            strategicScore: 1250 + (3 - pip) * 40,
            visibleStepDelayPolicy: 'visible',
        },
    })))
        .filter((action): action is AiLegalAction => Boolean(action));
}

function buildDamageTraitPayloads(
    allowedTraits: BetrayalTraitKey[],
    amount: number,
): EventChoicePayload[] {
    const normalizedAmount = Math.max(0, Math.floor(amount));
    if (normalizedAmount === 0 || allowedTraits.length === 0) {
        return [{ traits: [] }];
    }

    const payloads: EventChoicePayload[] = [];
    const maxCandidates = 4096;
    const visit = (traits: BetrayalTraitKey[]): void => {
        if (payloads.length >= maxCandidates) {
            return;
        }
        if (traits.length === normalizedAmount) {
            payloads.push({ traits: [...traits] });
            return;
        }
        for (const trait of allowedTraits) {
            visit([...traits, trait]);
            if (payloads.length >= maxCandidates) {
                return;
            }
        }
    };
    visit([]);
    return payloads;
}

function buildDamageAllocationActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingDamageAllocation;
    if (!pending || pending.playerId !== playerId || pending.amount < 0) {
        return [];
    }

    const candidates: Array<{ traits: BetrayalTraitKey[]; useBrooch?: boolean }> = [];
    const addCandidates = (allowedTraits: BetrayalTraitKey[], useBrooch = false) => {
        for (const payload of buildDamageTraitPayloads(allowedTraits, pending.amount)) {
            candidates.push({
                traits: payload.traits ?? [],
                ...(useBrooch ? { useBrooch: true } : {}),
            });
        }
    };

    if (pending.forcedTraitSequence) {
        candidates.push({ traits: [...pending.forcedTraitSequence] });
    } else {
        addCandidates(pending.allowedTraits);
        if (pending.damageReplacement && pending.damageKind !== 'general') {
            addCandidates(BETRAYAL_AI_TRAITS, true);
        }
    }

    return candidates
        .map((candidate, index) => createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            payload: candidate,
            kind: ACTION_KINDS.RESOLVE_DAMAGE_ALLOCATION,
            label: candidate.useBrooch ? '用胸针替换并分配伤害' : '分配当前伤害',
            idParts: [
                candidate.useBrooch ? 'brooch' : 'damage',
                ...candidate.traits,
            ],
            metadata: {
                strategicScore: 1500 - index,
                traits: candidate.traits,
                useBrooch: candidate.useBrooch === true,
                visibleStepDelayPolicy: 'visible',
            },
        }))
        .filter((action): action is AiLegalAction => Boolean(action));
}

function buildRoomEffectActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
        payload: {},
        kind: ACTION_KINDS.USE_ROOM_EFFECT,
        label: '使用当前房间效果',
        metadata: {
            strategicScore: 820,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildTurnActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    if (core.currentPlayer !== playerId || core.phase === 'endgame') return [];

    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    const actorIsDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId);
    if (!actorIsDead) {
        actions.push(
            ...buildPossessionActions(validate, state, playerId),
            ...buildTradeActions(validate, state, playerId),
            ...buildLootActions(validate, state, playerId),
            ...buildRoomEffectActions(validate, state, playerId),
        );
    }

    for (const room of core.rooms) {
        if (room.state !== 'discovered') continue;
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            payload: { roomId: room.id },
            kind: ACTION_KINDS.MOVE_TO_ROOM,
            label: `移动到${room.name}`,
            idParts: [room.id],
            metadata: {
                roomId: room.id,
                visibleStepDelayPolicy: 'visible',
            },
        }));
    }

    if (core.phase === 'preHaunt') {
        add(createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.EXPLORE_ROOM,
            payload: {},
            kind: ACTION_KINDS.EXPLORE_ROOM,
            label: '探索未知房间',
            metadata: { visibleStepDelayPolicy: 'visible' },
        }));
    } else if (core.phase === 'haunt') {
        const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
        const isDead = core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId);
        if (isMummyHaunt(core)) {
            actions.push(...buildMummyHauntActions(validate, state, playerId, isTraitor, isDead));
        } else {
            actions.push(...buildDustHauntActions(validate, state, playerId, isDead));
            actions.push(...buildMagicCameraHauntActions(validate, state, playerId, isTraitor, isDead));
            if (isTraitor) {
                for (const hero of getAllExplorers(core)) {
                    if (
                        hero.playerId === playerId
                        || core.scenarioRuntime.deadExplorerPlayerIds.includes(hero.playerId)
                    ) {
                        continue;
                    }
                    add(createValidatedAction({
                        validate,
                        state,
                        playerId,
                        type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
                        payload: { target: 'hero', targetPlayerId: hero.playerId },
                        kind: ACTION_KINDS.TRAITOR_ATTACK_HERO,
                        label: `攻击${hero.displayName}`,
                        idParts: [hero.playerId],
                        metadata: {
                            targetPlayerId: hero.playerId,
                            visibleStepDelayPolicy: 'visible',
                        },
                    }));
                }
            } else if (!isDead) {
                add(createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.EXORCISE_JACK,
                    payload: {},
                    kind: ACTION_KINDS.EXORCISE_JACK,
                    label: '驱魔',
                    metadata: { visibleStepDelayPolicy: 'visible' },
                }));
                add(createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
                    payload: {},
                    kind: ACTION_KINDS.LEARN_ABOUT_JACK,
                    label: '调查杰克',
                    metadata: { visibleStepDelayPolicy: 'visible' },
                }));
                add(createValidatedAction({
                    validate,
                    state,
                    playerId,
                    type: BETRAYAL_COMMANDS.STUDY_EXORCISM,
                    payload: {},
                    kind: ACTION_KINDS.STUDY_EXORCISM,
                    label: '研究驱魔法阵',
                    metadata: { visibleStepDelayPolicy: 'visible' },
                }));
                const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
                const traitorIsDead = Boolean(
                    traitorPlayerId
                    && core.scenarioRuntime.deadExplorerPlayerIds.includes(traitorPlayerId),
                );
                if (!traitorIsDead) {
                    add(createValidatedAction({
                        validate,
                        state,
                        playerId,
                        type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
                        payload: { target: 'traitor' },
                        kind: ACTION_KINDS.HERO_ATTACK_TRAITOR,
                        label: '攻击叛徒',
                        metadata: { visibleStepDelayPolicy: 'visible' },
                    }));
                }
            }
        }
    }

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.END_TURN,
        payload: {},
        kind: ACTION_KINDS.END_TURN,
        label: '结束回合',
        metadata: { visibleStepDelayPolicy: 'hidden' },
    }));

    return actions;
}

function buildHelpingHandsMonsterTurnActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const core = state.core;
    const helpingHands = core.scenarioRuntime.helpingHands;
    if (!helpingHands || !isHelpingHandsMonsterTurn(core, playerId)) {
        return [];
    }

    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    const activeTrollHands = helpingHands.trollHandIds
        .filter((monsterId) => !helpingHands.trollHandAttackUsedIdsThisTurn.includes(monsterId))
        .map((monsterId) => core.monsters.find((monster) => monster.id === monsterId))
        .filter((monster): monster is BetrayalAiMonster => Boolean(monster));
    const actions: AiLegalAction[] = [];
    const add = (action: AiLegalAction | null) => {
        if (action) actions.push(action);
    };

    if (
        activeTrollHands.length === 2
        && activeTrollHands[0]!.roomId === activeTrollHands[1]!.roomId
    ) {
        for (const target of livingExplorers.filter((explorer) => (
            explorer.roomId === activeTrollHands[0]!.roomId
        ))) {
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
                payload: { combined: true, targetPlayerId: target.playerId },
                kind: ACTION_KINDS.TROLL_HAND_ATTACK,
                label: `让巨魔手合击${target.displayName}`,
                idParts: ['combined', target.playerId],
                metadata: {
                    combined: true,
                    targetPlayerId: target.playerId,
                    strategicScore: 1360 + Math.max(0, 8 - target.traits.might) * 8,
                    visibleStepDelayPolicy: 'visible',
                },
            }));
        }
    }

    for (const monster of activeTrollHands) {
        for (const target of livingExplorers.filter((explorer) => explorer.roomId === monster.roomId)) {
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
                payload: { monsterId: monster.id, targetPlayerId: target.playerId },
                kind: ACTION_KINDS.TROLL_HAND_ATTACK,
                label: `让${monster.name}攻击${target.displayName}`,
                idParts: [monster.id, target.playerId],
                metadata: {
                    monsterId: monster.id,
                    targetPlayerId: target.playerId,
                    strategicScore: 1290 + Math.max(0, 7 - target.traits.might) * 8,
                    visibleStepDelayPolicy: 'visible',
                },
            }));
        }
    }

    for (const monster of activeTrollHands) {
        if ((helpingHands.trollHandMoveRemainingById[monster.id] ?? 0) <= 0) {
            continue;
        }
        for (const room of core.rooms) {
            if (room.state !== 'discovered' || room.id === monster.roomId) {
                continue;
            }
            add(createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.MOVE_HELPING_HANDS_TROLL_HAND,
                payload: { monsterId: monster.id, roomId: room.id },
                kind: ACTION_KINDS.MOVE_TROLL_HAND,
                label: `移动${monster.name}到${room.name}`,
                idParts: [monster.id, room.id],
                metadata: {
                    monsterId: monster.id,
                    roomId: room.id,
                    strategicScore: 560,
                    visibleStepDelayPolicy: 'visible',
                },
            }));
        }
    }

    add(createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.END_HELPING_HANDS_MONSTER_TURN,
        payload: {},
        kind: ACTION_KINDS.END_TROLL_HAND_MONSTER_TURN,
        label: '结束巨魔手回合',
        metadata: {
            strategicScore: 0,
            visibleStepDelayPolicy: 'visible',
        },
    }));

    return actions;
}

function buildTurnEndRollAcknowledgementActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const recentRoll = state.core.recentRoll;
    if (
        recentRoll?.kind !== 'roomEndTurnTraitCheck'
        || recentRoll.playerId !== playerId
        || !recentRoll.roomEndTurn?.nextPlayerId
    ) {
        return [];
    }
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL,
        payload: {},
        kind: ACTION_KINDS.ACKNOWLEDGE_TURN_END_ROLL,
        label: '确认回合结束检定结果',
        metadata: {
            strategicScore: 900,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildRecentRollAcknowledgementActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const recentRoll = state.core.recentRoll;
    if (!recentRoll || recentRoll.playerId !== playerId || recentRoll.kind === 'roomEndTurnTraitCheck') {
        return [];
    }
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL,
        payload: {},
        kind: ACTION_KINDS.ACKNOWLEDGE_RECENT_ROLL,
        label: `确认投骰结果：${recentRoll.latestLabel}`,
        metadata: {
            strategicScore: 1230,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildCardResolutionAcknowledgementActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pendingResolution = state.core.pendingCardResolutionQueue?.[0];
    const requiredPlayerIds = pendingResolution?.requiredPlayerIds?.length
        ? pendingResolution.requiredPlayerIds
        : pendingResolution
            ? [pendingResolution.playerId]
            : [];
    const acknowledgedPlayerIds = pendingResolution?.acknowledgedPlayerIds ?? [];
    if (!pendingResolution || !requiredPlayerIds.includes(playerId) || acknowledgedPlayerIds.includes(playerId)) {
        return [];
    }
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION,
        payload: { resolutionId: pendingResolution.id },
        kind: ACTION_KINDS.ACKNOWLEDGE_CARD_RESOLUTION,
        label: `确认翻牌结算：${pendingResolution.cardName}`,
        metadata: {
            strategicScore: 1180,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildEventRollFinalizationActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingEventRollResolution;
    if (pending?.requiresAcknowledgement === false) {
        if (pending.playerId !== playerId) {
            return [];
        }
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
            payload: { rollId: pending.rollId },
            kind: ACTION_KINDS.FINALIZE_EVENT_ROLL,
            label: `自动收口事件展示：${pending.sourceTitle}`,
            idParts: [pending.rollId],
            metadata: {
                strategicScore: 1190,
                visibleStepDelayPolicy: 'visible',
            },
        });
        return action ? [action] : [];
    }
    const requiredPlayerIds = pending?.requiredPlayerIds?.length
        ? pending.requiredPlayerIds
        : pending
            ? state.core.playerIds
            : [];
    const acknowledgedPlayerIds = pending?.acknowledgedPlayerIds ?? [];
    if (!pending || !requiredPlayerIds.includes(playerId) || acknowledgedPlayerIds.includes(playerId)) {
        return [];
    }
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL,
        payload: { rollId: pending.rollId },
        kind: ACTION_KINDS.ACKNOWLEDGE_EVENT_ROLL,
        label: `确认事件投骰结果：${pending.sourceTitle}`,
        metadata: {
            strategicScore: 1190,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildEventRollStartActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
): AiLegalAction[] {
    const pending = state.core.pendingEventRollStart;
    if (!pending || pending.playerId !== playerId) {
        return [];
    }
    const action = createValidatedAction({
        validate,
        state,
        playerId,
        type: BETRAYAL_COMMANDS.ROLL_EVENT,
        payload: { sourceTitle: pending.sourceTitle },
        kind: ACTION_KINDS.ROLL_EVENT,
        label: `投掷事件：${pending.sourceTitle}`,
        idParts: [pending.sourceTitle],
        metadata: {
            sourceTitle: pending.sourceTitle,
            visibleStepDelayPolicy: 'visible',
        },
    });
    return action ? [action] : [];
}

function buildBetrayalAiLegalActions(
    validate: BetrayalAiValidator,
    args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
    },
): AiLegalAction[] {
    const state = args.state as BetrayalState;
    if (state.sys?.gameover || state.core.endgameResult || state.core.phase === 'endgame') {
        return [];
    }

    if (state.core.phase === 'characterSelect') {
        return buildCharacterSelectActions(validate, state, args.playerId);
    }

    const damageAllocationActions = buildDamageAllocationActions(validate, state, args.playerId);
    if (damageAllocationActions.length > 0) {
        return damageAllocationActions;
    }

    const eventChoiceActions = buildEventChoiceActions(validate, state, args.playerId);
    if (eventChoiceActions.length > 0) {
        return eventChoiceActions;
    }

    const eventRollStartActions = buildEventRollStartActions(validate, state, args.playerId);
    if (eventRollStartActions.length > 0) {
        return eventRollStartActions;
    }

    const eventRollFinalizationActions = buildEventRollFinalizationActions(validate, state, args.playerId);
    if (eventRollFinalizationActions.length > 0) {
        return eventRollFinalizationActions;
    }

    const cardResolutionAcknowledgementActions = buildCardResolutionAcknowledgementActions(validate, state, args.playerId);
    if (cardResolutionAcknowledgementActions.length > 0) {
        return cardResolutionAcknowledgementActions;
    }

    const tradeAgreementActions = buildTradeAgreementActions(validate, state, args.playerId);
    if (tradeAgreementActions.length > 0) {
        return tradeAgreementActions;
    }

    const dustSicknessExchangeActions = buildDustSicknessExchangeActions(validate, state, args.playerId);
    if (dustSicknessExchangeActions.length > 0) {
        return dustSicknessExchangeActions;
    }

    const rabbitFootActions = buildRabbitFootActions(validate, state, args.playerId);
    if (rabbitFootActions.length > 0) {
        return rabbitFootActions;
    }

    const recentRollAcknowledgementActions = buildRecentRollAcknowledgementActions(validate, state, args.playerId);

    const turnEndRollAcknowledgementActions = buildTurnEndRollAcknowledgementActions(validate, state, args.playerId);
    if (turnEndRollAcknowledgementActions.length > 0) {
        return turnEndRollAcknowledgementActions;
    }

    const helpingHandsMonsterTurnActions = buildHelpingHandsMonsterTurnActions(validate, state, args.playerId);
    if (helpingHandsMonsterTurnActions.length > 0) {
        return [...recentRollAcknowledgementActions, ...helpingHandsMonsterTurnActions];
    }

    return [...recentRollAcknowledgementActions, ...buildTurnActions(validate, state, args.playerId)];
}

function roomDistance(core: BetrayalAiCore, fromRoomId: string, targetRoomId: string): number {
    if (fromRoomId === targetRoomId) return 0;
    const roomsById = new Map(core.rooms.map((room) => [room.id, room]));
    const queue: Array<{ roomId: string; distance: number }> = [{ roomId: fromRoomId, distance: 0 }];
    const visited = new Set([fromRoomId]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const room = roomsById.get(current.roomId);
        if (!room) continue;
        for (const connectedRoomId of room.connectedRoomIds) {
            if (visited.has(connectedRoomId)) continue;
            if (connectedRoomId === targetRoomId) return current.distance + 1;
            visited.add(connectedRoomId);
            queue.push({ roomId: connectedRoomId, distance: current.distance + 1 });
        }
    }

    const from = roomsById.get(fromRoomId);
    const target = roomsById.get(targetRoomId);
    if (!from || !target) return 99;
    const floorPenalty = from.floor === target.floor ? 0 : 6;
    return Math.abs(from.x - target.x) + Math.abs(from.y - target.y) + floorPenalty;
}

function resolveDustObjectiveRoomIds(core: BetrayalAiCore, playerId: PlayerId): string[] {
    const dust = core.scenarioRuntime.dust;
    const actor = findExplorer(core, playerId);
    if (!isDustHaunt(core) || !dust || !actor) return [];

    if (dust.researchRoomIds.length > 0) {
        return [...dust.researchRoomIds];
    }

    const namedResearchRooms = core.rooms
        .filter((room) => room.state === 'discovered')
        .filter((room) => ['实验室', '手术室', '观测台', '观象台', '厨房'].includes(room.name))
        .map((room) => room.id);
    if (namedResearchRooms.length > 0) {
        return namedResearchRooms;
    }

    const omenRoomsWithoutResearch = core.rooms
        .filter((room) => (
            room.state === 'discovered'
            && room.discoveryReward === 'omen'
            && !dust.researchRoomIds.includes(room.id)
        ))
        .map((room) => room.id);
    if (omenRoomsWithoutResearch.length > 0) {
        return omenRoomsWithoutResearch;
    }

    return getAllExplorers(core)
        .filter((explorer) => (
            explorer.playerId !== playerId
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        ))
        .map((explorer) => explorer.roomId);
}

function resolveMummyObjectiveRoomIds(core: BetrayalAiCore, playerId: PlayerId): string[] {
    const mummy = core.scenarioRuntime.mummy;
    const actor = findExplorer(core, playerId);
    if (!isMummyHaunt(core) || !mummy || !actor) return [];

    const mummyMonster = findMummyMonster(core);
    const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
    if (isTraitor) {
        const actorHasWeddingOmen = actor.inventory.some(isMummyWeddingOmen);
        const mummyHasWeddingOmen = mummy.mummyCarriedOmenIds.some((cardId) => (
            MUMMY_WEDDING_OMEN_EFFECT_IDS.has(resolveInventoryEffectId(cardId))
        ));
        if (mummy.girlHeldByMummy && mummyHasWeddingOmen) {
            return [mummy.sarcophagusRoomId];
        }
        if ((mummy.girlHolderPlayerId === playerId || actorHasWeddingOmen) && mummyMonster) {
            return [mummyMonster.roomId];
        }
        if (mummy.girlRoomId) {
            return [mummy.girlRoomId];
        }
        if (mummy.girlHolderPlayerId) {
            const holder = findExplorer(core, mummy.girlHolderPlayerId);
            if (holder) return [holder.roomId];
        }
        if (mummyMonster) {
            return [mummyMonster.roomId];
        }
    }

    if (mummy.banishmentSpellLearned && mummy.knowledgeTokenCount >= 2 && mummyMonster) {
        return [mummyMonster.roomId];
    }
    if (mummy.trueNameFound && !mummy.banishmentSpellLearned) {
        if (hasOmenBook(actor)) return [actor.roomId];
        const bookHolder = getLivingHeroes(core).find(hasOmenBook);
        if (bookHolder) return [bookHolder.roomId];
    }
    if (!mummy.trueNameFound) {
        const studyRoomIds = core.rooms
            .filter((room) => room.state === 'discovered')
            .filter((room) => isMummyNameStudyCandidateRoom(core, room))
            .map((room) => room.id);
        if (studyRoomIds.length > 0) return studyRoomIds;
    }
    if (mummy.girlRoomId) {
        return [mummy.girlRoomId];
    }
    return mummyMonster ? [mummyMonster.roomId] : [];
}

function resolveObjectiveRoomIds(core: BetrayalAiCore, playerId: PlayerId): string[] {
    if (core.phase === 'preHaunt') {
        return core.rooms
            .filter((room) => room.state === 'discovered')
            .filter((room) => room.connectedRoomIds.some((connectedRoomId) => (
                core.rooms.some((candidate) => candidate.id === connectedRoomId && candidate.state === 'unexplored')
            )))
            .map((room) => room.id);
    }

    const dustObjectiveRoomIds = resolveDustObjectiveRoomIds(core, playerId);
    if (dustObjectiveRoomIds.length > 0) {
        return dustObjectiveRoomIds;
    }

    const mummyObjectiveRoomIds = resolveMummyObjectiveRoomIds(core, playerId);
    if (mummyObjectiveRoomIds.length > 0) {
        return mummyObjectiveRoomIds;
    }

    const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
    if (isTraitor) {
        return getAllExplorers(core)
            .filter((explorer) => explorer.playerId !== playerId)
            .filter((explorer) => !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId))
            .map((explorer) => explorer.roomId);
    }

    if (
        core.scenarioRuntime.jackSpiritReleased
        && core.scenarioRuntime.jackSpiritRoomId
        && core.scenarioRuntime.exorcismCircleRoomIds.length >= 2
    ) {
        return [core.scenarioRuntime.jackSpiritRoomId];
    }
    if (!core.scenarioRuntime.knowledgeOfJackPlayerIds.includes(playerId)) {
        const library = core.rooms.find((room) => room.id === 'upper-west' || room.name === '图书馆');
        if (library) return [library.id];
    }
    if (core.scenarioRuntime.exorcismCircleRoomIds.length < 2) {
        const eventRooms = core.rooms
            .filter((room) => room.state === 'discovered' && room.discoveryReward === 'event')
            .filter((room) => !core.scenarioRuntime.exorcismCircleRoomIds.includes(room.id))
            .map((room) => room.id);
        if (eventRooms.length > 0) return eventRooms;
    }
    const traitor = core.scenarioRuntime.traitorPlayerId
        ? findExplorer(core, core.scenarioRuntime.traitorPlayerId)
        : null;
    return traitor ? [traitor.roomId] : [];
}

function scoreMoveAction(
    core: BetrayalAiCore,
    playerId: PlayerId,
    action: AiLegalAction,
): number {
    const roomId = typeof action.metadata?.roomId === 'string' ? action.metadata.roomId : null;
    if (!roomId) return 0;
    const objectiveRoomIds = resolveObjectiveRoomIds(core, playerId);
    if (objectiveRoomIds.length === 0) return -1000;
    const nearestDistance = Math.min(...objectiveRoomIds.map((targetRoomId) => (
        roomDistance(core, roomId, targetRoomId)
    )));
    const actor = findExplorer(core, playerId);
    const controlledRoomId = (
        core.scenarioRuntime.traitorPlayerId === playerId
        && core.scenarioRuntime.deadExplorerPlayerIds.includes(playerId)
        && core.scenarioRuntime.jackSpiritReleased
        && core.scenarioRuntime.jackSpiritRoomId
    )
        ? core.scenarioRuntime.jackSpiritRoomId
        : actor?.roomId;
    const currentNearestDistance = controlledRoomId
        ? Math.min(...objectiveRoomIds.map((targetRoomId) => (
            roomDistance(core, controlledRoomId, targetRoomId)
        )))
        : 99;
    if (nearestDistance >= currentNearestDistance) {
        return -1000;
    }
    const room = core.rooms.find((candidate) => candidate.id === roomId);
    const unexploredDoorBonus = core.phase === 'preHaunt'
        ? room?.connectedRoomIds.filter((connectedRoomId) => (
            core.rooms.some((candidate) => candidate.id === connectedRoomId && candidate.state === 'unexplored')
        )).length ?? 0
        : 0;
    return Math.max(0, 120 - nearestDistance * 15) + unexploredDoorBonus * 20;
}

function scoreEventChoice(core: BetrayalAiCore, action: AiLegalAction): number {
    let score = 0;
    if (action.metadata?.eventMode === 'optionalHauntRoll') {
        score += action.metadata.accept === false ? 30 : 0;
    } else if (action.metadata?.accept === true) {
        score += 10;
    }
    if (typeof action.metadata?.trait === 'string') {
        score += core.currentExplorer.traits[action.metadata.trait as BetrayalTraitKey] ?? 0;
    }
    if (Array.isArray(action.metadata?.traits)) {
        score += (action.metadata.traits as BetrayalTraitKey[])
            .reduce((total, trait) => total + core.currentExplorer.traits[trait], 0);
    }
    return score;
}

function scoreAction(context: AiDecisionContext, action: AiLegalAction): number {
    const state = context.visibleState as BetrayalState;
    const core = state.core;
    const strategicScore = typeof action.metadata?.strategicScore === 'number'
        ? action.metadata.strategicScore
        : 0;
    switch (action.kind) {
        case ACTION_KINDS.SELECT_EXPLORER:
            return 1000;
        case ACTION_KINDS.CONFIRM_EXPLORER:
            return 1100;
        case ACTION_KINDS.CONFIRM_SCENARIO_CARD:
            return 1150;
        case ACTION_KINDS.START_SCENARIO:
            return 1200;
        case ACTION_KINDS.RESOLVE_EVENT_CHOICE:
            return 1150 + scoreEventChoice(core, action);
        case ACTION_KINDS.RESOLVE_DAMAGE_ALLOCATION:
            return strategicScore;
        case ACTION_KINDS.EXORCISE_JACK:
            return 1200;
        case ACTION_KINDS.TRAITOR_ATTACK_HERO:
            return 1100;
        case ACTION_KINDS.TAKE_PHOTO:
            return Math.min(strategicScore, 1360);
        case ACTION_KINDS.SMASH_MAGIC_CAMERA:
            return Math.min(strategicScore, 1350);
        case ACTION_KINDS.ATTACK_PHANTOM_PHOTOGRAPHER:
            return Math.min(strategicScore, 1270);
        case ACTION_KINDS.PHANTOM_PHOTOGRAPHER_ATTACK:
            return Math.min(strategicScore, 1220);
        case ACTION_KINDS.CURE_THE_DUST:
            return Math.min(strategicScore, 1390);
        case ACTION_KINDS.RESOLVE_SICKNESS_EXCHANGE:
            return Math.min(strategicScore, 1280);
        case ACTION_KINDS.SEARCH_FOR_CURE:
            return Math.min(strategicScore, 1280);
        case ACTION_KINDS.REQUEST_SICKNESS_EXCHANGE:
            return Math.min(strategicScore, 1170);
        case ACTION_KINDS.BANISH_MUMMY:
            return Math.min(strategicScore, 1560);
        case ACTION_KINDS.LEARN_MUMMY_BANISHMENT:
            return Math.min(strategicScore, 1480);
        case ACTION_KINDS.STUDY_MUMMY_NAME:
            return Math.min(strategicScore, 1440);
        case ACTION_KINDS.GIVE_GIRL_TO_MUMMY:
            return Math.min(strategicScore, 1460);
        case ACTION_KINDS.GIVE_OMEN_TO_MUMMY:
            return Math.min(strategicScore, 1440);
        case ACTION_KINDS.PICK_UP_MUMMY_GIRL:
            return Math.min(strategicScore, 1380);
        case ACTION_KINDS.RESOLVE_MUMMY_ATTACK_REWARD:
            return Math.min(strategicScore, 1500);
        case ACTION_KINDS.RESOLVE_MONSTER_TURN_START:
            return Math.min(strategicScore, 1520);
        case ACTION_KINDS.ROLL_MONSTER_MOVEMENT_GROUP:
            return Math.min(strategicScore, 1510);
        case ACTION_KINDS.MONSTER_ATTACK_HERO:
            return Math.min(strategicScore, 1510);
        case ACTION_KINDS.MOVE_MONSTER_TO_ROOM:
            return Math.min(strategicScore, 1560);
        case ACTION_KINDS.ACKNOWLEDGE_RECENT_ROLL:
            return strategicScore;
        case ACTION_KINDS.STUDY_EXORCISM:
            return 1050;
        case ACTION_KINDS.LEARN_ABOUT_JACK:
            return 1000;
        case ACTION_KINDS.HERO_ATTACK_TRAITOR:
            return 1120;
        case ACTION_KINDS.USE_RABBIT_FOOT:
            return strategicScore;
        case ACTION_KINDS.ROLL_EVENT:
            return 1190;
        case ACTION_KINDS.FINALIZE_EVENT_ROLL:
            return strategicScore;
        case ACTION_KINDS.ACKNOWLEDGE_EVENT_ROLL:
            return strategicScore;
        case ACTION_KINDS.ACKNOWLEDGE_CARD_RESOLUTION:
            return strategicScore;
        case ACTION_KINDS.USE_ROOM_EFFECT:
            return Math.min(strategicScore, 820);
        case ACTION_KINDS.LOOT_CORPSE:
            return Math.min(strategicScore, 860);
        case ACTION_KINDS.USE_POSSESSION:
            return Math.min(strategicScore, 880);
        case ACTION_KINDS.TRADE_POSSESSION:
            return Math.min(strategicScore, 780);
        case ACTION_KINDS.RESOLVE_TRADE_AGREEMENT:
            return 1250;
        case ACTION_KINDS.EXPLORE_ROOM:
            return 800;
        case ACTION_KINDS.MOVE_TO_ROOM:
            return 500 + scoreMoveAction(core, context.playerId, action);
        case ACTION_KINDS.TROLL_HAND_ATTACK:
            return Math.min(strategicScore, 1360);
        case ACTION_KINDS.MOVE_TROLL_HAND:
            return Math.min(strategicScore, 560);
        case ACTION_KINDS.END_TROLL_HAND_MONSTER_TURN:
            return 0;
        case ACTION_KINDS.END_TURN:
            return 0;
        default:
            return -100;
    }
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context) {
        const ranked = context.legalActions
            .map((action) => ({ action, score: scoreAction(context, action) }))
            .sort((left, right) => (
                right.score - left.score
                || left.action.actionId.localeCompare(right.action.actionId)
            ));
        const best = ranked[0];
        return best
            ? {
                actionId: best.action.actionId,
                confidence: 0.75,
                reasoningSummary: `按当前阵营目标选择：${best.action.label}`,
            }
            : null;
    },
};

export function createBetrayalAiRuntime(args: {
    validate: BetrayalAiValidator;
}): GameAiRuntime {
    return {
        gameId: 'betrayal',
        buildLegalActions: (buildArgs) => buildBetrayalAiLegalActions(args.validate, buildArgs),
        defaultMinimumActionDelayMs: BETRAYAL_AI_MINIMUM_VISIBLE_STEP_DELAY_MS,
        localVisibleStepDelayConfig: {
            mode: 'whitelist',
            actionKinds: [
                ACTION_KINDS.SELECT_EXPLORER,
                ACTION_KINDS.MOVE_TO_ROOM,
                ACTION_KINDS.EXPLORE_ROOM,
                ACTION_KINDS.HERO_ATTACK_TRAITOR,
                ACTION_KINDS.TRAITOR_ATTACK_HERO,
                ACTION_KINDS.ATTACK_PHANTOM_PHOTOGRAPHER,
                ACTION_KINDS.TAKE_PHOTO,
                ACTION_KINDS.SMASH_MAGIC_CAMERA,
                ACTION_KINDS.PHANTOM_PHOTOGRAPHER_ATTACK,
                ACTION_KINDS.SEARCH_FOR_CURE,
                ACTION_KINDS.CURE_THE_DUST,
                ACTION_KINDS.REQUEST_SICKNESS_EXCHANGE,
                ACTION_KINDS.RESOLVE_SICKNESS_EXCHANGE,
                ACTION_KINDS.STUDY_MUMMY_NAME,
                ACTION_KINDS.LEARN_MUMMY_BANISHMENT,
                ACTION_KINDS.BANISH_MUMMY,
                ACTION_KINDS.PICK_UP_MUMMY_GIRL,
                ACTION_KINDS.GIVE_GIRL_TO_MUMMY,
                ACTION_KINDS.GIVE_OMEN_TO_MUMMY,
                ACTION_KINDS.RESOLVE_MUMMY_ATTACK_REWARD,
                ACTION_KINDS.RESOLVE_MONSTER_TURN_START,
                ACTION_KINDS.ROLL_MONSTER_MOVEMENT_GROUP,
                ACTION_KINDS.MOVE_MONSTER_TO_ROOM,
                ACTION_KINDS.MONSTER_ATTACK_HERO,
                ACTION_KINDS.LEARN_ABOUT_JACK,
                ACTION_KINDS.STUDY_EXORCISM,
                ACTION_KINDS.EXORCISE_JACK,
                ACTION_KINDS.USE_POSSESSION,
                ACTION_KINDS.TRADE_POSSESSION,
                ACTION_KINDS.RESOLVE_TRADE_AGREEMENT,
                ACTION_KINDS.LOOT_CORPSE,
                ACTION_KINDS.USE_RABBIT_FOOT,
                ACTION_KINDS.ROLL_EVENT,
                ACTION_KINDS.FINALIZE_EVENT_ROLL,
                ACTION_KINDS.ACKNOWLEDGE_RECENT_ROLL,
                ACTION_KINDS.ACKNOWLEDGE_EVENT_ROLL,
                ACTION_KINDS.ACKNOWLEDGE_CARD_RESOLUTION,
                ACTION_KINDS.RESOLVE_DAMAGE_ALLOCATION,
                ACTION_KINDS.USE_ROOM_EFFECT,
                ACTION_KINDS.MOVE_TROLL_HAND,
                ACTION_KINDS.TROLL_HAND_ATTACK,
                ACTION_KINDS.END_TROLL_HAND_MONSTER_TURN,
            ],
        },
        localPolicies: {
            baseline: baselineLocalPolicy,
        },
        defaultLocalPolicyId: 'baseline',
    };
}

export { ACTION_KINDS as BETRAYAL_AI_ACTION_KINDS };
