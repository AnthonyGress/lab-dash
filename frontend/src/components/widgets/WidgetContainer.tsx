import { Card } from '@mui/material';
import React from 'react';

import { COLORS } from '../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    isOverlay?: boolean;
};

export const WidgetContainer: React.FC<Props> = ({ children, editMode, isOverlay = false }) => {
    return (
        <Card
            sx={{
                width: '90%',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.TRANSPARENT_GRAY,
                border: 'none', // No dashed border for overlay
                cursor: editMode ? 'grab' : 'auto',
                boxShadow: 2,
                borderRadius: 2,
                padding: 2,
                opacity: isOverlay ? 0.5 : 1,
            }}
        >
            {children}
        </Card>
    );
};
