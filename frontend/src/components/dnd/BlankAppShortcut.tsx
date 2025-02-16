import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 } from '@mui/material';
import React from 'react';

import { styles } from '../../theme/styles';
import { AppShortcut } from '../AppShortcut';
import { WidgetContainer } from '../widgets/WidgetContainer';

type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
};

export const BlankAppShortcut: React.FC<Props> = ({ id, editMode, isOverlay = false, onDelete, onEdit }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <Grid2
            size={{ xs: 6 , sm: 4 , md: 4, lg: 4/3, xl: 4/3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Transform.toString(transform) : undefined,
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit} appShortcut placeholder>
                {/* <AppShortcut url={url} name={name} iconName={iconName} /> */}
                <Box sx={{ ...styles.shortcutIcon, height: '6rem' }}/>
            </WidgetContainer>
        </Grid2>
    );
};
