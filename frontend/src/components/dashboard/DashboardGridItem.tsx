import { useDraggable } from '@dnd-kit/core';
import { Box } from '@mui/material';
import React, { useRef, useState } from 'react';

import { GridRect, GridSize } from '../../types';
import {
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_GAP,
    DASHBOARD_GRID_ROW_HEIGHT,
    getGridRectStyle,
} from '../../utils/dashboard-grid';

type ResizeAxis = 'x' | 'y' | 'both';

type Props = {
    children: React.ReactNode;
    id: string;
    type: string;
    rect: GridRect;
    editMode: boolean;
    /** Off for an item that was just dropped, so it does not slide in from where it started. */
    animate: boolean;
    onResize: (id: string, size: GridSize) => void;
    onResizeEnd: (id: string, commit: boolean) => void;
};

const MOVE_TRANSITION = ['left', 'top', 'width', 'height'].map(property => `${property} 180ms ease`).join(', ');

// The cell's right and bottom padding is the gap between items, so the
// handles sit on the visible edge of the card rather than the cell's.
const HANDLE_STYLES: Record<ResizeAxis, object> = {
    x: { top: 12, bottom: DASHBOARD_GRID_GAP + 20, right: DASHBOARD_GRID_GAP - 5, width: 10, cursor: 'ew-resize' },
    y: { left: 12, right: DASHBOARD_GRID_GAP + 20, bottom: DASHBOARD_GRID_GAP - 5, height: 10, cursor: 'ns-resize' },
    both: {
        right: DASHBOARD_GRID_GAP - 3,
        bottom: DASHBOARD_GRID_GAP - 3,
        width: 20,
        height: 20,
        cursor: 'nwse-resize',
        // Corner grip
        '&::after': {
            content: '""',
            position: 'absolute',
            right: 6,
            bottom: 6,
            width: 9,
            height: 9,
            borderRight: '2px solid rgba(255, 255, 255, 0.75)',
            borderBottom: '2px solid rgba(255, 255, 255, 0.75)',
            borderBottomRightRadius: 3,
        },
    },
};

/**
 * One cell of the dashboard grid: positions its content, and in edit mode makes
 * it draggable and resizable. The grid decides where things end up; this only
 * reports what the pointer asks for.
 */
export const DashboardGridItem: React.FC<Props> = ({
    children,
    id,
    type,
    rect,
    editMode,
    animate,
    onResize,
    onResizeEnd,
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data: { type },
        disabled: !editMode,
    });
    const nodeRef = useRef<HTMLDivElement | null>(null);
    const [isResizing, setIsResizing] = useState(false);

    const startResize = (axis: ResizeAxis) => (event: React.PointerEvent<HTMLDivElement>) => {
        const node = nodeRef.current;
        const gridWidth = node?.parentElement?.getBoundingClientRect().width;

        // Keep the pointer from starting a drag of the item itself
        event.stopPropagation();
        if (!node || !gridWidth || event.button !== 0) {
            return;
        }
        event.preventDefault();

        const handle = event.currentTarget;
        const { pointerId } = event;
        const columnWidth = gridWidth / DASHBOARD_GRID_COLUMNS;
        const box = node.getBoundingClientRect();
        // Where on the handle it was grabbed, so the edge does not jump to the pointer
        const grab = { x: event.clientX - box.right, y: event.clientY - box.bottom };

        const handleMove = (moveEvent: PointerEvent) => {
            // Measured from the item's corner on screen, so scrolling mid-resize is accounted for
            const origin = node.getBoundingClientRect();

            onResize(id, {
                w: axis === 'y' ? rect.w : Math.round((moveEvent.clientX - grab.x - origin.left) / columnWidth),
                h: axis === 'x' ? rect.h : Math.round((moveEvent.clientY - grab.y - origin.top) / DASHBOARD_GRID_ROW_HEIGHT),
            });
        };
        const finish = (commit: boolean) => {
            handle.removeEventListener('pointermove', handleMove);
            handle.removeEventListener('pointerup', handleUp);
            handle.removeEventListener('pointercancel', handleCancel);
            window.removeEventListener('keydown', handleKey);
            if (handle.hasPointerCapture(pointerId)) {
                handle.releasePointerCapture(pointerId);
            }
            setIsResizing(false);
            onResizeEnd(id, commit);
        };
        const handleUp = () => finish(true);
        const handleCancel = () => finish(false);
        const handleKey = (keyEvent: KeyboardEvent) => {
            if (keyEvent.key === 'Escape') finish(false);
        };

        handle.setPointerCapture(pointerId);
        handle.addEventListener('pointermove', handleMove);
        handle.addEventListener('pointerup', handleUp);
        handle.addEventListener('pointercancel', handleCancel);
        window.addEventListener('keydown', handleKey);
        setIsResizing(true);
    };

    const isActive = isDragging || isResizing;

    return (
        <Box
            ref={(node: HTMLDivElement | null) => {
                nodeRef.current = node;
                setNodeRef(node);
            }}
            data-grid-item-id={id}
            {...(editMode ? attributes : {})}
            {...(editMode ? listeners : {})}
            sx={{
                boxSizing: 'border-box',
                paddingRight: `${DASHBOARD_GRID_GAP}px`,
                paddingBottom: `${DASHBOARD_GRID_GAP}px`,
                minWidth: 0,
                userSelect: editMode ? 'none' : undefined,
                '&:focus-visible': { outline: 'none' },
                '& > .grid-resize-handle': {
                    position: 'absolute',
                    zIndex: 100,
                    touchAction: 'none',
                    borderRadius: '4px',
                    transition: 'background-color 120ms ease',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
                },
            }}
            // Geometry changes on every pointer move, so it is set inline rather than through a generated class
            style={{
                ...getGridRectStyle(rect),
                transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
                transition: animate && !isActive ? MOVE_TRANSITION : 'none',
                zIndex: isActive ? 1000 : undefined,
                opacity: isDragging ? 0.85 : undefined,
            }}
        >
            {children}
            {editMode && (Object.keys(HANDLE_STYLES) as ResizeAxis[]).map(axis => (
                <Box
                    key={axis}
                    className='grid-resize-handle'
                    onPointerDown={startResize(axis)}
                    sx={HANDLE_STYLES[axis]}
                />
            ))}
        </Box>
    );
};
