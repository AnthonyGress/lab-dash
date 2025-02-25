import React from 'react';

type Props = {
    editMode: boolean;
    children: React.ReactNode;
}

export const WiggleWrapper = ({ editMode, children }: Props) => {
    return (
        <div className={editMode ? 'wiggle-container' : ''}>
            {children}
        </div>
    );
};
