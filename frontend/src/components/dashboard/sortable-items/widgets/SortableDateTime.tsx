import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React from 'react';

import { DateTimeWidget } from '../../base-items/widgets/DateTimeWidget';
import { WidgetContainer } from '../../base-items/widgets/WidgetContainer';

type DateTimeConfig = {
    location?: {
        name: string;
        latitude: number;
        longitude: number;
    } | null;
    timezone?: string;
};

type Props = {
    id: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
    // Accept any config type
    config?: Record<string, any>;
};

export const SortableDateTimeWidget: React.FC<Props> = ({ id, editMode, isOverlay = false, onDelete, onEdit, config }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    // Ensure we have a properly typed config for the DateTimeWidget
    // Only extract the properties we need, ignore the rest
    const dateTimeConfig: DateTimeConfig = {
        location: config?.location || null,
        timezone: config?.timezone || undefined
    };

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
                visibility: isDragging ? 'hidden' : 'visible',
            }}
        >
            <WidgetContainer editMode={editMode} onDelete={onDelete} onEdit={onEdit}>
                <DateTimeWidget config={dateTimeConfig} />
            </WidgetContainer>
        </Grid2>
    );
};
