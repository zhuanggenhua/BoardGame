let onlineMatchRoutePrefetchPromise: Promise<void> | null = null;

export const prefetchOnlineMatchRoute = (): Promise<void> => {
    if (!onlineMatchRoutePrefetchPromise) {
        onlineMatchRoutePrefetchPromise = import('../pages/MatchRoomWithAudio')
            .then(() => undefined)
            .catch((error) => {
                onlineMatchRoutePrefetchPromise = null;
                throw error;
            });
    }

    return onlineMatchRoutePrefetchPromise;
};
