import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 } from '@mui/material';
import React from 'react';

import { PlaceholderWidget } from './PlaceholderWidget';
import { SystemMonitorWidget } from '../widgets/SystemMonitorWidget/SystemMonitorWidget';
import { WidgetContainer } from '../widgets/WidgetContainer';


type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void
};

export const SortableSystemMonitorWidget: React.FC<Props> = ({ id, editMode, isOverlay = false, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 12, md: 6, lg: 6, xl: 4 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Transform.toString(transform) : undefined,
                opacity: isOverlay ? .6 : 1
            }}
        >
            {isDragging ? (
                // <PlaceholderWidget />
                <></>
            ) : (
                <WidgetContainer editMode={editMode} onDelete={onDelete}>
                    <SystemMonitorWidget />
                </WidgetContainer>
            )}
        </Grid2>
    );
};
