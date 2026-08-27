import { createContext } from 'react';
import type { ToastContextType } from './ToastContext';

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
