import { X } from 'lucide-react';
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { UI_Z_INDEX } from '../../../core';
import type { QidahenArmamentState, QidahenCore, QidahenFactionId } from '../domain/types';
import { QidahenStatReadout } from './QidahenStatReadout';
import { getQidahenArmamentInspectView, listQidahenDevelopedArmaments } from './setupCardPreviews';

const PANEL_SKIN = {
    borderColor: '#20150d',
    background: [
        'linear-gradient(180deg, rgba(56,39,24,0.96) 0%, rgba(28,20,13,0.94) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(231,197,126,0.16), transparent 36%)',
    ].join(', '),
    color: '#ead7a7',
    boxShadow: '0 2px 0 rgba(7,5,3,0.7), 0 18px 32px rgba(22,14,8,0.42), inset 0 0 0 1px rgba(232,200,133,0.2)',
    titleColor: '#f6d5a8',
    muted: '#d2b775',
} as const;

const ARMAMENT_CARD = {
    width: 132,
} as const;

const InspectCloseButton: React.FC<{ onClose: () => void; label: string }> = ({ onClose, label }) => (
    <button
        type="button"
        data-testid="qidahen-inspect-close"
        className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center"
        onClick={onClose}
        aria-label={label}
        title={label}
        style={{
            color: PANEL_SKIN.titleColor,
            background: 'rgba(12, 8, 5, 0.42)',
            borderRadius: 999,
            boxShadow: 'inset 0 0 0 1px rgba(232,200,133,0.28)',
        }}
    >
        <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
    </button>
);

const InspectArmamentCard: React.FC<{
    armament: QidahenArmamentState;
    locale?: string;
}> = ({ armament, locale }) => {
    const view = getQidahenArmamentInspectView(armament.id);

    return (
        <div
            className="relative"
            data-testid={`qidahen-inspect-armament-${armament.id}`}
            data-armament-level={armament.level}
            style={{ width: ARMAMENT_CARD.width }}
        >
            <span className="sr-only">{armament.name}</span>
            {view ? (
                <CardPreview
                    previewRef={view.previewRef}
                    locale={locale}
                    title={armament.name}
                    alt={armament.name}
                    style={{
                        width: ARMAMENT_CARD.width,
                        background: 'transparent',
                    }}
                />
            ) : (
                <div
                    className="flex items-center justify-center px-2 py-8 text-center text-[13px] font-black"
                    style={{ color: PANEL_SKIN.titleColor }}
                >
                    {armament.name}
                </div>
            )}
            {armament.level > 1 ? (
                <span
                    className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] font-black"
                    style={{
                        background: 'rgba(12, 8, 5, 0.72)',
                        color: PANEL_SKIN.titleColor,
                        borderRadius: 2,
                    }}
                >
                    Lv.{armament.level}
                </span>
            ) : null}
        </div>
    );
};

export type QidahenInspectTarget =
    | { kind: 'faction'; factionId: QidahenFactionId };

interface QidahenInspectPanelProps {
    core: QidahenCore;
    target: QidahenInspectTarget;
    locale?: string;
    onClose: () => void;
}

export const QidahenInspectPanel: React.FC<QidahenInspectPanelProps> = ({
    core,
    target,
    locale,
    onClose,
}) => {
    const { t } = useTranslation('game-qidahen');
    const portalRoot = useMemo(() => (
        typeof document === 'undefined' ? null : document.body
    ), []);

    if (!portalRoot) {
        return null;
    }

    const faction = target.kind === 'faction' ? core.factions[target.factionId] : null;
    const developedArmaments = faction ? listQidahenDevelopedArmaments(faction.armaments) : [];

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center px-6"
            data-testid="qidahen-inspect-overlay"
            style={{ zIndex: UI_Z_INDEX.modalOverlay, background: 'rgba(12, 8, 5, 0.52)' }}
            onClick={onClose}
        >
            <div
                className="relative max-h-[86vh] w-[min(720px,92vw)] overflow-hidden border-[3px] pr-16"
                data-testid="qidahen-inspect-panel"
                data-inspect-kind={target.kind}
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                style={{
                    borderColor: PANEL_SKIN.borderColor,
                    background: PANEL_SKIN.background,
                    color: PANEL_SKIN.color,
                    boxShadow: PANEL_SKIN.boxShadow,
                    borderRadius: 4,
                }}
            >
                <InspectCloseButton
                    onClose={onClose}
                    label={t('board.inspect.close', { defaultValue: '关闭' })}
                />
                <div className="max-h-[86vh] overflow-auto px-5 py-4">
                {faction ? (
                    <div data-testid={`qidahen-inspect-faction-${faction.id}`}>
                        <div>
                            <div className="text-[12px] font-black tracking-[0.14em]" style={{ color: PANEL_SKIN.muted }}>
                                {t('board.inspect.factionHeader', { defaultValue: '势力详情' })}
                            </div>
                            <div className="mt-1 text-[22px] font-black" style={{ color: PANEL_SKIN.titleColor }}>
                                {faction.name}
                            </div>
                        </div>
                        <div className="mt-4">
                            <QidahenStatReadout
                                testId="qidahen-inspect-faction-stats"
                                tone={{ label: PANEL_SKIN.muted, value: PANEL_SKIN.titleColor }}
                                items={[
                                    {
                                        testId: 'qidahen-inspect-stat-vp',
                                        label: t('board.inspect.statVp', { defaultValue: '胜利点' }),
                                        value: String(faction.vp),
                                    },
                                    {
                                        testId: 'qidahen-inspect-stat-hand',
                                        label: t('board.inspect.statHand', { defaultValue: '手牌' }),
                                        value: `${faction.handCount}/${faction.handLimit}`,
                                    },
                                    {
                                        testId: 'qidahen-inspect-stat-troops',
                                        label: t('board.inspect.statTroops', { defaultValue: '兵力' }),
                                        value: String(faction.troops),
                                    },
                                    {
                                        testId: 'qidahen-inspect-stat-grain',
                                        label: t('board.inspect.statGrain', { defaultValue: '粮' }),
                                        value: String(faction.grain),
                                    },
                                ]}
                            />
                        </div>
                        <section className="mt-4" data-testid={`qidahen-inspect-armaments-${faction.id}`}>
                            <div className="text-[12px] font-black tracking-[0.12em]" style={{ color: PANEL_SKIN.muted }}>
                                {t('board.inspect.armamentsTitle', { defaultValue: '军备' })}
                            </div>
                            {developedArmaments.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-3">
                                    {developedArmaments.map((armament) => (
                                        <InspectArmamentCard
                                            key={armament.id}
                                            armament={armament}
                                            locale={locale}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-2 text-[13px] font-black" style={{ color: PANEL_SKIN.muted }}>
                                    {t('board.player.armamentsUndeveloped', { defaultValue: '未开发' })}
                                </div>
                            )}
                        </section>
                        <section className="mt-4">
                            <div className="text-[12px] font-black tracking-[0.12em]" style={{ color: PANEL_SKIN.muted }}>
                                {t('board.inspect.charactersTitle', { defaultValue: '人物' })}
                            </div>
                            <div className="mt-2 text-[13px] font-black">
                                {faction.characters.filter((character) => character.inPlay).map((character) => character.name).join('、')
                                    || t('board.inspect.charactersEmpty', { defaultValue: '场上暂无人物' })}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="text-[14px] font-black">
                        {t('board.inspect.missing', { defaultValue: '当前没有可查看的详情。' })}
                    </div>
                )}
                </div>
            </div>
        </div>,
        portalRoot,
    );
};
