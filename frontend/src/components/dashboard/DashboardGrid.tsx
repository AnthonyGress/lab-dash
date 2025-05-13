import {
    closestCenter,
    closestCorners,
    DndContext,
    DragOverlay,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import { Box, Grid2 as Grid, useMediaQuery } from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SortableDeluge } from './sortable-items/widgets/SortableDeluge';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem, ITEM_TYPE, TORRENT_CLIENT_TYPE } from '../../types';
import { AddEditForm } from '../forms/AddEditForm';
import { CenteredModal } from '../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../modals/PopupManager';
import { BlankAppShortcut } from './base-items/apps/BlankAppShortcut';
import { BlankWidget } from './base-items/widgets/BlankWidget';
import { SortableAppShortcut } from './sortable-items/apps/SortableAppShortcut';
import { SortableDateTimeWidget } from './sortable-items/widgets/SortableDateTime';
import { SortableDualWidget } from './sortable-items/widgets/SortableDualWidget';
import { SortableGroupWidgetSmall } from './sortable-items/widgets/SortableGroupWidgetSmall';
import { SortablePihole } from './sortable-items/widgets/SortablePihole';
import { SortableQBittorrent } from './sortable-items/widgets/SortableQBittorrent';
import { SortableSystemMonitorWidget } from './sortable-items/widgets/SortableSystemMonitor';
import { SortableWeatherWidget } from './sortable-items/widgets/SortableWeather';
import { theme } from '../../theme/theme';

// Custom event helper function
const dispatchDndKitEvent = (name: string, detail: Record<string, any>): void => {
    document.dispatchEvent(new CustomEvent(`dndkit:${name}`, { detail }));
};

// Enhanced collision detection that prioritizes drop zones
const customCollisionDetection = (args: any) => {
    // First, check if there are any group containers in the droppable elements
    const groups = args.droppableContainers.filter(
        (container: any) => container.data.current?.type === 'group-widget-small' ||
                    container.id.toString().includes('group-droppable')
    );

    // If the active item is an app shortcut and we have group containers,
    // use a more accurate detection for groups with a higher threshold
    if (args.active.data.current?.type === ITEM_TYPE.APP_SHORTCUT && groups.length > 0) {
        // Use rectIntersection with a higher threshold for app-to-group drops
        // This makes it require more precision when dropping onto a group
        const intersections = groups.map((container: any) => {
            const activeRect = args.active.rect.current;
            const containerRect = container.rect.current;

            if (!activeRect || !containerRect) {
                return { id: container.id, value: 0 };
            }

            // Calculate the intersection area
            const intersectionArea = getIntersectionArea(activeRect, containerRect);

            // Calculate how much of the active element is over the container
            const coverage = intersectionArea / (activeRect.width * activeRect.height);

            // Only consider it a match if at least 40% of the dragged item is over the container
            return {
                id: container.id,
                value: coverage > 0.4 ? coverage : 0
            };
        }).filter((intersection: any) => intersection.value > 0);

        if (intersections.length > 0) {
            // Sort by highest intersection value (most precise overlap)
            intersections.sort((a: any, b: any) => b.value - a.value);
            return [{ id: intersections[0].id }];
        }
    }

    // Fall back to standard detection for other cases
    return closestCorners(args);
};

// Helper function to calculate intersection area between two rectangles
function getIntersectionArea(rect1: any, rect2: any) {
    const xOverlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x));
    const yOverlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y));
    return xOverlap * yOverlap;
}

export const DashboardGrid: React.FC = () => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeData, setActiveData] = useState<any>(null);
    const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
    const [openEditModal, setOpenEditModal] = useState(false);
    const { dashboardLayout, setDashboardLayout, refreshDashboard, editMode, isAdmin, isLoggedIn, saveLayout } = useAppContext();
    const isMed = useMediaQuery(theme.breakpoints.down('md'));
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Filter out admin-only items if user is not an admin
    const items = useMemo(() => {
        if (isAdmin) {
            return dashboardLayout; // Show all items for admins
        } else {
            const filteredItems = dashboardLayout.filter(item => item.adminOnly !== true);
            return filteredItems;
        }
    }, [dashboardLayout, isAdmin, isLoggedIn]);

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

    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (event: any) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveData(active.data.current);
        setIsDragging(true);

        // Dispatch event that drag has started
        dispatchDndKitEvent('active', { active: { id: active.id, data: active.data.current } });
    };

    const handleDragOver = (event: any) => {
        const { over, active } = event;

        // Dispatch drag over event with both over and active data
        dispatchDndKitEvent('dragover', { over, active });
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        console.log('Drag end event:', { active, over });

        // Only proceed with events if we have both active and over
        if (!active || !over) {
            // Just dispatch the general drag end and inactive events
            dispatchDndKitEvent('dragend', { active, over });
            setActiveId(null);
            setActiveData(null);
            setIsDragging(false);
            dispatchDndKitEvent('inactive', {});
            return;
        }

        // Now we have both active and over, so we can proceed with specific handling
        const isAppShortcut = active.data.current?.type === ITEM_TYPE.APP_SHORTCUT;
        const isGroupContainer =
            over.data.current?.type === 'group-widget-small' ||
            over.data.current?.type === 'group-container' ||
            (typeof over.id === 'string' && over.id.includes('group-droppable'));

        if (active && over) {
            // Handle group item dragging to dashboard
            if (active.data.current?.type === 'group-item' &&
                active.data.current?.parentId &&
                over.id !== active.data.current.parentId) {
                // Item was dragged from a group to the dashboard
                // This is handled by the group widget's onItemDragOut callback
                console.log('Group item dragged to dashboard');

                // Dispatch the standard drag end event
                dispatchDndKitEvent('dragend', {
                    active,
                    over,
                    activeId: active?.id,
                    activeType: active?.data?.current?.type,
                    overId: over?.id,
                    overType: over?.data?.current?.type,
                    action: 'group-item-to-dashboard'
                });
            }
            // Handle app shortcut dragging to group ONLY if directly over the group
            else if (isAppShortcut && isGroupContainer) {
                // Item was dragged to a group
                console.log('App shortcut dragged directly over group widget:', over.id);

                // Dispatch a special event for group widgets
                dispatchDndKitEvent('app-to-group', {
                    active,
                    over,
                    confirmed: true
                });

                // Also dispatch the standard drag end event
                dispatchDndKitEvent('dragend', {
                    active,
                    over,
                    activeId: active?.id,
                    activeType: active?.data?.current?.type,
                    overId: over?.id,
                    overType: over?.data?.current?.type,
                    action: 'app-to-group'
                });
            }
            // Handle regular reordering
            else if (active.id !== over.id) {
                setDashboardLayout((prev: any[]) => {
                    const oldIndex = prev.findIndex((item: { id: any; }) => item.id === active.id);
                    const newIndex = prev.findIndex((item: { id: any; }) => item.id === over.id);

                    // Only reorder if we found both indices
                    if (oldIndex !== -1 && newIndex !== -1) {
                        const newItems = arrayMove(prev, oldIndex, newIndex);

                        // Save the updated layout to the server
                        saveLayout(newItems);

                        return newItems;
                    }
                    return prev;
                });

                // Dispatch the standard drag end event
                dispatchDndKitEvent('dragend', {
                    active,
                    over,
                    activeId: active?.id,
                    activeType: active?.data?.current?.type,
                    overId: over?.id,
                    overType: over?.data?.current?.type,
                    action: 'reorder'
                });
            }
            else {
                // Just a click without any change
                dispatchDndKitEvent('dragend', {
                    active,
                    over,
                    activeId: active?.id,
                    activeType: active?.data?.current?.type,
                    overId: over?.id,
                    overType: over?.data?.current?.type,
                    action: 'no-change'
                });
            }
        }

        setActiveId(null);
        setActiveData(null);
        setIsDragging(false);

        // Dispatch inactive event
        dispatchDndKitEvent('inactive', {});
    };

    const handleDelete = (id: string) => {
        const options: ConfirmationOptions = {
            title: 'Delete Item?',
            confirmAction: () => {
                const updatedLayout = dashboardLayout.filter((item) => item.id !== id);
                setDashboardLayout(updatedLayout);
                saveLayout(updatedLayout);
            }
        };

        PopupManager.deleteConfirmation(options);
    };

    const handleEdit = (item: DashboardItem) => {
        setSelectedItem(item);
        setOpenEditModal(true);
    };

    useEffect(() => {
        const disableScroll = (event: TouchEvent) => {
            event.preventDefault();
        };

        if (isDragging) {
            document.addEventListener('touchmove', disableScroll, { passive: false });
        } else {
            document.removeEventListener('touchmove', disableScroll);
        }

        return () => {
            document.removeEventListener('touchmove', disableScroll);
        };
    }, [isDragging]);

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                collisionDetection={customCollisionDetection}
                measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
                <SortableContext items={items.map(item => item.id)} strategy={rectSortingStrategy} disabled={!editMode}>
                    <Box
                        ref={containerRef}
                        sx={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}
                    >
                        <Grid container sx={{
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            px: 2,
                            paddingBottom: 4
                        }} spacing={2}>
                            {items.map((item) => {
                                switch (item.type) {
                                case ITEM_TYPE.WEATHER_WIDGET:
                                    return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.DATE_TIME_WIDGET:
                                    return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                    return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.PIHOLE_WIDGET:
                                    return <SortablePihole key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.TORRENT_CLIENT:
                                    return item.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE
                                        ? <SortableDeluge key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>
                                        : <SortableQBittorrent key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.DUAL_WIDGET: {
                                    // Transform the existing config to the correct structure
                                    const dualWidgetConfig = {
                                        topWidget: item.config?.topWidget || undefined,
                                        bottomWidget: item.config?.bottomWidget || undefined
                                    };
                                    return <SortableDualWidget
                                        key={item.id}
                                        id={item.id}
                                        editMode={editMode}
                                        config={dualWidgetConfig}
                                        onDelete={() => handleDelete(item.id)}
                                        onEdit={() => handleEdit(item)}
                                    />;
                                }
                                case ITEM_TYPE.GROUP_WIDGET_SMALL:
                                    return <SortableGroupWidgetSmall
                                        key={item.id}
                                        id={item.id}
                                        editMode={editMode}
                                        config={item.config}
                                        onDelete={() => handleDelete(item.id)}
                                        onEdit={() => handleEdit(item)}
                                    />;
                                case ITEM_TYPE.APP_SHORTCUT:
                                    return (
                                        <SortableAppShortcut
                                            key={item.id}
                                            id={item.id}
                                            url={item.url as string}
                                            name={item.label}
                                            iconName={item.icon?.path || ''}
                                            editMode={editMode}
                                            onDelete={() => handleDelete(item.id)}
                                            onEdit={() => handleEdit(item)}
                                            showLabel={item.showLabel}
                                            config={item.config}
                                        />
                                    );
                                case ITEM_TYPE.BLANK_APP:
                                    return <BlankAppShortcut key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} />;
                                case ITEM_TYPE.BLANK_ROW:
                                    return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} row/>;
                                default:
                                    return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} />;
                                }
                            })}
                        </Grid>
                    </Box>
                </SortableContext>

                <DragOverlay>
                    {activeId ? (
                        // For group items being dragged out, always render as app shortcut
                        activeData?.type === 'group-item' ? (
                            // Render a app shortcut overlay for dragged group items
                            <SortableAppShortcut
                                id={activeId}
                                url={activeData.originalItem?.url || '#'}
                                name={activeData.originalItem?.name || 'App'}
                                iconName={activeData.originalItem?.icon || ''}
                                editMode={editMode}
                                isOverlay
                                showLabel={true}
                                config={{}}
                            />
                        ) : (
                            // For normal dashboard items, render appropriate overlay
                            items.map((item) => {
                                if (item.id === activeId) {
                                    switch (item.type) {
                                    case ITEM_TYPE.WEATHER_WIDGET:
                                        return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.DATE_TIME_WIDGET:
                                        return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                        return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.PIHOLE_WIDGET:
                                        return <SortablePihole key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.TORRENT_CLIENT:
                                        return item.config?.clientType === TORRENT_CLIENT_TYPE.DELUGE
                                            ? <SortableDeluge key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>
                                            : <SortableQBittorrent key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.DUAL_WIDGET: {
                                        // Transform the existing config to the correct structure
                                        const dualWidgetConfig = {
                                            topWidget: item.config?.topWidget || undefined,
                                            bottomWidget: item.config?.bottomWidget || undefined
                                        };
                                        return <SortableDualWidget
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={dualWidgetConfig}
                                            isOverlay
                                        />;
                                    }
                                    case ITEM_TYPE.GROUP_WIDGET_SMALL:
                                        return <SortableGroupWidgetSmall
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.APP_SHORTCUT:
                                        return (
                                            <SortableAppShortcut
                                                key={item.id}
                                                id={item.id}
                                                url={item.url as string}
                                                name={item.label}
                                                iconName={item.icon?.path || ''}
                                                editMode={editMode}
                                                isOverlay
                                                showLabel={item.showLabel}
                                                config={item.config}
                                            />
                                        );
                                    case ITEM_TYPE.BLANK_APP:
                                        return <BlankAppShortcut key={item.id} id={item.id} editMode={editMode} isOverlay/>;
                                    case ITEM_TYPE.BLANK_ROW:
                                        return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} isOverlay row/>;
                                    default:
                                        return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} isOverlay/>;
                                    }
                                }
                                return null;
                            })
                        )
                    ) : null}
                </DragOverlay>
            </DndContext>
            <CenteredModal open={openEditModal} handleClose={() => setOpenEditModal(false)} title='Edit Item'>
                <AddEditForm handleClose={() => setOpenEditModal(false)} existingItem={selectedItem}/>
            </CenteredModal>
        </>
    );
};
