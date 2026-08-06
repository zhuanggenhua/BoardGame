import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerAbility } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    createSkipOption,
} from '../domain/abilityHelpers';
import { registerExtended, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    registerTrigger,
    type TriggerContext,
    type TriggerResult,
} from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { SU_EVENTS, type SmashUpCore, type SmashUpEvent } from '../domain/types';

const BIG_HERO = 'munchkin_warriors_big_hero';
const STAR_PLAYER = 'munchkin_warriors_star_player';
const BERSERKER = 'munchkin_warriors_berserker';
const TAUNTER = 'munchkin_warriors_taunter';
const CAMPAIGN = 'munchkin_warriors_campaign';
const CLEAVE = 'munchkin_warriors_cleave';
const DUNGEON_BAIT = 'munchkin_warriors_dungeon_bait';
const ETERNAL_HERO = 'munchkin_warriors_eternal_hero';
const RUCKUS = 'munchkin_warriors_ruckus';
const WAR_CRY = 'munchkin_warriors_war_cry';
const BASE_BASTION = 'base_bastion';
const BASE_THE_GAUNTLET = 'base_the_gauntlet';

const BIG_HERO_MODE_SOURCE_ID = 'munchkin_warriors_big_hero_mode';
const BIG_HERO_MONSTER_SOURCE_ID = 'munchkin_warriors_big_hero_monster';
const BERSERKER_MONSTER_SOURCE_ID = 'munchkin_warriors_berserker_monster';
const TAUNTER_MODE_SOURCE_ID = 'munchkin_warriors_taunter_mode';
const DUNGEON_BAIT_MODE_SOURCE_ID = 'munchkin_warriors_dungeon_bait_mode';
const DUNGEON_BAIT_BASE_SOURCE_ID = 'munchkin_warriors_dungeon_bait_base';
const DUNGEON_BAIT_MINION_SOURCE_ID = 'munchkin_warriors_dungeon_bait_minion';
const CLEAVE_MONSTER_SOURCE_ID = 'munchkin_warriors_cleave_monster';
const RUCKUS_BASE_SOURCE_ID = 'munchkin_warriors_ruckus_base';
const RUCKUS_MODE_SOURCE_ID = 'munchkin_warriors_ruckus_mode';
const WAR_CRY_MONSTER_SOURCE_ID = 'munchkin_warriors_war_cry_monster';
const WAR_CRY_MINION_SOURCE_ID = 'munchkin_warriors_war_cry_minion';

type ModeChoice = { mode?: 'destroyMonster' | 'playMonster' | 'destroyMinion' | 'destroyAll' | 'playTwo'; skip?: boolean };
type MonsterChoice = { monsterUid?: string; monsterDefId?: string; baseIndex?: number };
type MinionChoice = { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number };
type BaseChoice = { baseIndex?: number; baseDefId?: string };

type SourceData = {
    sourceCardUid?: string;
    sourceBaseIndex?: number;
};

type BigHeroModeData = SourceData;
type DungeonBaitModeData = SourceData;
type RuckusModeData = SourceData & { baseIndex?: number };
type WarCryData = SourceData & { monsterUid?: string; monsterDefId?: string; monsterPower?: number; baseIndex?: number };

function cardName(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseName(defId: string): string {
    return getBaseDef(defId)?.name ?? defId;
}

function isMonsterUncontrolled(monster: { controllerId?: PlayerId }): boolean {
    return monster.controllerId === undefined;
}

function buildMonsterOptions(state: SmashUpCore, baseIndex?: number) {
    return state.bases.flatMap((base, index) => {
        if (baseIndex !== undefined && index !== baseIndex) return [];
        return (base.monsters ?? [])
            .filter(isMonsterUncontrolled)
            .map(monster => ({
                id: `munchkin-warriors-monster-${index}-${monster.uid}`,
                label: `${cardName(monster.defId)}（${baseName(base.defId)}）`,
                value: { monsterUid: monster.uid, monsterDefId: monster.defId, baseIndex: index } satisfies MonsterChoice,
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
    });
}

function buildAllMonsterOptions(state: SmashUpCore) {
    return buildMonsterOptions(state);
}

function buildMinionOptions(state: SmashUpCore, maxPower: number, baseIndex?: number, sourcePlayerId: PlayerId = '0') {
    const candidates = state.bases.flatMap((base, index) => {
        if (baseIndex !== undefined && index !== baseIndex) return [];
        return base.minions
            .filter(minion => getEffectivePower(state, minion, index) <= maxPower)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: index,
                label: `${cardName(minion.defId)}（${baseName(base.defId)}）`,
            }));
    });
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId,
        sourceDefId: DUNGEON_BAIT,
        sourceKind: 'action',
        effectType: 'destroy',
    });
}

function buildMonsterPlayEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndices: number[],
    reason: string,
    timestamp: number,
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    let deckOffset = 0;
    let nextUid = state.nextUid;
    for (const baseIndex of baseIndices) {
        const monsterDefId = state.monsterDeck?.[deckOffset];
        if (!monsterDefId || !state.bases[baseIndex]) continue;
        events.push({
            type: SU_EVENTS.MUNCHKIN_MONSTER_PLAYED,
            payload: {
                playerId,
                baseIndex,
                monsterDefId,
                monsterUid: `munchkin_monster_${nextUid}`,
                reason,
            },
            timestamp,
        } as SmashUpEvent);
        deckOffset += 1;
        nextUid += 1;
    }
    return events;
}

function collectOccupiedUids(state: SmashUpCore): Set<string> {
    const occupied = new Set<string>();
    for (const player of Object.values(state.players)) {
        for (const card of [...player.hand, ...player.deck, ...player.discard]) occupied.add(card.uid);
    }
    for (const base of state.bases) {
        for (const minion of base.minions) {
            occupied.add(minion.uid);
            for (const action of minion.attachedActions) occupied.add(action.uid);
        }
        for (const action of base.ongoingActions) occupied.add(action.uid);
        for (const monster of base.monsters ?? []) occupied.add(monster.uid);
        for (const card of base.buriedCards ?? []) occupied.add(card.uid);
    }
    return occupied;
}

function allocateTreasureUids(state: SmashUpCore, count: number): string[] {
    const occupied = collectOccupiedUids(state);
    const result: string[] = [];
    let nextUid = state.nextUid;
    while (result.length < count) {
        const candidate = `munchkin_treasure_${nextUid}`;
        nextUid += 1;
        if (occupied.has(candidate)) continue;
        occupied.add(candidate);
        result.push(candidate);
    }
    return result;
}

function buildMonsterDefeatEvent(
    state: SmashUpCore,
    playerId: PlayerId,
    monster: { uid: string; defId: string },
    reason: string,
    options?: { suppressTreasureReward?: boolean; grantTreasureExtraPlay?: boolean },
): SmashUpEvent {
    const rewardCount = options?.suppressTreasureReward
        ? 0
        : Math.min(getMunchkinSpecialCardDescriptor(monster.defId)?.treasureReward ?? 0, state.treasureDeck?.length ?? 0);
    return {
        type: SU_EVENTS.MUNCHKIN_MONSTER_DEFEATED,
        payload: {
            playerId,
            baseIndex: state.bases.findIndex(base => base.monsters?.some(candidate => candidate.uid === monster.uid)),
            monsterUid: monster.uid,
            monsterDefId: monster.defId,
            treasureUids: allocateTreasureUids(state, rewardCount),
            ...(options ?? {}),
            reason,
        },
        timestamp: 0,
    } as SmashUpEvent;
}

function buildMonsterDefeatEventAtBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
    monster: { uid: string; defId: string },
    reason: string,
    now: number,
    options?: { suppressTreasureReward?: boolean; grantTreasureExtraPlay?: boolean },
): SmashUpEvent {
    const event = buildMonsterDefeatEvent(state, playerId, monster, reason, options);
    return { ...event, timestamp: now, payload: { ...event.payload, baseIndex } } as SmashUpEvent;
}

function buildModeOptions(modes: Array<{ mode: ModeChoice['mode']; label: string }>) {
    return modes.map(({ mode, label }) => ({
        id: `munchkin-warriors-mode-${mode}`,
        label,
        value: { mode } satisfies ModeChoice,
        displayMode: 'button' as const,
    }));
}

function isSourceMinionValid(state: SmashUpCore, playerId: PlayerId, sourceBaseIndex: number | undefined, sourceCardUid: string | undefined, defId: string): boolean {
    if (sourceBaseIndex === undefined || !sourceCardUid) return false;
    const source = state.bases[sourceBaseIndex]?.minions.find(minion => minion.uid === sourceCardUid);
    return source?.defId === defId && source.controller === playerId;
}

function queueModeChoice<T extends Record<string, unknown>>(
    matchState: MatchState<SmashUpCore>,
    id: string,
    playerId: PlayerId,
    title: string,
    options: unknown[],
    sourceId: string,
    titleKey: string,
    data: T,
) {
    const interaction = createSimpleChoice(
        id,
        playerId,
        title,
        options,
        {
            sourceId,
            targetType: 'generic',
            titleKey,
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
        },
    );
    interaction.data = { ...interaction.data, ...data };
    return queueInteraction(matchState, interaction);
}

function bigHeroTalent(ctx: AbilityContext): AbilityResult {
    const source = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!source || source.defId !== BIG_HERO || source.controller !== ctx.playerId || !ctx.matchState) return { events: [] };
    const modes = [
        ...(buildMonsterOptions(ctx.state, ctx.baseIndex).length > 0 ? [{ mode: 'destroyMonster' as const, label: '摧毁这里一个怪物' }] : []),
        ...(ctx.state.monsterDeck?.length ? [{ mode: 'playMonster' as const, label: '在这里打出一个怪物' }] : []),
    ];
    if (modes.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueModeChoice(
            ctx.matchState,
            `${BIG_HERO_MODE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
            ctx.playerId,
            '大英雄：选择天赋效果',
            buildModeOptions(modes),
            BIG_HERO_MODE_SOURCE_ID,
            'ui.munchkin_warriors_big_hero_mode_title',
            { sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex } satisfies BigHeroModeData,
        ),
    };
}

function berserkerOnPlay(ctx: AbilityContext): AbilityResult {
    const source = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!source || source.defId !== BERSERKER || source.controller !== ctx.playerId || !ctx.matchState) return { events: [] };
    const options = buildMonsterOptions(ctx.state, ctx.baseIndex).filter(option => {
        const monster = ctx.state.bases[ctx.baseIndex]?.monsters?.find(candidate => candidate.uid === option.value.monsterUid);
        const power = monster ? getMunchkinSpecialCardDescriptor(monster.defId)?.power ?? 0 : 0;
        return power <= getEffectivePower(ctx.state, source, ctx.baseIndex);
    });
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MonsterChoice>(
        `${BERSERKER_MONSTER_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '狂战士：选择力量不高于自身的怪物',
        options,
        {
            sourceId: BERSERKER_MONSTER_SOURCE_ID,
            targetType: 'monster',
            titleKey: 'ui.munchkin_warriors_berserker_monster_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
            displayCard: { defId: BERSERKER, cardUid: ctx.cardUid },
        },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex } satisfies SourceData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildMonsterOptions(latestState.core as SmashUpCore, ctx.baseIndex);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function taunterOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState || !ctx.state.monsterDeck?.length) return { events: [] };
    const interaction = createSimpleChoice<ModeChoice>(
        `${TAUNTER_MODE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '嘲讽者：可以在这里打出一个怪物',
        [createSkipOption('跳过', 'ui.skip'), { id: 'play-monster', label: '打出一个怪物', value: { mode: 'playMonster' }, displayMode: 'button' }],
        {
            sourceId: TAUNTER_MODE_SOURCE_ID,
            targetType: 'generic',
            titleKey: 'ui.munchkin_warriors_taunter_mode_title',
            responseValidationMode: 'live',
            autoRefresh: 'field',
            autoResolveIfSingle: false,
        },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid, sourceBaseIndex: ctx.baseIndex } satisfies SourceData & Record<string, unknown>;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function campaignOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const [baseIndex, base] of ctx.state.bases.entries()) {
        if (!(base.monsters?.length ?? 0)) continue;
        for (const minion of base.minions.filter(candidate => candidate.controller === ctx.playerId)) {
            events.push(addTempPower(minion.uid, baseIndex, 2, CAMPAIGN, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: CAMPAIGN,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
            }));
        }
    }
    return { events };
}

function cleaveOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildAllMonsterOptions(ctx.state);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MonsterChoice>(
        `${CLEAVE_MONSTER_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '斩杀：选择一个未被控制的怪物',
        options,
        { sourceId: CLEAVE_MONSTER_SOURCE_ID, targetType: 'monster', titleKey: 'ui.munchkin_warriors_cleave_monster_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: CLEAVE, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid } satisfies SourceData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildAllMonsterOptions(latestState.core as SmashUpCore);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function dungeonBaitOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const modes = [
        ...(ctx.state.monsterDeck?.length ? [{ mode: 'playMonster' as const, label: '在一个基地打出一个怪物' }] : []),
        ...(buildMinionOptions(ctx.state, 2, undefined, ctx.playerId).length ? [{ mode: 'destroyMinion' as const, label: '摧毁一个力量 2 或更少的仆从' }] : []),
    ];
    if (modes.length === 0) return { events: [] };
    return {
        events: [],
        matchState: queueModeChoice(
            ctx.matchState,
            `${DUNGEON_BAIT_MODE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
            ctx.playerId,
            '地牢诱饵：选择效果',
            buildModeOptions(modes),
            DUNGEON_BAIT_MODE_SOURCE_ID,
            'ui.munchkin_warriors_dungeon_bait_mode_title',
            { sourceCardUid: ctx.cardUid } satisfies DungeonBaitModeData,
        ),
    };
}

function ruckusOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const baseOptions = ctx.state.bases.flatMap((base, baseIndex) => {
        const canPlayTwo = (ctx.state.monsterDeck?.length ?? 0) >= 2;
        const canDestroyAll = (base.monsters ?? []).length > 0;
        return canPlayTwo || canDestroyAll ? [{ baseIndex, label: baseName(base.defId) }] : [];
    });
    if (baseOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice<BaseChoice>(
        `${RUCKUS_BASE_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '骚乱：选择基地',
        buildBaseTargetOptions(baseOptions, ctx.state),
        { sourceId: RUCKUS_BASE_SOURCE_ID, targetType: 'base', titleKey: 'ui.munchkin_warriors_ruckus_base_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: RUCKUS, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid } satisfies SourceData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildBaseTargetOptions(
        (latestState.core as SmashUpCore).bases.flatMap((base, baseIndex) => {
            const canPlayTwo = ((latestState.core as SmashUpCore).monsterDeck?.length ?? 0) >= 2;
            const canDestroyAll = (base.monsters ?? []).length > 0;
            return canPlayTwo || canDestroyAll ? [{ baseIndex, label: baseName(base.defId) }] : [];
        }),
        latestState.core as SmashUpCore,
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function warCryOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildMonsterOptions(ctx.state);
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MonsterChoice>(
        `${WAR_CRY_MONSTER_SOURCE_ID}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '战争怒吼：选择一个怪物',
        options,
        { sourceId: WAR_CRY_MONSTER_SOURCE_ID, targetType: 'monster', titleKey: 'ui.munchkin_warriors_war_cry_monster_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: WAR_CRY, cardUid: ctx.cardUid } },
    );
    interaction.data = { ...interaction.data, sourceCardUid: ctx.cardUid } satisfies SourceData & Record<string, unknown>;
    interaction.data.optionsGenerator = latestState => buildAllMonsterOptions(latestState.core as SmashUpCore);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function monsterDefeatedTrigger(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    return {
        events: [addPowerCounter(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, STAR_PLAYER, ctx.now)],
    };
}

function eternalHeroCanTrigger(ctx: TriggerContext): boolean {
    return Boolean(
        ctx.sourceCardUid
        && ctx.triggerMinion
        && ctx.sourceControllerId
        && ctx.triggerMinion.controller === ctx.sourceControllerId
        && ctx.triggerMinion.attachedActions.some(action => action.uid === ctx.sourceCardUid),
    );
}

function eternalHeroReplacement(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.triggerMinion || ctx.baseIndex === undefined) return [];
    return [{
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: ctx.triggerMinion.uid,
            minionDefId: ctx.triggerMinion.defId,
            fromBaseIndex: ctx.baseIndex,
            toPlayerId: ctx.triggerMinion.owner,
            reason: ETERNAL_HERO,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: ETERNAL_HERO,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.baseIndex,
            returnAttachedActionUids: [ctx.sourceCardUid],
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function bastionAfterMonsterDestroyed(ctx: BaseAbilityContext): BaseAbilityResult {
    return {
        events: [{
            type: SU_EVENTS.MUNCHKIN_TREASURES_DRAWN,
            payload: {
                playerId: ctx.playerId,
                count: 1,
                reason: BASE_BASTION,
                sourcePlayerId: ctx.playerId,
                sourceDefId: BASE_BASTION,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function gauntletAfterMonsterDestroyed(ctx: BaseAbilityContext): BaseAbilityResult {
    const monsterDefId = ctx.state.monsterDeck?.[0];
    if (!monsterDefId) return { events: [] };
    return {
        events: buildMonsterPlayEvents(ctx.state, ctx.playerId, [ctx.baseIndex], BASE_THE_GAUNTLET, ctx.now),
    };
}

export function registerMunchkinWarriorsAbilities(): void {
    registerAbility(BIG_HERO, 'talent', bigHeroTalent);
    registerAbility(BERSERKER, 'onPlay', berserkerOnPlay);
    registerAbility(TAUNTER, 'onPlay', taunterOnPlay);
    registerAbility(CAMPAIGN, 'onPlay', campaignOnPlay);
    registerAbility(CLEAVE, 'onPlay', cleaveOnPlay);
    registerAbility(DUNGEON_BAIT, 'onPlay', dungeonBaitOnPlay);
    registerAbility(RUCKUS, 'onPlay', ruckusOnPlay);
    registerAbility(WAR_CRY, 'onPlay', warCryOnPlay);

    registerTrigger(STAR_PLAYER, 'onMonsterDestroyed', monsterDefeatedTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger(ETERNAL_HERO, 'onMinionDestroyed', eternalHeroReplacement, {
        phase: 'replacement',
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: eternalHeroCanTrigger,
    });
    registerTrigger(ETERNAL_HERO, 'onMinionDiscardedFromBase', eternalHeroReplacement, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
        canTrigger: eternalHeroCanTrigger,
    });

    registerExtended(BASE_BASTION, 'onMonsterDestroyed', bastionAfterMonsterDestroyed, {
        canTrigger: ctx => ctx.destroyerId === ctx.playerId,
    });
    registerExtended(BASE_THE_GAUNTLET, 'onMonsterDestroyed', gauntletAfterMonsterDestroyed, {
        canTrigger: ctx => Boolean(ctx.state.monsterDeck?.length),
    });
}

export function registerMunchkinWarriorsInteractionHandlers(): void {
    registerInteractionHandler(BIG_HERO_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as BigHeroModeData | undefined;
        const choice = value as ModeChoice | undefined;
        if (!data?.sourceCardUid || data.sourceBaseIndex === undefined || !choice?.mode || !isSourceMinionValid(state.core, playerId, data.sourceBaseIndex, data.sourceCardUid, BIG_HERO)) {
            return { state, events: [] };
        }
        if (choice.mode === 'playMonster') {
            if (!state.core.monsterDeck?.length) return { state, events: [] };
            return { state, events: buildMonsterPlayEvents(state.core, playerId, [data.sourceBaseIndex], BIG_HERO, timestamp) };
        }
        const options = buildMonsterOptions(state.core, data.sourceBaseIndex);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MonsterChoice>(
            `${BIG_HERO_MONSTER_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '大英雄：选择要摧毁的怪物',
            options,
            { sourceId: BIG_HERO_MONSTER_SOURCE_ID, targetType: 'monster', titleKey: 'ui.munchkin_warriors_big_hero_monster_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: BIG_HERO, cardUid: data.sourceCardUid } },
        );
        interaction.data = { ...interaction.data, sourceCardUid: data.sourceCardUid, sourceBaseIndex: data.sourceBaseIndex } satisfies SourceData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildMonsterOptions(latestState.core as SmashUpCore, data.sourceBaseIndex);
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler(BIG_HERO_MONSTER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as MonsterChoice | undefined;
        if (!data?.sourceCardUid || data.sourceBaseIndex === undefined || !choice?.monsterUid || choice.baseIndex === undefined) return { state, events: [] };
        if (!isSourceMinionValid(state.core, playerId, data.sourceBaseIndex, data.sourceCardUid, BIG_HERO) || choice.baseIndex !== data.sourceBaseIndex) return { state, events: [] };
        const monster = state.core.bases[choice.baseIndex]?.monsters?.find(candidate => candidate.uid === choice.monsterUid && isMonsterUncontrolled(candidate));
        if (!monster) return { state, events: [] };
        return { state, events: [buildMonsterDefeatEventAtBase(state.core, playerId, choice.baseIndex, monster, BIG_HERO, timestamp)] };
    });

    registerInteractionHandler(BERSERKER_MONSTER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as MonsterChoice | undefined;
        if (!data?.sourceCardUid || data.sourceBaseIndex === undefined || !choice?.monsterUid || choice.baseIndex !== data.sourceBaseIndex) return { state, events: [] };
        const source = state.core.bases[data.sourceBaseIndex]?.minions.find(minion => minion.uid === data.sourceCardUid);
        const monster = state.core.bases[data.sourceBaseIndex]?.monsters?.find(candidate => candidate.uid === choice.monsterUid && isMonsterUncontrolled(candidate));
        if (!source || source.defId !== BERSERKER || source.controller !== playerId || !monster) return { state, events: [] };
        const monsterPower = getMunchkinSpecialCardDescriptor(monster.defId)?.power ?? 0;
        if (monsterPower > getEffectivePower(state.core, source, data.sourceBaseIndex)) return { state, events: [] };
        return {
            state,
            events: [
                buildMonsterDefeatEventAtBase(state.core, playerId, data.sourceBaseIndex, monster, BERSERKER, timestamp),
                addPowerCounter(source.uid, data.sourceBaseIndex, 1, BERSERKER, timestamp),
            ],
        };
    });

    registerInteractionHandler(TAUNTER_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as ModeChoice | undefined;
        if (choice?.skip || !data?.sourceCardUid || data.sourceBaseIndex === undefined) return { state, events: [] };
        if (choice.mode !== 'playMonster' || !isSourceMinionValid(state.core, playerId, data.sourceBaseIndex, data.sourceCardUid, TAUNTER) || !state.core.monsterDeck?.length) return { state, events: [] };
        return { state, events: buildMonsterPlayEvents(state.core, playerId, [data.sourceBaseIndex], TAUNTER, timestamp) };
    });

    registerInteractionHandler(DUNGEON_BAIT_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as DungeonBaitModeData | undefined;
        const choice = value as ModeChoice | undefined;
        if (!data?.sourceCardUid || !choice?.mode) return { state, events: [] };
        if (choice.mode === 'playMonster') {
            const options = state.core.bases.map((base, baseIndex) => ({ baseIndex, label: baseName(base.defId) }));
            const interaction = createSimpleChoice<BaseChoice>(
                `${DUNGEON_BAIT_BASE_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
                playerId,
                '地牢诱饵：选择打出怪物的基地',
                buildBaseTargetOptions(options, state.core),
                { sourceId: DUNGEON_BAIT_BASE_SOURCE_ID, targetType: 'base', titleKey: 'ui.munchkin_warriors_dungeon_bait_base_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: DUNGEON_BAIT, cardUid: data.sourceCardUid } },
            );
            interaction.data = { ...interaction.data, sourceCardUid: data.sourceCardUid } satisfies SourceData & Record<string, unknown>;
            return { state: queueInteraction(state, interaction), events: [] };
        }
        const options = buildMinionOptions(state.core, 2, undefined, playerId);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice>(
            `${DUNGEON_BAIT_MINION_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '地牢诱饵：选择力量 2 或更少的仆从',
            options,
            { sourceId: DUNGEON_BAIT_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_warriors_dungeon_bait_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: DUNGEON_BAIT, cardUid: data.sourceCardUid } },
        );
        interaction.data = { ...interaction.data, sourceCardUid: data.sourceCardUid } satisfies SourceData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildMinionOptions(latestState.core as SmashUpCore, 2, undefined, playerId);
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler(DUNGEON_BAIT_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as BaseChoice | undefined;
        if (!data?.sourceCardUid || choice?.baseIndex === undefined || !state.core.monsterDeck?.length) return { state, events: [] };
        return { state, events: buildMonsterPlayEvents(state.core, playerId, [choice.baseIndex], DUNGEON_BAIT, timestamp) };
    });

    registerInteractionHandler(DUNGEON_BAIT_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as MinionChoice | undefined;
        if (!data?.sourceCardUid || !choice?.minionUid || choice.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid && getEffectivePower(state.core, minion, choice.baseIndex!) <= 2);
        if (!target) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                reason: DUNGEON_BAIT,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: data.sourceCardUid,
                sourceDefId: DUNGEON_BAIT,
                sourceControllerId: playerId,
                sourceBaseIndex: choice.baseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler(CLEAVE_MONSTER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as MonsterChoice | undefined;
        if (!data?.sourceCardUid || !choice?.monsterUid || choice.baseIndex === undefined) return { state, events: [] };
        const monster = state.core.bases[choice.baseIndex]?.monsters?.find(candidate => candidate.uid === choice.monsterUid && isMonsterUncontrolled(candidate));
        if (!monster) return { state, events: [] };
        return { state, events: [buildMonsterDefeatEventAtBase(state.core, playerId, choice.baseIndex, monster, CLEAVE, timestamp, { grantTreasureExtraPlay: true })] };
    });

    registerInteractionHandler(RUCKUS_BASE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as BaseChoice | undefined;
        if (!data?.sourceCardUid || choice?.baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[choice.baseIndex];
        if (!base) return { state, events: [] };
        const modes = [
            ...((state.core.monsterDeck?.length ?? 0) >= 2 ? [{ mode: 'playTwo' as const, label: '在那里打出两个怪物' }] : []),
            ...((base.monsters ?? []).length > 0 ? [{ mode: 'destroyAll' as const, label: '摧毁那里所有怪物' }] : []),
        ];
        if (modes.length === 0) return { state, events: [] };
        return {
            state: queueModeChoice(
                state,
                `${RUCKUS_MODE_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
                playerId,
                '骚乱：选择效果',
                buildModeOptions(modes),
                RUCKUS_MODE_SOURCE_ID,
                'ui.munchkin_warriors_ruckus_mode_title',
                { sourceCardUid: data.sourceCardUid, baseIndex: choice.baseIndex } satisfies RuckusModeData,
            ),
            events: [],
        };
    });

    registerInteractionHandler(RUCKUS_MODE_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as RuckusModeData | undefined;
        const choice = value as ModeChoice | undefined;
        if (!data?.sourceCardUid || data.baseIndex === undefined || !choice?.mode) return { state, events: [] };
        const base = state.core.bases[data.baseIndex];
        if (!base) return { state, events: [] };
        if (choice.mode === 'playTwo') {
            if ((state.core.monsterDeck?.length ?? 0) < 2) return { state, events: [] };
            return { state, events: buildMonsterPlayEvents(state.core, playerId, [data.baseIndex, data.baseIndex], RUCKUS, timestamp) };
        }
        const monsters = (base.monsters ?? []).filter(monster => isMonsterUncontrolled(monster) || monster.controllerId !== undefined);
        return {
            state,
            events: monsters.map(monster => buildMonsterDefeatEventAtBase(
                state.core,
                playerId,
                data.baseIndex!,
                monster,
                RUCKUS,
                timestamp,
                { suppressTreasureReward: true },
            )),
        };
    });

    registerInteractionHandler(WAR_CRY_MONSTER_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as SourceData | undefined;
        const choice = value as MonsterChoice | undefined;
        if (!data?.sourceCardUid || !choice?.monsterUid || choice.baseIndex === undefined) return { state, events: [] };
        const monster = state.core.bases[choice.baseIndex]?.monsters?.find(candidate => candidate.uid === choice.monsterUid && isMonsterUncontrolled(candidate));
        if (!monster) return { state, events: [] };
        const minionOptions = state.core.bases[choice.baseIndex]?.minions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: choice.baseIndex!,
            label: cardName(minion.defId),
        })) ?? [];
        const options = buildMinionTargetOptions(minionOptions, {
            state: state.core,
            sourcePlayerId: playerId,
            sourceDefId: WAR_CRY,
            sourceKind: 'action',
            effectType: 'power_change',
        });
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<MinionChoice>(
            `${WAR_CRY_MINION_SOURCE_ID}_${data.sourceCardUid}_${timestamp}`,
            playerId,
            '战争怒吼：选择该基地上的一个仆从',
            options,
            { sourceId: WAR_CRY_MINION_SOURCE_ID, targetType: 'minion', titleKey: 'ui.munchkin_warriors_war_cry_minion_title', responseValidationMode: 'live', autoRefresh: 'field', autoResolveIfSingle: false, displayCard: { defId: WAR_CRY, cardUid: data.sourceCardUid } },
        );
        interaction.data = { ...interaction.data, sourceCardUid: data.sourceCardUid, monsterUid: monster.uid, monsterDefId: monster.defId, monsterPower: getMunchkinSpecialCardDescriptor(monster.defId)?.power ?? 0, baseIndex: choice.baseIndex } satisfies WarCryData & Record<string, unknown>;
        interaction.data.optionsGenerator = latestState => buildMinionTargetOptions(
            (latestState.core as SmashUpCore).bases[choice.baseIndex!]?.minions.map(minion => ({ uid: minion.uid, defId: minion.defId, baseIndex: choice.baseIndex!, label: cardName(minion.defId) })) ?? [],
            { state: latestState.core as SmashUpCore, sourcePlayerId: playerId, sourceDefId: WAR_CRY, sourceKind: 'action', effectType: 'power_change' },
        );
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler(WAR_CRY_MINION_SOURCE_ID, (state, playerId, value, interactionData, _random, timestamp) => {
        const data = interactionData as WarCryData | undefined;
        const choice = value as MinionChoice | undefined;
        if (!data?.sourceCardUid || data.baseIndex === undefined || !data.monsterUid || !choice?.minionUid || choice.baseIndex !== data.baseIndex) return { state, events: [] };
        const monster = state.core.bases[data.baseIndex]?.monsters?.find(candidate => candidate.uid === data.monsterUid && isMonsterUncontrolled(candidate));
        const target = state.core.bases[data.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!monster || !target) return { state, events: [] };
        return {
            state,
            events: [
                buildMonsterDefeatEventAtBase(state.core, playerId, data.baseIndex, monster, WAR_CRY, timestamp),
                addTempPower(target.uid, data.baseIndex, data.monsterPower ?? 0, WAR_CRY, timestamp, {
                    sourcePlayerId: playerId,
                    sourceCardUid: data.sourceCardUid,
                    sourceDefId: WAR_CRY,
                    sourceControllerId: playerId,
                    sourceBaseIndex: data.baseIndex,
                }),
            ],
        };
    });
}
