let playDeniedSoundModulePromise: Promise<typeof import('./useGameAudio')> | null = null;

function loadDeniedSoundModule() {
    if (!playDeniedSoundModulePromise) {
        playDeniedSoundModulePromise = import('./useGameAudio');
    }
    return playDeniedSoundModulePromise;
}

export function playDeniedSoundLazy(): void {
    void loadDeniedSoundModule()
        .then((module) => {
            module.playDeniedSound();
        })
        .catch((error) => {
            console.error('[InteractionGuard] 拒绝音效懒加载失败', error);
        });
}
