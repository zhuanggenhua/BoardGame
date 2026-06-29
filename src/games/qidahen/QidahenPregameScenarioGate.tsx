import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    buildLocalMatchSetupData,
    resolveLocalMatchPlayerCount,
    resolveSetupSelectionsFromSearchParams,
} from '../../engine/ai/seatControllers';
import type { GameSetupSelections } from '../setupOptions';
import { QIDAHEN_MANIFEST } from './manifest';
import {
    applyQidahenPregameChoiceDefaults,
    getQidahenAllowedPlayerCounts,
    getQidahenPregameChoiceFields,
    QIDAHEN_PREGAME_CHOICE_FIELDS,
    QIDAHEN_SCENARIO_SETUP_OPTIONS,
    QIDAHEN_SCENARIO_SETUP_FIELD,
    readQidahenScenarioId,
    type QidahenPregameChoiceField,
} from './roomSetup';
import { buildQidahenTutorialSetupData } from './tutorialSetup';
import { QIDAHEN_DEFAULT_TUTORIAL_ID } from './tutorial';

type QidahenPregameScenarioGateReadyState = {
    numPlayers: number;
    setupSelections: GameSetupSelections;
    setupData: Record<string, unknown>;
};

type QidahenPregameScenarioGateProps = {
    searchParams: URLSearchParams;
    tutorialId?: string;
    tutorialMode?: boolean;
    onSearchParamsChange: (nextSearchParams: URLSearchParams) => void;
    children: (readyState: QidahenPregameScenarioGateReadyState) => React.ReactNode;
};

const isSameSetupSelections = (
    left: GameSetupSelections,
    right: GameSetupSelections,
) => {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    return leftKeys.every((key) => left[key] === right[key]);
};

const isValidPregameChoiceValue = (
    field: QidahenPregameChoiceField,
    value: unknown,
): value is string => (
    typeof value === 'string'
    && (field.field.options ?? []).some((option) => option.value === value)
);

const readRouteSelectionsFromSearchParams = (searchParams: URLSearchParams): GameSetupSelections => {
    const selections = resolveSetupSelectionsFromSearchParams({
        gameManifest: QIDAHEN_MANIFEST,
        searchParams,
    });
    const scenarioId = readQidahenScenarioId({
        ...selections,
        [QIDAHEN_SCENARIO_SETUP_FIELD]: searchParams.get(`setup.${QIDAHEN_SCENARIO_SETUP_FIELD}`) ?? selections[QIDAHEN_SCENARIO_SETUP_FIELD],
    } as Record<string, unknown>);
    const nextSelections: GameSetupSelections = {
        ...selections,
        [QIDAHEN_SCENARIO_SETUP_FIELD]: scenarioId,
    };

    for (const field of getQidahenPregameChoiceFields(scenarioId)) {
        const rawValue = searchParams.get(`setup.${field.key}`);
        if (isValidPregameChoiceValue(field, rawValue)) {
            nextSelections[field.key] = rawValue;
        }
    }

    return nextSelections;
};

const hasCompletePregameSelections = (selections: GameSetupSelections): boolean => {
    const scenarioId = readQidahenScenarioId(selections as Record<string, unknown>);
    return getQidahenPregameChoiceFields(scenarioId).every((field) => (
        isValidPregameChoiceValue(field, selections[field.key])
    ));
};

const resolvePregamePlayerCount = (
    searchParams: URLSearchParams,
    scenarioId: ReturnType<typeof readQidahenScenarioId>,
): number => (
    resolveLocalMatchPlayerCount(searchParams.get('players'), [
        ...getQidahenAllowedPlayerCounts(scenarioId),
    ])
);

const resolveScenarioLabel = (
    scenarioId: ReturnType<typeof readQidahenScenarioId>,
    t: (key: string, options?: Record<string, unknown>) => string,
): string => {
    const labelKey = QIDAHEN_SCENARIO_SETUP_OPTIONS.find((option) => option.value === scenarioId)?.labelKey;
    if (!labelKey) {
        return scenarioId;
    }
    return t(labelKey.replace('games.qidahen.', ''), { defaultValue: scenarioId });
};

export function QidahenPregameScenarioGate({
    searchParams,
    tutorialId,
    tutorialMode = false,
    onSearchParamsChange,
    children,
}: QidahenPregameScenarioGateProps) {
    const { t } = useTranslation('game-qidahen');
    const effectiveTutorialId = tutorialMode
        ? (tutorialId ?? QIDAHEN_DEFAULT_TUTORIAL_ID)
        : tutorialId;
    const tutorialSetupData = React.useMemo(
        () => buildQidahenTutorialSetupData(effectiveTutorialId),
        [effectiveTutorialId],
    );
    const routeSelections = React.useMemo(
        () => readRouteSelectionsFromSearchParams(searchParams),
        [searchParams],
    );
    const [draftSelections, setDraftSelections] = React.useState<GameSetupSelections>(
        () => applyQidahenPregameChoiceDefaults(routeSelections),
    );

    React.useEffect(() => {
        const nextDraftSelections = applyQidahenPregameChoiceDefaults(routeSelections);
        setDraftSelections((current) => (
            isSameSetupSelections(current, nextDraftSelections)
                ? current
                : nextDraftSelections
        ));
    }, [routeSelections]);

    const routeScenarioId = readQidahenScenarioId(routeSelections as Record<string, unknown>);
    const draftScenarioId = readQidahenScenarioId(draftSelections as Record<string, unknown>);
    const activePregameFields = React.useMemo(
        () => getQidahenPregameChoiceFields(draftScenarioId),
        [draftScenarioId],
    );
    const resolvedPlayerCount = React.useMemo(
        () => resolvePregamePlayerCount(searchParams, routeScenarioId),
        [routeScenarioId, searchParams],
    );

    if (tutorialSetupData) {
        return (
            <>
                {children({
                    numPlayers: tutorialSetupData.numPlayers,
                    setupSelections: tutorialSetupData.setupSelections,
                    setupData: tutorialSetupData.setupData,
                })}
            </>
        );
    }

    if (hasCompletePregameSelections(routeSelections)) {
        return (
            <>
                {children({
                    numPlayers: resolvedPlayerCount,
                    setupSelections: routeSelections,
                    setupData: buildLocalMatchSetupData(routeSelections),
                })}
            </>
        );
    }

    const handleScenarioChange = (value: string) => {
        setDraftSelections((current) => applyQidahenPregameChoiceDefaults({
            ...current,
            [QIDAHEN_SCENARIO_SETUP_FIELD]: value,
        }));
    };

    const handlePregameFieldChange = (fieldKey: string, value: string) => {
        setDraftSelections((current) => ({
            ...current,
            [fieldKey]: value,
        }));
    };

    const handleConfirm = () => {
        const nextSelections = applyQidahenPregameChoiceDefaults(draftSelections);
        const nextScenarioId = readQidahenScenarioId(nextSelections as Record<string, unknown>);
        const nextPlayerCount = resolvePregamePlayerCount(searchParams, nextScenarioId);
        const nextSearchParams = new URLSearchParams(searchParams);

        nextSearchParams.set(`setup.${QIDAHEN_SCENARIO_SETUP_FIELD}`, nextScenarioId);
        nextSearchParams.set('players', String(nextPlayerCount));
        for (const field of QIDAHEN_PREGAME_CHOICE_FIELDS) {
            nextSearchParams.delete(`setup.${field.key}`);
        }
        for (const field of getQidahenPregameChoiceFields(nextScenarioId)) {
            const nextValue = nextSelections[field.key];
            if (isValidPregameChoiceValue(field, nextValue)) {
                nextSearchParams.set(`setup.${field.key}`, nextValue);
            }
        }

        onSearchParamsChange(nextSearchParams);
    };

    return (
        <div
            className="relative flex h-full w-full items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,rgba(116,84,48,0.32),transparent_42%),linear-gradient(180deg,#120d08_0%,#1a130d_45%,#0f0a06_100%)] px-6 py-10 text-[#f1dfb2]"
            data-testid="qidahen-scenario-pregame-screen"
        >
            <div className="w-full max-w-[860px] rounded-[28px] border border-[#9f7d42]/45 bg-[linear-gradient(180deg,rgba(47,32,20,0.96)_0%,rgba(22,15,10,0.98)_100%)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] md:p-8">
                <div className="flex flex-col gap-3 border-b border-[#9f7d42]/28 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#d2b775]">
                            {t('setup.pregameGate.eyebrow', { defaultValue: '剧本前置页' })}
                        </div>
                        <h1 className="mt-2 text-2xl font-black text-[#f6ead0] md:text-[30px]">
                            {t('setup.pregameGate.title', { defaultValue: '先确认当前剧本的开局人物与军备' })}
                        </h1>
                        <p className="mt-2 max-w-[620px] text-sm leading-6 text-[#d9c9a6]">
                            {t('setup.pregameGate.description', { defaultValue: '正式棋盘只保留紧凑剧本摘要。这里确认完本局剧本后，再进入地图主视图。' })}
                        </p>
                    </div>
                    <div
                        className="inline-flex rounded-full border border-[#d2b775]/28 bg-[#120d08]/55 px-4 py-2 text-xs font-black tracking-[0.12em] text-[#f1dfb2]"
                        data-testid="qidahen-scenario-pregame-player-count"
                    >
                        {t('setup.pregameGate.playerCount', {
                            defaultValue: '{{count}} 人剧本',
                            count: resolvePregamePlayerCount(searchParams, draftScenarioId),
                        })}
                    </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
                    <section className="space-y-5">
                        <div className="rounded-[22px] border border-[#9f7d42]/28 bg-[#1a130d]/78 p-4">
                            <label
                                className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#d2b775]"
                                htmlFor="qidahen-pregame-scenario"
                            >
                                {t('setup.scenario.label')}
                            </label>
                            <select
                                id="qidahen-pregame-scenario"
                                className="w-full rounded-2xl border border-[#9f7d42]/35 bg-[#24180f] px-4 py-3 text-sm font-bold text-[#f7ecd2] outline-none transition focus:border-[#d2b775]"
                                data-testid="qidahen-pregame-scenario-select"
                                value={draftScenarioId}
                                onChange={(event) => handleScenarioChange(event.target.value)}
                            >
                                {QIDAHEN_SCENARIO_SETUP_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {t(option.labelKey.replace('games.qidahen.', ''), { defaultValue: option.value })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activePregameFields.length > 0 ? (
                            <div
                                className="space-y-4 rounded-[22px] border border-[#9f7d42]/28 bg-[#1a130d]/78 p-4"
                                data-testid="qidahen-pregame-choice-fields"
                            >
                                {activePregameFields.map((field) => (
                                    <div key={field.key}>
                                        <label
                                            className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#d2b775]"
                                            htmlFor={`qidahen-pregame-choice-${field.key}`}
                                        >
                                            {t(field.field.labelKey.replace('games.qidahen.', ''), { defaultValue: field.key })}
                                        </label>
                                        <select
                                            id={`qidahen-pregame-choice-${field.key}`}
                                            className="w-full rounded-2xl border border-[#9f7d42]/35 bg-[#24180f] px-4 py-3 text-sm font-bold text-[#f7ecd2] outline-none transition focus:border-[#d2b775]"
                                            data-testid={`qidahen-pregame-choice-${field.key}`}
                                            value={typeof draftSelections[field.key] === 'string' ? draftSelections[field.key] as string : ''}
                                            onChange={(event) => handlePregameFieldChange(field.key, event.target.value)}
                                        >
                                            {field.field.options?.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {t(option.labelKey.replace('games.qidahen.', ''), { defaultValue: option.value })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    <aside className="rounded-[22px] border border-[#9f7d42]/28 bg-[linear-gradient(180deg,rgba(43,30,19,0.92)_0%,rgba(18,13,8,0.98)_100%)] p-5">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-[#d2b775]">
                            {t('setup.pregameGate.summaryTitle', { defaultValue: '本局将带入以下配置' })}
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#d2b775]/20 bg-[#120d08]/50 px-4 py-3">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c8ae72]">
                                {t('setup.pregameGate.summaryScenario', { defaultValue: '剧本' })}
                            </div>
                            <div className="mt-1 text-base font-black text-[#f6ead0]" data-testid="qidahen-pregame-summary-scenario">
                                {resolveScenarioLabel(draftScenarioId, t)}
                            </div>
                        </div>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-[#dfcfad]">
                            {activePregameFields.length > 0 ? activePregameFields.map((field) => (
                                <div key={field.key} className="rounded-2xl border border-[#9f7d42]/18 bg-[#120d08]/45 px-4 py-3">
                                    <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#d2b775]">
                                        {t(field.field.labelKey.replace('games.qidahen.', ''), { defaultValue: field.key })}
                                    </div>
                                    <div className="mt-1 font-bold text-[#f7ecd2]">
                                        {t(
                                            field.field.options?.find((option) => option.value === draftSelections[field.key])?.labelKey.replace('games.qidahen.', '')
                                                ?? '',
                                            { defaultValue: String(draftSelections[field.key] ?? '') },
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-2xl border border-[#9f7d42]/18 bg-[#120d08]/45 px-4 py-3">
                                    {t('setup.pregameGate.noExtraChoices', { defaultValue: '这个剧本没有额外前置选择，确认后可直接进入棋盘。' })}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="mt-6 w-full rounded-2xl border border-[#d2b775]/45 bg-[linear-gradient(180deg,#d4bb84_0%,#9f7d42_100%)] px-5 py-3 text-sm font-black text-[#21160d] transition hover:brightness-105"
                            data-testid="qidahen-pregame-confirm"
                            onClick={handleConfirm}
                        >
                            {t('setup.pregameGate.confirm', { defaultValue: '确认并进入棋盘' })}
                        </button>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default QidahenPregameScenarioGate;
