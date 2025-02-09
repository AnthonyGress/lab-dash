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
import { Box, Button, Grid2 as Grid } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { SortableTimeDateWidget } from './SortableDateTime';
import { SortableItem } from './SortableItem';
import { SortableSystemMonitorWidget } from './SortableSystemMonitor';
import { SortableWeatherWidget } from './SortableWeather';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../types';

type Props = {
    editMode: boolean;
    config: any;
    items: DashboardItem[],
    // setItems: (arg: any) => any
}

export const DashboardGrid: React.FC<Props> = ({ editMode, config, items }) => {
    // const [items, setItems] = useState(initialItems);
    const [activeId, setActiveId] = useState<string | null>(null);
    const { setDashboardLayout } = useAppContext();
    const sensors = useSensors(useSensor(PointerSensor));

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setDashboardLayout((prev: any[]) => {
                const oldIndex = prev.findIndex((item: { id: any; }) => item.id === active.id);
                const newIndex = prev.findIndex((item: { id: any; }) => item.id === over.id);
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
                    <Grid container spacing={2} >
                        {items.map((item) => {
                            switch (item.type) {
                            case ITEM_TYPE.WEATHER_WIDGET:
                                return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} />;
                            case ITEM_TYPE.DATE_TIME_WIDGET:
                                return <SortableTimeDateWidget key={item.id} id={item.id} editMode={editMode} />;
                            case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} />;
                            default:
                                return <SortableItem key={item.id} id={item.id} label={item.label} editMode={editMode} />;
                            }
                        })}
                    </Grid>
                </SortableContext>

                <DragOverlay>
                    {activeId ? (
                        <SortableItem id={activeId} label={items.find(i => i.id === activeId)?.label || ''} isOverlay editMode={editMode}/>
                    ) : null}
                </DragOverlay>
            </Box>
        </DndContext>
    );
};
