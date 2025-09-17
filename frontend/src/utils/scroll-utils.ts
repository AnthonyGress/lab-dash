// Reference counter for scroll locks
let scrollLockCount = 0;
let originalScrollPosition = 0;

/**
 * Advanced scroll lock that prevents scrolling without layout shifts
 * Uses scroll position preservation and scrollbar width compensation
 * @returns cleanup function to restore scrolling
 */
export const lockScroll = (): (() => void) => {
    scrollLockCount++;

    if (scrollLockCount === 1) {
        // Store the current scroll position
        originalScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

        // Calculate scrollbar width before hiding it
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        // Apply scroll lock with position preservation
        document.body.style.position = 'fixed';
        document.body.style.top = `-${originalScrollPosition}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';

        // Apply scrollbar width compensation to html element to prevent layout shift
        if (scrollbarWidth > 0) {
            document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
        }
    }

    return () => {
        scrollLockCount = Math.max(0, scrollLockCount - 1);

        if (scrollLockCount === 0) {
            // Restore original styles
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            document.documentElement.style.paddingRight = '';

            // Restore scroll position
            window.scrollTo(0, originalScrollPosition);
        }
    };
};

/**
 * Simple scroll lock for drawer - no layout compensation needed
 * Since drawer covers the scrollbar area anyway
 * @returns cleanup function to restore scrolling
 */
export const lockScrollForDrawer = (): (() => void) => {
    scrollLockCount++;

    if (scrollLockCount === 1) {
        // Store the current scroll position
        originalScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

        // Simple overflow hidden approach for drawer
        document.body.style.position = 'fixed';
        document.body.style.top = `-${originalScrollPosition}px`;
        document.body.style.width = '100%';
        // Don't compensate for scrollbar since drawer covers that area
    }

    return () => {
        scrollLockCount = Math.max(0, scrollLockCount - 1);

        if (scrollLockCount === 0) {
            // Restore original styles
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';

            // Restore scroll position
            window.scrollTo(0, originalScrollPosition);
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
