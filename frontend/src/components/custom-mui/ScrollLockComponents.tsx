import { Menu as MuiMenu, MenuProps as MuiMenuProps, Select as MuiSelect, SelectProps as MuiSelectProps } from '@mui/material';
import React, { useEffect, useRef } from 'react';

import { lockScroll } from '../../utils/scroll-utils';

// Custom Menu component with scroll lock
export const Menu: React.FC<MuiMenuProps> = ({ open, children, ...props }) => {
    const unlockScrollRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (open) {
            // Apply scroll lock when menu opens
            if (!unlockScrollRef.current) {
                unlockScrollRef.current = lockScroll();
            }
        } else {
            // Delay unlocking scroll to allow menu close transition to complete
            if (unlockScrollRef.current) {
                const unlock = unlockScrollRef.current;
                unlockScrollRef.current = null;
                
                setTimeout(() => {
                    unlock();
                }, 150);
            }
        }
    }, [open]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (unlockScrollRef.current) {
                unlockScrollRef.current();
                unlockScrollRef.current = null;
            }
        };
    }, []);

    return (
        <MuiMenu
            open={open}
            disableScrollLock={true}
            {...props}
        >
            {children}
        </MuiMenu>
    );
};

// Custom Select component with scroll lock
export const Select: React.FC<MuiSelectProps> = ({ open, children, ...props }) => {
    const unlockScrollRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (open) {
            // Apply scroll lock when select opens
            if (!unlockScrollRef.current) {
                unlockScrollRef.current = lockScroll();
            }
        } else {
            // Delay unlocking scroll to allow select close transition to complete
            if (unlockScrollRef.current) {
                const unlock = unlockScrollRef.current;
                unlockScrollRef.current = null;
                
                setTimeout(() => {
                    unlock();
                }, 150);
            }
        }
    }, [open]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (unlockScrollRef.current) {
                unlockScrollRef.current();
                unlockScrollRef.current = null;
            }
        };
    }, []);

    return (
        <MuiSelect
            open={open}
            MenuProps={{
                disableScrollLock: true,
            }}
            {...props}
        >
            {children}
        </MuiSelect>
    );
};
