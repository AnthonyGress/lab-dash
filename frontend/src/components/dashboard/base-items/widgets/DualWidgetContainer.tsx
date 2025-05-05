import { Card, CardContent } from '@mui/material';
import React from 'react';

import { EditMenu } from './EditMenu';
import { StatusIndicator } from './StatusIndicator';
import { COLORS } from '../../../../theme/styles';

type DualWidgetContainerProps = {
    children: React.ReactNode;
    editMode?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
    url?: string;
};

export const DualWidgetContainer: React.FC<DualWidgetContainerProps> = ({
    children,
    editMode = false,
    onEdit,
    onDelete,
    url
}) => {
    return (
        <Card
            sx={{
                width: '100%',
                height: '100%',
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
            <EditMenu editMode={editMode} onEdit={onEdit} onDelete={onDelete} />

            <CardContent
                sx={{
                    flex: 1,
                    p: 0.25,
                    '&:last-child': {
                        pb: 0.25
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                    justifyContent: 'center'
                }}
            >
                {children}
            </CardContent>

            <StatusIndicator url={url} />
        </Card>
    );
};
