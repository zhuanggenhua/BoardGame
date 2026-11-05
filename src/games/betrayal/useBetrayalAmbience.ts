import { useEffect } from 'react';
import { AudioManager } from '../../lib/audio/AudioManager';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry } from '../../lib/audio/commonRegistry';

// Existing licensed library loop; a low-level atmospheric bed, not a new generated sound.
export const BETRAYAL_AMBIENCE_KEY = 'card.loops.decks_and_cards_sound_fx_pack.abstract_drone_dark_loop';

/** The board owns ambience lifetime; turn intro skip never touches this independent loop. */
export function useBetrayalAmbience(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        let stop: (() => void) | undefined;
        void loadCommonAudioRegistry().then(registry => {
            if (cancelled) return;
            AudioManager.initialize();
            AudioManager.registerRegistryEntries(registry.entries, COMMON_AUDIO_BASE_PATH);
            stop = AudioManager.playLoop(BETRAYAL_AMBIENCE_KEY, 0.08);
        }).catch(error => console.warn('[Betrayal] ambience unavailable', error));
        return () => { cancelled = true; stop?.(); };
    }, [active]);
}
