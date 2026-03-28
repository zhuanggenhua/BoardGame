import type { AiActionDecision, AiDecisionContext, RemoteAiProvider } from '../types';

const DEFAULT_ASTRBOT_PROVIDER_ID = 'astrbot';

interface AstrBotProviderOptions {
    id?: string;
    endpoint?: string;
    apiKey?: string;
    authHeader?: string;
    defaultTimeoutMs?: number;
    defaultRetryCount?: number;
}

interface AstrBotDecisionRequest {
    schemaVersion: 1;
    provider: 'astrbot';
    context: AiDecisionContext;
}

type AstrBotDecisionResponse =
    | AiActionDecision
    | {
        decision?: AiActionDecision | null;
    };

function getViteEnv(): Record<string, string | undefined> {
    const metaEnv = (import.meta as ImportMeta & {
        env?: Record<string, string | undefined>;
    }).env;
    return metaEnv ?? {};
}

function readNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDecision(payload: AstrBotDecisionResponse): AiActionDecision | null {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    if ('decision' in payload) {
        return payload.decision ?? null;
    }

    return payload as AiActionDecision;
}

export function createAstrBotRemoteAiProvider(
    options?: AstrBotProviderOptions,
): RemoteAiProvider {
    const env = getViteEnv();
    const endpoint = options?.endpoint ?? env.VITE_ASTRBOT_ENDPOINT;
    const apiKey = options?.apiKey ?? env.VITE_ASTRBOT_API_KEY;
    const authHeader = options?.authHeader ?? env.VITE_ASTRBOT_AUTH_HEADER ?? 'Authorization';
    const defaultTimeoutMs = options?.defaultTimeoutMs ?? readNumber(env.VITE_ASTRBOT_TIMEOUT_MS);
    const defaultRetryCount = options?.defaultRetryCount ?? readNumber(env.VITE_ASTRBOT_RETRY_COUNT);

    return {
        id: options?.id ?? DEFAULT_ASTRBOT_PROVIDER_ID,
        ...(defaultTimeoutMs !== undefined ? { defaultTimeoutMs } : {}),
        ...(defaultRetryCount !== undefined ? { defaultRetryCount } : {}),
        async decide(context) {
            if (!endpoint) {
                return null;
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (apiKey) {
                headers[authHeader] = authHeader.toLowerCase() === 'authorization'
                    ? `Bearer ${apiKey}`
                    : apiKey;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    schemaVersion: 1,
                    provider: 'astrbot',
                    context,
                } satisfies AstrBotDecisionRequest),
            });

            if (!response.ok) {
                throw new Error(`astrbot_http_${response.status}`);
            }

            const payload = await response.json() as AstrBotDecisionResponse;
            return normalizeDecision(payload);
        },
    };
}
