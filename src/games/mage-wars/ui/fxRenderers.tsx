import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    BoardBurstImpactPreset,
    BoardDamageImpactPreset,
    BoardHealingImpactPreset,
    BoardProjectileAttackPreset,
    BoardProjectilePathPreset,
    BoardSummonEffectPreset,
} from '../../../components/common/animations/BoardFxPresets';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import {
    resolveFxQuality,
    scheduleFxFrameCallback,
    type FxAnchorSnapshot,
    type FxCellCoord,
    type FxBox,
    type FxQuality,
    type FxRendererProps,
    createFxPathBox,
} from '../../../engine/fx';
import {
    MAGE_WARS_ATTACK_FX_TUNING,
    MAGE_WARS_DIRECT_DAMAGE_FX_TUNING,
    MAGE_WARS_FX_TIMING,
    MAGE_WARS_SUMMON_FX_TUNING,
    MAGE_WARS_TRAVEL_FX_TUNING,
    mageWarsFxColors,
    resolveMageWarsSummonColor,
} from './fxTuning';

type AttackDieFaceId = 'burst' | 'hit2' | 'hit1' | 'blank';

const ATTACK_DIE_TEXTURE_SIZE = 1280;
const ATTACK_DIE_FACES: Record<AttackDieFaceId, { x: number; y: number; rotate: string }> = {
    burst: { x: 164, y: 318, rotate: '-7deg' },
    hit2: { x: 480, y: 318, rotate: '5deg' },
    hit1: { x: 480, y: 948, rotate: '-4deg' },
    blank: { x: 794, y: 318, rotate: '4deg' },
};

function getAttackDieFace(result: number): AttackDieFaceId {
    if (result >= 3) return 'burst';
    if (result === 2) return 'hit2';
    if (result === 1) return 'hit1';
    return 'blank';
}

function AttackDieResult({ result }: { result: number }) {
    const crop = ATTACK_DIE_FACES[getAttackDieFace(result)];
    const scale = ATTACK_DIE_TEXTURE_SIZE / 320;

    return (
        <span
            className="relative block h-[clamp(3rem,4vw,5rem)] w-[clamp(3rem,4vw,5rem)] shrink-0 overflow-hidden rounded-[0.18rem] bg-black/35 shadow-[0_8px_18px_rgba(0,0,0,0.52)]"
            style={{ transform: `rotate(${crop.rotate})` }}
            data-testid="mage-wars-fx-attack-die-face"
            aria-label={`攻击骰 ${result}`}
        >
            <OptimizedImage
                src="mage-wars/dice/attack-die-texture"
                alt={`攻击骰 ${result}`}
                className="absolute max-w-none select-none"
                style={{
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                    left: `${-(crop.x / 320) * 100}%`,
                    top: `${-(crop.y / 320) * 100}%`,
                }}
                placeholder={false}
            />
        </span>
    );
}

function EffectDieResult({ result }: { result: number }) {
    const { t } = useTranslation('game-mage-wars');

    return (
        <span
            className="inline-flex min-h-[2.5rem] shrink-0 items-center rounded-[0.22rem] border border-sky-100/35 bg-slate-950/72 px-2.5 text-[clamp(0.8rem,1.15vw,1rem)] font-black tracking-[0.08em] text-sky-100 shadow-[0_6px_14px_rgba(0,0,0,0.42)]"
            data-testid="mage-wars-fx-effect-die-face"
            data-visual-role="effect-die-result"
            data-die-kind="d12"
            data-asset-status="tts-native-not-embedded"
            aria-label={`效果骰 ${result}`}
            title={t('dice.effectNativeAssetNote')}
        >
            {t('dice.effectResult', { result })}
        </span>
    );
}

function AttackDiceFeedback({
    diceResults,
    effectDieResult,
    visibleDurationMs,
}: {
    diceResults: number[];
    effectDieResult?: number;
    visibleDurationMs: number;
}) {
    if (diceResults.length === 0) return null;

    const resultLayer = (
        <motion.div
            className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center"
            data-testid="mage-wars-fx-attack-dice"
            data-placement="board-center"
            data-visual-role="attack-dice-result"
            data-visible-duration-ms={visibleDurationMs}
            initial={{ opacity: 0, scale: 0.68, y: 10 }}
            animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.68, 1, 1, 1, 1.04], y: [10, 0, 0, 0, -6] }}
            transition={{ duration: visibleDurationMs / 1000, ease: 'easeOut' }}
        >
            <div className="flex max-w-[34rem] items-center justify-center gap-[clamp(0.45rem,1vw,1rem)]">
                {diceResults.slice(0, 6).map((result, index) => (
                    <AttackDieResult key={`${index}-${result}`} result={result} />
                ))}
                {effectDieResult !== undefined ? (
                    <EffectDieResult result={effectDieResult} />
                ) : null}
            </div>
        </motion.div>
    );

    return typeof document === 'undefined'
        ? resultLayer
        : createPortal(resultLayer, document.body);
}

function useStableComplete(onComplete?: () => void): () => void {
    const ref = useRef(onComplete ?? (() => undefined));
    useLayoutEffect(() => {
        ref.current = onComplete ?? (() => undefined);
    }, [onComplete]);
    return React.useCallback(() => ref.current(), []);
}

function useTimedImpactAndComplete(
    cell: FxCellCoord | undefined,
    onImpact: (() => void) | undefined,
    onComplete: (() => void) | undefined,
    impactMs: number,
    completeMs: number,
): void {
    const impactRef = useRef(false);
    const stableComplete = useStableComplete(onComplete);

    useLayoutEffect(() => {
        if (!cell) {
            stableComplete();
            return undefined;
        }

        const cancelImpact = scheduleFxFrameCallback(impactMs, () => {
            if (impactRef.current) return;
            impactRef.current = true;
            onImpact?.();
        });
        const cancelComplete = scheduleFxFrameCallback(completeMs, stableComplete);
        return () => {
            cancelImpact();
            cancelComplete();
        };
    }, [cell, completeMs, impactMs, onImpact, stableComplete]);
}

function cellBox(getCellPosition: FxRendererProps['getCellPosition'], cell: FxCellCoord) {
    const pos = getCellPosition(cell.row, cell.col);
    return {
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        height: `${pos.height}%`,
    };
}

function fxBoxStyle(box: FxBox) {
    return {
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
    };
}

function sameCell(a: FxCellCoord | undefined, b: FxCellCoord | undefined): boolean {
    return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function resolveEventQuality(event: FxRendererProps['event'], fallback: FxQuality = 'full'): FxQuality {
    return resolveFxQuality(event.params?.quality, resolveFxQuality(event.ctx.quality, fallback));
}

function stringifyAnchorId(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFxAnchorSnapshot(value: unknown): FxAnchorSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<FxAnchorSnapshot>;
    if (
        typeof candidate.surfaceId !== 'string'
        || typeof candidate.anchorId !== 'string'
        || !candidate.box
        || typeof candidate.box.left !== 'number'
        || typeof candidate.box.top !== 'number'
        || typeof candidate.box.width !== 'number'
        || typeof candidate.box.height !== 'number'
    ) {
        return null;
    }
    return candidate as FxAnchorSnapshot;
}

export const SummonRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const objectId = stringifyAnchorId(event.params?.objectId);
    const objectSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const stableComplete = useStableComplete(onComplete);

    useEffect(() => {
        if (!cell) stableComplete();
    }, [cell, stableComplete]);

    if (!cell) return null;

    const quality = resolveEventQuality(event);
    const color = resolveMageWarsSummonColor(event.params?.objectKind);
    const pos = getCellPosition(cell.row, cell.col);

    return (
        <BoardSummonEffectPreset
            cellBox={pos}
            anchorSnapshot={objectSnapshot}
            intensity={event.ctx.intensity ?? 'normal'}
            color={color}
            quality={quality}
            scale={MAGE_WARS_SUMMON_FX_TUNING.scale}
            originY={MAGE_WARS_SUMMON_FX_TUNING.originY}
            durationScale={MAGE_WARS_SUMMON_FX_TUNING.durationScale}
            visualScale={MAGE_WARS_SUMMON_FX_TUNING.visualScale}
            dimStrength={MAGE_WARS_SUMMON_FX_TUNING.dimStrength}
            hostTestId="mage-wars-fx-summon"
            objectKind={String(event.params?.objectKind ?? '')}
            objectId={objectId ?? ''}
            onImpact={onImpact}
            onComplete={stableComplete}
        />
    );
};

function MageWarsTravelPath({
    source,
    target,
    sourceSnapshot,
    targetSnapshot,
    sourceBox,
    targetBox,
    sourceAnchorId,
    targetAnchorId,
    getCellPosition,
    kind,
    strong = false,
    quality,
    showSourceWake,
    showMidBurst,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    sourceSnapshot?: FxAnchorSnapshot | null;
    targetSnapshot?: FxAnchorSnapshot | null;
    sourceBox?: FxBox | null;
    targetBox?: FxBox | null;
    sourceAnchorId?: string;
    targetAnchorId?: string;
    getCellPosition: FxRendererProps['getCellPosition'];
    kind: 'push' | 'teleport' | 'move';
    strong?: boolean;
    quality: FxQuality;
    showSourceWake?: boolean;
    showMidBurst?: boolean;
}) {
    if (!source || sameCell(source, target)) return null;
    const tuning = MAGE_WARS_TRAVEL_FX_TUNING[kind];
    const color = mageWarsFxColors(kind, strong);
    const midBurstPreset = strong && tuning.midBurstStrongPreset
        ? tuning.midBurstStrongPreset
        : tuning.midBurstPreset;

    return (
        <BoardProjectilePathPreset
            source={source}
            target={target}
            getCellPosition={getCellPosition}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            sourceBox={sourceBox}
            targetBox={targetBox}
            sourceAnchorId={sourceAnchorId}
            targetAnchorId={targetAnchorId}
            intensity={strong ? 'strong' : 'normal'}
            quality={quality}
            color={color}
            travelDurationMs={kind === 'move' ? MAGE_WARS_FX_TIMING.moveTravelImpactMs : MAGE_WARS_FX_TIMING.projectileTravelMs}
            showSourceWake={showSourceWake ?? true}
            showMidBurst={showMidBurst ?? true}
            sourceWakeTestId={`mage-wars-fx-${kind}-source-wake`}
            sourceBurstTestId={`mage-wars-fx-${kind}-source-burst`}
            travelTestId={`mage-wars-fx-${kind}-travel`}
            travelMidBurstTestId={`mage-wars-fx-${kind}-travel-mid-burst`}
            sourceWakePreset={tuning.sourceWakePreset}
            midBurstPreset={midBurstPreset}
            sourceWakeColors={color}
            midBurstColors={color}
            sourceWakeOverflow={tuning.sourceWakeOverflow}
            midBurstOverflow={tuning.midBurstOverflow}
            sourceWakeSizeClassName={tuning.sourceWakeSizeClassName}
            pathPaddingCells={tuning.pathPaddingCells}
            pathMinSizeCells={tuning.pathMinSizeCells}
        />
    );
}

function MageWarsTargetBurst({
    cell,
    targetSnapshot,
    targetBox,
    targetAnchorId,
    getCellPosition,
    kind,
    strong = false,
    delayMs,
    quality,
}: {
    cell: FxCellCoord;
    targetSnapshot?: FxAnchorSnapshot | null;
    targetBox?: FxBox | null;
    targetAnchorId?: string;
    getCellPosition: FxRendererProps['getCellPosition'];
    kind: 'push' | 'teleport';
    strong?: boolean;
    delayMs: number;
    quality: FxQuality;
}) {
    const tuning = MAGE_WARS_TRAVEL_FX_TUNING[kind];
    const preset = strong && tuning.targetBurstStrongPreset
        ? tuning.targetBurstStrongPreset
        : tuning.targetBurstPreset;
    if (!preset) return null;

    return (
        <BoardBurstImpactPreset
            cell={cell}
            getCellPosition={getCellPosition}
            targetSnapshot={targetSnapshot}
            box={targetBox}
            targetAnchorId={targetAnchorId}
            quality={quality}
            delayMs={delayMs}
            hostTestId={`mage-wars-fx-spell-${kind}`}
            burstTestId={`mage-wars-fx-spell-${kind}-burst`}
            preset={preset}
            color={mageWarsFxColors(kind, strong)}
            overflow={tuning.targetBurstOverflow}
            sizeClassName={tuning.targetBurstSizeClassName}
        />
    );
}

function MovementTrail({
    source,
    target,
    sourceSnapshot,
    targetSnapshot,
    sourceAnchorId,
    targetAnchorId,
    getCellPosition,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    sourceSnapshot?: FxAnchorSnapshot | null;
    targetSnapshot?: FxAnchorSnapshot | null;
    sourceAnchorId?: string;
    targetAnchorId?: string;
    getCellPosition: FxRendererProps['getCellPosition'];
}) {
    if (!source || sameCell(source, target)) return null;
    const sourceBox = sourceSnapshot?.box ?? getCellPosition(source.row, source.col);
    const targetBox = targetSnapshot?.box ?? getCellPosition(target.row, target.col);
    const path = createFxPathBox(sourceBox, targetBox, {
        paddingCells: 0.35,
        minSizeCells: 1.05,
        overflow: 'visible',
    });
    const dx = path.end.xPct - path.start.xPct;
    const dy = path.end.yPct - path.start.yPct;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.01) return null;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const steps = [18, 34, 50, 66, 82];

    return (
        <div
            className="absolute pointer-events-none z-30"
            data-testid="mage-wars-fx-move-trail"
            data-source-row={source.row}
            data-source-col={source.col}
            data-target-row={target.row}
            data-target-col={target.col}
            data-source-snapshot-anchor-id={sourceAnchorId ?? sourceSnapshot?.anchorId ?? ''}
            data-target-snapshot-anchor-id={targetAnchorId ?? targetSnapshot?.anchorId ?? ''}
            style={path.style}
        >
            <div
                className="absolute left-0 top-0 h-0"
                style={{
                    left: `${path.start.xPct}%`,
                    top: `${path.start.yPct}%`,
                    width: `${distance}%`,
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: '0 50%',
                }}
            >
                {steps.map((left, index) => (
                    <span
                        key={left}
                        className="absolute block h-2.5 w-1.5 rounded-full border border-cyan-50/70 bg-cyan-200/80 shadow-[0_0_10px_rgba(103,232,249,0.55)]"
                        data-testid="mage-wars-fx-move-step"
                        style={{
                            left: `${left}%`,
                            top: 0,
                            opacity: 0.52 + index * 0.08,
                            transform: `translate(-50%, -50%) rotate(${index % 2 === 0 ? '-14deg' : '14deg'})`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export const SpellTeleportRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        hasTravel ? MAGE_WARS_FX_TIMING.teleportTravelImpactMs : MAGE_WARS_FX_TIMING.teleportSameCellImpactMs,
        hasTravel ? MAGE_WARS_FX_TIMING.teleportTravelCompleteMs : MAGE_WARS_FX_TIMING.teleportSameCellCompleteMs,
    );

    if (!cell) return null;
    const strong = event.ctx.intensity === 'strong';
    const quality = resolveEventQuality(event);

    return (
        <>
            <MageWarsTravelPath
                source={source}
                target={cell}
                sourceSnapshot={sourceSnapshot}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="teleport"
                strong={strong}
                quality={quality}
            />
            <MageWarsTargetBurst
                cell={cell}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="teleport"
                strong={strong}
                delayMs={hasTravel ? MAGE_WARS_FX_TIMING.teleportTravelImpactMs : 0}
                quality={quality}
            />
        </>
    );
};

export const SpellPushRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        hasTravel ? MAGE_WARS_FX_TIMING.pushTravelImpactMs : MAGE_WARS_FX_TIMING.pushSameCellImpactMs,
        hasTravel ? MAGE_WARS_FX_TIMING.pushTravelCompleteMs : MAGE_WARS_FX_TIMING.pushSameCellCompleteMs,
    );

    if (!cell) return null;
    const strong = true;
    const quality = resolveEventQuality(event);

    return (
        <>
            <MageWarsTravelPath
                source={source}
                target={cell}
                sourceSnapshot={sourceSnapshot}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="push"
                strong
                quality={quality}
            />
            <MageWarsTargetBurst
                cell={cell}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="push"
                strong={strong}
                delayMs={hasTravel ? MAGE_WARS_FX_TIMING.pushTravelImpactMs : 0}
                quality={quality}
            />
        </>
    );
};

export const MovementRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const targetAnchorId = stringifyAnchorId(
        event.params?.targetObjectId
        ?? event.params?.targetPlayerId
        ?? event.params?.objectId,
    );
    const sourceAnchorId = targetAnchorId;
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        hasTravel ? MAGE_WARS_FX_TIMING.moveTravelImpactMs : MAGE_WARS_FX_TIMING.moveSameCellImpactMs,
        hasTravel ? MAGE_WARS_FX_TIMING.moveTravelCompleteMs : MAGE_WARS_FX_TIMING.moveSameCellCompleteMs,
    );

    if (!cell) return null;
    const quality = resolveEventQuality(event);

    return (
        <>
            <MovementTrail
                source={source}
                target={cell}
                sourceSnapshot={sourceSnapshot}
                targetSnapshot={targetSnapshot}
                sourceAnchorId={sourceAnchorId}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
            />
            <BoardBurstImpactPreset
                cell={cell}
                getCellPosition={getCellPosition}
                targetSnapshot={targetSnapshot}
                targetAnchorId={targetAnchorId}
                delayMs={hasTravel ? MAGE_WARS_FX_TIMING.moveTravelImpactMs : 0}
                hostTestId="mage-wars-fx-move-arrival"
                burstTestId="mage-wars-fx-move-arrival-burst"
                preset={MAGE_WARS_TRAVEL_FX_TUNING.move.midBurstPreset}
                color={mageWarsFxColors('move')}
                overflow={MAGE_WARS_TRAVEL_FX_TUNING.move.midBurstOverflow}
                sizeClassName={MAGE_WARS_TRAVEL_FX_TUNING.move.sourceWakeSizeClassName}
                quality={quality}
            />
        </>
    );
};

export const AttackImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const sourceAnchorId = stringifyAnchorId(event.params?.sourceObjectId ?? event.params?.attackerId);
    const targetAnchorId = stringifyAnchorId(event.params?.targetObjectId ?? event.params?.targetPlayerId ?? event.params?.defenderId);
    const sourceSnapshot = readFxAnchorSnapshot(event.params?.sourceSnapshot ?? event.ctx.sourceSnapshot);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    const rangeKind = event.params?.rangeKind === 'melee' ? 'melee' : 'ranged';

    useTimedImpactAndComplete(
        rangeKind === 'melee' ? cell : undefined,
        rangeKind === 'melee' ? onImpact : undefined,
        rangeKind === 'melee' ? onComplete : undefined,
        MAGE_WARS_FX_TIMING.meleeStrikeMs,
        MAGE_WARS_FX_TIMING.meleeResultVisibleMs,
    );

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;
    const attackIntensity = event.ctx.intensity === 'strong' ? 'strong' : 'normal';
    const attackColors = mageWarsFxColors('attack', attackIntensity === 'strong');
    const diceResults = Array.isArray(event.params?.diceResults)
        ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
        : [];
    const effectDieResult = typeof event.params?.effectDieResult === 'number'
        ? event.params.effectDieResult
        : undefined;
    const quality = resolveEventQuality(event);

    if (rangeKind === 'melee') {
        const targetBox = targetSnapshot?.box ?? getCellPosition(cell.row, cell.col);

        return (
            <>
                <div
                    className="absolute pointer-events-none z-30"
                    data-testid="mage-wars-fx-attack-melee-strike"
                    data-visual-role="melee-unified-impact"
                    data-strike-style="shared-impact"
                    data-source-row={source?.row}
                    data-source-col={source?.col}
                    data-target-row={cell.row}
                    data-target-col={cell.col}
                    style={{
                        left: `${targetBox.left}%`,
                        top: `${targetBox.top}%`,
                        width: `${targetBox.width}%`,
                        height: `${targetBox.height}%`,
                        overflow: 'visible',
                    }}
                >
                    <div
                        className="grid h-full w-full place-items-center"
                        data-testid="mage-wars-fx-attack-melee-impact"
                    data-source-anchor-id={sourceAnchorId ?? undefined}
                    data-target-anchor-id={targetAnchorId ?? undefined}
                    data-source-snapshot-anchor-id={sourceSnapshot?.anchorId ?? ''}
                    data-target-snapshot-anchor-id={targetSnapshot?.anchorId ?? ''}
                    data-source-snapshot-surface-id={sourceSnapshot?.surfaceId ?? ''}
                    data-target-snapshot-surface-id={targetSnapshot?.surfaceId ?? ''}
                        style={{ overflow: 'visible' }}
                    >
                    <BoardDamageImpactPreset
                        damage={damage}
                        quality={quality}
                        delayMs={MAGE_WARS_FX_TIMING.meleeStrikeMs}
                        hostTestId="mage-wars-fx-attack-damage-host"
                        burstTestId="mage-wars-fx-attack-impact-burst"
                        numberTestId="mage-wars-fx-attack-damage-float"
                        intensity={attackIntensity}
                        showImpactBurst
                        showRedPulse={false}
                        impactBurstPreset={MAGE_WARS_ATTACK_FX_TUNING.impactBurstPreset}
                        impactBurstColors={attackColors}
                        impactBurstOverflow={MAGE_WARS_ATTACK_FX_TUNING.impactBurstOverflow}
                        numberFontScale={MAGE_WARS_ATTACK_FX_TUNING.damageNumberFontScale}
                        numberColorClass={MAGE_WARS_ATTACK_FX_TUNING.damageNumberColorClass}
                        numberDurationSeconds={MAGE_WARS_ATTACK_FX_TUNING.damageNumberDurationSeconds}
                        pulseColor={MAGE_WARS_ATTACK_FX_TUNING.pulseColor}
                        shakeDuration={MAGE_WARS_ATTACK_FX_TUNING.shakeDuration}
                        impactEffects={MAGE_WARS_ATTACK_FX_TUNING.impactEffects}
                        damageFlashCompleteMs={MAGE_WARS_ATTACK_FX_TUNING.damageFlashCompleteMs}
                    />
                    </div>
                </div>
                <AttackDiceFeedback
                    diceResults={diceResults}
                    effectDieResult={effectDieResult}
                    visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
                />
            </>
        );
    }

    return (
        <>
            <BoardProjectileAttackPreset
                source={source}
                target={cell}
                getCellPosition={getCellPosition}
                sourceSnapshot={sourceSnapshot}
                targetSnapshot={targetSnapshot}
                sourceAnchorId={sourceAnchorId}
                targetAnchorId={targetAnchorId}
                damage={damage}
                quality={quality}
                intensity={attackIntensity}
                color={attackColors}
                travelDurationMs={MAGE_WARS_FX_TIMING.rangedAttackTravelMs}
                travelMotionEasing={MAGE_WARS_ATTACK_FX_TUNING.projectileMotionEasing}
                completeMs={
                    source && !sameCell(source, cell)
                        ? MAGE_WARS_FX_TIMING.projectileRangedCompleteMs
                        : MAGE_WARS_FX_TIMING.projectileSameCellCompleteMs
                }
                hostTestId="mage-wars-fx-attack-impact"
                travelTestId="mage-wars-fx-attack-travel"
                damageHostTestId="mage-wars-fx-attack-damage-host"
                impactBurstTestId="mage-wars-fx-attack-impact-burst"
                damageNumberTestId="mage-wars-fx-attack-damage-float"
                damageNumberFontScale={MAGE_WARS_ATTACK_FX_TUNING.damageNumberFontScale}
                damageNumberColorClass={MAGE_WARS_ATTACK_FX_TUNING.damageNumberColorClass}
                damageNumberDurationSeconds={MAGE_WARS_ATTACK_FX_TUNING.damageNumberDurationSeconds}
                pulseColor={MAGE_WARS_ATTACK_FX_TUNING.pulseColor}
                showImpactBurst={MAGE_WARS_ATTACK_FX_TUNING.showImpactBurst}
                showRedPulse={MAGE_WARS_ATTACK_FX_TUNING.showRedPulse}
                impactBurstPreset={MAGE_WARS_ATTACK_FX_TUNING.impactBurstPreset}
                impactBurstColors={attackColors}
                impactBurstOverflow={MAGE_WARS_ATTACK_FX_TUNING.impactBurstOverflow}
                shakeDuration={MAGE_WARS_ATTACK_FX_TUNING.shakeDuration}
                impactEffects={MAGE_WARS_ATTACK_FX_TUNING.impactEffects}
                damageFlashCompleteMs={MAGE_WARS_ATTACK_FX_TUNING.damageFlashCompleteMs}
                pathPaddingCells={MAGE_WARS_ATTACK_FX_TUNING.pathPaddingCells}
                pathMinSizeCells={MAGE_WARS_ATTACK_FX_TUNING.pathMinSizeCells}
                onImpact={onImpact}
                onComplete={onComplete}
            />
            <AttackDiceFeedback
                diceResults={diceResults}
                effectDieResult={effectDieResult}
                visibleDurationMs={MAGE_WARS_FX_TIMING.projectileRangedCompleteMs}
            />
        </>
    );
};

export const HealingImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const stableComplete = useStableComplete(onComplete);

    useEffect(() => {
        if (!cell) stableComplete();
    }, [cell, stableComplete]);

    if (!cell) return null;

    const amount = typeof event.params?.actualHealing === 'number'
        ? event.params.actualHealing
        : typeof event.params?.healingAmount === 'number'
            ? event.params.healingAmount
            : 0;
    const targetAnchorId = stringifyAnchorId(
        event.params?.targetObjectId
        ?? event.params?.targetPlayerId
        ?? event.params?.targetZoneId,
    );
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);

    return (
        <BoardHealingImpactPreset
            cell={cell}
            getCellPosition={getCellPosition}
            targetSnapshot={targetSnapshot}
            targetAnchorId={targetAnchorId}
            amount={amount}
            quality={resolveEventQuality(event)}
            hostTestId="mage-wars-fx-healing-impact"
            burstTestId="mage-wars-fx-healing-burst"
            numberTestId="mage-wars-fx-healing-number"
            onImpact={onImpact}
            onComplete={stableComplete}
        />
    );
};

export const DamageImpactRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const targetAnchorId = stringifyAnchorId(event.params?.targetId);
    const targetSnapshot = readFxAnchorSnapshot(event.params?.targetSnapshot ?? event.ctx.targetSnapshot);
    useTimedImpactAndComplete(cell, onImpact, onComplete, 0, MAGE_WARS_FX_TIMING.directDamageCompleteMs);

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;

    return (
        <div
            className="absolute pointer-events-none z-30 flex items-center justify-center"
            data-testid="mage-wars-fx-damage-impact"
            data-target-anchor-id={targetAnchorId ?? targetSnapshot?.anchorId ?? ''}
            data-surface-id={targetSnapshot?.surfaceId ?? ''}
            style={{ ...(targetSnapshot ? fxBoxStyle(targetSnapshot.box) : cellBox(getCellPosition, cell)), overflow: 'visible' }}
        >
            <BoardDamageImpactPreset
                damage={damage}
                quality={resolveEventQuality(event)}
                intensity={event.ctx.intensity ?? 'normal'}
                hostTestId="mage-wars-fx-damage-impact-host"
                numberTestId="mage-wars-fx-direct-damage-float"
                showImpactBurst={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.showImpactBurst}
                numberFontScale={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberFontScale}
                numberColorClass={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberColorClass}
                numberDurationSeconds={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.numberDurationSeconds}
                shakeDuration={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.shakeDuration}
                impactEffects={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.impactEffects}
                damageFlashCompleteMs={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.damageFlashCompleteMs}
                sizeStyle={MAGE_WARS_DIRECT_DAMAGE_FX_TUNING.sizeStyle}
            />
        </div>
    );
};
