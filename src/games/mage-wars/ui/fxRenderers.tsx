import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    BoardBurstImpactPreset,
    BoardDamageImpactPreset,
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
            className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-[0.18rem] bg-black/35 shadow-[0_6px_12px_rgba(0,0,0,0.46)]"
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

function AttackDiceFeedback({
    source,
    target,
    sourceBox,
    targetBox,
    diceResults,
    effectDieResult,
    getCellPosition,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    sourceBox?: FxBox | null;
    targetBox?: FxBox | null;
    diceResults: number[];
    effectDieResult?: number;
    getCellPosition: FxRendererProps['getCellPosition'];
}) {
    if (diceResults.length === 0) return null;

    const resolvedTargetBox = targetBox ?? getCellPosition(target.row, target.col);
    const resolvedSourceBox = sourceBox ?? (source ? getCellPosition(source.row, source.col) : resolvedTargetBox);
    const sourceCenter = {
        x: resolvedSourceBox.left + resolvedSourceBox.width / 2,
        y: resolvedSourceBox.top + resolvedSourceBox.height / 2,
    };
    const targetCenter = {
        x: resolvedTargetBox.left + resolvedTargetBox.width / 2,
        y: resolvedTargetBox.top + resolvedTargetBox.height / 2,
    };
    const pathCenter = {
        x: (sourceCenter.x + targetCenter.x) / 2,
        y: (sourceCenter.y + targetCenter.y) / 2,
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const distance = Math.hypot(dx, dy);
    const perpendicular = distance > 0.01
        ? { x: -dy / distance, y: dx / distance }
        : { x: 0, y: -1 };
    const sideSign = Math.abs(dx) >= Math.abs(dy)
        ? (pathCenter.y > 50 ? -1 : 1)
        : (pathCenter.x > 50 ? -1 : 1);
    const offset = Math.min(
        19,
        Math.max(13.5, Math.max(resolvedTargetBox.width, resolvedTargetBox.height) * 0.92 + 6),
    );
    const clampPercent = (value: number) => Math.min(94, Math.max(6, value));
    const left = clampPercent(pathCenter.x + perpendicular.x * sideSign * offset);
    const top = clampPercent(pathCenter.y + perpendicular.y * sideSign * offset);

    return (
        <motion.div
            className="absolute z-40 flex max-w-[11rem] items-center justify-center gap-1"
            data-testid="mage-wars-fx-attack-dice"
            data-placement="path-side-avoid-target"
            style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.68, y: 10 }}
            animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.68, 1, 1, 1, 1.04], y: [10, 0, 0, 0, -6] }}
            transition={{ duration: 1.35, ease: 'easeOut' }}
        >
            {diceResults.slice(0, 6).map((result, index) => (
                <AttackDieResult key={`${index}-${result}`} result={result} />
            ))}
            {effectDieResult !== undefined ? (
                <span
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-black/42 shadow-[0_6px_12px_rgba(0,0,0,0.46)]"
                    data-testid="mage-wars-fx-effect-die-face"
                    aria-label={`效果骰 ${effectDieResult}`}
                >
                    <OptimizedImage
                        src="mage-wars/dice/effect-die-d12-face"
                        alt={`效果骰 ${effectDieResult}`}
                        className="h-full w-full object-contain"
                        placeholder={false}
                    />
                </span>
            ) : null}
        </motion.div>
    );
}

function useStableComplete(onComplete: () => void): () => void {
    const ref = useRef(onComplete);
    useLayoutEffect(() => {
        ref.current = onComplete;
    }, [onComplete]);
    return React.useCallback(() => ref.current(), []);
}

function useTimedImpactAndComplete(
    cell: FxCellCoord | undefined,
    onImpact: () => void,
    onComplete: () => void,
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
            onImpact();
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
    kind: 'push' | 'teleport';
    strong?: boolean;
    quality: FxQuality;
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
            travelDurationMs={MAGE_WARS_FX_TIMING.projectileTravelMs}
            showSourceWake
            showMidBurst
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
                travelDurationMs={MAGE_WARS_FX_TIMING.projectileTravelMs}
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
                showImpactBurst={MAGE_WARS_ATTACK_FX_TUNING.showImpactBurst}
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
                source={source}
                target={cell}
                sourceBox={sourceSnapshot?.box ?? null}
                targetBox={targetSnapshot?.box ?? null}
                diceResults={diceResults}
                effectDieResult={effectDieResult}
                getCellPosition={getCellPosition}
            />
        </>
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
