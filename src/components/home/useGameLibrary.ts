import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserLibrary, setUserFavorite, type UserLibrary } from '../../api/user-library';
import { getLocalStorage } from '../../lib/browserStorage';

const GUEST_LIBRARY_KEY = 'bg_guest_game_library';
type FavoriteChange = { gameId: string; favorite: boolean };
type OwnedFavoriteChange = FavoriteChange & {
    ownerId: string | null;
    accessToken: string | null;
    queryKey: readonly ['game-library', string];
};
function readGuestLibrary(): UserLibrary {
    const raw = getLocalStorage()?.getItem(GUEST_LIBRARY_KEY);
    if (!raw) return { gameIds: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(id => typeof id === 'string')) throw new Error('本机收藏记录无法读取');
    return { gameIds: [...new Set(parsed)] };
}

/** Account data stays server-owned; guests keep an explicitly device-local collection. */
export function useGameLibrary() {
    const { user, token, isLoading: authLoading } = useAuth();
    const client = useQueryClient();
    const owner = user?.id ?? 'guest';
    const key = ['game-library', owner] as const;
    const query = useQuery({
        queryKey: key,
        queryFn: () => token && user ? getUserLibrary(token) : Promise.resolve(readGuestLibrary()),
        enabled: !authLoading && (!user || Boolean(token)),
        staleTime: 30_000,
    });
    const mutation = useMutation({
        mutationKey: key,
        mutationFn: async ({ gameId, favorite, ownerId, accessToken }: OwnedFavoriteChange) => {
            if (ownerId) {
                if (!accessToken) throw new Error('登录状态尚未就绪');
                return setUserFavorite(accessToken, gameId, favorite);
            }
            const storage = getLocalStorage();
            if (!storage) throw new Error('无法保存本机收藏');
            const ids = new Set(readGuestLibrary().gameIds);
            if (favorite) ids.add(gameId); else ids.delete(gameId);
            const gameIds = [...ids];
            storage.setItem(GUEST_LIBRARY_KEY, JSON.stringify(gameIds));
            return { gameIds };
        },
        onSuccess: (library, variables) => {
            client.setQueryData(variables.queryKey, library);
            void client.invalidateQueries({ queryKey: variables.queryKey });
        },
    });
    return {
        gameIds: query.data?.gameIds ?? [],
        isLoading: query.isPending,
        isSaving: mutation.isPending,
        error: query.error ?? mutation.error,
        retry: query.refetch,
        setFavorite: (change: FavoriteChange) => mutation.mutateAsync({
            ...change, ownerId: user?.id ?? null, accessToken: token ?? null, queryKey: key,
        }),
        isGuest: !user,
    };
}
