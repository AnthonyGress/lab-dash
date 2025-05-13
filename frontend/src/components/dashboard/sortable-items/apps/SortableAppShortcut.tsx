import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React from 'react';

import { ITEM_TYPE } from '../../../../types';
import { AppShortcut } from '../../base-items/apps/AppShortcut';
import { WidgetContainer } from '../../base-items/widgets/WidgetContainer';

type Props = {
    id: string;
    url: string;
    name: string;
    iconName: string;
    editMode: boolean;
    isOverlay?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
    showLabel?: boolean;
    config?: any;
};

export const SortableAppShortcut: React.FC<Props> = ({
    id,
    url,
    name,
    iconName,
    editMode,
    isOverlay = false,
    onDelete,
    onEdit,
    showLabel,
    config
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: {
            type: ITEM_TYPE.APP_SHORTCUT
        }
    });

    // Only show label in overlay when dragging, or when not dragging at all
    const shouldShowLabel = showLabel && (isOverlay || !isDragging);

    // Use healthUrl for status checking if available
    const healthUrl = config?.healthUrl;
    const healthCheckType = config?.healthCheckType || 'http';
    const statusUrl = healthUrl || url;

    return (
        <Grid2
            size={{ xs: 4 , sm: 4, md: 2, lg: 4/3, xl: 4/3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                pointerEvents: isDragging ? 'none' : 'auto',
                opacity: isOverlay ? .6 : 1,
                visibility: isDragging ? 'hidden' : 'visible'
            }}
            data-type={ITEM_TYPE.APP_SHORTCUT}
            data-id={id}
        >
            <WidgetContainer
                editMode={editMode}
                onDelete={onDelete}
                onEdit={onEdit}
                appShortcut
                url={statusUrl}
                healthCheckType={healthCheckType}
            >
                <AppShortcut
                    url={url}
                    name={name}
                    iconName={iconName}
                    showLabel={shouldShowLabel}
                    editMode={editMode}
                    config={config}
                />
            </WidgetContainer>
        </Grid2>
    );
};
