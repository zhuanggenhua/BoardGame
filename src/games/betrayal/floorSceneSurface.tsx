import type { PropsWithChildren } from 'react';
import { motion, useIsPresent } from 'framer-motion';

/** An exiting floor remains visible briefly, but none of its old targets remain actionable. */
export function BetrayalFloorScene({ reducedMotion, children }: PropsWithChildren<{ reducedMotion: boolean }>) {
    const present = useIsPresent();
    return <motion.div
        className="absolute inset-0"
        data-testid="betrayal-floor-scene"
        inert={!present}
        aria-hidden={!present}
        initial={{ opacity: reducedMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.18 }}
    >{children}</motion.div>;
}
