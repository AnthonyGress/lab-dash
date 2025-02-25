import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Grid2 } from '@mui/material';
import React from 'react';

import { styles } from '../../theme/styles';
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
            size={{ xs: 4 , sm: 3 , md: 5/3, lg: 4/3, xl: 4/3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                opacity: isOverlay ? .6 : 1,
                visibility: isDragging ? 'hidden' : 'visible',
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit} appShortcut placeholder>
                {/* <AppShortcut url={url} name={name} iconName={iconName} /> */}
                <Box sx={{ width: { xs: '50%', sm: '40%', md: '55%', lg: '50%', xl: '35%' } }} />
            </WidgetContainer>
        </Grid2>
    );
};
