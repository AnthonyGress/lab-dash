// Reference counter for scroll locks
let scrollLockCount = 0;

/**
 * Simple scroll lock using CSS overflow on html element
 * Maintains scrollbar gutter to prevent layout shift
 * @returns cleanup function to restore scrolling
 */
export const lockScroll = (): (() => void) => {
    scrollLockCount++;

    if (scrollLockCount === 1) {
        // Apply scroll lock to html element to maintain scrollbar gutter
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.scrollbarGutter = 'stable';
    }

    return () => {
        scrollLockCount = Math.max(0, scrollLockCount - 1);

        if (scrollLockCount === 0) {
            document.documentElement.style.overflow = '';
            document.documentElement.style.scrollbarGutter = '';
        }
    };
};

/**
 * Force unlock all scroll locks (emergency cleanup)
 */
export const forceUnlockScroll = (): void => {
    scrollLockCount = 0;
    document.documentElement.style.overflow = '';
    document.documentElement.style.scrollbarGutter = '';
};

/**
 * Check if scroll is currently locked
 */
export const isScrollLocked = (): boolean => {
    return scrollLockCount > 0;
};
