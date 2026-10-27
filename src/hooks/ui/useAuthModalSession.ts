import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/** 个人弹窗绑定打开时的账户；身份切换时由原关闭回调回收弹窗及滚动锁。 */
export function useAuthModalSession(isOpen: boolean, onClose: () => void) {
    const { user } = useAuth();
    const ownerId = useRef(user?.id);
    useLayoutEffect(() => {
        if (!isOpen) ownerId.current = user?.id;
        else if (ownerId.current !== user?.id) onClose();
    }, [isOpen, user?.id, onClose]);
}
