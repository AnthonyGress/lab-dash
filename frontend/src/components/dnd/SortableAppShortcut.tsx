import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 as Grid, Grid2 } from '@mui/material';
import React from 'react';

import { AppShortcut } from '../AppShortcut';
import { WidgetContainer } from '../widgets/WidgetContainer';

type Props = {
    id: string;
    url: string;
    name: string;
    iconName: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
};

export const SortableAppShortcut: React.FC<Props> = ({ id, url, name, iconName, editMode, isOverlay = false, onDelete, onEdit }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 6 , sm: 4 , md: 4, lg: 2, xl: 4/3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Transform.toString(transform) : undefined,
            }}
        >
            {isDragging ? (
                // <Box
                //     sx={{
                //         width: '100%',
                //         height: 200,
                //         backgroundColor: 'rgba(47, 46, 46, 1)',
                //         border: '2px dashed gray',
                //         borderRadius: 2,
                //     }}
                // />
                <></>
            ) : (
                <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit} appShortcut>
                    <AppShortcut url={url} name={name} iconName={iconName} />
                </WidgetContainer>
            )}
        </Grid2>
    );
};
