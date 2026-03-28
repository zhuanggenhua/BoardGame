import type { AiSeatController, GameAiRuntime, LocalAiPolicy, RemoteAiProvider } from './types';

const gameAiRuntimeRegistry = new Map<string, GameAiRuntime>();
const remoteAiProviderRegistry = new Map<string, RemoteAiProvider>();

export function registerGameAiRuntime(runtime: GameAiRuntime): void {
    gameAiRuntimeRegistry.set(runtime.gameId, runtime);
}

export function getGameAiRuntime(gameId: string): GameAiRuntime | undefined {
    return gameAiRuntimeRegistry.get(gameId);
}

export function resolveLocalAiPolicyByPreference(args: {
    runtime: GameAiRuntime | undefined;
    preferredPolicyId?: string;
    fallbackPolicyId?: string;
}): LocalAiPolicy | undefined {
    const { runtime, preferredPolicyId, fallbackPolicyId } = args;
    if (!runtime?.localPolicies) return undefined;

    if (preferredPolicyId && runtime.localPolicies[preferredPolicyId]) {
        return runtime.localPolicies[preferredPolicyId];
    }

    if (fallbackPolicyId && runtime.localPolicies[fallbackPolicyId]) {
        return runtime.localPolicies[fallbackPolicyId];
    }

    if (runtime.defaultLocalPolicyId && runtime.localPolicies[runtime.defaultLocalPolicyId]) {
        return runtime.localPolicies[runtime.defaultLocalPolicyId];
    }

    return Object.values(runtime.localPolicies)[0];
}

export function resolveLocalAiPolicy(
    runtime: GameAiRuntime | undefined,
    seatController: Extract<AiSeatController, { type: 'local-ai' }>,
): LocalAiPolicy | undefined {
    return resolveLocalAiPolicyByPreference({
        runtime,
        preferredPolicyId: seatController.policyId ?? runtime?.defaultLocalPolicyId,
        fallbackPolicyId: seatController.fallbackPolicyId,
    });
}

export function registerRemoteAiProvider(provider: RemoteAiProvider): void {
    remoteAiProviderRegistry.set(provider.id, provider);
}

export function getRemoteAiProvider(providerId: string): RemoteAiProvider | undefined {
    return remoteAiProviderRegistry.get(providerId);
}
