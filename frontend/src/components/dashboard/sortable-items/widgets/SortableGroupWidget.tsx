import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import shortid from 'shortid';

import { DUAL_WIDGET_CONTAINER_HEIGHT, STANDARD_WIDGET_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../../../types';
import { GroupItem } from '../../../../types/group';
import { AddEditForm } from '../../../forms/AddEditForm/AddEditForm';
import { CenteredModal } from '../../../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../../../modals/PopupManager';
import GroupWidget from '../../base-items/widgets/GroupWidget';

/**
 * SortableGroupWidgetSmall Component
 *
 * This component manages a group of items that can be sorted and organized.
 *
 * Important note on ID handling:
 * - When adding an item from the dashboard to a group, a new unique ID is generated to avoid conflicts
 * - When dragging an item out from a group to the dashboard, a new unique ID is also generated
 * - This prevents duplicate key issues when items are moved between contexts
 */

export interface GroupWidgetConfig {
  items?: GroupItem[];
  temperatureUnit?: string;
  healthUrl?: string;
  healthCheckType?: string;
  maxItems?: number;
  showLabel?: boolean;
  [key: string]: any;
}

interface Props {
  id: string;
  label: string;
  config?: GroupWidgetConfig;
  editMode: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  isOverlay?: boolean;
}

export const SortableGroupWidget: React.FC<Props> = ({
    id,
    label,
    config,
    editMode,
    onDelete,
    onEdit,
    onDuplicate,
    isOverlay = false
}) => {
    const { dashboardLayout, setDashboardLayout, saveLayout, refreshDashboard } = useAppContext();
    const groupWidgetRef = useRef<HTMLDivElement | null>(null);
    const [isOver, setIsOver] = useState<boolean>(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [openEditItemModal, setOpenEditItemModal] = useState(false);
    const [isCurrentDropTarget, setIsCurrentDropTarget] = useState(false);
    const [itemBeingDraggedOut, setItemBeingDraggedOut] = useState<string | null>(null);
    const [draggingOutStarted, setDraggingOutStarted] = useState(false);

    // Ensure config.items is always initialized
    const ensureItems = useCallback(() => {
        if (!config || !config.items) {
            return [];
        }
        return config.items;
    }, [config]);

    // Handle item changes (reordering within the group)
    const handleItemsChange = useCallback((newItems: GroupItem[]) => {
        // Ensure config exists with defaults for new groups
        const safeConfig = config || { maxItems: '3', showLabel: true, items: [] };

        // Update the group widget config directly using saveLayout instead of updateItem
        // to avoid triggering any unexpected state changes
        const updatedLayout = dashboardLayout.map(layoutItem => {
            if (layoutItem.id === id) {
                return {
                    ...layoutItem,
                    config: {
                        ...safeConfig,
                        items: newItems
                    }
                };
            }
            return layoutItem;
        });

        // Update local state to reflect the change
        setDashboardLayout(updatedLayout);

        // Save layout in the background
        saveLayout(updatedLayout);
    }, [id, dashboardLayout, saveLayout, setDashboardLayout, config]);

    // Get a group item as a dashboard item for editing
    const getItemAsDashboardItem = useCallback((itemId: string): DashboardItem | null => {
        if (!config?.items) return null;

        // Find the item in the group
        const foundItem = config.items.find(item => item.id === itemId);
        if (!foundItem) {
            console.error('Could not find item to edit');
            return null;
        }

        // Create a dashboard item from the group item to pass to the edit form
        const dashboardItem: DashboardItem = {
            id: foundItem.id,
            type: ITEM_TYPE.APP_SHORTCUT,
            label: foundItem.name,
            url: foundItem.url,
            showLabel: true,
            adminOnly: foundItem.adminOnly || false,
            icon: {
                path: foundItem.icon || '',
                name: foundItem.name
            },
            config: {}
        };

        // Add WoL properties if they exist
        if (foundItem.isWol) {
            dashboardItem.config = {
                ...dashboardItem.config,
                isWol: foundItem.isWol,
                macAddress: foundItem.macAddress,
                broadcastAddress: foundItem.broadcastAddress,
                port: foundItem.port
            };
        }

        // Add health check properties if they exist
        if (foundItem.healthUrl) {
            dashboardItem.config = {
                ...dashboardItem.config,
                healthUrl: foundItem.healthUrl,
                healthCheckType: foundItem.healthCheckType
            };
        }

        return dashboardItem;
    }, [config]);

    // Function to update a group item after it has been edited
    const updateGroupItem = useCallback(async (itemId: string, updatedItem: DashboardItem) => {
        // Ensure config exists with defaults for new groups
        const safeConfig = config || { maxItems: '3', showLabel: true, items: [] };
        const currentItems = safeConfig.items || [];

        // Create an updated GroupItem from the updated DashboardItem
        const updatedGroupItem: GroupItem = {
            id: itemId,
            name: updatedItem.label,
            url: updatedItem.url?.toString() || '#',
            icon: updatedItem.icon?.path || '',
            adminOnly: updatedItem.adminOnly || false
        };

        // Add WoL properties if they exist
        if (updatedItem.config?.isWol) {
            updatedGroupItem.isWol = updatedItem.config.isWol;
            updatedGroupItem.macAddress = updatedItem.config.macAddress;
            updatedGroupItem.broadcastAddress = updatedItem.config.broadcastAddress;
            updatedGroupItem.port = updatedItem.config.port;
        }

        // Add health check properties if they exist
        if (updatedItem.config?.healthUrl) {
            updatedGroupItem.healthUrl = updatedItem.config.healthUrl;
            updatedGroupItem.healthCheckType = updatedItem.config.healthCheckType;
        }

        // Replace the item in the group's items array
        const updatedItems = currentItems.map(item =>
            item.id === itemId ? updatedGroupItem : item
        );

        // Update the group widget config directly using saveLayout instead of updateItem
        // to avoid triggering any unexpected state changes
        const updatedLayout = dashboardLayout.map(layoutItem => {
            if (layoutItem.id === id) {
                return {
                    ...layoutItem,
                    config: {
                        ...safeConfig, // Use safeConfig which includes defaults
                        ...layoutItem.config, // Preserve any existing config
                        items: updatedItems
                    }
                };
            }
            return layoutItem;
        });

        // Save directly to avoid any intermediate state changes
        await saveLayout(updatedLayout);

        // Update local state to reflect the change
        setDashboardLayout(updatedLayout);
    }, [id, dashboardLayout, saveLayout, setDashboardLayout, config]);

    // Function to notify about dragging a group item
    const notifyGroupItemDrag = useCallback((isDragging: boolean, itemId?: string) => {
        // Use a direct event to DashboardGrid
        document.dispatchEvent(new CustomEvent('dndkit:group-item-drag', {
            detail: {
                dragging: isDragging,
                itemId,
                groupId: id,
            }
        }));
    }, [id]);

    // Explicitly hide backdrop on mount to ensure clean state
    useEffect(() => {
        // Ensure backdrop is hidden when component mounts
        notifyGroupItemDrag(false);
    }, [notifyGroupItemDrag]);

    // Handle when an item is dragged out of the group
    const handleItemDragOut = useCallback(async (itemId: string) => {
        if (!dashboardLayout || !config || !config.items) return;

        // Notify that we're dragging out
        notifyGroupItemDrag(true, itemId);

        // Find the item in the group
        const draggedItem = config.items.find(item => item.id === itemId);
        if (!draggedItem) {
            console.error('Could not find dragged item in group');
            return;
        }

        // Generate a new unique ID for the app shortcut to avoid conflicts
        const newItemId = shortid.generate();

        // Create a new app shortcut from the group item with a NEW ID
        const newAppShortcut: DashboardItem = {
            id: newItemId, // Use the new ID here
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

        // Create updated dashboard layout with both the updated group and the new app shortcut
        const updatedLayout = [...dashboardLayout];

        // Update the group widget with the reduced items
        const updatedGroupWidget = { ...updatedLayout[groupIndex] };
        if (!updatedGroupWidget.config) {
            updatedGroupWidget.config = {};
        }

        updatedGroupWidget.config = {
            ...updatedGroupWidget.config,
            items: updatedGroupItems
        };

        updatedLayout[groupIndex] = updatedGroupWidget;

        // Insert the app shortcut at index+1 of the group in the dashboard layout
        updatedLayout.splice(groupIndex + 1, 0, newAppShortcut);

        // Update the dashboard layout immediately for UI responsiveness
        setDashboardLayout(updatedLayout);

        try {
            // Save the updated layout to server (this includes both the updated group and new item)
            await saveLayout(updatedLayout);

            // No need to refresh dashboard - saveLayout should be sufficient
        } catch (error) {
            console.error('Error saving layout after drag out:', error);
        }

        // Reset the state
        setItemBeingDraggedOut(null);

        // We'll let the DashboardGrid's drag end handler clear the backdrop
    }, [dashboardLayout, config, id, setDashboardLayout, saveLayout, notifyGroupItemDrag]);

    // Add an app shortcut to the group
    const addAppShortcutToGroup = useCallback((shortcutItem: DashboardItem) => {
        if (!dashboardLayout) {
            console.error('Missing dashboardLayout');
            return;
        }

        // Ensure config exists with defaults for new groups
        const safeConfig = config || { maxItems: '3', showLabel: true, items: [] };

        // Use the configured maxItems or parse from the special format strings
        const maxItemsStr = String(safeConfig.maxItems || 3);
        let MAX_ITEMS = 3;

        if (maxItemsStr === '6_2x3' || maxItemsStr === '6_3x2') {
            MAX_ITEMS = 6;
        } else if (maxItemsStr === '8_4x2') {
            MAX_ITEMS = 8;
        } else {
            MAX_ITEMS = parseInt(maxItemsStr, 10) || 3;
        }

        const currentItems = ensureItems();

        // Check if we already have maximum items
        if (currentItems.length >= MAX_ITEMS) {
            return;
        }

        // Check if this is a normal app shortcut or a placeholder
        const isPlaceholder = shortcutItem.type === ITEM_TYPE.BLANK_APP;

        // Generate a new unique ID for the group item to avoid conflicts
        const newItemId = shortid.generate();

        // Create a new group item from the app shortcut with a NEW ID
        const newGroupItem: GroupItem = {
            id: newItemId, // Use the new ID here
            name: shortcutItem.label || (isPlaceholder ? 'Placeholder' : 'App'),
            url: isPlaceholder ? '#' : (shortcutItem.url?.toString() || '#'),
            icon: shortcutItem.icon?.path || '',
            adminOnly: shortcutItem.adminOnly || false
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

        // Remove the app shortcut from the dashboard layout
        const updatedLayout = dashboardLayout.filter(item => item.id !== shortcutItem.id);

        // Check if the item was actually removed to avoid processing duplicate events
        if (updatedLayout.length === dashboardLayout.length) {
            console.log('Item not found in dashboard layout, may have already been processed');
            return;
        }

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
            ...safeConfig, // Use safeConfig which includes defaults
            ...updatedGroupWidget.config, // Preserve any existing config
            items: updatedItems
        };

        updatedLayout[groupIndex] = updatedGroupWidget;

        // Update the dashboard layout
        setDashboardLayout(updatedLayout);

        // Save to server
        saveLayout(updatedLayout);
    }, [dashboardLayout, id, ensureItems, setDashboardLayout, saveLayout, config]);

    // Get maximum items allowed in the group
    const getMaxItems = useCallback(() => {
        if (!config || !config.maxItems) {
            return '3'; // Default to 3 items in 3x1 layout
        }
        return config.maxItems;
    }, [config]);

    // Helper function to interpret max items string value into a number
    const getMaxItemsAsNumber = useCallback(() => {
        const maxItemsStr = String(getMaxItems());
        if (maxItemsStr === '6_2x3' || maxItemsStr === '6_3x2' || maxItemsStr === '6') {
            return 6;
        }
        if (maxItemsStr === '8_4x2') {
            return 8;
        }
        return parseInt(maxItemsStr, 10) || 3;
    }, [getMaxItems]);

    // Handle drag over events directly
    const handleDragOver = useCallback((event: any) => {
        if (event.over && event.over.id === id) {
            // Only set isOver to true if we haven't reached max items
            const currentItems = ensureItems();
            const maxItems = getMaxItemsAsNumber();

            setIsOver(currentItems.length < maxItems);
        } else {
            setIsOver(false);
        }
    }, [id, ensureItems, getMaxItemsAsNumber]);

    // Subscribe to all the necessary DnD-kit events
    useEffect(() => {
        // Event handlers for direct communication from DashboardGrid
        const handleDndKitDragStart = (event: any) => {
            const { active } = event.detail || {};
            if (active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT) {
                // App shortcut drag started
            }

            // Check if the drag started from a group item in this group
            if (active?.data?.current?.type === 'group-item' &&
                active?.data?.current?.parentId === id) {
                setItemBeingDraggedOut(active.id);
                setDraggingOutStarted(false); // Initially not dragging out

                // Explicitly ensure backdrop is hidden on drag start
                notifyGroupItemDrag(false, active.id);
            }
        };

        const handleDndKitDragOver = (event: any) => {
            const { over, active } = event.detail || {};

            // Check if over this group or its droppable container
            const isOverThisGroup =
                over?.id === id ||
                over?.id === `group-droppable-${id}` ||
                over?.id === `group-widget-droppable-${id}` ||
                (typeof over?.id === 'string' && over?.id.includes(`group-droppable-item-${id}`)) ||
                (over?.data?.current?.groupId === id);

            if (isOverThisGroup) {
                const isAppShortcutType =
                    active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                    active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

                if (isAppShortcutType) {
                    // Only set drop target if we haven't reached max items
                    const currentItems = ensureItems();
                    const maxItems = getMaxItemsAsNumber();

                    setIsCurrentDropTarget(currentItems.length < maxItems);
                } else {
                    setIsCurrentDropTarget(false);
                }
            } else if (isCurrentDropTarget) {
                setIsCurrentDropTarget(false);
            }

            // If we're dragging a group item
            if (itemBeingDraggedOut &&
                active?.data?.current?.type === 'group-item' &&
                active?.data?.current?.parentId === id) {

                // Check if inside or outside the group
                if (!isOverThisGroup && !draggingOutStarted) {
                    // Only now dragging outside group - show backdrop
                    setDraggingOutStarted(true);
                    notifyGroupItemDrag(true, itemBeingDraggedOut);
                }
                else if (isOverThisGroup && draggingOutStarted) {
                    // Returned to group - hide backdrop
                    setDraggingOutStarted(false);
                    notifyGroupItemDrag(false, itemBeingDraggedOut);
                }
            }
        };

        // Special handler for direct app shortcut to group drop
        const handleAppToGroup = (event: any) => {
            const { active, over, confirmed } = event.detail || {};

            // Only process if this is a confirmed drop (not just a hover)
            if (!confirmed) {
                setIsOver(false);
                setIsCurrentDropTarget(false);
                return;
            }

            // Determine if this event is for this group
            const overId = over?.id?.toString() || '';
            const isForThisGroup =
                over?.id === id ||
                overId === `group-droppable-${id}` ||
                overId === `group-widget-droppable-${id}` ||
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            const isAppShortcutType =
                active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

            if (isForThisGroup && isAppShortcutType) {
                // Find the app shortcut and add it to this group
                const shortcutIndex = dashboardLayout.findIndex(item => item.id === active.id);
                if (shortcutIndex !== -1) {
                    addAppShortcutToGroup(dashboardLayout[shortcutIndex]);
                }
            }

            setIsOver(false);
            setIsCurrentDropTarget(false);
        };

        const handleDndKitDragEnd = (event: any) => {
            const { active, over, action } = event.detail || {};

            // Reset the states
            setItemBeingDraggedOut(null);
            setDraggingOutStarted(false);

            // Always explicitly hide backdrop on drag end
            notifyGroupItemDrag(false);

            // Signal that the group item drag has ended
            notifyGroupItemDrag(false);

            // If this was already handled by app-to-group, don't handle it again
            if (action === 'app-to-group') {
                setIsOver(false);
                setIsCurrentDropTarget(false);
                return;
            }

            // Extract actual group ID from the over.id if it's in the format "group-droppable-item-ID"
            const targetGroupId = id;
            const overId = over?.id?.toString() || '';

            // Check if the app shortcut was dropped on this group
            const isOverThisGroup =
                over?.id === id ||
                overId === `group-droppable-${id}` ||
                overId === `group-widget-droppable-${id}` ||
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            const isAppShortcutType =
                active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

            // Only process actual drops directly on this group, not just near it
            // But ONLY if this wasn't already handled by the app-to-group event
            if (isOverThisGroup && isAppShortcutType && !action) {
                // Find the app shortcut in the dashboard layout
                const shortcutIndex = dashboardLayout.findIndex(item => item.id === active.id);
                if (shortcutIndex !== -1) {
                    addAppShortcutToGroup(dashboardLayout[shortcutIndex]);
                } else {
                    console.error('Could not find app shortcut in dashboard layout:', active.id);
                }
            }

            // Reset the isOver state
            setIsOver(false);
            setIsCurrentDropTarget(false);
        };

        const handleDndKitInactive = () => {
            setIsOver(false);
            setIsCurrentDropTarget(false);
            setItemBeingDraggedOut(null);
            setDraggingOutStarted(false);

            // Always explicitly hide backdrop on inactive
            notifyGroupItemDrag(false);
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
    }, [id, dashboardLayout, addAppShortcutToGroup, isOver, notifyGroupItemDrag, itemBeingDraggedOut, draggingOutStarted, isCurrentDropTarget]);

    // Additional droppable for the entire widget area to expand hitbox
    const { setNodeRef: setDroppableRef, isOver: isDroppableOver } = useDroppable({
        id: `group-widget-droppable-${id}`,
        data: {
            type: 'group-widget-container',
            groupId: id,
            accepts: 'app-shortcut'
        }
    });

    // Directly listen for drag moves to detect dragging out of group
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
            type: 'group-widget',
            accepts: ['app-shortcut'],
            canDrop: true,
            groupId: id
        },
        animateLayoutChanges: ({ isSorting, wasDragging, isDragging: isCurrentlyDragging }) => {
            if (isSorting && isCurrentlyDragging) return true;
            if (wasDragging && !isCurrentlyDragging) return false;
            return true;
        },
    });

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

    // Handle editing a specific item in the group
    const handleItemEdit = useCallback((itemId: string) => {
        // First, check if the item is actually still in the group
        if (!config?.items) return;

        const foundItem = config.items.find(item => item.id === itemId);
        if (!foundItem) {
            // Item is not in the group anymore (likely moved out), don't handle the edit
            console.log('Item not found in group, ignoring edit request for:', itemId);
            return;
        }

        // Set the selected item id and open the edit modal
        setSelectedItemId(itemId);
        setOpenEditItemModal(true);
    }, [config]);

    // Handle closing the edit modal
    const handleCloseEditModal = useCallback(() => {
        setOpenEditItemModal(false);
        setSelectedItemId(null);
    }, []);

    // Handle updating the item after edit
    const handleItemUpdate = useCallback((updatedItem: DashboardItem) => {
        if (selectedItemId && config?.items) {
            // Update the group item with the new values
            updateGroupItem(selectedItemId, updatedItem);
        }
        // Close the modal
        handleCloseEditModal();
    }, [selectedItemId, config, updateGroupItem, handleCloseEditModal]);

    // Handle deleting a specific item from the group
    const handleItemDelete = useCallback((itemId: string) => {
        if (!config?.items) return;

        // Find the item in the group
        const foundItem = config.items.find(item => item.id === itemId);
        if (!foundItem) {
            console.error('Could not find item to delete');
            return;
        }

        console.log(`[SortableGroupWidget] Deleting group item with ID: ${itemId}`);
        console.log('[SortableGroupWidget] Current dashboard layout IDs:', dashboardLayout.map(item => item.id));

        const options: ConfirmationOptions = {
            title: `Delete ${foundItem.name}?`,
            confirmAction: async () => {
                // Remove the item from the group's items only
                const updatedItems = config.items?.filter(item => item.id !== itemId) || [];

                console.log('[SortableGroupWidget] Group items after deletion:', updatedItems.map(item => item.id));

                // Update the group widget config directly using saveLayout instead of updateItem
                // to avoid triggering any unexpected state changes
                const updatedLayout = dashboardLayout.map(layoutItem => {
                    if (layoutItem.id === id) {
                        return {
                            ...layoutItem,
                            config: {
                                ...layoutItem.config,
                                items: updatedItems
                            }
                        };
                    }
                    return layoutItem;
                });

                // Save directly to avoid any intermediate state changes
                await saveLayout(updatedLayout);

                // Update local state to reflect the change
                setDashboardLayout(updatedLayout);

                console.log('[SortableGroupWidget] Dashboard layout should remain unchanged');
            }
        };

        PopupManager.deleteConfirmation(options);
    }, [config, id, dashboardLayout, saveLayout, setDashboardLayout]);

    // Handle item duplication - only handles adding to dashboard when group is full
    const handleItemDuplicate = useCallback((groupItem: GroupItem) => {
        if (!config?.items) return;

        // Generate a highly unique ID to prevent any collisions
        const dashboardItemId = `dash-${shortid.generate()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Convert the group item to a dashboard item
        const newDashboardItem: DashboardItem = {
            id: dashboardItemId,
            type: ITEM_TYPE.APP_SHORTCUT,
            label: groupItem.name,
            url: groupItem.url,
            showLabel: true,
            icon: {
                path: groupItem.icon || '',
                name: groupItem.name
            },
            config: {}
        };

        // Add WoL properties if they exist
        if (groupItem.isWol) {
            newDashboardItem.config = {
                ...newDashboardItem.config,
                isWol: groupItem.isWol,
                macAddress: groupItem.macAddress,
                broadcastAddress: groupItem.broadcastAddress,
                port: groupItem.port
            };
        }

        // Add health check properties if they exist
        if (groupItem.healthUrl) {
            newDashboardItem.config = {
                ...newDashboardItem.config,
                healthUrl: groupItem.healthUrl,
                healthCheckType: groupItem.healthCheckType
            };
        }

        // Find the group widget in the dashboard layout
        const groupIndex = dashboardLayout.findIndex(layoutItem => layoutItem.id === id);
        if (groupIndex === -1) {
            console.error('Could not find group widget in dashboard layout');
            return;
        }

        // Add the new item after the group using functional update
        setDashboardLayout(prevLayout => {
            const newLayout = [...prevLayout];
            newLayout.splice(groupIndex + 1, 0, newDashboardItem);
            return newLayout;
        });

        // Save to server
        const updatedLayout = [...dashboardLayout];
        updatedLayout.splice(groupIndex + 1, 0, newDashboardItem);
        saveLayout(updatedLayout);
    }, [config, id, dashboardLayout, setDashboardLayout, saveLayout]);

    // Get selected dashboard item for editing
    const selectedDashboardItem = selectedItemId
        ? getItemAsDashboardItem(selectedItemId)
        : null;

    // Extract layout information from the maxItems configuration
    const getLayoutType = useCallback(() => {
        if (!config || !config.maxItems) return '3x1';

        const maxItemsStr = String(config.maxItems);
        if (maxItemsStr === '6_2x3') return '2x3';
        if (maxItemsStr === '6_3x2' || maxItemsStr === '6') return '3x2';
        if (maxItemsStr === '8_4x2') return '4x2';
        return '3x1';
    }, [config]);

    const layout = getLayoutType();

    // Define fixed height values directly based on layout
    const getWidgetHeight = useCallback(() => {
        if (layout === '2x3' || layout === '3x2' || layout === '4x2') {
            // 6-item and 8-item layouts use dual widget height
            return {
                xs: DUAL_WIDGET_CONTAINER_HEIGHT.xs,
                sm: DUAL_WIDGET_CONTAINER_HEIGHT.sm,
                md: DUAL_WIDGET_CONTAINER_HEIGHT.md,
                lg: DUAL_WIDGET_CONTAINER_HEIGHT.lg
            };
        } else {
            // 3-item layout uses standard widget height
            return {
                xs: STANDARD_WIDGET_HEIGHT.xs,
                sm: STANDARD_WIDGET_HEIGHT.sm,
                md: STANDARD_WIDGET_HEIGHT.md,
                lg: STANDARD_WIDGET_HEIGHT.lg
            };
        }
    }, [layout]);

    const widgetHeight = getWidgetHeight();

    if (isOverlay) {
        return (
            <Grid2
                size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 4 }}
                sx={{
                    opacity: 0.6,
                    height: widgetHeight.sm,
                    minHeight: widgetHeight.sm,
                    width: '100%',
                }}
            >
                <GroupWidget
                    id={id}
                    name={label}
                    items={config?.items || []}
                    onItemsChange={handleItemsChange}
                    onRemove={onDelete}
                    onEdit={onEdit}
                    isEditing={editMode}
                    onItemDragOut={handleItemDragOut}
                    onItemEdit={handleItemEdit}
                    onItemDelete={handleItemDelete}
                    onItemDuplicate={handleItemDuplicate}
                    maxItems={getMaxItems()}
                    showLabel={config?.showLabel !== undefined ? config.showLabel : true}
                />
            </Grid2>
        );
    }

    return (
        <>
            <Grid2
                size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 4 }}
                ref={(node) => {
                    groupWidgetRef.current = node;
                    setNodeRef(node);
                    setDroppableRef(node);
                }}
                {...attributes}
                {...listeners}
                sx={{
                    transform: transform ? CSS.Translate.toString(transform) : undefined,
                    opacity: isDragging ? 0.5 : 1,
                    visibility: isDragging ? 'hidden' : 'visible',
                    position: 'relative',
                    backgroundColor: isDroppableOver || isCurrentDropTarget ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                    transition: isDragging ? 'none' : 'background-color 0.3s ease, transform 0.2s, border 0.3s ease',
                    transitionProperty: isDragging ? 'none' : 'all',
                    transitionDuration: isDragging ? '0ms' : '250ms',
                    borderRadius: '8px',
                    height: widgetHeight.sm,
                    minHeight: widgetHeight.sm,
                    '& > div': {
                        height: '100%',
                        width: '100%',
                        visibility: 'inherit',
                        transition: isDragging ? 'none' : undefined
                    },
                    // Only apply immediate disappearance when THIS component is dragging
                    ...(isDragging && {
                        '& > div > div': {
                            opacity: 0,
                            transition: 'none'
                        }
                    })
                }}
                data-type='group-widget'
                data-widget-id={id}
                data-accepts='app-shortcut'
                data-id={id}
            >
                <div style={{ width: '100%', height: '100%' }}>
                    <GroupWidget
                        id={id}
                        name={label}
                        items={config?.items || []}
                        onItemsChange={handleItemsChange}
                        onRemove={onDelete}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        isEditing={editMode}
                        onItemDragOut={handleItemDragOut}
                        onItemEdit={handleItemEdit}
                        onItemDelete={handleItemDelete}
                        onItemDuplicate={handleItemDuplicate}
                        maxItems={getMaxItems()}
                        isHighlighted={isOver || isCurrentDropTarget}
                        showLabel={config?.showLabel !== undefined ? config.showLabel : true}
                    />
                </div>
            </Grid2>

            {/* Modal for editing group items */}
            <CenteredModal
                open={openEditItemModal}
                handleClose={handleCloseEditModal}
                title='Edit App Shortcut'
            >
                {selectedDashboardItem && (
                    <AddEditForm
                        handleClose={handleCloseEditModal}
                        existingItem={selectedDashboardItem}
                        onSubmit={handleItemUpdate}
                    />
                )}
            </CenteredModal>
        </>
    );
};
