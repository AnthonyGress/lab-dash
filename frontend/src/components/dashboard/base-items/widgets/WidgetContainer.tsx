import { Card } from '@mui/material';
import React from 'react';

import { EditMenu } from './EditMenu';
import { StatusIndicator } from './StatusIndicator';
import { COLORS } from '../../../../theme/styles';

type Props = {
    children: React.ReactNode;
    editMode: boolean;
    id?: string;
    onEdit?: () => void
    onDelete?: () => void;
    onDuplicate?: () => void;
    placeholder?: boolean;
    url?: string;
    healthCheckType?: 'http' | 'ping';
    groupItem?: boolean;
    isHighlighted?: boolean;
    isPreview?: boolean;
};

export const WidgetContainer: React.FC<Props> = ({
    children,
    editMode,
    id,
    onEdit,
    onDelete,
    onDuplicate,
    placeholder=false,
    url,
    healthCheckType='http',
    groupItem,
    isHighlighted = false,
    isPreview = false
}) => {
    return (
        <Card
            sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                flexGrow: 1,
                height: '100%',
                // Lets content size itself from the cell (cqw/cqh units, @container rules)
                containerType: 'size',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isHighlighted ? 'rgba(255, 255, 255, 0.13)' :
                    isPreview ? 'rgba(76, 175, 80, 0.05)' :
                        placeholder || groupItem ? 'transparent' : COLORS.TRANSPARENT_GRAY,
                borderRadius: 2,
                border: isPreview ? `2px dashed ${COLORS.LIGHT_GRAY_HOVER}` :
                    placeholder && editMode ? 'none' : !placeholder ? `1px solid ${COLORS.BORDER}` : 'none',
                padding: 0,
                cursor: editMode ? 'grab' : !placeholder ? 'auto' : 'auto',
                boxShadow: placeholder ? 0 : 2,
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
                backdropFilter: placeholder || groupItem ? 'none' : '6px',
                transition: 'background-color 0.3s ease, outline 0.3s ease',
                ...(isPreview && {
                    animation: 'pulse 2s infinite ease-in-out',
                    '@keyframes pulse': {
                        '0%': { opacity: 0.7 },
                        '50%': { opacity: 9 },
                        '100%': { opacity: 0.7 }
                    }
                })
            }}
            data-preview={isPreview ? 'true' : 'false'}
        >
            {!isPreview && <EditMenu editMode={editMode} itemId={id} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />}
            {children}
            {!isPreview && <StatusIndicator itemId={id} url={url} healthCheckType={healthCheckType} />}
        </Card>
    );
};
