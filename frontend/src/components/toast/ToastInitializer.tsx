import { useEffect } from 'react';

import { ToastManager, useToast } from './ToastManager';

export const ToastInitializer: React.FC = () => {
    const toastContext = useToast();

    useEffect(() => {
        // Set the global instance for static access
        ToastManager.setInstance(toastContext);
    }, [toastContext]);

    return null; // This component doesn't render anything
};
