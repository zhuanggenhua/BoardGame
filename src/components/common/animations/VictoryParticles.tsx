import React, { useEffect, useMemo, useState } from 'react';
import type { ISourceOptions } from '@tsparticles/engine';
import type { IParticlesProps } from '@tsparticles/react';

type ParticlesComponent = React.ComponentType<IParticlesProps>;

export interface VictoryParticlesProps {
    active: boolean;
    className?: string;
}

export function VictoryParticles({ active, className = '' }: VictoryParticlesProps): React.ReactElement | null {
    const isBrowser = typeof window !== 'undefined';
    const [Particles, setParticles] = useState<ParticlesComponent | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [emittersEnabled, setEmittersEnabled] = useState(false);

    useEffect(() => {
        if (!active || typeof window === 'undefined') return undefined;
        let mounted = true;

        const loadParticles = async () => {
            const [{ initParticlesEngine, Particles: ParticlesComponent }, { loadSlim }] = await Promise.all([
                import('@tsparticles/react'),
                import('@tsparticles/slim'),
            ]);

            let hasEmitters = false;
            await initParticlesEngine(async (engine) => {
                await loadSlim(engine);
                try {
                    const { loadEmittersPlugin } = await import(/* @vite-ignore */ '@tsparticles/plugin-emitters');
                    await loadEmittersPlugin(engine);
                    hasEmitters = true;
                } catch {
                    hasEmitters = false;
                }
            });

            if (!mounted) return;
            setParticles(() => ParticlesComponent);
            setEmittersEnabled(hasEmitters);
            setIsReady(true);
        };

        void loadParticles();

        return () => {
            mounted = false;
        };
    }, [active]);

    const options = useMemo<ISourceOptions>(() => ({
        fullScreen: { enable: false, zIndex: 0 },
        fpsLimit: 60,
        detectRetina: true,
        particles: {
            number: { value: 0 },
            color: { value: ['#F59E0B', '#10B981', '#38BDF8', '#F472B6', '#FDE047'] },
            shape: { type: ['circle', 'square'] },
            opacity: { value: { min: 0.7, max: 1 } },
            size: { value: { min: 2, max: 6 } },
            rotate: { value: { min: 0, max: 360 }, direction: 'random' },
            move: {
                enable: true,
                speed: { min: 6, max: 14 },
                direction: 'top' as const,
                outModes: { default: 'out' },
            },
        },
        ...(emittersEnabled ? {
            emitters: {
                position: { x: 50, y: 65 },
                rate: { delay: 0.1, quantity: 8 },
                life: { count: 1, duration: 0.2 },
                size: { width: 100, height: 0 },
                startCount: 60,
            },
        } : {}),
    }), [emittersEnabled]);

    if (!active || !isBrowser) return null;

    return (
        <div
            className={`absolute inset-0 pointer-events-none ${className}`}
            data-victory-particles
            aria-hidden
        >
            {Particles && isReady ? (
                <Particles id="victory-confetti" options={options} />
            ) : null}
        </div>
    );
}
