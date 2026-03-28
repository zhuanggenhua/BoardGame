import { registerRemoteAiProvider } from '../registry';
import { createAstrBotRemoteAiProvider } from './astrbot';

let defaultsRegistered = false;

export function registerDefaultRemoteAiProviders(): void {
    if (defaultsRegistered) {
        return;
    }

    registerRemoteAiProvider(createAstrBotRemoteAiProvider());
    defaultsRegistered = true;
}

export * from './astrbot';
