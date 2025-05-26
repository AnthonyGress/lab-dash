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
    onDuplicate?: () => void;
    row?: boolean;
};

export const BlankWidget: React.FC<Props> = ({ id, label, editMode, isOverlay = false, onDelete, onEdit, onDuplicate, row }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 12, sm: row ? 12 : 6, md: row ? 12 : 6, lg: row ? 12 : 4 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                opacity: isOverlay ? .6 : 1,
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                visibility: isDragging ? 'hidden' : 'visible',
            }}
        >
            <WidgetContainer editMode={editMode} id={id} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} placeholder rowPlaceholder={row}>
                <Typography variant='h6' textAlign='center'>
                    {/* {label} */}
                </Typography>
            </WidgetContainer>
        </Grid2>
    );
};
