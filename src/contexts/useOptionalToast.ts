import { useContext } from 'react';
import { ToastContext } from './toastContextValue';

export const useOptionalToast = () => useContext(ToastContext);
