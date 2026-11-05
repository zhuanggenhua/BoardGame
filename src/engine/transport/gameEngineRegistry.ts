import type { GameEngineConfig } from './engineConfig';

export interface GameEngineLoader {
    gameId: string;
    loadEngine: () => Promise<GameEngineConfig>;
}

/** Module evaluation errors are terminal until the process reloads its code.
 * Bundled dev imports must not return partially initialized exports on retry. */
export function createGameModuleLoader<T>(load: () => Promise<T>): () => Promise<T> {
    let attempt: Promise<T> | undefined;
    return () => attempt ??= Promise.resolve().then(load);
}

/** A catalogue does not evaluate rules. Only a room requesting its game loads them. */
export class GameEngineRegistry {
    private readonly engines = new Map<string, GameEngineConfig>();
    private readonly loaders = new Map<string, () => Promise<GameEngineConfig>>();
    private readonly pending = new Map<string, Promise<GameEngineConfig>>();
    get loadedGameIds(): string[] { return [...this.engines.keys()]; }

    constructor(engines: readonly GameEngineConfig[], loaders: readonly GameEngineLoader[] = []) {
        for (const engine of engines) this.engines.set(engine.gameId, engine);
        for (const loader of loaders) {
            if (this.engines.has(loader.gameId) || this.loaders.has(loader.gameId)) {
                throw new Error(`Duplicate game engine: ${loader.gameId}`);
            }
            this.loaders.set(loader.gameId, loader.loadEngine);
        }
    }

    async get(gameId: string): Promise<GameEngineConfig | undefined> {
        const cached = this.engines.get(gameId);
        if (cached) return cached;
        const existing = this.pending.get(gameId);
        if (existing) return existing;
        const loader = this.loaders.get(gameId);
        if (!loader) return undefined;
        const task = Promise.resolve().then(loader).then(engine => {
            // A failed module initializer may leave a partial bundled namespace.
            // Never publish it as a valid engine on a subsequent request.
            if (!engine || engine.gameId !== gameId || typeof engine.domain?.setup !== 'function'
                || typeof engine.domain?.reduce !== 'function') {
                throw new Error(`Invalid engine export for game ${gameId}`);
            }
            this.engines.set(gameId, engine);
            return engine;
        }).finally(() => {
            if (this.pending.get(gameId) === task) this.pending.delete(gameId);
        });
        this.pending.set(gameId, task);
        return task;
    }
}
