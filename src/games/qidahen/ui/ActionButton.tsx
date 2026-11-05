import React from 'react';
import type { QidahenActionChoice } from '../domain';
import { useTranslation } from 'react-i18next';
import { UI_STYLE, UI_SURFACE } from './boardLayout';
import { QidahenHoverTip, QidahenHoverTipBody } from './QidahenHoverTip';

export const ActionButton: React.FC<{
    action: QidahenActionChoice;
    focused: boolean;
    engaged?: boolean;
    disabled?: boolean;
    onClick: () => void;
}> = ({ action, focused, engaged = false, disabled = false, onClick }) => {
    const { t } = useTranslation('game-qidahen');
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [tipOpen, setTipOpen] = React.useState(false);
    const [tipAnchor, setTipAnchor] = React.useState<Element | null>(null);
    const borderColor = engaged ? UI_STYLE.cinnabar : focused ? UI_STYLE.mapGold : UI_STYLE.mapInk;
    const background = engaged
        ? UI_SURFACE.mapOpenPanelSelected
        : focused
          ? 'linear-gradient(180deg, rgba(239,213,157,0.86) 0%, rgba(203,162,91,0.76) 100%)'
          : UI_SURFACE.mapOpenPanel;
    const accentColor = engaged ? UI_STYLE.cinnabar : 'rgba(210,183,117,0.76)';
    const glowShadow = focused && !engaged ? ', 0 0 0 2px rgba(232,200,133,0.18)' : '';
    const showTip = (target: Element) => {
        setTipAnchor(target);
        setTipOpen(true);
    };
    const hideTip = () => setTipOpen(false);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                data-testid={`qidahen-action-${action.id}`}
                data-tutorial-id={`qidahen-action-${action.id}`}
                title={action.detail}
                disabled={disabled}
                className="group relative inline-flex h-[48px] min-w-[132px] items-center justify-between gap-2 overflow-visible border-[2px] px-3.5 text-left text-[14px] font-black tracking-[0.02em] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#9f3426]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0"
                onClick={onClick}
                onMouseEnter={(event) => showTip(event.currentTarget)}
                onMouseLeave={hideTip}
                onFocus={(event) => showTip(event.currentTarget)}
                onBlur={hideTip}
                style={{
                    borderColor,
                    background,
                    color: UI_STYLE.ink,
                    boxShadow: `${UI_SURFACE.mapOpenPanelShadow}${glowShadow}`,
                    borderRadius: 9,
                }}
            >
                <span
                    className="pointer-events-none absolute inset-y-0 left-0 w-[5px]"
                    style={{ background: accentColor }}
                />
                <span
                    className="pointer-events-none absolute inset-x-[14px] top-[3px] h-[1px]"
                    style={{ background: 'rgba(232,200,133,0.3)' }}
                />
                <span className="min-w-0 whitespace-nowrap">{action.label}</span>
            </button>
            <QidahenHoverTip
                open={tipOpen}
                anchor={tipAnchor ?? buttonRef.current}
                placement="left"
                testId={`qidahen-action-tooltip-${action.id}`}
            >
                <QidahenHoverTipBody
                    header={t('board.actions.tooltipHeader', { defaultValue: '功能说明' })}
                    cost={t('board.actions.tooltipCost', {
                        cost: action.cost,
                        defaultValue: '花费 {{cost}}',
                    })}
                    title={action.label}
                    detail={action.detail}
                />
            </QidahenHoverTip>
        </>
    );
};
