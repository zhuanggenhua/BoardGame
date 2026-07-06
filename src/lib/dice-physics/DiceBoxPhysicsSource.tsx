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
}

export interface DiceBoxPhysicsSourceProps {
    dice: DicePhysicsDieInput[];
    isRolling: boolean;
    rerollingDiceIds?: number[];
    styleProfile?: DiceBoxStyleProfile;
    dieSkins?: Array<DiceBoxDieSkin | null>;
    rendererMode?: DicePhysicsRendererMode;
    canvasTestId?: string;
    className?: string;
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
    rendererMode = 'physics-only',
    canvasTestId,
    className,
    testId = 'dice-box-physics-source',
    dataAttributes,
    onPhysicsStatesChange,
}: DiceBoxPhysicsSourceProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const engineRef = React.useRef<DiceBoxThreeEngine | null>(null);
    const previousDiceIdsRef = React.useRef<number[]>([]);
    const activeMotionRef = React.useRef<{ type: 'roll' | 'reroll'; key: string } | null>(null);
    const settledRef = React.useRef(true);
    const [engineVersion, setEngineVersion] = React.useState(0);
    const [engineReady, setEngineReady] = React.useState(false);
    const [settled, setSettled] = React.useState(true);

    const values = React.useMemo(() => dice.map((die) => die.value), [dice]);
    const valuesKey = React.useMemo(() => values.join(','), [values]);
    const rerollIds = React.useMemo(
        () => [...(rerollingDiceIds ?? [])].sort((left, right) => left - right),
        [rerollingDiceIds],
    );
    const rerollKey = React.useMemo(() => rerollIds.join(','), [rerollIds]);

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
                    skinsReady: false,
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
    }, [canvasTestId, rendererMode, styleProfile]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;
        if (dieSkins) {
            engine.setDieSkins(dieSkins);
            engine.setCanvasDiagnostics({
                settled: settledRef.current,
                skinsReady: dieSkins.length > 0,
            });
        }
    }, [dieSkins, engineVersion]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        let frameId = 0;
        const tick = () => {
            const states = dice
                .map((die, index) => engine.getPhysicsState(index, die.id, settledRef.current))
                .filter((state): state is DicePhysicsState => Boolean(state));
            onPhysicsStatesChange?.(states);
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
                setSettledState(false);
                if (activeMotionRef.current?.type !== 'roll') {
                    activeMotionRef.current = { type: 'roll', key: valuesKey };
                    try {
                        await engine.rollToValues(values);
                    } finally {
                        if (activeMotionRef.current?.type === 'roll') {
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
                            await engine.rerollToValues(rerollIndices, values);
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

            engine.syncValues(values);
            previousDiceIdsRef.current = dice.map((die) => die.id);
            setSettledState(true);
        };

        void run();
    }, [dice, engineReady, isRolling, rerollIds, rerollKey, setSettledState, values, valuesKey]);

    return (
        <div
            ref={containerRef}
            className={className}
            data-testid={testId}
            data-dice-physics-source="dice-box-threejs"
            data-dice-physics-mode={rendererMode}
            data-dice-settled={settled ? 'true' : 'false'}
            {...dataAttributes}
        />
    );
}
