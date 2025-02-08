import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Grid2, Paper, Typography } from '@mui/material';
import React from 'react';

import { styles } from '../../theme/styles';
import { WeatherWidget } from '../widgets/WeatherWidget';

type Props = {
  id: string;
  isOverlay?: boolean;
  editMode: boolean;
};

export const SortableWeatherWidget: React.FC<Props> = ({ id, editMode, isOverlay = false }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

    return (
        <Grid2
            size={{ xs: 3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                opacity: isDragging ? 0.3 : 1,
                transition,
                transform: CSS.Transform.toString(transform),
            }}
        >
            {/* <Paper
                sx={{
                    p: 2,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isOverlay ? 'rgba(0, 0, 255, 0.2)' : '#f5f5f5',
                    border: isOverlay ? '2px dashed blue' : 'none',
                    cursor: editMode ? 'grab' : 'auto',
                }}
            > */}
            <Card sx={{
                ...styles.widgetContainer,
                backgroundColor: isOverlay ? 'rgba(0, 0, 255, 0.2)' : '#f5f5f5',
                border: isOverlay ? '2px dashed blue' : 'none',
                cursor: editMode ? 'grab' : 'auto', }}
            >
                <WeatherWidget />
            </Card>
            {/* </Paper> */}
        </Grid2>
    );
};
