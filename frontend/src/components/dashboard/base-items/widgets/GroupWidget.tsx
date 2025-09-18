import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import { Box, Grid2 as Grid, Typography } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shortid from 'shortid';

import { WidgetContainer } from './WidgetContainer';
import { DUAL_WIDGET_CONTAINER_HEIGHT, STANDARD_WIDGET_HEIGHT } from '../../../../constants/widget-dimensions';
import { GroupItem } from '../../../../types/group';
import { AppShortcut } from '../apps/AppShortcut';

interface GroupWidgetProps {
    id: string;
    name: string;
    items: GroupItem[];
    onItemsChange?: (items: GroupItem[]) => void;
    onRemove?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    isEditing?: boolean;
    onItemDragOut?: (itemId: string) => void;
    onItemEdit?: (itemId: string) => void;
    onItemDelete?: (itemId: string) => void;
    onItemDuplicate?: (item: GroupItem) => void;
    isHighlighted?: boolean;
    maxItems?: number | string;
    showLabel?: boolean;
}

interface SortableGroupItemProps {
    item: GroupItem;
    isEditing: boolean;
    groupId: string;
    onDragStart?: (id: string) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: () => void;
    itemSize?: 'small' | 'medium' | 'large';
}

// Component for each sortable item within the group
const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
    item,
    isEditing,
    groupId,
    onDragStart,
    onEdit,
    onDelete,
    onDuplicate,
    itemSize = 'medium'
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
        },
        animateLayoutChanges: ({ isSorting, wasDragging, isDragging: isCurrentlyDragging }) => {
            if (isSorting && isCurrentlyDragging) return true;
            if (wasDragging && !isCurrentlyDragging) return false;
            return true;
        },
        disabled: !isEditing // Only allow dragging in edit mode
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

    // Call the parent's duplicate handler directly
    const handleDuplicate = () => {
        if (onDuplicate) {
            onDuplicate();
        }
    };

    // Determine item height based on size prop
    const getItemHeight = () => {
        switch (itemSize) {
        case 'small':
            return { xs: '75px', sm: '85px', md: '80px' };
        case 'large':
            return { xs: '95px', sm: '105px', md: '100px' };
        case 'medium':
        default:
            return { xs: '90px', sm: '100px', md: '95px' };
        }
    };

    return (
        <Grid
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            sx={{
                height: getItemHeight(),
                width: '100%',
                cursor: isEditing ? 'grab' : 'pointer',
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                transition,
                opacity: isDragging ? 0.6 : 1,
                position: 'relative',
                touchAction: 'none', // Ensure touch events are captured properly on mobile
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
            data-item-id={item.id}
            data-group-id={groupId}
            data-type='group-item'
            onDragStart={handleDragStart}
        >
            <WidgetContainer
                editMode={isEditing}
                id={item.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
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
                    size={itemSize}
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

const GroupWidget: React.FC<GroupWidgetProps> = ({
    id,
    name,
    items = [],
    onItemsChange,
    onRemove,
    onEdit,
    onDuplicate,
    isEditing = false,
    onItemDragOut,
    onItemEdit,
    onItemDelete,
    onItemDuplicate,
    isHighlighted = false,
    maxItems = 3,
    showLabel = true
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isDraggingOut, setIsDraggingOut] = useState(false);
    const [isCurrentDropTarget, setIsCurrentDropTarget] = useState(false);

    // Add a ref to prevent duplicate execution
    const duplicationInProgress = useRef<Set<string>>(new Set());

    // Detect mobile devices
    const isMobile = useMemo(() => {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
    }, []);

    // Pointer sensor configuration for better mobile support
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            delay: isMobile ? 100 : 0, // Prevents accidental drags
            tolerance: 5, // Ensures drag starts after small movement
        }
    }));

    // Extract the actual max items value and layout from the maxItems prop
    const getLayoutConfig = () => {
        // Convert to string to handle both string and numeric maxItems
        const maxItemsStr = String(maxItems);

        // Check for the special layout formats
        if (maxItemsStr === '6_2x3') {
            return {
                maxItems: 6,
                layout: '2x3'
            };
        } else if (maxItemsStr === '6_3x2' || maxItemsStr === '6') {
            return {
                maxItems: 6,
                layout: '3x2'
            };
        } else if (maxItemsStr === '8_4x2') {
            return {
                maxItems: 8,
                layout: '4x2'
            };
        } else {
            // Default 3x1 layout (3 items in one row)
            return {
                maxItems: parseInt(maxItemsStr, 10) || 3,
                layout: '3x1'
            };
        }
    };

    const { maxItems: MAX_ITEMS, layout } = getLayoutConfig();

    const getGridSettings = () => {
        if (layout === '2x3') {
            // 2x3 grid layout (6 items in 3 rows of 2 items each)
            return {
                width: '45%',  // Wider items, 2 per row
                maxWidth: '200px', // Max width for larger screens
                rows: 3,
                cols: 2,
                height: DUAL_WIDGET_CONTAINER_HEIGHT,
                itemSize: 'small' as const,
                titleHeight: '2rem'
            };
        } else if (layout === '3x2') {
            // 3x2 grid layout (6 items in 2 rows of 3 items each)
            return {
                width: '30%',  // Narrower items, 3 per row
                maxWidth: '150px', // Max width for larger screens
                rows: 2,
                cols: 3,
                height: DUAL_WIDGET_CONTAINER_HEIGHT,
                itemSize: 'small' as const,
                titleHeight: '2rem'
            };
        } else if (layout === '4x2') {
            // 4x2 grid layout (8 items in 2 rows of 4 items each)
            return {
                width: '22%', // Even narrower items, 4 per row
                maxWidth: '180px', // Max width for larger screens
                rows: 2,
                cols: 4,
                height: DUAL_WIDGET_CONTAINER_HEIGHT,
                itemSize: 'small' as const,
                titleHeight: '2rem'
            };
        } else {
            // Default 3x1 layout (3 items in one row)
            return {
                width: '30%',
                maxWidth: '150px', // Max width for larger screens
                rows: 1,
                cols: 3,
                height: STANDARD_WIDGET_HEIGHT,  // Using standard widget height for 3x1 layout
                itemSize: 'medium' as const,
                titleHeight: '2rem'
            };
        }
    };

    const gridSettings = getGridSettings();

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
        // Check for null or undefined rects
        if (!activeRect || !containerRect) {
            return false;
        }

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

        // Add null check for activeRect
        if (!activeRect) return;

        // Check if the active item is clearly outside the group container
        const isOutside = isRectOutsideGroup(activeRect, containerRect);

        // Only update state if it changed
        if (isOutside !== isDraggingOut) {
            setIsDraggingOut(isOutside);

            // If now dragging OUT, show preview
            if (isOutside) {
                // Find the item to get its details
                const draggedItem = items.find(i => i.id === active.id.toString());

                // When dragged out, we'll generate a new ID in the handleItemDragOut function
                // to prevent conflicts, but for the preview we use the current ID
                document.dispatchEvent(new CustomEvent('dndkit:group-item-preview', {
                    detail: {
                        dragging: true,
                        itemId: active.id.toString(),
                        groupId: id,
                        position: 'next', // Place at index+1
                        item: draggedItem
                    }
                }));
            }
            // If now dragging INSIDE, hide preview
            else {
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
        const isAppShortcut = active?.data?.current?.type === 'app-shortcut' || active?.data?.current?.type === 'blank-app';
        const isDirectlyOverGroup = over && (
            over.id === id ||
            over.id === `group-droppable-${id}` ||
            over.id === `group-widget-droppable-${id}` ||
            (typeof over.id === 'string' && over.id.includes(`group-droppable-item-${id}`)) ||
            (over.data?.current?.groupId === id)
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

        // Restore normal scrolling on mobile - enhanced cleanup
        if (isMobile) {
            document.body.style.overflow = '';
            // Also force removal of any touch event listeners that might be stuck
            const noop = () => {};
            document.removeEventListener('touchmove', noop);

            // Force restore scrolling with a small delay to ensure it takes effect
            setTimeout(() => {
                if (document.body.style.overflow === 'hidden') {
                    document.body.style.overflow = '';
                }
            }, 50);
        }

        if (!over) {
            // Item was dragged outside - handle removal if needed
            if (isDraggingOut && activeId && onItemDragOut) {
                // When the item is dragged out, it will get a new ID to prevent conflicts
                // The onItemDragOut callback will handle moving the item to the dashboard
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

    // Cleanup effects for mobile
    useEffect(() => {
        // Cleanup function to ensure we don't leave lingering event listeners
        return () => {
            if (isMobile) {
                // Always restore scrolling when component unmounts or dependencies change
                document.body.style.overflow = '';

                // Remove any lingering touch event handlers more thoroughly
                const noop = () => {};
                document.removeEventListener('touchmove', noop);
                document.removeEventListener('touchstart', noop);
                document.removeEventListener('touchend', noop);
            }
        };
    }, [isMobile]);

    // Add handler for drag start
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id.toString());

        // For mobile: ensure all document touchmove events are captured
        if (isMobile) {
            // This prevents the page from scrolling during drag on mobile
            document.body.style.overflow = 'hidden';

            // Prevent default behavior for touch events
            const preventDefaultTouchMove = (e: TouchEvent) => {
                if (activeId && e.cancelable) {
                    e.preventDefault();
                }
            };

            document.addEventListener('touchmove', preventDefaultTouchMove, { passive: false });

            // More robust cleanup that works even when dragging out of group
            const cleanup = () => {
                document.body.style.overflow = '';
                document.removeEventListener('touchmove', preventDefaultTouchMove);
                document.removeEventListener('dragend', cleanup);
                document.removeEventListener('pointerup', cleanup);
                document.removeEventListener('touchend', cleanup);
            };

            // Listen for multiple end events to ensure cleanup happens
            document.addEventListener('dragend', cleanup, { once: true });
            document.addEventListener('pointerup', cleanup, { once: true });
            document.addEventListener('touchend', cleanup, { once: true });

            // Add a failsafe timeout to restore scrolling
            setTimeout(() => {
                if (document.body.style.overflow === 'hidden') {
                    console.log('GroupWidget: Failsafe scroll restore triggered');
                    cleanup();
                }
            }, 5000);
        }
    };

    // Add handler for drag over
    const handleDragOver = (event: DragOverEvent) => {
        // Check if something is being dragged over the group
        const { over, active } = event;

        // Check if we're directly over this group
        const isDirectlyOverThis = over && (
            over.id === id ||
            over.id === `group-droppable-${id}` ||
            over.id === `group-widget-droppable-${id}` ||
            (typeof over.id === 'string' && over.id.includes(`group-droppable-item-${id}`)) ||
            (over.data?.current?.groupId === id)
        );

        if (isDirectlyOverThis) {
            const isAppShortcut = active?.data?.current?.type === 'app-shortcut' || active?.data?.current?.type === 'blank-app';
            if (isAppShortcut && items.length < MAX_ITEMS) {
                setIsCurrentDropTarget(true);
            } else {
                setIsCurrentDropTarget(false);
            }
        } else {
            setIsCurrentDropTarget(false);
        }
    };

    // Limit items displayed to MAX_ITEMS
    const visibleItems = items.slice(0, MAX_ITEMS);

    // Helper function to get appropriate height based on itemSize
    const getItemHeight = () => {
        // Access the string value safely
        const itemSizeValue = String(gridSettings.itemSize);

        if (itemSizeValue === 'small') {
            return { xs: '75px', sm: '85px', md: '80px' };
        }

        // Default case (medium or any other value)
        return { xs: '90px', sm: '100px', md: '95px' };
    };

    return (
        <WidgetContainer
            editMode={isEditing}
            id={id}
            onEdit={onEdit}
            onDelete={onRemove}
            onDuplicate={undefined}
            isHighlighted={isHighlighted}
            customHeight={layout === '2x3' || layout === '3x2' || layout === '4x2' ? DUAL_WIDGET_CONTAINER_HEIGHT : STANDARD_WIDGET_HEIGHT}
        >
            <DndContext
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
                sensors={sensors}
                autoScroll={false} // Disable auto-scrolling to prevent issues
                modifiers={[]} // No modifiers needed for this simple drag case
            >
                <Box
                    ref={setDroppableRef}
                    sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        p: 1.5,
                        pt: 0.5,
                        transition: 'background-color 0.3s ease, border 0.3s ease',
                        backgroundColor: isCurrentDropTarget ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        height: layout === '2x3' || layout === '3x2' || layout === '4x2' ? DUAL_WIDGET_CONTAINER_HEIGHT.sm : STANDARD_WIDGET_HEIGHT.sm,
                        maxHeight: layout === '2x3' || layout === '3x2' || layout === '4x2' ? DUAL_WIDGET_CONTAINER_HEIGHT.sm : STANDARD_WIDGET_HEIGHT.sm
                    }}
                    data-type='group-container'
                    data-id={id}
                    data-group-id={id}
                    data-accepts='app-shortcut'
                    data-droppable='true'
                >
                    {/* Group Title - Only show if showLabel is true */}
                    {showLabel && (
                        <Typography
                            variant='subtitle1'
                            sx={{
                                px: 1,
                                pt: 0.5,
                                pb: 0.5,
                                fontWeight: 500,
                                fontSize: '1rem',
                                lineHeight: 1.2,
                                height: gridSettings.titleHeight,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {name}
                        </Typography>
                    )}

                    {/* Group Items Container */}
                    <Box
                        sx={{
                            flex: 1,
                            display: 'grid',
                            gridTemplateColumns: layout === '2x3'
                                ? { xs: 'repeat(2, minmax(110px, 180px))', sm: 'repeat(2, minmax(90px, 160px))' }
                                : layout === '4x2'
                                    ? { xs: 'repeat(4, minmax(70px, 110px))', sm: 'repeat(4, minmax(65px, 120px))', md: 'repeat(4, 1fr)', lg: 'repeat(4, 1fr)' }
                                    : { xs: 'repeat(3, minmax(95px, 160px))', sm: 'repeat(3, minmax(85px, 150px))' },
                            gridTemplateRows: layout === '2x3' ? 'repeat(3, auto)' : layout === '4x2' ? 'repeat(2, auto)' : 'repeat(1, auto)',
                            rowGap: layout === '4x2' ? { xs: 3, sm: 4 } : { xs: 4, sm: 4 },
                            columnGap: layout === '4x2' ? { xs: 1, sm: 2 } : { xs: 2, sm: 4 },
                            gridAutoFlow: 'row', // Fill row by row (left to right, top to bottom)
                            justifyItems: layout === '4x2' ? 'stretch' : 'center', // Stretch 4x2 items to fill grid cells, center others
                            alignItems: 'center', // Center items vertically within their grid cells
                            justifyContent: 'center', // Center the grid content horizontally
                            alignContent: 'center', // Center the entire grid vertically
                            overflowY: 'hidden',
                            overflowX: 'hidden',
                            p: 1,
                            m: 0
                        }}
                    >
                        <SortableContext items={visibleItems.map(item => item.id)}>
                            {visibleItems.map((item) => (
                                <Box
                                    key={item.id}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        maxWidth: layout === '4x2' ? 'none' : gridSettings.maxWidth,
                                        width: '100%',
                                        height: '100%'
                                    }}
                                >
                                    <SortableGroupItem
                                        item={item}
                                        isEditing={isEditing}
                                        groupId={id}
                                        onEdit={handleItemEdit}
                                        onDelete={handleItemDelete}
                                        onDuplicate={() => {
                                            // Prevent double execution
                                            const duplicateKey = `${id}-${item.id}`;
                                            if (duplicationInProgress.current.has(duplicateKey)) {
                                                console.log('Duplication already in progress, ignoring');
                                                return;
                                            }

                                            duplicationInProgress.current.add(duplicateKey);

                                            // Clear the flag after a short delay to allow the operation to complete
                                            setTimeout(() => {
                                                duplicationInProgress.current.delete(duplicateKey);
                                            }, 1000);

                                            // Create a duplicate with a new ID using timestamp for uniqueness
                                            const groupItemId = `group-${shortid.generate()}-${Date.now()}`;

                                            const duplicatedItem: GroupItem = {
                                                ...JSON.parse(JSON.stringify(item)), // Deep clone
                                                id: groupItemId // Extra-unique ID for group items
                                            };

                                            // Check if group is at capacity
                                            if (items.length >= MAX_ITEMS) {
                                                // Send to parent handler for adding to dashboard
                                                if (onItemDuplicate) {
                                                    onItemDuplicate(duplicatedItem);
                                                }
                                            } else {
                                                // Add within the group directly - bypass any external handlers
                                                const originalIndex = items.findIndex(groupItem => groupItem.id === item.id);
                                                const updatedItems = [...items];
                                                updatedItems.splice(originalIndex + 1, 0, duplicatedItem);

                                                // Use React's functional state update to ensure we have the latest state
                                                if (onItemsChange) {
                                                    onItemsChange(updatedItems);
                                                }
                                            }
                                        }}
                                        itemSize={gridSettings.itemSize}
                                    />
                                </Box>
                            ))}
                        </SortableContext>

                        {/* Add Button */}
                        {visibleItems.length < MAX_ITEMS && isEditing && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    maxWidth: layout === '4x2' ? 'none' : gridSettings.maxWidth,
                                    width: '100%',
                                    height: '100%'
                                }}
                            >
                                <Box
                                    sx={{
                                        height: getItemHeight(),
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
                                    title='Edit group to add items'
                                >
                                    <AddIcon fontSize='medium' />
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
            </DndContext>
        </WidgetContainer>
    );
};

export default GroupWidget;
