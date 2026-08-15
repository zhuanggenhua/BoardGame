import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { CardPreview } from '../../components/common/media/CardPreview';
import { FxLayer, useFxBus, type FxBus } from '../../engine/fx';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import {
    INTERACTION_COMMANDS,
    asSimpleChoice,
    type InteractionDescriptor,
} from '../../engine/systems/InteractionSystem';
import type { PlayerId } from '../../engine/types';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import type { ArenaZoneId } from './domain/ids';
import {
    MAGE_WARS_COMMANDS,
    type MageWarsArenaObjectState,
    type MageWarsCore,
    type MageWarsPlayerState,
} from './domain';
import {
    getPresetMageSetupFromConfig,
    getPresetSpellbookCardIdsFromConfig,
    getPresetSpellbookEntriesFromConfig,
    getMageWarsSpellCardFromConfig,
} from './data/configPackage';
import { areAdjacentZones } from './domain/utils';
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
} from './ui/useGameEvents';
import {
    canMageWarsObjectUsePostMoveQuickAction,
    getMageWarsObjectAttackProfiles,
    hasMageWarsStunStatus,
    isMageWarsArenaObjectRestrained,
    isMageWarsObjectAttackTargetInRange,
    isMageWarsTargetInSpellRange,
    resolveMageWarsSpellRawCostTotal,
} from './domain/spellRules';

type Props = GameBoardProps<MageWarsCore>;

type ZoneRect = {
    left: number;
    top: number;
    width: number;
    height: number;
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
    damage: 'mage-wars/tokens/damage/damage-token-front',
    channeling: 'mage-wars/tokens/channeling/channeling-token-front',
} as const;

const VISIBLE_STATUS_TOKENS = [
    { id: 'burn', image: TOKEN_IMAGES.burn, labelKey: 'tokens.burn' },
    { id: 'daze', image: TOKEN_IMAGES.daze, labelKey: 'tokens.daze' },
    { id: 'weak', image: TOKEN_IMAGES.weak, labelKey: 'tokens.weak' },
    { id: 'cripple', image: TOKEN_IMAGES.cripple, labelKey: 'tokens.cripple' },
    { id: 'rot', image: TOKEN_IMAGES.rot, labelKey: 'tokens.rot' },
    { id: 'stun', image: TOKEN_IMAGES.stun, labelKey: 'tokens.stun' },
] as const;

type VisibleStatusTokenId = (typeof VISIBLE_STATUS_TOKENS)[number]['id'];

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

const CAST_PHASES = new Set(['deployment', 'initiativeQuickcast', 'creatureAction', 'finalQuickcast']);
const SIMULTANEOUS_PREPARATION_PHASES = new Set(['reset', 'channel', 'upkeep', 'planning']);

type SpellbookCategoryId = 'all' | 'attack' | 'enchantment' | 'creature' | 'equipment';

type FieldCardRole = 'source' | 'target';
type ZoneEntityDensity = 'solo' | 'duel' | 'dense' | 'packed';
type SeatOwnerSide = 'seat-left' | 'seat-right' | 'neutral';
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

function resolveMageWarsFieldCardKind(cardId: number): MageWarsArenaObjectState['kind'] | undefined {
    const spell = getMageWarsSpellCardFromConfig(cardId);
    if (!spell) return undefined;
    if (spell.spellType === '生物') return 'creature';
    if (spell.spellType === '魔物') return 'conjuration';
    if (spell.spellType === '结界') return 'enchantment';
    if (spell.spellType === '装备') return 'equipment';
    return undefined;
}

function isMageWarsSpellObjectTargetAllowed(
    spell: NonNullable<ReturnType<typeof getMageWarsSpellCardFromConfig>>,
    object: Pick<MageWarsArenaObjectState, 'kind' | 'revealed' | 'typeLine' | 'attackOrTraitLine' | 'rulesText'>,
): boolean {
    const targetRule = spell.targetRule ?? '';
    if (targetRule.includes('区域') || targetRule.includes('法师')) return false;
    if (targetRule.includes('显性结界')) return object.kind === 'enchantment' && object.revealed === true;
    if (targetRule.includes('结界')) return object.kind === 'enchantment';
    if (targetRule.includes('装备')) return object.kind === 'equipment';
    if (targetRule.includes('活体生物')) {
        return object.kind === 'creature'
            && ![object.typeLine, object.attackOrTraitLine, object.rulesText]
                .filter(Boolean)
                .join('；')
                .includes('非活体');
    }
    if (targetRule.includes('非法师生物') || targetRule.includes('实体生物') || targetRule.includes('生物')) {
        return object.kind === 'creature';
    }
    if (targetRule.includes('魔物')) return object.kind === 'conjuration';
    return spell.spellType === '攻击' && (object.kind === 'creature' || object.kind === 'conjuration');
}

function isMageWarsSpellFieldCardTargetAllowed(
    spell: NonNullable<ReturnType<typeof getMageWarsSpellCardFromConfig>>,
    cardId: number,
): boolean {
    const kind = resolveMageWarsFieldCardKind(cardId);
    return kind !== undefined && isMageWarsSpellObjectTargetAllowed(spell, { kind });
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

function getSpellbookPreviewCardIds(player: MageWarsPlayerState, maxCount: number): number[] {
    const preparedIds = player.preparedSpellCardIds.filter((cardId) => getMageWarsSpellCardPreviewRef(cardId) != null);
    const spellbookIds = getPresetSpellbookEntriesFromConfig(player.mageId)
        .map((entry) => entry.spellCardId)
        .filter((cardId) => !preparedIds.includes(cardId));

    return [...preparedIds, ...spellbookIds]
        .slice(0, maxCount);
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
            >
                <div
                    className="relative"
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
                                'pointer-events-none absolute -inset-1 z-10 rounded-[0.25rem] border shadow-[0_0_24px_rgba(251,191,36,0.34)]',
                                role === 'source'
                                    ? 'border-cyan-200/90 shadow-[0_0_26px_rgba(34,211,238,0.48)]'
                                    : 'border-rose-300/90 shadow-[0_0_28px_rgba(251,113,133,0.5)]',
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
        >
            <div
                className="relative"
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
                            'pointer-events-none absolute -inset-1 z-10 rounded-[0.25rem] border shadow-[0_0_18px_rgba(251,191,36,0.32)]',
                            role === 'source'
                                ? 'border-amber-200/80'
                                : 'border-rose-200/80',
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
                    className="pointer-events-none absolute -inset-1 z-20 rounded-[0.28rem] border-2 border-amber-200 shadow-[0_0_0_2px_rgba(251,191,36,0.28),0_0_26px_rgba(251,191,36,0.58)]"
                    data-testid="mage-wars-selected-card-frame"
                />
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute -inset-1 z-10 rounded-[0.28rem] border border-amber-200/70 shadow-[0_0_22px_rgba(251,191,36,0.38)]"
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
}: {
    cardId: number;
    object?: MageWarsArenaObjectState;
    role?: FieldCardRole;
    density?: ZoneEntityDensity;
    ownerSide?: SeatOwnerSide;
    onClick?: () => void;
    visualDamage?: number;
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
            {object ? (
                <div className={cx(
                    'pointer-events-none absolute flex items-center gap-1',
                    compact ? '-bottom-1 left-0.5 scale-[0.78] origin-bottom-left' : '-bottom-2 left-2',
                )}>
                    {VISIBLE_STATUS_TOKENS.map(({ id, image }) => {
                        const count = object.statusTokens[id] ?? 0;
                        return count > 0 ? (
                            <span
                                key={id}
                                className="inline-flex items-center gap-0.5 rounded-full bg-black/62 px-1 py-0.5 text-[0.62rem] font-bold text-amber-50 shadow-[0_4px_12px_rgba(0,0,0,0.38)]"
                            >
                                <TokenImage src={image} alt={getVisibleStatusTokenLabel(t, id)} className="h-5 w-5" />
                                {count > 1 ? count : null}
                            </span>
                        ) : null;
                    })}
                    {(visualDamage ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-black/62 px-1 py-0.5 text-[0.62rem] font-bold text-rose-50 shadow-[0_4px_12px_rgba(0,0,0,0.38)]">
                            <TokenImage src={TOKEN_IMAGES.damage} alt={t('tokens.damage')} className="h-5 w-5" />
                            {visualDamage}
                        </span>
                    ) : null}
                </div>
            ) : null}
            {role === 'target' ? (
                <>
                    <span
                        className={cx(
                            'pointer-events-none absolute rounded-[0.22rem] border border-rose-300/90 shadow-[0_0_24px_rgba(251,113,133,0.5)]',
                            compact ? '-left-1.5 -right-1.5 -top-1.5 -bottom-1.5' : '-left-3 -right-3 -top-3 -bottom-3',
                        )}
                        data-testid="mage-wars-field-card-target-frame"
                    />
                </>
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute -inset-1.5 z-10 rounded-[0.22rem] border-2 border-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.72),inset_0_0_16px_rgba(34,211,238,0.26)]"
                    data-testid="mage-wars-field-card-source-frame"
                />
            ) : null}
        </>
    );

    return (
        <button
            type="button"
            className={cx(
                'relative z-20 block shrink-0 rounded-[0.18rem] text-left shadow-[0_14px_30px_rgba(0,0,0,0.48)]',
                cardHeightClass,
                compact && 'shadow-[0_8px_16px_rgba(0,0,0,0.42)]',
                role === 'target' && 'shadow-[0_0_32px_rgba(251,113,133,0.46)]',
                role === 'source' && '-translate-y-2 shadow-[0_0_36px_rgba(34,211,238,0.62)]',
                !onClick && 'pointer-events-none',
            )}
            style={cardSizeStyle}
            disabled={!onClick}
            onClick={(event) => {
                event.stopPropagation();
                onClick?.();
            }}
            aria-label={title}
            data-testid="mage-wars-zone-field-card"
            data-object-id={object?.id}
            data-source-card-id={cardId}
            data-owner-side={ownerSide}
            data-field-card-role={role}
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
}: {
    object: MageWarsArenaObjectState;
    role?: FieldCardRole;
    density?: ZoneEntityDensity;
    ownerSide?: SeatOwnerSide;
    onClick?: () => void;
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
                    className="pointer-events-none absolute -inset-1 z-10 rounded-[0.18rem] border border-rose-200/90 shadow-[0_0_16px_rgba(251,113,133,0.56)]"
                    data-testid="mage-wars-attachment-target-frame"
                />
            ) : null}
            {role === 'source' ? (
                <span
                    className="pointer-events-none absolute -inset-1 z-10 rounded-[0.18rem] border border-cyan-100/90 shadow-[0_0_16px_rgba(34,211,238,0.58)]"
                    data-testid="mage-wars-attachment-source-frame"
                />
            ) : null}
        </>
    );

    const className = cx(
        'relative block shrink-0 rounded-[0.16rem] text-left shadow-[0_7px_14px_rgba(0,0,0,0.48)]',
        heightClass,
        role === 'target' && 'shadow-[0_0_18px_rgba(251,113,133,0.45)]',
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
}: {
    objects: MageWarsArenaObjectState[];
    density?: ZoneEntityDensity;
    hostKind: 'mage' | 'object' | 'zone';
    ownerSide?: SeatOwnerSide;
    getRole: (object: MageWarsArenaObjectState) => FieldCardRole | undefined;
    getOnClick: (object: MageWarsArenaObjectState) => (() => void) | undefined;
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
                />
            ))}
        </div>
    );
}

function SpellRail({
    player,
    phase,
    canAct,
    self,
    selectedCardId,
    onSelect,
    compact = false,
}: {
    player: MageWarsPlayerState;
    phase: string;
    canAct: boolean;
    self: boolean;
    selectedCardId: number | null;
    onSelect: (cardId: number) => void;
    compact?: boolean;
}) {
    const { t } = useTranslation('game-mage-wars');
    const previewIds = useMemo(() => getSpellbookPreviewCardIds(player, 4), [player]);
    const preparedIds = player.preparedSpellCardIds.slice(0, 2);
    const canSelectSpell = self && canAct && CAST_PHASES.has(phase);

    return (
        <section
            className={cx(
                'pointer-events-auto flex min-h-0 rounded-[0.35rem] bg-black/28',
                compact ? 'flex-row items-end gap-2 p-1.5' : 'flex-col gap-2 p-2',
            )}
        >
            <div
                className={cx(
                    'flex text-stone-200',
                    compact
                        ? 'w-[5.9rem] shrink-0 flex-col justify-end gap-0.5 pb-0.5 text-[0.6rem] leading-tight'
                        : 'items-center justify-between gap-3 text-xs',
                )}
            >
                <span className="font-semibold text-amber-100">
                    {self ? t('privateZones.selfPlans') : t('privateZones.opponentPlans')}
                </span>
                <span>{t('privateZones.spellbookCount', { count: player.spellbookCount })}</span>
            </div>
            <div className={cx('flex items-end overflow-hidden', compact ? 'gap-1.5' : 'gap-2')}>
                {[0, 1].map((slot) => (
                    <PreparedSpellCard
                        key={`${player.id}-prepared-${slot}`}
                        cardId={preparedIds[slot]}
                        hidden={!self}
                        label={slot < player.preparedSpellSlots || !self
                            ? t('privateZones.hiddenPrepared')
                            : t('privateZones.emptySlot')}
                        compact={compact}
                        role={slot === 0 && self && preparedIds[slot] != null ? 'source' : undefined}
                        preparedScope={self ? 'self' : 'opponent'}
                        selected={preparedIds[slot] === selectedCardId}
                        disabled={!canSelectSpell || preparedIds[slot] == null}
                        onClick={preparedIds[slot] == null || !canSelectSpell
                            ? undefined
                            : () => onSelect(preparedIds[slot]!)}
                    />
                ))}
                {self ? previewIds.map((cardId) => (
                    <PreparedSpellCard
                        key={`${player.id}-spellbook-${cardId}`}
                        cardId={cardId}
                        label={getMageWarsSpellCardName(cardId) ?? t('privateZones.spell')}
                        compact={compact}
                    />
                )) : null}
            </div>
        </section>
    );
}

function OpponentPlanMirror({ player }: { player: MageWarsPlayerState }) {
    const { t } = useTranslation('game-mage-wars');

    return (
        <section className="pointer-events-auto flex flex-col items-start gap-3" data-testid="mage-wars-opponent-prepared-mirror">
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
        <section className="pointer-events-auto flex h-[6.25rem] w-[8.65rem] shrink-0 items-center gap-2" data-testid="mage-wars-discard-pile">
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
    dispatch,
}: {
    player: MageWarsPlayerState;
    phase: string;
    canAct: boolean;
    dispatch: Props['dispatch'];
}) {
    const { t } = useTranslation('game-mage-wars');
    const [category, setCategory] = useState<SpellbookCategoryId>('all');
    const [page, setPage] = useState(0);
    const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
    const planning = phase === 'planning' && canAct;
    const categories: Array<{ id: SpellbookCategoryId; label: string }> = [
        { id: 'all', label: t('spellbook.categories.all') },
        { id: 'attack', label: t('spellbook.categories.attack') },
        { id: 'enchantment', label: t('spellbook.categories.enchantment') },
        { id: 'creature', label: t('spellbook.categories.creature') },
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
                    >
                        {t('spellbook.planSelected', { count: selectedCardIds.length })}
                    </button>
                ) : null}
            </div>
            <div className="flex min-w-0 flex-1 items-end gap-[0.875rem]">
                {previewIds.map((cardId) => (
                    <PreparedSpellCard
                        key={`${player.id}-spellbook-desktop-${cardId}`}
                        cardId={cardId}
                        label={getMageWarsSpellCardName(cardId) ?? t('privateZones.spell')}
                        testId="mage-wars-desktop-spellbook-card"
                        selected={selectedCardIds.includes(cardId)}
                        disabled={!planning}
                        onClick={planning ? () => togglePlannedCard(cardId) : undefined}
                    />
                ))}
            </div>
            <div className="flex h-[11.75rem] w-12 shrink-0 flex-col items-center justify-center gap-2 text-stone-100">
                <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-[0.3rem] bg-black/32 text-lg font-bold text-amber-100"
                    aria-label={t('spellbook.previousPage')}
                    disabled={currentPage === 0}
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
    selectedCardId,
    onSelect,
}: {
    player: MageWarsPlayerState;
    phase: string;
    canAct: boolean;
    selectedCardId: number | null;
    onSelect: (cardId: number) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const preparedIds = player.preparedSpellCardIds.slice(0, 2);
    const canSelectSpell = canAct && CAST_PHASES.has(phase);

    return (
        <section
            className="pointer-events-auto flex h-[17.75rem] w-[22.5rem] flex-col justify-start gap-[0.875rem]"
            data-testid="mage-wars-desktop-prepared-spells"
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

function TurnStatusDock({ dispatch, disabled }: { dispatch: Props['dispatch']; disabled?: boolean }) {
    const { t } = useTranslation('game-mage-wars');

    return (
        <section className="pointer-events-auto" data-testid="mage-wars-turn-end-dock">
            <button
                type="button"
                className={cx(
                    'grid h-[3.25rem] w-[10.5rem] place-items-center rounded-[0.32rem] border border-amber-200/24 px-5 text-xl font-black text-amber-50 shadow-[0_8px_18px_rgba(0,0,0,0.32)] transition',
                    disabled ? 'cursor-not-allowed bg-black/20 text-stone-500' : 'bg-amber-950/36 hover:bg-amber-900/42',
                )}
                disabled={disabled}
                onClick={() => dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {})}
                data-testid="mage-wars-turn-end"
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
}: {
    player: MageWarsPlayerState;
    role?: 'source' | 'target';
    crowded?: boolean;
    density?: ZoneEntityDensity;
    onClick?: () => void;
    visualDamage?: number;
}) {
    const { t } = useTranslation('game-mage-wars');
    const mageLabel = getMageDisplayLabel(player);
    const compact = density === 'dense' || density === 'packed';
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
                'relative z-20 shrink-0 rounded-[0.18rem] shadow-[0_14px_30px_rgba(0,0,0,0.48)]',
                role === 'source' && '-translate-y-2 shadow-[0_0_30px_rgba(34,211,238,0.58)]',
                role === 'target' && 'shadow-[0_0_30px_rgba(251,113,133,0.46)]',
                'pointer-events-auto',
                onClick && 'cursor-pointer outline outline-2 outline-cyan-200/70',
            )}
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
            <div className="pointer-events-none absolute -bottom-2 left-2 flex items-center gap-1">
                {player.guarding ? (
                    <TokenImage src={TOKEN_IMAGES.guard} alt={t('tokens.guard')} className="h-7 w-7" />
                ) : null}
                {VISIBLE_STATUS_TOKENS.map(({ id, image }) => {
                    const count = player.statusTokens[id] ?? 0;
                    return count > 0 ? (
                        <span
                            key={id}
                            className="inline-flex items-center gap-0.5 rounded-full bg-black/62 px-1 py-0.5 text-[0.62rem] font-bold text-amber-50 shadow-[0_4px_12px_rgba(0,0,0,0.38)]"
                        >
                            <TokenImage src={image} alt={getVisibleStatusTokenLabel(t, id)} className="h-5 w-5" />
                            {count > 1 ? count : null}
                        </span>
                    ) : null;
                })}
                {visualDamage > 0 ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-black/62 px-1 py-0.5 text-[0.62rem] font-bold text-rose-50 shadow-[0_4px_12px_rgba(0,0,0,0.38)]">
                        <TokenImage src={TOKEN_IMAGES.damage} alt={t('tokens.damage')} className="h-5 w-5" />
                        {visualDamage}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function ArenaStage({
    core,
    phase,
    canAct,
    activePlayer,
    activeOpponent,
    viewingPlayerId,
    selectedSpellCardId,
    selectedObjectId,
    selectedMageId,
    onZoneSelect,
    onObjectSelect,
    onActorObjectSelect,
    onPlayerSelect,
    onActorPlayerSelect,
    onGuard,
    fxBus,
    onFxImpact,
    onFxComplete,
    getVisualObjectDamage,
    getVisualPlayerDamage,
}: {
    core: MageWarsCore;
    phase: string;
    canAct: boolean;
    activePlayer?: MageWarsPlayerState;
    activeOpponent?: MageWarsPlayerState | null;
    viewingPlayerId: PlayerId;
    selectedSpellCardId?: number | null;
    selectedObjectId?: string | null;
    selectedMageId?: PlayerId | null;
    onZoneSelect?: (zoneId: ArenaZoneId) => void;
    onObjectSelect?: (objectId: string) => void;
    onActorObjectSelect?: (objectId: string) => void;
    onPlayerSelect?: (playerId: PlayerId) => void;
    onActorPlayerSelect?: (playerId: PlayerId) => void;
    onGuard?: () => void;
    fxBus: FxBus;
    onFxImpact?: (id: string, cue: string) => void;
    onFxComplete?: (id: string, cue: string) => void;
    getVisualObjectDamage: (object: MageWarsArenaObjectState) => number;
    getVisualPlayerDamage: (player: MageWarsPlayerState) => number;
}) {
    const { t } = useTranslation('game-mage-wars');
    const creatureActionActive = isCreatureActionPhase(phase) && canAct;
    const canUseMageAction = creatureActionActive && activePlayer?.actionReady === true;
    const selectedSpell = selectedSpellCardId == null
        ? undefined
        : getMageWarsSpellCardFromConfig(selectedSpellCardId);
    const spellNeedsZoneTarget = selectedSpell?.spellType === '生物' || selectedSpell?.targetRule === '区域';
    const spellNeedsObjectTarget = Boolean(selectedSpell) && !spellNeedsZoneTarget;
    const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
    const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
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
    const selectedActorZoneId = selectedObject?.zoneId ?? (selectedMageCanAct ? selectedMage?.mageZoneId : undefined);
    const hasSelectedActor = selectedActorZoneId != null;
    const canGuardSelectedActor = Boolean(
        hasSelectedActor
        && (selectedObject ? selectedObject.actionReady : selectedMageCanAct),
    );
    const targeting = Boolean(selectedSpell) || hasSelectedActor;
    const legalMoveZoneIds = new Set(
        creatureActionActive
            && selectedActorZoneId
            && (selectedObject ? selectedObjectCanMove : selectedMageCanAct)
            ? core.arena
                .filter((zone) => areAdjacentZones(core, selectedActorZoneId, zone.id))
                .map((zone) => zone.id)
            : [],
    );
    const legalAttackTargetId = activeOpponent
        && (selectedObject && selectedObjectCanAttack && selectedObjectAttackProfile
            ? isMageWarsObjectAttackTargetInRange(
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
        selectedSpell && activePlayer
            ? core.arena
                .filter((zone) => {
                    if (!isMageWarsTargetInSpellRange(core, activePlayer, selectedSpell, zone.id)) return false;
                    if (spellNeedsZoneTarget) return true;
                    if (selectedSpell.targetRule?.includes('法师')) {
                        return Object.values(core.players).some((player) => player.mageZoneId === zone.id);
                    }
                    const fieldObjects = zone.objectIds
                        .map((objectId) => core.objects[objectId])
                        .filter((object): object is MageWarsArenaObjectState => object != null);
                    return fieldObjects.some((object) => isMageWarsSpellObjectTargetAllowed(selectedSpell, object))
                        || (zone.fieldCardIds ?? []).some((cardId) => isMageWarsSpellFieldCardTargetAllowed(selectedSpell, cardId));
                })
                .map((zone) => zone.id)
            : [],
    );

    return (
        <section
            className="absolute top-0 h-full w-auto aspect-[4/3] overflow-hidden rounded-[0.5rem] shadow-[0_34px_58px_rgba(0,0,0,0.55)] lg:top-[2.75%] lg:h-[74%]"
            data-testid="mage-wars-arena-stage"
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
                const zoneObjects = zone.objectIds
                    .map((objectId) => core.objects[objectId])
                    .filter((object): object is MageWarsArenaObjectState => object != null);
                const attachedObjects = zoneObjects.filter(isMageWarsAttachmentObject);
                const fieldObjects = zoneObjects.filter((object) => !isMageWarsAttachmentObject(object));
                const zoneAttachmentObjects = attachedObjects.filter((object) => (
                    isMageWarsZoneAttachmentObject(object, zone.id)
                ));
                const zoneOccupants = zone.occupantIds
                    .map((occupantId) => core.players[occupantId])
                    .filter((occupant): occupant is MageWarsPlayerState => occupant != null);
                const hasFieldCards = fieldCardIds.length > 0 || fieldObjects.length > 0;
                const isSourceZone = hasSelectedActor && zone.id === selectedActorZoneId;
                const isLegalMoveZone = legalMoveZoneIds.has(zone.id);
                const isLegalAttackZone = targetZoneId != null && zone.id === targetZoneId;
                const isLegalSpellTargetZone = legalSpellTargetZoneIds.has(zone.id);
                const isLegalTargetZone = isLegalAttackZone || isLegalSpellTargetZone;
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
                    const isSpellObjectTarget = Boolean(
                        selectedSpell
                        && spellNeedsObjectTarget
                        && isMageWarsSpellObjectTargetAllowed(selectedSpell, object),
                    );
                    if (isSpellObjectTarget) return 'target';
                    return object.id === selectedObjectId ? 'source' : undefined;
                };
                const resolveAttachmentClick = (object: MageWarsArenaObjectState): (() => void) | undefined => {
                    const isSpellObjectTarget = Boolean(
                        selectedSpell
                        && spellNeedsObjectTarget
                        && isMageWarsSpellObjectTargetAllowed(selectedSpell, object),
                    );
                    return isSpellObjectTarget ? () => onObjectSelect?.(object.id) : undefined;
                };
                const renderFieldObject = (object: MageWarsArenaObjectState, density: ZoneEntityDensity = 'solo') => {
                    const objectAttachments = attachedObjects.filter((attachment) => (
                        isMageWarsObjectAttachmentObject(attachment, object.id)
                    ));
                    const isObjectAttackTarget = Boolean(
                        selectedObject
                        && selectedObjectCanAttack
                        && selectedObjectAttackProfile
                        && object.ownerId !== activePlayer?.id
                        && isMageWarsObjectAttackTargetInRange(
                            core,
                            selectedObject.zoneId,
                            object.zoneId,
                            selectedObjectAttackProfile,
                        ),
                    );
                    const isSpellObjectTarget = Boolean(
                        selectedSpell
                        && spellNeedsObjectTarget
                        && isMageWarsSpellObjectTargetAllowed(selectedSpell, object),
                    );
                    const canSelectObjectActor = Boolean(
                        creatureActionActive
                        && !selectedSpell
                        && canMageWarsObjectStartAction(object, activePlayer?.id),
                    );
                    return (
                        <div key={object.id} className="relative z-20 flex shrink-0 items-center justify-center">
                            <ZoneFieldCard
                                cardId={object.sourceSpellCardId}
                                object={object}
                                density={density}
                                ownerSide={resolveSeatOwnerSide(core, object.ownerId)}
                                visualDamage={getVisualObjectDamage(object)}
                                role={isSpellObjectTarget || isObjectAttackTarget
                                    ? 'target'
                                    : object.id === selectedObjectId
                                        ? 'source'
                                        : undefined}
                                onClick={isSpellObjectTarget
                                    ? () => onObjectSelect?.(object.id)
                                    : isObjectAttackTarget
                                        ? () => onObjectSelect?.(object.id)
                                        : canSelectObjectActor
                                            ? () => onActorObjectSelect?.(object.id)
                                            : undefined}
                            />
                            <ArenaAttachmentStrip
                                objects={objectAttachments}
                                density={density}
                                hostKind="object"
                                ownerSide={resolveSeatOwnerSide(core, object.ownerId)}
                                getRole={resolveAttachmentRole}
                                getOnClick={resolveAttachmentClick}
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
                            ? 'target'
                            : undefined;
                    const canSelectMageActor = Boolean(
                        creatureActionActive
                        && !selectedSpell
                        && occupant.id === activePlayer?.id
                        && canUseMageAction,
                    );
                    return (
                        <div key={occupant.id} className="relative z-20 flex shrink-0 items-center justify-center">
                            <ZoneOccupant
                                player={occupant}
                                role={role}
                                crowded={hasFieldCards || mageAttachments.length > 0}
                                density={density}
                                visualDamage={getVisualPlayerDamage(occupant)}
                                onClick={occupant.id === legalAttackTargetId || (selectedSpell && spellNeedsObjectTarget)
                                    ? () => onPlayerSelect?.(occupant.id)
                                    : canSelectMageActor
                                        ? () => onActorPlayerSelect?.(occupant.id)
                                        : undefined}
                            />
                            <ArenaAttachmentStrip
                                objects={mageAttachments}
                                density={density}
                                hostKind="mage"
                                ownerSide={resolveSeatOwnerSide(core, occupant.id)}
                                getRole={resolveAttachmentRole}
                                getOnClick={resolveAttachmentClick}
                            />
                        </div>
                    );
                };
                return (
                    <div
                        key={zone.id}
                        data-testid={`mage-wars-arena-zone-${zone.id}`}
                        data-source-zone={isSourceZone ? 'true' : undefined}
                        data-legal-move-zone={isLegalMoveZone ? 'true' : undefined}
                        data-legal-target-zone={isLegalTargetZone ? 'true' : undefined}
                        className={cx(
                            'absolute rounded-[0.25rem] text-left transition',
                            'outline outline-1 outline-transparent hover:bg-amber-200/8 hover:outline-amber-100/45',
                            zone.occupantIds.length > 0 && 'bg-black/5',
                            entityCount > 0 && 'z-10',
                            isSourceZone && 'bg-cyan-200/10 outline-cyan-200/60',
                            isLegalMoveZone && 'bg-sky-300/14 outline-sky-200/75 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.42),inset_0_0_36px_rgba(56,189,248,0.13)]',
                            isLegalTargetZone && 'bg-rose-300/14 outline-rose-200/80 shadow-[inset_0_0_0_1px_rgba(253,164,175,0.46),inset_0_0_36px_rgba(244,63,94,0.14)]',
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
                                        role={(isLegalAttackZone && index === 0)
                                            || (selectedSpell && spellNeedsObjectTarget && isMageWarsSpellFieldCardTargetAllowed(selectedSpell, cardId))
                                            ? 'target'
                                            : undefined}
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
                        />
                    </div>
                );
            })}
            {canGuardSelectedActor && selectedActorZoneId && onGuard ? (() => {
                const rect = ZONE_RECTS[selectedActorZoneId];
                return (
                    <div
                        className="pointer-events-none absolute z-30"
                        style={{
                            left: pct(rect.left + rect.width - 8),
                            top: pct(rect.top + 4),
                        }}
                    >
                        <button
                            type="button"
                            className="pointer-events-auto grid h-9 w-9 place-items-center rounded-[0.22rem] border border-emerald-100/75 bg-emerald-950/86 text-emerald-100 shadow-[0_8px_18px_rgba(0,0,0,0.45)] transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100"
                            aria-label={t('actions.guard')}
                            title={t('actions.guard')}
                            data-testid="mage-wars-selected-unit-guard"
                            onClick={(event) => {
                                event.stopPropagation();
                                onGuard();
                            }}
                        >
                            <ShieldCheck size={18} strokeWidth={2.25} aria-hidden="true" />
                        </button>
                    </div>
                );
            })() : null}
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

export default function MageWarsBoard({ G, playerID, dispatch }: Props) {
    const { t } = useTranslation('game-mage-wars');
    const [selectedSpellCardId, setSelectedSpellCardId] = useState<number | null>(null);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [selectedMageId, setSelectedMageId] = useState<PlayerId | null>(null);
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
    const readyPlayerIds = core.phaseReadyPlayerIds ?? [];
    const canAdvance = isPlayerId(playerID)
        && !readyPlayerIds.includes(playerID)
        && (SIMULTANEOUS_PREPARATION_PHASES.has(phase) || playerID === phaseActorId);
    const canAct = isPlayerId(playerID)
        && !readyPlayerIds.includes(playerID)
        && (phase === 'planning' || playerID === phaseActorId);
    const isLandscapeMobileViewport = viewport.width <= 1023 && viewport.width > viewport.height;
    const selectedSpell = selectedSpellCardId == null
        ? undefined
        : getMageWarsSpellCardFromConfig(selectedSpellCardId);
    const spellNeedsZoneTarget = selectedSpell?.spellType === '生物' || selectedSpell?.targetRule === '区域';
    const resolveSelectedSpellManaCost = () => {
        if (!selectedSpell) return undefined;
        return selectedSpell.manaCost ?? resolveMageWarsSpellRawCostTotal(selectedSpell);
    };
    const castSelectedSpell = (target: {
        targetPlayerId?: PlayerId;
        targetObjectId?: string;
        targetZoneId?: ArenaZoneId;
    }) => {
        const manaCost = resolveSelectedSpellManaCost();
        if (!canAct || selectedSpellCardId == null || manaCost == null) return;
        dispatch(MAGE_WARS_COMMANDS.CAST_SPELL, {
            spellCardId: selectedSpellCardId,
            manaCost,
            ...target,
        });
        setSelectedSpellCardId(null);
        setSelectedObjectId(null);
        setSelectedMageId(null);
    };
    const handleZoneSelect = (zoneId: ArenaZoneId) => {
        const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
        if (selectedObject) {
            if (
                !canAct
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
                || !isCreatureActionPhase(phase)
                || selectedMage.id !== activePlayer?.id
                || !selectedMage.actionReady
                || !areAdjacentZones(core, selectedMage.mageZoneId, zoneId)
            ) return;
            dispatch(MAGE_WARS_COMMANDS.MOVE_MAGE, { toZoneId: zoneId });
            setSelectedMageId(null);
            return;
        }
        if (selectedSpellCardId != null && spellNeedsZoneTarget) {
            castSelectedSpell({ targetZoneId: zoneId });
        }
    };
    const handleObjectSelect = (objectId: string) => {
        const attacker = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const target = core.objects[objectId];
        const profile = attacker
            ? getMageWarsObjectAttackProfiles(attacker).find((candidate) => (
                attacker.actionReady || canMageWarsObjectUsePostMoveQuickAction(attacker, candidate)
            ))
            : undefined;
        if (
            attacker
            && target
            && profile
            && attacker.ownerId === activePlayer?.id
            && target.ownerId !== activePlayer?.id
            && isMageWarsObjectAttackTargetInRange(core, attacker.zoneId, target.zoneId, profile)
        ) {
            dispatch(MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK, {
                attackerObjectId: attacker.id,
                attackProfileId: profile.id,
                targetObjectId: target.id,
            });
            setSelectedObjectId(null);
            return;
        }
        if (selectedSpellCardId != null) castSelectedSpell({ targetObjectId: objectId });
    };
    const handlePlayerSelect = (targetPlayerId: PlayerId) => {
        const target = core.players[targetPlayerId];
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
                || !isMageWarsObjectAttackTargetInRange(core, attacker.zoneId, target.mageZoneId, profile)
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
                || !isCreatureActionPhase(phase)
                || selectedMage.id !== activePlayer?.id
                || !selectedMage.actionReady
                || selectedMage.mageZoneId !== target.mageZoneId
            ) return;
            dispatch(MAGE_WARS_COMMANDS.DECLARE_ATTACK, { targetPlayerId });
            setSelectedMageId(null);
            return;
        }
        if (selectedSpellCardId != null && !spellNeedsZoneTarget) {
            castSelectedSpell({ targetPlayerId });
        }
    };
    const handleActorObjectSelect = (objectId: string) => {
        setSelectedSpellCardId(null);
        setSelectedMageId(null);
        setSelectedObjectId((current) => current === objectId ? null : objectId);
    };
    const handleActorMageSelect = (mageId: PlayerId) => {
        setSelectedSpellCardId(null);
        setSelectedObjectId(null);
        setSelectedMageId((current) => current === mageId ? null : mageId);
    };
    const handleGuard = () => {
        if (!canAct || !isCreatureActionPhase(phase)) return;
        const selectedObject = selectedObjectId ? core.objects[selectedObjectId] : undefined;
        const selectedMage = selectedMageId ? core.players[selectedMageId] : undefined;
        if (selectedObject?.ownerId === activePlayer?.id && selectedObject.actionReady) {
            dispatch(MAGE_WARS_COMMANDS.GUARD, { objectId: selectedObject.id });
            setSelectedObjectId(null);
            return;
        }
        if (selectedMage?.id === activePlayer?.id && selectedMage.actionReady) {
            dispatch(MAGE_WARS_COMMANDS.GUARD, {});
            setSelectedMageId(null);
        }
    };
    const handlePreparedSpellSelect = (cardId: number) => {
        setSelectedObjectId(null);
        setSelectedMageId(null);
        setSelectedSpellCardId((current) => current === cardId ? null : cardId);
    };
    const fxBus = useFxBus(mageWarsFxRegistry);
    const mageWarsEvents = useMageWarsGameEvents({ G, fxBus });
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
            data-mage-wars-phase={phase}
            data-mage-wars-current-player-id={core.currentPlayerId}
            data-mage-wars-phase-actor-id={phaseActorId}
            data-mage-wars-turn-number={core.turnNumber}
            data-mage-wars-ready-player-ids={readyPlayerIds.join(',')}
            style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(185,79,28,0.28), transparent 50%), radial-gradient(circle at 12% 92%, rgba(201,92,31,0.22), transparent 28%), linear-gradient(135deg, #170503 0%, #371207 56%, #120302 100%)',
            }}
        >
            <ArenaStage
                core={core}
                phase={phase}
                canAct={canAct}
                activePlayer={activePlayer}
                activeOpponent={activeOpponent}
                viewingPlayerId={viewingPlayerId}
                selectedSpellCardId={selectedSpellCardId}
                selectedObjectId={selectedObjectId}
                selectedMageId={selectedMageId}
                onZoneSelect={handleZoneSelect}
                onObjectSelect={handleObjectSelect}
                onActorObjectSelect={handleActorObjectSelect}
                onPlayerSelect={handlePlayerSelect}
                onActorPlayerSelect={handleActorMageSelect}
                onGuard={handleGuard}
                fxBus={fxBus}
                onFxImpact={mageWarsEvents.onEffectImpact}
                onFxComplete={mageWarsEvents.onEffectComplete}
                getVisualObjectDamage={getVisualObjectDamage}
                getVisualPlayerDamage={getVisualPlayerDamage}
            />
            <div className={cx(
                'absolute inset-y-0 left-0 bg-gradient-to-r from-black/24 via-black/7 to-transparent',
                isLandscapeMobileViewport ? 'w-[13rem]' : 'w-[16rem]',
            )} />
            <div className={cx(
                'absolute inset-y-0 right-0 bg-gradient-to-l from-black/24 via-black/8 to-transparent',
                isLandscapeMobileViewport ? 'w-[19rem]' : 'w-[17rem]',
            )} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/16 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/12 to-transparent" />

            <div
                className="pointer-events-none absolute left-1/2 top-4 z-30 flex h-[2.125rem] w-[17.5rem] -translate-x-1/2 items-center justify-center rounded-full border border-amber-100/16 bg-black/40 px-8 text-sm shadow-[0_10px_28px_rgba(0,0,0,0.36)] lg:left-[820px] lg:translate-x-0"
                data-testid="mage-wars-stage-chip"
            >
                <span className="font-semibold text-amber-100">
                    {isCreatureActionPhase(phase) ? t('arena.actionStage') : t('arena.mode')}
                </span>
            </div>

            <MageWarsInteractionDock
                interaction={G.sys.interaction?.current}
                playerId={playerID ?? viewingPlayerId}
                dispatch={dispatch}
            />

            {isLandscapeMobileViewport ? (
                <aside className="pointer-events-none absolute bottom-2 left-2 top-2 z-20 flex w-[12.2rem] min-h-0 flex-col justify-between gap-2">
                    <div className="pointer-events-auto">
                        {opponent ? (
                            <MageHud
                                player={opponent}
                                current={opponent.id === phaseActorId}
                                self={false}
                                compact
                                visualDamage={getVisualPlayerDamage(opponent)}
                            />
                        ) : null}
                    </div>
                    <div className="pointer-events-auto">
                        {viewingPlayer ? (
                            <MageHud
                                player={viewingPlayer}
                                current={viewingPlayer.id === phaseActorId}
                                self
                                compact
                                visualDamage={getVisualPlayerDamage(viewingPlayer)}
                            />
                        ) : null}
                    </div>
                </aside>
            ) : (
                <>
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
                </>
            )}

            {isLandscapeMobileViewport ? (
                <>
                    <aside className="pointer-events-none absolute bottom-2 right-2 z-30">
                        <div className="pointer-events-auto">
                            <TurnStatusDock dispatch={dispatch} disabled={!canAdvance} />
                        </div>
                    </aside>
                    <aside className="pointer-events-none absolute bottom-2 left-[13rem] right-[4.8rem] z-20 flex min-h-0 items-end gap-2">
                        <div className="pointer-events-auto min-w-0 flex-1">
                            {viewingPlayer ? (
                                <SpellRail
                                    player={viewingPlayer}
                                    phase={phase}
                                    canAct={canAct}
                                    self
                                    selectedCardId={selectedSpellCardId}
                                    onSelect={handlePreparedSpellSelect}
                                    compact
                                />
                            ) : null}
                        </div>
                        <div className="pointer-events-auto min-w-0">
                            {opponent ? (
                                <SpellRail
                                    player={opponent}
                                    phase={phase}
                                    canAct={false}
                                    self={false}
                                    selectedCardId={null}
                                    onSelect={() => undefined}
                                    compact
                                />
                            ) : null}
                        </div>
                    </aside>
                </>
            ) : (
                <>
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
                                selectedCardId={selectedSpellCardId}
                                onSelect={handlePreparedSpellSelect}
                            />
                        </aside>
                    ) : null}
                </>
            )}
        </div>
    );
}
