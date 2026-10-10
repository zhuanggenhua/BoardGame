import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    BoardDamageImpactPreset,
    BoardHealingImpactPreset,
    BoardProjectileAttackPreset,
    BoardSummonEffectPreset,
    BoardTeleportImpactPreset,
} from '../../../components/common/animations/BoardFxPresets';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { AttackDie } from './AttackDie';
import { EffectDie } from './EffectDie';
import {
    resolveFxQuality,
    scheduleFxFrameCallback,
    type FxAnchorSnapshot,
    type FxCellCoord,
    type FxBox,
    type FxQuality,
    type FxRendererProps,
} from '../../../engine/fx';
import type { MageId } from '../domain/ids';
import { MAGE_IDS } from '../domain/ids';
import { getMageWarsMagePreviewRef, getMageWarsSpellCardPreviewRef } from './cardAtlas';
import {
    MAGE_WARS_ATTACK_FX_TUNING,
    MAGE_WARS_DIRECT_DAMAGE_FX_TUNING,
    MAGE_WARS_FX_TIMING,
    MAGE_WARS_SUMMON_FX_TUNING,
    MAGE_WARS_SUMMON_HOST_STYLE,
    MAGE_WARS_TELEPORT_FX_TUNING,
    mageWarsFxColors,
    resolveMageWarsSummonColor,
} from './fxTuning';

const MAGE_ID_VALUES = new Set<string>(Object.values(MAGE_IDS));

function isMageId(value: unknown): value is MageId {
    return typeof value === 'string' && MAGE_ID_VALUES.has(value);
}

function AttackDiceFeedback({
    diceResults,
    effectDieResult,
    rawEffectDieResult,
    visibleDurationMs,
}: {
    diceResults: number[];
    effectDieResult?: number;
    rawEffectDieResult?: number;
    visibleDurationMs: number;
}) {
    if (diceResults.length === 0 && effectDieResult === undefined) return null;

    const resultLayer = (
        <motion.div
            className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center"
            data-testid="mage-wars-fx-attack-dice"
            data-placement="board-center"
            data-visual-role="attack-dice-result"
            data-visible-duration-ms={visibleDurationMs}
            initial={{ opacity: 0, scale: 0.68, y: 10 }}
            animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.68, 1, 1, 1, 1.04], y: [10, 0, 0, 0, -6] }}
            transition={{
                duration: visibleDurationMs / 1000,
                ease: 'easeOut',
                times: [0, 0.05, 0.82, 0.94, 1],
            }}
        >
            <div
                className="flex max-w-[34rem] items-center justify-center gap-[clamp(0.45rem,1vw,1rem)]"
                data-testid="mage-wars-fx-attack-dice-content"
            >
                {diceResults.slice(0, 6).map((result, index) => (
                    <AttackDie key={`${index}-${result}`} result={result} index={index} />
                ))}
                {effectDieResult !== undefined ? (
                    <EffectDie result={rawEffectDieResult ?? effectDieResult} resolvedResult={effectDieResult} />
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
    const stableImpact = useStableComplete(onImpact);
    const stableComplete = useStableComplete(onComplete);

    useLayoutEffect(() => {
        if (!cell) {
            stableComplete();
            return undefined;
        }

        const cancelImpact = scheduleFxFrameCallback(impactMs, () => {
            if (impactRef.current) return;
            impactRef.current = true;
            stableImpact();
        });
        const cancelComplete = scheduleFxFrameCallback(completeMs, stableComplete);
        return () => {
            cancelImpact();
            cancelComplete();
        };
    }, [cell, completeMs, impactMs, stableImpact, stableComplete]);
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

function centerEntityBoxInCell(cellBox: FxBox, sizeBox: FxBox): FxBox {
    return {
        left: cellBox.left + (cellBox.width - sizeBox.width) / 2,
        top: cellBox.top + (cellBox.height - sizeBox.height) / 2,
        width: sizeBox.width,
        height: sizeBox.height,
    };
}

function resolveEntitySlideBox(
    cell: FxCellCoord | undefined,
    sizeRef: FxAnchorSnapshot | null | undefined,
    getCellPosition: FxRendererProps['getCellPosition'],
): FxBox | null {
    // 起终点必须跟格子走。快照盒会在棋子已经落到目标格后被采到，再用它当 from 就会瞬移。
    if (!cell) return null;
    const cellBox = getCellPosition(cell.row, cell.col);
    if (sizeRef?.box) return centerEntityBoxInCell(cellBox, sizeRef.box);
    return cellBox;
}

function MageWarsEntitySlide({
    source,
    target,
    sourceSnapshot,
    targetSnapshot,
    getCellPosition,
    durationMs,
    kind,
    objectId,
    sourceSpellCardId,
    mageId,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    sourceSnapshot?: FxAnchorSnapshot | null;
    targetSnapshot?: FxAnchorSnapshot | null;
    getCellPosition: FxRendererProps['getCellPosition'];
    durationMs: number;
    kind: 'push' | 'move';
    objectId?: string;
    sourceSpellCardId?: number;
    mageId?: string;
}) {
    const sizeRef = sourceSnapshot ?? targetSnapshot;
    const fromBox = resolveEntitySlideBox(source, sizeRef, getCellPosition);
    const toBox = resolveEntitySlideBox(target, targetSnapshot ?? sourceSnapshot, getCellPosition);
    const frozenPathRef = useRef<{ fromBox: FxBox; toBox: FxBox } | null>(null);
    if (fromBox && toBox && frozenPathRef.current == null) {
        frozenPathRef.current = { fromBox, toBox };
    }
    const frozenPath = frozenPathRef.current;
    if (!frozenPath) return null;
    const { fromBox: frozenFromBox, toBox: frozenToBox } = frozenPath;
    const previewRef = sourceSpellCardId != null
        ? getMageWarsSpellCardPreviewRef(sourceSpellCardId)
        : isMageId(mageId)
            ? getMageWarsMagePreviewRef(mageId, 'portrait')
            : null;
    const slideBody = (
        <div
            className="h-full w-full overflow-hidden rounded-[0.16rem] shadow-[0_10px_18px_rgba(0,0,0,0.42)]"
            data-testid={`mage-wars-fx-${kind}-slide-body`}
        >
            {previewRef ? (
                <CardPreview
                    previewRef={previewRef}
                    className="h-full w-full rounded-[0.16rem]"
                />
            ) : (
                <div className="h-full w-full rounded-[0.16rem] bg-stone-900/85 ring-1 ring-amber-100/40" />
            )}
        </div>
    );
    return (
        <motion.div
            className="pointer-events-none absolute inset-0 z-30 overflow-visible"
            data-testid={`mage-wars-fx-${kind}-slide`}
            data-visual-role="entity-slide"
            data-slide-ease="linear"
            data-slide-layer="arena"
            data-slide-motion="transform"
            data-object-id={objectId ?? ''}
            data-source-spell-card-id={sourceSpellCardId ?? ''}
            data-mage-id={mageId ?? ''}
            data-source-row={source?.row}
            data-source-col={source?.col}
            data-target-row={target.row}
            data-target-col={target.col}
            data-from-left={String(frozenFromBox.left)}
            data-from-top={String(frozenFromBox.top)}
            data-to-left={String(frozenToBox.left)}
            data-to-top={String(frozenToBox.top)}
            initial={{
                x: `${frozenFromBox.left}%`,
                y: `${frozenFromBox.top}%`,
            }}
            animate={{
                x: `${frozenToBox.left}%`,
                y: `${frozenToBox.top}%`,
            }}
            transition={{ duration: durationMs / 1000, ease: 'linear' }}
            style={{ willChange: 'transform' }}
        >
            <motion.div
                className="absolute left-0 top-0 overflow-visible rounded-[0.18rem]"
                initial={{
                    width: `${frozenFromBox.width}%`,
                    height: `${frozenFromBox.height}%`,
                }}
                animate={{
                    width: `${frozenToBox.width}%`,
                    height: `${frozenToBox.height}%`,
                }}
                transition={{ duration: durationMs / 1000, ease: 'linear' }}
            >
                {slideBody}
            </motion.div>
        </motion.div>
    );
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
            pillarWidthRatio={MAGE_WARS_SUMMON_FX_TUNING.pillarWidthRatio}
            hostTestId="mage-wars-fx-summon"
            objectKind={String(event.params?.objectKind ?? '')}
            objectId={objectId ?? ''}
            className="z-0"
            hostStyle={MAGE_WARS_SUMMON_HOST_STYLE}
            onImpact={onImpact}
            onComplete={stableComplete}
        />
    );
};

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
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        MAGE_WARS_FX_TIMING.teleportArrivalImpactMs,
        MAGE_WARS_FX_TIMING.teleportCompleteMs,
    );

    if (!cell) return null;
    const strong = event.ctx.intensity === 'strong';
    const quality = resolveEventQuality(event);

    return (
        <BoardTeleportImpactPreset
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            sourceAnchorId={stringifyAnchorId(event.params?.sourceObjectId ?? event.params?.targetObjectId)}
            targetAnchorId={targetAnchorId}
            getCellPosition={getCellPosition}
            quality={quality}
            arrivalDelayMs={MAGE_WARS_FX_TIMING.teleportArrivalImpactMs}
            sourceHostTestId="mage-wars-fx-teleport-source-wake"
            sourceBurstTestId="mage-wars-fx-teleport-source-burst"
            arrivalHostTestId="mage-wars-fx-spell-teleport"
            arrivalBurstTestId="mage-wars-fx-spell-teleport-burst"
            sourcePreset={MAGE_WARS_TELEPORT_FX_TUNING.sourcePreset}
            arrivalPreset={strong
                ? MAGE_WARS_TELEPORT_FX_TUNING.arrivalStrongPreset
                : MAGE_WARS_TELEPORT_FX_TUNING.arrivalPreset}
            sourceColor={mageWarsFxColors('teleport', strong)}
            arrivalColor={mageWarsFxColors('teleport', strong)}
            sourceOverflow={MAGE_WARS_TELEPORT_FX_TUNING.sourceOverflow}
            arrivalOverflow={MAGE_WARS_TELEPORT_FX_TUNING.arrivalOverflow}
            sourceSizeClassName={MAGE_WARS_TELEPORT_FX_TUNING.sourceSizeClassName}
            arrivalSizeClassName={MAGE_WARS_TELEPORT_FX_TUNING.arrivalSizeClassName}
        />
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

    if (!hasTravel) return null;

    return (
        <MageWarsEntitySlide
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            getCellPosition={getCellPosition}
            durationMs={MAGE_WARS_FX_TIMING.pushTravelImpactMs}
            kind="push"
            objectId={targetAnchorId}
            sourceSpellCardId={typeof event.params?.sourceSpellCardId === 'number'
                ? event.params.sourceSpellCardId
                : undefined}
            mageId={stringifyAnchorId(event.params?.mageId)}
        />
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

    if (!hasTravel) return null;

    return (
        <MageWarsEntitySlide
            source={source}
            target={cell}
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            getCellPosition={getCellPosition}
            durationMs={MAGE_WARS_FX_TIMING.moveTravelImpactMs}
            kind="move"
            objectId={targetAnchorId}
            sourceSpellCardId={typeof event.params?.sourceSpellCardId === 'number'
                ? event.params.sourceSpellCardId
                : undefined}
            mageId={stringifyAnchorId(event.params?.mageId)}
        />
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

    const damage = (event.params?.damageAmount as number | undefined) ?? 1;
    const attackIntensity = event.ctx.intensity === 'strong' ? 'strong' : 'normal';
    const attackColors = mageWarsFxColors('attack', attackIntensity === 'strong');
    const diceResults = useMemo(
        () => Array.isArray(event.params?.diceResults)
            ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
            : [],
        [event.params],
    );
    const effectDieResult = typeof event.params?.effectDieResult === 'number'
        ? event.params.effectDieResult
        : undefined;
    const rawEffectDieResult = typeof event.params?.rawEffectDieResult === 'number'
        ? event.params.rawEffectDieResult
        : undefined;
    const quality = resolveEventQuality(event);

    useEffect(() => {
        if (!(globalThis as typeof globalThis & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__) return;
        console.warn('[DEBUG-MAGE-WARS-ATTACK-RENDERER]', {
            fxId: event.id,
            rangeKind,
            diceCount: diceResults.length,
            diceResults,
            effectDieResult: effectDieResult ?? null,
            hasCell: Boolean(cell),
            source: source ?? null,
            target: cell ?? null,
        });
    }, [cell, diceResults, effectDieResult, event.id, rangeKind, source]);

    if (!cell) return null;

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
                        slashDurationMs={MAGE_WARS_ATTACK_FX_TUNING.meleeSlashDurationMs}
                        slashActiveMs={MAGE_WARS_ATTACK_FX_TUNING.meleeSlashActiveMs}
                    />
                    </div>
                </div>
                <AttackDiceFeedback
                    diceResults={diceResults}
                    effectDieResult={effectDieResult}
                    rawEffectDieResult={rawEffectDieResult}
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
                completeMs={Math.max(
                    MAGE_WARS_FX_TIMING.meleeResultVisibleMs,
                    source && !sameCell(source, cell)
                        ? MAGE_WARS_FX_TIMING.projectileRangedCompleteMs
                        : MAGE_WARS_FX_TIMING.projectileSameCellCompleteMs
                )}
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
                rawEffectDieResult={rawEffectDieResult}
                visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
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
    const diceResults = useMemo(
        () => Array.isArray(event.params?.diceResults)
            ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
            : [],
        [event.params],
    );
    const hasDice = diceResults.length > 0;
    useTimedImpactAndComplete(
        cell,
        onImpact,
        onComplete,
        0,
        hasDice ? MAGE_WARS_FX_TIMING.meleeResultVisibleMs : 1_100,
    );

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
        <>
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
            />
            {hasDice ? (
                <AttackDiceFeedback
                    diceResults={diceResults}
                    visibleDurationMs={MAGE_WARS_FX_TIMING.meleeResultVisibleMs}
                />
            ) : null}
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
