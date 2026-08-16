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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto w-[24vw] max-w-[30rem] rounded-[0.8vw] border border-amber-400/35 bg-slate-950/94 px-[1.1vw] py-[0.95vw] text-center shadow-2xl shadow-black/45 backdrop-blur-sm"
            data-testid="compare-roll-overlay"
            data-placement="main-result-layer"
        >
            <div className="text-[1vw] font-black leading-tight tracking-wide text-amber-100">
                {hasTranslation(compareRoll.title)
                    ? t(compareRoll.title)
                    : compareRoll.title}
            </div>

            <div className="mt-[0.6vw] grid grid-cols-2 gap-[0.55vw]">
                {contestants.map((contestant, index) => {
                    const label = hasTranslation(contestant.labelKey)
                        ? t(contestant.labelKey, contestant.labelParams)
                        : contestant.label;

                    return (
                        <div
                            key={`${compareRoll.id}-${contestant.playerId ?? index}`}
                            className="min-w-0 rounded-[0.55vw] border border-white/10 bg-white/10 px-[0.55vw] py-[0.45vw]"
                            data-testid={`compare-roll-participant-${index}`}
                        >
                            <div className="truncate text-[0.7vw] font-bold uppercase leading-tight tracking-wide text-white/75">
                                {label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {resultText ? (
                <div
                    className={`mt-[0.65vw] rounded-[0.55vw] border bg-black/35 px-[0.7vw] py-[0.55vw] text-[0.85vw] font-bold leading-snug ${RESULT_TONE_CLASS[resultTone]}`}
                    data-testid="compare-roll-result"
                >
                    {resultText}
                </div>
            ) : null}

            {hasOptions && canResolve ? (
                <div className="mt-[0.7vw] grid grid-cols-2 gap-[0.45vw]">
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
                                className="!h-[2.25vw] !min-h-0 !rounded-[0.5vw] !px-[0.55vw] !py-0 !text-[0.72vw]"
                            >
                                {label}
                            </GameButton>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="mt-[0.55vw] text-[0.75vw] font-semibold leading-tight text-white/65"
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
