import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BurstParticles } from '../../../components/common/animations/BurstParticles';
import { ConeBlast } from '../../../components/common/animations/ConeBlast';
import { DamageFlash } from '../../../components/common/animations/DamageFlash';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { ImpactContainer } from '../../../components/common/animations/ImpactContainer';
import {
    createFxPathBox,
    createFxScaledCellBox,
    resolveFxQuality,
    type FxCellCoord,
    type FxQuality,
    type FxRendererProps,
} from '../../../engine/fx';

type AttackDieFaceId = 'burst' | 'hit2' | 'hit1' | 'blank';

const ATTACK_DIE_TEXTURE_SIZE = 1280;
const PROJECTILE_IMPACT_DELAY_MS = 1_060;
const PROJECTILE_IMPACT_DELAY_SECONDS = PROJECTILE_IMPACT_DELAY_MS / 1000;
const PROJECTILE_TRAVEL_DURATION_SCALE = 2.15;
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
    diceResults,
    effectDieResult,
    getCellPosition,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    diceResults: number[];
    effectDieResult?: number;
    getCellPosition: FxRendererProps['getCellPosition'];
}) {
    if (diceResults.length === 0) return null;

    const sourceBox = source ? getCellPosition(source.row, source.col) : getCellPosition(target.row, target.col);
    const targetBox = getCellPosition(target.row, target.col);
    const left = (sourceBox.left + sourceBox.width / 2 + targetBox.left + targetBox.width / 2) / 2;
    const top = (sourceBox.top + sourceBox.height / 2 + targetBox.top + targetBox.height / 2) / 2;

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

    useEffect(() => {
        if (!cell) {
            stableComplete();
            return undefined;
        }

        const impactTimer = window.setTimeout(() => {
            if (impactRef.current) return;
            impactRef.current = true;
            onImpact();
        }, impactMs);
        const completeTimer = window.setTimeout(stableComplete, completeMs);
        return () => {
            window.clearTimeout(impactTimer);
            window.clearTimeout(completeTimer);
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

function sameCell(a: FxCellCoord | undefined, b: FxCellCoord | undefined): boolean {
    return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function resolveEventQuality(event: FxRendererProps['event'], fallback: FxQuality = 'full'): FxQuality {
    return resolveFxQuality(event.params?.quality, resolveFxQuality(event.ctx.quality, fallback));
}

function fxColors(kind: 'spell' | 'attack' | 'push', strong = false): string[] {
    if (kind === 'attack') return ['#fff7ed', '#fca5a5', '#ef4444', '#7f1d1d'];
    if (kind === 'push') return ['#e0f2fe', '#bae6fd', '#38bdf8', '#0369a1'];
    return strong
        ? ['#fff7ed', '#fde68a', '#f59e0b', '#7c2d12']
        : ['#f0f9ff', '#bae6fd', '#38bdf8', '#1d4ed8'];
}

function DelayedBurstParticles({
    testId,
    delayMs = 0,
    preset,
    color,
    quality,
    overflow = 2.4,
}: {
    testId?: string;
    delayMs?: number;
    preset: React.ComponentProps<typeof BurstParticles>['preset'];
    color: string[];
    quality: FxQuality;
    overflow?: number;
}) {
    const [active, setActive] = React.useState(delayMs === 0);

    useEffect(() => {
        if (delayMs === 0) {
            setActive(true);
            return undefined;
        }
        const timer = window.setTimeout(() => setActive(true), delayMs);
        return () => window.clearTimeout(timer);
    }, [delayMs]);

    return (
        <div
            className="absolute inset-0 pointer-events-none"
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

function DelayedDamageImpact({
    delayMs,
    damage,
    quality,
}: {
    delayMs: number;
    damage: number;
    quality: FxQuality;
}) {
    const [active, setActive] = React.useState(delayMs === 0);

    useEffect(() => {
        if (delayMs === 0) {
            setActive(true);
            return undefined;
        }
        const timer = window.setTimeout(() => setActive(true), delayMs);
        return () => window.clearTimeout(timer);
    }, [delayMs]);

    return (
        <div
            className="absolute h-44 w-44"
            data-testid="mage-wars-fx-attack-damage-host"
        >
            <DelayedBurstParticles
                testId="mage-wars-fx-attack-impact-burst"
                delayMs={delayMs}
                preset="explosionStrong"
                color={fxColors('attack')}
                quality={quality}
                overflow={2.2}
            />
            <ImpactContainer
                isActive={active}
                damage={damage}
                effects={{ shake: true, hitStop: true }}
                shakeDuration={620}
                className="absolute inset-0"
                style={{ overflow: 'visible' }}
            >
                <DamageFlash
                    active={active}
                    damage={damage}
                    intensity="strong"
                    numberTestId="mage-wars-fx-attack-damage-float"
                    numberFontScale={1.75}
                    numberColorClass="text-amber-50"
                    quality={quality}
                    slashDurationMs={560}
                    slashActiveMs={220}
                    pulseDurationMs={620}
                    pulseActiveMs={620}
                    completeMs={1_050}
                />
            </ImpactContainer>
        </div>
    );
}

function BoardSourceWake({
    source,
    getCellPosition,
    kind,
    strong = false,
    quality,
}: {
    source?: FxCellCoord;
    getCellPosition: FxRendererProps['getCellPosition'];
    kind: 'spell' | 'attack' | 'push';
    strong?: boolean;
    quality: FxQuality;
}) {
    if (!source) return null;

    return (
        <div
            className="absolute pointer-events-none z-30 grid place-items-center"
            data-testid={`mage-wars-fx-${kind}-source-wake`}
            style={{ ...cellBox(getCellPosition, source), overflow: 'visible' }}
        >
            <div className="relative h-24 w-24">
                <DelayedBurstParticles
                    testId={`mage-wars-fx-${kind}-source-burst`}
                    preset={kind === 'attack' ? 'sparks' : 'magicDust'}
                    color={fxColors(kind, strong)}
                    quality={quality}
                    overflow={2.8}
                />
            </div>
        </div>
    );
}

function BoardTravelEffect({
    source,
    target,
    getCellPosition,
    kind,
    strong = false,
    quality,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    getCellPosition: FxRendererProps['getCellPosition'];
    kind: 'spell' | 'attack' | 'push';
    strong?: boolean;
    quality: FxQuality;
}) {
    if (!source) return null;

    const hasTravel = !sameCell(source, target);
    if (!hasTravel) return null;

    const pathBox = createFxPathBox(
        getCellPosition(source.row, source.col),
        getCellPosition(target.row, target.col),
        { paddingCells: 1.8, minSizeCells: 3 },
    );

    return (
        <div
            className="absolute pointer-events-none z-40"
            data-testid={`mage-wars-fx-${kind}-travel`}
            data-source-row={source.row}
            data-source-col={source.col}
            data-target-row={target.row}
            data-target-col={target.col}
            style={pathBox.style}
        >
            <ConeBlast
                start={pathBox.start}
                end={pathBox.end}
                intensity={kind === 'attack' || strong ? 'strong' : 'normal'}
                quality={quality}
                durationScale={PROJECTILE_TRAVEL_DURATION_SCALE}
            />
        </div>
    );
}

function BoardFxTravel({
    source,
    target,
    getCellPosition,
    kind,
    strong = false,
    quality,
}: {
    source?: FxCellCoord;
    target: FxCellCoord;
    getCellPosition: FxRendererProps['getCellPosition'];
    kind: 'spell' | 'attack' | 'push';
    strong?: boolean;
    quality: FxQuality;
}) {
    return (
        <>
            <BoardSourceWake
                source={source}
                getCellPosition={getCellPosition}
                kind={kind}
                strong={strong}
                quality={quality}
            />
            <BoardTravelEffect
                source={source}
                target={target}
                getCellPosition={getCellPosition}
                kind={kind}
                strong={strong}
                quality={quality}
            />
        </>
    );
}

export const SpellCastRenderer: React.FC<FxRendererProps> = ({
    event,
    getCellPosition,
    onComplete,
    onImpact,
}) => {
    const cell = event.ctx.cell;
    const source = event.params?.source as FxCellCoord | undefined;
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(cell, onImpact, onComplete, hasTravel ? PROJECTILE_IMPACT_DELAY_MS : 180, hasTravel ? 1_800 : 950);

    if (!cell) return null;
    const strong = event.ctx.intensity === 'strong';

    return (
        <>
            <BoardProjectileTravel
                source={source}
                target={cell}
                getCellPosition={getCellPosition}
                kind="spell"
                strong={strong}
            />
            <div
                className="absolute pointer-events-none z-30 grid place-items-center"
                data-testid="mage-wars-fx-spell-cast"
                style={{ ...cellBox(getCellPosition, cell), overflow: 'visible' }}
            >
                <motion.div
                    className="absolute h-24 w-24 rounded-full"
                    style={{
                        background: strong
                            ? 'radial-gradient(circle, rgba(251,191,36,.72) 0%, rgba(249,115,22,.32) 38%, transparent 72%)'
                            : 'radial-gradient(circle, rgba(125,211,252,.68) 0%, rgba(59,130,246,.28) 38%, transparent 72%)',
                        filter: 'blur(2px)',
                    }}
                    initial={{ opacity: 0, scale: 0.2, rotate: -20 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.2, 1.15, 1.55], rotate: 28 }}
                    transition={{ duration: 0.9, delay: hasTravel ? PROJECTILE_IMPACT_DELAY_SECONDS : 0, ease: 'easeOut' }}
                />
                <motion.div
                    className="absolute h-16 w-16 rounded-full"
                    style={{
                        boxShadow: strong
                            ? '0 0 34px rgba(251,191,36,.82), inset 0 0 24px rgba(249,115,22,.4)'
                            : '0 0 30px rgba(125,211,252,.76), inset 0 0 20px rgba(59,130,246,.35)',
                    }}
                    initial={{ opacity: 0, scale: 0.35 }}
                    animate={{ opacity: [0, 0.9, 0], scale: [0.35, 1.05, 1.42] }}
                    transition={{ duration: 0.78, delay: hasTravel ? PROJECTILE_IMPACT_DELAY_SECONDS : 0, ease: 'easeOut' }}
                />
                <motion.div
                    className="absolute h-2 w-2 rounded-full bg-amber-100"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.4, strong ? 3.2 : 2.4, 0.6] }}
                    transition={{ duration: 0.62, delay: hasTravel ? PROJECTILE_IMPACT_DELAY_SECONDS : 0, ease: 'easeOut' }}
                />
            </div>
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
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(cell, onImpact, onComplete, hasTravel ? PROJECTILE_IMPACT_DELAY_MS : 80, hasTravel ? 1_600 : 780);

    if (!cell) return null;

    return (
        <>
            <BoardProjectileTravel
                source={source}
                target={cell}
                getCellPosition={getCellPosition}
                kind="push"
            />
            <div
                className="absolute pointer-events-none z-30 grid place-items-center"
                data-testid="mage-wars-fx-spell-push"
                style={{ ...cellBox(getCellPosition, cell), overflow: 'visible' }}
            >
                {[0, 1, 2].map((index) => (
                    <motion.div
                        key={index}
                        className="absolute h-3 rounded-full"
                        style={{
                            width: `${72 - index * 12}px`,
                            background: 'linear-gradient(90deg, transparent, rgba(186,230,253,.88), rgba(125,211,252,.28), transparent)',
                            filter: 'blur(.5px)',
                        }}
                        initial={{ opacity: 0, x: -42, y: -16 + index * 16, scaleX: 0.35 }}
                        animate={{ opacity: [0, 1, 0], x: 46, scaleX: [0.35, 1, 0.65] }}
                        transition={{ duration: 0.52, delay: (hasTravel ? 0.36 : 0) + index * 0.08, ease: 'easeOut' }}
                    />
                ))}
                <motion.div
                    className="absolute h-16 w-16 rounded-full border border-sky-100/65"
                    initial={{ opacity: 0, scale: 0.45 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.45, 1.05, 1.35] }}
                    transition={{ duration: 0.66, delay: hasTravel ? PROJECTILE_IMPACT_DELAY_SECONDS : 0, ease: 'easeOut' }}
                />
            </div>
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
    const hasTravel = Boolean(source && cell && !sameCell(source, cell));
    useTimedImpactAndComplete(cell, onImpact, onComplete, hasTravel ? PROJECTILE_IMPACT_DELAY_MS : 0, hasTravel ? 2_000 : 1_450);

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;
    const diceResults = Array.isArray(event.params?.diceResults)
        ? event.params.diceResults.filter((result): result is number => typeof result === 'number')
        : [];
    const effectDieResult = typeof event.params?.effectDieResult === 'number'
        ? event.params.effectDieResult
        : undefined;

    return (
        <>
            <BoardProjectileTravel
                source={source}
                target={cell}
                getCellPosition={getCellPosition}
                kind="attack"
            />
            <div
                className="absolute pointer-events-none z-30 grid place-items-center"
                data-testid="mage-wars-fx-attack-impact"
                style={{ ...cellBox(getCellPosition, cell), overflow: 'visible' }}
            >
                <motion.div
                    className="h-20 w-20 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(248,113,113,.56) 0%, rgba(127,29,29,.26) 42%, transparent 74%)',
                        boxShadow: '0 0 32px rgba(248,113,113,.48)',
                    }}
                    initial={{ opacity: 0, scale: 0.55 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.55, 1.12, 1.45] }}
                    transition={{ duration: 0.55, delay: hasTravel ? PROJECTILE_IMPACT_DELAY_SECONDS : 0, ease: 'easeOut' }}
                />
                <div
                    className="absolute h-36 w-36"
                    data-testid="mage-wars-fx-attack-damage-host"
                >
                    <DamageFlash
                        active
                        damage={damage}
                        intensity="strong"
                        startDelayMs={hasTravel ? PROJECTILE_IMPACT_DELAY_MS : 0}
                        numberTestId="mage-wars-fx-attack-damage-float"
                        numberFontScale={1.45}
                        numberColorClass="text-amber-50"
                        completeMs={620}
                    />
                </div>
            </div>
            <AttackDiceFeedback
                source={source}
                target={cell}
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
    useTimedImpactAndComplete(cell, onImpact, onComplete, 0, 850);

    if (!cell) return null;
    const damage = (event.params?.damageAmount as number | undefined) ?? 1;
    const pos = cellBox(getCellPosition, cell);

    return (
        <div
            className="absolute pointer-events-none z-30 flex items-center justify-center"
            data-testid="mage-wars-fx-damage-impact"
            style={{ ...pos, overflow: 'visible' }}
        >
            <div className="relative h-20 w-20">
                <ImpactContainer
                    isActive
                    damage={damage}
                    effects={{ shake: true, hitStop: false }}
                    className="absolute inset-0"
                    onComplete={onComplete}
                >
                    <DamageFlash
                        active
                        damage={damage}
                        intensity={event.ctx.intensity ?? 'normal'}
                        completeMs={780}
                    />
                </ImpactContainer>
            </div>
        </div>
    );
};
