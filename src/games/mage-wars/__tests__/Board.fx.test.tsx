import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EventStreamRollbackContext, type EventStreamRollbackValue } from '../../../engine/hooks/EventStreamRollbackContext';
import { resetFxFrameClockForTests, type FxEvent } from '../../../engine/fx';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { GameBoardProps } from '../../../engine/transport/protocol';
import type { RandomFn, SystemState } from '../../../engine/types';
import MageWarsBoard from '../Board';
import { MageWarsDomain, type MageWarsArenaObjectState, type MageWarsCore } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { engineConfig } from '../game';
import { ARENA_ZONE_IDS } from '../domain/ids';
import {
    AttackImpactRenderer,
    DamageImpactRenderer,
    SpellPushRenderer,
    SpellTeleportRenderer,
    SummonRenderer,
} from '../ui/fxRenderers';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: { language: 'zh-CN' },
        t: (key: string, params?: Record<string, string | number>) => (
            params ? `${key}:${JSON.stringify(params)}` : key
        ),
    }),
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, className }: { src: string; alt?: string; className?: string }) => (
        <img data-testid="mock-optimized-image" src={src} alt={alt ?? ''} className={className} />
    ),
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ title, className }: { title?: string; className?: string }) => (
        <div data-testid="mock-card-preview" className={className}>{title}</div>
    ),
}));


vi.mock('../../../components/common/animations/BurstParticles', () => ({
    BurstParticles: ({
        active,
        preset,
        quality,
        overflow,
    }: {
        active?: boolean;
        preset?: string;
        quality?: string;
        overflow?: number;
    }) => (
        <div
            data-testid="mock-burst-particles"
            data-active={String(active)}
            data-preset={preset ?? ''}
            data-quality={quality ?? ''}
            data-overflow={String(overflow ?? '')}
        />
    ),
}));

vi.mock('../../../components/common/animations/ConeBlast', () => ({
    ConeBlast: ({
        intensity,
        quality,
        durationMs,
        color,
    }: {
        intensity?: string;
        quality?: string;
        durationMs?: number;
        color?: string[];
    }) => (
        <div
            data-testid="mock-cone-blast"
            data-intensity={intensity ?? ''}
            data-quality={quality ?? ''}
            data-duration-ms={String(durationMs ?? '')}
            data-color={color?.join('|') ?? ''}
        />
    ),
}));

vi.mock('../../../components/common/animations/SummonHybridEffect', () => ({
    SummonHybridEffect: ({
        active,
        intensity,
        color,
        originY,
        quality,
        durationScale,
        dimStrength,
        onImpact,
    }: {
        active?: boolean;
        intensity?: string;
        color?: string;
        originY?: number;
        quality?: string;
        durationScale?: number;
        dimStrength?: number;
        onImpact?: () => void;
    }) => (
        <button
            type="button"
            data-testid="mock-summon-hybrid-effect"
            data-active={String(active)}
            data-intensity={intensity ?? ''}
            data-color={color ?? ''}
            data-origin-y={String(originY ?? '')}
            data-quality={quality ?? ''}
            data-duration-scale={String(durationScale ?? '')}
            data-dim-strength={String(dimStrength ?? '')}
            data-has-impact={String(Boolean(onImpact))}
            onClick={onImpact}
        />
    ),
}));

vi.mock('../../../components/common/animations/DamageFlash', () => ({
    DamageFlash: ({
        damage,
        intensity,
        showNumber = true,
        startDelayMs = 0,
        numberDelayMs = 0,
        numberTestId,
        numberFontScale,
        numberColorClass,
        numberDurationSeconds,
    }: {
        damage?: number;
        intensity?: string;
        showNumber?: boolean;
        startDelayMs?: number;
        numberDelayMs?: number;
        numberTestId?: string;
        numberFontScale?: number;
        numberColorClass?: string;
        numberDurationSeconds?: number;
    }) => (
        <div
            data-testid="mock-damage-flash"
            data-show-number={String(showNumber)}
            data-intensity={intensity ?? ''}
            data-start-delay-ms={String(startDelayMs)}
            data-number-delay-ms={String(numberDelayMs)}
            data-number-testid={numberTestId ?? ''}
            data-number-font-scale={String(numberFontScale ?? '')}
            data-number-color-class={numberColorClass ?? ''}
            data-number-duration-seconds={String(numberDurationSeconds ?? '')}
        >
            {damage}
        </div>
    ),
}));

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min: number) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

function boardProps(
    coreOverride?: MageWarsCore,
    playerID = '0',
    sysOverride?: Partial<SystemState>,
): GameBoardProps<MageWarsCore> {
    const playerIds = ['0', '1'];
    return {
        G: {
            core: coreOverride ?? MageWarsDomain.setup(playerIds, fixedRandom),
            sys: {
                ...createInitialSystemState(playerIds, engineConfig.systems, 'local:mage-wars-board-fx'),
                phase: 'creatureAction',
                ...sysOverride,
            },
        },
        dispatch: vi.fn(),
        playerID,
        isMultiplayer: false,
        isConnected: true,
    };
}

function creatureObject(
    id: string,
    ownerId: string,
    sourceSpellCardId: number,
    name: string,
    zoneId: typeof ARENA_ZONE_IDS[keyof typeof ARENA_ZONE_IDS],
): MageWarsArenaObjectState {
    return {
        id,
        kind: 'creature',
        ownerId,
        sourceSpellCardId,
        sourceObjectId: `spell-${sourceSpellCardId}`,
        name,
        zoneId,
        life: 4,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
    };
}

const getCellPosition = (row: number, col: number) => ({
    left: col * 25,
    top: row * 33.3333,
    width: 25,
    height: 33.3333,
});

function renderFxRenderer(
    renderer: ReactElement,
) {
    return render(
        <div style={{ position: 'relative', width: 800, height: 600 }}>
            {renderer}
        </div>,
    );
}

function advanceSharedFxClockDelay(delayMs: number) {
    const totalMs = delayMs + 64;
    for (let elapsed = 0; elapsed < totalMs; elapsed += 16) {
        vi.advanceTimersByTime(16);
    }
}

describe('MageWarsBoard FX wiring', () => {
    it('mounts the board with the event-driven FX layer attached', () => {
        render(<MageWarsBoard {...boardProps()} />);

        expect(screen.queryByTestId('mage-wars-board')).not.toBeNull();
    });

    it('plays summon FX when the confirmed online state arrives during reconcile', async () => {
        let rollbackValue: EventStreamRollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 0,
        };
        const renderWithRollback = (
            core: MageWarsCore,
            sysOverride?: Partial<SystemState>,
        ) => (
            <EventStreamRollbackContext.Provider value={rollbackValue}>
                <MageWarsBoard {...boardProps(core, '0', sysOverride)} />
            </EventStreamRollbackContext.Provider>
        );

        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const summoned = creatureObject('mwobj-0-cat-confirmed', '0', 2906, '确认山猫', ARENA_ZONE_IDS.A3);
        const afterCore: MageWarsCore = {
            ...baseCore,
            objects: {
                [summoned.id]: summoned,
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A3
                    ? { ...zone, objectIds: [summoned.id] }
                    : zone
            )),
        };
        const sysWithSummon: Partial<SystemState> = {
            eventStream: {
                entries: [
                    {
                        id: 1,
                        event: {
                            type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                            payload: { object: summoned },
                            timestamp: 1,
                        },
                    },
                ],
                maxEntries: 200,
                nextId: 2,
            },
        };

        const { rerender } = render(renderWithRollback(baseCore));

        rollbackValue = {
            watermark: null,
            seq: 0,
            reconcileSeq: 1,
        };
        act(() => {
            rerender(renderWithRollback(afterCore, sysWithSummon));
        });

        await waitFor(() => {
            expect(screen.queryByTestId('mage-wars-fx-summon')).not.toBeNull();
        });
        expect(screen.getByTestId('mage-wars-fx-layer').getAttribute('data-fx-active-cues')).toContain('mage-wars.summon');
    });

    it('plays required summon FX when the first rendered board state already contains the summon event', async () => {
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const summoned = creatureObject('mwobj-0-cat-initial', '0', 2906, '首屏山猫', ARENA_ZONE_IDS.A3);
        const afterCore: MageWarsCore = {
            ...baseCore,
            objects: {
                [summoned.id]: summoned,
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A3
                    ? { ...zone, objectIds: [summoned.id] }
                    : zone
            )),
        };

        render(<MageWarsBoard
            {...boardProps(afterCore, '0', {
                eventStream: {
                    entries: [
                        {
                            id: 1,
                            event: {
                                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                                payload: { object: summoned },
                                timestamp: 1,
                            },
                        },
                    ],
                    maxEntries: 200,
                    nextId: 2,
                },
            })}
        />);

        await waitFor(() => {
            expect(screen.queryByTestId('mage-wars-fx-summon')).not.toBeNull();
        });
        expect(screen.getByTestId('mage-wars-fx-layer').getAttribute('data-fx-active-cues')).toContain('mage-wars.summon');
        expect(screen.getByTestId('mage-wars-board').getAttribute('data-mage-wars-last-consumed-events')).toContain(MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED);
    });

    it('renders summoned arena objects from core object state', () => {
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const object: MageWarsArenaObjectState = {
            id: 'mwobj-0-2906-1',
            kind: 'creature',
            ownerId: '0',
            sourceSpellCardId: 2906,
            sourceObjectId: 'spell-2906',
            name: '野性山猫',
            zoneId: ARENA_ZONE_IDS.A1,
            life: 4,
            damage: 2,
            armor: 0,
            actionReady: false,
            guarding: false,
            statusTokens: {},
        };
        const core: MageWarsCore = {
            ...baseCore,
            objects: {
                [object.id]: object,
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A1
                    ? { ...zone, objectIds: [object.id] }
                    : zone
            )),
        };

        render(<MageWarsBoard {...boardProps(core)} />);

        const fieldCard = screen.getByText('野性山猫').closest('[data-testid="mage-wars-zone-field-card"]');
        expect(fieldCard).not.toBeNull();
        expect(fieldCard?.getAttribute('data-object-id')).toBe(object.id);
        expect(screen.getAllByTestId('mock-card-preview').some((node) => node.textContent === '野性山猫')).toBe(true);
    });

    it('keeps same-zone ownership lanes anchored to fixed seats instead of viewer perspective', () => {
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const leftSeatObject = creatureObject('mwobj-left-cat', '0', 2906, '左席位山猫', ARENA_ZONE_IDS.A2);
        const rightSeatObject = creatureObject('mwobj-right-knight', '1', 2909, '右席位骑士', ARENA_ZONE_IDS.A2);
        const core: MageWarsCore = {
            ...baseCore,
            objects: {
                [leftSeatObject.id]: leftSeatObject,
                [rightSeatObject.id]: rightSeatObject,
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A2
                    ? { ...zone, objectIds: [leftSeatObject.id, rightSeatObject.id] }
                    : zone
            )),
        };

        render(<MageWarsBoard {...boardProps(core, '1')} />);

        const leftSeatCard = screen.getByText('左席位山猫').closest('[data-testid="mage-wars-zone-field-card"]');
        const rightSeatCard = screen.getByText('右席位骑士').closest('[data-testid="mage-wars-zone-field-card"]');
        expect(leftSeatCard?.closest('[data-lane-owner-side]')?.getAttribute('data-lane-owner-side')).toBe('seat-left');
        expect(rightSeatCard?.closest('[data-lane-owner-side]')?.getAttribute('data-lane-owner-side')).toBe('seat-right');
        expect(leftSeatCard?.getAttribute('data-owner-side')).toBe('seat-left');
        expect(rightSeatCard?.getAttribute('data-owner-side')).toBe('seat-right');
    });

    it('buffers arena object damage until attack impact', async () => {
        vi.useFakeTimers();
        const baseCore = MageWarsDomain.setup(['0', '1'], fixedRandom);
        const attacker = creatureObject('mwobj-left-attacker', '0', 2906, '缓冲来源', ARENA_ZONE_IDS.A2);
        const targetBefore = creatureObject('mwobj-right-target', '1', 2909, '缓冲目标', ARENA_ZONE_IDS.B2);
        const targetAfter: MageWarsArenaObjectState = {
            ...targetBefore,
            damage: 3,
        };
        const beforeCore: MageWarsCore = {
            ...baseCore,
            objects: {
                [attacker.id]: attacker,
                [targetBefore.id]: targetBefore,
            },
            arena: baseCore.arena.map((zone) => (
                zone.id === ARENA_ZONE_IDS.A2
                    ? { ...zone, objectIds: [attacker.id] }
                    : zone.id === ARENA_ZONE_IDS.B2
                        ? { ...zone, objectIds: [targetBefore.id] }
                        : zone
            )),
        };
        const afterCore: MageWarsCore = {
            ...beforeCore,
            objects: {
                [attacker.id]: attacker,
                [targetAfter.id]: targetAfter,
            },
        };
        const sysWithAttack = {
            eventStream: {
                entries: [
                    {
                        id: 1,
                        event: {
                            type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
                            payload: {
                                ownerId: '0',
                                attackerObjectId: attacker.id,
                                attackProfileId: 'bite',
                                targetObjectId: targetAfter.id,
                                targetZoneId: ARENA_ZONE_IDS.B2,
                                diceResults: [3],
                                baseDamage: 3,
                            },
                            timestamp: 1,
                        },
                    },
                    {
                        id: 2,
                        event: {
                            type: 'DAMAGE_DEALT',
                            payload: {
                                targetId: targetAfter.id,
                                amount: 3,
                                actualDamage: 3,
                                sourceAbilityId: 'test.attack',
                            },
                            timestamp: 2,
                        },
                    },
                ],
                maxEntries: 200,
                nextId: 3,
            },
        };

        try {
            const { rerender } = render(<MageWarsBoard {...boardProps(beforeCore)} />);

            act(() => {
                rerender(<MageWarsBoard {...boardProps(afterCore, '0', sysWithAttack)} />);
            });

            const targetCard = screen.getByText('缓冲目标').closest('[data-testid="mage-wars-zone-field-card"]');
            expect(targetCard?.getAttribute('data-visual-damage')).toBe('0');
            expect(screen.queryByTestId('mage-wars-fx-attack-travel')).not.toBeNull();

            act(() => {
                advanceSharedFxClockDelay(2600);
            });
            await act(async () => {});

            const releasedTargetCard = screen.getByText('缓冲目标').closest('[data-testid="mage-wars-zone-field-card"]');
            expect(releasedTargetCard?.getAttribute('data-visual-damage')).toBe('3');
        } finally {
            resetFxFrameClockForTests();
            vi.useRealTimers();
        }
    });

    it('renders summons through the shared board summon preset', () => {
        const onImpact = vi.fn();
        const event: FxEvent = {
            id: 'fx-summon',
            cue: 'mage-wars.summon',
            ctx: { cell: { row: 1, col: 2 }, intensity: 'strong', quality: 'reduced' },
            params: { objectId: 'mwobj-0-cat', objectKind: 'creature' },
        };

        renderFxRenderer(
            <SummonRenderer
                event={event}
                getCellPosition={getCellPosition}
                onImpact={onImpact}
                onComplete={vi.fn()}
            />,
        );

        const host = screen.getByTestId('mage-wars-fx-summon');
        const summonEffect = screen.getByTestId('mock-summon-hybrid-effect');
        expect(host.getAttribute('data-object-kind')).toBe('creature');
        expect(host.getAttribute('data-object-id')).toBe('mwobj-0-cat');
        expect(summonEffect.getAttribute('data-active')).toBe('true');
        expect(summonEffect.getAttribute('data-intensity')).toBe('strong');
        expect(summonEffect.getAttribute('data-color')).toBe('blue');
        expect(summonEffect.getAttribute('data-origin-y')).toBe('0.62');
        expect(summonEffect.getAttribute('data-quality')).toBe('reduced');
        expect(summonEffect.getAttribute('data-duration-scale')).toBe('2.4');
        expect(summonEffect.getAttribute('data-dim-strength')).toBe('0');
        expect(summonEffect.getAttribute('data-has-impact')).toBe('true');
        expect(onImpact).not.toHaveBeenCalled();

        fireEvent.click(summonEffect);
        expect(onImpact).toHaveBeenCalledTimes(1);
    });

    it('uses a distinct summon color for conjurations without fabricating travel', () => {
        const event: FxEvent = {
            id: 'fx-conjuration-summon',
            cue: 'mage-wars.summon',
            ctx: { cell: { row: 2, col: 0 }, intensity: 'normal' },
            params: { objectId: 'mwobj-0-vine', objectKind: 'conjuration' },
        };

        renderFxRenderer(
            <SummonRenderer
                event={event}
                getCellPosition={getCellPosition}
            />,
        );

        expect(screen.queryByTestId('mage-wars-fx-summon')).not.toBeNull();
        expect(screen.getByTestId('mock-summon-hybrid-effect').getAttribute('data-color')).toBe('gold');
        expect(screen.queryByTestId('mage-wars-fx-teleport-travel')).toBeNull();
    });

    it('renders attacks with a source-to-target travel cue before impact', () => {
        vi.useFakeTimers();
        const onImpact = vi.fn();
        const onComplete = vi.fn();
        const event: FxEvent = {
            id: 'fx-attack',
            cue: 'mage-wars.attack.impact',
            ctx: { cell: { row: 2, col: 3 }, intensity: 'strong' },
            params: {
                source: { row: 1, col: 0 },
                damageAmount: 6,
                diceResults: [1, 2, 3],
            },
        };

        try {
            renderFxRenderer(
                <AttackImpactRenderer
                    event={event}
                    getCellPosition={getCellPosition}
                    onImpact={onImpact}
                    onComplete={onComplete}
                />,
            );

            const travel = screen.getByTestId('mage-wars-fx-attack-travel');
            expect(screen.queryByTestId('mage-wars-fx-attack-impact')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-attack-dice')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-attack-source-wake')).toBeNull();
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-show-number')).toBe('true');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-intensity')).toBe('strong');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-start-delay-ms')).toBe('0');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-delay-ms')).toBe('0');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-testid')).toBe('mage-wars-fx-attack-damage-float');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-font-scale')).toBe('1.75');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-color-class')).toBe('text-amber-50');
            expect(screen.queryByTestId('mage-wars-fx-attack-damage-host')).not.toBeNull();
            expect(travel.getAttribute('data-source-col')).toBe('0');
            expect(travel.getAttribute('data-target-row')).toBe('2');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-intensity')).toBe('strong');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-duration-ms')).toBe('2600');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-color')).toContain('#ef4444');
            expect(screen.queryByTestId('mage-wars-fx-attack-travel-mid-burst')).toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-attack-impact-burst')).not.toBeNull();
            expect(screen
                .getByTestId('mage-wars-fx-attack-impact-burst')
                .querySelector('[data-testid="mock-burst-particles"]')
                ?.getAttribute('data-preset')).toBe('explosionStrong');
            expect(screen
                .getByTestId('mage-wars-fx-attack-impact-burst')
                .querySelector('[data-testid="mock-burst-particles"]')
                ?.getAttribute('data-overflow')).toBe('2.2');
            expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-duration-seconds')).toBe('1.35');

            act(() => {
                advanceSharedFxClockDelay(2600);
            });
            expect(onImpact).toHaveBeenCalledTimes(1);
        } finally {
            resetFxFrameClockForTests();
            vi.useRealTimers();
        }
    });

    it('renders direct damage with Mage Wars light impact tuning through the shared preset', () => {
        const event: FxEvent = {
            id: 'fx-direct-damage',
            cue: 'mage-wars.damage.impact',
            ctx: { cell: { row: 2, col: 2 }, intensity: 'normal' },
            params: {
                damageAmount: 2,
            },
        };

        renderFxRenderer(
            <DamageImpactRenderer
                event={event}
                getCellPosition={getCellPosition}
                onImpact={vi.fn()}
                onComplete={vi.fn()}
            />,
        );

        expect(screen.queryByTestId('mage-wars-fx-damage-impact')).not.toBeNull();
        expect(screen.queryByTestId('mage-wars-fx-damage-impact-host')).not.toBeNull();
        expect(screen.queryByTestId('mock-burst-particles')).toBeNull();
        expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-font-scale')).toBe('1.25');
        expect(screen.getByTestId('mock-damage-flash').getAttribute('data-number-duration-seconds')).toBe('1');
    });

    it('renders force push with source-to-target travel before impact', () => {
        vi.useFakeTimers();
        const onImpact = vi.fn();
        const onComplete = vi.fn();
        const event: FxEvent = {
            id: 'fx-push',
            cue: 'mage-wars.spell.push',
            ctx: { cell: { row: 1, col: 2 }, intensity: 'normal' },
            params: {
                source: { row: 1, col: 1 },
                spellCardId: 3523,
                targetObjectId: 'mwobj-push-target',
                fromZoneId: ARENA_ZONE_IDS.B2,
                toZoneId: ARENA_ZONE_IDS.C2,
            },
        };

        try {
            renderFxRenderer(
                <SpellPushRenderer
                    event={event}
                    getCellPosition={getCellPosition}
                    onImpact={onImpact}
                    onComplete={onComplete}
                />,
            );

            const travel = screen.getByTestId('mage-wars-fx-push-travel');
            expect(screen.queryByTestId('mage-wars-fx-push-source-wake')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-push-travel-mid-burst')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-spell-push')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-spell-push-burst')).not.toBeNull();
            expect(screen
                .getByTestId('mage-wars-fx-spell-push-burst')
                .querySelector('[data-testid="mock-burst-particles"]')
                ?.getAttribute('data-overflow')).toBe('2.35');
            expect(travel.getAttribute('data-source-col')).toBe('1');
            expect(travel.getAttribute('data-target-col')).toBe('2');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-intensity')).toBe('strong');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-duration-ms')).toBe('2600');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-color')).toContain('#38bdf8');

            act(() => {
                advanceSharedFxClockDelay(2600);
            });
            expect(onImpact).toHaveBeenCalledTimes(1);
        } finally {
            resetFxFrameClockForTests();
            vi.useRealTimers();
        }
    });

    it('renders teleport with source-to-target travel before arrival burst', () => {
        vi.useFakeTimers();
        const onImpact = vi.fn();
        const onComplete = vi.fn();
        const event: FxEvent = {
            id: 'fx-teleport',
            cue: 'mage-wars.spell.teleport',
            ctx: { cell: { row: 2, col: 1 }, intensity: 'strong' },
            params: {
                source: { row: 0, col: 0 },
                spellCardId: 3410,
                targetObjectId: 'mwobj-teleport-target',
                fromZoneId: ARENA_ZONE_IDS.A1,
                toZoneId: ARENA_ZONE_IDS.B3,
                distance: 3,
            },
        };

        try {
            renderFxRenderer(
                <SpellTeleportRenderer
                    event={event}
                    getCellPosition={getCellPosition}
                    onImpact={onImpact}
                    onComplete={onComplete}
                />,
            );

            const travel = screen.getByTestId('mage-wars-fx-teleport-travel');
            expect(screen.queryByTestId('mage-wars-fx-teleport-source-wake')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-teleport-travel-mid-burst')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-spell-teleport')).not.toBeNull();
            expect(screen.queryByTestId('mage-wars-fx-spell-teleport-burst')).not.toBeNull();
            expect(screen
                .getByTestId('mage-wars-fx-spell-teleport-burst')
                .querySelector('[data-testid="mock-burst-particles"]')
                ?.getAttribute('data-overflow')).toBe('2.2');
            expect(travel.getAttribute('data-source-row')).toBe('0');
            expect(travel.getAttribute('data-target-row')).toBe('2');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-intensity')).toBe('strong');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-duration-ms')).toBe('2600');
            expect(screen.getByTestId('mock-cone-blast').getAttribute('data-color')).toContain('#f59e0b');

            act(() => {
                advanceSharedFxClockDelay(2600);
            });
            expect(onImpact).toHaveBeenCalledTimes(1);
        } finally {
            resetFxFrameClockForTests();
            vi.useRealTimers();
        }
    });
});
