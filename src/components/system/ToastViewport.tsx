import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';
import { ToastItem } from '../common/feedback/ToastItem';

export const ToastViewport: React.FC = () => {
    const { toasts } = useToast();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} />
                ))}
            </AnimatePresence>
        </div>
    );
};
