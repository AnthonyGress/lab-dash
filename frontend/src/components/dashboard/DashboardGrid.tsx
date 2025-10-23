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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shortid from 'shortid';

import { SortableSabnzbd } from './sortable-items/widgets/SortableSabnzbd';
import { SortableNzbget } from './sortable-items/widgets/SortableNzbget';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem, DOWNLOAD_CLIENT_TYPE, ITEM_TYPE, TORRENT_CLIENT_TYPE } from '../../types';
import { AddEditForm } from '../forms/AddEditForm/AddEditForm';
import { CenteredModal } from '../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../modals/PopupManager';
import { ToastManager } from '../toast/ToastManager';
import { BlankAppShortcut } from './base-items/apps/BlankAppShortcut';
import { BlankWidget } from './base-items/widgets/BlankWidget';
import { SortableAppShortcut } from './sortable-items/apps/SortableAppShortcut';
import { SortableAdGuard } from './sortable-items/widgets/SortableAdGuard';
import { SortableDateTimeWidget } from './sortable-items/widgets/SortableDateTime';
import { SortableDeluge } from './sortable-items/widgets/SortableDeluge';
import { SortableDiskMonitor } from './sortable-items/widgets/SortableDiskMonitor';
import { SortableDualWidget } from './sortable-items/widgets/SortableDualWidget';
import { SortableGroupWidget } from './sortable-items/widgets/SortableGroupWidget';
import { SortableMediaRequestManager } from './sortable-items/widgets/SortableMediaRequestManager';
import { SortableMediaServer } from './sortable-items/widgets/SortableMediaServer';
import { SortableNotes } from './sortable-items/widgets/SortableNotes';
import { SortablePihole } from './sortable-items/widgets/SortablePihole';
import { SortableQBittorrent } from './sortable-items/widgets/SortableQBittorrent';
import { SortableRadarr } from './sortable-items/widgets/SortableRadarr';
import { SortableSonarr } from './sortable-items/widgets/SortableSonarr';
import { SortableSystemMonitorWidget } from './sortable-items/widgets/SortableSystemMonitor';
import { SortableTransmission } from './sortable-items/widgets/SortableTransmission';
import { SortableWeatherWidget } from './sortable-items/widgets/SortableWeather';
import { theme } from '../../theme/theme';

// Custom event helper function
const dispatchDndKitEvent = (name: string, detail: Record<string, any>): void => {
    document.dispatchEvent(new CustomEvent(`dndkit:${name}`, { detail }));
};

// Enhanced collision detection that prioritizes drop zones
const customCollisionDetection = (args: any) => {
    const isAppShortcutType =
        args.active.data.current?.type === ITEM_TYPE.APP_SHORTCUT ||
        args.active.data.current?.type === ITEM_TYPE.BLANK_APP;

    const isGroupWidgetType = args.active.data.current?.type === 'group-widget';

    // If the active item is an app shortcut, use expanded collision detection for ALL containers
    if (isAppShortcutType) {

        // Check ALL containers, not just groups, and apply generous detection to group-like containers
        const allIntersections = args.droppableContainers.map((container: any) => {
            const activeRect = args.active.rect.current.translated || args.active.rect.current.initial;
            const containerRect = container.rect.current;

            if (!activeRect || !containerRect) {
                return { id: container.id, value: 0 };
            }



            // Try to get valid coordinates from different possible properties
            const activeX = activeRect.x ?? activeRect.left ?? 0;
            const activeY = activeRect.y ?? activeRect.top ?? 0;
            const activeWidth = activeRect.width ?? 0;
            const activeHeight = activeRect.height ?? 0;

            const containerX = containerRect.x ?? containerRect.left ?? 0;
            const containerY = containerRect.y ?? containerRect.top ?? 0;
            const containerWidth = containerRect.width ?? 0;
            const containerHeight = containerRect.height ?? 0;

            // Skip if we still don't have valid coordinates
            if (activeX === 0 && activeY === 0 && activeWidth === 0 && activeHeight === 0) {
                return { id: container.id, value: 0 };
            }

            // Check if this is a group-related container
            const isGroupContainer =
                container.data.current?.type === 'group-widget' ||
                container.data.current?.type === 'group-container' ||
                container.data.current?.type === 'group-widget-container' ||
                container.id.toString().includes('group-droppable') ||
                container.data.current?.groupId;

            if (isGroupContainer) {
                // Calculate the center point of the dragged item using normalized coordinates
                const activeCenterX = activeX + activeWidth / 2;
                const activeCenterY = activeY + activeHeight / 2;

                // Expand the container rect by 10px on all sides for precise targeting
                const expandedRect = {
                    x: containerX - 10,
                    y: containerY - 10,
                    width: containerWidth + 20,
                    height: containerHeight + 20
                };

                // Check if the center point is within the expanded bounds
                const centerInBounds =
                    activeCenterX >= expandedRect.x &&
                    activeCenterX <= expandedRect.x + expandedRect.width &&
                    activeCenterY >= expandedRect.y &&
                    activeCenterY <= expandedRect.y + expandedRect.height;

                // Create normalized rect objects for intersection calculation
                const normalizedActiveRect = {
                    x: activeX,
                    y: activeY,
                    width: activeWidth,
                    height: activeHeight
                };

                // Also calculate intersection area as a fallback
                const intersectionArea = getIntersectionArea(normalizedActiveRect, expandedRect);
                const coverage = intersectionArea / (activeWidth * activeHeight);

                // Use center point detection OR higher threshold overlap
                const hasValidDrop = centerInBounds || coverage > 0.3;

                return {
                    id: container.id,
                    value: hasValidDrop ? (centerInBounds ? 1.0 : coverage) : 0
                };
            } else {
                // For non-group containers, use standard collision detection
                const normalizedActiveRect = {
                    x: activeX,
                    y: activeY,
                    width: activeWidth,
                    height: activeHeight
                };
                const normalizedContainerRect = {
                    x: containerX,
                    y: containerY,
                    width: containerWidth,
                    height: containerHeight
                };
                const intersectionArea = getIntersectionArea(normalizedActiveRect, normalizedContainerRect);
                const coverage = intersectionArea / (activeWidth * activeHeight);
                return {
                    id: container.id,
                    value: coverage > 0.5 ? coverage : 0 // Standard threshold for non-groups
                };
            }
        }).filter((intersection: any) => intersection.value > 0);

        if (allIntersections.length > 0) {
            // Sort by highest intersection value (most precise overlap)
            allIntersections.sort((a: any, b: any) => b.value - a.value);
            return [{ id: allIntersections[0].id }];
        }
    }

    // For group widgets being dragged, use closestCenter for better reordering
    // but exclude group-internal droppable containers to prevent interference
    if (isGroupWidgetType) {
        // Filter out group-internal containers that shouldn't be targets for group reordering
        const filteredContainers = args.droppableContainers.filter((container: any) => {
            const containerId = container.id.toString();
            // Exclude group-internal droppable containers
            return !containerId.includes('group-droppable') &&
                   !containerId.includes('group-widget-droppable') &&
                   container.data.current?.type !== 'group-container' &&
                   container.data.current?.type !== 'group-widget-container';
        });

        // Use closestCenter with filtered containers for group widget reordering
        return closestCenter({
            ...args,
            droppableContainers: filteredContainers
        });
    }

    // For all other widget types (non-app-shortcuts, non-group-widgets)
    // Filter out group-internal containers to ensure proper collision with group widgets
    const filteredContainers = args.droppableContainers.filter((container: any) => {
        const containerId = container.id.toString();
        // Exclude group-internal droppable containers that shouldn't interfere with widget reordering
        return !containerId.includes('group-droppable') &&
               !containerId.includes('group-widget-droppable') &&
               container.data.current?.type !== 'group-container' &&
               container.data.current?.type !== 'group-widget-container';
    });

    // Use closestCorners with filtered containers for better collision detection
    return closestCorners({
        ...args,
        droppableContainers: filteredContainers
    });
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
    const [dragPlaceholder, setDragPlaceholder] = useState<{
        groupId: string,
        itemId: string,
        item?: any,
        visible: boolean,
        position?: string
    } | null>(null);

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

    // Listen for group item preview events
    useEffect(() => {
        // Handler for group item preview
        const handleGroupItemPreview = (event: CustomEvent) => {
            const { dragging, groupId, itemId, position, item } = event.detail || {};

            if (dragging && groupId && itemId) {
                // Find the group index in the dashboard layout
                const groupIndex = items.findIndex(i => i.id === groupId);

                if (groupIndex !== -1) {
                    // Set placeholder data for rendering
                    setDragPlaceholder({
                        groupId,
                        itemId,
                        item,
                        visible: true,
                        position: position || 'next' // Default to next position
                    });
                }
            } else {
                // Hide the placeholder if needed
                if (dragPlaceholder?.visible) {
                    setDragPlaceholder(null);
                }
            }
        };

        // Listen for the preview event from group widgets
        document.addEventListener('dndkit:group-item-preview', handleGroupItemPreview as EventListener);

        // Clean up function
        return () => {
            document.removeEventListener('dndkit:group-item-preview', handleGroupItemPreview as EventListener);
        };
    }, [dragPlaceholder, items]);

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

        setIsDragging(false);
        setDragPlaceholder(null);

        // Reset all drag states
        setActiveId(null);
        setActiveData(null);

        // FAILSAFE: Always restore scrolling on mobile when ANY drag ends
        if (isMobile) {
            document.body.style.overflow = '';
        }

        // Only proceed with events if we have both active and over
        if (!active || !over) {
            // Just dispatch the general drag end and inactive events
            dispatchDndKitEvent('dragend', { active, over });
            dispatchDndKitEvent('inactive', {});
            return;
        }

        // Now we have both active and over, so we can proceed with specific handling
        const isAppShortcut = active.data.current?.type === ITEM_TYPE.APP_SHORTCUT;
        const isGroupItem = active.data.current?.type === 'group-item';
        const isGroupContainer =
            over.data.current?.type === 'group-widget' ||
            over.data.current?.type === 'group-container' ||
            over.data.current?.type === 'group-widget-container' ||
            (typeof over.id === 'string' && over.id.includes('group-droppable')) ||
            (over.data.current?.groupId && typeof over.data.current.groupId === 'string');

        if (active && over) {
            // Handle group item dragging to dashboard
            if (isGroupItem &&
                active.data.current?.parentId &&
                over.id !== active.data.current.parentId) {
                // Item was dragged from a group to the dashboard

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
                setDashboardLayout((prev) => {
                    const oldIndex = prev.findIndex((item) => item.id === active.id);
                    const newIndex = prev.findIndex((item) => item.id === over.id);

                    if (oldIndex !== -1 && newIndex !== -1) {
                        const newItems = arrayMove(prev, oldIndex, newIndex);
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

        // Dispatch inactive event
        dispatchDndKitEvent('inactive', {});
    };

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

        // Find the item's position in the layout
        const index = dashboardLayout.findIndex((i) => i.id === item.id);

        // Insert the duplicated item after the original
        const updatedLayout = [...dashboardLayout];
        updatedLayout.splice(index + 1, 0, duplicatedItem);

        // Update the dashboard
        setDashboardLayout(updatedLayout);

        // Save layout and refresh config to ensure backend processing is complete
        await saveLayout(updatedLayout);

        // Refresh the dashboard to get the updated config with processed credentials
        await refreshDashboard();

        // Add a longer delay to ensure config propagates to all widgets and backend processing is complete
        await new Promise(resolve => setTimeout(resolve, 500));
    };

    useEffect(() => {
        const disableScroll = (event: TouchEvent) => {
            if (event.cancelable) {
                event.preventDefault();
            }
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

    // Find the group widget's index
    const getGroupPosition = useCallback((groupId: string) => {
        return items.findIndex(item => item.id === groupId);
    }, [items]);

    // Render our items with the placeholder inserted at the right position
    const renderItems = () => {
        // Clone the items array
        const itemsToRender = [...items];

        // If we have a visible placeholder and the group exists
        if (dragPlaceholder?.visible) {
            const groupIndex = getGroupPosition(dragPlaceholder.groupId);

            if (groupIndex !== -1) {
                // Determine target index based on position
                const targetIndex = dragPlaceholder.position === 'next'
                    ? groupIndex + 1 // Insert after group
                    : groupIndex;    // Insert before group

                // Insert the placeholder at the target index
                const result: React.ReactNode[] = [];

                itemsToRender.forEach((item, index) => {
                    // If this is where we insert the placeholder
                    if (index === targetIndex) {
                        result.push(renderPlaceholder(dragPlaceholder));
                    }

                    // Always add the current item
                    result.push(renderItem(item));
                });

                // If the placeholder goes at the end
                if (targetIndex >= itemsToRender.length) {
                    result.push(renderPlaceholder(dragPlaceholder));
                }

                return result;
            }
        }

        // If no placeholder or group not found, just render the items normally
        return itemsToRender.map(item => renderItem(item));
    };

    // Helper function to create a proper DateTimeConfig
    const createDateTimeConfig = (config: any) => {
        return {
            location: config?.location || null,
            timezone: config?.timezone || undefined
        };
    };

    // Helper function to render download client components
    const renderDownloadClient = (item: any, isOverlay = false) => {
        const clientType = item.config?.clientType;
        const key = item.id;
        const commonProps = {
            id: item.id,
            editMode,
            config: item.config,
            onDelete: () => handleDelete(item.id),
            onEdit: () => handleEdit(item),
            onDuplicate: () => handleDuplicate(item),
            ...(isOverlay && { isOverlay })
        };

        // Handle all download client types for DOWNLOAD_CLIENT
        if (item.type === ITEM_TYPE.DOWNLOAD_CLIENT) {
            if (clientType === DOWNLOAD_CLIENT_TYPE.DELUGE) {
                return <SortableDeluge key={key} {...commonProps} />;
            }
            if (clientType === DOWNLOAD_CLIENT_TYPE.TRANSMISSION) {
                return <SortableTransmission key={key} {...commonProps} />;
            }
            if (clientType === DOWNLOAD_CLIENT_TYPE.SABNZBD) {
                return <SortableSabnzbd key={key} {...commonProps} />;
            }
            if (clientType === DOWNLOAD_CLIENT_TYPE.NZBGET) {
                return <SortableNzbget key={key} {...commonProps} />;
            }
            // Default to qBittorrent for DOWNLOAD_CLIENT
            return <SortableQBittorrent key={key} {...commonProps} />;
        }

        // Handle legacy TORRENT_CLIENT - only torrent clients (no SABnzbd)
        if (item.type === ITEM_TYPE.TORRENT_CLIENT) {
            if (clientType === TORRENT_CLIENT_TYPE.DELUGE) {
                return <SortableDeluge key={key} {...commonProps} />;
            }
            if (clientType === TORRENT_CLIENT_TYPE.TRANSMISSION) {
                return <SortableTransmission key={key} {...commonProps} />;
            }
            if (clientType === TORRENT_CLIENT_TYPE.QBITTORRENT) {
                return <SortableQBittorrent key={key} {...commonProps} />;
            }
            // Default to qBittorrent for legacy torrent client
            return <SortableQBittorrent key={key} {...commonProps} />;
        }

        // Fallback
        return <SortableQBittorrent key={key} {...commonProps} />;
    };

    // Render a single item
    const renderItem = (item: any) => {
        switch (item.type) {
        case ITEM_TYPE.WEATHER_WIDGET:
            return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)}/>;
        case ITEM_TYPE.DATE_TIME_WIDGET:
            return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} config={createDateTimeConfig(item.config)} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)}/>;
        case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
            return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)}/>;
        case ITEM_TYPE.DISK_MONITOR_WIDGET:
            return <SortableDiskMonitor key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)} />;
        case ITEM_TYPE.PIHOLE_WIDGET:
            return <SortablePihole key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)}/>;
        case ITEM_TYPE.ADGUARD_WIDGET:
            return <SortableAdGuard key={item.id} id={item.id} editMode={editMode} config={item.config} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)}/>;
        case ITEM_TYPE.DOWNLOAD_CLIENT:
            return renderDownloadClient(item);
        case ITEM_TYPE.TORRENT_CLIENT:
            return renderDownloadClient(item);
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
                onDuplicate={() => handleDuplicate(item)}
            />;
        }
        case ITEM_TYPE.GROUP_WIDGET:
            return <SortableGroupWidget
                key={item.id}
                id={item.id}
                editMode={editMode}
                label={item.label}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.MEDIA_SERVER_WIDGET:
            return <SortableMediaServer
                key={item.id}
                id={item.id}
                editMode={editMode}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET:
            return <SortableMediaRequestManager
                key={item.id}
                id={item.id}
                editMode={editMode}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.NOTES_WIDGET:
            return <SortableNotes
                key={item.id}
                id={item.id}
                editMode={editMode}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.SONARR_WIDGET:
            return <SortableSonarr
                key={item.id}
                id={item.id}
                editMode={editMode}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.RADARR_WIDGET:
            return <SortableRadarr
                key={item.id}
                id={item.id}
                editMode={editMode}
                config={item.config}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => handleEdit(item)}
                onDuplicate={() => handleDuplicate(item)}
            />;
        case ITEM_TYPE.APP_SHORTCUT:
            return (
                <SortableAppShortcut
                    key={item.id}
                    id={item.id}
                    url={item.url}
                    name={item.label}
                    iconName={item.icon?.path || ''}
                    editMode={editMode}
                    onDelete={() => handleDelete(item.id)}
                    onEdit={() => handleEdit(item)}
                    onDuplicate={() => handleDuplicate(item)}
                    showLabel={item.showLabel}
                    config={item.config}
                />
            );
        case ITEM_TYPE.BLANK_APP:
            return <BlankAppShortcut key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)} />;
        case ITEM_TYPE.BLANK_ROW:
            return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)} row/>;
        default:
            return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)} onDuplicate={() => handleDuplicate(item)} />;
        }
    };

    // Render a placeholder app shortcut
    const renderPlaceholder = (placeholder: any) => {
        const name = placeholder.item?.name || 'Item';
        const icon = placeholder.item?.icon || '';
        const url = placeholder.item?.url;
        const healthUrl = placeholder.item?.healthUrl;
        const healthCheckType = placeholder.item?.healthCheckType;
        const isWol = placeholder.item?.isWol;

        // Create a more complete config object based on available item properties
        const config: any = {};

        if (healthUrl) {
            config.healthUrl = healthUrl;
            config.healthCheckType = healthCheckType;
        }

        if (isWol) {
            config.isWol = isWol;
            config.macAddress = placeholder.item?.macAddress;
            config.broadcastAddress = placeholder.item?.broadcastAddress;
            config.port = placeholder.item?.port;
        }

        return (
            <SortableAppShortcut
                key='preview-placeholder'
                id='preview-placeholder'
                url={url}
                name={name}
                iconName={icon}
                editMode={false}
                showLabel={true}
                config={config}
                isOverlay={true}
            />
        );
    };

    // Get ids including the placeholder if visible
    const getSortableIds = () => {
        if (dragPlaceholder?.visible) {
            return [...items.map(item => item.id), 'placeholder'];
        }
        return items.map(item => item.id);
    };

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
                <SortableContext items={getSortableIds()} strategy={rectSortingStrategy} disabled={!editMode}>
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
                            {renderItems()}
                        </Grid>
                    </Box>
                </SortableContext>

                <DragOverlay
                    modifiers={[]}
                    zIndex={10000}
                >
                    {activeId ? (
                        // For group items being dragged out, always render as app shortcut
                        activeData?.type === 'group-item' ? (
                            // Render a app shortcut overlay for dragged group items
                            <SortableAppShortcut
                                key={activeId}
                                id={activeId}
                                url={activeData.originalItem?.url}
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
                                    case ITEM_TYPE.DATE_TIME_WIDGET: {
                                        // Create a properly typed config for DateTimeWidget
                                        const dateTimeConfig = {
                                            location: item.config?.location || null,
                                            timezone: item.config?.timezone || undefined
                                        };
                                        return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} config={dateTimeConfig} isOverlay/>;
                                    }
                                    case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                        return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.DISK_MONITOR_WIDGET:
                                        return <SortableDiskMonitor key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay />;
                                    case ITEM_TYPE.PIHOLE_WIDGET:
                                        return <SortablePihole key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.ADGUARD_WIDGET:
                                        return <SortableAdGuard key={item.id} id={item.id} editMode={editMode} config={item.config} isOverlay/>;
                                    case ITEM_TYPE.DOWNLOAD_CLIENT:
                                    case ITEM_TYPE.TORRENT_CLIENT:
                                        return renderDownloadClient(item, true);
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
                                    case ITEM_TYPE.GROUP_WIDGET:
                                        return <SortableGroupWidget
                                            key={item.id}
                                            id={item.id}
                                            label={item.label}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.MEDIA_SERVER_WIDGET:
                                        return <SortableMediaServer
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.SONARR_WIDGET:
                                        return <SortableSonarr
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.RADARR_WIDGET:
                                        return <SortableRadarr
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.MEDIA_REQUEST_MANAGER_WIDGET:
                                        return <SortableMediaRequestManager
                                            key={item.id}
                                            id={item.id}
                                            editMode={editMode}
                                            config={item.config}
                                            isOverlay
                                        />;
                                    case ITEM_TYPE.NOTES_WIDGET:
                                        return <SortableNotes
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
                                                url={item.url}
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
