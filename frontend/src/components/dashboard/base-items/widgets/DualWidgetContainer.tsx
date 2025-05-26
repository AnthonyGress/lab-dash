import { Card, CardContent, useMediaQuery } from '@mui/material';
import React from 'react';

import { EditMenu } from './EditMenu';
import { StatusIndicator } from './StatusIndicator';
import { DUAL_WIDGET_CONTAINER_HEIGHT } from '../../../../constants/widget-dimensions';
import { COLORS } from '../../../../theme/styles';
import { theme } from '../../../../theme/theme';

type DualWidgetContainerProps = {
    children: React.ReactNode;
    editMode?: boolean;
    id?: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    url?: string;
};

export const DualWidgetContainer: React.FC<DualWidgetContainerProps> = ({
    children,
    editMode = false,
    id,
    onEdit,
    onDelete,
    onDuplicate,
    url
}) => {
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Card
            sx={{
                width: '100%',
                height: isMobile ? 'auto' : '100%',
                maxWidth: '100%',
                minWidth: 0,
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.TRANSPARENT_GRAY,
                borderRadius: 2,
                border: `1px solid ${COLORS.BORDER}`,
                padding: 0,
                cursor: editMode ? 'grab' : 'auto',
                boxShadow: 2,
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
                backdropFilter: '6px'
            }}
        >
            <EditMenu editMode={editMode} itemId={id} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />

            <CardContent
                sx={{
                    flex: 1,
                    p: 1,
                    '&:last-child': {
                        pb: 0.25
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    height: isMobile ? 'auto' : '100%',
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    ...(isMobile ? {} : {
                        minHeight: '400px'
                    })
                }}
            >
                {children}
            </CardContent>
        </Card>
    );
};
