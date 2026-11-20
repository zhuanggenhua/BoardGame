export function externalRoomPath(gameId: string, roomId: string, native = false) {
    const query = new URLSearchParams({ room: roomId });
    if (native) query.set('native', '1');
    return `/external/${encodeURIComponent(gameId)}?${query}`;
}
