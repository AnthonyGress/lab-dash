import React from 'react';

import { WidgetContainer } from '../widgets/WidgetContainer';

type Props = {
    id: string;
    editMode: boolean;
    onDelete?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
};

export const BlankAppShortcut: React.FC<Props> = ({ id, editMode, onDelete, onEdit, onDuplicate }) => (
    <WidgetContainer editMode={editMode} id={id} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} placeholder>
        {null}
    </WidgetContainer>
);
