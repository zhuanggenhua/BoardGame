import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    const left = (resolvedSourceBox.left + resolvedSourceBox.width / 2 + resolvedTargetBox.left + resolvedTargetBox.width / 2) / 2;
    const top = (resolvedSourceBox.top + resolvedSourceBox.height / 2 + resolvedTargetBox.top + resolvedTargetBox.height / 2) / 2;

    return (
        <motion.div
            className="absolute z-40 flex max-w-[11rem] items-center justify-center gap-1"
            data-testid="mage-wars-fx-attack-dice"
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

function escapeCssAttributeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sameFxBox(a: FxBox | null, b: FxBox | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return Math.abs(a.left - b.left) < 0.01
        && Math.abs(a.top - b.top) < 0.01
        && Math.abs(a.width - b.width) < 0.01
        && Math.abs(a.height - b.height) < 0.01;
}

function readRelativeFxBox(element: HTMLElement | null): FxBox | null {
    if (typeof document === 'undefined' || !element) return null;
    const layer = document.querySelector<HTMLElement>('[data-testid="mage-wars-fx-layer"]');
    if (!layer) return null;
    const layerRect = layer.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (layerRect.width <= 0 || layerRect.height <= 0 || rect.width <= 0 || rect.height <= 0) return null;
    return {
        left: ((rect.left - layerRect.left) / layerRect.width) * 100,
        top: ((rect.top - layerRect.top) / layerRect.height) * 100,
        width: (rect.width / layerRect.width) * 100,
        height: (rect.height / layerRect.height) * 100,
    };
}

function readMageWarsAnchorBox(anchorId: string | undefined): FxBox | null {
    if (typeof document === 'undefined' || !anchorId) return null;
    const escaped = escapeCssAttributeValue(anchorId);
    const objectElement = document.querySelector<HTMLElement>(
        `[data-testid="mage-wars-zone-field-card"][data-object-id="${escaped}"]`,
    );
    if (objectElement) return readRelativeFxBox(objectElement);
    const attachmentElement = document.querySelector<HTMLElement>(
        `[data-testid="mage-wars-attached-card"][data-object-id="${escaped}"]`,
    );
    if (attachmentElement) return readRelativeFxBox(attachmentElement);
    const mageElement = document.querySelector<HTMLElement>(
        `[data-testid="mage-wars-zone-mage-entity"][data-player-id="${escaped}"]`,
    );
    return readRelativeFxBox(mageElement);
}

function useMageWarsAnchorBox(anchorId: string | undefined): FxBox | null {
    const [box, setBox] = useState<FxBox | null>(() => readMageWarsAnchorBox(anchorId));

    useLayoutEffect(() => {
        if (!anchorId) {
            setBox(null);
            return undefined;
        }

        const update = () => {
            const next = readMageWarsAnchorBox(anchorId);
            setBox((current) => (sameFxBox(current, next) ? current : next));
        };
        update();
        const cancelFrame = scheduleFxFrameCallback(0, update);
        window.addEventListener('resize', update);
        return () => {
            cancelFrame();
            window.removeEventListener('resize', update);
        };
    }, [anchorId]);

    return box;
}

export const SummonRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const objectId = stringifyAnchorId(event.params?.objectId);
    const objectBox = useMageWarsAnchorBox(objectId);
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
            cellBox={objectBox ?? pos}
            intensity={event.ctx.intensity ?? 'normal'}
            color={color}
            quality={quality}
            scale={MAGE_WARS_SUMMON_FX_TUNING.scale}
            originY={MAGE_WARS_SUMMON_FX_TUNING.originY}
            durationScale={MAGE_WARS_SUMMON_FX_TUNING.durationScale}
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
    targetBox,
    targetAnchorId,
    getCellPosition,
    kind,
    strong = false,
    delayMs,
    quality,
}: {
    cell: FxCellCoord;
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
    const targetBox = useMageWarsAnchorBox(targetAnchorId);
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
                targetBox={targetBox}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="teleport"
                strong={strong}
                quality={quality}
            />
            <MageWarsTargetBurst
                cell={cell}
                targetBox={targetBox}
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
    const targetBox = useMageWarsAnchorBox(targetAnchorId);
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
                targetBox={targetBox}
                targetAnchorId={targetAnchorId}
                getCellPosition={getCellPosition}
                kind="push"
                strong
                quality={quality}
            />
            <MageWarsTargetBurst
                cell={cell}
                targetBox={targetBox}
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
    const sourceBox = useMageWarsAnchorBox(sourceAnchorId);
    const targetBox = useMageWarsAnchorBox(targetAnchorId);

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
                sourceBox={sourceBox}
                targetBox={targetBox}
                sourceAnchorId={sourceAnchorId}
                targetAnchorId={targetAnchorId}
                damage={damage}
                quality={quality}
                intensity={attackIntensity}
                color={attackColors}
                travelDurationMs={MAGE_WARS_FX_TIMING.projectileTravelMs}
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
                sourceBox={sourceBox}
                targetBox={targetBox}
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
    const targetBox = useMageWarsAnchorBox(targetAnchorId);
    useTimedImpactAndComplete(cell, onImpact, onComplete, 0, MAGE_WARS_FX_TIMING.directDamageCompleteMs);

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;

    return (
        <div
            className="absolute pointer-events-none z-30 flex items-center justify-center"
            data-testid="mage-wars-fx-damage-impact"
            data-target-anchor-id={targetAnchorId ?? ''}
            style={{ ...(targetBox ? fxBoxStyle(targetBox) : cellBox(getCellPosition, cell)), overflow: 'visible' }}
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
