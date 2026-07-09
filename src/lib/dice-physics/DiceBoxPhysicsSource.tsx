import React from 'react';

import {
    DiceBoxThreeEngine,
    type DiceBoxDieSkin,
    type DiceBoxStyleProfile,
} from '../dice-box-threejs/engine';
import type { DicePhysicsRendererMode, DicePhysicsState } from './types';

export interface DicePhysicsDieInput {
    id: number;
    value: number;
    isKept?: boolean;
}

export interface DiceBoxPhysicsSourceProps {
    dice: DicePhysicsDieInput[];
    isRolling: boolean;
    rerollingDiceIds?: number[];
    styleProfile?: DiceBoxStyleProfile;
    dieSkins?: Array<DiceBoxDieSkin | null>;
    requireDieSkins?: boolean;
    rendererMode?: DicePhysicsRendererMode;
    canvasTestId?: string;
    className?: string;
    style?: React.CSSProperties;
    testId?: string;
    dataAttributes?: Record<string, string>;
    onPhysicsStatesChange?: (states: DicePhysicsState[]) => void;
}

export function DiceBoxPhysicsSource({
    dice,
    isRolling,
    rerollingDiceIds,
    styleProfile,
    dieSkins,
    requireDieSkins = false,
    rendererMode = 'physics-only',
    canvasTestId,
    className,
    style,
    testId = 'dice-box-physics-source',
    dataAttributes,
    onPhysicsStatesChange,
}: DiceBoxPhysicsSourceProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const engineRef = React.useRef<DiceBoxThreeEngine | null>(null);
    const previousDiceIdsRef = React.useRef<number[]>([]);
    const activeMotionRef = React.useRef<{ type: 'roll' | 'reroll'; key: string } | null>(null);
    const settledRef = React.useRef(true);
    const lastPhysicsSnapshotRef = React.useRef('');
    const [engineVersion, setEngineVersion] = React.useState(0);
    const [engineReady, setEngineReady] = React.useState(false);
    const [settled, setSettled] = React.useState(true);

    const values = React.useMemo(() => dice.map((die) => die.value), [dice]);
    const valuesKey = React.useMemo(() => values.join(','), [values]);
    const rollingIndices = React.useMemo(
        () => dice
            .map((die, index) => (die.isKept ? -1 : index))
            .filter((index) => index >= 0),
        [dice],
    );
    const lockedIndices = React.useMemo(
        () => dice
            .map((die, index) => (die.isKept ? index : -1))
            .filter((index) => index >= 0),
        [dice],
    );
    const rollingKey = React.useMemo(
        () => `${valuesKey}|${rollingIndices.join(',')}`,
        [rollingIndices, valuesKey],
    );
    const rerollIds = React.useMemo(
        () => [...(rerollingDiceIds ?? [])]
            .filter((dieId) => !dice.find((die) => die.id === dieId)?.isKept)
            .sort((left, right) => left - right),
        [dice, rerollingDiceIds],
    );
    const rerollKey = React.useMemo(() => rerollIds.join(','), [rerollIds]);
    const requiredDieSkinsReady = React.useMemo(
        () => !requireDieSkins
            || dice.length === 0
            || (Array.isArray(dieSkins)
                && dieSkins.length >= dice.length
                && dieSkins.slice(0, dice.length).every(Boolean)),
        [dice.length, dieSkins, requireDieSkins],
    );

    const setSettledState = React.useCallback((nextSettled: boolean) => {
        settledRef.current = nextSettled;
        engineRef.current?.setCanvasDiagnostics({
            settled: nextSettled,
        });
        setSettled(nextSettled);
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const container = containerRef.current;
            if (!container || engineRef.current) return;
            try {
                const engine = await DiceBoxThreeEngine.create(container, {
                    styleProfile,
                    rendererMode,
                    canvasTestId,
                });
                if (cancelled) {
                    engine.destroy();
                    return;
                }
                engineRef.current = engine;
                engine.resize();
                engine.setCanvasDiagnostics({
                    settled: settledRef.current,
                    skinsReady: !requireDieSkins || dice.length === 0,
                });
                setEngineReady(true);
                setEngineVersion((count) => count + 1);
            } catch {
                if (cancelled) return;
                engineRef.current = null;
                setEngineReady(false);
            }
        };

        void init();

        return () => {
            cancelled = true;
            activeMotionRef.current = null;
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, [canvasTestId, dice.length, rendererMode, requireDieSkins, styleProfile]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        if (dieSkins) {
            engine.setDieSkins(dieSkins);
            engine.setCanvasDiagnostics({
                settled: settledRef.current,
                skinsReady: requiredDieSkinsReady,
            });
        }
    }, [dieSkins, engineVersion, requiredDieSkinsReady]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        let frameId = 0;
        let lastEmitAt = 0;
        const tick = () => {
            const now = performance.now();
            const minIntervalMs = settledRef.current ? 120 : 33;
            if (now - lastEmitAt < minIntervalMs) {
                frameId = window.requestAnimationFrame(tick);
                return;
            }
            lastEmitAt = now;
            if (!settledRef.current || activeMotionRef.current) {
                engine.recoverOutOfBoundsDice();
            }

            const states = dice
                .map((die, index) => engine.getPhysicsState(index, die.id, settledRef.current))
                .filter((state): state is DicePhysicsState => Boolean(state));

            const snapshot = states.map((state) => [
                state.id,
                Math.round(state.layout.x),
                Math.round(state.layout.y),
                Math.round(state.layout.width),
                Math.round(state.layout.height),
                state.motion.rotateX.toFixed(2),
                state.motion.rotateY.toFixed(2),
                state.motion.rotateZ.toFixed(2),
                state.settled ? '1' : '0',
            ].join(':')).join('|');

            if (snapshot !== lastPhysicsSnapshotRef.current) {
                lastPhysicsSnapshotRef.current = snapshot;
                onPhysicsStatesChange?.(states);
            }
            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver === 'function' && containerRef.current) {
            observer = new ResizeObserver(() => engine.resize());
            observer.observe(containerRef.current);
        }

        return () => {
            window.cancelAnimationFrame(frameId);
            observer?.disconnect();
        };
    }, [dice, engineVersion, onPhysicsStatesChange]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engineReady || !engine) return;
        if (!requiredDieSkinsReady) {
            engine.setCanvasDiagnostics({
                settled: true,
                skinsReady: false,
            });
            return;
        }

        const run = async () => {
            if (dice.length === 0) {
                if (previousDiceIdsRef.current.length > 0) {
                    await engine.removeDice(previousDiceIdsRef.current.map((_, index) => index).reverse());
                    previousDiceIdsRef.current = [];
                } else {
                    engine.clear();
                }
                setSettledState(true);
                return;
            }

            if (isRolling) {
                if (engine.hasDice(dice.length) && rollingIndices.length === 0) {
                    engine.syncSettledValues(values);
                    previousDiceIdsRef.current = dice.map((die) => die.id);
                    setSettledState(true);
                    return;
                }
                setSettledState(false);
                if (activeMotionRef.current?.type !== 'roll' || activeMotionRef.current.key !== rollingKey) {
                    activeMotionRef.current = { type: 'roll', key: rollingKey };
                    try {
                        if (engine.hasDice(dice.length)) {
                            await engine.rerollToValues(rollingIndices, values, lockedIndices);
                        } else {
                            await engine.rollToValues(values);
                        }
                    } finally {
                        if (activeMotionRef.current?.type === 'roll' && activeMotionRef.current.key === rollingKey) {
                            activeMotionRef.current = null;
                        }
                        previousDiceIdsRef.current = dice.map((die) => die.id);
                        setSettledState(true);
                    }
                    return;
                }
                engine.previewValues(values);
                return;
            }

            if (rerollIds.length > 0) {
                const rerollIndices = rerollIds
                    .map((dieId) => dice.findIndex((die) => die.id === dieId))
                    .filter((index) => index >= 0);
                if (rerollIndices.length > 0) {
                    setSettledState(false);
                    if (activeMotionRef.current?.type !== 'reroll' || activeMotionRef.current.key !== rerollKey) {
                        activeMotionRef.current = { type: 'reroll', key: rerollKey };
                        try {
                            await engine.rerollToValues(rerollIndices, values, lockedIndices);
                        } finally {
                            if (activeMotionRef.current?.type === 'reroll' && activeMotionRef.current.key === rerollKey) {
                                activeMotionRef.current = null;
                            }
                            previousDiceIdsRef.current = dice.map((die) => die.id);
                            setSettledState(true);
                        }
                    }
                    return;
                }
            }

            if (activeMotionRef.current) return;

            if (!engine.hasDice(dice.length)) {
                const previousIds = previousDiceIdsRef.current;
                const removedIndices = previousIds
                    .map((dieId, index) => (dice.some((die) => die.id === dieId) ? -1 : index))
                    .filter((index) => index >= 0)
                    .sort((left, right) => right - left);
                if (previousIds.length > dice.length && removedIndices.length === previousIds.length - dice.length) {
                    setSettledState(false);
                    await engine.removeDice(removedIndices);
                    engine.syncValues(values);
                    previousDiceIdsRef.current = dice.map((die) => die.id);
                    setSettledState(true);
                    return;
                }

                setSettledState(true);
                await engine.restoreValues(values);
                previousDiceIdsRef.current = dice.map((die) => die.id);
                setSettledState(true);
                return;
            }

            engine.syncSettledValues(values);
            previousDiceIdsRef.current = dice.map((die) => die.id);
            setSettledState(true);
        };

        void run();
    }, [dice, engineReady, isRolling, lockedIndices, rerollIds, rerollKey, requiredDieSkinsReady, rollingIndices, rollingKey, setSettledState, values]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={style}
            data-testid={testId}
            data-dice-physics-source="dice-box-threejs"
            data-dice-physics-mode={rendererMode}
            data-dice-settled={settled ? 'true' : 'false'}
            data-dice-skins-ready={requiredDieSkinsReady ? 'true' : 'false'}
            {...dataAttributes}
        />
    );
}
