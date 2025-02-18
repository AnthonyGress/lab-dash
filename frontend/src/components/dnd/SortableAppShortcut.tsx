import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
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
            size={{ xs: 4 , sm: 4 , md: 4, lg: 4/3, xl: 4/3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit} appShortcut url={url}>
                <AppShortcut url={url} name={name} iconName={iconName} />
            </WidgetContainer>
        </Grid2>
    );
};
