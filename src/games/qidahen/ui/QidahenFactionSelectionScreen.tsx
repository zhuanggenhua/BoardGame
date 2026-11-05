import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { QidahenCore, QidahenFactionId, QidahenScenarioId } from '../domain/types';
import { getQidahenScenarioPreset } from '../domain/scenarioPresets';
import {
    QIDAHEN_SCENARIO_SETUP_OPTIONS,
    getQidahenPlayableFactions,
    getQidahenScenarioVoteMeta,
} from '../roomSetup';
import { getQidahenScenarioCardPreview } from './setupCardPreviews';
import {
    QIDAHEN_FACTION_MARKER_ASSET,
    QIDAHEN_FACTION_SELECT_COPY,
    QIDAHEN_FACTION_SELECT_IDS,
    QIDAHEN_SCENARIO_SHORT_NAME,
} from './factionSelectionCopy';

const SCENARIO_CARD_WIDTH = 420;
const SCENARIO_CARD_HEIGHT = 582;

export const QidahenFactionSelectionScreen: React.FC<{
    core: QidahenCore;
    playerID: string | null;
    playerNamesById: Record<string, string>;
    locale?: string;
    onCastScenarioVote: (scenarioId: QidahenScenarioId | null) => void;
    onSelectFaction: (factionId: QidahenFactionId) => void;
}> = ({
    core,
    playerID,
    playerNamesById,
    locale,
    onCastScenarioVote,
    onSelectFaction,
}) => {
    const { t } = useTranslation('game-qidahen');
    const scenarioVote = core.scenarioVote;
    const selectionState = core.factionSelection;
    const scenarioVotePending = scenarioVote != null;
    const factionSelectionPending = selectionState != null;
    const isHostViewer = scenarioVotePending && playerID === scenarioVote.hostPlayerId;
    const ownSelection = playerID ? selectionState?.selections[playerID] ?? null : null;
    const playableScenarioIds = new Set((scenarioVote?.options ?? []).map((option) => option.scenarioId));
    const scenarioOptions = QIDAHEN_SCENARIO_SETUP_OPTIONS.map((setupOption) => {
        const scenarioId = setupOption.value as QidahenScenarioId;
        const meta = getQidahenScenarioVoteMeta(scenarioId);
        return {
            scenarioId,
            label: QIDAHEN_SCENARIO_SHORT_NAME[scenarioId],
            fullLabel: meta.label,
            supportedPlayerCounts: meta.supportedPlayerCounts,
            isPlayable: scenarioVotePending ? playableScenarioIds.has(scenarioId) : scenarioId === core.scenarioId,
        };
    });
    const defaultDraftScenarioId = scenarioVotePending
        ? (scenarioOptions.find((option) => option.isPlayable)?.scenarioId ?? core.scenarioId)
        : core.scenarioId;
    const [scenarioMenuOpen, setScenarioMenuOpen] = React.useState(false);
    const [draftScenarioId, setDraftScenarioId] = React.useState<QidahenScenarioId>(defaultDraftScenarioId);
    const [draftFactionId, setDraftFactionId] = React.useState<QidahenFactionId | null>(ownSelection);

    React.useEffect(() => {
        if (!scenarioVotePending) {
            setScenarioMenuOpen(false);
            setDraftScenarioId(core.scenarioId);
        }
    }, [core.scenarioId, scenarioVotePending]);

    React.useEffect(() => {
        if (!selectionState || !draftFactionId) {
            return;
        }
        const ownerPlayerId = Object.entries(selectionState.selections).find(([, selectedFactionId]) => selectedFactionId === draftFactionId)?.[0] ?? null;
        if (ownerPlayerId && ownerPlayerId !== playerID) {
            setDraftFactionId(ownSelection);
        }
    }, [draftFactionId, ownSelection, playerID, selectionState]);

    if (!scenarioVotePending && !factionSelectionPending) {
        return null;
    }

    const previewScenarioId = scenarioMenuOpen ? draftScenarioId : (scenarioVotePending ? defaultDraftScenarioId : core.scenarioId);
    const playableFactionIds = new Set(getQidahenPlayableFactions(previewScenarioId));
    const startHandByFaction = getQidahenScenarioPreset(previewScenarioId).factions;
    const confirmedCount = selectionState ? Object.keys(selectionState.selections).length : 0;
    const totalSeats = core.playerIds.length;
    const playerCount = scenarioVote?.playerCount ?? totalSeats;
    const scenarioChipLabel = scenarioVotePending
        ? t('board.factionSelection.scenarioMenu', { defaultValue: '剧本' })
        : `${t('board.factionSelection.scenarioMenu', { defaultValue: '剧本' })} · ${QIDAHEN_SCENARIO_SHORT_NAME[core.scenarioId]}`;
    const canConfirmFaction = Boolean(
        factionSelectionPending
        && playerID
        && draftFactionId
        && playableFactionIds.has(draftFactionId)
        && draftFactionId !== ownSelection,
    );
    const statusText = scenarioVotePending
        ? (isHostViewer
            ? t('board.factionSelection.confirmScenarioFirst', { defaultValue: '请先确认起始剧本设置卡' })
            : t('board.scenarioVote.waitingHost', { defaultValue: '等待房主选择' }))
        : draftFactionId
            ? (ownSelection === draftFactionId
                ? t('board.factionSelection.confirmedFaction', {
                    factionName: core.factions[draftFactionId].name,
                    defaultValue: '已确认 {{factionName}}',
                })
                : core.factions[draftFactionId].name)
            : t('board.factionSelection.chooseAvailable', { defaultValue: '请选择一个未被占用的阵营' });

    return (
        <div
            className="qidahen-faction-select pointer-events-auto absolute inset-0 overflow-hidden px-9 py-6"
            data-testid="qidahen-faction-selection-screen"
        >
            <div className="qidahen-faction-select__sheet">
                <div className="qidahen-faction-select__top">
                    <h1 data-testid="qidahen-faction-selection-title">
                        {t('board.factionSelection.title', { defaultValue: '选择你的阵营' })}
                    </h1>
                    <div className="qidahen-faction-select__top-right">
                        <button
                            type="button"
                            className="qidahen-faction-select__scenario-btn"
                            data-testid="qidahen-scenario-menu-open"
                            onClick={() => {
                                setDraftScenarioId(scenarioVotePending ? defaultDraftScenarioId : core.scenarioId);
                                setScenarioMenuOpen(true);
                            }}
                        >
                            {scenarioChipLabel}
                        </button>
                        <div className="qidahen-faction-select__chip">
                            {t('board.factionSelection.confirmedCount', {
                                confirmed: confirmedCount,
                                total: totalSeats,
                                defaultValue: '已确认 {{confirmed}} / {{total}}',
                            })}
                        </div>
                        <div
                            className="qidahen-faction-select__chip"
                            data-testid="qidahen-scenario-vote-player-count"
                        >
                            {t('board.scenarioVote.playerCountShort', {
                                count: playerCount,
                                defaultValue: '{{count}} 人',
                            })}
                        </div>
                    </div>
                </div>

                <div className="qidahen-faction-select__factions" data-testid="qidahen-faction-selection-options">
                    {QIDAHEN_FACTION_SELECT_IDS.map((factionId) => {
                        const faction = core.factions[factionId];
                        const copy = QIDAHEN_FACTION_SELECT_COPY[factionId];
                        const blocked = !playableFactionIds.has(factionId);
                        const ownerPlayerId = selectionState
                            ? Object.entries(selectionState.selections).find(([, selectedFactionId]) => selectedFactionId === factionId)?.[0] ?? null
                            : null;
                        const ownerSeatNumber = ownerPlayerId ? core.playerIds.indexOf(ownerPlayerId) + 1 : null;
                        const selectedByViewer = draftFactionId === factionId && !blocked;
                        const confirmedByViewer = ownerPlayerId != null && ownerPlayerId === playerID;
                        const occupiedByOther = ownerPlayerId != null && ownerPlayerId !== playerID;
                        const startHand = startHandByFaction[factionId]?.handCount;
                        const occupancy = blocked
                            ? t('board.factionSelection.unavailableInScenario', { defaultValue: '本剧本无此势力' })
                            : confirmedByViewer
                                ? t('board.factionSelection.youConfirmed', { defaultValue: '你已确认' })
                                : occupiedByOther
                                    ? t('board.factionSelection.occupiedBy', {
                                        playerName: playerNamesById[ownerPlayerId] ?? t('board.factionSelection.seatFallback', {
                                            seatNumber: ownerSeatNumber,
                                            defaultValue: '席位 {{seatNumber}}',
                                        }),
                                        defaultValue: '{{playerName}} 已确认',
                                    })
                                    : t('board.factionSelection.available', { defaultValue: '可选择' });
                        return (
                            <button
                                key={factionId}
                                type="button"
                                data-testid={`qidahen-faction-option-${factionId}`}
                                data-selected={selectedByViewer ? 'true' : 'false'}
                                disabled={!playerID || occupiedByOther || blocked}
                                className={`qidahen-faction-select__faction${selectedByViewer ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}`}
                                aria-pressed={selectedByViewer}
                                onClick={() => {
                                    if (!blocked && !occupiedByOther) {
                                        setDraftFactionId(factionId);
                                    }
                                }}
                            >
                                <div className="qidahen-faction-select__who">
                                    <OptimizedImage
                                        src={QIDAHEN_FACTION_MARKER_ASSET[factionId]}
                                        locale={locale}
                                        alt=""
                                        aria-hidden="true"
                                        className="qidahen-faction-select__token"
                                        draggable={false}
                                        placeholder={false}
                                    />
                                    <h2>{faction.name}</h2>
                                </div>
                                <p className="qidahen-faction-select__intro">{copy.intro}</p>
                                <div className="qidahen-faction-select__facts">
                                    {copy.facts}
                                    {!blocked && startHand != null ? ` · 起始手牌 ${startHand}` : ''}
                                </div>
                                <div className="qidahen-faction-select__acts-label">
                                    {t('board.factionSelection.factionActions', { defaultValue: '势力行动' })}
                                </div>
                                <ul className="qidahen-faction-select__acts">
                                    {copy.actions.map((action) => (
                                        <li key={action.id}>
                                            <span
                                                className="qidahen-faction-select__act"
                                                data-testid={`qidahen-faction-act-${factionId}-${action.id}`}
                                                tabIndex={0}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                {action.name}
                                                <span className="qidahen-faction-select__tip">{action.effect}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="qidahen-faction-select__occ">{occupancy}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="qidahen-faction-select__dock">
                    <div className="qidahen-faction-select__status" data-testid="qidahen-faction-selection-status">
                        {statusText}
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-faction-selection-confirm"
                        disabled={!canConfirmFaction}
                        className="qidahen-faction-select__confirm"
                        onClick={() => {
                            if (draftFactionId && canConfirmFaction) {
                                onSelectFaction(draftFactionId);
                            }
                        }}
                    >
                        {t('board.factionSelection.confirmFaction', { defaultValue: '确认阵营' })}
                    </button>
                </div>
            </div>

            {scenarioMenuOpen ? (
                <div className="qidahen-faction-select__overlay" data-testid="qidahen-scenario-vote-screen">
                    <div className="qidahen-faction-select__menu">
                        <h3 data-testid="qidahen-scenario-vote-title">
                            {t('board.scenarioVote.overlayTitle', { defaultValue: '起始剧本设置卡' })}
                        </h3>
                        <div className="qidahen-faction-select__cards">
                            {scenarioOptions.map((option) => {
                                const picked = draftScenarioId === option.scenarioId;
                                const lockedReason = t('board.scenarioVote.unavailableForPlayerCountShort', {
                                    count: playerCount,
                                    defaultValue: `当前 ${playerCount} 人房不可投`,
                                });
                                return (
                                    <button
                                        key={option.scenarioId}
                                        type="button"
                                        className={`qidahen-faction-select__scen${picked ? ' is-picked' : ''}${option.isPlayable ? '' : ' is-bad'}`}
                                        data-testid={`qidahen-scenario-vote-option-${option.scenarioId}`}
                                        data-qidahen-scenario-host-selected={picked ? 'true' : undefined}
                                        disabled={!isHostViewer || !option.isPlayable}
                                        aria-pressed={picked}
                                        aria-label={option.isPlayable ? option.fullLabel : `${option.fullLabel}，${lockedReason}`}
                                        onClick={() => {
                                            if (isHostViewer && option.isPlayable) {
                                                setDraftScenarioId(option.scenarioId);
                                            }
                                        }}
                                    >
                                        <span
                                            className="qidahen-faction-select__scen-frame"
                                            data-testid={picked ? `qidahen-scenario-host-selected-${option.scenarioId}` : undefined}
                                        >
                                            <CardPreview
                                                previewRef={getQidahenScenarioCardPreview(option.scenarioId)}
                                                locale={locale}
                                                title={option.fullLabel}
                                                style={{
                                                    width: SCENARIO_CARD_WIDTH,
                                                    height: SCENARIO_CARD_HEIGHT,
                                                    background: 'transparent',
                                                }}
                                            />
                                        </span>
                                        {!option.isPlayable ? (
                                            <span
                                                className="qidahen-faction-select__locked"
                                                data-testid={`qidahen-scenario-vote-locked-${option.scenarioId}`}
                                            >
                                                {lockedReason}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="qidahen-faction-select__menu-actions" data-testid="qidahen-scenario-vote-actions">
                            {isHostViewer ? (
                                <>
                                    <button
                                        type="button"
                                        className="qidahen-faction-select__ghost"
                                        data-testid="qidahen-scenario-vote-close"
                                        onClick={() => setScenarioMenuOpen(false)}
                                    >
                                        {t('board.scenarioVote.close', { defaultValue: '关闭' })}
                                    </button>
                                    <button
                                        type="button"
                                        className="qidahen-faction-select__confirm"
                                        data-testid="qidahen-scenario-vote-confirm"
                                        disabled={!draftScenarioId || !scenarioVotePending}
                                        onClick={() => {
                                            if (scenarioVotePending) {
                                                onCastScenarioVote(draftScenarioId);
                                            } else {
                                                setScenarioMenuOpen(false);
                                            }
                                        }}
                                    >
                                        {t('board.scenarioVote.confirmScenario', { defaultValue: '确认采用' })}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="qidahen-faction-select__waiting">
                                        {t('board.scenarioVote.waitingHostShort', { defaultValue: '等待房主' })}
                                    </div>
                                    <button
                                        type="button"
                                        className="qidahen-faction-select__ghost"
                                        data-testid="qidahen-scenario-vote-close"
                                        onClick={() => setScenarioMenuOpen(false)}
                                    >
                                        {t('board.scenarioVote.close', { defaultValue: '关闭' })}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
