import React from 'react';
import type { CardPreviewRef } from '../../../core/cardPreviewTypes';
import { useTranslation } from 'react-i18next';
import { SelectableGameObject } from '../../../components/game/framework';
import { CardPreviewFit } from './CardSurfaces';
import { CARD_DIMENSIONS, UI_STYLE, UI_SURFACE } from './boardLayout';
import { Maximize2 } from 'lucide-react';
import type { QidahenCore, QidahenFactionId } from '../domain';
import type { QidahenMagnifyTarget } from './boardTypes';
import { getQidahenSetupCharacterPreview, getQidahenSetupArmamentPreview } from './setupCardPreviews';

export const QidahenSetupObjectChoice: React.FC<{
    label: string;
    previewRef: CardPreviewRef | null;
    selected: boolean;
    testId: string;
    onClick: () => void;
    onMagnify?: () => void;
    disabled?: boolean;
}> = ({ label, previewRef, selected, testId, onClick, onMagnify, disabled = false }) => {
    const { t } = useTranslation('game-qidahen');
    return (
        <div className="relative h-[226px] w-[164px] shrink-0" data-qidahen-setup-choice-shell>
            <SelectableGameObject
                aria-label={`选择${label}`}
                selected={selected}
                available={!disabled}
                disabled={disabled}
                data-testid={testId}
                data-qidahen-choice-selected={selected ? 'true' : undefined}
                className={`group h-[226px] w-[164px] rounded-[9px] bg-transparent active:translate-y-0 ${disabled ? 'cursor-default opacity-65' : 'hover:-translate-y-2'} ${selected ? '-translate-y-2 opacity-100' : ''}`}
                onClick={onClick}
            >
                {previewRef ? (
                    <span className="pointer-events-none relative block h-full w-full overflow-hidden rounded-[9px] bg-[#efe3c4] shadow-[0_8px_18px_rgba(56,35,15,0.24)]">
                        <CardPreviewFit
                            previewRef={previewRef}
                            title={label}
                            width={164}
                            height={226}
                            rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                            rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                        />
                    </span>
                ) : (
                    <span
                        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[9px] border-[2px] border-dashed px-3 text-center"
                        style={{
                            borderColor: UI_STYLE.cinnabar,
                            background: UI_SURFACE.paperQuiet,
                            color: UI_STYLE.ink,
                        }}
                    >
                        <span className="text-[15px] font-black">{label}</span>
                        <span className="text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                            {t('board.setup.missingOfficialCardArt', { defaultValue: '缺少正式卡图' })}
                        </span>
                    </span>
                )}
            </SelectableGameObject>
            {previewRef && onMagnify ? (
                <button
                    type="button"
                    className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center border-[2px] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
                    aria-label={`放大查看${label}`}
                    title={`放大查看${label}`}
                    onClick={onMagnify}
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: UI_STYLE.paperLight,
                        color: UI_STYLE.ink,
                        borderRadius: 4,
                    }}
                >
                    <Maximize2 aria-hidden="true" className="h-5 w-5" />
                </button>
            ) : null}
        </div>
    );
};

export const QidahenInMatchSetupOverlay: React.FC<{
    core: QidahenCore;
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    onResolveScenarioCharacterChoice: (groupId: string, characterIds: string[]) => void;
    onResolveScenarioArmamentChoice: (
        groupId: string,
        armamentIds: QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds'],
    ) => void;
    onMagnifyCard: (target: QidahenMagnifyTarget) => void;
}> = ({
    core,
    viewerFactionId,
    playerID,
    onResolveScenarioCharacterChoice,
    onResolveScenarioArmamentChoice,
    onMagnifyCard,
}) => {
    const { t } = useTranslation('game-qidahen');
    const pendingCharacterChoices = core.pendingScenarioCharacterChoices;
    const pendingArmamentChoices = core.pendingScenarioArmamentChoices;
    const [setupCharacterChoices] = React.useState(() => pendingCharacterChoices);
    const [setupArmamentChoices] = React.useState(() => pendingArmamentChoices);
    const isViewerScoped = playerID != null && viewerFactionId != null;
    const interactiveCharacterChoices = setupCharacterChoices.filter(
        (group) => !isViewerScoped || group.factionId === viewerFactionId,
    );
    const waitingCharacterChoices = pendingCharacterChoices.filter(
        (group) => isViewerScoped && group.factionId !== viewerFactionId,
    );
    const interactiveArmamentChoices = setupArmamentChoices.filter(
        (group) => !isViewerScoped || group.factionId === viewerFactionId,
    );
    const waitingArmamentChoices = pendingArmamentChoices.filter(
        (group) => isViewerScoped && group.factionId !== viewerFactionId,
    );
    const [selectedCharacterIdsByGroup, setSelectedCharacterIdsByGroup] = React.useState<Record<string, string[]>>({});
    const [selectedArmamentIdsByGroup, setSelectedArmamentIdsByGroup] = React.useState<Record<string, string[]>>({});
    const applyInlineChoice = React.useCallback(
        (
            groupId: string,
            optionId: string,
            maxCount: number,
            currentSelections: Record<string, string[]>,
            setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>,
        ) => {
            const selectedIds = currentSelections[groupId] ?? [];
            const alreadySelected = selectedIds.includes(optionId);
            const nextSelectedIds = alreadySelected
                ? selectedIds.filter((id) => id !== optionId)
                : selectedIds.length >= maxCount
                  ? [...selectedIds.slice(0, Math.max(0, maxCount - 1)), optionId]
                  : [...selectedIds, optionId];
            setSelections((current) => ({
                ...current,
                [groupId]: nextSelectedIds,
            }));
        },
        [],
    );
    const waitingSummaryLines = React.useMemo(() => {
        const waitingSummaries = new Map<
            string,
            {
                factionName: string;
                characterGroupCount: number;
                armamentGroupCount: number;
            }
        >();

        for (const group of waitingCharacterChoices) {
            const current = waitingSummaries.get(group.factionId) ?? {
                factionName: group.factionName,
                characterGroupCount: 0,
                armamentGroupCount: 0,
            };
            current.characterGroupCount += 1;
            waitingSummaries.set(group.factionId, current);
        }

        for (const group of waitingArmamentChoices) {
            const current = waitingSummaries.get(group.factionId) ?? {
                factionName: group.factionName,
                characterGroupCount: 0,
                armamentGroupCount: 0,
            };
            current.armamentGroupCount += 1;
            waitingSummaries.set(group.factionId, current);
        }

        return Array.from(waitingSummaries.values()).map((summary) => {
            const parts: string[] = [];
            if (summary.characterGroupCount > 0) {
                parts.push(`人物 ${summary.characterGroupCount} 项`);
            }
            if (summary.armamentGroupCount > 0) {
                parts.push(`军备 ${summary.armamentGroupCount} 项`);
            }
            return `${summary.factionName}：${parts.join('、')}`;
        });
    }, [waitingArmamentChoices, waitingCharacterChoices]);

    const currentSeatLabel = t('board.setup.currentSeat', { defaultValue: '本席' });

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-[140] flex items-center justify-center bg-[rgba(14,10,7,0.78)] px-6 py-8 backdrop-blur-[2px]"
            data-testid="qidahen-inmatch-setup-overlay"
        >
            <div
                className="relative max-h-full w-full max-w-[1180px] overflow-hidden border-[4px] p-5"
                data-ui-family="qidahen-book-setup"
                style={{
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.bookPaper,
                    color: UI_STYLE.ink,
                    boxShadow: '0 8px 0 rgba(58,37,17,0.26), 0 28px 46px rgba(13,8,4,0.42)',
                    borderRadius: 8,
                }}
            >
                <div
                    className="pointer-events-none absolute bottom-5 left-1/2 top-5 w-[2px] -translate-x-1/2"
                    style={{ background: 'linear-gradient(180deg, transparent, rgba(84,55,24,0.38), transparent)' }}
                />
                <div
                    className="relative flex flex-wrap items-end justify-between gap-3 border-b-[2px] pb-4"
                    style={{ borderColor: UI_STYLE.bronzeFaint }}
                >
                    <div>
                        <div
                            className="text-[11px] font-black uppercase tracking-[0.2em]"
                            style={{ color: UI_STYLE.cinnabar }}
                        >
                            {t('board.setup.eyebrow', { defaultValue: '局内开局设置' })}
                        </div>
                        <div className="mt-2 text-[28px] font-black" data-testid="qidahen-inmatch-setup-title">
                            {t('board.setup.title', { defaultValue: '确认本阵营人物与军备' })}
                        </div>
                        <div className="mt-2 text-[13px] leading-6" style={{ color: UI_STYLE.mutedInk }}>
                            {t('board.setup.description', { defaultValue: '选择候选后确认；确认前可以随时改选。' })}
                        </div>
                    </div>
                    <div
                        className="border-[2px] px-3 py-2 text-[12px] font-black"
                        data-testid="qidahen-inmatch-setup-scenario"
                        style={{ borderColor: UI_STYLE.paperEdge, background: UI_STYLE.paperLight, borderRadius: 4 }}
                    >
                        {core.scenarioLabel}
                    </div>
                </div>

                <div className="relative mt-5 grid min-h-0 gap-5 md:grid-cols-2">
                    <section
                        className="min-h-0 overflow-y-auto border-[3px] p-4"
                        data-testid="qidahen-inmatch-setup-book-page-player"
                        style={{
                            borderColor: UI_STYLE.paperEdge,
                            background: UI_SURFACE.bookPage,
                            boxShadow: UI_SURFACE.inkInset,
                            borderRadius: 5,
                        }}
                    >
                        <div
                            className="mb-3 flex items-center justify-between gap-3 border-b pb-2"
                            style={{ borderColor: UI_STYLE.bronzeFaint }}
                        >
                            <div
                                className="text-[12px] font-black tracking-[0.16em]"
                                style={{ color: UI_STYLE.cinnabar }}
                            >
                                {viewerFactionId
                                    ? (core.factions[viewerFactionId]?.name ?? currentSeatLabel)
                                    : currentSeatLabel}
                            </div>
                            <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                {t('board.setup.playerPage', { defaultValue: '人物与军备' })}
                            </div>
                        </div>
                        {interactiveCharacterChoices.map((group) => {
                            const selectedIds = selectedCharacterIdsByGroup[group.id] ?? [];
                            const completed = !pendingCharacterChoices.some(
                                (pendingGroup) => pendingGroup.id === group.id,
                            );
                            return (
                                <div
                                    key={group.id}
                                    className="mb-4 border-b-[2px] pb-4 last:mb-0 last:border-b-0 last:pb-0"
                                    data-testid={`qidahen-inmatch-setup-character-${group.id}`}
                                    data-qidahen-inline-choice="character"
                                    data-completed={completed ? 'true' : 'false'}
                                    style={{ borderColor: UI_STYLE.bronzeFaint }}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <div
                                            className="text-[12px] font-black tracking-[0.18em]"
                                            style={{ color: UI_STYLE.cinnabar }}
                                        >
                                            {group.factionName} ·{' '}
                                            {t('board.setup.characterLabel', { defaultValue: '人物' })}
                                        </div>
                                        <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                            {completed
                                                ? t('board.setup.completed', { defaultValue: '已完成' })
                                                : t('board.setup.selectedCount', {
                                                      selected: selectedIds.length,
                                                      count: group.count,
                                                      defaultValue: '已选 {{selected}} / {{count}}',
                                                  })}
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-end gap-4">
                                        {group.characterIds.map((characterId, index) => {
                                            const selected = selectedIds.includes(characterId);
                                            const label = group.characterNames[index] ?? characterId;
                                            return (
                                                <QidahenSetupObjectChoice
                                                    key={characterId}
                                                    label={label}
                                                    previewRef={getQidahenSetupCharacterPreview(
                                                        group.factionId,
                                                        characterId,
                                                    )}
                                                    selected={selected}
                                                    disabled={completed}
                                                    testId={`qidahen-inmatch-setup-character-option-${group.id}-${characterId}`}
                                                    onMagnify={() => {
                                                        const previewRef = getQidahenSetupCharacterPreview(
                                                            group.factionId,
                                                            characterId,
                                                        );
                                                        if (previewRef) {
                                                            onMagnifyCard({
                                                                previewRef,
                                                                title: label,
                                                                rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                                                rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                                            });
                                                        }
                                                    }}
                                                    onClick={() =>
                                                        applyInlineChoice(
                                                            group.id,
                                                            characterId,
                                                            group.count,
                                                            selectedCharacterIdsByGroup,
                                                            setSelectedCharacterIdsByGroup,
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                    <div
                                        className="mt-4 flex items-center justify-between gap-4 border-t pt-3"
                                        style={{ borderColor: UI_STYLE.bronzeFaint }}
                                    >
                                        <span className="text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                            {completed
                                                ? t('board.setup.characterConfirmed', {
                                                      defaultValue: '人物选择已确认',
                                                  })
                                                : selectedIds.length === group.count
                                                  ? t('board.setup.readyToConfirm', {
                                                        defaultValue: '候选已齐，可以确认',
                                                    })
                                                  : t('board.setup.remainingChoices', {
                                                        count: group.count - selectedIds.length,
                                                        defaultValue: '还需选择 {{count}} 项',
                                                    })}
                                        </span>
                                        <button
                                            type="button"
                                            data-testid={`qidahen-inmatch-setup-character-confirm-${group.id}`}
                                            disabled={completed || selectedIds.length !== group.count}
                                            className="min-h-11 border-[2px] px-5 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                            onClick={() => onResolveScenarioCharacterChoice(group.id, selectedIds)}
                                            style={{
                                                borderColor: UI_STYLE.mapInk,
                                                background: UI_STYLE.cinnabar,
                                                color: UI_STYLE.mapIvory,
                                                borderRadius: 4,
                                            }}
                                        >
                                            {completed
                                                ? t('board.setup.characterButtonConfirmed', {
                                                      defaultValue: '人物已确认',
                                                  })
                                                : t('board.setup.confirmCharacter', { defaultValue: '确认人物' })}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {interactiveArmamentChoices.map((group) => {
                            const selectedIds = selectedArmamentIdsByGroup[group.id] ?? [];
                            const completed = !pendingArmamentChoices.some(
                                (pendingGroup) => pendingGroup.id === group.id,
                            );
                            return (
                                <div
                                    key={group.id}
                                    className="mb-4 border-b-[2px] pb-4 last:mb-0 last:border-b-0 last:pb-0"
                                    data-testid={`qidahen-inmatch-setup-armament-${group.id}`}
                                    data-qidahen-inline-choice="armament"
                                    data-completed={completed ? 'true' : 'false'}
                                    style={{ borderColor: UI_STYLE.bronzeFaint }}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <div
                                            className="text-[12px] font-black tracking-[0.18em]"
                                            style={{ color: UI_STYLE.cinnabar }}
                                        >
                                            {group.factionName} ·{' '}
                                            {t('board.setup.armamentLabel', { defaultValue: '军备' })}
                                        </div>
                                        <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                            {completed
                                                ? t('board.setup.completed', { defaultValue: '已完成' })
                                                : t('board.setup.selectedCount', {
                                                      selected: selectedIds.length,
                                                      count: group.count,
                                                      defaultValue: '已选 {{selected}} / {{count}}',
                                                  })}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                        {t('board.setup.armamentEligible', {
                                            factionName: group.factionName,
                                            defaultValue: '通用军备卡 · 本剧本允许{{factionName}}选择',
                                        })}
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-end gap-4">
                                        {group.armamentIds.map((armamentId, index) => {
                                            const selected = selectedIds.includes(armamentId);
                                            const label = group.armamentNames[index] ?? armamentId;
                                            return (
                                                <QidahenSetupObjectChoice
                                                    key={armamentId}
                                                    label={label}
                                                    previewRef={getQidahenSetupArmamentPreview(armamentId)}
                                                    selected={selected}
                                                    disabled={completed}
                                                    testId={`qidahen-inmatch-setup-armament-option-${group.id}-${armamentId}`}
                                                    onMagnify={() => {
                                                        const previewRef = getQidahenSetupArmamentPreview(armamentId);
                                                        if (previewRef) {
                                                            onMagnifyCard({
                                                                previewRef,
                                                                title: label,
                                                                rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                                                rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                                            });
                                                        }
                                                    }}
                                                    onClick={() =>
                                                        applyInlineChoice(
                                                            group.id,
                                                            armamentId,
                                                            group.count,
                                                            selectedArmamentIdsByGroup,
                                                            setSelectedArmamentIdsByGroup,
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                    <div
                                        className="mt-4 flex items-center justify-between gap-4 border-t pt-3"
                                        style={{ borderColor: UI_STYLE.bronzeFaint }}
                                    >
                                        <span className="text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                            {completed
                                                ? t('board.setup.armamentConfirmed', { defaultValue: '军备选择已确认' })
                                                : selectedIds.length === group.count
                                                  ? t('board.setup.readyToConfirm', {
                                                        defaultValue: '候选已齐，可以确认',
                                                    })
                                                  : t('board.setup.remainingChoices', {
                                                        count: group.count - selectedIds.length,
                                                        defaultValue: '还需选择 {{count}} 项',
                                                    })}
                                        </span>
                                        <button
                                            type="button"
                                            data-testid={`qidahen-inmatch-setup-armament-confirm-${group.id}`}
                                            disabled={completed || selectedIds.length !== group.count}
                                            className="min-h-11 border-[2px] px-5 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                            onClick={() =>
                                                onResolveScenarioArmamentChoice(
                                                    group.id,
                                                    selectedIds as QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds'],
                                                )
                                            }
                                            style={{
                                                borderColor: UI_STYLE.mapInk,
                                                background: UI_STYLE.cinnabar,
                                                color: UI_STYLE.mapIvory,
                                                borderRadius: 4,
                                            }}
                                        >
                                            {completed
                                                ? t('board.setup.armamentButtonConfirmed', {
                                                      defaultValue: '军备已确认',
                                                  })
                                                : t('board.setup.confirmArmament', { defaultValue: '确认军备' })}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {interactiveCharacterChoices.length === 0 && interactiveArmamentChoices.length === 0 ? (
                            <div
                                className="flex min-h-[260px] items-center justify-center border-[2px] px-8 text-center text-[15px] font-black"
                                data-testid="qidahen-inmatch-setup-no-private-choice"
                                style={{
                                    borderColor: UI_STYLE.bronzeFaint,
                                    color: UI_STYLE.mutedInk,
                                    background: 'rgba(255,255,255,0.32)',
                                    borderRadius: 4,
                                }}
                            >
                                {t('board.setup.noPrivateChoice', {
                                    defaultValue: '本阵营没有需要选择的前置项，等待其他玩家完成。',
                                })}
                            </div>
                        ) : null}
                    </section>

                    <section
                        className="min-h-0 overflow-y-auto border-[3px] p-4"
                        data-testid="qidahen-inmatch-setup-book-page-status"
                        style={{
                            borderColor: UI_STYLE.paperEdge,
                            background: UI_SURFACE.bookPage,
                            boxShadow: UI_SURFACE.inkInset,
                            borderRadius: 5,
                        }}
                    >
                        <div
                            className="mb-3 flex items-center justify-between gap-3 border-b pb-2"
                            style={{ borderColor: UI_STYLE.bronzeFaint }}
                        >
                            <div
                                className="text-[12px] font-black tracking-[0.16em]"
                                style={{ color: UI_STYLE.cinnabar }}
                            >
                                {t('board.setup.tablePage', { defaultValue: '席位状态' })}
                            </div>
                            <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                {core.scenarioLabel}
                            </div>
                        </div>
                        <div
                            className="border-[2px] px-4 py-3 text-[13px] font-black leading-6"
                            data-testid="qidahen-inmatch-setup-waiting"
                            style={{
                                borderColor: UI_STYLE.paperEdge,
                                background: 'rgba(255,255,255,0.48)',
                                borderRadius: 4,
                            }}
                        >
                            {waitingCharacterChoices.length > 0 || waitingArmamentChoices.length > 0
                                ? t('board.setup.waiting', { defaultValue: '等待其他玩家完成其所属阵营的前置项。' })
                                : t('board.setup.noWaiting', { defaultValue: '本席当前没有等待中的他人前置项。' })}
                            <div className="mt-1 text-[12px]" style={{ color: UI_STYLE.mutedInk }}>
                                {waitingSummaryLines.length > 0
                                    ? waitingSummaryLines.join(' / ')
                                    : t('board.setup.privateOnly', {
                                          defaultValue: '只显示你所属阵营可处理的项目，不暴露他人私有候选。',
                                      })}
                            </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                            {core.currentFactionOrder.map((factionId) => {
                                const faction = core.factions[factionId];
                                const ownCharacterCount = pendingCharacterChoices.filter(
                                    (group) => group.factionId === factionId,
                                ).length;
                                const ownArmamentCount = pendingArmamentChoices.filter(
                                    (group) => group.factionId === factionId,
                                ).length;
                                return (
                                    <div
                                        key={factionId}
                                        className="flex items-center justify-between border-b pb-2"
                                        style={{ borderColor: UI_STYLE.bronzeFaint }}
                                    >
                                        <span>{faction.name}</span>
                                        <span>
                                            {ownCharacterCount + ownArmamentCount > 0
                                                ? t('board.setup.pendingItems', {
                                                      count: ownCharacterCount + ownArmamentCount,
                                                      defaultValue: '待完成 {{count}} 项',
                                                  })
                                                : t('board.setup.completed', { defaultValue: '已完成' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
