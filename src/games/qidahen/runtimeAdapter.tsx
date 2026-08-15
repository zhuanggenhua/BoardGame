import type { GameRuntimeAdapter } from '../gameRuntimeAdapter';
import { resolveQidahenLocalSetup } from './pregameSetup';

export const qidahenGameRuntimeAdapter: GameRuntimeAdapter = {
    resolveLocalSetup: resolveQidahenLocalSetup,
};
