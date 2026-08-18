/**
 * Board FX presets
 *
 * Shared board-level visual recipes built from the lower-level animation
 * primitives. Game renderers should map their cue params into these presets
 * instead of composing projectile, summon, impact, and floating-number layers
 * in game-specific files.
 */

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  createFxPathBox,
  createFxScaledCellBox,
  scheduleFxFrameCallback,
  type FxBox,
  type FxCellCoord,
  type FxAnchorSnapshot,
  type FxQuality,
  type FxRendererProps,
} from '../../../engine/fx';
import { BurstParticles, type BurstParticlesProps } from './BurstParticles';
import { ConeBlast } from './ConeBlast';
import { DamageFlash } from './DamageFlash';
import { ImpactContainer, type ImpactEffects } from './ImpactContainer';
import { SummonHybridEffect } from './SummonHybridEffect';
import type { SummonColorTheme, SummonIntensity } from './SummonEffect';

export type BoardBurstPresetName = NonNullable<BurstParticlesProps['preset']>;
type CellPositionResolver = FxRendererProps['getCellPosition'];

const CARD_ASPECT_RATIO = 1044 / 729;
const CARD_WIDTH_RATIO = 0.85;
const CARD_PADDING_TOP = `${100 / CARD_ASPECT_RATIO}%`;

export const BOARD_PROJECTILE_ATTACK_TIMING = {
  travelDurationMs: 2_600,
  rangedCompleteMs: 4_200,
  sameCellCompleteMs: 1_450,
} as const;

function useStableCallback(callback?: () => void): () => void {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  }, [callback]);
  return React.useCallback(() => ref.current?.(), []);
}

function useTimedImpactAndComplete({
  active,
  impactMs,
  completeMs,
  onImpact,
  onComplete,
}: {
  active: boolean;
  impactMs: number;
  completeMs: number;
  onImpact?: () => void;
  onComplete?: () => void;
}): void {
  const impactFiredRef = useRef(false);
  const stableImpact = useStableCallback(onImpact);
  const stableComplete = useStableCallback(onComplete);

  useLayoutEffect(() => {
    if (!active) {
      stableComplete();
      return undefined;
    }

    impactFiredRef.current = false;
    const cancelImpact = scheduleFxFrameCallback(impactMs, () => {
      if (impactFiredRef.current) return;
      impactFiredRef.current = true;
      stableImpact();
    });
    const cancelComplete = scheduleFxFrameCallback(completeMs, stableComplete);

    return () => {
      cancelImpact();
      cancelComplete();
    };
  }, [active, completeMs, impactMs, stableComplete, stableImpact]);
}

function useDelayedActive(delayMs: number): boolean {
  const [activation, setActivation] = React.useState(() => ({
    delayMs,
    active: delayMs === 0,
  }));

  useEffect(() => {
    if (delayMs === 0) return undefined;
    const cancelActivation = scheduleFxFrameCallback(delayMs, () => {
      setActivation({ delayMs, active: true });
    });
    return cancelActivation;
  }, [delayMs]);

  return delayMs === 0 || (activation.delayMs === delayMs && activation.active);
}

function sameCell(a: FxCellCoord | undefined, b: FxCellCoord | undefined): boolean {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function cellBox(getCellPosition: CellPositionResolver, cell: FxCellCoord) {
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
    overflow: 'visible' as const,
  };
}

function snapshotBox(snapshot?: FxAnchorSnapshot | null): FxBox | null {
  return snapshot?.box ?? null;
}

function DelayedBurstParticles({
  testId,
  delayMs = 0,
  preset,
  color,
  quality,
  overflow = 2.4,
  className = 'absolute inset-0 pointer-events-none',
}: {
  testId?: string;
  delayMs?: number;
  preset: BoardBurstPresetName;
  color?: string[];
  quality: FxQuality;
  overflow?: number;
  className?: string;
}) {
  const active = useDelayedActive(delayMs);

  return (
    <div
      className={className}
      data-testid={testId}
      style={{ overflow: 'visible' }}
    >
      <BurstParticles
        active={active}
        preset={preset}
        color={color}
        quality={quality}
        overflow={overflow}
      />
    </div>
  );
}

export interface BoardSummonEffectPresetProps {
  cellBox: FxBox;
  anchorSnapshot?: FxAnchorSnapshot | null;
  intensity?: SummonIntensity;
  color?: SummonColorTheme;
  quality?: FxQuality;
  scale?: number;
  originY?: number;
  durationScale?: number;
  visualScale?: number;
  dimStrength?: number;
  hostTestId?: string;
  objectKind?: string;
  objectId?: string;
  className?: string;
  onImpact?: () => void;
  onComplete?: () => void;
}

export const BoardSummonEffectPreset: React.FC<BoardSummonEffectPresetProps> = ({
  cellBox,
  anchorSnapshot,
  intensity = 'normal',
  color = 'blue',
  quality = 'full',
  scale = 7.5,
  originY = 0.5,
  durationScale,
  visualScale,
  dimStrength,
  hostTestId = 'board-fx-summon-preset',
  objectKind,
  objectId,
  className = '',
  onImpact,
  onComplete,
}) => {
  const resolvedBox = snapshotBox(anchorSnapshot) ?? cellBox;
  const box = createFxScaledCellBox(resolvedBox, scale);

  return (
    <div
      className={`absolute pointer-events-none z-30 ${className}`}
      data-testid={hostTestId}
      data-object-kind={objectKind ?? ''}
      data-object-id={objectId ?? anchorSnapshot?.anchorId ?? ''}
      data-anchor-id={anchorSnapshot?.anchorId ?? objectId ?? ''}
      data-surface-id={anchorSnapshot?.surfaceId ?? ''}
      style={box}
    >
      <SummonHybridEffect
        active
        intensity={intensity}
        color={color}
        originY={originY}
        quality={quality}
        durationScale={durationScale}
        visualScale={visualScale}
        dimStrength={dimStrength}
        onImpact={onImpact}
        onComplete={onComplete}
      />
    </div>
  );
};

export interface BoardProjectilePathPresetProps {
  source?: FxCellCoord;
  target: FxCellCoord;
  getCellPosition: CellPositionResolver;
  sourceSnapshot?: FxAnchorSnapshot | null;
  targetSnapshot?: FxAnchorSnapshot | null;
  sourceBox?: FxBox | null;
  targetBox?: FxBox | null;
  sourceAnchorId?: string;
  targetAnchorId?: string;
  intensity?: 'normal' | 'strong';
  quality?: FxQuality;
  color?: string[];
  travelDurationMs?: number;
  showSourceWake?: boolean;
  showMidBurst?: boolean;
  sourceWakeTestId?: string;
  sourceBurstTestId?: string;
  travelTestId?: string;
  travelMidBurstTestId?: string;
  sourceWakePreset?: BoardBurstPresetName;
  midBurstPreset?: BoardBurstPresetName;
  sourceWakeColors?: string[];
  midBurstColors?: string[];
  sourceWakeOverflow?: number;
  midBurstOverflow?: number;
  sourceWakeSizeClassName?: string;
  pathPaddingCells?: number;
  pathMinSizeCells?: number;
}

export const BoardProjectilePathPreset: React.FC<BoardProjectilePathPresetProps> = ({
  source,
  target,
  getCellPosition,
  sourceSnapshot,
  targetSnapshot,
  sourceBox,
  targetBox,
  sourceAnchorId,
  targetAnchorId,
  intensity = 'normal',
  quality = 'full',
  color,
  travelDurationMs = BOARD_PROJECTILE_ATTACK_TIMING.travelDurationMs,
  showSourceWake = false,
  showMidBurst = false,
  sourceWakeTestId,
  sourceBurstTestId,
  travelTestId = 'board-fx-projectile-travel',
  travelMidBurstTestId,
  sourceWakePreset = 'sparks',
  midBurstPreset = 'sparks',
  sourceWakeColors,
  midBurstColors,
  sourceWakeOverflow = 2.8,
  midBurstOverflow = 3.2,
  sourceWakeSizeClassName = 'relative h-24 w-24',
  pathPaddingCells = 1.35,
  pathMinSizeCells = 2.25,
}) => {
  if (!source || sameCell(source, target)) return null;
  const resolvedSourceBox = snapshotBox(sourceSnapshot) ?? sourceBox ?? getCellPosition(source.row, source.col);
  const resolvedTargetBox = snapshotBox(targetSnapshot) ?? targetBox ?? getCellPosition(target.row, target.col);

  const pathBox = createFxPathBox(
    resolvedSourceBox,
    resolvedTargetBox,
    { paddingCells: pathPaddingCells, minSizeCells: pathMinSizeCells },
  );
  const midX = pathBox.start.xPct + (pathBox.end.xPct - pathBox.start.xPct) * 0.52;
  const midY = pathBox.start.yPct + (pathBox.end.yPct - pathBox.start.yPct) * 0.52;

  return (
    <>
      {showSourceWake ? (
        <div
          className="absolute pointer-events-none z-30 grid place-items-center"
          data-testid={sourceWakeTestId}
        data-source-anchor-id={sourceAnchorId ?? ''}
        data-source-snapshot-anchor-id={sourceSnapshot?.anchorId ?? ''}
        data-source-snapshot-surface-id={sourceSnapshot?.surfaceId ?? ''}
        style={fxBoxStyle(resolvedSourceBox)}
        >
          <div className={sourceWakeSizeClassName}>
            <DelayedBurstParticles
              testId={sourceBurstTestId}
              preset={sourceWakePreset}
              color={sourceWakeColors ?? color}
              quality={quality}
              overflow={sourceWakeOverflow}
            />
          </div>
        </div>
      ) : null}
      <div
        className="absolute pointer-events-none z-40"
        data-testid={travelTestId}
        data-source-row={source.row}
        data-source-col={source.col}
        data-target-row={target.row}
        data-target-col={target.col}
        data-source-anchor-id={sourceAnchorId ?? ''}
        data-target-anchor-id={targetAnchorId ?? ''}
        data-source-snapshot-anchor-id={sourceSnapshot?.anchorId ?? ''}
        data-target-snapshot-anchor-id={targetSnapshot?.anchorId ?? ''}
        data-surface-id={targetSnapshot?.surfaceId ?? sourceSnapshot?.surfaceId ?? ''}
        style={pathBox.style}
      >
        <ConeBlast
          start={pathBox.start}
          end={pathBox.end}
          intensity={intensity}
          quality={quality}
          durationMs={travelDurationMs}
          color={color}
        />
        {showMidBurst ? (
          <div
            className="absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2"
            data-testid={travelMidBurstTestId}
            style={{ left: `${midX}%`, top: `${midY}%`, overflow: 'visible' }}
          >
            <DelayedBurstParticles
              delayMs={360}
              preset={midBurstPreset}
              color={midBurstColors ?? color}
              quality={quality}
              overflow={midBurstOverflow}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};

export interface BoardDamageImpactPresetProps {
  damage: number;
  quality?: FxQuality;
  delayMs?: number;
  hostTestId?: string;
  burstTestId?: string;
  numberTestId?: string;
  intensity?: 'normal' | 'strong';
  showImpactBurst?: boolean;
  impactBurstPreset?: BoardBurstPresetName;
  impactBurstColors?: string[];
  impactBurstOverflow?: number;
  numberFontScale?: number;
  numberColorClass?: string;
  numberDurationSeconds?: number;
  shakeDuration?: number;
  impactEffects?: ImpactEffects;
  damageFlashCompleteMs?: number;
  sizeStyle?: React.CSSProperties;
  className?: string;
}

export const BoardDamageImpactPreset: React.FC<BoardDamageImpactPresetProps> = ({
  damage,
  quality = 'full',
  delayMs = 0,
  hostTestId = 'board-fx-damage-impact-host',
  burstTestId,
  numberTestId,
  intensity = 'strong',
  showImpactBurst = true,
  impactBurstPreset = 'explosionStrong',
  impactBurstColors,
  impactBurstOverflow = 2.2,
  numberFontScale = 1.45,
  numberColorClass = 'text-amber-50',
  numberDurationSeconds = 1.2,
  shakeDuration = 620,
  impactEffects = { shake: true, hitStop: true },
  damageFlashCompleteMs = 1_550,
  sizeStyle,
  className = '',
}) => {
  const active = useDelayedActive(delayMs);

  return (
    <div
      className={`relative ${className}`}
      data-testid={hostTestId}
      style={{
        width: `${CARD_WIDTH_RATIO * 100}%`,
        height: 0,
        paddingTop: CARD_PADDING_TOP,
        aspectRatio: `${CARD_ASPECT_RATIO}`,
        maxHeight: '100%',
        overflow: 'visible',
        ...sizeStyle,
      }}
    >
      {showImpactBurst ? (
        <DelayedBurstParticles
          testId={burstTestId}
          delayMs={delayMs}
          preset={impactBurstPreset}
          color={impactBurstColors}
          quality={quality}
          overflow={impactBurstOverflow}
        />
      ) : null}
      <ImpactContainer
        isActive={active}
        damage={damage}
        effects={impactEffects}
        shakeDuration={shakeDuration}
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        <DamageFlash
          active={active}
          damage={damage}
          intensity={intensity}
          numberTestId={numberTestId}
          numberFontScale={numberFontScale}
          numberColorClass={numberColorClass}
          numberDurationSeconds={numberDurationSeconds}
          quality={quality}
          slashDurationMs={560}
          slashActiveMs={220}
          pulseDurationMs={620}
          pulseActiveMs={620}
          completeMs={damageFlashCompleteMs}
        />
      </ImpactContainer>
    </div>
  );
};

export interface BoardBurstImpactPresetProps {
  cell: FxCellCoord;
  getCellPosition: CellPositionResolver;
  targetSnapshot?: FxAnchorSnapshot | null;
  box?: FxBox | null;
  targetAnchorId?: string;
  quality?: FxQuality;
  delayMs?: number;
  hostTestId?: string;
  burstTestId?: string;
  preset: BoardBurstPresetName;
  color?: string[];
  overflow?: number;
  sizeClassName?: string;
}

export const BoardBurstImpactPreset: React.FC<BoardBurstImpactPresetProps> = ({
  cell,
  getCellPosition,
  targetSnapshot,
  box,
  targetAnchorId,
  quality = 'full',
  delayMs = 0,
  hostTestId = 'board-fx-burst-impact',
  burstTestId,
  preset,
  color,
  overflow = 2.6,
  sizeClassName = 'relative h-36 w-36',
}) => {
  const resolvedSnapshotBox = snapshotBox(targetSnapshot);

  return (
    <div
      className="absolute pointer-events-none z-30 grid place-items-center"
      data-testid={hostTestId}
      data-target-anchor-id={targetAnchorId ?? targetSnapshot?.anchorId ?? ''}
      data-surface-id={targetSnapshot?.surfaceId ?? ''}
      style={resolvedSnapshotBox ? fxBoxStyle(resolvedSnapshotBox) : box ? fxBoxStyle(box) : { ...cellBox(getCellPosition, cell), overflow: 'visible' }}
    >
      <div className={sizeClassName}>
        <DelayedBurstParticles
          testId={burstTestId}
          delayMs={delayMs}
          preset={preset}
          color={color}
          quality={quality}
          overflow={overflow}
        />
      </div>
    </div>
  );
};

export interface BoardProjectileAttackPresetProps {
  source?: FxCellCoord;
  target?: FxCellCoord;
  getCellPosition: CellPositionResolver;
  sourceSnapshot?: FxAnchorSnapshot | null;
  targetSnapshot?: FxAnchorSnapshot | null;
  sourceBox?: FxBox | null;
  targetBox?: FxBox | null;
  sourceAnchorId?: string;
  targetAnchorId?: string;
  damage?: number;
  quality?: FxQuality;
  intensity?: 'normal' | 'strong';
  color?: string[];
  travelDurationMs?: number;
  completeMs?: number;
  hostTestId?: string;
  travelTestId?: string;
  sourceWakeTestId?: string;
  sourceBurstTestId?: string;
  travelMidBurstTestId?: string;
  damageHostTestId?: string;
  impactBurstTestId?: string;
  damageNumberTestId?: string;
  damageNumberFontScale?: number;
  damageNumberColorClass?: string;
  damageNumberDurationSeconds?: number;
  impactBurstPreset?: BoardBurstPresetName;
  impactBurstColors?: string[];
  impactBurstOverflow?: number;
  shakeDuration?: number;
  impactEffects?: ImpactEffects;
  damageFlashCompleteMs?: number;
  showSourceWake?: boolean;
  showMidBurst?: boolean;
  showImpactBurst?: boolean;
  pathPaddingCells?: number;
  pathMinSizeCells?: number;
  onImpact?: () => void;
  onComplete?: () => void;
}

export const BoardProjectileAttackPreset: React.FC<BoardProjectileAttackPresetProps> = ({
  source,
  target,
  getCellPosition,
  sourceBox,
  targetBox,
  sourceSnapshot,
  targetSnapshot,
  sourceAnchorId,
  targetAnchorId,
  damage = 1,
  quality = 'full',
  intensity = 'strong',
  color,
  travelDurationMs = BOARD_PROJECTILE_ATTACK_TIMING.travelDurationMs,
  completeMs,
  hostTestId = 'board-fx-projectile-attack-impact',
  travelTestId = 'board-fx-projectile-attack-travel',
  sourceWakeTestId,
  sourceBurstTestId,
  travelMidBurstTestId,
  damageHostTestId,
  impactBurstTestId,
  damageNumberTestId,
  damageNumberFontScale = 1.45,
  damageNumberColorClass = 'text-amber-50',
  damageNumberDurationSeconds = 1.2,
  impactBurstPreset = 'explosionStrong',
  impactBurstColors,
  impactBurstOverflow = 2.2,
  shakeDuration = 620,
  impactEffects = { shake: true, hitStop: true },
  damageFlashCompleteMs = 1_550,
  showSourceWake = false,
  showMidBurst = false,
  showImpactBurst = true,
  pathPaddingCells,
  pathMinSizeCells,
  onImpact,
  onComplete,
}) => {
  const hasTravel = Boolean(source && target && !sameCell(source, target));
  const resolvedCompleteMs = completeMs ?? (
    hasTravel
      ? BOARD_PROJECTILE_ATTACK_TIMING.rangedCompleteMs
      : BOARD_PROJECTILE_ATTACK_TIMING.sameCellCompleteMs
  );

  useTimedImpactAndComplete({
    active: Boolean(target),
    impactMs: hasTravel ? travelDurationMs : 0,
    completeMs: resolvedCompleteMs,
    onImpact,
    onComplete,
  });

  if (!target) return null;
  const resolvedTargetSnapshotBox = snapshotBox(targetSnapshot);

  return (
    <>
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
        intensity={intensity}
        quality={quality}
        color={color}
        travelDurationMs={travelDurationMs}
        showSourceWake={showSourceWake}
        showMidBurst={showMidBurst}
        sourceWakeTestId={sourceWakeTestId}
        sourceBurstTestId={sourceBurstTestId}
        travelTestId={travelTestId}
        travelMidBurstTestId={travelMidBurstTestId}
        pathPaddingCells={pathPaddingCells}
        pathMinSizeCells={pathMinSizeCells}
      />
      <div
        className="absolute pointer-events-none z-30 grid place-items-center"
        data-testid={hostTestId}
        data-target-anchor-id={targetAnchorId ?? targetSnapshot?.anchorId ?? ''}
        data-surface-id={targetSnapshot?.surfaceId ?? ''}
        style={resolvedTargetSnapshotBox ? fxBoxStyle(resolvedTargetSnapshotBox) : targetBox ? fxBoxStyle(targetBox) : { ...cellBox(getCellPosition, target), overflow: 'visible' }}
      >
        <BoardDamageImpactPreset
          damage={damage}
          quality={quality}
          delayMs={hasTravel ? travelDurationMs : 0}
          hostTestId={damageHostTestId}
          burstTestId={impactBurstTestId}
          numberTestId={damageNumberTestId}
          intensity={intensity}
          showImpactBurst={showImpactBurst}
          impactBurstPreset={impactBurstPreset}
          impactBurstColors={impactBurstColors}
          impactBurstOverflow={impactBurstOverflow}
          numberFontScale={damageNumberFontScale}
          numberColorClass={damageNumberColorClass}
          numberDurationSeconds={damageNumberDurationSeconds}
          shakeDuration={shakeDuration}
          impactEffects={impactEffects}
          damageFlashCompleteMs={damageFlashCompleteMs}
        />
      </div>
    </>
  );
};
