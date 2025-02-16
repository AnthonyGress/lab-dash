import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2, Typography } from '@mui/material';
import React from 'react';

import { WidgetContainer } from '../widgets/WidgetContainer';

type Props = {
    id: string;
    label?: string;
    isOverlay?: boolean;
    editMode: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
};

export const BlankWidget: React.FC<Props> = ({ id, label, editMode, isOverlay = false, onDelete, onEdit }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 12, md: 6, lg: 4 }} // Match size with widgets
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                opacity: isOverlay ? .6 : 1,
                transition,
                transform: transform ? CSS.Transform.toString(transform) : undefined,
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit} placeholder>
                <Typography variant='h6' textAlign='center'>
                    {/* {label} */}
                </Typography>
            </WidgetContainer>
        </Grid2>
    );
};
