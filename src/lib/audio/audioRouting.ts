import type { AudioCategory, AudioEvent, AudioRuntimeContext, BgmRule, GameAudioConfig, SoundKey } from './types';

export function resolveEventSoundKey<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
>(
    event: AudioEvent,
    context: AudioRuntimeContext<G, Ctx, Meta>,
    config: GameAudioConfig
): SoundKey | null {
    if (event.sfxKey) return event.sfxKey;

    const resolved = config.eventSoundResolver?.(event, context);
    if (resolved !== undefined) {
        return resolved ?? null;
    }

    return config.eventSoundMap?.[event.type] ?? null;
}

export function resolveAudioKey<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
>(
    event: AudioEvent,
    context: AudioRuntimeContext<G, Ctx, Meta>,
    config: GameAudioConfig,
    resolveCategoryKey: (category: AudioCategory) => SoundKey | null
): SoundKey | null {
    if (event.audioKey) return event.audioKey;

    if (event.audioCategory) {
        const categoryKey = resolveCategoryKey(event.audioCategory);
        if (categoryKey) return categoryKey;
    }

    return resolveEventSoundKey(event, context, config);
}

export function resolveBgmKey<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
>(
    context: AudioRuntimeContext<G, Ctx, Meta>,
    rules: Array<BgmRule<G, Ctx, Meta>> | undefined,
    fallbackKey: string | null
): string | null {
    if (rules && rules.length > 0) {
        for (const rule of rules) {
            if (rule.when(context)) return rule.key;
        }
    }

    return fallbackKey ?? null;
}

export function resolveAudioEvent(
    entry: unknown,
    selector?: (entry: unknown) => AudioEvent | null | undefined
): AudioEvent | null {
    if (selector) return selector(entry) ?? null;
    if (!entry || typeof entry !== 'object') return null;

    const maybeStreamEntry = entry as { event?: AudioEvent };
    if (maybeStreamEntry.event && typeof maybeStreamEntry.event === 'object') {
        const streamEvent = maybeStreamEntry.event as { type?: string };
        if (typeof streamEvent.type === 'string') {
            return streamEvent as AudioEvent;
        }
    }

    const maybeEntry = entry as { type?: string; data?: unknown };
    if (maybeEntry.type === 'event' && maybeEntry.data && typeof maybeEntry.data === 'object') {
        const data = maybeEntry.data as { type?: string };
        if (typeof data.type === 'string') {
            return data as AudioEvent;
        }
    }

    return null;
}
