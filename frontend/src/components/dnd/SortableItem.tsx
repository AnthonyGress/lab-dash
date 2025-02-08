import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid, Paper, Typography } from '@mui/material';
import React from 'react';

type Props = {
    id: string;
    label?: string;
    isOverlay?: boolean;
    isPlaceholder?: boolean;
    editMode: boolean;
};

export const SortableItem: React.FC<Props> = ({ id, label, editMode, isOverlay = false, isPlaceholder = false }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id });

    return (
        <Grid
            item
            xs={6}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                opacity: isDragging ? 0.3 : 1,
                transition,
                transform: CSS.Transform.toString(transform),
            }}
        >
            <Paper
                sx={{
                    p: 2,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isOverlay ? 'rgba(0, 0, 255, 0.2)' : isPlaceholder ? 'transparent' : '#f5f5f5',
                    border: isOverlay ? '2px dashed blue' : isPlaceholder ? '2px dashed lightgray' : 'none',
                    cursor: editMode && !isPlaceholder ? 'grab' : 'auto',
                    visibility: isPlaceholder ? 'hidden' : 'visible',
                }}
            >
                <Typography>{label}</Typography>
            </Paper>
        </Grid>
    );
};
