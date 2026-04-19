import type { AudioEvent, AudioRuntimeContext, BgmGroupId, BgmRule, GameAudioConfig, SoundKey } from './types';

/**
 * 统一反馈解析：返回 SoundKey 或 null。
 * 仅处理无动画事件，返回的 key 由框架立即播放。
 * event.audioKey 享有最高优先级（引擎层事件标注）。
 */
export function resolveFeedback<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
>(
    event: AudioEvent,
    context: AudioRuntimeContext<G, Ctx, Meta>,
    config: GameAudioConfig,
): SoundKey | null {
    // event 上的 audioKey（引擎层标注）优先级最高
    if (event.audioKey) return event.audioKey;

    // event.sfxKey（事件级注入）
    if (event.sfxKey) return event.sfxKey;

    // 游戏层 feedbackResolver
    const resolved = config.feedbackResolver(event, context);
    return resolved ?? null;
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

export function resolveBgmGroup<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
>(
    context: AudioRuntimeContext<G, Ctx, Meta>,
    rules: Array<BgmRule<G, Ctx, Meta>> | undefined,
    fallbackGroup: BgmGroupId = 'normal'
): BgmGroupId {
    if (rules && rules.length > 0) {
        for (const rule of rules) {
            if (rule.when(context)) {
                return rule.group ?? fallbackGroup;
            }
        }
    }

    return fallbackGroup;
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
