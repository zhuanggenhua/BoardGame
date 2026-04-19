import clsx from 'clsx';

/** 移动端聊天详情页需要把滚动限制在内容区，避免输入区跟随整体滚动。 */
export function getFriendsChatListPaneClass(selectedFriendId: string | null) {
    return clsx(
        'w-full md:w-80 h-full min-h-0 overflow-hidden border-r border-parchment-card-border/30 flex flex-col transition-all duration-300 absolute md:relative z-10 bg-parchment-card-bg',
        selectedFriendId ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
    );
}

export function getFriendsChatDetailPaneClass(selectedFriendId: string | null) {
    return clsx(
        'flex-1 h-full min-h-0 overflow-hidden flex flex-col transition-all duration-300 absolute md:relative w-full md:w-auto bg-parchment-card-bg',
        selectedFriendId ? 'translate-x-0' : 'translate-x-full md:translate-x-0',
    );
}

export const FRIENDS_CHAT_DETAIL_CONTENT_CLASS = 'flex-1 min-h-0 overflow-hidden';
