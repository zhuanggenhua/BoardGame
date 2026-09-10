import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { CompareRollChoiceData } from '../../../engine/systems/InteractionSystem';
import { GameButton } from './components/GameButton';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

const dtUnit = buildBoardShellInlineUnitValue;

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
    const compareRollId = compareRoll?.id ?? null;
    const autoConfirmDelayMs = compareRoll?.autoConfirmDelayMs ?? 3000;

    React.useEffect(() => {
        if (!canResolve || !isVisible || !compareRollId || hasOptions) return;

        const timer = window.setTimeout(() => {
            onConfirmRef.current();
        }, autoConfirmDelayMs);
        return () => window.clearTimeout(timer);
    }, [autoConfirmDelayMs, canResolve, compareRollId, hasOptions, isVisible]);

    if (!isVisible || !compareRoll) {
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
            className="pointer-events-auto max-w-[30rem] border border-amber-400/35 bg-slate-950/94 text-center shadow-2xl shadow-black/45 backdrop-blur-sm"
            data-testid="compare-roll-overlay"
            data-placement="main-result-layer"
            style={{
                width: dtUnit(24),
                borderRadius: dtUnit(0.8),
                paddingInline: dtUnit(1.1),
                paddingBlock: dtUnit(0.95),
            }}
        >
            <div className="font-black leading-tight tracking-wide text-amber-100" style={{ fontSize: dtUnit(1) }}>
                {hasTranslation(compareRoll.title)
                    ? t(compareRoll.title)
                    : compareRoll.title}
            </div>

            {resultText ? (
                <div
                    className={`border bg-black/35 font-bold leading-snug ${RESULT_TONE_CLASS[resultTone]}`}
                    data-testid="compare-roll-result"
                    style={{
                        marginTop: dtUnit(0.65),
                        borderRadius: dtUnit(0.55),
                        paddingInline: dtUnit(0.7),
                        paddingBlock: dtUnit(0.55),
                        fontSize: dtUnit(0.85),
                    }}
                >
                    {resultText}
                </div>
            ) : null}

            {hasOptions && canResolve ? (
                <div
                    className="grid grid-cols-2"
                    style={{ marginTop: dtUnit(0.7), gap: dtUnit(0.45) }}
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
                                size="sm"
                                className="!min-h-0 !py-0"
                                style={{
                                    height: dtUnit(2.25),
                                    borderRadius: dtUnit(0.5),
                                    paddingInline: dtUnit(0.55),
                                    fontSize: dtUnit(0.72),
                                }}
                            >
                                {label}
                            </GameButton>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="font-semibold leading-tight text-white/65"
                    data-testid={hasOptions ? 'compare-roll-waiting' : 'compare-roll-autoconfirm'}
                    style={{ marginTop: dtUnit(0.55), fontSize: dtUnit(0.75) }}
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
