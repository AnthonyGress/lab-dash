import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { DUAL_WIDGET_CONTAINER_HEIGHT, STANDARD_WIDGET_HEIGHT } from '../../../../constants/widget-dimensions';
import { useAppContext } from '../../../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../../../types';
import { GroupItem } from '../../../../types/group';
import { AddEditForm } from '../../../forms/AddEditForm';
import { CenteredModal } from '../../../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../../../modals/PopupManager';
import GroupWidgetSmall from '../../base-items/widgets/GroupWidgetSmall';

export interface GroupWidgetSmallConfig {
  title?: string;
  items?: GroupItem[];
  temperatureUnit?: string;
  healthUrl?: string;
  healthCheckType?: string;
  maxItems?: number;
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
    const updateGroupItem = useCallback((itemId: string, updatedItem: DashboardItem) => {
        if (!config?.items) return;

        // Create an updated GroupItem from the updated DashboardItem
        const updatedGroupItem: GroupItem = {
            id: itemId,
            name: updatedItem.label,
            url: updatedItem.url?.toString() || '#',
            icon: updatedItem.icon?.path || ''
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
        const updatedItems = config.items.map(item =>
            item.id === itemId ? updatedGroupItem : item
        );

        // Update the group widget with the updated items
        if (updateItem) {
            updateItem(id, {
                config: {
                    ...config,
                    items: updatedItems
                }
            });
        }
    }, [config, id, updateItem]);

    // Function to notify about dragging a group item
    const notifyGroupItemDrag = useCallback((isDragging: boolean, itemId?: string) => {
        console.log('Notifying about group item drag:', { isDragging, itemId, groupId: id });
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
    const handleItemDragOut = useCallback((itemId: string) => {
        console.log('Item dragged out of group:', itemId);

        if (!dashboardLayout || !config || !config.items) return;

        // Notify that we're dragging out
        notifyGroupItemDrag(true, itemId);

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

        // Insert the app shortcut at index+1 of the group in the dashboard layout
        updatedLayout.splice(groupIndex + 1, 0, newAppShortcut);

        // Update the dashboard layout
        setDashboardLayout(updatedLayout);

        // Save to server
        saveLayout(updatedLayout);

        console.log('Item moved from group to dashboard at position', groupIndex + 1);

        // Reset the state
        setItemBeingDraggedOut(null);

        // We'll let the DashboardGrid's drag end handler clear the backdrop
    }, [dashboardLayout, config, id, setDashboardLayout, saveLayout, notifyGroupItemDrag]);

    // Add an app shortcut to the group
    const addAppShortcutToGroup = useCallback((shortcutItem: DashboardItem) => {
        console.log('Adding app shortcut to group:', shortcutItem);

        if (!config || !dashboardLayout) {
            console.error('Missing config or dashboardLayout');
            return;
        }

        // Use the configured maxItems instead of hardcoding
        const MAX_ITEMS = config.maxItems || 3;
        console.log('Using max items:', MAX_ITEMS, 'from config:', config);

        const currentItems = ensureItems();

        // Check if we already have maximum items
        if (currentItems.length >= MAX_ITEMS) {
            console.log('Maximum items reached:', currentItems.length, '>=', MAX_ITEMS);
            return;
        }

        // Check if this is a normal app shortcut or a placeholder
        const isPlaceholder = shortcutItem.type === ITEM_TYPE.BLANK_APP;

        // Create a new group item from the app shortcut
        const newGroupItem: GroupItem = {
            id: shortcutItem.id,
            name: shortcutItem.label || (isPlaceholder ? 'Placeholder' : 'App'),
            url: isPlaceholder ? '#' : (shortcutItem.url?.toString() || '#'),
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

            // Check if the drag started from a group item in this group
            if (active?.data?.current?.type === 'group-item' &&
                active?.data?.current?.parentId === id) {
                console.log('Group item dragged from group:', id);
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
                (typeof over?.id === 'string' && over?.id.includes(`group-droppable-item-${id}`)) ||
                (over?.data?.current?.groupId === id);

            if (isOverThisGroup) {
                const isAppShortcutType =
                    active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                    active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

                if (isAppShortcutType) {
                    console.log('App shortcut directly over group widget:', id);
                    setIsCurrentDropTarget(true);
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
                    console.log('Group item NOW outside group, showing backdrop');
                    setDraggingOutStarted(true);
                    notifyGroupItemDrag(true, itemBeingDraggedOut);
                }
                else if (isOverThisGroup && draggingOutStarted) {
                    // Returned to group - hide backdrop
                    console.log('Group item returned to group, hiding backdrop');
                    setDraggingOutStarted(false);
                    notifyGroupItemDrag(false, itemBeingDraggedOut);
                }
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
                setIsCurrentDropTarget(false);
                return;
            }

            // Determine if this event is for this group
            const overId = over?.id?.toString() || '';
            const isForThisGroup =
                over?.id === id ||
                overId === `group-droppable-${id}` ||
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            const isAppShortcutType =
                active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

            if (isForThisGroup && isAppShortcutType) {
                console.log('App shortcut drop targeted at this group:', id);

                // Find the app shortcut and add it to this group
                const shortcutIndex = dashboardLayout.findIndex(item => item.id === active.id);
                if (shortcutIndex !== -1) {
                    console.log('Found app shortcut, adding to group immediately');
                    addAppShortcutToGroup(dashboardLayout[shortcutIndex]);
                }
            }

            setIsOver(false);
            setIsCurrentDropTarget(false);
        };

        const handleDndKitDragEnd = (event: any) => {
            const { active, over, action } = event.detail || {};

            console.log('DnD-kit dragend event:', { active, over, action });

            // Reset the states
            setItemBeingDraggedOut(null);
            setDraggingOutStarted(false);

            // Always explicitly hide backdrop on drag end
            notifyGroupItemDrag(false);

            // Signal that the group item drag has ended
            notifyGroupItemDrag(false);

            // If this was already handled by app-to-group, don't handle it again
            if (action === 'app-to-group') {
                console.log('Already handled by app-to-group event');
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
                overId.includes(`group-droppable-item-${id}`) ||
                (over?.data?.current?.groupId === id);

            const isAppShortcutType =
                active?.data?.current?.type === ITEM_TYPE.APP_SHORTCUT ||
                active?.data?.current?.type === ITEM_TYPE.BLANK_APP;

            // Only process actual drops directly on this group, not just near it
            if (isOverThisGroup && isAppShortcutType) {
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
            type: 'group-widget-small',
            accepts: ['app-shortcut'],
            canDrop: true,
            groupId: id
        }
    });

    // Handle editing a specific item in the group
    const handleItemEdit = useCallback((itemId: string) => {
        console.log('Edit item in group:', itemId);

        // Set the selected item id and open the edit modal
        setSelectedItemId(itemId);
        setOpenEditItemModal(true);
    }, []);

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
        console.log('Delete item from group:', itemId);

        if (!config?.items) return;

        // Find the item in the group
        const foundItem = config.items.find(item => item.id === itemId);
        if (!foundItem) {
            console.error('Could not find item to delete');
            return;
        }

        const options: ConfirmationOptions = {
            title: `Delete ${foundItem.name}?`,
            confirmAction: () => {
                // Remove the item from the group's items
                const updatedItems = config.items?.filter(item => item.id !== itemId) || [];

                // Update the group widget config
                if (updateItem) {
                    updateItem(id, {
                        config: {
                            ...config,
                            items: updatedItems
                        }
                    });

                    console.log('Item removed from group:', itemId);
                }
            }
        };

        PopupManager.deleteConfirmation(options);
    }, [config, id, updateItem]);

    // Get selected dashboard item for editing
    const selectedDashboardItem = selectedItemId
        ? getItemAsDashboardItem(selectedItemId)
        : null;

    // Extract maxItems from config, defaulting to 3
    const getMaxItems = useCallback(() => {
        if (!config || !config.maxItems) {
            return '3'; // Default to 3 items in 3x1 layout
        }
        return config.maxItems;
    }, [config]);

    // Extract layout information from the maxItems configuration
    const getLayoutType = useCallback(() => {
        if (!config || !config.maxItems) return '3x1';

        const maxItemsStr = String(config.maxItems);
        if (maxItemsStr === '6_2x3') return '2x3';
        if (maxItemsStr === '6_3x2' || maxItemsStr === '6') return '3x2';
        return '3x1';
    }, [config]);

    const layout = getLayoutType();

    // Define fixed height values directly based on layout
    const getWidgetHeight = useCallback(() => {
        if (layout === '2x3' || layout === '3x2') {
            // 6-item layouts use dual widget height
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
                <GroupWidgetSmall
                    id={id}
                    name={config?.title || 'Group'}
                    items={config?.items || []}
                    onItemsChange={handleItemsChange}
                    onRemove={onDelete}
                    onEdit={onEdit}
                    isEditing={editMode}
                    onItemDragOut={handleItemDragOut}
                    onItemEdit={handleItemEdit}
                    onItemDelete={handleItemDelete}
                    maxItems={getMaxItems()}
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
                }}
                {...attributes}
                {...listeners}
                sx={{
                    transform: transform ? CSS.Translate.toString(transform) : undefined,
                    opacity: isDragging ? 0.5 : 1,
                    visibility: isDragging ? 'hidden' : 'visible',
                    position: 'relative',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.3s ease, transform 0.2s',
                    borderRadius: '8px',
                    height: widgetHeight.sm,
                    minHeight: widgetHeight.sm,
                    '& > div': {
                        height: '100%',
                        width: '100%',
                        visibility: 'inherit'
                    },
                    '& * ': {
                        visibility: 'inherit'
                    }
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
                        onItemEdit={handleItemEdit}
                        onItemDelete={handleItemDelete}
                        maxItems={config?.maxItems || 3}
                        isHighlighted={isOver || isCurrentDropTarget}
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
