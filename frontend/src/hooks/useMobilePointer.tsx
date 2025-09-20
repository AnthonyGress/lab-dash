import { useEffect, useState } from 'react';

/**
 * Custom hook to detect if the device has a coarse pointer (mobile/tablet)
 * @returns boolean - true if the device has a coarse pointer (mobile/tablet), false for fine pointer (mouse/trackpad)
 */
export const useMobilePointer = (): boolean => {
    const [isMobilePointer, setIsMobilePointer] = useState(false);

    useEffect(() => {
        const detectAndSetPointerType = () => {
            const mediaQuery = window.matchMedia('(pointer: coarse)');
            setIsMobilePointer(mediaQuery.matches);
        };

        // Initial detection
        detectAndSetPointerType();

        // Listen for changes (e.g., device rotation or external mouse connection)
        const mediaQuery = window.matchMedia('(pointer: coarse)');
        const handleChange = () => detectAndSetPointerType();
        
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            // Fallback for older browsers
            mediaQuery.addListener(handleChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleChange);
            } else {
                // Fallback for older browsers
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    return isMobilePointer;
};