import {
    closestCenter,
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    rectSwappingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import { Box, Button, Grid } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { SortableItem } from './SortableItem';

// The key for localStorage
const LOCAL_STORAGE_KEY = 'dashboardLayout';

const initialItems = Array.from({ length: 9 }, (_, index) => ({
    id: `item-${index + 1}`,
    label: `Item ${index + 1}`,
}));

type Props = {
    editMode: boolean;
    config: any;
}

export const DashboardGrid: React.FC<Props> = ({ editMode, config }) => {
    const [items, setItems] = useState(initialItems);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(useSensor(PointerSensor));

    // Load saved layout from localStorage
    useEffect(() => {
        const savedLayout = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedLayout) {
            setItems(JSON.parse(savedLayout).items);
        }
    }, []);

    // Save layout to localStorage
    const saveLayout = () => {
        const jsonData = JSON.stringify({ items });
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonData);
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setItems((prev) => {
                const oldIndex = prev.findIndex((item) => item.id === active.id);
                const newIndex = prev.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(prev, oldIndex, newIndex);
                return newItems;
            });
            // saveLayout();
        }
        setActiveId(null);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <Box sx={{ width: '90%', height: '100%', margin: 'auto', padding: 2 }}>
                <SortableContext items={items} strategy={rectSortingStrategy} disabled={!editMode}>
                    <Grid container spacing={2}>
                        {items.map((item) => (
                            <SortableItem key={item.id} id={item.id} label={item.label} editMode={editMode} />
                        ))}
                    </Grid>
                </SortableContext>

                <DragOverlay>
                    {activeId ? (
                        <SortableItem id={activeId} label={items.find(i => i.id === activeId)?.label || ''} isOverlay editMode={editMode}/>
                    ) : null}
                </DragOverlay>

                <Button variant='contained' onClick={saveLayout} sx={{ mt: 2 }}>
          Save Layout
                </Button>
            </Box>
        </DndContext>
    );
};
