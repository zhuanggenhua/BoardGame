import React, { useMemo, useState } from 'react';
import { ArrowRight, Eye, Flag, Gem, Hand, History, MapPin, Shield, Sparkles, X, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { MatchState } from '../../engine/types';
import { UndoProvider } from '../../contexts/UndoContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { FATE_ATTACK_BY_ID, FATE_MASTERS, FATE_SERVANT_BY_ID, FATE_SERVANTS } from './data';
import { legalMoveTargets } from './domain';
import type { FateDominationCommandMap, FateDominationCore, LocationId } from './domain';
import { FATE_DOMINATION_COMMANDS } from './domain';
import './ui/styles.css';

type Props = GameBoardProps<FateDominationCore, FateDominationCommandMap>;

const LOCATION_ORDER: LocationId[] = ['workshop', 'miyama', 'shinto', 'recon'];
const LOCATION_POSITIONS: Record<LocationId, React.CSSProperties> = {
    workshop: { left: '10%', bottom: '13%' },
    miyama: { left: '34%', top: '44%' },
    shinto: { right: '22%', top: '38%' },
    recon: { right: '5%', top: '11%' },
};

const cardDefinitionFor = (cardId: string, core: FateDominationCore) => {
    const handCard = Object.values(core.players).flatMap((player) => player.hand).find((card) => card.id === cardId);
    if (handCard) return FATE_ATTACK_BY_ID[handCard.definitionId];
    if (core.situation.id === cardId) return core.situation;
    if (core.miyamaEvent.id === cardId) return core.miyamaEvent;
    const master = FATE_MASTERS.find((item) => item.id === cardId);
    if (master) return master;
    const servant = FATE_SERVANTS.find((item) => item.id === cardId);
    return servant;
};

const playerName = (id: string, matchData: Props['matchData']) => {
    const matchPlayer = matchData?.find((item) => String(item.id) === id);
    return matchPlayer?.name || `玩家 ${Number(id) + 1}`;
};

const displaySourceStatus = (status: 'verified' | 'partial' | 'unverified') => ({
    verified: '已核验',
    partial: '部分核验',
    unverified: '待核验',
}[status]);

export const FateDominationBoard: React.FC<Props> = ({ G, dispatch, playerID, matchData, isMultiplayer }) => {
    const { t } = useTranslation('game-fate-domination');
    const core = G.core;
    const actorId = playerID ?? core.currentPlayerId;
    const actor = core.players[actorId] ?? core.players[core.currentPlayerId];
    const isCurrentPlayer = !isMultiplayer || actorId === core.currentPlayerId;
    const [inspectedCardId, setInspectedCardId] = useState<string | null>(null);
    const runtimeDispatch = dispatch as unknown as (type: string, payload: unknown) => void;
    const activeCards = useMemo(() => actor?.activeAttackIds.map((id) => actor.hand.find((card) => card.id === id)).filter(Boolean) ?? [], [actor]);
    const selectedCount = actor?.selectedAttackIds.length ?? 0;
    const actionLog = [...new Map((G.sys.actionLog?.entries ?? []).map((entry) => [entry.id, entry])).values()].slice(-5).reverse();
    const inspectedCard = inspectedCardId ? cardDefinitionFor(inspectedCardId, core) : undefined;
    const moveTargets = actor ? legalMoveTargets(core, actor) : [];
    const nextBattleLocation = LOCATION_ORDER.find((locationId) => !core.resolvedLocations.includes(locationId));

    const inspect = (cardId: string) => {
        runtimeDispatch(FATE_DOMINATION_COMMANDS.INSPECT_CARD, { cardId });
        setInspectedCardId(cardId);
    };

    const selectMaster = (masterId: string) => runtimeDispatch(FATE_DOMINATION_COMMANDS.SELECT_MASTER, { masterId });
    const selectServant = (servantId: string) => runtimeDispatch(FATE_DOMINATION_COMMANDS.SELECT_SERVANT, { servantId });
    const deploy = (locationId: LocationId) => runtimeDispatch(FATE_DOMINATION_COMMANDS.DEPLOY_MASTER, { locationId });
    const toggleAttack = (cardId: string) => runtimeDispatch(FATE_DOMINATION_COMMANDS.SELECT_ATTACK_CARD, { cardId });
    const move = (locationId: LocationId) => runtimeDispatch(FATE_DOMINATION_COMMANDS.MOVE_PLAYER, { locationId });
    const passAction = () => runtimeDispatch(FATE_DOMINATION_COMMANDS.PASS_ACTION, {});
    const playSkill = (skillId: string) => runtimeDispatch(FATE_DOMINATION_COMMANDS.PLAY_SKILL, { skillId });
    const resolveLocation = (locationId: LocationId) => runtimeDispatch(FATE_DOMINATION_COMMANDS.RESOLVE_LOCATION, { locationId });
    const advance = () => runtimeDispatch(FATE_DOMINATION_COMMANDS.ADVANCE_PHASE, {});
    const allDeployed = core.playerIds.every((id) => core.players[id].eliminated || Boolean(core.players[id].locationId));

    const canAdvance = isCurrentPlayer && (
        core.phase === 'preparation'
        || (core.phase === 'outpost' && allDeployed)
        || core.phase === 'action'
        || core.phase === 'battle'
    );
    const actionButtonLabel = core.phase === 'preparation'
        ? t('commands.toOutpost')
        : core.phase === 'outpost'
            ? t('commands.toAction')
            : core.phase === 'battle'
                ? t('commands.resolveBattle')
                : t('commands.confirmAttack');

    return (
        <UndoProvider value={{ G: G as MatchState<unknown>, dispatch: runtimeDispatch, playerID, isGameOver: core.phase === 'complete', isLocalMode: !isMultiplayer }}>
            <div className="fd-table" data-testid="fate-domination-board">
                <header className="fd-top-rail">
                    <div className="fd-brand-lockup">
                        <div className="fd-brand-kicker">{t('brand')}</div>
                        <h1>{t('title')}</h1>
                        <span>{t('subtitle')}</span>
                    </div>
                    <div className="fd-round-block">
                        <span className="fd-label">{t('round')}</span>
                        <strong>{core.round}<small> / 11</small></strong>
                        <span className="fd-phase-pill">{t(`phases.${core.phase}`)}</span>
                    </div>
                    <div className="fd-top-card fd-situation-slot" data-testid="fate-domination-situation">
                        <button type="button" className="fd-top-card-button" onClick={() => inspect(core.situation.id)} aria-label={core.situation.name}>
                            <OptimizedImage src={core.situation.assetPath} alt={core.situation.name} className="fd-top-card-image" />
                        </button>
                        <div><span>{t('zones.situation')}</span><b>{core.situation.name}</b></div>
                    </div>
                    <div className="fd-top-card" data-testid="fate-domination-miyama-event">
                        <button type="button" className="fd-top-card-button" onClick={() => inspect(core.miyamaEvent.id)} aria-label={core.miyamaEvent.name}>
                            <OptimizedImage src={core.miyamaEvent.assetPath} alt={core.miyamaEvent.name} className="fd-top-card-image" />
                        </button>
                        <div><span>{t('zones.miyamaEvent')}</span><b>{core.miyamaEvent.name} · {core.miyamaEvent.victoryPoints} VP</b></div>
                    </div>
                    <div className="fd-pile-strip">
                        <div><span>{t('zones.situationDeck')}</span><strong>{core.situationDeckCount}</strong></div>
                        <div><span>{t('zones.eventDeck')}</span><strong>{core.eventDeckCount}</strong></div>
                        <div><span>{t('zones.eventDiscard')}</span><strong>{core.eventDiscardCount}</strong></div>
                    </div>
                </header>

                <main className="fd-main-grid">
                    <section className="fd-board-scene" aria-label={t('board.sceneLabel')}>
                        <OptimizedImage src="fate-domination/board/fuyuki-city" alt={t('board.mapAlt')} className="fd-board-image" />
                        <div className="fd-board-vignette" />
                        <div className="fd-route route-one" />
                        <div className="fd-route route-two" />
                        <div className="fd-route route-three" />
                        {LOCATION_ORDER.map((locationId) => {
                            const location = core.battlefield[locationId];
                            const active = actor?.locationId === locationId;
                            const available = core.phase === 'outpost' && isCurrentPlayer && !actor?.locationId && (location.capacity === null || location.playerIds.length < location.capacity);
                            return (
                                <button
                                    type="button"
                                    key={locationId}
                                    className={`fd-location-anchor ${active ? 'is-active' : ''} ${available ? 'is-available' : ''}`}
                                    style={LOCATION_POSITIONS[locationId]}
                                    onClick={() => available && deploy(locationId)}
                                    disabled={!available}
                                    data-testid={`fate-domination-location-${locationId}`}
                                    aria-label={`${location.label}，${t('board.movementCost')} ${location.movementCost}`}
                                >
                                    <span className="fd-location-marker"><MapPin size={15} /></span>
                                    <span className="fd-location-name">{location.label}</span>
                                    <span className="fd-location-meta">{t('board.cost')} {location.movementCost} · {t('board.terrain')} +{location.terrainPower}</span>
                                    {location.playerIds.length > 0 && <span className="fd-location-occupants">{location.playerIds.map((id) => <i key={id}>{Number(id) + 1}</i>)}</span>}
                                </button>
                            );
                        })}
                        <div className="fd-board-caption"><span>{t('board.mapTitle')}</span><small>{t('board.mapSubtitle')}</small></div>
                    </section>

                    <aside className="fd-side-rail">
                        <section className="fd-panel fd-active-player">
                            <div className="fd-panel-heading"><span><Sparkles size={16} /> {t('currentPlayer')}</span><b>{playerName(core.currentPlayerId, matchData)}</b></div>
                            <div className="fd-resource-grid">
                                <div><Zap size={17} /><b>{actor?.mana ?? 0}</b><span>{t('resources.mana')}</span></div>
                                <div><Gem size={17} /><b>{actor?.victoryPoints ?? 0}</b><span>{t('resources.victoryPoints')}</span></div>
                                <div><Shield size={17} /><b>{actor?.commandSpells ?? 0}</b><span>{t('resources.commandSpells')}</span></div>
                            </div>
                            <div className="fd-identity-mini">
                                <OptimizedImage src={FATE_SERVANT_BY_ID[actor?.servantId ?? 'servant-saber']?.assetPath ?? 'fate-domination/servants/saber'} alt={FATE_SERVANT_BY_ID[actor?.servantId ?? 'servant-saber']?.name ?? t('identity.servantFallback')} />
                                <div><span>{t('identity.servant')}</span><b>{FATE_SERVANT_BY_ID[actor?.servantId ?? 'servant-saber']?.name ?? t('identity.servantFallback')}</b><small>{actor?.locationId ? core.battlefield[actor.locationId].label : t('identity.notDeployed')}</small></div>
                            </div>
                        </section>
                        <section className="fd-panel fd-score-panel">
                            <div className="fd-panel-heading"><span><Flag size={16} /> {t('scoreboard')}</span><span className="fd-small-status">{core.playerIds.length} {t('players')}</span></div>
                            <div className="fd-player-list">
                                {core.playerIds.map((id) => {
                                    const player = core.players[id];
                                    return <div key={id} className={`fd-player-row ${id === core.currentPlayerId ? 'is-current' : ''}`}><span className="fd-player-dot">{Number(id) + 1}</span><div><b>{playerName(id, matchData)}</b><small>{player.locationId ? core.battlefield[player.locationId].label : t('identity.notDeployed')}</small></div><strong>{player.victoryPoints}<small> VP</small></strong></div>;
                                })}
                            </div>
                        </section>
                        <section className="fd-panel fd-log-panel">
                            <div className="fd-panel-heading"><span><History size={16} /> {t('actionLog')}</span></div>
                            <div className="fd-log-list">
                                {actionLog.length === 0 ? <span className="fd-muted">{t('actionLogEmpty')}</span> : actionLog.map((entry) => <div key={entry.id}>{entry.segments.map((segment, index) => <span key={index}>{segment.type === 'text' ? segment.text : segment.type === 'i18n' ? segment.key : '·'}</span>)}</div>)}
                            </div>
                        </section>
                    </aside>
                </main>

                <section className="fd-identity-strip" aria-label={t('identity.sectionLabel')}>
                    <div className="fd-strip-title"><span>{t('identity.title')}</span><small>{t('identity.subtitle')}</small></div>
                    <div className="fd-identity-options">
                        {FATE_MASTERS.map((master) => <button key={master.id} type="button" className={`fd-identity-card ${actor?.masterId === master.id ? 'is-selected' : ''}`} onClick={() => selectMaster(master.id)} aria-label={master.name}>
                            <OptimizedImage src={master.assetPath} alt={master.name} /><span>{master.name}</span>
                        </button>)}
                        {FATE_SERVANTS.map((servant) => <button key={servant.id} type="button" className={`fd-identity-card fd-servant-card ${actor?.servantId === servant.id ? 'is-selected' : ''}`} onClick={() => selectServant(servant.id)} aria-label={servant.name}>
                            <OptimizedImage src={servant.assetPath} alt={servant.name} /><span>{servant.name}</span>
                        </button>)}
                    </div>
                    <div className="fd-source-note"><span>{t('sourceNote')}</span><b>{displaySourceStatus(core.situation.sourceStatus)}</b></div>
                </section>

                <footer className="fd-bottom-dock">
                    <div className="fd-hand-heading"><span><Hand size={17} /> {t('hand')}</span><b>{selectedCount} / 2</b><small>{t('handStatus')}</small></div>
                    <div className="fd-hand-row" data-testid="fate-domination-hand">
                        {actor?.hand.map((card) => {
                            const definition = FATE_ATTACK_BY_ID[card.definitionId];
                            const selected = actor.selectedAttackIds.includes(card.id);
                            return <div key={card.id} className={`fd-hand-card-wrap ${selected ? 'is-selected' : ''}`}>
                                <button type="button" className="fd-hand-card" onClick={() => isCurrentPlayer && core.phase === 'action' && toggleAttack(card.id)} aria-label={definition.name} data-testid={`fate-domination-card-${card.id}`}>
                                    <OptimizedImage src={definition.assetPath} alt={definition.name} className="fd-hand-card-image" />
                                    <span className="fd-card-stats"><b>{definition.basePower}</b><small>{definition.manaCost} M</small></span>
                                </button>
                                <button type="button" className="fd-inspect-button" onClick={() => inspect(card.id)} aria-label={`${t('inspect')} ${definition.name}`} title={t('inspect')}><Eye size={14} /></button>
                            </div>;
                        })}
                    </div>
                    <div className="fd-attack-zone">
                        <div className="fd-attack-title"><span>{t('attackZone')}</span><small>{core.battleResult ? `${t('battlePower')} ${core.battleResult.power}` : t('attackPending')}</small></div>
                        <div className="fd-active-cards">{activeCards.map((card) => card && <button key={card.id} type="button" className="fd-active-card" onClick={() => inspect(card.id)} aria-label={FATE_ATTACK_BY_ID[card.definitionId].name}><OptimizedImage src={FATE_ATTACK_BY_ID[card.definitionId].assetPath} alt={FATE_ATTACK_BY_ID[card.definitionId].name} /></button>)}</div>
                    </div>
                    <div className="fd-action-dock">
                        <div className="fd-notice"><span>{t(`notices.${core.phase}`)}</span><b>{core.actionNotice}</b></div>
                        {core.phase === 'action' && isCurrentPlayer && (
                            <div className="fd-action-controls" aria-label={t('commands.actionControls')}>
                                {moveTargets.map((locationId) => <button key={locationId} type="button" className="fd-secondary-action" onClick={() => move(locationId)}>{t('commands.moveTo')} {core.battlefield[locationId].label}</button>)}
                                {actor?.skills.filter((skill) => !actor.activeSkills.includes(skill.id)).map((skill) => <button key={skill.id} type="button" className="fd-secondary-action" onClick={() => playSkill(skill.id)}>{t('commands.playSkill')} · {skill.name}</button>)}
                                <button type="button" className="fd-secondary-action" onClick={passAction}>{t('commands.passAction')}</button>
                            </div>
                        )}
                        {core.phase === 'battle' && isCurrentPlayer && nextBattleLocation && (
                            <div className="fd-action-controls" aria-label={t('commands.battleControls')}>
                                <button type="button" className="fd-secondary-action" onClick={() => resolveLocation(nextBattleLocation)}>{t('commands.resolveLocation')} · {core.battlefield[nextBattleLocation].label}</button>
                            </div>
                        )}
                        <button type="button" className="fd-primary-action" disabled={!isCurrentPlayer || (core.phase === 'action' && selectedCount !== 2) || !canAdvance} onClick={() => core.phase === 'action' ? runtimeDispatch(FATE_DOMINATION_COMMANDS.CONFIRM_ATTACK, {}) : advance()} data-testid="fate-domination-primary-action">
                            <span>{actionButtonLabel}</span><ArrowRight size={18} />
                        </button>
                    </div>
                </footer>

                {inspectedCard && <div className="fd-modal-backdrop" role="presentation" onClick={() => setInspectedCardId(null)}>
                    <section className="fd-card-modal" role="dialog" aria-modal="true" aria-label={inspectedCard.name} onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="fd-modal-close" onClick={() => setInspectedCardId(null)} aria-label={t('close')} title={t('close')}><X size={20} /></button>
                        <OptimizedImage src={inspectedCard.assetPath} alt={inspectedCard.name} className="fd-modal-card-image" />
                        <div className="fd-modal-copy"><span className="fd-label">{t('cardInspection')}</span><h2>{inspectedCard.name}</h2><p>{'effectSummary' in inspectedCard && inspectedCard.effectSummary ? inspectedCard.effectSummary : t('cardTextPending')}</p><small>{displaySourceStatus(inspectedCard.sourceStatus)}</small></div>
                    </section>
                </div>}
            </div>
        </UndoProvider>
    );
};

export default FateDominationBoard;
