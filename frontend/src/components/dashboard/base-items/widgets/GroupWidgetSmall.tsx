import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { WidgetContainer } from './WidgetContainer';
import { GroupItem } from '../../../../types/group';
import { getIconPath } from '../../../../utils/utils';
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
}

interface SortableGroupItemProps {
    item: GroupItem;
    isEditing: boolean;
    groupId: string;
    onDragStart?: (id: string) => void;
}

// Component for each sortable item within the group
const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
    item,
    isEditing,
    groupId,
    onDragStart
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

    // Check if the item has health URL - if so, we need space for the status icon
    const hasHealthUrl = !!item.healthUrl || !!item.healthCheckType;

    return (
        <Box
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            sx={{
                height: { xs: '70px', sm: '80px', md: '85px' },
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                m: 0.5,
                cursor: isEditing ? 'grab' : 'pointer',
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                transition,
                opacity: isDragging ? 0.5 : 1,
                overflow: 'hidden',
                position: 'relative',
                '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 0 5px rgba(255, 255, 255, 0.1)'
                }
            }}
            data-item-id={item.id}
            data-group-id={groupId}
            data-type='group-item'
            onDragStart={handleDragStart}
        >
            <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
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
            </Box>
        </Box>
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
    onItemDragOut
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

    // Handle click on add button - in a real app this would open a modal or picker
    const handleAddClick = useCallback(() => {
        if (isEditing && items.length < MAX_ITEMS) {
            console.log('Add button clicked');
            // In a real implementation, this would open a modal to add a new item
            onEdit?.();
        }
    }, [isEditing, items.length, onEdit]);

    // Listen for external dragover events for highlighting
    useEffect(() => {
        const handleDragOver = (e: any) => {
            const detail = e.detail || {};
            const { over, active } = detail;

            // Calculate if we're directly over this group
            const isDirectlyOverThis = over && (
                over.id === id ||
                over.id === `group-droppable-${id}` ||
                (typeof over.id === 'string' && over.id.includes(`group-droppable-item-${id}`))
            );

            if (isDirectlyOverThis) {
                const isAppShortcut = active?.data?.current?.type === 'app-shortcut';
                if (isAppShortcut) {
                    console.log('App shortcut directly over group:', id);
                    setIsCurrentDropTarget(true);
                } else {
                    setIsCurrentDropTarget(false);
                }
            } else {
                if (isCurrentDropTarget) {
                    setIsCurrentDropTarget(false);
                }
            }
        };

        const handleDragEnd = () => {
            setIsCurrentDropTarget(false);
        };

        document.addEventListener('dndkit:dragover', handleDragOver);
        document.addEventListener('dndkit:dragend', handleDragEnd);
        document.addEventListener('dndkit:inactive', handleDragEnd);

        return () => {
            document.removeEventListener('dndkit:dragover', handleDragOver);
            document.removeEventListener('dndkit:dragend', handleDragEnd);
            document.removeEventListener('dndkit:inactive', handleDragEnd);
        };
    }, [id, isCurrentDropTarget]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id.toString());
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Internal drag handling for group items
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            // Item was dragged outside - handle removal if needed
            if (isDraggingOut && activeId && onItemDragOut) {
                onItemDragOut(activeId);
            }
            setActiveId(null);
            setIsDraggingOut(false);
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
    };

    // Check if an item is outside the group area
    const handleDragMove = useCallback((event: any) => {
        // Get coordinates
        const { active, over } = event;

        // Check if we're dragging outside the group container
        const isOverGroupContainer = over?.data?.current?.type === 'group-container' ||
                                    over?.data?.current?.type === 'group-item';

        setIsDraggingOut(!isOverGroupContainer);
    }, []);

    return (
        <WidgetContainer
            editMode={isEditing}
            onEdit={onEdit}
            onDelete={onRemove}
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
                        transition: 'background-color 0.2s',
                        ...(isCurrentDropTarget && {
                            backgroundColor: 'rgba(25, 118, 210, 0.2)', // Highlight when can drop
                            // outline: '2px dashed rgba(25, 118, 210, 0.8)',
                        }),
                        ...(isOver && {
                            backgroundColor: 'rgba(25, 118, 210, 0.3)',
                            outline: '2px solid rgba(25, 118, 210, 0.8)',
                        })
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
                            lineHeight: 1.2
                        }}
                    >
                        {name}
                    </Typography>

                    {/* Group Items Container */}
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 1,
                        overflowY: 'auto',
                        pb: 0.5
                    }}>
                        <SortableContext items={items.map(item => item.id)}>
                            {items.map((item) => (
                                <Box width='30%'>
                                    <SortableGroupItem
                                        key={item.id}
                                        item={item}
                                        isEditing={isEditing}
                                        groupId={id}
                                    />
                                </Box>
                            ))}
                        </SortableContext>

                        {/* Add Button */}
                        {items.length < MAX_ITEMS && isEditing && (
                            <Box
                                sx={{
                                    height: { xs: '70px', sm: '80px', md: '85px' },
                                    width: { xs: '70px', sm: '80px', md: '85px' },
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px dashed rgba(255, 255, 255, 0.3)',
                                    borderRadius: '8px',
                                    m: 0.5,
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
                        )}
                    </Box>
                </Box>
            </DndContext>
        </WidgetContainer>
    );
};

export default GroupWidgetSmall;
