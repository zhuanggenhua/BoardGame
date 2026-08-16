import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { CompareRollChoiceData } from '../../../engine/systems/InteractionSystem';
import { GameButton } from './components/GameButton';

interface CompareRollOverlayProps {
    compareRoll?: CompareRollChoiceData & { id: string; playerId: string };
    isVisible: boolean;
    canResolve?: boolean;
    locale?: string;
    onResolveOption: (optionId: string) => void;
    onConfirm: () => void;
}

const RESULT_TONE_CLASS: Record<NonNullable<CompareRollChoiceData['resultTone']>, string> = {
    neutral: 'border-white/20 text-white',
    success: 'border-emerald-300/40 text-emerald-100',
    warning: 'border-amber-300/40 text-amber-100',
    danger: 'border-rose-300/40 text-rose-100',
};

export const CompareRollOverlay: React.FC<CompareRollOverlayProps> = ({
    compareRoll,
    isVisible,
    canResolve = true,
    onResolveOption,
    onConfirm,
}) => {
    const { t, i18n } = useTranslation('game-dicethrone');
    const hasTranslation = React.useCallback((key?: string) => {
        return Boolean(key && i18n.exists(key, { ns: 'game-dicethrone' }));
    }, [i18n]);
    const onConfirmRef = React.useRef(onConfirm);

    React.useEffect(() => {
        onConfirmRef.current = onConfirm;
    }, [onConfirm]);

    const options = compareRoll?.options ?? [];
    const hasOptions = options.length > 0;
    const contestants = compareRoll?.contestants ?? [];
    const compareRollId = compareRoll?.id ?? null;
    const autoConfirmDelayMs = compareRoll?.autoConfirmDelayMs ?? 3000;

    React.useEffect(() => {
        if (!canResolve || !isVisible || !compareRollId || hasOptions) return;

        const timer = window.setTimeout(() => {
            onConfirmRef.current();
        }, autoConfirmDelayMs);
        return () => window.clearTimeout(timer);
    }, [autoConfirmDelayMs, canResolve, compareRollId, hasOptions, isVisible]);

    if (!isVisible || !compareRoll || contestants.length !== 2) {
        return null;
    }

    const resultText = hasTranslation(compareRoll.resultTextKey)
        ? t(compareRoll.resultTextKey, compareRoll.resultTextParams)
        : compareRoll.resultText;
    const resultTone = compareRoll.resultTone ?? 'neutral';

    return (
        <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="pointer-events-auto w-[13.4vw] rounded-[0.7vw] border border-amber-400/35 bg-slate-950/92 px-[0.7vw] py-[0.65vw] text-center shadow-lg shadow-black/35 backdrop-blur-sm"
            data-testid="compare-roll-overlay"
            data-placement="right-dice-panel"
        >
            <div className="text-[0.82vw] font-black leading-tight tracking-wide text-amber-100">
                {hasTranslation(compareRoll.title)
                    ? t(compareRoll.title)
                    : compareRoll.title}
            </div>

            <div className="mt-[0.45vw] grid grid-cols-2 gap-[0.35vw]">
                {contestants.map((contestant, index) => {
                    const label = hasTranslation(contestant.labelKey)
                        ? t(contestant.labelKey, contestant.labelParams)
                        : contestant.label;

                    return (
                        <div
                            key={`${compareRoll.id}-${contestant.playerId ?? index}`}
                            className="min-w-0 rounded-[0.45vw] border border-white/10 bg-white/10 px-[0.35vw] py-[0.3vw]"
                            data-testid={`compare-roll-participant-${index}`}
                        >
                            <div className="truncate text-[0.58vw] font-bold uppercase leading-tight tracking-wide text-white/75">
                                {label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {resultText ? (
                <div
                    className={`mt-[0.5vw] rounded-[0.5vw] border bg-black/35 px-[0.45vw] py-[0.45vw] text-[0.72vw] font-bold leading-snug ${RESULT_TONE_CLASS[resultTone]}`}
                    data-testid="compare-roll-result"
                >
                    {resultText}
                </div>
            ) : null}

            {hasOptions && canResolve ? (
                <div className="mt-[0.55vw] flex flex-col gap-[0.35vw]">
                    {options.map((option) => {
                        const label = hasTranslation(option.labelKey)
                            ? t(option.labelKey, option.labelParams)
                            : option.label;
                        return (
                            <GameButton
                                key={option.id}
                                onClick={() => onResolveOption(option.id)}
                                disabled={option.disabled}
                                variant="primary"
                                size="sm"
                                className="!h-[1.9vw] !min-h-0 !rounded-[0.45vw] !px-[0.45vw] !py-0 !text-[0.62vw]"
                            >
                                {label}
                            </GameButton>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="mt-[0.45vw] text-[0.66vw] font-semibold leading-tight text-white/65"
                    data-testid={hasOptions ? 'compare-roll-waiting' : 'compare-roll-autoconfirm'}
                >
                    {hasOptions && !canResolve
                        ? t('compareRoll.waitingForOwnerChoice')
                        : t('compareRoll.confirming')}
                </div>
            )}
        </motion.div>
    );
};

export default CompareRollOverlay;
