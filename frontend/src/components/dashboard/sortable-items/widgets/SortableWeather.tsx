import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 } from '@mui/material';
import React from 'react';

import { WeatherWidget } from '../../base-items/widgets/WeatherWidget';
import { WidgetContainer } from '../../base-items/widgets/WidgetContainer';


type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
};

export const SortableWeatherWidget: React.FC<Props> = ({ id, editMode, isOverlay = false, onDelete, onEdit }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 4 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                opacity: isOverlay ? .6 : 1,
                visibility: isDragging ? 'hidden' : 'visible'
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit}>
                <WeatherWidget />
            </WidgetContainer>
        </Grid2>
    );
};
