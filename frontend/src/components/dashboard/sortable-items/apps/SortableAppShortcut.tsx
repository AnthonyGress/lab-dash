import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Grid2 } from '@mui/material';
import React from 'react';

import { ITEM_TYPE } from '../../../../types';
import { AppShortcut } from '../../base-items/apps/AppShortcut';
import { WidgetContainer } from '../../base-items/widgets/WidgetContainer';

type Props = {
    id: string;
    url?: string;
    name: string;
    iconName: string;
    editMode: boolean;
    isOverlay?: boolean;
    isPreview?: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
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
    isPreview = false,
    onDelete,
    onEdit,
    onDuplicate,
    showLabel,
    config
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: {
            type: ITEM_TYPE.APP_SHORTCUT
        },
        animateLayoutChanges: ({ isSorting, wasDragging, isDragging: isCurrentlyDragging }) => {
            if (isSorting && isCurrentlyDragging) return true;
            if (wasDragging && !isCurrentlyDragging) return false;
            return true;
        },
    });

    // Only show label in overlay when dragging, or when not dragging at all
    const shouldShowLabel = showLabel && (isOverlay || isPreview || !isDragging);

    // Use healthUrl for status checking if available
    const healthUrl = config?.healthUrl;
    const healthCheckType = config?.healthCheckType || 'http';
    const statusUrl = healthUrl || url;

    return (
        <Grid2
            size={{ xs: 4, sm: 4, md: 2, lg: 4 / 3, xl: 4 / 3 }}
            ref={!isOverlay ? setNodeRef : undefined}
            {...(!isOverlay ? attributes : {})}
            {...(!isOverlay ? listeners : {})}
            sx={{
                transition: isDragging ? 'none' : transition,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                opacity: isOverlay ? 0.6 : (isDragging ? 0 : 1),
            }}
            data-type={ITEM_TYPE.APP_SHORTCUT}
            data-id={id}
            data-preview={isPreview ? 'true' : 'false'}
        >
            <WidgetContainer
                editMode={editMode}
                id={id}
                onDelete={onDelete}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                appShortcut
                url={statusUrl}
                healthCheckType={healthCheckType}
                isPreview={isPreview}
            >
                <AppShortcut
                    url={url}
                    name={isPreview ? `${name} (Drop Here)` : name}
                    iconName={iconName}
                    showLabel={shouldShowLabel}
                    editMode={editMode}
                    config={config}
                    isPreview={isPreview}
                />
            </WidgetContainer>
        </Grid2>
    );
};
