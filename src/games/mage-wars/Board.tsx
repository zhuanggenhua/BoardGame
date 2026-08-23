import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { CardPreview } from '../../components/common/media/CardPreview';
import { BoardDamageStateOverlay } from '../../components/common/animations/BoardDamageStateOverlay';
import { FxLayer, useFxAnchorRegistry, useFxBus, type FxAnchorRegistry, type FxBus } from '../../engine/fx';
import { useRenderPipelineSettings } from '../../engine/renderPipeline';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import {
    projectChoiceRequestToDirectSelectionTargets,
    type ChoiceRequestDirectSelectionTarget,
} from '../../engine/systems';
import {
    INTERACTION_COMMANDS,
    asSimpleChoice,
    type InteractionDescriptor,
} from '../../engine/systems/InteractionSystem';
import { buildChoiceRequestFromOpportunity } from '../../engine/TimingOpportunity';
import type { PlayerId } from '../../engine/types';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import {
    MAGE_WARS_OBJECT_ABILITY_IDS,
    getMageWarsWallEdgeId,
    type ArenaZoneId,
    type MageWarsMageAbilityId,
    type MageWarsObjectAbilityId,
    type MageWarsWallEdgeId,
} from './domain/ids';
import {
    MAGE_WARS_COMMANDS,
    type MageWarsArenaObjectState,
    type MageWarsCastSpellCommand,
    type MageWarsCore,
    type MageWarsPlayerState,
} from './domain';
import {
    getPresetMageSetupFromConfig,
    getPresetSpellbookCardIdsFromConfig,
    getMageWarsMageAbilityFromConfig,
    getMageWarsSpellCardFromConfig,
} from './data/configPackage';
import { areAdjacentZones, doesMageWarsWallBlockLineOfSight, isArenaZoneId } from './domain/utils';
import { mageWarsObjectAbilityRegistry } from './domain/abilityCatalog';
import {
    buildMageWarsObjectAbilityActivationOpportunity,
    type MageWarsObjectAbilityActivationChoiceValue,
} from './domain/objectAbilityRuntime';
import {
    buildMageWarsMageAbilityActivationOpportunity,
    resolveMageWarsPriestessRestoreAbilityIdForPhase,
    type MageWarsMageAbilityActivationChoiceValue,
} from './domain/mageAbilityRuntime';
import {
    buildMageWarsSpellCastOpportunity,
    type MageWarsSpellCastChoiceValue,
} from './domain/spellCastRuntime';
import {
    getMageWarsMagePreviewRef,
    getMageWarsSpellCardAspectRatio,
    getMageWarsSpellCardName,
    getMageWarsSpellCardPreviewRef,
} from './ui/cardAtlas';
import { mageWarsFxRegistry } from './ui/fxSetup';
import {
    mageWarsObjectDamageKey,
    mageWarsPlayerDamageKey,
    useMageWarsGameEvents,
    MAGE_WARS_ARENA_FX_SURFACE_ID,
} from './ui/useGameEvents';
import {
    canMageWarsObjectUsePostMoveQuickAction,
    getMageWarsObjectAttackProfiles,
    hasMageWarsStunStatus,
    isMageWarsArenaObjectRestrained,
    isMageWarsObjectAttackTargetInRange,
    resolveMageWarsObjectEffectiveLife,
    type MageWarsObjectAttackProfile,
} from './domain/spellRules';

type Props = GameBoardProps<MageWarsCore>;

type ZoneRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type WallEdgeDescriptor = {
    edgeId: MageWarsWallEdgeId;
    zoneIds: [ArenaZoneId, ArenaZoneId];
    orientation: 'vertical' | 'horizontal';
    style: CSSProperties;
};

const TOKEN_IMAGES = {
    actionReady: 'mage-wars/tokens/action/ready-token-front',
    actionSpent: 'mage-wars/tokens/action/ready-token-back',
    quickcastReady: 'mage-wars/tokens/quickcast/quickcast-marker-front',
    quickcastSpent: 'mage-wars/tokens/quickcast/quickcast-marker-back',
    guard: 'mage-wars/tokens/status/guard-token',
    burn: 'mage-wars/tokens/status/burn-token',
    daze: 'mage-wars/tokens/status/daze-token',
    weak: 'mage-wars/tokens/status/weak-token',
    cripple: 'mage-wars/tokens/status/cripple-token',
    rot: 'mage-wars/tokens/status/rot-token',
    stun: 'mage-wars/tokens/status/stun-token',
    sleep: 'mage-wars/tokens/status/sleep-token',
    channeling: 'mage-wars/tokens/channeling/channeling-token-front',
} as const;

const VISIBLE_STATUS_TOKENS = [
    { id: 'burn', image: TOKEN_IMAGES.burn, labelKey: 'tokens.burn' },
    { id: 'daze', image: TOKEN_IMAGES.daze, labelKey: 'tokens.daze' },
    { id: 'weak', image: TOKEN_IMAGES.weak, labelKey: 'tokens.weak' },
    { id: 'cripple', image: TOKEN_IMAGES.cripple, labelKey: 'tokens.cripple' },
    { id: 'rot', image: TOKEN_IMAGES.rot, labelKey: 'tokens.rot' },
    { id: 'stun', image: TOKEN_IMAGES.stun, labelKey: 'tokens.stun' },
    { id: 'sleep', image: TOKEN_IMAGES.sleep, labelKey: 'tokens.sleep' },
] as const;

type VisibleStatusTokenId = (typeof VISIBLE_STATUS_TOKENS)[number]['id'];

const MAGE_WARS_LIFE_BADGE_CONTAINER_STYLE = {
    containerType: 'inline-size',
} as CSSProperties;

const MAGE_WARS_LIFE_BADGE_STYLE: CSSProperties = {
    fontSize: 'clamp(15px, 30cqw, 32px)',
    lineHeight: 0.95,
    paddingInline: '0.18em',
    paddingBlock: '0.04em',
    boxShadow: '0 2px 8px rgba(0,0,0,0.65)',
    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
};

const getVisibleStatusTokenLabel = (
    t: ReturnType<typeof useTranslation>['t'],
    statusTokenId: VisibleStatusTokenId,
) => {
    switch (statusTokenId) {
        case 'burn': return t('tokens.burn');
        case 'daze': return t('tokens.daze');
        case 'weak': return t('tokens.weak');
        case 'cripple': return t('tokens.cripple');
        case 'rot': return t('tokens.rot');
        case 'stun': return t('tokens.stun');
        case 'sleep': return t('tokens.sleep');
    }
};

const SPELL_CARD_BACK = 'mage-wars/cards/backs/spell-card-back';
const SPELL_CARD_BACK_ASPECT_RATIO = 992 / 1391;

const ZONE_RECTS: Record<ArenaZoneId, ZoneRect> = {
    a1: { left: 0, top: 0, width: 25, height: 33.3333 },
    b1: { left: 25, top: 0, width: 25, height: 33.3333 },
    c1: { left: 50, top: 0, width: 25, height: 33.3333 },
    d1: { left: 75, top: 0, width: 25, height: 33.3333 },
    a2: { left: 0, top: 33.3333, width: 25, height: 33.3333 },
    b2: { left: 25, top: 33.3333, width: 25, height: 33.3333 },
    c2: { left: 50, top: 33.3333, width: 25, height: 33.3333 },
    d2: { left: 75, top: 33.3333, width: 25, height: 33.3333 },
    a3: { left: 0, top: 66.6666, width: 25, height: 33.3333 },
    b3: { left: 25, top: 66.6666, width: 25, height: 33.3333 },
    c3: { left: 50, top: 66.6666, width: 25, height: 33.3333 },
    d3: { left: 75, top: 66.6666, width: 25, height: 33.3333 },
};

const WALL_EDGE_THICKNESS = 2.3;

function buildMageWarsWallEdgeDescriptors(core: MageWarsCore): WallEdgeDescriptor[] {
    return core.arena.flatMap((zone) => {
        const rect = ZONE_RECTS[zone.id];
        const right = core.arena.find((candidate) => candidate.row === zone.row && candidate.col === zone.col + 1);
        const down = core.arena.find((candidate) => candidate.row === zone.row + 1 && candidate.col === zone.col);
        const descriptors: WallEdgeDescriptor[] = [];

        if (right) {
            descriptors.push({
                edgeId: getMageWarsWallEdgeId(zone.id, right.id),
                zoneIds: [zone.id, right.id],
                orientation: 'vertical',
                style: {
                    left: pct(rect.left + rect.width - (WALL_EDGE_THICKNESS / 2)),
                    top: pct(rect.top + 1.2),
                    width: pct(WALL_EDGE_THICKNESS),
                    height: pct(rect.height - 2.4),
                },
            });
        }
        if (down) {
            descriptors.push({
                edgeId: getMageWarsWallEdgeId(zone.id, down.id),
                zoneIds: [zone.id, down.id],
                orientation: 'horizontal',
                style: {
                    left: pct(rect.left + 1.2),
                    top: pct(rect.top + rect.height - (WALL_EDGE_THICKNESS / 2)),
                    width: pct(rect.width - 2.4),
                    height: pct(WALL_EDGE_THICKNESS),
                },
            });
        }

        return descriptors;
    });
}

const CAST_PHASES = new Set(['deployment', 'initiativeQuickcast', 'creatureAction', 'finalQuickcast']);
const SIMULTANEOUS_PREPARATION_PHASES = new Set(['reset', 'channel', 'upkeep', 'planning']);

type SpellbookCategoryId = 'all' | 'attack' | 'enchantment' | 'creature' | 'incantation' | 'equipment';

type FieldCardRole = 'source' | 'target';
type ZoneEntityDensity = 'solo' | 'duel' | 'dense' | 'packed';
type SeatOwnerSide = 'seat-left' | 'seat-right' | 'neutral';
type PendingObjectAbilitySelection = {
    objectId: string;
    abilityId: MageWarsObjectAbilityId;
};
type PendingMageAbilitySelection = {
    playerId: PlayerId;
    abilityId: MageWarsMageAbilityId;
};
type PendingSpellCastSelection =
    | { kind: 'object'; objectId: string; chainTargetObjectIds: string[] }
    | { kind: 'player'; playerId: PlayerId };

const MAGE_WARS_OBJECT_ABILITY_ID_LIST = Object.values(MAGE_WARS_OBJECT_ABILITY_IDS) as MageWarsObjectAbilityId[];

function getMageWarsObjectAbilityButtonTestId(abilityId: MageWarsObjectAbilityId): string {
    if (abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT) {
        return 'mage-wars-selected-object-ability-healing-light';
    }
    return `mage-wars-selected-object-ability-${abilityId.replace(/[^a-z0-9]+/gi, '-')}`;
}

function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}
function pct(value: number): string {
    return `${value}%`;
}

function isPlayerId(value: string | null | undefined): value is PlayerId {
    return value != null;
}

function resolveMageWarsPhaseActorId(core: MageWarsCore): PlayerId {
    return core.phaseActorId ?? core.currentPlayerId;
}

function isMageWarsAttachmentObject(object: MageWarsArenaObjectState): boolean {
    if (object.kind === 'equipment') {
        return object.anchoredToPlayerId !== undefined || object.anchoredToObjectId !== undefined;
    }
    if (object.kind !== 'enchantment') return false;
    return object.anchoredToPlayerId !== undefined
        || object.anchoredToObjectId !== undefined
        || object.anchoredToZoneId !== undefined;
}

function isMageWarsMageAttachmentObject(
    object: MageWarsArenaObjectState,
    playerId: PlayerId,
): boolean {
    return isMageWarsAttachmentObject(object) && object.anchoredToPlayerId === playerId;
}

function isMageWarsObjectAttachmentObject(
    object: MageWarsArenaObjectState,
    hostObjectId: string,
): boolean {
    return isMageWarsAttachmentObject(object) && object.anchoredToObjectId === hostObjectId;
}

function isMageWarsZoneAttachmentObject(
    object: MageWarsArenaObjectState,
    zoneId: ArenaZoneId,
): boolean {
    return isMageWarsAttachmentObject(object) && object.anchoredToZoneId === zoneId;
}

function resolveViewingPlayerId(core: MageWarsCore, playerID: string | null): PlayerId {
    if (isPlayerId(playerID) && core.players[playerID]) return playerID;
    return core.currentPlayerId;
}

function resolveOpponentId(core: MageWarsCore, playerId: PlayerId): PlayerId | null {
    return core.playerOrder.find((candidate) => candidate !== playerId) ?? null;
}

function resolveSeatOwnerSide(core: MageWarsCore, playerId: PlayerId | undefined): SeatOwnerSide {
    if (playerId == null) return 'neutral';
    const seatIndex = core.playerOrder.indexOf(playerId);
    if (seatIndex === 0) return 'seat-left';
    if (seatIndex === 1) return 'seat-right';
    return 'neutral';
}

function getMageDisplayLabel(player: MageWarsPlayerState): string {
    return getPresetMageSetupFromConfig(player.mageId).displayName;
}

function getZoneFieldCardOffsetStyle(zoneId: ArenaZoneId, hasFieldCards: boolean): CSSProperties | undefined {
    if (!hasFieldCards) return undefined;

    const offsets: Partial<Record<ArenaZoneId, { x: number; y: number }>> = {
        a1: { x: 70, y: 0 },
        a2: { x: 70, y: 0 },
        a3: { x: 70, y: 0 },
        b1: { x: 45, y: 0 },
        b2: { x: 45, y: 0 },
        b3: { x: 45, y: 0 },
        c1: { x: -45, y: 0 },
        c2: { x: -45, y: 0 },
        c3: { x: -45, y: 0 },
        d1: { x: -70, y: 0 },
        d2: { x: -70, y: 0 },
        d3: { x: -70, y: 0 },
    };
    const offset = offsets[zoneId];

    return offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined;
}

function TokenImage({
    src,
    alt,
    className,
}: {
    src: string;
    alt: string;
    className?: string;
}) {
    return (
        <OptimizedImage
            src={src}
            alt={alt}
            className={cx('object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]', className)}
            placeholder={false}
        />
    );
}

function EntityStatusTokenRail({
    guarding,
    statusTokens,
    compact = false,
}: {
    guarding?: boolean;
    statusTokens: MageWarsArenaObjectState['statusTokens'] | MageWarsPlayerState['statusTokens'];
    compact?: boolean;
}) {
    const { t } = useTranslation('game-mage-wars');
    const visibleStatusTokens = VISIBLE_STATUS_TOKENS
        .map(({ id, image }) => ({
            id,
            image,
            count: statusTokens[id] ?? 0,
        }))
        .filter((token) => token.count > 0);

    if (!guarding && visibleStatusTokens.length === 0) return null;

    return (
        <div className={cx(
            'pointer-events-none absolute z-30 flex items-center gap-1',
            compact
                ? 'left-1/2 top-full mt-0.5 -translate-x-1/2 scale-[0.72] origin-top'
                : 'left-1/2 top-full mt-1 -translate-x-1/2',
        )}
            data-testid="mage-wars-entity-status-token-rail"
        >
            {guarding ? (
                <TokenImage src={TOKEN_IMAGES.guard} alt={t('tokens.guard')} className="h-7 w-7" />
            ) : null}
            {visibleStatusTokens.map(({ id, image, count }) => (
                <span
                    key={id}
                    className="inline-flex items-center gap-0.5 rounded-full bg-black/62 px-1 py-0.5 text-[0.62rem] font-bold text-amber-50 shadow-[0_4px_12px_rgba(0,0,0,0.38)]"
                >
                    <TokenImage src={image} alt={getVisibleStatusTokenLabel(t, id)} className="h-5 w-5" />
                    {count > 1 ? count : null}
                </span>
            ))}
        </div>
    );
}

function MageWarsGuardTokenAction({
    onGuard,
    compact = false,
}: {
    onGuard: () => void;
    compact?: boolean;
}) {
    const { t } = useTranslation('game-mage-wars');

    return (
        <button
            type="button"
            className={cx(
                'pointer-events-auto absolute left-1/2 top-full z-40 -translate-x-1/2 rounded-full bg-transparent p-0 transition-[filter,transform] hover:scale-105 hover:drop-shadow-[0_0_12px_rgba(110,231,183,0.78)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100',
                compact ? 'mt-0.5 h-7 w-7' : 'mt-1 h-9 w-9',
            )}
            aria-label={t('actions.guard')}
            title={t('actions.guard')}
            data-testid="mage-wars-selected-unit-guard"
            data-mage-wars-guard-action-placement="bottom-center"
            style={{
                left: '50%',
                top: '100%',
                transform: 'translateX(-50%)',
            }}
            onClick={(event) => {
                event.stopPropagation();
                onGuard();
            }}
        >
            <TokenImage src={TOKEN_IMAGES.guard} alt={t('tokens.guard')} className={compact ? 'h-7 w-7' : 'h-8 w-8'} />
        </button>
    );
}

function MageWarsLifeDamageReadout({
    damage,
    life,
    testId,
    showLifeTotals,
}: {
    damage: number;
    life: number;
    testId: string;
    showLifeTotals: boolean;
}) {
    if (life <= 0) return null;

    const remaining = Math.max(0, life - damage);
    const damageRatio = Math.min(1, Math.max(0, damage / life));

    return (
        <div
            aria-hidden="true"
            className={cx(
                'pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity',
                showLifeTotals ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            data-testid={testId}
            data-damage={damage}
            data-life={life}
            data-life-remaining={remaining}
            data-life-visible={showLifeTotals ? 'true' : 'false'}
            data-damage-ratio={damageRatio.toFixed(3)}
            style={MAGE_WARS_LIFE_BADGE_CONTAINER_STYLE}
        >
            <span
                className={cx(
                    'rounded font-bold',
                    damage > 0 ? 'bg-red-900/80 text-red-200' : 'bg-black/60 text-white',
                )}
                data-testid={`${testId}-text`}
                style={MAGE_WARS_LIFE_BADGE_STYLE}
            >
                {remaining}/{life}
            </span>
        </div>
    );
}

function MageWarsLifeVisibilityIcon() {
    return (
        <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
        >
            <path
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

function MageWarsLifeToggle({
    pressed,
    onToggle,
    className,
}: {
    pressed: boolean;
    onToggle: () => void;
    className?: string;
}) {
    const { t } = useTranslation('game-mage-wars');
    const label = t(pressed ? 'ui.hideAllLifeTotals' : 'ui.showAllLifeTotals');

    return (
        <button
            type="button"
            className={cx(
                'pointer-events-auto absolute z-30 flex h-10 w-10 items-center justify-center rounded-lg border text-white shadow-lg transition-[background-color,border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-amber-200/80',
                pressed
                    ? 'border-amber-300/70 bg-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                    : 'border-white/20 bg-black/70 hover:border-amber-300/60 hover:bg-slate-800/90',
                className,
            )}
            aria-label={label}
            aria-pressed={pressed}
            title={label}
            data-testid="mage-wars-life-toggle"
            data-life-visible={pressed ? 'true' : 'false'}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggle();
            }}
        >
            <MageWarsLifeVisibilityIcon />
        </button>
    );
}

function isCreatureActionPhase(phase: string): boolean {
    return phase === 'creatureAction';
}

function isMageWarsActionableCreatureObject(
    object: MageWarsArenaObjectState | undefined,
    ownerId: PlayerId | undefined,
): object is MageWarsArenaObjectState {
    return Boolean(
        object
        && ownerId
        && object.ownerId === ownerId
        && object.kind === 'creature'
        && !hasMageWarsStunStatus(object),
    );
}

function canMageWarsObjectStartAction(
    object: MageWarsArenaObjectState | undefined,
    ownerId: PlayerId | undefined,
): object is MageWarsArenaObjectState {
    if (!isMageWarsActionableCreatureObject(object, ownerId)) return false;
    if (object.actionReady) return true;
    return getMageWarsObjectAttackProfiles(object)
        .some((profile) => canMageWarsObjectUsePostMoveQuickAction(object, profile));
}

function hasEnabledChoiceCandidate(candidates: readonly { disabled?: boolean; stale?: boolean }[] | undefined): boolean {
    return candidates?.some((candidate) => candidate.disabled !== true && candidate.stale !== true) === true;
}

function compareMageAbilityTargets(
    left: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>,
    right: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>,
): number {
    const leftStatusCount = left.value?.statusTokenIds.length ?? 0;
    const rightStatusCount = right.value?.statusTokenIds.length ?? 0;
    if (leftStatusCount !== rightStatusCount) return rightStatusCount - leftStatusCount;

    const leftManaCost = left.value?.manaCost ?? 0;
    const rightManaCost = right.value?.manaCost ?? 0;
    if (leftManaCost !== rightManaCost) return rightManaCost - leftManaCost;

    return left.id.localeCompare(right.id);
}

function buildMageAbilityTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || typeof target.targetRef !== 'string') continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort(compareMageAbilityTargets);
    }
    return map;
}

function compareObjectAbilityTargets(
    left: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
    right: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
): number {
    const modeRank = (mode: MageWarsObjectAbilityActivationChoiceValue['mode']): number => {
        if (mode === 'melee-bonus') return 0;
        if (mode === 'heal') return 1;
        return 2;
    };
    const leftModeRank = modeRank(left.value?.mode);
    const rightModeRank = modeRank(right.value?.mode);
    if (leftModeRank !== rightModeRank) return leftModeRank - rightModeRank;
    return left.id.localeCompare(right.id);
}

function buildObjectAbilityTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || typeof target.targetRef !== 'string') continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort(compareObjectAbilityTargets);
    }
    return map;
}

function buildSpellCastTargetsByObjectId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<string, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<string, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const objectId = readMageWarsCastSpellPayload(target)?.targetObjectId;
        if (!objectId) continue;
        const current = map.get(objectId) ?? [];
        current.push(target);
        map.set(objectId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

function buildSpellCastTargetsByPlayerId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<PlayerId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<PlayerId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const playerId = readMageWarsCastSpellPayload(target)?.targetPlayerId;
        if (!playerId) continue;
        const current = map.get(playerId) ?? [];
        current.push(target);
        map.set(playerId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

function buildSpellCastTargetsByZoneId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<ArenaZoneId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<ArenaZoneId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale || !isArenaZoneId(target.targetRef)) continue;
        const current = map.get(target.targetRef) ?? [];
        current.push(target);
        map.set(target.targetRef, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

function buildSpellCastTargetsByWallEdgeId(
    targets: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[] | undefined,
): Map<MageWarsWallEdgeId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]> {
    const map = new Map<MageWarsWallEdgeId, ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[]>();
    for (const target of targets ?? []) {
        if (target.disabled || target.stale) continue;
        const payload = readMageWarsCastSpellPayload(target);
        const edgeId = payload?.targetWallEdgeId;
        if (!edgeId) continue;
        const current = map.get(edgeId) ?? [];
        current.push(target);
        map.set(edgeId, current);
    }
    for (const groupedTargets of map.values()) {
        groupedTargets.sort((left, right) => left.id.localeCompare(right.id));
    }
    return map;
}

function readMageWarsCastSpellPayload(
    targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
): MageWarsCastSpellCommand['payload'] | null {
    const command = targetSelection.commandPreview.find((candidateCommand) => (
        candidateCommand.type === MAGE_WARS_COMMANDS.CAST_SPELL
    ));
    if (!command || !command.payload || typeof command.payload !== 'object') return null;
    return command.payload as MageWarsCastSpellCommand['payload'];
}

function readMageWarsCastSpellChainObjectIds(
    targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
): string[] {
    const payload = readMageWarsCastSpellPayload(targetSelection);
    if (!payload?.targetObjectId) return [];
    return [
        payload.targetObjectId,
        ...(payload.chainLightningTargets ?? []).map((target) => target.targetObjectId),
    ];
}

function startsWithObjectPath(path: readonly string[], prefix: readonly string[]): boolean {
    return prefix.length <= path.length && prefix.every((objectId, index) => path[index] === objectId);
}

function hasSameObjectPath(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && startsWithObjectPath(left, right);
}

function buildNonEmptySet<T>(values: Iterable<T>): Set<T> | undefined {
    const set = new Set(values);
    return set.size > 0 ? set : undefined;
}

function isMageWarsObjectAttackTargetSelectable(
    core: MageWarsCore,
    attackerZoneId: ArenaZoneId,
    targetZoneId: ArenaZoneId,
    profile: MageWarsObjectAttackProfile,
): boolean {
    if (!isMageWarsObjectAttackTargetInRange(core, attackerZoneId, targetZoneId, profile)) return false;
    return profile.rangeKind !== 'ranged'
        || !doesMageWarsWallBlockLineOfSight(core, attackerZoneId, targetZoneId);
}

function MageStatusBars({ player, visualDamage = player.damage }: { player: MageWarsPlayerState; visualDamage?: number }) {
    const lifeRemaining = Math.max(0, player.life - visualDamage);
    const lifePercent = Math.max(0, Math.min(100, (lifeRemaining / player.life) * 100));
    const manaPercent = Math.max(0, Math.min(100, (player.mana / 20) * 100));

    return (
        <div className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-red-950/70">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-300"
                    style={{ width: `${lifePercent}%` }}
                />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sky-950/70">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-200"
                    style={{ width: `${manaPercent}%` }}
                />
            </div>
        </div>
    );
}

function MageHud({
    player,
    current,
    self,
    role,
    compact = false,
    visualDamage = player.damage,
}: {
    player: MageWarsPlayerState;
    current: boolean;
    self: boolean;
    role?: 'source' | 'target';
    compact?: boolean;
    visualDamage?: number;
}) {
    const { t } = useTranslation('game-mage-wars');
    const lifeRemaining = Math.max(0, player.life - visualDamage);
    const mageLabel = getMageDisplayLabel(player);

    if (!compact) {
        return (
            <section
                className="pointer-events-auto relative flex w-[15.5rem] flex-col items-start gap-2 text-stone-100"
                data-testid={self ? 'mage-wars-mage-hud-self' : 'mage-wars-mage-hud-opponent'}
                data-tutorial-id={self ? 'mw-self-hud' : 'mw-opponent-hud'}
            >
                <div
                    className="relative rounded-[0.2rem]"
                    data-testid="mage-wars-mage-hud-hint-card"
                    data-mage-preview-kind="card"
                    data-mage-ui-role="player-hint-card"
                >
                        <CardPreview
                            previewRef={getMageWarsMagePreviewRef(player.mageId, 'card')}
                            className="h-[10.8rem] w-auto rounded-[0.2rem] shadow-[0_12px_28px_rgba(0,0,0,0.52)]"
                        title={mageLabel}
                        alt={mageLabel}
                    />
                    {current ? (
                        <div
                            className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/72 px-2 py-1 text-[0.68rem] font-black leading-none text-amber-100 shadow-[0_6px_16px_rgba(0,0,0,0.46)]"
                            data-testid="mage-wars-mage-hud-current-badge"
                        >
                            <TokenImage
                                src={player.actionReady ? TOKEN_IMAGES.actionReady : TOKEN_IMAGES.actionSpent}
                                alt={t(player.actionReady ? 'tokens.actionReady' : 'tokens.actionSpent')}
                                className="h-5 w-5"
                            />
                            {t('player.active')}
                        </div>
                    ) : null}
                    {role ? (
                        <span
                            className={cx(
                                'pointer-events-none absolute inset-0 z-10 rounded-[inherit] border shadow-[inset_0_0_0_1px_rgba(251,191,36,0.24),0_0_18px_rgba(251,191,36,0.28)]',
                                role === 'source'
                                    ? 'border-cyan-200/90 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22),0_0_18px_rgba(34,211,238,0.4)]'
                                    : 'border-emerald-300/95 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.24),0_0_18px_rgba(16,185,129,0.42)]',
                            )}
                            data-testid={`mage-wars-mage-hud-${role}-frame`}
                            data-mage-hud-role={role}
                        />
                    ) : null}
                </div>
                <div className="w-full max-w-[14rem]">
                    <div className="flex items-end justify-between gap-2">
                        <div>
                            <div className="text-2xl font-black leading-none text-amber-100 drop-shadow-[0_3px_10px_rgba(0,0,0,0.68)]">
                                {mageLabel}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-stone-100">
                                {self ? t('player.you') : t('player.opponent')}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TokenImage
                                src={player.actionReady ? TOKEN_IMAGES.actionReady : TOKEN_IMAGES.actionSpent}
                                alt={t(player.actionReady ? 'tokens.actionReady' : 'tokens.actionSpent')}
                                className="h-7 w-7"
                            />
                            <TokenImage
                                src={player.quickcastReady ? TOKEN_IMAGES.quickcastReady : TOKEN_IMAGES.quickcastSpent}
                                alt={t(player.quickcastReady ? 'tokens.quickcastReady' : 'tokens.quickcastSpent')}
                                className="h-7 w-7"
                            />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-[2.6rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-2 text-xs font-semibold text-amber-50">
                        <span>{t('stats.life')}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-red-950/70">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-300"
                                style={{ width: `${Math.max(0, Math.min(100, (lifeRemaining / player.life) * 100))}%` }}
                            />
                        </div>
                        <span>{lifeRemaining}</span>
                        <span>{t('stats.mana')}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-sky-950/70">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-200"
                                style={{ width: `${Math.max(0, Math.min(100, (player.mana / 20) * 100))}%` }}
                            />
                        </div>
                        <span>{player.mana}</span>
                        <span>{t('stats.channeling')}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-amber-950/70">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-100"
                                style={{ width: `${Math.max(0, Math.min(100, (player.channeling / 12) * 100))}%` }}
                            />
                        </div>
                        <span>{player.channeling}</span>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            className={cx(
                'relative grid rounded-[0.35rem] bg-gradient-to-r from-black/70 via-black/38 to-transparent',
                compact
                    ? 'grid-cols-[3.1rem_minmax(0,1fr)] gap-2 p-1.5'
                    : 'grid-cols-[4.6rem_minmax(0,1fr)] gap-3 p-2',
                current && 'before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-amber-300/80',
            )}
            data-testid={self ? 'mage-wars-mage-hud-self' : 'mage-wars-mage-hud-opponent'}
            data-tutorial-id={self ? 'mw-self-hud' : 'mw-opponent-hud'}
        >
            <div
                className="relative rounded-[0.2rem]"
                data-testid="mage-wars-mage-hud-hint-card"
                data-mage-preview-kind="card"
                data-mage-ui-role="player-hint-card"
            >
                <CardPreview
                    previewRef={getMageWarsMagePreviewRef(player.mageId, 'card')}
                        className={cx(
                            'rounded-[0.2rem] shadow-[0_8px_22px_rgba(0,0,0,0.48)]',
                            compact ? 'h-16 w-auto' : 'h-24 w-auto',
                    )}
                    title={mageLabel}
                    alt={mageLabel}
                />
                {current ? (
                    <div
                        className="absolute bottom-1 left-1 z-10 inline-flex items-center gap-1 rounded-full bg-black/72 px-1.5 py-0.5 text-[0.54rem] font-black leading-none text-amber-100 shadow-[0_4px_12px_rgba(0,0,0,0.42)]"
                        data-testid="mage-wars-mage-hud-current-badge"
                    >
                        <TokenImage
                            src={player.actionReady ? TOKEN_IMAGES.actionReady : TOKEN_IMAGES.actionSpent}
                            alt={t(player.actionReady ? 'tokens.actionReady' : 'tokens.actionSpent')}
                            className="h-4 w-4"
                        />
                        {t('player.active')}
                    </div>
                ) : null}
                {role ? (
                    <span
                        className={cx(
                            'pointer-events-none absolute inset-0 z-10 rounded-[inherit] border shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2),0_0_14px_rgba(251,191,36,0.24)]',
                            role === 'source'
                                ? 'border-amber-200/80'
                                : 'border-emerald-200/85',
                        )}
                        data-testid={`mage-wars-mage-hud-${role}-frame`}
                        data-mage-hud-role={role}
                    />
                ) : null}
            </div>
            <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-amber-50">
                            {mageLabel}
                        </div>
                        <div className="text-[0.7rem] text-stone-300">
                            {self ? t('player.you') : t('player.opponent')}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <TokenImage
                            src={player.actionReady ? TOKEN_IMAGES.actionReady : TOKEN_IMAGES.actionSpent}
                            alt={t(player.actionReady ? 'tokens.actionReady' : 'tokens.actionSpent')}
                            className={compact ? 'h-5 w-5' : 'h-7 w-7'}
                        />
                        <TokenImage
                            src={player.quickcastReady ? TOKEN_IMAGES.quickcastReady : TOKEN_IMAGES.quickcastSpent}
                            alt={t(player.quickcastReady ? 'tokens.quickcastReady' : 'tokens.quickcastSpent')}
                            className={compact ? 'h-5 w-5' : 'h-7 w-7'}
                        />
                    </div>
                </div>
                <div className="mt-2">
                    <MageStatusBars player={player} visualDamage={visualDamage} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[0.68rem] text-stone-200">
                    <span>{t('stats.lifeShort', { value: lifeRemaining })}</span>
                    <span>{t('stats.manaShort', { value: player.mana })}</span>
                    <span>{t('stats.channelingShort', { value: player.channeling })}</span>
                    <span>{t('stats.damageShort', { value: visualDamage })}</span>
                </div>
            </div>
        </section>
    );
}

function PreparedSpellCard({
    cardId,
    hidden,
    label,
    role,
    compact = false,
    testId,
    preparedScope,
    selected = false,
    disabled = false,
    onClick,
    tutorialId,
}: {
    cardId?: number;
    hidden?: boolean;
    label: string;
    role?: 'source';
    compact?: boolean;
    testId?: string;
    preparedScope?: 'self' | 'opponent';
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    tutorialId?: string;
}) {
    const previewRef = cardId == null || hidden ? null : getMageWarsSpellCardPreviewRef(cardId);
    const title = cardId == null ? label : getMageWarsSpellCardName(cardId) ?? label;
    const showLabel = hidden || cardId == null;
    const cardAspectRatio = cardId == null || hidden
        ? SPELL_CARD_BACK_ASPECT_RATIO
        : getMageWarsSpellCardAspectRatio(cardId) ?? SPELL_CARD_BACK_ASPECT_RATIO;
    const cardSizeClass = compact ? 'h-[5.05rem]' : 'h-[14rem]';
    const cardSizeStyle = { aspectRatio: cardAspectRatio };

    const content = (
        <>
            {previewRef ? (
                <CardPreview
                    previewRef={previewRef}
                    className="h-full w-full rounded-[0.18rem] shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                    title={title}
                />
            ) : hidden ? (
                <OptimizedImage
                    src={SPELL_CARD_BACK}
                    alt={title}
                    className="h-full w-full rounded-[0.18rem] object-cover shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                    placeholder={false}
                />
            ) : (
                <div className="h-full w-full rounded-[0.18rem] border border-dashed border-amber-100/22 bg-stone-950/28 shadow-[inset_0_0_30px_rgba(0,0,0,0.35)]" />
            )}
            {showLabel ? (
                <div
                    className={cx(
                        'absolute inset-x-1 bottom-1 rounded-sm bg-black/65 px-1 py-0.5 text-center text-amber-50',
                        compact ? 'text-[0.48rem] leading-none' : 'text-[0.62rem]',
                    )}
                >
                    {hidden ? label : title}
                </div>
            ) : null}
            {selected ? (
                <span
                    className="pointer-events-none absolute inset-0 z-20 rounded-[0.18rem] border-2 border-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.22),0_0_18px_rgba(251,191,36,0.5)]"
                    data-testid="mage-wars-selected-card-frame"
                />
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute inset-0 z-10 rounded-[0.18rem] border border-amber-200/70 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18),0_0_14px_rgba(251,191,36,0.32)]"
                    data-testid="mage-wars-prepared-source-frame"
                />
            ) : null}
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                className={cx(
                    'relative block shrink-0 text-left',
                    cardSizeClass,
                    disabled && 'cursor-not-allowed opacity-45',
                )}
                style={cardSizeStyle}
                data-testid={testId}
                data-tutorial-id={tutorialId}
                data-mage-wars-prepared-card={preparedScope}
                data-source-card-id={cardId ?? undefined}
                data-selected={selected ? 'true' : undefined}
                disabled={disabled}
                onClick={onClick}
                aria-label={title}
            >
                {content}
            </button>
        );
    }

    return (
        <div
            className={cx('relative shrink-0', cardSizeClass)}
            style={cardSizeStyle}
            data-testid={testId}
            data-tutorial-id={tutorialId}
            data-mage-wars-prepared-card={preparedScope}
            data-source-card-id={cardId ?? undefined}
            data-selected={selected ? 'true' : undefined}
        >
            {content}
        </div>
    );
}

function ZoneFieldCard({
    cardId,
    object,
    role,
    density = 'solo',
    ownerSide,
    onClick,
    visualDamage = object?.damage,
    visualLife,
    visualHeld = false,
    showLifeTotals = false,
    fxAnchorRef,
}: {
    cardId: number;
    object?: MageWarsArenaObjectState;
    role?: FieldCardRole;
    density?: ZoneEntityDensity;
    ownerSide?: SeatOwnerSide;
    onClick?: () => void;
    visualDamage?: number;
    visualLife?: number;
    visualHeld?: boolean;
    showLifeTotals?: boolean;
    fxAnchorRef?: (element: HTMLButtonElement | null) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const previewRef = getMageWarsSpellCardPreviewRef(cardId);
    const title = object?.name ?? getMageWarsSpellCardName(cardId) ?? t('privateZones.spell');
    const compact = density === 'dense' || density === 'packed';
    const cardHeightClass = density === 'packed'
        ? 'h-[4.2rem]'
        : density === 'dense'
            ? 'h-[5.7rem]'
            : density === 'duel'
                ? 'h-[8rem]'
                : 'h-[11.95rem]';
    const cardAspectRatio = getMageWarsSpellCardAspectRatio(cardId) ?? SPELL_CARD_BACK_ASPECT_RATIO;
    const cardSizeStyle: CSSProperties = { aspectRatio: cardAspectRatio };
    const life = visualLife ?? object?.life ?? 0;
    const damage = visualDamage ?? 0;

    if (!previewRef) return null;

    const content = (
        <>
            <CardPreview
                previewRef={previewRef}
                className={cx(
                    'h-full w-full rounded-[0.18rem]',
                )}
                title={title}
            />
            <BoardDamageStateOverlay
                damage={damage}
                life={life}
                testId="mage-wars-field-card-damage-overlay"
                showValueBadge={false}
            />
            <MageWarsLifeDamageReadout
                damage={damage}
                life={life}
                testId="mage-wars-field-card-life-readout"
                showLifeTotals={showLifeTotals}
            />
            {object ? (
                <EntityStatusTokenRail
                    guarding={object.guarding}
                    statusTokens={object.statusTokens}
                    compact={compact}
                />
            ) : null}
            {role === 'target' ? (
                <>
                    <span
                        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-emerald-300/95 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.36),0_0_12px_rgba(16,185,129,0.42)]"
                        data-testid="mage-wars-field-card-target-frame"
                    />
                </>
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.34),0_0_18px_rgba(34,211,238,0.56)]"
                    data-testid="mage-wars-field-card-source-frame"
                />
            ) : null}
        </>
    );

    return (
        <button
            type="button"
            className={cx(
                'group relative z-20 block shrink-0 rounded-[0.18rem] text-left shadow-[0_14px_30px_rgba(0,0,0,0.48)]',
                cardHeightClass,
                compact && 'shadow-[0_8px_16px_rgba(0,0,0,0.42)]',
                role === 'target' && 'shadow-[0_0_32px_rgba(16,185,129,0.46)]',
                role === 'source' && '-translate-y-2 shadow-[0_0_36px_rgba(34,211,238,0.62)]',
                !onClick && 'pointer-events-none',
            )}
            ref={fxAnchorRef}
            style={cardSizeStyle}
            disabled={!onClick}
            onClick={(event) => {
                event.stopPropagation();
                onClick?.();
            }}
            aria-label={title}
            data-testid="mage-wars-zone-field-card"
            data-tutorial-id={object ? `mw-field-object-${object.sourceSpellCardId}` : `mw-field-card-${cardId}`}
            data-object-id={object?.id}
            data-source-card-id={cardId}
            data-owner-side={ownerSide}
            data-field-card-role={role}
            data-visual-damage={visualDamage ?? 0}
            data-visual-held={visualHeld ? 'true' : undefined}
        >
            {content}
        </button>
    );
}

function ArenaAttachmentCard({
    object,
    role,
    density = 'solo',
    ownerSide,
    onClick,
    fxAnchorRef,
}: {
    object: MageWarsArenaObjectState;
    role?: FieldCardRole;
    density?: ZoneEntityDensity;
    ownerSide?: SeatOwnerSide;
    onClick?: () => void;
    fxAnchorRef?: (element: HTMLElement | null) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const previewRef = getMageWarsSpellCardPreviewRef(object.sourceSpellCardId);
    const title = object.name ?? getMageWarsSpellCardName(object.sourceSpellCardId) ?? t('privateZones.spell');
    const heightClass = density === 'packed'
        ? 'h-8'
        : density === 'dense'
            ? 'h-10'
            : density === 'duel'
                ? 'h-12'
                : 'h-14';
    const cardAspectRatio = getMageWarsSpellCardAspectRatio(object.sourceSpellCardId) ?? SPELL_CARD_BACK_ASPECT_RATIO;
    const cardSizeStyle: CSSProperties = { aspectRatio: cardAspectRatio };

    if (!previewRef) return null;

    const content = (
        <>
            <CardPreview
                previewRef={previewRef}
                className={cx(
                    'h-full w-full rounded-[0.12rem]',
                    object.kind === 'equipment' ? 'ring-1 ring-sky-200/75' : 'ring-1 ring-violet-200/75',
                )}
                title={title}
            />
            {role === 'target' ? (
                <span
                    className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border border-emerald-200/95 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.34),0_0_12px_rgba(16,185,129,0.42)]"
                    data-testid="mage-wars-attachment-target-frame"
                />
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border border-cyan-100/90 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.32),0_0_12px_rgba(34,211,238,0.44)]"
                    data-testid="mage-wars-attachment-source-frame"
                />
            ) : null}
        </>
    );

    const className = cx(
        'relative block shrink-0 rounded-[0.16rem] text-left shadow-[0_7px_14px_rgba(0,0,0,0.48)]',
        heightClass,
        role === 'target' && 'shadow-[0_0_18px_rgba(16,185,129,0.45)]',
        role === 'source' && 'shadow-[0_0_18px_rgba(34,211,238,0.52)]',
        onClick && 'cursor-pointer',
        !onClick && 'pointer-events-none',
    );

    const dataProps = {
        'data-testid': 'mage-wars-attached-card',
        'data-object-id': object.id,
        'data-source-card-id': object.sourceSpellCardId,
        'data-owner-side': ownerSide,
        'data-attachment-kind': object.kind,
        'data-attachment-role': role,
    };

    if (onClick) {
        return (
            <button
                type="button"
                className={className}
                ref={fxAnchorRef as (element: HTMLButtonElement | null) => void}
                onClick={(event) => {
                    event.stopPropagation();
                    onClick();
                }}
                aria-label={title}
                style={cardSizeStyle}
                {...dataProps}
            >
                {content}
            </button>
        );
    }

    return (
        <div
            className={className}
            ref={fxAnchorRef as (element: HTMLDivElement | null) => void}
            aria-label={title}
            style={cardSizeStyle}
            {...dataProps}
        >
            {content}
        </div>
    );
}

function ArenaAttachmentStrip({
    objects,
    density = 'solo',
    hostKind,
    ownerSide,
    getRole,
    getOnClick,
    getFxAnchorRef,
}: {
    objects: MageWarsArenaObjectState[];
    density?: ZoneEntityDensity;
    hostKind: 'mage' | 'object' | 'zone';
    ownerSide?: SeatOwnerSide;
    getRole: (object: MageWarsArenaObjectState) => FieldCardRole | undefined;
    getOnClick: (object: MageWarsArenaObjectState) => (() => void) | undefined;
    getFxAnchorRef?: (object: MageWarsArenaObjectState) => (element: HTMLElement | null) => void;
}) {
    if (objects.length === 0) return null;

    return (
        <div
            className={cx(
                'pointer-events-auto absolute z-30 flex gap-1',
                hostKind === 'mage' && '-right-3 top-1 flex-col items-end',
                hostKind === 'object' && '-right-3 -top-2 flex-col items-end',
                hostKind === 'zone' && 'right-1 top-1 flex-row items-start',
            )}
            data-testid={`mage-wars-${hostKind}-attachment-strip`}
        >
            {objects.map((object) => (
                <ArenaAttachmentCard
                    key={object.id}
                    object={object}
                    density={density}
                    role={getRole(object)}
                    ownerSide={ownerSide}
                    onClick={getOnClick(object)}
                    fxAnchorRef={getFxAnchorRef?.(object)}
                />
            ))}
        </div>
    );
}

function OpponentPlanMirror({ player, compact = false }: { player: MageWarsPlayerState; compact?: boolean }) {
    const { t } = useTranslation('game-mage-wars');

    if (compact) {
        return (
            <section
                className="pointer-events-auto flex items-center gap-1.5 rounded-[0.35rem] bg-black/34 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.32)]"
                data-testid="mage-wars-opponent-prepared-mirror"
                data-tutorial-id="mw-opponent-prepared"
                data-mage-wars-compact="true"
            >
                <div className="flex items-end gap-1">
                    {[0, 1].map((slot) => (
                        <OptimizedImage
                            key={`${player.id}-opponent-plan-compact-${slot}`}
                            src={SPELL_CARD_BACK}
                            alt={t('privateZones.hiddenPrepared')}
                            className="h-12 w-[2.15rem] rounded-[0.12rem] object-cover shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
                            placeholder={false}
                        />
                    ))}
                </div>
                <div className="max-w-[4.7rem] text-[0.58rem] font-semibold leading-tight text-amber-100">
                    {t('privateZones.opponentPlansWithCount', { count: player.preparedSpellSlots })}
                </div>
            </section>
        );
    }

    return (
        <section className="pointer-events-auto flex flex-col items-start gap-3" data-testid="mage-wars-opponent-prepared-mirror" data-tutorial-id="mw-opponent-prepared">
            <div className="flex items-end gap-1.5">
                {[0, 1].map((slot) => (
                    <OptimizedImage
                        key={`${player.id}-opponent-plan-${slot}`}
                        src={SPELL_CARD_BACK}
                        alt={t('privateZones.hiddenPrepared')}
                        className="h-28 w-[4.95rem] rounded-[0.16rem] object-cover shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                        placeholder={false}
                    />
                ))}
            </div>
            <div className="pl-0.5 text-[0.68rem] font-semibold leading-tight text-amber-100">
                {t('privateZones.opponentPlansWithCount', { count: player.preparedSpellSlots })}
            </div>
        </section>
    );
}

function DiscardPile({ player }: { player: MageWarsPlayerState }) {
    const { t } = useTranslation('game-mage-wars');
    const discardSpellCardIds = player.discardSpellCardIds ?? [];
    const topCardId = discardSpellCardIds[0];
    const topCardPreviewRef = topCardId == null ? null : getMageWarsSpellCardPreviewRef(topCardId);
    const count = discardSpellCardIds.length;

    return (
        <section className="pointer-events-auto flex h-[6.25rem] w-[8.65rem] shrink-0 items-center gap-2" data-testid="mage-wars-discard-pile" data-tutorial-id="mw-discard">
            <button
                type="button"
                className="relative h-[6.25rem] w-[5.15rem] overflow-visible rounded-[0.12rem] text-left"
                aria-label={t('privateZones.discardPileAria', { count })}
            >
                {topCardPreviewRef ? (
                    <>
                        <div className="absolute left-2 top-2 h-[5.85rem] w-[4.25rem] rotate-[-7deg] rounded-[0.16rem] bg-amber-100/18 shadow-[0_10px_18px_rgba(0,0,0,0.28)]" />
                        <CardPreview
                            previewRef={topCardPreviewRef}
                            className="absolute left-1 top-0.5 h-[6.1rem] w-auto rotate-[2deg] rounded-[0.14rem] shadow-[0_10px_20px_rgba(0,0,0,0.48)]"
                            title={getMageWarsSpellCardName(topCardId) ?? t('privateZones.discardPile')}
                        />
                    </>
                ) : (
                    <div className="absolute inset-1 rounded-[0.2rem] border border-dashed border-amber-100/18 bg-stone-950/12" />
                )}
            </button>
            <div className="text-center text-[0.66rem] font-semibold text-amber-100">
                {t('privateZones.discardPileWithCount', { count })}
            </div>
        </section>
    );
}

function SpellbookShelf({
    player,
    phase,
    canAct,
    canPlan,
    dispatch,
}: {
    player: MageWarsPlayerState;
    phase: string;
    canAct: boolean;
    canPlan: boolean;
    dispatch: Props['dispatch'];
}) {
    const { t } = useTranslation('game-mage-wars');
    const [category, setCategory] = useState<SpellbookCategoryId>('all');
    const [page, setPage] = useState(0);
    const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
    const planning = phase === 'planning' && canAct && canPlan;
    const categories: Array<{ id: SpellbookCategoryId; label: string }> = [
        { id: 'all', label: t('spellbook.categories.all') },
        { id: 'attack', label: t('spellbook.categories.attack') },
        { id: 'enchantment', label: t('spellbook.categories.enchantment') },
        { id: 'creature', label: t('spellbook.categories.creature') },
        { id: 'incantation', label: t('spellbook.categories.incantation') },
        { id: 'equipment', label: t('spellbook.categories.equipment') },
    ];
    const spellbookIds = useMemo(() => (
        [...new Set(getPresetSpellbookCardIdsFromConfig(player.mageId))]
    ), [player.mageId]);
    const filteredIds = useMemo(() => spellbookIds.filter((cardId) => {
        if (category === 'all') return true;
        const spellType = getMageWarsSpellCardFromConfig(cardId)?.spellType;
        if (category === 'creature') return spellType === '生物' || spellType === '魔物';
        if (category === 'enchantment') return spellType === '结界';
        if (category === 'attack') return spellType === '攻击';
        if (category === 'incantation') return spellType === '咒语';
        return spellType === '装备';
    }), [category, spellbookIds]);
    const pageCount = Math.max(1, Math.ceil(filteredIds.length / 6));
    const currentPage = Math.min(page, pageCount - 1);
    const previewIds = filteredIds.slice(currentPage * 6, currentPage * 6 + 6);
    const togglePlannedCard = (cardId: number) => {
        if (!planning) return;
        setSelectedCardIds((current) => {
            if (current.includes(cardId)) return current.filter((id) => id !== cardId);
            if (current.length >= 2) return current;
            return [...current, cardId];
        });
    };
    const planSelectedSpells = () => {
        if (!planning || selectedCardIds.length === 0) return;
        dispatch(MAGE_WARS_COMMANDS.PLAN_SPELLS, { spellCardIds: selectedCardIds });
        setSelectedCardIds([]);
    };

    return (
        <section
            className={cx(
                'flex items-end gap-[1.125rem] px-1.5 pb-2 pt-3',
                planning ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            data-testid="mage-wars-desktop-spellbook-shelf"
            data-tutorial-id="mw-spellbook"
            aria-label={t('privateZones.spellbook')}
            aria-disabled={!planning}
        >
            <span className="sr-only">{t('privateZones.spellbook')}</span>
            <div className="flex h-[9.875rem] w-[3.625rem] shrink-0 flex-col justify-end gap-1.5">
                {categories.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        className={cx(
                            'min-h-[1.55rem] rounded-[0.22rem] px-1.5 text-[0.66rem] font-semibold transition',
                            category === id
                                ? 'bg-amber-200/85 text-stone-950 shadow-[0_6px_14px_rgba(0,0,0,0.25)]'
                                : 'bg-black/26 text-stone-200 hover:bg-black/38',
                        )}
                        aria-pressed={category === id}
                        data-testid={`mage-wars-spellbook-category-${id}`}
                        data-tutorial-id={`mw-spellbook-category-${id}`}
                        onClick={() => {
                            setCategory(id);
                            setPage(0);
                        }}
                    >
                        {label}
                    </button>
                ))}
                {planning ? (
                    <button
                        type="button"
                        className={cx(
                            'min-h-[1.55rem] rounded-[0.22rem] px-1.5 text-[0.66rem] font-black transition',
                            selectedCardIds.length > 0
                                ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200'
                                : 'bg-black/18 text-stone-500',
                        )}
                        disabled={selectedCardIds.length === 0}
                        onClick={planSelectedSpells}
                        data-testid="mage-wars-plan-spells"
                        data-tutorial-id="mw-plan-spells"
                    >
                        {t('spellbook.planSelected', { count: selectedCardIds.length })}
                    </button>
                ) : null}
            </div>
            <div className="relative z-10 flex min-w-0 flex-1 items-end gap-[0.875rem] overflow-hidden">
                {previewIds.map((cardId) => (
                    <PreparedSpellCard
                        key={`${player.id}-spellbook-desktop-${cardId}`}
                        cardId={cardId}
                        label={getMageWarsSpellCardName(cardId) ?? t('privateZones.spell')}
                        testId="mage-wars-desktop-spellbook-card"
                        tutorialId={`mw-spellbook-card-${cardId}`}
                        selected={selectedCardIds.includes(cardId)}
                        disabled={!planning}
                        onClick={planning ? () => togglePlannedCard(cardId) : undefined}
                    />
                ))}
            </div>
            <div className="relative z-20 flex h-[11.75rem] w-12 shrink-0 flex-col items-center justify-center gap-2 text-stone-100">
                <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-[0.3rem] bg-black/32 text-lg font-bold text-amber-100"
                    aria-label={t('spellbook.previousPage')}
                    disabled={currentPage === 0}
                    data-testid="mage-wars-spellbook-previous-page"
                    data-tutorial-id="mw-spellbook-previous-page"
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                    ‹
                </button>
                <div className="rounded-[0.2rem] bg-black/18 px-1.5 py-1 text-center text-[0.62rem] leading-tight text-stone-200">
                    {t('spellbook.pageSummary', { page: currentPage + 1, total: pageCount })}
                </div>
                <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-[0.3rem] bg-black/32 text-lg font-bold text-amber-100"
                    aria-label={t('spellbook.nextPage')}
                    disabled={currentPage >= pageCount - 1}
                    data-testid="mage-wars-spellbook-next-page"
                    data-tutorial-id="mw-spellbook-next-page"
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                >
                    ›
                </button>
            </div>
        </section>
    );
}

function PreparedSpellsDock({
    player,
    phase,
    canAct,
    canCast,
    selectedCardId,
    onSelect,
}: {
    player: MageWarsPlayerState;
    phase: string;
    canAct: boolean;
    canCast: boolean;
    selectedCardId: number | null;
    onSelect: (cardId: number) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const preparedIds = player.preparedSpellCardIds.slice(0, 2);
    const canSelectSpell = canAct && canCast && CAST_PHASES.has(phase);

    return (
        <section
            className="pointer-events-auto flex h-[17.75rem] w-[22.5rem] flex-col justify-start gap-[0.875rem]"
            data-testid="mage-wars-desktop-prepared-spells"
            data-tutorial-id="mw-prepared"
        >
            <div className="text-center text-[0.66rem] font-semibold text-amber-100">
                {t('privateZones.preparedSpellsWithCount', {
                    count: preparedIds.length,
                    total: player.preparedSpellSlots,
                })}
            </div>
            <div className="flex flex-row-reverse justify-end gap-[0.875rem] pl-6 pr-1.5">
                {[0, 1].map((slot) => (
                    <PreparedSpellCard
                        key={`${player.id}-prepared-desktop-${slot}`}
                        cardId={preparedIds[slot]}
                        label={slot < player.preparedSpellSlots
                            ? t('privateZones.preparedSpell')
                            : t('privateZones.emptySlot')}
                        role={slot === 0 && preparedIds[slot] != null ? 'source' : undefined}
                        testId="mage-wars-desktop-prepared-card"
                        tutorialId={preparedIds[slot] == null ? undefined : `mw-prepared-card-${preparedIds[slot]}`}
                        preparedScope="self"
                        selected={preparedIds[slot] === selectedCardId}
                        disabled={!canSelectSpell || preparedIds[slot] == null}
                        onClick={preparedIds[slot] == null || !canSelectSpell
                            ? undefined
                            : () => onSelect(preparedIds[slot]!)}
                    />
                ))}
            </div>
        </section>
    );
}

function TurnStatusDock({
    dispatch,
    disabled,
    compact = false,
}: {
    dispatch: Props['dispatch'];
    disabled?: boolean;
    compact?: boolean;
}) {
    const { t } = useTranslation('game-mage-wars');

    return (
        <section className="pointer-events-auto" data-testid="mage-wars-turn-end-dock">
            <button
                type="button"
                className={cx(
                    'grid place-items-center rounded-[0.32rem] border border-amber-200/24 font-black text-amber-50 shadow-[0_8px_18px_rgba(0,0,0,0.32)] transition',
                    compact ? 'h-11 w-28 px-3 text-base' : 'h-[3.25rem] w-[10.5rem] px-5 text-xl',
                    disabled ? 'cursor-not-allowed bg-black/20 text-stone-500' : 'bg-amber-950/36 hover:bg-amber-900/42',
                )}
                disabled={disabled}
                onClick={() => dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {})}
                data-testid="mage-wars-turn-end"
                data-tutorial-id="mw-turn-end"
            >
                {t('actions.endTurn')}
            </button>
        </section>
    );
}

function ZoneOccupant({
    player,
    role,
    crowded,
    density = 'solo',
    onClick,
    visualDamage = player.damage,
    showLifeTotals = false,
    fxAnchorRef,
}: {
    player: MageWarsPlayerState;
    role?: 'source' | 'target';
    crowded?: boolean;
    density?: ZoneEntityDensity;
    onClick?: () => void;
    visualDamage?: number;
    showLifeTotals?: boolean;
    fxAnchorRef?: (element: HTMLDivElement | null) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const mageLabel = getMageDisplayLabel(player);
    const portraitHeightClass = density === 'packed'
        ? 'h-[4.2rem]'
        : density === 'dense'
            ? 'h-[5.7rem]'
            : density === 'duel'
                ? 'h-[8rem]'
                : crowded
                    ? 'h-[10.35rem]'
                    : 'h-[11.5rem]';

    return (
        <div
            className={cx(
                'group relative z-20 shrink-0 rounded-[0.18rem] shadow-[0_14px_30px_rgba(0,0,0,0.48)]',
                role === 'source' && '-translate-y-2 shadow-[0_0_30px_rgba(34,211,238,0.58)]',
                role === 'target' && 'shadow-[0_0_30px_rgba(16,185,129,0.48)]',
                'pointer-events-auto',
                onClick && 'cursor-pointer',
            )}
            ref={fxAnchorRef}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={(event) => {
                if (!onClick) return;
                event.stopPropagation();
                onClick();
            }}
            onKeyDown={(event) => {
                if (!onClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onClick();
                }
            }}
            aria-label={t(`mages.${player.mageId}`)}
            data-testid="mage-wars-zone-mage-entity"
            data-player-id={player.id}
            data-mage-id={player.mageId}
            data-mage-preview-kind="portrait"
            data-mage-ui-role="mage-battle-entity"
            data-mage-role={role}
        >
            <CardPreview
                previewRef={getMageWarsMagePreviewRef(player.mageId, 'portrait')}
                className={cx(
                    'rounded-[0.18rem]',
                    `${portraitHeightClass} w-auto`,
                )}
                title={mageLabel}
                alt={mageLabel}
            />
            {role ? (
                <span
                    className={cx(
                        'pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2',
                        role === 'target'
                            ? 'border-emerald-200/95 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.34),0_0_16px_rgba(16,185,129,0.44)]'
                            : 'border-cyan-100/90 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.32),0_0_16px_rgba(34,211,238,0.44)]',
                    )}
                    data-testid={`mage-wars-mage-entity-${role}-frame`}
                />
            ) : null}
            <BoardDamageStateOverlay
                damage={visualDamage}
                life={player.life}
                testId="mage-wars-mage-entity-damage-overlay"
                showValueBadge={false}
            />
            <MageWarsLifeDamageReadout
                damage={visualDamage}
                life={player.life}
                testId="mage-wars-mage-entity-life-readout"
                showLifeTotals={showLifeTotals}
            />
            <EntityStatusTokenRail
                guarding={player.guarding}
                statusTokens={player.statusTokens}
            />
        </div>
    );
}

function ArenaStage({
    core,
    phase,
    canAct,
    activePlayer,
    activeOpponent,
    selectedSpellCardId,
    pendingSpellCastSelection,
    selectedObjectId,
    selectedMageId,
    objectAbilitySourceIds,
    selectedSpellCastTargetIds,
    selectedSpellCastTargetZoneIds,
    selectedSpellCastTargetWallEdgeIds,
    selectedSpellCastDestinationZoneIds,
    selectedSpellCastNewTargetObjectIds,
    selectedSpellCastTargetPlayerIds,
    selectedSpellCastNewTargetPlayerIds,
    selectedSpellCastNewTargetZoneIds,
    selectedSpellCastChainPathObjectIds,
    selectedSpellCastNextChainTargetObjectIds,
    selectedSpellCastCurrentChainSubmitObjectId,
    mageRestoreAvailablePlayerIds,
    pendingObjectAbility,
    pendingObjectAbilityTargetIds,
    pendingMageAbility,
    pendingMageAbilityTargetIds,
    onZoneSelect,
    onObjectSelect,
    onWallEdgeSelect,
    onActorObjectSelect,
    onPlayerSelect,
    onActorPlayerSelect,
    onGuard,
    fxBus,
    onFxImpact,
    onFxComplete,
    fxAnchors,
    getVisualObjectDamage,
    getVisualPlayerDamage,
    showLifeTotals = false,
    visualHeldObjects = [],
    desktopFrame = false,
}: {
    core: MageWarsCore;
    phase: string;
    canAct: boolean;
    activePlayer?: MageWarsPlayerState;
    activeOpponent?: MageWarsPlayerState | null;
    selectedSpellCardId?: number | null;
    pendingSpellCastSelection?: PendingSpellCastSelection | null;
    selectedObjectId?: string | null;
    selectedMageId?: PlayerId | null;
    objectAbilitySourceIds?: ReadonlySet<string>;
    selectedSpellCastTargetIds?: ReadonlySet<string>;
    selectedSpellCastTargetZoneIds?: ReadonlySet<ArenaZoneId>;
    selectedSpellCastTargetWallEdgeIds?: ReadonlySet<MageWarsWallEdgeId>;
    selectedSpellCastDestinationZoneIds?: ReadonlySet<ArenaZoneId>;
    selectedSpellCastNewTargetObjectIds?: ReadonlySet<string>;
    selectedSpellCastTargetPlayerIds?: ReadonlySet<PlayerId>;
    selectedSpellCastNewTargetPlayerIds?: ReadonlySet<PlayerId>;
    selectedSpellCastNewTargetZoneIds?: ReadonlySet<ArenaZoneId>;
    selectedSpellCastChainPathObjectIds?: ReadonlySet<string>;
    selectedSpellCastNextChainTargetObjectIds?: ReadonlySet<string>;
    selectedSpellCastCurrentChainSubmitObjectId?: string;
    mageRestoreAvailablePlayerIds?: ReadonlySet<PlayerId>;
    pendingObjectAbility?: PendingObjectAbilitySelection | null;
    pendingObjectAbilityTargetIds?: ReadonlySet<string>;
    pendingMageAbility?: PendingMageAbilitySelection | null;
    pendingMageAbilityTargetIds?: ReadonlySet<string>;
    onZoneSelect?: (zoneId: ArenaZoneId) => void;
    onObjectSelect?: (objectId: string) => void;
    onWallEdgeSelect?: (edgeId: MageWarsWallEdgeId) => void;
    onActorObjectSelect?: (objectId: string) => void;
    onPlayerSelect?: (playerId: PlayerId) => void;
    onActorPlayerSelect?: (playerId: PlayerId) => void;
    onGuard?: () => void;
    fxBus: FxBus;
    onFxImpact?: (id: string, cue: string) => void;
    onFxComplete?: (id: string, cue: string) => void;
    fxAnchors: FxAnchorRegistry;
    getVisualObjectDamage: (object: MageWarsArenaObjectState) => number;
    getVisualPlayerDamage: (player: MageWarsPlayerState) => number;
    showLifeTotals?: boolean;
    visualHeldObjects?: MageWarsArenaObjectState[];
    desktopFrame?: boolean;
}) {
    const { t } = useTranslation('game-mage-wars');
    const creatureActionActive = isCreatureActionPhase(phase) && canAct;
    const canUseMageAction = creatureActionActive && activePlayer?.actionReady === true;
    const selectedSpell = selectedSpellCardId == null
        ? undefined
        : getMageWarsSpellCardFromConfig(selectedSpellCardId);
    const spellNeedsZoneTarget = selectedSpellCastTargetZoneIds !== undefined;
    const spellNeedsObjectTarget = Boolean(
        selectedSpellCastTargetIds
        || selectedSpellCastTargetPlayerIds
        || selectedSpellCastNewTargetObjectIds
        || selectedSpellCastNewTargetPlayerIds
        || selectedSpellCastNextChainTargetObjectIds
        || selectedSpellCastCurrentChainSubmitObjectId,
    );
    const spellNeedsNewAnchorTarget = Boolean(
        selectedSpellCastNewTargetObjectIds
        || selectedSpellCastNewTargetPlayerIds
        || selectedSpellCastNewTargetZoneIds,
    );
    const spellNeedsChainTargets = Boolean(
        selectedSpellCastNextChainTargetObjectIds
        || selectedSpellCastCurrentChainSubmitObjectId,
    );
    const hasSelectedSpellCastContract = Boolean(
        selectedSpellCastTargetIds
        || selectedSpellCastTargetZoneIds
        || selectedSpellCastTargetWallEdgeIds
        || selectedSpellCastDestinationZoneIds
        || selectedSpellCastNewTargetObjectIds
        || selectedSpellCastTargetPlayerIds
        || selectedSpellCastNewTargetPlayerIds
        || selectedSpellCastNewTargetZoneIds
        || selectedSpellCastNextChainTargetObjectIds
        || selectedSpellCastCurrentChainSubmitObjectId,
    );
    const pendingSpellTargetObjectId = pendingSpellCastSelection?.kind === 'object'
        ? pendingSpellCastSelection.objectId
        : undefined;
    const pendingSpellTargetPlayerId = pendingSpellCastSelection?.kind === 'player'
        ? pendingSpellCastSelection.playerId
        : undefined;
    const pendingSpellTargetObject = pendingSpellTargetObjectId ? core.objects[pendingSpellTargetObjectId] : undefined;
    const pendingSpellTargetPlayer = pendingSpellTargetPlayerId ? core.players[pendingSpellTargetPlayerId] : undefined;
    const pendingSpellTargetZoneId = pendingSpellTargetObject?.zoneId ?? pendingSpellTargetPlayer?.mageZoneId;
    const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
    const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
    const selectedMageRestoreAbilityId = selectedMage ? resolveMageWarsPriestessRestoreAbilityIdForPhase(phase) : undefined;
    const canUseSelectedMageRestoreAbility = Boolean(
        selectedMage
        && selectedMage.id === activePlayer?.id
        && selectedMageRestoreAbilityId
        && mageRestoreAvailablePlayerIds?.has(selectedMage.id),
    );
    const hasPendingAbilityTarget = Boolean(pendingObjectAbility || pendingMageAbility);
    const selectedObjectAttackProfile = selectedObject
        ? getMageWarsObjectAttackProfiles(selectedObject).find((profile) => (
            selectedObject.actionReady || canMageWarsObjectUsePostMoveQuickAction(selectedObject, profile)
        ))
        : undefined;
    const selectedMageCanAct = Boolean(
        selectedMage
        && selectedMage.id === activePlayer?.id
        && canUseMageAction,
    );
    const selectedObjectCanMove = Boolean(
        selectedObject
        && canMageWarsObjectStartAction(selectedObject, activePlayer?.id)
        && selectedObject.actionReady
        && !isMageWarsArenaObjectRestrained(selectedObject),
    );
    const selectedObjectCanAttack = Boolean(
        selectedObject
        && isMageWarsActionableCreatureObject(selectedObject, activePlayer?.id)
        && selectedObjectAttackProfile,
    );
    const selectedActorZoneId = selectedObject?.zoneId
        ?? (selectedMageCanAct || canUseSelectedMageRestoreAbility ? selectedMage?.mageZoneId : undefined);
    const hasSelectedActor = selectedActorZoneId != null;
    const hasPendingSpellDestination = Boolean(
        (pendingSpellTargetObject || pendingSpellTargetPlayer)
        && (
            selectedSpellCastDestinationZoneIds
            || spellNeedsNewAnchorTarget
            || spellNeedsChainTargets
        ),
    );
    const isSelectedSpellObjectTarget = (object: MageWarsArenaObjectState): boolean => {
        if (!spellNeedsObjectTarget) return false;
        if (pendingSpellTargetObject && spellNeedsChainTargets && selectedSpellCastNextChainTargetObjectIds) {
            return selectedSpellCastNextChainTargetObjectIds.has(object.id)
                || selectedSpellCastCurrentChainSubmitObjectId === object.id;
        }
        if (pendingSpellTargetObject && selectedSpellCastNewTargetObjectIds) {
            return selectedSpellCastNewTargetObjectIds.has(object.id);
        }
        if (pendingSpellTargetObject && spellNeedsNewAnchorTarget && selectedSpellCastTargetIds) return false;
        if (pendingSpellTargetObject && spellNeedsChainTargets && selectedSpellCastTargetIds) return false;
        if (selectedSpellCastTargetIds) return selectedSpellCastTargetIds.has(object.id);
        return false;
    };
    const isSelectedSpellPlayerTarget = (player: MageWarsPlayerState): boolean => Boolean(
        spellNeedsObjectTarget
        && (
            (
                pendingSpellTargetObject
                && selectedSpellCastNewTargetPlayerIds?.has(player.id)
            )
            || selectedSpellCastTargetPlayerIds?.has(player.id)
        ),
    );
    const canGuardSelectedActor = Boolean(
        !hasPendingAbilityTarget
        && hasSelectedActor
        && (selectedObject ? selectedObject.actionReady : selectedMageCanAct),
    );
    const targeting = Boolean(selectedSpell) || hasSelectedActor || hasPendingAbilityTarget;
    const legalMoveZoneIds = new Set(
        !hasPendingAbilityTarget
            && creatureActionActive
            && selectedActorZoneId
            && (selectedObject ? selectedObjectCanMove : selectedMageCanAct)
            ? core.arena
                .filter((zone) => areAdjacentZones(core, selectedActorZoneId, zone.id))
                .map((zone) => zone.id)
            : [],
    );
    const legalAttackTargetId = activeOpponent
        && !hasPendingAbilityTarget
        && (selectedObject && selectedObjectCanAttack && selectedObjectAttackProfile
            ? isMageWarsObjectAttackTargetSelectable(
                core,
                selectedObject.zoneId,
                activeOpponent.mageZoneId,
                selectedObjectAttackProfile,
            )
            : selectedMageCanAct && activeOpponent.mageZoneId === selectedMage?.mageZoneId)
        ? activeOpponent.id
        : null;
    const targetZoneId = legalAttackTargetId ? activeOpponent?.mageZoneId ?? null : null;
    const legalSpellTargetZoneIds = new Set(
        selectedSpellCardId != null
            ? core.arena
                .filter((zone) => {
                    const fieldObjects = zone.objectIds
                        .map((objectId) => core.objects[objectId])
                        .filter((object): object is MageWarsArenaObjectState => object != null);
                    const zoneOccupants = zone.occupantIds
                        .map((occupantId) => core.players[occupantId])
                        .filter((occupant): occupant is MageWarsPlayerState => occupant != null);
                    if (pendingSpellTargetObject && spellNeedsNewAnchorTarget) {
                        return selectedSpellCastNewTargetZoneIds?.has(zone.id) === true
                            || fieldObjects.some((object) => isSelectedSpellObjectTarget(object))
                            || zoneOccupants.some((occupant) => isSelectedSpellPlayerTarget(occupant));
                    }
                    if ((pendingSpellTargetObject || pendingSpellTargetPlayer) && selectedSpellCastDestinationZoneIds) {
                        return selectedSpellCastDestinationZoneIds.has(zone.id);
                    }
                    if (!pendingSpellTargetObject && selectedSpellCastTargetZoneIds) {
                        return selectedSpellCastTargetZoneIds.has(zone.id);
                    }
                    return fieldObjects.some((object) => isSelectedSpellObjectTarget(object))
                        || zoneOccupants.some((occupant) => isSelectedSpellPlayerTarget(occupant));
                })
                .map((zone) => zone.id)
            : [],
    );
    const wallEdgeDescriptors = buildMageWarsWallEdgeDescriptors(core);
    const legalWallEdgeIds = new Set(
        selectedSpellCastTargetWallEdgeIds
            ? wallEdgeDescriptors
                .filter((edge) => selectedSpellCastTargetWallEdgeIds.has(edge.edgeId))
                .map((edge) => edge.edgeId)
            : [],
    );

    return (
        <section
            className={cx(
                'absolute w-auto aspect-[4/3] overflow-hidden rounded-[0.5rem] shadow-[0_34px_58px_rgba(0,0,0,0.55)]',
                desktopFrame ? 'top-[2.75%] h-[74%]' : 'top-0 h-full lg:top-[2.75%] lg:h-[74%]',
            )}
            data-testid="mage-wars-arena-stage"
            data-tutorial-id="mw-arena"
            ref={fxAnchors.registerSurface}
            style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
            <OptimizedImage
                src="mage-wars/board/standard-arena"
                alt={t('arena.standardArenaAlt')}
                className="absolute inset-0 h-full w-full max-w-none object-contain"
                placeholder={false}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,231,166,0.06),rgba(6,5,4,0.1)_56%,rgba(3,2,1,0.44))]" />
            {core.arena.map((zone) => {
                const rect = ZONE_RECTS[zone.id];
                const fieldCardIds = zone.fieldCardIds ?? [];
                const coreZoneObjects = zone.objectIds
                    .map((objectId) => core.objects[objectId])
                    .filter((object): object is MageWarsArenaObjectState => object != null);
                const zoneHeldObjects = visualHeldObjects.filter((object) => (
                    object.zoneId === zone.id
                    && core.objects[object.id] == null
                    && !coreZoneObjects.some((current) => current.id === object.id)
                ));
                const zoneObjects = [...coreZoneObjects, ...zoneHeldObjects];
                const zoneHeldObjectIds = new Set(zoneHeldObjects.map((object) => object.id));
                const attachedObjects = zoneObjects.filter(isMageWarsAttachmentObject);
                const fieldObjects = zoneObjects.filter((object) => !isMageWarsAttachmentObject(object));
                const zoneAttachmentObjects = attachedObjects.filter((object) => (
                    isMageWarsZoneAttachmentObject(object, zone.id)
                ));
                const zoneOccupants = zone.occupantIds
                    .map((occupantId) => core.players[occupantId])
                    .filter((occupant): occupant is MageWarsPlayerState => occupant != null);
                const hasFieldCards = fieldCardIds.length > 0 || fieldObjects.length > 0;
                const isSourceZone = (hasSelectedActor && zone.id === selectedActorZoneId)
                    || (hasPendingSpellDestination && zone.id === pendingSpellTargetZoneId);
                const isLegalMoveZone = legalMoveZoneIds.has(zone.id);
                const isLegalAttackZone = targetZoneId != null && zone.id === targetZoneId;
                const isLegalSpellTargetZone = legalSpellTargetZoneIds.has(zone.id);
                const isLegalObjectAbilityTargetZone = Boolean(
                    pendingObjectAbility
                    && pendingObjectAbilityTargetIds
                    && fieldObjects.some((object) => pendingObjectAbilityTargetIds.has(object.id)),
                );
                const isLegalMageAbilityTargetZone = Boolean(
                    pendingMageAbility
                    && pendingMageAbilityTargetIds
                    && fieldObjects.some((object) => pendingMageAbilityTargetIds.has(object.id)),
                );
                const isLegalTargetZone = isLegalAttackZone
                    || isLegalSpellTargetZone
                    || isLegalObjectAbilityTargetZone
                    || isLegalMageAbilityTargetZone;
                const isLegalExplicitZoneTarget = Boolean(
                    selectedSpellCastDestinationZoneIds?.has(zone.id) === true
                    || selectedSpellCastNewTargetZoneIds?.has(zone.id) === true
                    || (
                        selectedSpellCastTargetZoneIds?.has(zone.id) === true
                        && spellNeedsZoneTarget
                    ),
                );
                const isLegalObjectOrPlayerTargetZone = isLegalTargetZone && !isLegalExplicitZoneTarget;
                const zoneAriaLabel = [
                    t('arena.zoneAria', { zone: t(`zones.${zone.id}`) }),
                    isSourceZone ? t('arena.source') : null,
                    isLegalMoveZone && !isLegalTargetZone ? t('arena.legalMove') : null,
                    isLegalTargetZone ? t('arena.legalTarget') : null,
                ].filter(Boolean).join('，');
                const entityCount = fieldObjects.length + zoneOccupants.length;
                const usesOwnershipLanes = fieldCardIds.length === 0 && entityCount > 0;
                const leftSeatPlayerId = core.playerOrder[0];
                const rightSeatPlayerId = core.playerOrder[1];
                const leftSeatFieldObjects = fieldObjects.filter((object) => object.ownerId === leftSeatPlayerId);
                const rightSeatFieldObjects = fieldObjects.filter((object) => object.ownerId === rightSeatPlayerId);
                const leftSeatZoneOccupants = zoneOccupants.filter((occupant) => occupant.id === leftSeatPlayerId);
                const rightSeatZoneOccupants = zoneOccupants.filter((occupant) => occupant.id === rightSeatPlayerId);
                const largestLaneCount = Math.max(
                    leftSeatFieldObjects.length + leftSeatZoneOccupants.length,
                    rightSeatFieldObjects.length + rightSeatZoneOccupants.length,
                );
                const entityDensity: ZoneEntityDensity = !usesOwnershipLanes
                    ? 'solo'
                    : largestLaneCount <= 1
                        ? 'duel'
                        : largestLaneCount <= 2
                            ? 'dense'
                            : 'packed';
                const resolveAttachmentRole = (object: MageWarsArenaObjectState): FieldCardRole | undefined => {
                    const isSpellObjectTarget = isSelectedSpellObjectTarget(object);
                    if (selectedSpellCastChainPathObjectIds?.has(object.id)) return 'source';
                    if (object.id === pendingSpellTargetObjectId) return 'source';
                    if (isSpellObjectTarget) return 'target';
                    return object.id === selectedObjectId ? 'source' : undefined;
                };
                const resolveAttachmentClick = (object: MageWarsArenaObjectState): (() => void) | undefined => {
                    const isSpellObjectTarget = isSelectedSpellObjectTarget(object);
                    if (isSpellObjectTarget || selectedSpellCastCurrentChainSubmitObjectId === object.id) {
                        return () => onObjectSelect?.(object.id);
                    }
                    if (!selectedSpell && !hasPendingAbilityTarget && objectAbilitySourceIds?.has(object.id)) {
                        return () => onActorObjectSelect?.(object.id);
                    }
                    return undefined;
                };
                const renderFieldObject = (object: MageWarsArenaObjectState, density: ZoneEntityDensity = 'solo') => {
                    const visualHeld = zoneHeldObjectIds.has(object.id);
                    const objectAttachments = attachedObjects.filter((attachment) => (
                        isMageWarsObjectAttachmentObject(attachment, object.id)
                    ));
                    const isObjectAttackTarget = Boolean(
                        selectedObject
                        && selectedObjectCanAttack
                        && selectedObjectAttackProfile
                        && object.ownerId !== activePlayer?.id
                        && isMageWarsObjectAttackTargetSelectable(
                            core,
                            selectedObject.zoneId,
                            object.zoneId,
                            selectedObjectAttackProfile,
                        ),
                    );
                    const isSpellObjectTarget = isSelectedSpellObjectTarget(object);
                    const isObjectAbilitySource = object.id === pendingObjectAbility?.objectId;
                    const isObjectAbilityTarget = Boolean(
                        pendingObjectAbility
                        && pendingObjectAbilityTargetIds?.has(object.id),
                    );
                    const isMageAbilityTarget = Boolean(
                        pendingMageAbility
                        && pendingMageAbilityTargetIds?.has(object.id),
                    );
                    const isObjectAbilityActor = objectAbilitySourceIds?.has(object.id) === true;
                    const canSelectObjectActor = Boolean(
                        !selectedSpell
                        && !hasPendingAbilityTarget
                        && (
                            (
                                creatureActionActive
                                && canMageWarsObjectStartAction(object, activePlayer?.id)
                            )
                            || isObjectAbilityActor
                        ),
                    );
                    return (
                        <div key={object.id} className="relative z-20 flex shrink-0 items-center justify-center">
                            <div className="relative shrink-0">
                                <ZoneFieldCard
                                    cardId={object.sourceSpellCardId}
                                    object={object}
                                    density={density}
                                    ownerSide={resolveSeatOwnerSide(core, object.ownerId)}
                                    visualDamage={getVisualObjectDamage(object)}
                                    visualLife={resolveMageWarsObjectEffectiveLife(core, object)}
                                    visualHeld={visualHeld}
                                    showLifeTotals={showLifeTotals}
                                    role={object.id === pendingSpellTargetObjectId
                                        || selectedSpellCastChainPathObjectIds?.has(object.id)
                                        || object.id === selectedObjectId
                                        || isObjectAbilitySource
                                        ? 'source'
                                        : isSpellObjectTarget || isObjectAttackTarget || isObjectAbilityTarget || isMageAbilityTarget
                                            ? 'target'
                                            : undefined}
                                    onClick={isObjectAbilityTarget || isMageAbilityTarget
                                        ? () => onObjectSelect?.(object.id)
                                        : isSpellObjectTarget
                                        ? () => onObjectSelect?.(object.id)
                                        : selectedSpellCastCurrentChainSubmitObjectId === object.id
                                            ? () => onObjectSelect?.(object.id)
                                        : isObjectAttackTarget
                                            ? () => onObjectSelect?.(object.id)
                                            : canSelectObjectActor
                                                ? () => onActorObjectSelect?.(object.id)
                                                : undefined}
                                    fxAnchorRef={fxAnchors.registerAnchor({
                                        anchorId: object.id,
                                        anchorKind: 'entity',
                                        entityRef: object.id,
                                    })}
                                />
                                {object.id === selectedObjectId && canGuardSelectedActor && onGuard ? (
                                    <MageWarsGuardTokenAction
                                        onGuard={onGuard}
                                        compact={density === 'dense' || density === 'packed'}
                                    />
                                ) : null}
                            </div>
                            <ArenaAttachmentStrip
                                objects={objectAttachments}
                                density={density}
                                hostKind="object"
                                ownerSide={resolveSeatOwnerSide(core, object.ownerId)}
                                getRole={resolveAttachmentRole}
                                getOnClick={resolveAttachmentClick}
                                getFxAnchorRef={(attachment) => fxAnchors.registerAnchor({
                                    anchorId: attachment.id,
                                    anchorKind: 'attachment-slot',
                                    entityRef: attachment.id,
                                })}
                            />
                        </div>
                    );
                };
                const renderZoneOccupant = (occupant: MageWarsPlayerState, density: ZoneEntityDensity = 'solo') => {
                    const mageAttachments = attachedObjects.filter((attachment) => (
                        isMageWarsMageAttachmentObject(attachment, occupant.id)
                    ));
                    const role = occupant.id === selectedMageId
                        ? 'source'
                        : occupant.id === legalAttackTargetId
                            || isSelectedSpellPlayerTarget(occupant)
                            ? 'target'
                            : undefined;
                    const occupantRestoreAbilityId = resolveMageWarsPriestessRestoreAbilityIdForPhase(phase);
                    const occupantCanUseRestoreAbility = Boolean(
                        canAct
                        && !selectedSpell
                        && !hasPendingAbilityTarget
                        && occupant.id === activePlayer?.id
                        && occupantRestoreAbilityId
                        && mageRestoreAvailablePlayerIds?.has(occupant.id),
                    );
                    const canSelectMageActor = Boolean(
                        !hasPendingAbilityTarget
                        && !selectedSpell
                        && occupant.id === activePlayer?.id
                        && ((creatureActionActive && canUseMageAction) || occupantCanUseRestoreAbility),
                    );
                    return (
                        <div key={occupant.id} className="relative z-20 flex shrink-0 items-center justify-center">
                            <div className="relative shrink-0">
                                <ZoneOccupant
                                    player={occupant}
                                    role={role}
                                    crowded={hasFieldCards || mageAttachments.length > 0}
                                    density={density}
                                    visualDamage={getVisualPlayerDamage(occupant)}
                                    showLifeTotals={showLifeTotals}
                                    fxAnchorRef={fxAnchors.registerAnchor({
                                        anchorId: occupant.id,
                                        anchorKind: 'player',
                                        entityRef: occupant.id,
                                    })}
                                    onClick={occupant.id === legalAttackTargetId || spellNeedsObjectTarget
                                        ? () => onPlayerSelect?.(occupant.id)
                                        : canSelectMageActor
                                            ? () => onActorPlayerSelect?.(occupant.id)
                                            : undefined}
                                />
                                {occupant.id === selectedMageId && canGuardSelectedActor && onGuard ? (
                                    <MageWarsGuardTokenAction
                                        onGuard={onGuard}
                                        compact={density === 'dense' || density === 'packed'}
                                    />
                                ) : null}
                            </div>
                            <ArenaAttachmentStrip
                                objects={mageAttachments}
                                density={density}
                                hostKind="mage"
                                ownerSide={resolveSeatOwnerSide(core, occupant.id)}
                                getRole={resolveAttachmentRole}
                                getOnClick={resolveAttachmentClick}
                                getFxAnchorRef={(attachment) => fxAnchors.registerAnchor({
                                    anchorId: attachment.id,
                                    anchorKind: 'attachment-slot',
                                    entityRef: attachment.id,
                                })}
                            />
                        </div>
                    );
                };
                return (
                    <div
                        key={zone.id}
                        data-testid={`mage-wars-arena-zone-${zone.id}`}
                        data-tutorial-id={`mw-zone-${zone.id}`}
                        data-source-zone={isSourceZone ? 'true' : undefined}
                        data-legal-move-zone={isLegalMoveZone ? 'true' : undefined}
                        data-legal-target-zone={isLegalTargetZone ? 'true' : undefined}
                        data-zone-target-scope={isLegalExplicitZoneTarget ? 'zone' : isLegalObjectOrPlayerTargetZone ? 'object' : undefined}
                        className={cx(
                            'absolute rounded-[0.25rem] text-left transition',
                            'outline outline-1 outline-transparent hover:bg-amber-200/8 hover:outline-amber-100/45',
                            zone.occupantIds.length > 0 && 'bg-black/5',
                            entityCount > 0 && 'z-10',
                            isSourceZone && 'outline-cyan-200/35',
                            isLegalMoveZone && 'bg-sky-300/8 outline-sky-200/70 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.34)]',
                            isLegalExplicitZoneTarget && 'bg-emerald-300/8 outline-emerald-200/80 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.38)]',
                        )}
                        style={{
                            left: pct(rect.left),
                            top: pct(rect.top),
                            width: pct(rect.width),
                            height: pct(rect.height),
                        }}
                        aria-label={zoneAriaLabel}
                        role="button"
                        tabIndex={targeting ? 0 : -1}
                        onClick={() => {
                            if (targeting) onZoneSelect?.(zone.id);
                        }}
                        onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ' ') && targeting) {
                                event.preventDefault();
                                onZoneSelect?.(zone.id);
                            }
                        }}
                        >
                        {usesOwnershipLanes ? (
                            <div
                                className="absolute inset-[2.2%] grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[3.5%]"
                                data-testid="mage-wars-zone-ownership-lanes"
                                data-zone-id={zone.id}
                            >
                                <div className={cx(
                                    'relative flex h-full flex-wrap content-center items-center justify-center gap-1.5 rounded-[0.22rem] bg-rose-900/10 px-1 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.16)]',
                                    entityDensity === 'packed' ? 'py-5' : entityDensity === 'dense' ? 'py-2' : 'py-3',
                                )} data-lane-owner-side="seat-left" data-lane-player-id={leftSeatPlayerId}>
                                    {leftSeatZoneOccupants.map((occupant) => renderZoneOccupant(occupant, entityDensity))}
                                    {leftSeatFieldObjects.map((object) => renderFieldObject(object, entityDensity))}
                                </div>
                                <div className={cx(
                                    'relative flex h-full flex-wrap content-center items-center justify-center gap-1.5 rounded-[0.22rem] bg-sky-900/10 px-1 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.16)]',
                                    entityDensity === 'packed' ? 'py-5' : entityDensity === 'dense' ? 'py-2' : 'py-3',
                                )} data-lane-owner-side="seat-right" data-lane-player-id={rightSeatPlayerId}>
                                    {rightSeatZoneOccupants.map((occupant) => renderZoneOccupant(occupant, entityDensity))}
                                    {rightSeatFieldObjects.map((object) => renderFieldObject(object, entityDensity))}
                                </div>
                            </div>
                        ) : (
                            <div
                                className={cx(
                                    'absolute inset-0 flex flex-wrap items-center gap-3 py-5',
                                    'justify-center px-4',
                                )}
                                style={getZoneFieldCardOffsetStyle(zone.id, hasFieldCards)}
                            >
                                {fieldCardIds.map((cardId, index) => (
                                    <ZoneFieldCard
                                        key={`${zone.id}-field-card-${cardId}-${index}`}
                                        cardId={cardId}
                                        ownerSide="neutral"
                                        role={isLegalAttackZone && index === 0 ? 'target' : undefined}
                                    />
                                ))}
                                {fieldObjects.map((object) => renderFieldObject(object))}
                                {zoneOccupants.map((occupant) => renderZoneOccupant(occupant))}
                            </div>
                        )}
                        <ArenaAttachmentStrip
                            objects={zoneAttachmentObjects}
                            density={entityDensity}
                            hostKind="zone"
                            ownerSide="neutral"
                            getRole={resolveAttachmentRole}
                            getOnClick={resolveAttachmentClick}
                            getFxAnchorRef={(attachment) => fxAnchors.registerAnchor({
                                anchorId: attachment.id,
                                anchorKind: 'attachment-slot',
                                entityRef: attachment.id,
                            })}
                        />
                    </div>
                );
            })}
            {wallEdgeDescriptors.map((edge) => {
                const wall = core.walls?.[edge.edgeId];
                const isLegalWallTarget = legalWallEdgeIds.has(edge.edgeId);
                if (!wall && !isLegalWallTarget) return null;

                const [fromZoneId, toZoneId] = edge.zoneIds;
                const label = wall
                    ? t('arena.wallAria', {
                        wall: wall.name,
                        from: t(`zones.${fromZoneId}`),
                        to: t(`zones.${toZoneId}`),
                    })
                    : t('arena.wallEdgeAria', {
                        from: t(`zones.${fromZoneId}`),
                        to: t(`zones.${toZoneId}`),
                    });

                return (
                    <button
                        key={edge.edgeId}
                        type="button"
                        className={cx(
                            'absolute z-30 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100',
                            edge.orientation === 'vertical'
                                ? 'shadow-[0_0_18px_rgba(251,146,60,0.34)]'
                                : 'shadow-[0_0_16px_rgba(251,146,60,0.3)]',
                            wall
                                ? 'border-orange-200/95 bg-gradient-to-r from-red-700/80 via-orange-300/90 to-red-700/80'
                                : 'border-amber-100/82 bg-amber-300/18 hover:bg-amber-300/30',
                        )}
                        style={edge.style}
                        aria-label={label}
                        title={label}
                        disabled={!isLegalWallTarget}
                        data-testid={`mage-wars-wall-edge-${edge.edgeId}`}
                        data-wall-edge-id={edge.edgeId}
                        data-legal-target-wall-edge={isLegalWallTarget ? 'true' : undefined}
                        data-wall-object={wall ? 'true' : undefined}
                        data-wall-spell-card-id={wall?.sourceSpellCardId}
                        onClick={(event) => {
                            if (!isLegalWallTarget) return;
                            event.stopPropagation();
                            onWallEdgeSelect?.(edge.edgeId);
                        }}
                    >
                        <span
                            className={cx(
                                'pointer-events-none absolute inset-0 rounded-full',
                                wall
                                    ? 'shadow-[inset_0_0_0_1px_rgba(255,247,237,0.52),0_0_20px_rgba(248,113,22,0.72)]'
                                    : 'shadow-[inset_0_0_0_1px_rgba(254,243,199,0.5),0_0_18px_rgba(251,191,36,0.38)]',
                            )}
                            data-testid={wall ? 'mage-wars-wall-object' : undefined}
                        />
                    </button>
                );
            })}
            <FxLayer
                bus={fxBus}
                getCellPosition={(row, col) => ({
                    left: (col / 4) * 100,
                    top: (row / 3) * 100,
                    width: 100 / 4,
                    height: 100 / 3,
                })}
                className="z-40"
                data-testid="mage-wars-fx-layer"
                onEffectImpact={onFxImpact}
                onEffectComplete={onFxComplete}
            />
        </section>
    );
}

function getObjectAbilityChoiceLabel(
    selection: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
): string {
    if (selection.value?.mode === 'melee-bonus') return '近战加成';
    if (selection.value?.mode === 'heal') return '治疗';
    return selection.label ?? String(selection.value?.boundSpellCardId ?? selection.id);
}

function getSpellCastChoiceLabel(
    selection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
): string {
    if (selection.value?.boundSpellCardId === undefined && selection.metadata?.targetMode === 'player-bound-spell') {
        return '不绑定法术';
    }
    return selection.label ?? String(selection.value?.boundSpellCardId ?? selection.id);
}

function MageSpellCastChoiceDock({
    spellName,
    targetPlayer,
    selections,
    onSelect,
    onCancel,
}: {
    spellName?: string;
    targetPlayer?: MageWarsPlayerState;
    selections: readonly ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>[];
    onSelect: (selection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    if (selections.length === 0) return null;

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 top-[9.25rem] z-50 flex justify-center px-4"
            data-testid="mage-wars-spell-cast-choice-dock"
        >
            <section className="pointer-events-auto w-full max-w-[34rem] rounded-[0.35rem] border border-sky-100/18 bg-stone-950/90 px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.55)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-sky-100">
                            {spellName ?? t('interaction.spellCastChoice.fallbackTitle')}
                        </div>
                        {targetPlayer ? (
                            <div className="mt-0.5 truncate text-xs font-semibold text-stone-300">
                                {targetPlayer.mageId}
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="shrink-0 rounded-[0.25rem] border border-stone-500/60 px-2.5 py-1 text-xs font-bold text-stone-200 transition hover:border-stone-300 hover:bg-stone-800"
                        data-testid="mage-wars-spell-cast-choice-cancel"
                        onClick={onCancel}
                    >
                        {t('interaction.mageAbilityStatusChoice.cancel')}
                    </button>
                </div>
                <div className="grid gap-2">
                    {selections.map((selection) => {
                        const manaCost = selection.value?.manaCost ?? 0;
                        return (
                            <button
                                key={selection.id}
                                type="button"
                                className="flex min-h-12 items-center justify-between gap-3 rounded-[0.28rem] border border-sky-100/16 bg-sky-950/30 px-3 py-2 text-left transition hover:border-sky-100/48 hover:bg-sky-900/42"
                                data-testid="mage-wars-spell-cast-choice-option"
                                data-choice-id={selection.id}
                                data-bound-spell-card-id={selection.value?.boundSpellCardId}
                                data-mana-cost={manaCost}
                                onClick={() => onSelect(selection)}
                            >
                                <span className="min-w-0 truncate text-xs font-bold text-stone-100">
                                    {getSpellCastChoiceLabel(selection)}
                                </span>
                                <span className="shrink-0 rounded-full border border-sky-200/30 bg-sky-950/38 px-2.5 py-1 text-xs font-black text-sky-100">
                                    {t('interaction.mageAbilityStatusChoice.manaCost', { manaCost })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </aside>
    );
}

function MageWarsSelectedAbilityActionDock({
    sourceName,
    objectId,
    objectAbilities,
    magePlayerId,
    mageAbility,
    onObjectAbilitySelect,
    onMageAbilitySelect,
}: {
    sourceName?: string;
    objectId?: string;
    objectAbilities: readonly { id: MageWarsObjectAbilityId; name: string }[];
    magePlayerId?: PlayerId;
    mageAbility?: { abilityId: MageWarsMageAbilityId; name: string };
    onObjectAbilitySelect: (sourceObjectId: string, abilityId: MageWarsObjectAbilityId) => void;
    onMageAbilitySelect: (playerId: PlayerId, abilityId: MageWarsMageAbilityId) => void;
}) {
    if (objectAbilities.length === 0 && !mageAbility) return null;

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 bottom-[15.75rem] z-50 flex justify-center px-4"
            data-testid="mage-wars-selected-ability-action-dock"
            data-ability-action-placement="middle-lower-action-dock"
        >
            <section className="pointer-events-auto flex max-w-[38rem] items-center gap-3 rounded-[0.35rem] border border-amber-100/18 bg-stone-950/90 px-4 py-2.5 shadow-[0_16px_38px_rgba(0,0,0,0.52)]">
                {sourceName ? (
                    <div
                        className="max-w-[11rem] truncate text-xs font-bold text-stone-300"
                        data-testid="mage-wars-selected-ability-source-label"
                    >
                        {sourceName}
                    </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {objectId ? objectAbilities.map((ability) => (
                        <button
                            key={ability.id}
                            type="button"
                            className="min-h-9 rounded-[0.25rem] border border-amber-100/28 bg-amber-200 px-3 py-1.5 text-xs font-black text-stone-950 shadow-[0_8px_18px_rgba(0,0,0,0.36)] transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                            aria-label={ability.name}
                            title={ability.name}
                            data-testid={getMageWarsObjectAbilityButtonTestId(ability.id)}
                            data-ability-id={ability.id}
                            data-ability-visual="text-action"
                            data-ability-action-placement="middle-lower-action-dock"
                            onClick={() => onObjectAbilitySelect(objectId, ability.id)}
                        >
                            {ability.name}
                        </button>
                    )) : null}
                    {magePlayerId && mageAbility ? (
                        <button
                            type="button"
                            className="min-h-9 rounded-[0.25rem] border border-cyan-100/32 bg-cyan-200 px-3 py-1.5 text-xs font-black text-stone-950 shadow-[0_8px_18px_rgba(0,0,0,0.36)] transition hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
                            aria-label={mageAbility.name}
                            title={mageAbility.name}
                            data-testid="mage-wars-selected-mage-ability-restore"
                            data-ability-visual="text-action"
                            data-ability-action-placement="middle-lower-action-dock"
                            onClick={() => onMageAbilitySelect(magePlayerId, mageAbility.abilityId)}
                        >
                            {mageAbility.name}
                        </button>
                    ) : null}
                </div>
            </section>
        </aside>
    );
}

function MageObjectAbilityChoiceDock({
    abilityName,
    targetObject,
    selections,
    onSelect,
    onCancel,
}: {
    abilityName?: string;
    targetObject?: MageWarsArenaObjectState;
    selections: readonly ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>[];
    onSelect: (selection: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    if (selections.length === 0) return null;

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 top-[9.25rem] z-50 flex justify-center px-4"
            data-testid="mage-wars-object-ability-choice-dock"
        >
            <section className="pointer-events-auto w-full max-w-[34rem] rounded-[0.35rem] border border-amber-100/18 bg-stone-950/90 px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.55)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-amber-100">
                            {abilityName ?? t('interaction.objectAbilityChoice.fallbackTitle')}
                        </div>
                        {targetObject ? (
                            <div className="mt-0.5 truncate text-xs font-semibold text-stone-300">
                                {targetObject.name}
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className="shrink-0 rounded-[0.25rem] border border-stone-500/60 px-2.5 py-1 text-xs font-bold text-stone-200 transition hover:border-stone-300 hover:bg-stone-800"
                        data-testid="mage-wars-object-ability-choice-cancel"
                        onClick={onCancel}
                    >
                        {t('interaction.mageAbilityStatusChoice.cancel')}
                    </button>
                </div>
                <div className="grid gap-2">
                    {selections.map((selection) => {
                        const manaCost = selection.value?.manaCost ?? 0;
                        return (
                            <button
                                key={selection.id}
                                type="button"
                                className="flex min-h-12 items-center justify-between gap-3 rounded-[0.28rem] border border-amber-100/16 bg-amber-950/30 px-3 py-2 text-left transition hover:border-amber-100/48 hover:bg-amber-900/42"
                                data-testid="mage-wars-object-ability-choice-option"
                                data-choice-id={selection.id}
                                data-mode={selection.value?.mode}
                                data-bound-spell-card-id={selection.value?.boundSpellCardId}
                                data-mana-cost={manaCost}
                                onClick={() => onSelect(selection)}
                            >
                                <span className="min-w-0 truncate text-xs font-bold text-stone-100">
                                    {getObjectAbilityChoiceLabel(selection)}
                                </span>
                                <span className="shrink-0 rounded-full border border-amber-200/30 bg-amber-950/38 px-2.5 py-1 text-xs font-black text-amber-100">
                                    {t('interaction.mageAbilityStatusChoice.manaCost', { manaCost })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </aside>
    );
}

function MageAbilityStatusChoiceDock({
    targetObject,
    selections,
    onSelect,
    onCancel,
}: {
    targetObject?: MageWarsArenaObjectState;
    selections: readonly ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>[];
    onSelect: (selection: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    if (!targetObject || selections.length <= 1) return null;

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 top-[9.25rem] z-50 flex justify-center px-4"
            data-testid="mage-wars-mage-ability-status-choice-dock"
        >
            <section className="pointer-events-auto w-full max-w-[34rem] rounded-[0.35rem] border border-cyan-100/18 bg-stone-950/90 px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.55)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-cyan-100">
                            {t('interaction.mageAbilityStatusChoice.title')}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-semibold text-stone-300">
                            {targetObject.name}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="shrink-0 rounded-[0.25rem] border border-stone-500/60 px-2.5 py-1 text-xs font-bold text-stone-200 transition hover:border-stone-300 hover:bg-stone-800"
                        data-testid="mage-wars-mage-ability-status-choice-cancel"
                        onClick={onCancel}
                    >
                        {t('interaction.mageAbilityStatusChoice.cancel')}
                    </button>
                </div>
                <div className="grid gap-2">
                    {selections.map((selection) => {
                        const statusTokenIds = selection.value?.statusTokenIds ?? [];
                        const manaCost = selection.value?.manaCost ?? 0;
                        const statusNames = statusTokenIds
                            .map((statusTokenId) => getVisibleStatusTokenLabel(t, statusTokenId))
                            .join(' + ');
                        return (
                            <button
                                key={selection.id}
                                type="button"
                                className="flex min-h-12 items-center justify-between gap-3 rounded-[0.28rem] border border-cyan-100/16 bg-cyan-950/30 px-3 py-2 text-left transition hover:border-cyan-100/48 hover:bg-cyan-900/42"
                                data-testid="mage-wars-mage-ability-status-option"
                                data-choice-id={selection.id}
                                data-status-token-ids={statusTokenIds.join(',')}
                                data-mana-cost={manaCost}
                                onClick={() => onSelect(selection)}
                            >
                                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    {statusTokenIds.map((statusTokenId) => {
                                        const token = VISIBLE_STATUS_TOKENS.find((candidate) => candidate.id === statusTokenId);
                                        return token ? (
                                            <span
                                                key={statusTokenId}
                                                className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-xs font-bold text-cyan-50"
                                            >
                                                <TokenImage src={token.image} alt={getVisibleStatusTokenLabel(t, statusTokenId)} className="h-5 w-5" />
                                                {getVisibleStatusTokenLabel(t, statusTokenId)}
                                            </span>
                                        ) : null;
                                    })}
                                    {statusTokenIds.length === 0 ? (
                                        <span className="text-xs font-bold text-stone-200">{statusNames}</span>
                                    ) : null}
                                </span>
                                <span className="shrink-0 rounded-full border border-amber-200/30 bg-amber-950/38 px-2.5 py-1 text-xs font-black text-amber-100">
                                    {t('interaction.mageAbilityStatusChoice.manaCost', { manaCost })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </aside>
    );
}

function MageWarsInteractionDock({
    interaction,
    playerId,
    dispatch,
}: {
    interaction?: InteractionDescriptor;
    playerId: PlayerId;
    dispatch: Props['dispatch'];
}) {
    const { t } = useTranslation('game-mage-wars');
    const prompt = asSimpleChoice(interaction);
    if (!prompt || prompt.playerId !== playerId) return null;

    const title = t(prompt.titleKey ?? prompt.title, {
        ...(prompt.titleParams ?? {}),
        defaultValue: prompt.title,
    });

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 top-[5.5rem] z-50 flex justify-center px-4"
            data-testid="mage-wars-interaction-dock"
        >
            <section className="pointer-events-auto flex max-w-[38rem] items-center gap-3 rounded-[0.35rem] bg-stone-950/88 px-4 py-3 shadow-[0_16px_38px_rgba(0,0,0,0.52)]">
                <div className="min-w-0 text-sm font-semibold text-amber-100">{title}</div>
                <div className="flex shrink-0 items-center gap-2">
                    {prompt.options.filter((option) => !option.disabled).map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className="min-h-9 rounded-[0.25rem] bg-amber-200 px-3 py-1.5 text-xs font-bold text-stone-950 transition hover:bg-amber-100"
                            data-testid="mage-wars-interaction-option"
                            data-option-id={option.id}
                            onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, {
                                interactionId: prompt.id,
                                optionId: option.id,
                            })}
                        >
                            {t(option.labelKey ?? option.label, {
                                ...(option.labelParams ?? {}),
                                defaultValue: option.label,
                            })}
                        </button>
                    ))}
                </div>
            </section>
        </aside>
    );
}

export default function MageWarsBoard({ G, playerID, dispatch, reset, matchData, isMultiplayer }: Props) {
    const { t } = useTranslation('game-mage-wars');
    const [selectedSpellCardId, setSelectedSpellCardId] = useState<number | null>(null);
    const [pendingSpellCastSelection, setPendingSpellCastSelection] = useState<PendingSpellCastSelection | null>(null);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [selectedMageId, setSelectedMageId] = useState<PlayerId | null>(null);
    const [pendingObjectAbility, setPendingObjectAbility] = useState<PendingObjectAbilitySelection | null>(null);
    const [pendingObjectAbilityTargetObjectId, setPendingObjectAbilityTargetObjectId] = useState<string | null>(null);
    const [pendingMageAbility, setPendingMageAbility] = useState<PendingMageAbilitySelection | null>(null);
    const [pendingMageAbilityStatusTargetObjectId, setPendingMageAbilityStatusTargetObjectId] = useState<string | null>(null);
    const [showBoardLifeTotals, setShowBoardLifeTotals] = useState(false);
    const viewport = useRuntimeViewport();
    const phase = G.sys.phase ?? 'reset';
    const core = G.core;
    const players = core.playerOrder.map((id) => core.players[id]).filter(Boolean);
    const viewingPlayerId = resolveViewingPlayerId(core, playerID);
    const phaseActorId = resolveMageWarsPhaseActorId(core);
    const activePlayer = core.players[phaseActorId] ?? players[0];
    const activeOpponentId = resolveOpponentId(core, activePlayer?.id ?? viewingPlayerId);
    const activeOpponent = activeOpponentId ? core.players[activeOpponentId] ?? null : null;
    const viewingPlayer = core.players[viewingPlayerId] ?? activePlayer;
    const opponentId = resolveOpponentId(core, viewingPlayerId);
    const opponent = opponentId ? core.players[opponentId] ?? null : null;
    const gameOverResult = G.sys.gameover;
    const { overlayProps: endgameProps } = useEndgame({
        result: gameOverResult || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });
    const readyPlayerIds = core.phaseReadyPlayerIds ?? [];
    const tutorialRuntimeSyncKey = [
        phase,
        core.currentPlayerId,
        phaseActorId,
        core.turnNumber,
        readyPlayerIds.join(','),
        G.sys.eventStream?.nextId ?? 0,
        G.sys.decisionEpoch ?? 0,
        G.sys.interaction?.current?.id ?? '',
        G.sys.responseWindow?.current?.id ?? '',
        G.sys.responseWindow?.current?.currentResponderIndex ?? '',
    ].join('|');
    useTutorialBridge(G.sys.tutorial, dispatch, tutorialRuntimeSyncKey);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
    const isCommandAllowed = (commandType: string) => {
        if (!isTutorialActive || !tutorialStep) return true;
        if (!tutorialStep.allowedCommands || tutorialStep.allowedCommands.length === 0) return !tutorialStep.infoStep;
        return tutorialStep.allowedCommands.includes(commandType);
    };
    const canAdvance = isPlayerId(playerID)
        && !readyPlayerIds.includes(playerID)
        && (SIMULTANEOUS_PREPARATION_PHASES.has(phase) || playerID === phaseActorId)
        && isCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE);
    const canAct = isPlayerId(playerID)
        && !readyPlayerIds.includes(playerID)
        && (phase === 'planning' || playerID === phaseActorId);
    const availableObjectAbilityIdsByObjectId = new Map<string, MageWarsObjectAbilityId[]>();
    if (canAct && activePlayer && isCommandAllowed(MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY)) {
        for (const object of Object.values(core.objects)) {
            if (object.ownerId !== activePlayer.id) continue;
            const abilityIds = MAGE_WARS_OBJECT_ABILITY_ID_LIST.filter((abilityId) => {
                const opportunity = buildMageWarsObjectAbilityActivationOpportunity({
                    state: G,
                    playerId: object.ownerId,
                    objectId: object.id,
                    abilityId,
                });
                const request = opportunity ? buildChoiceRequestFromOpportunity(opportunity) : null;
                return hasEnabledChoiceCandidate(request?.candidates);
            });
            if (abilityIds.length > 0) availableObjectAbilityIdsByObjectId.set(object.id, abilityIds);
        }
    }
    const objectAbilitySourceIds = new Set(availableObjectAbilityIdsByObjectId.keys());
    const pendingObjectAbilityOpportunity = (() => {
        if (!pendingObjectAbility) return null;
        const sourceObject = core.objects[pendingObjectAbility.objectId];
        if (!sourceObject) return null;
        return buildMageWarsObjectAbilityActivationOpportunity({
            state: G,
            playerId: sourceObject.ownerId,
            objectId: sourceObject.id,
            abilityId: pendingObjectAbility.abilityId,
        });
    })();
    const pendingObjectAbilityRequest = pendingObjectAbilityOpportunity
        ? buildChoiceRequestFromOpportunity(pendingObjectAbilityOpportunity)
        : null;
    const pendingObjectAbilityTargetSurface = pendingObjectAbilityRequest
        ? projectChoiceRequestToDirectSelectionTargets<MageWarsObjectAbilityActivationChoiceValue>(
            pendingObjectAbilityRequest,
            { playerId: pendingObjectAbilityRequest.playerId },
        )
        : null;
    const pendingObjectAbilityTargetsByObjectId = buildObjectAbilityTargetsByObjectId(
        pendingObjectAbilityTargetSurface?.targets,
    );
    const pendingObjectAbilityTargetIds = new Set(pendingObjectAbilityTargetsByObjectId.keys());
    const pendingObjectAbilityTargetObject = pendingObjectAbilityTargetObjectId
        ? core.objects[pendingObjectAbilityTargetObjectId]
        : undefined;
    const pendingObjectAbilityTargetSelections = pendingObjectAbilityTargetObjectId
        ? pendingObjectAbilityTargetsByObjectId.get(pendingObjectAbilityTargetObjectId) ?? []
        : [];
    const pendingObjectAbilityCardSelections = pendingObjectAbilityTargetSurface?.targets
        .filter((target) => !target.disabled && !target.stale && typeof target.targetRef === 'number')
        .sort(compareObjectAbilityTargets) ?? [];
    const pendingObjectAbilityDef = pendingObjectAbility
        ? mageWarsObjectAbilityRegistry.get(pendingObjectAbility.abilityId)
        : undefined;
    const pendingObjectAbilityChoiceSelections = pendingObjectAbilityTargetSelections.length > 1
        ? pendingObjectAbilityTargetSelections
        : pendingObjectAbilityRequest?.kind === 'select-card'
            ? pendingObjectAbilityCardSelections
            : [];
    const pendingMageAbilityOpportunity = pendingMageAbility
        ? buildMageWarsMageAbilityActivationOpportunity({
            state: G,
            playerId: pendingMageAbility.playerId,
            abilityId: pendingMageAbility.abilityId,
        })
        : null;
    const pendingMageAbilityRequest = pendingMageAbilityOpportunity
        ? buildChoiceRequestFromOpportunity(pendingMageAbilityOpportunity)
        : null;
    const pendingMageAbilityTargetSurface = pendingMageAbilityRequest
        ? projectChoiceRequestToDirectSelectionTargets<MageWarsMageAbilityActivationChoiceValue>(
            pendingMageAbilityRequest,
            { playerId: pendingMageAbilityRequest.playerId },
        )
        : null;
    const pendingMageAbilityTargetsByObjectId = buildMageAbilityTargetsByObjectId(
        pendingMageAbilityTargetSurface?.targets,
    );
    const pendingMageAbilityTargetIds = new Set(pendingMageAbilityTargetsByObjectId.keys());
    const pendingMageAbilityStatusTargetObject = pendingMageAbilityStatusTargetObjectId
        ? core.objects[pendingMageAbilityStatusTargetObjectId]
        : undefined;
    const pendingMageAbilityStatusSelections = pendingMageAbilityStatusTargetObjectId
        ? pendingMageAbilityTargetsByObjectId.get(pendingMageAbilityStatusTargetObjectId) ?? []
        : [];
    const phasePriestessRestoreAbilityId = resolveMageWarsPriestessRestoreAbilityIdForPhase(phase);
    const mageRestoreAvailablePlayerIds = new Set<PlayerId>(
        phasePriestessRestoreAbilityId
            ? players
                .filter((player) => {
                    const opportunity = buildMageWarsMageAbilityActivationOpportunity({
                        state: G,
                        playerId: player.id,
                        abilityId: phasePriestessRestoreAbilityId,
                    });
                    const request = opportunity ? buildChoiceRequestFromOpportunity(opportunity) : null;
                    return hasEnabledChoiceCandidate(request?.candidates);
                })
                .map((player) => player.id)
            : [],
    );
    const isLandscapeMobileViewport = viewport.width <= 1023 && viewport.width > viewport.height;
    const selectedSpell = selectedSpellCardId == null
        ? undefined
        : getMageWarsSpellCardFromConfig(selectedSpellCardId);
    const selectedSpellCastOpportunity = selectedSpellCardId != null && activePlayer
        ? buildMageWarsSpellCastOpportunity({
            state: G,
            playerId: activePlayer.id,
            spellCardId: selectedSpellCardId,
        })
        : null;
    const selectedSpellCastRequest = selectedSpellCastOpportunity
        ? buildChoiceRequestFromOpportunity(selectedSpellCastOpportunity)
        : null;
    const selectedSpellCastTargetSurface = selectedSpellCastRequest
        ? projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(
            selectedSpellCastRequest,
            { playerId: selectedSpellCastRequest.playerId },
        )
        : null;
    const hasSelectedSpellCastContract = selectedSpellCastTargetSurface != null;
    const selectedSpellCastTargetsByObjectId = selectedSpellCastTargetSurface
        ? buildSpellCastTargetsByObjectId(selectedSpellCastTargetSurface.targets)
        : undefined;
    const selectedSpellCastTargetIds = selectedSpellCastTargetsByObjectId
        ? new Set(selectedSpellCastTargetsByObjectId.keys())
        : undefined;
    const selectedSpellCastTargetsByPlayerId = selectedSpellCastTargetSurface
        ? buildSpellCastTargetsByPlayerId(selectedSpellCastTargetSurface.targets)
        : undefined;
    const selectedSpellCastTargetPlayerIds = selectedSpellCastTargetsByPlayerId && selectedSpellCastTargetsByPlayerId.size > 0
        ? new Set(selectedSpellCastTargetsByPlayerId.keys())
        : undefined;
    const selectedSpellCastTargetsByZoneId = selectedSpellCastTargetSurface
        ? buildSpellCastTargetsByZoneId(selectedSpellCastTargetSurface.targets)
        : undefined;
    const selectedSpellCastTargetZoneIds = selectedSpellCastTargetsByZoneId && selectedSpellCastTargetsByZoneId.size > 0
        ? new Set(selectedSpellCastTargetsByZoneId.keys())
        : undefined;
    const selectedSpellCastTargetsByWallEdgeId = selectedSpellCastTargetSurface
        ? buildSpellCastTargetsByWallEdgeId(selectedSpellCastTargetSurface.targets)
        : undefined;
    const selectedSpellCastTargetWallEdgeIds = selectedSpellCastTargetsByWallEdgeId && selectedSpellCastTargetsByWallEdgeId.size > 0
        ? new Set(selectedSpellCastTargetsByWallEdgeId.keys())
        : undefined;
    const selectedSpellCastEnabledPayloads = (selectedSpellCastTargetSurface?.targets ?? [])
        .filter((targetSelection) => targetSelection.disabled !== true && targetSelection.stale !== true)
        .map(readMageWarsCastSpellPayload)
        .filter((payload): payload is MageWarsCastSpellCommand['payload'] => payload != null);
    const pendingSpellTargetObjectId = pendingSpellCastSelection?.kind === 'object'
        ? pendingSpellCastSelection.objectId
        : null;
    const pendingSpellTargetPlayerId = pendingSpellCastSelection?.kind === 'player'
        ? pendingSpellCastSelection.playerId
        : null;
    const pendingSpellChainTargetObjectIds = pendingSpellCastSelection?.kind === 'object'
        ? pendingSpellCastSelection.chainTargetObjectIds
        : [];
    const pendingSpellCastTargetSelections = pendingSpellTargetObjectId && selectedSpellCastTargetsByObjectId
        ? selectedSpellCastTargetsByObjectId.get(pendingSpellTargetObjectId) ?? []
        : [];
    const pendingSpellCastPlayerSelections = pendingSpellTargetPlayerId && selectedSpellCastTargetsByPlayerId
        ? selectedSpellCastTargetsByPlayerId.get(pendingSpellTargetPlayerId) ?? []
        : [];
    const pendingSpellTargetPlayer = pendingSpellTargetPlayerId
        ? core.players[pendingSpellTargetPlayerId]
        : undefined;
    const pendingSpellCastDestinationSelections = pendingSpellCastTargetSelections.length > 0
        ? pendingSpellCastTargetSelections
        : pendingSpellCastPlayerSelections;
    const selectedSpellCastDestinationZoneIds = pendingSpellCastDestinationSelections.length > 0
        ? buildNonEmptySet(pendingSpellCastDestinationSelections
            .map((targetSelection) => {
                const payload = readMageWarsCastSpellPayload(targetSelection);
                return payload?.pushToZoneId ?? payload?.targetZoneId;
            })
            .filter((zoneId): zoneId is ArenaZoneId => zoneId !== undefined))
        : undefined;
    const selectedSpellCastNewTargetObjectIds = pendingSpellCastTargetSelections.length > 0
        ? buildNonEmptySet(pendingSpellCastTargetSelections
            .map((targetSelection) => readMageWarsCastSpellPayload(targetSelection)?.newTargetObjectId)
            .filter((objectId): objectId is string => objectId !== undefined))
        : undefined;
    const selectedSpellCastNewTargetPlayerIds = pendingSpellCastTargetSelections.length > 0
        ? buildNonEmptySet(pendingSpellCastTargetSelections
            .map((targetSelection) => readMageWarsCastSpellPayload(targetSelection)?.newTargetPlayerId)
            .filter((playerId): playerId is PlayerId => playerId !== undefined))
        : undefined;
    const selectedSpellCastNewTargetZoneIds = pendingSpellCastTargetSelections.length > 0
        ? buildNonEmptySet(pendingSpellCastTargetSelections
            .map((targetSelection) => readMageWarsCastSpellPayload(targetSelection)?.newTargetZoneId)
            .filter((zoneId): zoneId is ArenaZoneId => zoneId !== undefined))
        : undefined;
    const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
    const selectedObjectAvailableAbilityIds = new Set<MageWarsObjectAbilityId>(
        selectedObject ? availableObjectAbilityIdsByObjectId.get(selectedObject.id) ?? [] : [],
    );
    const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
    const selectedMageAvailableAbilityIds = new Set<MageWarsMageAbilityId>(
        selectedMage && phasePriestessRestoreAbilityId && mageRestoreAvailablePlayerIds.has(selectedMage.id)
            ? [phasePriestessRestoreAbilityId]
            : [],
    );
    const selectedObjectAvailableAbilities = selectedObject
        ? MAGE_WARS_OBJECT_ABILITY_ID_LIST.flatMap((abilityId) => {
            if (!selectedObjectAvailableAbilityIds.has(abilityId)) return [];
            const ability = mageWarsObjectAbilityRegistry.get(abilityId);
            return ability ? [ability] : [];
        })
        : [];
    const selectedMageRestoreAbility = selectedMage && phasePriestessRestoreAbilityId
        && selectedMageAvailableAbilityIds.has(phasePriestessRestoreAbilityId)
        ? getMageWarsMageAbilityFromConfig(selectedMage.mageId, phasePriestessRestoreAbilityId)
        : undefined;
    const selectedAbilitySourceName = selectedObject?.name
        ?? (selectedMage ? getMageDisplayLabel(selectedMage) : undefined);
    const shouldShowSelectedAbilityActionDock = Boolean(
        !selectedSpell
        && !pendingSpellCastSelection
        && !pendingObjectAbility
        && !pendingMageAbility
        && !G.sys.interaction?.current
        && (selectedObjectAvailableAbilities.length > 0 || selectedMageRestoreAbility),
    );
    const spellNeedsWallEdgeTarget = selectedSpellCastTargetWallEdgeIds !== undefined;
    const spellNeedsZoneTarget = selectedSpellCastTargetZoneIds !== undefined;
    const selectedSpellUsesConfirmChoice = selectedSpellCastRequest?.kind === 'confirm';
    const spellNeedsDestinationZone = selectedSpellCastEnabledPayloads.some((payload) => (
        (payload.targetObjectId !== undefined || payload.targetPlayerId !== undefined)
        && (payload.pushToZoneId !== undefined || payload.targetZoneId !== undefined)
    ));
    const spellNeedsNewAnchorTarget = selectedSpellCastEnabledPayloads.some((payload) => (
        payload.targetObjectId !== undefined
        && (
            payload.newTargetObjectId !== undefined
            || payload.newTargetPlayerId !== undefined
            || payload.newTargetZoneId !== undefined
        )
    ));
    const spellNeedsChainTargets = selectedSpellCastEnabledPayloads.some((payload) => (
        payload.targetObjectId !== undefined
        && payload.chainLightningTargets !== undefined
    ));
    const pendingSpellChainPathObjectIds = pendingSpellTargetObjectId
        ? [pendingSpellTargetObjectId, ...pendingSpellChainTargetObjectIds]
        : [];
    const pendingSpellChainSelections = spellNeedsChainTargets && pendingSpellChainPathObjectIds.length > 0
        ? pendingSpellCastTargetSelections.filter((targetSelection) => (
            startsWithObjectPath(readMageWarsCastSpellChainObjectIds(targetSelection), pendingSpellChainPathObjectIds)
        ))
        : [];
    const selectedSpellCastChainPathObjectIds = pendingSpellChainPathObjectIds.length > 0
        ? buildNonEmptySet(pendingSpellChainPathObjectIds)
        : undefined;
    const selectedSpellCastNextChainTargetObjectIds = pendingSpellChainSelections.length > 0
        ? buildNonEmptySet(pendingSpellChainSelections
            .map((targetSelection) => readMageWarsCastSpellChainObjectIds(targetSelection)[pendingSpellChainPathObjectIds.length])
            .filter((objectId): objectId is string => objectId !== undefined))
        : undefined;
    const selectedSpellCastCurrentChainSelection = pendingSpellChainSelections.find((targetSelection) => (
        hasSameObjectPath(readMageWarsCastSpellChainObjectIds(targetSelection), pendingSpellChainPathObjectIds)
    ));
    const selectedSpellCastCurrentChainSubmitObjectId = selectedSpellCastCurrentChainSelection
        ? pendingSpellChainPathObjectIds[pendingSpellChainPathObjectIds.length - 1]
        : undefined;
    const submitSpellCastTargetSelection = (
        targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue>,
    ): boolean => {
        const command = targetSelection.commandPreview.find((candidateCommand) => (
            candidateCommand.type === MAGE_WARS_COMMANDS.CAST_SPELL
        ));
        if (!command || !isCommandAllowed(MAGE_WARS_COMMANDS.CAST_SPELL)) return false;
        dispatch(MAGE_WARS_COMMANDS.CAST_SPELL, command.payload);
        setSelectedSpellCardId(null);
        setPendingSpellCastSelection(null);
        setSelectedObjectId(null);
        setSelectedMageId(null);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        return true;
    };
    const submitObjectAbilityTargetSelection = (
        targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsObjectAbilityActivationChoiceValue>,
    ): boolean => {
        const command = targetSelection.commandPreview.find((candidateCommand) => (
            candidateCommand.type === MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY
        ));
        if (!command || !isCommandAllowed(MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY)) return false;
        dispatch(MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY, command.payload);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setSelectedObjectId(null);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        return true;
    };
    const submitMageAbilityTargetSelection = (
        targetSelection: ChoiceRequestDirectSelectionTarget<MageWarsMageAbilityActivationChoiceValue>,
    ): boolean => {
        const command = targetSelection.commandPreview.find((candidateCommand) => (
            candidateCommand.type === MAGE_WARS_COMMANDS.USE_MAGE_ABILITY
        ));
        if (!command || !isCommandAllowed(MAGE_WARS_COMMANDS.USE_MAGE_ABILITY)) return false;
        dispatch(MAGE_WARS_COMMANDS.USE_MAGE_ABILITY, command.payload);
        setPendingMageAbility(null);
        setSelectedMageId(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        return true;
    };
    const findSpellCastDestinationSelection = (
        objectId: string,
        zoneId: ArenaZoneId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        selectedSpellCastTargetsByObjectId?.get(objectId)?.find((targetSelection) => {
            const payload = readMageWarsCastSpellPayload(targetSelection);
            return payload?.pushToZoneId === zoneId || payload?.targetZoneId === zoneId;
        })
    );
    const findSpellCastPlayerDestinationSelection = (
        playerId: PlayerId,
        zoneId: ArenaZoneId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        selectedSpellCastTargetsByPlayerId?.get(playerId)?.find((targetSelection) => {
            const payload = readMageWarsCastSpellPayload(targetSelection);
            return payload?.pushToZoneId === zoneId || payload?.targetZoneId === zoneId;
        })
    );
    const findSpellCastNewTargetObjectSelection = (
        sourceObjectId: string,
        newTargetObjectId: string,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        selectedSpellCastTargetsByObjectId?.get(sourceObjectId)?.find((targetSelection) => (
            readMageWarsCastSpellPayload(targetSelection)?.newTargetObjectId === newTargetObjectId
        ))
    );
    const findSpellCastNewTargetPlayerSelection = (
        sourceObjectId: string,
        newTargetPlayerId: PlayerId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        selectedSpellCastTargetsByObjectId?.get(sourceObjectId)?.find((targetSelection) => (
            readMageWarsCastSpellPayload(targetSelection)?.newTargetPlayerId === newTargetPlayerId
        ))
    );
    const findSpellCastNewTargetZoneSelection = (
        sourceObjectId: string,
        newTargetZoneId: ArenaZoneId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        selectedSpellCastTargetsByObjectId?.get(sourceObjectId)?.find((targetSelection) => (
            readMageWarsCastSpellPayload(targetSelection)?.newTargetZoneId === newTargetZoneId
        ))
    );
    const findSpellCastChainSelection = (
        pathObjectIds: readonly string[],
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => (
        pendingSpellCastTargetSelections.find((targetSelection) => (
            hasSameObjectPath(readMageWarsCastSpellChainObjectIds(targetSelection), pathObjectIds)
        ))
    );
    const hasSpellCastChainContinuation = (pathObjectIds: readonly string[]): boolean => (
        pendingSpellCastTargetSelections.some((targetSelection) => {
            const path = readMageWarsCastSpellChainObjectIds(targetSelection);
            return startsWithObjectPath(path, pathObjectIds) && path.length > pathObjectIds.length;
        })
    );
    const findSpellCastZoneSelection = (
        zoneId: ArenaZoneId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => {
        const zoneSelections = selectedSpellCastTargetsByZoneId?.get(zoneId) ?? [];
        if (zoneSelections.length > 1) {
            throw new Error(`Mage Wars spell cast zone ${zoneId} has multiple direct selections`);
        }
        return zoneSelections[0];
    };
    const findSpellCastWallEdgeSelection = (
        edgeId: MageWarsWallEdgeId,
    ): ChoiceRequestDirectSelectionTarget<MageWarsSpellCastChoiceValue> | undefined => {
        const edgeSelections = selectedSpellCastTargetsByWallEdgeId?.get(edgeId) ?? [];
        if (edgeSelections.length > 1) {
            throw new Error(`Mage Wars spell cast wall edge ${edgeId} has multiple direct selections`);
        }
        return edgeSelections[0];
    };
    const handleZoneSelect = (zoneId: ArenaZoneId) => {
        if (pendingObjectAbility || pendingMageAbility) return;
        const pendingSpellTargetObject = pendingSpellTargetObjectId ? core.objects[pendingSpellTargetObjectId] : undefined;
        const pendingSpellTargetPlayer = pendingSpellTargetPlayerId ? core.players[pendingSpellTargetPlayerId] : undefined;
        if (selectedSpellCardId != null && selectedSpell && pendingSpellTargetObject) {
            const destinationSelection = findSpellCastDestinationSelection(pendingSpellTargetObject.id, zoneId);
            if (destinationSelection) {
                submitSpellCastTargetSelection(destinationSelection);
                return;
            }
            const newTargetZoneSelection = findSpellCastNewTargetZoneSelection(pendingSpellTargetObject.id, zoneId);
            if (newTargetZoneSelection) {
                submitSpellCastTargetSelection(newTargetZoneSelection);
                return;
            }
            return;
        }
        if (selectedSpellCardId != null && selectedSpell && pendingSpellTargetPlayer) {
            const destinationSelection = findSpellCastPlayerDestinationSelection(pendingSpellTargetPlayer.id, zoneId);
            if (destinationSelection) {
                submitSpellCastTargetSelection(destinationSelection);
                return;
            }
            return;
        }
        if (selectedSpellCardId != null && selectedSpell && !pendingSpellTargetObject && !pendingSpellTargetPlayer) {
            const zoneSelection = findSpellCastZoneSelection(zoneId);
            if (zoneSelection) {
                submitSpellCastTargetSelection(zoneSelection);
                return;
            }
            return;
        }
        const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
        if (selectedObject) {
            if (
                !canAct
                || !isCommandAllowed(MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT)
                || !isCreatureActionPhase(phase)
                || !selectedObject.actionReady
                || isMageWarsArenaObjectRestrained(selectedObject)
                || !areAdjacentZones(core, selectedObject.zoneId, zoneId)
            ) return;
            dispatch(MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT, {
                objectId: selectedObject.id,
                toZoneId: zoneId,
            });
            setSelectedObjectId(null);
            return;
        }
        if (selectedMage) {
            if (
                !canAct
                || !isCommandAllowed(MAGE_WARS_COMMANDS.MOVE_MAGE)
                || !isCreatureActionPhase(phase)
                || selectedMage.id !== activePlayer?.id
                || !selectedMage.actionReady
                || !areAdjacentZones(core, selectedMage.mageZoneId, zoneId)
            ) return;
            dispatch(MAGE_WARS_COMMANDS.MOVE_MAGE, { toZoneId: zoneId });
            setSelectedMageId(null);
            return;
        }
    };
    const handleWallEdgeSelect = (edgeId: MageWarsWallEdgeId) => {
        if (pendingObjectAbility || pendingMageAbility) return;
        if (selectedSpellCardId == null || !selectedSpell || !spellNeedsWallEdgeTarget) return;
        const wallEdgeSelection = findSpellCastWallEdgeSelection(edgeId);
        if (wallEdgeSelection) {
            submitSpellCastTargetSelection(wallEdgeSelection);
            return;
        }
    };
    const handleObjectSelect = (objectId: string) => {
        const target = core.objects[objectId];
        if (pendingObjectAbility) {
            const targetSelections = pendingObjectAbilityTargetsByObjectId.get(objectId) ?? [];
            if (targetSelections.length === 1) submitObjectAbilityTargetSelection(targetSelections[0]);
            if (targetSelections.length > 1) setPendingObjectAbilityTargetObjectId(objectId);
            return;
        }
        if (pendingMageAbility) {
            const targetSelections = pendingMageAbilityTargetsByObjectId.get(objectId) ?? [];
            if (targetSelections.length === 1) submitMageAbilityTargetSelection(targetSelections[0]);
            if (targetSelections.length > 1) setPendingMageAbilityStatusTargetObjectId(objectId);
            return;
        }
        const attacker = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const profile = attacker
            ? getMageWarsObjectAttackProfiles(attacker).find((candidate) => (
                attacker.actionReady || canMageWarsObjectUsePostMoveQuickAction(attacker, candidate)
            ))
            : undefined;
        if (
            attacker
            && target
            && profile
            && isCommandAllowed(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK)
            && attacker.ownerId === activePlayer?.id
            && target.ownerId !== activePlayer?.id
            && isMageWarsObjectAttackTargetSelectable(core, attacker.zoneId, target.zoneId, profile)
        ) {
            dispatch(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK, {
                attackerObjectId: attacker.id,
                attackProfileId: profile.id,
                targetObjectId: target.id,
            });
            setSelectedObjectId(null);
            return;
        }
        if (selectedSpellCardId != null && !selectedSpellUsesConfirmChoice) {
            if (pendingSpellTargetObjectId) {
                if (spellNeedsChainTargets) {
                    const currentChainSelection = findSpellCastChainSelection(pendingSpellChainPathObjectIds);
                    if (objectId === selectedSpellCastCurrentChainSubmitObjectId && currentChainSelection) {
                        submitSpellCastTargetSelection(currentChainSelection);
                        return;
                    }

                    const candidatePath = [...pendingSpellChainPathObjectIds, objectId];
                    const nextChainSelection = findSpellCastChainSelection(candidatePath);
                    if (nextChainSelection) {
                        if (hasSpellCastChainContinuation(candidatePath)) {
                            setPendingSpellCastSelection({
                                kind: 'object',
                                objectId: pendingSpellTargetObjectId,
                                chainTargetObjectIds: candidatePath.slice(1),
                            });
                            return;
                        }
                        submitSpellCastTargetSelection(nextChainSelection);
                        return;
                    }

                    if (hasSelectedSpellCastContract) return;
                }
                const newTargetObjectSelection = findSpellCastNewTargetObjectSelection(pendingSpellTargetObjectId, objectId);
                if (newTargetObjectSelection) {
                    submitSpellCastTargetSelection(newTargetObjectSelection);
                    return;
                }
                if (hasSelectedSpellCastContract) return;
            }
            const spellCastTargetSelections = selectedSpellCastTargetsByObjectId?.get(objectId) ?? [];
            if (selectedSpell && (spellNeedsDestinationZone || spellNeedsNewAnchorTarget)) {
                if (spellCastTargetSelections.length > 0) {
                    setPendingSpellCastSelection({ kind: 'object', objectId, chainTargetObjectIds: [] });
                    return;
                }
                return;
            }
            if (selectedSpell && spellNeedsChainTargets) {
                const firstPath = [objectId];
                const firstChainSelection = spellCastTargetSelections.find((targetSelection) => (
                    hasSameObjectPath(readMageWarsCastSpellChainObjectIds(targetSelection), firstPath)
                ));
                const hasFirstChainContinuation = spellCastTargetSelections.some((targetSelection) => {
                    const path = readMageWarsCastSpellChainObjectIds(targetSelection);
                    return startsWithObjectPath(path, firstPath) && path.length > firstPath.length;
                });
                if (hasFirstChainContinuation) {
                    setPendingSpellCastSelection({ kind: 'object', objectId, chainTargetObjectIds: [] });
                    return;
                }
                if (firstChainSelection) {
                    submitSpellCastTargetSelection(firstChainSelection);
                    return;
                }
                if (hasSelectedSpellCastContract) return;
            }
            if (spellCastTargetSelections.length === 1) {
                submitSpellCastTargetSelection(spellCastTargetSelections[0]);
                return;
            }
            if (spellCastTargetSelections.length > 1) {
                setPendingSpellCastSelection({ kind: 'object', objectId, chainTargetObjectIds: [] });
                return;
            }
            return;
        }
    };
    const handlePlayerSelect = (targetPlayerId: PlayerId) => {
        if (pendingObjectAbility || pendingMageAbility) return;
        const target = core.players[targetPlayerId];
        if (selectedSpellCardId != null && pendingSpellTargetObjectId) {
            const newTargetPlayerSelection = findSpellCastNewTargetPlayerSelection(
                pendingSpellTargetObjectId,
                targetPlayerId,
            );
            if (newTargetPlayerSelection) {
                submitSpellCastTargetSelection(newTargetPlayerSelection);
                return;
            }
            if (hasSelectedSpellCastContract) return;
        }
        if (selectedSpellCardId != null && !pendingSpellTargetObjectId) {
            const playerSelections = selectedSpellCastTargetsByPlayerId?.get(targetPlayerId) ?? [];
            if (selectedSpell && spellNeedsDestinationZone) {
                if (playerSelections.length > 0) {
                    setPendingSpellCastSelection({ kind: 'player', playerId: targetPlayerId });
                    return;
                }
                return;
            }
            if (playerSelections.length === 1) {
                submitSpellCastTargetSelection(playerSelections[0]);
                return;
            }
            if (playerSelections.length > 1) {
                setPendingSpellCastSelection({ kind: 'player', playerId: targetPlayerId });
                return;
            }
            if (hasSelectedSpellCastContract) return;
        }
        const attacker = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
        const profile = attacker
            ? getMageWarsObjectAttackProfiles(attacker).find((candidate) => (
                attacker.actionReady || canMageWarsObjectUsePostMoveQuickAction(attacker, candidate)
            ))
            : undefined;
        if (target && target.id === activeOpponent?.id && attacker && profile) {
            if (
                attacker.ownerId !== activePlayer?.id
                || !isCommandAllowed(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK)
                || !isMageWarsObjectAttackTargetSelectable(core, attacker.zoneId, target.mageZoneId, profile)
            ) return;
            dispatch(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK, {
                attackerObjectId: attacker.id,
                attackProfileId: profile.id,
                targetPlayerId,
            });
            setSelectedObjectId(null);
            return;
        }
        if (target && target.id === activeOpponent?.id && selectedMage) {
            if (
                !canAct
                || !isCommandAllowed(MAGE_WARS_COMMANDS.DECLARE_ATTACK)
                || !isCreatureActionPhase(phase)
                || selectedMage.id !== activePlayer?.id
                || !selectedMage.actionReady
                || selectedMage.mageZoneId !== target.mageZoneId
            ) return;
            dispatch(MAGE_WARS_COMMANDS.DECLARE_ATTACK, { targetPlayerId });
            setSelectedMageId(null);
            return;
        }
    };
    const handleActorObjectSelect = (objectId: string) => {
        setSelectedSpellCardId(null);
        setPendingSpellCastSelection(null);
        setSelectedMageId(null);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        setSelectedObjectId((current) => current === objectId ? null : objectId);
    };
    const handleActorMageSelect = (mageId: PlayerId) => {
        setSelectedSpellCardId(null);
        setPendingSpellCastSelection(null);
        setSelectedObjectId(null);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        setSelectedMageId((current) => current === mageId ? null : mageId);
    };
    const handleGuard = () => {
        if (!canAct || !isCommandAllowed(MAGE_WARS_COMMANDS.GUARD) || !isCreatureActionPhase(phase)) return;
        const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
        if (selectedObject?.ownerId === activePlayer?.id && selectedObject.actionReady) {
            dispatch(MAGE_WARS_COMMANDS.GUARD, { objectId: selectedObject.id });
            setSelectedObjectId(null);
            setPendingObjectAbility(null);
            setPendingObjectAbilityTargetObjectId(null);
            setPendingMageAbility(null);
            setPendingMageAbilityStatusTargetObjectId(null);
            return;
        }
        if (selectedMage?.id === activePlayer?.id && selectedMage.actionReady) {
            dispatch(MAGE_WARS_COMMANDS.GUARD, {});
            setSelectedMageId(null);
            setPendingObjectAbility(null);
            setPendingObjectAbilityTargetObjectId(null);
            setPendingMageAbility(null);
            setPendingMageAbilityStatusTargetObjectId(null);
        }
    };
    const handleObjectAbilitySelect = (sourceObjectId: string, abilityId: MageWarsObjectAbilityId) => {
        if (!isCommandAllowed(MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY)) return;
        setSelectedSpellCardId(null);
        setPendingSpellCastSelection(null);
        setSelectedMageId(null);
        setSelectedObjectId(sourceObjectId);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        setPendingObjectAbilityTargetObjectId(null);
        const sourceObject = core.objects[sourceObjectId];
        const opportunity = sourceObject
            ? buildMageWarsObjectAbilityActivationOpportunity({
                state: G,
                playerId: sourceObject.ownerId,
                objectId: sourceObject.id,
                abilityId,
            })
            : null;
        const request = opportunity ? buildChoiceRequestFromOpportunity(opportunity) : null;
        const enabledCandidates = request?.candidates.filter((candidate) => (
            candidate.disabled !== true && candidate.stale !== true
        )) ?? [];
        if (request?.kind === 'confirm' && enabledCandidates.length === 1) {
            const command = enabledCandidates[0].commands?.find((candidateCommand) => (
                candidateCommand.type === MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY
            ));
            if (command) {
                dispatch(MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY, command.payload);
                setSelectedObjectId(null);
                setPendingObjectAbility(null);
                return;
            }
        }
        setPendingObjectAbility({ objectId: sourceObjectId, abilityId });
    };
    const handleMageAbilitySelect = (sourcePlayerId: PlayerId, abilityId: MageWarsMageAbilityId) => {
        if (!isCommandAllowed(MAGE_WARS_COMMANDS.USE_MAGE_ABILITY)) return;
        setSelectedSpellCardId(null);
        setPendingSpellCastSelection(null);
        setSelectedObjectId(null);
        setSelectedMageId(sourcePlayerId);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        setPendingMageAbility({ playerId: sourcePlayerId, abilityId });
    };
    const handlePreparedSpellSelect = (cardId: number) => {
        if (!isCommandAllowed(MAGE_WARS_COMMANDS.CAST_SPELL)) return;
        const spell = getMageWarsSpellCardFromConfig(cardId);
        if (canAct && activePlayer) {
            const opportunity = buildMageWarsSpellCastOpportunity({
                state: G,
                playerId: activePlayer.id,
                spellCardId: cardId,
            });
            const request = opportunity ? buildChoiceRequestFromOpportunity(opportunity) : null;
            if (request?.kind === 'confirm') {
                const surface = projectChoiceRequestToDirectSelectionTargets<MageWarsSpellCastChoiceValue>(
                    request,
                    { playerId: request.playerId },
                );
                const enabledSelections = surface.targets.filter((target) => (
                    target.disabled !== true && target.stale !== true
                ));
                if (enabledSelections.length === 1) {
                    submitSpellCastTargetSelection(enabledSelections[0]);
                }
                return;
            }
        }
        setSelectedObjectId(null);
        setSelectedMageId(null);
        setPendingSpellCastSelection(null);
        setPendingObjectAbility(null);
        setPendingObjectAbilityTargetObjectId(null);
        setPendingMageAbility(null);
        setPendingMageAbilityStatusTargetObjectId(null);
        setSelectedSpellCardId((current) => current === cardId ? null : cardId);
    };
    const renderPipelineSettings = useRenderPipelineSettings();
    const fxBus = useFxBus(mageWarsFxRegistry, {
        quality: renderPipelineSettings.fxQuality,
        reduceWhenHighCostActiveAt: renderPipelineSettings.reduceWhenHighCostActiveAt,
        dropWhenHighCostActiveAt: renderPipelineSettings.dropWhenHighCostActiveAt,
        maxDpr: renderPipelineSettings.maxDpr,
        reducedMaxDpr: renderPipelineSettings.reducedMaxDpr,
    });
    const fxAnchors = useFxAnchorRegistry(MAGE_WARS_ARENA_FX_SURFACE_ID, 'board');
    const mageWarsEvents = useMageWarsGameEvents({
        G,
        fxBus,
        resolveFxAnchorSnapshot: fxAnchors.resolveSnapshot,
    });
    const getVisualPlayerDamage = (player: MageWarsPlayerState) => (
        mageWarsEvents.damageBuffer.get(mageWarsPlayerDamageKey(player.id), player.damage)
    );
    const getVisualObjectDamage = (object: MageWarsArenaObjectState) => (
        mageWarsEvents.damageBuffer.get(mageWarsObjectDamageKey(object.id), object.damage)
    );
    return (
        <div
            className="relative h-full min-h-0 w-full overflow-hidden text-stone-100"
            data-testid="mage-wars-board"
            data-tutorial-id="mw-board"
            data-mage-wars-phase={phase}
            data-mage-wars-current-player-id={core.currentPlayerId}
            data-mage-wars-phase-actor-id={phaseActorId}
            data-mage-wars-turn-number={core.turnNumber}
            data-mage-wars-ready-player-ids={readyPlayerIds.join(',')}
            data-mage-wars-event-count={mageWarsEvents.debug.eventCount}
            data-mage-wars-event-latest-id={mageWarsEvents.debug.latestEntryId}
            data-mage-wars-event-cursor={mageWarsEvents.debug.cursor}
            data-mage-wars-last-consumed-events={mageWarsEvents.debug.lastConsumedTypes.join(',')}
            data-mage-wars-last-fx-cues={mageWarsEvents.debug.lastFxCues.join(',')}
            style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(185,79,28,0.28), transparent 50%), radial-gradient(circle at 12% 92%, rgba(201,92,31,0.22), transparent 28%), linear-gradient(135deg, #170503 0%, #371207 56%, #120302 100%)',
            }}
        >
            <div
                className={isLandscapeMobileViewport
                    ? 'absolute inset-0'
                    : 'absolute inset-0'}
                data-testid={isLandscapeMobileViewport ? 'mage-wars-mobile-desktop-mirror-layer' : undefined}
                data-mage-wars-layout-source={isLandscapeMobileViewport ? 'desktop-mirror' : undefined}
            >
            <ArenaStage
                core={core}
                phase={phase}
                canAct={canAct}
                activePlayer={activePlayer}
                activeOpponent={activeOpponent}
                selectedSpellCardId={selectedSpellCardId}
                pendingSpellCastSelection={pendingSpellCastSelection}
                selectedObjectId={selectedObjectId}
                selectedMageId={selectedMageId}
                objectAbilitySourceIds={objectAbilitySourceIds}
                selectedSpellCastTargetIds={selectedSpellCastTargetIds}
                selectedSpellCastTargetZoneIds={selectedSpellCastTargetZoneIds}
                selectedSpellCastTargetWallEdgeIds={selectedSpellCastTargetWallEdgeIds}
                selectedSpellCastDestinationZoneIds={selectedSpellCastDestinationZoneIds}
                selectedSpellCastNewTargetObjectIds={selectedSpellCastNewTargetObjectIds}
                selectedSpellCastTargetPlayerIds={selectedSpellCastTargetPlayerIds}
                selectedSpellCastNewTargetPlayerIds={selectedSpellCastNewTargetPlayerIds}
                selectedSpellCastNewTargetZoneIds={selectedSpellCastNewTargetZoneIds}
                selectedSpellCastChainPathObjectIds={selectedSpellCastChainPathObjectIds}
                selectedSpellCastNextChainTargetObjectIds={selectedSpellCastNextChainTargetObjectIds}
                selectedSpellCastCurrentChainSubmitObjectId={selectedSpellCastCurrentChainSubmitObjectId}
                mageRestoreAvailablePlayerIds={mageRestoreAvailablePlayerIds}
                pendingObjectAbility={pendingObjectAbility}
                pendingObjectAbilityTargetIds={pendingObjectAbilityTargetIds}
                pendingMageAbility={pendingMageAbility}
                pendingMageAbilityTargetIds={pendingMageAbilityTargetIds}
                onZoneSelect={handleZoneSelect}
                onObjectSelect={handleObjectSelect}
                onWallEdgeSelect={handleWallEdgeSelect}
                onActorObjectSelect={handleActorObjectSelect}
                onPlayerSelect={handlePlayerSelect}
                onActorPlayerSelect={handleActorMageSelect}
                onGuard={handleGuard}
                fxBus={fxBus}
                onFxImpact={mageWarsEvents.onEffectImpact}
                onFxComplete={mageWarsEvents.onEffectComplete}
                fxAnchors={fxAnchors}
                getVisualObjectDamage={getVisualObjectDamage}
                getVisualPlayerDamage={getVisualPlayerDamage}
                showLifeTotals={showBoardLifeTotals}
                visualHeldObjects={mageWarsEvents.heldObjects}
                desktopFrame={isLandscapeMobileViewport}
            />
            <div className={cx(
                'pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/24 via-black/7 to-transparent',
                'w-[16rem]',
            )} />
            <div className={cx(
                'pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/24 via-black/8 to-transparent',
                'w-[17rem]',
            )} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/16 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/12 to-transparent" />

            <div
                className={cx(
                    'pointer-events-none absolute top-4 z-30 flex h-[2.125rem] w-[17.5rem] items-center justify-center rounded-full border border-amber-100/16 bg-black/40 px-8 text-sm shadow-[0_10px_28px_rgba(0,0,0,0.36)]',
                    isLandscapeMobileViewport
                        ? 'left-[820px]'
                        : 'left-1/2 -translate-x-1/2 lg:left-[820px] lg:translate-x-0',
                )}
                data-testid="mage-wars-stage-chip"
                data-tutorial-id="mw-stage"
            >
                <span className="font-semibold text-amber-100">
                    {isCreatureActionPhase(phase) ? t('arena.actionStage') : t('arena.mode')}
                </span>
            </div>
            <MageWarsLifeToggle
                pressed={showBoardLifeTotals}
                onToggle={() => setShowBoardLifeTotals((value) => !value)}
                className={isLandscapeMobileViewport
                    ? 'left-[1112px] top-4'
                    : 'left-[calc(50%+9.35rem)] top-4 lg:left-[1112px]'}
            />

            <MageWarsInteractionDock
                interaction={G.sys.interaction?.current}
                playerId={playerID ?? viewingPlayerId}
                dispatch={dispatch}
            />
            {shouldShowSelectedAbilityActionDock ? (
                <MageWarsSelectedAbilityActionDock
                    sourceName={selectedAbilitySourceName}
                    objectId={selectedObject?.id}
                    objectAbilities={selectedObjectAvailableAbilities}
                    magePlayerId={selectedMage?.id}
                    mageAbility={selectedMageRestoreAbility}
                    onObjectAbilitySelect={handleObjectAbilitySelect}
                    onMageAbilitySelect={handleMageAbilitySelect}
                />
            ) : null}
            <MageSpellCastChoiceDock
                spellName={selectedSpell?.name}
                targetPlayer={pendingSpellTargetPlayer}
                selections={pendingSpellCastPlayerSelections}
                onSelect={submitSpellCastTargetSelection}
                onCancel={() => setPendingSpellCastSelection(null)}
            />
            <MageObjectAbilityChoiceDock
                abilityName={pendingObjectAbilityDef?.name}
                targetObject={pendingObjectAbilityTargetObject}
                selections={pendingObjectAbilityChoiceSelections}
                onSelect={submitObjectAbilityTargetSelection}
                onCancel={() => {
                    setPendingObjectAbilityTargetObjectId(null);
                    if (pendingObjectAbilityRequest?.kind === 'select-card') {
                        setPendingObjectAbility(null);
                    }
                }}
            />
            <MageAbilityStatusChoiceDock
                targetObject={pendingMageAbilityStatusTargetObject}
                selections={pendingMageAbilityStatusSelections}
                onSelect={submitMageAbilityTargetSelection}
                onCancel={() => setPendingMageAbilityStatusTargetObjectId(null)}
            />

            <aside className="pointer-events-none absolute bottom-[5.125rem] left-11 z-20 w-[17rem]">
                <div className="pointer-events-auto">
                    {viewingPlayer ? (
                        <MageHud
                            player={viewingPlayer}
                            current={viewingPlayer.id === phaseActorId}
                            self
                            visualDamage={getVisualPlayerDamage(viewingPlayer)}
                        />
                    ) : null}
                </div>
            </aside>
            <aside className="pointer-events-none absolute right-6 top-[4.375rem] z-20 w-[15.5rem]">
                <div className="pointer-events-auto">
                    {opponent ? (
                        <MageHud
                            player={opponent}
                            current={opponent.id === phaseActorId}
                            self={false}
                            visualDamage={getVisualPlayerDamage(opponent)}
                        />
                    ) : null}
                </div>
            </aside>

            {opponent ? (
                <aside className="pointer-events-none absolute left-14 top-12 z-20">
                    <OpponentPlanMirror player={opponent} />
                </aside>
            ) : null}
            <aside className="pointer-events-none absolute bottom-4 right-12 z-30">
                <div className="pointer-events-auto">
                    <TurnStatusDock dispatch={dispatch} disabled={!canAdvance} />
                </div>
            </aside>
            {viewingPlayer ? (
                <aside className="pointer-events-none absolute right-14 top-[50.5%] z-20">
                    <DiscardPile player={viewingPlayer} />
                </aside>
            ) : null}
            {viewingPlayer ? (
                <aside className="pointer-events-none absolute bottom-[3.2rem] left-[18.25rem] right-[25.5rem] z-20">
                    <SpellbookShelf
                        player={viewingPlayer}
                        phase={phase}
                        canAct={canAct}
                        canPlan={isCommandAllowed(MAGE_WARS_COMMANDS.PLAN_SPELLS)}
                        dispatch={dispatch}
                    />
                </aside>
            ) : null}
            {viewingPlayer ? (
                <aside className="pointer-events-none absolute bottom-[4.875rem] right-[2.625rem] z-20">
                    <PreparedSpellsDock
                        player={viewingPlayer}
                        phase={phase}
                        canAct={canAct}
                        canCast={isCommandAllowed(MAGE_WARS_COMMANDS.CAST_SPELL)}
                        selectedCardId={selectedSpellCardId}
                        onSelect={handlePreparedSpellSelect}
                    />
                </aside>
            ) : null}
            <EndgameOverlay {...endgameProps} />
            </div>
        </div>
    );
}
