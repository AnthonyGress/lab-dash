import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import { Box, Grid2 as Grid, IconButton, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { EditMenu } from './EditMenu';
import { StatusIndicator } from './StatusIndicator';
import { WidgetContainer } from './WidgetContainer';
import { DashboardItem, ITEM_TYPE } from '../../../../types';
import { GroupItem } from '../../../../types/group';
import { getIconPath } from '../../../../utils/utils';
import { ConfirmationOptions, PopupManager } from '../../../modals/PopupManager';
import { AppShortcut } from '../apps/AppShortcut';

interface GroupWidgetSmallProps {
    id: string;
    name: string;
    items: GroupItem[];
    onItemsChange?: (items: GroupItem[]) => void;
    onRemove?: () => void;
    onEdit?: () => void;
    isEditing?: boolean;
    onItemDragOut?: (itemId: string) => void;
    onItemEdit?: (itemId: string) => void;
    onItemDelete?: (itemId: string) => void;
    isHighlighted?: boolean;
}

interface SortableGroupItemProps {
    item: GroupItem;
    isEditing: boolean;
    groupId: string;
    onDragStart?: (id: string) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
}

// Component for each sortable item within the group
const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
    item,
    isEditing,
    groupId,
    onDragStart,
    onEdit,
    onDelete
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: item.id,
        data: {
            type: 'group-item',
            originalItem: item,
            parentId: groupId
        }
    });

    const handleDragStart = () => {
        if (onDragStart) {
            onDragStart(item.id);
        }
    };

    // Call the parent's edit handler directly
    const handleEdit = () => {
        if (onEdit) {
            onEdit(item.id);
        }
    };

    // Call the parent's delete handler directly
    const handleDelete = () => {
        if (onDelete) {
            onDelete(item.id);
        }
    };

    return (
        <Grid
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            sx={{
                height: { xs: '90px', sm: '100px', md: '95px' },
                width: '100%',
                cursor: isEditing ? 'grab' : 'pointer',
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                transition,
                opacity: isDragging ? 0.5 : 1,
                position: 'relative',
                m: 0.5, // Add margin for spacing
            }}
            data-item-id={item.id}
            data-group-id={groupId}
            data-type='group-item'
            onDragStart={handleDragStart}
        >
            <WidgetContainer
                editMode={isEditing}
                onEdit={handleEdit}
                onDelete={handleDelete}
                appShortcut={true}
                url={item.healthUrl || item.url}
                healthCheckType={item.healthCheckType === 'ping' ? 'ping' : 'http'}
                groupItem
            >
                <AppShortcut
                    url={item.url}
                    name={item.name}
                    iconName={item.icon || ''}
                    showLabel={true}
                    editMode={isEditing}
                    config={{
                        isWol: item.isWol,
                        macAddress: item.macAddress,
                        broadcastAddress: item.broadcastAddress,
                        port: item.port,
                        healthUrl: item.healthUrl,
                        healthCheckType: item.healthCheckType
                    }}
                />
            </WidgetContainer>
        </Grid>
    );
};

const GroupWidgetSmall: React.FC<GroupWidgetSmallProps> = ({
    id,
    name,
    items = [],
    onItemsChange,
    onRemove,
    onEdit,
    isEditing = false,
    onItemDragOut,
    onItemEdit,
    onItemDelete,
    isHighlighted = false
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isDraggingOut, setIsDraggingOut] = useState(false);
    const [isCurrentDropTarget, setIsCurrentDropTarget] = useState(false);
    const MAX_ITEMS = 3;

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `group-droppable-${id}`,
        data: {
            type: 'group-container',
            groupId: id,
            accepts: 'app-shortcut'
        }
    });

    // Modified function to check if an item is clearly outside the group area (with margins)
    const isRectOutsideGroup = (activeRect: any, containerRect: any) => {
        // Add some margin to consider the item "inside" the group if it's near the border
        const margin = 30; // pixels

        return (
            activeRect.left > containerRect.right + margin ||
            activeRect.right < containerRect.left - margin ||
            activeRect.top > containerRect.bottom + margin ||
            activeRect.bottom < containerRect.top - margin
        );
    };

    // Check if an item is outside the group area with improved positioning logic
    const handleDragMove = useCallback((event: any) => {
        // Get coordinates
        const { active, over, activatorEvent } = event;

        // Only proceed if we're dragging a group item
        if (active?.data?.current?.type !== 'group-item') return;

        // Get the group container element
        const groupContainer = document.querySelector(`[data-group-id="${id}"][data-type="group-container"]`);
        if (!groupContainer) return;

        // Get the positions
        const containerRect = groupContainer.getBoundingClientRect();
        const activeRect = active.rect.current.translated;

        // Check if the active item is clearly outside the group container
        const isOutside = isRectOutsideGroup(activeRect, containerRect);

        // Only update state if it changed
        if (isOutside !== isDraggingOut) {
            setIsDraggingOut(isOutside);

            // If now dragging OUT, show preview
            if (isOutside) {
                console.log('Group item clearly outside group, showing preview');

                // Dispatch event with position information for correct placement
                document.dispatchEvent(new CustomEvent('dndkit:group-item-preview', {
                    detail: {
                        dragging: true,
                        itemId: active.id.toString(),
                        groupId: id,
                        position: 'next', // Place at index+1
                        // Find the item to get its details
                        item: items.find(i => i.id === active.id.toString())
                    }
                }));
            }
            // If now dragging INSIDE, hide preview
            else {
                console.log('Group item inside group bounds, hiding preview');

                // Hide the preview
                document.dispatchEvent(new CustomEvent('dndkit:group-item-preview', {
                    detail: {
                        dragging: false,
                        itemId: active.id.toString(),
                        groupId: id
                    }
                }));
            }
        }

        // Check if an app shortcut is being dragged over the group
        const isAppShortcut = active?.data?.current?.type === 'app-shortcut';
        const isDirectlyOverGroup = over && (
            over.id === id ||
            over.id === `group-droppable-${id}` ||
            (typeof over.id === 'string' && over.id.includes(`group-droppable-item-${id}`))
        );

        if (isDirectlyOverGroup && isAppShortcut && items.length < MAX_ITEMS) {
            setIsCurrentDropTarget(true);
        } else if (isCurrentDropTarget) {
            setIsCurrentDropTarget(false);
        }
    }, [id, items, MAX_ITEMS, isCurrentDropTarget, isDraggingOut]);

    // Ensure preview is hidden when drag ends
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Always hide preview
        document.dispatchEvent(new CustomEvent('dndkit:group-item-preview', {
            detail: {
                dragging: false,
                itemId: activeId || '',
                groupId: id
            }
        }));

        if (!over) {
            // Item was dragged outside - handle removal if needed
            if (isDraggingOut && activeId && onItemDragOut) {
                onItemDragOut(activeId);
            }
            setActiveId(null);
            setIsDraggingOut(false);
            setIsCurrentDropTarget(false);
            return;
        }

        // If dropped on another position within the group, reorder
        if (active.id !== over.id && onItemsChange) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newItems = arrayMove(items, oldIndex, newIndex);
                onItemsChange(newItems);
            }
        }

        setActiveId(null);
        setIsDraggingOut(false);
        setIsCurrentDropTarget(false);
    };

    // Handle item edit - Convert group item to dashboard item for edit form
    const handleItemEdit = useCallback((itemId: string) => {
        // Find the item in the group
        const foundItem = items.find(item => item.id === itemId);
        if (!foundItem) {
            console.error('Could not find item to edit');
            return;
        }

        // Create a dashboard item from the group item for the edit form
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
            config: {
                // Add WoL properties if they exist
                ...(foundItem.isWol && {
                    isWol: foundItem.isWol,
                    macAddress: foundItem.macAddress,
                    broadcastAddress: foundItem.broadcastAddress,
                    port: foundItem.port
                }),
                // Add health check properties if they exist
                ...(foundItem.healthUrl && {
                    healthUrl: foundItem.healthUrl,
                    healthCheckType: foundItem.healthCheckType
                })
            }
        };

        // Pass to parent for editing
        if (onItemEdit) {
            onItemEdit(itemId);
        } else {
            // If no external handler, use the group's edit function
            onEdit?.();
        }
    }, [items, onItemEdit, onEdit]);

    // Handle item delete with confirmation
    const handleItemDelete = useCallback((itemId: string) => {
        // Find the item in the group
        const foundItem = items.find(item => item.id === itemId);
        if (!foundItem) {
            console.error('Could not find item to delete');
            return;
        }

        // Directly call the external delete handler if available
        if (onItemDelete) {
            onItemDelete(itemId);
        } else {
            // If no external handler, just update the items list
            const updatedItems = items.filter(item => item.id !== itemId);
            if (onItemsChange) {
                onItemsChange(updatedItems);
            }
        }
    }, [items, onItemsChange, onItemDelete]);

    // Handle click on add button - opens the group edit modal
    const handleAddClick = useCallback(() => {
        if (isEditing && items.length < MAX_ITEMS) {
            console.log('Add button clicked');
            // Open the group edit modal
            onEdit?.();
        }
    }, [isEditing, items.length, onEdit]);

    // Add handler for drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id.toString());
        console.log('Group item drag started in GroupWidgetSmall:', active.id);
    };

    // Add handler for drag over
    const handleDragOver = (event: DragOverEvent) => {
        // Check if something is being dragged over the group
        const { over, active } = event;

        // Check if we're directly over this group
        const isDirectlyOverThis = over && (
            over.id === id ||
            over.id === `group-droppable-${id}` ||
            (typeof over.id === 'string' && over.id.includes(`group-droppable-item-${id}`))
        );

        if (isDirectlyOverThis) {
            const isAppShortcut = active?.data?.current?.type === 'app-shortcut';
            if (isAppShortcut) {
                setIsCurrentDropTarget(true);
            } else {
                setIsCurrentDropTarget(false);
            }
        } else {
            setIsCurrentDropTarget(false);
        }
    };

    return (
        <WidgetContainer
            editMode={isEditing}
            onEdit={onEdit}
            onDelete={onRemove}
            isHighlighted={isHighlighted}
        >
            <DndContext
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
            >
                <Box
                    ref={setDroppableRef}
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        p: 1.5,
                        pt: 0.5,
                        transition: 'background-color 0.3s ease',
                        backgroundColor: 'transparent',
                        overflow: 'hidden'
                    }}
                    data-type='group-container'
                    data-id={id}
                    data-group-id={id}
                    data-accepts='app-shortcut'
                    data-droppable='true'
                >
                    {/* Group Title */}
                    <Typography
                        variant='subtitle1'
                        sx={{
                            px: 1,
                            pt: 0.5,
                            pb: 1,
                            fontWeight: 500,
                            fontSize: '1rem',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {name}
                    </Typography>

                    {/* Group Items Container */}
                    <Grid sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 1,
                        overflowY: 'hidden',
                        overflowX: 'hidden',
                        pb: 0.5,
                        size: { xs: 4 }
                    }}>
                        <SortableContext items={items.map(item => item.id)}>
                            {items.map((item) => (
                                <Box
                                    width='30%'
                                    key={item.id}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <SortableGroupItem
                                        item={item}
                                        isEditing={isEditing}
                                        groupId={id}
                                        onEdit={handleItemEdit}
                                        onDelete={handleItemDelete}
                                    />
                                </Box>
                            ))}
                        </SortableContext>

                        {/* Add Button */}
                        {items.length < MAX_ITEMS && isEditing && (
                            <Box
                                width='30%'
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    m: 0.5
                                }}
                            >
                                <Box
                                    sx={{
                                        height: { xs: '70px', sm: '80px', md: '85px' },
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px dashed rgba(255, 255, 255, 0.3)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            borderColor: 'rgba(255, 255, 255, 0.5)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)'
                                        }
                                    }}
                                    onClick={handleAddClick}
                                    title='Edit group to add items'
                                >
                                    <AddIcon fontSize='medium' />
                                </Box>
                            </Box>
                        )}
                    </Grid>
                </Box>
            </DndContext>
        </WidgetContainer>
    );
};

export default GroupWidgetSmall;
