import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 } from '@mui/material';
import React from 'react';

import { DateTimeWidget } from '../widgets/DateTimeWidget';
import { WidgetContainer } from '../widgets/WidgetContainer';

type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
};

export const SortableDateTime: React.FC<Props> = ({ id, editMode, isOverlay = false }) => {
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
            }}
        >
            {isDragging ? (
                <Box
                    sx={{
                        width: '100%',
                        height: 200,
                        backgroundColor: 'rgba(150, 150, 150, 0.3)',
                        border: '2px dashed gray',
                        borderRadius: 2,
                    }}
                />
            ) : (
                <WidgetContainer editMode={editMode}>
                    <DateTimeWidget />
                </WidgetContainer>
            )}
        </Grid2>
    );
};
