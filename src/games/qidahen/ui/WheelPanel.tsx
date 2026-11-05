import React from 'react';
import type { QidahenWheelMoveChoice } from '../domain';
import { useTranslation } from 'react-i18next';
import {
    WHEEL_SECTORS,
    WHEEL_SECTOR_COPY_DEFAULTS,
    WHEEL_CENTER,
    WHEEL_OUTER_RADIUS,
    WHEEL_VIEW,
    WHEEL_LABEL_RADIUS,
    WHEEL_INNER_RADIUS,
    ASSETS,
} from './boardLayout';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { QidahenHoverTip, QidahenHoverTipBody } from './QidahenHoverTip';

export const polarToPoint = (center: number, radius: number, angleDeg: number) => {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: center + Math.cos(radians) * radius,
        y: center + Math.sin(radians) * radius,
    };
};

export const renderQidahenWheelVerticalText = (
    text: string,
    x: number,
    y: number,
    options: {
        className: string;
        fontSize: number;
        fontWeight: number;
    },
) => {
    const chars = Array.from(text);
    const lineHeight = options.fontSize * 1.12;
    const top = y - ((chars.length - 1) * lineHeight) / 2;

    return (
        <text
            x={x}
            y={top}
            textAnchor="middle"
            dominantBaseline="middle"
            className={options.className}
            style={{
                fontFamily: 'KaiTi, STKaiti, Songti SC, serif',
                fontSize: `${options.fontSize}px`,
                fontWeight: options.fontWeight,
                letterSpacing: 0,
            }}
        >
            {chars.map((char, index) => (
                <tspan key={`${text}-${index}-${char}`} x={x} y={top + index * lineHeight}>
                    {char}
                </tspan>
            ))}
        </text>
    );
};

export const describeAnnularSlice = (
    center: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
) => {
    const outerStart = polarToPoint(center, outerRadius, startAngle);
    const outerEnd = polarToPoint(center, outerRadius, endAngle);
    const innerEnd = polarToPoint(center, innerRadius, endAngle);
    const innerStart = polarToPoint(center, innerRadius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
        `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        'Z',
    ].join(' ');
};

export const WheelPanel: React.FC<{
    selectedId: string;
    selectedMoveId: string;
    moveChoices: QidahenWheelMoveChoice[];
    moveSummary: string;
    disabled: boolean;
    emphasized?: boolean;
    primaryMoveId?: string | null;
    directExecuteOnClick?: boolean;
    onSelectMove: (moveId: string) => void;
    onExecuteMove: (moveId: string) => void;
}> = ({
    selectedId,
    selectedMoveId,
    moveChoices,
    moveSummary: _moveSummary,
    disabled,
    emphasized = false,
    primaryMoveId = null,
    directExecuteOnClick = false,
    onSelectMove,
    onExecuteMove,
}) => {
    const { t } = useTranslation('game-qidahen');
    const [activeMoveId, setActiveMoveId] = React.useState(selectedMoveId);
    const [wheelHover, setWheelHover] = React.useState<{
        sectorId: (typeof WHEEL_SECTORS)[number]['id'];
        moveId: string | null;
        anchor: Element;
    } | null>(null);
    const selectedIndex = Math.max(
        0,
        WHEEL_SECTORS.findIndex((sector) => sector.id === selectedId),
    );
    const selectedAngle = WHEEL_SECTORS[selectedIndex]?.angle ?? -90;
    // Formal wheel legality is already represented by moveChoices and the
    // domain command validator. Tutorial guidance may recommend a move, but
    // it must not shrink the set of formally legal wheel choices.
    const activatableMoveChoices = moveChoices;
    const activeMove =
        activatableMoveChoices.find((choice) => choice.id === activeMoveId) ??
        activatableMoveChoices.find((choice) => choice.id === selectedMoveId) ??
        activatableMoveChoices[0];
    const activeMoveTargetIndex = activeMove
        ? (selectedIndex + activeMove.steps) % WHEEL_SECTORS.length
        : selectedIndex;
    const hoveredSector = wheelHover
        ? (WHEEL_SECTORS.find((sector) => sector.id === wheelHover.sectorId) ?? null)
        : null;
    const hoveredMove = wheelHover?.moveId
        ? (activatableMoveChoices.find((choice) => choice.id === wheelHover.moveId) ?? null)
        : null;
    const hoveredSectorCopy = hoveredSector ? WHEEL_SECTOR_COPY_DEFAULTS[hoveredSector.actionKey] : null;
    const moveTargetIndices = new Set(
        activatableMoveChoices.map((choice) => (selectedIndex + choice.steps) % WHEEL_SECTORS.length),
    );
    const primaryMove = primaryMoveId
        ? (activatableMoveChoices.find((choice) => choice.id === primaryMoveId) ?? null)
        : null;
    const primaryMoveTargetIndex = primaryMove ? (selectedIndex + primaryMove.steps) % WHEEL_SECTORS.length : null;
    const currentMarkerPoint = polarToPoint(WHEEL_CENTER, WHEEL_OUTER_RADIUS - 18, selectedAngle);

    React.useEffect(() => {
        setActiveMoveId(selectedMoveId);
    }, [selectedMoveId]);

    const getMoveTargetAngle = (steps: number) => {
        const targetIndex = (selectedIndex + steps) % WHEEL_SECTORS.length;
        return WHEEL_SECTORS[targetIndex]?.angle ?? selectedAngle;
    };

    const selectedMove = moveChoices.find((choice) => choice.id === selectedMoveId);
    const showCommittedMoveSelection = !directExecuteOnClick && selectedMove != null;
    const selectedMoveTargetIndex =
        showCommittedMoveSelection && selectedMove
            ? (selectedIndex + selectedMove.steps) % WHEEL_SECTORS.length
            : selectedIndex;
    const sectorRenderOrder = WHEEL_SECTORS.map((sector, index) => ({ sector, index })).sort((a, b) => {
        if (a.index === selectedMoveTargetIndex) return 1;
        if (b.index === selectedMoveTargetIndex) return -1;
        return a.index - b.index;
    });

    return (
        <div
            className="pointer-events-none group absolute left-[136px] top-[-16px] z-30 h-[438px] w-[438px]"
            data-testid="qidahen-action-wheel"
            data-tutorial-id="qidahen-action-wheel"
            data-wheel-emphasized={emphasized ? 'true' : 'false'}
            data-ui-anchor="left-top"
            style={{
                left: 'calc(136px - var(--qidahen-mobile-edge-pull, 0px))',
                top: 'calc(-16px + var(--qidahen-mobile-top-inset, 0px))',
            }}
        >
            <div
                className="relative h-full w-full"
                role="img"
                aria-label={t('board.wheel.aria', { defaultValue: '七大恨行动轮盘' })}
                data-testid="qidahen-action-wheel-asset"
            >
                <svg
                    viewBox={`0 0 ${WHEEL_VIEW} ${WHEEL_VIEW}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    <defs>
                        <filter id="qidahen-wheel-current" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1.4" stdDeviation="0.9" floodColor="rgba(72,54,31,0.18)" />
                        </filter>
                        <filter id="qidahen-wheel-selected" x="-24%" y="-24%" width="148%" height="148%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.8" floodColor="rgba(255,218,126,0.42)" />
                            <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="rgba(127,29,22,0.3)" />
                        </filter>
                        <filter id="qidahen-wheel-grain" x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="21" />
                            <feColorMatrix type="saturate" values="0" />
                            <feComponentTransfer>
                                <feFuncA type="table" tableValues="0 0.14" />
                            </feComponentTransfer>
                        </filter>
                        <radialGradient id="qidahen-wheel-paper" cx="47%" cy="42%" r="58%">
                            <stop offset="0%" stopColor="#a28c58" />
                            <stop offset="62%" stopColor="#7d755d" />
                            <stop offset="100%" stopColor="#5b5442" />
                        </radialGradient>
                        <radialGradient id="qidahen-wheel-center-paper" cx="47%" cy="38%" r="62%">
                            <stop offset="0%" stopColor="#af9052" />
                            <stop offset="100%" stopColor="#99793f" />
                        </radialGradient>
                        <clipPath id="qidahen-wheel-face-clip">
                            <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 7} />
                        </clipPath>
                    </defs>
                    <circle
                        cx={WHEEL_CENTER}
                        cy={WHEEL_CENTER}
                        r={WHEEL_OUTER_RADIUS - 4}
                        fill="url(#qidahen-wheel-paper)"
                        stroke="#1f160f"
                        strokeWidth="6"
                    />
                    <circle
                        cx={WHEEL_CENTER}
                        cy={WHEEL_CENTER}
                        r={WHEEL_OUTER_RADIUS - 8}
                        clipPath="url(#qidahen-wheel-face-clip)"
                        filter="url(#qidahen-wheel-grain)"
                        opacity="0.82"
                        style={{ mixBlendMode: 'multiply' }}
                    />
                    {sectorRenderOrder.map(({ sector, index }) => {
                        const current = index === selectedIndex;
                        const candidateTarget = moveTargetIndices.has(index);
                        const primaryTarget = primaryMoveTargetIndex === index;
                        const secondaryCandidate =
                            candidateTarget && emphasized && primaryMove != null && !primaryTarget;
                        const selectedTarget = showCommittedMoveSelection ? index === selectedMoveTargetIndex : false;
                        const activeTarget = index === activeMoveTargetIndex;
                        const labelPoint = polarToPoint(WHEEL_CENTER, WHEEL_LABEL_RADIUS, sector.angle);
                        const labelClassName = primaryTarget
                            ? 'fill-[#f5f2df]'
                            : secondaryCandidate
                              ? 'fill-[rgba(225,242,218,0.72)]'
                              : candidateTarget && emphasized
                                ? 'fill-[#f5f2df]'
                                : 'fill-[#241b14]';
                        const labelFontSize = primaryTarget || selectedTarget || activeTarget ? 13 : 12;
                        const labelFontWeight =
                            primaryTarget || (candidateTarget && emphasized && primaryMove == null) ? 900 : 650;
                        return (
                            <g
                                key={sector.id}
                                data-testid="qidahen-wheel-sector"
                                data-wheel-sector-id={sector.id}
                                data-wheel-candidate={candidateTarget ? 'true' : undefined}
                                data-wheel-primary={primaryTarget ? 'true' : undefined}
                                data-wheel-candidate-level={
                                    secondaryCandidate ? 'secondary' : primaryTarget ? 'primary' : undefined
                                }
                                data-wheel-selected={selectedTarget ? 'true' : undefined}
                                filter={
                                    selectedTarget
                                        ? 'url(#qidahen-wheel-selected)'
                                        : current
                                          ? 'url(#qidahen-wheel-current)'
                                          : undefined
                                }
                            >
                                <path
                                    d={describeAnnularSlice(
                                        WHEEL_CENTER,
                                        WHEEL_INNER_RADIUS,
                                        WHEEL_OUTER_RADIUS - 16,
                                        sector.angle - 22.5,
                                        sector.angle + 22.5,
                                    )}
                                    fill={
                                        selectedTarget
                                            ? 'rgba(168,41,31,0.72)'
                                            : primaryTarget
                                              ? activeTarget
                                                  ? 'rgba(78, 156, 83, 0.72)'
                                                  : 'rgba(53, 124, 65, 0.58)'
                                              : secondaryCandidate
                                                ? activeTarget
                                                    ? 'rgba(78, 156, 83, 0.24)'
                                                    : 'rgba(53, 124, 65, 0.14)'
                                                : candidateTarget && emphasized
                                                  ? activeTarget
                                                      ? 'rgba(78, 156, 83, 0.52)'
                                                      : 'rgba(53, 124, 65, 0.42)'
                                                  : current
                                                    ? 'rgba(182,145,76,0.18)'
                                                    : index % 2 === 0
                                                      ? 'rgba(54,52,43,0.18)'
                                                      : 'rgba(105,93,68,0.14)'
                                    }
                                    stroke={
                                        selectedTarget
                                            ? 'rgba(246,214,149,0.98)'
                                            : primaryTarget
                                              ? activeTarget
                                                  ? 'rgba(241, 255, 208, 1)'
                                                  : 'rgba(216, 255, 190, 0.98)'
                                              : secondaryCandidate
                                                ? activeTarget
                                                    ? 'rgba(181, 236, 180, 0.62)'
                                                    : 'rgba(140, 230, 153, 0.34)'
                                                : candidateTarget && emphasized
                                                  ? activeTarget
                                                      ? 'rgba(241, 255, 208, 0.98)'
                                                      : 'rgba(140, 230, 153, 0.94)'
                                                  : 'rgba(32,23,15,0.56)'
                                    }
                                    strokeWidth={
                                        selectedTarget
                                            ? 4
                                            : primaryTarget
                                              ? activeTarget
                                                  ? 4.5
                                                  : 4
                                              : secondaryCandidate
                                                ? activeTarget
                                                    ? 2
                                                    : 1.2
                                                : candidateTarget && emphasized
                                                  ? activeTarget
                                                      ? 4
                                                      : 3
                                                  : 0.9
                                    }
                                    strokeLinejoin="round"
                                />
                                {renderQidahenWheelVerticalText(sector.label[0], labelPoint.x - 9, labelPoint.y, {
                                    className: labelClassName,
                                    fontSize: labelFontSize,
                                    fontWeight: labelFontWeight,
                                })}
                                {renderQidahenWheelVerticalText(sector.label[1], labelPoint.x + 10, labelPoint.y, {
                                    className: labelClassName,
                                    fontSize: labelFontSize,
                                    fontWeight: labelFontWeight,
                                })}
                            </g>
                        );
                    })}
                    <text
                        x={WHEEL_CENTER}
                        y="24"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        {t('board.wheel.newYear', { defaultValue: '新年 >>>' })}
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_VIEW - 20}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        {t('board.wheel.midyear', { defaultValue: '年中' })}
                    </text>
                    <circle
                        cx={WHEEL_CENTER}
                        cy={WHEEL_CENTER}
                        r={WHEEL_INNER_RADIUS - 6}
                        fill="url(#qidahen-wheel-center-paper)"
                        stroke="#24190f"
                        strokeWidth="2"
                    />
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - 32}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerTop', { defaultValue: '行' })}
                    </text>
                    <text
                        x={WHEEL_CENTER + 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerRight', { defaultValue: '轮' })}
                    </text>
                    <text
                        x={WHEEL_CENTER - 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerLeft', { defaultValue: '盘' })}
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER + 34}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerBottom', { defaultValue: '动' })}
                    </text>
                    <g data-testid="qidahen-wheel-sector-hit-layer">
                        {WHEEL_SECTORS.map((sector) => (
                            <path
                                key={`hit-${sector.id}`}
                                data-testid={`qidahen-wheel-sector-hit-${sector.id}`}
                                d={describeAnnularSlice(
                                    WHEEL_CENTER,
                                    WHEEL_INNER_RADIUS,
                                    WHEEL_OUTER_RADIUS - 16,
                                    sector.angle - 22.5,
                                    sector.angle + 22.5,
                                )}
                                fill="rgba(255,248,233,0.001)"
                                stroke="transparent"
                                strokeWidth="1"
                                className="pointer-events-auto cursor-help outline-none"
                                aria-label={t(`board.wheel.sectors.${sector.actionKey}.name`, {
                                    defaultValue: WHEEL_SECTOR_COPY_DEFAULTS[sector.actionKey].name,
                                })}
                                onMouseEnter={(event) => {
                                    setWheelHover({
                                        sectorId: sector.id,
                                        moveId: null,
                                        anchor: event.currentTarget,
                                    });
                                }}
                                onMouseLeave={() => setWheelHover(null)}
                            />
                        ))}
                    </g>
                    <g data-testid="qidahen-wheel-move-layer">
                        {moveChoices.map((choice) => {
                            const targetAngle = getMoveTargetAngle(choice.steps);
                            const landingSector = WHEEL_SECTORS[(selectedIndex + choice.steps) % WHEEL_SECTORS.length];
                            const selected = choice.id === selectedMoveId;
                            const moveDisabled = disabled;
                            const activateMove = () => {
                                if (moveDisabled) {
                                    return;
                                }
                                if (directExecuteOnClick) {
                                    onExecuteMove(choice.id);
                                    return;
                                }
                                if (selected) {
                                    onExecuteMove(choice.id);
                                    return;
                                }
                                onSelectMove(choice.id);
                            };
                            const showMoveHover = (target: Element) => {
                                setActiveMoveId(choice.id);
                                if (!landingSector) return;
                                setWheelHover({
                                    sectorId: landingSector.id,
                                    moveId: choice.id,
                                    anchor: target,
                                });
                            };
                            const hideMoveHover = () => {
                                setActiveMoveId(selectedMoveId);
                                setWheelHover(null);
                            };
                            return (
                                <path
                                    key={choice.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={choice.label}
                                    data-testid={`qidahen-wheel-move-target-${choice.id}`}
                                    data-tutorial-id={`qidahen-wheel-move-${choice.id}`}
                                    data-wheel-primary={choice.id === primaryMoveId ? 'true' : undefined}
                                    data-wheel-candidate-level={
                                        primaryMove != null
                                            ? choice.id === primaryMoveId
                                                ? 'primary'
                                                : 'secondary'
                                            : undefined
                                    }
                                    d={describeAnnularSlice(
                                        WHEEL_CENTER,
                                        WHEEL_INNER_RADIUS - 8,
                                        WHEEL_OUTER_RADIUS - 8,
                                        targetAngle - 23.5,
                                        targetAngle + 23.5,
                                    )}
                                    fill="rgba(255,248,233,0.001)"
                                    stroke="transparent"
                                    strokeWidth="1"
                                    className={`pointer-events-auto outline-none transition-[fill,stroke] ${moveDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    aria-disabled={moveDisabled}
                                    onClick={activateMove}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            activateMove();
                                        }
                                    }}
                                    onFocus={(event) => showMoveHover(event.currentTarget)}
                                    onMouseEnter={(event) => showMoveHover(event.currentTarget)}
                                    onBlur={hideMoveHover}
                                    onMouseLeave={hideMoveHover}
                                />
                            );
                        })}
                    </g>
                </svg>
                <div
                    className="pointer-events-none absolute z-10 h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
                    data-testid="qidahen-wheel-current-marker"
                    data-wheel-current-position={selectedId}
                    style={{
                        left: `${(currentMarkerPoint.x / WHEEL_VIEW) * 100}%`,
                        top: `${(currentMarkerPoint.y / WHEEL_VIEW) * 100}%`,
                        filter: 'drop-shadow(0 2px 3px rgba(31, 22, 15, 0.72))',
                    }}
                >
                    <OptimizedImage
                        src={ASSETS.wheelMarker}
                        alt={t('board.wheel.currentMarker', { defaultValue: '轮盘行动标记当前位置' })}
                        className="h-full w-full scale-[1.08] object-cover"
                        draggable={false}
                        placeholder={false}
                    />
                </div>
            </div>

            {hoveredSector && hoveredSectorCopy ? (
                <QidahenHoverTip open anchor={wheelHover?.anchor ?? null} placement="right" testId="qidahen-wheel-tip">
                    <QidahenHoverTipBody
                        header={t('board.actions.tooltipHeader', { defaultValue: '功能说明' })}
                        cost={hoveredMove?.label ?? null}
                        title={t(`board.wheel.sectors.${hoveredSector.actionKey}.name`, {
                            defaultValue: hoveredSectorCopy.name,
                        })}
                        detail={t(`board.wheel.sectors.${hoveredSector.actionKey}.detail`, {
                            defaultValue: hoveredSectorCopy.detail,
                        })}
                    />
                </QidahenHoverTip>
            ) : null}
        </div>
    );
};
