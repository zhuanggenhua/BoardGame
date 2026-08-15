import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { CompareRollChoiceData } from '../../../engine/systems/InteractionSystem';
import SpotlightContainer from './SpotlightContainer';
import { GameButton } from './components/GameButton';
import { UI_Z_INDEX } from '../../../core';

interface CompareRollOverlayProps {
    compareRoll?: CompareRollChoiceData & { id: string; playerId: string };
    isVisible: boolean;
    canResolve?: boolean;
    locale?: string;
    onResolveOption: (optionId: string) => void;
    onConfirm: () => void;
    usePortal?: boolean;
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
    usePortal,
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
        <SpotlightContainer
            id={compareRoll.id}
            isVisible={isVisible}
            onClose={() => undefined}
            disableAutoClose={true}
            disableBackdropClose={true}
            closeOnContentClick={false}
            blockPointerEvents={true}
            zIndex={UI_Z_INDEX.overlayRaised + 120}
            usePortal={usePortal}
        >
            <div
                className="flex flex-col items-center gap-[1.6vw] px-[1vw]"
                data-testid="compare-roll-overlay"
            >
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/60 border border-amber-400/30 rounded-xl px-[2.4vw] py-[0.9vw] shadow-lg"
                >
                    <span className="text-white text-[1.5vw] font-black tracking-wide">
                        {hasTranslation(compareRoll.title)
                            ? t(compareRoll.title)
                            : compareRoll.title}
                    </span>
                </motion.div>

                <div className="flex items-start justify-center gap-[1vw] max-w-[90vw]">
                    {contestants.map((contestant, index) => {
                        const label = hasTranslation(contestant.labelKey)
                            ? t(contestant.labelKey, contestant.labelParams)
                            : contestant.label;

                        return (
                            <motion.div
                                key={`${compareRoll.id}-${contestant.playerId ?? index}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.12 }}
                                className="rounded-xl border border-white/15 bg-black/45 px-[1.2vw] py-[0.55vw] text-center min-w-[10vw]"
                                data-testid={`compare-roll-participant-${index}`}
                            >
                                <div className="text-white/90 text-[0.95vw] font-bold tracking-[0.06em] uppercase">
                                    {label}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {resultText ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className={`max-w-[46vw] text-center text-[1.2vw] font-bold rounded-2xl px-[1.6vw] py-[0.9vw] bg-black/55 shadow-lg ${RESULT_TONE_CLASS[resultTone]}`}
                        data-testid="compare-roll-result"
                    >
                        {resultText}
                    </motion.div>
                ) : null}

                {hasOptions && canResolve ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="flex flex-wrap items-center justify-center gap-[1vw] max-w-[54vw]"
                    >
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
                                    size="md"
                                    className="!text-[1.05vw] !px-[1.6vw] !py-[0.75vw]"
                                >
                                    {label}
                                </GameButton>
                            );
                        })}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="text-white/70 text-[1vw] font-semibold tracking-wide"
                        data-testid={hasOptions ? 'compare-roll-waiting' : 'compare-roll-autoconfirm'}
                    >
                        {hasOptions && !canResolve
                            ? t('compareRoll.waitingForOwnerChoice')
                            : t('compareRoll.confirming')}
                    </motion.div>
                )}
            </div>
        </SpotlightContainer>
    );
};

export default CompareRollOverlay;
