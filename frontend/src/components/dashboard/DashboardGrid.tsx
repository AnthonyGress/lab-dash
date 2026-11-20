import {
    CollisionDetection,
    DndContext,
    DragEndEvent,
    DragMoveEvent,
    DragStartEvent,
    MeasuringStrategy,
    Modifier,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { Box, useMediaQuery } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shortid from 'shortid';

import { useAppContext } from '../../context/useAppContext';
import { COLORS } from '../../theme/styles';
import { theme } from '../../theme/theme';
import { DashboardItem, GridBreakpoint, GridPoint, GridRect, GridSize, ITEM_TYPE } from '../../types';
import {
    DASHBOARD_GRID_COLUMNS,
    DASHBOARD_GRID_GAP,
    DASHBOARD_GRID_ROW_HEIGHT,
    DESKTOP_GRID_BREAKPOINTS,
    getGridRect,
    getGridRectStyle,
    getGridRowCount,
    getGroupItemLimit,
    layoutDashboardGrid,
    MOBILE_GRID_BREAKPOINTS,
    moveDashboardGridItem,
    placeDashboardGridItem,
    resizeDashboardGridItem,
    snapGridPoint,
    snapGridSize,
} from '../../utils/dashboard-grid';
import { lazyComponent } from '../lazy';
import { CenteredModal } from '../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../modals/PopupManager';
import { ToastManager } from '../toast/ToastManager';
import { AppShortcut } from './base-items/apps/AppShortcut';
import { WidgetContainer } from './base-items/widgets/WidgetContainer';
import { DashboardGridItem } from './DashboardGridItem';
import { DashboardItemContent } from './DashboardItemContent';

// Downloaded when an item is first edited, not with the dashboard
const AddEditForm = lazyComponent(() => import('../forms/AddEditForm/AddEditForm').then(module => module.AddEditForm));

// Spare room below the last item in edit mode, so items can be dropped there
const EDIT_MODE_SPARE_ROWS = 40;

// Group widgets follow drags through these document events
const dispatchDndKitEvent = (name: string, detail: Record<string, unknown>): void => {
    document.dispatchEvent(new CustomEvent(`dndkit:${name}`, { detail }));
};

const isShortcutType = (type: unknown): boolean =>
    type === ITEM_TYPE.APP_SHORTCUT || type === ITEM_TYPE.BLANK_APP;

/**
 * Items are placed by grid position, not by what they are dropped on. The one
 * exception is a shortcut dropped on a group widget: it is over the group once
 * its centre is inside it (with a small margin).
 */
const groupDropCollision: CollisionDetection = ({ active, collisionRect, droppableContainers, droppableRects }) => {
    if (!isShortcutType(active.data.current?.type)) {
        return [];
    }

    const margin = 10;
    const centerX = collisionRect.left + collisionRect.width / 2;
    const centerY = collisionRect.top + collisionRect.height / 2;
    const group = droppableContainers.find(container => {
        const rect = droppableRects.get(container.id);

        return rect !== undefined &&
            container.data.current?.type === 'group-widget-container' &&
            centerX >= rect.left - margin && centerX <= rect.right + margin &&
            centerY >= rect.top - margin && centerY <= rect.bottom + margin;
    });

    return group ? [{ id: group.id }] : [];
};

/**
 * Keeps a dragged item between the left and right edges of the grid. Past the
 * right edge it would widen the page, which then scrolls sideways after it.
 */
const keepInsideGridHorizontally: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
    if (!draggingNodeRect || !containerNodeRect) {
        return transform;
    }

    const leftmost = containerNodeRect.left - draggingNodeRect.left;
    const rightmost = containerNodeRect.right - draggingNodeRect.right;

    return { ...transform, x: Math.min(Math.max(transform.x, leftmost), rightmost) };
};

// The dashboard only ever scrolls vertically
const AUTO_SCROLL = { threshold: { x: 0, y: 0.2 } };

/** A move or resize in progress. Held in a ref: pointer handlers outlive the render that started them. */
type Gesture = {
    kind: 'drag' | 'resize';
    id: string;
    /** The layout when the gesture began. Previews are always computed from it, so pushed items return when the pointer moves away. */
    snapshot: DashboardItem[];
    columnWidth: number;
    startRect: GridRect;
    /** What the pointer last asked for, to skip recomputing while it stays within a cell. */
    request: string;
    point?: GridPoint;
    size?: GridSize;
};

type GroupItemPreview = {
    name?: string;
    icon?: string;
    url?: string;
};

export const DashboardGrid: React.FC = () => {
    const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
    const [openEditModal, setOpenEditModal] = useState(false);
    const { dashboardLayout, setDashboardLayout, refreshDashboard, editMode, isAdmin, isLoggedIn, saveLayout } = useAppContext();
    const isXs = useMediaQuery(theme.breakpoints.down('sm'));
    const isSm = useMediaQuery(theme.breakpoints.down('md'));
    const isMd = useMediaQuery(theme.breakpoints.down('lg'));
    const breakpoint: GridBreakpoint = isXs ? 'xs' : isSm ? 'sm' : isMd ? 'md' : 'lg';

    const gridRef = useRef<HTMLDivElement | null>(null);
    const gestureRef = useRef<Gesture | null>(null);
    const [activeGesture, setActiveGesture] = useState<{ kind: Gesture['kind']; id: string } | null>(null);
    // The layout as it would be if the gesture ended now
    const [preview, setPreview] = useState<DashboardItem[] | null>(null);
    const [isOverGroup, setIsOverGroup] = useState(false);
    // The item that was just dropped: it must not animate from where it started
    const [settledId, setSettledId] = useState<string | null>(null);
    const [groupItemPreview, setGroupItemPreview] = useState<GroupItemPreview | null>(null);

    // Layouts saved before the grid existed have no positions. They are laid out
    // here in memory and get stored the first time the layout is edited.
    const layout = useMemo(
        () => layoutDashboardGrid(dashboardLayout, [breakpoint]),
        [dashboardLayout, breakpoint]
    );

    // Filter out admin-only items if user is not an admin
    const items = useMemo(
        () => (isAdmin ? layout : layout.filter(item => item.adminOnly !== true)),
        [layout, isAdmin]
    );

    const prevAuthStatus = useRef({ isLoggedIn, isAdmin });

    useEffect(() => {
        // Only refresh if login status or admin status has actually changed
        if (prevAuthStatus.current.isLoggedIn !== isLoggedIn ||
            prevAuthStatus.current.isAdmin !== isAdmin) {

            refreshDashboard();

            // Update ref with current values
            prevAuthStatus.current = { isLoggedIn, isAdmin };
        }
    }, [isLoggedIn, isAdmin, refreshDashboard]);

    const isMobile = useMemo(() => {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
    }, []);

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            delay: isMobile ? 100 : 0, // Prevents accidental drags
            tolerance: 5, // Ensures drag starts after small movement
        }
    }));

    // A group widget announces the shortcut being dragged out of it, so the
    // grid can show where it will land
    useEffect(() => {
        const handleGroupItemPreview = (event: Event) => {
            const { dragging, item } = (event as CustomEvent).detail || {};
            setGroupItemPreview(dragging ? { name: item?.name, icon: item?.icon, url: item?.url } : null);
        };

        document.addEventListener('dndkit:group-item-preview', handleGroupItemPreview);

        return () => {
            document.removeEventListener('dndkit:group-item-preview', handleGroupItemPreview);
        };
    }, []);

    useEffect(() => {
        if (!settledId) return;

        const timer = setTimeout(() => setSettledId(null), 200);
        return () => clearTimeout(timer);
    }, [settledId]);

    // Keep the page from scrolling under a touch drag or resize
    const isGestureActive = activeGesture !== null;
    useEffect(() => {
        if (!isGestureActive) return;

        const disableScroll = (event: TouchEvent) => {
            if (event.cancelable) {
                event.preventDefault();
            }
        };

        document.addEventListener('touchmove', disableScroll, { passive: false });

        return () => {
            document.removeEventListener('touchmove', disableScroll);
        };
    }, [isGestureActive]);

    const commitLayout = (nextLayout: DashboardItem[]) => {
        setDashboardLayout(nextLayout);
        saveLayout(nextLayout);
    };

    // Pointer listeners are attached when a gesture starts and keep running
    // across renders, so they read what they need from here
    const latest = useRef({ layout, dashboardLayout, breakpoint, commitLayout });
    latest.current = { layout, dashboardLayout, breakpoint, commitLayout };

    const beginGesture = (kind: Gesture['kind'], id: string): Gesture | null => {
        const item = latest.current.layout.find(candidate => candidate.id === id);
        const startRect = item && getGridRect(item, latest.current.breakpoint);
        const gridWidth = gridRef.current?.getBoundingClientRect().width;

        if (!startRect || !gridWidth) {
            return null;
        }

        gestureRef.current = {
            kind,
            id,
            snapshot: latest.current.layout,
            columnWidth: gridWidth / DASHBOARD_GRID_COLUMNS,
            startRect,
            request: '',
        };
        setActiveGesture({ kind, id });

        return gestureRef.current;
    };

    const endGesture = (): Gesture | null => {
        const gesture = gestureRef.current;

        gestureRef.current = null;
        setActiveGesture(null);
        setPreview(null);
        setIsOverGroup(false);
        if (isMobile) {
            document.body.style.overflow = '';
        }

        return gesture;
    };

    /** The group a shortcut would be added to if dropped now, if any. A full group is just an obstacle. */
    const getDropGroupId = (event: DragMoveEvent | DragEndEvent): string | null => {
        const groupId = event.over?.data.current?.groupId;

        if (typeof groupId !== 'string' || !isShortcutType(event.active.data.current?.type)) {
            return null;
        }

        const group = latest.current.layout.find(item => item.id === groupId);
        const hasRoom = group !== undefined && (group.config?.items?.length ?? 0) < getGroupItemLimit(group.config);

        return hasRoom ? groupId : null;
    };

    const handleDragStart = ({ active }: DragStartEvent) => {
        beginGesture('drag', String(active.id));
        dispatchDndKitEvent('active', { active: { id: active.id, data: active.data.current } });
    };

    // Runs when the pointer moves and when what it is over changes
    const updateDragPreview = (event: DragMoveEvent) => {
        const gesture = gestureRef.current;

        if (gesture?.kind !== 'drag') {
            return;
        }

        if (getDropGroupId(event)) {
            // The shortcut is about to join the group: leave the layout alone
            if (gesture.request !== 'group') {
                gesture.request = 'group';
                setPreview(null);
                setIsOverGroup(true);
            }
            return;
        }

        // Where the pointer is, pulled onto the edges of nearby items
        const point = snapGridPoint(gesture.snapshot, gesture.id, {
            x: gesture.startRect.x + Math.round(event.delta.x / gesture.columnWidth),
            y: gesture.startRect.y + Math.round(event.delta.y / DASHBOARD_GRID_ROW_HEIGHT),
        }, latest.current.breakpoint);
        const request = `${point.x},${point.y}`;

        if (request !== gesture.request) {
            gesture.request = request;
            gesture.point = point;
            setPreview(moveDashboardGridItem(gesture.snapshot, gesture.id, point, latest.current.breakpoint));
            setIsOverGroup(false);
        }
    };

    const handleDragOver = (event: DragMoveEvent) => {
        updateDragPreview(event);
        dispatchDndKitEvent('dragover', { over: event.over, active: event.active });
    };

    const handleDragCancel = () => {
        endGesture();
        dispatchDndKitEvent('inactive', {});
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const dropGroupId = getDropGroupId(event);
        const gesture = endGesture();
        const detail = {
            active,
            over,
            activeId: active.id,
            activeType: active.data.current?.type,
            overId: over?.id,
            overType: over?.data.current?.type,
        };

        if (dropGroupId) {
            // The group widget moves the shortcut into itself
            dispatchDndKitEvent('app-to-group', { active, over, confirmed: true });
            dispatchDndKitEvent('dragend', { ...detail, action: 'app-to-group' });
        } else {
            if (gesture?.kind === 'drag' && gesture.point) {
                const { dashboardLayout: currentLayout, breakpoint: currentBreakpoint } = latest.current;

                setSettledId(gesture.id);
                commitLayout(moveDashboardGridItem(currentLayout, gesture.id, gesture.point, currentBreakpoint));
            }
            dispatchDndKitEvent('dragend', { ...detail, action: 'reorder' });
        }

        dispatchDndKitEvent('inactive', {});
    };

    const handleResize = useCallback((id: string, requestedSize: GridSize) => {
        const gesture = gestureRef.current?.id === id ? gestureRef.current : beginGesture('resize', id);

        if (!gesture) {
            return;
        }

        // What the pointer asks for, pulled to the edges and sizes of nearby items
        const size = snapGridSize(gesture.snapshot, id, requestedSize, latest.current.breakpoint);
        const request = `${size.w}x${size.h}`;

        if (request !== gesture.request) {
            gesture.request = request;
            gesture.size = size;
            setPreview(resizeDashboardGridItem(gesture.snapshot, id, size, latest.current.breakpoint));
        }
    // Reads current values through refs; see `latest`
    }, []);

    const handleResizeEnd = useCallback((id: string, commit: boolean) => {
        const gesture = endGesture();

        if (commit && gesture?.kind === 'resize' && gesture.size) {
            const { dashboardLayout: currentLayout, breakpoint: currentBreakpoint } = latest.current;
            latest.current.commitLayout(resizeDashboardGridItem(currentLayout, id, gesture.size, currentBreakpoint));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = (id: string) => {
        const itemToDelete = dashboardLayout.find(item => item.id === id);
        const itemName = itemToDelete?.label || itemToDelete?.config?.displayName || 'Item';

        const options: ConfirmationOptions = {
            title: 'Delete Item?',
            confirmAction: async () => {
                const updatedLayout = dashboardLayout.filter((item) => item.id !== id);
                setDashboardLayout(updatedLayout);
                saveLayout(updatedLayout);

                // Show success toast
                ToastManager.success(`${itemName} deleted successfully`);
            }
        };

        PopupManager.deleteConfirmation(options);
    };

    const handleEdit = (item: DashboardItem) => {
        setSelectedItem(item);
        setOpenEditModal(true);
    };

    const handleDuplicate = async (item: DashboardItem) => {
        // Deep clone the item
        const duplicatedItem: DashboardItem = JSON.parse(JSON.stringify(item));

        // Generate a new unique ID for the main item
        const newItemId = shortid.generate();
        duplicatedItem.id = newItemId;

        // Helper function to preserve sensitive data flags for any config
        const preserveSensitiveDataFlags = (config: any) => {
            if (!config) return config;

            const preservedConfig = { ...config };

            // Preserve Pi-hole sensitive data flags
            if (config._hasApiToken) {
                preservedConfig._hasApiToken = true;
            }
            if (config._hasPassword) {
                preservedConfig._hasPassword = true;
            }

            // Preserve AdGuard Home sensitive data flags
            if (config._hasUsername) {
                preservedConfig._hasUsername = true;
            }

            return preservedConfig;
        };

        // Add duplication metadata to help backend copy credentials
        if (duplicatedItem.config) {
            duplicatedItem.config._duplicatedFrom = item.id;
        } else {
            duplicatedItem.config = { _duplicatedFrom: item.id };
        }

        // Handle different widget types with sensitive data
        if (duplicatedItem.config) {
            // Handle regular widgets with sensitive data
            duplicatedItem.config = preserveSensitiveDataFlags(duplicatedItem.config);

            // Handle dual widgets with sensitive data
            if (item.type === ITEM_TYPE.DUAL_WIDGET && duplicatedItem.config) {
                if (duplicatedItem.config.topWidget?.config) {
                    duplicatedItem.config.topWidget.config = preserveSensitiveDataFlags(duplicatedItem.config.topWidget.config);
                }
                if (duplicatedItem.config.bottomWidget?.config) {
                    duplicatedItem.config.bottomWidget.config = preserveSensitiveDataFlags(duplicatedItem.config.bottomWidget.config);
                }
            }

            // Handle group widgets
            if (item.type === ITEM_TYPE.GROUP_WIDGET && duplicatedItem.config?.items && item.config?.items) {
                // Ensure each item in the group gets a new ID
                duplicatedItem.config.items = item.config.items.map((groupItem: any) => {
                    const newGroupItemId = shortid.generate();

                    return {
                        ...groupItem,
                        id: newGroupItemId // New ID for each group item
                    };
                });
            }
        }

        // The copy keeps the original's size but takes free space of its own
        const placedDuplicate = placeDashboardGridItem(
            dashboardLayout,
            duplicatedItem,
            breakpoint === 'xs' ? MOBILE_GRID_BREAKPOINTS : DESKTOP_GRID_BREAKPOINTS
        );

        // Find the item's position in the layout
        const index = dashboardLayout.findIndex((i) => i.id === item.id);

        // Insert the duplicated item after the original
        const updatedLayout = [...dashboardLayout];
        updatedLayout.splice(index + 1, 0, placedDuplicate);

        // Update the dashboard
        setDashboardLayout(updatedLayout);

        // Save layout and refresh config to ensure backend processing is complete
        await saveLayout(updatedLayout);

        // Refresh the dashboard to get the updated config with processed credentials
        await refreshDashboard();

        // Add a longer delay to ensure config propagates to all widgets and backend processing is complete
        await new Promise(resolve => setTimeout(resolve, 500));
    };

    // Item content is memoized, so it gets callbacks that never change identity
    const itemHandlers = useRef({ handleDelete, handleEdit, handleDuplicate });
    itemHandlers.current = { handleDelete, handleEdit, handleDuplicate };
    const itemActions = useMemo(() => ({
        onDelete: (item: DashboardItem) => itemHandlers.current.handleDelete(item.id),
        onEdit: (item: DashboardItem) => itemHandlers.current.handleEdit(item),
        onDuplicate: (item: DashboardItem) => { void itemHandlers.current.handleDuplicate(item); },
    }), []);

    const previewRects = useMemo(
        () => preview && new Map(preview.map(item => [item.id, getGridRect(item, breakpoint)])),
        [preview, breakpoint]
    );
    const draggedId = activeGesture?.kind === 'drag' ? activeGesture.id : null;

    // Where a shortcut dragged out of a group will land: the first free spot
    const groupItemPreviewRect = useMemo(() => {
        if (!groupItemPreview) return undefined;

        const placeholder: DashboardItem = { id: 'preview-placeholder', label: '', type: ITEM_TYPE.APP_SHORTCUT };
        return getGridRect(placeDashboardGridItem(layout, placeholder, [breakpoint]), breakpoint);
    }, [groupItemPreview, layout, breakpoint]);

    const rowCount = Math.max(
        getGridRowCount(preview ?? items, breakpoint),
        groupItemPreviewRect ? groupItemPreviewRect.y + groupItemPreviewRect.h : 0
    ) + (editMode ? EDIT_MODE_SPARE_ROWS : 0);

    // Where the dragged item will land
    const dropRect = draggedId && !isOverGroup ? previewRects?.get(draggedId) : undefined;

    const cellSx = {
        boxSizing: 'border-box',
        paddingRight: `${DASHBOARD_GRID_GAP}px`,
        paddingBottom: `${DASHBOARD_GRID_GAP}px`,
        pointerEvents: 'none',
    };

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragMove={updateDragPreview}
                onDragOver={handleDragOver}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
                collisionDetection={groupDropCollision}
                modifiers={[keepInsideGridHorizontally]}
                autoScroll={AUTO_SCROLL}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
                <Box sx={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box', paddingLeft: 2, paddingBottom: 2 }}>
                    <Box
                        ref={gridRef}
                        sx={{ position: 'relative', width: '100%' }}
                        style={{ height: rowCount * DASHBOARD_GRID_ROW_HEIGHT }}
                    >
                        {dropRect && (
                            <Box sx={cellSx} style={getGridRectStyle(dropRect)}>
                                <Box sx={{
                                    width: '100%',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    border: `2px dashed ${COLORS.LIGHT_GRAY_HOVER}`,
                                    borderRadius: 2,
                                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                }} />
                            </Box>
                        )}

                        {items.map(item => {
                            // The dragged item stays in its cell and follows the pointer by transform
                            const rect = (item.id === draggedId ? undefined : previewRects?.get(item.id))
                                ?? getGridRect(item, breakpoint);

                            return rect && (
                                <DashboardGridItem
                                    key={item.id}
                                    id={item.id}
                                    type={item.type}
                                    rect={rect}
                                    editMode={editMode}
                                    animate={item.id !== settledId}
                                    onResize={handleResize}
                                    onResizeEnd={handleResizeEnd}
                                >
                                    <DashboardItemContent item={item} editMode={editMode} {...itemActions} />
                                </DashboardGridItem>
                            );
                        })}

                        {groupItemPreview && groupItemPreviewRect && (
                            <Box sx={cellSx} style={getGridRectStyle(groupItemPreviewRect)}>
                                <WidgetContainer editMode={false} isPreview>
                                    <AppShortcut
                                        url={groupItemPreview.url}
                                        name={`${groupItemPreview.name || 'Item'} (Drop Here)`}
                                        iconName={groupItemPreview.icon || ''}
                                        showLabel
                                        editMode={false}
                                        isPreview
                                    />
                                </WidgetContainer>
                            </Box>
                        )}
                    </Box>
                </Box>
            </DndContext>

            <CenteredModal open={openEditModal} handleClose={() => setOpenEditModal(false)} title='Edit Item'>
                <AddEditForm handleClose={() => setOpenEditModal(false)} existingItem={selectedItem}/>
            </CenteredModal>
        </>
    );
};
