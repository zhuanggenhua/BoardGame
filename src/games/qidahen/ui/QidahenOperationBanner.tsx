import React from 'react';
import { useTranslation } from 'react-i18next';
import { QIDAHEN_DISCARD_HAND_PROMPT } from './operationPrompt';

const BANNER_SKIN = {
    borderColor: '#20150d',
    background: [
        'linear-gradient(180deg, rgba(142,53,38,0.9) 0%, rgba(69,32,22,0.88) 100%)',
        'radial-gradient(circle at 15% 12%, rgba(238,198,127,0.18), transparent 38%)',
    ].join(', '),
    color: '#ead7a7',
    boxShadow: '0 2px 0 rgba(7,5,3,0.7), 0 10px 18px rgba(22,14,8,0.32), inset 0 0 0 1px rgba(232,200,133,0.2)',
} as const;

export const QidahenOperationBanner: React.FC<{
    title: string;
}> = ({ title }) => {
    const { t } = useTranslation('game-qidahen');
    const text = title === QIDAHEN_DISCARD_HAND_PROMPT
        ? t('board.operation.discardHand', { defaultValue: QIDAHEN_DISCARD_HAND_PROMPT })
        : title;

    return (
        <div
            className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
            data-testid="qidahen-operation-banner"
            style={{
                top: 'calc(82px + var(--qidahen-mobile-top-inset, 0px))',
            }}
        >
            <div
                className="border-[3px] px-5 py-2 text-[16px] font-black leading-6 tracking-[0.04em]"
                style={{
                    borderColor: BANNER_SKIN.borderColor,
                    background: BANNER_SKIN.background,
                    color: BANNER_SKIN.color,
                    boxShadow: BANNER_SKIN.boxShadow,
                    borderRadius: 3,
                    textShadow: '0 1px 0 rgba(0,0,0,0.45)',
                }}
            >
                {text}
            </div>
        </div>
    );
};
