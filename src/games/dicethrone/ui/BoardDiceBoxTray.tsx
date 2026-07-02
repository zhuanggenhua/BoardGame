import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import {
    DiceBoxThreeEngine,
    type DiceBoxMotionSnapshot,
    type DiceBoxProjectedLayout,
} from '../../../lib/dice-box-threejs/engine';
import { Dice3D } from './Dice3D';
import { resolveCharacterIdFromDiceDefinitionId } from './assets';
import { DICETHRONE_DICE_BOX_STYLE_PROFILE } from './diceBoxStyleProfiles';
import { loadDiceThroneDiceBoxSkins, type DiceThroneDiceBoxSkin } from './diceThroneDiceBoxSkins';

type BoardDisplayDie = {
    id: number;
    displayValue: number;
    isKept: boolean;
    selected: boolean;
    clickable: boolean;
    definitionId?: string;
};

type LockedLabelLayout = {
    x: number;
    y: number;
};

type DepartingDieAnimation = {
    die: BoardDisplayDie;
    fromLayout: DiceBoxProjectedLayout;
    startedAt: number;
};

type PreviousBoardDie = {
    die: BoardDisplayDie;
};

const FALLBACK_BOARD_DICE_SLOTS = [
    { left: '16%', top: '69%', rotate: '-18deg', zIndex: 5 },
    { left: '34%', top: '31%', rotate: '14deg', zIndex: 2 },
    { left: '52%', top: '59%', rotate: '-8deg', zIndex: 4 },
    { left: '70%', top: '29%', rotate: '18deg', zIndex: 1 },
    { left: '84%', top: '53%', rotate: '-14deg', zIndex: 3 },
] as const;

const DEPARTING_DIE_DURATION_MS = 420;

const RAIL_EXIT_TARGET = {
    x: 'calc(100% + 7vw)',
    y: '78%',
    scale: 0.72,
    opacity: 0,
    rotate: 18,
};

type BoardDiceBoxState = 'loading' | 'ready' | 'failed';

export const BoardDiceBoxTray = ({
    dice,
    isRolling,
    rerollingDiceIds,
    onDieClick,
    locale,
}: {
    dice: BoardDisplayDie[];
    isRolling: boolean;
    rerollingDiceIds?: number[];
    onDieClick: (dieId: number) => void;
    locale?: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const engineRef = React.useRef<DiceBoxThreeEngine | null>(null);
    const engineReadyRef = React.useRef(false);
    const dieSkinsRef = React.useRef<Array<DiceThroneDiceBoxSkin | null>>([]);
    const activeMotionRef = React.useRef<{ type: 'roll' | 'reroll'; key: string } | null>(null);
    const previousDiceIdsRef = React.useRef<number[]>([]);
    const previousDiceByIdRef = React.useRef<Record<number, PreviousBoardDie>>({});
    const [engineVersion, setEngineVersion] = React.useState(0);
    const [projectedLayouts, setProjectedLayouts] = React.useState<Record<number, DiceBoxProjectedLayout>>({});
    const [motionSnapshots, setMotionSnapshots] = React.useState<Record<number, DiceBoxMotionSnapshot>>({});
    const [lockedLabelLayouts, setLockedLabelLayouts] = React.useState<Record<number, LockedLabelLayout>>({});
    const [departingDice, setDepartingDice] = React.useState<Record<number, DepartingDieAnimation>>({});
    const [engineState, setEngineState] = React.useState<BoardDiceBoxState>('loading');
    const [diceSettled, setDiceSettled] = React.useState(false);
    const [skinsReady, setSkinsReady] = React.useState(false);

    const values = React.useMemo(() => dice.map((die) => die.displayValue), [dice]);
    const valuesKey = React.useMemo(() => values.join(','), [values]);
    const rerollIds = React.useMemo(
        () => [...(rerollingDiceIds ?? [])].sort((a, b) => a - b),
        [rerollingDiceIds],
    );
    const rerollKey = React.useMemo(() => rerollIds.join(','), [rerollIds]);
    const skinDefinitionIdsKey = React.useMemo(
        () => dice.map((die) => die.definitionId ?? '').join('|'),
        [dice],
    );
    const skinDefinitions = React.useMemo(
        () => skinDefinitionIdsKey.split('|').map((definitionId) => ({
            definitionId: definitionId || undefined,
        })),
        [skinDefinitionIdsKey],
    );
    const skinKey = `${locale ?? 'zh-CN'}|${skinDefinitionIdsKey}`;

    React.useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const container = containerRef.current;
            if (!container || engineRef.current) return;
            try {
                const engine = await DiceBoxThreeEngine.create(container, {
                    styleProfile: DICETHRONE_DICE_BOX_STYLE_PROFILE,
                });
                if (cancelled) {
                    engine.destroy();
                    return;
                }
                engineRef.current = engine;
                engineReadyRef.current = true;
                if (dieSkinsRef.current.length > 0) {
                    engine.setDieSkins(dieSkinsRef.current);
                }
                engine.resize();
                setEngineState('ready');
                setEngineVersion((count) => count + 1);
            } catch {
                if (cancelled) return;
                engineReadyRef.current = false;
                engineRef.current = null;
                setEngineState('failed');
            }
        };

        void init();

        return () => {
            cancelled = true;
            engineReadyRef.current = false;
            activeMotionRef.current = null;
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        setSkinsReady(false);

        void loadDiceThroneDiceBoxSkins(skinDefinitions, locale ?? 'zh-CN').then((skins) => {
            if (cancelled) return;
            dieSkinsRef.current = skins;
            engineRef.current?.setDieSkins(skins);
            setSkinsReady(true);
            setEngineVersion((count) => count + 1);
        });

        return () => {
            cancelled = true;
        };
    }, [locale, skinDefinitions, skinKey]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        const update = () => {
            const nextLayouts: Record<number, DiceBoxProjectedLayout> = {};
            const nextSnapshots: Record<number, DiceBoxMotionSnapshot> = {};
            const nextLockedLayouts: Record<number, LockedLabelLayout> = {};
            dice.forEach((die, index) => {
                const layout = engine.getProjectedLayout(index, die.id);
                if (layout) {
                    nextLayouts[die.id] = layout;
                    if (die.isKept && !die.selected) {
                        nextLockedLayouts[die.id] = {
                            x: layout.x,
                            y: layout.y + (layout.height * 0.58),
                        };
                    }
                }
                const snapshot = engine.getMotionSnapshot(index);
                if (snapshot) {
                    nextSnapshots[die.id] = snapshot;
                }
            });
            setProjectedLayouts(nextLayouts);
            setMotionSnapshots(nextSnapshots);
            setLockedLabelLayouts(nextLockedLayouts);
        };

        let frameId = 0;
        const tick = () => {
            update();
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
    }, [dice, engineVersion]);

    React.useEffect(() => {
        previousDiceByIdRef.current = dice.reduce<Record<number, PreviousBoardDie>>((next, die) => {
            next[die.id] = { die };
            return next;
        }, {});
    }, [dice]);

    React.useEffect(() => {
        const engine = engineRef.current;
        if (!engineReadyRef.current || !engine || !skinsReady) return;

        const run = async () => {
            if (dice.length === 0) {
                if (previousDiceIdsRef.current.length > 0) {
                    await engine.removeDice(previousDiceIdsRef.current.map((_, index) => index).reverse());
                    previousDiceIdsRef.current = [];
                } else {
                    engine.clear();
                }
                setProjectedLayouts({});
                setDiceSettled(true);
                return;
            }

            if (isRolling) {
                setDiceSettled(false);
                if (activeMotionRef.current?.type !== 'roll') {
                    activeMotionRef.current = { type: 'roll', key: valuesKey };
                    try {
                        await engine.rollToValues(values);
                    } finally {
                        if (activeMotionRef.current?.type === 'roll') {
                            activeMotionRef.current = null;
                        }
                        setDiceSettled(true);
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
                    setDiceSettled(false);
                    if (activeMotionRef.current?.type !== 'reroll' || activeMotionRef.current.key !== rerollKey) {
                        activeMotionRef.current = { type: 'reroll', key: rerollKey };
                        try {
                            await engine.rerollToValues(rerollIndices, values);
                        } finally {
                            if (activeMotionRef.current?.type === 'reroll' && activeMotionRef.current.key === rerollKey) {
                                activeMotionRef.current = null;
                            }
                            setDiceSettled(true);
                        }
                    }
                    return;
                }
            }

            if (activeMotionRef.current) {
                return;
            }

            if (!engine.hasDice(dice.length)) {
                const previousIds = previousDiceIdsRef.current;
                const previousDiceById = previousDiceByIdRef.current;
                const removedIndices = previousIds
                    .map((dieId, index) => (dice.some((die) => die.id === dieId) ? -1 : index))
                    .filter((index) => index >= 0)
                    .sort((left, right) => right - left);
                if (previousIds.length > dice.length && removedIndices.length === previousIds.length - dice.length) {
                    const removedIdSet = new Set(removedIndices.map((index) => previousIds[index]));
                    setDepartingDice((prev) => {
                        const now = Date.now();
                        const next = { ...prev };
                        for (const removedId of removedIdSet) {
                            const previousLayout = projectedLayouts[removedId];
                            const sourceDie = previousDiceById[removedId]?.die;
                            if (!previousLayout) continue;
                            const dieFromPreviousState: BoardDisplayDie = sourceDie
                                ? { ...sourceDie, isKept: true, selected: false, clickable: false }
                                : {
                                    id: removedId,
                                    displayValue: values[previousIds.indexOf(removedId)] ?? 1,
                                    isKept: true,
                                    selected: false,
                                    clickable: false,
                                };
                            next[removedId] = {
                                die: dieFromPreviousState,
                                fromLayout: previousLayout,
                                startedAt: now,
                            };
                        }
                        return next;
                    });
                    setDiceSettled(false);
                    await engine.removeDice(removedIndices);
                    engine.syncValues(values);
                    previousDiceIdsRef.current = dice.map((die) => die.id);
                    activeMotionRef.current = null;
                    setDiceSettled(true);
                    return;
                }

                setDiceSettled(false);
                await engine.rollToValues(values);
                previousDiceIdsRef.current = dice.map((die) => die.id);
                activeMotionRef.current = null;
                setDiceSettled(true);
                return;
            }

            engine.syncValues(values);
            previousDiceIdsRef.current = dice.map((die) => die.id);
            activeMotionRef.current = null;
            setDiceSettled(true);
        };

        void run();
    }, [dice, engineVersion, isRolling, projectedLayouts, rerollIds, rerollKey, skinsReady, values, valuesKey]);

    React.useEffect(() => {
        const ids = Object.keys(departingDice);
        if (ids.length === 0) return;

        const timeoutId = window.setTimeout(() => {
            setDepartingDice((prev) => {
                const now = Date.now();
                const next = { ...prev };
                for (const [id, animation] of Object.entries(prev)) {
                    if (now - animation.startedAt >= DEPARTING_DIE_DURATION_MS) {
                        delete next[Number(id)];
                    }
                }
                return next;
            });
        }, DEPARTING_DIE_DURATION_MS);

        return () => window.clearTimeout(timeoutId);
    }, [departingDice]);

    const renderFallbackDice = () => (
        <div
            className="absolute inset-0"
            data-testid="dicethrone-board-dice-box-fallback"
            data-engine-state={engineState}
        >
            {dice.map((die, index) => {
                const slot = FALLBACK_BOARD_DICE_SLOTS[index % FALLBACK_BOARD_DICE_SLOTS.length];
                const fallbackRolling = (isRolling && !die.isKept) || rerollIds.includes(die.id);

                return (
                    <button
                        key={die.id}
                        type="button"
                        onClick={() => die.clickable && onDieClick(die.id)}
                        data-testid={`die-button-${die.id}`}
                        data-render-mode="fallback"
                        data-selected={die.selected ? 'true' : 'false'}
                        data-clickable={die.clickable ? 'true' : 'false'}
                        data-display-value={die.displayValue}
                        className={clsx(
                            'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition-all duration-150',
                            die.clickable ? 'cursor-pointer' : 'cursor-default',
                        )}
                        style={{
                            left: slot.left,
                            top: slot.top,
                            zIndex: slot.zIndex,
                            transform: `translate(-50%, -50%) rotate(${slot.rotate})`,
                        }}
                    >
                        <div
                            className={clsx(
                                'rounded-[1rem] border transition-all duration-150',
                                die.selected
                                    ? 'border-amber-300/70 shadow-[0_0_0_2px_rgba(251,191,36,0.38),0_0_24px_rgba(245,158,11,0.26)]'
                                    : 'border-transparent',
                            )}
                        >
                            <Dice3D
                                value={die.displayValue}
                                isRolling={fallbackRolling}
                                size="clamp(46px, 4.7vw, 82px)"
                                locale={locale}
                                variant="default"
                                characterId={resolveCharacterIdFromDiceDefinitionId(die.definitionId)}
                                definitionId={die.definitionId}
                                enableWebgl={false}
                            />
                        </div>
                        {die.isKept && !die.selected && (
                            <span className="pointer-events-none rounded bg-black/58 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/15">
                                {t('dice.locked')}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="relative h-full w-full">
            <div className="pointer-events-none absolute left-1/2 top-[72%] h-[20%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35 blur-3xl" />
            <div
                ref={containerRef}
                className="absolute inset-0 overflow-hidden rounded-[1.4vw]"
                data-testid="dicethrone-board-dice-box-canvas"
                data-dice-settled={diceSettled ? 'true' : 'false'}
                data-skins-ready={skinsReady ? 'true' : 'false'}
            />
            {(engineState !== 'ready' || !skinsReady) && renderFallbackDice()}
            {engineState === 'ready' && skinsReady && (
                <div className="absolute inset-0">
                    <div className="pointer-events-none absolute inset-0">
                        {dice.map((die) => {
                            if (!die.selected) return null;
                            const layout = projectedLayouts[die.id];
                            if (!layout) return null;
                            const arcWidth = Math.max(layout.width, layout.height) * 0.9;
                            const arcHeight = arcWidth * 0.56;

                            return (
                                <div
                                    key={`underlay-${die.id}`}
                                    className="absolute"
                                    style={{
                                        left: `${layout.x}px`,
                                        top: `${layout.y + (layout.height * 0.16)}px`,
                                        width: `${arcWidth}px`,
                                        height: `${arcHeight}px`,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 8,
                                    }}
                                >
                                    <div
                                        className="absolute inset-0 rounded-[999px] border border-t-transparent"
                                        style={{
                                            borderWidth: '4px',
                                            borderColor: 'rgba(92, 43, 8, 0.58)',
                                            borderTopColor: 'transparent',
                                            filter: 'drop-shadow(0 0 8px rgba(60, 24, 4, 0.35))',
                                        }}
                                    />
                                    <div
                                        className="absolute inset-[6%] rounded-[999px] border border-t-transparent"
                                        style={{
                                            borderWidth: '3px',
                                            borderColor: 'rgba(247, 196, 78, 0.96)',
                                            borderTopColor: 'transparent',
                                            filter: 'drop-shadow(0 0 10px rgba(247, 196, 78, 0.38))',
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <AnimatePresence>
                        {Object.values(departingDice).map(({ die, fromLayout }) => (
                            <motion.div
                                key={`departing-die-${die.id}`}
                                className="pointer-events-none absolute"
                                data-testid={`departing-die-${die.id}`}
                                initial={{
                                    left: fromLayout.x,
                                    top: fromLayout.y,
                                    width: fromLayout.width,
                                    height: fromLayout.height,
                                    x: '-50%',
                                    y: '-50%',
                                    scale: 1,
                                    opacity: 0.9,
                                    rotate: 0,
                                }}
                                animate={{
                                    left: RAIL_EXIT_TARGET.x,
                                    top: RAIL_EXIT_TARGET.y,
                                    x: '-50%',
                                    y: '-50%',
                                    scale: RAIL_EXIT_TARGET.scale,
                                    opacity: RAIL_EXIT_TARGET.opacity,
                                    rotate: RAIL_EXIT_TARGET.rotate,
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: DEPARTING_DIE_DURATION_MS / 1000, ease: [0.22, 0.8, 0.32, 1] }}
                                style={{ zIndex: 22 }}
                            >
                                <Dice3D
                                    value={die.displayValue}
                                    isRolling={false}
                                    size="100%"
                                    locale={locale}
                                    variant="default"
                                    characterId={resolveCharacterIdFromDiceDefinitionId(die.definitionId)}
                                    definitionId={die.definitionId}
                                    enableWebgl={false}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {dice.map((die) => {
                        const layout = projectedLayouts[die.id];
                        if (!layout) return null;

                        return (
                            <button
                                key={die.id}
                                type="button"
                                onClick={() => die.clickable && onDieClick(die.id)}
                                data-testid={`die-button-${die.id}`}
                                data-render-mode="engine"
                                data-selected={die.selected ? 'true' : 'false'}
                                data-clickable={die.clickable ? 'true' : 'false'}
                                data-display-value={die.displayValue}
                                data-rotate-x={(motionSnapshots[die.id]?.rotateX ?? layout.rotateX).toFixed(4)}
                                data-rotate-y={(motionSnapshots[die.id]?.rotateY ?? layout.rotateY).toFixed(4)}
                                data-rotate-z={(motionSnapshots[die.id]?.rotateZ ?? layout.rotateZ).toFixed(4)}
                                data-motion-x={motionSnapshots[die.id]?.x.toFixed(3)}
                                data-motion-y={motionSnapshots[die.id]?.y.toFixed(3)}
                                data-motion-z={motionSnapshots[die.id]?.z.toFixed(3)}
                                className={clsx(
                                    'absolute rounded-[1rem] border transition-[left,top,width,height,opacity,box-shadow,background] duration-75 ease-out',
                                    die.selected
                                        ? 'border-amber-200/85 shadow-[0_0_0_2px_rgba(251,191,36,0.52),0_0_28px_rgba(245,158,11,0.32)]'
                                        : 'border-transparent',
                                    die.clickable ? 'cursor-pointer' : 'cursor-default',
                                )}
                                style={{
                                    left: `${layout.x}px`,
                                    top: `${layout.y}px`,
                                    width: `${layout.width}px`,
                                    height: `${layout.height}px`,
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: die.selected ? 14 : 12,
                                    background: die.selected ? 'linear-gradient(180deg, rgba(255,239,188,0.16), rgba(255,204,71,0.07))' : 'transparent',
                                }}
                            >
                                {!die.selected && (
                                    <span className="sr-only">{`die-${die.id}`}</span>
                                )}
                            </button>
                        );
                    })}
                    <div className="pointer-events-none absolute inset-0">
                        {dice.map((die) => {
                            if (!die.isKept || die.selected) return null;
                            const labelLayout = lockedLabelLayouts[die.id];
                            if (!labelLayout) return null;
                            return (
                                <div
                                    key={`locked-label-${die.id}`}
                                    className="absolute -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${labelLayout.x}px`,
                                        top: `${labelLayout.y}px`,
                                        zIndex: 18,
                                    }}
                                >
                                    <span className="block rounded bg-black/58 px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/15">
                                        {t('dice.locked')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
