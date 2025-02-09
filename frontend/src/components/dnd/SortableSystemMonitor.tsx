import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React from 'react';

import { SystemMonitorWidget } from '../widgets/SystemMonitorWidget/SystemMonitorWidget';
import { WidgetContainer } from '../widgets/WidgetContainer';


type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
};

export const SortableSystemMonitorWidget: React.FC<Props> = ({ id, editMode, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 12, md: 6, lg: 6, xl: 4 }} // Corrected Grid2 sizing
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                opacity: isDragging ? 0.3 : 1,
                transition,
                transform: transform ? CSS.Transform.toString(transform) : undefined, // Fix type error
            }}
        >
            <WidgetContainer editMode={editMode} isOverlay={isOverlay}>
                <SystemMonitorWidget />
            </WidgetContainer>
        </Grid2>
    );
};
