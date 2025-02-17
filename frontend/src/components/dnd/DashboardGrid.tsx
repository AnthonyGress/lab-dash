import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
} from '@dnd-kit/sortable';
import { Box, Grid2 as Grid } from '@mui/material';
import React, { useState } from 'react';

import { BlankAppShortcut } from './BlankAppShortcut';
import { BlankWidget } from './BlankWidget';
import { SortableAppShortcut } from './SortableAppShortcut';
import { SortableDateTimeWidget } from './SortableDateTime';
import { SortableSystemMonitorWidget } from './SortableSystemMonitor';
import { SortableWeatherWidget } from './SortableWeather';
import { useAppContext } from '../../context/useAppContext';
import { DashboardItem, ITEM_TYPE } from '../../types';
import { AddEditForm } from '../forms/AddEditForm';
import { CenteredModal } from '../modals/CenteredModal';
import { ConfirmationOptions, PopupManager } from '../modals/PopupManager';

type Props = {
    editMode: boolean;
    items: DashboardItem[],
}

export const DashboardGrid: React.FC<Props> = ({ editMode, items }) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
    const [openEditModal, setOpenEditModal] = useState(false);
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
        }
        setActiveId(null);
    };

    const handleDelete = (id: string) => {
        const options: ConfirmationOptions = {
            title: 'Delete Item?',
            confirmAction: () => setDashboardLayout((prev: any[]) => prev.filter((item) => item.id !== id))
        };

        PopupManager.deleteConfirmation(options);
    };

    const handleEdit = (item: DashboardItem) => {
        setSelectedItem(item);
        setOpenEditModal(true);
    };

    return (
        <>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={items} strategy={rectSortingStrategy} disabled={!editMode}>
                    <Box sx={{ width: '100%', overflow: 'hidden' }}>
                        <Grid container spacing={2} sx={{ width: '100%', margin: 0, flexWrap: 'wrap', p:2 }}>
                            {items.map((item) => {
                                switch (item.type) {
                                case ITEM_TYPE.WEATHER_WIDGET:
                                    return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.DATE_TIME_WIDGET:
                                    return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
                                case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                    return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} onEdit={() => handleEdit(item)}/>;
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
                                        />
                                    );
                                case ITEM_TYPE.BLANK_APP:
                                    return <BlankAppShortcut key={item.id} id={item.id} editMode={editMode} onDelete={() => handleDelete(item.id)} />;
                                default:
                                    return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} onDelete={() => handleDelete(item.id)} />;
                                }
                            })}
                        </Grid>
                    </Box>
                </SortableContext>

                <DragOverlay>
                    {activeId ? (
                        items.map((item) => {
                            if (item.id === activeId) {
                                switch (item.type) {
                                case ITEM_TYPE.WEATHER_WIDGET:
                                    return <SortableWeatherWidget key={item.id} id={item.id} editMode={editMode} isOverlay/>;
                                case ITEM_TYPE.DATE_TIME_WIDGET:
                                    return <SortableDateTimeWidget key={item.id} id={item.id} editMode={editMode} isOverlay/>;
                                case ITEM_TYPE.SYSTEM_MONITOR_WIDGET:
                                    return <SortableSystemMonitorWidget key={item.id} id={item.id} editMode={editMode} isOverlay/>;
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
                                        />
                                    );
                                case ITEM_TYPE.BLANK_APP:
                                    return <BlankAppShortcut key={item.id} id={item.id} editMode={editMode} isOverlay/>;
                                default:
                                    return <BlankWidget key={item.id} id={item.id} label={item.label} editMode={editMode} isOverlay/>;
                                }
                            }
                            return null;
                        })
                    ) : null}
                </DragOverlay>
            </DndContext>
            <CenteredModal open={openEditModal} handleClose={() => setOpenEditModal(false)} title='Edit Item'>
                <AddEditForm handleClose={() => setOpenEditModal(false)} existingItem={selectedItem}/>
            </CenteredModal>
        </>
    );
};
