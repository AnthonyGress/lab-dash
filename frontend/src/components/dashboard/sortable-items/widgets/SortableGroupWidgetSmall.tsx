import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useAppContext } from '../../../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../../../types';
import { GroupItem } from '../../../../types/group';
import GroupWidgetSmall from '../../base-items/widgets/GroupWidgetSmall';

export interface GroupWidgetSmallConfig {
  title?: string;
  items?: GroupItem[];
  temperatureUnit?: string;
  healthUrl?: string;
  healthCheckType?: string;
  [key: string]: any;
}

interface Props {
  id: string;
  config?: GroupWidgetSmallConfig;
  editMode: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  isOverlay?: boolean;
}

export const SortableGroupWidgetSmall: React.FC<Props> = ({
    id,
    config,
    editMode,
    onDelete,
    onEdit,
    isOverlay = false
}) => {
    const { updateItem, dashboardLayout, setDashboardLayout, saveLayout } = useAppContext();
    const groupWidgetRef = useRef<HTMLDivElement | null>(null);
    const [isOver, setIsOver] = useState<boolean>(false);

    // Ensure config.items is always initialized
    const ensureItems = useCallback(() => {
        if (!config || !config.items) {
            return [];
        }
        return config.items;
    }, [config]);

    // Handle item changes (reordering within the group)
    const handleItemsChange = useCallback((newItems: GroupItem[]) => {
        if (config && updateItem) {
            console.log('Reordering items in group widget:', newItems);

            updateItem(id, {
                config: {
                    ...config,
                    items: newItems
                }
            });
        }
    }, [id, config, updateItem]);

    // Handle when an item is dragged out of the group
    const handleItemDragOut = useCallback((itemId: string) => {
        console.log('Item dragged out of group:', itemId);

        if (!dashboardLayout || !config || !config.items) return;

        // Find the item in the group
        const draggedItem = config.items.find(item => item.id === itemId);
        if (!draggedItem) {
            console.error('Could not find dragged item in group');
            return;
        }

        // Create a new app shortcut from the group item
        const newAppShortcut: DashboardItem = {
            id: itemId,
            type: ITEM_TYPE.APP_SHORTCUT,
            label: draggedItem.name,
            url: draggedItem.url,
            showLabel: true,
            icon: {
                path: draggedItem.icon || '',
                name: draggedItem.name
            },
            config: {}
        };

        // Add WoL properties if they exist
        if (draggedItem.isWol) {
            newAppShortcut.config = {
                ...newAppShortcut.config,
                isWol: draggedItem.isWol,
                macAddress: draggedItem.macAddress,
                broadcastAddress: draggedItem.broadcastAddress,
                port: draggedItem.port
            };
        }

        // Add health check properties if they exist
        if (draggedItem.healthUrl) {
            newAppShortcut.config = {
                ...newAppShortcut.config,
                healthUrl: draggedItem.healthUrl,
                healthCheckType: draggedItem.healthCheckType
            };
        }

        // Remove the item from the group
        const updatedGroupItems = config.items.filter(item => item.id !== itemId);

        // Find the group widget in the dashboard layout
        const groupIndex = dashboardLayout.findIndex(item => item.id === id);
        if (groupIndex === -1) {
            console.error('Could not find group widget in dashboard layout');
            return;
        }

        // Create updated dashboard layout
        const updatedLayout = [...dashboardLayout];

        // Update the group widget with the new items
        const updatedGroupWidget = { ...updatedLayout[groupIndex] };
        if (!updatedGroupWidget.config) {
            updatedGroupWidget.config = {};
        }

        updatedGroupWidget.config = {
            ...updatedGroupWidget.config,
            items: updatedGroupItems
        };

        updatedLayout[groupIndex] = updatedGroupWidget;

        // Add the app shortcut to the dashboard layout
        updatedLayout.push(newAppShortcut);

        // Update the dashboard layout
        setDashboardLayout(updatedLayout);

        // Save to server
        saveLayout(updatedLayout);

        console.log('Item moved from group to dashboard');
    }, [dashboardLayout, config, id, setDashboardLayout, saveLayout]);

    // Add an app shortcut to the group
    const addAppShortcutToGroup = useCallback((shortcutItem: DashboardItem) => {
        console.log('Adding app shortcut to group:', shortcutItem);

        if (!config || !dashboardLayout) {
            console.error('Missing config or dashboardLayout');
            return;
        }

        const MAX_ITEMS = 3;
        const currentItems = ensureItems();

        // Check if we already have maximum items
        if (currentItems.length >= MAX_ITEMS) {
            console.log('Maximum items reached');
            return;
        }

        // Create a new group item from the app shortcut
        const newGroupItem: GroupItem = {
            id: shortcutItem.id,
            name: shortcutItem.label,
            url: shortcutItem.url?.toString() || '#',
            icon: shortcutItem.icon?.path || ''
        };

        // Add any additional properties
        if (shortcutItem.config) {
            if (shortcutItem.config.isWol) {
                newGroupItem.isWol = shortcutItem.config.isWol;
                newGroupItem.macAddress = shortcutItem.config.macAddress;
                newGroupItem.broadcastAddress = shortcutItem.config.broadcastAddress;
                newGroupItem.port = shortcutItem.config.port;
            }

            if (shortcutItem.config.healthUrl) {
                newGroupItem.healthUrl = shortcutItem.config.healthUrl;
                newGroupItem.healthCheckType = shortcutItem.config.healthCheckType;
            }
        }

        // Create updated group items
        const updatedItems = [...currentItems, newGroupItem];

        // Clone the dashboardLayout to avoid mutation
        console.log('Current dashboard layout:', dashboardLayout);

        // Remove the app shortcut from the dashboard layout
        const updatedLayout = dashboardLayout.filter(item => item.id !== shortcutItem.id);

        console.log('Updated layout after filtering:', updatedLayout);

        // Find the group widget in the updated layout
        const groupIndex = updatedLayout.findIndex(item => item.id === id);
        if (groupIndex === -1) {
            console.error('Could not find group widget in dashboard layout');
            return;
        }

        // Update the group widget with the new items
        const updatedGroupWidget = { ...updatedLayout[groupIndex] };
        if (!updatedGroupWidget.config) {
            updatedGroupWidget.config = {};
        }

        updatedGroupWidget.config = {
            ...updatedGroupWidget.config,
            items: updatedItems
        };

        updatedLayout[groupIndex] = updatedGroupWidget;

        console.log('Final updated layout:', updatedLayout);

        // Update the dashboard layout
        setDashboardLayout(updatedLayout);

        // Save to server
        saveLayout(updatedLayout);

        console.log('App shortcut added to group and removed from dashboard');
    }, [dashboardLayout, config, id, ensureItems, setDashboardLayout, saveLayout]);

    // Handle drag over events directly
    const handleDragOver = useCallback((event: any) => {
        if (event.over && event.over.id === id) {
            setIsOver(true);
        } else {
            setIsOver(false);
        }
    }, [id]);

    // Subscribe to all the necessary DnD-kit events
    useEffect(() => {
        // Event handlers for direct communication from DashboardGrid
        const handleDndKitDragStart = (event: any) => {
            const { active } = event.detail || {};
            if (active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT) {
                console.log('DnD-kit: App shortcut drag started:', active.id);
            }
        };

        const handleDndKitDragOver = (event: any) => {
            const { over, active } = event.detail || {};

            // Check if over this group or its droppable container
            const isOverThisGroup =
                over?.id === id ||
                (typeof over?.id === 'string' &&
                 (over.id === `group-droppable-${id}` || over.id.includes(`group-droppable-item-${id}`)));

            if (isOverThisGroup && active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT) {
                console.log('DnD-kit: App shortcut over group widget:', id);
                setIsOver(true);
            } else if (isOver) {
                setIsOver(false);
            }
        };

        // Special handler for direct app shortcut to group drop
        const handleAppToGroup = (event: any) => {
            const { active, over, confirmed } = event.detail || {};
            console.log('Special app-to-group event received:', { active, over, confirmed });

            // Only process if this is a confirmed drop (not just a hover)
            if (!confirmed) {
                console.log('Not a confirmed drop, ignoring');
                setIsOver(false);
                return;
            }

            // Determine if this event is for this group
            const overId = over?.id?.toString() || '';
            const isForThisGroup =
                over?.id === id ||
                overId === `group-droppable-${id}` ||
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            if (isForThisGroup && active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT) {
                console.log('App shortcut drop targeted at this group:', id);

                // Find the app shortcut and add it to this group
                const shortcutIndex = dashboardLayout.findIndex(item => item.id === active.id);
                if (shortcutIndex !== -1) {
                    console.log('Found app shortcut, adding to group immediately');
                    addAppShortcutToGroup(dashboardLayout[shortcutIndex]);
                }
            }

            setIsOver(false);
        };

        const handleDndKitDragEnd = (event: any) => {
            const { active, over, action } = event.detail || {};

            console.log('DnD-kit dragend event:', { active, over, action });

            // If this was already handled by app-to-group, don't handle it again
            if (action === 'app-to-group') {
                console.log('Already handled by app-to-group event');
                setIsOver(false);
                return;
            }

            // Extract actual group ID from the over.id if it's in the format "group-droppable-item-ID"
            const targetGroupId = id;
            const overId = over?.id?.toString() || '';

            // Check if the app shortcut was dropped on this group
            const isOverThisGroup =
                over?.id === id ||
                overId === `group-droppable-${id}` ||
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            // Only process actual drops directly on this group, not just near it
            if (isOverThisGroup && active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT) {
                console.log('DnD-kit: App shortcut dropped on group widget', id);

                // Find the app shortcut in the dashboard layout
                const shortcutIndex = dashboardLayout.findIndex(item => item.id === active.id);
                if (shortcutIndex !== -1) {
                    console.log('Found app shortcut in dashboard layout, adding to group');
                    addAppShortcutToGroup(dashboardLayout[shortcutIndex]);
                } else {
                    console.error('Could not find app shortcut in dashboard layout:', active.id);
                }
            } else {
                console.log('Drop not targeted at this group or not an app shortcut');
            }

            // Reset the isOver state
            setIsOver(false);
        };

        const handleDndKitInactive = () => {
            setIsOver(false);
        };

        // Listen for all DnD-kit events
        document.addEventListener('dndkit:active', handleDndKitDragStart);
        document.addEventListener('dndkit:dragover', handleDndKitDragOver);
        document.addEventListener('dndkit:dragend', handleDndKitDragEnd);
        document.addEventListener('dndkit:inactive', handleDndKitInactive);
        document.addEventListener('dndkit:app-to-group', handleAppToGroup);

        return () => {
            document.removeEventListener('dndkit:active', handleDndKitDragStart);
            document.removeEventListener('dndkit:dragover', handleDndKitDragOver);
            document.removeEventListener('dndkit:dragend', handleDndKitDragEnd);
            document.removeEventListener('dndkit:inactive', handleDndKitInactive);
            document.removeEventListener('dndkit:app-to-group', handleAppToGroup);
        };
    }, [id, dashboardLayout, addAppShortcutToGroup, isOver]);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        data: {
            type: 'group-widget-small',
            accepts: ['app-shortcut'],
            canDrop: true,
            groupId: id
        }
    });

    if (isOverlay) {
        return (
            <Grid2
                size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 4 }}
                sx={{
                    opacity: 0.6,
                    height: '100%',
                    width: '100%',
                }}
            >
                <GroupWidgetSmall
                    id={id}
                    name={config?.title || 'Group'}
                    items={config?.items || []}
                    onItemsChange={handleItemsChange}
                    onRemove={onDelete}
                    onEdit={onEdit}
                    isEditing={editMode}
                    onItemDragOut={handleItemDragOut}
                />
            </Grid2>
        );
    }

    return (
        <Grid2
            size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 4 }}
            ref={(node) => {
                groupWidgetRef.current = node;
                setNodeRef(node);
            }}
            {...attributes}
            {...listeners}
            sx={{
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                opacity: isDragging ? 0.5 : 1,
                visibility: isDragging ? 'hidden' : 'visible',
                ...(isOver && {
                    outline: '2px solid rgba(25, 118, 210, 0.8)',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)'
                })
            }}
            data-type='group-widget-small'
            data-widget-id={id}
            data-accepts='app-shortcut'
            data-id={id}
        >
            <div style={{ width: '100%', height: '100%' }}>
                <GroupWidgetSmall
                    id={id}
                    name={config?.title || 'Group'}
                    items={config?.items || []}
                    onItemsChange={handleItemsChange}
                    onRemove={onDelete}
                    onEdit={onEdit}
                    isEditing={editMode}
                    onItemDragOut={handleItemDragOut}
                />
            </div>
        </Grid2>
    );
};
