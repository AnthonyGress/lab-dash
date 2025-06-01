import { useState } from 'react';

import { initialItems } from '../../constants/constants';
import { useAppContext } from '../../context/useAppContext';
import { SetupModal } from '../modals/SetupModal';

type SetupFormProps = {
    onSuccess: () => void;
};

export const SetupForm: React.FC<SetupFormProps> = ({ onSuccess }) => {
    const [showSetupModal, setShowSetupModal] = useState(true);
    const { updateConfig } = useAppContext();

    const handleSetupComplete = async () => {
        // Mark setup as complete and save initial items to the layout
        await updateConfig({
            isSetupComplete: true,
            search: true,
            searchProvider: {
                name: 'Google',
                url: 'https://www.google.com/search?q={query}'
            },
            layout: {
                desktop: initialItems,
                mobile: initialItems
            }
        });
        onSuccess();
    };

    return (
        <SetupModal open={showSetupModal} onComplete={handleSetupComplete} />
    );
};
