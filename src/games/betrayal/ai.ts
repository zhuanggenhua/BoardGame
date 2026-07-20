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
    isImplementedBetrayalHauntCardNumber,
    type BetrayalScenarioId,
    type BetrayalTraitKey,
    type BetrayalUseEffectSeed as UseEffectProfile,
} from './scenarioConfig';
import {
    resolveInventoryEffectId,
    resolveUseEffect,
} from './possessionEffects';

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

interface BetrayalAiHungryHouseCarriedCorpse {
    kind: 'cultist' | 'explorer';
    corpseId: string;
    name: string;
    sourcePlayerId?: string;
    sourceMonsterId?: string;
}

interface BetrayalAiHungryHouseRuntime {
    ritualProgress: number;
    ritualRoomId: string;
    chasmRoomId: string;
    cultistIds: string[];
    cultistCorpseRoomIds: Record<string, string>;
    carriedCorpseByPlayerId: Record<string, BetrayalAiHungryHouseCarriedCorpse>;
    sacrificedCorpseIds: string[];
}

interface BetrayalAiRecentRoll {
    kind: 'eventTraitCheck' | 'eventDiceRoll' | 'hauntRoll' | 'mysticElevator' | 'attackRoll' | 'roomEndTurnTraitCheck' | 'deathPrevention' | 'hauntActionTraitCheck';
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
        hungryHouse?: BetrayalAiHungryHouseRuntime;
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
    PICK_UP_CORPSE: 'pick-up-corpse',
    FEED_HER: 'feed-her',
    ATTACK_CULTIST: 'attack-cultist',
    CULTIST_ATTACK: 'cultist-attack',
    LEARN_ABOUT_JACK: 'learn-about-jack',
    STUDY_EXORCISM: 'study-exorcism',
    EXORCISE_JACK: 'exorcise-jack',
    USE_POSSESSION: 'use-possession',
    TRADE_POSSESSION: 'trade-possession',
    RESOLVE_TRADE_AGREEMENT: 'resolve-trade-agreement',
    LOOT_CORPSE: 'loot-corpse',
    USE_RABBIT_FOOT: 'use-rabbit-foot',
    USE_ROOM_EFFECT: 'use-room-effect',
    END_TURN: 'end-turn',
    ACKNOWLEDGE_TURN_END_ROLL: 'acknowledge-turn-end-roll',
} as const;

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
            const accepted = isImplementedBetrayalHauntCardNumber(effect.successHauntId)
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

    if (core.readyPlayerIds.length === core.playerIds.length) {
        const action = createValidatedAction({
            validate,
            state,
            playerId,
            type: BETRAYAL_COMMANDS.START_SCENARIO,
            payload: { scenarioId: core.scenarioId },
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

function isHungryHouseHaunt(core: BetrayalAiCore): boolean {
    return core.phase === 'haunt'
        && core.scenarioRuntime.hauntCardNumber === 12
        && Boolean(core.scenarioRuntime.hungryHouse);
}

function resolveLowestTrait(explorer: BetrayalAiExplorer): BetrayalTraitKey {
    return BETRAYAL_AI_TRAITS.reduce((lowest, trait) => (
        explorer.traits[trait] < explorer.traits[lowest] ? trait : lowest
    ), 'might');
}

function resolveHungryHouseCarriableCorpses(
    core: BetrayalAiCore,
    actor: BetrayalAiExplorer,
): BetrayalAiHungryHouseCarriedCorpse[] {
    const hungryHouse = core.scenarioRuntime.hungryHouse;
    if (
        !isHungryHouseHaunt(core)
        || !hungryHouse
        || core.scenarioRuntime.deadExplorerPlayerIds.includes(actor.playerId)
        || hungryHouse.carriedCorpseByPlayerId[actor.playerId]
    ) {
        return [];
    }

    const cultistCorpses = Object.entries(hungryHouse.cultistCorpseRoomIds)
        .filter(([, roomId]) => roomId === actor.roomId)
        .filter(([corpseId]) => !hungryHouse.sacrificedCorpseIds.includes(corpseId))
        .map(([corpseId]) => ({
            kind: 'cultist' as const,
            corpseId,
            sourceMonsterId: corpseId,
            name: '邪教徒尸体',
        }));
    const carriedExplorerCorpseIds = new Set(
        Object.values(hungryHouse.carriedCorpseByPlayerId)
            .map((corpse) => corpse.sourcePlayerId)
            .filter((sourcePlayerId): sourcePlayerId is string => Boolean(sourcePlayerId)),
    );
    const explorerCorpses = getAllExplorers(core)
        .filter((explorer) => (
            explorer.playerId !== actor.playerId
            && explorer.roomId === actor.roomId
            && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && !carriedExplorerCorpseIds.has(explorer.playerId)
            && !hungryHouse.sacrificedCorpseIds.includes(`explorer:${explorer.playerId}`)
        ))
        .map((explorer) => ({
            kind: 'explorer' as const,
            corpseId: `explorer:${explorer.playerId}`,
            sourcePlayerId: explorer.playerId,
            name: `${explorer.displayName}的尸体`,
        }));

    return [...cultistCorpses, ...explorerCorpses];
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

function buildHungryHouseHauntActions(
    validate: BetrayalAiValidator,
    state: BetrayalState,
    playerId: PlayerId,
    isDead: boolean,
): AiLegalAction[] {
    const core = state.core;
    const hungryHouse = core.scenarioRuntime.hungryHouse;
    const actor = findExplorer(core, playerId);
    if (!isHungryHouseHaunt(core) || !hungryHouse || !actor) return [];

    const actions: AiLegalAction[] = [];
    if (!isDead) {
        for (const corpse of resolveHungryHouseCarriableCorpses(core, actor)) {
            const action = createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.PICK_UP_CORPSE,
                payload: {
                    corpseKind: corpse.kind,
                    corpseId: corpse.corpseId,
                    ...(corpse.sourcePlayerId ? { sourcePlayerId: corpse.sourcePlayerId } : {}),
                },
                kind: ACTION_KINDS.PICK_UP_CORPSE,
                label: `搬起${corpse.name}`,
                idParts: [corpse.kind, corpse.corpseId, corpse.sourcePlayerId],
                metadata: {
                    corpseKind: corpse.kind,
                    corpseId: corpse.corpseId,
                    strategicScore: corpse.kind === 'cultist' ? 1260 : 1220,
                    visibleStepDelayPolicy: 'visible',
                },
            });
            if (action) actions.push(action);
        }

        const carriedCorpse = hungryHouse.carriedCorpseByPlayerId[playerId];
        if (carriedCorpse) {
            const action = createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.FEED_HER,
                payload: {},
                kind: ACTION_KINDS.FEED_HER,
                label: `把${carriedCorpse.name}献给大宅`,
                metadata: {
                    corpseId: carriedCorpse.corpseId,
                    strategicScore: 1380,
                    visibleStepDelayPolicy: 'visible',
                },
            });
            if (action) actions.push(action);
        }

        for (const monster of core.monsters) {
            if (
                !hungryHouse.cultistIds.includes(monster.id)
                || monster.roomId !== actor.roomId
            ) {
                continue;
            }
            const action = createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.HAUNT_ATTACK,
                payload: { target: 'cultist', targetMonsterId: monster.id },
                kind: ACTION_KINDS.ATTACK_CULTIST,
                label: `攻击${monster.name}`,
                idParts: [monster.id],
                metadata: {
                    monsterId: monster.id,
                    strategicScore: 1120,
                    visibleStepDelayPolicy: 'visible',
                },
            });
            if (action) actions.push(action);
        }
    }

    const livingExplorers = getAllExplorers(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    for (const monster of core.monsters) {
        if (!hungryHouse.cultistIds.includes(monster.id)) continue;
        for (const explorer of livingExplorers) {
            if (explorer.roomId !== monster.roomId) continue;
            const action = createValidatedAction({
                validate,
                state,
                playerId,
                type: BETRAYAL_COMMANDS.CULTIST_ATTACK,
                payload: { monsterId: monster.id, targetPlayerId: explorer.playerId },
                kind: ACTION_KINDS.CULTIST_ATTACK,
                label: `让邪教徒攻击${explorer.displayName}`,
                idParts: [monster.id, explorer.playerId],
                metadata: {
                    monsterId: monster.id,
                    targetPlayerId: explorer.playerId,
                    strategicScore: 1180 + Math.max(0, 6 - explorer.traits.might) * 8,
                    visibleStepDelayPolicy: 'visible',
                },
            });
            if (action) actions.push(action);
        }
    }

    return actions;
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
        actions.push(...buildDustHauntActions(validate, state, playerId, isDead));
        actions.push(...buildMagicCameraHauntActions(validate, state, playerId, isTraitor, isDead));
        actions.push(...buildHungryHouseHauntActions(validate, state, playerId, isDead));
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

    const eventChoiceActions = buildEventChoiceActions(validate, state, args.playerId);
    if (eventChoiceActions.length > 0) {
        return eventChoiceActions;
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

    const turnEndRollAcknowledgementActions = buildTurnEndRollAcknowledgementActions(validate, state, args.playerId);
    if (turnEndRollAcknowledgementActions.length > 0) {
        return turnEndRollAcknowledgementActions;
    }

    return buildTurnActions(validate, state, args.playerId);
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

function resolveHungryHouseObjectiveRoomIds(core: BetrayalAiCore, playerId: PlayerId): string[] {
    const hungryHouse = core.scenarioRuntime.hungryHouse;
    const actor = findExplorer(core, playerId);
    if (!isHungryHouseHaunt(core) || !hungryHouse || !actor) return [];

    if (hungryHouse.carriedCorpseByPlayerId[playerId]) {
        return [hungryHouse.chasmRoomId];
    }

    const corpseRoomIds = new Set<string>();
    for (const roomId of Object.values(hungryHouse.cultistCorpseRoomIds)) {
        corpseRoomIds.add(roomId);
    }
    for (const explorer of getAllExplorers(core)) {
        if (
            explorer.playerId !== playerId
            && core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && !hungryHouse.sacrificedCorpseIds.includes(`explorer:${explorer.playerId}`)
        ) {
            corpseRoomIds.add(explorer.roomId);
        }
    }
    if (corpseRoomIds.size > 0) {
        return [...corpseRoomIds];
    }

    const cultistRoomIds = core.monsters
        .filter((monster) => hungryHouse.cultistIds.includes(monster.id))
        .map((monster) => monster.roomId);
    if (cultistRoomIds.length > 0) {
        return Array.from(new Set(cultistRoomIds));
    }

    return [hungryHouse.ritualRoomId, hungryHouse.chasmRoomId];
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

    const hungryHouseObjectiveRoomIds = resolveHungryHouseObjectiveRoomIds(core, playerId);
    if (hungryHouseObjectiveRoomIds.length > 0) {
        return hungryHouseObjectiveRoomIds;
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
        case ACTION_KINDS.START_SCENARIO:
            return 1200;
        case ACTION_KINDS.RESOLVE_EVENT_CHOICE:
            return 1150 + scoreEventChoice(core, action);
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
        case ACTION_KINDS.FEED_HER:
            return Math.min(strategicScore, 1390);
        case ACTION_KINDS.PICK_UP_CORPSE:
            return Math.min(strategicScore, 1270);
        case ACTION_KINDS.CULTIST_ATTACK:
            return Math.min(strategicScore, 1230);
        case ACTION_KINDS.ATTACK_CULTIST:
            return Math.min(strategicScore, 1130);
        case ACTION_KINDS.STUDY_EXORCISM:
            return 1050;
        case ACTION_KINDS.LEARN_ABOUT_JACK:
            return 1000;
        case ACTION_KINDS.HERO_ATTACK_TRAITOR:
            return 900;
        case ACTION_KINDS.USE_RABBIT_FOOT:
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
        defaultMinimumActionDelayMs: 700,
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
                ACTION_KINDS.PICK_UP_CORPSE,
                ACTION_KINDS.FEED_HER,
                ACTION_KINDS.ATTACK_CULTIST,
                ACTION_KINDS.CULTIST_ATTACK,
                ACTION_KINDS.LEARN_ABOUT_JACK,
                ACTION_KINDS.STUDY_EXORCISM,
                ACTION_KINDS.EXORCISE_JACK,
                ACTION_KINDS.USE_POSSESSION,
                ACTION_KINDS.TRADE_POSSESSION,
                ACTION_KINDS.RESOLVE_TRADE_AGREEMENT,
                ACTION_KINDS.LOOT_CORPSE,
                ACTION_KINDS.USE_RABBIT_FOOT,
                ACTION_KINDS.USE_ROOM_EFFECT,
            ],
        },
        localPolicies: {
            baseline: baselineLocalPolicy,
        },
        defaultLocalPolicyId: 'baseline',
    };
}

export { ACTION_KINDS as BETRAYAL_AI_ACTION_KINDS };
