import { Box, styled } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const ScrollbarTrack = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'visible',
})<{ visible: boolean }>(({ visible }) => ({
    position: 'fixed',
    top: 0,
    right: 0,
    width: '10px',
    height: '100vh',
    background: 'transparent',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out',
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 9999,
}));

const ScrollbarThumb = styled(Box, {
    shouldForwardProp: (prop) =>
        prop !== 'height' && prop !== 'top' && prop !== 'isDragging',
})<{
    height: number;
    top: number;
    isDragging: boolean;
}>(({ height, top, isDragging }) => ({
    position: 'absolute',
    right: '2px',
    width: '8px',
    height: `${height}px`,
    top: `${top}px`,
    background: isDragging
        ? 'rgba(255, 255, 255, 0.6)'
        : 'rgba(255, 255, 255, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: isDragging ? 'none' : 'background-color 0.1s ease',
    '&:hover': {
        background: 'rgba(255, 255, 255, 0.5)',
    },
}));

export const GlobalCustomScrollbar: React.FC = () => {
    const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);
    const [thumbHeight, setThumbHeight] = useState(0);
    const [thumbTop, setThumbTop] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ y: 0, scrollTop: 0 });
    const [justFinishedDragging, setJustFinishedDragging] = useState(false);
    const [postDragAutoHideActive, setPostDragAutoHideActive] = useState(false);

    const hideTimeoutRef = useRef<number>();
    const postDragTimeoutRef = useRef<number>();
    const isMouseOverScrollbarRef = useRef(false);


    const updateScrollbar = useCallback(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollHeight <= clientHeight) {
            setIsScrollbarVisible(false);
            return;
        }

        const thumbHeightRatio = clientHeight / scrollHeight;
        const newThumbHeight = Math.max(30, clientHeight * thumbHeightRatio);

        // Ensure thumb stays within visible bounds with some padding
        const trackPadding = 4; // Account for border radius and visual spacing
        const availableTrackHeight = clientHeight - (trackPadding * 2);
        const adjustedThumbHeight = Math.min(newThumbHeight, availableTrackHeight);

        const maxThumbTop = availableTrackHeight - adjustedThumbHeight + trackPadding;
        const scrollPercentage = scrollTop / (scrollHeight - clientHeight);
        const newThumbTop = Math.max(trackPadding, Math.min(maxThumbTop, scrollPercentage * maxThumbTop));

        setThumbHeight(adjustedThumbHeight);
        setThumbTop(newThumbTop);
    }, []);

    const tryHideScrollbar = useCallback(() => {
        if (!isDragging && !isMouseOverScrollbarRef.current) {
            setIsScrollbarVisible(false);
        }
    }, [isDragging]);

    const showScrollbar = useCallback(() => {
        // Don't interfere if we're in the post-drag auto-hide period
        if (postDragAutoHideActive) {
            return;
        }

        setIsScrollbarVisible(true);
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = window.setTimeout(tryHideScrollbar, 2000);
    }, [tryHideScrollbar, postDragAutoHideActive]);

    const handleScroll = useCallback(() => {
        updateScrollbar();

        // If user scrolls after dragging, clear the flags and cancel post-drag auto-hide
        if (justFinishedDragging || postDragAutoHideActive) {
            setJustFinishedDragging(false);
            setPostDragAutoHideActive(false);
            if (postDragTimeoutRef.current) {
                clearTimeout(postDragTimeoutRef.current);
            }
        }

        // Only show scrollbar if not currently dragging
        if (!isDragging) {
            showScrollbar();
        }
    }, [updateScrollbar, showScrollbar, isDragging, justFinishedDragging, postDragAutoHideActive]);

    const handleMouseEnter = useCallback(() => {


        isMouseOverScrollbarRef.current = true;
        // Reset the auto-hide timer when mouse enters scrollbar
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        setIsScrollbarVisible(true);
        // Start a fresh 2-second timer
        hideTimeoutRef.current = window.setTimeout(tryHideScrollbar, 2000);
    }, [tryHideScrollbar]);

    const handleMouseLeave = useCallback(() => {
        isMouseOverScrollbarRef.current = false;
        // Only set timer if not currently dragging
        // If dragging, handleMouseUp will handle the timer
        if (!isDragging) {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            hideTimeoutRef.current = window.setTimeout(tryHideScrollbar, 1000);
        }
    }, [isDragging, tryHideScrollbar]);

    const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        // Temporarily disable smooth scrolling during drag
        const originalScrollBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';

        setIsDragging(true);
        setDragStart({
            y: e.clientY,
            scrollTop: window.pageYOffset || document.documentElement.scrollTop,
        });

        // Store the original scroll behavior to restore later
        (window as Window & { originalScrollBehavior?: string }).originalScrollBehavior = originalScrollBehavior;
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const deltaY = e.clientY - dragStart.y;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;

        const scrollRange = scrollHeight - clientHeight;
        const thumbRange = clientHeight - thumbHeight;
        const scrollRatio = scrollRange / thumbRange;

        const newScrollTop = Math.max(0, Math.min(scrollRange, dragStart.scrollTop + deltaY * scrollRatio));

        // Direct scroll assignment for instant response - no animation frames or delays
        document.documentElement.scrollTop = newScrollTop;
        document.body.scrollTop = newScrollTop; // For Safari compatibility
    }, [isDragging, dragStart, thumbHeight]);

    const handleMouseUp = useCallback(() => {
        const wasDragging = isDragging;
        setIsDragging(false);

        // Restore original scroll behavior
        const originalBehavior = (window as Window & { originalScrollBehavior?: string }).originalScrollBehavior;
        if (originalBehavior !== undefined) {
            document.documentElement.style.scrollBehavior = originalBehavior;
        }

        // Always start auto-hide timer after drag ends, regardless of mouse position
        if (wasDragging) {
            setJustFinishedDragging(true);
            setPostDragAutoHideActive(true); // Block showScrollbar from interfering

            // Clear any existing timers
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            if (postDragTimeoutRef.current) {
                clearTimeout(postDragTimeoutRef.current);
            }

            // Set post-drag auto-hide timer
            postDragTimeoutRef.current = window.setTimeout(() => {
                // Only hide if mouse is not over scrollbar
                if (!isMouseOverScrollbarRef.current) {
                    setIsScrollbarVisible(false);
                } else {
                    // Start normal auto-hide behavior since mouse is over scrollbar
                    hideTimeoutRef.current = window.setTimeout(tryHideScrollbar, 2000);
                }
                setJustFinishedDragging(false);
                setPostDragAutoHideActive(false); // Re-enable normal behavior
            }, 1000);
        }
    }, [isDragging, tryHideScrollbar]);

    const handleTrackClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;
            const scrollPercentage = clickY / clientHeight;
            const newScrollTop = scrollPercentage * (scrollHeight - clientHeight);

            window.scrollTo({
                top: Math.max(0, Math.min(scrollHeight - clientHeight, newScrollTop)),
                behavior: 'smooth'
            });
        }
    }, []);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
        const handleGlobalMouseUp = () => handleMouseUp();

        if (isDragging) {
            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
            document.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    useEffect(() => {
        updateScrollbar();

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateScrollbar);

        // Watch for DOM changes to detect when overlays open/close
        const observer = new MutationObserver(() => {
            updateScrollbar(); // Re-check if scrollbar should be visible
        });

        // Observe changes to the document body and backdrop/modal elements
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['role', 'class', 'aria-hidden']
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updateScrollbar);
            observer.disconnect();
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, [updateScrollbar, handleScroll]);

    // Don't render if there's no content to scroll
    if (thumbHeight === 0) {
        return null;
    }

    return (
        <ScrollbarTrack
            visible={isScrollbarVisible}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleTrackClick}
        >
            <ScrollbarThumb
                height={thumbHeight}
                top={thumbTop}
                isDragging={isDragging}
                onMouseDown={handleThumbMouseDown}
            />
        </ScrollbarTrack>
    );
};
