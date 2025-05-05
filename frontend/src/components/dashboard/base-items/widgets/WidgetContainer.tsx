import { Card } from '@mui/material';
import React from 'react';

import { EditMenu } from './EditMenu';
import { StatusIndicator } from './StatusIndicator';
import { COLORS } from '../../../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    onEdit?: () => void
    onDelete?: () => void;
    appShortcut?: boolean;
    placeholder?: boolean;
    url?: string;
    healthCheckType?: 'http' | 'ping';
    rowPlaceholder?: boolean;
};

export const WidgetContainer: React.FC<Props> = ({
    children,
    editMode,
    onEdit,
    onDelete,
    appShortcut=false,
    placeholder=false,
    url,
    healthCheckType='http',
    rowPlaceholder
}) => {
    return (
        <Card
            sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                flexGrow: 1,
                minHeight: appShortcut || rowPlaceholder ? '6rem' : { xs: '12rem' },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: placeholder ? 'transparent' : COLORS.TRANSPARENT_GRAY,
                borderRadius: 2,
                border: placeholder && editMode ? 'none' : !placeholder ? `1px solid ${COLORS.BORDER}` : 'none',
                padding: 0,
                cursor: editMode ? 'grab' : !placeholder ? 'auto' : 'auto',
                boxShadow: placeholder ? 0 : 2,
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
                backdropFilter: placeholder ? 'none' : '6px'
            }}
        >
            <EditMenu editMode={editMode} onEdit={onEdit} onDelete={onDelete} />
            {children}
            <StatusIndicator url={url} healthCheckType={healthCheckType} />
        </Card>
    );
};
